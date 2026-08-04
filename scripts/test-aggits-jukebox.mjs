import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {createProject,attachMp4,renderStudioPreview} from "./studio-model.mjs";
import {AGGITS_JUKEBOX_ICONS,AGGITS_JUKEBOX_CABINET_SHA256,AGGITS_JUKEBOX_ICON_MASTER_SHA256} from "./aggits-jukebox-icons.mjs";

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
assert.equal(sha256(path.join(root,"assets","aggits-jukebox-master-v1.jpg")),AGGITS_JUKEBOX_CABINET_SHA256,"cabinet master identity changed");
assert.equal(sha256(path.join(root,"assets","aggits-jukebox-icons-master-v1.jpg")),AGGITS_JUKEBOX_ICON_MASTER_SHA256,"icon master identity changed");
for(const icon of AGGITS_JUKEBOX_ICONS){
  const file=path.join(root,icon.assetPath.replace(/^\//,""));
  assert.ok(fs.statSync(file).size>1000,`missing or empty icon asset: ${icon.id}`);
}

let project=createProject(fixture,new Date("2026-08-03T00:00:00Z"));
assert.equal(project.input.actionButtons[0].href,"tel:+61390000000");
assert.equal(project.readiness.handoffReady,false);
project=attachMp4(project,{fileName:"welcome.mp4",sizeBytes:1024,sha256:"a".repeat(64)},new Date("2026-08-03T00:01:00Z"));
assert.equal(project.readiness.handoffReady,true);
const html=renderStudioPreview(project,{videoUrl:"/media/welcome.mp4"});
assert.match(html,/<textPath href="#aggitsMarqueeArc" startOffset="50%">AGGITS<\/textPath>/,"the physical marquee must use the permanent AGGITS heading");
assert.ok(!html.includes(">AN EXCEPTIONALLY LONG MELBOURNE VENUE NAME<"),"the project identity must never replace the fixed physical marquee");
for(const required of [
  "aggits-jukebox-master-v1.jpg","jukebox-real-coin-insert-cc0.mp3","object-fit:cover",
  'addEventListener("ended"',"noopener noreferrer","1120","aspect-ratio:1","width:min(64%,70px)","enableActions"
])assert.ok(html.includes(required),`preview missing ${required}`);
assert.ok(!html.includes("Math.random()"),"action-key illumination and random sequencing must remain removed");
assert.ok(!html.includes("is-lighting"),"Aggits Jukebox action keys must not render lighting states");
assert.ok(!html.includes("<strong>CALL US</strong>"),"public action keys must render icons only");
assert.ok(!html.includes("outline:3px solid #ffe19a"),"the large transparent coin hotspot must never expose an oval focus outline");
assert.match(html,/aria-label="CALL US"/,"stored labels must remain accessible names");
assert.match(html,/background:radial-gradient\(circle at 31% 24%,#fff8bd/,"coin must use the polished opaque gold treatment");
assert.ok(!html.includes('setTimeout(()=>video.pause'),"video completion must not use a timer");
assert.ok(!html.includes('addEventListener("timeupdate"'),"media time must not be artificially clamped");
const directive=fs.readFileSync(path.join(root,"PLATFORM_ARCHITECTURE_DIRECTIVE.md"),"utf8");
assert.match(directive,/## Aggits four-button Jukebox contract/);
assert.match(directive,/video opening is exactly `7:8`/);

console.log(`Aggits Jukebox tests passed: ${AGGITS_JUKEBOX_ICONS.length} icons, polished coin, static icon-only actions, genuine media completion and 7:8 guidance.`);
