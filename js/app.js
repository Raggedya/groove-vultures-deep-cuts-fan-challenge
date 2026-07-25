"use strict";

const VERSION="20260726-laneway-company-1";
const $=id=>document.getElementById(id);
const els={page:$("discoveryPage"),error:$("errorScreen"),errorMessage:$("errorMessage"),bandName:$("bandName"),bio:$("artistBio"),artwork:$("heroArtwork"),brandLogo:$("editionBrandLogo"),waveform:$("sonicSignature"),features:$("featureList"),video:$("featuredVideo"),videoLabel:$("featuredVideoLabel"),videoTitle:$("featuredVideoTitle"),videoFrame:$("featuredVideoFrame"),links:$("platformLinks"),share:$("shareButton"),status:$("shareStatus"),description:$("pageDescription"),poweredBy:$("poweredByLabel"),copyright:$("coverCopyright"),lanewayHome:$("lanewayHomeLink"),lanewayRecommended:$("lanewayRecommendedLink"),companyDirectory:$("lanewayCompanyDirectory"),companyDirectoryCount:$("lanewayCompanyDirectoryCount"),companySearch:$("lanewayCompanySearch"),companyArtistList:$("lanewayCompanyArtistList"),companyEmpty:$("lanewayCompanyEmpty")};

const MUSIC_LINK_DEFINITIONS=[
  {key:"buyMusic",label:"Buy Music",subLabel:"Purchase music directly",priority:"primary",fallback:"bandcamp"},
  {key:"spotify",label:"Listen on Spotify",subLabel:"Open the artist on Spotify",priority:"primary"},
  {key:"bandcamp",label:"Bandcamp",subLabel:"Listen directly"},
  {key:"youtube",label:"YouTube",subLabel:"Official videos"},
  {key:"instagram",label:"Instagram",subLabel:"Latest updates"},
  {key:"facebook",label:"Facebook",subLabel:"Follow the artist"},
  {key:"website",label:"Band Website",subLabel:"Official website"},
  {key:"merchandise",label:"Buy Merch",subLabel:"Official merchandise"},
  {key:"newsReviews",label:"News & Reviews",subLabel:"Latest verified coverage",priority:"editorial"}
];

const CAR_LINK_DEFINITIONS=[
  {key:"history",label:"Model History",subLabel:"Discover the EH story",priority:"primary"},
  {key:"specifications",label:"Specifications",subLabel:"Engines, dimensions and variants",priority:"primary"},
  {key:"buyerGuide",label:"Buyer’s Guide",subLabel:"What to inspect before buying"},
  {key:"youtube",label:"Watch",subLabel:"Verified EH Holden video"},
  {key:"ownersClub",label:"Owners’ Community",subLabel:"Connect with EH enthusiasts"},
  {key:"partsRestoration",label:"Parts & Restoration",subLabel:"Keep an EH on the road"},
  {key:"carsForSale",label:"Cars for Sale",subLabel:"Browse current EH listings"},
  {key:"newsReviews",label:"Articles & Features",subLabel:"Independent automotive coverage",priority:"editorial"}
];

const CLUB_LINK_DEFINITIONS=[
  {key:"website",label:"Official Website",subLabel:"Club home",priority:"primary"},
  {key:"calendar",label:"Club Calendar",subLabel:"What’s on",priority:"primary"},
  {key:"membership",label:"Join the Club",subLabel:"Membership and coaching"},
  {key:"barefootBowls",label:"Barefoot Bowls",subLabel:"Casual public sessions"},
  {key:"pennant",label:"Pennant Bowls",subLabel:"Teams, sides and competition"},
  {key:"events",label:"Club Events",subLabel:"Social and bowls events"},
  {key:"venueHire",label:"Venue Hire",subLabel:"Functions, bowls and facilities"},
  {key:"news",label:"Club News",subLabel:"Latest club updates"},
  {key:"history",label:"Club History",subLabel:"The club story"},
  {key:"contact",label:"Contact the Club",subLabel:"Location and enquiries"},
  {key:"facebook",label:"Facebook",subLabel:"Official club updates"},
  {key:"bowlsVictoria",label:"Bowls Victoria",subLabel:"State bowls resources",priority:"editorial"}
];

const SCHOOL_LINK_DEFINITIONS=[
  {key:"website",label:"Official Website",subLabel:"School home",priority:"primary"},
  {key:"enrolment",label:"Enrolment",subLabel:"How to enrol",priority:"primary"},
  {key:"virtualTour",label:"Virtual Tour",subLabel:"Explore the school"},
  {key:"principalMessage",label:"Principal's Message",subLabel:"Welcome from the principal"},
  {key:"visionValues",label:"Vision & Values",subLabel:"What guides the school"},
  {key:"curriculum",label:"Curriculum",subLabel:"Teaching and learning"},
  {key:"studentLife",label:"Student Life",subLabel:"Programs and opportunities"},
  {key:"newsletter",label:"Newsletter",subLabel:"Latest school news"},
  {key:"termDates",label:"Term Dates",subLabel:"School calendar"},
  {key:"policies",label:"Policies",subLabel:"Policies and procedures"},
  {key:"contact",label:"Contact",subLabel:"Location and enquiries"},
  {key:"schoolProject",label:"School Upgrade",subLabel:"Official project information",priority:"editorial"},
  {key:"youtube",label:"Watch Our School",subLabel:"Featured school video"}
];

let platform,editionEntry,config;
let analytics={device:"desktop",track(){return null}};
let attentionTimer=0;
init();

async function init(){
  try{
    platform=await fetchJson(`/platform.json?v=${VERSION}`);
    const pathId=location.pathname.match(/^\/e\/([A-Za-z0-9_-]+)/)?.[1];
    const legacy=new URLSearchParams(location.search).get("edition");
    const requested=pathId||legacy||platform.defaultEdition;
    editionEntry=platform.editions.find(item=>(item.editionId===requested||item.slug===requested)&&item.active);
    if(!editionEntry)throw new Error(`Unknown edition: ${requested}`);
    config=await fetchJson(`/${editionEntry.config}?v=${VERSION}`);
    analytics=new DeepCutsAnalytics.Tracker({platformConfig:platform,editionEntry,editionConfig:config});
    await applyConfig();
    analytics.track("discovery_page_viewed",{page_location:location.origin+location.pathname,page_identifier:pageIdentifier()},{onceKey:`page:${editionEntry.editionId||editionEntry.slug}`});
  }catch(error){console.error(error);showError("This Deep Cuts page could not be loaded. Please refresh and try again.")}
}

async function fetchJson(url){const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error(`${url} returned ${response.status}`);return response.json()}

async function applyConfig(){
  const name=config.bandName||editionEntry.name;
  const cars=isCarEdition(),clubs=isClubEdition(),schools=isSchoolEdition(),laneway=isLanewayEdition(),lanewayCompany=isLanewayCompanyEdition();
  document.documentElement.dataset.editionType=config.editionType||"music";
  document.title=`${name} | ${lanewayCompany?"Deep Cuts":laneway?"Laneway":schools?"School Discovery":clubs?"Deep Cuts Clubs":cars?"Deep Cuts Cars":"Deep Cuts"}`;
  const bio=config.discovery?.bio||config.description||`Discover ${name}.`;
  els.description.content=lanewayCompany?`Discover Laneway Music through an eight-question quiz, featured video and verified artist Spotify destinations.`:laneway?`Discover ${name} through Laneway's positive five-question band quiz and verified official links.`:schools?`Discover ${name} through verified official school information and video.`:clubs?`Verified club, membership, events, bowls and community links for ${name}.`:cars?`Verified history, specifications, buying, ownership and restoration links for ${name}.`:`Official music, video and social links for ${name}.`;
  els.bandName.textContent=name;
  els.bio.textContent=bio;
  if(schools||laneway||lanewayCompany){els.artwork.hidden=true;els.artwork.removeAttribute("src");els.artwork.alt=""}else{els.artwork.hidden=false;els.artwork.src=`/${config.characterArtwork||"assets/aggits-original-cutout-v4.png"}`;els.artwork.alt=`Aggits presenting ${name}`}
  if(laneway||lanewayCompany){els.brandLogo.hidden=false;els.brandLogo.src=`/${(lanewayCompany?config.lanewayCompany:config.laneway)?.logoArtwork||"assets/laneway-music-logo-reverse-transparent.png"}`;els.brandLogo.alt="Laneway Music"}else{els.brandLogo.hidden=true;els.brandLogo.removeAttribute("src");els.brandLogo.alt=""}
  els.copyright.textContent=config.social?.copyright||"copyright Clearlight Creative";
  els.poweredBy.textContent=laneway?"Deep Cuts":lanewayCompany?"Deep Cuts":schools?"School Discovery":clubs?"Powered by Deep Cuts Clubs":cars?"Powered by Deep Cuts Cars":"Powered by Deep Cuts";
  els.videoLabel.textContent=laneway||lanewayCompany?"Featured video":schools?"Discover our school":clubs?"Featured club video":cars?"Featured automotive video":"Featured video";
  buildFeatures(laneway?config.laneway?.heroLabels:schools?config.school?.heroLabels:clubs?config.club?.heroLabels:cars?config.automotive?.heroLabels:["Listen","Watch","Follow","Buy Stuff"]);
  document.documentElement.style.setProperty("--accent",config.theme?.accent||"#2f80ff");
  if(schools){document.documentElement.style.setProperty("--school-secondary",config.theme?.accentSecondary||"#00C4B4");document.documentElement.style.setProperty("--school-navy",config.theme?.navy||"#0A2342");document.documentElement.style.setProperty("--school-surface",config.theme?.surface||"#FFFFFF");document.documentElement.style.setProperty("--school-content",config.theme?.contentBackground||"#F8FAFC")}
  buildWaveform(name);
  buildFeaturedVideo();
  buildLinks();
  if(lanewayCompany)await buildLanewayCompanyDirectory();
  configureLanewayUtilityLinks();
  if(schools)await SchoolDiscoveryQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("schoolChallengeButton")});
  if(laneway)await LanewayQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("lanewayChallengeButton")});
  if(lanewayCompany)await LanewayCompanyQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("lanewayCompanyChallengeButton")});
  startAttentionCycle();
}

function isCarEdition(){return config.editionType==="car"}
function isClubEdition(){return config.editionType==="club"}
function isSchoolEdition(){return config.editionType==="school"}
function isLanewayEdition(){return config.editionType==="laneway"}
function isLanewayCompanyEdition(){return config.editionType==="laneway_company"}

function configureLanewayUtilityLinks(){
  if(!isLanewayEdition()&&!isLanewayCompanyEdition()){
    els.lanewayHome.hidden=true;els.lanewayRecommended.hidden=true;
    return;
  }
  const settings=isLanewayCompanyEdition()?config.lanewayCompany:config.laneway;
  const homeURL=validHttps(settings?.recordCompanyHomeURL);
  const recommendedURL=validHttps(settings?.recommendedArtistsURL);
  if(!homeURL||!recommendedURL)throw new Error("Laneway record-company navigation is incomplete.");
  for(const [element,url,destination] of [[els.lanewayHome,homeURL,"record_company_home"],[els.lanewayRecommended,recommendedURL,"recommended_artists"]]){
    element.href=url;element.hidden=false;
    element.setAttribute("aria-label",`${element.textContent}: Laneway Music (opens in a new tab)`);
    element.addEventListener("click",()=>DeepCutsInteractions.trackOutbound(analytics,destination,url),{passive:true});
  }
}

function buildFeatures(labels){
  const values=Array.isArray(labels)&&labels.length===4?labels:["Discover","Watch","Connect","Own & Restore"];
  els.features.innerHTML=values.map(label=>`<li>${escapeHtml(label)}</li>`).join("");
}

function buildWaveform(name){
  els.waveform.innerHTML="";
  let seed=[...name].reduce((value,char)=>((value*33)^char.charCodeAt(0))>>>0,2166136261);
  for(let index=0;index<47;index+=1){
    seed=(seed*1664525+1013904223)>>>0;
    const distance=Math.abs(index-23)/23;
    const envelope=Math.max(.2,1-Math.pow(distance,1.55));
    const height=Math.round(7+envelope*(12+(seed%28)));
    const bar=document.createElement("span");
    bar.style.setProperty("--bar-height",`${height}px`);
    els.waveform.append(bar);
  }
}

function linkValue(definition){
  if(definition.key==="buyMusic")return validHttps(config.links?.buyMusic)||validHttps(config.links?.[definition.fallback]);
  return validHttps(config.links?.[definition.key]);
}

function youtubeVideoId(value){
  const url=validHttps(value);if(!url)return"";
  try{
    const parsed=new URL(url);const host=parsed.hostname.replace(/^www\./,"").toLowerCase();
    if(host==="youtu.be")return safeVideoId(parsed.pathname.split("/").filter(Boolean)[0]);
    if(host!=="youtube.com"&&host!=="m.youtube.com"&&host!=="music.youtube.com"&&host!=="youtube-nocookie.com")return"";
    if(parsed.pathname==="/watch")return safeVideoId(parsed.searchParams.get("v"));
    const match=parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);return safeVideoId(match?.[1]);
  }catch{return""}
}

function safeVideoId(value){return /^[A-Za-z0-9_-]{11}$/.test(String(value||""))?String(value):""}

function buildFeaturedVideo(){
  const id=youtubeVideoId(config.featuredVideo?.youtubeURL);
  if(!id){els.video.hidden=true;els.videoFrame.removeAttribute("src");return}
  const title=config.featuredVideo?.title||`${config.bandName} featured video`;
  els.videoTitle.textContent=title;
  els.videoFrame.title=`${title} — ${config.bandName}`;
  els.videoFrame.src=`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  els.video.hidden=false;
}

function buildLinks(){
  els.links.innerHTML="";
  const definitions=isLanewayCompanyEdition()?[]:isSchoolEdition()?SCHOOL_LINK_DEFINITIONS:isClubEdition()?CLUB_LINK_DEFINITIONS:isCarEdition()?CAR_LINK_DEFINITIONS:MUSIC_LINK_DEFINITIONS;
  let schoolChallengeAdded=false;
  for(const definition of definitions){
    if(isSchoolEdition()&&definition.key==="schoolProject"&&!schoolChallengeAdded){els.links.append(createSchoolChallengeCard());schoolChallengeAdded=true}
    const url=linkValue(definition);
    if(!url)continue;
    const element=document.createElement("a");
    element.className=`platform-link is-active${definition.priority?` ${definition.priority}`:""}`;
    element.dataset.destination=definition.key;
    element.innerHTML=`<span class="link-copy"><strong>${definition.label}</strong><small>${activeSubtitle(definition)}</small></span><span class="link-arrow" aria-hidden="true">&gt;</span>`;
    element.href=url;element.target="_blank";element.rel="noopener noreferrer";
    element.setAttribute("aria-label",`${definition.label} for ${config.bandName} (opens in a new tab)`);
    element.addEventListener("click",()=>DeepCutsInteractions.trackOutbound(analytics,analyticsDestination(definition.key),url),{passive:true});
    els.links.append(element);
  }
  if(isSchoolEdition()&&!schoolChallengeAdded)els.links.append(createSchoolChallengeCard());
  if(isLanewayEdition())els.links.append(createLanewayChallengeCard());
  if(isLanewayCompanyEdition())els.links.append(createLanewayCompanyChallengeCard());
  balanceLinkGrid();
}

function createLanewayCompanyChallengeCard(){
  const button=document.createElement("button");
  button.id="lanewayCompanyChallengeButton";button.type="button";button.className="laneway-challenge-card wide";button.disabled=true;
  const copy=document.createElement("span");copy.className="link-copy";
  const title=document.createElement("strong");title.textContent=config.lanewayCompanyChallenge?.title||"How Well Do You Know Laneway Music?";
  const subtitle=document.createElement("small");subtitle.textContent=config.lanewayCompanyChallenge?.ctaLabel||"Take the Eight-Question Quiz";
  const arrow=document.createElement("span");arrow.className="link-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent=">";
  copy.append(title,subtitle);button.append(copy,arrow);button.addEventListener("click",()=>LanewayCompanyQuiz.open());
  return button;
}

async function buildLanewayCompanyDirectory(){
  const roster=await fetchJson(`/${config.lanewayCompany.rosterFile}?v=${VERSION}`);
  if(!Array.isArray(roster.artists)||!roster.artists.length)throw new Error("Laneway Music artist directory is empty.");
  const artists=roster.artists.filter(item=>item.name&&validSpotifyArtist(item.spotifyURL)).sort((a,b)=>a.name.localeCompare(b.name,"en-AU"));
  if(!artists.length)throw new Error("No verified Laneway Music Spotify artists were available.");
  const render=value=>{
    const needle=String(value||"").trim().toLocaleLowerCase("en-AU");
    const matches=artists.filter(item=>item.name.toLocaleLowerCase("en-AU").includes(needle));
    els.companyArtistList.replaceChildren(...matches.map(createLanewayCompanyArtistCard));
    els.companyEmpty.hidden=matches.length>0;
    els.companyDirectoryCount.textContent=`${matches.length} verified artist${matches.length===1?"":"s"}`;
  };
  els.companySearch.addEventListener("input",event=>render(event.currentTarget.value),{passive:true});
  render("");els.companyDirectory.hidden=false;
}

function createLanewayCompanyArtistCard(artist){
  const card=document.createElement("article");card.className="laneway-company-artist";
  const name=document.createElement("h3");name.textContent=artist.name;
  const actions=document.createElement("div");actions.className="laneway-company-artist-actions";
  actions.append(createLanewayArtistLink("Spotify",artist.spotifyURL,"spotify",artist.name));
  const website=validHttps(artist.websiteURL);
  if(website)actions.append(createLanewayArtistLink("Website",website,"website",artist.name));
  card.append(name,actions);return card;
}

function createLanewayArtistLink(label,url,destination,artistName){
  const link=document.createElement("a");link.className="laneway-company-artist-link is-active";link.href=url;link.target="_blank";link.rel="noopener noreferrer";
  link.textContent=label;link.setAttribute("aria-label",`${label} for ${artistName} (opens in a new tab)`);
  link.addEventListener("click",()=>{DeepCutsInteractions.trackOutbound(analytics,destination,url);analytics.track("laneway_artist_selected",{artist_name:artistName,destination_platform:destination},{dedupeKey:`artist:${artistName}:${destination}`,dedupeMs:500})},{passive:true});
  return link;
}

function validSpotifyArtist(value){
  const url=validHttps(value);if(!url)return"";
  try{const parsed=new URL(url);return parsed.hostname==="open.spotify.com"&&/^\/artist\/[A-Za-z0-9]+\/?$/.test(parsed.pathname)?parsed.href:""}catch{return""}
}

function createLanewayChallengeCard(){
  const button=document.createElement("button");
  button.id="lanewayChallengeButton";
  button.type="button";
  button.className="laneway-challenge-card wide";
  button.disabled=true;
  const copy=document.createElement("span");copy.className="link-copy";
  const title=document.createElement("strong");title.textContent=config.lanewayChallenge?.title||`How Well Do You Know ${config.bandName}?`;
  const subtitle=document.createElement("small");subtitle.textContent=config.lanewayChallenge?.ctaLabel||"Take the Five-Question Quiz";
  const arrow=document.createElement("span");arrow.className="link-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent=">";
  copy.append(title,subtitle);button.append(copy,arrow);
  button.addEventListener("click",()=>LanewayQuiz.open());
  return button;
}

function createSchoolChallengeCard(){
  const button=document.createElement("button");
  button.id="schoolChallengeButton";
  button.type="button";
  button.className="school-challenge-card wide";
  button.disabled=true;
  const icon=document.createElement("span");icon.className="school-challenge-icon";icon.setAttribute("aria-hidden","true");icon.textContent="?";
  const copy=document.createElement("span");copy.className="link-copy";
  const title=document.createElement("strong");title.textContent=config.schoolChallenge?.title||"How Well Do You Know Our School?";
  const subtitle=document.createElement("small");subtitle.textContent=config.schoolChallenge?.ctaLabel||"Take the Challenge";
  const arrow=document.createElement("span");arrow.className="link-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent=">";
  copy.append(title,subtitle);button.append(icon,copy,arrow);
  button.addEventListener("click",()=>SchoolDiscoveryQuiz.open());
  return button;
}

function balanceLinkGrid(){
  const cards=[...els.links.children];
  cards.forEach(card=>card.classList.toggle("wide",card.classList.contains("primary")||card.classList.contains("editorial")||card.classList.contains("school-challenge-card")||card.classList.contains("laneway-challenge-card")));
  const paired=cards.filter(card=>!card.classList.contains("wide"));
  if(paired.length%2===1)paired.at(-1)?.classList.add("wide");
  els.links.hidden=cards.length===0;
}

function activeSubtitle(definition){
  if(definition.key==="newsReviews")return config.discovery?.newsLabel||definition.subLabel;
  if(definition.key==="buyMusic"&&config.links?.bandcamp&&!config.links?.buyMusic)return "Purchase music via Bandcamp";
  return definition.subLabel;
}

function analyticsDestination(key){return({buyMusic:"buy_music",newsReviews:"news_reviews",merchandise:"merchandise"})[key]||key}

function startAttentionCycle(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const run=()=>{
    if(document.hidden)return;
    els.waveform.classList.remove("pulse");void els.waveform.offsetWidth;els.waveform.classList.add("pulse");
    [...els.links.querySelectorAll(".is-active"),...els.companyArtistList.querySelectorAll(".is-active")].slice(0,14).forEach((link,index)=>setTimeout(()=>{link.classList.add("attention");setTimeout(()=>link.classList.remove("attention"),650)},650+index*120));
  };
  setTimeout(run,450);
  attentionTimer=window.setInterval(run,10000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)run()},{passive:true});
}

function validHttps(value){try{const url=new URL(String(value||""));return url.protocol==="https:"?url.href:""}catch{return""}}
function pageIdentifier(){return config.analytics?.pageIdentifier||`${editionEntry.editionId}:discovery-v1`}
function canonicalURL(){return new URL(editionEntry.canonicalPath||`/e/${editionEntry.editionId}`,location.origin).href}
function sharePayload(){return isLanewayCompanyEdition()?{title:"Laneway Music | Deep Cuts",text:"Discover Laneway Music, take the eight-question quiz and explore its artists on Spotify.",url:canonicalURL()}:isLanewayEdition()?{title:`${config.bandName} | Laneway`,text:`Discover ${config.bandName} and take the positive five-question Laneway quiz.`,url:canonicalURL()}:isSchoolEdition()?{title:`${config.bandName} | School Discovery`,text:`Discover ${config.bandName}: official school information, programs and video.`,url:canonicalURL()}:isClubEdition()?{title:`${config.bandName} | Deep Cuts Clubs`,text:`Explore ${config.bandName}: verified club, membership, events and community links.`,url:canonicalURL()}:isCarEdition()?{title:`${config.bandName} | Deep Cuts Cars`,text:`Explore ${config.bandName}: verified history, specifications, buying and restoration links.`,url:canonicalURL()}:{title:`${config.bandName} | Deep Cuts`,text:`Discover ${config.bandName}: official music, video and social links.`,url:canonicalURL()}}

async function sharePage(){
  analytics.track("share_button_clicked",{page_identifier:pageIdentifier()},{dedupeKey:"main-share",dedupeMs:500});
  const payload=sharePayload();
  if(DeepCutsInteractions.supportsNativeShare(navigator,analytics.device)){
    const result=await DeepCutsInteractions.nativeShare({navigatorObject:navigator,tracker:analytics,payload,actionId:DeepCutsAnalytics.randomId()});
    if(result!=="failed")return;
  }
  const actionId=DeepCutsAnalytics.randomId();
  analytics.track("copy_link_clicked",{share_method:"copy_link",share_action_id:actionId},{dedupeKey:"share-copy",dedupeMs:500});
  const copied=await DeepCutsInteractions.copyLink({clipboard:navigator.clipboard,tracker:analytics,text:canonicalURL(),trigger:"share_fallback",actionId});
  els.status.textContent=copied?"Deep Cuts page link copied.":"Copy was blocked. Please copy the address from your browser.";
}

function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
function showError(message){els.page.hidden=true;els.errorMessage.textContent=message;els.error.hidden=false}
els.share.addEventListener("click",sharePage);
window.__deepCutsDiscoveryTest={validHttps,youtubeVideoId,getConfig:()=>config,getRenderedLinks:()=>[...els.links.children].map(link=>({destination:link.dataset.destination,wide:link.classList.contains("wide")}))};
