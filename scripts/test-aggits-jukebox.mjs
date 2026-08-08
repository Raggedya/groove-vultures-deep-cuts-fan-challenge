import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {createProject,attachMp4,renderStudioPreview} from "./studio-model.mjs";
import {AGGITS_JUKEBOX_ICONS,AGGITS_JUKEBOX_CABINET,AGGITS_JUKEBOX_CABINET_SHA256,AGGITS_JUKEBOX_ICON_MASTER_SHA256,AGGITS_JUKEBOX_OVAL_ICON_SET_SHA256} from "./aggits-jukebox-icons.mjs";
import {MAHOGANY_FIXED_MARQUEE_ASSET,MAHOGANY_FIXED_MARQUEE_SHA256,MAHOGANY_BUTTON_CLUNK_ASSET,MAHOGANY_BUTTON_CLUNK_SHA256,MAHOGANY_BUTTON_LINK_DELAY_MS,MAHOGANY_AGGITS_COIN_ASSET,MAHOGANY_AGGITS_COIN_SHA256,MAHOGANY_BUTTON_ATTENTION_START_SECONDS,MAHOGANY_BUTTON_ATTENTION_FLASH_SECONDS,MAHOGANY_BUTTON_ATTENTION_BUTTON_COUNT,MAHOGANY_BUTTON_ATTENTION_CYCLES,MAHOGANY_BUTTON_ATTENTION_END_SECONDS,mahoganyButtonAttentionIndex,isMahoganyButtonAttentionTime} from "./aggits-jukebox-preview.mjs";

const root=path.resolve(import.meta.dirname,"..");
const fixture={type:"aggits_jukebox",name:"An Exceptionally Long Melbourne Venue Name",tickerText:"THE BLOCK AND BEYOND! KITCHEN, EVENTS AND BOOKINGS.",actionButtons:[
  {enabled:true,iconId:"call",label:"CALL US",actionType:"tel",value:"+61 3 9000 0000"},
  {enabled:true,iconId:"book_now",label:"BOOK NOW",actionType:"web",value:"https://example.com/book"},
  {enabled:true,iconId:"gigs",label:"UPCOMING GIGS",actionType:"web",value:"https://example.com/gigs"},
  {enabled:true,iconId:"menu",label:"MENU",actionType:"web",value:"https://example.com/menu"}
]};

assert.equal(AGGITS_JUKEBOX_ICONS.length,111,"canonical icon library must contain 111 mapped icons");
assert.ok(AGGITS_JUKEBOX_ICONS.some(icon=>icon.id==="bandcamp"),"canonical icon library must include Bandcamp");
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
  assert.match(icon.assetPath,/aggits-jukebox-icons-oval-v4\/.+\.svg$/);
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
  "aggits-jukebox-illuminated-master-v3.png","aggits-jukebox-icons-oval-v4","jukebox-real-coin-insert-cc0.mp3","object-fit:cover",
  'addEventListener("ended"',"noopener noreferrer","1804","1436","aspect-ratio:864/1536","is-depressed","enableActions"
])assert.ok(html.includes(required),`preview missing ${required}`);
assert.ok(!html.includes("Math.random()"),"action-key illumination and random sequencing must remain removed");
assert.ok(!html.includes("is-lighting"),"Aggits Jukebox action keys must not render lighting states");
assert.ok(!html.includes("<strong>CALL US</strong>"),"public oval keys must remain icon-only");
assert.ok(!html.includes(".action:before"),"public oval keys must not render an exterior secondary line");
assert.match(html,/\.actions\{[^}]*background:transparent/,"button bank must preserve the illuminated master artwork beneath the live oval keys");
assert.ok(!html.includes(".actions:before"),"the clean illuminated master must not require a corrective mask above the key bank");
assert.ok(!html.includes("solid transparent"),"public oval keys must not render an exterior border layer");
assert.ok(!html.includes("border-box;color:#d5a355"),"public oval keys must use an internal bevel instead of an exterior gradient contour");
assert.match(html,/\.action-icon\{[^}]*width:68%/,"public oval key icons must remain centred inside the photographed key faces");
assert.ok(!html.includes("outline:3px solid #ffe19a"),"the large transparent coin hotspot must never expose an oval focus outline");
assert.match(html,/aria-label="CALL US \(opens in a new tab\)"/,"stored labels must remain accessible names and announce external-tab behaviour");
assert.equal(sha256(path.join(root,MAHOGANY_AGGITS_COIN_ASSET.replace(/^\//,""))),MAHOGANY_AGGITS_COIN_SHA256,"embossed Aggits coin identity changed");
assert.match(html,/class="coin-art"[^>]+aggits-coin-gold-v1\.png/,"coin must use the locked face-visible Aggits artwork");
assert.match(html,/left:16\.7%;width:9\.4%/,"coin must begin beside the illuminated master slot with only a shallow overlap");
assert.match(html,/translateX\(-56%\) rotateY\(88deg\)/,"coin must turn edge-on while travelling into the physical slot");
assert.equal(sha256(path.join(root,MAHOGANY_BUTTON_CLUNK_ASSET.replace(/^\//,""))),MAHOGANY_BUTTON_CLUNK_SHA256,"mechanical clunk identity changed");
assert.equal(MAHOGANY_BUTTON_LINK_DELAY_MS,500);
assert.match(html,/actions\.forEach\(candidate=>candidate\.classList\.toggle\("is-depressed",candidate===action\)\)/,"only one key may stay mechanically depressed");
assert.match(html,/launchTimer=setTimeout\(\(\)=>\{if\(outboundWindow\.closed\)return;/,"the reserved destination tab must navigate after the mechanical delay");
assert.ok(!html.includes('setTimeout(()=>video.pause'),"video completion must not use a timer");
assert.equal(MAHOGANY_BUTTON_ATTENTION_START_SECONDS,45.14);
assert.equal(MAHOGANY_BUTTON_ATTENTION_FLASH_SECONDS,.5);
assert.equal(MAHOGANY_BUTTON_ATTENTION_BUTTON_COUNT,4);
assert.equal(MAHOGANY_BUTTON_ATTENTION_CYCLES,3);
assert.equal(MAHOGANY_BUTTON_ATTENTION_END_SECONDS,51.14);
assert.equal(isMahoganyButtonAttentionTime(45.139),false);
assert.equal(isMahoganyButtonAttentionTime(45.14),true);
assert.equal(isMahoganyButtonAttentionTime(45.639),true);
assert.equal(mahoganyButtonAttentionIndex(45.14),0);
assert.equal(mahoganyButtonAttentionIndex(45.639),0);
assert.equal(mahoganyButtonAttentionIndex(45.64),1);
assert.equal(mahoganyButtonAttentionIndex(46.14),2);
assert.equal(mahoganyButtonAttentionIndex(46.64),3);
assert.equal(mahoganyButtonAttentionIndex(47.14),0);
assert.equal(mahoganyButtonAttentionIndex(49.14),0);
assert.equal(mahoganyButtonAttentionIndex(51.139),3);
assert.equal(mahoganyButtonAttentionIndex(51.14),-1);
assert.equal(isMahoganyButtonAttentionTime(51.14),false);
assert.match(html,/requestVideoFrameCallback/,"native MP4 timing must use presented media frames when supported");
assert.match(html,/metadata\?\.mediaTime/,"the attention state must consume media time rather than elapsed page time");
assert.match(html,/setInterval\(\(\)=>syncAttentionFlash\(video\.currentTime,video\.currentSrc\|\|video\.src\),50\)/,"MP4 timing must have an independent mobile watchdog");
assert.match(html,/setInterval\(requestYouTubeTime,80\)/,"YouTube timing must be actively sampled on mobile without depending on a player-state callback");
assert.match(html,/postYouTube\("getCurrentTime"\)/,"YouTube timing must request actual player media time");
assert.match(html,/frame\?\.addEventListener\("load",\(\)=>\{connectYouTube\(\);startYouTubeClock\(\)\}\)/,"the mobile YouTube bridge and watchdog must reconnect after the iframe loads");
assert.match(html,/youtubeMessageOrigins=new Set\(\["https:\/\/www\.youtube-nocookie\.com","https:\/\/www\.youtube\.com"\]\)/,"both valid YouTube player origins must be accepted");
assert.match(html,/video\?\.addEventListener\("play",\(\)=>\{syncAttentionFlash/,'every MP4 replay must restart media-time monitoring');
assert.match(html,/video\?\.addEventListener\("seeked",\(\)=>\{syncAttentionFlash/,'seeking before the flash window must re-arm monitoring');
assert.doesNotMatch(html,/attentionCompleted|attentionTriggered/,"the flash must not become permanently completed after one playback");
assert.match(html,/class="attention-flash-border"/,"every physical key needs a dedicated border-only flash layer");
assert.equal((html.match(/class="attention-flash-border"/g)||[]).length,4,"all four physical keys need the flash border layer");
assert.match(html,/\.action\.is-attention-flash \.attention-flash-border\{opacity:1\}/);
assert.match(html,/video\?\.addEventListener\("loadstart",\(\)=>resetAttentionFlash/,"a new source must clear the current flash state");
const directive=fs.readFileSync(path.join(root,"PLATFORM_ARCHITECTURE_DIRECTIVE.md"),"utf8");
assert.match(directive,/## Aggits four-button Jukebox contract/);
assert.match(directive,/video opening is landscape `3759:2992`/);

console.log(`Aggits Jukebox tests passed: ${AGGITS_JUKEBOX_ICONS.length} icons, embossed Aggits coin insertion, interlocked oval keys, 500 ms clunk delay, genuine media completion and 1804 × 1436 guidance.`);
