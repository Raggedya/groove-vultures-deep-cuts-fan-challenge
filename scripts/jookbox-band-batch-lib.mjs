import crypto from "node:crypto";
import {BAND_JOOKBOX_MODEL} from "./jookbox-locked-model.mjs";

export const JOOKBOX_BAND_BATCH_SCHEMA="deep-cuts-jookbox-band-batch/1";
export const JOOKBOX_BAND_CONFIDENCE_GATE=98;

export function bandRowsFromMaster(rows){
  const selected=rows.filter(row=>clean(row.category)==="Music"&&clean(row.subcategory)==="Band"&&clean(row.entity_group)==="Band");
  const names=new Set(),records=new Set();
  return selected.map(row=>{
    const name=clean(row.display_name||row.entity_name);
    const recordId=clean(row.record_id);
    if(!name||!recordId)throw new Error(`Band row ${row.rowNumber||"unknown"} requires display_name and record_id.`);
    const nameKey=name.toLowerCase(),recordKey=recordId.toLowerCase();
    if(names.has(nameKey))throw new Error(`Duplicate band name in master data: ${name}.`);
    if(records.has(recordKey))throw new Error(`Duplicate band record ID in master data: ${recordId}.`);
    names.add(nameKey);records.add(recordKey);
    return{
      recordId,
      sourceRecordId:clean(row.source_record_id),
      masterSlug:clean(row.edition_slug),
      name,
      country:clean(row.country),
      homepageUrl:normaliseHttps(row.homepage_url||row.button_1_final_destination_url||row.button_1_destination_url),
      sourceURL:normaliseHttps(row.discovery_source_url),
      sourceUrls:sourceSeeds(row),
      youtubeUrl:youtubeSeed(row),
      masterResearchDate:clean(row.research_date),
      masterConfidence:Number(row.research_confidence||0),
      sourceRow:row
    };
  });
}

export function bandResearchInput(item){
  return{
    name:item.name,
    type:"jookbox",
    sourceUrls:item.sourceUrls,
    sourceLabels:item.sourceUrls.map((_,index)=>index===0?"Official band source":"Artist-controlled corroborating source"),
    youtubeUrl:item.youtubeUrl
  };
}

export function factoryResearchFromStudio(research){
  if(!research?.passed||research.confidence<JOOKBOX_BAND_CONFIDENCE_GATE)throw new Error(`${research?.bandName||"Band"} did not pass the 98% JookBox gate.`);
  const paragraphs=research.biography?.paragraphs||[];
  const featured=research.featuredVideo;
  const root=research.roots?.[0];
  if(!paragraphs.length||!featured?.youtubeURL||!root?.url)throw new Error(`${research.bandName} is missing verified factory evidence.`);
  const selections=(research.selections||[]).map(selection=>selection.kind==="show"&&(!selection.dateLabel||!selection.venue)
    ?{...selection,kind:"website",label:selection.label||"Tickets",detail:"Open the verified ticket destination"}
    :selection).filter(selection=>!authenticationWall(selection.url));
  const selectionIds=new Set(selections.map(selection=>selection.id));
  const displaySelectionIds=(research.displaySelectionIds||[]).filter(id=>selectionIds.has(id)).slice(0,BAND_JOOKBOX_MODEL.maximumDestinations);
  for(const selection of selections)if(displaySelectionIds.length<BAND_JOOKBOX_MODEL.maximumDestinations&&!displaySelectionIds.includes(selection.id))displaySelectionIds.push(selection.id);
  const sources=[...(research.sources||[])];
  if(!sources.some(source=>source.destination==="jookBoxSource"&&sameURL(source.url,root.url))){
    sources.push({
      destination:"jookBoxSource",
      url:root.url,
      sourceType:"verified artist-controlled source snapshot",
      identityVerified:true,
      verifiedAt:root.verifiedAt||research.verifiedAt,
      evidence:`The verified artist-controlled source supplied the JookBox destinations for ${research.bandName}.`
    });
  }
  return{
    bandName:research.bandName,
    bio:cleanBio(paragraphs[0]),
    editionType:"jukebox",
    links:Object.fromEntries(Object.entries(research.links||{}).map(([key,url])=>[key,authenticationWall(url)?"":url])),
    featuredVideo:{
      title:featured.title,
      youtubeURL:featured.youtubeURL,
      selectionBasis:"most-viewed-official"
    },
    sources,
    jookBox:{
      tickerBio:research.biography.tickerBio,
      displaySelectionIds,
      linkSourceURL:root.url,
      linkSourceVerifiedAt:root.verifiedAt||research.verifiedAt,
      selections,
      biography:{sourceURL:research.biography.sourceURL,paragraphs},
      appearanceVariant:BAND_JOOKBOX_MODEL.appearanceVariant,
      keyBankFormat:BAND_JOOKBOX_MODEL.keyBankFormat,
      cabinetArtwork:BAND_JOOKBOX_MODEL.cabinetArtwork,
      qrArtworkVariant:BAND_JOOKBOX_MODEL.qrArtworkVariant
    }
  };
}

export function youtubeReportRow(item){
  const research=item.research||{};
  const featured=research.featuredVideo||{};
  return{
    "Record ID":item.recordId,
    "Band Name":item.name,
    "Factory Status":item.status,
    "Confidence":research.confidence??item.confidence??"",
    "Official YouTube Channel":featured.channelURL||"",
    "Most Popular Verified Video Title":featured.title||"",
    "Most Popular Verified Video URL":featured.youtubeURL||"",
    "Selection Basis":featured.selectionBasis||"",
    "Verified At":featured.verifiedAt||research.verifiedAt||"",
    "Permanent URL":item.liveURL||"",
    "Edition ID":item.editionId||"",
    "QR Poster Variant":item.editionId?BAND_JOOKBOX_MODEL.qrArtworkVariant:"",
    "Failure / Omission Reason":[...(item.blockers||[]),...(item.reasons||[])].map(value=>typeof value==="string"?value:value.message).filter(Boolean).join(" | ")
  };
}

export function batchFingerprint(items){
  return crypto.createHash("sha256").update(JSON.stringify(items.map(item=>({recordId:item.recordId,name:item.name,sourceUrls:item.sourceUrls,youtubeUrl:item.youtubeUrl})))).digest("hex");
}

function sourceSeeds(row){
  const urls=allDestinations(row);
  const homepage=normaliseHttps(row.homepage_url);
  const bandcamp=urls.find(url=>host(url).endsWith("bandcamp.com"));
  const social=urls.find(url=>/^(?:www\.)?(?:instagram|facebook)\.com$/i.test(host(url)));
  const spotify=urls.find(url=>host(url)==="open.spotify.com");
  const seeds=unique([homepage,bandcamp,social,spotify].filter(Boolean));
  return seeds.slice(0,3);
}

function youtubeSeed(row){
  return allDestinations(row).find(url=>["youtube.com","www.youtube.com","m.youtube.com","youtu.be"].includes(host(url)))||"";
}

function allDestinations(row){
  const values=[row.homepage_url];
  for(const prefix of ["button_1","button_2","button_3","button_4","reserve_1","reserve_2"]){
    values.push(row[`${prefix}_final_destination_url`],row[`${prefix}_destination_url`]);
  }
  return unique(values.map(normaliseHttps).filter(Boolean));
}

function host(value){try{return new URL(value).hostname.toLowerCase()}catch{return""}}
function normaliseHttps(value){
  try{
    const url=new URL(clean(value));
    if(url.protocol==="http:")url.protocol="https:";
    if(url.protocol!=="https:")return"";
    url.hash="";
    return url.href;
  }catch{return""}
}
function unique(values){return[...new Set(values)]}
function cleanBio(value){
  const text=clean(value).replace(/\s+/g," ");
  if(text.length<=190)return text;
  const shortened=text.slice(0,187);
  const boundary=shortened.lastIndexOf(" ");
  return`${shortened.slice(0,boundary>130?boundary:187).replace(/[,:;\- ]+$/,"")}...`;
}
function clean(value){return String(value||"").trim()}
function sameURL(left,right){try{const a=new URL(left),b=new URL(right);return a.origin+a.pathname.replace(/\/$/,"")===b.origin+b.pathname.replace(/\/$/,"")}catch{return false}}
function authenticationWall(value){try{const url=new URL(String(value));const hostname=url.hostname.replace(/^www\./,"").toLowerCase(),pathname=url.pathname.toLowerCase();return hostname==="instagram.com"&&(pathname.startsWith("/accounts/login")||pathname.startsWith("/accounts/signup")||url.searchParams.has("next"))||["facebook.com","m.facebook.com"].includes(hostname)&&(/^\/(?:login|checkpoint|recover|reg)(?:\/|$)/.test(pathname)||(pathname.startsWith("/login")&&url.searchParams.has("next")))}catch{return false}}
