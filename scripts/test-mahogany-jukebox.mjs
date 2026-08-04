import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createAggitsJukeboxQrArtwork,
  AGGITS_JUKEBOX_QR_PANEL,
} from "./aggits-jukebox-qr-artwork.mjs";
import { renderAggitsJukeboxStudioPreview } from "./aggits-jukebox-preview.mjs";
import { createMahoganyStudioServer } from "./mahogany-studio-server.mjs";
import {
  buildMahoganyManifest,
  newMahoganyProject,
  normalizeMahoganyProject,
  toPreviewProject,
  validateMahoganyProject,
} from "./mahogany-jukebox-model.mjs";

const root = process.cwd(),
  sample = normalizeMahoganyProject({
    ...newMahoganyProject(),
    name: "Savage Garden",
    tickerText: "SAVAGE GARDEN — LISTEN, WATCH AND DISCOVER.",
    video: {
      kind: "youtube",
      youtubeUrl: "https://www.youtube.com/watch?v=4QK0RZ0FQ_0",
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
const checked = validateMahoganyProject(sample);
assert.equal(checked.ready, true, checked.errors.join(" "));
const manifest = buildMahoganyManifest(sample);
assert.equal(manifest.actions.length, 4);
assert.equal(manifest.video.kind, "youtube");
assert.match(manifest.video.sha256, /^[a-f0-9]{64}$/);
const preview = renderAggitsJukeboxStudioPreview(toPreviewProject(sample), {
  youtubeUrl: sample.video.youtubeUrl,
});
assert.match(preview, /MAHOGANY JUKEBOX/);
assert.match(preview, /youtube-nocookie\.com\/embed\/4QK0RZ0FQ_0/);
assert.match(preview, /jukebox-real-coin-insert-cc0\.mp3/);
assert.match(preview, /coinInsert/);
assert.equal((preview.match(/class="action"/g) || []).length, 4);
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
      schemaVersion: "deep-cuts-mahogany-jukebox-publication/1",
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
  async accept() {
    return {
      schemaVersion: "deep-cuts-mahogany-jukebox-publication/1",
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
  assert.equal(data.icons.length, 110);
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
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporary, { recursive: true, force: true });
}
const studioCss = await fs.readFile(
  path.join(root, "mahogany-studio", "styles.css"),
  "utf8",
);
assert.match(studioCss, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
console.log(
  "Mahogany Jukebox model, locked renderer, perspective QR and local server tests passed.",
);
