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
assert.equal(config.jookBox?.cabinetArtwork, "assets/jookbox-cabinet-photoreal-v1.webp");
await fs.access(config.jookBox.cabinetArtwork);
assert.deepEqual(config.jookBox?.heroLabels, ["Listen", "Watch", "Follow", "Shop"]);
assert.equal(config.jookBox?.lightSequence, true);
assert.equal(config.jookBox?.coinStart, true);
assert.equal(config.jookBox?.syncMode, "verified-build-time");
assert.equal(config.jookBox?.primaryActionLabel, "View Upcoming Shows");
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
const showSelections = config.jookBox.selections.filter((selection) => selection.kind === "show");
assert.equal(showSelections.length, 8, "Verified ticket destinations must be separated into the Upcoming Shows module.");
for (const show of showSelections) {
  assert.ok(show.dateLabel && show.venue && show.location, `${show.id} requires verified display metadata.`);
}
assert.equal(config.jookBox.selections.filter((selection) => selection.kind === "deep_cut").length, 2);

const research = JSON.parse(await fs.readFile("editions/filthy-animals/research.json", "utf8"));
for (const [destination, url] of Object.entries(config.links)) {
  assert.ok(research.sources.some((source) => source.destination === destination && source.url.replace(/\/$/, "") === url.replace(/\/$/, "") && source.identityVerified === true), `${destination} requires matching verified research.`);
}
for (const selection of config.jookBox.selections) {
  assert.ok(research.sources.some((source) => source.destination === `selection:${selection.id}` && source.url.replace(/\/$/, "") === selection.url.replace(/\/$/, "") && source.identityVerified === true), `${selection.id} requires matching verified Linktree research.`);
}
assert.ok(research.sources.some((source) => source.destination === "featuredVideo" && source.url === config.featuredVideo.youtubeURL && /380K views/.test(source.evidence)), "The featured video must retain official Popular-order evidence.");

const [html, app, styles, creator, validator] = await Promise.all([
  fs.readFile("index.html", "utf8"),
  fs.readFile("js/app.js", "utf8"),
  fs.readFile("styles.css", "utf8"),
  fs.readFile("scripts/create-edition.mjs", "utf8"),
  fs.readFile("scripts/validate-platform.mjs", "utf8"),
]);
assert.match(html, /id="jookBoxCabinet"/);
assert.match(html, /id="jookBoxVideoSlot"/);
assert.match(html, /id="jookBoxCoinButton"/);
assert.match(html, /id="jookBoxSoundToggle"[\s\S]*aria-pressed="false"/);
assert.match(html, /class="jookbox-band-plaque"/);
assert.match(html, /id="jookBoxPlaqueName"/);
assert.match(html, /id="jookBoxTrackTitle"/);
assert.match(html, /id="jookBoxPrimaryAction"/);
assert.match(html, /id="jookBoxSecondaryActions"/);
assert.match(html, /id="jookBoxShows"/);
assert.match(html, /id="jookBoxShowsToggle"[\s\S]*aria-expanded="false"[\s\S]*aria-controls="jookBoxAllShows"/);
assert.match(html, /id="jookBoxActionBar"/);
assert.match(html, /id="jookBoxBottomDeepCut"/);
assert.match(html, /id="jookBoxBottomShows"/);
assert.match(html, /id="jookBoxBottomShare"/);
assert.match(html, /id="jookBoxBioScreen"/);
assert.ok(html.indexOf('id="jookBoxCoinButton"') < html.indexOf('id="jookBoxVideoSlot"'), "Coin and coin-slot hardware must appear above the video.");
const trackMetadataStart = html.indexOf('class="jookbox-track-metadata"');
const trackMetadataEnd = html.indexOf("</section>", trackMetadataStart);
const shareControlIndex = html.indexOf('id="jookBoxBottomShare"');
assert.ok(shareControlIndex > trackMetadataStart && shareControlIndex < trackMetadataEnd, "Share must be mounted beside the video metadata.");
const actionBarStart = html.indexOf('id="jookBoxActionBar"');
const actionBarEnd = html.indexOf("</nav>", actionBarStart);
assert.equal(html.slice(actionBarStart, actionBarEnd).includes('id="jookBoxBottomShare"'), false, "Share must not remain in the fixed action bar.");
assert.doesNotMatch(html, /Filthy Animals/, "The reusable renderer must never hard-code one band.");
assert.match(app, /function isJookBoxEdition\(\)/);
assert.match(app, /function jookBoxLinkDefinitions\(\)/);
assert.match(app, /function jookBoxDestinationDefinitions\(\)/);
assert.match(app, /function buildJookBoxProductNavigation\(\)/);
assert.match(app, /function configureJookBoxPrimaryAction\(shows,destinations\)/);
assert.match(app, /function buildJookBoxShows\(shows\)/);
assert.match(app, /function createJookBoxShowRow\(definition,featured\)/);
assert.match(app, /function createJookBoxDestinationLink\(definition,className,source\)/);
assert.match(app, /function openRandomJookBoxDeepCut\(\)/);
assert.match(app, /function unlockJookBoxDestinations\(\)/);
assert.match(app, /element\.hidden=!safeURL;[\s\S]*if\(!safeURL\)return;/, "Unavailable destinations must be omitted.");
assert.match(app, /els\.jookBoxShows\.hidden=!shows\.length;[\s\S]*if\(!shows\.length\)return;/, "An empty show module must be omitted.");
assert.match(app, /if\(!choices\.length\)return;/, "Deep Cut must disappear gracefully when no verified candidates exist.");
assert.match(app, /scrollIntoView\(\{block:"start",behavior:/);
assert.match(app, /setAttribute\("aria-expanded",String\(expanded\)\)/);
assert.match(app, /function powerJookBox\(\)/);
assert.match(app, /function playJookBoxCoinSound\(\)/);
assert.match(app, /function toggleJookBoxSound\(\)/);
assert.match(app, /if\(jookBoxSoundMuted\)return;/);
assert.match(app, /Share the \$\{config\.bandName\} JookBox/);
assert.match(app, /autoplay=1&playsinline=1/);
assert.match(app, /function trackJookBoxOutbound\(definition,url,source="jookbox_linktree"\)/);
assert.doesNotMatch(app, /JOOKBOX_VISIBLE_SELECTIONS|startJookBoxSelectionRotation|showJookBoxSelectionGroup/, "The cramped rotating key bank must not return.");
assert.match(styles, /\[data-edition-type="jukebox"\] \.jookbox-machine/);
assert.match(styles, /\[data-edition-type="jukebox"\] \.hero\{display:none\}/);
assert.match(styles, /\.jookbox-video-slot\{[\s\S]*aspect-ratio:16\/9/);
assert.match(styles, /\.jookbox-secondary-actions\{[\s\S]*grid-template-columns:repeat\(2/);
assert.match(styles, /\.jookbox-primary-action\{[\s\S]*min-height:64px/);
assert.match(styles, /\.jookbox-transport-control\{[\s\S]*min-height:56px/);
assert.match(styles, /\.jookbox-ticket-link\{[\s\S]*min-height:52px/);
assert.match(styles, /\.jookbox-action-bar\{[\s\S]*position:fixed/);
assert.match(styles, /\.jookbox-coin-slot\{[\s\S]*display:block/);
assert.match(styles, /\.jookbox-metadata-share\{/);
assert.match(styles, /font-size:clamp\(\.62rem,2\.8vw,\.82rem\)/, "The JookBox model label must remain subordinate to the band name.");
assert.match(styles, /font-size:clamp\(1\.55rem,7\.8vw,2\.55rem\)/, "The dynamic band name must be the marquee focal point.");
assert.match(styles, /repeating-linear-gradient\(97deg,transparent 0 17px/, "The cabinet must retain its subtle static wear texture.");
assert.match(styles, /env\(safe-area-inset-bottom\)/);
assert.match(styles, /\.jookbox-action-key:active[\s\S]*translateY\(2px\)/);
assert.match(styles, /@keyframes jookBoxPremiumCoinDrop/);
assert.match(styles, /@media\(max-width:359px\)/);
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*\[data-edition-type="jukebox"\]/);
assert.match(creator, /primaryActionLabel:clean\(input\.jookBox\?\.primaryActionLabel\|\|'View Upcoming Shows'/);
assert.match(creator, /\['dateLabel',40\],\['venue',100\],\['location',100\],\['availability',40\]/);
assert.match(creator, /if\(item\.kind==='show'&&\(!item\.dateLabel\|\|!item\.venue\)\)/);
assert.match(validator, /selection\.kind==='show'&&\(!selection\.dateLabel\|\|!selection\.venue\)/);

console.log("JookBox model passed: weathered vintage cabinet, top-mounted coin hardware, metadata-mounted Share, premium video hierarchy, tactile destinations and sourced biography remain isolated from every other edition.");
