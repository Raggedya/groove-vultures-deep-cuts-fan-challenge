import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {__test} from '../worker/index.js';

const source=fs.readFileSync('worker/index.js','utf8');
const schema=fs.readFileSync('migrations/0001_deep_cuts.sql','utf8');
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));

for(const route of ['/q/','/api/events','/api/editions','/api/builds','/api/delivery','/api/webhooks/resend','/api/reports/weekly.csv'])assert.ok(source.includes(route),`Worker route missing: ${route}`);
for(const table of ['editions','analytics_events','production_jobs','delivery_events'])assert.match(schema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
for(const event of ['qr_scan','outbound_clicked','share_button_clicked'])assert.ok(source.includes(`"${event}"`),`Worker event missing: ${event}`);
assert.equal(config.name,'deep-cuts');
assert.ok(config.assets.run_worker_first.includes('/q/*'));
assert.ok(config.assets.run_worker_first.includes('/api/*'));
assert.equal(config.d1_databases[0].binding,'DB');
assert.ok(source.includes('verifySvixWebhook(payload,request.headers,env.RESEND_WEBHOOK_SECRET)'),'Resend webhook signature verification is required');
assert.ok(source.includes('duplicate:true'),'Resend webhook delivery must be idempotent');

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
