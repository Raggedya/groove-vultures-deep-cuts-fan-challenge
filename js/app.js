"use strict";

const VERSION="20260715-reference-1";
const $=id=>document.getElementById(id);
const els={page:$("discoveryPage"),error:$("errorScreen"),errorMessage:$("errorMessage"),bandName:$("bandName"),headline:$("heroHeadline"),artwork:$("heroArtwork"),discoverTitle:$("discoverTitle"),links:$("platformLinks"),videoSection:$("videoSection"),videoTitle:$("videoTitle"),video:$("featuredVideo"),videoFallback:$("videoFallback"),share:$("shareButton"),copy:$("copyButton"),status:$("shareStatus"),description:$("pageDescription"),copyright:$("coverCopyright")};

const ICONS={
  spotify:'<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.58 14.42a.62.62 0 0 1-.86.2c-2.36-1.44-5.33-1.77-8.83-.97a.63.63 0 0 1-.28-1.22c3.83-.87 7.11-.49 9.77 1.13.3.18.39.57.2.86Zm1.23-2.73a.78.78 0 0 1-1.08.26c-2.7-1.66-6.82-2.14-10.02-1.17a.78.78 0 1 1-.45-1.5c3.65-1.1 8.19-.57 11.29 1.34.37.22.48.7.26 1.07Zm.1-2.84C14.67 8.93 9.33 8.75 6.24 9.68a.94.94 0 0 1-.54-1.8c3.54-1.07 9.44-.85 13.17 1.36a.94.94 0 0 1-.96 1.61Z"/></svg>',
  instagram:'<svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>',
  facebook:'<svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v7h4v-7h3l1-4h-4V9c0-.7.3-1 1-1Z"/></svg>',
  youtube:'<svg viewBox="0 0 24 24"><path d="M22 8s-.2-1.5-.8-2.2c-.8-.8-1.7-.8-2.1-.9C16.2 4.7 12 4.7 12 4.7s-4.2 0-7.1.2c-.4.1-1.3.1-2.1.9C2.2 6.5 2 8 2 8S1.8 9.7 1.8 11.4v1.5c0 1.7.2 3.4.2 3.4s.2 1.5.8 2.2c.8.8 1.9.8 2.4.9 1.7.2 6.8.2 6.8.2s4.2 0 7.1-.2c.4-.1 1.3-.1 2.1-.9.6-.7.8-2.2.8-2.2s.2-1.7.2-3.4v-1.5C22.2 9.7 22 8 22 8Zm-12 7.1V9.2l5.7 3-5.7 2.9Z"/></svg>',
  bandcamp:'<svg viewBox="0 0 24 24"><path d="M6.3 5h15l-3.6 7H2.8l3.5-7Zm-3.9 9h14.3l-2.5 5H0l2.4-5Z"/></svg>',
  tiktok:'<svg viewBox="0 0 24 24"><path d="M15 3c.4 2.1 1.7 3.5 4 4v4c-1.5 0-2.8-.4-4-1.1v5.6a6.5 6.5 0 1 1-6.5-6.5c.5 0 1 .1 1.5.2v4.1a2.5 2.5 0 1 0 1 2V3h4Z"/></svg>',
  website:'<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15 15 0 0 0-1.4-3A8.1 8.1 0 0 1 18.9 8ZM12 4c.8 1 1.5 2.3 1.9 4h-3.8c.4-1.7 1.1-3 1.9-4ZM9.5 5A15 15 0 0 0 8.1 8h-3A8.1 8.1 0 0 1 9.5 5ZM4 12c0-.7.1-1.4.3-2h3.4a18 18 0 0 0 0 4H4.3c-.2-.6-.3-1.3-.3-2Zm1.1 4h3a15 15 0 0 0 1.4 3A8.1 8.1 0 0 1 5.1 16Zm6.9 4c-.8-1-1.5-2.3-1.9-4h3.8c-.4 1.7-1.1 3-1.9 4Zm2.3-6H9.7a16 16 0 0 1 0-4h4.6a16 16 0 0 1 0 4Zm.2 5a15 15 0 0 0 1.4-3h3a8.1 8.1 0 0 1-4.4 3Zm1.8-5a18 18 0 0 0 0-4h3.4a8.1 8.1 0 0 1 0 4h-3.4Z"/></svg>',
  tickets:'<svg viewBox="0 0 24 24"><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm6 2v10h2V7H9Z"/></svg>',
  merchandise:'<svg viewBox="0 0 24 24"><path d="m8 3 4 2 4-2 5 3-3 5-2-1v11H8V10l-2 1-3-5 5-3Zm1.2 2L7 6.3l.5 1L10 6v13h4V6l2.5 1.3.5-1L14.8 5A4 4 0 0 1 12 7a4 4 0 0 1-2.8-2Z"/></svg>',
  mailingList:'<svg viewBox="0 0 24 24"><path d="M2 5h20v14H2V5Zm2 2v.5l8 5 8-5V7H4Zm16 10v-7.2l-8 5-8-5V17h16Z"/></svg>',
  tip:'<svg viewBox="0 0 24 24"><path d="M12 21 3.5 12.7A5.7 5.7 0 0 1 12 5.1a5.7 5.7 0 0 1 8.5 7.6L12 21Z"/></svg>'
};

const LINK_DEFINITIONS=[
  ["spotify","Listen on Spotify","Open the artist on Spotify","spotify"],
  ["instagram","Instagram","Follow the latest updates","instagram"],
  ["facebook","Facebook","Follow the band","facebook"],
  ["bandcamp","Bandcamp","Listen and support directly","bandcamp"],
  ["youtube","YouTube","Watch official videos","youtube"],
  ["tiktok","TikTok","Follow the band","tiktok"],
  ["website","Official Website","News, music and more","website"],
  ["tickets","Tickets","See the band live","tickets"],
  ["merchandise","Merchandise","Official band store","merchandise"],
  ["mailingList","Mailing List","Stay in the loop","mailing-list"],
  ["tip","Tip the Band","Send your support","tip"]
];

let platform,editionEntry,config;
let analytics={device:"desktop",track(){return null}};
init();

async function init(){try{platform=await fetchJson(`platform.json?v=${VERSION}`);const requested=new URLSearchParams(location.search).get("edition")||platform.defaultEdition;editionEntry=platform.editions.find(item=>item.slug===requested&&item.active);if(!editionEntry)throw new Error(`Unknown edition: ${requested}`);config=await fetchJson(`${editionEntry.config}?v=${VERSION}`);analytics=new DeepCutsAnalytics.Tracker({platformConfig:platform,editionEntry,editionConfig:config});applyConfig();analytics.track("discovery_page_viewed",{page_location:location.origin+location.pathname,page_identifier:pageIdentifier()},{onceKey:`page:${editionEntry.slug}`})}catch(error){console.error(error);showError("This artist page could not be loaded. Please refresh and try again.")}}
async function fetchJson(url){const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error(`${url} returned ${response.status}`);return response.json()}

function applyConfig(){const name=config.bandName||editionEntry.name;document.title=`${name} - Official Artist Links`;els.description.content=config.description||`Listen to, watch, follow and support ${name}.`;els.bandName.textContent=name;els.headline.innerHTML=(config.discovery?.headline||"Official Music<br>&amp; Artist Links");els.artwork.src=config.characterArtwork||"assets/aggits-original-cutout-v4.png";els.artwork.alt=`Aggits presenting ${name}`;els.copyright.textContent=config.social?.copyright||"copyright Clearlight Creative";document.documentElement.style.setProperty("--accent",config.theme?.accent||"#1298ff");document.documentElement.style.setProperty("--accent-soft",config.theme?.accentSecondary||"#86c9ff");buildLinks();buildVideo()}

function buildLinks(){els.links.innerHTML="";for(const[key,label,subLabel,className]of LINK_DEFINITIONS){const url=validHttps(config.links?.[key]);if(!url)continue;const link=document.createElement("a");link.href=url;link.target="_blank";link.rel="noopener noreferrer";link.className=`platform-link ${className}${key==="spotify"?" primary-destination":""}${key==="tip"?" tip-link":""}`;link.innerHTML=`<span class="link-icon" aria-hidden="true">${ICONS[key]||ICONS.website}</span><span class="link-copy"><strong>${label}</strong><small>${subLabel}</small></span><span class="link-arrow" aria-hidden="true">&#8250;</span>`;link.setAttribute("aria-label",`${label} for ${config.bandName} (opens in a new tab)`);link.addEventListener("click",()=>DeepCutsInteractions.trackOutbound(analytics,key,url),{passive:true});els.links.append(link)}}

function buildVideo(){const youtubeURL=validHttps(config.featuredVideo?.youtubeURL),videoId=youtubeVideoId(youtubeURL||config.featuredVideo?.embedURL);if(!youtubeURL||!videoId){els.videoSection.hidden=true;return}els.videoTitle.textContent=config.featuredVideo?.title||`${config.bandName} - featured video`;els.video.src=`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;els.videoFallback.href=youtubeURL;els.videoFallback.addEventListener("click",()=>DeepCutsInteractions.trackOutbound(analytics,"youtube",youtubeURL),{passive:true});els.videoSection.hidden=false;analytics.track("featured_video_loaded",{destination_platform:"youtube",video_id:videoId},{onceKey:`video:${videoId}`})}
function youtubeVideoId(value){if(!value)return"";try{const url=new URL(value);if(url.hostname==="youtu.be")return url.pathname.split("/").filter(Boolean)[0]||"";if(url.hostname.includes("youtube")){if(url.pathname.startsWith("/embed/"))return url.pathname.split("/")[2]||"";return url.searchParams.get("v")||""}}catch{}return""}
function validHttps(value){try{const url=new URL(String(value||""));return url.protocol==="https:"?url.href:""}catch{return""}}
function pageIdentifier(){return config.analytics?.pageIdentifier||`${editionEntry.slug}:discovery-v1`}
function canonicalURL(){return config.publicURL||location.href}
function sharePayload(){return{title:`${config.bandName} - Official Artist Links`,text:`Discover ${config.bandName}: music, video, socials and ways to support the band.`,url:canonicalURL()}}
async function sharePage(){analytics.track("share_button_clicked",{page_identifier:pageIdentifier()},{dedupeKey:"main-share",dedupeMs:500});const payload=sharePayload();if(DeepCutsInteractions.supportsNativeShare(navigator,analytics.device)){const result=await DeepCutsInteractions.nativeShare({navigatorObject:navigator,tracker:analytics,payload,actionId:DeepCutsAnalytics.randomId()});if(result!=="failed")return}await copyPage("share_fallback")}
async function copyPage(trigger="direct_button"){const actionId=DeepCutsAnalytics.randomId();analytics.track("share_method_selected",{share_method:"copy_link",share_action_id:actionId},{dedupeKey:`share:copy:${trigger}`,dedupeMs:500});const copied=await DeepCutsInteractions.copyLink({clipboard:navigator.clipboard,tracker:analytics,text:canonicalURL(),trigger,actionId});els.status.textContent=copied?"Artist page link copied.":"Copy was blocked. Please copy the address from your browser."}
function showError(message){els.page.hidden=true;els.errorMessage.textContent=message;els.error.hidden=false}
els.share.addEventListener("click",sharePage);els.copy.addEventListener("click",()=>copyPage());
window.__deepCutsDiscoveryTest={youtubeVideoId,validHttps,getConfig:()=>config,getRenderedLinks:()=>[...els.links.querySelectorAll("a")].map(link=>link.className)};
