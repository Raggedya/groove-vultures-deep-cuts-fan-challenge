import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {readCsv,csvText} from "./batch/csv.mjs";
import {researchStudioJookBox,StudioResearchNetwork} from "./studio-jookbox-research.mjs";
import {
  JOOKBOX_BAND_BATCH_SCHEMA,
  JOOKBOX_BAND_CONFIDENCE_GATE,
  bandRowsFromMaster,
  bandResearchInput,
  factoryResearchFromStudio,
  youtubeReportRow,
  batchFingerprint
} from "./jookbox-band-batch-lib.mjs";

const command=process.argv[2]||"help";
const options=parseOptions(process.argv.slice(3));
const stateRoot=path.resolve(".deep-cuts","jookbox-band-batches");
const latestPath=path.join(stateRoot,"latest.json");
let checkpointQueue=Promise.resolve();

if(command==="help"){help();process.exit(0)}
if(command==="status"){
  const state=await readLatest();
  console.log(JSON.stringify(summary(state),null,2));
  process.exit(0);
}
if(!["validate","test","run","resume","retry","recheck"].includes(command))throw new Error(`Unknown JookBox band batch command: ${command}`);

let state;
if(["resume","retry","recheck"].includes(command)){
  state=await readLatest();
}else{
  const inputPath=path.resolve(options.input||"");
  if(!options.input)throw new Error(`${command} requires --input <master.csv>.`);
  const rows=bandRowsFromMaster(await readCsv(inputPath));
  if(!rows.length)throw new Error("The master file contains no Music / Band records.");
  state=newState(rows,inputPath,command);
  if(command==="test")state.items=state.items.slice(0,Math.max(1,Math.min(5,Number(options.limit||2))));
  if(options.limit)state.items=state.items.slice(0,Math.max(1,Number(options.limit)));
}
await checkpoint(state);

if(command==="validate"){
  for(const item of state.items)item.status="input_validated";
  state.finishedAt=new Date().toISOString();
  await finish(state);
  process.exit(0);
}

const platform=JSON.parse(await fs.readFile("platform.json","utf8"));
const existingNames=new Map(platform.editions.map(edition=>[String(edition.name||"").toLowerCase(),edition]));
const existingSlugs=new Map(platform.editions.map(edition=>[edition.slug,edition]));
const network=new StudioResearchNetwork({
  timeoutMs:Math.max(5000,Number(options.timeout||18000)),
  retries:Math.max(1,Math.min(4,Number(options.retries||3)))
});
const queue=state.items.filter(item=>shouldProcess(item,command));
const concurrency=Math.max(1,Math.min(5,Number(options.concurrency||3)));
let completed=0;

await workers(queue,concurrency,async item=>{
  const existing=existingNames.get(item.name.toLowerCase())||existingSlugs.get(slugify(item.name));
  if(existing){
    Object.assign(item,{status:"skipped_existing",editionId:existing.editionId,liveURL:`${platform.publicBaseURL}${existing.canonicalPath}`,finishedAt:new Date().toISOString()});
    await checkpoint(state);return;
  }
  item.status="researching";item.attempts=(item.attempts||0)+1;item.startedAt=item.startedAt||new Date().toISOString();
  await checkpoint(state);
  try{
    item.research=await researchStudioJookBox(bandResearchInput(item),{
      network,
      onProgress:update=>{item.researchStage=update.stage;item.researchMessage=update.message}
    });
    item.confidence=item.research.confidence;
    item.blockers=item.research.blockers;
    item.status=item.research.passed&&item.research.confidence>=JOOKBOX_BAND_CONFIDENCE_GATE?"verified":"rejected";
  }catch(error){
    item.status="technical_failure";item.reasons=[{code:error.code||"RESEARCH_FAILURE",message:error.message}];
  }
  item.finishedAt=new Date().toISOString();
  completed+=1;
  console.log(`[${completed}/${queue.length}] ${item.status.toUpperCase()} — ${item.name}${item.confidence?` (${item.confidence}%)`:""}`);
  await checkpoint(state);
});

if(command!=="test"&&options.publish!=="false"){
  const verified=state.items.filter(item=>item.status==="verified");
  for(const [index,item] of verified.entries()){
    item.status="configuring";await checkpoint(state);
    try{
      const created=await configureEdition(item,state);
      Object.assign(item,{
        status:"configured",
        editionId:created.editionId,
        liveURL:`${platform.publicBaseURL}${created.canonicalPath}`,
        qrArtworkVariant:"aggits-character-poster/1",
        deploymentStatus:"pending_merge",
        emailStatus:"pending_deployment"
      });
      console.log(`[${index+1}/${verified.length}] CONFIGURED — ${item.name} — ${item.editionId}`);
    }catch(error){
      item.status="technical_failure";item.reasons=[{code:"CONFIGURATION_FAILURE",message:error.message}];
    }
    item.finishedAt=new Date().toISOString();await checkpoint(state);
  }
}

state.finishedAt=new Date().toISOString();
await finish(state);

async function configureEdition(item,currentState){
  const research=factoryResearchFromStudio(item.research);
  await run(process.execPath,["scripts/start-edition.mjs",item.name]);
  const directory=path.join(stateRoot,currentState.batchId,"research");
  await fs.mkdir(directory,{recursive:true});
  const file=path.join(directory,`${slugify(item.name)}.json`);
  await fs.writeFile(file,`${JSON.stringify(research,null,2)}\n`);
  return JSON.parse(await run(process.execPath,["scripts/create-edition.mjs",file]));
}

async function finish(currentState){
  currentState.counts=counts(currentState.items);
  await checkpoint(currentState);
  await writeReports(currentState);
  console.log(JSON.stringify(summary(currentState),null,2));
}

async function writeReports(currentState){
  const rows=currentState.items.map(youtubeReportRow);
  const columns=["Record ID","Band Name","Factory Status","Confidence","Official YouTube Channel","Most Popular Verified Video Title","Most Popular Verified Video URL","Selection Basis","Verified At","Permanent URL","Edition ID","QR Poster Variant","Failure / Omission Reason"];
  await fs.mkdir("reports",{recursive:true});
  await Promise.all([
    fs.writeFile("reports/JOOKBOX_BAND_YOUTUBE_VERIFICATION.csv",csvText(rows,columns)),
    fs.writeFile("reports/JOOKBOX_BAND_BATCH_SUMMARY.json",`${JSON.stringify(summary(currentState),null,2)}\n`),
    fs.writeFile("reports/JOOKBOX_BAND_REJECTIONS.csv",csvText(rows.filter(row=>!["configured","skipped_existing"].includes(row["Factory Status"])),columns))
  ]);
}

function newState(items,inputPath,mode){
  const startedAt=new Date().toISOString();
  return{
    schemaVersion:JOOKBOX_BAND_BATCH_SCHEMA,
    batchId:`jookbox_band_${startedAt.replace(/\D/g,"").slice(0,14)}_${crypto.randomBytes(3).toString("hex")}`,
    mode,inputPath,startedAt,finishedAt:null,
    inputFingerprint:batchFingerprint(items),
    recipient:"andrewharris501@gmail.com",
    qrArtworkVariant:"aggits-character-poster/1",
    items:items.map(item=>({...item,status:"pending",attempts:0,confidence:null,blockers:[],reasons:[],editionId:"",liveURL:""})),
    counts:counts([])
  };
}
function shouldProcess(item,mode){
  if(mode==="retry")return item.status==="technical_failure";
  if(mode==="recheck")return["rejected","technical_failure"].includes(item.status);
  return["pending","researching","technical_failure"].includes(item.status);
}
function counts(items){return{
  total:items.length,
  verified:items.filter(item=>["verified","configuring","configured"].includes(item.status)).length,
  configured:items.filter(item=>item.status==="configured").length,
  rejected:items.filter(item=>item.status==="rejected").length,
  technicalFailures:items.filter(item=>item.status==="technical_failure").length,
  skippedExisting:items.filter(item=>item.status==="skipped_existing").length
}}
function summary(currentState){return{
  ok:true,schemaVersion:currentState.schemaVersion,batchId:currentState.batchId,mode:currentState.mode,
  inputPath:currentState.inputPath,inputFingerprint:currentState.inputFingerprint,
  startedAt:currentState.startedAt,finishedAt:currentState.finishedAt,
  recipient:currentState.recipient,qrArtworkVariant:currentState.qrArtworkVariant,
  counts:counts(currentState.items),report:"reports/JOOKBOX_BAND_YOUTUBE_VERIFICATION.csv"
}}
function checkpoint(value){
  value.counts=counts(value.items);
  const text=`${JSON.stringify(value,null,2)}\n`;
  checkpointQueue=checkpointQueue.then(async()=>{
    await fs.mkdir(path.join(stateRoot,value.batchId),{recursive:true});
    await Promise.all([fs.writeFile(path.join(stateRoot,value.batchId,"state.json"),text),fs.writeFile(latestPath,text)]);
  });
  return checkpointQueue;
}
async function readLatest(){return JSON.parse(await fs.readFile(latestPath,"utf8").catch(()=>{throw new Error("No resumable Band JookBox batch exists.")}))}
async function workers(items,count,handler){let cursor=0;await Promise.all(Array.from({length:Math.min(count,items.length)},async()=>{while(cursor<items.length)await handler(items[cursor++])}))}
function run(executable,args){return new Promise((resolve,reject)=>{let stdout="",stderr="";const child=spawn(executable,args,{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]});child.stdout.on("data",chunk=>stdout+=chunk);child.stderr.on("data",chunk=>stderr+=chunk);child.once("error",reject);child.once("close",code=>code===0?resolve(stdout.trim()):reject(new Error(stderr.trim()||stdout.trim()||`${args[0]} exited with ${code}`)))})}
function slugify(value){return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function parseOptions(args){const result={};for(let index=0;index<args.length;index++){if(!args[index].startsWith("--"))continue;const key=args[index].slice(2);result[key]=args[index+1]&&!args[index+1].startsWith("--")?args[++index]:"true"}return result}
function help(){console.log(`Band JookBox unattended batch\n\n  npm run jookbox:bands -- validate --input <master.csv>\n  npm run jookbox:bands -- test --input <master.csv> --limit 2\n  npm run jookbox:bands -- run --input <master.csv>\n  npm run jookbox:bands -- status\n  npm run jookbox:bands -- resume\n  npm run jookbox:bands -- retry\n  npm run jookbox:bands -- recheck\n`)}
