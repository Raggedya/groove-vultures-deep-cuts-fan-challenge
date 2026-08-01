import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {BAR_PUBLIC_VIDEO_MAX_BYTES,createDirectVenuePublisher,inspectStoredVideo} from "./bar-edition-publication.mjs";
import {
  attachVenueVideo,
  createVenuePublicationJob,
  getVenue,
  interruptVenuePublications,
  migrateVenueLibrary,
  updateVenuePublicationJob
} from "./venue-library.mjs";

export const VENUE_BATCH_PUBLICATION_SCHEMA="deep-cuts-venue-batch-publication/1";

export async function publishVenueBatch({
  dataDir,
  workspaceRoot=process.cwd(),
  videoPath,
  credentialStore,
  publisher,
  fetchImpl=fetch,
  appVersion="3.4.0",
  venueIds=[],
  force=false,
  maxAttempts=3,
  retryBaseMs=15_000,
  interVenueDelayMs=5_000,
  sleep=delay,
  onProgress=()=>{},
  now=()=>new Date()
}={}){
  const libraryRoot=path.join(requiredPath(dataDir,"Studio data directory"),"venue-library");
  const libraryPath=path.join(libraryRoot,"library.json");
  const videosRoot=path.join(libraryRoot,"videos");
  const reportsRoot=path.join(libraryRoot,"batch-reports");
  const sourceVideo=requiredPath(videoPath,"Placeholder MP4");
  const video=await fs.readFile(sourceVideo);
  if(!isMp4(video))throw batchError("The supplied placeholder is not a valid MP4.","invalid_video_file");
  if(video.length>BAR_PUBLIC_VIDEO_MAX_BYTES)throw batchError(`The placeholder MP4 exceeds the ${Math.floor(BAR_PUBLIC_VIDEO_MAX_BYTES/1024/1024)} MB public limit.`,"video_too_large");
  const videoSha256=crypto.createHash("sha256").update(video).digest("hex");
  const fileName=path.basename(sourceVideo).slice(0,180);
  const batchId=`venue_batch_${now().toISOString().replace(/\D/g,"").slice(0,14)}_${crypto.randomBytes(3).toString("hex")}`;
  const publicationPublisher=publisher||createDirectVenuePublisher({root:workspaceRoot,appVersion,credentialStore,fetchImpl});
  const authentication=await publicationPublisher.authentication();
  if(!authentication?.available)throw batchError(authentication?.reason||"Secure publishing is not activated on this Windows installation.","publisher_activation_required");

  let library=migrateVenueLibrary(JSON.parse(await fs.readFile(libraryPath,"utf8")));
  const interrupted=interruptVenuePublications(library,{now:now()});
  library=interrupted.library;
  const selected=selectVenues(library,venueIds);
  if(!selected.length)throw batchError("No Venue Library records were selected.","no_venues_selected");
  const targets=selected.filter(venue=>force||!isCurrentPublication(venue,videoSha256));
  const skipped=selected.filter(venue=>!targets.includes(venue));

  await fs.mkdir(videosRoot,{recursive:true});
  await fs.mkdir(reportsRoot,{recursive:true});
  const backupPath=path.join(reportsRoot,`${batchId}-library-before.json`);
  await fs.writeFile(backupPath,`${JSON.stringify(library,null,2)}\n`,"utf8");

  for(const venue of targets){
    const destination=path.join(videosRoot,`${venue.id}.mp4`);
    await atomicWrite(destination,video);
    library=attachVenueVideo(library,venue.id,{fileName,sizeBytes:video.length,sha256:videoSha256},{initiatingUser:`Venue launch trial ${batchId}`,now:now()}).library;
  }
  await saveLibrary(libraryPath,library);

  const report={
    schemaVersion:VENUE_BATCH_PUBLICATION_SCHEMA,
    batchId,
    startedAt:now().toISOString(),
    finishedAt:null,
    sourceVideo:{fileName,sizeBytes:video.length,sha256:videoSha256},
    total:selected.length,
    requested:targets.length,
    published:0,
    failed:0,
    skipped:skipped.length,
    results:skipped.map(venue=>({masterId:venue.masterId,venueId:venue.id,venueName:venue.csv.venueName,status:"skipped",reason:"Already published with this exact MP4",liveUrl:venue.admin.publicEditionUrl,qrImageUrl:venue.admin.intendedQrUrl}))
  };
  await writeReport(reportsRoot,report);

  for(let index=0;index<targets.length;index+=1){
    library=migrateVenueLibrary(JSON.parse(await fs.readFile(libraryPath,"utf8")));
    const current=getVenue(library,targets[index].id);
    const storedVideoPath=path.join(videosRoot,`${current.id}.mp4`);
    const readiness=await inspectStoredVideo(current,storedVideoPath);
    const position=`${index+1}/${targets.length}`;
    if(!readiness.ready){
      const error=readiness.errors.join(" ");
      report.failed+=1;report.results.push(failedResult(current,error,"publication_not_ready",now()));
      await onProgress({batchId,position,masterId:current.masterId,venueName:current.csv.venueName,status:"failed",stage:"validation",message:error});
      await writeReport(reportsRoot,report);continue;
    }

    let localJob;
    try{
      const created=createVenuePublicationJob(library,current.id,{initiatingUser:`Venue launch trial ${batchId}`,now:now()});
      library=created.library;localJob=created.job;await saveLibrary(libraryPath,library);
      await persistJob(libraryPath,localJob.id,{status:"running",stage:"preparing",message:"Preparing protected batch publication"},now());
      await onProgress({batchId,position,masterId:current.masterId,venueName:current.csv.venueName,status:"running",stage:"preparing",message:"Preparing protected publication"});
      let published,lastError;
      for(let attempt=1;attempt<=Math.max(1,maxAttempts);attempt+=1){
        try{
          published=await publicationPublisher.publish({
            venue:current,
            videoPath:storedVideoPath,
            onProgress:async(stage,message,changes={})=>{
              await persistJob(libraryPath,localJob.id,{status:"running",stage,message,...changes},now());
              await onProgress({batchId,position,attempt,masterId:current.masterId,venueName:current.csv.venueName,status:"running",stage,message});
            }
          });
          break;
        }catch(error){
          lastError=error;
          if(attempt>=Math.max(1,maxAttempts)||!isTechnicalFailure(error))throw error;
          const waitMs=Math.max(0,retryBaseMs)*attempt;
          await persistJob(libraryPath,localJob.id,{status:"running",stage:"retrying",message:`Temporary publishing interruption. Retrying attempt ${attempt+1} of ${Math.max(1,maxAttempts)}.`},now());
          await onProgress({batchId,position,attempt,masterId:current.masterId,venueName:current.csv.venueName,status:"running",stage:"retrying",message:`Temporary publishing interruption. Retrying in ${Math.ceil(waitMs/1000)} seconds.`});
          await sleep(waitMs);
        }
      }
      if(!published)throw lastError||batchError("Publication did not return a result.","publication_result_missing");
      const finalChanges={status:"published",stage:"published",message:"Published, verified and delivered",remoteJobId:published.jobId,editionId:published.editionId,slug:published.slug,liveUrl:published.liveUrl,qrImageUrl:published.qrImageUrl,deploymentUrl:published.deploymentUrl,errorCode:"",error:""};
      await persistJob(libraryPath,localJob.id,finalChanges,now());
      report.published+=1;report.results.push({masterId:current.masterId,venueId:current.id,venueName:current.csv.venueName,status:"published",editionId:published.editionId,liveUrl:published.liveUrl,qrImageUrl:published.qrImageUrl,emailDelivery:"confirmed",completedAt:now().toISOString()});
      await onProgress({batchId,position,masterId:current.masterId,venueName:current.csv.venueName,status:"published",stage:"published",message:"Live page, QR and separate delivery email confirmed",liveUrl:published.liveUrl,qrImageUrl:published.qrImageUrl});
    }catch(error){
      const code=String(error?.code||"publication_failed"),message=String(error?.message||"Unknown publication failure");
      if(localJob)await persistJob(libraryPath,localJob.id,{status:"failed",stage:"failed",message:"Publication stopped safely; no unvalidated output was accepted",errorCode:code,error:message},now()).catch(()=>{});
      report.failed+=1;report.results.push(failedResult(current,message,code,now()));
      await onProgress({batchId,position,masterId:current.masterId,venueName:current.csv.venueName,status:"failed",stage:"failed",message});
    }
    await writeReport(reportsRoot,report);
    if(index<targets.length-1&&interVenueDelayMs>0)await sleep(interVenueDelayMs);
  }

  report.finishedAt=now().toISOString();await writeReport(reportsRoot,report);
  return{...report,reportPath:path.join(reportsRoot,`${report.batchId}.json`),backupPath};
}

async function persistJob(libraryPath,jobId,changes,at){
  const current=migrateVenueLibrary(JSON.parse(await fs.readFile(libraryPath,"utf8")));
  const updated=updateVenuePublicationJob(current,jobId,changes,{initiatingUser:"Deep Cuts protected venue batch",now:at});
  await saveLibrary(libraryPath,updated.library);return updated;
}
async function saveLibrary(libraryPath,library){await atomicWrite(libraryPath,Buffer.from(`${JSON.stringify(library,null,2)}\n`))}
async function writeReport(reportsRoot,report){await atomicWrite(path.join(reportsRoot,`${report.batchId}.json`),Buffer.from(`${JSON.stringify(report,null,2)}\n`))}
async function atomicWrite(destination,bytes){const temporary=`${destination}.${process.pid}.${crypto.randomBytes(3).toString("hex")}.tmp`;await fs.writeFile(temporary,bytes);await fs.rename(temporary,destination)}
function selectVenues(library,ids){const requested=new Set((ids||[]).map(String));return Object.values(library.venues).filter(venue=>!requested.size||requested.has(venue.id)||requested.has(venue.masterId)).sort((a,b)=>a.masterId.localeCompare(b.masterId))}
function isCurrentPublication(venue,videoSha256){return venue?.admin?.publicationState==="published"&&venue?.admin?.customVideo?.sha256===videoSha256&&isPublicHttps(venue?.admin?.publicEditionUrl)&&isPublicHttps(venue?.admin?.intendedQrUrl)}
function isTechnicalFailure(error){const status=Number(error?.status||0),code=String(error?.code||"");return status===429||status>=500||["publisher_request_failed","publisher_upload_failed","network_error","delivery_timeout"].includes(code)||/(?:HTTP|service|upload)\s+5\d\d|fetch failed|timed? out/i.test(String(error?.message||""))}
function isPublicHttps(value){try{const url=new URL(String(value||""));return url.protocol==="https:"&&!url.username&&!url.password}catch{return false}}
function isMp4(bytes){return bytes.length>=12&&bytes.subarray(4,8).toString("ascii")==="ftyp"}
function requiredPath(value,label){const result=String(value||"").trim();if(!result)throw batchError(`${label} is required.`,"missing_path");return path.resolve(result)}
function failedResult(venue,message,errorCode,at){return{masterId:venue.masterId,venueId:venue.id,venueName:venue.csv.venueName,status:"failed",errorCode,message,completedAt:at.toISOString()}}
function batchError(message,code){return Object.assign(new Error(message),{name:"VenueBatchPublicationError",code})}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
