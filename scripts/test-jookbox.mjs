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
assert.equal(config.jookBox?.modelVersion, "jookbox/2");
assert.deepEqual(config.jookBox?.heroLabels, ["Listen", "Watch", "Follow", "Shop"]);
assert.equal(config.jookBox?.lightSequence, true);
assert.equal(config.jookBox?.coinStart, true);
assert.equal(config.jookBox?.syncMode, "verified-build-time");
assert.equal(config.characterArtwork, "", "JookBox must never render Aggits.");
assert.equal(config.businessChallenge, undefined, "JookBox must not inherit a Business quiz.");
assert.equal(config.lanewayCompanyChallenge, undefined, "JookBox must not inherit an Indie Label quiz.");
assert.equal(config.indieWheel, undefined, "JookBox must not inherit a spinning wheel.");

assert.equal(config.featuredVideo?.selectionBasis, "most-viewed-official");
assert.equal(config.featuredVideo?.youtubeURL, "https://www.youtube.com/watch?v=Yarspws7fDA");
assert.equal(config.jookBox?.selections?.length, 18, "Every current visible Linktree button must render as one JookBox selection.");
assert.equal(new Set(config.jookBox.selections.map((selection) => selection.id)).size, config.jookBox.selections.length);
assert.equal(config.jookBox.selections.some((selection) => selection.id === "merch-shop"), true);
assert.equal(config.jookBox.selections.some((selection) => selection.id === "youtube-channel"), true);
assert.equal(config.jookBox.selections.some((selection) => selection.id === "tickets-moorabbin"), true);
assert.equal(config.jookBox.selections.some((selection) => selection.id === "furzey-podcast"), true);
assert.equal(config.jookBox?.biography?.paragraphs?.length, 3);

const research = JSON.parse(await fs.readFile("editions/filthy-animals/research.json", "utf8"));
for (const [destination, url] of Object.entries(config.links)) {
  assert.ok(research.sources.some((source) => source.destination === destination && source.url.replace(/\/$/, "") === url.replace(/\/$/, "") && source.identityVerified === true), `${destination} requires matching verified research.`);
}
for (const selection of config.jookBox.selections) {
  assert.ok(research.sources.some((source) => source.destination === `selection:${selection.id}` && source.url.replace(/\/$/, "") === selection.url.replace(/\/$/, "") && source.identityVerified === true), `${selection.id} requires matching verified Linktree research.`);
}
assert.ok(research.sources.some((source) => source.destination === "featuredVideo" && source.url === config.featuredVideo.youtubeURL && /380K views/.test(source.evidence)), "The featured video must retain official Popular-order evidence.");

const [html, app, styles] = await Promise.all([
  fs.readFile("index.html", "utf8"),
  fs.readFile("js/app.js", "utf8"),
  fs.readFile("styles.css", "utf8"),
]);
assert.match(html, /id="jookBoxCabinet"/);
assert.match(html, /id="jookBoxVideoSlot"/);
assert.match(html, /id="jookBoxSelectionSlot"/);
assert.match(html, /id="jookBoxCoinButton"/);
assert.match(html, /class="jookbox-band-plaque"/);
assert.match(html, /id="jookBoxPlaqueName"/);
assert.match(html, /id="jookBoxBioScreen"/);
assert.match(app, /function isJookBoxEdition\(\)/);
assert.match(app, /function jookBoxLinkDefinitions\(\)/);
assert.match(app, /jookBoxSelectionSlot\.append\(els\.links\)/);
assert.match(app, /function powerJookBox\(\)/);
assert.match(app, /function playJookBoxCoinSound\(\)/);
assert.match(app, /autoplay=1&playsinline=1/);
assert.match(app, /function sequenceJookBoxButtons\(\)/);
assert.match(styles, /\[data-edition-type="jukebox"\] \.jookbox-machine/);
assert.match(styles, /\[data-edition-type="jukebox"\] \.hero\{display:none\}/);
assert.match(styles, /\.jookbox-selection-bay/);
assert.match(styles, /\.jookbox-selection-slot \.platform-links\{grid-template-columns:repeat\(2/);
assert.match(styles, /@keyframes jookBoxCoinDrop/);
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*\[data-edition-type="jukebox"\]/);

console.log("JookBox model passed: verified Linktree keys, coin-start video, lights and sourced biography remain isolated from every other edition.");
