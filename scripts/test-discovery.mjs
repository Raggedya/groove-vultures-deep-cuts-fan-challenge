import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const html=await fs.readFile('index.html','utf8');const app=await fs.readFile('js/app.js','utf8');
for(const id of ['bandName','platformLinks','videoSection','shareButton','copyButton'])assert.ok(html.includes(`id="${id}"`),`Missing discovery control ${id}`);
for(const forbidden of ['quizScreen','timerRing','answerList','ding.mp3'])assert.ok(!html.includes(forbidden),`Public page must not load legacy quiz element ${forbidden}`);
for(const platform of ['spotify','bandcamp','youtube','instagram','facebook','tiktok','website','tickets','merchandise','mailingList','tip'])assert.ok(app.includes(`["${platform}"`),`Missing ${platform} discovery destination`);
assert.ok(app.includes('youtube-nocookie.com/embed/'),'Featured video must use privacy-enhanced YouTube embeds.');
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
for(const edition of platform.editions){const config=JSON.parse(await fs.readFile(edition.config,'utf8'));assert.ok(Object.hasOwn(config.links,'tip'),`${edition.slug} needs optional tip configuration`);assert.ok(config.featuredVideo,`${edition.slug} needs optional featured video configuration`)}
console.log('Discovery tests passed: single-page UI, all destinations, optional tip and privacy-enhanced featured video.');
