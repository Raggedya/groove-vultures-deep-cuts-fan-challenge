import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {applyVenueSync,createVenueLibrary,previewVenueSync} from "./venue-library.mjs";
import {publishVenueBatch} from "./venue-batch-publication.mjs";

const root=path.resolve(process.cwd()),temporary=await fs.mkdtemp(path.join(os.tmpdir(),"deep-cuts-venue-batch-"));
const dataDir=path.join(temporary,"studio"),libraryRoot=path.join(dataDir,"venue-library"),libraryPath=path.join(libraryRoot,"library.json"),videoPath=path.join(temporary,"placeholder.mp4");
const source=await fs.readFile(path.join(root,"scripts","fixtures","venue-library","melbourne-venues-31.csv"),"utf8");
const firstTwo=`${source.split(/\r?\n/).slice(0,3).join("\n")}\n`;
let library=applyVenueSync(createVenueLibrary(),previewVenueSync(createVenueLibrary(),firstTwo,{fileName:"venues.csv"})).library;
await fs.mkdir(libraryRoot,{recursive:true});await fs.writeFile(libraryPath,`${JSON.stringify(library,null,2)}\n`);
const video=Buffer.from([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0,0,0,0,0,0,0,0,0,0]);await fs.writeFile(videoPath,video);
const calls=[],attempts=new Map();const publisher={authentication:async()=>({available:true}),publish:async({venue,videoPath:onDisk,onProgress})=>{calls.push(venue.masterId);attempts.set(venue.masterId,(attempts.get(venue.masterId)||0)+1);if(venue.masterId==="Aggits_001"&&attempts.get(venue.masterId)===1)throw Object.assign(new Error("Publishing service returned 503."),{status:503,code:"publisher_request_failed"});assert.equal((await fs.readFile(onDisk)).length,video.length);await onProgress("validating","Validated");await onProgress("delivery","Email confirmed");return{jobId:`barjob_${venue.masterId}`,editionId:`dc_${venue.masterId.slice(-3)}`,slug:`bar-${venue.masterId.toLowerCase()}`,liveUrl:`https://example.com/e/dc_${venue.masterId.slice(-3)}`,qrImageUrl:`https://example.com/output/${venue.masterId}/qr.png`,deploymentUrl:"https://example.com"}}};
try{
  const events=[];const report=await publishVenueBatch({dataDir,workspaceRoot:root,videoPath,publisher,retryBaseMs:0,interVenueDelayMs:0,onProgress:event=>events.push(event),now:(()=>{let tick=0;return()=>new Date(1785542400000+tick++*1000)})()});
  assert.equal(report.total,2);assert.equal(report.requested,2);assert.equal(report.published,2);assert.equal(report.failed,0);assert.equal(report.skipped,0);assert.deepEqual(calls,["Aggits_001","Aggits_001","Aggits_002"]);assert.ok(events.some(event=>event.stage==="retrying"));assert.ok(events.some(event=>event.status==="published"));
  library=JSON.parse(await fs.readFile(libraryPath,"utf8"));for(const venue of Object.values(library.venues)){assert.equal(venue.admin.customVideo.sha256,crypto.createHash("sha256").update(video).digest("hex"));assert.equal(venue.admin.publicationState,"published");assert.match(venue.admin.publicEditionUrl,/^https:\/\/example\.com\/e\//);assert.ok(await fs.stat(path.join(libraryRoot,"videos",`${venue.id}.mp4`)))}
  const persisted=JSON.parse(await fs.readFile(report.reportPath,"utf8"));assert.equal(persisted.results.length,2);assert.ok(persisted.results.every(result=>result.emailDelivery==="confirmed"));assert.ok(await fs.stat(report.backupPath));
  const second=await publishVenueBatch({dataDir,workspaceRoot:root,videoPath,publisher,retryBaseMs:0,interVenueDelayMs:0,now:()=>new Date(1785542600000)});assert.equal(second.requested,0);assert.equal(second.skipped,2);assert.equal(calls.length,3);
}finally{await fs.rm(temporary,{recursive:true,force:true})}
console.log("Venue batch publication passed: placeholder MP4 attachment, technical retries, completed-edition skipping, isolated publishing, permanent links, QR results, separate confirmed delivery emails and local recovery records are intact.");
