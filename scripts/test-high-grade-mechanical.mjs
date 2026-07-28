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
assert.equal(config.business.buttonLightSequence,true,'HGM must opt in to its sequential carnival-light button treatment.');
assert.equal(crypto.createHash('sha256').update(aggits).digest('hex'),'892848ddef048125a9ff577036709883da4ca9e3637fd7fdf082b7172c700f73','The exact owner-supplied HGM Aggits asset was changed.');
assert.equal(crypto.createHash('sha256').update(logo).digest('hex'),'dc23a13a9d82740848e3ccbaea28eac43f3228e4f0194a0b47c99788a4bff6e3','The verified official HGM logo asset was changed.');
assert.equal(config.featuredVideo.youtubeURL,'https://www.youtube.com/watch?v=TgKUyWn0Nf8');
assert.equal(config.featuredVideo.selectionBasis,'owner-selected');
assert.equal(config.featuredVideo.ownerSelected,true);
assert.equal(config.business.jobs.length,8);
assert.equal(new Set(config.business.jobs.map(job=>job.id)).size,8);
assert.equal(config.business.locationWheel.options.length,7,'The HGM service map must retain all seven verified options.');
assert.equal(new Set(config.business.locationWheel.options.map(option=>option.id)).size,7,'HGM service-map option IDs must be unique.');
assert.deepEqual(config.business.rolePaths.map(item=>[item.label,item.detail]),[
  ['Short Term Roles','Contact Jade'],
  ['Longer Term Roles','Contact Katie']
]);
for(const rolePath of config.business.rolePaths){
  assert.equal(rolePath.url,'https://www.hgmechanical.com.au/contact/');
  assert.ok(research.sources.some(source=>source.destination===`rolePath:${rolePath.id}`&&source.url===rolePath.url&&source.identityVerified===true),`${rolePath.id} lacks verified official contact evidence.`);
}
for(const job of config.business.jobs){
  assert.match(job.url,/^https:\/\/www\.hgmechanical\.com\.au\/available-jobs\/[^/?#]+\/$/);
  assert.ok(research.sources.some(source=>source.destination===`job:${job.id}`&&source.url===job.url&&source.identityVerified===true),`${job.id} lacks verified official evidence.`);
}
for(const option of config.business.locationWheel.options){
  assert.ok(option.label&&option.type&&option.description&&option.sourceLabel,`${option.id} is missing required service-map copy.`);
  assert.match(option.sourceURL,/^https:\/\/www\.hgmechanical\.com\.au\//,`${option.id} must use an official HGM source.`);
  assert.ok(research.sources.some(source=>source.destination===`locationWheel:${option.id}`&&source.url===option.sourceURL&&source.identityVerified===true),`${option.id} lacks verified official location evidence.`);
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
assert.ok(app.includes('await BusinessQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("businessChallengeButton")})'));
assert.ok(app.includes('business&&config.business?.showHeroArtwork===false'));
assert.ok(app.includes('titleRow.classList.toggle("visually-hidden",business&&config.business?.showTitle===false)'));
assert.ok(app.includes('if(config.business?.buttonLightSequence===true)sequenceBusinessButtons()'));
assert.ok(app.indexOf('for(const rolePath of config.business?.rolePaths||[])')<app.indexOf('for(const job of config.business?.jobs||[])'),'The two featured role pathways must render above the individual vacancies.');
assert.ok(app.includes("interaction_source:source"));
assert.ok(app.includes("role_path"));
assert.ok(app.includes("function sequenceBusinessButtons()"));
assert.ok(app.includes("function buildBusinessLocationWheel()"));
assert.ok(app.includes('interaction_source:"business_location_wheel"'));
assert.ok(app.includes('duration=reduced?180:3900'),'The HGM wheel must use a brief reduced-motion selection.');
assert.ok(app.includes('selected===lastSelected'),'The HGM wheel must avoid an immediate repeated result.');
const businessRendererStart=app.indexOf('function buildBusinessLinks(){');
const businessRendererEnd=app.indexOf('function trackBusinessOutbound',businessRendererStart);
assert.ok(businessRendererStart>=0&&businessRendererEnd>businessRendererStart);
const businessRenderer=app.slice(businessRendererStart,businessRendererEnd);
assert.equal((businessRenderer.match(/class="link-arrow"/g)||[]).length,1,'Only the HGM quiz CTA may retain its chevron; job cards must omit theirs.');
assert.ok(businessRenderer.indexOf('els.links.append(challenge)')<businessRenderer.indexOf('buildBusinessLocationWheel()'),'The service-map wheel must render directly below the HGM quiz button.');
assert.ok(quiz.includes('Not quite — now you know.'));
assert.ok(quiz.includes('wrong-answer'));
assert.ok(quiz.includes('best-answer'));
assert.ok(css.includes('[data-edition-type="business"] .business-job-link'));
assert.ok(css.includes('[data-edition-type="business"] .business-role-path-link'));
assert.ok(css.includes('@keyframes businessCarnivalLight'));
assert.ok(css.includes('@keyframes businessCarnivalMark'));
assert.ok(css.includes('.business-location-wheel'));
assert.ok(css.includes('@keyframes businessLocationSpin'));
assert.ok(css.includes('@keyframes businessLocationReveal'));
assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{.*business-carnival-light.*animation:none/s,'The carnival-light sequence must stop for reduced-motion visitors.');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{.*business-location-spin-spiral.*animation:none/s,'The HGM wheel spinner must stop for reduced-motion visitors.');
assert.match(css,/\[data-edition-type="business"\] \.business-jobs-heading\{grid-column:1\/-1/,'The jobs introduction must span the grid above every role.');
assert.ok(html.includes('<span id="poweredByLabel">Deep Cuts</span>'));
assert.ok(html.includes('<small id="coverCopyright">Copyright Clearlight Creative</small>'));

console.log('High Grade Mechanical tests passed: exact Aggits, verified HGM jobs, owner-selected video, isolated quiz and locked footer.');
