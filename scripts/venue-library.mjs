import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

export const VENUE_LIBRARY_SCHEMA="deep-cuts-venue-library/1";
export const VENUE_LIBRARY_ARCHIVE_RESET_VERSION=1;
export const VENUE_CSV_HEADERS=Object.freeze([
  "Research Date","Master ID","Venue Name","Venue Type","Website","Gigs / Shows / What’s On","Menu","Contact Us",
  "Instagram","Facebook","About Us","Location","Street Address","Suburb / City / Town","State","Postcode","Phone","Email",
  "Venue Capacity","Verification Notes"
]);
export const DEFAULT_HEALTH_THRESHOLDS=Object.freeze({slowMs:4000,staleDays:14,redAfterFailures:2});
const URL_FIELDS=Object.freeze(["websiteUrl","gigsUrl","menuUrl","contactUrl","instagramUrl","facebookUrl","aboutUrl"]);
const CSV_FIELD_MAP=Object.freeze({
  "Research Date":"researchDate","Master ID":"masterId","Venue Name":"venueName","Venue Type":"venueType","Website":"websiteUrl",
  "Gigs / Shows / What’s On":"gigsUrl","Menu":"menuUrl","Contact Us":"contactUrl","Instagram":"instagramUrl","Facebook":"facebookUrl",
  "About Us":"aboutUrl","Location":"location","Street Address":"streetAddress","Suburb / City / Town":"suburb","State":"state",
  "Postcode":"postcode","Phone":"phone","Email":"email","Venue Capacity":"venueCapacity","Verification Notes":"verificationNotes"
});

export class VenueLibraryError extends Error{
  constructor(message,code="venue_library_error",details={}){super(message);this.name="VenueLibraryError";this.code=code;this.details=details}
}

export function createVenueLibrary(now=new Date()){
  const timestamp=now.toISOString();
  return{
    schemaVersion:VENUE_LIBRARY_SCHEMA,
    revision:1,
    createdAt:timestamp,
    updatedAt:timestamp,
    settings:{masterFileName:"",masterChecksum:"",lastSyncAt:null,activeLibraryResetVersion:VENUE_LIBRARY_ARCHIVE_RESET_VERSION,activeLibraryResetAt:timestamp,healthThresholds:{...DEFAULT_HEALTH_THRESHOLDS}},
    venues:{},
    imports:[],
    updateRuns:[],
    publicationJobs:[],
    audit:[]
  };
}

export function migrateVenueLibrary(input,now=new Date()){
  if(!input||typeof input!=="object")return createVenueLibrary(now);
  if(input.schemaVersion!==VENUE_LIBRARY_SCHEMA)throw new VenueLibraryError("This venue library was created by an unsupported application version.","unsupported_library_schema");
  const library=structuredClone(input);
  library.settings={masterFileName:"",masterChecksum:"",lastSyncAt:null,healthThresholds:{...DEFAULT_HEALTH_THRESHOLDS},...(library.settings||{})};
  library.settings.healthThresholds={...DEFAULT_HEALTH_THRESHOLDS,...(library.settings.healthThresholds||{})};
  library.venues=library.venues&&typeof library.venues==="object"?library.venues:{};
  library.imports=Array.isArray(library.imports)?library.imports:[];
  library.updateRuns=Array.isArray(library.updateRuns)?library.updateRuns:[];
  library.publicationJobs=Array.isArray(library.publicationJobs)?library.publicationJobs:[];
  library.audit=Array.isArray(library.audit)?library.audit:[];
  for(const venue of Object.values(library.venues))venue.admin={publicationState:"draft",libraryVisibility:"active",libraryArchivedAt:null,publicEditionUrl:"",intendedQrUrl:"",tickerOverride:"",tickerPinnedNotice:"",aboutOverride:"",notes:"",customVideo:null,publication:null,sourceStudioProjectId:"",studioActions:[],...(venue.admin||{})};
  return library;
}

export function archiveLegacyVenueLibrary(library,{initiatingUser="Deep Cuts Studio migration",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);
  if(Number(next.settings.activeLibraryResetVersion||0)>=VENUE_LIBRARY_ARCHIVE_RESET_VERSION)return{library:next,changed:false,archivedCount:0};
  const timestamp=now.toISOString();let archivedCount=0;
  for(const venue of Object.values(next.venues)){
    venue.admin.libraryVisibility="archived";venue.admin.libraryArchivedAt=venue.admin.libraryArchivedAt||timestamp;
    venue.revision=Number(venue.revision||0)+1;venue.updatedAt=timestamp;archivedCount++;
  }
  next.settings.activeLibraryResetVersion=VENUE_LIBRARY_ARCHIVE_RESET_VERSION;next.settings.activeLibraryResetAt=timestamp;
  next.audit=[auditEntry("active_venue_library_archived",initiatingUser,{archivedCount,preservedPublicEditions:true},timestamp),...next.audit].slice(0,5000);
  touchLibrary(next,timestamp);return{library:next,changed:true,archivedCount};
}

export function setVenueLibraryVisibility(library,id,visibility,{initiatingUser="Local administrator",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now),venue=next.venues?.[id];
  if(!venue)throw new VenueLibraryError("Venue not found.","venue_not_found");
  const target=oneOf(visibility,["active","archived"],"active"),timestamp=now.toISOString();
  venue.admin.libraryVisibility=target;venue.admin.libraryArchivedAt=target==="archived"?timestamp:null;
  if(target==="active"&&venue.admin.publicationState==="archived")venue.admin.publicationState="draft";
  venue.revision=Number(venue.revision||0)+1;venue.updatedAt=timestamp;
  next.audit=[auditEntry(target==="active"?"venue_returned_to_active_library":"venue_hidden_from_active_library",initiatingUser,{venueId:id,masterId:venue.masterId,preservedPublicEditionUrl:venue.admin.publicEditionUrl||""},timestamp),...next.audit].slice(0,5000);
  touchLibrary(next,timestamp);return{library:next,venue:structuredClone(venue)};
}

export function parseVenueCsv(text){
  const source=String(text??"").replace(/^\uFEFF/,"");
  if(!source.trim())throw new VenueLibraryError("The selected CSV is empty.","empty_csv");
  const table=parseCsvRows(source);
  if(table.length<2)throw new VenueLibraryError("The CSV has a header but no venue records.","empty_csv_rows");
  const headers=table[0].map(value=>value.trim());
  const missing=VENUE_CSV_HEADERS.filter(header=>!headers.includes(header));
  const unexpected=headers.filter(header=>!VENUE_CSV_HEADERS.includes(header));
  if(missing.length||unexpected.length)throw new VenueLibraryError("The CSV columns do not match the venue master format.","invalid_csv_headers",{missing,unexpected});
  const index=new Map(headers.map((header,position)=>[header,position]));
  return table.slice(1).filter(row=>row.some(value=>String(value).trim())).map((row,rowIndex)=>{
    const record={};
    for(const header of VENUE_CSV_HEADERS)record[CSV_FIELD_MAP[header]]=String(row[index.get(header)]??"").trim();
    return normalizeCsvVenue(record,rowIndex+2);
  });
}

export function previewVenueSync(library,csvText,{fileName="venue-master.csv",now=new Date()}={}){
  const records=parseVenueCsv(csvText);
  const issues=[];
  const accepted=[];
  const masterIds=new Map();
  const names=new Map();
  for(const record of records){
    const rowIssues=validateCsvVenue(record);
    if(masterIds.has(record.masterId)){
      rowIssues.push({field:"Master ID",code:"duplicate_master_id",message:`Duplicate Master ID also appears on row ${masterIds.get(record.masterId)}.`});
    }else if(record.masterId)masterIds.set(record.masterId,record.sourceRow);
    const nameKey=record.venueName.toLocaleLowerCase("en-AU");
    if(nameKey&&names.has(nameKey))rowIssues.push({field:"Venue Name",code:"possible_duplicate_name",severity:"warning",message:`Venue name also appears on row ${names.get(nameKey)}.`});
    else if(nameKey)names.set(nameKey,record.sourceRow);
    const rejected=rowIssues.some(issue=>(issue.severity||"error")==="error");
    issues.push(...rowIssues.map(issue=>({...issue,row:record.sourceRow,masterId:record.masterId,venueName:record.venueName})));
    if(!rejected)accepted.push(record);
  }
  const existingByMaster=new Map(Object.values(library.venues||{}).map(venue=>[venue.masterId,venue]));
  const changes={new:[],updated:[],unchanged:[]};
  for(const record of accepted){
    const existing=existingByMaster.get(record.masterId);
    if(!existing)changes.new.push(record.masterId);
    else if(csvFingerprint(record)!==existing.csvFingerprint)changes.updated.push(record.masterId);
    else changes.unchanged.push(record.masterId);
  }
  const checksum=crypto.createHash("sha256").update(String(csvText)).digest("hex");
  return{
    schemaVersion:"deep-cuts-venue-import-preview/1",
    fileName:clean(fileName,240)||"venue-master.csv",
    checksum,
    previewedAt:now.toISOString(),
    parsedRows:records.length,
    acceptedRows:accepted.length,
    rejectedRows:records.length-accepted.length,
    newCount:changes.new.length,
    updatedCount:changes.updated.length,
    unchangedCount:changes.unchanged.length,
    warningCount:issues.filter(issue=>issue.severity==="warning").length,
    errors:issues.filter(issue=>(issue.severity||"error")==="error"),
    warnings:issues.filter(issue=>issue.severity==="warning"),
    changes,
    records:accepted
  };
}

export function applyVenueSync(library,preview,{initiatingUser="Local administrator",now=new Date()}={}){
  if(!preview||preview.schemaVersion!=="deep-cuts-venue-import-preview/1")throw new VenueLibraryError("Import preview is missing or invalid.","invalid_import_preview");
  const next=migrateVenueLibrary(library,now);
  const timestamp=now.toISOString();
  for(const record of preview.records){
    const existing=findVenueByMasterId(next,record.masterId);
    if(existing){
      existing.csv=csvRecordForStorage(record);
      existing.csvFingerprint=csvFingerprint(record);
      existing.csvUpdatedAt=timestamp;
      existing.updatedAt=timestamp;
      existing.revision=Number(existing.revision||0)+1;
      existing.health=deriveOverallHealth(existing,next.settings.healthThresholds,now);
    }else{
      const id=venueInternalId(record.masterId);
      next.venues[id]=createVenueRecord(id,record,timestamp);
    }
  }
  const importRecord={
    id:`import_${crypto.randomUUID()}`,fileName:preview.fileName,checksum:preview.checksum,startedAt:preview.previewedAt,completedAt:timestamp,
    initiatingUser,parsedRows:preview.parsedRows,acceptedRows:preview.acceptedRows,rejectedRows:preview.rejectedRows,
    newCount:preview.newCount,updatedCount:preview.updatedCount,unchangedCount:preview.unchangedCount,warningCount:preview.warningCount,
    result:preview.rejectedRows?"completed_with_warnings":"completed"
  };
  next.settings.masterFileName=preview.fileName;
  next.settings.masterChecksum=preview.checksum;
  next.settings.lastSyncAt=timestamp;
  next.imports=[importRecord,...next.imports].slice(0,200);
  next.audit=[auditEntry("master_csv_synchronised",initiatingUser,{importId:importRecord.id,...countsFromPreview(preview)},timestamp),...next.audit].slice(0,5000);
  touchLibrary(next,timestamp);
  return{library:next,importRecord};
}

export function listVenueSummaries(library,filters={}){
  const search=String(filters.search||"").trim().toLocaleLowerCase("en-AU");
  const health=String(filters.health||"");
  const publication=String(filters.publication||"");
  const video=String(filters.video||"");
  const venueType=String(filters.venueType||"");
  const location=String(filters.location||"");
  const gigFreshness=String(filters.gigFreshness||"");
  const updateState=String(filters.updateState||"");
  const updateOutcome=String(filters.updateOutcome||"");
  const sort=String(filters.sort||"health");
  const visibility=String(filters.visibility||"active");
  const values=Object.values(library.venues||{}).filter(venue=>{
    const csv=venue.csv||{};
    if(visibility!=="all"&&(venue.admin?.libraryVisibility||"active")!==visibility)return false;
    if(search&&!`${venue.masterId} ${csv.venueName}`.toLocaleLowerCase("en-AU").includes(search))return false;
    if(health&&venue.health?.overall!==health)return false;
    if(publication&&venue.admin?.publicationState!==publication)return false;
    if(video==="present"&&!venue.admin?.customVideo)return false;
    if(video==="missing"&&venue.admin?.customVideo)return false;
    if(venueType&&csv.venueType!==venueType)return false;
    if(location&&![csv.location,csv.suburb].includes(location))return false;
    if(gigFreshness&&(venue.automated?.gigStatus||"never_checked")!==gigFreshness)return false;
    if(updateState==="updated"&&!venue.lastUpdateAttempt)return false;
    if(updateState==="not_updated"&&venue.lastUpdateAttempt)return false;
    if(updateOutcome&&(venue.lastUpdateResult?.status||"")!==updateOutcome)return false;
    return true;
  }).map(venue=>venueSummary(venue));
  values.sort(summarySorter(sort));
  return values;
}

export function venueLibraryBootstrap(library){
  const venues=listVenueSummaries(library);
  const archivedVenueCount=Object.values(library.venues||{}).filter(venue=>(venue.admin?.libraryVisibility||"active")==="archived").length;
  const healthCounts={red:0,amber:0,green:0,grey:0};
  for(const venue of venues)healthCounts[venue.health]=(healthCounts[venue.health]||0)+1;
  return{
    schemaVersion:VENUE_LIBRARY_SCHEMA,
    venueCount:venues.length,
    archivedVenueCount,
    healthCounts,
    publicationCounts:countBy(venues,venue=>venue.publicationState),
    videoCounts:countBy(venues,venue=>venue.videoStatus),
    lastSyncAt:library.settings.lastSyncAt,
    masterFileName:library.settings.masterFileName,
    lastAttemptedFullUpdate:library.updateRuns.find(run=>run.scope==="all")?.startedAt||null,
    lastSuccessfulFullUpdate:library.updateRuns.find(run=>run.scope==="all"&&run.status==="completed"&&run.failureCount===0)?.finishedAt||null,
    venueTypes:uniqueSorted(venues.map(venue=>venue.venueType)),
    locations:uniqueSorted(venues.flatMap(venue=>[venue.location,venue.suburb]).filter(Boolean)),
    analyticsNotice:"Public visitor analytics requires hosted analytics. This local release reports only imports, checks, updates, gigs, tickers, QR readiness and publication state.",
    dataModel:"Master ID is the immutable CSV key. CSV fields, automated results and administrator overrides are stored separately."
  };
}

export function getVenue(library,idOrMasterId){
  const venue=library.venues?.[idOrMasterId]||findVenueByMasterId(library,idOrMasterId);
  if(!venue)throw new VenueLibraryError("Venue not found.","venue_not_found");
  return structuredClone(venue);
}

export function updateVenue(library,id,changes,{expectedRevision,initiatingUser="Local administrator",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);
  const venue=next.venues?.[id];
  if(!venue)throw new VenueLibraryError("Venue not found.","venue_not_found");
  if(expectedRevision!==undefined&&Number(expectedRevision)!==Number(venue.revision))throw new VenueLibraryError("This venue changed after you opened it. Reload before saving so newer work is not lost.","stale_venue_revision");
  const admin=changes?.admin||{};
  venue.admin={
    ...venue.admin,
    publicationState:oneOf(admin.publicationState??venue.admin.publicationState,["draft","published","archived"],"draft"),
    publicEditionUrl:optionalHttpsUrl(admin.publicEditionUrl??venue.admin.publicEditionUrl),
    intendedQrUrl:optionalHttpsUrl(admin.intendedQrUrl??venue.admin.intendedQrUrl),
    tickerOverride:cleanMultiline(admin.tickerOverride??venue.admin.tickerOverride,1600),
    tickerPinnedNotice:cleanMultiline(admin.tickerPinnedNotice??venue.admin.tickerPinnedNotice,500),
    aboutOverride:cleanMultiline(admin.aboutOverride??venue.admin.aboutOverride,3000),
    notes:cleanMultiline(admin.notes??venue.admin.notes,2000)
  };
  if(admin.removeTickerOverride===true)venue.admin.tickerOverride="";
  if(admin.removeAboutOverride===true)venue.admin.aboutOverride="";
  venue.revision=Number(venue.revision||0)+1;
  venue.updatedAt=now.toISOString();
  venue.health=deriveOverallHealth(venue,next.settings.healthThresholds,now);
  next.audit=[auditEntry("venue_edited",initiatingUser,{venueId:id,masterId:venue.masterId},venue.updatedAt),...next.audit].slice(0,5000);
  touchLibrary(next,venue.updatedAt);
  return{library:next,venue:structuredClone(venue)};
}

export function attachVenueVideo(library,id,video,{initiatingUser="Local administrator",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);const venue=next.venues?.[id];
  if(!venue)throw new VenueLibraryError("Venue not found.","venue_not_found");
  venue.admin.customVideo={fileName:clean(video.fileName,180),sizeBytes:Number(video.sizeBytes),sha256:String(video.sha256||""),uploadedAt:now.toISOString()};
  venue.revision+=1;venue.updatedAt=now.toISOString();venue.health=deriveOverallHealth(venue,next.settings.healthThresholds,now);
  next.audit=[auditEntry("venue_video_added",initiatingUser,{venueId:id,masterId:venue.masterId,fileName:venue.admin.customVideo.fileName},venue.updatedAt),...next.audit].slice(0,5000);
  touchLibrary(next,venue.updatedAt);return{library:next,venue:structuredClone(venue)};
}

export function removeVenueVideo(library,id,{initiatingUser="Local administrator",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);const venue=next.venues?.[id];
  if(!venue)throw new VenueLibraryError("Venue not found.","venue_not_found");
  venue.admin.customVideo=null;venue.revision+=1;venue.updatedAt=now.toISOString();venue.health=deriveOverallHealth(venue,next.settings.healthThresholds,now);
  next.audit=[auditEntry("venue_video_removed",initiatingUser,{venueId:id,masterId:venue.masterId},venue.updatedAt),...next.audit].slice(0,5000);
  touchLibrary(next,venue.updatedAt);return{library:next,venue:structuredClone(venue)};
}

export function createVenuePublicationJob(library,id,{initiatingUser="Local administrator",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);const venue=next.venues?.[id];
  if(!venue)throw new VenueLibraryError("Venue not found.","venue_not_found");
  const active=next.publicationJobs.find(job=>job.venueId===id&&["queued","running"].includes(job.status));
  if(active)throw new VenueLibraryError("This venue already has a secure publication in progress.","publication_in_progress");
  const timestamp=now.toISOString();
  const job={id:`publication_${crypto.randomUUID()}`,venueId:id,masterId:venue.masterId,venueName:venue.csv.venueName,status:"queued",stage:"queued",message:"Secure publication queued",createdAt:timestamp,startedAt:null,finishedAt:null,prUrl:"",branch:"",editionId:"",slug:"",liveUrl:"",qrImageUrl:"",deploymentUrl:"",errorCode:"",error:""};
  next.publicationJobs=[job,...next.publicationJobs].slice(0,500);
  venue.admin.publication={jobId:job.id,status:job.status,stage:job.stage,message:job.message,updatedAt:timestamp};
  venue.revision+=1;venue.updatedAt=timestamp;
  next.audit=[auditEntry("venue_publication_queued",initiatingUser,{venueId:id,masterId:venue.masterId,publicationJobId:job.id},timestamp),...next.audit].slice(0,5000);
  touchLibrary(next,timestamp);return{library:next,job:structuredClone(job),venue:structuredClone(venue)};
}

export function updateVenuePublicationJob(library,jobId,changes,{initiatingUser="Deep Cuts secure publisher",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);const job=next.publicationJobs.find(item=>item.id===jobId);
  if(!job)throw new VenueLibraryError("Publication job not found.","publication_job_not_found");
  const venue=next.venues?.[job.venueId];if(!venue)throw new VenueLibraryError("Publication venue not found.","venue_not_found");
  const timestamp=now.toISOString();
  Object.assign(job,pickPublicationChanges(changes));
  if(job.status==="running"&&!job.startedAt)job.startedAt=timestamp;
  if(["published","failed","interrupted"].includes(job.status)&&!job.finishedAt)job.finishedAt=timestamp;
  venue.admin.publication={jobId:job.id,status:job.status,stage:job.stage,message:job.message,prUrl:job.prUrl,editionId:job.editionId,slug:job.slug,liveUrl:job.liveUrl,qrImageUrl:job.qrImageUrl,deploymentUrl:job.deploymentUrl,errorCode:job.errorCode,error:job.error,updatedAt:timestamp};
  if(job.status==="published"){
    venue.admin.publicationState="published";venue.admin.publicEditionUrl=job.liveUrl;venue.admin.intendedQrUrl=job.liveUrl;
    venue.automated.qr={state:"green",label:"Ready for generation",destination:job.liveUrl,publiclyDistributable:true,checkedAt:timestamp,qrImageUrl:job.qrImageUrl};
  }
  venue.revision+=1;venue.updatedAt=timestamp;venue.health=deriveOverallHealth(venue,next.settings.healthThresholds,now);
  if(["published","failed","interrupted"].includes(job.status))next.audit=[auditEntry(job.status==="published"?"venue_published":"venue_publication_failed",initiatingUser,{venueId:venue.id,masterId:venue.masterId,publicationJobId:job.id,status:job.status,editionId:job.editionId,liveUrl:job.liveUrl,errorCode:job.errorCode},timestamp),...next.audit].slice(0,5000);
  touchLibrary(next,timestamp);return{library:next,job:structuredClone(job),venue:structuredClone(venue)};
}

export function upsertStudioVenue(library,project,{initiatingUser="Deep Cuts Studio",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);
  if(project?.schemaVersion!=="deep-cuts-studio-project/1"||project?.input?.type!=="bar_jukebox")throw new VenueLibraryError("Only a complete Bar Edition Studio project can be saved to Venue Library.","invalid_studio_venue");
  if(project?.readiness?.handoffReady!==true)throw new VenueLibraryError((project?.readiness?.blockers||[]).join(" ")||"Complete the Bar Edition before saving it to Venue Library.","studio_venue_not_ready");
  const sourceUrls=Array.isArray(project.input.sourceUrls)?project.input.sourceUrls:[];
  const sourceLabels=Array.isArray(project.input.sourceLabels)?project.input.sourceLabels:[];
  if(sourceUrls.length!==5||sourceLabels.length!==5)throw new VenueLibraryError("Exactly five labelled HTTPS destinations are required.","studio_venue_destinations_invalid");
  const actions=sourceUrls.map((url,index)=>({label:clean(sourceLabels[index],42),url:normalizeUrl(url)}));
  if(actions.some(action=>!action.label||!/^https:\/\//i.test(action.url)))throw new VenueLibraryError("Exactly five labelled HTTPS destinations are required.","studio_venue_destinations_invalid");
  const timestamp=now.toISOString(),masterId=`Studio_${String(project.id).replace(/^studio_/,"")}`,id=venueInternalId(masterId);
  const record=normalizeCsvVenue({
    researchDate:timestamp.slice(0,10),masterId,venueName:project.input.name,venueType:"Bar Edition",websiteUrl:actions[0].url,
    gigsUrl:actions.find(action=>/gig|show|event|what'?s on/i.test(action.label))?.url||actions[0].url,
    menuUrl:actions.find(action=>/menu|eat|drink/i.test(action.label))?.url||actions[1].url,
    contactUrl:actions.find(action=>/contact|book|enquir/i.test(action.label))?.url||actions[2].url,
    instagramUrl:actions.find(action=>/instagram/i.test(action.label))?.url||actions[3].url,
    facebookUrl:actions.find(action=>/facebook/i.test(action.label))?.url||actions[4].url,
    aboutUrl:actions[0].url,location:"",streetAddress:"",suburb:"",state:"VIC",postcode:"",phone:"",email:"",venueCapacity:"",
    verificationNotes:"Administrator-supplied Bar Edition Studio project."
  },0);
  let venue=next.venues[id];
  if(!venue){
    venue=createVenueRecord(id,record,timestamp);next.venues[id]=venue;
  }else{
    venue.csv={...venue.csv,...csvRecordForStorage(record)};venue.csvFingerprint=csvFingerprint(record);venue.csvUpdatedAt=timestamp;
    venue.revision=Number(venue.revision||0)+1;venue.updatedAt=timestamp;
  }
  venue.admin={...venue.admin,libraryVisibility:"active",libraryArchivedAt:null,sourceStudioProjectId:project.id,studioActions:actions,tickerOverride:cleanMultiline(project.input.tickerText,1600),aboutOverride:cleanMultiline(project.input.aboutText,3000)};
  venue.health=deriveOverallHealth(venue,next.settings.healthThresholds,now);
  next.audit=[auditEntry("studio_venue_saved",initiatingUser,{venueId:id,masterId,sourceStudioProjectId:project.id,actionCount:actions.length,preservedPublicIdentity:Boolean(venue.admin.publicEditionUrl)},timestamp),...next.audit].slice(0,5000);
  touchLibrary(next,timestamp);
  return{library:next,venue:structuredClone(venue),created:venue.createdAt===timestamp&&venue.revision===1};
}

export function setVenuePublicationState(library,id,published,{publication=null,initiatingUser="Deep Cuts secure publisher",now=new Date()}={}){
  const next=migrateVenueLibrary(library,now),venue=next.venues?.[id];if(!venue)throw new VenueLibraryError("Venue not found.","venue_not_found");
  const timestamp=now.toISOString();venue.admin.publicationState=published?"published":"draft";
  if(publication)venue.admin.publication={...(venue.admin.publication||{}),...publication,status:published?"published":"unpublished",stage:published?"published":"unpublished",updatedAt:timestamp};
  venue.revision=Number(venue.revision||0)+1;venue.updatedAt=timestamp;
  next.audit=[auditEntry(published?"venue_republished":"venue_unpublished",initiatingUser,{venueId:id,masterId:venue.masterId,editionId:venue.admin.publication?.editionId||"",liveUrl:venue.admin.publicEditionUrl||"",identityPreserved:true},timestamp),...next.audit].slice(0,5000);
  touchLibrary(next,timestamp);return{library:next,venue:structuredClone(venue)};
}

export function interruptVenuePublications(library,{now=new Date()}={}){
  let next=migrateVenueLibrary(library,now),changed=false;
  for(const job of next.publicationJobs.filter(item=>["queued","running"].includes(item.status))){
    next=updateVenuePublicationJob(next,job.id,{status:"interrupted",stage:"interrupted",message:"Studio closed before publication completed. Press Publish Venue to retry safely.",errorCode:"publication_interrupted",error:"The local publication monitor stopped before completion."},{now}).library;changed=true;
  }
  return{library:next,changed};
}

export function createUpdateRun({venueIds,operations={},scope="selected",parentRunId=null,applicationVersion="",initiatingUser="Local administrator",now=new Date()}){
  const ids=[...new Set((venueIds||[]).map(String))];
  return{
    id:`run_${crypto.randomUUID()}`,parentRunId,scope,status:"queued",applicationVersion,initiatingUser,startedAt:now.toISOString(),finishedAt:null,
    selectedOperations:{syncCsv:false,checkUrls:true,retrieveGigs:true,regenerateTickers:true,regenerateQr:false,...operations},
    venueIds:ids,totalCount:ids.length,completedCount:0,successCount:0,warningCount:0,failureCount:0,skippedCount:0,cancelledCount:0,
    currentVenueId:null,currentVenueName:"",currentOperation:"Waiting",cancelRequested:false,results:[]
  };
}

export function startRun(library,run,now=new Date()){
  const next=migrateVenueLibrary(library,now);run={...run,status:"running",startedAt:now.toISOString(),currentOperation:"Starting"};
  next.updateRuns=[run,...next.updateRuns].slice(0,250);touchLibrary(next,run.startedAt);return{library:next,run};
}

export function recordRunVenueResult(library,runId,result,now=new Date()){
  const next=migrateVenueLibrary(library,now);const run=next.updateRuns.find(item=>item.id===runId);
  if(!run)throw new VenueLibraryError("Update run not found.","run_not_found");
  run.results.push({...result,completedAt:result.completedAt||now.toISOString()});run.completedCount=run.results.length;
  const state=result.status||"failed";if(state==="success")run.successCount++;else if(state==="warning")run.warningCount++;else if(state==="skipped")run.skippedCount++;else if(state==="cancelled")run.cancelledCount++;else run.failureCount++;
  run.currentVenueId=null;run.currentVenueName="";run.currentOperation="Waiting";touchLibrary(next,now.toISOString());return{library:next,run};
}

export function finishRun(library,runId,{cancelled=false,now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);const run=next.updateRuns.find(item=>item.id===runId);
  if(!run)throw new VenueLibraryError("Update run not found.","run_not_found");
  run.status=cancelled?"cancelled":"completed";run.finishedAt=now.toISOString();run.currentOperation=cancelled?"Cancelled":"Complete";touchLibrary(next,run.finishedAt);return{library:next,run};
}

export function markVenueUpdate(library,id,update,{now=new Date()}={}){
  const next=migrateVenueLibrary(library,now);const venue=next.venues?.[id];
  if(!venue)throw new VenueLibraryError("Venue not found.","venue_not_found");
  venue.automated={...venue.automated,...(update.automated||{})};
  venue.healthChecks={...venue.healthChecks,...(update.healthChecks||{})};
  venue.lastUpdateAttempt=now.toISOString();
  if(update.status!=="failed")venue.lastSuccessfulUpdate=now.toISOString();
  venue.lastUpdateResult={status:update.status||"success",summary:clean(update.summary,500),warnings:update.warnings||[],errors:update.errors||[],runId:update.runId||null,completedAt:now.toISOString()};
  venue.health=deriveOverallHealth(venue,next.settings.healthThresholds,now);venue.revision+=1;venue.updatedAt=now.toISOString();touchLibrary(next,venue.updatedAt);return{library:next,venue};
}

export async function fetchSafeUrl(rawUrl,{timeoutMs=10000,maxBytes=2*1024*1024,maxRedirects=4,accept="text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.2",fetchImpl=fetch,dnsLookup=dns.lookup}={}){
  let current=validatedPublicHttpUrl(rawUrl);
  const started=Date.now();
  for(let redirectCount=0;redirectCount<=maxRedirects;redirectCount++){
    await assertPublicHost(current,dnsLookup);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    let response;
    try{
      response=await fetchImpl(current,{method:"GET",redirect:"manual",signal:controller.signal,headers:{accept,"user-agent":"Deep-Cuts-Studio-Venue-Health/1.0"}});
    }catch(error){
      clearTimeout(timer);
      const reason=error?.name==="AbortError"?"timeout":classifyNetworkError(error);
      throw new VenueLibraryError(reason==="timeout"?"The request timed out.":"The destination could not be reached.",reason,{url:current.href,cause:error?.message});
    }
    clearTimeout(timer);
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get("location");
      if(!location)throw new VenueLibraryError("The destination returned an invalid redirect.","redirect_error",{url:current.href,status:response.status});
      if(redirectCount===maxRedirects)throw new VenueLibraryError("The destination redirected too many times.","redirect_error",{url:current.href,status:response.status});
      current=validatedPublicHttpUrl(new URL(location,current).href);continue;
    }
    const body=await readLimitedResponse(response,maxBytes);
    return{ok:response.ok,status:response.status,finalUrl:current.href,durationMs:Date.now()-started,contentType:response.headers.get("content-type")||"",body,redirectCount};
  }
  throw new VenueLibraryError("The destination redirected too many times.","redirect_error",{url:current.href});
}

export function extractEventsFromHtml(html,{venueId,sourceUrl,now=new Date()}={}){
  const source=String(html||"");const events=[];const evidence=[];
  const scripts=[...source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for(const script of scripts){
    try{
      const parsed=JSON.parse(decodeHtmlEntities(script[1].trim()));
      for(const candidate of flattenJsonLd(parsed)){
        if(!hasJsonLdType(candidate,"Event"))continue;
        const event=normalizeEvent(candidate,{venueId,sourceUrl,now});if(event)events.push(event);
      }
      evidence.push({kind:"json_ld",parsed:true});
    }catch(error){evidence.push({kind:"json_ld",parsed:false,error:clean(error.message,180)})}
  }
  const unique=new Map();for(const event of events)unique.set(event.contentHash,event);
  return{events:[...unique.values()].sort((a,b)=>a.startDate.localeCompare(b.startDate)),evidence,method:scripts.length?"schema.org/Event JSON-LD":"no_supported_events"};
}

export function mergeVenueEvents(existing,incoming,{now=new Date()}={}){
  const today=now.getTime();const byKey=new Map((existing||[]).map(event=>[event.sourceSpecificId||event.contentHash,{...event}]));
  for(const event of incoming||[])byKey.set(event.sourceSpecificId||event.contentHash,{...event,publicationState:new Date(event.startDate).getTime()<today?"expired":"current"});
  for(const event of byKey.values())if(new Date(event.startDate).getTime()<today)event.publicationState="expired";
  return [...byKey.values()].sort((a,b)=>a.startDate.localeCompare(b.startDate));
}

export function generateVenueTicker(events,{pinnedNotice="",now=new Date()}={}){
  const nowMs=now.getTime();const current=(events||[]).filter(event=>event.publicationState!=="expired"&&new Date(event.startDate).getTime()>=nowMs).slice(0,8);
  const entries=current.map(event=>{
    const date=new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Melbourne",weekday:"short",day:"numeric",month:"short"}).format(new Date(event.startDate)).toUpperCase();
    const time=event.startDate.includes("T")?new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Melbourne",hour:"numeric",minute:"2-digit"}).format(new Date(event.startDate)).toUpperCase():"";
    return `${date}${time?` ${time}`:""} — ${event.title}${event.eventUrl?" — DETAILS & TICKETS":""}`;
  });
  if(cleanMultiline(pinnedNotice,500))entries.unshift(cleanMultiline(pinnedNotice,500).toUpperCase());
  return{tickerText:entries.join("   ★   "),eventIds:current.map(event=>event.id),generatedAt:now.toISOString(),entryCount:entries.length};
}

export function deriveOverallHealth(venue,thresholds=DEFAULT_HEALTH_THRESHOLDS,now=new Date()){
  const checks=Object.values(venue.healthChecks||{});const currentFailures=checks.filter(check=>check?.success===false);const successes=checks.filter(check=>check?.success===true);
  const consecutive=Math.max(0,...currentFailures.map(check=>Number(check.consecutiveFailureCount||0)));
  const requiredComplete=["venueName","websiteUrl","gigsUrl","menuUrl","contactUrl","instagramUrl","facebookUrl","aboutUrl"].every(field=>Boolean(venue.csv?.[field]));
  const stale=venue.lastSuccessfulUpdate?now.getTime()-new Date(venue.lastSuccessfulUpdate).getTime()>Number(thresholds.staleDays||14)*86400000:true;
  let overall="grey",reason="Never checked";
  if(!checks.length&&!venue.lastUpdateAttempt)return{overall,reason,updatedAt:now.toISOString(),components:{dataCompleteness:requiredComplete?"green":"amber",freshness:"grey",destinations:"grey",video:venue.admin?.customVideo?"green":"grey",qr:qrStatusFor(venue).state}};
  if(currentFailures.some(check=>check.critical===true)||consecutive>=Number(thresholds.redAfterFailures||2)){overall="red";reason=currentFailures[0]?.errorSummary||"Repeated destination failures"}
  else if(currentFailures.length||successes.some(check=>Number(check.durationMs)>Number(thresholds.slowMs||4000))||stale||!requiredComplete){overall="amber";reason=currentFailures[0]?.errorSummary||(!requiredComplete?"Venue data is incomplete":stale?"Information may be stale":"A destination is slow")}
  else if(successes.length){overall="green";reason="Most recent checks succeeded"}
  return{overall,reason,updatedAt:now.toISOString(),components:{dataCompleteness:requiredComplete?"green":"amber",freshness:stale?"amber":venue.lastSuccessfulUpdate?"green":"grey",destinations:successes.length?(currentFailures.length?"amber":"green"):"grey",video:venue.admin?.customVideo?"green":"grey",qr:qrStatusFor(venue).state}};
}

export function reportRows(library,filters={}){
  return listVenueSummaries(library,filters).map(summary=>({
    "Master ID":summary.masterId,"Venue Name":summary.venueName,"Venue Type":summary.venueType,"Location":summary.location,"Health":summary.health,
    "Health Reason":summary.healthReason,"Publication State":summary.publicationState,"Video Status":summary.videoStatus,"Gig Status":summary.gigStatus,
    "Last Update Attempt":summary.lastUpdateAttempt||"","Last Successful Update":summary.lastSuccessfulUpdate||"","Last Edited":summary.updatedAt||"",
    "Public Analytics":"Requires hosted analytics"
  }));
}

export function encodeCsv(rows){
  if(!rows.length)return"";const headers=Object.keys(rows[0]);
  return `${headers.map(csvCell).join(",")}\r\n${rows.map(row=>headers.map(header=>csvCell(row[header])).join(",")).join("\r\n")}\r\n`;
}

export function qrStatusFor(venue){
  const destination=venue.admin?.publicEditionUrl||venue.admin?.intendedQrUrl||"";
  if(!destination)return{state:"grey",label:"Publication URL required",destination:"",publiclyDistributable:false};
  return{state:venue.admin?.publicEditionUrl?"green":"amber",label:venue.admin?.publicEditionUrl?"Ready for generation":"Intended URL only — not approved for distribution",destination,publiclyDistributable:Boolean(venue.admin?.publicEditionUrl)};
}

export function effectiveVenueContent(venue){
  const generated=venue.automated?.generatedTicker?.tickerText||"";
  return{
    tickerText:generated||venue.admin?.tickerOverride||`${venue.csv.venueName.toUpperCase()} — ${[venue.csv.location,venue.csv.venueType].filter(Boolean).join(" — ").toUpperCase()}`,
    aboutText:venue.admin?.aboutOverride||factualAbout(venue.csv),
    tickerSource:generated?"verified_gigs_events":venue.admin?.tickerOverride?"manual_fallback":"csv_facts",
    aboutSource:venue.admin?.aboutOverride?"manual_override":"csv_facts"
  };
}

function createVenueRecord(id,record,timestamp){
  const venue={
    id,masterId:record.masterId,revision:1,csv:csvRecordForStorage(record),csvFingerprint:csvFingerprint(record),csvImportedAt:timestamp,csvUpdatedAt:timestamp,
    admin:{publicationState:"draft",libraryVisibility:"active",libraryArchivedAt:null,publicEditionUrl:"",intendedQrUrl:"",tickerOverride:"",tickerPinnedNotice:"",aboutOverride:"",notes:"",customVideo:null,publication:null,sourceStudioProjectId:"",studioActions:[]},
    automated:{events:[],gigStatus:"never_checked",gigEvidence:[],generatedTicker:null,lastGigAttempt:null,lastGigSuccess:null},
    healthChecks:{},health:null,lastUpdateAttempt:null,lastSuccessfulUpdate:null,lastUpdateResult:null,createdAt:timestamp,updatedAt:timestamp
  };
  venue.health=deriveOverallHealth(venue,DEFAULT_HEALTH_THRESHOLDS,new Date(timestamp));return venue;
}
function normalizeCsvVenue(record,sourceRow){
  const normalized={...record,sourceRow};
  for(const field of URL_FIELDS)normalized[field]=normalizeUrl(record[field]);
  normalized.researchDate=String(record.researchDate||"").trim();normalized.masterId=clean(record.masterId,80);normalized.venueName=clean(record.venueName,180);
  normalized.venueType=clean(record.venueType,180);normalized.location=clean(record.location,180);normalized.streetAddress=clean(record.streetAddress,240);
  normalized.suburb=clean(record.suburb,120);normalized.state=clean(record.state,30);normalized.postcode=clean(record.postcode,20);normalized.phone=clean(record.phone,80);
  normalized.email=clean(record.email,180);normalized.venueCapacity=String(record.venueCapacity||"").trim();normalized.verificationNotes=cleanMultiline(record.verificationNotes,1200);
  return normalized;
}
function validateCsvVenue(record){
  const issues=[];const error=(field,code,message)=>issues.push({field,code,message});const warning=(field,code,message)=>issues.push({field,code,message,severity:"warning"});
  if(!record.masterId)error("Master ID","required_master_id","Master ID is required.");else if(!/^Aggits_\d{3,}$/i.test(record.masterId))warning("Master ID","unexpected_master_id_format","Master ID does not use the expected Aggits_001 format.");
  if(!record.venueName)error("Venue Name","required_venue_name","Venue name is required.");
  if(record.researchDate&&!/^\d{4}-\d{2}-\d{2}$/.test(record.researchDate))error("Research Date","invalid_research_date","Research date must use YYYY-MM-DD.");
  for(const field of URL_FIELDS)if(record[field]&&!isHttpUrl(record[field]))error(field,"invalid_url",`${field} must be a complete HTTP or HTTPS URL.`);
  if(record.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email))error("Email","invalid_email","Email address is not valid.");
  if(record.postcode&&!/^\d{4}$/.test(record.postcode))warning("Postcode","unexpected_postcode","Victorian postcodes normally contain four digits.");
  if(record.venueCapacity&&!/^\d+$/.test(record.venueCapacity))error("Venue Capacity","invalid_capacity","Venue capacity must be a whole number or blank.");
  return issues;
}
function parseCsvRows(text){
  const rows=[];let row=[],field="",quoted=false;
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(quoted){if(char==='"'&&text[index+1]==='"'){field+='"';index++}else if(char==='"')quoted=false;else field+=char;continue}
    if(char==='"'){quoted=true;continue}if(char===","){row.push(field);field="";continue}if(char==="\n"){row.push(field.replace(/\r$/,"") );rows.push(row);row=[];field="";continue}field+=char;
  }
  if(quoted)throw new VenueLibraryError("The CSV contains an unterminated quoted field.","invalid_csv_quoting");
  if(field.length||row.length){row.push(field.replace(/\r$/,"") );rows.push(row)}return rows;
}
function csvRecordForStorage(record){const stored={};for(const field of Object.values(CSV_FIELD_MAP))stored[field]=record[field]??"";stored.venueCapacity=record.venueCapacity?Number(record.venueCapacity):null;return stored}
function csvFingerprint(record){return crypto.createHash("sha256").update(JSON.stringify(csvRecordForStorage(record))).digest("hex")}
function venueInternalId(masterId){return`venue_${crypto.createHash("sha256").update(String(masterId).toLocaleLowerCase("en-AU")).digest("hex").slice(0,16)}`}
function findVenueByMasterId(library,masterId){return Object.values(library.venues||{}).find(venue=>venue.masterId===masterId)||null}
function venueSummary(venue){
  const qr=qrStatusFor(venue);return{id:venue.id,masterId:venue.masterId,venueName:venue.csv.venueName,venueType:venue.csv.venueType,location:venue.csv.location,suburb:venue.csv.suburb,
    publicationState:venue.admin.publicationState,libraryVisibility:venue.admin.libraryVisibility||"active",health:venue.health?.overall||"grey",healthReason:venue.health?.reason||"Never checked",gigStatus:venue.automated?.gigStatus||"never_checked",
    videoStatus:venue.admin?.customVideo?"present":"missing",qrStatus:qr.state,lastUpdateStatus:venue.lastUpdateResult?.status||"never_updated",lastUpdateAttempt:venue.lastUpdateAttempt,lastSuccessfulUpdate:venue.lastSuccessfulUpdate,updatedAt:venue.updatedAt};
}
function summarySorter(sort){const healthRank={red:0,amber:1,grey:2,green:3},gigRank={failed:0,stale:1,review_required:2,never_checked:3,current:4};return(a,b)=>{if(sort==="name")return a.venueName.localeCompare(b.venueName);if(sort==="master_id")return a.masterId.localeCompare(b.masterId,undefined,{numeric:true});if(sort==="updated")return String(b.updatedAt).localeCompare(String(a.updatedAt));if(sort==="last_success")return String(b.lastSuccessfulUpdate||"").localeCompare(String(a.lastSuccessfulUpdate||""));if(sort==="gig_freshness")return(gigRank[a.gigStatus]??9)-(gigRank[b.gigStatus]??9)||a.venueName.localeCompare(b.venueName);if(sort==="publication")return a.publicationState.localeCompare(b.publicationState)||a.venueName.localeCompare(b.venueName);return(healthRank[a.health]??9)-(healthRank[b.health]??9)||a.venueName.localeCompare(b.venueName)}}
function normalizeEvent(candidate,{venueId,sourceUrl,now}){
  const title=clean(candidate?.name,300),rawStart=String(candidate?.startDate||"").trim();if(!title||!rawStart||Number.isNaN(new Date(rawStart).getTime()))return null;
  const eventUrl=optionalHttpUrl(typeof candidate.url==="string"?candidate.url:typeof candidate.offers?.url==="string"?candidate.offers.url:"");
  const base={venueId,title,startDate:new Date(rawStart).toISOString(),endDate:validDate(candidate.endDate),description:clean(stripTags(candidate.description),800),eventUrl,imageUrl:jsonLdImage(candidate.image),sourceUrl,sourceSpecificId:clean(candidate.identifier?.value||candidate.identifier||candidate['@id']||eventUrl,500),extractedAt:now.toISOString(),lastVerifiedAt:now.toISOString(),publicationState:"current"};
  const hashInput=[venueId,title,base.startDate,eventUrl].join("|");base.contentHash=crypto.createHash("sha256").update(hashInput).digest("hex");base.id=`event_${base.contentHash.slice(0,20)}`;return base;
}
function flattenJsonLd(value){if(Array.isArray(value))return value.flatMap(flattenJsonLd);if(!value||typeof value!=="object")return[];if(Array.isArray(value['@graph']))return[value,...value['@graph'].flatMap(flattenJsonLd)];return[value]}
function hasJsonLdType(value,type){const values=Array.isArray(value?.['@type'])?value['@type']:[value?.['@type']];return values.some(item=>String(item).toLocaleLowerCase("en-AU")===type.toLocaleLowerCase("en-AU"))}
function jsonLdImage(value){const raw=Array.isArray(value)?value[0]:typeof value==="object"?value?.url:value;return optionalHttpUrl(raw)}
function validDate(value){if(!value||Number.isNaN(new Date(value).getTime()))return"";return new Date(value).toISOString()}
function factualAbout(csv){const location=[csv.streetAddress,csv.suburb,csv.state,csv.postcode].filter(Boolean).join(", ");return[`${csv.venueName}${csv.venueType?` is listed as a ${csv.venueType}`:""}${csv.location?` in ${csv.location}`:""}.`,location?`Address: ${location}.`:"",csv.verificationNotes||""].filter(Boolean).join(" ")}
function optionalHttpsUrl(value){const text=String(value||"").trim();if(!text)return"";const url=validatedPublicHttpUrl(text);if(url.protocol!=="https:")throw new VenueLibraryError("Public edition and QR URLs must use HTTPS.","https_required");return url.href}
function optionalHttpUrl(value){try{return value?validatedPublicHttpUrl(String(value)).href:""}catch{return""}}
function validatedPublicHttpUrl(value){let url;try{url=new URL(String(value))}catch{throw new VenueLibraryError("URL is not valid.","invalid_url",{url:value})}if(!["http:","https:"].includes(url.protocol))throw new VenueLibraryError("Only HTTP and HTTPS destinations are allowed.","unsafe_url_scheme",{url:value});if(url.username||url.password)throw new VenueLibraryError("URLs containing embedded credentials are not allowed.","unsafe_url_credentials",{url:value});if(isBlockedHostname(url.hostname))throw new VenueLibraryError("Local and internal network destinations are blocked.","unsafe_url_host",{url:value});return url}
async function assertPublicHost(url,dnsLookup){if(isBlockedHostname(url.hostname))throw new VenueLibraryError("Local and internal network destinations are blocked.","unsafe_url_host",{url:url.href});const addresses=net.isIP(url.hostname)?[{address:url.hostname}]:await dnsLookup(url.hostname,{all:true,verbatim:true});if(!addresses?.length)throw new VenueLibraryError("The destination hostname could not be resolved.","dns_error",{url:url.href});for(const item of addresses)if(isPrivateIp(item.address))throw new VenueLibraryError("The destination resolves to a private or internal network address.","unsafe_url_address",{url:url.href,address:item.address})}
function isBlockedHostname(hostname){const value=String(hostname||"").replace(/^\[|\]$/g,"").toLocaleLowerCase("en-AU");return value==="localhost"||value.endsWith(".localhost")||value.endsWith(".local")||value==="0.0.0.0"||isPrivateIp(value)}
function isPrivateIp(value){if(net.isIP(value)===4){const p=value.split(".").map(Number);return p[0]===10||p[0]===127||p[0]===0||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127)||(p[0]===198&&[18,19].includes(p[1]))||p[0]>=224}if(net.isIP(value)===6){const normalized=value.toLocaleLowerCase("en-AU");return normalized==="::"||normalized==="::1"||normalized.startsWith("fc")||normalized.startsWith("fd")||/^fe[89ab]/.test(normalized)||normalized.startsWith("::ffff:127.")||normalized.startsWith("::ffff:10.")||normalized.startsWith("::ffff:192.168.")}return false}
async function readLimitedResponse(response,maxBytes){if(response.body==null)return"";const declared=Number(response.headers.get("content-length")||0);if(declared>maxBytes)throw new VenueLibraryError("The destination response exceeds the safe download limit.","response_too_large",{declared,maxBytes});const reader=response.body.getReader();const chunks=[];let total=0;while(true){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new VenueLibraryError("The destination response exceeds the safe download limit.","response_too_large",{maxBytes})}chunks.push(value)}const merged=new Uint8Array(total);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder("utf-8",{fatal:false}).decode(merged)}
function classifyNetworkError(error){const message=String(error?.cause?.code||error?.code||error?.message||"").toLocaleLowerCase("en-AU");if(message.includes("cert")||message.includes("tls"))return"tls_error";if(message.includes("enotfound")||message.includes("dns"))return"dns_error";return"network_error"}
function parseCsvCell(value){return String(value??"")}
function csvCell(value){const text=parseCsvCell(value);return/[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text}
function countsFromPreview(preview){return{parsedRows:preview.parsedRows,newCount:preview.newCount,updatedCount:preview.updatedCount,unchangedCount:preview.unchangedCount,rejectedRows:preview.rejectedRows}}
function auditEntry(action,user,details,timestamp){return{id:`audit_${crypto.randomUUID()}`,action,user,details,timestamp}}
function pickPublicationChanges(value){const allowed=["status","stage","message","prUrl","branch","editionId","slug","liveUrl","qrImageUrl","deploymentUrl","errorCode","error"];const result={};for(const key of allowed)if(value?.[key]!==undefined)result[key]=String(value[key]??"").slice(0,key==="error"||key==="message"?1200:500);return result}
function touchLibrary(library,timestamp){library.revision=Number(library.revision||0)+1;library.updatedAt=timestamp}
function countBy(items,picker){const result={};for(const item of items){const key=picker(item)||"unknown";result[key]=(result[key]||0)+1}return result}
function uniqueSorted(values){return[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function oneOf(value,values,fallback){return values.includes(value)?value:fallback}
function normalizeUrl(value){const text=String(value||"").trim();if(!text)return"";try{const url=new URL(text);if(!["http:","https:"].includes(url.protocol))return text;url.hash="";return url.href}catch{return text}}
function isHttpUrl(value){try{return["http:","https:"].includes(new URL(value).protocol)}catch{return false}}
function clean(value,max=500){return String(value??"").trim().replace(/\s+/g," ").slice(0,max)}
function cleanMultiline(value,max=1200){return String(value??"").trim().replace(/\r\n?/g,"\n").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").slice(0,max)}
function stripTags(value){return String(value||"").replace(/<[^>]+>/g," ")}
function decodeHtmlEntities(value){return String(value||"").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")}
