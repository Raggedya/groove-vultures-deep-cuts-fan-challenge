import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import {attachMp4,createProject,renderStudioPreview} from "./studio-model.mjs";

const [contracts,html,app,styles,studioHtml,studioApp,server,validator,forge,venueHtml,venueServer,publisher,artwork,artworkVerifier,heritageArtwork]=await Promise.all([
  fs.readFile("edition-contracts.json","utf8").then(JSON.parse),
  fs.readFile("index.html","utf8"),
  fs.readFile("js/app.js","utf8"),
  fs.readFile("styles.css","utf8"),
  fs.readFile("studio/index.html","utf8"),
  fs.readFile("studio/app.js","utf8"),
  fs.readFile("scripts/studio-server.mjs","utf8"),
  fs.readFile("scripts/validate-platform.mjs","utf8"),
  fs.readFile("forge.config.cjs","utf8"),
  fs.readFile("studio/venue-library.html","utf8"),
  fs.readFile("scripts/venue-library-server.mjs","utf8"),
  fs.readFile("scripts/bar-edition-publication.mjs","utf8"),
  fs.readFile("scripts/generate-social-assets.py","utf8"),
  fs.readFile("scripts/verify-delivery-assets.py","utf8"),
  fs.readFile("assets/jookbox-bar-heritage-brass-v1.png")
]);

assert.equal(crypto.createHash("sha256").update(heritageArtwork).digest("hex"),"d2556a41bb1b0d56d96e78d9a6ff538f780637e32ba473c153d5b61184f1eb92","The owner-approved Bar heritage cabinet must remain immutable.");

assert.equal(contracts.productModels.bar_jukebox.version,1);
assert.equal(contracts.productModels.bar_jukebox.defaultAppearanceVariant,"atlas-reference-cabinet/1");
assert.equal(contracts.productModels.bar_jukebox.defaultKeyBankFormat,"bar-six-key/1");
assert.deepEqual(contracts.editionTypes.bar_jukebox.exclusiveConfig,["barJookBox"]);
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("five-administrator-labelled-https-actions"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("administrator-supplied-about-copy"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("permanent-sixth-about-us-key"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("working-dynamic-venue-share-panel"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("single-long-share-control"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("no-scannable-localhost-preview-qr"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("coin-recording-completes-before-local-mp4-focus-with-controls-fallback"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("six-stage-single-key-contained-incandescent-illumination"));

assert.match(html,/id="barJookBoxWelcomeVideo"/);
assert.match(html,/id="barJookBoxIntro"/);
assert.match(html,/id="barJookBoxMarqueeArtwork"/);
assert.match(html,/id="barJookBoxTitlePath"/);
assert.match(html,/id="barJookBoxTitlePath" d="M 48 148 Q 360 43 672 148"/,"The venue title must use the protected full-width inner arc and remain clear of the cabinet crown.");
assert.match(html,/id="barJookBoxMarqueeText"/);
assert.equal((html.match(/class="bar-jookbox-share-hand /g)||[]).length,2,"The physical Share plaque requires two mirrored SVG pointing hands.");
assert.equal((html.match(/class="bar-jookbox-share-hand-ink"/g)||[]).length,2,"Both Share plaque hands require the approved inward-pointing outline.");
assert.equal((html.match(/class="bar-jookbox-share-hand-detail"/g)||[]).length,2,"Both Share plaque hands require visible vintage cuff and finger detail.");
assert.match(app,/function isBarJookBoxEdition\(\)/);
assert.match(app,/Array\.isArray\(source\.actions\)\?source\.actions:\[\]\)\.slice\(0,5\)/);
assert.match(app,/keyBankFormat:"bar-six-key\/1"/);
assert.match(app,/lightSequenceMode:"single-key"/);
assert.match(app,/buttonLightDurationMs:1100/);
assert.match(app,/function fitBarJookBoxMarqueeTitle\(\)/);
assert.match(app,/getComputedTextLength/);
assert.match(app,/const targetWidth=610/);
assert.match(app,/const maximumSize=82/);
assert.match(app,/title\.dataset\.fittedWidth/);
assert.match(app,/function barJookBoxActionIcon\(definition\)/);
assert.match(app,/bar-jookbox-key-icon-\$\{type\}/);
assert.match(app,/setBarJookBoxShareLabel/);
assert.match(app,/controls\.push\(createJookBoxUtilityKey\("learn_more",controls\.length\)\)/);
assert.match(app,/barAbout\?"About Us":"Learn More"/);
assert.match(app,/barAbout\?"Venue information":"Band biography"/);
assert.match(app,/interaction_source:isBarJookBoxEdition\(\)\?"jookbox_about_us":"jookbox_learn_more"/);
assert.match(app,/label:"SHARE"/);
assert.match(app,/function barJookBoxVideoAsset\(value\)/);
assert.match(app,/\/api\\\/bar-assets\\\/dc_\[a-f0-9\]\{10\}\\\/video/);
assert.match(app,/sleepingStateLabel:"INSERT COIN"/);
assert.match(app,/activateBarJookBoxWelcomeVideo\(\{autoplay:true\}\)/);
assert.match(app,/barJookBoxWelcomeVideo\.play\(\)/);
assert.match(app,/localWelcomeVideo/);
assert.match(app,/webLookupAllowed/);
assert.match(styles,/\[data-product-type="bar_jukebox"\] \.bar-jookbox-welcome-video/);
assert.match(styles,/\[data-product-type="bar_jukebox"\]\[data-jookbox-key-format="bar-six-key\/1"\]/);
assert.match(styles,/\[data-product-type="bar_jukebox"\][\s\S]*\.jookbox-primary-action\{[\s\S]*display:grid!important/);
assert.doesNotMatch(styles,/\[data-product-type="bar_jukebox"\] \.jookbox-primary-action\{display:none!important\}/);
assert.match(styles,/BAR_HERITAGE_CRAFT_FINISH_START/);
assert.match(styles,/BAR_HERITAGE_CRAFT_FINISH_END/);
assert.match(styles,/html\[data-product-type="bar_jukebox"\][^\n]* \.jookbox-marquee\{\s*top:6\.15%;[\s\S]*?height:12\.7%/);
assert.match(styles,/\.bar-jookbox-curved-title\{/);
assert.match(styles,/\.bar-jookbox-key-icon g\{[\s\S]*?stroke:currentColor/);
assert.match(styles,/barHeritageIncandescentCycle/);
assert.match(styles,/\.bar-jookbox-share-hand-right\{[\s\S]*?scaleX\(-1\)/);
assert.match(styles,/BAR_HERITAGE_PRECISION_AUTHORITY_V2_START/);
assert.match(styles,/BAR_SINGLE_KEY_CONTAINED_LIGHT_AUTHORITY_V1_START/);
assert.match(styles,/\.jookbox-action-key:before\{[\s\S]*?inset:6\.5% 5\.5% 8%!important;[\s\S]*?box-shadow:[\s\S]*?inset 0 0 16px/s);
assert.match(styles,/\.is-buttons-running \.jookbox-action-key\.is-current-key\{[\s\S]*?box-shadow:none!important/s);
assert.match(styles,/\.is-buttons-running \.jookbox-action-key\.is-current-key:before\{[\s\S]*?barContainedKeyLamp 1100ms/s);
assert.match(styles,/BAR_VIDEO_APERTURE_AUTHORITY_V1_START/);
assert.match(styles,/\.bar-jookbox-welcome-video\{[\s\S]*?object-fit:cover!important;[\s\S]*?object-position:50% 50%!important/s);
assert.match(styles,/data-jookbox-embedded-marquee="false"\] \.jookbox-marquee\{[\s\S]*?left:6%!important;[\s\S]*?width:88%!important/);
assert.match(styles,/grid-template-columns:minmax\(0,1fr\)!important/);
assert.match(styles,/\.bar-jookbox-share-hand\{[\s\S]*?width:18\.5%!important/);
assert.match(styles,/\.bar-jookbox-share-hand-left\{[\s\S]*?translateY\(-50%\)!important/);
assert.match(styles,/\.bar-jookbox-share-hand-right\{[\s\S]*?translateY\(-50%\) scaleX\(-1\)!important/);
assert.doesNotMatch(styles,/\.jookbox-primary-action\.is-share-action strong\{[\s\S]{0,220}?color:#ff9eab/);
assert.match(styles,/\[data-product-type="bar_jukebox"\][^\n]* \.jookbox-playing-status\{\s*display:none/);
assert.match(styles,/\[data-product-type="bar_jukebox"\] \.is-awake \.jookbox-coin-button\{[\s\S]*?animation:none!important;[\s\S]*?text-shadow:none/);
assert.match(styles,/\[data-product-type="bar_jukebox"\] \.is-awake \.jookbox-coin\{[\s\S]*?animation:none!important;[\s\S]*?opacity:0;[\s\S]*?box-shadow:none/);
assert.match(styles,/ATLAS_SIX_KEY_VISUAL_CONTRACT_START/);
assert.match(styles,/ATLAS_SIX_KEY_VISUAL_CONTRACT_END/);
const visualStart=styles.indexOf("/* ATLAS_SIX_KEY_VISUAL_CONTRACT_START */");
const visualEnd=styles.indexOf("/* ATLAS_SIX_KEY_VISUAL_CONTRACT_END */");
const visualContract=styles
  .slice(visualStart+"/* ATLAS_SIX_KEY_VISUAL_CONTRACT_START */".length,visualEnd)
  .trim()
  .replace(/\r\n/g,"\n");
assert.equal(
  crypto.createHash("sha256").update(visualContract).digest("hex"),
  "640c66368e94a588b7639af8e4ca29cb921ee5a45963a20ef062df4c918f631d",
  "Bar Edition must not change the owner-approved ATLAS key visual contract."
);

assert.match(studioHtml,/id="source-label-5"/);
assert.match(studioHtml,/id="source-url-5"/);
assert.match(studioHtml,/id="bar-ticker"/);
assert.match(studioHtml,/id="bar-about"/);
assert.match(studioHtml,/id="mp4-file"/);
assert.match(studioApp,/Build the local MP4 JookBox with five links, About Us and the Share bar/);
assert.match(studioApp,/type\?\.id==="bar_jukebox"/);
assert.match(studioApp,/renderPublicationPendingPoster\(\)/);
assert.match(studioApp,/PUBLIC QR CREATED/);
assert.match(studioApp,/AFTER PUBLISHING/);
assert.match(studioApp,/els\.qr\.hidden=publicationType/);
assert.match(studioApp,/els\.downloadQr\.hidden=publicationType/);
assert.doesNotMatch(studioApp,/This QR opens the private preview on this computer/);
assert.match(server,/MAX_MP4_BYTES=500\*1024\*1024/);
assert.match(server,/serveMediaFile\(request,response/);
assert.match(server,/verificationRequired:project\.input\.type==="bar_jukebox"\?false/);
assert.match(validator,/exactly five administrator-supplied actions; About Us is the permanent sixth key and the long support panel is the sole Share control/);
assert.match(validator,/requires administrator-approved About Us copy/);
assert.match(validator,/config\.editionType!=='bar_jukebox'/);
assert.match(forge,/jukebox-real-coin-insert-cc0\.mp3/);
assert.match(forge,/jookbox-atlas-reference-v1\.webp/);
assert.match(forge,/jookbox-bar-heritage-brass-v1\.png/);
assert.match(styles,/BAR_HERITAGE_BRASS_VISUAL_CONTRACT_START/);
assert.match(styles,/jookbox-bar-heritage-brass-v1\.png/);
assert.match(styles,/\.jookbox-ticker-text\{[^}]*font-size:clamp\(\.82rem,3\.55vw,1\.9rem\)[^}]*white-space:nowrap/s);
assert.match(styles,/\.jookbox-cabinet-copyright\{[^}]*background:linear-gradient\(145deg,#c69d58/s);
assert.match(venueHtml,/id="venue-published-toggle"/);assert.match(venueHtml,/role="switch"/);assert.match(venueHtml,/id="restore-venue"/);assert.doesNotMatch(venueHtml,/Secure Publish Venue|Activate Publishing|Connect GitHub/);
assert.match(venueServer,/createVenuePublicationJob/);assert.match(venueServer,/publicationPublisher\.publish/);assert.match(venueServer,/publicationPublisher\.setPublished/);assert.match(venueServer,/archiveLegacyVenueLibrary/);
assert.match(publisher,/BAR_PUBLIC_VIDEO_MAX_BYTES=24\*1024\*1024/);assert.match(publisher,/createDirectVenuePublisher/);assert.match(publisher,/createVenueQrArtwork/);assert.match(publisher,/verifyPublicEdition/);assert.doesNotMatch(publisher,/GitHubVenuePublisher/);
assert.match(validator,/protected 24 MiB Cloudflare publication limit/);
assert.match(artwork,/create_bar_jookbox_qr/);assert.match(artwork,/jookbox-venue-qr-master-v1\.png/);assert.match(artworkVerifier,/bar_jukebox/);

const base=createProject({
  name:"Shotkickers",
  type:"bar_jukebox",
  sourceUrls:[
    "https://venue.example/gigs",
    "https://venue.example/menu",
    "https://venue.example/contact",
    "https://venue.example/instagram",
    "https://venue.example/facebook"
  ],
  sourceLabels:["Gigs","Menu","Contact Us","Instagram","Facebook"],
  tickerText:"SHOTKICKERS — LIVE MUSIC, GIGS, DRINKS AND GOOD TIMES.",
  aboutText:"Shotkickers venue information supplied and approved by the administrator."
});
assert.equal(base.input.sourceUrls.length,5);
assert.equal(base.input.sourceLabels.length,5);
assert.equal(base.input.aboutText,"Shotkickers venue information supplied and approved by the administrator.");
assert.equal(base.readiness.handoffReady,false);
const duplicateShare=attachMp4(createProject({...base.input,sourceLabels:["Gigs","Menu","Contact Us","Instagram","Share"]}),{fileName:"welcome.mp4",sizeBytes:2048,sha256:"e".repeat(64)});
assert.equal(duplicateShare.readiness.handoffReady,false,"The long support panel must remain the sole Bar Edition Share action.");
assert.match(duplicateShare.readiness.blockers.join(" "),/replace the external button labelled Share/);
const complete=attachMp4(base,{fileName:"welcome.mp4",sizeBytes:2048,sha256:"f".repeat(64)});
assert.equal(complete.readiness.handoffReady,true);
const preview=renderStudioPreview(complete,{videoUrl:"/api/studio/projects/studio_preview/video"});
assert.equal((preview.match(/class="key(?:\s|")/g)||[]).length,6,"Bar Edition preview must always render five administrator keys plus About Us.");
assert.match(preview,/id="aboutKey"/);
assert.match(preview,/id="aboutScreen"/);
assert.match(preview,/id="aboutBack"/);
assert.doesNotMatch(preview,/id="shareKey"/);
assert.match(preview,/id="sharePanel"/);
assert.match(preview,/main\{width:100%;max-width:430px/);
assert.match(preview,/\.about-screen\{width:100%;/);
assert.match(preview,/Shotkickers venue information supplied and approved by the administrator/);
assert.match(preview,/class="coin-label">INSERT COIN</);
assert.doesNotMatch(preview,/Drag coin up to play/);
assert.match(preview,/\.machine\.is-awake \.coin\{animation:none!important;opacity:0;filter:none;box-shadow:none\}/);
assert.match(preview,/machine\.classList\.remove\("is-powering","is-accepting"\)/);
assert.match(preview,/jookbox-bar-heritage-brass-v1\.png/);
assert.match(preview,/id="studioBarTitlePath"/);
assert.match(preview,/id="studioBarTitlePath" d="M48 148Q360 43 672 148"/);
assert.match(preview,/id="barTitle" href="#studioBarTitlePath"/);
assert.match(preview,/\.title\{[^}]*top:6\.15%;[^}]*left:6%;[^}]*width:88%;[^}]*height:12\.7%/);
assert.match(preview,/\.ticker span\{[^}]*white-space:nowrap/);
assert.doesNotMatch(preview,/\.title small:after\{[^}]*content:"BAR EDITION"/);
assert.match(preview,/<span class="share-word">SHARE<\/span>/);
assert.equal((preview.match(/class="share-hand /g)||[]).length,2);
assert.equal((preview.match(/class="share-hand-ink"/g)||[]).length,2);
assert.equal((preview.match(/class="share-hand-detail"/g)||[]).length,2);
assert.match(preview,/const target=610/);
assert.match(preview,/grid-template-columns:minmax\(0,1fr\)/);
assert.match(preview,/\.share-hand-right\{right:2\.5%;transform:translateY\(-50%\) scaleX\(-1\)\}/);
assert.doesNotMatch(preview,/Math\.floor\(index\/2\)/);
assert.match(preview,/setTimeout\(sequence,1100\)/);
assert.match(preview,/keys\.forEach\(key=>key\.classList\.remove\("is-current"\)\)[\s\S]*?keys\[keyIndex\]\.classList\.add\("is-current"\)/,"Studio preview must clear every key before adding exactly one active light.");
assert.match(preview,/\.machine\.is-buttons-on \.key\.is-current:before\{opacity:\.95;animation:keyFaceGlow 1100ms/);
assert.doesNotMatch(preview,/0 0 9px rgba\(255,203,98/);
assert.match(preview,/\.screen video\{[^}]*object-fit:cover;object-position:50% 50%;background:transparent/);
assert.doesNotMatch(preview,/\.screen video\{[^}]*object-fit:contain/);
assert.match(preview,/\.key-icon g\{[^}]*stroke:currentColor/);
assert.match(preview,/Public sharing activates after deployment/);
assert.doesNotMatch(preview,/url:location\.href/);
assert.match(preview,/target="_blank" rel="noopener noreferrer"/);
assert.match(preview,/DeepCutsJookBoxCoinAudio/);
assert.match(preview,/sound\?\.play\(\)/);
assert.match(preview,/coinPlayback\?\.then\)coinPlayback\.then\(startVideo\)/);
assert.match(preview,/volume:1,gain:1\.15/);
assert.match(preview,/video\.play\(\)/);
assert.match(preview,/is-neon-on/);
assert.match(preview,/is-screen-on/);
assert.match(preview,/is-buttons-on/);
assert.match(preview,/is-ticker-on/);
assert.doesNotMatch(preview,/youtube-nocookie/i);
assert.match(preview,/No web lookup runs for Bar Edition/i);
assert.match(publisher,/buttonLightDurationMs:1100/);
assert.match(publisher,/lightSequenceMode:"single-key"/);
assert.doesNotMatch(app,/playJookBoxCoinFallback|window\.AudioContext|webkitAudioContext/,"Bar/JookBox must never fall back to an electronic synthesized coin noise.");

console.log("Bar Edition contract tests passed: the isolated heritage brass cabinet, five-plus-About Us keys, sole Share panel, local MP4, coin start-up and Studio intake are locked.");
