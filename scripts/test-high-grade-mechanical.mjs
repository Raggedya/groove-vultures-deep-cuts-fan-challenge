import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const entry=platform.editions.find(item=>item.slug==='high-grade-mechanical');
assert.ok(entry?.active,'High Grade Mechanical must be an active isolated edition.');
assert.equal(entry.editionId,'dc_4a71b2c8e9');
assert.equal(entry.canonicalPath,`/e/${entry.editionId}`);
assert.ok(!entry.canonicalPath.includes('high-grade'),'The public HGM route must remain opaque.');

const config=JSON.parse(await fs.readFile(entry.config,'utf8'));
const questions=JSON.parse(await fs.readFile(config.businessChallenge.questionFile,'utf8'));
const research=JSON.parse(await fs.readFile('editions/high-grade-mechanical/research.json','utf8'));
const app=await fs.readFile('js/app.js','utf8');
const quiz=await fs.readFile('js/business-quiz.js','utf8');
const html=await fs.readFile('index.html','utf8');
const css=await fs.readFile('styles.css','utf8');
const aggits=await fs.readFile(config.characterArtwork);
const logo=await fs.readFile(config.business.logoArtwork);

assert.equal(config.editionType,'business');
assert.equal(config.brandName,'Deep Cuts Business');
assert.equal(config.characterArtwork,'assets/hgm-aggits-owner-supplied.jpg');
assert.equal(config.business.showHeroArtwork,false,'The marked-up HGM live page must omit its large Aggits hero panel.');
assert.equal(config.business.showTitle,false,'The marked-up HGM live page must omit the duplicated company-name title.');
assert.equal(crypto.createHash('sha256').update(aggits).digest('hex'),'892848ddef048125a9ff577036709883da4ca9e3637fd7fdf082b7172c700f73','The exact owner-supplied HGM Aggits asset was changed.');
assert.equal(crypto.createHash('sha256').update(logo).digest('hex'),'dc23a13a9d82740848e3ccbaea28eac43f3228e4f0194a0b47c99788a4bff6e3','The verified official HGM logo asset was changed.');
assert.equal(config.featuredVideo.youtubeURL,'https://www.youtube.com/watch?v=TgKUyWn0Nf8');
assert.equal(config.featuredVideo.selectionBasis,'owner-selected');
assert.equal(config.featuredVideo.ownerSelected,true);
assert.equal(config.business.jobs.length,8);
assert.equal(new Set(config.business.jobs.map(job=>job.id)).size,8);
for(const job of config.business.jobs){
  assert.match(job.url,/^https:\/\/www\.hgmechanical\.com\.au\/available-jobs\/[^/?#]+\/$/);
  assert.ok(research.sources.some(source=>source.destination===`job:${job.id}`&&source.url===job.url&&source.identityVerified===true),`${job.id} lacks verified official evidence.`);
}
assert.equal(questions.length,10);
for(const question of questions){
  assert.equal(question.active,true);
  assert.equal(question.options.length,4);
  assert.ok(question.options.includes(question.correctAnswer));
  assert.ok(research.sources.some(source=>source.url===question.sourceURL&&source.identityVerified===true),`${question.id} lacks verified source evidence.`);
}
for(const id of ['businessQuizScreen','businessAnswerList','businessResultScreen','businessResultCareersLink'])assert.ok(html.includes(`id="${id}"`),`Missing HGM quiz control ${id}.`);
assert.ok(app.includes('function isBusinessEdition()'));
assert.ok(app.includes('buildBusinessLinks()'));
assert.ok(app.includes('if(business)await BusinessQuiz.configure'));
assert.ok(app.includes('business&&config.business?.showHeroArtwork===false'));
assert.ok(app.includes('titleRow.classList.toggle("visually-hidden",business&&config.business?.showTitle===false)'));
const businessRendererStart=app.indexOf('function buildBusinessLinks(){');
const businessRendererEnd=app.indexOf('function trackBusinessOutbound',businessRendererStart);
assert.ok(businessRendererStart>=0&&businessRendererEnd>businessRendererStart);
const businessRenderer=app.slice(businessRendererStart,businessRendererEnd);
assert.equal((businessRenderer.match(/class="link-arrow"/g)||[]).length,1,'Only the HGM quiz CTA may retain its chevron; job cards must omit theirs.');
assert.ok(quiz.includes('Not quite — now you know.'));
assert.ok(quiz.includes('wrong-answer'));
assert.ok(quiz.includes('best-answer'));
assert.ok(css.includes('[data-edition-type="business"] .business-job-link'));
assert.match(css,/\[data-edition-type="business"\] \.business-jobs-heading\{grid-column:1\/-1/,'The jobs introduction must span the grid above every role.');
assert.ok(html.includes('<span id="poweredByLabel">Deep Cuts</span>'));
assert.ok(html.includes('<small id="coverCopyright">Copyright Clearlight Creative</small>'));

console.log('High Grade Mechanical tests passed: exact Aggits, verified HGM jobs, owner-selected video, isolated quiz and locked footer.');
