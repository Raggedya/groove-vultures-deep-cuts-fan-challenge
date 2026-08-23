import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AGGITS_JUKEBOX_ICONS } from "./aggits-jukebox-icons.mjs";
import {
  MAHOGANY_RENDERER_VERSION,
  renderAggitsJukeboxStudioPreview,
} from "./aggits-jukebox-preview.mjs";
import {
  MAHOGANY_LEGACY_CUSTOM_LAYOUT,
  MAHOGANY_LEGACY_CUSTOM_LAYOUT_ID,
  MAHOGANY_LEGACY_LAYOUT,
  MAHOGANY_LEGACY_LAYOUT_ID,
  MAHOGANY_MASTER_LAYOUT,
  MAHOGANY_MASTER_LAYOUT_ID,
  MAHOGANY_MINERS_REST_LAYOUT,
  MAHOGANY_MINERS_REST_SKIN_SHA256,
  mahoganyGeometrySnapshot,
} from "./mahogany-jukebox-layout.mjs";

const root = path.resolve(import.meta.dirname, ".."),
  contractPath = path.join(
    root,
    "contracts",
    "canonical-mahogany-jukebox-v1.json",
  ),
  contract = JSON.parse(await fs.readFile(contractPath, "utf8"));

assert.equal(contract.contractId, "canonical-mahogany-jukebox/v1");
assert.equal(contract.status, "immutable");
assert.equal(contract.baseline.rendererVersion, MAHOGANY_RENDERER_VERSION);
assert.match(contract.baseline.sourceCommit, /^[a-f0-9]{40}$/);
assert.match(contract.baseline.productionWorkerVersion, /^[a-f0-9-]{36}$/);

for (const item of [...contract.protectedFiles, ...contract.protectedAssets]) {
  const absolute = path.join(root, item.path),
    diskBytes = await fs.readFile(absolute),
    canonicalBytes =
      item.hashMode === "utf8-lf"
        ? Buffer.from(diskBytes.toString("utf8").replace(/\r\n?/g, "\n"), "utf8")
        : diskBytes;
  assert.ok(
    !item.hashMode || item.hashMode === "utf8-lf",
    `${item.path} uses an unknown canonical hash mode`,
  );
  assert.equal(
    canonicalBytes.length,
    item.bytes,
    `${item.path} canonical byte length changed`,
  );
  assert.equal(
    sha256(canonicalBytes),
    item.sha256,
    `${item.path} changed outside an authorised canonical-module migration`,
  );
  if (item.width || item.height) {
    const metadata = await sharp(diskBytes).metadata();
    assert.equal(metadata.width, item.width, `${item.path} width changed`);
    assert.equal(metadata.height, item.height, `${item.path} height changed`);
  }
}

assert.equal(
  AGGITS_JUKEBOX_ICONS.length,
  contract.iconSet.existingIconCount,
  "the canonical icon identity/order changed",
);
const iconSetHash = crypto.createHash("sha256");
for (const icon of AGGITS_JUKEBOX_ICONS) {
  const absolute = path.join(root, icon.assetPath.replace(/^\//, "")),
    svg = await fs.readFile(absolute, "utf8");
  assert.match(icon.assetPath, /aggits-jukebox-icons-oval-v6\/.+\.svg$/);
  assert.equal((svg.match(/<svg\b/g) || []).length, 1);
  iconSetHash.update(path.basename(absolute));
  iconSetHash.update(svg.replace(/\r\n?/g, "\n"));
}
assert.equal(
  iconSetHash.digest("hex"),
  contract.iconSet.combinedSha256,
  "existing canonical icon bytes changed",
);

const geometryProfiles = {
  master: MAHOGANY_MASTER_LAYOUT,
  minersRest: MAHOGANY_MINERS_REST_LAYOUT,
  legacyDefault: MAHOGANY_LEGACY_LAYOUT,
  legacyCustom: MAHOGANY_LEGACY_CUSTOM_LAYOUT,
};
for (const [name, profile] of Object.entries(geometryProfiles)) {
  const expected = contract.geometrySnapshots[name],
    canonical = mahoganyGeometrySnapshot(profile).canonical,
    tickerBottom = profile.slots.ticker.top + profile.slots.ticker.height,
    videoBottom = profile.slots.video.top + profile.slots.video.height;
  assert.equal(profile.id, expected.id);
  assert.equal(profile.width, expected.width);
  assert.equal(profile.height, expected.height);
  assert.equal(Buffer.byteLength(canonical), expected.canonicalBytes);
  assert.equal(sha256(canonical), expected.sha256, `${name} geometry changed`);
  assert.ok(
    profile.slots.video.top > tickerBottom,
    `${name} video must remain below the independent ticker viewport`,
  );
  assert.ok(videoBottom <= 100, `${name} video escaped the fixed machine`);
  assert.ok(
    profile.slots.share.top + profile.slots.share.height <= 100,
    `${name} Share region escaped the fixed machine`,
  );
  assert.ok(
    profile.slots.mainPlay.top + profile.slots.mainPlay.height <= 100,
    `${name} main play control escaped the fixed machine`,
  );
}

const measuredPhysicalActionCentres = [199, 377, 564, 739];
MAHOGANY_MASTER_LAYOUT.slots.actionKeys.forEach((slot, index) => {
  const renderedCentre =
    ((slot.left + slot.width / 2) / 100) * MAHOGANY_MASTER_LAYOUT.width;
  assert.ok(
    Math.abs(renderedCentre - measuredPhysicalActionCentres[index]) <= 0.01,
    `canonical action ${index + 1} moved off its photographed centre`,
  );
});

const actions = ["spotify", "youtube", "instagram", "facebook"].map(
    (iconId, index) => ({
      enabled: true,
      iconId,
      label: iconId.toUpperCase(),
      href: `https://example.com/action-${index + 1}`,
      openInNewTab: true,
    }),
  ),
  fixture = (layoutProfile, cabinetSkin) => ({
    id: "studio_canonical000001",
    input: {
      type: "aggits_jukebox",
      name: "Canonical Jukebox",
      tickerText: "CANONICAL JUKEBOX IMMUTABLE BASELINE",
      layoutProfile,
      cabinetSkin,
      actionButtons: actions,
    },
    mp4: {
      fileName: "canonical.mp4",
      sizeBytes: 1024,
      sha256: "a".repeat(64),
    },
    readiness: { handoffReady: true },
  }),
  renderOptions = {
    videoUrl: "/canonical/welcome.mp4",
    secretVideoUrl: "/canonical/secret.mp4",
    publicMode: true,
    canonicalUrl: "https://deep-cuts.example/e/dc_canonical",
  },
  rendererVariants = {
    master: fixture(MAHOGANY_MASTER_LAYOUT_ID, {
      kind: "default",
      layoutProfile: MAHOGANY_MASTER_LAYOUT_ID,
    }),
    minersRest: fixture(MAHOGANY_MASTER_LAYOUT_ID, {
      kind: "custom",
      layoutProfile: MAHOGANY_MASTER_LAYOUT_ID,
      width: 941,
      height: 1672,
      sizeBytes: 2317000,
      sha256: MAHOGANY_MINERS_REST_SKIN_SHA256,
      format: "png",
      mimeType: "image/png",
    }),
    legacyDefault: fixture(MAHOGANY_LEGACY_LAYOUT_ID, {
      kind: "default",
      layoutProfile: MAHOGANY_LEGACY_LAYOUT_ID,
    }),
    legacyCustom: fixture(MAHOGANY_LEGACY_CUSTOM_LAYOUT_ID, {
      kind: "custom",
      layoutProfile: MAHOGANY_LEGACY_CUSTOM_LAYOUT_ID,
      width: 864,
      height: 1536,
      sizeBytes: 1024,
      sha256: "b".repeat(64),
      format: "png",
      mimeType: "image/png",
    }),
  };

for (const [name, project] of Object.entries(rendererVariants)) {
  const html = renderAggitsJukeboxStudioPreview(project, {
      ...renderOptions,
      skinUrl:
        project.input.cabinetSkin.kind === "custom"
          ? "/canonical/skin.png"
          : "",
    }),
    expected = contract.rendererSnapshots[name];
  assert.equal(Buffer.byteLength(html), expected.bytes, `${name} output length changed`);
  assert.equal(
    sha256(html),
    expected.sha256,
    `${name} DOM, CSS, behaviour or renderer output changed`,
  );
  assert.equal((html.match(/class="action"/g) || []).length, 4);
  assert.match(html, /\.ticker\{position:absolute;z-index:4;/);
  assert.match(html, /\.video\{position:absolute;z-index:3;/);
  assert.match(html, /\.video\{[^}]*overflow:hidden/);
  assert.match(html, /\.video\{[^}]*clip-path:inset\(0 round var\(--video-radius\)\)/);
  assert.match(html, /\.machine\.is-fixed-action-layout \.action\{position:absolute;padding:0\}/);
  assert.match(html, /\.action-icon\{[^}]*top:50%;left:50%/);
  assert.match(html, /object-fit:cover/);
  assert.match(html, /addEventListener\("ended"/);
  assert.match(html, /window\.open\("about:blank","_blank"\)/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /prefers-reduced-motion/);
}

for (const baseline of contract.visualBaselines) {
  const absolute = path.join(root, baseline.path),
    bytes = await fs.readFile(absolute),
    metadata = await sharp(bytes).metadata();
  assert.equal(bytes.length, baseline.bytes, `${baseline.path} byte length changed`);
  assert.equal(sha256(bytes), baseline.sha256, `${baseline.path} visual baseline changed`);
  assert.equal(metadata.width, baseline.width, `${baseline.path} width changed`);
  assert.equal(metadata.height, baseline.height, `${baseline.path} height changed`);
}

const measurementBytes = await fs.readFile(
    path.join(root, contract.measurementBaseline.path),
  ),
  measurements = JSON.parse(measurementBytes);
assert.equal(measurementBytes.length, contract.measurementBaseline.bytes);
assert.equal(sha256(measurementBytes), contract.measurementBaseline.sha256);
assert.deepEqual(
  measurements.map((item) => item.label),
  contract.measurementBaseline.requiredLabels,
);
for (const measurement of measurements) {
  assert.equal(measurement.profile, "miners-rest-941/1");
  assert.equal(measurement.tickerTop, "27.09%");
  assert.equal(measurement.videoTop, "31.64%");
  assert.equal(measurement.videoHeight, "29.84%");
  assert.equal(measurement.subtitleClear, true);
  assert.equal(measurement.tickerVideoClear, true);
  assert.ok(measurement.subtitleTickerGap >= 8);
  assert.ok(measurement.tickerVideoGap > 0);
}

const [agentInstructions, architectureDirective, validationPlan, skinSchema] =
  await Promise.all([
    fs.readFile(path.join(root, "AGENTS.md"), "utf8"),
    fs.readFile(path.join(root, "PLATFORM_ARCHITECTURE_DIRECTIVE.md"), "utf8"),
    fs.readFile(path.join(root, "scripts", "validation-plan.mjs"), "utf8"),
    fs.readFile(path.join(root, "scripts", "mahogany-jukebox-skin-schema.mjs"), "utf8"),
  ]);
assert.match(agentInstructions, /CANONICAL_JUKEBOX_MODULE_LOCK\.md/);
assert.match(architectureDirective, /canonical-mahogany-jukebox\/v1/);
assert.match(validationPlan, /test-canonical-mahogany-jukebox-lock\.mjs/);
for (const forbidden of contract.publicInterface.forbiddenConfiguration)
  assert.doesNotMatch(
    skinSchema,
    new RegExp(`^[\\s\"]*${escapeRegExp(forbidden)}[\"]?:`, "mi"),
    `skin schema must not expose ${forbidden}`,
  );

console.log(
  "Canonical Mahogany Jukebox v1 lock passed: protected source, assets, geometry, renderer output, public boundary and production visual baselines are unchanged.",
);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
