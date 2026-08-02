const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const VIDEO_MAX_BYTES=24*1024*1024;
const QR_MAX_BYTES=8*1024*1024;
const ACTIVATION_TTL_MS=10*60*1000;
const ACTIVATION_RESEND_MS=60*1000;
const ACTIVATION_DAILY_LIMIT=50;
const MAX_CODE_ATTEMPTS=5;
const LOCKED_CABINET_SHA="ee1f3b869c2b8e9b7ac747e33d62de20a7904b3ed6fcacf7e87bbfeec61bdfb3";
const LOCKED_COIN_SHA="3fd636fe3763b95a09bc8f6be470361ddf0a49e7772464d1a5292fa7c7674e8a";

export async function handleBarPublisher(request,env,url){
  if(!hasPublisherBindings(env))return json({ok:false,error:"Automatic venue publishing is not configured."},503);
  const path=url.pathname.replace(/^\/api\/bar-publisher\/?/,"");
  if(path==="activation/start"&&request.method==="POST")return startActivation(request,env);
  if(path==="activation/complete"&&request.method==="POST")return completeActivation(request,env);
  const device=await authorizePublisher(request,env);
  if(!device)return json({ok:false,error:"Secure publisher activation is required.",code:"publisher_activation_required"},401);
  if(path==="session"&&request.method==="GET")return json({ok:true,active:true,installationId:device.installation_id});
  if(path==="publications"&&request.method==="POST")return preparePublication(request,env,device,url);
  const match=path.match(/^publications\/(barjob_[a-f0-9-]+)(?:\/(video|qr|commit|rollback))?$/);
  if(!match)return json({ok:false,error:"Publisher route not found."},404);
  const job=await ownedJob(env,match[1],device.installation_id);
  if(!job)return json({ok:false,error:"Publication job not found."},404);
  const action=match[2]||"status";
  if(action==="status"&&request.method==="GET")return json({ok:true,job:publicJob(job)});
  if(action==="video"&&request.method==="PUT")return uploadVideo(request,env,job);
  if(action==="qr"&&request.method==="PUT")return uploadQr(request,env,job);
  if(action==="commit"&&request.method==="POST")return commitPublication(env,job);
  if(action==="rollback"&&request.method==="POST")return rollbackPublication(env,job,"client_verification_failed","Studio could not verify the live publication.");
  return json({ok:false,error:"Publisher method not allowed."},405);
}

export async function handleBarPublicAsset(request,env,url){
  if(!env.DB||!env.BAR_ASSETS)return null;
  const configMatch=url.pathname.match(/^\/api\/bar-editions\/(dc_[a-f0-9]{10})\/config$/);
  if(configMatch&&["GET","HEAD"].includes(request.method)){
    const row=await env.DB.prepare("SELECT config_json FROM bar_editions WHERE edition_id=?1 AND status='active'").bind(configMatch[1]).first();
    if(!row)return new Response("Unknown Deep Cuts edition",{status:404});
    return new Response(request.method==="HEAD"?null:row.config_json,{headers:{...JSON_HEADERS,"cache-control":"public, max-age=60"}});
  }
  const videoMatch=url.pathname.match(/^\/api\/bar-assets\/(dc_[a-f0-9]{10})\/video$/);
  if(videoMatch&&["GET","HEAD"].includes(request.method))return serveBarObject(request,env,videoMatch[1],"video");
  const qrMatch=url.pathname.match(/^\/output\/(bar-[a-z0-9-]+)\/instagram-qr\.png$/);
  if(qrMatch&&["GET","HEAD"].includes(request.method)){
    const row=await env.DB.prepare("SELECT qr_key FROM bar_editions WHERE slug=?1 AND status='active'").bind(qrMatch[1]).first();
    if(!row)return new Response("QR artwork not found",{status:404});
    return serveR2Object(request,env.BAR_ASSETS,row.qr_key,"image/png");
  }
  return null;
}

export async function augmentPlatformManifest(staticResponse,env){
  if(!env.DB||!staticResponse.ok)return staticResponse;
  const contentType=staticResponse.headers.get("content-type")||"";
  if(!contentType.includes("json"))return staticResponse;
  let platform;try{platform=await staticResponse.json()}catch{return staticResponse}
  let rows;try{rows=await env.DB.prepare("SELECT edition_id,slug,venue_name FROM bar_editions WHERE status='active' ORDER BY created_at").all()}catch(error){console.warn("bar-edition-manifest-unavailable",error?.message||error);return json(platform,staticResponse.status,{"cache-control":"no-store"})}
  const existing=new Set((platform.editions||[]).map(item=>item.editionId));
  for(const row of rows.results||[])if(!existing.has(row.edition_id))platform.editions.push({
    slug:row.slug,editionId:row.edition_id,canonicalPath:`/e/${row.edition_id}`,name:row.venue_name,
    config:`api/bar-editions/${row.edition_id}/config`,active:true,dynamic:true
  });
  return json(platform,200,{"cache-control":"no-store"});
}

export async function handleBarDeliveryEvent(env,{body,tags,occurredAt}){
  if(tags.job_type!=="bar_edition"||!tags.job_id)return false;
  const job=await env.DB.prepare("SELECT * FROM bar_publication_jobs WHERE job_id=?1").bind(clean(tags.job_id,100)).first();
  if(!job)return true;
  if(body.type==="email.delivered"){
    await env.DB.batch([
      env.DB.prepare("UPDATE bar_publication_jobs SET status='published',stage='published',completed_at=?1,updated_at=?1,error_code=NULL,error_message=NULL WHERE job_id=?2").bind(occurredAt,job.job_id),
      env.DB.prepare("UPDATE bar_editions SET status='active',updated_at=?1 WHERE edition_id=?2 AND current_job_id=?3").bind(occurredAt,job.edition_id,job.job_id),
      env.DB.prepare("UPDATE editions SET status='active',updated_at=?1 WHERE edition_id=?2").bind(occurredAt,job.edition_id),
      env.DB.prepare("UPDATE production_jobs SET email_delivered_at=?1,status='completed',completed_at=?1,updated_at=?1 WHERE job_id=?2").bind(occurredAt,job.job_id)
    ]);
  }else if(["email.bounced","email.failed","email.complained"].includes(body.type)){
    await rollbackPublication(env,job,"email_delivery_failed",`Completion email reported ${body.type}.`);
  }
  return true;
}

async function startActivation(request,env){
  const body=await safeJson(request),installationId=installation(body?.installation_id);
  if(!installationId)return json({ok:false,error:"Invalid Studio installation identity."},400);
  if(!env.RESEND_API_KEY||!env.REPORT_RECIPIENT||!env.REPORT_FROM_EMAIL||!env.ADMIN_TOKEN)return json({ok:false,error:"Publisher activation email is not configured."},503);
  const now=new Date(),nowIso=now.toISOString();
  const existing=await env.DB.prepare("SELECT requested_at FROM bar_publisher_activations WHERE installation_id=?1").bind(installationId).first();
  if(existing&&now.getTime()-new Date(existing.requested_at).getTime()<ACTIVATION_RESEND_MS)return json({ok:false,error:"An activation code was already sent. Please check your email.",code:"activation_rate_limited"},429);
  const since=new Date(now.getTime()-86400000).toISOString();
  const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM bar_publisher_activations WHERE requested_at>=?1").bind(since).first();
  if(Number(count?.total||0)>=ACTIVATION_DAILY_LIMIT)return json({ok:false,error:"The secure activation limit has been reached. Try again tomorrow."},429);
  const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0");
  const codeHash=await keyedHash(env,`activation:${installationId}:${code}`),expiresAt=new Date(now.getTime()+ACTIVATION_TTL_MS).toISOString();
  await env.DB.prepare(`INSERT INTO bar_publisher_activations (installation_id,code_hash,status,attempts,requested_at,expires_at,email_id,updated_at)
    VALUES (?1,?2,'pending',0,?3,?4,NULL,?3)
    ON CONFLICT(installation_id) DO UPDATE SET code_hash=excluded.code_hash,status='pending',attempts=0,requested_at=excluded.requested_at,expires_at=excluded.expires_at,email_id=NULL,updated_at=excluded.updated_at`)
    .bind(installationId,codeHash,nowIso,expiresAt).run();
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,"content-type":"application/json","idempotency-key":`bar-publisher-activation-${installationId}-${Math.floor(now.getTime()/ACTIVATION_RESEND_MS)}`},body:JSON.stringify({
    from:env.REPORT_FROM_EMAIL,to:[env.REPORT_RECIPIENT],subject:"Deep Cuts Studio publishing activation code",
    html:`<p>Enter this one-time code in Deep Cuts Studio:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px">${code}</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`,
    tags:[{name:"job_type",value:"bar_publisher_activation"},{name:"installation",value:installationId.slice(-16)}]
  })});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){await env.DB.prepare("DELETE FROM bar_publisher_activations WHERE installation_id=?1").bind(installationId).run();return json({ok:false,error:"The activation email could not be sent."},502)}
  await env.DB.prepare("UPDATE bar_publisher_activations SET email_id=?1,updated_at=?2 WHERE installation_id=?3").bind(clean(result.id,160),nowIso,installationId).run();
  return json({ok:true,pending:true,expiresAt,recipientHint:maskEmail(env.REPORT_RECIPIENT)});
}

async function completeActivation(request,env){
  const body=await safeJson(request),installationId=installation(body?.installation_id),code=String(body?.code||"").trim();
  if(!installationId||!/^\d{6}$/.test(code))return json({ok:false,error:"Enter the six-digit activation code."},400);
  const record=await env.DB.prepare("SELECT * FROM bar_publisher_activations WHERE installation_id=?1").bind(installationId).first();
  if(!record||record.status!=="pending"||new Date(record.expires_at).getTime()<Date.now())return json({ok:false,error:"The activation code has expired. Request a new one."},400);
  if(Number(record.attempts||0)>=MAX_CODE_ATTEMPTS)return json({ok:false,error:"Too many incorrect attempts. Request a new activation code."},429);
  const expected=await keyedHash(env,`activation:${installationId}:${code}`);
  if(!constantTimeText(expected,record.code_hash)){
    await env.DB.prepare("UPDATE bar_publisher_activations SET attempts=attempts+1,updated_at=?1 WHERE installation_id=?2").bind(new Date().toISOString(),installationId).run();
    return json({ok:false,error:"That activation code is not correct."},400);
  }
  const token=`bpub_${randomToken(32)}`,tokenHash=await keyedHash(env,`token:${installationId}:${token}`),now=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO bar_publisher_devices (installation_id,token_hash,status,app_version,created_at,last_used_at) VALUES (?1,?2,'active',?3,?4,?4)
      ON CONFLICT(installation_id) DO UPDATE SET token_hash=excluded.token_hash,status='active',app_version=excluded.app_version,last_used_at=excluded.last_used_at`).bind(installationId,tokenHash,clean(body?.app_version,40),now),
    env.DB.prepare("UPDATE bar_publisher_activations SET status='used',updated_at=?1 WHERE installation_id=?2").bind(now,installationId)
  ]);
  return json({ok:true,token,installationId});
}

async function preparePublication(request,env,device,url){
  const manifest=validateManifest(await safeJson(request));
  if(!manifest.ok)return json({ok:false,error:manifest.error,code:"publication_not_ready"},400);
  const inFlight=await env.DB.prepare("SELECT job_id FROM bar_publication_jobs WHERE master_id=?1 AND status IN ('prepared','video_uploaded','qr_uploaded','awaiting_delivery') ORDER BY created_at DESC LIMIT 1").bind(manifest.value.masterId).first();
  if(inFlight)return json({ok:false,error:"This venue already has a publication in progress. Wait for it to finish before trying again.",code:"publication_in_progress"},409);
  const now=new Date().toISOString(),existing=await env.DB.prepare("SELECT * FROM bar_editions WHERE master_id=?1").bind(manifest.value.masterId).first();
  const editionId=existing?.edition_id||await uniqueEditionId(env),slug=existing?.slug||stableSlug(manifest.value.masterId),jobId=`barjob_${crypto.randomUUID()}`;
  const baseUrl=url.origin,videoKey=`bar/${editionId}/${jobId}/welcome.mp4`,qrKey=`bar/${editionId}/${jobId}/qr.png`;
  await env.DB.prepare(`INSERT INTO bar_publication_jobs (job_id,installation_id,master_id,edition_id,slug,venue_name,status,stage,manifest_json,previous_record_json,base_url,video_key,qr_key,video_sha256,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,'prepared','prepared',?7,?8,?9,?10,?11,?12,?13,?13)`)
    .bind(jobId,device.installation_id,manifest.value.masterId,editionId,slug,manifest.value.venueName,JSON.stringify(manifest.value),existing?JSON.stringify(existing):null,baseUrl,videoKey,qrKey,manifest.value.video.sha256,now).run();
  return json({ok:true,job:publicJob({job_id:jobId,edition_id:editionId,slug,venue_name:manifest.value.venueName,status:"prepared",stage:"prepared",base_url:baseUrl,updated_at:now}),qrPayload:`${baseUrl}/q/${editionId}`});
}

async function uploadVideo(request,env,job){
  if(!["prepared","video_uploaded"].includes(job.status))return json({ok:false,error:"The publication is not accepting a video."},409);
  const expected=JSON.parse(job.manifest_json).video,length=contentLength(request);
  if(length<=0||length>VIDEO_MAX_BYTES||length!==Number(expected.sizeBytes))return json({ok:false,error:"The MP4 size does not match the validated manifest."},400);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.length!==length||!isMp4(bytes))return json({ok:false,error:"The welcome video is not a valid MP4."},400);
  const sha=await sha256(bytes);if(sha!==expected.sha256)return json({ok:false,error:"The MP4 failed its SHA-256 identity check."},400);
  await env.BAR_ASSETS.put(job.video_key,bytes,{httpMetadata:{contentType:"video/mp4",cacheControl:"public, max-age=31536000, immutable"},customMetadata:{sha256:sha,jobId:job.job_id,editionId:job.edition_id}});
  const now=new Date().toISOString();await env.DB.prepare("UPDATE bar_publication_jobs SET status='video_uploaded',stage='video_uploaded',updated_at=?1 WHERE job_id=?2").bind(now,job.job_id).run();
  return json({ok:true,stage:"video_uploaded"});
}

async function uploadQr(request,env,job){
  if(!["video_uploaded","qr_uploaded"].includes(job.status))return json({ok:false,error:"Upload the validated MP4 before the QR artwork."},409);
  const length=contentLength(request);if(length<=0||length>QR_MAX_BYTES)return json({ok:false,error:"The QR PNG exceeds the secure upload limit."},400);
  const bytes=new Uint8Array(await request.arrayBuffer()),payload=request.headers.get("x-deep-cuts-qr-payload")||"",proof=request.headers.get("x-deep-cuts-qr-scan-proof")||"";
  if(!isPng(bytes,1920,1080))return json({ok:false,error:"The permanent QR artwork must be a 1920 x 1080 PNG."},400);
  if(payload!==`${job.base_url}/q/${job.edition_id}`||proof!=="rendered-matrix:full+960x540")return json({ok:false,error:"The QR scan-back proof does not match this opaque edition route."},400);
  const sha=await sha256(bytes),claimed=String(request.headers.get("x-content-sha256")||"").toLowerCase();if(claimed!==sha)return json({ok:false,error:"The QR artwork failed its SHA-256 identity check."},400);
  await env.BAR_ASSETS.put(job.qr_key,bytes,{httpMetadata:{contentType:"image/png",cacheControl:"public, max-age=31536000, immutable"},customMetadata:{sha256:sha,payload,scanProof:proof,jobId:job.job_id,editionId:job.edition_id}});
  const now=new Date().toISOString();await env.DB.prepare("UPDATE bar_publication_jobs SET status='qr_uploaded',stage='qr_uploaded',qr_sha256=?1,updated_at=?2 WHERE job_id=?3").bind(sha,now,job.job_id).run();
  return json({ok:true,stage:"qr_uploaded",sha256:sha});
}

async function commitPublication(env,inputJob){
  const job=await env.DB.prepare("SELECT * FROM bar_publication_jobs WHERE job_id=?1").bind(inputJob.job_id).first();
  if(job.status!=="qr_uploaded")return json({ok:false,error:"The validated MP4 and QR artwork are required before publication."},409);
  const [video,qr]=await Promise.all([env.BAR_ASSETS.head(job.video_key),env.BAR_ASSETS.head(job.qr_key)]);
  if(!video||video.customMetadata?.sha256!==job.video_sha256||!qr||qr.customMetadata?.sha256!==job.qr_sha256)return rollbackPublication(env,job,"asset_verification_failed","Stored publication assets did not pass identity verification.");
  const manifest=JSON.parse(job.manifest_json),now=new Date().toISOString(),config=buildConfig(job,manifest);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO bar_editions (edition_id,master_id,slug,venue_name,config_json,video_key,qr_key,status,current_job_id,created_at,updated_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,'active',?8,?9,?9)
      ON CONFLICT(edition_id) DO UPDATE SET venue_name=excluded.venue_name,config_json=excluded.config_json,video_key=excluded.video_key,qr_key=excluded.qr_key,status='active',current_job_id=excluded.current_job_id,updated_at=excluded.updated_at`)
      .bind(job.edition_id,job.master_id,job.slug,job.venue_name,JSON.stringify(config),job.video_key,job.qr_key,job.job_id,now),
    env.DB.prepare(`INSERT INTO editions (edition_id,band_name,config_path,canonical_path,status,deployed_at,commit_sha,created_at,updated_at)
      VALUES (?1,?2,?3,?4,'active',?5,NULL,?5,?5)
      ON CONFLICT(edition_id) DO UPDATE SET band_name=excluded.band_name,config_path=excluded.config_path,canonical_path=excluded.canonical_path,status='active',deployed_at=excluded.deployed_at,updated_at=excluded.updated_at`)
      .bind(job.edition_id,job.venue_name,`api/bar-editions/${job.edition_id}/config`,`/e/${job.edition_id}`,now),
    env.DB.prepare(`INSERT INTO production_jobs (job_id,edition_id,band_name,status,submitted_at,research_completed_at,validation_completed_at,deployed_at,updated_at)
      VALUES (?1,?2,?3,'deployed',?4,?4,?4,?4,?4)
      ON CONFLICT(job_id) DO UPDATE SET status='deployed',validation_completed_at=?4,deployed_at=?4,updated_at=?4`).bind(job.job_id,job.edition_id,job.venue_name,now),
    env.DB.prepare("UPDATE bar_publication_jobs SET status='awaiting_delivery',stage='email_delivery',updated_at=?1 WHERE job_id=?2").bind(now,job.job_id)
  ]);
  const qrObject=await env.BAR_ASSETS.get(job.qr_key),qrBytes=new Uint8Array(await qrObject.arrayBuffer());
  const email=await sendCompletionEmail(env,job,qrBytes);
  if(!email.ok)return rollbackPublication(env,{...job,status:"awaiting_delivery"},"email_request_failed",email.error);
  await env.DB.batch([
    env.DB.prepare("UPDATE bar_publication_jobs SET email_id=?1,updated_at=?2 WHERE job_id=?3").bind(email.id,now,job.job_id),
    env.DB.prepare("UPDATE production_jobs SET status='email_accepted',email_accepted_at=?1,updated_at=?1 WHERE job_id=?2").bind(now,job.job_id)
  ]);
  return json({ok:true,job:publicJob({...job,status:"awaiting_delivery",stage:"email_delivery",email_id:email.id,updated_at:now})},202);
}

async function sendCompletionEmail(env,job,qrBytes){
  if(!env.RESEND_API_KEY||!env.REPORT_RECIPIENT||!env.REPORT_FROM_EMAIL)return{ok:false,error:"Completion email is not configured."};
  const liveUrl=`${job.base_url}/e/${job.edition_id}`;
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,"content-type":"application/json","idempotency-key":`bar-edition-${job.job_id}`},body:JSON.stringify({
    from:env.REPORT_FROM_EMAIL,to:[env.REPORT_RECIPIENT],subject:`JookBox venue published: ${clean(job.venue_name,200)}`,
    html:`<p>The JookBox venue edition for <strong>${escapeHtml(job.venue_name)}</strong> passed validation and is live.</p><p><a href="${escapeHtml(liveUrl)}">Open the live venue</a></p><p>The permanent scan-tested QR artwork is attached.</p>`,
    attachments:[{content:bytesBase64(qrBytes),filename:`${job.slug}-jookbox-qr.png`}],
    tags:[{name:"job_id",value:job.job_id},{name:"edition_id",value:job.edition_id},{name:"job_type",value:"bar_edition"}]
  })});
  const result=await response.json().catch(()=>({}));return response.ok?{ok:true,id:clean(result.id,160)}:{ok:false,error:"Completion email was rejected."};
}

async function rollbackPublication(env,job,code,message){
  const previous=job.previous_record_json?JSON.parse(job.previous_record_json):null,now=new Date().toISOString(),statements=[];
  if(previous){
    statements.push(env.DB.prepare("UPDATE bar_editions SET venue_name=?1,config_json=?2,video_key=?3,qr_key=?4,status=?5,current_job_id=?6,updated_at=?7 WHERE edition_id=?8").bind(previous.venue_name,previous.config_json,previous.video_key,previous.qr_key,previous.status,previous.current_job_id,now,job.edition_id));
    statements.push(env.DB.prepare("UPDATE editions SET band_name=?1,config_path=?2,canonical_path=?3,status='active',updated_at=?4 WHERE edition_id=?5").bind(previous.venue_name,`api/bar-editions/${job.edition_id}/config`,`/e/${job.edition_id}`,now,job.edition_id));
  }else{
    statements.push(env.DB.prepare("DELETE FROM bar_editions WHERE edition_id=?1 AND current_job_id=?2").bind(job.edition_id,job.job_id));
    statements.push(env.DB.prepare("UPDATE editions SET status='inactive',updated_at=?1 WHERE edition_id=?2").bind(now,job.edition_id));
  }
  statements.push(env.DB.prepare("UPDATE bar_publication_jobs SET status='failed',stage='failed',error_code=?1,error_message=?2,updated_at=?3,completed_at=?3 WHERE job_id=?4").bind(code,clean(message,600),now,job.job_id));
  statements.push(env.DB.prepare("UPDATE production_jobs SET status='failed',failure_stage='publication',failure_message=?1,updated_at=?2 WHERE job_id=?3").bind(clean(message,500),now,job.job_id));
  await env.DB.batch(statements);
  return json({ok:false,error:message,code,job:publicJob({...job,status:"failed",stage:"failed",error_code:code,error_message:message,updated_at:now})},409);
}

async function serveBarObject(request,env,editionId,kind){
  const column=kind==="video"?"video_key":"qr_key";
  const row=await env.DB.prepare(`SELECT ${column} AS object_key FROM bar_editions WHERE edition_id=?1 AND status='active'`).bind(editionId).first();
  if(!row)return new Response("Unknown Deep Cuts edition",{status:404});
  return serveR2Object(request,env.BAR_ASSETS,row.object_key,kind==="video"?"video/mp4":"image/png");
}

async function serveR2Object(request,bucket,key,fallbackType){
  const range=parseRange(request.headers.get("range"));
  const object=await bucket.get(key,range?{range}:undefined);if(!object)return new Response("Asset not found",{status:404});
  const headers=new Headers();object.writeHttpMetadata?.(headers);headers.set("content-type",headers.get("content-type")||fallbackType);headers.set("etag",object.httpEtag);headers.set("accept-ranges","bytes");headers.set("x-content-type-options","nosniff");
  if(request.method==="HEAD")return new Response(null,{status:200,headers});
  if(object.range){headers.set("content-range",`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);headers.set("content-length",String(object.range.length));return new Response(object.body,{status:206,headers})}
  headers.set("content-length",String(object.size));return new Response(object.body,{headers});
}

async function authorizePublisher(request,env){
  const installationId=installation(request.headers.get("x-deep-cuts-installation-id")),value=request.headers.get("authorization")||"",token=value.startsWith("Bearer ")?value.slice(7):"";
  if(!installationId||!/^bpub_[A-Za-z0-9_-]{43}$/.test(token))return null;
  const hash=await keyedHash(env,`token:${installationId}:${token}`),device=await env.DB.prepare("SELECT installation_id,status FROM bar_publisher_devices WHERE installation_id=?1 AND token_hash=?2 AND status='active'").bind(installationId,hash).first();
  if(device)await env.DB.prepare("UPDATE bar_publisher_devices SET last_used_at=?1 WHERE installation_id=?2").bind(new Date().toISOString(),installationId).run();
  return device||null;
}

async function ownedJob(env,jobId,installationId){return env.DB.prepare("SELECT * FROM bar_publication_jobs WHERE job_id=?1 AND installation_id=?2").bind(jobId,installationId).first()}
function buildConfig(job,manifest){const timestamp=new Date().toISOString(),about=manifest.aboutText,name=manifest.venueName,liveUrl=`${job.base_url}/e/${job.edition_id}`;return{
  brandName:"Bar Edition",editionType:"bar_jukebox",bandName:name,editionTitle:name,description:about.slice(0,190),discovery:{bio:about.slice(0,190),newsLabel:""},mode:"discovery",slug:job.slug,publicURL:liveUrl,characterArtwork:"",backgroundArtwork:"",
  social:{copyright:"copyright Clearlight Creative",instagramImage:`output/${job.slug}/instagram-qr.png`,qrImage:`output/${job.slug}/instagram-qr.png`},theme:{accent:"#55D9FF",accentSecondary:"#FF6640",gold:"#FFD66B",surface:"#091321"},links:{},analytics:{editionId:job.edition_id,pageIdentifier:`${job.edition_id}:bar-jukebox-v1`},production:{jobId:job.job_id,submittedAt:job.created_at,researchCompletedAt:job.created_at,editionCreatedAt:timestamp,updatedAt:timestamp},
  barJookBox:{modelVersion:"bar-jukebox/1",layoutVersion:"coin-awakening/1",appearanceVariant:"atlas-reference-cabinet/1",keyBankFormat:"bar-six-key/1",contentMode:"administrator-static",webLookupAllowed:false,sourceMasterId:manifest.masterId,venueName:name,tickerText:manifest.tickerText,aboutText:about,localWelcomeVideo:`/api/bar-assets/${job.edition_id}/video`,localWelcomeVideoSha256:manifest.video.sha256,actions:manifest.actions,cabinetArtwork:"assets/jookbox-atlas-reference-v1.webp",cabinetArtworkSha256:LOCKED_CABINET_SHA,coinSound:"assets/audio/jukebox-real-coin-insert-cc0.mp3",coinSoundSha256:LOCKED_COIN_SHA,coinSoundSource:"https://freesound.org/s/696745/",coinSoundLicense:"CC0-1.0",sessionStorageKey:`barJookBoxActivated:${job.edition_id}`,tickerDurationSeconds:34,buttonLightDurationMs:1100,autoplayDelayMs:0,startupTimingsMs:{mechanism:120,neonOn:800,screenOn:1200,buttonsOn:1600,tickerOn:2000},lightSequence:true,lightSequenceMode:"single-key",coinStart:true,cabinetCopyright:"Copyright Clearlight Creative 2026.",contentStatus:"administrator-approved",venueDescription:about,address:manifest.address||"",supportAction:{action:"share",label:"SHARE",detail:"",kind:"share",icon:"",detailIcon:""}}
}}
function validateManifest(body){const masterId=clean(body?.masterId,80),venueName=clean(body?.venueName,120),tickerText=multiline(body?.tickerText,500),aboutText=multiline(body?.aboutText,1200),address=clean(body?.address,400),actions=Array.isArray(body?.actions)?body.actions:[],video=body?.video||{};if(!/^Aggits_\d{3}$/i.test(masterId))return{ok:false,error:"A valid immutable Master ID is required."};if(!venueName||!tickerText||!aboutText)return{ok:false,error:"Venue name, ticker and About Us copy are required."};if(actions.length!==5)return{ok:false,error:"Exactly five administrator-supplied destinations are required."};const cleanActions=[];for(const item of actions){const url=safeHttps(item?.url);if(!url)return{ok:false,error:"Every destination must be a complete public HTTPS URL."};cleanActions.push({id:clean(item?.id,40),label:clean(item?.label,40),url,detail:clean(item?.detail,80)})}if(!Number.isInteger(Number(video.sizeBytes))||Number(video.sizeBytes)<=0||Number(video.sizeBytes)>VIDEO_MAX_BYTES||!/^[a-f0-9]{64}$/.test(String(video.sha256||"")))return{ok:false,error:"The MP4 must be 24 MiB or smaller and have a valid SHA-256 identity."};return{ok:true,value:{schemaVersion:"deep-cuts-bar-publication/2",masterId,venueName,tickerText,aboutText,address,actions:cleanActions,video:{sizeBytes:Number(video.sizeBytes),sha256:String(video.sha256).toLowerCase(),fileName:clean(video.fileName,180)}}}}
function publicJob(job){return{id:job.job_id,editionId:job.edition_id,slug:job.slug,venueName:job.venue_name,status:job.status,stage:job.stage,liveUrl:job.base_url&&job.edition_id?`${job.base_url}/e/${job.edition_id}`:"",qrImageUrl:job.base_url&&job.slug?`${job.base_url}/output/${job.slug}/instagram-qr.png`:"",qrPayload:job.base_url&&job.edition_id?`${job.base_url}/q/${job.edition_id}`:"",emailId:job.email_id||"",errorCode:job.error_code||"",error:job.error_message||"",updatedAt:job.updated_at||""}}
function hasPublisherBindings(env){return Boolean(env.DB&&env.BAR_ASSETS&&env.ADMIN_TOKEN)}
async function uniqueEditionId(env){for(let attempt=0;attempt<20;attempt++){const id=`dc_${randomHex(5)}`,found=await env.DB.prepare("SELECT edition_id FROM editions WHERE edition_id=?1").bind(id).first();if(!found)return id}throw new Error("Could not allocate an opaque edition ID.")}
async function keyedHash(env,value){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(env.ADMIN_TOKEN)),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return bytesHex(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))))}
async function sha256(bytes){return bytesHex(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)))}
function constantTimeText(left,right){const a=new TextEncoder().encode(String(left)),b=new TextEncoder().encode(String(right));return a.length===b.length&&crypto.subtle.timingSafeEqual(a,b)}
function randomToken(length){const bytes=crypto.getRandomValues(new Uint8Array(length));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function randomHex(length){return bytesHex(crypto.getRandomValues(new Uint8Array(length)))}
function bytesHex(bytes){return[...bytes].map(byte=>byte.toString(16).padStart(2,"0")).join("")}
function bytesBase64(bytes){let result="";for(let offset=0;offset<bytes.length;offset+=0x8000){let part="";for(const byte of bytes.subarray(offset,offset+0x8000))part+=String.fromCharCode(byte);result+=part}return btoa(result)}
function installation(value){const text=String(value||"").trim();return /^studio_[a-f0-9]{32}$/.test(text)?text:""}
function stableSlug(value){return`bar-${String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,28)}`}
function safeHttps(value){try{const url=new URL(String(value||""));if(url.protocol!=="https:"||url.username||url.password||blockedHost(url.hostname))return"";url.hash="";return url.href}catch{return""}}
function blockedHost(host){const value=String(host||"").toLowerCase();return value==="localhost"||value.endsWith(".local")||value.startsWith("127.")||value.startsWith("10.")||value.startsWith("192.168.")||/^172\.(?:1[6-9]|2\d|3[01])\./.test(value)}
function contentLength(request){const value=Number(request.headers.get("content-length")||0);return Number.isSafeInteger(value)?value:0}
function isMp4(bytes){return bytes.length>=12&&String.fromCharCode(...bytes.subarray(4,8))==="ftyp"}
function isPng(bytes,width,height){if(bytes.length<24||bytes[0]!==0x89||bytes[1]!==0x50||bytes[2]!==0x4e||bytes[3]!==0x47)return false;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return view.getUint32(16)===width&&view.getUint32(20)===height}
function parseRange(value){const match=String(value||"").match(/^bytes=(\d+)-(\d*)$/);if(!match)return null;const offset=Number(match[1]),end=match[2]?Number(match[2]):null;if(!Number.isSafeInteger(offset)||offset<0||end!==null&&(!Number.isSafeInteger(end)||end<offset))return null;return end===null?{offset}:{offset,length:end-offset+1}}
function maskEmail(value){const [local,domain]=String(value||"").split("@");return local&&domain?`${local.slice(0,2)}***@${domain}`:"the configured owner email"}
function clean(value,max=200){return String(value||"").trim().replace(/\s+/g," ").slice(0,max)}
function multiline(value,max){return String(value||"").trim().replace(/\r\n?/g,"\n").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").slice(0,max)}
function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function json(body,status=200,extraHeaders={}){return new Response(JSON.stringify(body),{status,headers:{...JSON_HEADERS,...extraHeaders}})}
async function safeJson(request){try{return await request.json()}catch{return null}}

export const __test={validateManifest,buildConfig,publicJob,isPng,stableSlug,constantTimeText};
