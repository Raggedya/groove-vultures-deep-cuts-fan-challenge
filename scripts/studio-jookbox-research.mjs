import crypto from "node:crypto";
import dns from "node:dns/promises";

export const STUDIO_JOOKBOX_RESEARCH_SCHEMA="deep-cuts-studio-jookbox-research/1";
export const STUDIO_JOOKBOX_CONFIDENCE_GATE=98;

const LINK_HUB_HOSTS=new Set(["linktr.ee","bio.site","beacons.ai","campsite.bio","lnk.bio","solo.to"]);
const SEARCH_HOSTS=new Set(["bing.com","www.bing.com"]);
const PLATFORM_HOSTS=new Set([
  "open.spotify.com","spotify.com",
  "youtube.com","www.youtube.com","m.youtube.com","youtu.be",
  "instagram.com","www.instagram.com",
  "facebook.com","www.facebook.com","m.facebook.com",
  "tiktok.com","www.tiktok.com"
]);
const IGNORED_HOSTS=new Set([
  "google.com","www.google.com","googleusercontent.com","gstatic.com",
  "doubleclick.net","www.youtube-nocookie.com","schema.org",
  "twitter.com","x.com","pinterest.com","linkedin.com"
]);
const IGNORED_EXTENSIONS=/\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|pdf|xml)(?:$|\?)/i;
const KIND_PRIORITY=[
  "bandcamp","spotify","youtube","instagram","tiktok","website",
  "buy_music","merchandise","facebook","newsletter","contact","show","deep_cut"
];
const KIND_LABELS={
  bandcamp:["Bandcamp","Listen and buy direct"],
  spotify:["Spotify","Listen on Spotify"],
  youtube:["YouTube","Watch and subscribe"],
  instagram:["Instagram","Latest band updates"],
  tiktok:["TikTok","Official band clips"],
  website:["Band Website","Visit the official website"],
  buy_music:["Buy Music","Purchase music online"],
  merchandise:["Buy Merch","Official band merchandise"],
  facebook:["Facebook","Follow the band"],
  newsletter:["Newsletter","Join the official mailing list"],
  contact:["Contact","Official band enquiries"],
  show:["Tickets","View the verified show"],
  deep_cut:["Deep Cut","Explore another band feature"]
};

export class StudioResearchNetwork{
  constructor({timeoutMs=14000,retries=2,maxBytes=1_500_000,userAgent="DeepCutsStudioResearch/1.0"}={}){
    this.timeoutMs=timeoutMs;
    this.retries=retries;
    this.maxBytes=maxBytes;
    this.userAgent=userAgent;
    this.inflight=new Map();
  }

  async inspect(value){
    const url=await assertPublicHttps(value);
    if(this.inflight.has(url))return this.inflight.get(url);
    const pending=this.inspectFresh(url);
    this.inflight.set(url,pending);
    try{return await pending}
    finally{if(this.inflight.get(url)===pending)this.inflight.delete(url)}
  }

  async inspectFresh(url){
    let lastError;
    for(let attempt=1;attempt<=this.retries;attempt++){
      try{
        let finalURL=url;
        let response;
        for(let redirectCount=0;redirectCount<=5;redirectCount++){
          response=await fetch(finalURL,{
            redirect:"manual",
            signal:AbortSignal.timeout(this.timeoutMs),
            headers:{
              "user-agent":this.userAgent,
              accept:"text/html,application/xhtml+xml,application/json,application/xml,text/xml;q=0.9,*/*;q=0.5"
            }
          });
          const location=response.headers.get("location");
          if(response.status>=300&&response.status<400&&location){
            if(redirectCount===5)throw new StudioJookBoxResearchError("Research stopped after too many redirects.","too_many_redirects");
            finalURL=await assertPublicHttps(new URL(location,finalURL).href);
            continue;
          }
          break;
        }
        if(!response)throw new StudioJookBoxResearchError("Research did not receive a destination response.","empty_research_response");
        const contentType=response.headers.get("content-type")||"";
        const body=await readLimitedText(response,this.maxBytes,contentType);
        return{
          ok:response.ok||[401,403,429].includes(response.status),
          status:response.status,
          requestedURL:url,
          finalURL,
          contentType,
          body,
          checkedAt:new Date().toISOString()
        };
      }catch(error){
        lastError=error;
        if(attempt<this.retries)await delay(350*attempt);
      }
    }
    return{
      ok:false,
      status:0,
      requestedURL:url,
      finalURL:url,
      contentType:"",
      body:"",
      error:lastError?.message||"Network request failed.",
      checkedAt:new Date().toISOString()
    };
  }

  async search(bandName){
    const name=String(bandName).trim();
    const queries=[
      `"${name}" "official website" band`,
      `"${name}" band music official`,
      `"${name}" band Linktree`
    ];
    const urls=queries.map(query=>`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
    const youtubeURL=`https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} band official`)}`;
    const pages=await Promise.all([...urls,youtubeURL].map(url=>this.inspect(url)));
    const results=[];
    for(const page of pages.slice(0,queries.length)){
      if(page.ok)results.push(...extractSearchResults(page.body));
    }
    const youtubeSearch=pages.at(-1);
    if(youtubeSearch.ok)results.unshift(...extractYouTubeSearchSeeds(youtubeSearch.body));
    return unique(results).slice(0,30);
  }
}

export async function researchStudioJookBox(input,{network=new StudioResearchNetwork(),now=new Date(),onProgress=()=>{}}={}){
  const bandName=clean(input?.name,120);
  if(!bandName)throw new StudioJookBoxResearchError("Add the band name before research begins.","band_name_required");
  const suppliedSeeds=unique((input?.sourceUrls||[]).map(normalizeHttps).filter(Boolean)).slice(0,3);
  const suppliedVideo=normalizeHttps(input?.youtubeUrl||"");
  const fingerprint=researchFingerprint(input);
  const startedAt=now.toISOString();
  const discoveryNotes=[];

  onProgress({stage:"discovering",message:"Finding artist-controlled sources."});
  let seedURLs=[...suppliedSeeds];
  if(!seedURLs.length){
    const discovered=await network.search(bandName).catch(()=>[]);
    seedURLs=rankSearchSeeds(discovered,bandName).slice(0,6);
    discoveryNotes.push(seedURLs.length
      ?"Name-only discovery found possible official sources; each candidate still had to pass the identity checks."
      :"Name-only discovery did not find an independently verifiable artist-controlled source.");
  }
  if(suppliedVideo&&!seedURLs.includes(suppliedVideo))seedURLs.push(suppliedVideo);

  const inspected=new Map();
  const inspect=async url=>{
    const normalized=normalizeHttps(url);
    if(!normalized)return failedPage(url,"Invalid HTTPS URL.");
    if(inspected.has(normalized))return inspected.get(normalized);
    const promise=network.inspect(normalized).catch(error=>failedPage(normalized,error.message));
    inspected.set(normalized,promise);
    return promise;
  };

  const rootPages=await mapWithConcurrency(seedURLs.slice(0,7),4,async url=>{
    const page=await inspect(url);
    const identity=page.ok&&pageIdentityMatch(page,bandName);
    return{...page,identity,entries:page.ok?extractPageEntries(page.body,page.finalURL):[]};
  });

  let verifiedRoots=rootPages.filter(page=>page.identity);
  const rootLinks=verifiedRoots.flatMap(page=>page.entries.map(entry=>({...entry,sourceURL:page.finalURL,sourceIdentity:true})));
  const likelyOfficialWebsites=unique(rootLinks
    .flatMap(entry=>{
      if(isArtistLinkHubProfile(entry.url))return[entry.url];
      const kind=classifyEntry(entry,bandName);
      if(kind==="website")return[entry.url];
      const origin=originURL(entry.url);
      return["merchandise","buy_music","contact"].includes(kind)&&officialDomainMatch(origin,bandName)?[origin]:[];
    })
    .filter(url=>!seedURLs.includes(url)))
    .slice(0,3);

  onProgress({stage:"cross_checking",message:"Cross-checking official pages and direct destinations."});
  const additionalRoots=await mapWithConcurrency(likelyOfficialWebsites,3,async url=>{
    const page=await inspect(url);
    if(page.ok&&pageIdentityMatch(page,bandName)){
      return{...page,identity:true,entries:extractPageEntries(page.body,page.finalURL)};
    }
    return null;
  });
  verifiedRoots.push(...additionalRoots.filter(Boolean));
  verifiedRoots=[...new Map(verifiedRoots.map(page=>[normalizeComparable(page.finalURL),page])).values()];

  const sourceEntries=uniqueEntries(verifiedRoots.flatMap(page=>
    extractPageEntries(page.body,page.finalURL).map(entry=>({...entry,sourceURL:page.finalURL,sourceIdentity:true}))
  ));
  for(const page of verifiedRoots){
    const kind=classifyURL(page.finalURL,"",bandName);
    if(kind==="website")sourceEntries.push({url:page.finalURL,label:"Official Website",sourceURL:page.finalURL,sourceIdentity:true});
  }
  if(suppliedVideo)sourceEntries.push({url:suppliedVideo,label:"Owner-supplied YouTube lead",sourceURL:suppliedVideo,sourceIdentity:false});

  const candidates=dedupeCandidates(sourceEntries
    .map(entry=>({...entry,kind:classifyEntry(entry,bandName)}))
    .filter(entry=>entry.kind));

  const destinationCandidates=candidates.slice(0,40).filter(candidate=>isDirectDestination(candidate.kind,candidate.url));
  const verifiedDestinationResults=await mapWithConcurrency(destinationCandidates,4,async candidate=>{
    const page=await inspect(candidate.url);
    if(!page.ok)return null;
    const linkedByVerifiedRoot=verifiedRoots.some(root=>sameURL(root.finalURL,candidate.sourceURL));
    const destinationIdentity=pageIdentityMatch(page,bandName);
    const matchingRootCount=new Set(sourceEntries.filter(entry=>sameURL(entry.url,candidate.url)&&entry.sourceIdentity).map(entry=>host(entry.sourceURL))).size;
    const confidence=destinationIdentity?100:linkedByVerifiedRoot||matchingRootCount>0?98:0;
    if(confidence<STUDIO_JOOKBOX_CONFIDENCE_GATE)return null;
    const [defaultLabel,defaultDetail]=KIND_LABELS[candidate.kind]||["Open","Verified destination"];
    return{
      candidate,
      sourceTitle:clean(candidate.label||defaultLabel,160),
      label:clean(buttonLabel(candidate.label,defaultLabel),80),
      detail:defaultDetail,
      kind:candidate.kind,
      url:cleanTrackingURL(page.finalURL||candidate.url),
      platform:platformFor(candidate.kind),
      confidence,
      verifiedAt:page.checkedAt,
      sourceURL:candidate.sourceURL,
      evidence:destinationIdentity
        ?`${defaultLabel} resolved directly and its destination metadata matched ${bandName}.`
        :`${defaultLabel} resolved directly from an identity-matched artist-controlled source for ${bandName}.`
    };
  });
  const verifiedSelections=[];
  for(const result of verifiedDestinationResults.filter(Boolean)){
    const {candidate,...selection}=result;
    verifiedSelections.push({
      id:selectionId(candidate.kind,candidate.url,verifiedSelections),
      ...selection
    });
  }

  const selections=dedupeVerifiedSelections(verifiedSelections);
  const displaySelections=KIND_PRIORITY
    .flatMap(kind=>selections.filter(item=>item.kind===kind))
    .slice(0,8);

  onProgress({stage:"video",message:"Verifying the official channel and featured video."});
  const featuredVideo=await resolveFeaturedVideo({
    bandName,
    suppliedVideo,
    selections,
    roots:verifiedRoots,
    inspect
  });

  onProgress({stage:"biography",message:"Building the sourced biography ticker."});
  const biography=extractVerifiedBiography(verifiedRoots,bandName);
  const identityHosts=new Set([
    ...verifiedRoots.map(page=>host(page.finalURL)),
    ...selections.map(item=>host(item.url))
  ].filter(Boolean));
  const checks={
    artistControlledIdentity:verifiedRoots.length>0,
    independentSources:identityHosts.size>=2,
    sourcedBiography:Boolean(biography.text&&biography.sourceURL),
    officialFeaturedVideo:Boolean(featuredVideo?.url&&featuredVideo?.identityVerified),
    verifiedDestinations:displaySelections.length>0,
    everyDisplayedDestinationVerified:displaySelections.every(item=>item.confidence>=STUDIO_JOOKBOX_CONFIDENCE_GATE)
  };
  const confidence=confidenceForChecks(checks);
  const passed=confidence>=STUDIO_JOOKBOX_CONFIDENCE_GATE&&Object.values(checks).every(Boolean);
  const finishedAt=new Date().toISOString();
  const sources=buildEvidence({
    bandName,
    verifiedRoots,
    selections,
    biography,
    featuredVideo,
    finishedAt
  });
  const omittedCandidates=candidates
    .filter(candidate=>!selections.some(selection=>sameURL(selection.url,candidate.url)))
    .slice(0,20)
    .map(candidate=>({label:candidate.label||candidate.kind,url:candidate.url,reason:"Omitted because the direct destination or artist identity did not reach 98% confidence."}));

  onProgress({stage:passed?"passed":"needs_review",message:passed?"The 98% JookBox research gate passed.":"Research stopped safely below the 98% gate."});
  return{
    schemaVersion:STUDIO_JOOKBOX_RESEARCH_SCHEMA,
    status:passed?"passed":"needs_review",
    inputFingerprint:fingerprint,
    bandName,
    startedAt,
    verifiedAt:finishedAt,
    confidence,
    confidenceGate:STUDIO_JOOKBOX_CONFIDENCE_GATE,
    passed,
    discoveryMode:suppliedSeeds.length?"artist_url_seeded":"name_only_search",
    discoveryNotes,
    checks,
    roots:verifiedRoots.map(page=>({url:page.finalURL,verifiedAt:page.checkedAt,identityVerified:true})),
    biography:{
      tickerBio:biography.text.toUpperCase(),
      paragraphs:biography.text?[biography.text]:[],
      sourceURL:biography.sourceURL
    },
    featuredVideo:featuredVideo?{
      title:featuredVideo.title,
      youtubeURL:featuredVideo.url,
      channelURL:featuredVideo.channelURL,
      selectionBasis:"most-viewed-official",
      verifiedAt:featuredVideo.verifiedAt
    }:null,
    links:linksFromSelections(selections),
    selections,
    displaySelectionIds:displaySelections.map(item=>item.id),
    sources,
    omittedCandidates,
    blockers:blockersFor(checks,{suppliedSeeds,seedCount:seedURLs.length})
  };
}

export function researchFingerprint(input={}){
  return crypto.createHash("sha256").update(JSON.stringify({
    name:clean(input.name,120).toLowerCase(),
    sourceUrls:unique((input.sourceUrls||[]).map(normalizeHttps).filter(Boolean)).sort(),
    youtubeUrl:normalizeHttps(input.youtubeUrl||"")
  })).digest("hex");
}

export function extractStudioResearchEntries(html,baseURL){
  return extractPageEntries(html,baseURL);
}

export function classifyStudioResearchEntry(entry,bandName){
  return classifyEntry(entry,bandName);
}

function confidenceForChecks(checks){
  const weights={
    artistControlledIdentity:28,
    independentSources:18,
    sourcedBiography:16,
    officialFeaturedVideo:20,
    verifiedDestinations:10,
    everyDisplayedDestinationVerified:8
  };
  const score=Object.entries(weights).reduce((sum,[key,weight])=>sum+(checks[key]?weight:0),0);
  return score===100?100:Math.min(97,score);
}

function blockersFor(checks,{suppliedSeeds,seedCount}){
  const blockers=[];
  if(!checks.artistControlledIdentity)blockers.push(suppliedSeeds.length
    ?"The supplied URL did not independently prove the band identity."
    :seedCount?"Name-only candidates did not prove an artist-controlled identity. Add the band’s official website, Linktree or social profile.":"No credible artist-controlled source was discovered. Add one official URL.");
  if(!checks.independentSources)blockers.push("A second independent destination must corroborate the band identity.");
  if(!checks.sourcedBiography)blockers.push("A concise biography could not be extracted from an identity-verified official source.");
  if(!checks.officialFeaturedVideo)blockers.push("The most-viewed embeddable video on the verified official YouTube channel could not be proved.");
  if(!checks.verifiedDestinations)blockers.push("No direct destination reached the mandatory 98% confidence gate.");
  if(!checks.everyDisplayedDestinationVerified)blockers.push("One or more proposed JookBox keys did not meet the 98% confidence gate.");
  return blockers;
}

async function resolveFeaturedVideo({bandName,suppliedVideo,selections,roots,inspect}){
  const youtubeCandidates=unique([
    ...selections.filter(item=>item.kind==="youtube").map(item=>item.url),
    ...roots.flatMap(root=>root.entries||[]).map(entry=>entry.url).filter(url=>classifyURL(url,"",bandName)==="youtube"),
    suppliedVideo
  ].filter(Boolean));
  const channelCandidates=[];
  const directVideos=[];
  for(const url of youtubeCandidates){
    const parsed=youtubeParts(url);
    if(!parsed)continue;
    if(parsed.videoId)directVideos.push(url);
    else channelCandidates.push(parsed.channelURL||url);
  }
  for(const channelURL of unique(channelCandidates)){
    const popularURL=popularVideosURL(channelURL);
    if(!popularURL)continue;
    const page=await inspect(popularURL);
    if(!page.ok||!pageIdentityMatch(page,bandName))continue;
    const video=firstYouTubeVideo(page.body);
    if(!video?.id)continue;
    const url=`https://www.youtube.com/watch?v=${video.id}`;
    const metadata=await verifiedYouTubeMetadata(video.id,bandName,inspect);
    if(!metadata)continue;
    return{
      url,
      title:metadata.title||video.title||`${bandName} featured official video`,
      channelURL,
      verifiedAt:page.checkedAt,
      identityVerified:true
    };
  }
  for(const url of directVideos){
    const page=await inspect(url);
    if(!page.ok||!pageIdentityMatch(page,bandName))continue;
    const channelURL=extractYouTubeChannelURL(page.body);
    if(!channelURL)continue;
    const popularURL=popularVideosURL(channelURL);
    const popular=popularURL?await inspect(popularURL):null;
    const first=popular?.ok&&pageIdentityMatch(popular,bandName)?firstYouTubeVideo(popular.body):null;
    if(!first?.id)continue;
    const popularVideoURL=`https://www.youtube.com/watch?v=${first.id}`;
    const metadata=await verifiedYouTubeMetadata(first.id,bandName,inspect);
    if(!metadata)continue;
    return{
      url:popularVideoURL,
      title:metadata.title||first.title||`${bandName} featured official video`,
      channelURL,
      verifiedAt:popular.checkedAt,
      identityVerified:true
    };
  }
  return null;
}

function extractVerifiedBiography(pages,bandName){
  const candidates=[];
  for(const page of pages){
    const descriptions=extractDescriptions(page.body);
    for(const [order,value] of descriptions.entries()){
      const text=cleanSentence(value,420);
      if(text.length>=55&&text.length<=420&&!isBoilerplate(text)&&biographyKnowledgeSignals(text)>=2){
        candidates.push({text,sourceURL:page.finalURL,score:biographyScore(text,page.finalURL),order});
      }
    }
  }
  const ranked=candidates.sort((a,b)=>b.score-a.score);
  const primary=ranked[0];
  if(!primary)return{text:"",sourceURL:"",score:0};
  const companion=ranked
    .slice(1,7)
    .filter(item=>sameURL(item.sourceURL,primary.sourceURL)&&Math.abs(item.order-primary.order)<=2)
    .find(item=>item.score>=220&&`${primary.text} ${item.text}`.length<=520);
  if(!companion)return primary;
  const paragraphs=[primary,companion].sort((a,b)=>a.order-b.order);
  return{
    text:paragraphs.map(item=>item.text).join(" "),
    sourceURL:primary.sourceURL,
    score:primary.score+companion.score
  };
}

function extractDescriptions(html){
  const values=[];
  const source=String(html||"");
  const metaPattern=/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|og:description|twitter:description)["'][^>]*>/gi;
  for(const tag of source.match(metaPattern)||[]){
    const content=attribute(tag,"content");
    if(content)values.push(content);
  }
  const reverseMeta=/<meta\b[^>]*content\s*=\s*["']([^"']+)["'][^>]*(?:name|property)\s*=\s*["'](?:description|og:description|twitter:description)["'][^>]*>/gi;
  for(const match of source.matchAll(reverseMeta))values.push(match[1]);
  for(const match of source.matchAll(/<p\b[^>]*>([\s\S]{50,900}?)<\/p>/gi))values.push(stripHtml(match[1]));
  for(const match of source.matchAll(/"(?:description|bio|biography|about|text|content)"\s*:\s*"((?:\\.|[^"\\]){55,1200})"/gi)){
    values.push(decodeUnicode(match[1].replaceAll("\\/","/")));
  }
  return unique(values.map(decodeHtml).map(value=>value.trim()).filter(Boolean));
}

function extractPageEntries(html,baseURL){
  const entries=[];
  const expanded=String(html||"")
    .replaceAll("\\u003c","<")
    .replaceAll("\\u003e",">")
    .replaceAll("\\u0026","&")
    .replaceAll("\\/","/")
    .replaceAll('\\"','"');
  for(const match of expanded.matchAll(/<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)){
    const url=resolveHttps(decodeHtml(match[2]),baseURL);
    if(url)entries.push({url,label:cleanSentence(stripHtml(match[4]),160)});
  }
  for(const jsonText of scriptJsonBlocks(html)){
    try{walkJson(JSON.parse(decodeHtml(jsonText)),entries,baseURL)}catch{}
  }
  for(const match of expanded.matchAll(/https:\\?\/\\?\/[^"'<>\\\s]+/gi)){
    const url=resolveHttps(match[0].replaceAll("\\/","/").replaceAll("\\u0026","&"),baseURL);
    if(url)entries.push({url,label:""});
  }
  return uniqueEntries(entries);
}

function walkJson(value,entries,baseURL){
  if(Array.isArray(value)){for(const item of value)walkJson(item,entries,baseURL);return}
  if(!value||typeof value!=="object")return;
  const rawURL=value.url||value.href||value.link||value.destination||value.targetUrl;
  if(typeof rawURL==="string"){
    const url=resolveHttps(rawURL,baseURL);
    if(url)entries.push({url,label:cleanSentence(value.title||value.label||value.name||value.text||"",160)});
  }
  for(const child of Object.values(value))walkJson(child,entries,baseURL);
}

function classifyEntry(entry,bandName){return classifyURL(entry.url,entry.label,bandName)}
function classifyURL(value,label="",bandName=""){
  let url;try{url=new URL(value)}catch{return""}
  const hostname=url.hostname.replace(/^www\./,"").toLowerCase();
  const path=url.pathname.toLowerCase();
  const context=`${label} ${path}`.toLowerCase();
  if(LINK_HUB_HOSTS.has(hostname)||IGNORED_HOSTS.has(hostname)||SEARCH_HOSTS.has(hostname)||IGNORED_EXTENSIONS.test(url.href))return"";
  if(hostname==="open.spotify.com"&&/^\/artist\/[a-z0-9]+/i.test(path))return"spotify";
  if(hostname.endsWith("bandcamp.com")&&!path.startsWith("/search"))return"bandcamp";
  if(["youtube.com","m.youtube.com","youtu.be"].includes(hostname)&&!path.startsWith("/results")&&!path.startsWith("/search"))return"youtube";
  if(hostname==="instagram.com"&&path.split("/").filter(Boolean).length>=1&&!path.startsWith("/explore"))return"instagram";
  if(["facebook.com","m.facebook.com"].includes(hostname)&&path!=="/"&&!/^\/(?:search|login|share)/.test(path))return"facebook";
  if(hostname==="tiktok.com"&&path.startsWith("/@"))return"tiktok";
  if(/\b(newsletter|mailing list|subscribe)\b/.test(context))return"newsletter";
  if(/\b(contact|booking|enquir)/.test(context))return"contact";
  if(/\b(ticket|tickets|show|gig|tour date|event)\b/.test(context))return"show";
  if(/\b(merch|merchandise|apparel|t-?shirt|shop|store)\b/.test(context))return"merchandise";
  if(/\b(buy music|music store|releases|discography|albums)\b/.test(context))return"buy_music";
  if(/\b(podcast|interview|reaction|deep cut)\b/.test(context)&&hostname.includes("youtube"))return"deep_cut";
  if(PLATFORM_HOSTS.has(hostname))return"";
  if(/\b(official website|band website|website|official site)\b/.test(label.toLowerCase()))return"website";
  if(officialDomainMatch(value,bandName))return"website";
  return"";
}

function isDirectDestination(kind,value){
  let url;try{url=new URL(value)}catch{return false}
  if(url.protocol!=="https:"||isSearchURL(url)||IGNORED_EXTENSIONS.test(url.href))return false;
  const hostname=url.hostname.replace(/^www\./,"").toLowerCase();
  const path=url.pathname.toLowerCase();
  if(kind==="spotify")return hostname==="open.spotify.com"&&/^\/artist\/[a-z0-9]+/i.test(path);
  if(kind==="instagram")return hostname==="instagram.com"&&path.split("/").filter(Boolean).length>=1;
  if(kind==="facebook")return ["facebook.com","m.facebook.com"].includes(hostname)&&path!=="/";
  if(kind==="tiktok")return hostname==="tiktok.com"&&path.startsWith("/@");
  if(kind==="youtube")return ["youtube.com","m.youtube.com","youtu.be"].includes(hostname)&&!path.startsWith("/results");
  if(kind==="bandcamp")return hostname.endsWith("bandcamp.com")&&!path.startsWith("/search");
  return true;
}

function pageIdentityMatch(page,bandName){
  let url;
  try{url=new URL(page.finalURL||page.requestedURL||"")}catch{}
  if(url&&LINK_HUB_HOSTS.has(url.hostname.replace(/^www\./,"").toLowerCase())&&!isArtistLinkHubProfile(url.href))return false;
  if(url&&["youtube.com","www.youtube.com","m.youtube.com"].includes(url.hostname.toLowerCase())&&/^\/(?:channel\/|@|c\/|user\/)/.test(url.pathname)){
    const body=String(page.body||"");
    const identityValues=[
      ...[...body.matchAll(/<title[^>]*>([\s\S]{1,180}?)<\/title>/gi)].map(match=>stripHtml(match[1])),
      ...[...body.matchAll(/"channelMetadataRenderer":\{"title":"((?:\\.|[^"\\]){1,180})"/gi)].map(match=>decodeUnicode(match[1])),
      ...[...body.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*content=["']([^"']+)["']/gi)].map(match=>match[1])
    ];
    return identityValues.some(value=>textIdentityMatch(value.replace(/\s*-\s*YouTube\s*$/i,""),bandName));
  }
  const haystack=decodeHtml(`${page.finalURL||""} ${page.body||""}`).toLowerCase();
  return textIdentityMatch(haystack,bandName);
}

function textIdentityMatch(value,bandName){
  const haystack=compact(value);
  const name=compact(bandName);
  if(name.length>=4&&haystack.includes(name))return true;
  const words=String(bandName).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const meaningful=words.filter(word=>word.length>2&&!["the","and","band","music","official"].includes(word));
  const required=meaningful.length?meaningful:words;
  return required.length>0&&required.filter(word=>haystack.includes(compact(word))).length>=Math.max(1,Math.ceil(required.length*.75));
}

function buildEvidence({bandName,verifiedRoots,selections,biography,featuredVideo,finishedAt}){
  const sources=[];
  for(const page of verifiedRoots){
    sources.push({
      destination:"identity",
      url:page.finalURL,
      sourceType:LINK_HUB_HOSTS.has(host(page.finalURL))?"official artist-controlled link hub":"identity-matched artist-controlled source",
      identityVerified:true,
      verifiedAt:page.checkedAt||finishedAt,
      evidence:`The page identified ${bandName} and supplied direct artist destinations used for independent cross-checking.`
    });
  }
  for(const item of selections){
    sources.push({
      destination:`selection:${item.id}`,
      url:item.url,
      sourceType:"verified direct JookBox destination",
      identityVerified:true,
      verifiedAt:item.verifiedAt||finishedAt,
      evidence:item.evidence
    });
    const destination=destinationForKind(item.kind);
    if(destination)sources.push({...sources.at(-1),destination});
  }
  if(biography.text&&biography.sourceURL)sources.push({
    destination:"biography",
    url:biography.sourceURL,
    sourceType:"identity-verified artist-controlled biography source",
    identityVerified:true,
    verifiedAt:finishedAt,
    evidence:`The official source supplied the concise biography text used by the ${bandName} ticker.`
  });
  if(featuredVideo)sources.push({
    destination:"featuredVideo",
    url:featuredVideo.url,
    sourceType:"official YouTube channel Popular ordering",
    identityVerified:true,
    verifiedAt:featuredVideo.verifiedAt||finishedAt,
    evidence:`The verified official channel Popular ordering supplied the featured ${bandName} video, and the privacy-enhanced embed was reachable.`
  });
  return dedupeEvidence(sources);
}

function linksFromSelections(selections){
  const links={};
  for(const item of selections){
    const destination=destinationForKind(item.kind);
    if(destination&&!links[destination])links[destination]=item.url;
  }
  return links;
}

function destinationForKind(kind){
  return({
    bandcamp:"bandcamp",
    spotify:"spotify",
    youtube:"youtube",
    instagram:"instagram",
    facebook:"facebook",
    tiktok:"tiktok",
    website:"website",
    buy_music:"buyMusic",
    merchandise:"merchandise",
    contact:"contact"
  })[kind]||"";
}

function platformFor(kind){
  return(["youtube","facebook","instagram","merchandise","website"].includes(kind)?kind:"website");
}

function firstYouTubeVideo(body){
  const source=String(body||"");
  const id=[
    /"richItemRenderer":\{"content":\{"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"/,
    /"gridVideoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"/,
    /"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"/,
    /"videoId":"([A-Za-z0-9_-]{11})"/
  ].map(pattern=>source.match(pattern)?.[1]).find(Boolean);
  if(!id)return null;
  const vicinity=source.slice(Math.max(0,source.indexOf(`"videoId":"${id}"`)-500),source.indexOf(`"videoId":"${id}"`)+3000);
  const title=decodeUnicode(vicinity.match(/"title":\{"runs":\[\{"text":"([^"]+)"/)?.[1]||vicinity.match(/"title":\{"simpleText":"([^"]+)"/)?.[1]||"");
  return{id,title:cleanSentence(title,120)};
}

async function verifiedYouTubeMetadata(videoId,bandName,inspect){
  const metadataURL=`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  const metadataPage=await inspect(metadataURL);
  if(!metadataPage.ok)return null;
  let metadata;try{metadata=JSON.parse(metadataPage.body)}catch{return null}
  if(!textIdentityMatch(metadata.author_name||"",bandName))return null;
  const embed=await inspect(`https://www.youtube-nocookie.com/embed/${videoId}`);
  if(!embed.ok)return null;
  return{title:cleanSentence(metadata.title,120),authorName:cleanSentence(metadata.author_name,120)};
}

function youtubeParts(value){
  let url;try{url=new URL(value)}catch{return null}
  const hostname=url.hostname.replace(/^www\./,"");
  if(hostname==="youtu.be"){
    const videoId=url.pathname.split("/").filter(Boolean)[0];
    return/^[A-Za-z0-9_-]{11}$/.test(videoId||"")?{videoId}:null;
  }
  if(!["youtube.com","m.youtube.com"].includes(hostname))return null;
  const videoId=url.searchParams.get("v")||(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/.exec(url.pathname)?.[1]);
  if(videoId)return{videoId};
  if(/^\/(?:channel|c|user|@)\//.test(url.pathname)||url.pathname.startsWith("/@"))return{channelURL:`https://www.youtube.com${url.pathname.replace(/\/videos\/?$/,"")}`};
  return null;
}

function extractYouTubeChannelURL(body){
  const channelId=String(body||"").match(/"channelId":"(UC[A-Za-z0-9_-]{20,})"/)?.[1];
  if(channelId)return`https://www.youtube.com/channel/${channelId}`;
  const canonical=String(body||"").match(/"canonicalBaseUrl":"(\/@[A-Za-z0-9._-]+)"/)?.[1];
  return canonical?`https://www.youtube.com${canonical}`:"";
}

function popularVideosURL(channelURL){
  const parts=youtubeParts(channelURL);
  if(!parts?.channelURL)return"";
  return`${parts.channelURL.replace(/\/(?:about|videos)\/?$/,"").replace(/\/$/,"")}/videos?view=0&sort=p&flow=grid`;
}

function rankSearchSeeds(results,bandName){
  return unique(results.map(normalizeHttps).filter(Boolean))
    .map(url=>({url,score:searchSeedScore(url,bandName)}))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score)
    .map(item=>item.url);
}

function searchSeedScore(value,bandName){
  let url;try{url=new URL(value)}catch{return 0}
  const hostname=url.hostname.replace(/^www\./,"");
  let score=textIdentityMatch(url.href,bandName)?20:0;
  if(LINK_HUB_HOSTS.has(hostname))score+=100;
  else if(hostname.endsWith("bandcamp.com"))score+=70;
  else if(hostname==="youtube.com"&&/^\/(?:channel\/[A-Za-z0-9_-]+|@[^/]+)/.test(url.pathname))score+=90;
  else if(["youtube.com","instagram.com","facebook.com","tiktok.com","open.spotify.com"].includes(hostname))score+=55;
  else if(score>0&&!SEARCH_HOSTS.has(hostname)&&!IGNORED_HOSTS.has(hostname))score+=80;
  return score;
}

function extractSearchResults(xml){
  const urls=[];
  for(const match of String(xml||"").matchAll(/<item>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/gi)){
    const url=decodeHtml(stripCdata(match[1])).trim();
    if(normalizeHttps(url))urls.push(url);
  }
  return unique(urls);
}

function extractYouTubeSearchSeeds(html){
  const channels=[];
  for(const match of String(html||"").matchAll(/"channelId":"([A-Za-z0-9_-]{20,30})"/g)){
    channels.push(`https://www.youtube.com/channel/${match[1]}/about`);
  }
  return unique(channels).slice(0,10);
}

async function assertPublicHttps(value){
  const normalized=normalizeHttps(value);
  if(!normalized)throw new StudioJookBoxResearchError("Research accepts HTTPS destinations only.","invalid_research_url");
  const url=new URL(normalized);
  const hostname=url.hostname.toLowerCase();
  if(hostname==="localhost"||hostname.endsWith(".localhost")||hostname.endsWith(".local")||isPrivateIp(hostname)){
    throw new StudioJookBoxResearchError("Research cannot access local or private network addresses.","private_network_blocked");
  }
  if(!isIpLiteral(hostname)){
    const addresses=await dns.lookup(hostname,{all:true,verbatim:true}).catch(()=>[]);
    if(!addresses.length)throw new StudioJookBoxResearchError(`Research could not resolve ${hostname}.`,"dns_failed");
    if(addresses.some(item=>isPrivateIp(item.address)))throw new StudioJookBoxResearchError("Research cannot access local or private network addresses.","private_network_blocked");
  }
  return url.href;
}

async function readLimitedText(response,maxBytes,contentType){
  if(!/(?:text|html|json|xml|javascript)/i.test(contentType))return"";
  const reader=response.body?.getReader();
  if(!reader)return(await response.text()).slice(0,maxBytes);
  const chunks=[];let total=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    const remaining=maxBytes-total;
    if(remaining<=0){await reader.cancel();break}
    const chunk=value.length>remaining?value.slice(0,remaining):value;
    chunks.push(chunk);total+=chunk.length;
    if(total>=maxBytes){await reader.cancel();break}
  }
  return new TextDecoder().decode(concatBytes(chunks,total));
}

function concatBytes(chunks,total){
  const output=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length}
  return output;
}

function dedupeCandidates(entries){
  const seen=new Set();
  return entries.filter(entry=>{
    const key=`${entry.kind}:${normalizeComparable(entry.url)}`;
    if(!entry.kind||seen.has(key))return false;
    seen.add(key);return true;
  });
}

function dedupeVerifiedSelections(items){
  const seenURLs=new Set(),seenKinds=new Set();
  return items.filter(item=>{
    const url=normalizeComparable(item.url);
    if(seenURLs.has(url))return false;
    if(["spotify","bandcamp","instagram","facebook","tiktok","website","buy_music","merchandise","youtube"].includes(item.kind)&&seenKinds.has(item.kind))return false;
    seenURLs.add(url);seenKinds.add(item.kind);return true;
  });
}

function dedupeEvidence(items){
  const seen=new Set();
  return items.filter(item=>{
    const key=`${item.destination}:${normalizeComparable(item.url)}`;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

function uniqueEntries(entries){
  const seen=new Set();
  return entries.filter(entry=>{
    const url=normalizeHttps(entry.url);
    if(!url||IGNORED_EXTENSIONS.test(url))return false;
    const key=`${normalizeComparable(url)}:${clean(entry.label,160).toLowerCase()}`;
    if(seen.has(key))return false;
    seen.add(key);entry.url=url;return true;
  });
}

function selectionId(kind,url,existing){
  const base=`${kind}-${crypto.createHash("sha1").update(normalizeComparable(url)).digest("hex").slice(0,8)}`;
  let id=base,index=2;
  while(existing.some(item=>item.id===id))id=`${base}-${index++}`;
  return id;
}

function buttonLabel(value,fallback){
  const label=cleanSentence(value,80);
  if(!label||label.length>38||/^https?:/i.test(label)||/\b(?:skip to|click here|learn more|menu|home page)\b/i.test(label))return fallback;
  return label;
}

function biographyScore(text,url){
  const hostname=host(url);
  const knowledgeSignals=biographyKnowledgeSignals(text);
  const originBonus=/\bformed (?:during|in|by)\b/i.test(text)?180:0;
  const promotionalPenalty=/\b(?:book now|buy now|sign up|subscribe|tickets available)\b/i.test(text)?180:0;
  const reviewPenalty=/\b(?:promises you|outstanding reviews|night to remember)\b/i.test(text)?140:0;
  const testimonialPenalty=/\b(?:thank you|our awards|our event|nobody left|wanted to go home|corporate cover band|testimonial)\b/i.test(text)?420:0;
  return text.length+(LINK_HUB_HOSTS.has(hostname)?0:80)+(knowledgeSignals*24)+originBonus-promotionalPenalty-reviewPenalty-testimonialPenalty;
}

function biographyKnowledgeSignals(text){
  return(text.match(/\b(?:formed|band|collective|lineup|members?|music|musicians?|performers?|Australian|rock|punk|metal|tour(?:ing)?|record(?:ed|ing)?|career|album|single|songs?|hits?|live|supergroup)\b/gi)||[]).length;
}

function isBoilerplate(value){
  return/\b(cookie|privacy policy|terms of use|accept all|sign in|log in|javascript|browser)\b/i.test(value);
}

function scriptJsonBlocks(html){
  const values=[];
  for(const match of String(html||"").matchAll(/<script\b[^>]*(?:type=["']application\/json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi))values.push(match[1]);
  return values;
}

function attribute(tag,name){
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]||"";
}

function resolveHttps(value,baseURL){
  try{
    const url=new URL(decodeHtml(String(value||"").replaceAll("\\/","/")),baseURL);
    if(url.protocol!=="https:")return"";
    if(["youtube.com","www.youtube.com","m.youtube.com"].includes(url.hostname.toLowerCase())&&url.pathname==="/redirect"){
      const destination=url.searchParams.get("q")||url.searchParams.get("url");
      if(destination)return resolveHttps(destination,baseURL);
    }
    url.hash="";
    return url.href;
  }catch{return""}
}

function normalizeHttps(value){
  const raw=String(value||"").trim();
  if(!raw)return"";
  try{
    const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:`https://${raw}`);
    if(url.protocol!=="https:")return"";
    url.hash="";
    return url.href;
  }catch{return""}
}

function sameURL(a,b){return normalizeComparable(a)===normalizeComparable(b)}
function originURL(value){try{return`${new URL(value).origin}/`}catch{return""}}
function normalizeComparable(value){
  try{
    const url=new URL(value);
    url.hash="";
    for(const key of [...url.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|si|ref)$/i.test(key))url.searchParams.delete(key);
    return`${url.hostname.replace(/^www\./,"").toLowerCase()}${url.pathname.replace(/\/$/,"")}${url.search}`;
  }catch{return String(value||"")}
}
function cleanTrackingURL(value){
  try{
    const url=new URL(value);
    url.hash="";
    for(const key of [...url.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|si|ref|_t|_r|igsh)$/i.test(key))url.searchParams.delete(key);
    return url.href;
  }catch{return String(value||"")}
}
function officialDomainMatch(value,bandName){
  try{
    const url=new URL(value);
    const depth=url.pathname.split("/").filter(Boolean).length;
    return depth===0&&textIdentityMatch(url.hostname,bandName);
  }catch{return false}
}
function isArtistLinkHubProfile(value){
  try{
    const url=new URL(value);
    const hostname=url.hostname.replace(/^www\./,"").toLowerCase();
    if(!LINK_HUB_HOSTS.has(hostname))return false;
    const parts=url.pathname.split("/").filter(Boolean);
    if(parts.length!==1)return false;
    return!/^(?:s|about|legal|help|privacy|terms|trust|login|register|signup|discover|marketplace)$/i.test(parts[0]);
  }catch{return false}
}
function isSearchURL(url){return /(^|\/)(?:search|results)(?:\/|$)/i.test(url.pathname)||url.searchParams.has("search_query")}
function host(value){try{return new URL(value).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}
function compact(value){return decodeHtml(String(value||"")).toLowerCase().replace(/[^a-z0-9]+/g,"")}
function clean(value,max=Infinity){return String(value??"").trim().replace(/\s+/g," ").slice(0,max)}
function cleanSentence(value,max=Infinity){return clean(decodeHtml(stripHtml(value)),max).replace(/\s+([,.;!?])/g,"$1")}
function stripHtml(value){return String(value||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ")}
function decodeHtml(value){
  return String(value||"")
    .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&nbsp;/gi," ")
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(parseInt(code,16)));
}
function decodeUnicode(value){
  try{return JSON.parse(`"${String(value||"").replaceAll('"','\\"')}"`)}catch{return String(value||"").replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))}
}
function stripCdata(value){return String(value||"").replace(/^<!\[CDATA\[|\]\]>$/g,"")}
function unique(items){return[...new Set(items)]}
async function mapWithConcurrency(items,limit,worker){
  const results=new Array(items.length);
  let nextIndex=0;
  const runners=Array.from({length:Math.min(Math.max(1,limit),items.length)},async()=>{
    while(nextIndex<items.length){
      const index=nextIndex++;
      results[index]=await worker(items[index],index);
    }
  });
  await Promise.all(runners);
  return results;
}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function failedPage(url,error){return{ok:false,status:0,requestedURL:url,finalURL:url,contentType:"",body:"",error,checkedAt:new Date().toISOString()}}
function isIpLiteral(hostname){return/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)||hostname.includes(":")}
function isPrivateIp(value){
  const ip=String(value||"").toLowerCase();
  if(ip==="::1"||ip==="0:0:0:0:0:0:0:1"||ip.startsWith("fe80:")||ip.startsWith("fc")||ip.startsWith("fd"))return true;
  const parts=ip.split(".").map(Number);
  if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
  return parts[0]===10||parts[0]===127||parts[0]===0||(parts[0]===169&&parts[1]===254)||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||(parts[0]===192&&parts[1]===168);
}

export class StudioJookBoxResearchError extends Error{
  constructor(message,code="jookbox_research_failed"){super(message);this.name="StudioJookBoxResearchError";this.code=code}
}
