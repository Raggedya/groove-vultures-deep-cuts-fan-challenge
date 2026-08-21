import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {createProject,attachMp4,renderStudioPreview} from "./studio-model.mjs";
import {AGGITS_JUKEBOX_ICONS,AGGITS_JUKEBOX_CABINET,AGGITS_JUKEBOX_CABINET_SHA256,AGGITS_JUKEBOX_ICON_MASTER_SHA256,AGGITS_JUKEBOX_OVAL_ICON_SET_SHA256} from "./aggits-jukebox-icons.mjs";
import {MAHOGANY_FIXED_MARQUEE_ASSET,MAHOGANY_FIXED_MARQUEE_SHA256,MAHOGANY_BUTTON_CLUNK_ASSET,MAHOGANY_BUTTON_CLUNK_SHA256,MAHOGANY_BUTTON_LINK_DELAY_MS,MAHOGANY_AGGITS_COIN_ASSET,MAHOGANY_AGGITS_COIN_SHA256} from "./aggits-jukebox-preview.mjs";

const root=path.resolve(import.meta.dirname,"..");
const fixture={type:"aggits_jukebox",name:"An Exceptionally Long Melbourne Venue Name",tickerText:"THE BLOCK AND BEYOND! KITCHEN, EVENTS AND BOOKINGS.",actionButtons:[
  {enabled:true,iconId:"call",label:"CALL US",actionType:"tel",value:"+61 3 9000 0000"},
  {enabled:true,iconId:"book_now",label:"BOOK NOW",actionType:"web",value:"https://example.com/book"},
  {enabled:true,iconId:"gigs",label:"UPCOMING GIGS",actionType:"web",value:"https://example.com/gigs"},
  {enabled:true,iconId:"menu",label:"MENU",actionType:"web",value:"https://example.com/menu"}
]};

assert.equal(AGGITS_JUKEBOX_ICONS.length,173,"canonical icon library must contain 173 mapped icons");
assert.ok(AGGITS_JUKEBOX_ICONS.some(icon=>icon.id==="bandcamp"),"canonical icon library must include Bandcamp");
for(const requiredIcon of ["australian_football","cricket","restaurant","live_entertainment","wedding_ceremony","florist","photography"]){
  assert.ok(AGGITS_JUKEBOX_ICONS.some(icon=>icon.id===requiredIcon),`canonical icon library must include ${requiredIcon}`);
}
assert.equal(new Set(AGGITS_JUKEBOX_ICONS.map(icon=>icon.id)).size,AGGITS_JUKEBOX_ICONS.length,"canonical icon IDs must be unique");
assert.match(AGGITS_JUKEBOX_CABINET_SHA256,/^[a-f0-9]{64}$/);
assert.match(AGGITS_JUKEBOX_ICON_MASTER_SHA256,/^[a-f0-9]{64}$/);
const sha256=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
assert.equal(sha256(path.join(root,AGGITS_JUKEBOX_CABINET)),AGGITS_JUKEBOX_CABINET_SHA256,"cabinet master identity changed");
assert.equal(sha256(path.join(root,"assets","aggits-jukebox-icons-master-v1.jpg")),AGGITS_JUKEBOX_ICON_MASTER_SHA256,"icon master identity changed");
assert.equal(sha256(path.join(root,MAHOGANY_FIXED_MARQUEE_ASSET.replace(/^\//,""))),MAHOGANY_FIXED_MARQUEE_SHA256,"fixed AGGITS marquee reference changed");
const ovalSetHash=crypto.createHash("sha256");
for(const icon of AGGITS_JUKEBOX_ICONS){
  const file=path.join(root,icon.assetPath.replace(/^\//,""));
  assert.ok(fs.statSync(file).size>300,`missing or empty icon asset: ${icon.id}`);
  assert.match(icon.assetPath,/aggits-jukebox-icons-oval-v6\/.+\.svg$/);
  const svg=fs.readFileSync(file,"utf8");
  assert.equal((svg.match(/<svg\b/g)||[]).length,1,`icon must contain one clean SVG root: ${icon.id}`);
  ovalSetHash.update(path.basename(file));
  ovalSetHash.update(svg.replace(/\r\n?/g,"\n"));
}
assert.equal(ovalSetHash.digest("hex"),AGGITS_JUKEBOX_OVAL_ICON_SET_SHA256,"oval-native icon set identity changed");

let project=createProject(fixture,new Date("2026-08-03T00:00:00Z"));
assert.equal(project.input.actionButtons[0].href,"tel:+61390000000");
assert.equal(project.readiness.handoffReady,false);
project=attachMp4(project,{fileName:"welcome.mp4",sizeBytes:1024,sha256:"a".repeat(64)},new Date("2026-08-03T00:01:00Z"));
assert.equal(project.readiness.handoffReady,true);
const html=renderStudioPreview(project,{videoUrl:"/media/welcome.mp4"});
assert.ok(!html.includes(">AN EXCEPTIONALLY LONG MELBOURNE VENUE NAME<"),"the project identity must never replace the fixed physical marquee");
for(const required of [
  "aggits-jukebox-illuminated-master-v3.png","aggits-jukebox-icons-oval-v6","jukebox-real-coin-insert-cc0.mp3","object-fit:cover",
  'addEventListener("ended"',"noopener noreferrer","1890","1800","--machine-aspect:864/1536","is-depressed","enableActions"
])assert.ok(html.includes(required),`preview missing ${required}`);
assert.ok(!html.includes("Math.random()"),"action-key illumination and random sequencing must remain removed");
assert.ok(!html.includes("is-lighting"),"Aggits Jukebox action keys must not render lighting states");
assert.ok(!html.includes("<strong>CALL US</strong>"),"public oval keys must remain icon-only");
assert.ok(!html.includes(".action:before"),"public oval keys must not render an exterior secondary line");
assert.match(html,/\.actions\{[^}]*background:transparent/,"button bank must preserve the illuminated master artwork beneath the live oval keys");
assert.ok(!html.includes(".actions:before"),"the clean illuminated master must not require a corrective mask above the key bank");
assert.ok(!html.includes("solid transparent"),"public oval keys must not render an exterior border layer");
assert.ok(!html.includes("border-box;color:#d5a355"),"public oval keys must use an internal bevel instead of an exterior gradient contour");
assert.match(html,/\.action-icon\{[^}]*top:50%;left:50%;width:40%;height:34%[^}]*transform:translate\(-50%,-50%\)/,"public oval key icons must receive a compact, non-collapsing and exactly centred box inside the photographed key faces");
assert.match(html,/\.machine\.is-fixed-action-layout \.action-icon\{top:47\.55%\}/,"the shared icon layer must use the measured vertical centre of the photographed oval faces");
assert.match(html,/\.machine\.is-fixed-action-layout \.action\.is-depressed \.action-icon\{transform:translate\(-50%,-50%\)\}/,"pressing a fixed-layout key must not shift its icon inside the photographed oval face");
assert.match(html,/\.machine\.is-fixed-action-layout \.action\{position:absolute;padding:0\}/,"fixed physical slots must not inherit percentage padding that enlarges and shifts their border boxes");
assert.match(html,/\.action-icon img\{[^}]*object-position:50% 50%/,"all icon artwork must remain optically centred within its shared box");

for (const iconId of ["website", "menu", "shop", "events"]) {
  const iconPath = path.join(root, "assets", "aggits-jukebox-icons-oval-v6", `${iconId}.svg`);
  const raster = await sharp(iconPath)
    .resize(240, 240, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let weightedX = 0;
  let weightedY = 0;
  let alphaTotal = 0;
  for (let y = 0; y < raster.info.height; y += 1) {
    for (let x = 0; x < raster.info.width; x += 1) {
      const alpha = raster.data[(y * raster.info.width + x) * 4 + 3];
      weightedX += x * alpha;
      weightedY += y * alpha;
      alphaTotal += alpha;
    }
  }
  const centre = (raster.info.width - 1) / 2;
  assert.ok(Math.abs(weightedX / alphaTotal - centre) <= 1, `${iconId} artwork must be horizontally centred within one rendered pixel`);
  assert.ok(Math.abs(weightedY / alphaTotal - centre) <= 1, `${iconId} artwork must be vertically centred within one rendered pixel`);
}
assert.match(html,/\.action\{[^}]*filter:brightness\(\.62\) saturate\(\.72\);opacity:\.86/,"configured icons must remain visibly identifiable before activation");
assert.ok(!html.includes("outline:3px solid #ffe19a"),"the large transparent coin hotspot must never expose an oval focus outline");
assert.match(html,/aria-label="CALL US \(opens in a new tab\)"/,"stored labels must remain accessible names and announce external-tab behaviour");
assert.equal(sha256(path.join(root,MAHOGANY_AGGITS_COIN_ASSET.replace(/^\//,""))),MAHOGANY_AGGITS_COIN_SHA256,"embossed Aggits coin identity changed");
assert.match(html,/class="coin-art"[^>]+aggits-coin-gold-v1\.png/,"coin must use the locked face-visible Aggits artwork");
assert.match(html,/--coin-left:\d+(?:\.\d+)?%/,"coin position must come from the locked layout profile");
assert.match(html,/--coin-width:\d+(?:\.\d+)?%/,"coin size must come from the locked layout profile");
assert.match(html,/translateX\(-56%\) rotateY\(88deg\)/,"coin must turn edge-on while travelling into the physical slot");
assert.equal(sha256(path.join(root,MAHOGANY_BUTTON_CLUNK_ASSET.replace(/^\//,""))),MAHOGANY_BUTTON_CLUNK_SHA256,"mechanical clunk identity changed");
assert.equal(MAHOGANY_BUTTON_LINK_DELAY_MS,500);
assert.match(html,/actions\.forEach\(candidate=>candidate\.classList\.toggle\("is-depressed",candidate===action\)\)/,"only one key may stay mechanically depressed");
assert.match(html,/launchTimer=setTimeout\(\(\)=>\{if\(outboundWindow\.closed\)return;/,"the reserved destination tab must navigate after the mechanical delay");
assert.ok(!html.includes('setTimeout(()=>video.pause'),"video completion must not use a timer");
assert.doesNotMatch(html,/bass|AnalyserNode|createAnalyser|attention-flash|is-attention-flash|requestVideoFrameCallback/i,"automatic, sound-reactive and timed key illumination must remain absent");
const customSkinHtml=renderStudioPreview({
  ...project,
  input:{...project.input,cabinetSkin:{kind:"custom",sha256:"b".repeat(64)}},
},{videoUrl:"/media/welcome.mp4",skinUrl:"/media/custom-skin.png"});
assert.match(customSkinHtml,/class="machine is-fixed-action-layout"/,"legacy stored projects must use their preserved fixed interaction profile");
assert.match(customSkinHtml,/data-skin-profile="custom-skin-864\/1"/);
assert.match(customSkinHtml,/--action-1-left:/,"physical key positions must come from the preserved layout profile");
assert.match(customSkinHtml,/--video-top:/,"video geometry must come from the preserved layout profile");
assert.match(customSkinHtml,/clip-path:inset\(0 round var\(--video-radius\)\)/,"video must be clipped inside the photographed cabinet aperture");
assert.match(customSkinHtml,/--share-top:/,"share geometry must come from the preserved layout profile");
const directive=fs.readFileSync(path.join(root,"PLATFORM_ARCHITECTURE_DIRECTIVE.md"),"utf8");
assert.match(directive,/## Aggits four-button Jukebox contract/);
assert.match(directive,/video opening is landscape `3759:2992`/);

console.log(`Aggits Jukebox tests passed: ${AGGITS_JUKEBOX_ICONS.length} icons, embossed Aggits coin insertion, interlocked oval keys, 500 ms clunk delay, genuine media completion and 1890 × 1800 guidance.`);
