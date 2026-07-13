import fs from 'node:fs/promises';
import path from 'node:path';

const [slug,name]=process.argv.slice(2);
if(!slug||!name||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){
  console.error('Usage: node scripts/register-edition.mjs <slug> "Band Name"');
  process.exit(1);
}
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
if(platform.editions.some(edition=>edition.slug===slug))throw new Error(`Edition already registered: ${slug}`);
const template=JSON.parse(await fs.readFile('editions/groove-vultures/edition.json','utf8'));
const directory=path.join('editions',slug);
await fs.mkdir(directory,{recursive:true});
const config={...template,slug,bandName:name,editionTitle:name,quizTitle:`${name} Deep Cuts`,description:`Thirty-six source-verified ${name} deep cuts.`,publicURL:`https://raggedya.github.io/groove-vultures-deep-cuts-fan-challenge/?edition=${slug}`,questionFile:`editions/${slug}/questions.json`,links:Object.fromEntries(Object.keys(template.links).map(key=>[key,''])),social:{...template.social,instagramImage:`output/${slug}/instagram-fan-challenge.png`,qrImage:`output/${slug}/instagram-qr.png`}};
await fs.writeFile(path.join(directory,'edition.json'),JSON.stringify(config,null,2)+'\n');
await fs.writeFile(path.join(directory,'questions.json'),'[]\n');
platform.editions.push({slug,name,config:`editions/${slug}/edition.json`,active:false});
await fs.writeFile('platform.json',JSON.stringify(platform,null,2)+'\n');
console.log(`Registered draft edition ${slug}. Add verified links and 36 questions, then set active to true.`);
