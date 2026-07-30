import {buildTelstraReport,telstraMatches} from "../sell/demo-data.js";
import {publicReport,sanitizeOffering,validateIdentity,validateReport} from "../sell/schemas.js";
import {buildCommercialReport,buildDocumentReview,buildUrlReview,identifyOfficialCompany,internalResearchReady,ResearchError,validPublicHttps} from "./commercial-research.js";
import {
  acquireRequestSlot,
  concurrentRequestResponse,
  dailyLimitResponse,
  enforceRateLimit,
  protectionUnavailableResponse,
  rateLimitResponse,
  readJsonBody,
  reserveDailyUsage
} from "./security.js";

const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const EVENTS=new Set(["business_searched","business_confirmed","offering_entered","research_started","research_completed","section_opened","executive_section_opened","source_opened","strategy_viewed","meeting_briefing_viewed","report_exported","briefing_saved","private_share_created","banjo_brief_created","banjo_brief_exported","low_confidence_result","research_failure","new_search_started"]);
const RESEARCH_ROUTES=new Set(["/api/sell/identify","/api/sell/research","/api/sell/review","/api/sell/document-review"]);
const IDENTITY_KEYS=new Set(["id","officialName","tradingName","website","industry","location","publicStatus","registration","matchConfidence","identitySource","identityEvidence"]);
const OFFERING_KEYS=new Set(["description","businessName","website","location","coverage","capabilities","certifications","customers","contractSize","relevance","other"]);
const BODY_RULES={
  identify:{maxBytes:8192,keys:new Set(["targetWebsite","website","query","sellerWebsite","location","demo"])},
  research:{maxBytes:65536,keys:new Set(["business","offering","seller","target","request","demo"])},
  review:{maxBytes:16384,keys:new Set(["url","reviewType","spoilerFree","request"])},
  document:{maxBytes:80000,keys:new Set(["text","fileName","reviewType","request"])},
  briefing:{maxBytes:524288,keys:new Set(["report"])},
  event:{maxBytes:8192,keys:new Set(["eventName","eventId","briefingId","sectionId","sessionId","deviceCategory","result","sourceId","timestamp"])}
};

export async function handleSales(request,env,ctx,url){
  if(url.pathname!=="/api/sell/health"){
    const limited=await enforceRateLimit(env,"SALES_RATE_LIMITER",request,`sales:${url.pathname}`);
    if(!limited.configured||limited.error)return protectionUnavailableResponse();
    if(!limited.ok)return rateLimitResponse();
  }
  let releaseSlot=null;
  if(RESEARCH_ROUTES.has(url.pathname)){
    const limited=await enforceRateLimit(env,"SALES_RESEARCH_RATE_LIMITER",request,"sales-research");
    if(!limited.configured||limited.error)return protectionUnavailableResponse();
    if(!limited.ok)return rateLimitResponse();
    releaseSlot=await acquireRequestSlot(request,"sales-research");
    if(!releaseSlot)return concurrentRequestResponse();
  }
  try{return await routeSales(request,env,ctx,url)}
  finally{releaseSlot?.()}
}

async function routeSales(request,env,ctx,url){
  if(url.pathname==="/api/sell/identify"&&request.method==="POST")return identify(request,env);
  if(url.pathname==="/api/sell/research"&&request.method==="POST")return research(request,env);
  if(url.pathname==="/api/sell/review"&&request.method==="POST")return reviewUrl(request,env);
  if(url.pathname==="/api/sell/document-review"&&request.method==="POST")return reviewDocument(request,env);
  if(url.pathname==="/api/sell/briefings"&&request.method==="POST")return saveBriefing(request,env);
  if(url.pathname.startsWith("/api/sell/briefings/")&&request.method==="GET")return loadBriefing(request,env,url);
  if(url.pathname==="/api/sell/events"&&request.method==="POST")return recordEvent(request,env,ctx);
  if(url.pathname==="/api/sell/health"&&request.method==="GET")return reply({ok:true,module:"commercial-instinct",providerConfigured:providerReady(env),providerMode:externalProviderReady(env)?"external":internalResearchReady(env)?"official-websites-ai":"unavailable"});
  return reply({ok:false,error:"Unknown sales-intelligence route"},404);
}

async function reviewUrl(request,env){
  const parsed=await salesBody(request,BODY_RULES.review);if(!parsed.ok)return parsed.response;
  const body=parsed.value;
  if(!validReviewBody(body))return reply({ok:false,error:"Invalid review request"},400);
  if(!validPublicHttps(body?.url))return reply({ok:false,code:"INVALID_REVIEW_URL",error:"Enter a public HTTPS page."},400);
  if(!internalResearchReady(env))return reply({ok:false,code:"RESEARCH_PROVIDER_UNAVAILABLE",error:"Live review research is not available at the moment."},503);
  if(!(await reserveDailyUsage(env,"sales_research")))return dailyLimitResponse();
  try{return reply({ok:true,review:await buildUrlReview({url:body?.url,reviewType:body?.reviewType,spoilerFree:body?.spoilerFree!==false,request:body?.request},env)})}
  catch(error){return researchFailure(error)}
}

async function reviewDocument(request,env){
  const parsed=await salesBody(request,BODY_RULES.document);if(!parsed.ok)return parsed.response;
  const body=parsed.value;
  if(!validDocumentBody(body))return reply({ok:false,error:"Invalid document review request"},400);
  const source=String(body?.text||"").trim();
  if(source.length<40)return reply({ok:false,code:"INVALID_DOCUMENT",error:"The document does not contain enough readable text."},400);
  if(source.length>60000)return reply({ok:false,code:"DOCUMENT_TOO_LARGE",error:"The readable document text exceeds the 60,000-character analysis limit."},413);
  if(!internalResearchReady(env))return reply({ok:false,code:"RESEARCH_PROVIDER_UNAVAILABLE",error:"Document review is not available at the moment."},503);
  if(!(await reserveDailyUsage(env,"sales_research")))return dailyLimitResponse();
  try{return reply({ok:true,review:await buildDocumentReview({text:body?.text,fileName:body?.fileName,reviewType:body?.reviewType,request:body?.request},env)})}
  catch(error){return researchFailure(error)}
}

async function identify(request,env){
  const parsed=await salesBody(request,BODY_RULES.identify);if(!parsed.ok)return parsed.response;
  const body=parsed.value;
  if(!validIdentifyBody(body))return reply({ok:false,error:"Invalid company identification request"},400);
  const website=validPublicHttps(body?.targetWebsite||body?.website);
  const query=clean(body?.query,200)||companyNameFromUrl(website);
  if(query.length<2||!website)return reply({ok:false,error:"Enter the official target-company website"},400);
  const demo=body?.demo===true?telstraMatches(query,website):[];
  if(demo.length)return reply({ok:true,matches:demo,source:"verified_demo"});
  if(!providerReady(env))return reply({ok:false,code:"RESEARCH_PROVIDER_UNAVAILABLE",error:"Live company research is not configured yet. The complete Telstra demonstration remains available.",demo:"Telstra"},503);
  if(!(await reserveDailyUsage(env,"sales_research")))return dailyLimitResponse();
  let matches=[];
  if(externalProviderReady(env)){
    const result=await providerCall(env,"identify",{query,website,targetWebsite:website,sellerWebsite:validPublicHttps(body.sellerWebsite),location:clean(body.location,200)});
    if(!result.ok)return result.response;
    matches=(Array.isArray(result.data.matches)?result.data.matches:[]).filter(item=>validateIdentity(item).length===0).slice(0,8).map(publicIdentity);
  }else{
    try{matches=[await identifyOfficialCompany(website,env)]}
    catch(error){return researchFailure(error)}
  }
  if(!matches.length)return reply({ok:true,matches:[],message:"No business could be identified confidently. Add an official website or location and try again."});
  return reply({ok:true,matches,source:"configured_provider"});
}

async function research(request,env){
  const parsed=await salesBody(request,BODY_RULES.research);if(!parsed.ok)return parsed.response;
  const body=parsed.value;
  if(!validResearchBody(body))return reply({ok:false,error:"Invalid research request"},400);
  const identity=body?.business;
  const identityErrors=validateIdentity(identity);
  if(identityErrors.length)return reply({ok:false,error:"Confirm the business before research",details:identityErrors},400);
  if(!validPublicHttps(identity?.website))return reply({ok:false,error:"Confirm a public HTTPS target-company website before research"},400);
  const offering=sanitizeOffering(body?.offering);
  if(!validPublicHttps(offering.website))return reply({ok:false,error:"Enter the official My Company website before research"},400);
  let report;
  if(body?.demo===true&&identity.id==="au-asx-tls")report=buildTelstraReport(offering);
  else{
    if(!providerReady(env))return reply({ok:false,code:"RESEARCH_PROVIDER_UNAVAILABLE",error:"The research service is unavailable. No briefing has been invented."},503);
    if(!(await reserveDailyUsage(env,"sales_research")))return dailyLimitResponse();
    if(externalProviderReady(env)){
      const result=await providerCall(env,"research",{business:identity,offering,seller:{website:validPublicHttps(offering.website)},target:{website:validPublicHttps(identity.website)},objective:"sell_to_company",product:"commercial_instinct",requiredSchema:"deep-cuts-sales-1.0"});
      if(!result.ok)return result.response;
      report=result.data.report;
    }else{
      try{report=await buildCommercialReport({business:identity,offering,request:body?.request},env)}
      catch(error){return researchFailure(error)}
    }
  }
  const errors=validateReport(report);
  if(errors.length)return reply({ok:false,code:"REPORT_VALIDATION_FAILED",error:"The research did not meet Deep Cuts evidence standards. No briefing was published.",details:errors.slice(0,20)},422);
  const runId=crypto.randomUUID();
  await safeDb(env,`INSERT INTO sales_research_runs (run_id,business_id,status,stages_json,created_at,completed_at) VALUES (?1,?2,'completed',?3,?4,?4)`,[runId,identity.id,JSON.stringify(report.stagesCompleted||[]),new Date().toISOString()]);
  return reply({ok:true,runId,report:publicReport(report)});
}

async function saveBriefing(request,env){
  const parsed=await salesBody(request,BODY_RULES.briefing);if(!parsed.ok)return parsed.response;
  const body=parsed.value;
  if(!plainObject(body.report))return reply({ok:false,error:"Invalid private briefing request"},400);
  const report=body?.report;
  const errors=validateReport(report);
  if(errors.length)return reply({ok:false,error:"Only a validated briefing can be saved",details:errors.slice(0,20)},422);
  const token=randomToken();
  const tokenHash=await hash(token);
  const briefingId=crypto.randomUUID();
  const now=new Date().toISOString();
  const expiresAt=new Date(Date.now()+30*86400000).toISOString();
  await env.DB.prepare(`INSERT INTO sales_briefings (briefing_id,access_token_hash,business_id,business_name,business_identity_json,offering_json,report_json,researched_at,research_cutoff,provider,created_at,updated_at,expires_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11,?12)`)
    .bind(briefingId,tokenHash,report.business.id,clean(report.business.officialName,200),JSON.stringify(report.business),JSON.stringify(report.offering||{}),JSON.stringify(publicReport(report)),report.researchedAt,report.researchCutoff,clean(report.researchMode,40)||"configured_provider",now,expiresAt).run();
  return reply({ok:true,briefingId,accessToken:token,expiresAt});
}

async function loadBriefing(request,env,url){
  const briefingId=clean(decodeURIComponent(url.pathname.slice("/api/sell/briefings/".length)),80);
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!briefingId||!token)return reply({ok:false,error:"Private briefing access is required"},401);
  const row=await env.DB.prepare("SELECT access_token_hash,report_json,expires_at FROM sales_briefings WHERE briefing_id=?1").bind(briefingId).first();
  if(!row||new Date(row.expires_at)<=new Date()||!(await equalHash(row.access_token_hash,token)))return reply({ok:false,error:"Private briefing not found or access has expired"},404);
  return reply({ok:true,report:JSON.parse(row.report_json),expiresAt:row.expires_at});
}

async function recordEvent(request,env,ctx){
  const parsed=await salesBody(request,BODY_RULES.event);if(!parsed.ok)return parsed.response;
  const body=parsed.value;
  if(!validEventBody(body))return reply({ok:false,error:"Invalid product event"},400);
  const eventName=clean(body?.eventName,60);
  if(!EVENTS.has(eventName))return reply({ok:false,error:"Invalid product event"},400);
  const eventId=clean(body.eventId,100)||crypto.randomUUID();
  const briefingId=clean(body.briefingId,80)||null;
  const sectionId=clean(body.sectionId,60)||null;
  const sessionId=clean(body.sessionId,100)||null;
  const device=clean(body.deviceCategory,20)||null;
  const metadata=JSON.stringify({result:clean(body.result,80)||undefined,sourceId:clean(body.sourceId,80)||undefined});
  const operation=safeDb(env,"INSERT OR IGNORE INTO sales_events (event_id,briefing_id,event_name,occurred_at,received_at,session_id,section_id,device_category,metadata_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",[eventId,briefingId,eventName,validDate(body.timestamp),new Date().toISOString(),sessionId,sectionId,device,metadata]);
  if(ctx?.waitUntil)ctx.waitUntil(operation);else await operation;
  return reply({ok:true});
}

async function providerCall(env,operation,payload){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch(env.SALES_RESEARCH_API_URL,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${env.SALES_RESEARCH_API_KEY}`},body:JSON.stringify({operation,...payload}),signal:controller.signal});
    const data=await responseJsonWithinLimit(response,1000000).catch(()=>null);
    if(!response.ok||!data)return {ok:false,response:reply({ok:false,code:"RESEARCH_PROVIDER_FAILED",error:"The research service could not complete a verified result. No briefing was invented."},502)};
    return {ok:true,data};
  }catch{return {ok:false,response:reply({ok:false,code:"RESEARCH_PROVIDER_FAILED",error:"The research service could not complete a verified result. Try again later."},502)}}
  finally{clearTimeout(timeout)}
}

function externalProviderReady(env){try{const url=new URL(env.SALES_RESEARCH_API_URL);return Boolean(env.SALES_RESEARCH_API_KEY)&&url.protocol==="https:"&&!url.username&&!url.password}catch{return false}}
function providerReady(env){return externalProviderReady(env)||internalResearchReady(env)}
function researchFailure(error){const known=error instanceof ResearchError;return reply({ok:false,code:known?error.code:"RESEARCH_PROVIDER_FAILED",error:known?error.message:"The research service could not complete a verified result. Try again later."},known&&error.code==="INVALID_COMPANY_URL"?400:502)}
async function salesBody(request,rule){return readJsonBody(request,{maxBytes:rule.maxBytes,allowedKeys:rule.keys})}
function clean(value,max=200){return String(value||"").trim().slice(0,max)}
function validIdentifyBody(body){
  return optionalString(body,"targetWebsite",500)&&optionalString(body,"website",500)
    &&optionalString(body,"query",200)&&optionalString(body,"sellerWebsite",500)
    &&optionalString(body,"location",200)&&optionalBoolean(body,"demo");
}
function validResearchBody(body){
  if(!plainObject(body.business)||!plainObject(body.offering)||!optionalString(body,"request",1000)||!optionalBoolean(body,"demo"))return false;
  if(Object.keys(body.business).some(key=>!IDENTITY_KEYS.has(key))||Object.keys(body.offering).some(key=>!OFFERING_KEYS.has(key)))return false;
  for(const[key,value]of Object.entries(body.business)){
    if(key==="identityEvidence"){
      if(!Array.isArray(value)||value.length>20||value.some(item=>typeof item!=="string"||item.length>200))return false;
    }else if(typeof value!=="string"||value.length>500)return false;
  }
  if(Object.values(body.offering).some(value=>typeof value!=="string"||value.length>500))return false;
  for(const key of ["seller","target"]){
    if(body[key]===undefined)continue;
    if(!plainObject(body[key])||Object.keys(body[key]).some(field=>field!=="website")||!optionalString(body[key],"website",500))return false;
  }
  return true;
}
function validReviewBody(body){
  return optionalString(body,"url",500)&&optionalString(body,"reviewType",40)
    &&optionalString(body,"request",1000)&&optionalBoolean(body,"spoilerFree");
}
function validDocumentBody(body){
  return optionalString(body,"text",60000)&&optionalString(body,"fileName",240)
    &&optionalString(body,"reviewType",40)&&optionalString(body,"request",1000);
}
function validEventBody(body){
  for(const[key,max]of Object.entries({eventName:60,eventId:100,briefingId:80,sectionId:60,sessionId:100,deviceCategory:20,result:80,sourceId:80,timestamp:40})){
    if(!optionalString(body,key,max))return false;
  }
  if(body.deviceCategory!==undefined&&!["mobile","tablet","desktop","unknown"].includes(body.deviceCategory))return false;
  if(body.timestamp!==undefined&&Number.isNaN(new Date(body.timestamp).getTime()))return false;
  return true;
}
function optionalString(object,key,max){return object[key]===undefined||(typeof object[key]==="string"&&object[key].length<=max)}
function optionalBoolean(object,key){return object[key]===undefined||typeof object[key]==="boolean"}
function plainObject(value){return Boolean(value)&&typeof value==="object"&&!Array.isArray(value)}
function publicIdentity(value){return Object.fromEntries(Object.entries(value||{}).filter(([key])=>IDENTITY_KEYS.has(key)))}
function companyNameFromUrl(value){try{return new URL(value).hostname.replace(/^www\./,"").split(".")[0].replace(/[-_]+/g," ")}catch{return ""}}
function validDate(value){const date=new Date(value||Date.now());return Number.isNaN(date.getTime())?new Date().toISOString():date.toISOString()}
function randomToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,item=>item.toString(16).padStart(2,"0")).join("")}
async function hash(value){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),item=>item.toString(16).padStart(2,"0")).join("")}
async function equalHash(expected,token){const actual=await hash(token);if(actual.length!==String(expected).length)return false;let difference=0;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^String(expected).charCodeAt(i);return difference===0}
async function safeDb(env,sql,values){if(!env.DB)return;await env.DB.prepare(sql).bind(...values).run()}
async function responseJsonWithinLimit(response,maxBytes){
  const declared=Number(response.headers.get("content-length")||0);
  if(Number.isFinite(declared)&&declared>maxBytes)throw new Error("Provider response too large");
  if(!response.body)return null;
  const reader=response.body.getReader();const decoder=new TextDecoder();let total=0,text="";
  while(true){
    const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;
    if(total>maxBytes){await reader.cancel().catch(()=>{});throw new Error("Provider response too large")}
    text+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(text+decoder.decode());
}
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:HEADERS})}

export const __test={EVENTS,providerReady,externalProviderReady,hash,equalHash};
