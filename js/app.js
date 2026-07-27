"use strict";

const VERSION="20260727-laneway-discovery-engine-1";
const LANEWAY_REPORTING_VERSION="laneway-weekly-v2";
const $=id=>document.getElementById(id);
const els={page:$("discoveryPage"),error:$("errorScreen"),errorMessage:$("errorMessage"),bandName:$("bandName"),bio:$("artistBio"),artwork:$("heroArtwork"),brandLogo:$("editionBrandLogo"),waveform:$("sonicSignature"),features:$("featureList"),video:$("featuredVideo"),videoLabel:$("featuredVideoLabel"),videoTitle:$("featuredVideoTitle"),videoFrame:$("featuredVideoFrame"),links:$("platformLinks"),share:$("shareButton"),status:$("shareStatus"),description:$("pageDescription"),poweredBy:$("poweredByLabel"),copyright:$("coverCopyright"),lanewayHome:$("lanewayHomeLink"),lanewayRecommended:$("lanewayRecommendedLink"),companyDirectory:$("lanewayCompanyDirectory"),companyDirectoryCount:$("lanewayCompanyDirectoryCount"),companySearch:$("lanewayCompanySearch"),companyArtistList:$("lanewayCompanyArtistList"),companyEmpty:$("lanewayCompanyEmpty"),companyWheel:$("lanewayArtistWheel"),wheelCanvas:$("lanewayWheelCanvas"),wheelSpin:$("lanewayWheelSpin"),wheelStatus:$("lanewayWheelStatus"),wheelWinner:$("lanewayWheelWinner"),wheelImpact:$("lanewayWheelImpact"),wheelPurchaseLinks:$("lanewayWheelPurchaseLinks"),wheelBuyMusic:$("lanewayWheelBuyMusic"),wheelBuyMerch:$("lanewayWheelBuyMerch"),wheelIntroduction:$("lanewayWheelIntroduction"),artistDiscovery:$("lanewayArtistDiscovery"),discoveryName:$("lanewayDiscoveryArtistName"),discoveryDescription:$("lanewayDiscoveryDescription"),discoveryReason:$("lanewayDiscoveryReason"),discoveryStartWith:$("lanewayDiscoveryStartWith"),discoveryDestinations:$("lanewayDiscoveryDestinations"),discoverAnother:$("lanewayDiscoverAnother"),returnToWheel:$("lanewayReturnToWheel"),returnToRoster:$("lanewayReturnToRoster"),surpriseSection:$("lanewaySurpriseSection"),surpriseButton:$("lanewaySurpriseButton"),recommendations:$("lanewayRecommendations"),recommendationsTitle:$("lanewayRecommendationsTitle"),recommendationList:$("lanewayRecommendationList"),licensing:$("lanewayLicensing"),licensingLink:$("lanewayLicensingLink")};

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
let lanewayDiscovery=null;
const lanewaySession={startedAt:performance.now(),artists:new Set(),summarySent:false};
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
    if(isLanewayCompanyEdition())trackLanewayEvent("discovery_page_viewed",{page_location:location.origin+location.pathname,page_identifier:pageIdentifier()},{onceKey:`page:${editionEntry.editionId||editionEntry.slug}`});
    else analytics.track("discovery_page_viewed",{page_location:location.origin+location.pathname,page_identifier:pageIdentifier()},{onceKey:`page:${editionEntry.editionId||editionEntry.slug}`});
  }catch(error){console.error(error);showError("This Deep Cuts page could not be loaded. Please refresh and try again.")}
}

async function fetchJson(url){const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error(`${url} returned ${response.status}`);return response.json()}

async function applyConfig(){
  const name=config.bandName||editionEntry.name;
  const cars=isCarEdition(),clubs=isClubEdition(),schools=isSchoolEdition(),laneway=isLanewayEdition(),lanewayCompany=isLanewayCompanyEdition(),indieWheel=isIndieWheelEdition(),wheelEdition=lanewayCompany||indieWheel;
  document.documentElement.dataset.editionType=indieWheel?"laneway_company":config.editionType||"music";
  document.documentElement.dataset.productType=config.editionType||"music";
  document.title=`${name} | ${lanewayCompany?"Catalogue Discovery":indieWheel?"Indie Wheel":laneway?"Laneway":schools?"School Discovery":clubs?"Deep Cuts Clubs":cars?"Deep Cuts Cars":"Deep Cuts"}`;
  const bio=config.discovery?.bio||config.description||`Discover ${name}.`;
  els.description.content=wheelEdition?`Spin to discover a verified ${name} artist on ${wheelSettings().destinationLabel}, search the catalogue and take the 10-question artist quiz.`:laneway?`Discover ${name} through Laneway's positive five-question band quiz and verified official links.`:schools?`Discover ${name} through verified official school information and video.`:clubs?`Verified club, membership, events, bowls and community links for ${name}.`:cars?`Verified history, specifications, buying, ownership and restoration links for ${name}.`:`Official music, video and social links for ${name}.`;
  els.bandName.textContent=name;
  els.bio.textContent=bio;
  if(schools||laneway||wheelEdition){els.artwork.hidden=true;els.artwork.removeAttribute("src");els.artwork.alt=""}else{els.artwork.hidden=false;els.artwork.src=`/${config.characterArtwork||"assets/aggits-original-cutout-v4.png"}`;els.artwork.alt=`Aggits presenting ${name}`}
  if(laneway||wheelEdition){const branding=wheelEdition?wheelSettings():config.laneway;els.brandLogo.hidden=false;els.brandLogo.src=`/${branding?.logoArtwork||"assets/laneway-music-logo-reverse-transparent.png"}`;els.brandLogo.alt=name}else{els.brandLogo.hidden=true;els.brandLogo.removeAttribute("src");els.brandLogo.alt=""}
  els.copyright.textContent=config.social?.copyright||"copyright Clearlight Creative";
  els.poweredBy.textContent=laneway?"Deep Cuts":lanewayCompany?"Deep Cuts":schools?"School Discovery":clubs?"Powered by Deep Cuts Clubs":cars?"Powered by Deep Cuts Cars":"Powered by Deep Cuts";
  if(indieWheel)els.poweredBy.textContent="Indie Wheel";
  els.videoLabel.textContent=laneway||wheelEdition?"Featured video":schools?"Discover our school":clubs?"Featured club video":cars?"Featured automotive video":"Featured video";
  buildFeatures(laneway?config.laneway?.heroLabels:schools?config.school?.heroLabels:clubs?config.club?.heroLabels:cars?config.automotive?.heroLabels:["Listen","Watch","Follow","Buy Stuff"]);
  document.documentElement.style.setProperty("--accent",config.theme?.accent||"#2f80ff");
  if(schools){document.documentElement.style.setProperty("--school-secondary",config.theme?.accentSecondary||"#00C4B4");document.documentElement.style.setProperty("--school-navy",config.theme?.navy||"#0A2342");document.documentElement.style.setProperty("--school-surface",config.theme?.surface||"#FFFFFF");document.documentElement.style.setProperty("--school-content",config.theme?.contentBackground||"#F8FAFC")}
  buildWaveform(name);
  buildFeaturedVideo();
  buildLinks();
  if(wheelEdition)await buildLanewayCompanyDirectory();
  configureLanewayUtilityLinks();
  if(lanewayCompany)configureLanewayCompanyJourney();
  if(schools)await SchoolDiscoveryQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("schoolChallengeButton")});
  if(laneway)await LanewayQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("lanewayChallengeButton")});
  if(wheelEdition)await LanewayCompanyQuiz.configure({
    config,analytics,homeElement:els.page,challengeButton:$("lanewayCompanyChallengeButton"),
    recommendationProvider:isLanewayCompanyEdition()?answerRecords=>lanewayDiscovery?.quizRecommendations(answerRecords)||[]:null,
    onDiscoverArtist:isLanewayCompanyEdition()?(artistName,source)=>lanewayDiscovery?.selectByName(artistName,source,{scroll:true}):null,
    trackEvent:isLanewayCompanyEdition()?trackLanewayEvent:null
  });
  startAttentionCycle();
}

function isCarEdition(){return config.editionType==="car"}
function isClubEdition(){return config.editionType==="club"}
function isSchoolEdition(){return config.editionType==="school"}
function isLanewayEdition(){return config.editionType==="laneway"}
function isLanewayCompanyEdition(){return config.editionType==="laneway_company"}
function isIndieWheelEdition(){return config.editionType==="indie_wheel"}
function isWheelEdition(){return isLanewayCompanyEdition()||isIndieWheelEdition()}
function wheelSettings(){
  if(isIndieWheelEdition())return config.indieWheel;
  return{
    destinationKey:"spotifyURL",
    destinationLabel:"Spotify",
    ...config.lanewayCompany
  };
}
function wheelChallenge(){return isIndieWheelEdition()?config.indieWheelChallenge:config.lanewayCompanyChallenge}

function trackLanewayEvent(eventName,properties={},options={}){
  if(!isLanewayCompanyEdition())return analytics.track(eventName,properties,options);
  return analytics.track(eventName,{
    ...properties,
    edition_type:config.editionType,
    tracking_version:LANEWAY_REPORTING_VERSION
  },options);
}

function trackLanewaySessionSummary(){
  if(!isLanewayCompanyEdition()||lanewaySession.summarySent)return;
  lanewaySession.summarySent=true;
  trackLanewayEvent("session_summary",{
    session_duration_seconds:Math.max(1,Math.round((performance.now()-lanewaySession.startedAt)/1000)),
    discovered_artist_count:lanewaySession.artists.size
  },{onceKey:"laneway-session-summary"});
}

function configureLanewayCompanyJourney(){
  els.wheelIntroduction.hidden=false;
  els.surpriseSection.hidden=false;
  const linkSection=els.links.closest(".link-section");
  els.companyDirectory.after(linkSection);
  linkSection.after(els.licensing);
  const servicesURL=validHttps(config.lanewayCompany?.servicesURL);
  if(servicesURL){
    els.licensingLink.href=servicesURL;
    els.licensingLink.setAttribute("aria-label","Contact Laneway Music about licensing opportunities (opens in a new tab)");
    els.licensingLink.addEventListener("click",()=>trackLanewayEvent("services_contact_clicked",{
      button_name:"laneway_sync",interaction_source:"main_page",destination_url_origin:new URL(servicesURL).origin
    }),{passive:true});
    els.licensing.hidden=false;
  }
  els.surpriseButton.addEventListener("click",()=>lanewayDiscovery?.surprise("surprise_me"),{passive:true});
  els.discoverAnother.addEventListener("click",()=>lanewayDiscovery?.surprise("selected_artist_card"),{passive:true});
  els.returnToWheel.addEventListener("click",()=>{
    els.companyWheel.scrollIntoView({behavior:preferredScrollBehavior(),block:"start"});
    els.wheelSpin.focus({preventScroll:true});
  });
  els.returnToRoster.addEventListener("click",()=>{
    els.companyDirectory.scrollIntoView({behavior:preferredScrollBehavior(),block:"start"});
    els.companySearch.focus({preventScroll:true});
  });
  window.addEventListener("pagehide",trackLanewaySessionSummary,{passive:true});
}

function configureLanewayUtilityLinks(){
  if(!isLanewayEdition()&&!isWheelEdition()){
    els.lanewayHome.hidden=true;els.lanewayRecommended.hidden=true;
    return;
  }
  const settings=isWheelEdition()?wheelSettings():config.laneway;
  const homeURL=validHttps(isLanewayCompanyEdition()?settings?.servicesURL:settings?.recordCompanyHomeURL);
  const recommendedURL=validHttps(settings?.recommendedArtistsURL);
  if(!homeURL||!recommendedURL)throw new Error("Record-company navigation is incomplete.");
  els.lanewayHome.textContent=isLanewayCompanyEdition()?"Contact Us":"Home";
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

function buildLinks(){
  els.links.innerHTML="";
  const definitions=isWheelEdition()?[]:isSchoolEdition()?SCHOOL_LINK_DEFINITIONS:isClubEdition()?CLUB_LINK_DEFINITIONS:isCarEdition()?CAR_LINK_DEFINITIONS:MUSIC_LINK_DEFINITIONS;
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
  if(isWheelEdition())els.links.append(createLanewayCompanyChallengeCard());
  balanceLinkGrid();
}

function createLanewayCompanyChallengeCard(){
  const button=document.createElement("button");
  button.id="lanewayCompanyChallengeButton";button.type="button";button.className="laneway-challenge-card wide";button.disabled=true;
  const copy=document.createElement("span");copy.className="link-copy";
  const challenge=wheelChallenge();
  const title=document.createElement("strong");title.textContent=challenge?.title||`How Well Do You Know ${config.bandName}?`;
  const subtitle=document.createElement("small");subtitle.textContent=challenge?.ctaLabel||"Take the 10-Question Artist Quiz";
  const action=document.createElement("span");action.className="laneway-challenge-action";action.textContent=challenge?.buttonLabel||"Take the quiz";
  const arrow=document.createElement("span");arrow.className="link-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent=">";
  copy.append(title,subtitle,action);button.append(copy,arrow);button.addEventListener("click",()=>LanewayCompanyQuiz.open());
  return button;
}

function setLanewayCompanyWheelSpinState(isSpinning,hasSelection=false){
  els.wheelSpin.classList.toggle("is-spinning",isSpinning);
  const restingLabel=hasSelection?"Spin again":"Discover";
  els.wheelSpin.setAttribute("aria-label",isSpinning?"Selecting an artist":restingLabel);
  if(!isSpinning){els.wheelSpin.textContent=restingLabel;return}
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
  const [roster,discoveryMetadata]=await Promise.all([
    fetchJson(`/${settings.rosterFile}?v=${VERSION}`),
    isLanewayCompanyEdition()?fetchJson(`/${settings.artistImpactFile}?v=${VERSION}`):Promise.resolve({})
  ]);
  if(!Array.isArray(roster.artists)||!roster.artists.length)throw new Error(`${config.bandName} artist directory is empty.`);
  const artists=roster.artists
    .filter(item=>item.name&&validWheelDestination(item[destinationKey],destinationKey))
    .map(item=>{
      const stored=discoveryMetadata[item.name];
      const metadata=typeof stored==="string"?{description:stored}:stored&&typeof stored==="object"?stored:{};
      return{
        ...item,
        impactLine:String(metadata.description||"").trim(),
        description:String(metadata.description||"").trim(),
        reasonToListen:String(metadata.reasonToListen||"").trim(),
        startWith:String(metadata.startWith||"").trim(),
        related:Array.isArray(metadata.related)?metadata.related.filter(recommendation=>recommendation?.artist&&recommendation?.reason):[]
      };
    })
    .sort((a,b)=>a.name.localeCompare(b.name,"en-AU"));
  if(!artists.length)throw new Error(`No verified ${config.bandName} ${destinationLabel} artists were available.`);
  document.getElementById("indieWheelCollectionLabel").textContent=`${config.bandName} artist collection`;
  document.getElementById("indieWheelDirectoryLabel").textContent=`${config.bandName} artist collection`;
  document.getElementById("lanewayCompanySearch").placeholder=`Search ${config.bandName} artists`;
  if(isLanewayCompanyEdition()){
    const title=document.getElementById("lanewayArtistWheelTitle");
    title.replaceChildren("Spin to discover",document.createElement("br"));
    const accent=document.createElement("span");accent.textContent="an artist";title.append(accent);
    lanewayDiscovery=createLanewayCompanyDiscovery(artists);
  }
  if(settings.artistWheel?.enabled)buildLanewayArtistWheel(artists,artist=>{
    if(isLanewayCompanyEdition())lanewayDiscovery.select(artist,"wheel",{scroll:true});
  });
  const render=value=>{
    const needle=String(value||"").trim().toLocaleLowerCase("en-AU");
    const matches=artists.filter(item=>item.name.toLocaleLowerCase("en-AU").includes(needle));
    els.companyArtistList.replaceChildren(...matches.map(artist=>createLanewayCompanyArtistCard(artist)));
    els.companyEmpty.hidden=matches.length>0;
    els.companyDirectoryCount.textContent=needle?`${matches.length} of ${artists.length} verified artists`:`${artists.length} verified artists`;
    return matches.length;
  };
  let searchTimer=0;
  els.companySearch.addEventListener("input",event=>{
    const value=event.currentTarget.value,resultCount=render(value);
    if(isLanewayCompanyEdition()&&String(value).trim().length>=2){
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>trackLanewayEvent("artist_directory_searched",{result_count:resultCount,interaction_source:"search"},{dedupeKey:"laneway-directory-search",dedupeMs:750}),800);
    }
  },{passive:true});
  render("");els.companyDirectory.hidden=false;
}

function buildLanewayArtistWheel(artists,onArtistSelected=()=>{}){
  const canvas=els.wheelCanvas,context=canvas.getContext("2d");
  if(!context)throw new Error("Artist wheel canvas is unavailable.");
  const segmentAngle=Math.PI*2/artists.length;
  let rotation=0,spinning=false,frame=0,lastSelectedName="";
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
    const eligible=artists.map((artist,index)=>({artist,index})).filter(entry=>artists.length<2||entry.artist.name!==lastSelectedName);
    const count=eligible.length;
    if(globalThis.crypto?.getRandomValues){
      const values=new Uint32Array(1),limit=Math.floor(0x100000000/count)*count;
      do{crypto.getRandomValues(values)}while(values[0]>=limit);
      return eligible[values[0]%count].index;
    }
    return eligible[Math.floor(Math.random()*count)].index;
  };
  const hidePurchaseLinks=()=>{
    els.wheelPurchaseLinks.hidden=true;
    els.wheelPurchaseLinks.classList.remove("is-revealed");
    for(const link of [els.wheelBuyMusic,els.wheelBuyMerch]){
      link.hidden=true;link.removeAttribute("href");link.removeAttribute("aria-label");delete link.dataset.artistName;delete link.dataset.destinationPlatform;
    }
  };
  const configurePurchaseLink=(link,label,url,artistName,destinationPlatform)=>{
    const destination=validHttps(url);
    if(!isLanewayCompanyEdition()||!destination){link.hidden=true;return false}
    link.href=destination;link.textContent=label;link.hidden=false;
    link.dataset.artistName=artistName;link.dataset.destinationPlatform=destinationPlatform;
    link.setAttribute("aria-label",`${label} from ${artistName} (opens in a new tab)`);
    return true;
  };
  const finish=winner=>{
    spinning=false;lastSelectedName=winner.name;els.wheelSpin.disabled=false;
    if(isLanewayCompanyEdition()){
      setLanewayCompanyWheelSpinState(false,true);
      els.wheelStatus.textContent=`Selected artist: ${winner.name}.`;
      els.wheelWinner.hidden=true;els.wheelImpact.hidden=true;hidePurchaseLinks();
      trackLanewayEvent("wheel_spin_completed",{artist_name:winner.name,artist_count:artists.length,discovery_source:"wheel"},{dedupeKey:`wheel-complete:${winner.name}`,dedupeMs:500});
      trackLanewayEvent("wheel_result_shown",{artist_name:winner.name,artist_count:artists.length,discovery_source:"wheel"},{dedupeKey:`wheel:${winner.name}`,dedupeMs:500});
      onArtistSelected(winner);
    }else{
      els.wheelSpin.textContent="Spin again";
      els.wheelStatus.textContent=`Winner: ${winner.name}`;
      els.wheelWinner.href=winner[destinationKey];els.wheelWinner.textContent=`Listen to ${winner.name} on ${destinationLabel}`;
      els.wheelWinner.setAttribute("aria-label",`Listen to ${winner.name} on ${destinationLabel} (opens in a new tab)`);
      els.wheelWinner.hidden=false;els.wheelWinner.focus({preventScroll:true});
      analytics.track("wheel_result_shown",{artist_name:winner.name,artist_count:artists.length},{dedupeKey:`wheel:${winner.name}`,dedupeMs:500});
    }
  };
  els.wheelSpin.addEventListener("click",()=>{
    if(spinning)return;
    if(isLanewayCompanyEdition())trackLanewayEvent("wheel_spin_started",{artist_count:artists.length,discovery_source:"wheel"},{dedupeKey:"wheel-spin",dedupeMs:500});
    else analytics.track("wheel_spin_started",{artist_count:artists.length},{dedupeKey:"wheel-spin",dedupeMs:500});
    spinning=true;els.wheelSpin.disabled=true;
    if(isLanewayCompanyEdition())setLanewayCompanyWheelSpinState(true);else els.wheelSpin.textContent="Spinning";
    els.wheelWinner.hidden=true;els.wheelImpact.hidden=true;els.wheelImpact.textContent="";els.wheelStatus.textContent="The artist wheel is spinning…";
    els.wheelImpact.classList.remove("is-attention-flash");hidePurchaseLinks();
    const selected=randomIndex(),current=rotation%(Math.PI*2);
    const target=-selected*segmentAngle;
    const normalized=((target-current)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    const total=normalized+Math.PI*2*7,start=performance.now();
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches,duration=reduced?180:4800;
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
    if(isLanewayCompanyEdition())trackLanewayEvent("artist_destination_clicked",{artist_name:winner?.name||"",interaction_source:"wheel_winner",discovery_source:"wheel",destination_platform:destinationKey.replace(/URL$/,"").toLowerCase(),destination_url_origin:new URL(els.wheelWinner.href).origin},{dedupeKey:`wheel-destination:${winner?.name||""}`,dedupeMs:500});
    else DeepCutsInteractions.trackOutbound(analytics,destinationKey.replace(/URL$/,"").toLowerCase(),els.wheelWinner.href);
  },{passive:true});
  for(const link of [els.wheelBuyMusic,els.wheelBuyMerch])link.addEventListener("click",()=>{
    if(link.hidden||!link.href)return;
    trackLanewayEvent("artist_destination_clicked",{artist_name:link.dataset.artistName||"",interaction_source:"wheel_winner",discovery_source:"wheel",destination_platform:link.dataset.destinationPlatform||"",destination_url_origin:new URL(link.href).origin},{dedupeKey:`wheel-purchase:${link.dataset.artistName||""}:${link.dataset.destinationPlatform||""}`,dedupeMs:500});
  },{passive:true});
  hidePurchaseLinks();
  draw();els.companyWheel.hidden=false;
  if(isLanewayCompanyEdition())setLanewayCompanyWheelSpinState(false,false);else els.wheelSpin.textContent="Spin";
  if(settings.artistWheel?.replacesFeaturedVideo){
    els.video.hidden=true;els.videoFrame.removeAttribute("src");
  }
}

function createLanewayCompanyArtistCard(artist){
  const card=document.createElement("article");card.className="laneway-company-artist";
  const name=document.createElement("button");name.type="button";name.className="laneway-company-artist-name";name.textContent=artist.name;
  name.setAttribute("aria-label",`Discover ${artist.name}`);
  name.addEventListener("click",()=>lanewayDiscovery?.select(artist,"roster",{scroll:true}));
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
    if(isLanewayCompanyEdition())trackLanewayEvent("artist_destination_clicked",{artist_name:artistName,interaction_source:"artist_directory",discovery_source:"roster",destination_platform:destination,destination_url_origin:new URL(url).origin},{dedupeKey:`artist:${artistName}:${destination}`,dedupeMs:500});
    else DeepCutsInteractions.trackOutbound(analytics,destination,url);
  },{passive:true});
  return link;
}

function createLanewayCompanyDiscovery(artists){
  const byName=new Map(artists.map(artist=>[artist.name,artist]));
  let selected=null;
  const randomArtist=()=>{
    const eligible=artists.filter(artist=>artists.length<2||artist.name!==selected?.name);
    return eligible[secureRandomIndex(eligible.length)];
  };
  const createDestination=(artist,label,url,platform,source,primary=false)=>{
    const destination=validHttps(url);if(!destination)return null;
    const link=document.createElement("a");link.className=`laneway-discovery-link${primary?" primary":""}`;
    link.href=destination;link.target="_blank";link.rel="noopener noreferrer";link.textContent=label;
    link.setAttribute("aria-label",`${label} for ${artist.name} (opens in a new tab)`);
    link.addEventListener("click",()=>trackLanewayEvent("artist_destination_clicked",{
      artist_name:artist.name,interaction_source:"selected_artist_card",discovery_source:source,
      destination_platform:platform,destination_url_origin:new URL(destination).origin
    },{dedupeKey:`discovery-link:${artist.name}:${platform}`,dedupeMs:500}),{passive:true});
    return link;
  };
  const renderRecommendations=(artist,source)=>{
    const recommendations=artist.related.map(item=>({...item,record:byName.get(item.artist)})).filter(item=>item.record).slice(0,3);
    els.recommendationsTitle.textContent=`If you like ${artist.name}, try these`;
    els.recommendationList.replaceChildren(...recommendations.map(item=>{
      const card=document.createElement("article");card.className="laneway-recommendation";
      const copy=document.createElement("div"),title=document.createElement("h3"),reason=document.createElement("p"),button=document.createElement("button");
      title.textContent=item.record.name;reason.textContent=item.reason;button.type="button";button.textContent="Discover";
      button.addEventListener("click",()=>{
        trackLanewayEvent("recommendation_selected",{artist_name:item.record.name,recommending_artist_name:artist.name,discovery_source:"recommendation",interaction_source:source});
        select(item.record,"recommendation",{scroll:true});
      });
      copy.append(title,reason);card.append(copy,button);
      trackLanewayEvent("recommendation_shown",{artist_name:item.record.name,recommending_artist_name:artist.name,discovery_source:"recommendation",interaction_source:source},{dedupeKey:`recommendation-shown:${artist.name}:${item.record.name}`,dedupeMs:30000});
      return card;
    }));
    els.recommendations.hidden=recommendations.length===0;
  };
  const renderArtist=(artist,source)=>{
    els.discoveryName.textContent=artist.name;
    els.discoveryDescription.textContent=artist.description||"Explore this artist through Laneway Music.";
    els.discoveryReason.textContent=artist.reasonToListen?`Why listen: ${artist.reasonToListen}`:"";
    els.discoveryReason.hidden=!artist.reasonToListen;
    els.discoveryStartWith.textContent=artist.startWith?`Start with: ${artist.startWith}`:"";
    els.discoveryStartWith.hidden=!artist.startWith;
    const links=[];
    links.push(createDestination(artist,"Listen on Spotify",artist.spotifyURL,"spotify",source,true));
    if(artist.buyMusicURL){
      const isBandcamp=new URL(artist.buyMusicURL).hostname.endsWith(".bandcamp.com");
      links.push(createDestination(artist,isBandcamp?"Bandcamp":"Buy Music",artist.buyMusicURL,isBandcamp?"bandcamp":"buy_music",source));
    }
    links.push(createDestination(artist,"Buy Merch",artist.buyMerchURL,"merchandise",source));
    links.push(createDestination(artist,"YouTube",artist.youtubeURL,"youtube",source));
    links.push(createDestination(artist,"Website",artist.websiteURL,"website",source));
    links.push(createDestination(artist,"Instagram",artist.instagramURL,"instagram",source));
    links.push(createDestination(artist,"Laneway Profile",artist.sourceURL,"laneway_profile",source));
    els.discoveryDestinations.replaceChildren(...links.filter(Boolean));
    els.artistDiscovery.hidden=false;
    els.artistDiscovery.classList.remove("is-entering");void els.artistDiscovery.offsetWidth;els.artistDiscovery.classList.add("is-entering");
    renderRecommendations(artist,source);
  };
  const select=(artist,source,{scroll=false}={})=>{
    if(!artist||!byName.has(artist.name))return;
    selected=artist;lanewaySession.artists.add(artist.name);renderArtist(artist,source);
    trackLanewayEvent("artist_selected",{
      artist_name:artist.name,discovery_source:source,interaction_source:source,discovered_artist_count:lanewaySession.artists.size
    },{dedupeKey:`artist-selected:${artist.name}:${source}`,dedupeMs:400});
    if(source==="roster")trackLanewayEvent("artist_roster_selected",{artist_name:artist.name,discovery_source:"roster"});
    if(scroll)els.artistDiscovery.scrollIntoView({behavior:preferredScrollBehavior(),block:"start"});
  };
  const surprise=source=>{
    const artist=randomArtist();
    trackLanewayEvent("surprise_me_clicked",{artist_name:artist.name,discovery_source:"surprise_me",interaction_source:source});
    select(artist,"surprise_me",{scroll:true});
  };
  const quizRecommendations=answerRecords=>{
    const ordered=[...answerRecords].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const signature=ordered.map(answer=>`${answer.id}:${answer.correct?1:0}`).join("|");
    const picks=[];
    const add=(artist,reason)=>{
      if(!artist||picks.some(item=>item.artist===artist.name))return;
      picks.push({artist:artist.name,reason,spotifyURL:artist.spotifyURL});
    };
    for(const answer of ordered.filter(item=>!item.correct)){
      const artist=byName.get(answer.category);add(artist,`Meet the artist behind a catalogue story that caught you out.`);
      if(picks.length===3)break;
    }
    for(const answer of ordered.filter(item=>item.correct)){
      const known=byName.get(answer.category),related=known?.related?.[0],artist=related?byName.get(related.artist):known;
      add(artist,related?.reason||`Follow a catalogue thread you already recognised.`);
      if(picks.length===3)break;
    }
    let cursor=stableHash(signature)%artists.length;
    while(picks.length<3){add(artists[cursor%artists.length],"A different entry point into the breadth of the Laneway catalogue.");cursor+=11}
    return picks;
  };
  return{select,surprise,selectByName:(name,source,options)=>select(byName.get(name),source,options),quizRecommendations,getSelected:()=>selected};
}

function secureRandomIndex(length){
  if(length<=1)return 0;
  if(globalThis.crypto?.getRandomValues){
    const values=new Uint32Array(1),limit=Math.floor(0x100000000/length)*length;
    do{crypto.getRandomValues(values)}while(values[0]>=limit);
    return values[0]%length;
  }
  return Math.floor(Math.random()*length);
}

function stableHash(value){
  let hash=2166136261;
  for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
  return hash>>>0;
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
  if(isLanewayCompanyEdition()){
    const pulseWaveform=()=>{if(!document.hidden){els.waveform.classList.remove("pulse");void els.waveform.offsetWidth;els.waveform.classList.add("pulse")}};
    setTimeout(pulseWaveform,500);attentionTimer=window.setInterval(pulseWaveform,10000);
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
function preferredScrollBehavior(){return matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}
function pageIdentifier(){return config.analytics?.pageIdentifier||`${editionEntry.editionId}:discovery-v1`}
function canonicalURL(){return new URL(editionEntry.canonicalPath||`/e/${editionEntry.editionId}`,location.origin).href}
function sharePayload(){return isLanewayCompanyEdition()?{title:"Laneway Music | Catalogue Discovery",text:"Discover artists from across the Laneway Music catalogue.",url:canonicalURL()}:isWheelEdition()?{title:`${config.bandName} | Indie Wheel`,text:`Spin to discover ${config.bandName} artists, take the 10-question quiz and explore the catalogue on ${wheelSettings().destinationLabel}.`,url:canonicalURL()}:isLanewayEdition()?{title:`${config.bandName} | Laneway`,text:`Discover ${config.bandName} and take the positive five-question Laneway quiz.`,url:canonicalURL()}:isSchoolEdition()?{title:`${config.bandName} | School Discovery`,text:`Discover ${config.bandName}: official school information, programs and video.`,url:canonicalURL()}:isClubEdition()?{title:`${config.bandName} | Deep Cuts Clubs`,text:`Explore ${config.bandName}: verified club, membership, events and community links.`,url:canonicalURL()}:isCarEdition()?{title:`${config.bandName} | Deep Cuts Cars`,text:`Explore ${config.bandName}: verified history, specifications, buying and restoration links.`,url:canonicalURL()}:{title:`${config.bandName} | Deep Cuts`,text:`Discover ${config.bandName}: official music, video and social links.`,url:canonicalURL()}}

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
