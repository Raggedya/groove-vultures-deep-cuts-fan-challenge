import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const html=await fs.readFile('index.html','utf8');
const app=await fs.readFile('js/app.js','utf8');
const css=await fs.readFile('styles.css','utf8');
for(const id of ['bandName','artistBio','sonicSignature','featureList','featuredVideo','featuredVideoFrame','platformLinks','shareButton','poweredByLabel'])assert.ok(html.includes(`id="${id}"`),`Missing locked discovery control ${id}`);
for(const forbidden of ['quizScreen','timerRing','answerList','copyButton','Official Music'])assert.ok(!html.includes(forbidden),`Locked artist page must not contain ${forbidden}`);
for(const visualClass of ['hero-stage','hero-artwork','artist-title-row','artist-bio','sonic-signature','feature-list','featured-video','video-frame','platform-links'])assert.ok(html.includes(`class="${visualClass}`),`Missing master-layout element ${visualClass}`);
assert.match(css,/\.hero-artwork\{[^}]*height:auto/,'Aggits must preserve his native aspect ratio.');
assert.match(css,/\.platform-links\{[^}]*grid-template-columns:1fr 1fr/,'Master layout requires paired destination cards.');
assert.match(css,/\.video-frame\{[^}]*aspect-ratio:16\/9/,'Featured YouTube screen must preserve a 16:9 ratio.');
assert.ok(!css.includes('.platform-link.is-disabled'),'Unavailable destinations must not render disabled cards.');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'Attention animation must respect reduced-motion settings.');
assert.ok(app.includes('setInterval(run,10000)'),'Waveform and destination attention cycle must repeat every ten seconds.');
for(const platform of ['buyMusic','spotify','instagram','bandcamp','youtube','facebook','website','merchandise','newsReviews'])assert.ok(app.includes(`key:"${platform}"`),`Missing standard ${platform} destination`);
for(const destination of ['history','specifications','buyerGuide','ownersClub','partsRestoration','carsForSale'])assert.ok(app.includes(`key:"${destination}"`),`Missing standard Cars destination ${destination}`);
assert.ok(app.includes('config.editionType==="car"'),'Music and Cars editions must remain explicitly separated by configuration.');
for(const label of ['Discover','Watch','Connect','Own & Restore'])assert.ok(app.includes(`"${label}"`),`Missing locked Cars navigation label ${label}`);
assert.ok(!app.includes('key:"tip"'),'Tip must not be rendered by the discovery engine.');
assert.ok(app.includes('if(!url)continue'),'Unverified or unavailable destinations must be omitted entirely.');
assert.ok(app.includes('youtube-nocookie.com/embed/'),'Featured videos must use the privacy-enhanced YouTube player.');
assert.ok(app.includes('balanceLinkGrid()'),'Destination cards must rebalance without visual gaps.');
assert.ok(app.includes('editionEntry.editionId'),'Public routing must use opaque edition IDs.');
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
for(const edition of platform.editions){
  assert.match(edition.editionId,/^[A-Za-z0-9_-]{4,40}$/);
  assert.equal(edition.canonicalPath,`/e/${edition.editionId}`);
  assert.ok(!edition.canonicalPath.toLowerCase().includes(edition.slug),'Public route must not expose the band slug.');
  JSON.parse(await fs.readFile(edition.config,'utf8'));
}
console.log('Discovery tests passed: featured video, opaque routes, verified-only links, balanced cards and attention cycle.');
