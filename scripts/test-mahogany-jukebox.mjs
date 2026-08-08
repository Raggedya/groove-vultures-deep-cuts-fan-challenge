import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
  MAHOGANY_BUTTON_LINK_DELAY_MS,
  MAHOGANY_BUTTON_ATTENTION_START_SECONDS,
  MAHOGANY_BUTTON_ATTENTION_FLASH_SECONDS,
  MAHOGANY_BUTTON_ATTENTION_BUTTON_COUNT,
  MAHOGANY_BUTTON_ATTENTION_CYCLES,
  MAHOGANY_BUTTON_ATTENTION_END_SECONDS,
  MAHOGANY_AGGITS_COIN_ASSET,
  MAHOGANY_AGGITS_COIN_SHA256,
  mahoganyButtonAttentionIndex,
  isMahoganyButtonAttentionTime,
  renderAggitsJukeboxStudioPreview,
} from "./aggits-jukebox-preview.mjs";
import { createMahoganyStudioServer } from "./mahogany-studio-server.mjs";
import {
  buildMahoganyManifest,
  newMahoganyProject,
  normalizeMahoganyProject,
  toPreviewProject,
  validateMahoganyProject,
} from "./mahogany-jukebox-model.mjs";

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
assert.match(desktopMainSource, /json\.icons\.length !== 111/);
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
assert.equal(manifest.schemaVersion, "deep-cuts-mahogany-jukebox-publication/2");
assert.equal(manifest.video.embedStatus, "playable");
assert.match(manifest.video.sha256, /^[a-f0-9]{64}$/);
const preview = renderAggitsJukeboxStudioPreview(toPreviewProject(sample), {
  youtubeUrl: sample.video.youtubeUrl,
});
assert.match(preview, /MAHOGANY JUKEBOX/);
assert.equal(MAHOGANY_FIXED_MARQUEE, "AGGITS");
assert.equal(MAHOGANY_RENDERER_VERSION, "mahogany-jukebox/2026-08-08-v6");
assert.match(
  preview,
  /<meta name="deep-cuts-renderer" content="mahogany-jukebox\/2026-08-08-v6">/,
);
assert.match(
  preview,
  /data-renderer-version="mahogany-jukebox\/2026-08-08-v6"/,
);
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
assert.match(preview, /is-powering:before\{opacity:\.3\}/);
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
assert.match(preview, /left:16\.7%;width:9\.4%/);
assert.match(preview, /translateX\(-56%\) rotateY\(88deg\)/);
assert.doesNotMatch(preview, /content:"\$"/);
assert.match(preview, /is-depressed/);
assert.match(preview, /actions\.forEach\(candidate=>candidate\.classList\.toggle\("is-depressed",candidate===action\)\)/);
assert.match(preview, /jukebox-mechanical-button-clunk-public-domain\.ogg/);
assert.match(preview, /\.video\{[^}]*left:23\.55%;width:64\.78%/);
assert.match(preview, /\.actions\{[^}]*top:55\.9%;left:12\.05%;width:73\.5%;height:18\.2%;[^}]*gap:1\.45%/);
assert.match(preview, /aggits-jukebox-icons-oval-v4\/spotify\.svg/);
assert.match(preview, /\.action-icon img\{[^}]*width:100%;height:100%/);
assert.match(preview, /\.action-icon\{[^}]*width:68%/);
assert.doesNotMatch(preview, /solid transparent/);
assert.doesNotMatch(preview, /is-label-medium/);
assert.doesNotMatch(preview, /<strong>Spotify<\/strong>/);
assert.doesNotMatch(preview, /\.action:before/);
assert.match(preview, /createMediaElementSource\(video\)/);
assert.match(preview, /Math\.ceil\(40\/binHz\)/);
assert.match(preview, /Math\.floor\(180\/binHz\)/);
assert.match(preview, /adaptiveBass=adaptiveBass\*\.94\+raw\*\.06/);
assert.match(preview, /simulatedBass/);
assert.match(preview, /video\?\.addEventListener\("pause",\(\)=>\{clearBass\(\);stopAttentionMonitor\(\)/);
assert.match(preview, /video\?\.addEventListener\("ended",\(\)=>\{clearBass\(\);stopAttentionMonitor\(\)/);
assert.match(preview, /prefers-reduced-motion:reduce[^}]*[\s\S]*--bass-scale:1!important/);
assert.match(preview, /\.action:after\{[^}]*inset:4\.5% 5\.5%[^}]*opacity:calc\(var\(--bass-level\) \* \.82\)/);
assert.equal(MAHOGANY_BUTTON_ATTENTION_START_SECONDS, 45.14);
assert.equal(MAHOGANY_BUTTON_ATTENTION_FLASH_SECONDS, 0.5);
assert.equal(MAHOGANY_BUTTON_ATTENTION_BUTTON_COUNT, 4);
assert.equal(MAHOGANY_BUTTON_ATTENTION_CYCLES, 3);
assert.equal(MAHOGANY_BUTTON_ATTENTION_END_SECONDS, 51.14);
assert.deepEqual(
  [45.139, 45.14, 45.639, 45.64, 46.14, 46.64, 47.14, 49.14, 51.139, 51.14].map(mahoganyButtonAttentionIndex),
  [-1, 0, 0, 1, 2, 3, 0, 0, 3, -1],
  "the three left-to-right media-time cycles must remain exact",
);
assert.equal(isMahoganyButtonAttentionTime(45.14), true);
assert.equal(isMahoganyButtonAttentionTime(51.14), false);
assert.equal((preview.match(/class="attention-flash-border"/g) || []).length, 4);
assert.match(preview, /border:clamp\(2px,\.65vw,4px\) solid #ffd36a/);
assert.doesNotMatch(preview, /\.action\.is-attention-flash\{[^}]*filter|\.action\.is-attention-flash\{[^}]*transform/);
assert.match(preview, /requestVideoFrameCallback\(attentionTick\)/);
assert.match(preview, /Number\.isFinite\(metadata\?\.mediaTime\)\?metadata\.mediaTime:video\.currentTime/);
assert.match(preview, /message\?\.event==="infoDelivery"/);
assert.match(preview, /setInterval\(requestYouTubeTime,80\)/);
assert.match(preview, /postYouTube\("getCurrentTime"\)/);
assert.match(preview, /frame\?\.addEventListener\("load",connectYouTube\)/);
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
      schemaVersion: "deep-cuts-mahogany-jukebox-publication/2",
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
      schemaVersion: "deep-cuts-mahogany-jukebox-publication/2",
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
  assert.equal(data.icons.length, 111);
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
  const rendered = await fetch(
    `${origin}/api/mahogany/projects/${created.project.id}/preview`,
  ).then((response) => response.text());
  assert.match(rendered, /SAVAGE GARDEN/);
  assert.match(rendered, /Mahogany Jukebox preview/);
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
assert.doesNotMatch(studioHtml, /Save draft/);
assert.doesNotMatch(studioHtml, /Accept &amp; publish/);
console.log(
  "Mahogany Jukebox model, locked renderer, perspective QR and local server tests passed.",
);
