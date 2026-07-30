import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import worker from "../worker/index.js";
import {validPublicHttps} from "../worker/commercial-research.js";
import {acquireRequestSlot,isBlockedPublicPath} from "../worker/security.js";
import {TELSTRA_IDENTITY} from "../sell/demo-data.js";

await import(`./build-cloudflare.mjs?security-test=${Date.now()}`);

const root=process.cwd();
const dist=path.join(root,"dist");
const platform=JSON.parse(fs.readFileSync(path.join(root,"platform.json"),"utf8"));
const wrangler=JSON.parse(fs.readFileSync(path.join(root,"wrangler.jsonc"),"utf8"));
const migration=fs.readFileSync(path.join(root,"migrations/0004_security_hardening.sql"),"utf8");
const publicFiles=walk(dist);
assert.equal(platform.editions.filter(item=>item.active!==false).length,34,"All 34 active editions must remain registered");

for(const expected of [
  "index.html",
  "styles.css",
  "platform.json",
  "js/app.js",
  "js/analytics.js",
  "sell/index.html",
  "record-company/index.html",
  "assets/jookbox-filthy-animals-locked-v1.jpg"
]){
  assert.ok(publicFiles.has(expected),`Required public runtime file missing: ${expected}`);
}
for(const edition of platform.editions.filter(item=>item.active!==false)){
  assert.ok(publicFiles.has(edition.config),`Active edition configuration missing from public bundle: ${edition.editionId}`);
}
for(const forbidden of publicFiles){
  assert.ok(!/(^|\/)research\.json$/i.test(forbidden),`Research file leaked into public bundle: ${forbidden}`);
  assert.ok(!/(^|\/)(delivery-manifest|build-export)\.json$/i.test(forbidden),`Delivery/export manifest leaked into public bundle: ${forbidden}`);
  assert.ok(!/^record-company-output\//i.test(forbidden),`Record-company delivery package leaked into public bundle: ${forbidden}`);
  assert.ok(!/^(studio|scripts|worker|migrations|data)\//i.test(forbidden),`Internal application path leaked into public bundle: ${forbidden}`);
  assert.ok(!/\.(xlsx?|zip|sql|sqlite)$/i.test(forbidden),`Internal report or database file leaked into public bundle: ${forbidden}`);
}
assert.equal(fs.existsSync(path.join(dist,"assets","aggits-integrity.json")),false,"Aggits integrity controls must remain repository-only");
assert.equal(fs.existsSync(path.join(dist,"output","filthy-animals","delivery-manifest.json")),false,"Delivery manifests must remain private");
assert.equal(fs.existsSync(path.join(dist,"ACQUISITION_HARDENING_PHASE_0.md")),false,"New internal documentation must remain private by default");

for(const sourceDirectory of fs.readdirSync(path.join(root,"output"),{withFileTypes:true}).filter(entry=>entry.isDirectory())){
  for(const fileName of ["instagram-qr.png","instagram-discovery.png"]){
    const source=path.join(root,"output",sourceDirectory.name,fileName);
    if(fs.existsSync(source))assert.ok(publicFiles.has(`output/${sourceDirectory.name}/${fileName}`),`Approved delivery image missing: ${sourceDirectory.name}/${fileName}`);
  }
}

const blockedPaths=[
  "/editions/example/research.json",
  "/editions/example/%2572esearch.json",
  "/record-company-output/laneway-music/build-export.json",
  "/output/filthy-animals/delivery-manifest.json",
  "/studio/index.html",
  "/scripts/publish-edition.mjs",
  "/migrations/0001_deep_cuts.sql",
  "/.git/config",
  "/package.json",
  "/api/%252e%252e/package.json",
  "/api/unknown/package.json"
];
for(const pathname of blockedPaths)assert.equal(isBlockedPublicPath(pathname),true,`${pathname} must be blocked`);
for(const pathname of ["/","/index.html","/e/dc_42e5242568","/output/filthy-animals/instagram-qr.png","/api/reports/weekly.csv"]){
  assert.equal(isBlockedPublicPath(pathname),false,`${pathname} must remain available to its normal route`);
}

let assetCalls=0;
const assets={
  fetch:async request=>{
    assetCalls+=1;
    return new Response(`<html><body>asset:${new URL(request.url).pathname}</body></html>`,{headers:{"content-type":"text/html; charset=utf-8"}});
  }
};
for(const pathname of blockedPaths){
  const before=assetCalls;
  const response=await worker.fetch(new Request(`https://deep-cuts.test${pathname}`),{ASSETS:assets},{});
  assert.equal(response.status,404,`${pathname} must return a generic 404`);
  assert.equal(assetCalls,before,`${pathname} must not reach the static asset binding`);
}
const approvedAsset=await worker.fetch(new Request("https://deep-cuts.test/output/filthy-animals/instagram-qr.png"),{ASSETS:assets},{});
assert.equal(approvedAsset.status,200,"Approved QR delivery image must remain routable");

for(const pathname of ["/","/e/dc_42e5242568","/sell/","/record-company/example-label"]){
  const response=await worker.fetch(new Request(`https://deep-cuts.test${pathname}`),{ASSETS:assets},{});
  assert.equal(response.status,200,`${pathname} must remain available`);
  for(const header of ["content-security-policy","strict-transport-security","referrer-policy","permissions-policy","x-content-type-options","x-frame-options"]){
    assert.ok(response.headers.get(header),`${pathname} is missing ${header}`);
  }
  assert.match(response.headers.get("content-security-policy"),/youtube-nocookie\.com/,"YouTube embeds must remain permitted by the global CSP");
}

const activeEditions=new Set(["dc_42e5242568"]);
let insertedEvent=null;
const eventDb={
  prepare:sql=>({
    bind:(...values)=>({
      first:async()=>sql.includes("FROM editions")&&activeEditions.has(values[0])?{edition_id:values[0]}:null,
      run:async()=>{if(sql.includes("INSERT OR IGNORE INTO analytics_events"))insertedEvent=values;return{meta:{changes:1}}},
      all:async()=>({results:[]})
    })
  })
};
const allowedLimiter={limit:async()=>({success:true})};
const eventEnv={DB:eventDb,ASSETS:assets,ANALYTICS_RATE_LIMITER:allowedLimiter};
const validEvent={
  event_id:"event-security-test-1",
  edition_id:"dc_42e5242568",
  event_name:"discovery_page_viewed",
  timestamp:new Date().toISOString(),
  session_id:"session-security-test-1",
  referring_source:"direct",
  device_category:"mobile",
  page_identifier:"security-regression"
};
const accepted=await postJson("/api/events",validEvent,eventEnv);
assert.equal(accepted.status,200,"Valid analytics events must remain accepted");
assert.equal(insertedEvent[1],"dc_42e5242568","Accepted analytics event must retain its edition");
assert.equal(insertedEvent[2],"discovery_page_viewed","Accepted analytics event must retain its event type");
assert.equal(accepted.headers.get("x-content-type-options"),"nosniff","API responses must receive global security headers");

assert.equal((await postJson("/api/events",{...validEvent,event_id:"event-security-test-2",unexpected:"reject-me"},eventEnv)).status,400,"Unexpected analytics fields must be rejected");
assert.equal((await postJson("/api/events",{...validEvent,event_id:"event-security-test-3",edition_id:"dc_unknown"},eventEnv)).status,400,"Unknown editions must be rejected");
assert.equal((await postJson("/api/events",{...validEvent,event_id:"event-security-test-4",device_category:"smart-fridge"},eventEnv)).status,400,"Unknown device categories must be rejected");
assert.equal((await postJson("/api/events",{...validEvent,event_id:"event-security-test-5",timestamp:"not-a-date"},eventEnv)).status,400,"Malformed analytics timestamps must be rejected");
assert.equal((await postJson("/api/events",{...validEvent,event_id:"event-security-test-7",referring_source:"bad\u0000source"},eventEnv)).status,400,"Malformed discovery sources must be rejected");
assert.equal((await postJson("/api/events",{...validEvent,event_id:"event-security-test-8",referring_source:"x".repeat(121)},eventEnv)).status,400,"Oversized analytics properties must be rejected");
const {event_id:discardedEventId,...missingEventId}=validEvent;
assert.equal((await postJson("/api/events",missingEventId,eventEnv)).status,400,"Analytics events must provide a deduplication identifier");
const malformed=await worker.fetch(new Request("https://deep-cuts.test/api/events",{method:"POST",headers:{"content-type":"application/json"},body:"{"}),eventEnv,{});
assert.equal(malformed.status,400,"Malformed analytics JSON must be rejected");
const wrongType=await worker.fetch(new Request("https://deep-cuts.test/api/events",{method:"POST",headers:{"content-type":"text/plain"},body:"{}"}),eventEnv,{});
assert.equal(wrongType.status,415,"Non-JSON analytics requests must be rejected");
const oversized=await postJson("/api/events",{...validEvent,event_id:"event-security-test-6",page_location:"x".repeat(20000)},eventEnv);
assert.equal(oversized.status,413,"Oversized analytics requests must be rejected");
const throttled=await postJson("/api/events",validEvent,{...eventEnv,ANALYTICS_RATE_LIMITER:{limit:async()=>({success:false})}});
assert.equal(throttled.status,429,"Analytics rate limits must fail closed");
const analyticsProtectionMissing=await postJson("/api/events",validEvent,{...eventEnv,ANALYTICS_RATE_LIMITER:undefined});
assert.equal(analyticsProtectionMissing.status,503,"Analytics ingestion must fail safely when required protection is unavailable");

const salesLimiters={SALES_RATE_LIMITER:allowedLimiter,SALES_RESEARCH_RATE_LIMITER:allowedLimiter};
for(const unsafeUrl of ["https://localhost/private","https://127.0.0.1/private","https://100.64.0.1/private","https://169.254.169.254/latest/meta-data","https://[::1]/private"]){
  assert.equal(validPublicHttps(unsafeUrl),"",`Unsafe research URL must be rejected: ${unsafeUrl}`);
  const response=await postJson("/api/sell/identify",{query:"Example",targetWebsite:unsafeUrl},salesLimiters);
  assert.equal(response.status,400,`Sales identify must reject unsafe URL: ${unsafeUrl}`);
}
assert.equal(validPublicHttps("https://example.com/about"),"https://example.com/about","Public HTTPS research URLs must remain supported");
const salesUnexpected=await postJson("/api/sell/identify",{query:"Example",targetWebsite:"https://example.com",unexpected:true},salesLimiters);
assert.equal(salesUnexpected.status,400,"Sales endpoints must reject unsupported fields");
const legacyResearchPayload={
  business:TELSTRA_IDENTITY,
  offering:{website:"https://www.accessworkwear.com.au/",businessName:"Access Workwear",description:""},
  seller:{website:"https://www.accessworkwear.com.au/"},
  target:{website:"https://www.telstra.com.au/"},
  demo:true
};
assert.equal((await postJson("/api/sell/research",legacyResearchPayload,salesLimiters)).status,200,"The existing two-company sales workflow must remain compatible");
assert.equal((await postJson("/api/sell/research",{...legacyResearchPayload,business:{...TELSTRA_IDENTITY,unexpected:"reject"}},salesLimiters)).status,400,"Unexpected nested sales properties must be rejected");
const oversizedDocument=await postJson("/api/sell/document-review",{text:"x".repeat(81000)},salesLimiters);
assert.equal(oversizedDocument.status,413,"Sales document requests must enforce the transport-size ceiling");
const salesThrottled=await postJson("/api/sell/identify",{query:"Example",targetWebsite:"https://example.com"},{SALES_RATE_LIMITER:{limit:async()=>({success:false})}});
assert.equal(salesThrottled.status,429,"Sales rate limits must fail closed before external research");
const salesProtectionMissing=await postJson("/api/sell/identify",{query:"Example",targetWebsite:"https://example.com"},{SALES_RATE_LIMITER:allowedLimiter});
assert.equal(salesProtectionMissing.status,503,"Research must fail safely when its operation-specific limiter is unavailable");
const quotaDb={prepare:()=>({bind:()=>({run:async()=>({meta:{changes:0}})})})};
const dailyLimited=await postJson("/api/sell/review",{url:"https://example.com/article"},{...salesLimiters,DB:quotaDb,AI:{run:async()=>({})}});
assert.equal(dailyLimited.status,429,"The configurable daily research ceiling must fail closed");

const concurrentRequest=new Request("https://deep-cuts.test/api/sell/research",{headers:{"cf-connecting-ip":"203.0.113.11"}});
const release=await acquireRequestSlot(concurrentRequest,"sales-research");
assert.equal(typeof release,"function","The first research request must acquire its concurrency slot");
assert.equal(await acquireRequestSlot(concurrentRequest,"sales-research"),null,"A concurrent request from the same client must be refused");
release();
const releaseAgain=await acquireRequestSlot(concurrentRequest,"sales-research");
assert.equal(typeof releaseAgain,"function","Concurrency slots must be released after a request completes");
releaseAgain();

const bindingNames=new Set((wrangler.ratelimits||[]).map(binding=>binding.name));
for(const binding of ["ANALYTICS_RATE_LIMITER","SALES_RATE_LIMITER","SALES_RESEARCH_RATE_LIMITER"]){
  assert.ok(bindingNames.has(binding),`Cloudflare rate-limit binding missing: ${binding}`);
}
assert.equal(wrangler.vars.SALES_DAILY_REQUEST_LIMIT,"100","Daily research ceiling must be explicitly configurable");
assert.equal(wrangler.vars.PRODUCTION_HOST,"deep-cuts.andrewharris501.workers.dev","Production analytics traffic must have an explicit host classification");
assert.match(migration,/CREATE TABLE IF NOT EXISTS security_daily_usage/,"Daily quota migration is missing");
assert.doesNotMatch(migration,/\b(ip|session|email|user_agent)\b/i,"Daily quota storage must not contain visitor identifiers");

console.log("Deep Cuts Phase 0 security hardening contracts passed.");

async function postJson(pathname,body,env){
  return worker.fetch(new Request(`https://deep-cuts.test${pathname}`,{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"203.0.113.10"},
    body:JSON.stringify(body)
  }),env,{});
}

function walk(directory,prefix=""){
  const files=new Set();
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;
    if(entry.isDirectory()){
      for(const file of walk(path.join(directory,entry.name),relative))files.add(file);
    }else if(entry.isFile())files.add(relative);
  }
  return files;
}
