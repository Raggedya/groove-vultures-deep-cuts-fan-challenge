import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import worker,{__test} from '../worker/index.js';

const source=fs.readFileSync('worker/index.js','utf8');
const schema=fs.readFileSync('migrations/0001_deep_cuts.sql','utf8');
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));

for(const route of ['/q/','/api/events','/api/editions','/api/builds','/api/builds/','/api/delivery','/api/webhooks/resend','/api/reports/weekly.csv','/api/reports/laneway-weekly.pdf','/api/reports/laneway-weekly.xlsx','/api/sell/'])assert.ok(source.includes(route),`Worker route missing: ${route}`);
for(const table of ['editions','analytics_events','production_jobs','delivery_events'])assert.match(schema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
for(const event of ['qr_scan','outbound_clicked','share_button_clicked','wheel_spin_started','wheel_result_shown','artist_destination_clicked','artist_directory_searched','quiz_started','quiz_question_answered','quiz_completed','quiz_abandoned','services_contact_clicked'])assert.ok(source.includes(`"${event}"`),`Worker event missing: ${event}`);
assert.equal(config.name,'deep-cuts');
assert.ok(config.assets.run_worker_first===true||config.assets.run_worker_first.includes('/q/*'));
assert.ok(config.assets.run_worker_first===true||config.assets.run_worker_first.includes('/api/*'));
assert.equal(config.d1_databases[0].binding,'DB');
assert.equal(config.ai.binding,'AI','Workers AI binding must be configured for live Commercial Instinct research');
assert.ok(source.includes('verifySvixWebhook(payload,request.headers,env.RESEND_WEBHOOK_SECRET)'),'Resend webhook signature verification is required');
assert.ok(source.includes('duplicate:true'),'Resend webhook delivery must be idempotent');
assert.ok(source.includes('deep-cuts-laneway-weekly-'),'Weekly report email must have a deterministic idempotency key');
assert.ok(source.includes('if(!response.ok)throw new Error'),'Weekly report email failures must fail closed');
assert.equal(__test.isRecordCompanyPagePath('/record-company/laneway-music'),true,'Company routes must load the Record Company application shell');
assert.equal(__test.isRecordCompanyPagePath('/record-company/laneway-music/artists/cel-001'),true,'Artist routes must load the Record Company application shell');
for(const assetPath of ['/record-company/app.js','/record-company/styles.css','/record-company/schemas.js','/record-company/index.html']){
  assert.equal(__test.isRecordCompanyPagePath(assetPath),false,`${assetPath} must be served as a static asset`);
}
assert.equal(__test.isRecordCompanyRootPath('/record-company'),true,'The Record Company entry route must recover a missing collection slug');
assert.equal(__test.isRecordCompanyRootPath('/record-company/'),true,'The trailing-slash Record Company entry route must recover a missing collection slug');
assert.equal(__test.isRecordCompanyRootPath('/record-company/laneway-music'),false,'A complete collection route must not be treated as the entry route');
assert.equal(__test.restoredLanewayEntryPath('/record-company'),'/e/dc_f63a383fac','The Record Company entry must restore the standalone Celibate Rifles edition');
assert.equal(__test.restoredLanewayEntryPath('/record-company/'),'/e/dc_f63a383fac','The trailing-slash entry must restore the standalone Celibate Rifles edition');
assert.equal(__test.restoredLanewayEntryPath('/record-company/laneway-music'),'/e/dc_f63a383fac','The former Laneway collection entry must restore Celibate Rifles');
assert.equal(__test.restoredLanewayEntryPath('/record-company/laneway-music/'),'/e/dc_f63a383fac','The former Laneway collection entry must tolerate a trailing slash');
assert.equal(__test.restoredLanewayEntryPath('/record-company/laneway-music/artists/argus'),'','Individual collection artist routes must remain available');
assert.equal(__test.restoredLanewayEntryPath('/record-company/another-label'),'','Other Record Company collections must remain available');
assert.ok(source.includes('new URL("/record-company/",url.origin)'),'Collection routes must fetch the directory asset without redirecting through index.html');
assert.ok(!source.includes('new URL("/record-company/index.html",url.origin)'),'Collection routes must preserve the company slug in the browser address');

let eventBindings=[];
const eventEnv={
  DB:{prepare:()=>({bind:(...values)=>{eventBindings=values;return{run:async()=>({success:true})}}})}
};
const eventResponse=await worker.fetch(new Request('https://deep-cuts.test/api/events',{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({
    event_id:'event-laneway-quiz-1',
    edition_id:'dc_b9e7b66620',
    event_name:'quiz_question_answered',
    timestamp:'2026-07-24T00:00:00.000Z',
    session_id:'anonymous-session',
    quiz_identifier:'laneway-company-quiz',
    quiz_run_id:'quiz-run-1',
    question_id:'laneway-q1',
    question_number:1,
    correct:false,
    tracking_version:'laneway-weekly-v1',
    ignored_sensitive_value:'must-not-be-stored'
  })
}),eventEnv,{});
assert.equal(eventResponse.status,200,'Enhanced Laneway events must be accepted');
const storedMetadata=JSON.parse(eventBindings[12]);
assert.deepEqual(
  storedMetadata,
  {tracking_version:'laneway-weekly-v1',quiz_identifier:'laneway-company-quiz',quiz_run_id:'quiz-run-1',question_id:'laneway-q1',question_number:1,correct:false},
  'Only the typed reporting metadata allow-list may be stored'
);
for(const route of ['/api/reports/laneway-weekly.pdf','/api/reports/laneway-weekly.xlsx']){
  const unauthorized=await worker.fetch(new Request(`https://deep-cuts.test${route}`),{},{});
  assert.equal(unauthorized.status,401,`${route} must require administrator authentication`);
}

const payload=JSON.stringify({type:'email.delivered',data:{email_id:'email_123'}});
const webhookId='msg_test';
const webhookTimestamp=String(Math.floor(Date.now()/1000));
const secretBytes=crypto.randomBytes(32);
const webhookSecret=`whsec_${secretBytes.toString('base64')}`;
const signature=crypto.createHmac('sha256',secretBytes).update(`${webhookId}.${webhookTimestamp}.${payload}`).digest('base64');
const validHeaders=new Headers({'svix-id':webhookId,'svix-timestamp':webhookTimestamp,'svix-signature':`v1,${signature}`});
assert.equal(await __test.verifySvixWebhook(payload,validHeaders,webhookSecret),true,'Valid Resend webhook signature should pass');
assert.equal(await __test.verifySvixWebhook(`${payload} `,validHeaders,webhookSecret),false,'Tampered Resend webhook payload should fail');
console.log('Deep Cuts Worker contract tests passed.');

