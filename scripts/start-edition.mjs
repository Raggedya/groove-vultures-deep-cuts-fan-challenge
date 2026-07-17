import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.env.DEEP_CUTS_ROOT||process.cwd());
const bandName=process.argv.slice(2).join(' ').trim();
if(!bandName)throw new Error('Usage: node scripts/start-edition.mjs "Artist Name"');
const slug=slugify(bandName);
const directory=path.join(root,'.deep-cuts','jobs');
const file=path.join(directory,`${slug}.json`);
await fs.mkdir(directory,{recursive:true});
let job;
try{
  job=JSON.parse(await fs.readFile(file,'utf8'));
  if(job.status!=='in_progress')throw new Error(`A completed factory job already exists for ${bandName}.`);
}catch(error){
  if(error.code!=='ENOENT')throw error;
  job={jobId:`dcjob_${crypto.randomUUID()}`,bandName,slug,submittedAt:new Date().toISOString(),status:'in_progress'};
  await fs.writeFile(file,JSON.stringify(job,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify(job,null,2));

function slugify(value){
  const slug=value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!slug)throw new Error('Artist name cannot produce a safe edition slug.');
  return slug;
}

