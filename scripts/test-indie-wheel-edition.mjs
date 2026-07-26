import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const config=JSON.parse(await fs.readFile('editions/cool-death-records/edition.json','utf8'));
const roster=JSON.parse(await fs.readFile(config.indieWheel.rosterFile,'utf8'));
const questions=JSON.parse(await fs.readFile(config.indieWheelChallenge.questionFile,'utf8'));
const contracts=JSON.parse(await fs.readFile('edition-contracts.json','utf8'));
const app=await fs.readFile('js/app.js','utf8');
const css=await fs.readFile('styles.css','utf8');
const html=await fs.readFile('index.html','utf8');
const socialGenerator=await fs.readFile('scripts/generate-social-assets.py','utf8');

assert.equal(config.editionType,'indie_wheel');
assert.equal(config.brandName,'Indie Wheel');
assert.deepEqual(contracts.editionTypes.indie_wheel.exclusiveConfig,['indieWheel','indieWheelChallenge']);
assert.equal(config.indieWheel.destinationKey,'bandcampURL');
assert.equal(config.indieWheel.destinationLabel,'Bandcamp');
assert.equal(config.indieWheel.tagline,'The Only Rule Is Cool');
assert.equal(config.indieWheel.artistWheel.enabled,true);
assert.equal(config.indieWheel.artistWheel.replacesFeaturedVideo,true);
assert.equal(roster.artists.length,19);
assert.equal(roster.pendingArtistCount,0);
assert.equal(questions.length,10);
assert.ok(roster.artists.every(artist=>/^https:\/\/[^/]+\.bandcamp\.com\/$/.test(artist.bandcampURL)));
assert.ok(roster.artists.every(artist=>artist.sourceURL==='https://cooldeathrecords.bandcamp.com/artists'));
assert.match(app,/function isIndieWheelEdition/);
assert.match(app,/validWheelDestination/);
assert.match(css,/\[data-product-type="indie_wheel"\] \.laneway-wheel-winner/);
assert.match(css,/\[data-product-type="indie_wheel"\] \.laneway-company-artist-link\.attention/);
assert.ok(html.includes('id="indieWheelCollectionLabel"'));
assert.match(socialGenerator,/def indie_wheel_logo\(config: dict\)/);
assert.match(socialGenerator,/config\.get\("indieWheel", \{\}\)\.get\("logoArtwork", ""\)/);
assert.match(socialGenerator,/config\.get\("editionType"\) == "indie_wheel"/);
await fs.access(config.indieWheel.logoArtwork);

console.log('Cool Death Records Indie Wheel tests passed: official identity, 19 verified Bandcamp artists, random wheel and 10-question catalogue quiz.');
