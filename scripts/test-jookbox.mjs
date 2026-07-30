import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";

const platform = JSON.parse(await fs.readFile("platform.json", "utf8"));
const entry = platform.editions.find((item) => item.slug === "filthy-animals");
assert.ok(entry?.active, "Filthy Animals JookBox must remain active.");
assert.equal(entry.editionId, "dc_a3c049e4bc");
assert.equal(entry.canonicalPath, "/e/dc_a3c049e4bc");

const config = JSON.parse(await fs.readFile(entry.config, "utf8"));
assert.equal(config.brandName, "JookBox");
assert.equal(config.editionType, "jukebox");
assert.equal(config.jookBox?.modelVersion, "jookbox/3");
assert.equal(config.jookBox?.layoutVersion, "coin-awakening/1");
assert.equal(config.jookBox?.cabinetArtwork, "assets/jookbox-filthy-animals-locked-v1.jpg");
assert.equal(config.jookBox?.coinSound, "assets/audio/jukebox-real-coin-insert-cc0.mp3");
assert.equal(config.jookBox?.coinSoundSha256, "3fd636fe3763b95a09bc8f6be470361ddf0a49e7772464d1a5292fa7c7674e8a");
assert.equal(config.jookBox?.coinSoundSource, "https://freesound.org/s/696745/");
assert.equal(config.jookBox?.coinSoundLicense, "CC0-1.0");
assert.equal(config.jookBox?.sessionStorageKey, "filthyAnimalsJukeboxActivated");
assert.equal(config.jookBox?.tickerDurationSeconds, 28);
assert.equal(config.jookBox?.buttonRowDurationMs, 800);
assert.equal(config.jookBox?.autoplayDelayMs, 0);
assert.deepEqual(config.jookBox?.startupTimingsMs, {
  mechanism: 120,
  neonOn: 800,
  screenOn: 1200,
  buttonsOn: 1600,
  tickerOn: 2000,
});
assert.match(config.jookBox?.tickerBio || "", /THE FILTHY ANIMALS/);
assert.deepEqual(config.jookBox?.heroLabels, ["Listen", "Watch", "Follow", "Shop"]);
assert.equal(config.jookBox?.lightSequence, true);
assert.equal(config.jookBox?.coinStart, true);
assert.equal(config.jookBox?.syncMode, "verified-build-time");
assert.equal(config.characterArtwork, "", "JookBox must never render Aggits.");
assert.equal(config.businessChallenge, undefined, "JookBox must not inherit a Business quiz.");
assert.equal(config.lanewayCompanyChallenge, undefined, "JookBox must not inherit an Indie Label quiz.");
assert.equal(config.indieWheel, undefined, "JookBox must not inherit a spinning wheel.");

const cabinet = await fs.readFile(config.jookBox.cabinetArtwork);
assert.equal(
  crypto.createHash("sha256").update(cabinet).digest("hex"),
  config.jookBox.cabinetArtworkSha256,
  "The owner-approved 762 × 1280 cabinet reference must remain byte-for-byte locked.",
);

const coinSound = await fs.readFile(config.jookBox.coinSound);
assert.ok(coinSound[0] === 0xff && (coinSound[1] & 0xe0) === 0xe0, "The local coin recording must be a valid MPEG audio stream.");
assert.ok(coinSound.byteLength > 40000, "The local coin mechanism sound must not be an empty placeholder.");
assert.equal(
  crypto.createHash("sha256").update(coinSound).digest("hex"),
  config.jookBox.coinSoundSha256,
  "The licensed real coin-slot recording must retain its verified identity.",
);
const coinSoundLicense = await fs.readFile("assets/audio/jukebox-real-coin-insert-cc0.LICENSE.txt", "utf8");
assert.match(coinSoundLicense, /vending_machine_coin_insert\.wav/);
assert.match(coinSoundLicense, /Creative Commons CC0 1\.0/);
assert.match(coinSoundLicense, /https:\/\/freesound\.org\/s\/696745\//);

assert.equal(config.featuredVideo?.selectionBasis, "most-viewed-official");
assert.equal(config.featuredVideo?.youtubeURL, "https://www.youtube.com/watch?v=Yarspws7fDA");
assert.equal(config.jookBox?.selections?.length, 18, "The dated Linktree research snapshot must remain complete.");
assert.equal(new Set(config.jookBox.selections.map((selection) => selection.id)).size, config.jookBox.selections.length);
assert.equal(config.jookBox?.biography?.paragraphs?.length, 3);
assert.deepEqual(config.jookBox.displaySelectionIds, [
  "tickets-moorabbin",
  "newsletter",
  "youtube-channel",
  "tickets-rozelle",
  "tickets-southport",
  "airlie-beach",
  "tickets-ipswich",
  "tickets-bundaberg",
]);
for (const id of config.jookBox.displaySelectionIds) {
  assert.ok(config.jookBox.selections.some((selection) => selection.id === id), `${id} must resolve to a verified Linktree snapshot entry.`);
}

const research = JSON.parse(await fs.readFile("editions/filthy-animals/research.json", "utf8"));
for (const [destination, url] of Object.entries(config.links)) {
  assert.ok(research.sources.some((source) => source.destination === destination && source.url.replace(/\/$/, "") === url.replace(/\/$/, "") && source.identityVerified === true), `${destination} requires matching verified research.`);
}
for (const selection of config.jookBox.selections) {
  assert.ok(research.sources.some((source) => source.destination === `selection:${selection.id}` && source.url.replace(/\/$/, "") === selection.url.replace(/\/$/, "") && source.identityVerified === true), `${selection.id} requires matching verified Linktree research.`);
}
assert.ok(research.sources.some((source) => source.destination === "featuredVideo" && source.url === config.featuredVideo.youtubeURL && /380K views/.test(source.evidence)), "The featured video must retain official Popular-order evidence.");

const [html, app, styles, creator, validator, contractsText] = await Promise.all([
  fs.readFile("index.html", "utf8"),
  fs.readFile("js/app.js", "utf8"),
  fs.readFile("styles.css", "utf8"),
  fs.readFile("scripts/create-edition.mjs", "utf8"),
  fs.readFile("scripts/validate-platform.mjs", "utf8"),
  fs.readFile("edition-contracts.json", "utf8"),
]);
const contracts = JSON.parse(contractsText);
assert.equal(contracts.productModels.jookbox.version, 3);
assert.deepEqual(contracts.editionTypes.jukebox.renderedLinks, []);
assert.match(html, /id="jookBoxCabinet"/);
assert.match(html, /id="jookBoxVideoSlot"/);
assert.match(html, /id="jookBoxCoinButton"[\s\S]*aria-label="Insert coin and start the jukebox"/);
assert.match(html, /id="jookBoxTickerText"/);
assert.match(html, /id="jookBoxBottomShare"/);
assert.match(html, /id="jookBoxLearnMore" class="jookbox-learn-more jookbox-brass-dial"/);
assert.match(html, /id="jookBoxSecondaryActions"/);
assert.match(html, /id="jookBoxStatePlaque"/);
assert.doesNotMatch(html, /Filthy Animals/, "The reusable HTML renderer must never hard-code one band.");
assert.doesNotMatch(html, /id="jookBoxSoundToggle"|class="jookbox-band-plaque"|id="jookBoxActionBar"/);

assert.match(app, /function setJookBoxState\(nextState\)/);
assert.match(app, /\["sleeping","acceptingCoin","poweringUp","awake"\]/);
assert.match(app, /function restoreJookBoxSessionState\(\)/);
assert.match(app, /sessionStorage\.getItem\(jookBoxSessionKey\(\)\)/);
assert.match(app, /sessionStorage\.setItem\(jookBoxSessionKey\(\),"true"\)/);
assert.match(app, /function clearJookBoxStartupTimers\(\)/);
assert.doesNotMatch(app, /jookBoxAutoplayTimer|scheduleJookBoxAutoplay|clearJookBoxAutoplayTimer/);
assert.match(app, /function prepareJookBoxCoinAudio\(\)/);
assert.match(app, /new Audio\(source\.startsWith/);
assert.match(app, /function playJookBoxCoinFallback\(\)/);
assert.match(app, /function handleJookBoxVisibility\(\)/);
assert.match(app, /window\.addEventListener\("pagehide",clearJookBoxStartupTimers/);
assert.match(app, /window\.addEventListener\("pageshow",handleJookBoxPageShow/);
assert.match(app, /event\.persisted&&jookBoxState!=="awake"/);
assert.match(app, /is-animation-paused/);
assert.match(app, /startupTimingsMs/);
assert.match(app, /displaySelectionIds/);
assert.match(app, /--jookbox-row-delay/);
assert.match(app, /autoplay=\$\{autoplay\?1:0\}/);
assert.match(app, /function powerJookBox\(\)\{[\s\S]*?playJookBoxCoinSound\(\);\s*activateJookBoxVideo\(true\);[\s\S]*?const reducedMotion/);
assert.match(app, /www\.youtube-nocookie\.com\/embed/);
assert.match(app, /function trackJookBoxOutbound\(definition,url,source="jookbox_linktree"\)/);

assert.match(styles, /\[data-jookbox-layout="coin-awakening\/1"\] \.jookbox-machine\{[\s\S]*aspect-ratio:762\/1280/);
assert.match(styles, /\.jookbox-coin-button\{[\s\S]*min-height:44px/);
assert.match(styles, /@keyframes jookBoxLockedCoinAttention/);
assert.match(styles, /@keyframes jookBoxLockedCoinInsert/);
assert.match(styles, /@keyframes jookBoxLockedNeonFlicker/);
assert.match(styles, /@keyframes jookBoxLockedScreenOn/);
assert.match(styles, /@keyframes jookBoxLockedRowLight/);
assert.match(styles, /@keyframes jookBoxLockedTickerRTL/);
assert.match(styles, /--jb-led:#ffd45f/);
assert.match(styles, /font-size:clamp\(\.4rem,1\.68vw,\.78rem\)/);
assert.match(styles, /from\{transform:translate\(min\(100vw,762px\),-50%\)\}[\s\S]*to\{transform:translate\(-100%,-50%\)\}/);
assert.match(styles, /\.jookbox-secondary-actions\{[\s\S]*grid-template-rows:repeat\(4/);
assert.match(styles, /\.jookbox-action-key\[aria-disabled="true"\]\{[\s\S]*opacity:\.68;[\s\S]*pointer-events:none;[\s\S]*filter:brightness\(\.3\) saturate\(\.24\)/);
assert.match(styles, /\.is-awake \.jookbox-action-key:hover/);
assert.match(styles, /\.is-awake \.jookbox-action-key:focus-visible/);
assert.match(styles, /\.is-awake \.jookbox-action-key:active/);
assert.match(styles, /\.is-animation-paused \.jookbox-ticker-text/);
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*data-jookbox-layout="coin-awakening\/1"/);
assert.match(styles, /env\(safe-area-inset-bottom\)/);

assert.match(creator, /modelVersion:'jookbox\/3'/);
assert.match(creator, /layoutVersion:'coin-awakening\/1'/);
assert.match(creator, /displaySelectionIds:requestedDisplayIds/);
assert.match(creator, /assets\/audio\/jukebox-real-coin-insert-cc0\.mp3/);
assert.match(creator, /coinSoundLicense:clean\(input\.jookBox\?\.coinSoundLicense\|\|'CC0-1\.0'/);
assert.match(creator, /autoplayDelayMs:0/);
assert.match(validator, /locked JookBox cabinet artwork failed its SHA-256 identity check/);
assert.match(validator, /JookBox coin recording failed its SHA-256 identity check/);
assert.match(validator, /request JookBox video playback immediately within the direct coin interaction/);
assert.match(validator, /one to eight unique display selection IDs/);
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("immediate-coin-interaction-autoplay-request-with-manual-fallback"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("pre-coin-dimmed-locked-selection-keys"));

for (const other of platform.editions.filter((item) => item.editionId !== entry.editionId)) {
  const otherConfig = JSON.parse(await fs.readFile(other.config, "utf8"));
  assert.notEqual(otherConfig.jookBox?.cabinetArtwork, config.jookBox.cabinetArtwork, `${other.slug} must not inherit the Filthy Animals locked artwork.`);
  assert.notEqual(otherConfig.jookBox?.sessionStorageKey, config.jookBox.sessionStorageKey, `${other.slug} must not share the Filthy Animals session key.`);
}

console.log("JookBox v3 passed: the owner-locked cabinet, real coin-slot recording, immediate coin-interaction YouTube playback request, pre-coin dimmed selection keys, brighter right-to-left ticker and four-row light sequence are isolated to Filthy Animals.");
