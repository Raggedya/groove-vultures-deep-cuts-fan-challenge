import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const html=await fs.readFile('index.html','utf8');const app=await fs.readFile('js/app.js','utf8');const css=await fs.readFile('styles.css','utf8');const generator=await fs.readFile('scripts/generate-social-assets.py','utf8');
for(const id of ['bandName','platformLinks','videoSection','shareButton','copyButton'])assert.ok(html.includes(`id="${id}"`),`Missing discovery control ${id}`);
for(const forbidden of ['quizScreen','timerRing','answerList','ding.mp3'])assert.ok(!html.includes(forbidden),`Public page must not load legacy quiz element ${forbidden}`);
for(const visualClass of ['hero-stage','hero-artwork','band-name','hero-headline','feature-list','platform-links'])assert.ok(html.includes(`class="${visualClass}`),`Missing reference-layout element ${visualClass}`);
for(const legacy of ['heroKicker','tagline'])assert.ok(!app.includes(legacy),`Legacy hero content must not return: ${legacy}`);
assert.match(css,/\.hero-artwork\{[^}]*height:auto/,'Aggits must preserve its native aspect ratio.');
assert.match(css,/\.platform-links\{[^}]*grid-template-columns:1fr 1fr/,'Reference layout requires paired secondary cards.');
assert.ok(app.includes('primary-destination'),'Spotify must render as the wide primary destination.');
assert.ok(generator.includes('QR_HEIGHT = 1350'),'QR promotion must use a non-distorting 4:5 portrait canvas.');
assert.ok(generator.includes("approved.resize((SIZE, 1440)"),'Approved QR-holder artwork must preserve its 3:4 aspect ratio.');
for(const platform of ['spotify','bandcamp','youtube','instagram','facebook','tiktok','website','tickets','merchandise','mailingList','tip'])assert.ok(app.includes(`["${platform}"`),`Missing ${platform} discovery destination`);
assert.ok(app.includes('youtube-nocookie.com/embed/'),'Featured video must use privacy-enhanced YouTube embeds.');
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
for(const edition of platform.editions){const config=JSON.parse(await fs.readFile(edition.config,'utf8'));assert.ok(Object.hasOwn(config.links,'tip'),`${edition.slug} needs optional tip configuration`);assert.ok(config.featuredVideo,`${edition.slug} needs optional featured video configuration`)}
console.log('Discovery tests passed: reference portrait layout, aspect-safe Aggits artwork, all destinations, optional tip and privacy-enhanced featured video.');
