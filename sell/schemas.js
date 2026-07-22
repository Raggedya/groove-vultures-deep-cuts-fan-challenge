export const SALES_SECTION_ORDER=[
  ["priorities","What they are trying to achieve"],
  ["values","What they appear to value"],
  ["pressures","Their likely business pressures"],
  ["opportunities","Where you may be able to help"],
  ["buying","How they buy"],
  ["supplierExpectations","What they expect from suppliers"],
  ["projects","Current priorities and projects"],
  ["executives","Key executives and management"],
  ["teams","Relevant teams and decision-makers"],
  ["feedback","Customer and market feedback"],
  ["risks","Risks before approaching them"],
  ["approach","How I would approach them"],
  ["questions","Questions to ask"],
  ["firstMeeting","What to say in the first meeting"],
  ["notToDo","What not to do"],
  ["tomorrow","If I were meeting them tomorrow"],
  ["evidence","Evidence and sources"]
];

export const CLAIM_STATUSES=new Set(["confirmed_fact","strong_interpretation","possible_interpretation","unknown","unable_to_verify"]);
export const CONFIDENCE_LEVELS=new Set(["High confidence","Moderate confidence","Low confidence"]);

export function validateIdentity(identity){
  if(!identity||typeof identity!=="object")return ["Business identity is missing"];
  const errors=[];
  if(!text(identity.id))errors.push("Business identity id is missing");
  if(!text(identity.officialName))errors.push("Official business name is missing");
  if(!validUrl(identity.website))errors.push("Official website must be an HTTPS URL");
  if(!text(identity.industry))errors.push("Industry is missing");
  if(!text(identity.location))errors.push("Location is missing");
  if(!["high","moderate"].includes(identity.matchConfidence))errors.push("Business identity confidence is insufficient");
  return errors;
}

export function validateReport(report){
  const errors=[];
  if(!report||typeof report!=="object")return ["Research report is missing"];
  if(report.objective!=="sell_to_company")errors.push("Research objective is invalid");
  errors.push(...validateIdentity(report.business));
  if(!validDate(report.researchedAt))errors.push("Research date is invalid");
  if(!validDate(report.researchCutoff))errors.push("Research cut-off date is invalid");
  if(!Array.isArray(report.sources)||report.sources.length===0)errors.push("At least one source is required");
  const sourceIds=new Set();
  for(const source of report.sources||[]){
    if(!text(source.id)||sourceIds.has(source.id))errors.push("Source ids must be present and unique");
    sourceIds.add(source.id);
    if(!text(source.title)||!text(source.publisher)||!validUrl(source.url)||!validDate(source.accessedAt))errors.push(`Source ${source.id||"unknown"} is incomplete`);
  }
  for(const [key] of SALES_SECTION_ORDER){
    const section=report.sections?.[key];
    if(!section||!Array.isArray(section.items))errors.push(`Section ${key} is missing`);
    for(const item of section?.items||[]){
      if(!text(item.title)||!CLAIM_STATUSES.has(item.status)||!CONFIDENCE_LEVELS.has(item.confidence))errors.push(`Section ${key} contains an invalid insight`);
      for(const field of ["found","meaning","relevance","action","question"])if(!text(item[field]))errors.push(`${item.title||key} is missing ${field}`);
      if(item.status!=="unknown"&&item.status!=="unable_to_verify"&&(!Array.isArray(item.sourceIds)||item.sourceIds.length===0))errors.push(`${item.title||key} has no evidence`);
      for(const id of item.sourceIds||[])if(!sourceIds.has(id))errors.push(`${item.title||key} references an unknown source`);
    }
  }
  for(const person of report.sections?.executives?.people||[]){
    if(!text(person.name)||!text(person.title)||!validDate(person.verifiedAt)||!person.sourceId||!sourceIds.has(person.sourceId))errors.push("An executive record is not current and verifiable");
    if(person.email||person.phone)errors.push("Private or guessed executive contact information is prohibited");
  }
  return [...new Set(errors)];
}

export function sanitizeOffering(value={}){
  const fields=["description","businessName","website","location","coverage","capabilities","certifications","customers","contractSize","relevance","other"];
  return Object.fromEntries(fields.map(key=>[key,String(value[key]||"").trim().slice(0,key==="description"?500:300)]));
}

export function publicReport(report){
  const copy=structuredClone(report);
  delete copy.internal;
  return copy;
}

function text(value){return typeof value==="string"&&value.trim().length>0}
function validUrl(value){try{const url=new URL(value);return url.protocol==="https:"}catch{return false}}
function validDate(value){return !Number.isNaN(new Date(value).getTime())}
