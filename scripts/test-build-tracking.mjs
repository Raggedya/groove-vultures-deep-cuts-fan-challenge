import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildSummary,calculateUsageCost,completionEmailBody,finishBuild,formatDuration,startBuild,recordUsage} from './build-tracker.mjs';

const root=path.resolve('output','.tracking-test');
await fs.rm(root,{recursive:true,force:true});
await fs.mkdir(path.join(root,'config'),{recursive:true});
await fs.writeFile(path.join(root,'config','build-tracking.json'),JSON.stringify({reporting_currency:'AUD',original_currency:'USD',email_recipient:'test@example.com',detailed_usage_in_email:false,include_failed_builds:true,pricing_table:'config/ai-pricing.json'}));
await fs.writeFile(path.join(root,'config','ai-pricing.json'),JSON.stringify({currency:'USD',models:{'test-model':{input_per_million:2,cached_input_per_million:1,output_per_million:4,reasoning_per_million:5}}}));

const started=new Date('2026-07-14T01:00:00.000Z');
const build=await startBuild({slug:'test-band',artist:'Test Band',root,now:started,buildId:'DC-TESTBAND-20260714-001'});
assert.equal(build.started_at,started.toISOString());assert.equal(build.status,'in progress');
await recordUsage(build.build_id,{provider:'test',model:'test-model',calls:2,input_tokens:1_000_000,cached_input_tokens:500_000,output_tokens:250_000,reasoning_tokens:100_000,service_charges:[{service:'image',amount:1,currency:'USD',method:'actual'}]},{root});
const completed=await finishBuild(build.build_id,{root,now:new Date('2026-07-14T01:12:47.000Z'),deploymentURL:'https://example.com',gitCommit:'a1b2c3d',env:{DEEP_CUTS_AUD_EXCHANGE_RATE:'1.5',DEEP_CUTS_EXCHANGE_RATE_DATE:'2026-07-14',DEEP_CUTS_EXCHANGE_RATE_SOURCE:'Test rate'},fetchImpl:null});
assert.equal(completed.completed_at,'2026-07-14T01:12:47.000Z');assert.equal(completed.production_seconds,767);assert.equal(completed.production_time_display,'00h 12m 47s');
assert.equal(completed.ai_cost_original_currency,5);assert.equal(completed.ai_cost_aud,7.5);assert.equal(completed.cost_method,'calculated');
assert.match(buildSummary(completed),/BUILD SUMMARY/);assert.match(buildSummary(completed),/Build cost: A\$7\.50/);assert.match(buildSummary(completed),/Production time: 12 minutes 47 seconds/);
const email=completionEmailBody({bandName:'Test Band',publicURL:'https://example.com'},completed);
assert.match(email,/BUILD SUMMARY/);assert.match(email,/Build cost: A\$7\.50/);assert.match(email,/Build ID: DC-TESTBAND-20260714-001/);assert.match(email,/Git commit: a1b2c3d/);

const empty={usage:{models:[],service_charges:[]}};
assert.equal(calculateUsageCost(empty,{models:{}},1.5).method,'unavailable');
assert.equal(calculateUsageCost(empty,{models:{}},1.5).aud,null);
assert.equal(formatDuration(3723),'01h 02m 03s');

const failed=await startBuild({slug:'failed-band',artist:'Failed Band',root,now:started,buildId:'DC-FAILEDBAND-20260714-001'});
const failurePreview=await finishBuild(failed.build_id,{root,now:new Date('2026-07-14T01:00:30.000Z'),status:'failed',failureReason:'Preview',env:{},fetchImpl:null,persist:false});
assert.equal(failurePreview.production_seconds,30);
await fs.access(path.join(root,'build-records','in-progress',`${failed.build_id}.json`));
const failedRecord=await finishBuild(failed.build_id,{root,now:new Date('2026-07-14T01:01:00.000Z'),status:'failed',failureReason:'Deliberate test failure',env:{},fetchImpl:null});
assert.equal(failedRecord.status,'failed');assert.equal(failedRecord.production_seconds,60);assert.equal(failedRecord.failure_reason,'Deliberate test failure');
const log=(await fs.readFile(path.join(root,'build-records','builds.jsonl'),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
assert.equal(log.length,2);assert.equal(log[1].status,'failed');

await fs.rm(root,{recursive:true,force:true});
console.log('Build tracking tests passed: timestamps, duration, cost, AUD conversion, unavailable usage, failure retention and email summary.');
