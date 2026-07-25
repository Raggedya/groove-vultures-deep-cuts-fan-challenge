import assert from "node:assert/strict";
import fs from "node:fs/promises";

const config=JSON.parse(await fs.readFile("editions/laneway-music-one-off/edition.json","utf8"));
const roster=JSON.parse(await fs.readFile(config.lanewayCompany.rosterFile,"utf8"));
const questions=JSON.parse(await fs.readFile(config.lanewayCompanyChallenge.questionFile,"utf8"));
const contracts=JSON.parse(await fs.readFile("edition-contracts.json","utf8"));
const html=await fs.readFile("index.html","utf8");
const app=await fs.readFile("js/app.js","utf8");
const quiz=await fs.readFile("js/laneway-company-quiz.js","utf8");
const css=await fs.readFile("styles.css","utf8");

assert.equal(config.editionType,"laneway_company");
assert.equal(config.bandName,"Laneway Music");
assert.equal(config.characterArtwork,"");
assert.deepEqual(contracts.editionTypes.laneway_company.exclusiveConfig,["lanewayCompany","lanewayCompanyChallenge"]);
assert.equal(config.lanewayCompany.logoArtwork,"assets/laneway-music-logo-reverse-transparent.png");
assert.equal(config.featuredVideo.youtubeURL,"https://www.youtube.com/watch?v=GkZPRgnTOvg");
assert.equal(config.lanewayCompanyChallenge.numberOfQuestions,8);
assert.equal(questions.length,8);
assert.equal(roster.pendingArtistCount,0);
assert.ok(roster.artists.length>0);
assert.equal(new Set(roster.artists.map(artist=>artist.name.toLowerCase())).size,roster.artists.length);
assert.equal(new Set(roster.artists.map(artist=>artist.spotifyURL)).size,roster.artists.length);
for(const artist of roster.artists){
  assert.match(artist.sourceURL,/^https:\/\/www\.lanewaymusic\.com\.au\//);
  assert.match(artist.spotifyURL,/^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]+$/);
  if(artist.websiteURL)assert.match(artist.websiteURL,/^https:\/\//);
}
for(const id of ["lanewayCompanyDirectory","lanewayCompanySearch","lanewayCompanyArtistList","lanewayCompanyQuizScreen","lanewayCompanyResultScreen"])assert.ok(html.includes(`id="${id}"`));
assert.ok(html.indexOf('id="featuredVideo"')<html.indexOf('id="platformLinks"'));
assert.ok(html.indexOf('id="platformLinks"')<html.indexOf('id="lanewayCompanyDirectory"'));
assert.match(app,/isLanewayCompanyEdition/);
assert.match(app,/buildLanewayCompanyDirectory/);
assert.match(app,/validSpotifyArtist/);
assert.match(app,/LanewayCompanyQuiz\.configure/);
assert.match(quiz,/value\.length!==8/);
assert.match(quiz,/prepareQuestions\(questionBank,8\)/);
assert.match(css,/\[data-edition-type="laneway_company"\] \.artist-title-row/);
assert.match(css,/\[data-edition-type="laneway_company"\] \.laneway-company-artist-list/);
assert.doesNotMatch(JSON.stringify(config),/aggits/i);
assert.equal(JSON.parse(await fs.readFile("editions/celibate-rifles/edition.json","utf8")).lanewayChallenge.numberOfQuestions,5);

console.log(`Laneway Music one-off tests passed: logo-only heading, featured video, isolated eight-question quiz and ${roster.artists.length} verified Spotify artists.`);
