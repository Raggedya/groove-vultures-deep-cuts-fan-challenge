import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import {promisify} from 'node:util';
import {mapLimit} from './lib/parallel.mjs';

const execFileAsync=promisify(execFile);
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const candidates=[];

for(const edition of platform.editions.filter(item=>item.active)){
  const config=JSON.parse(await fs.readFile(edition.config,'utf8'));
  if(['aggits-character-poster/1','aggits-character-poster-perspective/2'].includes(config.jookBox?.qrArtworkVariant))candidates.push(edition);
}

const jobs=Math.max(1,Math.min(6,Number(process.env.DEEP_CUTS_DELIVERY_JOBS||4)));
console.log(`Character-poster delivery recovery: ${candidates.length} active edition(s), ${jobs} worker(s).`);

await mapLimit(candidates,jobs,async edition=>{
  const {stdout,stderr}=await execFileAsync(process.execPath,['scripts/send-delivery.mjs',edition.slug],{
    cwd:process.cwd(),
    env:process.env,
    encoding:'utf8',
    maxBuffer:1024*1024
  });
  if(stderr.trim())process.stderr.write(stderr);
  return {edition,output:stdout.trim()};
},{onProgress:({completed,total,item})=>console.log(`[${completed}/${total}] ${item.name}`)});

console.log(`Character-poster delivery recovery completed for ${candidates.length} active edition(s).`);
