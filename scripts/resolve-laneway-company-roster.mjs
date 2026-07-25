import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const sourcePath=path.join(ROOT,"record-company-output","laneway-music","build-export.json");
const outputPath=path.join(ROOT,"editions","laneway-music-one-off","roster.json");
const batchSize=Math.max(1,Number(process.argv.find(value=>value.startsWith("--batch="))?.split("=")[1]||8));
const retryOmissions=process.argv.includes("--retry-omissions");
const source=JSON.parse(await fs.readFile(sourcePath,"utf8"));
const cachePath=path.join(ROOT,".deep-cuts","laneway-company-roster-cache.json");
await fs.mkdir(path.dirname(cachePath),{recursive:true});
let cache={};
try{cache=JSON.parse(await fs.readFile(cachePath,"utf8"))}
catch{
  try{
    const checkpoint=JSON.parse(await fs.readFile(outputPath,"utf8"));
    for(const item of [...(checkpoint.artists||[]),...(checkpoint.omissions||[])])cache[item.sourceURL]=item;
  }catch{}
}

const seeds=source.artists
  .filter(artist=>artist.name&&artist.official_label_profile_url&&Number(artist.confidence_score)>=.98)
  .sort((a,b)=>a.name.localeCompare(b.name,"en-AU"));
const pending=seeds.filter(seed=>!cache[seed.official_label_profile_url]||(retryOmissions&&!cache[seed.official_label_profile_url]?.spotifyURL)).slice(0,batchSize);

for(let offset=0;offset<pending.length;offset+=8){
  const group=pending.slice(offset,offset+8);
  const results=await Promise.all(group.map(async seed=>{
    try{return await resolveArtist(seed)}
    catch(error){return{name:seed.name,sourceURL:seed.official_label_profile_url,spotifyURL:"",verification:{association:"official Laneway Music artist profile",spotify:"verification request failed",website:"not checked",checkedAt:new Date().toISOString()},omissionReason:`Verification unavailable: ${error.message}`}}
  }));
  group.forEach((seed,index)=>{cache[seed.official_label_profile_url]=results[index];process.stdout.write(`${results[index].spotifyURL?"✓":"–"} ${seed.name}\n`)});
  await atomicJson(cachePath,cache);
}

const artists=seeds.map(seed=>cache[seed.official_label_profile_url]).filter(item=>item?.spotifyURL);
const omissions=seeds.map(seed=>cache[seed.official_label_profile_url]).filter(item=>item&&!item.spotifyURL);
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify({
  generatedAt:new Date().toISOString(),
  sourceURL:"https://www.lanewaymusic.com.au/",
  sourceArtistCount:seeds.length,
  verifiedArtistCount:artists.length,
  pendingArtistCount:seeds.length-Object.keys(cache).length,
  artists,
  omissions
},null,2)+"\n","utf8");
console.log(`Roster checkpoint: ${artists.length} verified, ${omissions.length} omitted, ${seeds.length-Object.keys(cache).length} pending.`);

async function resolveArtist(seed){
  const markdown=await fetchText(`https://r.jina.ai/${seed.official_label_profile_url}`);
  const links=parseMarkdownLinks(markdown);
  const spotifyCandidates=links.filter(link=>/spotify/i.test(link.label)||/spotify/i.test(link.url));
  let spotifyURL="";
  for(const candidate of spotifyCandidates){
    spotifyURL=await directSpotifyArtist(candidate.url);
    if(spotifyURL)break;
  }
  if(!spotifyURL&&!ambiguousName(seed.name))spotifyURL=await exactSpotifySearch(seed.name);
  const websiteURL=firstOfficialWebsite(links,seed);
  return{
    name:seed.name,
    sourceURL:seed.official_label_profile_url,
    spotifyURL,
    ...(websiteURL?{websiteURL}:{}),
    verification:{
      association:"official Laneway Music artist profile",
      spotify:spotifyURL?"direct artist-profile link published by Laneway Music":"not confidently verified",
      website:websiteURL?"official-site link published on the Laneway Music profile":"not present",
      checkedAt:new Date().toISOString()
    },
    ...(!spotifyURL?{omissionReason:"No direct Spotify artist profile could be verified from the official Laneway Music artist page."}:{})
  };
}

async function exactSpotifySearch(name){
  const markdown=await fetchText(`https://r.jina.ai/https://open.spotify.com/search/${encodeURIComponent(name)}/artists`);
  const target=normalizedName(name);
  for(const link of parseMarkdownLinks(markdown)){
    if(normalizedName(link.label)!==target)continue;
    try{
      const url=new URL(link.url);
      if(url.hostname==="open.spotify.com"&&/^\/artist\/[A-Za-z0-9]+\/?$/.test(url.pathname))return `${url.origin}${url.pathname.replace(/\/$/,"")}`;
    }catch{}
  }
  return"";
}

function ambiguousName(name){
  return new Set(["x","chain","spectrum","ariel","daniel","bakery","new age","crossfire","remora","uppercut","argus","love child","la femme"]).has(normalizedName(name));
}

function normalizedName(value){return String(value||"").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu," ").trim().toLocaleLowerCase("en-AU")}

async function directSpotifyArtist(value){
  try{
    const response=await fetch(value,{redirect:"follow",signal:AbortSignal.timeout(8000),headers:{"user-agent":"Deep Cuts link verifier/1.0"}});
    const url=new URL(response.url);
    if(url.hostname==="open.spotify.com"&&/^\/artist\/[A-Za-z0-9]+\/?$/.test(url.pathname))return `${url.origin}${url.pathname.replace(/\/$/,"")}`;
  }catch{}
  return"";
}

function firstOfficialWebsite(links,seed){
  const excluded=["lanewaymusic.com.au","spotify.com","apple.com","youtube.com","youtu.be","facebook.com","instagram.com","twitter.com","x.com","bandcamp.com","soundcloud.com","amazon.com"];
  for(const link of links){
    if(!/(official\s*(?:website|site)|artist\s*website|website)/i.test(link.label))continue;
    try{
      const url=new URL(link.url);
      if(url.protocol!=="https:"||excluded.some(domain=>url.hostname===domain||url.hostname.endsWith(`.${domain}`)))continue;
      return url.href;
    }catch{}
  }
  try{
    const candidate=new URL(seed.official_website_url||"");
    if(candidate.protocol==="https:"&&!excluded.some(domain=>candidate.hostname===domain||candidate.hostname.endsWith(`.${domain}`)))return candidate.href;
  }catch{}
  return"";
}

function parseMarkdownLinks(markdown){
  const results=[];
  for(const match of markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g))results.push({label:match[1].replace(/!\[[^\]]*\]/g,"").trim(),url:match[2]});
  return results;
}

async function fetchText(url){
  let lastError;
  for(let attempt=0;attempt<2;attempt+=1){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{"user-agent":"Deep Cuts research verifier/1.0"}});
      if(response.ok)return response.text();
      lastError=new Error(`${url} returned ${response.status}`);
    }catch(error){lastError=error}
    await new Promise(resolve=>setTimeout(resolve,1200*(attempt+1)));
  }
  throw lastError;
}

async function atomicJson(destination,value){
  const temporary=`${destination}.tmp`;
  await fs.writeFile(temporary,JSON.stringify(value,null,2)+"\n","utf8");
  await fs.rename(temporary,destination);
}
