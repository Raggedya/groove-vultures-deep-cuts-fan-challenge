import assert from "node:assert/strict";
import fs from "node:fs/promises";

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
assert.match(engine,/this\.element\.play\(\)/,"HTML audio must remain as the cross-browser fallback.");
assert.match(engine,/volume=1/,"The physical coin recording must default to an audible full-volume level.");
assert.doesNotMatch(engine,/Oscillator|createOscillator/,"The coin fallback must never substitute an electronic synthetic noise.");

for(const [name,source] of [["public discovery shell",index],["Bar Studio preview",studioModel],["Aggits Jukebox preview",aggitsPreview]]){
  assert.match(source,/\/assets\/js\/jookbox-coin-audio\.js/,`${name} must load the shared coin-audio engine.`);
  assert.match(source,/rel="preload" href="\/assets\/audio\/jukebox-real-coin-insert-cc0\.mp3" as="audio" type="audio\/mpeg"/,`${name} must begin loading the real coin recording before the visitor inserts the coin.`);
}
for(const [name,source] of [["public discovery runtime",app],["Bar Studio preview",studioModel],["Aggits Jukebox preview",aggitsPreview]]){
  assert.match(source,/DeepCutsJookBoxCoinAudio/,`${name} must use the shared coin-audio engine.`);
  assert.match(source,/volume:1,gain:1\.15/,`${name} must request the locked audible coin level.`);
}
assert.doesNotMatch(studioModel,/sound\.play\(\)\.catch\(\(\)=>\{\}\)/,"Bar Studio must not silently swallow coin playback failure.");
assert.match(forgeConfig,/assets\/js\/jookbox-coin-audio\.js/,"Electron packaging must include the shared coin-audio engine.");
assert.match(windowsBuilder,/assets\/js\/jookbox-coin-audio\.js/,"The deterministic Windows installer must include the shared coin-audio engine.");
assert.match(worker,/coinSoundSha256:"0d5af258fc72136626d4888c3b6a75240afe8d7b6c00d5837576b92c4ebadec0"/,"Published Aggits editions must retain the verified real coin recording identity.");
assert.match(worker,/coinSoundLicense:"CC0-1\.0"/,"Published Aggits editions must retain the coin recording licence.");

console.log("Shared JookBox coin audio passed: Band, Bar, Aggits, Studio and packaged Windows runtimes use the verified real recording with Web Audio plus HTML-audio fallback.");
