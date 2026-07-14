import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const requiredDocs=['DEEP_CUTS_PRODUCTION_MANUAL.md','CLAUDE.md','ROADMAP.md','AGENTS.md','.agents/skills/deep-cuts-factory/SKILL.md'];
const errors=[];
for(const file of requiredDocs)try{const text=await fs.readFile(file,'utf8');if(text.trim().length<100)errors.push(`${file} is unexpectedly short.`)}catch{errors.push(`Missing ${file}.`)}
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
try{
  const integrity=JSON.parse(await fs.readFile('assets/aggits-integrity.json','utf8'));
  const bytes=await fs.readFile(integrity.asset);
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  if(actual!==integrity.sha256)errors.push('Approved Aggits artwork failed its immutable SHA-256 identity check.');
}catch(error){errors.push(`Aggits integrity check failed: ${error.message}`)}
if(!platform.defaultEdition)errors.push('platform.json requires defaultEdition.');
if(!platform.analytics||!Number.isInteger(platform.analytics.localRetention)||platform.analytics.localRetention<100)errors.push('platform.json requires analytics.localRetention of at least 100.');
if(platform.analytics?.measurementId&&!/^G-[A-Z0-9]+$/i.test(platform.analytics.measurementId))errors.push('analytics.measurementId must be blank or a valid GA4 measurement ID.');
for(const key of ['endpoint','reportingEndpoint'])if(platform.analytics?.[key]&&!/^https:\/\//i.test(platform.analytics[key]))errors.push(`analytics.${key} must be blank or an HTTPS URL.`);
const slugs=new Set();
for(const edition of platform.editions){
  if(slugs.has(edition.slug))errors.push(`Duplicate edition slug: ${edition.slug}`);slugs.add(edition.slug);
  try{const config=JSON.parse(await fs.readFile(edition.config,'utf8'));if(config.slug!==edition.slug)errors.push(`${edition.config} slug mismatch.`);await fs.access(config.questionFile);await fs.access(config.brandArtwork);await fs.access(config.characterArtwork)}catch(error){errors.push(`${edition.slug}: ${error.message}`)}
}
if(!slugs.has(platform.defaultEdition))errors.push('defaultEdition is not registered.');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Deep Cuts platform validation passed: ${platform.editions.length} registered edition(s).`);
