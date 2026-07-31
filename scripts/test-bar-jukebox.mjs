import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import {attachMp4,createProject,renderStudioPreview} from "./studio-model.mjs";

const [contracts,html,app,styles,studioHtml,studioApp,server,validator,forge]=await Promise.all([
  fs.readFile("edition-contracts.json","utf8").then(JSON.parse),
  fs.readFile("index.html","utf8"),
  fs.readFile("js/app.js","utf8"),
  fs.readFile("styles.css","utf8"),
  fs.readFile("studio/index.html","utf8"),
  fs.readFile("studio/app.js","utf8"),
  fs.readFile("scripts/studio-server.mjs","utf8"),
  fs.readFile("scripts/validate-platform.mjs","utf8"),
  fs.readFile("forge.config.cjs","utf8")
]);

assert.equal(contracts.productModels.bar_jukebox.version,1);
assert.equal(contracts.productModels.bar_jukebox.defaultAppearanceVariant,"atlas-reference-cabinet/1");
assert.equal(contracts.productModels.bar_jukebox.defaultKeyBankFormat,"bar-six-key/1");
assert.deepEqual(contracts.editionTypes.bar_jukebox.exclusiveConfig,["barJookBox"]);
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("five-administrator-labelled-https-actions"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("permanent-sixth-share-key"));
assert.ok(contracts.productModels.bar_jukebox.lockedCapabilities.includes("direct-coin-gesture-local-mp4-autoplay-request-with-controls-fallback"));

assert.match(html,/id="barJookBoxWelcomeVideo"/);
assert.match(html,/id="barJookBoxIntro"/);
assert.match(app,/function isBarJookBoxEdition\(\)/);
assert.match(app,/Array\.isArray\(source\.actions\)\?source\.actions:\[\]\)\.slice\(0,5\)/);
assert.match(app,/keyBankFormat:"bar-six-key\/1"/);
assert.match(app,/controls\.push\(createJookBoxUtilityKey\("share",controls\.length\)\)/);
assert.match(app,/activateBarJookBoxWelcomeVideo\(\{autoplay:true\}\)/);
assert.match(app,/barJookBoxWelcomeVideo\.play\(\)/);
assert.match(app,/localWelcomeVideo/);
assert.match(app,/webLookupAllowed/);
assert.match(styles,/\[data-product-type="bar_jukebox"\] \.bar-jookbox-welcome-video/);
assert.match(styles,/\[data-product-type="bar_jukebox"\]\[data-jookbox-key-format="bar-six-key\/1"\]/);
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
assert.match(studioHtml,/id="mp4-file"/);
assert.match(studioApp,/Build the local MP4 JookBox with five keys plus Share/);
assert.match(studioApp,/type\?\.id==="bar_jukebox"/);
assert.match(server,/MAX_MP4_BYTES=500\*1024\*1024/);
assert.match(server,/serveMediaFile\(request,response/);
assert.match(server,/verificationRequired:project\.input\.type==="bar_jukebox"\?false/);
assert.match(validator,/exactly five administrator-supplied actions; Share is the permanent sixth key/);
assert.match(validator,/config\.editionType!=='bar_jukebox'/);
assert.match(forge,/jukebox-real-coin-insert-cc0\.mp3/);
assert.match(forge,/jookbox-atlas-reference-v1\.webp/);

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
  tickerText:"SHOTKICKERS — LIVE MUSIC, GIGS, DRINKS AND GOOD TIMES."
});
assert.equal(base.input.sourceUrls.length,5);
assert.equal(base.input.sourceLabels.length,5);
assert.equal(base.readiness.handoffReady,false);
const complete=attachMp4(base,{fileName:"welcome.mp4",sizeBytes:2048,sha256:"f".repeat(64)});
assert.equal(complete.readiness.handoffReady,true);
const preview=renderStudioPreview(complete,{videoUrl:"/api/studio/projects/studio_preview/video"});
assert.equal((preview.match(/class="key(?:\s|")/g)||[]).length,6,"Bar Edition preview must always render five administrator keys plus Share.");
assert.match(preview,/id="shareKey"/);
assert.match(preview,/target="_blank" rel="noopener noreferrer"/);
assert.match(preview,/sound\.play\(\)/);
assert.match(preview,/video\.play\(\)/);
assert.match(preview,/is-neon-on/);
assert.match(preview,/is-screen-on/);
assert.match(preview,/is-buttons-on/);
assert.match(preview,/is-ticker-on/);
assert.doesNotMatch(preview,/youtube-nocookie/i);
assert.match(preview,/No web lookup runs for Bar Edition/i);

console.log("Bar Edition contract tests passed: the isolated ATLAS cabinet, five-plus-Share keys, local MP4, coin start-up and Mac Studio intake are locked.");
