import fs from "node:fs/promises";

const state=JSON.parse(await fs.readFile(".deep-cuts/jookbox-band-batches/latest.json","utf8"));
const platform=JSON.parse(await fs.readFile("platform.json","utf8"));
let reconciled=0;

for(const item of state.items.filter(entry=>entry.status==="configured"&&entry.editionId)){
  const edition=platform.editions.find(entry=>entry.editionId===item.editionId);
  if(!edition)throw new Error(`${item.name} (${item.editionId}) is missing from platform.json.`);
  const configPath=edition.config;
  const researchPath=configPath.replace(/edition\.json$/,"research.json");
  const [config,research]=await Promise.all([
    readJson(configPath),
    readJson(researchPath)
  ]);
  const sourceURL=config.jookBox?.linkSourceURL;
  const sourceEvidence=(research.sources||[]).find(source=>source.destination==="identity"&&sameURL(source.url,sourceURL));
  if(!sourceURL||!sourceEvidence)throw new Error(`${item.name} is missing matching artist-controlled source evidence.`);
  if(!(research.sources||[]).some(source=>source.destination==="jookBoxSource"&&sameURL(source.url,sourceURL))){
    research.sources.push({
      destination:"jookBoxSource",
      url:sourceURL,
      sourceType:"verified artist-controlled source snapshot",
      identityVerified:true,
      verifiedAt:sourceEvidence.verifiedAt||config.jookBox.linkSourceVerifiedAt,
      evidence:`The verified artist-controlled source supplied the JookBox destinations for ${config.bandName}.`
    });
  }
  config.links=Object.fromEntries(Object.entries(config.links||{}).map(([key,url])=>[key,authenticationWall(url)?"":url]));
  config.jookBox.selections=(config.jookBox.selections||[]).filter(selection=>!authenticationWall(selection.url));
  const ids=new Set(config.jookBox.selections.map(selection=>selection.id));
  const displayIds=(config.jookBox.displaySelectionIds||[]).filter(id=>ids.has(id));
  for(const selection of config.jookBox.selections)if(displayIds.length<6&&!displayIds.includes(selection.id))displayIds.push(selection.id);
  if(displayIds.length<4)throw new Error(`${item.name} has fewer than four safe verified display destinations after authentication-wall removal.`);
  config.jookBox.displaySelectionIds=displayIds;
  await Promise.all([writeJson(configPath,config),writeJson(researchPath,research)]);
  reconciled+=1;
}

console.log(JSON.stringify({ok:true,reconciled},null,2));

function readJson(file){return fs.readFile(file,"utf8").then(JSON.parse)}
function writeJson(file,value){return fs.writeFile(file,`${JSON.stringify(value,null,2)}\n`)}
function sameURL(left,right){try{const a=new URL(left),b=new URL(right);return a.origin+a.pathname.replace(/\/$/,"")===b.origin+b.pathname.replace(/\/$/,"")}catch{return false}}
function authenticationWall(value){try{const url=new URL(String(value));const host=url.hostname.replace(/^www\./,"").toLowerCase(),path=url.pathname.toLowerCase();return host==="instagram.com"&&(path.startsWith("/accounts/login")||path.startsWith("/accounts/signup")||url.searchParams.has("next"))||["facebook.com","m.facebook.com"].includes(host)&&(/^\/(?:login|checkpoint|recover|reg)(?:\/|$)/.test(path)||(path.startsWith("/login")&&url.searchParams.has("next")))}catch{return false}}
