import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const entry=platform.editions.find(item=>item.slug==='hays');
assert.ok(entry?.active,'Hays must be an active isolated edition.');
assert.equal(entry.editionId,'dc_3481f25897');
assert.equal(entry.canonicalPath,`/e/${entry.editionId}`);
assert.ok(!entry.canonicalPath.includes('hays'),'The public Hays route must remain opaque.');

const config=JSON.parse(await fs.readFile(entry.config,'utf8'));
const questions=JSON.parse(await fs.readFile(config.businessChallenge.questionFile,'utf8'));
const research=JSON.parse(await fs.readFile('editions/hays/research.json','utf8'));
const app=await fs.readFile('js/app.js','utf8');
const quiz=await fs.readFile('js/business-quiz.js','utf8');
const html=await fs.readFile('index.html','utf8');
const css=await fs.readFile('styles.css','utf8');
const aggits=await fs.readFile(config.characterArtwork);
const logo=await fs.readFile(config.business.logoArtwork);

assert.equal(config.editionType,'business');
assert.equal(config.brandName,'Deep Cuts Business');
assert.equal(config.characterArtwork,'assets/aggits-original-cutout-v4.png');
assert.equal(crypto.createHash('sha256').update(aggits).digest('hex'),'06290f721c96e01ef50912270d861c7cba6e25016cb2823c61b72936b6a64344','Hays must use the immutable standard Aggits artwork.');
assert.notEqual(config.characterArtwork,'assets/hgm-aggits-owner-supplied.jpg','The HGM-only Aggits asset must not be reused by Hays.');
assert.equal(crypto.createHash('sha256').update(logo).digest('hex'),'079e9db58b7b45d3d25ac51af89002855dc071d40e842191c80ffea909e08a6f','The verified official Hays logo asset changed.');
assert.equal(config.business.logoShape,'square');
assert.equal(config.business.buttonLightSequence,false,'The HGM-only carnival sequence must not transfer to Hays.');
assert.deepEqual(config.business.heroLabels,['Mining','Watch','Find Jobs','Employers']);

assert.equal(config.featuredVideo.youtubeURL,'https://www.youtube.com/watch?v=TgKUyWn0Nf8');
assert.equal(config.featuredVideo.selectionBasis,'owner-selected');
assert.equal(config.featuredVideo.ownerSelected,true);
assert.match(config.featuredVideo.title,/Demo Video/i);
assert.match(config.business.videoLabel,/demo/i);
assert.ok(research.sources.some(source=>source.destination==='featuredVideo'&&/no Hays ownership, endorsement or official association/i.test(source.evidence)));

assert.equal(config.business.jobs.length,5);
assert.match(config.business.jobURLPrefix,/^https:\/\/www\.hays\.com\.au\/job-detail\/$/);
assert.equal(new Set(config.business.jobs.map(job=>job.id)).size,5);
for(const job of config.business.jobs){
  assert.match(job.url,/^https:\/\/www\.hays\.com\.au\/job-detail\/JOB_\d+\?jobSource=HaysGCJ$/);
  assert.ok(research.sources.some(source=>source.destination===`job:${job.id}`&&source.url===job.url&&source.identityVerified===true),`${job.id} lacks matching official evidence.`);
}

assert.equal(questions.length,10);
for(const question of questions){
  assert.equal(question.active,true);
  assert.equal(question.options.length,4);
  assert.ok(question.options.includes(question.correctAnswer));
  assert.ok(research.sources.some(source=>source.url===question.sourceURL&&source.identityVerified===true),`${question.id} lacks verified source evidence.`);
}

assert.ok(app.includes('branding?.logoSurface==="light"'));
assert.ok(app.includes('branding?.logoShape==="square"'));
assert.ok(quiz.includes('config.business.logoSurface==="light"'));
assert.ok(quiz.includes('config.business.logoShape==="square"'));
assert.ok(css.includes('.business-logo-on-light'));
assert.ok(css.includes('.business-logo-square'));
assert.ok(html.includes('<span id="poweredByLabel">Deep Cuts</span>'));
assert.ok(html.includes('<small id="coverCopyright">Copyright Clearlight Creative</small>'));

console.log('Hays tests passed: isolated business edition, official sources and jobs, standard Aggits, demo-video disclosure and locked footer.');
