import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {readCsv} from './batch/csv.mjs';
import {validateInput} from './batch/policy.mjs';
import {Network} from './batch/network.mjs';
import {verifyArtist} from './batch/research.mjs';
import {writeReports} from './batch/reports.mjs';

const command=process.argv[2]||'help';
const options=parseOptions(process.argv.slice(3));
const input=path.resolve(options.input||'data/incoming/artists.csv');
const stateDir=path.resolve('.deep-cuts','batches');
const latestFile=path.join(stateDir,'latest.json');
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
let checkpointQueue=Promise.resolve();

if(command==='help'){help();process.exit(0)}
if(command==='status'){const state=await readLatest();console.log(JSON.stringify(state,null,2));process.exit(0)}
if(!['validate','test','run','resume','retry','force'].includes(command))throw new Error(`Unknown batch command: ${command}`);

const raw=await readCsv(input);const rows=validateInput(raw);
let state=(command==='resume'||command==='retry')?await readLatest():newState(rows,input,command);
if(command==='force'){
  const artist=options.artist;if(!artist)throw new Error('force requires --artist "Artist Name"');
  state=newState(rows.filter(row=>row.artist.toLowerCase()===artist.toLowerCase()),input,command);
  if(!state.artists.length)throw new Error(`Artist not found in CSV: ${artist}`);
}
if(command==='test')state.artists=state.artists.slice(0,2);
await checkpoint(state);

const existing=new Map(platform.editions.map(item=>[item.slug,item]));
const network=new Network({timeoutMs:Number(options.timeout||18000),retries:Number(options.retries||3)});
const concurrency=Math.max(1,Math.min(5,Number(options.concurrency||3)));
const queue=state.artists.filter(item=>shouldProcess(item,command));
await workers(queue,concurrency,async item=>{
  item.attempts=(item.attempts||0)+1;item.startedAt=item.startedAt||new Date().toISOString();item.buildStatus='verifying';await checkpoint(state);
  try{
    if(existing.has(item.slug)&&command!=='force'){
      const edition=existing.get(item.slug);Object.assign(item,{buildStatus:'skipped_completed',deploymentStatus:'already_deployed',postDeploymentStatus:'previously_verified',liveURL:`${platform.publicBaseURL}${edition.canonicalPath}`,finishedAt:new Date().toISOString()});return;
    }
    const verified=await verifyArtist(item,network,{offline:options.offline==='true'});
    Object.assign(item,{confidence:verified.confidence,sourceCount:verified.sourceCount,evidence:verified.evidence,reasons:verified.errors,verifiedRow:verified.row});
    if(verified.errors.length||verified.confidence<98){item.buildStatus='rejected';item.finishedAt=new Date().toISOString();return;}
    if(command==='validate'||options.publish==='false'||command==='test'){item.buildStatus='validated';item.deploymentStatus='not_requested';item.finishedAt=new Date().toISOString();return;}
    item.buildStatus='verified';item.deploymentStatus='awaiting_configuration';item.finishedAt=new Date().toISOString();
  }catch(error){item.buildStatus='technical_failure';item.reasons=[{code:'TECHNICAL_FAILURE',message:error.message}];item.finishedAt=new Date().toISOString();}
  finally{await checkpoint(state)}
});
if(!['validate','test'].includes(command)&&options.publish!=='false'){
  for(const item of state.artists.filter(value=>value.buildStatus==='verified')){
    try{
      const created=await createEdition(item);Object.assign(item,{buildStatus:'configured',editionId:created.editionId,liveURL:`${platform.publicBaseURL}${created.canonicalPath}`,deploymentStatus:'pending_merge',postDeploymentStatus:'pending_deployment',finishedAt:new Date().toISOString()});
    }catch(error){item.buildStatus='technical_failure';item.deploymentStatus='not_started';item.reasons=[{code:'CONFIGURATION_FAILURE',message:error.message}];item.finishedAt=new Date().toISOString()}
    await checkpoint(state);
  }
}
state.finishedAt=new Date().toISOString();state.durationMs=new Date(state.finishedAt)-new Date(state.startedAt);state.counts=counts(state.artists);await checkpoint(state);await writeReports(state);
console.log(JSON.stringify({ok:true,batchId:state.batchId,counts:state.counts,summary:'reports/LATEST_BATCH_SUMMARY.md'},null,2));

async function createEdition(item){
  const row=item.verifiedRow;const now=new Date().toISOString();
  await run(process.execPath,['scripts/start-edition.mjs',row.artist]);
  const sources=Object.entries(item.evidence).map(([destination,value])=>({destination,url:value.url,sourceType:destination==='newsReviews'?'credible music editorial':'official destination verified by unattended batch',identityVerified:true,credibleEditorial:destination==='newsReviews'?true:undefined,verifiedAt:value.verifiedAt,evidence:value.evidence}));
  const research={bandName:row.artist,bio:`${row.location} ${row.genre} artist ${row.artist}.`,newsLabel:'Latest verified interview or review',links:{buyMusic:item.evidence.buyMusic.url,spotify:item.evidence.spotify.url,instagram:item.evidence.instagram.url,bandcamp:item.evidence.bandcamp.url,youtube:item.evidence.youtube.url,facebook:item.evidence.facebook.url,website:item.evidence.website.url,merchandise:item.evidence.merchandise.url,newsReviews:item.evidence.newsReviews.url},featuredVideo:{title:`${row.artist} — featured official video`,youtubeURL:item.evidence.featuredVideo.url,selectionBasis:'most-viewed-official'},sources};
  const file=path.join('.deep-cuts','batches',state.batchId,`${row.slug}-research.json`);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(research,null,2)+'\n');
  const output=await run(process.execPath,['scripts/create-edition.mjs',file]);return JSON.parse(output);
}

function newState(rows,inputPath,mode){const startedAt=new Date().toISOString();return{schemaVersion:1,batchId:`batch_${startedAt.replace(/\D/g,'').slice(0,14)}_${crypto.randomBytes(3).toString('hex')}`,mode,inputPath,startedAt,finishedAt:null,durationMs:null,artists:rows.map(row=>({...row,buildStatus:'pending',deploymentStatus:'not_started',postDeploymentStatus:'not_started',confidence:null,sourceCount:0,reasons:[],attempts:0})),counts:counts([])}}
function shouldProcess(item,mode){if(mode==='retry')return item.buildStatus==='technical_failure';return ['pending','verifying','technical_failure'].includes(item.buildStatus)}
function counts(items){return{total:items.length,valid:items.filter(item=>!item.inputErrors?.length).length,completed:items.filter(item=>['configured','validated'].includes(item.buildStatus)).length,deployed:items.filter(item=>item.deploymentStatus==='deployed').length,rejected:items.filter(item=>item.buildStatus==='rejected').length,technicalFailures:items.filter(item=>item.buildStatus==='technical_failure').length,skippedCompleted:items.filter(item=>item.buildStatus==='skipped_completed').length}}
function checkpoint(value){
  value.counts=counts(value.artists);const snapshot=JSON.stringify(value,null,2)+'\n';
  checkpointQueue=checkpointQueue.then(async()=>{await fs.mkdir(path.join(stateDir,value.batchId),{recursive:true});const file=path.join(stateDir,value.batchId,'state.json');await fs.writeFile(file,snapshot);await fs.writeFile(latestFile,snapshot)});
  return checkpointQueue;
}
async function readLatest(){return JSON.parse(await fs.readFile(latestFile,'utf8').catch(()=>{throw new Error('No resumable batch exists.')}))}
async function workers(items,count,handler){let cursor=0;await Promise.all(Array.from({length:Math.min(count,items.length)},async()=>{while(cursor<items.length){const item=items[cursor++];await handler(item)}}))}
function run(executable,args){return new Promise((resolve,reject)=>{let stdout='',stderr='';const child=spawn(executable,args,{stdio:['ignore','pipe','pipe']});child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.on('close',code=>code===0?resolve(stdout.trim()):reject(new Error(stderr.trim()||`${args[0]} failed with exit ${code}`)))})}
function parseOptions(args){const result={};for(let i=0;i<args.length;i++){if(!args[i].startsWith('--'))continue;const key=args[i].slice(2);result[key]=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:'true'}return result}
function help(){console.log(`Deep Cuts unattended batch\n\n  npm run deepcuts:batch -- validate --input <artists.csv>\n  npm run deepcuts:batch -- test --input <artists.csv>\n  npm run deepcuts:batch -- run --input <artists.csv>\n  npm run deepcuts:batch -- status\n  npm run deepcuts:batch -- resume\n  npm run deepcuts:batch -- retry\n  npm run deepcuts:batch -- force --input <artists.csv> --artist "Artist Name"\n`)}
