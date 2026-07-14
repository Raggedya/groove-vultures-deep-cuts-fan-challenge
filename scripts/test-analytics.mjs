import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

await import(pathToFileURL(path.resolve('js/analytics.js')));
await import(pathToFileURL(path.resolve('js/interactions.js')));
await import(pathToFileURL(path.resolve('js/reporting.js')));
const A=globalThis.DeepCutsAnalytics;
const I=globalThis.DeepCutsInteractions;
const R=globalThis.DeepCutsReporting;

class MemoryStorage{
  constructor(){this.values=new Map()}
  getItem(key){return this.values.get(key)||null}
  setItem(key,value){this.values.set(key,value)}
}

let nowMs=Date.parse('2026-07-14T00:00:00Z');
const storage=new MemoryStorage();
const windowObject={dispatchEvent(){},fetch(){return Promise.reject(new Error('offline'))}};
const tracker=new A.Tracker({
  platformConfig:{analytics:{localRetention:2500}},editionEntry:{slug:'band-one'},editionConfig:{bandName:'Band One'},storage,windowObject,
  documentObject:{referrer:'https://example.com/article',head:null},navigatorObject:{userAgent:'Mozilla/5.0 (iPhone)'},locationObject:{search:'?utm_source=newsletter'},now:()=>new Date(nowMs)
});
tracker.setRun('run-one');
const viewed=tracker.track('quiz_page_viewed',{}, {onceKey:'page:band-one'});
assert.equal(viewed.edition_id,'band-one');
assert.equal(viewed.band_name,'Band One');
assert.equal(viewed.quiz_identifier,'band-one:deep-cuts-v1');
assert.equal(viewed.quiz_run_id,'run-one');
assert.equal(viewed.referring_source,'newsletter');
assert.equal(viewed.device_category,'mobile');
assert.equal(tracker.track('quiz_page_viewed',{}, {onceKey:'page:band-one'}),null,'page views must not double-count after a repeated render');

tracker.track('spotify_clicked',{destination_platform:'spotify'},{dedupeKey:'outbound:spotify',dedupeMs:500});
assert.equal(tracker.track('spotify_clicked',{destination_platform:'spotify'},{dedupeKey:'outbound:spotify',dedupeMs:500}),null,'rapid duplicate outbound taps must be suppressed');
nowMs+=600;
tracker.track('spotify_clicked',{destination_platform:'spotify'},{dedupeKey:'outbound:spotify',dedupeMs:500});
tracker.track('bandcamp_clicked',{destination_platform:'bandcamp'});
tracker.track('quiz_started');
tracker.track('quiz_completed',{final_score:9,completion_time_seconds:82});
tracker.track('share_method_selected',{share_method:'whatsapp'});
tracker.track('instagram_clicked',{destination_platform:'instagram'});
tracker.track('facebook_clicked',{destination_platform:'facebook'});
tracker.track('website_clicked',{destination_platform:'website'});
tracker.track('tickets_clicked',{destination_platform:'tickets'});
tracker.track('merchandise_clicked',{destination_platform:'merchandise'});

const second=new A.Tracker({platformConfig:{analytics:{localRetention:2500}},editionEntry:{slug:'band-two'},editionConfig:{bandName:'Band Two'},storage,windowObject,documentObject:{head:null},navigatorObject:{userAgent:'Desktop'},locationObject:{search:''},now:()=>new Date(nowMs)});
second.setRun('run-two');
second.track('quiz_page_viewed');
second.track('quiz_started');
second.track('quiz_completed',{final_score:6,completion_time_seconds:100});

const events=A.Tracker.storedEvents(storage);
const reports=R.aggregate(events);
const one=reports.find(report=>report.editionId==='band-one');
assert.deepEqual({views:one.pageViews,starts:one.quizStarts,completions:one.quizCompletions,shares:one.shareActions,outbound:one.totalOutboundClicks},{views:1,starts:1,completions:1,shares:1,outbound:8});
assert.equal(one.completionRate,1);
assert.equal(one.averageScore,9);
assert.equal(one.shareRate,1);
assert.equal(one.outboundClickThroughRate,8);
assert.equal(one.spotifyClicks,2);
assert.equal(one.bandcampClicks,1);
assert.equal(one.otherSocialClicks,1);
assert.equal(reports.find(report=>report.editionId==='band-two').averageScore,6,'events must remain assigned to the correct edition');

const interactionEvents=[];
const interactionTracker={track(name,data){interactionEvents.push({name,data})}};
assert.equal(I.supportsNativeShare({share(){}},'mobile'),true);
assert.equal(I.supportsNativeShare({share(){}},'desktop'),false,'desktop must use the visible fallback menu');
assert.equal(await I.nativeShare({navigatorObject:{share:async()=>{}},tracker:interactionTracker,payload:{},actionId:'native-1'}),'completed');
assert.deepEqual(interactionEvents.slice(0,3).map(item=>item.name),['share_method_selected','native_share_opened','native_share_completed']);
const abort=new Error('cancelled');abort.name='AbortError';
assert.equal(await I.nativeShare({navigatorObject:{share:async()=>{throw abort}},tracker:interactionTracker,payload:{},actionId:'native-2'}),'cancelled');
assert.ok(interactionEvents.some(item=>item.name==='native_share_cancelled'));
assert.equal(await I.copyLink({clipboard:{writeText:async()=>{}},tracker:interactionTracker,text:'https://example.com',trigger:'test',actionId:'copy-1'}),true);
assert.deepEqual(interactionEvents.slice(-2).map(item=>item.name),['copy_link_clicked','copy_link_succeeded']);
assert.equal(await I.copyLink({clipboard:{writeText:async()=>{throw new Error('blocked')}},tracker:interactionTracker,text:'https://example.com',trigger:'test-fail',actionId:'copy-2'}),false);
for(const method of ['facebook','x','whatsapp','messenger','email'])assert.ok(I.shareMethodUrl(method,{title:'Test',text:'Result',url:'https://example.com'}),`${method} must have a desktop share destination`);
for(const platform of ['spotify','bandcamp','instagram','youtube','facebook','tiktok','website','tickets','merchandise']){
  const recorded=[];I.trackOutbound({track(name,data){recorded.push({name,data})}},platform,`https://${platform}.example.com/path`);
  assert.equal(recorded[0].name,`${platform}_clicked`,`${platform} must record its own event`);
  assert.equal(recorded[0].data.destination_platform,platform);
}
assert.doesNotThrow(()=>I.trackOutbound({track(){throw new Error('analytics offline')}},'spotify','https://open.spotify.com/artist/test'),'analytics failure must never break outbound navigation');

const app=await fs.readFile('js/app.js','utf8');
const interactions=await fs.readFile('js/interactions.js','utf8');
for(const event of ['quiz_page_viewed','quiz_started','quiz_completed','share_button_clicked','share_method_selected'])assert.ok(app.includes(event),`app.js must instrument ${event}`);
for(const event of ['native_share_opened','native_share_completed','copy_link_clicked','copy_link_succeeded'])assert.ok(interactions.includes(event),`interactions.js must instrument ${event}`);
for(const platform of ['spotify','bandcamp','instagram','youtube','facebook','tiktok','website','tickets','merchandise'])assert.ok(app.includes(`['${platform}'`),`app.js must build and independently instrument the ${platform} destination`);
const html=await fs.readFile('index.html','utf8');
for(const method of ['facebook','x','whatsapp','messenger','email','copy_link'])assert.ok(html.includes(`data-share-method="${method}"`),`desktop share fallback must include ${method}`);

console.log('Analytics tests passed: context, edition assignment, deduplication, outbound platforms, sharing hooks and reporting formulas.');
