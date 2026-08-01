import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  VenueLibraryError,applyVenueSync,attachVenueVideo,createVenueLibrary,deriveOverallHealth,encodeCsv,extractEventsFromHtml,fetchSafeUrl,
  generateVenueTicker,getVenue,listVenueSummaries,mergeVenueEvents,previewVenueSync,reportRows,updateVenue,venueLibraryBootstrap
} from "./venue-library.mjs";
import {createStudioServer} from "./studio-server.mjs";
import {BAR_PUBLIC_VIDEO_MAX_BYTES,buildBarEditionPublication,publicationReadiness} from "./bar-edition-publication.mjs";

const root=path.resolve(process.cwd());
const fixture=await fs.readFile(path.join(root,"scripts","fixtures","venue-library","melbourne-venues-31.csv"),"utf8");
const preview=previewVenueSync(createVenueLibrary(),fixture,{fileName:"melbourne_venue_prospects_210.csv",now:new Date("2026-08-01T00:00:00Z")});
assert.equal(preview.parsedRows,31,"The misleading filename must not be used as the record count.");
assert.equal(preview.acceptedRows,31);
assert.equal(preview.rejectedRows,0);
assert.equal(preview.records[0].masterId,"Aggits_001");
assert.equal(preview.records.at(-1).masterId,"Aggits_031");

let library=applyVenueSync(createVenueLibrary(),preview,{now:new Date("2026-08-01T00:01:00Z")}).library;
assert.equal(venueLibraryBootstrap(library).venueCount,31);
assert.equal(venueLibraryBootstrap(library).healthCounts.grey,31,"Never-checked venues must be grey.");
const id001=listVenueSummaries(library,{search:"aggits_001"})[0].id;
assert.equal(listVenueSummaries(library,{search:"duke of well"})[0].masterId,"Aggits_001");
assert.equal(listVenueSummaries(library,{venueType:"Pub and rooftop bar"}).length,1);
assert.equal(listVenueSummaries(library,{updateState:"not_updated"}).length,31);
assert.equal(listVenueSummaries(library,{gigFreshness:"never_checked"}).length,31);
const again=previewVenueSync(library,fixture,{fileName:"melbourne_venue_prospects_210.csv"});
assert.equal(again.newCount,0);assert.equal(again.updatedCount,0);assert.equal(again.unchangedCount,31,"Re-import must be idempotent.");

let updated=updateVenue(library,id001,{admin:{publicationState:"draft",tickerOverride:"PINNED MANUAL TICKER",aboutOverride:"Administrator-approved venue copy.",intendedQrUrl:"https://example.com/q/venue"}},{expectedRevision:getVenue(library,id001).revision}).library;
updated=attachVenueVideo(updated,id001,{fileName:"welcome.mp4",sizeBytes:1000,sha256:"a".repeat(64)}).library;
const changedCsv=fixture.replace("Pub and rooftop bar","Historic pub and rooftop bar");
updated=applyVenueSync(updated,previewVenueSync(updated,changedCsv,{fileName:"changed.csv"})).library;
const preserved=getVenue(updated,id001);
assert.equal(preserved.csv.venueType,"Historic pub and rooftop bar");
assert.equal(preserved.admin.tickerOverride,"PINNED MANUAL TICKER");
assert.equal(preserved.admin.aboutOverride,"Administrator-approved venue copy.");
assert.equal(preserved.admin.customVideo.fileName,"welcome.mp4");

const duplicateCsv=`${fixture.trim()}\r\n${fixture.trim().split(/\r?\n/)[1]}\r\n`;
const duplicatePreview=previewVenueSync(createVenueLibrary(),duplicateCsv,{fileName:"duplicate.csv"});
assert.equal(duplicatePreview.rejectedRows,1,"Duplicate Master IDs must fail closed.");

const header=fixture.slice(0,fixture.indexOf("\n")+1);const firstRow=fixture.slice(fixture.indexOf("\n")+1).split(/\r?\n/)[0];
const addedRow=firstRow.replaceAll("Aggits_001","Aggits_032").replaceAll("The Duke of Wellington","New Test Venue");
const addedPreview=previewVenueSync(library,`${fixture.trim()}\r\n${addedRow}\r\n`,{fileName:"extended.csv"});
assert.equal(addedPreview.newCount,1,"A later CSV can append a new immutable Master ID.");

const eventHtml=`<!doctype html><script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","@id":"event-1","name":"Live Test Band","startDate":"2026-09-12T20:00:00+10:00","url":"https://venue.example/events/live-test-band","description":"A current official event."}</script>`;
const extracted=extractEventsFromHtml(eventHtml,{venueId:id001,sourceUrl:"https://venue.example/whats-on",now:new Date("2026-08-01T00:00:00Z")});
assert.equal(extracted.events.length,1);assert.equal(extracted.events[0].venueId,id001);
const merged=mergeVenueEvents([],extracted.events,{now:new Date("2026-08-01T00:00:00Z")});
assert.equal(mergeVenueEvents(merged,extracted.events).length,1,"Event updates must deduplicate.");
const ticker=generateVenueTicker(merged,{pinnedNotice:"TONIGHT: DOORS AT 7",now:new Date("2026-08-01T00:00:00Z")});
assert.match(ticker.tickerText,/TONIGHT: DOORS AT 7/);assert.match(ticker.tickerText,/LIVE TEST BAND/i);

await assert.rejects(()=>fetchSafeUrl("http://127.0.0.1/private"),error=>error instanceof VenueLibraryError&&error.code==="unsafe_url_host");
await assert.rejects(()=>fetchSafeUrl("http://169.254.169.254/latest/meta-data"),error=>error.code==="unsafe_url_host");
await assert.rejects(()=>fetchSafeUrl("ftp://example.com/file"),error=>error.code==="unsafe_url_scheme");
const safeFetch=await fetchSafeUrl("https://venue.example/whats-on",{
  dnsLookup:async()=>[{address:"93.184.216.34",family:4}],
  fetchImpl:async()=>new Response(eventHtml,{status:200,headers:{"content-type":"text/html"}})
});
assert.equal(safeFetch.status,200);assert.match(safeFetch.body,/Live Test Band/);

const report=encodeCsv(reportRows(library));assert.match(report,/Master ID/);assert.match(report,/Requires hosted analytics/);
assert.doesNotMatch(report,/Public page views/);
const fixtureHeaders=header.trim().split(",");assert.equal(fixtureHeaders.length,20);

const qrBytes=await fs.readFile(path.join(root,"assets","jookbox-venue-qr-master-v1.png"));
assert.equal(qrBytes.subarray(1,4).toString("ascii"),"PNG");
assert.equal(qrBytes.readUInt32BE(16),1920);assert.equal(qrBytes.readUInt32BE(20),1080,"QR master dimensions must remain 1920 × 1080.");
const ui=await fs.readFile(path.join(root,"studio","venue-library.js"),"utf8");
assert.match(ui,/new QRCode\(els\.qrSource/);assert.match(ui,/BarcodeDetector/);assert.match(ui,/jookbox-venue-qr-master-v1\.png/);
assert.match(ui,/Secure publication started/);assert.match(ui,/venue-publications\/capabilities/);
assert.match(ui,/if\(result\.authentication\?\.available\)state\.activationPending=false/,"A successful publisher refresh must clear a stale activation-code prompt.");
const welcomeVideo=Buffer.from([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0,0,0,0,0,0,0,0,0,0]);
const publicationVenue=structuredClone(preserved);publicationVenue.admin.customVideo={fileName:"welcome.mp4",sizeBytes:welcomeVideo.length,sha256:crypto.createHash("sha256").update(welcomeVideo).digest("hex")};
assert.equal(publicationReadiness(publicationVenue,{videoPath:"welcome.mp4",videoSizeBytes:welcomeVideo.length}).ready,true);
assert.equal(publicationReadiness(publicationVenue,{videoPath:"welcome.mp4",videoSizeBytes:BAR_PUBLIC_VIDEO_MAX_BYTES+1}).ready,false,"Cloudflare-incompatible video must fail closed.");
const platform=JSON.parse(await fs.readFile(path.join(root,"platform.json"),"utf8"));
const bundle=buildBarEditionPublication({venue:publicationVenue,platform,videoBytes:welcomeVideo,now:new Date("2026-08-01T01:00:00Z"),randomBytes:()=>Buffer.from("1234567890","hex")});
assert.equal(bundle.config.editionType,"bar_jukebox");assert.equal(bundle.config.barJookBox.modelVersion,"bar-jukebox/1");assert.equal(bundle.config.barJookBox.sourceMasterId,"Aggits_001");assert.equal(bundle.config.barJookBox.actions.length,5);assert.equal(bundle.config.barJookBox.webLookupAllowed,false);assert.match(bundle.canonicalPath,/^\/e\/dc_[a-f0-9]+$/);assert.ok(bundle.files.some(file=>file.path.endsWith("welcome.mp4")));

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),"deep-cuts-venue-library-"));
const token="venue-library-test-token";
const fakeFetch=async url=>new Response(eventHtml,{status:200,headers:{"content-type":"text/html","content-length":String(Buffer.byteLength(eventHtml))}});
const fakePublisher={
  authentication:async()=>({available:true,state:"active",reason:"Automatic publishing is securely activated."}),
  startActivation:async()=>({message:"Activation code sent."}),
  completeActivation:async()=>({available:true,state:"active"}),
  publish:async({venue,onProgress})=>{await onProgress("validating","Validation is running");await onProgress("publishing","Direct Cloudflare publication is running");return{jobId:"barjob_test",editionId:"dc_1234567890",slug:`bar-${venue.masterId.toLowerCase()}`,liveUrl:"https://deep-cuts.andrewharris501.workers.dev/e/dc_1234567890",qrImageUrl:"https://deep-cuts.andrewharris501.workers.dev/q/dc_1234567890",deploymentUrl:"https://deep-cuts.andrewharris501.workers.dev"}}
};
const server=createStudioServer({root,dataDir:temporary,token,venueFetchImpl:fakeFetch,venueDnsLookup:async()=>[{address:"93.184.216.34",family:4}],venuePublisher:fakePublisher});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const mutate=(url,body,method="POST")=>fetch(`${origin}${url}`,{method,headers:{origin,"content-type":"application/json","x-deep-cuts-studio-token":token},body:body===undefined?undefined:JSON.stringify(body)});
try{
  const page=await fetch(`${origin}/studio/venue-library.html`);assert.equal(page.status,200);assert.match(await page.text(),/Venue Library/);
  const importPreview=await mutate("/api/studio/venues/import/preview",{fileName:"melbourne_venue_prospects_210.csv",csvText:fixture}).then(response=>response.json());
  assert.equal(importPreview.preview.parsedRows,31);
  const imported=await mutate("/api/studio/venues/import/apply",{fileName:"melbourne_venue_prospects_210.csv",csvText:fixture,previewToken:importPreview.previewToken}).then(response=>response.json());
  assert.equal(imported.bootstrap.venueCount,31);
  const venueId=imported.venues.find(venue=>venue.masterId==="Aggits_001").id;
  const record=await fetch(`${origin}/api/studio/venues/${venueId}`).then(response=>response.json());assert.equal(record.venue.csv.venueName,"The Duke of Wellington");
  const edited=await mutate(`/api/studio/venues/${venueId}`,{expectedRevision:record.venue.revision,admin:{tickerOverride:"MANUAL API TICKER",aboutOverride:"MANUAL API ABOUT",intendedQrUrl:"https://example.com/q/test"}},"PUT").then(response=>response.json());
  assert.equal(edited.venue.admin.tickerOverride,"MANUAL API TICKER");
  const resynced=await mutate("/api/studio/venues/import/apply",{fileName:"melbourne_venue_prospects_210.csv",csvText:fixture}).then(response=>response.json());assert.equal(resynced.bootstrap.venueCount,31);
  const preservedApi=await fetch(`${origin}/api/studio/venues/${venueId}`).then(response=>response.json());assert.equal(preservedApi.venue.admin.tickerOverride,"MANUAL API TICKER");
  const capabilities=await fetch(`${origin}/api/studio/venue-publications/capabilities`).then(response=>response.json());assert.equal(capabilities.authentication.available,true);assert.equal(capabilities.maxVideoBytes,BAR_PUBLIC_VIDEO_MAX_BYTES);
  const uploaded=await fetch(`${origin}/api/studio/venues/${venueId}/video`,{method:"POST",headers:{origin,"content-type":"video/mp4","x-deep-cuts-studio-token":token,"x-studio-file-name":"welcome.mp4"},body:welcomeVideo}).then(response=>response.json());assert.equal(uploaded.venue.admin.customVideo.sizeBytes,welcomeVideo.length);
  const publicationCreated=await mutate(`/api/studio/venues/${venueId}/publish`,{}).then(response=>response.json());assert.match(publicationCreated.job.id,/^publication_/);
  let publication;for(let attempt=0;attempt<80;attempt++){publication=await fetch(`${origin}/api/studio/venue-publications/${publicationCreated.job.id}`).then(response=>response.json()).then(body=>body.job);if(["published","failed"].includes(publication.status))break;await new Promise(resolve=>setTimeout(resolve,25))}
  assert.equal(publication.status,"published",publication.error);assert.equal(publication.liveUrl,"https://deep-cuts.andrewharris501.workers.dev/e/dc_1234567890");
  const publishedVenue=await fetch(`${origin}/api/studio/venues/${venueId}`).then(response=>response.json());assert.equal(publishedVenue.venue.admin.publicationState,"published");assert.equal(publishedVenue.qr.publiclyDistributable,true);
  const runCreated=await mutate("/api/studio/venue-jobs",{scope:"selected",venueIds:[venueId],operations:{checkUrls:true,retrieveGigs:true,regenerateTickers:true,regenerateQr:true}}).then(response=>response.json());
  let run;for(let attempt=0;attempt<80;attempt++){run=await fetch(`${origin}/api/studio/venue-jobs/${runCreated.run.id}`).then(response=>response.json()).then(body=>body.run);if(run.status==="completed")break;await new Promise(resolve=>setTimeout(resolve,25))}
  assert.equal(run.status,"completed");assert.equal(run.completedCount,1);assert.equal(run.failureCount,0);assert.equal(run.results[0].masterId,"Aggits_001");
  const afterRun=await fetch(`${origin}/api/studio/venues/${venueId}`).then(response=>response.json());assert.ok(afterRun.venue.automated.events.length>0);assert.equal(afterRun.venue.admin.tickerOverride,"MANUAL API TICKER","Automatic updates must preserve manual overrides.");assert.ok(afterRun.history.length>0);assert.ok(afterRun.audit.length>0);
  const reportResponse=await fetch(`${origin}/api/studio/venue-reports/operations.csv`);assert.equal(reportResponse.status,200);assert.match(await reportResponse.text(),/Aggits_001/);
  const printable=await fetch(`${origin}/api/studio/venue-reports/print?search=Aggits_001`);assert.equal(printable.status,200);assert.match(await printable.text(),/JookBox Venue Operations/);
  const runExport=await fetch(`${origin}/api/studio/venue-jobs/${run.id}/export`);assert.equal(runExport.status,200);assert.match(await runExport.text(),/Live Test Band|The Duke of Wellington/);
}finally{await new Promise(resolve=>server.close(resolve));await fs.rm(temporary,{recursive:true,force:true})}

const green=deriveOverallHealth({...getVenue(library,id001),healthChecks:{website:{success:true,durationMs:100},gigs:{success:true,durationMs:150}},lastUpdateAttempt:"2026-08-01T00:00:00Z",lastSuccessfulUpdate:"2026-08-01T00:00:00Z"},{slowMs:4000,staleDays:14,redAfterFailures:2},new Date("2026-08-02T00:00:00Z"));
assert.equal(green.overall,"green");
const red=deriveOverallHealth({...getVenue(library,id001),healthChecks:{website:{success:false,consecutiveFailureCount:2,errorSummary:"Repeated failure"}},lastUpdateAttempt:"2026-08-01T00:00:00Z"},{slowMs:4000,staleDays:14,redAfterFailures:2},new Date("2026-08-02T00:00:00Z"));
assert.equal(red.overall,"red");

console.log("Venue Library tests passed: 31-row CSV sync, immutable Master IDs, idempotency, override/video preservation, search, isolation, safe URL fetching, JSON-LD gigs, ticker generation, background updates, health, reports and QR master integrity are intact.");
