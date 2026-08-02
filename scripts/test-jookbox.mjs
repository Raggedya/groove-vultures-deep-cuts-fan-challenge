import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";

const platform = JSON.parse(await fs.readFile("platform.json", "utf8"));
const entry = platform.editions.find((item) => item.slug === "filthy-animals");
assert.ok(entry?.active, "Filthy Animals JookBox must remain active.");
assert.equal(entry.editionId, "dc_a3c049e4bc");
assert.equal(entry.canonicalPath, "/e/dc_a3c049e4bc");

const config = JSON.parse(await fs.readFile(entry.config, "utf8"));
const atlasEntry = platform.editions.find((item) => item.editionId === "dc_e22f1cb651");
assert.ok(atlasEntry?.active, "ATLAS JookBox must remain active.");
const atlasConfig = JSON.parse(await fs.readFile(atlasEntry.config, "utf8"));
const scotsEntry = platform.editions.find((item) => item.slug === "southern-culture-on-the-skids");
assert.ok(scotsEntry?.active, "Southern Culture on the Skids JookBox must remain active.");
const scotsConfig = JSON.parse(await fs.readFile(scotsEntry.config, "utf8"));
assert.equal(config.brandName, "JookBox");
assert.equal(config.editionType, "jukebox");
assert.equal(config.jookBox?.modelVersion, "jookbox/3");
assert.equal(config.jookBox?.layoutVersion, "coin-awakening/1");
assert.equal(config.jookBox?.cabinetArtwork, "assets/jookbox-filthy-animals-locked-v1.jpg");
assert.equal(config.jookBox?.coinSound, "assets/audio/jukebox-real-coin-insert-cc0.mp3");
assert.equal(config.jookBox?.coinSoundSha256, "0d5af258fc72136626d4888c3b6a75240afe8d7b6c00d5837576b92c4ebadec0");
assert.equal(config.jookBox?.coinSoundSource, "https://freesound.org/people/kyles/sounds/637369/");
assert.equal(config.jookBox?.coinSoundLicense, "CC0-1.0");
assert.equal(config.jookBox?.sessionStorageKey, "filthyAnimalsJukeboxActivated");
assert.equal(config.jookBox?.tickerDurationSeconds, 36);
assert.equal(config.jookBox?.buttonLightDurationMs, 650);
assert.equal(config.jookBox?.buttonRowDurationMs, undefined);
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
assert.equal(config.jookBox?.lightSequenceMode, "single-key");
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
assert.ok(coinSound.byteLength > 20000, "The sourced 2.502-second local coin mechanism recording must not be an empty placeholder.");
assert.equal(
  crypto.createHash("sha256").update(coinSound).digest("hex"),
  config.jookBox.coinSoundSha256,
  "The licensed real coin-slot recording must retain its verified identity.",
);
const coinSoundLicense = await fs.readFile("assets/audio/jukebox-real-coin-insert-cc0.LICENSE.txt", "utf8");
assert.match(coinSoundLicense, /coin in jukebox slot \+fall1\.flac/);
assert.match(coinSoundLicense, /Creative Commons CC0 1\.0/);
assert.match(coinSoundLicense, /https:\/\/freesound\.org\/people\/kyles\/sounds\/637369\//);

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

const [html, app, styles, creator, validator, contractsText, studioModel] = await Promise.all([
  fs.readFile("index.html", "utf8"),
  fs.readFile("js/app.js", "utf8"),
  fs.readFile("styles.css", "utf8"),
  fs.readFile("scripts/create-edition.mjs", "utf8"),
  fs.readFile("scripts/validate-platform.mjs", "utf8"),
  fs.readFile("edition-contracts.json", "utf8"),
  fs.readFile("scripts/studio-model.mjs", "utf8"),
]);
const contracts = JSON.parse(contractsText);
assert.equal(contracts.productModels.jookbox.version, 3);
assert.deepEqual(contracts.editionTypes.jukebox.renderedLinks, []);
assert.match(html, /id="jookBoxCabinet"/);
assert.match(html, /styles\.css\?v=20260802-bar-mobile-8/);
assert.match(html, /app\.js\?v=20260802-bar-mobile-8/);
assert.match(html, /id="jookBoxVideoSlot"/);
assert.match(html, /id="jookBoxCoinButton"[\s\S]*aria-label="Insert coin and start the jukebox"/);
assert.match(html, /id="jookBoxTickerText"/);
assert.match(html, /id="jookBoxBottomShare"/);
assert.match(html, /id="jookBoxCabinetCopyright"/);
assert.match(html, /id="jookBoxLearnMore" class="jookbox-learn-more jookbox-brass-dial"/);
assert.match(html, /id="jookBoxSecondaryActions"/);
assert.match(html, /id="jookBoxStatePlaque"/);
assert.match(html, /class="jookbox-ticker-console"[\s\S]*id="jookBoxTicker"[\s\S]*id="jookBoxVideoSlot"[\s\S]*class="jookbox-control-console"[\s\S]*id="jookBoxCoinButton"/);
assert.doesNotMatch(html, /Filthy Animals/, "The reusable HTML renderer must never hard-code one band.");
assert.doesNotMatch(html, /id="jookBoxSoundToggle"|class="jookbox-band-plaque"|id="jookBoxActionBar"/);

assert.match(app, /function setJookBoxState\(nextState\)/);
assert.match(app, /const VERSION="20260802-bar-mobile-8"/);
assert.match(app, /dataset\.jookboxEmbeddedMarquee=embeddedMarquee\?"true":"false"/);
assert.match(app, /dataset\.jookboxAppearance=config\.jookBox\?\.appearanceVariant\|\|"reference"/);
assert.match(app, /dataset\.jookboxLightSequence=config\.jookBox\?\.lightSequenceMode\|\|"single-key"/);
assert.match(app, /dataset\.jookboxKeyFormat=config\.jookBox\?\.keyBankFormat\|\|"classic-eight-key\/1"/);
assert.match(app, /dataset\.jookboxLongMarquee=String\(\(config\.jookBox\?\.marquee\|\|name\)\.length>18\)/);
assert.match(app, /marquee\?\.classList\.toggle\("visually-hidden",embeddedMarquee\)/);
assert.match(app, /function scheduleJookBoxMarqueeTitleFit\(\)/);
assert.match(app, /document\.fonts\?\.ready/);
assert.match(app, /new ResizeObserver\(scheduleJookBoxMarqueeTitleFit\)/);
assert.match(app, /title\.dataset\.fitMode="single-line"/);
assert.match(app, /title\.dataset\.fitMode="multi-line"/);
assert.match(app, /const minimumMultiLine=Math\.min\(maximumSize,7\)/);
assert.match(app, /window\.removeEventListener\("resize",scheduleJookBoxMarqueeTitleFit\)/);
assert.match(app, /availableKeyCount===1\?"key is":"keys are"/);
assert.match(app, /\["sleeping","acceptingCoin","poweringUp","awake"\]/);
assert.match(app, /function restoreJookBoxSessionState\(\)/);
assert.match(app, /sessionStorage\.getItem\(jookBoxSessionKey\(\)\)/);
assert.match(app, /sessionStorage\.setItem\(jookBoxSessionKey\(\),"true"\)/);
assert.match(app, /function clearJookBoxStartupTimers\(\)/);
assert.match(app, /function clearJookBoxKeyLightTimer\(reset=false\)/);
assert.match(app, /function jookBoxKeyLightGroupSize\(\)\{[\s\S]*lightSequenceMode==="row-pair"\?2:1/);
assert.match(app, /function advanceJookBoxKeyLight\(\)/);
assert.match(app, /function startJookBoxKeyLightSequence\(\)/);
assert.match(app, /function cleanupJookBoxLifecycle\(\)/);
assert.doesNotMatch(app, /jookBoxAutoplayTimer|scheduleJookBoxAutoplay|clearJookBoxAutoplayTimer/);
assert.match(app, /function prepareJookBoxCoinAudio\(\)/);
assert.match(app, /new Audio\(source\.startsWith/);
assert.doesNotMatch(app, /function playJookBoxCoinFallback\(\)|window\.AudioContext|webkitAudioContext/, "A failed recording must remain silent instead of producing an electronic synthesized fallback.");
assert.match(app, /function handleJookBoxVisibility\(\)/);
assert.match(app, /window\.addEventListener\("pagehide",cleanupJookBoxLifecycle/);
assert.match(app, /window\.addEventListener\("pageshow",handleJookBoxPageShow/);
assert.match(app, /if\(!event\.persisted\)return;[\s\S]*startJookBoxKeyLightSequence\(\)/);
assert.match(app, /is-animation-paused/);
assert.match(app, /startupTimingsMs/);
assert.match(app, /displaySelectionIds/);
assert.match(app, /function jookBoxUsesSixKeyFormat\(\)/);
assert.match(app, /function jookBoxUtilityFallbackKinds\(destinationCount,hasBiography\)/);
assert.match(app, /function createJookBoxUtilityKey\(kind,index\)/);
const fallbackFunctionSource = app.match(/function jookBoxUtilityFallbackKinds\(destinationCount,hasBiography\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(fallbackFunctionSource, "The six-key utility fallback function must be present.");
const utilityFallbackKinds = Function(`return (${fallbackFunctionSource})`)();
assert.deepEqual(utilityFallbackKinds(6, true), []);
assert.deepEqual(utilityFallbackKinds(5, true), ["learn_more"]);
assert.deepEqual(utilityFallbackKinds(4, true), ["learn_more", "share"]);
assert.match(app, /utilityKinds\.has\("learn_more"\)/);
assert.match(app, /utilityKinds\.has\("learn_more"\)\|\|atlasReferenceCabinet/);
assert.match(app, /utilityKinds\.has\("share"\)/);
assert.match(app, /supportAction==="share"/);
assert.match(app, /dataset\.jookboxAction="share"/);
assert.match(app, /jookBoxPrimaryAction\.onclick=activateShare/);
assert.match(app, /jookBoxCabinetCopyright\.textContent=cabinetCopyright/);
assert.match(app, /querySelectorAll\("\[data-jookbox-utility\]"\)/);
assert.match(app, /link\.dataset\.keyIndex=String\(index\)/);
assert.match(app, /const groupCount=Math\.ceil\(keys\.length\/groupSize\)/);
assert.match(app, /classList\.toggle\("is-current-key",index>=groupStart&&index<groupStart\+groupSize\)/);
assert.match(app, /jookBoxKeyLightTimer=window\.setTimeout\(advanceJookBoxKeyLight,jookBoxKeyLightDuration\(\)\)/);
assert.doesNotMatch(app, /--jookbox-row-delay|--jookbox-row-cycle/);
assert.match(app, /autoplay=\$\{autoplay\?1:0\}/);
assert.match(app, /function powerJookBox\(\)\{[\s\S]*?playJookBoxCoinSound\(\);[\s\S]*?else activateJookBoxVideo\(true\);[\s\S]*?const reducedMotion/);
assert.match(app, /www\.youtube-nocookie\.com\/embed/);
assert.match(app, /function trackJookBoxOutbound\(definition,url,source="jookbox_linktree"\)/);

assert.match(styles, /\[data-jookbox-layout="coin-awakening\/1"\] \.jookbox-machine\{[\s\S]*aspect-ratio:762\/1280/);
assert.match(styles, /data-jookbox-embedded-marquee="false"[\s\S]*\.jookbox-marquee h1\{[\s\S]*text-transform:uppercase/);
assert.match(styles, /data-jookbox-appearance="atlas-reference-cabinet\/1"[\s\S]*\.jookbox-machine\{[\s\S]*aspect-ratio:887\/1774/);
assert.match(styles, /data-jookbox-long-marquee="true"[\s\S]*\.jookbox-marquee h1\{[\s\S]*font-size:clamp\(\.58rem,2\.65vw,2rem\)/);
assert.match(styles, /data-jookbox-appearance="atlas-reference-cabinet\/1"[\s\S]*\.jookbox-marquee h1\{[\s\S]*text-overflow:clip/);
assert.match(styles, /h1\[data-fit-mode="multi-line"\]\{[\s\S]*overflow-wrap:anywhere;[\s\S]*text-wrap:balance;[\s\S]*white-space:normal/);
assert.match(styles, /data-jookbox-appearance="atlas-reference-cabinet\/1"[\s\S]*\.jookbox-ticker-console\{[\s\S]*top:17\.35%/);
assert.match(styles, /data-jookbox-appearance="atlas-reference-cabinet\/1"[\s\S]*\.jookbox-screen-frame\{[\s\S]*left:27\.3%/);
assert.match(styles, /data-jookbox-appearance="atlas-reference-cabinet\/1"[\s\S]*\.jookbox-secondary-actions\{[\s\S]*grid-template-columns:repeat\(3/);
assert.match(styles, /ATLAS_SIX_KEY_VISUAL_CONTRACT_START/);
assert.match(styles, /ATLAS_SIX_KEY_VISUAL_CONTRACT_END/);
const atlasVisualStart = styles.indexOf("/* ATLAS_SIX_KEY_VISUAL_CONTRACT_START */");
const atlasVisualEnd = styles.indexOf("/* ATLAS_SIX_KEY_VISUAL_CONTRACT_END */");
assert.ok(atlasVisualStart >= 0 && atlasVisualEnd > atlasVisualStart, "The ATLAS key visual contract markers must remain intact.");
const atlasVisualContract = styles
  .slice(atlasVisualStart + "/* ATLAS_SIX_KEY_VISUAL_CONTRACT_START */".length, atlasVisualEnd)
  .trim()
  .replace(/\r\n/g, "\n");
assert.equal(
  crypto.createHash("sha256").update(atlasVisualContract).digest("hex"),
  "640c66368e94a588b7639af8e4ca29cb921ee5a45963a20ef062df4c918f631d",
  "The owner-approved ATLAS key shape, typography, spacing, colours, borders, dimensions and glow must remain unchanged.",
);
assert.match(styles, /\[data-jookbox-key-format="six-key\/1"\] \.jookbox-utility-key\{[\s\S]*appearance:none;[\s\S]*font:inherit/);
assert.match(styles, /data-jookbox-appearance="atlas-reference-cabinet\/1"[\s\S]*\.jookbox-primary-action\{[\s\S]*top:79\.55%/);
assert.match(styles, /data-jookbox-appearance="atlas-reference-cabinet\/1"[\s\S]*\.jookbox-primary-detail-icon\{[\s\S]*border-radius:50%/);
assert.match(styles, /\.jookbox-primary-action\.is-share-action strong\{[\s\S]*grid-row:1/);
assert.match(styles, /\.jookbox-primary-action\.is-share-action small\{[\s\S]*grid-row:2/);
assert.match(styles, /data-jookbox-appearance="atlas-reference-cabinet\/1"[\s\S]*\.jookbox-cabinet-copyright\{[\s\S]*top:91\.1%/);
assert.match(styles, /@keyframes atlasReferenceKeyPulse/);
assert.match(styles, /@keyframes atlasReferenceCoinInsert/);
assert.match(styles, /\.jookbox-coin-button\{[\s\S]*min-height:44px/);
assert.match(styles, /@keyframes jookBoxLockedCoinAttention/);
assert.match(styles, /@keyframes jookBoxLockedCoinInsert/);
assert.match(styles, /@keyframes jookBoxLockedNeonFlicker/);
assert.match(styles, /@keyframes jookBoxLockedScreenOn/);
assert.doesNotMatch(styles, /@keyframes jookBoxLockedRowLight/);
assert.match(styles, /@keyframes jookBoxLockedTickerRTL/);
assert.match(styles, /--jb-led:#ffd45f/);
assert.match(styles, /\.jookbox-ticker-console\{[\s\S]*top:17\.25%;[\s\S]*width:67\.8%;[\s\S]*height:10\.55%/);
assert.match(styles, /\.jookbox-control-console\{[\s\S]*top:51\.02%;[\s\S]*width:67\.8%;[\s\S]*height:6\.7%/);
assert.match(styles, /\.jookbox-coin-bank\{[\s\S]*top:6%;[\s\S]*left:38%;[\s\S]*width:24%;[\s\S]*height:88%/);
assert.match(styles, /font-size:clamp\(\.68rem,3vw,1\.32rem\)/);
assert.match(styles, /text-shadow:0 0 3px #fff7c2,0 0 8px #ffbd37,0 0 15px rgba\(255,198,76,1\)/);
assert.match(styles, /from\{transform:translate\(min\(100vw,762px\),-50%\)\}[\s\S]*to\{transform:translate\(-100%,-50%\)\}/);
assert.match(styles, /\.jookbox-secondary-actions\{[\s\S]*grid-template-rows:repeat\(4/);
assert.match(styles, /\.jookbox-lower-deck\{[\s\S]*left:30\.5%;[\s\S]*width:39%/);
assert.match(styles, /\.jookbox-action-panel:before\{[\s\S]*background:rgba\(7,4,3,\.88\)/);
assert.match(styles, /\.is-buttons-running \.jookbox-action-key\.is-current-key\{[\s\S]*filter:brightness\(1\.42\) saturate\(1\.34\)/);
assert.match(styles, /\.jookbox-action-key\[aria-disabled="true"\]\{[\s\S]*opacity:\.68;[\s\S]*pointer-events:none;[\s\S]*filter:brightness\(\.3\) saturate\(\.24\)/);
assert.match(styles, /\.is-awake \.jookbox-action-key:hover/);
assert.match(styles, /\.is-awake \.jookbox-action-key:focus-visible/);
assert.match(styles, /\.is-awake \.jookbox-action-key:active/);
assert.match(styles, /\.is-animation-paused \.jookbox-ticker-text/);
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*data-jookbox-layout="coin-awakening\/1"/);
assert.match(styles, /env\(safe-area-inset-bottom\)/);

assert.match(creator, /modelVersion:'jookbox\/3'/);
assert.match(creator, /layoutVersion:'coin-awakening\/1'/);
assert.match(creator, /const appearanceVariant='atlas-reference-cabinet\/1'/);
assert.match(creator, /const keyBankFormat='six-key\/1'/);
assert.match(creator, /requestedAppearanceVariant&&requestedAppearanceVariant!==appearanceVariant/);
assert.match(creator, /requestedKeyBankFormat&&requestedKeyBankFormat!==keyBankFormat/);
assert.match(creator, /requestedCabinetArtwork&&requestedCabinetArtwork!=='assets\/jookbox-atlas-reference-v1\.webp'/);
assert.match(creator, /const minimumDisplayIds=4/);
assert.match(creator, /const maximumDisplayIds=6/);
assert.match(creator, /keyBankFormat,/);
assert.match(creator, /displaySelectionIds:requestedDisplayIds/);
assert.match(creator, /cabinetArtwork:'assets\/jookbox-atlas-reference-v1\.webp'/);
assert.match(creator, /cabinetArtworkSha256:'ee1f3b869c2b8e9b7ac747e33d62de20a7904b3ed6fcacf7e87bbfeec61bdfb3'/);
assert.match(creator, /supportAction:\{action:'share',label:'Support Our Band',detail:'Please share our JookBox'/);
assert.match(creator, /cabinetCopyright:'Copyright Clearlight Creative 2026\.'/);
assert.match(creator, /assets\/audio\/jukebox-real-coin-insert-cc0\.mp3/);
assert.match(creator, /coinSoundLicense:clean\(input\.jookBox\?\.coinSoundLicense\|\|'CC0-1\.0'/);
assert.match(creator, /tickerDurationSeconds:Math\.max\(12,Math\.min\(60,Number\(input\.jookBox\?\.tickerDurationSeconds\)\|\|36\)\)/);
assert.match(creator, /buttonLightDurationMs:Math\.max\(450,Math\.min\(1200,Number\(input\.jookBox\?\.buttonLightDurationMs\)\|\|Number\(input\.jookBox\?\.buttonRowDurationMs\)\|\|1100\)\)/);
assert.match(creator, /lightSequenceMode:'single-key'/);
assert.match(creator, /autoplayDelayMs:0/);
assert.match(validator, /locked JookBox cabinet artwork failed its SHA-256 identity check/);
assert.match(validator, /JookBox coin recording failed its SHA-256 identity check/);
assert.match(validator, /request JookBox video playback immediately within the direct coin interaction/);
assert.match(validator, /const atlasReferenceCabinet=appearanceVariant==='atlas-reference-cabinet\/1'/);
assert.match(validator, /valid JookBox light duration/);
assert.match(validator, /six-key format requires four to six unique display selection IDs/);
assert.match(validator, /keyBankFormat!=='six-key\/1'/);
assert.match(validator, /const LEGACY_JOOKBOX_EDITION_ID='dc_a3c049e4bc'/);
assert.match(validator, /!legacyJookBox&&\(!atlasReferenceCabinet\|\|!sixKeyFormat\)/);
assert.match(validator, /only the immutable Filthy Animals edition may use the legacy cabinet/);
assert.equal(contracts.productModels.jookbox.referenceEditionId, "dc_e22f1cb651");
assert.equal(contracts.productModels.jookbox.legacyReferenceEditionId, "dc_a3c049e4bc");
assert.equal(contracts.productModels.jookbox.defaultAppearanceVariant, "atlas-reference-cabinet/1");
assert.equal(contracts.productModels.jookbox.defaultKeyBankFormat, "six-key/1");
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("atlas-reference-cabinet-permanent-new-edition-default"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("atlas-reference-only-for-all-non-legacy-jookboxes"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("automatic-responsive-marquee-title-fit-without-truncation"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("immediate-coin-interaction-autoplay-request-with-manual-fallback"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("pre-coin-dimmed-locked-selection-keys"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("single-key-sequential-illumination"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("six-key-fixed-uniform-bank"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("six-key-learn-more-then-share-gap-fill"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("six-key-single-key-reading-order-illumination"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("hero-biography-ticker-above-video"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("centered-post-video-coin-control"));
assert.ok(contracts.productModels.jookbox.lockedCapabilities.includes("origin-aware-secure-external-tabs"));
assert.match(studioModel, /id="studioJookBoxTitle"/);
assert.match(studioModel, /data-fit-mode="multi-line"/);
assert.match(studioModel, /new ResizeObserver\(schedule\)\.observe\(frame\)/);

assert.equal(atlasConfig.jookBox?.appearanceVariant, "atlas-reference-cabinet/1");
assert.equal(atlasConfig.jookBox?.keyBankFormat, "six-key/1");
assert.equal(atlasConfig.jookBox?.lightSequenceMode, "single-key");
assert.equal(atlasConfig.jookBox?.buttonLightDurationMs, 1100);
assert.equal(atlasConfig.jookBox?.displaySelectionIds?.length, 5);
assert.deepEqual(
  [...atlasConfig.jookBox.displaySelectionIds, "learn_more"],
  ["spotify", "bandcamp", "youtube-channel", "instagram", "dusk-til-dawn-ep", "learn_more"],
  "ATLAS must retain its five verified destinations in order, with Learn More filling the sixth physical key.",
);
assert.equal(atlasConfig.jookBox?.cabinetArtwork, "assets/jookbox-atlas-reference-v1.webp");
assert.deepEqual(atlasConfig.jookBox?.supportAction, {
  action: "share",
  label: "Support Our Band",
  detail: "Please share our JookBox",
  kind: "share",
  icon: "\u2661",
  detailIcon: "\u2197",
});
assert.equal(atlasConfig.jookBox?.cabinetCopyright, "Copyright Clearlight Creative 2026.");
assert.doesNotMatch(JSON.stringify(atlasConfig.jookBox), /Love our music\?/i);
assert.equal(atlasConfig.links?.website, "");
assert.equal(atlasConfig.links?.merchandise, "");
const atlasCabinet = await fs.readFile(atlasConfig.jookBox.cabinetArtwork);
assert.equal(
  crypto.createHash("sha256").update(atlasCabinet).digest("hex"),
  atlasConfig.jookBox.cabinetArtworkSha256,
  "The owner-approved ATLAS reference cabinet must remain byte-for-byte locked.",
);
assert.equal(config.jookBox?.lightSequenceMode, "single-key", "The Filthy Animals reference must keep its single-key sequence.");
assert.equal(config.jookBox?.buttonLightDurationMs, 650, "The Filthy Animals reference timing must remain unchanged.");

assert.equal(scotsEntry.editionId, "dc_f3f4750b1b");
assert.equal(scotsEntry.canonicalPath, "/e/dc_f3f4750b1b");
assert.equal(scotsConfig.editionType, "jukebox");
assert.equal(scotsConfig.brandName, "JookBox");
assert.equal(scotsConfig.characterArtwork, "", "Southern Culture on the Skids must use the no-Aggits JookBox model.");
assert.equal(scotsConfig.jookBox?.modelVersion, "jookbox/3");
assert.equal(scotsConfig.jookBox?.appearanceVariant, "atlas-reference-cabinet/1");
assert.equal(scotsConfig.jookBox?.keyBankFormat, "six-key/1");
assert.equal(scotsConfig.jookBox?.lightSequenceMode, "single-key");
assert.equal(scotsConfig.jookBox?.buttonLightDurationMs, 1100);
assert.equal(scotsConfig.jookBox?.cabinetArtwork, "assets/jookbox-atlas-reference-v1.webp");
assert.equal(scotsConfig.jookBox?.cabinetArtworkSha256, atlasConfig.jookBox?.cabinetArtworkSha256);
assert.deepEqual(scotsConfig.jookBox?.supportAction, atlasConfig.jookBox?.supportAction);
assert.equal(scotsConfig.jookBox?.cabinetCopyright, "Copyright Clearlight Creative 2026.");
assert.equal(scotsConfig.jookBox?.linkSourceURL, "https://www.scots.com/");
assert.equal(scotsConfig.featuredVideo?.youtubeURL, "https://www.youtube.com/watch?v=GNl0u3Bbs04");
assert.equal(scotsConfig.featuredVideo?.selectionBasis, "most-viewed-official");
assert.deepEqual(scotsConfig.jookBox?.displaySelectionIds, [
  "spotify",
  "bandcamp",
  "youtube-channel",
  "instagram",
  "merchandise",
  "website",
]);
assert.equal(scotsConfig.jookBox?.selections?.length, 8);
assert.equal(scotsConfig.jookBox?.biography?.paragraphs?.length, 3);
const scotsResearch = JSON.parse(await fs.readFile("editions/southern-culture-on-the-skids/research.json", "utf8"));
assert.ok(
  scotsResearch.sources.some(
    (source) =>
      source.destination === "featuredVideo" &&
      source.url === scotsConfig.featuredVideo.youtubeURL &&
      /82K views/.test(source.evidence) &&
      /rights-blocked Camel Walk/.test(source.evidence),
  ),
  "Southern Culture on the Skids must retain verified official replacement-video evidence after rejecting the blocked Camel Walk embed.",
);
for (const selection of scotsConfig.jookBox.selections) {
  assert.ok(
    scotsResearch.sources.some(
      (source) =>
        source.destination === `selection:${selection.id}` &&
        source.url.replace(/\/$/, "") === selection.url.replace(/\/$/, "") &&
        source.identityVerified === true,
    ),
    `${selection.id} requires matching Southern Culture on the Skids source evidence.`,
  );
}

for (const other of platform.editions.filter((item) => item.editionId !== entry.editionId)) {
  const otherConfig = JSON.parse(await fs.readFile(other.config, "utf8"));
  assert.notEqual(otherConfig.jookBox?.cabinetArtwork, config.jookBox.cabinetArtwork, `${other.slug} must not inherit the Filthy Animals locked artwork.`);
  assert.notEqual(otherConfig.jookBox?.sessionStorageKey, config.jookBox.sessionStorageKey, `${other.slug} must not share the Filthy Animals session key.`);
}

console.log("JookBox v3 passed: Filthy Animals is unchanged, while the byte-locked ATLAS six-key cabinet is the permanent future default and Southern Culture uses it with independently verified content.");
