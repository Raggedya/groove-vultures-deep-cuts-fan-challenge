import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {__test} from "../worker/bar-publisher.js";
import {createVenueQrArtwork} from "./venue-qr-artwork.mjs";
import {createDirectVenuePublisher} from "./bar-edition-publication.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifest={
  schemaVersion:"deep-cuts-bar-publication/2",
  masterId:"Aggits_001",
  venueName:"Test Melbourne Venue",
  tickerText:"TEST MELBOURNE VENUE — LIVE MUSIC, FOOD AND DRINKS.",
  aboutText:"Test Melbourne Venue is an administrator-approved Bar Edition test fixture.",
  address:"1 Test Street, Melbourne VIC 3000",
  actions:[
    {id:"gigs",label:"Gigs",url:"https://example.com/gigs",detail:"Open Gigs"},
    {id:"menu",label:"Menu",url:"https://example.com/menu",detail:"Open Menu"},
    {id:"contact",label:"Contact Us",url:"https://example.com/contact",detail:"Open Contact Us"},
    {id:"instagram",label:"Instagram",url:"https://instagram.com/example",detail:"Open Instagram"},
    {id:"facebook",label:"Facebook",url:"https://facebook.com/example",detail:"Open Facebook"}
  ],
  video:{fileName:"welcome.mp4",sizeBytes:1024,sha256:crypto.createHash("sha256").update("fixture").digest("hex")}
};

const validated=__test.validateManifest(manifest);
assert.equal(validated.ok,true,validated.error);
assert.equal(validated.value.actions.length,5);
assert.equal(__test.validateManifest({...manifest,actions:manifest.actions.slice(0,4)}).ok,false,"The publisher must fail closed unless exactly five destinations exist.");
assert.equal(__test.validateManifest({...manifest,actions:manifest.actions.map((item,index)=>index?item:{...item,url:"http://127.0.0.1/private"})}).ok,false,"Private or non-HTTPS destinations must be rejected.");
assert.equal(__test.validateManifest({...manifest,video:{...manifest.video,sizeBytes:24*1024*1024+1}}).ok,false,"Oversize public MP4 files must be rejected.");

const job={job_id:"barjob_test",edition_id:"dc_0123456789",slug:"bar-aggits-001",venue_name:manifest.venueName,base_url:"https://deep-cuts.andrewharris501.workers.dev",created_at:"2026-08-01T00:00:00.000Z"};
const config=__test.buildConfig(job,validated.value);
assert.equal(config.editionType,"bar_jukebox");
assert.equal(config.barJookBox.modelVersion,"bar-jukebox/1");
assert.equal(config.barJookBox.actions.length,5);
assert.equal(config.barJookBox.webLookupAllowed,false);
assert.equal(config.barJookBox.supportAction.label,"Share Test Melbourne Venue with your mates");
assert.equal(config.barJookBox.localWelcomeVideo,"/api/bar-assets/dc_0123456789/video");

const destination="https://deep-cuts.andrewharris501.workers.dev/q/dc_0123456789";
const qr=await createVenueQrArtwork({root,venueName:manifest.venueName,destination});
assert.equal(qr.destination,destination);
assert.equal(qr.width,1920);
assert.equal(qr.height,1080);
assert.equal(qr.scanProof,"rendered-matrix:full+960x540");
assert.match(qr.sha256,/^[a-f0-9]{64}$/);
assert.equal(__test.isPng(qr.bytes,1920,1080),true);
assert.ok(qr.bytes.length>10000);

const videoBytes=Buffer.from([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0,0,0,0,0,0,0,0,0,0]);
const venue={masterId:manifest.masterId,csv:{venueName:manifest.venueName,location:"Melbourne CBD",streetAddress:"1 Test Street",suburb:"Melbourne",state:"VIC",postcode:"3000",gigsUrl:manifest.actions[0].url,menuUrl:manifest.actions[1].url,contactUrl:manifest.actions[2].url,instagramUrl:manifest.actions[3].url,facebookUrl:manifest.actions[4].url},admin:{tickerOverride:manifest.tickerText,aboutOverride:manifest.aboutText,customVideo:{fileName:"welcome.mp4",sizeBytes:videoBytes.length,sha256:crypto.createHash("sha256").update(videoBytes).digest("hex")}},automated:{}};
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),"direct-bar-publisher-")),videoPath=path.join(temporary,"welcome.mp4");await fs.writeFile(videoPath,videoBytes);
let storedToken="",uploadedQr=null;const activationToken=`bpub_${"A".repeat(43)}`;
const credentialStore={activationSupported:true,getInstallationId:async()=>`studio_${"1".repeat(32)}`,getToken:async()=>storedToken,setToken:async value=>{storedToken=value},clearToken:async()=>{storedToken=""}};
const publishedJob={id:"barjob_test",editionId:job.edition_id,slug:job.slug,venueName:manifest.venueName,status:"published",stage:"published",liveUrl:`${job.base_url}/e/${job.edition_id}`,qrImageUrl:`${job.base_url}/output/${job.slug}/instagram-qr.png`,qrPayload:destination};
const calls=[];
const fakeRemote=async(url,options={})=>{calls.push({url:String(url),method:options.method||"GET",headers:new Headers(options.headers)});const pathname=new URL(url).pathname;
  if(pathname==="/api/bar-publisher/activation/start")return Response.json({ok:true,message:"Activation code sent."});
  if(pathname==="/api/bar-publisher/activation/complete")return Response.json({ok:true,token:activationToken});
  if(pathname==="/api/bar-publisher/session")return Response.json({ok:true});
  if(pathname==="/api/bar-publisher/publications"&&options.method==="POST")return Response.json({ok:true,job:publishedJob,qrPayload:destination});
  if(pathname.endsWith("/video")&&options.method==="PUT")return Response.json({ok:true});
  if(pathname.endsWith("/qr")&&options.method==="PUT"){uploadedQr=Buffer.from(options.body);assert.equal(options.headers["x-deep-cuts-qr-scan-proof"],"rendered-matrix:full+960x540");return Response.json({ok:true})}
  if(pathname.endsWith("/commit")&&options.method==="POST")return Response.json({ok:true,job:publishedJob});
  if(pathname===`/api/bar-publisher/publications/${publishedJob.id}`)return Response.json({ok:true,job:publishedJob});
  if(pathname===`/e/${job.edition_id}`)return new Response(`<html>Deep Cuts ${manifest.venueName}</html>`,{headers:{"content-type":"text/html"}});
  if(pathname===`/api/bar-editions/${job.edition_id}/config`)return Response.json(config);
  if(pathname===`/output/${job.slug}/instagram-qr.png`)return new Response(uploadedQr,{headers:{"content-type":"image/png"}});
  if(pathname===`/api/bar-assets/${job.edition_id}/video`&&options.method==="HEAD")return new Response(null,{headers:{"content-type":"video/mp4"}});
  throw new Error(`Unexpected direct publisher request: ${options.method||"GET"} ${pathname}`)
};
try{
  const publisher=createDirectVenuePublisher({serviceUrl:job.base_url,credentialStore,fetchImpl:fakeRemote,sleep:async()=>{},root,pollMs:0,maxPolls:2});
  assert.equal((await publisher.authentication()).available,false);
  await publisher.startActivation();assert.equal((await publisher.completeActivation("123456")).available,true);
  const stages=[],result=await publisher.publish({venue,videoPath,onProgress:async stage=>stages.push(stage)});
  assert.equal(result.editionId,job.edition_id);assert.deepEqual(stages,["validating","uploading","qr","publishing","verifying","delivered"]);assert.ok(uploadedQr.length>10000);assert.ok(calls.every(call=>call.url.startsWith("https://")));
}finally{await fs.rm(temporary,{recursive:true,force:true})}

const migration=await fs.readFile(path.join(root,"migrations","0004_bar_publisher.sql"),"utf8");
for(const table of["bar_publisher_activations","bar_publisher_devices","bar_publication_jobs","bar_editions"])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
const wrangler=JSON.parse((await fs.readFile(path.join(root,"wrangler.jsonc"),"utf8")).replace(/^\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,""));
assert.ok(wrangler.r2_buckets?.some(binding=>binding.binding==="BAR_ASSETS"),"Cloudflare must bind the isolated Bar Edition asset bucket.");
const publisherSource=await fs.readFile(path.join(root,"worker","bar-publisher.js"),"utf8");
assert.match(publisherSource,/config:`api\/bar-editions\/\$\{row\.edition_id\}\/config`/,"Dynamic Bar Edition manifests must not emit a scheme-relative configuration URL.");

console.log("Direct Bar publisher tests passed: manifest gate, locked Bar Edition config, 24 MiB ceiling, R2 binding and permanent 1920×1080 QR scan proof are intact.");
