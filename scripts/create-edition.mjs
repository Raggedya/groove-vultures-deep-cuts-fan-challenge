import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.env.DEEP_CUTS_ROOT||process.cwd());
const inputPath=process.argv[2];
if(!inputPath)throw new Error('Usage: node scripts/create-edition.mjs <verified-research.json>');
const input=JSON.parse(await fs.readFile(path.resolve(inputPath),'utf8'));
const bandName=clean(input.bandName,120);
const bio=clean(input.bio,190);
if(!bandName||!bio)throw new Error('Verified research requires bandName and a concise bio.');
const slug=slugify(bandName);
const jobPath=path.join(root,'.deep-cuts','jobs',`${slug}.json`);
const job=JSON.parse(await fs.readFile(jobPath,'utf8').catch(()=>{throw new Error(`Start the production clock first: node scripts/start-edition.mjs "${bandName}"`)}));
if(job.bandName!==bandName||job.status!=='in_progress')throw new Error('The active factory job does not match this artist.');

const platformPath=path.join(root,'platform.json');
const platform=JSON.parse(await fs.readFile(platformPath,'utf8'));
if(platform.editions.some(item=>item.slug===slug||String(item.name).toLowerCase()===bandName.toLowerCase()))throw new Error(`Edition already exists for ${bandName}.`);
const links=validateResearch(input);
const editionId=uniqueEditionId(platform);
const canonicalPath=`/e/${editionId}`;
const now=new Date().toISOString();
const directory=path.join(root,'editions',slug);
await fs.mkdir(directory,{recursive:true});
const config={
  brandName:'Deep Cuts',bandName,editionTitle:bandName,description:bio,
  discovery:{bio,newsLabel:clean(input.newsLabel||'',90)},mode:'discovery',slug,
  publicURL:`${String(platform.publicBaseURL).replace(/\/$/,'')}${canonicalPath}`,
  characterArtwork:'assets/aggits-original-cutout-v4.png',backgroundArtwork:'',
  social:{copyright:'copyright Clearlight Creative',instagramImage:`output/${slug}/instagram-discovery.png`,qrImage:`output/${slug}/instagram-qr.png`},
  theme:{accent:'#2f80ff',accentSecondary:'#8dbdff'},links,
  featuredVideo:{title:clean(input.featuredVideo?.title||'',120),youtubeURL:https(input.featuredVideo?.youtubeURL||'')},
  analytics:{editionId,pageIdentifier:`${editionId}:discovery-v1`},
  production:{jobId:job.jobId,submittedAt:job.submittedAt,researchCompletedAt:now,editionCreatedAt:now}
};
const research={bandName,slug,editionId,verifiedAt:now,sources:input.sources};
await fs.writeFile(path.join(directory,'edition.json'),JSON.stringify(config,null,2)+'\n');
await fs.writeFile(path.join(directory,'research.json'),JSON.stringify(research,null,2)+'\n');
platform.editions.push({slug,editionId,canonicalPath,name:bandName,config:`editions/${slug}/edition.json`,active:true});
await fs.writeFile(platformPath,JSON.stringify(platform,null,2)+'\n');
job.status='configured';job.editionId=editionId;job.configuredAt=now;
await fs.writeFile(jobPath,JSON.stringify(job,null,2)+'\n');
console.log(JSON.stringify({ok:true,jobId:job.jobId,slug,editionId,canonicalPath,config:`editions/${slug}/edition.json`},null,2));

function validateResearch(value){
  const keys=['buyMusic','spotify','instagram','bandcamp','youtube','facebook','website','merchandise','tip','newsReviews'];
  const links=Object.fromEntries(keys.map(key=>[key,https(value.links?.[key]||'')]));
  const sources=Array.isArray(value.sources)?value.sources:[];
  if(sources.length<2||!sources.some(source=>source.identityVerified===true&&/official/i.test(String(source.sourceType||''))))throw new Error('Research requires two identity-checked sources including one official artist-controlled source.');
  for(const [destination,url] of Object.entries(links)){
    if(!url)continue;
    const evidence=sources.find(source=>source.destination===destination&&normalize(source.url)===normalize(url)&&source.identityVerified===true&&validDate(source.verifiedAt)&&clean(source.evidence,300));
    if(!evidence)throw new Error(`${destination} requires matching, dated, identity-verified evidence.`);
    if(destination==='tip'&&!['artist-provided','owner-provided'].includes(evidence.authorization))throw new Error('Tip destinations require explicit artist or owner authorization.');
    if(destination==='newsReviews'&&evidence.credibleEditorial!==true)throw new Error('News & Reviews requires credible editorial evidence.');
  }
  return links;
}
function uniqueEditionId(platform){let id;do{id=`dc_${crypto.randomBytes(5).toString('hex')}`}while(platform.editions.some(item=>item.editionId===id));return id}
function slugify(value){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function clean(value,max){return String(value||'').trim().replace(/\s+/g,' ').slice(0,max)}
function https(value){if(!value)return'';const url=new URL(String(value));if(url.protocol!=='https:')throw new Error(`Destination must use HTTPS: ${value}`);url.hash='';return url.href}
function normalize(value){try{const url=new URL(String(value));url.hash='';return url.href.replace(/\/$/,'')}catch{return''}}
function validDate(value){return Number.isFinite(new Date(value).getTime())}

