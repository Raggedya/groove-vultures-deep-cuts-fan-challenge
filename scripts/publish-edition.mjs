import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';

const args=process.argv.slice(2);
const slug=args.find(value=>!value.startsWith('--'));
const deploy=args.includes('--deploy');
if(!slug){console.error('Usage: node scripts/publish-edition.mjs <edition-slug> [--deploy]');process.exit(1)}

function run(command,commandArgs){
  const result=spawnSync(command,commandArgs,{stdio:'inherit',shell:process.platform==='win32'});
  if(result.status!==0)process.exit(result.status??1);
}

run(process.execPath,['scripts/build-edition.mjs',slug]);
run(process.execPath,['scripts/prepare-delivery.mjs',slug]);
const manifest=JSON.parse(await fs.readFile(`output/${slug}/delivery-manifest.json`,'utf8'));

if(deploy){
  run('git',['add','--all']);
  const diff=spawnSync('git',['diff','--cached','--quiet'],{shell:process.platform==='win32'});
  if(diff.status!==0)run('git',['commit','-m',`Publish Deep Cuts edition: ${manifest.bandName}`]);
  run('git',['push','origin','HEAD:main']);
}

console.log(`Deep Cuts publish package ready: ${manifest.publicURL}`);
console.log(`Delivery manifest: output/${slug}/delivery.json`);
console.log(deploy?'Deployment pushed. Complete the automatic email delivery stage.':'Use --deploy only after editorial approval is complete.');
