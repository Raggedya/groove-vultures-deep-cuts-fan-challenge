import {SALES_SECTION_ORDER} from "../sell/schemas.js";

const MODEL="@cf/meta/llama-4-scout-17b-16e-instruct";
const MAX_PAGES=6;
const MAX_SOURCE_CHARS=4200;
const PAGE_HINT=/(about|company|who-we-are|services|solutions|capabilities|industr|customer|case-stud|project|news|media|insight|career|leadership|team|supplier|procurement|sustainab|contact)/i;
const SKIP_HINT=/\.(?:pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|mp4|mp3)(?:$|[?#])/i;

export function internalResearchReady(env){return Boolean(env?.AI&&typeof env.AI.run==="function")}

export async function identifyOfficialCompany(website){
  const pages=await crawlWebsite(website,2);
  if(!pages.length)throw new ResearchError("WEBSITE_UNAVAILABLE","The target company website could not be read. Check the address or try again later.");
  const root=pages[0];
  const officialName=nameFromPage(root,website);
  return {
    id:`web-${slug(new URL(website).hostname)}`,
    officialName,
    tradingName:officialName,
    website,
    industry:"Industry to be confirmed during research",
    location:"Location to be confirmed during research",
    publicStatus:"Status not confirmed",
    matchConfidence:"moderate",
    identitySource:root.url
  };
}

export async function buildCommercialReport({business,offering},env){
  if(!internalResearchReady(env))throw new ResearchError("RESEARCH_PROVIDER_UNAVAILABLE","Live company research is not available at the moment.");
  const sellerUrl=validPublicHttps(offering?.website);
  const targetUrl=validPublicHttps(business?.website);
  if(!sellerUrl||!targetUrl)throw new ResearchError("INVALID_COMPANY_URL","Both official company websites must use a public HTTPS address.");
  const [sellerPages,targetPages]=await Promise.all([crawlWebsite(sellerUrl,MAX_PAGES),crawlWebsite(targetUrl,MAX_PAGES)]);
  if(!targetPages.length)throw new ResearchError("WEBSITE_UNAVAILABLE","The target company website could not be read. No briefing was created.");
  if(!sellerPages.length)throw new ResearchError("WEBSITE_UNAVAILABLE","Your company website could not be read. No supplier fit was invented.");

  const accessedAt=new Date().toISOString();
  const sellerName=nameFromPage(sellerPages[0],sellerUrl);
  const documents=[
    ...targetPages.map((page,index)=>sourceDocument(page,`target-${index+1}`,business.officialName,"target_company",accessedAt)),
    ...sellerPages.map((page,index)=>sourceDocument(page,`seller-${index+1}`,sellerName,"seller_company",accessedAt))
  ];
  const evidence=documents.map(document=>`[${document.id}] ${document.publisher} — ${document.title}\nURL: ${document.url}\n${document.text.slice(0,MAX_SOURCE_CHARS)}`).join("\n\n");
  const sectionList=SALES_SECTION_ORDER.map(([key,title])=>`${key}: ${title}`).join("\n");
  const result=await askJson(env,[
    {role:"system",content:`You are Commercial Instinct: a candid, highly experienced B2B sales adviser. Analyse only the supplied official website evidence. Write brief, plain human language, never corporate jargon. Clearly separate facts from interpretation. Never claim an internal need, budget, dissatisfaction or decision-maker unless the evidence explicitly confirms it. Never invent people, contacts, projects, procurement rules or customer sentiment. Never suggest the seller can provide a product, service or capability unless a seller source explicitly says so. Cite only supplied source IDs. Return JSON only.`},
    {role:"user",content:`MY COMPANY\nName: ${sellerName}\nWebsite: ${sellerUrl}\n\nTARGET COMPANY\nName: ${business.officialName}\nWebsite: ${targetUrl}\n\nFirst identify the seller's explicitly published capabilities from seller-* sources. Then create one useful insight for every section below. Opportunity, approach, first-meeting and tomorrow advice must connect a capability stated in a seller-* source to a signal stated in a target-* source and cite both. If that two-sided evidence does not exist, label the fit unknown and recommend discovery instead of inventing a capability. Each insight must contain title, status, found, meaning, relevance, action, question, confidence and sourceIds. Allowed status: confirmed_fact, strong_interpretation, possible_interpretation, unknown, unable_to_verify. Allowed confidence: High confidence, Moderate confidence, Low confidence. Keep each field concise. "found" must describe evidence, not advice. "action" is candid advice to the salesperson. "question" is one natural question to ask. If evidence is missing, use unknown or unable_to_verify and an empty sourceIds array. For executives, include a people array only for names and current professional titles explicitly present in the evidence; each person needs name, title, area, why, approach, sourceId, confidence. Do not include email or phone.\n\nSECTIONS\n${sectionList}\n\nReturn exactly this shape:\n{"sections":{"priorities":{"items":[{...}]},"values":{"items":[{...}]},"pressures":{"items":[{...}]},"opportunities":{"items":[{...}]},"buying":{"items":[{...}]},"supplierExpectations":{"items":[{...}]},"projects":{"items":[{...}]},"executives":{"items":[{...}],"people":[]},"teams":{"items":[{...}]},"feedback":{"items":[{...}]},"risks":{"items":[{...}]},"approach":{"items":[{...}]},"questions":{"items":[{...}]},"firstMeeting":{"items":[{...}]},"notToDo":{"items":[{...}]},"tomorrow":{"items":[{...}]},"evidence":{"items":[{...}]}},"unknowns":["..."]}\n\nOFFICIAL WEBSITE EVIDENCE\n${evidence.slice(0,43000)}`}
  ],5200);

  const sourceIds=new Set(documents.map(document=>document.id));
  const sections=Object.fromEntries(SALES_SECTION_ORDER.map(([key,title])=>{
    const generated=result?.sections?.[key]||{};
    const items=(Array.isArray(generated.items)?generated.items:[]).slice(0,4).map(item=>normalizeInsight(item,key,sourceIds));
    return [key,{title,items:items.length?items:[unknownInsight(key)]}];
  }));
  sections.executives.people=normalizePeople(result?.sections?.executives?.people,sourceIds,accessedAt);
  const sources=documents.map(({text,...source})=>source);
  return {
    schemaVersion:"1.0",
    reportVersion:"commercial-instinct-live-1",
    objective:"sell_to_company",
    business,
    offering:{...offering,businessName:clean(offering.businessName,160)||sellerName},
    researchMode:"official_websites_workers_ai",
    researchedAt:accessedAt,
    researchCutoff:accessedAt,
    notice:"Commercial Instinct uses public website evidence and clearly labelled interpretation. It cannot prove an internal need, buying decision, budget or final decision-maker.",
    unknowns:(Array.isArray(result?.unknowns)?result.unknowns:[]).map(item=>clean(item,300)).filter(Boolean).slice(0,12),
    sources,
    sections,
    stagesCompleted:["Confirming both companies","Reading official company pages","Comparing priorities, capabilities and commercial signals","Separating facts from interpretation","Preparing candid sales advice"]
  };
}

async function crawlWebsite(input,limit){
  const start=validPublicHttps(input);if(!start)return [];
  const root=new URL(start);const queue=[root.toString()];const seen=new Set();const pages=[];
  while(queue.length&&pages.length<limit){
    const url=queue.shift();if(seen.has(url))continue;seen.add(url);
    const page=await fetchPage(url,root.hostname).catch(()=>null);if(!page)continue;
    pages.push(page);
    for(const link of page.links){if(queue.length+pages.length>=limit*4)break;if(!seen.has(link))queue.push(link)}
  }
  return pages;
}

async function fetchPage(input,expectedHost){
  const url=new URL(input);if(!safeHost(url.hostname)||registrableHost(url.hostname)!==registrableHost(expectedHost))return null;
  const response=await fetch(url.toString(),{headers:{accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (compatible; DeepCutsCommercialInstinct/1.0; public-business-research)"},redirect:"manual",signal:AbortSignal.timeout(12000)});
  if(response.status>=300&&response.status<400){
    const next=new URL(response.headers.get("location")||"",url);if(!safeHost(next.hostname)||registrableHost(next.hostname)!==registrableHost(expectedHost))return null;
    return fetchPage(next.toString(),next.hostname);
  }
  const type=response.headers.get("content-type")||"";if(!response.ok||!type.includes("text/html"))return null;
  if(Number(response.headers.get("content-length")||0)>2500000)return null;
  const html=(await response.text()).slice(0,600000);
  const title=firstMatch(html,/<title[^>]*>([\s\S]*?)<\/title>/i)||firstMeta(html,"og:title")||url.hostname;
  const siteName=firstMeta(html,"og:site_name");
  const description=firstMeta(html,"description")||firstMeta(html,"og:description");
  const text=htmlToText(html).slice(0,18000);
  if(text.length<80)return null;
  const links=extractLinks(html,url).filter(link=>{
    const candidate=new URL(link);return registrableHost(candidate.hostname)===registrableHost(expectedHost)&&PAGE_HINT.test(candidate.pathname)&&!SKIP_HINT.test(candidate.pathname);
  });
  return {url:url.toString(),title:clean(decode(title),220),siteName:clean(decode(siteName),160),description:clean(decode(description),500),text,links:[...new Set(links)].slice(0,20)};
}

async function askJson(env,messages,max_tokens){
  const output=await env.AI.run(env.SALES_AI_MODEL||MODEL,{messages,temperature:0.15,max_tokens,response_format:{type:"json_object"}});
  const raw=typeof output==="string"?output:(output?.response||output?.result?.response||"");
  if(raw&&typeof raw==="object")return raw;
  const text=String(raw).trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  try{return JSON.parse(text)}catch{throw new ResearchError("RESEARCH_SYNTHESIS_FAILED","The evidence was collected, but a reliable briefing could not be assembled. Please try again.")}
}

function sourceDocument(page,id,publisher,type,accessedAt){return {id,title:page.title,publisher,url:page.url,publicationDate:null,accessedAt,type,relevance:type==="target_company"?"Official target-company evidence":"Official seller-company evidence",text:[page.description,page.text].filter(Boolean).join("\n")}}
function normalizeInsight(item,key,sourceIds){
  const allowedStatus=new Set(["confirmed_fact","strong_interpretation","possible_interpretation","unknown","unable_to_verify"]);
  const allowedConfidence=new Set(["High confidence","Moderate confidence","Low confidence"]);
  let status=allowedStatus.has(item?.status)?item.status:"possible_interpretation";
  const ids=(Array.isArray(item?.sourceIds)?item.sourceIds:[]).map(String).filter(id=>sourceIds.has(id));
  const needsTwoSidedEvidence=new Set(["opportunities","approach","firstMeeting","tomorrow"]).has(key);
  const hasSeller=ids.some(id=>id.startsWith("seller-")),hasTarget=ids.some(id=>id.startsWith("target-"));
  const twoSidedMissing=needsTwoSidedEvidence&&(!hasSeller||!hasTarget);
  if(!ids.length&&!new Set(["unknown","unable_to_verify"]).has(status))status="unknown";
  if(twoSidedMissing)status="unknown";
  return {title:clean(item?.title,180)||sectionFallbackTitle(key),status,found:clean(item?.found,800)||"The available official pages do not confirm this point.",meaning:twoSidedMissing?"The public evidence does not establish a credible connection between the seller's capabilities and the target's needs.":clean(item?.meaning,600)||"There is not enough evidence for a firm interpretation.",relevance:twoSidedMissing?"Treat the commercial fit as unproven.":clean(item?.relevance,600)||"Treat this as an open question, not a sales claim.",action:twoSidedMissing?"Run a short discovery conversation before proposing a solution.":clean(item?.action,600)||"Validate this directly before shaping a proposal.",question:twoSidedMissing?"Is there a current problem here that would justify considering outside help?":clean(item?.question,400)||"How does this work in practice today?",confidence:twoSidedMissing?"Low confidence":allowedConfidence.has(item?.confidence)?item.confidence:"Low confidence",sourceIds:ids};
}
function normalizePeople(value,sourceIds,verifiedAt){return (Array.isArray(value)?value:[]).filter(person=>person?.name&&person?.title&&sourceIds.has(String(person.sourceId))).slice(0,12).map(person=>({name:clean(person.name,140),title:clean(person.title,180),area:clean(person.area,180)||"Relevant business function",why:clean(person.why,500)||"The official website identifies this professional role.",approach:clean(person.approach,500)||"Use an official business contact route.",sourceId:String(person.sourceId),verifiedAt,confidence:["High confidence","Moderate confidence","Low confidence"].includes(person.confidence)?person.confidence:"Moderate confidence"}))}
function unknownInsight(key){return {title:sectionFallbackTitle(key),status:"unable_to_verify",found:"The official websites reviewed do not publish enough information to confirm this point.",meaning:"The answer may exist inside the business, but it is not visible in the current public evidence.",relevance:"Do not turn this gap into an assumption.",action:"Use the gap as a sensible discovery topic.",question:"Could you explain how this works in your business today?",confidence:"Low confidence",sourceIds:[]}}
function sectionFallbackTitle(key){return ({priorities:"The published priorities need validation",values:"Their buying values are not fully public",pressures:"Internal pressure cannot be confirmed publicly",opportunities:"The fit needs a real conversation",buying:"The buying path is not fully published",supplierExpectations:"Supplier expectations need confirmation",projects:"Current project relevance is unclear",executives:"Relevant individuals need verification",teams:"The buying group needs mapping",feedback:"Customer sentiment is not established",risks:"The main risk is untested fit",approach:"Lead with discovery, not assumptions",questions:"Ask before proposing",firstMeeting:"Keep the first meeting diagnostic",notToDo:"Do not overclaim the research",tomorrow:"Prepare to validate the commercial fit",evidence:"Evidence is limited to official public pages"})[key]||"This point needs validation"}
function nameFromPage(page,website){let value=String(page?.siteName||"").trim()||String(page?.title||"").split(/[|–—:]/)[0].trim();value=value.replace(/\.(?:com(?:\.au)?|net(?:\.au)?|org(?:\.au)?|au)$/i,"");if(!value||value.length>80||/^(home|welcome|homepage|official site)$/i.test(value))value=new URL(website).hostname.replace(/^www\./,"").split(".")[0].replace(/[-_]+/g," ");return titleCase(value)}
function extractLinks(html,base){const links=[];for(const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)){try{const url=new URL(decode(match[1]),base);url.hash="";if(url.protocol==="https:")links.push(url.toString())}catch{}}return links}
function htmlToText(html){return decode(html.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ").replace(/<noscript\b[\s\S]*?<\/noscript>/gi," ").replace(/<svg\b[\s\S]*?<\/svg>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ")).trim()}
function firstMeta(html,name){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return firstMatch(html,new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["']`,"i"))}
function firstMatch(value,pattern){const match=String(value).match(pattern);return match?.[1]||match?.[2]||""}
function decode(value){return String(value||"").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")}
function validPublicHttps(value){try{const url=new URL(String(value||""));if(url.protocol!=="https:"||url.username||url.password||url.port||!safeHost(url.hostname))return "";url.hash="";return url.toString()}catch{return ""}}
function safeHost(host){const value=String(host||"").toLowerCase().replace(/\.$/,"");if(!value||value==="localhost"||value.endsWith(".local")||value.endsWith(".internal"))return false;if(/^\d+\.\d+\.\d+\.\d+$/.test(value)){const parts=value.split(".").map(Number);return !(parts[0]===10||parts[0]===127||parts[0]===0||parts[0]===169&&parts[1]===254||parts[0]===172&&parts[1]>=16&&parts[1]<=31||parts[0]===192&&parts[1]===168)}return !value.includes(":")}
function registrableHost(host){return String(host).toLowerCase().replace(/^www\./,"")}
function slug(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)}
function titleCase(value){return String(value||"").replace(/\b\w/g,char=>char.toUpperCase())}
function clean(value,max=300){return String(value||"").replace(/\s+/g," ").trim().slice(0,max)}

export class ResearchError extends Error{constructor(code,message){super(message);this.code=code}}
export const __test={validPublicHttps,safeHost,htmlToText,extractLinks,normalizeInsight};
