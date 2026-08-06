import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {createProject,attachMp4,renderStudioPreview} from "./studio-model.mjs";
import {AGGITS_JUKEBOX_ICONS,AGGITS_JUKEBOX_CABINET,AGGITS_JUKEBOX_CABINET_SHA256,AGGITS_JUKEBOX_ICON_MASTER_SHA256,AGGITS_JUKEBOX_OVAL_ICON_SET_SHA256} from "./aggits-jukebox-icons.mjs";
import {MAHOGANY_FIXED_MARQUEE_ASSET,MAHOGANY_FIXED_MARQUEE_SHA256,MAHOGANY_BUTTON_CLUNK_ASSET,MAHOGANY_BUTTON_CLUNK_SHA256,MAHOGANY_BUTTON_LINK_DELAY_MS} from "./aggits-jukebox-preview.mjs";

const root=path.resolve(import.meta.dirname,"..");
const fixture={type:"aggits_jukebox",name:"An Exceptionally Long Melbourne Venue Name",tickerText:"THE BLOCK AND BEYOND! KITCHEN, EVENTS AND BOOKINGS.",actionButtons:[
  {enabled:true,iconId:"call",label:"CALL US",actionType:"tel",value:"+61 3 9000 0000"},
  {enabled:true,iconId:"book_now",label:"BOOK NOW",actionType:"web",value:"https://example.com/book"},
  {enabled:true,iconId:"gigs",label:"UPCOMING GIGS",actionType:"web",value:"https://example.com/gigs"},
  {enabled:true,iconId:"menu",label:"MENU",actionType:"web",value:"https://example.com/menu"}
]};

assert.equal(AGGITS_JUKEBOX_ICONS.length,110,"canonical icon library must contain 110 mapped icons");
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
  assert.match(icon.assetPath,/aggits-jukebox-icons-oval-v3\/.+\.svg$/);
  const svg=fs.readFileSync(file,"utf8");
  assert.equal((svg.match(/<svg\b/g)||[]).length,1,`icon must contain one clean SVG root: ${icon.id}`);
  ovalSetHash.update(path.basename(file));
  ovalSetHash.update(svg);
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
  "aggits-jukebox-oval-master-v2.jpg","aggits-jukebox-icons-oval-v3","jukebox-real-coin-insert-cc0.mp3","object-fit:cover",
  'addEventListener("ended"',"noopener noreferrer","1120","aspect-ratio:720/1280","is-depressed","enableActions"
])assert.ok(html.includes(required),`preview missing ${required}`);
assert.ok(!html.includes("Math.random()"),"action-key illumination and random sequencing must remain removed");
assert.ok(!html.includes("is-lighting"),"Aggits Jukebox action keys must not render lighting states");
assert.ok(html.includes("<strong>CALL US</strong>"),"public oval keys must retain their visible physical labels");
assert.ok(!html.includes("outline:3px solid #ffe19a"),"the large transparent coin hotspot must never expose an oval focus outline");
assert.match(html,/aria-label="CALL US"/,"stored labels must remain accessible names");
assert.match(html,/width:30%;height:72%/,"coin must use the vertical metallic treatment");
assert.match(html,/rotateY\(48deg\)/,"coin must be vertically oriented toward the physical slot");
assert.equal(sha256(path.join(root,MAHOGANY_BUTTON_CLUNK_ASSET.replace(/^\//,""))),MAHOGANY_BUTTON_CLUNK_SHA256,"mechanical clunk identity changed");
assert.equal(MAHOGANY_BUTTON_LINK_DELAY_MS,500);
assert.match(html,/actions\.forEach\(candidate=>candidate\.classList\.toggle\("is-depressed",candidate===action\)\)/,"only one key may stay mechanically depressed");
assert.match(html,/setTimeout\(\(\)=>\{if\(newTab\)/,"destination opening must follow the mechanical delay");
assert.ok(!html.includes('setTimeout(()=>video.pause'),"video completion must not use a timer");
assert.ok(!html.includes('addEventListener("timeupdate"'),"media time must not be artificially clamped");
const directive=fs.readFileSync(path.join(root,"PLATFORM_ARCHITECTURE_DIRECTIVE.md"),"utf8");
assert.match(directive,/## Aggits four-button Jukebox contract/);
assert.match(directive,/video opening is exactly `7:8`/);

console.log(`Aggits Jukebox tests passed: ${AGGITS_JUKEBOX_ICONS.length} icons, vertical coin, interlocked oval keys, 500 ms clunk delay, genuine media completion and 7:8 guidance.`);
