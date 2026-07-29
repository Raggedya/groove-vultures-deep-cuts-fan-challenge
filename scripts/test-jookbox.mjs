import assert from "node:assert/strict";
import fs from "node:fs/promises";

const platform = JSON.parse(await fs.readFile("platform.json", "utf8"));
const entry = platform.editions.find((item) => item.slug === "filthy-animals");
assert.ok(entry?.active, "Filthy Animals JookBox must remain active.");
assert.equal(entry.editionId, "dc_a3c049e4bc");
assert.equal(entry.canonicalPath, "/e/dc_a3c049e4bc");

const config = JSON.parse(await fs.readFile(entry.config, "utf8"));
assert.equal(config.brandName, "JookBox");
assert.equal(config.editionType, "jukebox");
assert.equal(config.jookBox?.modelVersion, "jookbox/1");
assert.deepEqual(config.jookBox?.heroLabels, ["Listen", "Watch", "Follow", "Shop"]);
assert.equal(config.jookBox?.lightSequence, true);
assert.equal(config.characterArtwork, "", "JookBox must never render Aggits.");
assert.equal(config.businessChallenge, undefined, "JookBox must not inherit a Business quiz.");
assert.equal(config.lanewayCompanyChallenge, undefined, "JookBox must not inherit an Indie Label quiz.");
assert.equal(config.indieWheel, undefined, "JookBox must not inherit a spinning wheel.");

assert.equal(config.featuredVideo?.selectionBasis, "most-viewed-official");
assert.equal(config.featuredVideo?.youtubeURL, "https://www.youtube.com/watch?v=Yarspws7fDA");
assert.match(config.links?.spotify || "", /^https:\/\/open\.spotify\.com\/artist\//);
assert.match(config.links?.youtube || "", /^https:\/\/www\.youtube\.com\/channel\//);
assert.match(config.links?.merchandise || "", /^https:\/\/filthyanimals\.com\.au\/shop\//);

const research = JSON.parse(await fs.readFile("editions/filthy-animals/research.json", "utf8"));
for (const [destination, url] of Object.entries(config.links)) {
  assert.ok(research.sources.some((source) => source.destination === destination && source.url.replace(/\/$/, "") === url.replace(/\/$/, "") && source.identityVerified === true), `${destination} requires matching verified research.`);
}
assert.ok(research.sources.some((source) => source.destination === "featuredVideo" && source.url === config.featuredVideo.youtubeURL && /380K views/.test(source.evidence)), "The featured video must retain official Popular-order evidence.");

const [html, app, styles] = await Promise.all([
  fs.readFile("index.html", "utf8"),
  fs.readFile("js/app.js", "utf8"),
  fs.readFile("styles.css", "utf8"),
]);
assert.match(html, /id="jookBoxCabinet"/);
assert.match(html, /id="jookBoxVideoSlot"/);
assert.match(app, /function isJookBoxEdition\(\)/);
assert.match(app, /const JOOKBOX_LINK_DEFINITIONS=/);
assert.match(app, /function sequenceJookBoxButtons\(\)/);
assert.match(styles, /\[data-edition-type="jukebox"\] \.jookbox-machine/);
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*\[data-edition-type="jukebox"\]/);

console.log("JookBox model passed: Filthy Animals remains a no-quiz, no-wheel, no-Aggits band edition.");
