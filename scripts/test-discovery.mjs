import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const html=await fs.readFile('index.html','utf8');
const app=await fs.readFile('js/app.js','utf8');
const css=await fs.readFile('styles.css','utf8');
for(const id of ['bandName','artistBio','sonicSignature','platformLinks','shareButton'])assert.ok(html.includes(`id="${id}"`),`Missing locked discovery control ${id}`);
for(const forbidden of ['quizScreen','timerRing','answerList','videoSection','copyButton','Official Music'])assert.ok(!html.includes(forbidden),`Locked artist page must not contain ${forbidden}`);
for(const visualClass of ['hero-stage','hero-artwork','artist-title-row','artist-bio','sonic-signature','feature-list','platform-links'])assert.ok(html.includes(`class="${visualClass}`),`Missing master-layout element ${visualClass}`);
assert.match(css,/\.hero-artwork\{[^}]*height:auto/,'Aggits must preserve his native aspect ratio.');
assert.match(css,/\.platform-links\{[^}]*grid-template-columns:1fr 1fr/,'Master layout requires paired destination cards.');
assert.match(css,/\.platform-link\.is-disabled/,'Unavailable standard destinations must remain visible and disabled.');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'Attention animation must respect reduced-motion settings.');
assert.ok(app.includes('setInterval(run,10000)'),'Waveform and destination attention cycle must repeat every ten seconds.');
for(const platform of ['buyMusic','spotify','instagram','bandcamp','youtube','facebook','website','merchandise','tip','newsReviews'])assert.ok(app.includes(`key:"${platform}"`),`Missing standard ${platform} destination`);
assert.ok(app.includes('editionEntry.editionId'),'Public routing must use opaque edition IDs.');
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
for(const edition of platform.editions){
  assert.match(edition.editionId,/^[A-Za-z0-9_-]{4,40}$/);
  assert.equal(edition.canonicalPath,`/e/${edition.editionId}`);
  assert.ok(!edition.canonicalPath.toLowerCase().includes(edition.slug),'Public route must not expose the band slug.');
  const config=JSON.parse(await fs.readFile(edition.config,'utf8'));
  assert.ok(Object.hasOwn(config.links,'tip'),`${edition.slug} needs optional tip configuration`);
}
console.log('Discovery tests passed: locked one-screen design, opaque routes, fixed destinations, attention cycle and disabled states.');
