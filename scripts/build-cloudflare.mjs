import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const dist=path.join(root,'dist');
const files=['index.html','styles.css','platform.json','analytics.html','analytics.css'];
const directories=['js','assets','editions','output','sell','record-company','record-company-output'];

await fs.rm(dist,{recursive:true,force:true});
await fs.mkdir(dist,{recursive:true});
await Promise.all([
  ...files.map(file=>copyOptionalFile(file)),
  ...directories.map(directory=>copyOptionalDirectory(directory))
]);
await fs.access(path.join(dist,'assets','aggits-coin-gold-v1.png'));
console.log(`Deep Cuts static bundle created at ${dist}.`);

async function copyOptionalFile(file){
  try{await fs.copyFile(path.join(root,file),path.join(dist,file))}
  catch(error){if(error.code!=='ENOENT')throw error}
}

async function copyOptionalDirectory(directory){
  try{await fs.cp(path.join(root,directory),path.join(dist,directory),{recursive:true,filter:deploymentAssetFilter})}
  catch(error){if(error.code!=='ENOENT')throw error}
}

function deploymentAssetFilter(source){
  const relative=path.relative(root,source),
    segments=relative.split(path.sep),
    extension=path.extname(source).toLowerCase();
  if(segments.includes('.tools'))return false;
  if(['.exe','.zip','.dmg','.msi'].includes(extension))return false;
  if(segments[0]==='output'&&segments.some(segment=>/^(?:Mahogany-Jukebox-Windows|Deep-Cuts-Studio-(?:Windows|macOS))-/i.test(segment)))return false;
  return true;
}

