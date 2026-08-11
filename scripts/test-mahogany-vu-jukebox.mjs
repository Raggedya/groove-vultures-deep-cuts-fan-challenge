import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  analysePresenterAudio,
  DEFAULT_DUCKING_SETTINGS,
  speechAtTime,
} from "../mahogany-studio/audio-ducking.js";
import {
  newMahoganyProject,
  normalizeMahoganyProject,
  removeMahoganyVuMedia,
  saveMahoganyProject,
  setMahoganyVuDucking,
  storeMahoganyVuCharacter,
  storeMahoganyVuMusic,
  toPreviewProject,
  validateMahoganyProject,
} from "./mahogany-jukebox-model.mjs";
import {
  AGGITS_JUKEBOX_CANONICAL_BUTTON_ASSET,
  AGGITS_JUKEBOX_CANONICAL_BUTTON_SHA256,
  AGGITS_JUKEBOX_CANONICAL_BUTTON_VERSION,
  MAHOGANY_VU_CABINET_URL,
  MAHOGANY_VU_PRESENTER_GAIN,
  MAHOGANY_VU_RENDERER_VERSION,
  MAHOGANY_VU_START_DELAY_MS,
  MAHOGANY_VU_MARQUEE_FLICKER_MS,
  MAHOGANY_VU_MARQUEE_REVEAL_PLAYED_SECONDS,
  renderMahoganyVuPreview,
} from "./mahogany-vu-preview.mjs";
import { verifyMahoganyPublication } from "./mahogany-jukebox-publication.mjs";
import {
  createMahoganyStudioServer,
  repairReusedPublicationIdentity,
} from "./mahogany-studio-server.mjs";

function audioBuffer(duration, speech = [], incidental = []) {
  const sampleRate = 16000,
    length = Math.round(duration * sampleRate),
    data = new Float32Array(length);
  for (let index = 0; index < length; index++)
    data[index] = Math.sin(index * 0.17) * 0.00035;
  for (const [start, end] of speech)
    for (let index = Math.round(start * sampleRate); index < end * sampleRate; index++)
      data[index] +=
        Math.sin(index * 0.061) * 0.105 +
        Math.sin(index * 0.113) * 0.045 +
        Math.sin(index * 0.017) * 0.025;
  for (const [start, end] of incidental)
    for (let index = Math.round(start * sampleRate); index < end * sampleRate; index++)
      data[index] += Math.sin(index * 0.23) * 0.5;
  return {
    sampleRate,
    length,
    duration,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mahogany-vu-test-"));
try {
  // 10. Existing jukeboxes keep the locked master and gain safe defaults only.
  const original = normalizeMahoganyProject(newMahoganyProject());
  assert.equal(original.appearance, "mahogany-master");
  assert.deepEqual(
    {
      enabled: original.vu.ducking.enabled,
      speakingLevel: original.vu.ducking.speakingLevel,
      attackMs: original.vu.ducking.attackMs,
      releaseMs: original.vu.ducking.releaseMs,
      holdMs: original.vu.ducking.holdMs,
    },
    {
      enabled: true,
      speakingLevel: 0.2,
      attackMs: 320,
      releaseMs: 950,
      holdMs: 1600,
    },
  );

  let project = normalizeMahoganyProject({
    ...original,
    appearance: "mahogany-vu",
    name: "VU Test Band",
    tickerText: "NOW PLAYING VU TEST BAND",
    actions: original.actions.map((action) => ({
      ...action,
      href: "https://example.com/",
    })),
  });
  assert.equal(validateMahoganyProject(project).ready, false);

  // 1. MP3 only.
  const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00]);
  project = await storeMahoganyVuMusic(root, project, mp3, "test-track.mp3");
  assert.equal(validateMahoganyProject(project).ready, true);
  const musicOnly = renderMahoganyVuPreview(toPreviewProject(project), {
    musicUrl: "/music",
  });
  const otherBand = renderMahoganyVuPreview(
    {
      ...toPreviewProject(project),
      input: {
        ...toPreviewProject(project).input,
        name: "SECOND BAND",
        tickerText: "ONLY THE SECOND BAND MESSAGE",
      },
    },
    { musicUrl: "/music" },
  );
  assert.match(musicOnly, /<div class="ticker"><span>NOW PLAYING VU TEST BAND<\/span><\/div>/);
  assert.match(otherBand, /<div class="ticker"><span>ONLY THE SECOND BAND MESSAGE<\/span><\/div>/);
  assert.doesNotMatch(otherBand, /NOW PLAYING VU TEST BAND/);
  assert.match(musicOnly, /id="music"/);
  assert.equal(
    MAHOGANY_VU_CABINET_URL,
    "/assets/aggits-jukebox-vu-master-v2.jpg",
  );
  assert.match(musicOnly, /aggits-jukebox-vu-master-v2\.jpg/);
  assert.doesNotMatch(musicOnly, /aggits-jukebox-vu-master-v1\.jpg/);
  assert.match(
    musicOnly,
    /<link rel="preload" href="\/assets\/aggits-jukebox-vu-master-v2\.jpg" as="image">/,
  );
  assert.match(
    musicOnly,
    /\.machine:before\{[^}]*top:18\.55%;left:8\.55%;width:80\.3%;height:5\.95%[^}]*background:#070402/,
  );
  assert.match(musicOnly, /class="reel left"><i class="reel-rotor"/);
  assert.match(musicOnly, /\.is-playing \.reel\{animation:none\}/);
  assert.match(musicOnly, /\.is-playing \.reel-rotor\{animation:spin/);
  assert.match(musicOnly, /Copyright Clearlight Creative 2026/);
  assert.match(musicOnly, /aspect-ratio:768\/1280/);
  assert.match(musicOnly, /\.ticker\{[^}]*contain:paint;isolation:isolate[^}]*background:#070402/);
  assert.match(musicOnly, /\.ticker span\{[^}]*transform:translate3d\(0,0,0\);backface-visibility:hidden\}/);
  assert.match(musicOnly, /\.is-awake \.ticker span\{animation:ticker 30s linear infinite\}/);
  assert.match(musicOnly, /@keyframes ticker\{from\{transform:translate3d\(0,0,0\)\}to\{transform:translate3d\(-100%,0,0\)\}\}/);
  assert.match(musicOnly, /id="nowPlayingMarquee"/);
  assert.match(musicOnly, /★ NOW PLAYING ★/);
  assert.match(musicOnly, /id="marqueeArtist" class="marquee-artist">VU Test Band<\/span>/);
  assert.match(musicOnly, /id="marqueeTrack" class="marquee-track">test track<\/div>/i);
  assert.match(musicOnly, /\.now-playing-marquee\{[^}]*top:54\.62%;left:18\.9%;width:69\.6%;height:4\.5%/);
  assert.match(musicOnly, /radial-gradient\(circle at 45% 42%,#fff6c5/);
  assert.doesNotMatch(musicOnly, /class="jukebox-title/);
  assert.match(musicOnly, /class="coin-art" src="\/assets\/aggits-coin-gold-v1\.png"/);
  assert.match(musicOnly, /id="characterCanvas"/);
  assert.doesNotMatch(musicOnly, /id="characterAudio"/);
  assert.match(musicOnly, /id="characterVideo"[^>]+playsinline[^>]+muted/);
  assert.match(musicOnly, /characterAudio=character/);
  assert.match(musicOnly, /src="\/assets\/aggits-vu-presenter-v1\.mp4"/);
  assert.match(musicOnly, /\.character\{right:-3\.5%;bottom:3%;width:40%;height:114%/);
  assert.match(musicOnly, /target="_blank" rel="noopener noreferrer"/);
  assert.equal((musicOnly.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 4);
  assert.match(musicOnly, /<script src="\/js\/analytics\.js"><\/script>/);
  assert.match(musicOnly, /new window\.DeepCutsAnalytics\.Tracker/);
  assert.match(musicOnly, /track\('discovery_page_viewed'/);
  assert.match(musicOnly, /track\('jookbox_coin_inserted'/);
  assert.match(musicOnly, /track\('outbound_clicked'/);
  assert.equal((musicOnly.match(/data-action-id="[^"]+" data-destination="[^"]*"/g) || []).length, 4);
  assert.match(musicOnly, /font:700 clamp\(12px,3\.4vw,26px\)/);
  assert.equal((musicOnly.match(/class="action"/g) || []).length, 4);
  assert.equal((musicOnly.match(/class="action-icon"/g) || []).length, 4);
  assert.match(musicOnly, /aggits-jukebox-button-bank-canonical-v2\.png/);
  assert.match(musicOnly, /\.actions:before\{[^}]*aggits-jukebox-button-bank-canonical-v2\.png[^}]*100% 100% no-repeat/);
  assert.doesNotMatch(musicOnly, /\.action:before\{/);
  assert.match(musicOnly, /\.action-icon\{[^}]*width:68%[^}]*opacity:1/);
  assert.doesNotMatch(musicOnly, /momentary-switch|switch-name|switch-body|switch-lever/);
  assert.doesNotMatch(musicOnly, /Twin VU needles respond/);

  const filenameFallback = renderMahoganyVuPreview(
    {
      ...toPreviewProject(project),
      input: { ...toPreviewProject(project).input, name: "DOSE" },
      vu: {
        ...toPreviewProject(project).vu,
        music: {
          ...toPreviewProject(project).vu.music,
          fileName: "DOSE - Talk Like That.mp3",
          trackName: "",
        },
      },
    },
    { musicUrl: "/music" },
  );
  assert.match(
    filenameFallback,
    /id="marqueeTrack" class="marquee-track">Talk Like That<\/div>/,
  );

  // Both Mahogany renderers consume the same locked, fully opaque UHD button
  // bank. The selected SVG glyph is the only per-destination visual layer.
  const canonicalButton = await fs.readFile(
    path.join(process.cwd(), AGGITS_JUKEBOX_CANONICAL_BUTTON_ASSET.slice(1)),
  );
  assert.equal(
    crypto.createHash("sha256").update(canonicalButton).digest("hex"),
    AGGITS_JUKEBOX_CANONICAL_BUTTON_SHA256,
  );
  assert.equal(AGGITS_JUKEBOX_CANONICAL_BUTTON_VERSION, "aggits-oval-button-bank/2");

  // The shared real recording and both media layers are armed in the trusted
  // coin gesture. Each media element receives exactly one initial play call,
  // stays silent while the coin completes, seeks to zero while still running,
  // and is then opened without a pause/restart false start.
  assert.match(musicOnly, /\/assets\/js\/jookbox-coin-audio\.js/);
  assert.match(musicOnly, /rel="preload" href="\/assets\/audio\/jukebox-real-coin-insert-cc0\.mp3"/);
  assert.match(musicOnly, /DeepCutsJookBoxCoinAudio\?\.create/);
  assert.match(musicOnly, /volume:1,gain:1\.15/);
  assert.match(musicOnly, /\.machine:after\{[^}]*z-index:20[^}]*opacity:\.7/);
  assert.match(musicOnly, /\.machine\.is-powering-up:after\{opacity:\.18\}/);
  assert.match(musicOnly, /\.machine\.is-awake:after\{opacity:0\}/);
  assert.match(musicOnly, /\.coin\{[^}]*z-index:30/);
  assert.match(musicOnly, /\.coin:after\{[^}]*content:'INSERT COIN  ▼'/);
  assert.match(musicOnly, /\.coin\.is-accepting:after,\.coin\.is-spent:after\{opacity:0\}/);
  assert.match(musicOnly, /drop-shadow\(0 0 19px #ff8a00\) brightness\(1\.28\)/);
  assert.match(musicOnly, /silenceMedia\(music\);silenceMedia\(characterAudio\);const coinPlayback=coinSound\.play\(\),preparation=prepare\(\),mediaArming=armMedia\(\)/);
  assert.ok(
    musicOnly.indexOf("coinSound.play()") < musicOnly.indexOf("preparation=prepare()"),
  );
  assert.ok(
    musicOnly.indexOf("mediaArming=armMedia()") < musicOnly.indexOf("await coinPlayback"),
  );
  assert.match(musicOnly, /await coinPlayback;await preparation;machine\.classList\.add\('is-powering-up'\)/);
  assert.match(musicOnly, /await delay\(startDelayMs\);const armed=await mediaArming;if\(armed\.some\(result=>result\.status==='rejected'\)\)throw new Error\('Media playback was blocked\.'\);const\{musicRewound,characterRewound\}=await rewindPlayingMedia\(\)/);
  assert.match(musicOnly, /const silenceMedia=media=>\{[^}]*media\.muted=true;media\.volume=0/);
  assert.doesNotMatch(musicOnly, /primeMedia/);
  assert.match(musicOnly, /const armMedia=\(\)=>Promise\.allSettled\(\[music,characterAudio\]\.filter\(Boolean\)\.map\(media=>mediaPlay\(media\)\)\)/);
  assert.doesNotMatch(musicOnly, /pauseArmedMedia|startMutedFromZero|rewindArmedMedia/);
  assert.equal(MAHOGANY_VU_START_DELAY_MS, 1100);
  assert.equal(MAHOGANY_VU_PRESENTER_GAIN, 1.4);
  assert.match(musicOnly, /characterGain\.gain\.setValueAtTime\(presenterGain,context\.currentTime\)/);
  assert.ok(musicOnly.indexOf("await coinPlayback") < musicOnly.indexOf("await delay(startDelayMs)"));
  assert.ok(musicOnly.indexOf("mediaArming=armMedia()") < musicOnly.indexOf("await coinPlayback"));
  assert.ok(musicOnly.indexOf("await delay(startDelayMs)") < musicOnly.indexOf("openOutputs()"));
  assert.ok(musicOnly.indexOf("rewindPlayingMedia()") < musicOnly.indexOf("openOutputs()"));
  assert.match(musicOnly, /if\(music&&music\.paused\)throw new Error\('Music playback was blocked\.'\)/);
  assert.match(musicOnly, /if\(!music&&characterAudio&&characterAudio\.paused\)throw new Error\('Presenter playback was blocked\.'\)/);
  assert.doesNotMatch(musicOnly, /if\(characterAudio&&characterAudio\.paused\)throw new Error\('Presenter playback was blocked\.'\)/);
  assert.match(musicOnly, /coin\.classList\.add\('is-spent'\)/);
  assert.match(musicOnly, /\.coin\.is-spent\{opacity:0\}/);
  assert.match(musicOnly, /coinInsert \.68s[^}]+forwards/);

  // The artist marquee accumulates genuine, forward playback only. Pauses and
  // seeks cannot advance the five-second reveal, and ignition occurs once.
  assert.equal(MAHOGANY_VU_MARQUEE_REVEAL_PLAYED_SECONDS, 5);
  assert.equal(MAHOGANY_VU_MARQUEE_FLICKER_MS, 1050);
  assert.match(musicOnly, /marqueeState!=='waiting'\|\|music\.paused\|\|music\.ended\|\|music\.seeking/);
  assert.match(musicOnly, /delta>0&&delta<=1\.25/);
  assert.match(musicOnly, /marqueePlayedSeconds>=marqueeRevealPlayedSeconds/);
  assert.match(musicOnly, /music\?\.addEventListener\('seeking',\(\)=>\{marqueeLastMediaTime=null\}\)/);
  assert.match(musicOnly, /marqueeState='illuminated'/);
  assert.match(musicOnly, /prefers-reduced-motion: reduce/);
  assert.match(musicOnly, /event\.preventDefault\(\);if\(action\.dataset\.enabled!=='true'\)return/);
  assert.match(musicOnly, /window\.open\(action\.href,'_blank'\)/);
  assert.match(musicOnly, /destinationTab\.opener=null/);

  // VAD rejects a click and one section produces one compact range.
  const oneSection = analysePresenterAudio(
    audioBuffer(5, [[1, 3]], [[0.4, 0.41]]),
  );
  assert.equal(oneSection.regions.length, 1);
  assert.equal(speechAtTime(oneSection.regions, 2), true);
  assert.equal(speechAtTime(oneSection.regions, 0.4), false);

  // 4/5/6. Several sections, tiny word gaps bridged, long silences separated.
  const several = analysePresenterAudio(
    audioBuffer(8, [
      [0.8, 1.5],
      [1.62, 2.3],
      [5.1, 6.2],
    ]),
  );
  assert.equal(several.regions.length, 2);
  assert.equal(speechAtTime(several.regions, 1.56), true);
  assert.equal(speechAtTime(several.regions, 3.5), false);

  const character = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("ftyp"),
    Buffer.alloc(8),
  ]);
  project = await storeMahoganyVuCharacter(
    root,
    project,
    character,
    "aggits-green-screen.mp4",
  );
  assert.equal(project.vu.ducking.analysis.status, "pending");
  project = setMahoganyVuDucking(project, {
    settings: DEFAULT_DUCKING_SETTINGS,
    analysis: {
      status: "complete",
      sourceSha256: project.vu.character.sha256,
      durationSeconds: several.durationSeconds,
      regions: several.regions,
    },
  });
  assert.equal(project.vu.ducking.analysis.status, "complete");

  // 3. MP3 + presenter uses the stored envelope and smooth gain ramps.
  const both = renderMahoganyVuPreview(toPreviewProject(project), {
    musicUrl: "/music",
    characterUrl: "/character",
  });
  assert.match(both, /speechRegions=\[\[/);
  assert.match(both, /linearRampToValueAtTime/);
  assert.match(both, /if\(speechRegions\.length\)return speechRegions\.some/);
  assert.match(both, /characterSpeechUntil=now\+speechHoldMs/);
  assert.match(both, /Number\(region\[1\]\)\+speechHoldMs\/1000/);
  assert.match(both, /speechHoldMs=1600/);
  assert.match(both, /green=g-Math\.max\(r,b\)/);
  assert.match(both, /minX=width,minY=height,maxX=-1,maxY=-1/);
  assert.match(both, /canvas\.width=300;canvas\.height=720/);

  // 7/8/9. Replay, pause/resume, seek and independent media endings are handled.
  assert.match(both, /if\(music\?\.ended\)music\.currentTime=0/);
  assert.match(both, /PAUSED — TAP THE EMPTY COIN SLOT TO RESUME/);
  assert.match(both, /characterAudio\?\.addEventListener\('seeked',sync\)/);
  assert.match(both, /characterAudio\?\.addEventListener\('ended'/);
  assert.match(both, /music\?\.addEventListener\('ended',sync\)/);
  assert.match(both, /document\.addEventListener\('visibilitychange'/);
  assert.match(both, /addEventListener\('beforeunload'/);
  assert.doesNotMatch(both, /addEventListener\('pagehide'/);

  // 2. Presenter only remains playable with no music or ducking gain node.
  project = await removeMahoganyVuMedia(root, project, "music");
  assert.equal(validateMahoganyProject(project).ready, true);
  const presenterOnly = renderMahoganyVuPreview(toPreviewProject(project), {
    characterUrl: "/character",
  });
  assert.doesNotMatch(presenterOnly, /id="music"/);
  assert.match(presenterOnly, /id="characterVideo"/);
  assert.match(presenterOnly, /if\(!music&&!characterAudio\)/);

  // Removal clears the presenter and its envelope without affecting the project.
  project = await removeMahoganyVuMedia(root, project, "character");
  assert.equal(project.vu.character.fileName, "");
  assert.equal(project.vu.ducking.analysis.status, "none");
  assert.equal(MAHOGANY_VU_RENDERER_VERSION, "mahogany-vu-jukebox/2026-08-11-v21");

  const cleanCabinetPath = path.join(
      process.cwd(),
      "assets",
      "aggits-jukebox-vu-master-v2.jpg",
    ),
    cleanCabinetBytes = await fs.readFile(cleanCabinetPath),
    cleanCabinetHash = crypto
      .createHash("sha256")
      .update(cleanCabinetBytes)
      .digest("hex"),
    cleanTickerPixels = await sharp(cleanCabinetBytes)
      .extract({ left: 95, top: 310, width: 740, height: 60 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  let brightTickerPixels = 0;
  for (let index = 0; index < cleanTickerPixels.data.length; index += 3) {
    const luminance =
      cleanTickerPixels.data[index] * 0.2126 +
      cleanTickerPixels.data[index + 1] * 0.7152 +
      cleanTickerPixels.data[index + 2] * 0.0722;
    if (luminance > 90) brightTickerPixels += 1;
  }
  assert.equal(
    cleanCabinetHash,
    "71d5f554d02db692aaeec81dfec13d2df988a431fcc30fdee72012ed239d2924",
  );
  assert.ok(
    brightTickerPixels / (cleanTickerPixels.info.width * cleanTickerPixels.info.height) <
      0.002,
    "the physical cabinet ticker window must contain no bright baked lettering",
  );

  const permanentPresenter = await fs.readFile(
    path.join(process.cwd(), "assets", "aggits-vu-presenter-v1.mp4"),
  );
  assert.equal(permanentPresenter.length, 12_860_992);
  assert.equal(
    crypto.createHash("sha256").update(permanentPresenter).digest("hex"),
    "1991d02acaf7884873c375af0f1f1ebd162c2fc0da98765707b43fefc014a0ea",
  );

  // The desktop API stores media independently, persists the envelope and removes safely.
  const server = createMahoganyStudioServer({
    root: process.cwd(),
    dataDir: path.join(root, "server-data"),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`,
      created = await fetch(`${origin}/api/mahogany/projects`, {
        method: "POST",
        body: "{}",
      }).then((response) => response.json()),
      id = created.project.id;
    let response = await fetch(`${origin}/api/mahogany/projects/${id}/music`, {
      method: "PUT",
      headers: { "x-file-name": "api-track.mp3" },
      body: mp3,
    });
    assert.equal(response.ok, true);
    response = await fetch(`${origin}/api/mahogany/projects/${id}/character`, {
      method: "PUT",
      headers: { "x-file-name": "api-presenter.mp4" },
      body: character,
    });
    let apiProject = (await response.json()).project;
    assert.equal(apiProject.vu.ducking.analysis.status, "pending");
    response = await fetch(`${origin}/api/mahogany/projects/${id}/analysis`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        settings: DEFAULT_DUCKING_SETTINGS,
        analysis: {
          status: "complete",
          sourceSha256: apiProject.vu.character.sha256,
          durationSeconds: 8,
          regions: several.regions,
        },
      }),
    });
    apiProject = (await response.json()).project;
    assert.equal(apiProject.vu.ducking.analysis.regions.length, 2);
    const preview = await fetch(
      `${origin}/api/mahogany/projects/${id}/preview`,
    ).then((item) => item.text());
    assert.match(preview, /speechRegions=\[\[/);
    assert.equal(
      (await fetch(`${origin}/api/mahogany/projects/${id}/music`, {
        method: "DELETE",
      })).ok,
      true,
    );
    const removed = await fetch(
      `${origin}/api/mahogany/projects/${id}/character`,
      { method: "DELETE" },
    ).then((item) => item.json());
    assert.equal(removed.project.vu.ducking.analysis.status, "none");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const liveQr = new Uint8Array(10001);
  liveQr[0] = 0x89;
  liveQr[1] = 0x50;
  await verifyMahoganyPublication(
    async (url, options = {}) => {
      const value = String(url);
      if (value.includes("/config"))
        return Response.json({
          bandName: "DOSE",
          publicURL: "https://deep-cuts.example/e/dc_0123456789",
          analytics: { editionId: "dc_0123456789" },
          aggitsJukebox: {
            appearanceVariant: "mahogany-vu",
            modelVersion: MAHOGANY_VU_RENDERER_VERSION,
            projectId: "studio_0123456789ab",
            title: "DOSE",
            tickerText: "DOSE NEW RELEASE",
            musicAudio: {
              fileName: "dose.mp3",
              sizeBytes: 4096,
              sha256: "a".repeat(64),
              mimeType: "audio/mpeg",
            },
            presenterVideo: {
              fileName: "",
              sizeBytes: 0,
              sha256: "",
              mimeType: "",
            },
            actions: [
              {
                slot: 1,
                iconId: "bandcamp",
                label: "Bandcamp",
                actionType: "web",
                href: "https://dose6.bandcamp.com/",
                openInNewTab: true,
              },
            ],
          },
        });
      if (value.endsWith("/music"))
        return new Response(null, {
          status: options.method === "HEAD" ? 200 : 405,
          headers: { "content-type": "audio/mpeg" },
        });
      if (value.includes("instagram-qr.png")) return new Response(liveQr);
      return new Response(
        `<title>DOSE</title><p>Mahogany VU Jukebox</p><meta content="${MAHOGANY_VU_RENDERER_VERSION}">`,
        {
          headers: { "x-deep-cuts-renderer": MAHOGANY_VU_RENDERER_VERSION },
        },
      );
    },
    {
      id: "ajjob_vu_verify",
      editionId: "dc_0123456789",
      liveUrl: "https://deep-cuts.example/e/dc_0123456789",
      qrImageUrl: "https://deep-cuts.example/output/dose/instagram-qr.png",
    },
    {
      projectId: "studio_0123456789ab",
      title: "DOSE",
      tickerText: "DOSE NEW RELEASE",
      appearance: "mahogany-vu",
      actions: [
        {
          slot: 1,
          iconId: "bandcamp",
          label: "Bandcamp",
          actionType: "web",
          href: "https://dose6.bandcamp.com/",
          openInNewTab: true,
        },
      ],
      vu: {
        music: {
          fileName: "dose.mp3",
          sizeBytes: 4096,
          sha256: "a".repeat(64),
          mimeType: "audio/mpeg",
        },
        character: {
          fileName: "",
          sizeBytes: 0,
          sha256: "",
          mimeType: "",
        },
      },
    },
  );

  const identityRoot = path.join(root, "identity-repair"),
    reused = normalizeMahoganyProject({
      ...newMahoganyProject(),
      id: "studio_f083c7920a07",
      name: "Dose",
      tickerText: "DOSE NEW RELEASE",
      appearance: "mahogany-vu",
      vu: {
        ...newMahoganyProject().vu,
        music: {
          fileName: "dose.mp3",
          sizeBytes: 4,
          sha256: "a".repeat(64),
          mimeType: "audio/mpeg",
        },
      },
      actions: [
        { slot: 1, iconId: "bandcamp", label: "Bandcamp", href: "https://dose6.bandcamp.com/track/talk-like-that" },
        { slot: 2, iconId: "shop", label: "Buy Music", href: "https://dose6.bandcamp.com/track/talk-like-that" },
        { slot: 3, iconId: "instagram", label: "Instagram", href: "https://instagram.com/thefakeaways/" },
        { slot: 4, iconId: "facebook", label: "Facebook", href: "https://facebook.com/thefakeaways/" },
      ],
      status: "failed",
      publication: {
        editionId: "dc_ddcf25be18",
        liveUrl: "https://deep-cuts.example/e/dc_ddcf25be18",
        published: true,
      },
    });
  await saveMahoganyProject(identityRoot, reused);
  await fs.writeFile(path.join(identityRoot, reused.id, "music.mp3"), "DOSE");
  const repairedIdentity = await repairReusedPublicationIdentity(
    identityRoot,
    reused,
    {
      fetchImpl: async (url) => {
        if (String(url).includes("/config"))
          return Response.json({
            bandName: "The Fakeaways",
            aggitsJukebox: {
              projectId: reused.id,
              appearanceVariant: "aggits-jukebox-oval-master/4",
              tickerText: "FAKEAWAYS TICKER",
              videoKind: "youtube",
              youtubeUrl: "https://www.youtube.com/watch?v=NJNp6DnAAIo",
              actions: [
                { iconId: "bandcamp", label: "Bandcamp", href: "https://kimsalmon.bandcamp.com/" },
                { iconId: "youtube", label: "YouTube", href: "https://youtu.be/7HjsnuLkYp0" },
                { iconId: "instagram", label: "Instagram", href: "https://instagram.com/thefakeaways/" },
                { iconId: "facebook", label: "Facebook", href: "https://facebook.com/thefakeaways/" },
              ],
            },
          });
        return new Response(
          '<a href="https://www.instagram.com/dose.dirtrock/">Instagram</a><a href="/contact?b=2895015149&amp;n=DOSE">Contact</a>',
        );
      },
    },
  );
  assert.notEqual(repairedIdentity.project.id, reused.id);
  assert.equal(repairedIdentity.project.name, "Dose");
  assert.equal(repairedIdentity.identityRepair.restoredProject.name, "The Fakeaways");
  assert.equal(
    repairedIdentity.project.actions[2].href,
    "https://www.instagram.com/dose.dirtrock/",
  );
  assert.equal(repairedIdentity.project.actions[3].iconId, "contact");
  assert.match(repairedIdentity.project.actions[3].href, /dose6\.bandcamp\.com\/contact/);
  assert.equal(
    await fs.readFile(
      path.join(identityRoot, repairedIdentity.project.id, "music.mp3"),
      "utf8",
    ),
    "DOSE",
  );
  const studioServerSource = await fs.readFile(
    path.join(process.cwd(), "scripts", "mahogany-studio-server.mjs"),
    "utf8",
  );
  assert.match(studioServerSource, /const publicationProjectId = project\.id/);
  assert.match(
    studioServerSource,
    /publicationProjectId,[\s\S]*?"music\.mp3"/,
  );
  assert.match(
    studioServerSource,
    /path\.join\([\s\S]*projectRoot,[\s\S]*publicationProjectId,[\s\S]*"character\.mp4",[\s\S]*\)/,
  );

  console.log("Mahogany VU Jukebox audio-ducking and live-verification tests passed.");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
