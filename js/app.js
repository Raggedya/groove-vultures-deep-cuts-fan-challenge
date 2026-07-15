"use strict";

const VERSION="20260715-discovery-1";
const $=id=>document.getElementById(id);
const els={
  page:$("discoveryPage"),error:$("errorScreen"),errorMessage:$("errorMessage"),
  bandName:$("bandName"),kicker:$("heroKicker"),tagline:$("tagline"),artwork:$("heroArtwork"),
  discoverTitle:$("discoverTitle"),links:$("platformLinks"),videoSection:$("videoSection"),
  videoTitle:$("videoTitle"),video:$("featuredVideo"),videoFallback:$("videoFallback"),
  share:$("shareButton"),copy:$("copyButton"),status:$("shareStatus"),
  description:$("pageDescription"),copyright:$("coverCopyright")
};

const LINK_DEFINITIONS=[
  ["spotify","Listen on Spotify","Music","spotify","♪"],
  ["bandcamp","Support on Bandcamp","Music","bandcamp","B"],
  ["youtube","YouTube","Watch videos","youtube","▶"],
  ["instagram","Instagram","Follow the band","instagram","◎"],
  ["facebook","Facebook","Follow the band","facebook","f"],
  ["tiktok","TikTok","Follow the band","tiktok","♪"],
  ["website","Official website","News and more","website","↗"],
  ["tickets","Tickets","See the band live","tickets","★"],
  ["merchandise","Merchandise","Support the band","merchandise","◆"],
  ["mailingList","Join the mailing list","Stay in the loop","mailing-list","✉"],
  ["tip","Tip the Band","Send your support","tip","♥"]
];

let platform,editionEntry,config;
let analytics={device:"desktop",track(){return null}};

init();

async function init(){
  try{
    platform=await fetchJson(`platform.json?v=${VERSION}`);
    const requested=new URLSearchParams(location.search).get("edition")||platform.defaultEdition;
    editionEntry=platform.editions.find(item=>item.slug===requested&&item.active);
    if(!editionEntry)throw new Error(`Unknown edition: ${requested}`);
    config=await fetchJson(`${editionEntry.config}?v=${VERSION}`);
    analytics=new DeepCutsAnalytics.Tracker({platformConfig:platform,editionEntry,editionConfig:config});
    applyConfig();
    analytics.track("discovery_page_viewed",{page_location:location.origin+location.pathname,page_identifier:pageIdentifier()},{onceKey:`page:${editionEntry.slug}`});
  }catch(error){console.error(error);showError("This artist page could not be loaded. Please refresh and try again.")}
}

async function fetchJson(url){const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error(`${url} returned ${response.status}`);return response.json()}

function applyConfig(){
  const name=config.bandName||editionEntry.name;
  document.title=`${name} — Official Artist Links`;
  els.description.content=config.description||`Listen to, watch, follow and support ${name}.`;
  els.bandName.textContent=name;
  els.kicker.textContent=config.discovery?.kicker||"Official artist links";
  els.tagline.textContent=config.discovery?.tagline||"Listen. Watch. Follow. Support.";
  els.discoverTitle.textContent=`Discover ${name}`;
  els.artwork.src=config.characterArtwork||"assets/aggits-original-cutout-v4.png";
  els.artwork.alt=`Aggits presenting ${name}`;
  els.copyright.textContent=config.social?.copyright||"copyright Clearlight Creative";
  document.documentElement.style.setProperty("--accent",config.theme?.accent||"#168cff");
  document.documentElement.style.setProperty("--accent-soft",config.theme?.accentSecondary||"#8dc5ff");
  buildLinks();
  buildVideo();
}

function buildLinks(){
  els.links.innerHTML="";
  for(const[key,label,subLabel,className,icon]of LINK_DEFINITIONS){
    const url=validHttps(config.links?.[key]);
    if(!url)continue;
    const link=document.createElement("a");
    link.href=url;link.target="_blank";link.rel="noopener noreferrer";
    link.className=`platform-link ${className}${key==="tip"?" tip-link":""}`;
    link.innerHTML=`<span class="link-icon" aria-hidden="true">${icon}</span><span class="link-copy"><strong>${label}</strong><small>${subLabel}</small></span><span class="link-arrow" aria-hidden="true">›</span>`;
    link.setAttribute("aria-label",`${label} for ${config.bandName} (opens in a new tab)`);
    link.addEventListener("click",()=>DeepCutsInteractions.trackOutbound(analytics,key,url),{passive:true});
    els.links.append(link);
  }
}

function buildVideo(){
  const youtubeURL=validHttps(config.featuredVideo?.youtubeURL);
  const videoId=youtubeVideoId(youtubeURL||config.featuredVideo?.embedURL);
  if(!youtubeURL||!videoId){els.videoSection.hidden=true;return}
  els.videoTitle.textContent=config.featuredVideo?.title||`${config.bandName} — featured video`;
  els.video.src=`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
  els.videoFallback.href=youtubeURL;
  els.videoFallback.addEventListener("click",()=>DeepCutsInteractions.trackOutbound(analytics,"youtube",youtubeURL),{passive:true});
  els.videoSection.hidden=false;
  analytics.track("featured_video_loaded",{destination_platform:"youtube",video_id:videoId},{onceKey:`video:${videoId}`});
}

function youtubeVideoId(value){
  if(!value)return "";
  try{const url=new URL(value);if(url.hostname==="youtu.be")return url.pathname.split("/").filter(Boolean)[0]||"";if(url.hostname.includes("youtube")){if(url.pathname.startsWith("/embed/"))return url.pathname.split("/")[2]||"";return url.searchParams.get("v")||""}}catch{}
  return "";
}

function validHttps(value){try{const url=new URL(String(value||""));return url.protocol==="https:"?url.href:""}catch{return ""}}
function pageIdentifier(){return config.analytics?.pageIdentifier||`${editionEntry.slug}:discovery-v1`}
function canonicalURL(){return config.publicURL||location.href}
function sharePayload(){return{title:`${config.bandName} — Official Artist Links`,text:`Discover ${config.bandName}: music, video, socials and ways to support the band.`,url:canonicalURL()}}

async function sharePage(){
  analytics.track("share_button_clicked",{page_identifier:pageIdentifier()},{dedupeKey:"main-share",dedupeMs:500});
  const payload=sharePayload();
  if(DeepCutsInteractions.supportsNativeShare(navigator,analytics.device)){
    const result=await DeepCutsInteractions.nativeShare({navigatorObject:navigator,tracker:analytics,payload,actionId:DeepCutsAnalytics.randomId()});
    if(result!=="failed")return;
  }
  await copyPage("share_fallback");
}

async function copyPage(trigger="direct_button"){
  const actionId=DeepCutsAnalytics.randomId();
  analytics.track("share_method_selected",{share_method:"copy_link",share_action_id:actionId},{dedupeKey:`share:copy:${trigger}`,dedupeMs:500});
  const copied=await DeepCutsInteractions.copyLink({clipboard:navigator.clipboard,tracker:analytics,text:canonicalURL(),trigger,actionId});
  els.status.textContent=copied?"Artist page link copied.":"Copy was blocked. Please copy the address from your browser.";
}

function showError(message){els.page.hidden=true;els.errorMessage.textContent=message;els.error.hidden=false}

els.share.addEventListener("click",sharePage);
els.copy.addEventListener("click",()=>copyPage());
window.__deepCutsDiscoveryTest={youtubeVideoId,validHttps,getConfig:()=>config,getRenderedLinks:()=>[...els.links.querySelectorAll("a")].map(link=>link.className)};
