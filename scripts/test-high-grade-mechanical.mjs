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
const profileBuilder=await fs.readFile('js/business-profile.js','utf8');
const html=await fs.readFile('index.html','utf8');
const css=await fs.readFile('styles.css','utf8');
const worker=await fs.readFile('worker/index.js','utf8');
const aggits=await fs.readFile(config.characterArtwork);
const logo=await fs.readFile(config.business.logoArtwork);

assert.equal(config.editionType,'business');
assert.equal(config.brandName,'Deep Cuts Business');
assert.equal(config.characterArtwork,'assets/hgm-aggits-owner-supplied.jpg');
assert.equal(config.business.showHeroArtwork,false,'The marked-up HGM live page must omit its large Aggits hero panel.');
assert.equal(config.business.showTitle,false,'The marked-up HGM live page must omit the duplicated company-name title.');
assert.equal(config.business.buttonLightSequence,true,'HGM must opt in to its sequential carnival-light button treatment.');
assert.equal(config.businessProfile.title,'TELL US WHAT YOU WANT');
assert.equal(config.businessProfile.supportingText,'Five quick questions. Takes less than a minute.');
assert.equal(config.businessProfile.recruiter.name,'Katie');
assert.equal(typeof config.businessProfile.recruiter.mobileNumber,'string','Katie’s verified mobile number must be configured in one clearly named field.');
assert.equal(config.businessProfile.questions.length,5);
assert.deepEqual(config.businessProfile.questions.map(question=>question.id),['trade','workType','roster','pay','opportunity']);
for(const question of config.businessProfile.questions){
  assert.ok(question.profileLabel&&question.question&&question.feedback);
  assert.ok(Array.isArray(question.options)&&question.options.length>=5);
  assert.equal(new Set(question.options).size,question.options.length);
}
assert.equal(crypto.createHash('sha256').update(aggits).digest('hex'),'892848ddef048125a9ff577036709883da4ca9e3637fd7fdf082b7172c700f73','The exact owner-supplied HGM Aggits asset was changed.');
assert.equal(crypto.createHash('sha256').update(logo).digest('hex'),'dc23a13a9d82740848e3ccbaea28eac43f3228e4f0194a0b47c99788a4bff6e3','The verified official HGM logo asset was changed.');
assert.equal(config.featuredVideo.youtubeURL,'https://www.youtube.com/watch?v=TgKUyWn0Nf8');
assert.equal(config.featuredVideo.selectionBasis,'owner-selected');
assert.equal(config.featuredVideo.ownerSelected,true);
assert.equal(config.business.jobs.length,8);
assert.equal(new Set(config.business.jobs.map(job=>job.id)).size,8);
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
assert.equal(questions.length,10);
for(const question of questions){
  assert.equal(question.active,true);
  assert.equal(question.options.length,4);
  assert.ok(question.options.includes(question.correctAnswer));
  assert.ok(research.sources.some(source=>source.url===question.sourceURL&&source.identityVerified===true),`${question.id} lacks verified source evidence.`);
}
for(const id of ['businessProfileScreen','businessProfileQuestion','businessProfileAnswers','businessProfileResultScreen','businessProfileResultRows','businessProfileSmsButton','businessProfileRestartButton'])assert.ok(html.includes(`id="${id}"`),`Missing HGM profile-builder control ${id}.`);
assert.ok(app.includes('function isBusinessEdition()'));
assert.ok(app.includes('buildBusinessLinks()'));
assert.ok(app.includes('if(config.businessProfile)'));
assert.ok(app.includes('BusinessProfile.configure({config,analytics,homeElement:els.page,invitationButton:$("businessProfileInvitationButton")})'));
assert.ok(app.includes('await BusinessQuiz.configure({config,analytics,homeElement:els.page,challengeButton:$("businessChallengeButton")})'),'Business editions without the HGM profile must retain the existing quiz.');
assert.ok(app.includes('business&&config.business?.showHeroArtwork===false'));
assert.ok(app.includes('titleRow.classList.toggle("visually-hidden",business&&config.business?.showTitle===false)'));
assert.ok(app.includes('if(config.business?.buttonLightSequence===true)sequenceBusinessButtons()'));
assert.ok(app.indexOf('for(const rolePath of config.business?.rolePaths||[])')<app.indexOf('for(const job of config.business?.jobs||[])'),'The two featured role pathways must render above the individual vacancies.');
assert.ok(app.includes("interaction_source:source"));
assert.ok(app.includes("role_path"));
assert.ok(app.includes("function sequenceBusinessButtons()"));
const businessRendererStart=app.indexOf('function buildBusinessLinks(){');
const businessRendererEnd=app.indexOf('function trackBusinessOutbound',businessRendererStart);
assert.ok(businessRendererStart>=0&&businessRendererEnd>businessRendererStart);
const businessRenderer=app.slice(businessRendererStart,businessRendererEnd);
assert.equal((businessRenderer.match(/class="link-arrow"/g)||[]).length,1,'Only the legacy Business quiz CTA may retain its chevron; job cards must omit theirs.');
assert.ok(businessRenderer.indexOf('createBusinessProfileInvitation()')<businessRenderer.indexOf('business-jobs-heading'),'The HGM profile invitation must render before the jobs heading and tiles.');
assert.ok(quiz.includes('Not quite — now you know.'));
assert.ok(quiz.includes('wrong-answer'));
assert.ok(quiz.includes('best-answer'));
assert.ok(profileBuilder.includes('The HGM profile builder requires exactly five questions.'));
assert.ok(profileBuilder.includes('candidate_profile_started'));
assert.ok(profileBuilder.includes('candidate_profile_completed'));
assert.ok(profileBuilder.includes('candidate_profile_sms_opened'));
assert.ok(profileBuilder.includes('encodeURIComponent(lines.join("\\n"))'),'The prefilled SMS body must be URL encoded.');
assert.ok(profileBuilder.includes('sms:${recipient}?&body='),'The result must use a mobile SMS link.');
assert.ok(profileBuilder.includes('answers={}'),'Start Again must clear all prior selections.');
assert.ok(profileBuilder.includes('index-=1'),'Candidates must be able to go back and revise an answer.');
for(const eventName of ['candidate_profile_started','candidate_profile_answer_selected','candidate_profile_completed','candidate_profile_sms_opened','candidate_profile_restarted'])assert.ok(worker.includes(`"${eventName}"`),`The Worker must accept ${eventName}.`);
assert.ok(css.includes('[data-edition-type="business"] .business-job-link'));
assert.ok(css.includes('[data-edition-type="business"] .business-role-path-link'));
assert.ok(css.includes('[data-edition-type="business"] .business-profile-invitation'));
assert.ok(css.includes('[data-edition-type="business"] .business-profile-answer.is-selected'));
assert.ok(css.includes('[data-edition-type="business"] .business-profile-result-row'));
assert.ok(css.includes('@keyframes businessCarnivalLight'));
assert.ok(css.includes('@keyframes businessCarnivalMark'));
assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{.*business-carnival-light.*animation:none/s,'The carnival-light sequence must stop for reduced-motion visitors.');
assert.match(css,/\[data-edition-type="business"\] \.business-jobs-heading\{grid-column:1\/-1/,'The jobs introduction must span the grid above every role.');
assert.ok(html.includes('<span id="poweredByLabel">Deep Cuts</span>'));
assert.ok(html.includes('<small id="coverCopyright">Copyright Clearlight Creative</small>'));

console.log('High Grade Mechanical tests passed: exact Aggits, verified jobs/video, HGM-only five-step candidate profile, encoded SMS handoff and locked footer.');
