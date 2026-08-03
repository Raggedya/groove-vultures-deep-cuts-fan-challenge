import crypto from "node:crypto";
import fs from "node:fs/promises";
import {createAggitsJukeboxQrArtwork} from "./aggits-jukebox-qr-artwork.mjs";

export const AGGITS_JUKEBOX_PUBLICATION_SCHEMA="deep-cuts-aggits-jukebox-publication/1";
export const AGGITS_JUKEBOX_PUBLIC_VIDEO_MAX_BYTES=24*1024*1024;
export const DEFAULT_AGGITS_JUKEBOX_PUBLISHER_URL="https://deep-cuts.andrewharris501.workers.dev";

export function aggitsJukeboxPublicationReadiness(project,{videoPath=""}={}){
  const errors=[],input=project?.input||{},actions=(input.actionButtons||[]).filter(item=>item.enabled);
  if(project?.schemaVersion!=="deep-cuts-studio-project/1"||input.type!=="aggits_jukebox")errors.push("Choose the isolated Aggits Jukebox product.");
  if(!/^studio_[a-f0-9]{12}$/.test(String(project?.id||"")))errors.push("A stable Studio project identity is required.");
  if(!String(input.name||"").trim())errors.push("The Jukebox title is required.");
  if(!String(input.tickerText||"").trim())errors.push("Ticker copy is required.");
  if(actions.length<1||actions.length>4)errors.push("Configure between one and four enabled actions.");
  if(actions.some(item=>!item.iconId||!item.label||!item.href))errors.push("Every enabled action requires an approved icon, label and valid destination.");
  if(!project?.mp4||!videoPath)errors.push("A local MP4 is required.");
  if(Number(project?.mp4?.sizeBytes||0)>AGGITS_JUKEBOX_PUBLIC_VIDEO_MAX_BYTES)errors.push("The public MP4 must be 24 MiB or smaller.");
  if(project?.mp4&&!/^[a-f0-9]{64}$/.test(String(project.mp4.sha256||"")))errors.push("The MP4 requires a valid SHA-256 identity.");
  return{ready:errors.length===0,errors,actions};
}

export function buildAggitsJukeboxPublicationManifest(project){
  const ready=aggitsJukeboxPublicationReadiness(project,{videoPath:"stored.mp4"});if(!ready.ready)throw publicationError(ready.errors.join(" "),"publication_not_ready");
  return{schemaVersion:AGGITS_JUKEBOX_PUBLICATION_SCHEMA,projectId:project.id,title:clean(project.input.name,120),tickerText:multiline(project.input.tickerText,500),actions:ready.actions.map((item,index)=>({slot:index+1,iconId:clean(item.iconId,40),label:clean(item.label,32),actionType:clean(item.actionType,12),href:String(item.href),openInNewTab:Boolean(item.openInNewTab)})),video:{fileName:clean(project.mp4.fileName,180),sizeBytes:Number(project.mp4.sizeBytes),sha256:String(project.mp4.sha256).toLowerCase()}};
}

export function createDirectAggitsJukeboxPublisher({serviceUrl=process.env.DEEP_CUTS_PUBLISHER_URL||DEFAULT_AGGITS_JUKEBOX_PUBLISHER_URL,credentialStore,fetchImpl=fetch,sleep=delay,root=process.cwd(),pollMs=2500,maxPolls=300}={}){
  if(!credentialStore)throw new Error("The encrypted Studio publisher credential store is required.");
  const baseUrl=assertServiceUrl(serviceUrl);
  async function identity(){return{installationId:await credentialStore.getInstallationId(),token:await credentialStore.getToken()}}
  async function publish({project,videoPath,onProgress=async()=>{}}={}){
    const current=await identity();if(!current.token)throw publicationError("Secure publishing is not activated on this Windows installation.","publisher_activation_required");
    const readiness=aggitsJukeboxPublicationReadiness(project,{videoPath});if(!readiness.ready)throw publicationError(readiness.errors.join(" "),"publication_not_ready");
    const manifest=buildAggitsJukeboxPublicationManifest(project),video=await fs.readFile(videoPath),sha=crypto.createHash("sha256").update(video).digest("hex");
    if(video.length!==manifest.video.sizeBytes||sha!==manifest.video.sha256)throw publicationError("The stored MP4 failed its size or SHA-256 identity check.","video_identity_mismatch");
    await onProgress("validating","Validating the isolated Jukebox in the protected publisher");
    const prepared=await remoteJson(fetchImpl,`${baseUrl}/api/aggits-jukebox-publisher/publications`,{method:"POST",identity:current,body:manifest}),remoteJob=prepared.job;
    if(!remoteJob?.id||!prepared.qrPayload)throw publicationError("The publishing service did not allocate the permanent edition.","publisher_prepare_invalid");
    try{
      await onProgress("uploading","Uploading the SHA-256 verified MP4",fields(remoteJob));
      await remoteBytes(fetchImpl,`${baseUrl}/api/aggits-jukebox-publisher/publications/${remoteJob.id}/video`,{identity:current,bytes:video,headers:{"content-type":"video/mp4","x-content-sha256":sha}});
      await onProgress("qr","Fitting the title and scan-testing the permanent QR artwork",fields(remoteJob));
      const qr=await createAggitsJukeboxQrArtwork({root,title:manifest.title,destination:prepared.qrPayload});
      await remoteBytes(fetchImpl,`${baseUrl}/api/aggits-jukebox-publisher/publications/${remoteJob.id}/qr`,{identity:current,bytes:qr.bytes,headers:{"content-type":"image/png","x-content-sha256":qr.sha256,"x-deep-cuts-qr-payload":qr.destination,"x-deep-cuts-qr-scan-proof":qr.scanProof}});
      await onProgress("publishing","Publishing the permanent URL and requesting delivery email",fields(remoteJob));
      await remoteJson(fetchImpl,`${baseUrl}/api/aggits-jukebox-publisher/publications/${remoteJob.id}/commit`,{method:"POST",identity:current,body:{}});
      let job=remoteJob;for(let attempt=0;attempt<maxPolls;attempt++){job=(await remoteJson(fetchImpl,`${baseUrl}/api/aggits-jukebox-publisher/publications/${remoteJob.id}`,{identity:current})).job;if(job.status==="published")break;if(job.status==="failed")throw publicationError(job.error||"Publication failed safely.",job.errorCode||"publication_failed");await onProgress("delivery","Waiting for confirmed email delivery",fields(job));await sleep(pollMs)}
      if(job.status!=="published")throw publicationError("Email delivery was not confirmed within the publication window.","delivery_timeout");
      await onProgress("verifying","Verifying the live page, video, QR and configuration",fields(job));await verifyPublicEdition(fetchImpl,job,manifest.title);
      await onProgress("delivered","Permanent URL, scan-tested QR and delivery email confirmed",fields(job));
      return{schemaVersion:AGGITS_JUKEBOX_PUBLICATION_SCHEMA,editionId:job.editionId,slug:job.slug,liveUrl:job.liveUrl,qrImageUrl:job.qrImageUrl,jobId:job.id,deploymentUrl:baseUrl};
    }catch(error){await remoteJson(fetchImpl,`${baseUrl}/api/aggits-jukebox-publisher/publications/${remoteJob.id}/rollback`,{method:"POST",identity:current,body:{}}).catch(()=>{});throw error}
  }
  return{publish};
}

export async function verifyPublicEdition(fetchImpl,job,title){const origin=new URL(job.liveUrl).origin,[page,config,qr,video]=await Promise.all([fetchImpl(`${job.liveUrl}?publication=${job.id}`,{cache:"no-store"}),fetchImpl(`${origin}/api/aggits-jukebox-editions/${job.editionId}/config`,{cache:"no-store"}),fetchImpl(job.qrImageUrl,{cache:"no-store"}),fetchImpl(`${origin}/api/aggits-jukebox-assets/${job.editionId}/video`,{method:"HEAD",cache:"no-store"})]);const [html,json,qrBytes]=await Promise.all([page.text(),config.json().catch(()=>null),qr.arrayBuffer()]),png=new Uint8Array(qrBytes);if(!page.ok||!html.includes("Deep Cuts"))throw publicationError("The deployed Jukebox page failed verification.","live_verification_failed");if(!config.ok||json?.editionType!=="aggits_jukebox"||json?.bandName!==title)throw publicationError("The live Jukebox configuration did not match this edition.","config_verification_failed");if(!qr.ok||png.length<10000||png[0]!==0x89||png[1]!==0x50)throw publicationError("The deployed QR artwork failed verification.","qr_verification_failed");if(!video.ok||!(video.headers.get("content-type")||"").includes("video/mp4"))throw publicationError("The deployed MP4 failed verification.","video_verification_failed")}
async function remoteJson(fetchImpl,url,{method="GET",identity,body}={}){const response=await fetchImpl(url,{method,headers:headers(identity,body!==undefined?{"content-type":"application/json"}:{}),body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"}),result=await response.json().catch(()=>({}));if(!response.ok||result.ok===false)throw Object.assign(publicationError(result.error||`Publisher returned ${response.status}.`,result.code||"publisher_request_failed"),{status:response.status});return result}
async function remoteBytes(fetchImpl,url,{identity,bytes,headers:extra={}}={}){const response=await fetchImpl(url,{method:"PUT",headers:headers(identity,{...extra,"content-length":String(bytes.length)}),body:bytes});const result=await response.json().catch(()=>({}));if(!response.ok||result.ok===false)throw publicationError(result.error||`Asset upload returned ${response.status}.`,result.code||"publisher_upload_failed");return result}
function headers(identity,extra){return{authorization:`Bearer ${identity.token}`,"x-deep-cuts-installation-id":identity.installationId,...extra}}
function fields(job){return{editionId:job.editionId,liveUrl:job.liveUrl,qrImageUrl:job.qrImageUrl,remoteJobId:job.id}}
function assertServiceUrl(value){let url;try{url=new URL(String(value||""))}catch{throw publicationError("The publishing service URL is invalid.","publisher_url_invalid")}if(url.protocol!=="https:"||url.username||url.password)throw publicationError("The publisher requires HTTPS.","publisher_url_invalid");return url.origin}
function clean(value,max){return String(value||"").trim().replace(/\s+/g," ").slice(0,max)}
function multiline(value,max){return String(value||"").trim().replace(/\r\n?/g,"\n").replace(/[ \t]+/g," ").slice(0,max)}
function publicationError(message,code){return Object.assign(new Error(message),{name:"AggitsJukeboxPublicationError",code})}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
