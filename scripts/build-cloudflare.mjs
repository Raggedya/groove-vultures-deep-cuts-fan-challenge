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
const vuArtwork=path.join(dist,'assets','aggits-jukebox-vu-master-v1.jpg');
try{await fs.access(vuArtwork)}
catch(error){
  if(error.code!=='ENOENT')throw error;
  const encoded=await fs.readFile(`${vuArtwork}.base64`,'utf8');
  await fs.writeFile(vuArtwork,Buffer.from(encoded.trim(),'base64'));
  await fs.rm(`${vuArtwork}.base64`,{force:true});
}
await fs.access(path.join(dist,'assets','aggits-coin-gold-v1.png'));
console.log(`Deep Cuts static bundle created at ${dist}.`);

async function copyOptionalFile(file){
  try{await fs.copyFile(path.join(root,file),path.join(dist,file))}
  catch(error){if(error.code!=='ENOENT')throw error}
}

async function copyOptionalDirectory(directory){
  try{await fs.cp(path.join(root,directory),path.join(dist,directory),{recursive:true,filter:source=>!source.includes(`${path.sep}.tools${path.sep}`)})}
  catch(error){if(error.code!=='ENOENT')throw error}
}


