import {handleRacingRequest,reconcilePendingResults} from "./racing.js";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const EVENT_NAMES=new Set([
  "qr_scan","discovery_page_viewed","share_button_clicked","share_method_selected",
  "native_share_completed","copy_link_clicked","copy_link_completed","outbound_clicked"
]);
const DESTINATIONS=new Set([
  "buy_music","spotify","instagram","bandcamp","youtube","facebook","website",
  "merchandise","tip","news_reviews","share"
]);
const BUILD_STAGES=new Set([
  "submitted","research_started","research_completed","artwork_completed",
  "validation_completed","deployed","email_accepted","email_delivered","failed"
]);

export default {
  async fetch(request,env,ctx){
    try{
      const url=new URL(request.url);
      if(request.method==="OPTIONS")return cors(new Response(null,{status:204}),request,env);
      if(url.pathname.startsWith("/api/racing/"))return handleRacingRequest(request,env,url);
      if(url.pathname.startsWith("/q/"))return handleQr(request,env,ctx,url);
      if(url.pathname==="/api/events"&&request.method==="POST")return handleEvent(request,env);
      if(url.pathname==="/api/editions"&&request.method==="POST")return handleEdition(request,env);
      if(url.pathname==="/api/builds"&&request.method==="POST")return handleBuild(request,env);
      if(url.pathname.startsWith("/api/builds/")&&request.method==="GET")return handleBuildStatus(request,env,url);
      if(url.pathname==="/api/delivery"&&request.method==="POST")return handleDelivery(request,env);
      if(url.pathname==="/api/webhooks/resend"&&request.method==="POST")return handleResendWebhook(request,env);
      if(url.pathname==="/api/reports/weekly.csv"&&request.method==="GET")return handleReport(request,env);
      if(url.pathname==="/api/health")return json({ok:true,service:"deep-cuts",timestamp:new Date().toISOString()});
      return env.ASSETS.fetch(request);
    }catch(error){
      console.error("deep-cuts-worker-error",error);
      return json({ok:false,error:"Internal service error"},500);
    }
  },
  async scheduled(controller,env,ctx){
    ctx.waitUntil(Promise.all([sendWeeklyReportIfDue(controller,env),reconcilePendingResults(env)]));
  }
};

async function handleQr(request,env,ctx,url){
  const editionId=cleanId(url.pathname.split("/").filter(Boolean)[1]);
  if(!editionId)return new Response("Unknown Deep Cuts edition",{status:404});
  const edition=await env.DB.prepare("SELECT edition_id, canonical_path FROM editions WHERE edition_id=?1 AND status='active'").bind(editionId).first();
  if(!edition)return new Response("Unknown Deep Cuts edition",{status:404});
  const event=baseEvent(request,editionId,"qr_scan",{referring_source:url.searchParams.get("source")||"qr"});
  ctx.waitUntil(insertEvent(env,event));
  const destination=new URL(edition.canonical_path,url.origin);
  destination.searchParams.set("source","qr");
  return Response.redirect(destination.toString(),302);
}

async function handleEvent(request,env){
  const body=await safeJson(request);
  const editionId=cleanId(body?.edition_id);
  const eventName=String(body?.event_name||"");
  if(!editionId||!EVENT_NAMES.has(eventName))return json({ok:false,error:"Invalid analytics event"},400);
  const destination=String(body?.destination_platform||"");
  if(destination&&!DESTINATIONS.has(destination))return json({ok:false,error:"Invalid destination"},400);
  const event=baseEvent(request,editionId,eventName,{
    event_id:cleanText(body.event_id,100),
    occurred_at:validDate(body.timestamp),
    session_id:cleanText(body.session_id,100),
    referring_source:cleanText(body.referring_source,120),
    device_category:cleanText(body.device_category,20),
    destination_platform:destination,
    share_method:cleanText(body.share_method,40),
    metadata_json:JSON.stringify(safeMetadata(body))
  });
  await insertEvent(env,event);
  return cors(json({ok:true}),request,env);
}

async function handleEdition(request,env){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const body=await safeJson(request);
  const editionId=cleanId(body?.edition_id);
  const canonicalPath=String(body?.canonical_path||"");
  if(!editionId||!body?.band_name||canonicalPath!==`/e/${editionId}`)return json({ok:false,error:"Invalid edition"},400);
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO editions (edition_id,band_name,config_path,canonical_path,status,deployed_at,commit_sha,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8)
    ON CONFLICT(edition_id) DO UPDATE SET band_name=excluded.band_name,config_path=excluded.config_path,canonical_path=excluded.canonical_path,status=excluded.status,deployed_at=excluded.deployed_at,commit_sha=excluded.commit_sha,updated_at=excluded.updated_at`)
    .bind(editionId,cleanText(body.band_name,200),cleanText(body.config_path,300),canonicalPath,body.active===false?"inactive":"active",validDate(body.deployed_at),cleanText(body.commit_sha,80)||null,now).run();
  return json({ok:true,edition_id:editionId});
}

async function insertEvent(env,event){
  await env.DB.prepare(`INSERT OR IGNORE INTO analytics_events
    (event_id,edition_id,event_name,occurred_at,received_at,session_id,referring_source,device_category,destination_platform,share_method,country_code,region_code,metadata_json)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`)
    .bind(event.event_id,event.edition_id,event.event_name,event.occurred_at,event.received_at,event.session_id||null,event.referring_source||null,event.device_category||null,event.destination_platform||null,event.share_method||null,event.country_code||null,event.region_code||null,event.metadata_json||null).run();
}

async function handleBuild(request,env){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const body=await safeJson(request);
  const stage=String(body?.stage||"");
  if(!BUILD_STAGES.has(stage)||!body?.job_id||!body?.band_name)return json({ok:false,error:"Invalid production update"},400);
  const now=validDate(body.timestamp);
  const jobId=cleanText(body.job_id,100);
  const existing=await env.DB.prepare("SELECT submitted_at FROM production_jobs WHERE job_id=?1").bind(jobId).first();
  const submittedAt=stage==="submitted"?now:(existing?.submitted_at||validDate(body.submitted_at));
  await env.DB.prepare(`INSERT INTO production_jobs (job_id,edition_id,band_name,status,submitted_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6)
    ON CONFLICT(job_id) DO UPDATE SET edition_id=COALESCE(excluded.edition_id,edition_id),band_name=excluded.band_name,status=excluded.status,updated_at=excluded.updated_at`)
    .bind(jobId,cleanId(body.edition_id)||null,cleanText(body.band_name,200),stage,submittedAt,now).run();
  const column={
    research_started:"research_started_at",research_completed:"research_completed_at",
    artwork_completed:"artwork_completed_at",validation_completed:"validation_completed_at",
    deployed:"deployed_at",email_accepted:"email_accepted_at",email_delivered:"email_delivered_at"
  }[stage];
  if(column)await env.DB.prepare(`UPDATE production_jobs SET ${column}=?1, commit_sha=COALESCE(?2,commit_sha), updated_at=?1 WHERE job_id=?3`).bind(now,cleanText(body.commit_sha,80)||null,jobId).run();
  if(stage==="email_delivered")await completeJob(env,jobId,now);
  if(stage==="failed")await env.DB.prepare("UPDATE production_jobs SET failure_stage=?1,failure_message=?2,updated_at=?3 WHERE job_id=?4").bind(cleanText(body.failure_stage,80),cleanText(body.failure_message,500),now,jobId).run();
  return json({ok:true,job_id:jobId,stage});
}

async function completeJob(env,jobId,completedAt){
  const row=await env.DB.prepare("SELECT submitted_at FROM production_jobs WHERE job_id=?1").bind(jobId).first();
  const duration=Math.max(0,new Date(completedAt).getTime()-new Date(row?.submitted_at||completedAt).getTime());
  await env.DB.prepare("UPDATE production_jobs SET status='completed',completed_at=?1,total_duration_ms=?2,updated_at=?1 WHERE job_id=?3").bind(completedAt,duration,jobId).run();
}

async function handleBuildStatus(request,env,url){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const jobId=cleanText(decodeURIComponent(url.pathname.slice('/api/builds/'.length)),100);
  if(!jobId)return json({ok:false,error:"Invalid production job"},400);
  const row=await env.DB.prepare("SELECT job_id,edition_id,band_name,status,submitted_at,email_accepted_at,email_delivered_at,completed_at,total_duration_ms,failure_stage,failure_message FROM production_jobs WHERE job_id=?1").bind(jobId).first();
  return row?json({ok:true,...row}):json({ok:false,error:"Production job not found"},404);
}

async function handleDelivery(request,env){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const body=await safeJson(request);
  if(!body?.job_id||!body?.band_name||!body?.live_url||!body?.qr_image_url)return json({ok:false,error:"Missing delivery fields"},400);
  if(!env.RESEND_API_KEY||!env.REPORT_RECIPIENT||!env.REPORT_FROM_EMAIL)return json({ok:false,error:"Email service is not configured"},503);
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,"content-type":"application/json","idempotency-key":`deep-cuts-${cleanText(body.job_id,100)}`},
    body:JSON.stringify({
      from:env.REPORT_FROM_EMAIL,to:[env.REPORT_RECIPIENT],
      subject:`Deep Cuts complete: ${cleanText(body.band_name,200)}`,
      html:`<p>Your Deep Cuts edition for <strong>${escapeHtml(body.band_name)}</strong> is live.</p><p><a href="${escapeHtml(body.live_url)}">Open the artist page</a></p><p>The scan-tested QR artwork is attached.</p>`,
      attachments:[{path:String(body.qr_image_url),filename:`deep-cuts-${cleanId(body.edition_id)||"artist"}-qr.png`}],
      tags:[{name:"job_id",value:cleanText(body.job_id,100)},{name:"edition_id",value:cleanId(body.edition_id)||"unknown"}]
    })
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)return json({ok:false,error:"Email delivery request failed",details:result},502);
  const now=new Date().toISOString();
  await env.DB.prepare("UPDATE production_jobs SET email_accepted_at=?1,updated_at=?1 WHERE job_id=?2").bind(now,cleanText(body.job_id,100)).run();
  return json({ok:true,email_id:result.id});
}

async function handleResendWebhook(request,env){
  if(!env.RESEND_WEBHOOK_SECRET)return json({ok:false,error:"Webhook verification is not configured"},503);
  const payload=await request.text();
  const verified=await verifySvixWebhook(payload,request.headers,env.RESEND_WEBHOOK_SECRET);
  if(!verified)return json({ok:false,error:"Invalid webhook signature"},400);
  let body;
  try{body=JSON.parse(payload)}catch{return json({ok:false,error:"Invalid webhook payload"},400)}
  if(!body?.type||!body?.data?.email_id)return json({ok:false},400);
  const tags=normalizeTags(body.data.tags);
  const jobId=cleanText(tags.job_id,100);
  const eventId=cleanText(request.headers.get("svix-id"),120);
  const occurredAt=validDate(body.created_at);
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO delivery_events (delivery_event_id,email_id,job_id,event_type,occurred_at,received_at) VALUES (?1,?2,?3,?4,?5,?6)").bind(eventId,body.data.email_id,jobId||null,body.type,occurredAt,new Date().toISOString()).run();
  if(Number(inserted.meta?.changes||0)===0)return json({ok:true,duplicate:true});
  if(body.type==="email.delivered"&&jobId){
    await env.DB.prepare("UPDATE production_jobs SET email_delivered_at=?1,updated_at=?1 WHERE job_id=?2").bind(occurredAt,jobId).run();
    await completeJob(env,jobId,occurredAt);
  }
  return json({ok:true});
}

async function verifySvixWebhook(payload,headers,secret){
  const id=headers.get("svix-id");
  const timestamp=headers.get("svix-timestamp");
  const signature=headers.get("svix-signature");
  if(!id||!timestamp||!signature||!/^\d+$/.test(timestamp))return false;
  if(Math.abs(Date.now()-Number(timestamp)*1000)>5*60*1000)return false;
  try{
    const secretBytes=base64Bytes(String(secret).replace(/^whsec_/,""));
    const key=await crypto.subtle.importKey("raw",secretBytes,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const signed=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
    const expected=bytesBase64(new Uint8Array(signed));
    return signature.split(/\s+/).some(item=>{
      const [version,value]=item.split(",",2);
      return version==="v1"&&constantTimeEqual(value||"",expected);
    });
  }catch{return false}
}

function normalizeTags(tags){
  if(!Array.isArray(tags))return tags&&typeof tags==="object"?tags:{};
  return Object.fromEntries(tags.filter(tag=>tag&&tag.name).map(tag=>[tag.name,tag.value]));
}

function base64Bytes(value){
  const binary=atob(value);return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
function bytesBase64(bytes){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}
function constantTimeEqual(left,right){
  if(left.length!==right.length)return false;
  let difference=0;for(let index=0;index<left.length;index++)difference|=left.charCodeAt(index)^right.charCodeAt(index);
  return difference===0;
}

async function handleReport(request,env){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const url=new URL(request.url);
  const days=Math.min(366,Math.max(1,Number(url.searchParams.get("days")||7)));
  return csvResponse(await weeklyRows(env,days),`deep-cuts-${days}-day-report.csv`);
}

async function weeklyRows(env,days=7){
  const since=new Date(Date.now()-days*86400000).toISOString();
  const result=await env.DB.prepare(`SELECT e.edition_id,e.band_name,e.deployed_at,
    SUM(CASE WHEN a.event_name='qr_scan' THEN 1 ELSE 0 END) qr_scans,
    COUNT(DISTINCT CASE WHEN a.event_name='qr_scan' THEN a.session_id END) unique_qr_sessions,
    SUM(CASE WHEN a.event_name='discovery_page_viewed' THEN 1 ELSE 0 END) page_views,
    SUM(CASE WHEN a.event_name='outbound_clicked' THEN 1 ELSE 0 END) outbound_clicks,
    SUM(CASE WHEN a.destination_platform='spotify' THEN 1 ELSE 0 END) spotify_clicks,
    SUM(CASE WHEN a.destination_platform='bandcamp' THEN 1 ELSE 0 END) bandcamp_clicks,
    SUM(CASE WHEN a.destination_platform='instagram' THEN 1 ELSE 0 END) instagram_clicks,
    SUM(CASE WHEN a.destination_platform='youtube' THEN 1 ELSE 0 END) youtube_clicks,
    SUM(CASE WHEN a.destination_platform='facebook' THEN 1 ELSE 0 END) facebook_clicks,
    SUM(CASE WHEN a.destination_platform='website' THEN 1 ELSE 0 END) website_clicks,
    SUM(CASE WHEN a.destination_platform='merchandise' THEN 1 ELSE 0 END) merchandise_clicks,
    SUM(CASE WHEN a.destination_platform='tip' THEN 1 ELSE 0 END) tip_clicks,
    SUM(CASE WHEN a.destination_platform='news_reviews' THEN 1 ELSE 0 END) news_reviews_clicks,
    SUM(CASE WHEN a.event_name LIKE 'share_%' OR a.event_name='native_share_completed' THEN 1 ELSE 0 END) share_actions
    FROM editions e LEFT JOIN analytics_events a ON a.edition_id=e.edition_id AND a.occurred_at>=?1
    WHERE e.status='active' GROUP BY e.edition_id,e.band_name,e.deployed_at ORDER BY e.band_name`).bind(since).all();
  return result.results||[];
}

async function sendWeeklyReportIfDue(controller,env){
  const now=new Date(controller.scheduledTime||Date.now());
  const parts=new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",weekday:"short",hour:"2-digit",hour12:false}).formatToParts(now);
  const weekday=parts.find(item=>item.type==="weekday")?.value;
  const hour=Number(parts.find(item=>item.type==="hour")?.value);
  if(weekday!=="Fri"||hour!==9)return;
  if(!env.RESEND_API_KEY||!env.REPORT_RECIPIENT||!env.REPORT_FROM_EMAIL)return;
  const rows=await weeklyRows(env,7);
  const csv=toCsv(rows);
  await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,"content-type":"application/json","idempotency-key":`deep-cuts-weekly-${now.toISOString().slice(0,10)}`},body:JSON.stringify({from:env.REPORT_FROM_EMAIL,to:[env.REPORT_RECIPIENT],subject:`Deep Cuts weekly report - ${now.toISOString().slice(0,10)}`,html:"<p>Your weekly Deep Cuts analytics report is attached.</p>",attachments:[{content:base64(csv),filename:`deep-cuts-weekly-${now.toISOString().slice(0,10)}.csv`}]})});
}

function baseEvent(request,editionId,eventName,extra={}){
  const cf=request.cf||{};
  return {event_id:extra.event_id||crypto.randomUUID(),edition_id:editionId,event_name:eventName,occurred_at:extra.occurred_at||new Date().toISOString(),received_at:new Date().toISOString(),country_code:cleanText(cf.country,8),region_code:cleanText(cf.regionCode,16),...extra};
}
function authorized(request,env){const value=request.headers.get("authorization")||"";return Boolean(env.ADMIN_TOKEN)&&value===`Bearer ${env.ADMIN_TOKEN}`}
function cleanId(value){const text=String(value||"").trim();return /^[A-Za-z0-9_-]{4,40}$/.test(text)?text:""}
function cleanText(value,max=200){return String(value||"").trim().slice(0,max)}
function validDate(value){const date=new Date(value||Date.now());return Number.isNaN(date.getTime())?new Date().toISOString():date.toISOString()}
async function safeJson(request){try{return await request.json()}catch{return null}}
function safeMetadata(body){const allowed=["page_identifier","action_id","video_id","trigger"];return Object.fromEntries(allowed.filter(key=>body?.[key]!==undefined).map(key=>[key,cleanText(body[key],200)]))}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS})}
function cors(response,request,env){const origin=request.headers.get("origin")||"";const allowed=String(env.ALLOWED_ORIGIN||"");if(allowed&&origin===allowed){response.headers.set("access-control-allow-origin",origin);response.headers.set("vary","origin")}response.headers.set("access-control-allow-methods","POST,OPTIONS");response.headers.set("access-control-allow-headers","content-type");return response}
function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function toCsv(rows){const columns=["edition_id","band_name","deployed_at","qr_scans","unique_qr_sessions","page_views","outbound_clicks","spotify_clicks","bandcamp_clicks","instagram_clicks","youtube_clicks","facebook_clicks","website_clicks","merchandise_clicks","tip_clicks","news_reviews_clicks","share_actions"];return [columns.join(","),...rows.map(row=>columns.map(key=>`"${String(row[key]??"").replaceAll('"','""')}"`).join(","))].join("\r\n")+"\r\n"}
function csvResponse(rows,filename){return new Response(toCsv(rows),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${filename}"`,"cache-control":"no-store"}})}
function base64(text){const bytes=new TextEncoder().encode(text);let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}

export const __test={verifySvixWebhook};

