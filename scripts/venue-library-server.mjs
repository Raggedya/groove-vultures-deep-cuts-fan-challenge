import crypto from "node:crypto";
import {createReadStream} from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  VenueLibraryError,applyVenueSync,archiveLegacyVenueLibrary,attachVenueVideo,createUpdateRun,createVenueLibrary,createVenuePublicationJob,effectiveVenueContent,encodeCsv,
  extractEventsFromHtml,fetchSafeUrl,finishRun,generateVenueTicker,getVenue,listVenueSummaries,markVenueUpdate,mergeVenueEvents,
  interruptVenuePublications,migrateVenueLibrary,previewVenueSync,qrStatusFor,recordRunVenueResult,removeVenueVideo,reportRows,setVenueLibraryVisibility,setVenuePublicationState,startRun,updateVenue,
  updateVenuePublicationJob,venueLibraryBootstrap
} from "./venue-library.mjs";
import {BAR_PUBLIC_VIDEO_MAX_BYTES,createDirectVenuePublisher,inspectStoredVideo} from "./bar-edition-publication.mjs";
import {attachMp4,createProject,renderStudioPreview} from "./studio-model.mjs";

const MAX_CSV_JSON_BYTES=12*1024*1024;
const MAX_VIDEO_BYTES=500*1024*1024;

export function createVenueLibraryController({dataDir,root:workspaceRoot=process.cwd(),applicationVersion="development",fetchImpl=fetch,dnsLookup,publisher,credentialStore,publisherFetchImpl=fetch}={}){
  const root=path.join(dataDir,"venue-library");
  const libraryFile=path.join(root,"library.json");
  const videosRoot=path.join(root,"videos");
  const activeJobs=new Map();
  const activePublications=new Map();
  const publicationPublisher=publisher||createDirectVenuePublisher({root:workspaceRoot,appVersion:applicationVersion,credentialStore,fetchImpl:publisherFetchImpl});
  let writeQueue=Promise.resolve();
  let initialized=false;

  async function load(){
    try{return migrateVenueLibrary(JSON.parse(await fs.readFile(libraryFile,"utf8")))}catch(error){if(error.code!=="ENOENT")throw error;return createVenueLibrary()}
  }
  async function save(library){
    await fs.mkdir(root,{recursive:true});
    const temporary=path.join(root,`library-${process.pid}-${crypto.randomBytes(3).toString("hex")}.tmp`);
    await fs.writeFile(temporary,`${JSON.stringify(library,null,2)}\n`,"utf8");
    for(let attempt=0;;attempt++)try{await fs.rename(temporary,libraryFile);break}catch(error){if(!["EPERM","EACCES"].includes(error.code)||attempt>=5)throw error;await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)))}
  }
  function transact(callback){
    const operation=writeQueue.then(async()=>{const library=await load();const result=await callback(library);if(result?.library)await save(result.library);return result});
    writeQueue=operation.catch(()=>{});return operation;
  }

  async function initialize(){
    if(initialized)return;initialized=true;
    const current=await load(),archived=archiveLegacyVenueLibrary(current),interrupted=interruptVenuePublications(archived.library);
    if(archived.changed||interrupted.changed)await save(interrupted.library);
  }

  async function handle({request,response,url}){
    if(!url.pathname.startsWith("/api/studio/venues")&&!url.pathname.startsWith("/api/studio/venue-jobs")&&!url.pathname.startsWith("/api/studio/venue-reports")&&!url.pathname.startsWith("/api/studio/venue-publications"))return false;
    await initialize();

    if(request.method==="GET"&&url.pathname==="/api/studio/venue-publications/capabilities"){
      let authentication;try{authentication=await publicationPublisher.authentication()}catch(error){authentication={available:false,activationSupported:true,state:"unavailable",reason:error.message||"Secure publishing is temporarily unavailable."}}
      return json(response,200,{ok:true,authentication,workflow:"direct_cloudflare",maxVideoBytes:BAR_PUBLIC_VIDEO_MAX_BYTES,maxVideoLabel:`${Math.floor(BAR_PUBLIC_VIDEO_MAX_BYTES/1024/1024)} MB`,security:"Publishing uses a device-scoped credential encrypted by Windows. No GitHub account, password or token is required."});
    }
    if(request.method==="POST"&&url.pathname==="/api/studio/venue-publications/auth/start"){
      const result=await publicationPublisher.startActivation();return json(response,200,{ok:true,...result});
    }
    if(request.method==="POST"&&url.pathname==="/api/studio/venue-publications/auth/complete"){
      const body=await readJson(request);const authentication=await publicationPublisher.completeActivation(body.code);return json(response,200,{ok:true,authentication});
    }
    const publicationMatch=url.pathname.match(/^\/api\/studio\/venue-publications\/(publication_[a-f0-9-]+)$/);
    if(publicationMatch&&request.method==="GET"){
      const library=await load(),job=library.publicationJobs.find(item=>item.id===publicationMatch[1]);
      if(!job)throw new VenueLibraryError("Publication job not found.","publication_job_not_found");
      return json(response,200,{ok:true,job});
    }

    if(request.method==="GET"&&url.pathname==="/api/studio/venues/bootstrap"){
      const library=await load();return json(response,200,{ok:true,bootstrap:venueLibraryBootstrap(library),venues:listVenueSummaries(library)});
    }
    if(request.method==="POST"&&url.pathname==="/api/studio/venues/import/preview"){
      const body=await readJson(request,MAX_CSV_JSON_BYTES);const library=await load();
      const preview=previewVenueSync(library,body.csvText,{fileName:body.fileName});
      return json(response,200,{ok:true,preview:{...preview,records:undefined},previewToken:previewToken(preview)});
    }
    if(request.method==="POST"&&url.pathname==="/api/studio/venues/import/apply"){
      const body=await readJson(request,MAX_CSV_JSON_BYTES);
      const result=await transact(async library=>{
        const preview=previewVenueSync(library,body.csvText,{fileName:body.fileName});
        if(body.previewToken&&body.previewToken!==previewToken(preview))throw new VenueLibraryError("The CSV changed after preview. Preview it again before synchronising.","stale_import_preview");
        return applyVenueSync(library,preview);
      });
      return json(response,200,{ok:true,importRecord:result.importRecord,bootstrap:venueLibraryBootstrap(result.library),venues:listVenueSummaries(result.library)});
    }
    if(request.method==="GET"&&url.pathname==="/api/studio/venues"){
      const library=await load();const filters=Object.fromEntries(url.searchParams.entries());return json(response,200,{ok:true,venues:listVenueSummaries(library,filters),bootstrap:venueLibraryBootstrap(library)});
    }
    if(request.method==="GET"&&url.pathname==="/api/studio/venues-archived"){
      const library=await load(),filters={...Object.fromEntries(url.searchParams.entries()),visibility:"archived",sort:"name"};
      return json(response,200,{ok:true,venues:listVenueSummaries(library,filters)});
    }

    const venueMatch=url.pathname.match(/^\/api\/studio\/venues\/(venue_[a-f0-9]{16})(?:\/(preview|video|update|urls|gigs|ticker|qr|publish|publication|visibility))?$/);
    if(venueMatch){
      const venueId=venueMatch[1],action=venueMatch[2]||"record";
      if(request.method==="GET"&&action==="record"){
        const library=await load(),venue=getVenue(library,venueId);
        const history=library.updateRuns.flatMap(run=>(run.results||[]).filter(item=>item.venueId===venueId).map(item=>({...item,runId:run.id,runStartedAt:run.startedAt,runFinishedAt:run.finishedAt}))).slice(0,30);
        const audit=library.audit.filter(item=>item.details?.venueId===venueId||item.details?.masterId===venue.masterId).slice(0,30);
        return json(response,200,{ok:true,venue,effective:effectiveVenueContent(venue),qr:qrStatusFor(venue),history,audit});
      }
      if(request.method==="POST"&&action==="publish"){
        const library=await load(),venue=getVenue(library,venueId),videoPath=path.join(videosRoot,`${venueId}.mp4`);
        const readiness=await inspectStoredVideo(venue,videoPath);
        if(!readiness.ready)throw new VenueLibraryError(readiness.errors.join(" "),"publication_not_ready");
        let created;await transact(current=>{const result=createVenuePublicationJob(current,venueId);created=result.job;return result});
        activePublications.set(created.id,true);
        setTimeout(()=>runPublication(created.id,videoPath).catch(error=>console.error("[Secure Venue Publication]",error)),0);
        return json(response,202,{ok:true,job:created,readiness});
      }
      if(request.method==="PUT"&&action==="visibility"){
        const body=await readJson(request),result=await transact(library=>setVenueLibraryVisibility(library,venueId,body.visibility));
        return json(response,200,{ok:true,venue:result.venue,bootstrap:venueLibraryBootstrap(result.library),venues:listVenueSummaries(result.library)});
      }
      if(request.method==="PUT"&&action==="publication"){
        const body=await readJson(request),published=body.published===true,library=await load(),venue=getVenue(library,venueId);
        if(published&&venue.admin.publicationState==="published")return json(response,200,{ok:true,published:true,venue});
        const editionId=publicationEditionId(venue);
        if(!published){
          if(!editionId)throw new VenueLibraryError("This venue has not been published yet.","edition_identity_missing");
          const remote=await publicationPublisher.setPublished({editionId,published:false});
          const result=await transact(current=>setVenuePublicationState(current,venueId,false,{publication:remote}));
          return json(response,200,{ok:true,published:false,venue:result.venue,identityPreserved:true});
        }
        const videoPath=path.join(videosRoot,`${venueId}.mp4`),readiness=await inspectStoredVideo(venue,videoPath);
        if(!readiness.ready)throw new VenueLibraryError(readiness.errors.join(" "),"publication_not_ready");
        let created;await transact(current=>{const result=createVenuePublicationJob(current,venueId);created=result.job;return result});
        activePublications.set(created.id,true);setTimeout(()=>runPublication(created.id,videoPath).catch(error=>console.error("[Secure Venue Publication]",error)),0);
        return json(response,202,{ok:true,published:false,pending:true,job:created,readiness,identityPreserved:Boolean(editionId)});
      }
      if(request.method==="PUT"&&action==="record"){
        const body=await readJson(request);const result=await transact(library=>updateVenue(library,venueId,body,{expectedRevision:body.expectedRevision}));
        return json(response,200,{ok:true,venue:result.venue,effective:effectiveVenueContent(result.venue),qr:qrStatusFor(result.venue)});
      }
      if(request.method==="GET"&&action==="preview"){
        const library=await load();const venue=getVenue(library,venueId);const videoUrl=venue.admin.customVideo?`/api/studio/venues/${venueId}/video`:"";
        return html(response,renderVenuePreview(venue,videoUrl));
      }
      if(request.method==="POST"&&action==="video"){
        const fileName=decodeURIComponent(String(request.headers["x-studio-file-name"]||"welcome.mp4"));
        if(!/\.mp4$/i.test(fileName))throw new VenueLibraryError("Venue videos must be MP4 files.","invalid_video_type");
        await fs.mkdir(videosRoot,{recursive:true});const temporary=path.join(videosRoot,`${venueId}-${process.pid}.tmp`);
        let upload;try{upload=await streamUpload(request,temporary,MAX_VIDEO_BYTES);if(!looksLikeMp4(upload.header))throw new VenueLibraryError("The selected file does not appear to be a valid MP4.","invalid_video_file");await fs.rm(path.join(videosRoot,`${venueId}.mp4`),{force:true});await fs.rename(temporary,path.join(videosRoot,`${venueId}.mp4`))}catch(error){await fs.rm(temporary,{force:true});throw error}
        const result=await transact(library=>attachVenueVideo(library,venueId,{fileName,sizeBytes:upload.sizeBytes,sha256:upload.sha256}));
        return json(response,200,{ok:true,venue:result.venue});
      }
      if(request.method==="DELETE"&&action==="video"){
        await fs.rm(path.join(videosRoot,`${venueId}.mp4`),{force:true});const result=await transact(library=>removeVenueVideo(library,venueId));return json(response,200,{ok:true,venue:result.venue});
      }
      if(request.method==="GET"&&action==="video")return serveMedia(request,response,path.join(videosRoot,`${venueId}.mp4`),"video/mp4");
      if(request.method==="POST"&&["update","urls","gigs","ticker","qr"].includes(action)){
        const operations=action==="urls"?{checkUrls:true,retrieveGigs:false,regenerateTickers:false,regenerateQr:false}:action==="gigs"?{checkUrls:false,retrieveGigs:true,regenerateTickers:true,regenerateQr:false}:action==="ticker"?{checkUrls:false,retrieveGigs:false,regenerateTickers:true,regenerateQr:false}:action==="qr"?{checkUrls:false,retrieveGigs:false,regenerateTickers:false,regenerateQr:true}:undefined;
        const run=await queueRun({venueIds:[venueId],scope:"single",operations});return json(response,202,{ok:true,run});
      }
      throw new VenueLibraryError("Venue operation not found.","venue_route_not_found");
    }

    if(request.method==="POST"&&url.pathname==="/api/studio/venue-jobs"){
      const body=await readJson(request);const library=await load();const venueIds=body.scope==="all"?listVenueSummaries(library).map(venue=>venue.id):body.venueIds;
      const run=await queueRun({venueIds,scope:body.scope||"selected",operations:body.operations});return json(response,202,{ok:true,run});
    }
    const jobMatch=url.pathname.match(/^\/api\/studio\/venue-jobs\/(run_[a-f0-9-]+)(?:\/(cancel|retry|export))?$/);
    if(jobMatch){
      const runId=jobMatch[1],action=jobMatch[2]||"status";
      if(request.method==="GET"&&action==="status"){const library=await load();const run=library.updateRuns.find(item=>item.id===runId);if(!run)throw new VenueLibraryError("Update run not found.","run_not_found");return json(response,200,{ok:true,run})}
      if(request.method==="POST"&&action==="cancel"){const control=activeJobs.get(runId);if(control)control.cancelRequested=true;await transact(async library=>{const run=library.updateRuns.find(item=>item.id===runId);if(run)run.cancelRequested=true;return{library}});return json(response,202,{ok:true,cancelRequested:true})}
      if(request.method==="POST"&&action==="retry"){
        const library=await load();const original=library.updateRuns.find(item=>item.id===runId);if(!original)throw new VenueLibraryError("Update run not found.","run_not_found");
        const failedIds=original.results.filter(result=>result.status==="failed").map(result=>result.venueId);const run=await queueRun({venueIds:failedIds,scope:"retry",operations:original.selectedOperations,parentRunId:runId});return json(response,202,{ok:true,run});
      }
      if(request.method==="GET"&&action==="export"){
        const library=await load();const run=library.updateRuns.find(item=>item.id===runId);if(!run)throw new VenueLibraryError("Update run not found.","run_not_found");
        const rows=run.results.map(result=>({"Run ID":run.id,"Master ID":result.masterId,"Venue Name":result.venueName,"Status":result.status,"Summary":result.summary,"Warnings":(result.warnings||[]).join(" | "),"Errors":(result.errors||[]).join(" | "),"Completed At":result.completedAt}));
        return csv(response,encodeCsv(rows),`jookbox-update-${run.id}.csv`);
      }
    }
    if(request.method==="GET"&&url.pathname==="/api/studio/venue-reports/operations.csv"){
      const library=await load();return csv(response,encodeCsv(reportRows(library,Object.fromEntries(url.searchParams.entries()))),`jookbox-venue-report-${new Date().toISOString().slice(0,10)}.csv`);
    }
    if(request.method==="GET"&&url.pathname==="/api/studio/venue-reports/summary"){
      const library=await load();return json(response,200,{ok:true,bootstrap:venueLibraryBootstrap(library),imports:library.imports.slice(0,100),runs:library.updateRuns.slice(0,100),metricDefinitions:{health:"Local URL, freshness and completeness status.",publicActivity:"Requires hosted analytics and is not measured in this release."}});
    }
    if(request.method==="GET"&&url.pathname==="/api/studio/venue-reports/print"){
      const library=await load(),filters=Object.fromEntries(url.searchParams.entries());return html(response,renderOperationsReport(library,filters));
    }
    throw new VenueLibraryError("Venue Library route not found.","venue_route_not_found");
  }

  async function queueRun({venueIds=[],scope="selected",operations,parentRunId=null}){
    const unique=[...new Set((venueIds||[]).filter(Boolean))];if(!unique.length)throw new VenueLibraryError("Select at least one venue to update.","no_venues_selected");
    let created;await transact(async library=>{for(const id of unique)getVenue(library,id);const base=createUpdateRun({venueIds:unique,scope,operations,parentRunId,applicationVersion});const started=startRun(library,base);created=structuredClone(started.run);return started});
    const control={cancelRequested:false};activeJobs.set(created.id,control);
    setTimeout(()=>runUpdate(created.id,control).catch(error=>console.error("[Venue Library update]",error)),0);
    return created;
  }

  async function runPublication(jobId,videoPath){
    try{
      let library=await load(),job=library.publicationJobs.find(item=>item.id===jobId);if(!job)return;
      let venue=getVenue(library,job.venueId);
      await updatePublication(jobId,{status:"running",stage:"gigs",message:"Reading the verified Gigs page and preparing the upcoming-events ticker"});
      const tickerRefresh=await updateOneVenue(
        venue,
        {selectedOperations:{checkUrls:false,retrieveGigs:true,regenerateTickers:true,regenerateQr:false}},
        operation=>updatePublication(jobId,{status:"running",stage:"gigs",message:operation})
      );
      await transact(current=>markVenueUpdate(current,venue.id,{...tickerRefresh,runId:jobId}));
      library=await load();venue=getVenue(library,job.venueId);
      await updatePublication(jobId,{status:"running",stage:"preparing",message:tickerRefresh.automated?.generatedTicker?.entryCount?"Verified upcoming events added to the ticker":"No supported upcoming events were found; the approved fallback ticker was preserved"});
      const result=await publicationPublisher.publish({venue,videoPath,onProgress:async(stage,message,changes={})=>updatePublication(jobId,{status:"running",stage,message,...changes})});
      await updatePublication(jobId,{status:"published",stage:"published",message:"Published, verified and delivered",remoteJobId:result.jobId,editionId:result.editionId,slug:result.slug,liveUrl:result.liveUrl,qrImageUrl:result.qrImageUrl,deploymentUrl:result.deploymentUrl,errorCode:"",error:""});
    }catch(error){
      try{await updatePublication(jobId,{status:"failed",stage:"failed",message:"Publication stopped safely; nothing unvalidated was deployed",errorCode:error.code||"publication_failed",error:error.message||"Unknown publication failure"})}catch(updateError){console.error("[Secure Venue Publication state]",updateError)}
    }finally{activePublications.delete(jobId)}
  }

  async function updatePublication(jobId,changes){
    let result;await transact(library=>{result=updateVenuePublicationJob(library,jobId,changes);return result});return result;
  }

  async function runUpdate(runId,control){
    let library=await load();let run=library.updateRuns.find(item=>item.id===runId);if(!run)return;
    for(const venueId of run.venueIds){
      if(control.cancelRequested){await transact(async current=>{const active=current.updateRuns.find(item=>item.id===runId);if(active)active.cancelRequested=true;return finishRun(current,runId,{cancelled:true})});activeJobs.delete(runId);return}
      const venue=getVenue(await load(),venueId);
      await setProgress(runId,venue,"Checking venue");
      let updateResult;
      try{updateResult=await updateOneVenue(venue,run,operation=>setProgress(runId,venue,operation))}
      catch(error){updateResult={status:"failed",summary:"Update failed; existing venue data was preserved.",warnings:[],errors:[error.message||"Unknown update failure"],automated:{},healthChecks:{},runId}}
      let recorded;await transact(async current=>{const marked=markVenueUpdate(current,venueId,{...updateResult,runId});const result={venueId,masterId:venue.masterId,venueName:venue.csv.venueName,status:updateResult.status,summary:updateResult.summary,warnings:updateResult.warnings||[],errors:updateResult.errors||[]};return recordRunVenueResult(marked.library,runId,result)}).then(value=>{recorded=value});
      run=recorded.run;
    }
    await transact(current=>finishRun(current,runId));activeJobs.delete(runId);
  }

  async function updateOneVenue(venue,run,onProgress){
    const operations=run.selectedOperations;const warnings=[],errors=[];const healthChecks={};const automated={...venue.automated};let gigsResponse=null;let stageSuccess=0;
    if(operations.checkUrls){
      await onProgress("Checking destination URLs");const fields={website:venue.csv.websiteUrl,gigs:venue.csv.gigsUrl,menu:venue.csv.menuUrl,contact:venue.csv.contactUrl,instagram:venue.csv.instagramUrl,facebook:venue.csv.facebookUrl,about:venue.csv.aboutUrl};
      const entries=Object.entries(fields).filter(([,value])=>value);const results=await mapLimit(entries,3,async([key,value])=>{
        try{const fetched=await fetchSafeUrl(value,{fetchImpl,dnsLookup});return{key,value,fetched}}
        catch(error){return{key,value,error}}
      });
      for(const result of results){
        const previous=venue.healthChecks?.[result.key];
        if(result.error){const count=Number(previous?.consecutiveFailureCount||0)+1;healthChecks[result.key]={success:false,attemptedAt:new Date().toISOString(),url:result.value,errorCode:result.error.code||"network_error",errorSummary:result.error.message,consecutiveFailureCount:count,lastSuccessfulCheck:previous?.lastSuccessfulCheck||null};warnings.push(`${result.key}: ${result.error.message}`)}
        else{healthChecks[result.key]={success:result.fetched.ok,attemptedAt:new Date().toISOString(),url:result.value,httpStatus:result.fetched.status,finalUrl:result.fetched.finalUrl,durationMs:result.fetched.durationMs,consecutiveFailureCount:result.fetched.ok?0:Number(previous?.consecutiveFailureCount||0)+1,lastSuccessfulCheck:result.fetched.ok?new Date().toISOString():previous?.lastSuccessfulCheck||null,errorSummary:result.fetched.ok?"":`HTTP ${result.fetched.status}`};if(result.fetched.ok)stageSuccess++;else warnings.push(`${result.key}: HTTP ${result.fetched.status}`);if(result.key==="gigs")gigsResponse=result.fetched}
      }
    }
    if(operations.retrieveGigs){
      await onProgress("Retrieving gig information");automated.lastGigAttempt=new Date().toISOString();
      try{
        gigsResponse=gigsResponse||await fetchSafeUrl(venue.csv.gigsUrl,{fetchImpl,dnsLookup});if(!gigsResponse.ok)throw new VenueLibraryError(`Gig source returned HTTP ${gigsResponse.status}.`,"gig_http_error");
        const extracted=extractEventsFromHtml(gigsResponse.body,{venueId:venue.id,sourceUrl:gigsResponse.finalUrl});automated.gigEvidence=extracted.evidence;automated.events=mergeVenueEvents(venue.automated?.events,extracted.events);automated.lastGigSuccess=new Date().toISOString();automated.gigStatus=extracted.events.length?"current":"review_required";
        if(!extracted.events.length)warnings.push("Gig page was reachable but no supported structured events were found; existing event data was retained.");else stageSuccess++;
      }catch(error){automated.gigStatus=venue.automated?.events?.length?"stale":"failed";warnings.push(`Gig retrieval: ${error.message}. Existing event data was preserved.`);automated.events=venue.automated?.events||[]}
    }
    if(operations.regenerateTickers){
      await onProgress("Generating ticker");const generated=generateVenueTicker(automated.events,{pinnedNotice:venue.admin.tickerPinnedNotice});
      if(generated.entryCount){automated.generatedTicker=generated;stageSuccess++}else warnings.push("No current events were available for a generated ticker; the existing ticker was preserved.");
    }
    if(operations.regenerateQr){
      await onProgress("Checking QR readiness");const qr=qrStatusFor(venue);automated.qr={...qr,checkedAt:new Date().toISOString()};if(qr.destination)stageSuccess++;else warnings.push("QR generation is pending until a public or intended HTTPS destination is entered.");
    }
    const attempted=Object.values(operations).filter(Boolean).length;const status=errors.length||(attempted>0&&stageSuccess===0&&warnings.length)?"failed":warnings.length?"warning":"success";
    return{status,summary:`${stageSuccess} update stage${stageSuccess===1?"":"s"} completed${warnings.length?` with ${warnings.length} warning${warnings.length===1?"":"s"}`:""}.`,warnings,errors,automated,healthChecks,attempted};
  }

  async function setProgress(runId,venue,operation){
    await transact(async library=>{const run=library.updateRuns.find(item=>item.id===runId);if(run){run.currentVenueId=venue.id;run.currentVenueName=venue.csv.venueName;run.currentOperation=operation}return{library}});
  }

  return{handle,load};
}

function publicationEditionId(venue){
  const direct=String(venue?.admin?.publication?.editionId||"");if(/^dc_[a-f0-9]{10}$/.test(direct))return direct;
  const match=String(venue?.admin?.publicEditionUrl||"").match(/\/e\/(dc_[a-f0-9]{10})(?:$|[/?#])/);return match?.[1]||"";
}

function renderVenuePreview(venue,videoUrl){
  const content=effectiveVenueContent(venue);const urls=[venue.csv.gigsUrl,venue.csv.menuUrl,venue.csv.contactUrl,venue.csv.instagramUrl,venue.csv.facebookUrl];const labels=["Gigs","Menu","Contact Us","Instagram","Facebook"];
  let project=createProject({name:venue.csv.venueName,type:"bar_jukebox",sourceUrls:urls,sourceLabels:labels,tickerText:content.tickerText,aboutText:content.aboutText});
  project.id=`studio_${venue.id.slice(-12)}`;if(venue.admin.customVideo)project=attachMp4(project,venue.admin.customVideo);
  project.readiness={...project.readiness,handoffReady:false,publicationPending:true,blockers:venue.admin.customVideo?[]:["Custom video not yet added."]};
  return renderStudioPreview(project,{videoUrl,scriptNonce:"venue-library-preview"}).replace(/<script nonce="[^"]+">/, '<script nonce="venue-library-preview">');
}
function renderOperationsReport(library,filters){
  const bootstrap=venueLibraryBootstrap(library),rows=reportRows(library,filters),generated=new Intl.DateTimeFormat("en-AU",{dateStyle:"long",timeStyle:"short",timeZone:"Australia/Melbourne"}).format(new Date());
  const body=rows.map(row=>`<tr><td>${escapeHtml(row["Master ID"])}</td><td><strong>${escapeHtml(row["Venue Name"])}</strong><small>${escapeHtml(row["Venue Type"])} · ${escapeHtml(row.Location)}</small></td><td><span class="light ${escapeHtml(row.Health)}"></span>${escapeHtml(row.Health)}</td><td>${escapeHtml(row["Gig Status"])}</td><td>${escapeHtml(row["Last Successful Update"]||"Never")}</td></tr>`).join("");
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>JookBox Venue Operations Report</title><style>body{margin:0;background:#05101e;color:#eef7ff;font:14px Arial,sans-serif}main{max-width:1200px;margin:auto;padding:38px}.head{display:flex;justify-content:space-between;gap:30px;border-bottom:3px solid #168cff;padding-bottom:18px}.eyebrow{color:#ff7d3d;font-weight:900;letter-spacing:.18em}h1{margin:.2em 0;font-size:38px}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:22px 0}.summary div{border:1px solid #244760;border-radius:10px;padding:14px;background:#0a2036}.summary strong{display:block;font-size:24px}table{width:100%;border-collapse:collapse;background:#071829}th,td{padding:11px;border-bottom:1px solid #1b3e58;text-align:left}th{color:#91adc3;font-size:10px;text-transform:uppercase;letter-spacing:.12em}td small{display:block;color:#8198aa}.light{display:inline-block;width:10px;height:10px;margin-right:7px;border-radius:50%;background:#708297}.light.red{background:#ff5668}.light.amber{background:#ffc759}.light.green{background:#54e59b}.foot{margin-top:18px;color:#7790a4;font-size:11px}@media print{body{background:#fff;color:#101820}main{max-width:none;padding:12mm}.summary div,table{background:#fff}.head{border-color:#166dcc}th,td{border-color:#cad4dc}.foot{color:#52606c}}</style></head><body><main><section class="head"><div><div class="eyebrow">DEEP CUTS STUDIO</div><h1>JookBox Venue Operations</h1><p>Local operational health report</p></div><div><strong>${escapeHtml(generated)}</strong><br>${rows.length} venue${rows.length===1?"":"s"}</div></section><section class="summary"><div><strong>${bootstrap.venueCount}</strong>Total venues</div><div><strong>${bootstrap.healthCounts.red}</strong>Red</div><div><strong>${bootstrap.healthCounts.amber}</strong>Amber</div><div><strong>${bootstrap.healthCounts.green}</strong>Green</div><div><strong>${bootstrap.healthCounts.grey}</strong>Not checked</div></section><table><thead><tr><th>Master ID</th><th>Venue</th><th>Health</th><th>Gig data</th><th>Last success</th></tr></thead><tbody>${body||'<tr><td colspan="5">No venues match the current filters.</td></tr>'}</tbody></table><p class="foot">This local report measures imports, checks, gig retrieval, ticker readiness, QR readiness and publication status. Public page views, scans and clicks require hosted analytics and are not estimated.</p></main><script nonce="venue-library-preview">window.addEventListener("load",()=>setTimeout(()=>window.print(),250),{once:true})</script></body></html>`;
}
function previewToken(preview){return crypto.createHash("sha256").update(`${preview.checksum}|${preview.parsedRows}|${preview.newCount}|${preview.updatedCount}|${preview.unchangedCount}`).digest("hex")}
async function readJson(request,limit=512*1024){const chunks=[];let total=0;for await(const chunk of request){total+=chunk.length;if(total>limit)throw new VenueLibraryError("Request is too large.","payload_too_large");chunks.push(chunk)}try{return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")): {}}catch{throw new VenueLibraryError("Request body must be valid JSON.","invalid_json")}}
async function streamUpload(request,target,limit){const handle=await fs.open(target,"w");const hash=crypto.createHash("sha256"),header=[];let headerBytes=0,sizeBytes=0;try{for await(const chunk of request){sizeBytes+=chunk.length;if(sizeBytes>limit)throw new VenueLibraryError(`Upload exceeds ${Math.round(limit/1024/1024)} MB.`,"payload_too_large");if(headerBytes<32){const slice=chunk.subarray(0,Math.min(chunk.length,32-headerBytes));header.push(slice);headerBytes+=slice.length}hash.update(chunk);await handle.write(chunk)}}finally{await handle.close()}return{sizeBytes,sha256:hash.digest("hex"),header:Buffer.concat(header)}}
function looksLikeMp4(bytes){return bytes.length>=12&&bytes.subarray(4,8).toString("ascii")==="ftyp"}
async function serveMedia(request,response,file,contentType){const stat=await fs.stat(file);const range=String(request.headers.range||"");if(!range){response.writeHead(200,{"content-type":contentType,"content-length":stat.size,"accept-ranges":"bytes","cache-control":"no-store"});createReadStream(file).pipe(response);return true}const match=range.match(/^bytes=(\d*)-(\d*)$/);if(!match){response.writeHead(416,{"content-range":`bytes */${stat.size}`});response.end();return true}const start=match[1]?Number(match[1]):0,end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||start>=stat.size){response.writeHead(416,{"content-range":`bytes */${stat.size}`});response.end();return true}response.writeHead(206,{"content-type":contentType,"content-length":end-start+1,"content-range":`bytes ${start}-${end}/${stat.size}`,"accept-ranges":"bytes","cache-control":"no-store"});createReadStream(file,{start,end}).pipe(response);return true}
async function mapLimit(items,limit,worker){const results=new Array(items.length);let cursor=0;async function run(){while(cursor<items.length){const index=cursor++;results[index]=await worker(items[index],index)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},run));return results}
function json(response,status,value){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(value));return true}
function html(response,value){response.setHeader("content-security-policy","default-src 'self'; script-src 'self' 'nonce-venue-library-preview'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; frame-src 'self' https://www.youtube-nocookie.com; connect-src 'self'");response.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});response.end(value);return true}
function csv(response,value,fileName){response.writeHead(200,{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${fileName.replace(/[^a-z0-9._-]/gi,"-")}"`,"cache-control":"no-store"});response.end(`\uFEFF${value}`);return true}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
