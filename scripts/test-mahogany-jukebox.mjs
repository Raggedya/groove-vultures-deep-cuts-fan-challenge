import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  createAggitsJukeboxQrArtwork,
  AGGITS_JUKEBOX_QR_PANEL,
} from "./aggits-jukebox-qr-artwork.mjs";
import {
  MAHOGANY_FIXED_MARQUEE,
  MAHOGANY_RENDERER_VERSION,
  MAHOGANY_FIXED_MARQUEE_ASSET,
  MAHOGANY_FIXED_MARQUEE_SHA256,
  MAHOGANY_OVAL_CABINET_ASSET,
  MAHOGANY_OVAL_CABINET_SHA256,
  MAHOGANY_BUTTON_CLUNK_ASSET,
  MAHOGANY_SECRET_OPEN_MOTOR_ASSET,
  MAHOGANY_SECRET_CLOSE_MOTOR_ASSET,
  MAHOGANY_BUTTON_LINK_DELAY_MS,
  MAHOGANY_AGGITS_COIN_ASSET,
  MAHOGANY_AGGITS_COIN_SHA256,
  renderAggitsJukeboxStudioPreview,
} from "./aggits-jukebox-preview.mjs";
import { createMahoganyStudioServer } from "./mahogany-studio-server.mjs";
import {
  buildMahoganyManifest,
  MAHOGANY_SKIN_HEIGHT,
  MAHOGANY_SKIN_WIDTH,
  newMahoganyProject,
  normalizeMahoganyProject,
  toPreviewProject,
  validateMahoganyProject,
} from "./mahogany-jukebox-model.mjs";
import {
  MAHOGANY_LEGACY_LAYOUT_ID,
  MAHOGANY_MASTER_LAYOUT,
  MAHOGANY_MASTER_LAYOUT_ID,
  MAHOGANY_LOCKED_TIMING,
  mahoganyGeometrySnapshot,
} from "./mahogany-jukebox-layout.mjs";
import {
  MAHOGANY_SECRET_SCREEN_STATES,
  transitionMahoganySecretScreen,
} from "./mahogany-secret-screen-state.mjs";
import {
  MAHOGANY_SKIN_SCHEMA,
  validateMahoganySkinDefinition,
} from "./mahogany-jukebox-skin-schema.mjs";

const root = process.cwd(),
  desktopMainSource = await fs.readFile(
    path.join(root, "studio", "mahogany-desktop-main.mjs"),
    "utf8",
  ),
  windowsBuilderSource = await fs.readFile(
    path.join(root, "scripts", "build-mahogany-jukebox-windows.mjs"),
    "utf8",
  ),
  studioHtmlSource = await fs.readFile(
    path.join(root, "mahogany-studio", "index.html"),
    "utf8",
  ),
  studioStylesSource = await fs.readFile(
    path.join(root, "mahogany-studio", "styles.css"),
    "utf8",
  ),
  sample = normalizeMahoganyProject({
    ...newMahoganyProject(),
    name: "Savage Garden",
    tickerText: "SAVAGE GARDEN — LISTEN, WATCH AND DISCOVER.",
    video: {
      kind: "youtube",
      youtubeUrl: "https://www.youtube.com/watch?v=4QK0RZ0FQ_0",
      embedStatus: "playable",
      embedVideoId: "4QK0RZ0FQ_0",
      embedCheckedAt: new Date().toISOString(),
    },
    actions: [
      {
        iconId: "spotify",
        label: "Spotify",
        href: "https://open.spotify.com/artist/example",
      },
      {
        iconId: "youtube",
        label: "YouTube",
        href: "https://youtube.com/@example",
      },
      {
        iconId: "instagram",
        label: "Instagram",
        href: "https://instagram.com/example",
      },
      {
        iconId: "facebook",
        label: "Facebook",
        href: "https://facebook.com/example",
      },
    ],
  });
assert.match(desktopMainSource, /json\.icons\.length !== 173/);
assert.match(windowsBuilderSource, /--user-data-dir=\$\{smokeProfile\}/);
assert.ok(
  studioHtmlSource.indexOf('value="mp4"') < studioHtmlSource.indexOf('value="youtube"'),
  "Upload MP4 must be presented before YouTube",
);
assert.match(studioHtmlSource, /value="mp4"[\s\S]{0,100}checked/);
assert.match(
  studioStylesSource,
  /\.icon-picker\s*\{[\s\S]*?width:\s*62px;[\s\S]*?height:\s*82px;[\s\S]*?border-radius:\s*50%\s*\/\s*48%;/,
  "the four selected Studio icons must use the new physical oval-key treatment",
);
assert.match(
  studioStylesSource,
  /\.icon-option\s*\{[\s\S]*?width:\s*104px;[\s\S]*?height:\s*142px;[\s\S]*?border-radius:\s*50%\s*\/\s*47%;/,
  "the icon selector catalogue must present the approved icons as matching oval keys",
);
assert.match(
  studioStylesSource,
  /\.icon-option-art\s*\{[\s\S]*?width:\s*72%;/,
  "selector icons must remain centred within the oval bezel",
);
assert.equal(newMahoganyProject().video.kind, "mp4");
assert.equal(newMahoganyProject().skin.kind, "default");
assert.equal(newMahoganyProject().layoutProfile, MAHOGANY_MASTER_LAYOUT_ID);
assert.equal(MAHOGANY_MASTER_LAYOUT.width, 941);
assert.equal(MAHOGANY_MASTER_LAYOUT.height, 1672);
const measuredPhysicalActionCentres = [199, 377, 564, 739];
MAHOGANY_MASTER_LAYOUT.slots.actionKeys.forEach((slot, index) => {
  const renderedCentre =
    ((slot.left + slot.width / 2) / 100) * MAHOGANY_MASTER_LAYOUT.width;
  assert.ok(
    Math.abs(renderedCentre - measuredPhysicalActionCentres[index]) <= 0.01,
    `action ${index + 1} must share the measured physical oval centre`,
  );
});
assert.equal(MAHOGANY_LOCKED_TIMING.coinInsertMs, 620);
assert.equal(MAHOGANY_LOCKED_TIMING.secretScreenTravelMs, 3000);
assert.equal(MAHOGANY_LOCKED_TIMING.reducedSecretScreenTravelMs, 180);
assert.equal(MAHOGANY_LOCKED_TIMING.outboundDelayMs, 500);
assert.equal(
  mahoganyGeometrySnapshot().canonical,
  JSON.stringify({
    id: MAHOGANY_MASTER_LAYOUT.id,
    width: MAHOGANY_MASTER_LAYOUT.width,
    height: MAHOGANY_MASTER_LAYOUT.height,
    slots: MAHOGANY_MASTER_LAYOUT.slots,
    timing: MAHOGANY_LOCKED_TIMING,
  }),
);
const strictSkin = {
  schemaVersion: MAHOGANY_SKIN_SCHEMA,
  kind: "custom",
  layoutProfile: MAHOGANY_MASTER_LAYOUT_ID,
  fileName: "master.png",
  storageFileName: "skin.png",
  format: "png",
  mimeType: "image/png",
  width: 941,
  height: 1672,
  sizeBytes: 4096,
  sha256: "a".repeat(64),
};
assert.equal(
  validateMahoganySkinDefinition(strictSkin, { allowLegacy: false }).valid,
  true,
);
assert.equal(
  validateMahoganySkinDefinition(
    { ...strictSkin, width: 940 },
    { allowLegacy: false },
  ).valid,
  false,
);
assert.equal(
  validateMahoganySkinDefinition(
    { ...strictSkin, videoTop: 20 },
    { allowLegacy: false },
  ).valid,
  false,
  "skin metadata must not be able to alter fixed geometry",
);
assert.equal(
  normalizeMahoganyProject({ name: "Preserved legacy project" }).layoutProfile,
  MAHOGANY_LEGACY_LAYOUT_ID,
  "stored projects without a layout profile must keep the preserved 864 × 1536 renderer",
);
const checked = validateMahoganyProject(sample);
assert.equal(checked.ready, true, checked.errors.join(" "));
const uncheckedYouTube = normalizeMahoganyProject({
  ...sample,
  video: {
    kind: "youtube",
    youtubeUrl: sample.video.youtubeUrl,
  },
});
assert.equal(validateMahoganyProject(uncheckedYouTube).ready, false);
assert.match(
  validateMahoganyProject(uncheckedYouTube).errors.join(" "),
  /publish to verify that YouTube allows/i,
);
const manifest = buildMahoganyManifest(sample);
assert.equal(manifest.actions.length, 4);
assert.equal(manifest.video.kind, "youtube");
assert.equal(manifest.schemaVersion, "deep-cuts-mahogany-jukebox-publication/3");
assert.equal(manifest.video.embedStatus, "playable");
assert.equal(manifest.layoutProfile, MAHOGANY_MASTER_LAYOUT_ID);
assert.match(manifest.video.sha256, /^[a-f0-9]{64}$/);
const preview = renderAggitsJukeboxStudioPreview(toPreviewProject(sample), {
  youtubeUrl: sample.video.youtubeUrl,
});
const secretPreview = renderAggitsJukeboxStudioPreview(
  toPreviewProject(
    normalizeMahoganyProject({
      ...sample,
      secretVideo: {
        fileName: "concealed.mp4",
        mimeType: "video/mp4",
        sizeBytes: 4096,
        sha256: "b".repeat(64),
        storageName: `secret-video-${"b".repeat(64)}.mp4`,
        loop: false,
        updatedAt: new Date().toISOString(),
      },
    }),
  ),
  {
    youtubeUrl: sample.video.youtubeUrl,
    secretVideoUrl: "/assets/test/concealed.mp4",
  },
);
assert.match(preview, /MAHOGANY JUKEBOX/);
assert.equal(MAHOGANY_FIXED_MARQUEE, "AGGITS");
assert.equal(
  MAHOGANY_RENDERER_VERSION,
  "mahogany-jukebox/2026-08-21-v16-concealed-screen-toggle",
);
assert.match(
  preview,
  /<meta name="deep-cuts-renderer" content="mahogany-jukebox\/2026-08-21-v16-concealed-screen-toggle">/,
);
assert.match(
  preview,
  /data-renderer-version="mahogany-jukebox\/2026-08-21-v16-concealed-screen-toggle"/,
);
assert.match(preview, /data-skin-profile="master-structure\/1"/);
assert.equal(MAHOGANY_FIXED_MARQUEE_ASSET, "/assets/aggits-marquee-reference-v1.jpg");
assert.match(MAHOGANY_FIXED_MARQUEE_SHA256, /^[a-f0-9]{64}$/);
assert.equal(
  crypto.createHash("sha256").update(await fs.readFile(path.join(root, MAHOGANY_FIXED_MARQUEE_ASSET.slice(1)))).digest("hex"),
  MAHOGANY_FIXED_MARQUEE_SHA256,
);
assert.equal(MAHOGANY_OVAL_CABINET_ASSET, "/assets/aggits-jukebox-illuminated-master-v3.png");
assert.equal(
  crypto.createHash("sha256").update(await fs.readFile(path.join(root, MAHOGANY_OVAL_CABINET_ASSET.slice(1)))).digest("hex"),
  MAHOGANY_OVAL_CABINET_SHA256,
);
assert.match(preview, /aggits-jukebox-illuminated-master-v3\.png/);
assert.doesNotMatch(preview, /id="titleText"/);
assert.match(preview, /is-neon-starting/);
assert.match(preview, /is-neon-illuminated:before\{opacity:\.3\}/);
assert.match(preview, /animation:neonStartup 2240ms linear both/);
assert.match(preview, /66%,76%\{opacity:1\}100%\{opacity:\.3\}/);
assert.match(preview, /reducedMotion\?180:2240/);
assert.match(preview, /id="secretControl"/);
assert.match(
  secretPreview,
  /<video id="secretVideo" controls preload="metadata" playsinline webkit-playsinline src="\/assets\/test\/concealed\.mp4"/,
);
assert.match(
  secretPreview,
  /id="secretControl"[^>]*aria-expanded="false"[^>]*aria-busy="false"[^>]*aria-disabled="false"/,
);
assert.doesNotMatch(secretPreview, /id="secretControl"[^>]* disabled/);
assert.match(preview, /is-secret-opening/);
assert.match(preview, /is-secret-open/);
assert.match(preview, /is-secret-closing/);
assert.doesNotMatch(preview, /is-secret-playing/);
assert.match(preview, /transition:transform 3000ms/);
assert.match(preview, /transition-duration:180ms/);
assert.match(preview, /aria-busy="false"/);
assert.match(preview, /secretVideo\?\.addEventListener\("ended",\(\)=>requestSecretClose/);
assert.match(preview, /document\.hidden&&secretState!=="closed"\)requestSecretClose/);
assert.match(preview, /event\.propertyName==="transform"/);
assert.match(preview, /if\(!event\.repeat\)toggleSecret\(\)/);
assert.equal(MAHOGANY_SECRET_SCREEN_STATES.join(","), "closed,opening,open,closing");
assert.equal(transitionMahoganySecretScreen("closed", "TOGGLE"), "opening");
assert.equal(transitionMahoganySecretScreen("opening", "TOGGLE"), "opening");
assert.equal(transitionMahoganySecretScreen("opening", "ARRIVE"), "open");
assert.equal(transitionMahoganySecretScreen("open", "TOGGLE"), "closing");
assert.equal(transitionMahoganySecretScreen("closing", "TOGGLE"), "closing");
assert.equal(transitionMahoganySecretScreen("closing", "ARRIVE"), "closed");
assert.equal(transitionMahoganySecretScreen("open", "RESET"), "closed");
assert.equal(MAHOGANY_SECRET_OPEN_MOTOR_ASSET, "/assets/audio/jukebox-screen-motor-open-original.wav");
assert.equal(MAHOGANY_SECRET_CLOSE_MOTOR_ASSET, "/assets/audio/jukebox-screen-motor-close-original.wav");
assert.ok((await fs.stat(path.join(root, MAHOGANY_SECRET_OPEN_MOTOR_ASSET.slice(1)))).size > 100000);
assert.ok((await fs.stat(path.join(root, MAHOGANY_SECRET_CLOSE_MOTOR_ASSET.slice(1)))).size > 100000);
assert.match(preview, /youtube-nocookie\.com\/embed\/4QK0RZ0FQ_0/);
assert.match(preview, /jukebox-real-coin-insert-cc0\.mp3/);
assert.match(preview, /coinInsert/);
assert.equal(MAHOGANY_AGGITS_COIN_ASSET, "/assets/aggits-coin-gold-v1.png");
assert.equal(
  crypto.createHash("sha256").update(await fs.readFile(path.join(root, MAHOGANY_AGGITS_COIN_ASSET.slice(1)))).digest("hex"),
  MAHOGANY_AGGITS_COIN_SHA256,
);
assert.match(preview, /class="coin-art"/);
assert.match(preview, /aggits-coin-gold-v1\.png/);
assert.match(preview, /--coin-left:16\.7%;--coin-width:9\.4%/);
assert.match(preview, /translateX\(-56%\) rotateY\(88deg\)/);
assert.doesNotMatch(preview, /content:"\$"/);
assert.match(preview, /is-depressed/);
assert.match(preview, /actions\.forEach\(candidate=>candidate\.classList\.toggle\("is-depressed",candidate===action\)\)/);
assert.match(preview, /jukebox-mechanical-button-clunk-public-domain\.ogg/);
assert.match(preview, /--video-top:28\.17%;--video-left:26\.89%;--video-width:57\.92%;--video-height:32\.36%;--video-radius:3\.7%/);
assert.match(preview, /clip-path:inset\(0 round var\(--video-radius\)\)/);
assert.match(preview, /\.video video,\.video iframe,\.secret-compartment video\{[^}]*border-radius:inherit/);
assert.match(preview, /--actions-top:65\.55%;--actions-left:0%;--actions-width:100%;--actions-height:16\.9%/);
assert.match(preview, /--action-1-left:12\.1477%;--action-1-width:18%/);
assert.match(preview, /--action-4-left:69\.5335%;--action-4-width:18%/);
assert.match(preview, /\.machine\.is-fixed-action-layout \.action:nth-child\(1\)\{top:var\(--action-1-top\);left:var\(--action-1-left\);width:var\(--action-1-width\);height:var\(--action-1-height\)\}/);
assert.match(preview, /\.machine\.is-fixed-action-layout \.action\{position:absolute;padding:0\}/);
assert.match(preview, /aggits-jukebox-icons-oval-v6\/spotify\.svg/);
assert.match(preview, /\.action-icon img\{[^}]*width:100%;height:100%/);
assert.match(preview, /\.action-icon\{[^}]*top:50%;left:50%;width:40%;height:34%[^}]*transform:translate\(-50%,-50%\)/);
assert.match(preview, /\.action-icon img\{[^}]*object-position:50% 50%/);
assert.match(preview, /\.action\.is-depressed \.action-icon\{transform:translate\(-50%,calc\(-50% \+ 2px\)\)\}/);
assert.match(preview, /\.action\{[^}]*filter:brightness\(\.62\) saturate\(\.72\);opacity:\.86/);
assert.doesNotMatch(preview, /solid transparent/);
assert.doesNotMatch(preview, /is-label-medium/);
assert.doesNotMatch(preview, /<strong>Spotify<\/strong>/);
assert.doesNotMatch(preview, /\.action:before/);
assert.doesNotMatch(preview, /bass|AnalyserNode|createAnalyser|attention-flash|is-attention-flash|requestVideoFrameCallback/i);
const inlineScripts = [...preview.matchAll(/<script(?: nonce="[^"]*")?>([\s\S]*?)<\/script>/g)];
assert.ok(inlineScripts.length > 0, "preview should include its runtime script");
assert.doesNotThrow(
  () => new Function(inlineScripts.at(-1)[1]),
  "generated jukebox runtime script should compile",
);
assert.match(preview, /\.actions\{[^}]*background:transparent/);
assert.doesNotMatch(preview, /\.actions:before/);
assert.equal(MAHOGANY_BUTTON_LINK_DELAY_MS, 500);
assert.match(MAHOGANY_BUTTON_CLUNK_ASSET, /mechanical-button-clunk/);
assert.equal((preview.match(/class="action"/g) || []).length, 4);
assert.equal(
  (preview.match(/data-new-tab="true"/g) || []).length,
  4,
  "all four physical destination keys must preserve the Jukebox in its original tab",
);
assert.equal(
  (preview.match(/\(opens in a new tab\)/g) || []).length,
  4,
  "all four keys must announce their new-tab behaviour",
);
assert.match(preview, /window\.open\("about:blank","_blank"\)/);
assert.match(preview, /outboundWindow\.opener=null/);
assert.match(preview, /outbound\.rel="noopener noreferrer"/);
assert.match(preview, /outbound\.target="_self"/);
assert.match(preview, /outboundWindow\.closed/);
assert.notEqual(
  AGGITS_JUKEBOX_QR_PANEL.topLeft.x,
  AGGITS_JUKEBOX_QR_PANEL.bottomLeft.x,
  "QR left edge must preserve photographed perspective",
);
assert.notEqual(
  AGGITS_JUKEBOX_QR_PANEL.topRight.x,
  AGGITS_JUKEBOX_QR_PANEL.bottomRight.x,
  "QR right edge must preserve photographed perspective",
);
const qr = await createAggitsJukeboxQrArtwork({
  root,
  title: "Savage Garden",
  destination: "https://deep-cuts.andrewharris501.workers.dev/q/dc_0123456789",
});
assert.equal(qr.width, 1254);
assert.equal(qr.height, 1254);
assert.equal(qr.scanProof, "perspective-matrix:1254+627;decoder:360-required");
assert.ok(qr.bytes.length > 100000);
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "mahogany-test-"));
const fakePublisher = {
  async authentication() {
    return { available: true, state: "active" };
  },
  async prepare({ project }) {
    return {
      schemaVersion: "deep-cuts-mahogany-jukebox-publication/3",
      manifest: buildMahoganyManifest(project),
      job: {
        id: "ajjob_test",
        editionId: "dc_0123456789",
        slug: "aggits-jukebox-test",
        liveUrl: "https://deep-cuts.example/e/dc_0123456789",
        qrImageUrl:
          "https://deep-cuts.example/output/aggits-jukebox-test/instagram-qr.png",
      },
      qrPayload: qr.destination,
      qrBytes: qr.bytes,
      qrSha256: qr.sha256,
      qrScanProof: qr.scanProof,
      editionId: "dc_0123456789",
      slug: "aggits-jukebox-test",
      liveUrl: "https://deep-cuts.example/e/dc_0123456789",
      qrImageUrl:
        "https://deep-cuts.example/output/aggits-jukebox-test/instagram-qr.png",
    };
  },
  async accept({ onProgress = async () => {} } = {}) {
    await onProgress("publishing", "Publishing the permanent Jukebox");
    await onProgress("delivery", "Waiting for confirmed email delivery");
    return {
      schemaVersion: "deep-cuts-mahogany-jukebox-publication/3",
      editionId: "dc_0123456789",
      slug: "aggits-jukebox-test",
      liveUrl: "https://deep-cuts.example/e/dc_0123456789",
      qrImageUrl:
        "https://deep-cuts.example/output/aggits-jukebox-test/instagram-qr.png",
      jobId: "ajjob_test",
      published: true,
    };
  },
  async setPublished({ published }) {
    return {
      editionId: "dc_0123456789",
      slug: "aggits-jukebox-test",
      liveUrl: "https://deep-cuts.example/e/dc_0123456789",
      qrImageUrl:
        "https://deep-cuts.example/output/aggits-jukebox-test/instagram-qr.png",
      published,
    };
  },
  async rollback() {},
};
const server = createMahoganyStudioServer({
  root,
  dataDir: temporary,
  publisher: fakePublisher,
  async bandCandidateRunner({ projectRoot, onProgress }) {
    await onProgress({
      stage: "qualifying",
      message: "Verifying fixture candidates.",
      reviewed: 1,
      qualified: 0,
      rejected: 1,
    });
    const project = await import("./mahogany-jukebox-model.mjs").then(
      ({ saveMahoganyProject }) =>
        saveMahoganyProject(projectRoot, {
          ...newMahoganyProject(),
          name: "Verified Fixture Band",
          candidate: {
            kind: "band",
            source: "automatic_batch",
            status: "verified",
            confidence: 100,
          },
        }),
    );
    await onProgress({
      stage: "completed_with_shortfall",
      message: "One fixture candidate passed.",
      reviewed: 2,
      qualified: 1,
      rejected: 1,
    });
    return {
      requested: 10,
      qualified: 1,
      rejected: 1,
      reviewed: 2,
      shortfall: 9,
      projectIds: [project.id],
    };
  },
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
try {
  const origin = `http://127.0.0.1:${server.address().port}`,
    [page, bootstrap] = await Promise.all([
      fetch(`${origin}/mahogany-studio/`),
      fetch(`${origin}/api/mahogany/bootstrap`),
    ]),
    [html, data] = await Promise.all([page.text(), bootstrap.json()]);
  assert.equal(page.ok, true);
  assert.match(html, /Four physical action keys/);
  assert.equal(data.icons.length, 173);
  assert.ok(data.icons.some((icon) => icon.id === "bandcamp"));
  const candidateStart = await fetch(
    `${origin}/api/mahogany/candidate-batches/bands`,
    { method: "POST" },
  ).then((response) => response.json());
  assert.match(candidateStart.job.id, /^candidate_[a-f0-9]{16}$/);
  let candidateJob = candidateStart.job;
  for (let attempt = 0; attempt < 30 && candidateJob.status === "running"; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    candidateJob = await fetch(
      `${origin}/api/mahogany/candidate-batches/${candidateJob.id}`,
    ).then((response) => response.json()).then((value) => value.job);
  }
  assert.equal(candidateJob.status, "completed");
  assert.equal(candidateJob.result.qualified, 1);
  const created = await fetch(`${origin}/api/mahogany/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }).then((response) => response.json());
  assert.match(created.project.id, /^studio_[a-f0-9]{12}$/);
  const updated = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sample),
    },
  ).then((response) => response.json());
  assert.equal(updated.project.name, "Savage Garden");
  const skinBytes = await sharp({
    create: {
      width: 941,
      height: 1672,
      channels: 4,
      background: { r: 45, g: 22, b: 10, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const skinned = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/skin`,
    {
      method: "PUT",
      headers: {
        "content-type": "image/png",
        "x-file-name": encodeURIComponent("fixture-skin.png"),
      },
      body: skinBytes,
    },
  ).then((response) => response.json());
  assert.equal(skinned.project.skin.kind, "custom");
  assert.equal(skinned.project.skin.width, MAHOGANY_SKIN_WIDTH);
  assert.equal(skinned.project.skin.height, MAHOGANY_SKIN_HEIGHT);
  assert.match(skinned.project.skin.sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    validateMahoganyProject(skinned.project, { requireStoredSkin: true }).ready,
    true,
  );
  const storedSkin = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/skin`,
  );
  assert.equal(storedSkin.ok, true);
  assert.equal(storedSkin.headers.get("content-type"), "image/png");
  const storedSkinMetadata = await sharp(
    Buffer.from(await storedSkin.arrayBuffer()),
  ).metadata();
  assert.equal(storedSkinMetadata.width, MAHOGANY_SKIN_WIDTH);
  assert.equal(storedSkinMetadata.height, MAHOGANY_SKIN_HEIGHT);
  const rendered = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/preview`,
  ).then((response) => response.text());
  assert.match(rendered, /SAVAGE GARDEN/);
  assert.match(rendered, /Mahogany Jukebox preview/);
  assert.match(rendered, new RegExp(`/api/mahogany/projects/${created.project.id}/skin\\?v=`));
  const secondCreated = await fetch(`${origin}/api/mahogany/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }).then((response) => response.json());
  await fetch(`${origin}/api/mahogany/projects/${secondCreated.project.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...sample, name: "Different Skin Fixture" }),
  });
  const secondSkinBytes = await sharp({
    create: {
      width: 941,
      height: 1672,
      channels: 4,
      background: { r: 8, g: 44, b: 71, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  await fetch(
    `${origin}/api/mahogany/projects/${secondCreated.project.id}/skin`,
    {
      method: "PUT",
      headers: {
        "content-type": "image/png",
        "x-file-name": encodeURIComponent("unrelated-blue-skin.png"),
      },
      body: secondSkinBytes,
    },
  );
  const secondRendered = await fetch(
    `${origin}/api/mahogany/projects/${secondCreated.project.id}/preview`,
  ).then((response) => response.text());
  const geometryStyle = rendered.match(/<section id="machine"[^>]*style="([^"]+)"/u)?.[1];
  const secondGeometryStyle = secondRendered.match(
    /<section id="machine"[^>]*style="([^"]+)"/u,
  )?.[1];
  assert.ok(geometryStyle, "first materially different skin must expose canonical geometry");
  assert.equal(
    secondGeometryStyle,
    geometryStyle,
    "materially different skins must render through pixel-identical fixed geometry",
  );
  assert.match(secondRendered, /data-skin-profile="master-structure\/1"/);
  const prepared = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/create`,
    { method: "POST" },
  ).then((response) => response.json());
  assert.equal(prepared.project.status, "prepared");
  assert.equal(prepared.project.prepared.editionId, "dc_0123456789");
  const qrResponse = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/qr`,
  );
  assert.equal(qrResponse.ok, true);
  assert.match(qrResponse.headers.get("content-type"), /image\/png/);
  const accepted = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/accept`,
    { method: "POST" },
  ).then((response) => response.json());
  assert.equal(accepted.project.status, "published");
  assert.equal(
    accepted.project.publication.liveUrl,
    "https://deep-cuts.example/e/dc_0123456789",
  );
  const unpublished = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/state`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ published: false }),
    },
  ).then((response) => response.json());
  assert.equal(unpublished.project.status, "unpublished");
  assert.equal(unpublished.project.publication.editionId, "dc_0123456789");
  const republished = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/publish`,
    { method: "POST" },
  ).then((response) => response.json());
  assert.equal(republished.project.status, "published");
  assert.equal(republished.project.publicationProgress.stage, "completed");
  assert.match(
    republished.project.publicationProgress.message,
    /delivered by email/i,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporary, { recursive: true, force: true });
}
const studioCss = await fs.readFile(
  path.join(root, "mahogany-studio", "styles.css"),
  "utf8",
);
assert.match(studioCss, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
const studioApp = await fs.readFile(
  path.join(root, "mahogany-studio", "app.js"),
  "utf8",
);
assert.match(studioApp, /youtube\.com\/iframe_api/);
assert.match(studioApp, /event\.data === 101 \|\| event\.data === 150/);
assert.match(studioApp, /Embedding allowed/);
assert.match(studioApp, /\/publish`/);
assert.match(studioApp, /scheduleAutosave/);
assert.doesNotMatch(studioApp, /function acceptProduction/);
const studioHtml = await fs.readFile(
  path.join(root, "mahogany-studio", "index.html"),
  "utf8",
);
assert.match(studioHtml, /CREATE, PUBLISH &amp; EMAIL/);
assert.match(studioHtml, /ADD 10 BANDS/);
assert.match(studioHtml, /ADD 10 BUSINESSES/);
assert.match(studioHtml, /Cabinet skin/);
assert.match(studioHtml, /941 × 1672/);
assert.match(studioHtml, /Upload skin image/);
assert.match(
  studioApp,
  /Custom cabinet skin validated at \$\{state\.project\.skin\.width\} × \$\{state\.project\.skin\.height\}\. Mahogany geometry and functionality are unchanged\./,
);
assert.match(studioApp, /Mahogany Master cabinet restored\./);
assert.doesNotMatch(studioHtml, /Save draft/);
assert.doesNotMatch(studioHtml, /Accept &amp; publish/);
console.log(
  "Mahogany Jukebox model, locked renderer, perspective QR and local server tests passed.",
);
