import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  buildMahoganyManifest,
  newMahoganyProject,
  normalizeMahoganyProject,
  validateMahoganyProject,
} from "./mahogany-jukebox-model.mjs";
import {
  FULLNOISE_VU_CABINET_URL,
  FULLNOISE_VU_RENDERER_VERSION,
  renderFullnoiseVuPreview,
} from "./fullnoise-vu-preview.mjs";
import { createMahoganyStudioServer } from "./mahogany-studio-server.mjs";
import { __test as publisherTest } from "../worker/aggits-jukebox-publisher.js";

const assetPath = path.resolve("assets/fullnoise-vu-cabinet-generic-master-v2.webp"),
  assetBytes = await fs.readFile(assetPath),
  metadata = await sharp(assetBytes).metadata();
assert.deepEqual(
  { width: metadata.width, height: metadata.height },
  { width: 959, height: 1640 },
);
assert.equal(
  crypto.createHash("sha256").update(assetBytes).digest("hex"),
  "033a20845c25454015618d0858377fdad2962a2ca383ddabf1a84e90a38b6835",
);

const base = newMahoganyProject({ product: "fullnoise" });
assert.equal(base.product, "fullnoise");
assert.equal(base.appearance, "fullnoise-vu");
const project = normalizeMahoganyProject({
  ...base,
  name: "HEY GRINGO",
  tickerText: "FULLNOISE ARTISTS PRESENTS HEY GRINGO",
  actions: base.actions.map((action, index) => ({
    ...action,
    iconId: ["spotify", "youtube", "instagram", "shop"][index],
    href: `https://example.com/action-${index + 1}`,
  })),
  vu: {
    ...base.vu,
    music: {
      fileName: "hey-gringo.mp3",
      trackName: "Daryl Roberts & Hey Gringo Can't Say No From Three",
      sizeBytes: 8,
      sha256: "a".repeat(64),
      mimeType: "audio/mpeg",
    },
  },
});
assert.equal(validateMahoganyProject(project).ready, true);
const manifest = buildMahoganyManifest(project);
assert.equal(manifest.product, "fullnoise");
assert.equal(manifest.appearance, "fullnoise-vu");

const preview = renderFullnoiseVuPreview(
  {
    ...project,
    editionId: "dc_0123456789",
    input: {
      name: project.name,
      tickerText: project.tickerText,
      actionButtons: project.actions,
    },
  },
  { musicUrl: "/music.mp3", canonicalUrl: "https://example.com/e/test" },
);
assert.match(preview, new RegExp(FULLNOISE_VU_RENDERER_VERSION));
assert.match(preview, new RegExp(FULLNOISE_VU_CABINET_URL));
assert.match(preview, />HEY GRINGO</);
assert.match(preview, /id="deckBandName" class="deck-band-name">HEY GRINGO</);
assert.match(preview, /Daryl Roberts &amp; Hey Gringo Can&#39;t Say No From Three/);
assert.match(preview, /target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(preview, /aggits-jukebox-button-bank-canonical-v2/);
assert.doesNotMatch(preview, /id="characterVideo"/);
assert.doesNotMatch(preview, /aggits-vu-presenter-v1\.mp4/);

const validated = publisherTest.validateManifest(manifest);
assert.equal(validated.ok, true);
const config = publisherTest.buildConfig(
  {
    job_id: "ajjob_fullnoise",
    edition_id: "dc_0123456789",
    slug: "aggits-jukebox-fullnoise-test",
    base_url: "https://deep-cuts.example",
    created_at: new Date().toISOString(),
    video_key: "fullnoise/music.mp3",
  },
  validated.value,
);
assert.equal(config.brandName, "Fullnoise Artists");
assert.equal(config.aggitsJukebox.appearanceVariant, "fullnoise-vu");
assert.equal(config.aggitsJukebox.modelVersion, FULLNOISE_VU_RENDERER_VERSION);

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "fullnoise-isolation-")),
  server = createMahoganyStudioServer({
    root: process.cwd(),
    dataDir,
    publisher: null,
  });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const origin = `http://127.0.0.1:${server.address().port}`,
    fullnoiseCreated = await fetch(`${origin}/api/fullnoise/projects`, {
      method: "POST",
    }).then((response) => response.json()),
    mahoganyCreated = await fetch(`${origin}/api/mahogany/projects`, {
      method: "POST",
    }).then((response) => response.json());
  assert.equal(fullnoiseCreated.project.product, "fullnoise");
  assert.equal(fullnoiseCreated.project.appearance, "fullnoise-vu");
  assert.equal(mahoganyCreated.project.product, "mahogany");
  const [fullnoiseBootstrap, mahoganyBootstrap] = await Promise.all([
    fetch(`${origin}/api/fullnoise/bootstrap`).then((response) => response.json()),
    fetch(`${origin}/api/mahogany/bootstrap`).then((response) => response.json()),
  ]);
  assert.deepEqual(
    fullnoiseBootstrap.projects.map((item) => item.product),
    ["fullnoise"],
  );
  assert.deepEqual(
    mahoganyBootstrap.projects.map((item) => item.product),
    ["mahogany"],
  );
  const [fullnoiseStudio, mahoganyStudio] = await Promise.all([
    fetch(`${origin}/fullnoise-studio/`).then((response) => response.text()),
    fetch(`${origin}/mahogany-studio/`).then((response) => response.text()),
  ]);
  assert.match(fullnoiseStudio, /data-product="fullnoise"/);
  assert.match(fullnoiseStudio, /Fullnoise Jukebox library/);
  assert.doesNotMatch(mahoganyStudio, /data-product="fullnoise"/);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(dataDir, { recursive: true, force: true });
}

console.log("Fullnoise VU product isolation, renderer and cabinet tests passed.");
