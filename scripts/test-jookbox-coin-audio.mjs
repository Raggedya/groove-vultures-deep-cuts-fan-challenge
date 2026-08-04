import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const [engine,index,app,studioModel,aggitsPreview,forgeConfig,windowsBuilder,worker]=await Promise.all([
  fs.readFile("assets/js/jookbox-coin-audio.js","utf8"),
  fs.readFile("index.html","utf8"),
  fs.readFile("js/app.js","utf8"),
  fs.readFile("scripts/studio-model.mjs","utf8"),
  fs.readFile("scripts/aggits-jukebox-preview.mjs","utf8"),
  fs.readFile("forge.config.cjs","utf8"),
  fs.readFile("scripts/build-studio-windows.mjs","utf8"),
  fs.readFile("worker/aggits-jukebox-publisher.js","utf8")
]);

assert.match(engine,/AudioContext\|\|global\.webkitAudioContext/,"The shared coin engine must support standard and WebKit AudioContext implementations.");
assert.match(engine,/decodeAudioData/,"The real coin recording must be pre-decoded for reliable user-gesture playback.");
assert.match(engine,/this\.context\.resume\(\)/,"A suspended mobile audio context must resume inside the coin gesture.");
assert.match(engine,/element\.play\(\)/,"HTML audio must remain as the cross-browser fallback.");
assert.match(engine,/playHtmlRecording\(\)/,"The real recording must begin through HTML media inside the coin gesture on mobile.");
assert.match(engine,/addEventListener\("ended",finish/,"Coin playback must expose its real ended event to media-focus sequencing.");
assert.match(engine,/volume=1/,"The physical coin recording must default to an audible full-volume level.");
assert.doesNotMatch(engine,/Oscillator|createOscillator/,"The coin fallback must never substitute an electronic synthetic noise.");

let latestAudio=null;
class MockAudio{
  constructor(source){this.src=source;this.listeners=new Map();this.playCalls=0;latestAudio=this}
  load(){}
  pause(){}
  play(){this.playCalls+=1;return Promise.resolve()}
  addEventListener(type,listener){this.listeners.set(type,listener)}
  removeEventListener(type,listener){if(this.listeners.get(type)===listener)this.listeners.delete(type)}
  emit(type){this.listeners.get(type)?.({type})}
}
const browser={
  Audio:MockAudio,
  console,
  clearTimeout,
  setTimeout,
};
browser.window=browser;
vm.runInNewContext(engine,browser,{filename:"jookbox-coin-audio.js"});
const behavioralCoin=browser.DeepCutsJookBoxCoinAudio.create("/assets/audio/jukebox-real-coin-insert-cc0.mp3",{volume:1,gain:1.15});
const behavioralPlayback=behavioralCoin.play();
assert.equal(latestAudio.playCalls,1,"The coin gesture must synchronously start the real HTML recording.");
let playbackCompleted=false;
behavioralPlayback.then(()=>{playbackCompleted=true});
await Promise.resolve();
assert.equal(playbackCompleted,false,"Coin playback must not report completion before the recording ends.");
latestAudio.emit("ended");
await behavioralPlayback;
assert.equal(playbackCompleted,true,"The shared engine must resolve only after the real coin recording ends.");
behavioralCoin.destroy();

for(const [name,source] of [["public discovery shell",index],["Bar Studio preview",studioModel],["Aggits Jukebox preview",aggitsPreview]]){
  assert.match(source,/\/assets\/js\/jookbox-coin-audio\.js/,`${name} must load the shared coin-audio engine.`);
  assert.match(source,/rel="preload" href="\/assets\/audio\/jukebox-real-coin-insert-cc0\.mp3" as="audio" type="audio\/mpeg"/,`${name} must begin loading the real coin recording before the visitor inserts the coin.`);
}
for(const [name,source] of [["public discovery runtime",app],["Bar Studio preview",studioModel],["Aggits Jukebox preview",aggitsPreview]]){
  assert.match(source,/DeepCutsJookBoxCoinAudio/,`${name} must use the shared coin-audio engine.`);
  assert.match(source,/volume:1,gain:1\.15/,`${name} must request the locked audible coin level.`);
}
assert.match(app,/const coinPlayback=playJookBoxCoinSound\(\)/,"The public runtime must retain the coin completion handle.");
assert.match(app,/coinPlayback\.then\(activateVideoAfterCoin\)/,"Video media focus must wait for the real coin recording to finish.");
assert.doesNotMatch(app,/activateJookBoxVideo\(true\);[\s\S]{0,80}\},650/,"YouTube must never interrupt the coin recording after 650 milliseconds.");
assert.doesNotMatch(studioModel,/sound\.play\(\)\.catch\(\(\)=>\{\}\)/,"Bar Studio must not silently swallow coin playback failure.");
assert.match(forgeConfig,/assets\/js\/jookbox-coin-audio\.js/,"Electron packaging must include the shared coin-audio engine.");
assert.match(windowsBuilder,/assets\/js\/jookbox-coin-audio\.js/,"The deterministic Windows installer must include the shared coin-audio engine.");
assert.match(worker,/coinSoundSha256:"0d5af258fc72136626d4888c3b6a75240afe8d7b6c00d5837576b92c4ebadec0"/,"Published Aggits editions must retain the verified real coin recording identity.");
assert.match(worker,/coinSoundLicense:"CC0-1\.0"/,"Published Aggits editions must retain the coin recording licence.");

console.log("Shared JookBox coin audio passed: the real recording starts in the coin gesture, resolves on its ended event, and defers video media focus across Band, Bar, Aggits and Studio runtimes.");
