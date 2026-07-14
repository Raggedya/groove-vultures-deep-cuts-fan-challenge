import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {findActiveBuild,finishBuild,startBuild} from './build-tracker.mjs';

const args=process.argv.slice(2);
const slug=args.find(value=>!value.startsWith('--'));
const deploy=args.includes('--deploy');
if(!slug){console.error('Usage: node scripts/publish-edition.mjs <edition-slug> [--deploy]');process.exit(1)}

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const entry=platform.editions.find(item=>item.slug===slug);
if(!entry)throw new Error(`Unknown edition: ${slug}`);
const edition=JSON.parse(await fs.readFile(entry.config,'utf8'));
let build=await findActiveBuild(slug);
if(!build){
  build=await startBuild({slug,artist:edition.bandName});
  console.warn(`No pre-research build record existed; started ${build.build_id} at publish time. Future one-prompt runs start tracking before research.`);
}

function run(command,commandArgs,{capture=false}={}){
  const result=spawnSync(command,commandArgs,{stdio:capture?'pipe':'inherit',encoding:capture?'utf8':undefined,shell:process.platform==='win32'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${command} ${commandArgs.join(' ')} failed with exit code ${result.status??1}`);
  return capture?String(result.stdout).trim():'';
}

async function verifyDeployment(url){
  const editionURL=new URL(url);editionURL.searchParams.set('build',build.build_id);
  let lastError;
  for(let attempt=1;attempt<=8;attempt++){
    try{
      const response=await fetch(editionURL,{redirect:'follow'});
      if(response.ok&&(await response.text()).includes('Deep Cuts'))return;
      lastError=new Error(`HTTP ${response.status}`);
    }catch(error){lastError=error}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  throw new Error(`Live deployment verification failed: ${lastError?.message||'unknown error'}`);
}

try{
  run(process.execPath,['scripts/build-edition.mjs',slug]);
  let gitCommit='';
  if(deploy){
    run('git',['add','--all']);
    const diff=spawnSync('git',['diff','--cached','--quiet'],{shell:process.platform==='win32'});
    if(diff.status!==0)run('git',['commit','-m',`Publish Deep Cuts edition: ${edition.bandName}`]);
    gitCommit=run('git',['rev-parse','--short','HEAD'],{capture:true});
    run('git',['push','origin','HEAD:main']);
    await verifyDeployment(edition.publicURL);
  }else{
    gitCommit=run('git',['rev-parse','--short','HEAD'],{capture:true});
  }
  const completedAt=new Date();
  const preview=await finishBuild(build.build_id,{deploymentURL:deploy?edition.publicURL:'',gitCommit,now:completedAt,persist:false});
  const previewPath=`output/${slug}/build-record-preview.json`;
  await fs.writeFile(previewPath,JSON.stringify(preview,null,2)+'\n');
  run(process.execPath,['scripts/prepare-delivery.mjs',slug,'--build-record',previewPath]);
  const completed=await finishBuild(build.build_id,{deploymentURL:deploy?edition.publicURL:'',gitCommit,now:completedAt});
  if(deploy){
    run('git',['add','build-records/builds.jsonl']);
    run('git',['commit','-m',`Record Deep Cuts build: ${completed.build_id}`]);
    run('git',['push','origin','HEAD:main']);
  }
  console.log(`Deep Cuts publish package ready: ${edition.publicURL}`);
  console.log(`Build record: ${completed.build_id} (${completed.production_time_display}, ${completed.cost_method})`);
  console.log(`Delivery manifest: output/${slug}/delivery.json`);
  console.log(deploy?'Deployment verified. Send the prepared completion email automatically.':'Use --deploy only after editorial approval is complete.');
}catch(error){
  try{await finishBuild(build.build_id,{status:'failed',failureReason:error.message})}catch(trackingError){console.error(`Could not close failed build record: ${trackingError.message}`)}
  console.error(error.stack||error.message);process.exit(1);
}
