import fs from 'node:fs/promises';
import {findActiveBuild,finishBuild,recordUsage,startBuild} from './build-tracker.mjs';

const [command,...args]=process.argv.slice(2);
function value(flag){const index=args.indexOf(flag);return index>=0?args[index+1]:null}

if(command==='start'){
  const slug=args.find(arg=>!arg.startsWith('--'));const artist=value('--artist');
  if(!slug||!artist)throw new Error('Usage: track-build start <slug> --artist "Artist Name"');
  console.log(JSON.stringify(await startBuild({slug,artist}),null,2));
}else if(command==='usage'){
  const buildId=args.find(arg=>!arg.startsWith('--'));const file=value('--file');
  if(!buildId||!file)throw new Error('Usage: track-build usage <build-id> --file usage.json');
  console.log(JSON.stringify(await recordUsage(buildId,JSON.parse(await fs.readFile(file,'utf8'))),null,2));
}else if(command==='complete'||command==='fail'){
  const slug=args.find(arg=>!arg.startsWith('--'));const active=slug&&await findActiveBuild(slug);
  if(!active)throw new Error(`No in-progress build found for ${slug||'unknown slug'}.`);
  console.log(JSON.stringify(await finishBuild(active.build_id,{status:command==='fail'?'failed':'completed',failureReason:value('--reason')||'',deploymentURL:value('--url')||'',gitCommit:value('--commit')||''}),null,2));
}else{
  throw new Error('Usage: track-build <start|usage|complete|fail> ...');
}
