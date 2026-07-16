import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';
for(const file of ['js/analytics.js','js/interactions.js','js/reporting.js'])await import(pathToFileURL(path.resolve(file)));
const A=globalThis.DeepCutsAnalytics,I=globalThis.DeepCutsInteractions,R=globalThis.DeepCutsReporting;
class MemoryStorage{constructor(){this.values=new Map()}getItem(k){return this.values.get(k)||null}setItem(k,v){this.values.set(k,v)}}
let now=Date.parse('2026-07-15T00:00:00Z');const storage=new MemoryStorage();
const tracker=new A.Tracker({platformConfig:{analytics:{localRetention:2500}},editionEntry:{slug:'band-one',editionId:'dc_test01'},editionConfig:{bandName:'Band One'},storage,windowObject:{dispatchEvent(){},sessionStorage:new MemoryStorage()},documentObject:{referrer:'',head:null},navigatorObject:{userAgent:'iPhone'},locationObject:{search:'?utm_source=poster'},now:()=>new Date(now)});
const viewed=tracker.track('discovery_page_viewed',{}, {onceKey:'page:band-one'});assert.equal(viewed.edition_id,'dc_test01');assert.equal(viewed.referring_source,'poster');assert.ok(viewed.session_id);assert.equal(tracker.track('discovery_page_viewed',{}, {onceKey:'page:band-one'}),null);
for(const platform of ['spotify','bandcamp','instagram','youtube','facebook','tiktok','website','tickets','merchandise','mailingList','tip']){I.trackOutbound(tracker,platform,`https://${platform.toLowerCase()}.example.com/path`);now+=600}
tracker.track('share_method_selected',{share_method:'copy_link'});
const report=R.aggregate(A.Tracker.storedEvents(storage))[0];assert.equal(report.pageViews,1);assert.equal(report.totalOutboundClicks,11);assert.equal(report.tipClicks,1);assert.equal(report.shareRate,1);assert.equal(report.outboundClickThroughRate,11);
const recorded=[];const t={track(name,data){recorded.push({name,data})}};assert.equal(await I.copyLink({clipboard:{writeText:async()=>{}},tracker:t,text:'https://example.com',trigger:'test',actionId:'copy'}),true);assert.deepEqual(recorded.map(x=>x.name),['copy_link_clicked','copy_link_succeeded']);
assert.equal(await I.nativeShare({navigatorObject:{share:async()=>{}},tracker:t,payload:{},actionId:'native'}),'completed');assert.ok(recorded.some(x=>x.name==='native_share_completed'));
assert.doesNotThrow(()=>I.trackOutbound({track(){throw new Error('offline')}},'tip','https://paypal.me/example'));
console.log('Analytics tests passed: discovery views, shares, every destination including Tip, deduplication and reporting.');
