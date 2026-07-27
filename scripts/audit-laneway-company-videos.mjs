import fs from "node:fs/promises";

const rosterPath=process.argv[2]||"editions/laneway-music-one-off/roster.json";
const roster=JSON.parse(await fs.readFile(rosterPath,"utf8"));
const artists=Array.isArray(roster.artists)?roster.artists:[];

const cleanText=value=>String(value||"").replace(/\s+/g," ").trim();
const unique=values=>[...new Set(values.filter(Boolean))];
const videoIds=html=>unique([
  ...String(html).matchAll(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/gi)
].map(match=>match[1]));
const publicViewCount=html=>{
  const source=String(html);
  const schema=source.match(/itemprop="interactionType" content="https:\/\/schema\.org\/WatchAction"[\s\S]{0,400}?itemprop="userInteractionCount" content="(\d+)"/i);
  const player=source.match(/"viewCount":"(\d+)"/);
  const value=Number(schema?.[1]||player?.[1]||0);
  return Number.isSafeInteger(value)&&value>=0?value:0;
};

async function fetchText(url){
  const response=await fetch(url,{headers:{"user-agent":"DeepCutsLanewayVideoAudit/1.0"}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function auditArtist(artist){
  try{
    const html=await fetchText(artist.sourceURL);
    const ids=videoIds(html);
    const videos=[];
    for(const id of ids){
      try{
        const watchURL=`https://www.youtube.com/watch?v=${id}`;
        const [oembed,watchHTML]=await Promise.all([
          fetchText(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchURL)}&format=json`).then(JSON.parse),
          fetchText(watchURL)
        ]);
        videos.push({
          title:cleanText(oembed.title),
          youtubeURL:watchURL,
          videoId:id,
          channelName:cleanText(oembed.author_name),
          channelURL:cleanText(oembed.author_url),
          viewCount:publicViewCount(watchHTML),
          playableInEmbed:/"playableInEmbed":true/.test(watchHTML)
        });
      }catch(error){
        videos.push({youtubeURL:`https://www.youtube.com/watch?v=${id}`,videoId:id,error:cleanText(error.message)});
      }
    }
    videos.sort((a,b)=>(b.viewCount||0)-(a.viewCount||0));
    return {artist:artist.name,sourceURL:artist.sourceURL,videos};
  }catch(error){
    return {artist:artist.name,sourceURL:artist.sourceURL,videos:[],error:cleanText(error.message)};
  }
}

const results=[];
const concurrency=6;
for(let index=0;index<artists.length;index+=concurrency){
  results.push(...await Promise.all(artists.slice(index,index+concurrency).map(auditArtist)));
}

console.log(JSON.stringify({
  auditedAt:new Date().toISOString(),
  rosterPath,
  artistCount:artists.length,
  artistsWithVerifiedProfileVideo:results.filter(result=>result.videos.some(video=>video.title&&!video.error)).length,
  results
},null,2));
