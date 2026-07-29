"use strict";

const VERSION="20260729-jookbox-1";
const LANEWAY_REPORTING_VERSION="laneway-weekly-v1";
const $=id=>document.getElementById(id);
const els={page:$("discoveryPage"),error:$("errorScreen"),errorMessage:$("errorMessage"),bandName:$("bandName"),bio:$("artistBio"),artwork:$("heroArtwork"),brandLogo:$("editionBrandLogo"),waveform:$("sonicSignature"),features:$("featureList"),video:$("featuredVideo"),videoLabel:$("featuredVideoLabel"),videoTitle:$("featuredVideoTitle"),videoFrame:$("featuredVideoFrame"),jookBox:$("jookBoxCabinet"),jookBoxTitle:$("jookBoxTitle"),jookBoxVideoSlot:$("jookBoxVideoSlot"),links:$("platformLinks"),share:$("shareButton"),status:$("shareStatus"),description:$("pageDescription"),poweredBy:$("poweredByLabel"),copyright:$("coverCopyright"),lanewayHome:$("lanewayHomeLink"),lanewayRecommended:$("lanewayRecommendedLink"),companyDirectory:$("lanewayCompanyDirectory"),companyDirectoryCount:$("lanewayCompanyDirectoryCount"),companySearch:$("lanewayCompanySearch"),companyArtistList:$("lanewayCompanyArtistList"),companyEmpty:$("lanewayCompanyEmpty"),companyWheel:$("lanewayArtistWheel"),wheelCanvas:$("lanewayWheelCanvas"),wheelSpin:$("lanewayWheelSpin"),wheelStatus:$("lanewayWheelStatus"),wheelWinner:$("lanewayWheelWinner"),wheelImpact:$("lanewayWheelImpact"),wheelPurchaseLinks:$("lanewayWheelPurchaseLinks"),wheelBuyMusic:$("lanewayWheelBuyMusic"),wheelBuyMerch:$("lanewayWheelBuyMerch"),wheelVideo:$("lanewayWheelVideo"),wheelVideoTitle:$("lanewayWheelVideoTitle"),wheelVideoFrame:$("lanewayWheelVideoFrame")};

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

const JOOKBOX_LINK_DEFINITIONS=[
  {key:"spotify",label:"Spotify",subLabel:"Play the band"},
  {key:"youtube",label:"YouTube",subLabel:"Official band channel"},
  {key:"merchandise",label:"Merch Shop",subLabel:"Wear the band"},
  {key:"website",label:"Band Website",subLabel:"Meet the full supergroup"},
  {key:"instagram",label:"Instagram",subLabel:"Latest band updates"},
  {key:"facebook",label:"Facebook",subLabel:"Shows and announcements"},
  {key:"tiktok",label:"TikTok",subLabel:"Clips from the band"},
  {key:"contact",label:"Book the Band",subLabel:"Official enquiries"}
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
  const cars=isCarEdition(),clubs=isClubEdition(),schools=isSchoolEdition(),business=isBusinessEdition(),laneway=isLanewayEdition(),jookBox=isJookBoxEdition(),lanewayCompany=isLanewayCompanyEdition(),indieWheel=isIndieWheelEdition(),wheelEdition=lanewayCompany||indieWheel;
  document.documentElement.dataset.editionType=indieWheel?"laneway_company":config.editionType||"music";
  document.documentElement.dataset.productType=usesFinalIndieLabelModel()?"laneway_company":config.editionType||"music";
  if(usesFinalIndieLabelModel())document.documentElement.dataset.labelStyle=config.slug||"indie-label";
  document.title=`${name} | ${wheelEdition?"Indie Wheel":jookBox?"JookBox":laneway?"Laneway":schools?"School Discovery":business?"Deep Cuts Business":clubs?"Deep Cuts Clubs":cars?"Deep Cuts Cars":"Deep Cuts"}`;
  const bio=config.discovery?.bio||config.description||`Discover ${name}.`;
  els.description.content=wheelEdition?`Spin to discover a verified ${name} artist on ${wheelSettings().destinationLabel}, search the catalogue and take the 10-question artist quiz.`:jookBox?`Play ${name} through the JookBox and open the band's verified music, video, social and merchandise links.`:laneway?`Discover ${name} through Laneway's positive five-question band quiz and verified official links.`:schools?`Discover ${name} through verified official school information and video.`:business?`Explore verified ${name} job opportunities and learn about the business.`:clubs?`Verified club, membership, events, bowls and community links for ${name}.`:cars?`Verified history, specifications, buying, ownership and restoration links for ${name}.`:`Official music, video and social links for ${name}.`;
  els.bandName.textContent=name;
  els.bio.textContent=bio;
  const hideArtwork=schools||laneway||jookBox||wheelEdition||(business&&config.business?.showHeroArtwork===false);
  if(hideArtwork){els.artwork.hidden=true;els.artwork.removeAttribute("src");els.artwork.alt=""}else{els.artwork.hidden=false;els.artwork.src=`/${config.characterArtwork||"assets/aggits-original-cutout-v4.png"}`;els.artwork.alt=`Aggits presenting ${name}`}
  const titleRow=els.bandName.closest(".artist-title-row");
  titleRow.hidden=false;
  titleRow.classList.toggle("visually-hidden",business&&config.business?.showTitle===false);
  if(laneway||wheelEdition||business){const branding=business?config.business:wheelEdition?wheelSettings():config.laneway;els.brandLogo.hidden=false;els.brandLogo.src=`/${branding?.logoArtwork||"assets/laneway-music-logo-reverse-transparent.png"}`;els.brandLogo.alt=name;els.brandLogo.classList.toggle("business-logo-on-light",business&&branding?.logoSurface==="light");els.brandLogo.classList.toggle("business-logo-square",business&&branding?.logoShape==="square")}else{els.brandLogo.hidden=true;els.brandLogo.removeAttribute("src");els.brandLogo.alt="";els.brandLogo.classList.remove("business-logo-on-light","business-logo-square")}
  els.videoLabel.textContent=jookBox?(config.jookBox?.videoLabel||"Now playing"):laneway||wheelEdition?"Featured video":schools?"Discover our school":business?(config.business?.videoLabel||"Meet the team"):clubs?"Featured club video":cars?"Featured automotive video":"Featured video";
  buildFeatures(jookBox?config.jookBox?.heroLabels:laneway?config.laneway?.heroLabels:schools?config.school?.heroLabels:business?config.business?.heroLabels:clubs?config.club?.heroLabels:cars?config.automotive?.heroLabels:["Listen","Watch","Follow","Buy Stuff"]);
  document.documentElement.style.setProperty("--accent",config.theme?.accent||"#2f80ff");
  if(usesFinalIndieLabelModel()){
    document.documentElement.style.setProperty("--label-accent",config.theme?.accent||"#a9e7fa");
    document.documentElement.style.setProperty("--label-accent-secondary",config.theme?.accentSecondary||"#d9f7ff");
    document.documentElement.style.setProperty("--label-accent-rgb",config.theme?.accentRgb||"169,231,250");
  }
  if(schools){document.documentElement.style.setProperty("--school-secondary",config.theme?.accentSecondary||"#00C4B4");document.documentElement.style.setProperty("--school-navy",config.theme?.navy||"#0A2342");document.documentElement.style.setProperty("--school-surface",config.theme?.surface||"#FFFFFF");document.documentElement.style.setProperty("--school-content",config.theme?.contentBackground||"#F8FAFC")}
  if(business){document.documentElement.style.setProperty("--business-accent",config.theme?.accent||"#2f80c3");document.documentElement.style.setProperty("--business-secondary",config.theme?.accentSecondary||"#ff6a1a");document.documentElement.style.setProperty("--business-secondary-strong",config.theme?.secondaryStrong||"#a94618");document.documentElement.style.setProperty("--business-surface",config.theme?.surface||"#111a29")}
  if(jookBox){document.documentElement.style.setProperty("--jookbox-cyan",config.theme?.accent||"#55d9ff");document.documentElement.style.setProperty("--jookbox-orange",config.theme?.accentSecondary||"#ff6640");document.documentElement.style.setProperty("--jookbox-gold",config.theme?.gold||"#ffd66b");document.documentElement.style.setProperty("--jookbox-surface",config.theme?.surface||"#091321")}
  buildWaveform(name);
  buildFeaturedVideo();
  if(jookBox)buildJookBox();
  buildLinks();
  if(wheelEdition)await buildLanewayCompanyDirectory();
  configureLanewayUtilityLinks();
  if(schools)await SchoolDiscoveryQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("schoolChallengeButton")});
  if(business){
    if(config.businessProfile){
      BusinessProfile.configure({config,analytics,homeElement:els.page,invitationButton:$("businessProfileInvitationButton")});
    }else{
      await BusinessQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("businessChallengeButton")});
    }
    if(config.business?.buttonLightSequence===true)sequenceBusinessButtons();
  }
  if(laneway)await LanewayQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("lanewayChallengeButton")});
  if(wheelEdition)await LanewayCompanyQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("lanewayCompanyChallengeButton")});
  startAttentionCycle();
}

function isCarEdition(){return config.editionType==="car"}
function isClubEdition(){return config.editionType==="club"}
function isSchoolEdition(){return config.editionType==="school"}
function isBusinessEdition(){return config.editionType==="business"}
function isLanewayEdition(){return config.editionType==="laneway"}
function isJookBoxEdition(){return config.editionType==="jukebox"}
function isLanewayCompanyEdition(){return config.editionType==="laneway_company"}
function isIndieWheelEdition(){return config.editionType==="indie_wheel"}
function isWheelEdition(){return isLanewayCompanyEdition()||isIndieWheelEdition()}
function usesFinalIndieLabelModel(){return isIndieWheelEdition()&&config.indieWheel?.modelVersion==="indie_label/1"}
function usesEnhancedIndieLabelExperience(){return isLanewayCompanyEdition()||usesFinalIndieLabelModel()}
function wheelSettings(){
  if(isIndieWheelEdition())return config.indieWheel;
  return{
    destinationKey:"spotifyURL",
    destinationLabel:"Spotify",
    ...config.lanewayCompany
  };
}
function wheelChallenge(){return isIndieWheelEdition()?config.indieWheelChallenge:config.lanewayCompanyChallenge}

function configureLanewayUtilityLinks(){
  if(isBusinessEdition()){
    const website=validHttps(config.business?.websiteURL),careers=validHttps(config.business?.careersURL);
    if(!website||!careers)throw new Error("Business navigation is incomplete.");
    els.lanewayHome.textContent=`${config.business?.shortName||config.bandName} Website`;els.lanewayRecommended.textContent="All Jobs";
    for(const [element,url,destination] of [[els.lanewayHome,website,"website"],[els.lanewayRecommended,careers,"careers"]]){
      element.href=url;element.hidden=false;
      element.setAttribute("aria-label",`${element.textContent} (opens in a new tab)`);
      element.addEventListener("click",()=>trackBusinessOutbound(destination,url,"utility_actions"),{passive:true});
    }
    return;
  }
  if(!isLanewayEdition()&&!isWheelEdition()){
    els.lanewayHome.hidden=true;els.lanewayRecommended.hidden=true;
    return;
  }
  const settings=isWheelEdition()?wheelSettings():config.laneway;
  const homeURL=validHttps(settings?.recordCompanyHomeURL);
  const recommendedURL=validHttps(settings?.recommendedArtistsURL);
  if(!homeURL||!recommendedURL)throw new Error("Record-company navigation is incomplete.");
  els.lanewayHome.textContent=usesEnhancedIndieLabelExperience()?"Contact Us":"Home";
  for(const [element,url,destination] of [[els.lanewayHome,homeURL,"record_company_home"],[els.lanewayRecommended,recommendedURL,"recommended_artists"]]){
    element.href=url;element.hidden=false;
    element.setAttribute("aria-label",`${element.textContent}: ${config.bandName} (opens in a new tab)`);
    element.addEventListener("click",()=>{
      if(isLanewayCompanyEdition())analytics.track("utility_link_clicked",{button_name:destination,interaction_source:"main_footer",destination_url_origin:new URL(url).origin,edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION});
      else DeepCutsInteractions.trackOutbound(analytics,destination,url);
    },{passive:true});
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

function buildJookBox(){
  if(!isJookBoxEdition())return;
  els.jookBoxTitle.textContent=config.jookBox?.marquee||config.bandName;
  els.jookBox.hidden=false;
  if(!els.video.hidden){
    els.video.classList.add("jookbox-featured-video");
    els.jookBoxVideoSlot.append(els.video);
  }
}

function buildLinks(){
  els.links.innerHTML="";
  if(isBusinessEdition()){buildBusinessLinks();balanceLinkGrid();return}
  const definitions=isWheelEdition()?[]:isJookBoxEdition()?JOOKBOX_LINK_DEFINITIONS:isSchoolEdition()?SCHOOL_LINK_DEFINITIONS:isClubEdition()?CLUB_LINK_DEFINITIONS:isCarEdition()?CAR_LINK_DEFINITIONS:MUSIC_LINK_DEFINITIONS;
  let schoolChallengeAdded=false;
  for(const [index,definition] of definitions.entries()){
    if(isSchoolEdition()&&definition.key==="schoolProject"&&!schoolChallengeAdded){els.links.append(createSchoolChallengeCard());schoolChallengeAdded=true}
    const url=linkValue(definition);
    if(!url)continue;
    const element=document.createElement("a");
    element.className=`platform-link is-active${definition.priority?` ${definition.priority}`:""}${isJookBoxEdition()?" jookbox-selection":""}`;
    element.dataset.destination=definition.key;
    const selectionCode=isJookBoxEdition()?`<span class="jookbox-selection-code" aria-hidden="true">${String.fromCharCode(65+Math.floor(index/2))}${index%2+1}</span>`:"";
    element.innerHTML=`${selectionCode}<span class="link-copy"><strong>${definition.label}</strong><small>${activeSubtitle(definition)}</small></span><span class="link-arrow" aria-hidden="true">&gt;</span>`;
    element.href=url;element.target="_blank";element.rel="noopener noreferrer";
    element.setAttribute("aria-label",`${definition.label} for ${config.bandName} (opens in a new tab)`);
    element.addEventListener("click",()=>DeepCutsInteractions.trackOutbound(analytics,analyticsDestination(definition.key),url),{passive:true});
    els.links.append(element);
  }
  if(isSchoolEdition()&&!schoolChallengeAdded)els.links.append(createSchoolChallengeCard());
  if(isLanewayEdition())els.links.append(createLanewayChallengeCard());
  if(isWheelEdition())els.links.append(createLanewayCompanyChallengeCard());
  balanceLinkGrid();
  if(isJookBoxEdition())sequenceJookBoxButtons();
}

function sequenceJookBoxButtons(){
  const buttons=[...els.links.querySelectorAll(".jookbox-selection"),els.share].filter(element=>!element.hidden);
  const step=.55;
  const duration=Math.max(buttons.length*step,5);
  buttons.forEach((element,index)=>{
    element.classList.add("jookbox-carnival-light");
    element.style.setProperty("--jookbox-light-duration",`${duration}s`);
    element.style.setProperty("--jookbox-light-delay",`${index*step}s`);
  });
}

function buildBusinessLinks(){
  if(config.businessProfile)els.links.append(createBusinessProfileInvitation());
  const introduction=document.createElement("div");
  introduction.className="business-jobs-heading wide";
  introduction.innerHTML=`<p>${escapeHtml(config.business?.jobsEyebrow||"CURRENT OPPORTUNITIES")}</p><h2>${escapeHtml(config.business?.jobsTitle||"Find your next HGM job")}</h2><span>${escapeHtml(config.business?.jobsIntro||"Explore current roles with High Grade Mechanical.")}</span>`;
  els.links.append(introduction);
  for(const rolePath of config.business?.rolePaths||[]){
    const url=validHttps(rolePath.url);if(!url)continue;
    const element=document.createElement("a");
    element.className="platform-link business-job-link business-role-path-link is-active";
    element.href=url;element.target="_blank";element.rel="noopener noreferrer";
    element.dataset.destination="website";
    element.innerHTML=`<span class="business-job-mark" aria-hidden="true"></span><span class="link-copy"><strong>${escapeHtml(rolePath.label)}</strong><small>${escapeHtml(rolePath.detail||"Contact HGM")}</small></span>`;
    element.setAttribute("aria-label",`${rolePath.label} — ${rolePath.detail||"Contact HGM"} (opens in a new tab)`);
    element.addEventListener("click",()=>trackBusinessOutbound(rolePath.id,url,"role_path"),{passive:true});
    els.links.append(element);
  }
  for(const job of config.business?.jobs||[]){
    const url=validHttps(job.url);if(!url)continue;
    const element=document.createElement("a");
    element.className="platform-link business-job-link is-active";
    element.href=url;element.target="_blank";element.rel="noopener noreferrer";
    element.dataset.destination="website";
    element.innerHTML=`<span class="business-job-mark" aria-hidden="true"></span><span class="link-copy"><strong>${escapeHtml(job.label)}</strong><small>${escapeHtml(job.detail||"View current opportunity")}</small></span>`;
    element.setAttribute("aria-label",`${job.label} at ${config.bandName} (opens in a new tab)`);
    element.addEventListener("click",()=>trackBusinessOutbound(job.id,url,"job_directory"),{passive:true});
    els.links.append(element);
  }
  if(!config.businessProfile){
    const challenge=document.createElement("button");
    challenge.id="businessChallengeButton";challenge.type="button";challenge.className="business-challenge-card wide";challenge.disabled=true;
    challenge.innerHTML=`<span class="business-challenge-icon" aria-hidden="true">?</span><span class="link-copy"><strong>${escapeHtml(config.businessChallenge?.title||"LEARN ABOUT HGM")}</strong><small>${escapeHtml(config.businessChallenge?.ctaLabel||"Take the 10-question quiz")}</small></span><span class="link-arrow" aria-hidden="true">&gt;</span>`;
    challenge.addEventListener("click",()=>BusinessQuiz.open());
    els.links.append(challenge);
  }
}

function createBusinessProfileInvitation(){
  const invitation=document.createElement("section");
  invitation.className="business-profile-invitation wide";
  invitation.setAttribute("aria-labelledby","businessProfileInvitationTitle");
  const heading=document.createElement("h2");
  heading.id="businessProfileInvitationTitle";
  heading.textContent=config.businessProfile.title;
  const supporting=document.createElement("p");
  supporting.textContent=config.businessProfile.supportingText;
  const button=document.createElement("button");
  button.id="businessProfileInvitationButton";
  button.type="button";
  button.className="business-profile-invitation-button";
  button.disabled=true;
  button.innerHTML=`<span>${escapeHtml(config.businessProfile.buttonLabel)}</span><span aria-hidden="true">&gt;</span>`;
  button.addEventListener("click",()=>BusinessProfile.open());
  invitation.append(heading,supporting,button);
  return invitation;
}

function sequenceBusinessButtons(){
  const buttons=[...document.querySelectorAll('.business-profile-invitation-button,.business-job-link,.business-challenge-card,#editionUtilityActions .utility-action:not([hidden])')];
  const lightStep=.52;
  const lightDuration=Math.max(buttons.length*lightStep,4.2);
  buttons.forEach((element,index)=>{
    element.classList.add("business-carnival-light");
    element.style.setProperty("--business-light-duration",`${lightDuration}s`);
    element.style.setProperty("--business-light-delay",`${-(buttons.length-index)*lightStep}s`);
  });
}

function trackBusinessOutbound(buttonName,url,source){
  analytics.track("outbound_clicked",{destination_platform:"website",button_name:buttonName,interaction_source:source,destination_url_origin:new URL(url).origin,edition_type:config.editionType});
}

function createLanewayCompanyChallengeCard(){
  const button=document.createElement("button");
  button.id="lanewayCompanyChallengeButton";button.type="button";button.className="laneway-challenge-card wide";button.disabled=true;
  if(usesEnhancedIndieLabelExperience())button.hidden=true;
  const copy=document.createElement("span");copy.className="link-copy";
  const challenge=wheelChallenge();
  const title=document.createElement("strong");title.textContent=challenge?.title||`How Well Do You Know ${config.bandName}?`;
  const subtitle=document.createElement("small");subtitle.textContent=challenge?.ctaLabel||"Take the 10-Question Artist Quiz";
  const arrow=document.createElement("span");arrow.className="link-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent=">";
  copy.append(title,subtitle);button.append(copy,arrow);button.addEventListener("click",()=>LanewayCompanyQuiz.open());
  return button;
}

function createLanewayCompanyChallengeRevealController(isWheelIdle){
  const button=$("lanewayCompanyChallengeButton");
  if(!button)return null;
  const challenge=wheelChallenge();
  const configured=Number(challenge?.invitationRevealAfterFirstResultMs??challenge?.invitationRevealDelayMs);
  const delay=Math.min(15000,Math.max(5000,Number.isFinite(configured)?configured:10000));
  let armed=false,due=false,presented=false,animated=false,observer=null;
  const animate=()=>{
    if(animated||document.hidden)return;
    animated=true;
    observer?.disconnect();
    button.classList.add("is-delayed-reveal");
    analytics.track("quiz_invitation_revealed",{quiz_identifier:config.analytics?.pageIdentifier||"",reveal_delay_ms:delay,interaction_source:"first_spin_result",edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION},{onceKey:"laneway-quiz-invitation"});
  };
  const revealWhenReady=()=>{
    if(!due||presented||!isWheelIdle())return;
    presented=true;
    button.hidden=false;
    if(!("IntersectionObserver" in window)){animate();return}
    observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();animate();
    },{threshold:.35});
    observer.observe(button);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden&&button.getBoundingClientRect().top<window.innerHeight)animate()},{passive:true});
  };
  return{
    afterResult(){
      if(armed){revealWhenReady();return}
      armed=true;
      window.setTimeout(()=>{due=true;revealWhenReady()},delay);
    }
  };
}

function setLanewayCompanyWheelSpinState(isSpinning){
  els.wheelSpin.classList.toggle("is-spinning",isSpinning);
  els.wheelSpin.setAttribute("aria-label",isSpinning?"Spinning":"Spin");
  if(!isSpinning){els.wheelSpin.textContent="Spin";return}
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.classList.add("laneway-wheel-spin-spiral");svg.setAttribute("viewBox","0 0 64 64");svg.setAttribute("aria-hidden","true");
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  const points=Array.from({length:96},(_,index)=>{
    const progress=index/95,angle=progress*Math.PI*4.75,radius=2+progress*25;
    return`${index?"L":"M"} ${(32+Math.cos(angle)*radius).toFixed(2)} ${(32+Math.sin(angle)*radius).toFixed(2)}`;
  });
  path.setAttribute("d",points.join(" "));svg.append(path);els.wheelSpin.replaceChildren(svg);
}

async function buildLanewayCompanyDirectory(){
  const settings=wheelSettings(),destinationKey=settings.destinationKey,destinationLabel=settings.destinationLabel;
  const [roster,impactLines,videoData]=await Promise.all([
    fetchJson(`/${settings.rosterFile}?v=${VERSION}`),
    usesEnhancedIndieLabelExperience()&&settings.artistImpactFile?fetchJson(`/${settings.artistImpactFile}?v=${VERSION}`):Promise.resolve({}),
    usesEnhancedIndieLabelExperience()&&settings.artistVideoFile?fetchJson(`/${settings.artistVideoFile}?v=${VERSION}`):Promise.resolve({artists:{}})
  ]);
  if(!Array.isArray(roster.artists)||!roster.artists.length)throw new Error(`${config.bandName} artist directory is empty.`);
  const artists=roster.artists
    .filter(item=>item.name&&validWheelDestination(item[destinationKey],destinationKey))
    .map(item=>({...item,impactLine:String(impactLines[item.name]||"").trim(),featuredVideo:videoData.artists?.[item.name]||null}))
    .sort((a,b)=>a.name.localeCompare(b.name,"en-AU"));
  if(!artists.length)throw new Error(`No verified ${config.bandName} ${destinationLabel} artists were available.`);
  document.getElementById("indieWheelCollectionLabel").textContent=`${config.bandName} artist collection`;
  document.getElementById("indieWheelDirectoryLabel").textContent=`${config.bandName} artist collection`;
  document.getElementById("lanewayCompanySearch").placeholder=`Search ${config.bandName} artists`;
  if(usesEnhancedIndieLabelExperience()){
    const title=document.getElementById("lanewayArtistWheelTitle");
    title.replaceChildren("Spin to discover",document.createElement("br"));
    const accent=document.createElement("span");accent.textContent="an artist";title.append(accent);
  }
  if(settings.artistWheel?.enabled)buildLanewayArtistWheel(artists);
  const render=value=>{
    const needle=String(value||"").trim().toLocaleLowerCase("en-AU");
    const matches=artists.filter(item=>item.name.toLocaleLowerCase("en-AU").includes(needle));
    els.companyArtistList.replaceChildren(...matches.map(createLanewayCompanyArtistCard));
    els.companyEmpty.hidden=matches.length>0;
    els.companyDirectoryCount.textContent=`${matches.length} verified artist${matches.length===1?"":"s"}`;
    return matches.length;
  };
  let searchTimer=0;
  els.companySearch.addEventListener("input",event=>{
    const value=event.currentTarget.value,resultCount=render(value);
    if(isLanewayCompanyEdition()&&String(value).trim().length>=2){
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>analytics.track("artist_directory_searched",{result_count:resultCount,edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION},{dedupeKey:"laneway-directory-search",dedupeMs:750}),800);
    }
  },{passive:true});
  render("");els.companyDirectory.hidden=false;
}

function buildLanewayArtistWheel(artists){
  const canvas=els.wheelCanvas,context=canvas.getContext("2d");
  if(!context)throw new Error("Artist wheel canvas is unavailable.");
  const segmentAngle=Math.PI*2/artists.length;
  let rotation=0,spinning=false,frame=0;
  const challengeReveal=usesEnhancedIndieLabelExperience()?createLanewayCompanyChallengeRevealController(()=>!spinning):null;
  const settings=wheelSettings(),destinationKey=settings.destinationKey,destinationLabel=settings.destinationLabel;
  const colours=settings.wheelColours||["#f4f4f4","#3a3a3a","#d8d8d8","#202020","#bcbcbc","#505050"];
  const draw=()=>{
    const size=canvas.width,centre=size/2,radius=centre-10;
    context.clearRect(0,0,size,size);
    context.save();context.translate(centre,centre);context.rotate(rotation);
    artists.forEach((artist,index)=>{
      const start=-Math.PI/2-segmentAngle/2+index*segmentAngle,end=start+segmentAngle;
      context.beginPath();context.moveTo(0,0);context.arc(0,0,radius,start,end);context.closePath();
      context.fillStyle=colours[index%colours.length];context.fill();
      context.strokeStyle=settings.wheelLineColour||"rgba(0,0,0,.42)";context.lineWidth=2;context.stroke();
      const middle=start+segmentAngle/2,normalised=((middle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      context.save();context.rotate(middle);
      const inverted=normalised>Math.PI/2&&normalised<Math.PI*1.5;
      if(inverted)context.rotate(Math.PI);
      context.translate(inverted?-radius*.73:radius*.34,0);
      context.fillStyle=settings.wheelTextColour||(index%2===0?"#111":"#fff");
      context.font="900 13px Arial, sans-serif";context.textAlign=inverted?"left":"left";context.textBaseline="middle";
      const label=artist.name.length>22?`${artist.name.slice(0,20)}…`:artist.name;
      context.fillText(label,0,0,radius*.39);
      context.restore();
    });
    context.restore();
    context.beginPath();context.arc(centre,centre,radius,0,Math.PI*2);
    context.strokeStyle=settings.wheelRimColour||"#fff";context.lineWidth=8;context.stroke();
  };
  const randomIndex=()=>{
    if(globalThis.crypto?.getRandomValues){
      const values=new Uint32Array(1),limit=Math.floor(0x100000000/artists.length)*artists.length;
      do{crypto.getRandomValues(values)}while(values[0]>=limit);
      return values[0]%artists.length;
    }
    return Math.floor(Math.random()*artists.length);
  };
  const hidePurchaseLinks=()=>{
    els.wheelPurchaseLinks.hidden=true;
    els.wheelPurchaseLinks.classList.remove("is-revealed");
    for(const link of [els.wheelBuyMusic,els.wheelBuyMerch]){
      link.hidden=true;link.removeAttribute("href");link.removeAttribute("aria-label");delete link.dataset.artistName;delete link.dataset.destinationPlatform;
    }
  };
  const hideWinnerVideo=()=>{
    els.wheelVideo.hidden=true;
    els.wheelVideo.classList.remove("is-revealed");
    els.wheelVideoTitle.textContent="";
    els.wheelVideoFrame.removeAttribute("src");
    els.wheelVideoFrame.title="Featured artist video";
  };
  const showWinnerVideo=winner=>{
    const video=winner.featuredVideo,videoId=youtubeVideoId(video?.youtubeURL);
    if(!usesEnhancedIndieLabelExperience()||!videoId||video?.playableInEmbed!==true){hideWinnerVideo();return}
    els.wheelVideoTitle.textContent=video.title;
    els.wheelVideoFrame.title=`${video.title} — ${winner.name}`;
    els.wheelVideoFrame.src=`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`;
    els.wheelVideo.hidden=false;
    els.wheelVideo.classList.remove("is-revealed");
    void els.wheelVideo.offsetWidth;
    els.wheelVideo.classList.add("is-revealed");
    analytics.track("artist_video_shown",{artist_name:winner.name,interaction_source:"wheel_winner",destination_platform:"youtube",edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION},{dedupeKey:`wheel-video:${winner.name}`,dedupeMs:500});
  };
  const configurePurchaseLink=(link,label,url,artistName,destinationPlatform)=>{
    const destination=validHttps(url);
    if(!usesEnhancedIndieLabelExperience()||!destination){link.hidden=true;return false}
    link.href=destination;link.textContent=label;link.hidden=false;
    link.dataset.artistName=artistName;link.dataset.destinationPlatform=destinationPlatform;
    link.setAttribute("aria-label",`${label} from ${artistName} (opens in a new tab)`);
    return true;
  };
  const finish=winner=>{
    spinning=false;els.wheelSpin.disabled=false;
    if(usesEnhancedIndieLabelExperience())setLanewayCompanyWheelSpinState(false);else els.wheelSpin.textContent="Spin again";
    els.wheelStatus.textContent=`Winner: ${winner.name}`;
    els.wheelWinner.href=winner[destinationKey];els.wheelWinner.textContent=`Listen to ${winner.name} on ${destinationLabel}`;
    els.wheelWinner.setAttribute("aria-label",`Listen to ${winner.name} on ${destinationLabel} (opens in a new tab)`);
    els.wheelWinner.hidden=false;
    els.wheelImpact.textContent=winner.impactLine;
    els.wheelImpact.hidden=!winner.impactLine;
    els.wheelImpact.classList.remove("is-attention-flash");
    if(winner.impactLine){
      void els.wheelImpact.offsetWidth;
      els.wheelImpact.classList.add("is-attention-flash");
    }
    const hasMusic=configurePurchaseLink(els.wheelBuyMusic,"Buy Music",winner.buyMusicURL,winner.name,"buy_music");
    const hasMerch=configurePurchaseLink(els.wheelBuyMerch,"Buy Merch",winner.buyMerchURL,winner.name,"merchandise");
    els.wheelPurchaseLinks.hidden=!(hasMusic||hasMerch);
    els.wheelPurchaseLinks.classList.toggle("is-revealed",hasMusic||hasMerch);
    showWinnerVideo(winner);
    els.wheelWinner.focus({preventScroll:true});
    analytics.track("wheel_result_shown",{artist_name:winner.name,artist_count:artists.length,edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION},{dedupeKey:`wheel:${winner.name}`,dedupeMs:500});
    challengeReveal?.afterResult();
  };
  els.wheelSpin.addEventListener("click",()=>{
    if(spinning)return;
    analytics.track("wheel_spin_started",{artist_count:artists.length,edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION},{dedupeKey:"wheel-spin",dedupeMs:500});
    spinning=true;els.wheelSpin.disabled=true;
    if(usesEnhancedIndieLabelExperience())setLanewayCompanyWheelSpinState(true);else els.wheelSpin.textContent="Spinning";
    els.wheelWinner.hidden=true;els.wheelImpact.hidden=true;els.wheelImpact.textContent="";els.wheelStatus.textContent="The artist wheel is spinning…";
    els.wheelImpact.classList.remove("is-attention-flash");hidePurchaseLinks();hideWinnerVideo();
    const selected=randomIndex(),current=rotation%(Math.PI*2);
    const target=-selected*segmentAngle;
    const normalized=((target-current)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    const total=normalized+Math.PI*2*7,start=performance.now();
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches,duration=reduced?250:4800;
    const initial=rotation;
    cancelAnimationFrame(frame);
    const animate=now=>{
      const progress=Math.min(1,(now-start)/duration);
      const eased=1-Math.pow(1-progress,4);
      rotation=initial+total*eased;draw();
      if(progress<1)frame=requestAnimationFrame(animate);else finish(artists[selected]);
    };
    frame=requestAnimationFrame(animate);
  });
  els.wheelWinner.addEventListener("click",()=>{
    const winner=artists.find(item=>item[destinationKey]===els.wheelWinner.href);
    analytics.track("artist_destination_clicked",{artist_name:winner?.name||"",interaction_source:"wheel_winner",destination_platform:destinationKey.replace(/URL$/,"").toLowerCase(),destination_url_origin:new URL(els.wheelWinner.href).origin,edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION},{dedupeKey:`wheel-destination:${winner?.name||""}`,dedupeMs:500});
  },{passive:true});
  for(const link of [els.wheelBuyMusic,els.wheelBuyMerch])link.addEventListener("click",()=>{
    if(link.hidden||!link.href)return;
    analytics.track("artist_destination_clicked",{artist_name:link.dataset.artistName||"",interaction_source:"wheel_winner",destination_platform:link.dataset.destinationPlatform||"",destination_url_origin:new URL(link.href).origin,edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION},{dedupeKey:`wheel-purchase:${link.dataset.artistName||""}:${link.dataset.destinationPlatform||""}`,dedupeMs:500});
  },{passive:true});
  hidePurchaseLinks();hideWinnerVideo();
  els.companyWheel.hidden=false;draw();
  if(settings.artistWheel?.replacesFeaturedVideo){
    els.video.hidden=true;els.videoFrame.removeAttribute("src");
  }
}

function createLanewayCompanyArtistCard(artist){
  const card=document.createElement("article");card.className="laneway-company-artist";
  const name=document.createElement("h3");name.textContent=artist.name;
  const actions=document.createElement("div");actions.className="laneway-company-artist-actions";
  const settings=wheelSettings(),destinationKey=settings.destinationKey,destinationLabel=settings.destinationLabel;
  actions.append(createLanewayArtistLink(destinationLabel,artist[destinationKey],destinationKey.replace(/URL$/,"").toLowerCase(),artist.name));
  const website=validHttps(artist.websiteURL);
  if(website)actions.append(createLanewayArtistLink("Website",website,"website",artist.name));
  card.append(name,actions);return card;
}

function createLanewayArtistLink(label,url,destination,artistName){
  const link=document.createElement("a");link.className="laneway-company-artist-link is-active";link.href=url;link.target="_blank";link.rel="noopener noreferrer";
  link.textContent=label;link.setAttribute("aria-label",`${label} for ${artistName} (opens in a new tab)`);
  link.addEventListener("click",()=>{
    if(isLanewayCompanyEdition())analytics.track("artist_destination_clicked",{artist_name:artistName,interaction_source:"artist_directory",destination_platform:destination,destination_url_origin:new URL(url).origin,edition_type:config.editionType,tracking_version:LANEWAY_REPORTING_VERSION},{dedupeKey:`artist:${artistName}:${destination}`,dedupeMs:500});
    else DeepCutsInteractions.trackOutbound(analytics,destination,url);
  },{passive:true});
  return link;
}

function validSpotifyArtist(value){
  const url=validHttps(value);if(!url)return"";
  try{const parsed=new URL(url);return parsed.hostname==="open.spotify.com"&&/^\/artist\/[A-Za-z0-9]+\/?$/.test(parsed.pathname)?parsed.href:""}catch{return""}
}

function validWheelDestination(value,key){
  if(key==="spotifyURL")return validSpotifyArtist(value);
  const url=validHttps(value);if(!url)return"";
  try{const parsed=new URL(url);return key==="bandcampURL"&&parsed.hostname.endsWith(".bandcamp.com")?parsed.href:""}catch{return""}
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
  cards.forEach(card=>card.classList.toggle("wide",card.classList.contains("primary")||card.classList.contains("editorial")||card.classList.contains("school-challenge-card")||card.classList.contains("laneway-challenge-card")||card.classList.contains("business-challenge-card")||card.classList.contains("business-jobs-heading")));
  const paired=cards.filter(card=>!card.classList.contains("wide"));
  if(paired.length%2===1)paired.at(-1)?.classList.add("wide");
  els.links.hidden=cards.length===0;
}

function activeSubtitle(definition){
  if(isJookBoxEdition()&&definition.key==="spotify")return `Play ${config.bandName}`;
  if(definition.key==="newsReviews")return config.discovery?.newsLabel||definition.subLabel;
  if(definition.key==="buyMusic"&&config.links?.bandcamp&&!config.links?.buyMusic)return "Purchase music via Bandcamp";
  return definition.subLabel;
}

function analyticsDestination(key){return({buyMusic:"buy_music",newsReviews:"news_reviews",merchandise:"merchandise"})[key]||key}

function startAttentionCycle(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  if(isJookBoxEdition()){
    const pulseWaveform=()=>{
      if(document.hidden)return;
      els.waveform.classList.remove("pulse");void els.waveform.offsetWidth;els.waveform.classList.add("pulse");
    };
    setTimeout(pulseWaveform,600);
    attentionTimer=window.setInterval(pulseWaveform,8000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)pulseWaveform()},{passive:true});
    return;
  }
  if(isWheelEdition()){
    let controlIndex=0;
    let waveTick=0;
    const visibleCompanyControls=()=>[
      ...els.companyArtistList.querySelectorAll(".laneway-company-artist-link.is-active")
    ].filter(control=>{
      const bounds=control.getBoundingClientRect();
      return bounds.width>0&&bounds.height>0&&bounds.bottom>0&&bounds.top<window.innerHeight;
    });
    const runLanewayCompanyAttention=()=>{
      if(document.hidden)return;
      const controls=visibleCompanyControls();
      document.querySelectorAll('[data-edition-type="laneway_company"] .attention,[data-edition-type="indie_wheel"] .attention').forEach(control=>control.classList.remove("attention"));
      if(controls.length){
        const control=controls[controlIndex%controls.length];
        controlIndex+=1;
        control.classList.remove("attention");void control.offsetWidth;control.classList.add("attention");
      }
      if(waveTick%8===0){
        els.waveform.classList.remove("pulse");void els.waveform.offsetWidth;els.waveform.classList.add("pulse");
      }
      waveTick+=1;
    };
    setTimeout(runLanewayCompanyAttention,350);
    attentionTimer=window.setInterval(runLanewayCompanyAttention,560);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)runLanewayCompanyAttention()},{passive:true});
    return;
  }
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
function pageIdentifier(){return config.analytics?.pageIdentifier||`${editionEntry.editionId}:${isJookBoxEdition()?"jookbox-v1":"discovery-v1"}`}
function canonicalURL(){return new URL(editionEntry.canonicalPath||`/e/${editionEntry.editionId}`,location.origin).href}
function sharePayload(){return isWheelEdition()?{title:`${config.bandName} | Indie Wheel`,text:`Spin to discover ${config.bandName} artists, take the 10-question quiz and explore the catalogue on ${wheelSettings().destinationLabel}.`,url:canonicalURL()}:isJookBoxEdition()?{title:`${config.bandName} | JookBox`,text:`Play ${config.bandName} in the Deep Cuts JookBox and explore the band's official links.`,url:canonicalURL()}:isLanewayEdition()?{title:`${config.bandName} | Laneway`,text:`Discover ${config.bandName} and take the positive five-question Laneway quiz.`,url:canonicalURL()}:isSchoolEdition()?{title:`${config.bandName} | School Discovery`,text:`Discover ${config.bandName}: official school information, programs and video.`,url:canonicalURL()}:isBusinessEdition()?{title:`${config.bandName} | Careers`,text:`Explore current jobs and learn about working with ${config.bandName}.`,url:canonicalURL()}:isClubEdition()?{title:`${config.bandName} | Deep Cuts Clubs`,text:`Explore ${config.bandName}: verified club, membership, events and community links.`,url:canonicalURL()}:isCarEdition()?{title:`${config.bandName} | Deep Cuts Cars`,text:`Explore ${config.bandName}: verified history, specifications, buying and restoration links.`,url:canonicalURL()}:{title:`${config.bandName} | Deep Cuts`,text:`Discover ${config.bandName}: official music, video and social links.`,url:canonicalURL()}}

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
