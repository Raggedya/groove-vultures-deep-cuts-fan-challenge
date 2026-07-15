import fs from 'node:fs/promises';
import path from 'node:path';

const [slug,name]=process.argv.slice(2);
if(!slug||!name||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){console.error('Usage: node scripts/register-edition.mjs <slug> "Band Name"');process.exit(1)}
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
if(platform.editions.some(item=>item.slug===slug))throw new Error(`Edition already registered: ${slug}`);
const template=JSON.parse(await fs.readFile('editions/groove-vultures/edition.json','utf8'));
const directory=path.join('editions',slug);await fs.mkdir(directory,{recursive:true});
const config={
  brandName:'Deep Cuts',bandName:name,editionTitle:name,description:`Official music, video, social and support links for ${name}.`,slug,
  publicURL:`https://raggedya.github.io/groove-vultures-deep-cuts-fan-challenge/?edition=${slug}`,
  characterArtwork:'assets/aggits-original-cutout-v4.png',social:{copyright:'copyright Clearlight Creative',instagramImage:`output/${slug}/instagram-discovery.png`,qrImage:`output/${slug}/instagram-qr.png`},
  theme:{...template.theme},discovery:{kicker:'Official artist links',tagline:'Listen. Watch. Follow. Support.'},
  links:Object.fromEntries(['spotify','bandcamp','youtube','instagram','facebook','tiktok','website','tickets','merchandise','mailingList','tip'].map(key=>[key,''])),
  featuredVideo:{title:'',youtubeURL:''},analytics:{pageIdentifier:`${slug}:discovery-v1`}
};
await fs.writeFile(path.join(directory,'edition.json'),JSON.stringify(config,null,2)+'\n');
platform.editions.push({slug,name,config:`editions/${slug}/edition.json`,active:false});
await fs.writeFile('platform.json',JSON.stringify(platform,null,2)+'\n');
console.log(`Registered draft discovery page ${slug}. Add verified links, an optional tip URL and one verified featured video, then activate it.`);
