export const BANJO_BRIEF_CONFIG=Object.freeze({
  schemaVersion:"banjo-strategy-brief/1.0",maximumDurationSeconds:120,
  assumedWordsPerMinute:135,maximumWords:270
});

const SECTION_PLAN=[["opportunities","The opportunity worth testing is"],["approach","The best opening is"],["buying","On the buying process"],["risks","The main caution is"],["firstMeeting","In the first conversation"],["tomorrow","Your next practical move is"]];
const SPOKEN_STATUSES=new Set(["confirmed_fact","strong_interpretation","possible_interpretation"]);

export function buildBanjoStrategyBrief(report,{createdAt=new Date().toISOString()}={}){
  if(!report?.business||!report?.sections)throw new Error("A completed Commercial Instinct report is required");
  const seller=report.offering?.businessName||host(report.offering?.website)||"your company";
  const target=report.business.tradingName||report.business.officialName;
  const sourceById=new Map((report.sources||[]).map(source=>[String(source.id),source]));
  const lines=[`Right, here is the straight commercial read on how ${seller} should approach ${target}.`],decisions=[],spokenClaims=[];
  for(const [key,lead] of SECTION_PLAN){
    const item=(report.sections[key]?.items||[]).find(entry=>evidenceBacked(entry,sourceById));if(!item)continue;
    const fact=sentence(item.found);
    const interpretation=item.status==="confirmed_fact"?"":` This ${item.status==="strong_interpretation"?"suggests":"could indicate"} ${lowerFirst(sentence(item.meaning))}`;
    const advice=`${lead}: ${lowerFirst(sentence(item.action))}`;
    const spoken=`${fact}${interpretation} ${advice}`;
    if(!decisions.some(value=>normalise(value)===normalise(spoken))){
      decisions.push(spoken);lines.push(spoken);
      spokenClaims.push({section:key,status:item.status,text:spoken,sourceIds:[...new Set(item.sourceIds.map(String))]});
    }
  }
  lines.push("Keep the first contact useful and specific. Treat anything that is not publicly confirmed as a question to validate, not as a fact about their internal business.");
  lines.push("That is the play: earn the next conversation before trying to win the sale.");
  const script=fitToWordLimit(lines,BANJO_BRIEF_CONFIG.maximumWords);
  return {schemaVersion:BANJO_BRIEF_CONFIG.schemaVersion,briefId:crypto.randomUUID(),createdAt,
    seller:{name:seller,website:report.offering?.website||""},target:{name:target,website:report.business.website},script,
    estimatedDurationSeconds:estimateDuration(script),maximumDurationSeconds:BANJO_BRIEF_CONFIG.maximumDurationSeconds,
    voice:{mode:"owner_live_recording",consentRequired:true,consentConfirmedAt:null,sampleRequired:false},
    evidence:[...new Set(spokenClaims.flatMap(claim=>claim.sourceIds))].map(id=>sourceById.get(id)).filter(Boolean).map(source=>({id:String(source.id),title:source.title,publisher:source.publisher,url:source.url,accessedAt:source.accessedAt})),
    spokenClaims,
    provenance:{product:"commercial_instinct",researchCutoff:report.researchCutoff||report.researchedAt,sectionKeys:SECTION_PLAN.map(([key])=>key),integrityRule:"No evidence, no spoken claim"},manualEdits:false};
}

export function validateBanjoStrategyBrief(brief){
  const errors=[];
  if(brief?.schemaVersion!==BANJO_BRIEF_CONFIG.schemaVersion)errors.push("Banjo Brief version is not supported");
  if(!usable(brief?.briefId))errors.push("Brief ID is missing");
  if(!usable(brief?.seller?.name)||!usable(brief?.target?.name))errors.push("Seller and target names are required");
  if(!usable(brief?.script))errors.push("The speaking script is empty");
  if(wordCount(brief?.script)>BANJO_BRIEF_CONFIG.maximumWords)errors.push(`The script exceeds ${BANJO_BRIEF_CONFIG.maximumWords} words`);
  if(Number(brief?.maximumDurationSeconds)!==BANJO_BRIEF_CONFIG.maximumDurationSeconds)errors.push("The strategy-brief duration limit is invalid");
  if(brief?.voice?.mode!=="owner_live_recording")errors.push("The voice mode is not supported by this version");
  if(brief?.voice?.consentConfirmedAt&&!validDate(brief.voice.consentConfirmedAt))errors.push("Voice consent date is invalid");
  const evidenceIds=new Set((Array.isArray(brief?.evidence)?brief.evidence:[]).filter(source=>usable(source?.url)&&/^https:\/\//i.test(source.url)).map(source=>String(source.id)));
  for(const claim of Array.isArray(brief?.spokenClaims)?brief.spokenClaims:[]){
    if(!SPOKEN_STATUSES.has(claim?.status))errors.push("A spoken claim has an unsupported evidence status");
    if(!usable(claim?.text)||!Array.isArray(claim?.sourceIds)||!claim.sourceIds.length)errors.push("A spoken claim is missing evidence");
    else if(claim.sourceIds.some(id=>!evidenceIds.has(String(id))))errors.push("A spoken claim refers to evidence that is not included");
  }
  return errors;
}

export function estimateDuration(script){return Math.ceil(wordCount(script)/BANJO_BRIEF_CONFIG.assumedWordsPerMinute*60)}
export function wordCount(value){return String(value||"").trim().split(/\s+/).filter(Boolean).length}
export function fileNameForBrief(brief){return `${slug(brief.seller.name)}-to-${slug(brief.target.name)}-banjo-brief.json`}
function fitToWordLimit(lines,limit){const kept=[];for(const line of lines)if(wordCount([...kept,line].join("\n\n"))<=limit)kept.push(line);return kept.join("\n\n")}
function sentence(value){const clean=String(value||"").replace(/\s+/g," ").trim();return /[.!?]$/.test(clean)?clean:`${clean}.`}
function lowerFirst(value){return value?value[0].toLowerCase()+value.slice(1):value}
function normalise(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function usable(value){return typeof value==="string"&&value.trim().length>0}
function validDate(value){return !Number.isNaN(new Date(value).getTime())}
function evidenceBacked(item,sourceById){return usable(item?.found)&&usable(item?.action)&&SPOKEN_STATUSES.has(item?.status)&&Array.isArray(item?.sourceIds)&&item.sourceIds.length>0&&item.sourceIds.every(id=>sourceById.has(String(id)))}
function host(value){try{return new URL(value).hostname.replace(/^www\./,"")}catch{return ""}}
function slug(value){return String(value||"company").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"company"}
