import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const requiredDocs=['DEEP_CUTS_PRODUCTION_MANUAL.md','CLAUDE.md','ROADMAP.md','AGENTS.md','.agents/skills/deep-cuts-factory/SKILL.md'];
const errors=[];
for(const file of requiredDocs)try{const text=await fs.readFile(file,'utf8');if(text.trim().length<100)errors.push(`${file} is unexpectedly short.`)}catch{errors.push(`Missing ${file}.`)}
try{
  const integrity=JSON.parse(await fs.readFile('assets/aggits-integrity.json','utf8'));
  for(const item of integrity.assets||[integrity]){const actual=crypto.createHash('sha256').update(await fs.readFile(item.asset)).digest('hex');if(actual!==item.sha256)errors.push(`${item.asset} failed its approved SHA-256 identity check.`)}
}catch(error){errors.push(`Aggits integrity check failed: ${error.message}`)}
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
if(!platform.defaultEdition)errors.push('platform.json requires defaultEdition.');
let publicBaseURL;
try{
  publicBaseURL=new URL(platform.publicBaseURL);
  if(publicBaseURL.protocol!=='https:'||publicBaseURL.hostname.endsWith('.example'))errors.push('platform.json publicBaseURL must be the permanent HTTPS Deep Cuts address.');
  if(publicBaseURL.pathname!=='/'||publicBaseURL.search||publicBaseURL.hash)errors.push('platform.json publicBaseURL must not contain a path, query or fragment.');
}catch{errors.push('platform.json requires a valid publicBaseURL.');}
const slugs=new Set();
const editionIds=new Set();
for(const edition of platform.editions){
  if(slugs.has(edition.slug))errors.push(`Duplicate edition slug: ${edition.slug}`);slugs.add(edition.slug);
  if(!/^[A-Za-z0-9_-]{4,40}$/.test(edition.editionId||''))errors.push(`${edition.slug} requires an opaque editionId.`);
  if(editionIds.has(edition.editionId))errors.push(`Duplicate editionId: ${edition.editionId}`);editionIds.add(edition.editionId);
  if(edition.canonicalPath!==`/e/${edition.editionId}`)errors.push(`${edition.slug} canonicalPath must use its opaque editionId.`);
  if(publicBaseURL?.href.toLowerCase().includes(edition.slug.toLowerCase()))errors.push('The permanent publicBaseURL must not contain an artist slug.');
  try{
    const config=JSON.parse(await fs.readFile(edition.config,'utf8'));
    if(config.slug!==edition.slug)errors.push(`${edition.config} slug mismatch.`);
    if(!config.bandName||!/^https:\/\//.test(config.publicURL||''))errors.push(`${edition.config} requires bandName and an HTTPS publicURL.`);
    await fs.access(config.characterArtwork);
    for(const[key,value]of Object.entries(config.links||{}))if(value&&!/^https:\/\//.test(value))errors.push(`${edition.config} links.${key} must be blank or HTTPS.`);
    if(config.featuredVideo?.youtubeURL&&!/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(config.featuredVideo.youtubeURL))errors.push(`${edition.config} featuredVideo.youtubeURL must be a verified YouTube URL.`);
  }catch(error){errors.push(`${edition.slug}: ${error.message}`)}
}
if(!slugs.has(platform.defaultEdition))errors.push('defaultEdition is not registered.');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Deep Cuts discovery platform validation passed: ${platform.editions.length} registered edition(s).`);

