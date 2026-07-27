import assert from "node:assert/strict";
import fs from "node:fs/promises";

const contracts=JSON.parse(await fs.readFile("edition-contracts.json","utf8"));
const reference=JSON.parse(await fs.readFile("editions/laneway-music-one-off/edition.json","utf8"));
const roster=JSON.parse(await fs.readFile(reference.lanewayCompany.rosterFile,"utf8"));
const videoData=JSON.parse(await fs.readFile(reference.lanewayCompany.artistVideoFile,"utf8"));
const questions=JSON.parse(await fs.readFile(reference.lanewayCompanyChallenge.questionFile,"utf8"));
const coolDeath=JSON.parse(await fs.readFile("editions/cool-death-records/edition.json","utf8"));
const html=await fs.readFile("index.html","utf8");
const app=await fs.readFile("js/app.js","utf8");
const quiz=await fs.readFile("js/laneway-company-quiz.js","utf8");
const css=await fs.readFile("styles.css","utf8");

const model=contracts.productModels?.indie_label;
assert.ok(model,"the Indie Label model contract must exist");
assert.equal(model.version,1);
assert.equal(model.status,"final-locked");
assert.equal(model.referenceEditionType,"laneway_company");
assert.equal(model.referenceEditionId,"dc_b9e7b66620");
assert.equal(model.approvedState,"restored-pre-catalogue-overhaul");
assert.deepEqual(model.compatibleEditionTypes,["laneway_company","indie_wheel"]);
assert.equal(model.lockedCapabilities.length,11);
assert.equal(model.editionOwnedFields.length,10);

assert.equal(reference.editionType,model.referenceEditionType);
assert.equal(reference.analytics.editionId,model.referenceEditionId);
assert.equal(reference.lanewayCompany.artistWheel.enabled,true);
assert.equal(reference.lanewayCompany.artistWheel.replacesFeaturedVideo,true);
assert.equal(reference.lanewayCompanyChallenge.numberOfQuestions,10);
assert.equal(reference.lanewayCompanyChallenge.invitationRevealAfterFirstResultMs,10000);
assert.equal(roster.artists.length,35);
assert.equal(Object.keys(videoData.artists).length,28);
assert.equal(questions.length,10);

assert.ok(html.includes('id="lanewayArtistWheel"'));
assert.ok(html.includes('id="lanewayCompanySearch"'));
assert.ok(html.includes('id="lanewayCompanyQuizScreen"'));
assert.match(app,/setLanewayCompanyWheelSpinState\(true\)/);
assert.match(app,/setAttribute\("aria-label",isSpinning\?"Spinning":"Spin"\)/);
assert.match(app,/challengeReveal\?\.afterResult\(\)/);
assert.match(app,/wheelImpact\.textContent=winner\.impactLine/);
assert.match(app,/showWinnerVideo\(winner\)/);
assert.match(app,/youtube-nocookie\.com\/embed/);
assert.match(quiz,/prepareQuestions\(questionBank,10\)/);
assert.match(css,/\[data-edition-type="laneway_company"\] \.laneway-wheel-pointer/);
assert.match(css,/border-top:31px solid #ef233c/);
assert.match(css,/background:linear-gradient\(135deg,#a9e7fa,#d9f7ff,#8fdcf5\)/);
assert.match(css,/\[data-product-type="laneway_company"\] \.laneway-wheel-video/);

const rejectedOverhaul=[html,app,quiz,css].join("\n");
for(const rejected of [
  "SURPRISE ME",
  "IF YOU LIKE",
  "YOUR NEXT LANEWAY DISCOVERIES",
  "Discover music from across the Laneway catalogue."
])assert.ok(!rejectedOverhaul.includes(rejected),`${rejected} is not part of the final Indie Label model`);

assert.equal(coolDeath.editionType,"indie_wheel");
assert.notEqual(coolDeath.analytics.editionId,model.referenceEditionId);
assert.equal(coolDeath.indieWheel.destinationKey,"bandcampURL");

console.log("Final Indie Label model lock passed: restored Laneway reference, isolated label-owned fields and rejected-overhaul guard.");
