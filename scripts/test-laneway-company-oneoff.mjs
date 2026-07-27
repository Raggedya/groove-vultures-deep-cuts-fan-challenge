import assert from "node:assert/strict";
import fs from "node:fs/promises";

const config=JSON.parse(await fs.readFile("editions/laneway-music-one-off/edition.json","utf8"));
const roster=JSON.parse(await fs.readFile(config.lanewayCompany.rosterFile,"utf8"));
const discovery=JSON.parse(await fs.readFile(config.lanewayCompany.artistImpactFile,"utf8"));
const questions=JSON.parse(await fs.readFile(config.lanewayCompanyChallenge.questionFile,"utf8"));
const contracts=JSON.parse(await fs.readFile("edition-contracts.json","utf8"));
const html=await fs.readFile("index.html","utf8");
const app=await fs.readFile("js/app.js","utf8");
const quiz=await fs.readFile("js/laneway-company-quiz.js","utf8");
const css=await fs.readFile("styles.css","utf8");
const worker=await fs.readFile("worker/index.js","utf8");

assert.equal(config.editionType,"laneway_company");
assert.equal(config.bandName,"Laneway Music");
assert.equal(config.characterArtwork,"");
assert.deepEqual(contracts.editionTypes.laneway_company.exclusiveConfig,["lanewayCompany","lanewayCompanyChallenge"]);
assert.equal(config.lanewayCompany.logoArtwork,"assets/laneway-music-logo-reverse-transparent.png");
assert.equal(config.lanewayCompany.destinationKey,"spotifyURL");
assert.equal(config.lanewayCompany.destinationLabel,"Spotify");
assert.equal(config.lanewayCompany.servicesURL,"https://www.lanewaymusic.com.au/sync");
assert.equal(config.lanewayCompanyChallenge.numberOfQuestions,10);
assert.equal(config.lanewayCompanyChallenge.title,"How Well Do You Know the Laneway Catalogue?");
assert.equal(config.lanewayCompanyChallenge.ctaLabel,"Ten questions from across Laneway Music history.");
assert.equal(config.lanewayCompanyChallenge.buttonLabel,"Take the Quiz");
assert.equal(questions.length,10);
assert.equal(new Set(questions.map(question=>question.category)).size,10);
for(const question of questions)assert.ok(roster.artists.some(artist=>artist.name===question.category),`${question.category} must be a verified wheel artist`);

assert.equal(roster.pendingArtistCount,0);
assert.equal(roster.artists.length,35);
assert.equal(new Set(roster.artists.map(artist=>artist.name.toLowerCase())).size,roster.artists.length);
assert.equal(new Set(roster.artists.map(artist=>artist.spotifyURL)).size,roster.artists.length);
assert.equal(Object.keys(discovery).length,roster.artists.length);
for(const artist of roster.artists){
  assert.match(artist.sourceURL,/^https:\/\/www\.lanewaymusic\.com\.au\//);
  assert.match(artist.spotifyURL,/^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]+$/);
  const record=discovery[artist.name];
  assert.ok(record?.description?.length>=45,`${artist.name} requires a sourced discovery statement`);
  assert.ok(record?.reasonToListen?.length>=30,`${artist.name} requires a concise reason to listen`);
  assert.ok(record.related.length>=2&&record.related.length<=3,`${artist.name} requires two or three curated recommendations`);
  for(const recommendation of record.related){
    assert.ok(roster.artists.some(candidate=>candidate.name===recommendation.artist),`${artist.name} recommendation must be in the verified roster`);
    assert.notEqual(recommendation.artist,artist.name);
    assert.ok(recommendation.reason.length>=20);
  }
  for(const [key,evidenceKey] of [["buyMusicURL","buyMusic"],["buyMerchURL","buyMerch"]]){
    if(!artist[key])continue;
    assert.match(artist[key],/^https:\/\/[^?#\s]+/);
    assert.ok(artist.purchaseVerification?.[evidenceKey]?.length>=45);
  }
}
assert.ok(roster.artists.some(artist=>artist.buyMusicURL));
assert.ok(roster.artists.some(artist=>artist.buyMerchURL));
assert.ok(roster.artists.some(artist=>!artist.buyMusicURL&&!artist.buyMerchURL));

for(const id of [
  "lanewayArtistWheel","lanewayWheelCanvas","lanewayWheelSpin","lanewayWheelIntroduction",
  "lanewayArtistDiscovery","lanewayDiscoveryArtistName","lanewayDiscoveryDestinations",
  "lanewaySurpriseButton","lanewayRecommendations","lanewayRecommendationList",
  "lanewayCompanyDirectory","lanewayCompanySearch","lanewayCompanyArtistList",
  "lanewayCompanyQuizScreen","lanewayCompanyResultScreen","lanewayCompanyResultDiscoveries",
  "lanewayCompanyResultDiscoveryList","lanewayCompanyResultContact","lanewayLicensing","lanewayLicensingLink"
])assert.ok(html.includes(`id="${id}"`),`Missing ${id}`);

for(const pattern of [
  /createLanewayCompanyDiscovery/,/surprise_me_clicked/,/artist_selected/,/artist_roster_selected/,
  /recommendation_shown/,/recommendation_selected/,/session_summary/,/quizRecommendations/,
  /const restingLabel=hasSelection\?"Spin again":"Discover"/,/crypto\.getRandomValues/,
  /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/,/LANEWAY_REPORTING_VERSION="laneway-weekly-v2"/
])assert.match(app,pattern);
assert.match(app,/els\.companyDirectory\.after\(linkSection\)/,"Quiz must be moved below the roster for this edition");
assert.match(app,/links\.filter\(Boolean\)/,"Missing optional destinations must be hidden");
assert.match(app,/interaction_source:"artist_directory"/);
assert.match(app,/discovery_source:source/);
assert.doesNotMatch(app,/createLanewayCompanyChallengeRevealController/);

assert.match(quiz,/prepareQuestions\(questionBank,10\)/);
assert.match(quiz,/correct\?"Exactly right\.":"Not quite/);
assert.doesNotMatch(quiz,/Good choice/);
assert.match(quiz,/renderResultDiscoveries/);
assert.match(quiz,/quiz_recommendation_selected/);
assert.match(quiz,/services_contact_clicked/);
assert.match(quiz,/quiz_abandoned/);
assert.match(quiz,/els\.resultHome\.addEventListener\("click",\(\)=>returnHome\(false\)\)/);

for(const pattern of [
  /\[data-product-type="laneway_company"\] \.laneway-discovery-card/,
  /\[data-product-type="laneway_company"\] \.laneway-recommendation/,
  /\[data-product-type="laneway_company"\] \.laneway-result-discoveries/,
  /\[data-product-type="laneway_company"\] \.laneway-wheel-spin-spiral/,
  /@media\(prefers-reduced-motion:reduce\)/
])assert.match(css,pattern);
for(const event of ["wheel_spin_completed","artist_selected","surprise_me_clicked","artist_roster_selected","recommendation_shown","recommendation_selected","quiz_recommendation_selected","session_summary"])assert.ok(worker.includes(`"${event}"`));
assert.ok(worker.includes('"laneway_profile"'));
assert.doesNotMatch(JSON.stringify(config),/aggits/i);
assert.equal(JSON.parse(await fs.readFile("editions/celibate-rifles/edition.json","utf8")).lanewayChallenge.numberOfQuestions,5);

console.log(`Laneway Music one-off tests passed: endless catalogue discovery, rich cards, deterministic recommendations, reporting events and ${roster.artists.length} verified artists.`);
