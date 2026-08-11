import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  MAHOGANY_BAND_ACTION_COUNT,
  MAHOGANY_BAND_BATCH_SIZE,
  MahoganyBandDiscoveryNetwork,
  MAHOGANY_BAND_PLATFORM_ORDER,
  projectFromQualifiedBand,
  qualifyMahoganyBandResearch,
  runMahoganyBandCandidateBatch,
  summarizeCandidateRejections,
  __test as candidateTest,
} from "./mahogany-band-candidates.mjs";
import {
  archiveMahoganyProject,
  listMahoganyProjects,
  saveMahoganyProject,
} from "./mahogany-jukebox-model.mjs";

const VIDEO_ID = "dQw4w9WgXcQ";
const verifiedResearch = (name = "The Copper Signals", { video = true } = {}) => ({
  bandName: name,
  status: video ? "passed" : "needs_review",
  passed: video,
  confidence: video ? 100 : 92,
  checks: { artistControlledIdentity: true },
  verifiedAt: "2026-08-09T01:00:00.000Z",
  roots: [{ url: `https://linktr.ee/${slug(name)}`, identityVerified: true }],
  biography: {
    tickerBio: `${name.toUpperCase()} — VERIFIED INDEPENDENT BAND CANDIDATE.`,
    sourceURL: `https://linktr.ee/${slug(name)}`,
  },
  featuredVideo: video
    ? {
        youtubeURL: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
        verifiedAt: "2026-08-09T01:00:00.000Z",
      }
    : null,
  selections: [
    platform("spotify", `https://open.spotify.com/artist/${"a".repeat(22)}`),
    platform("facebook", `https://www.facebook.com/${slug(name)}/`),
    platform("bandcamp", `https://${slug(name)}.bandcamp.com/`),
    platform("instagram", `https://www.instagram.com/${slug(name)}/`),
  ],
  sources: [{ url: `https://linktr.ee/${slug(name)}`, identityVerified: true }],
});

assert.equal(MAHOGANY_BAND_BATCH_SIZE, 20);
const structuredSeed = candidateTest.structuredWikidataSeed(
  wikidataBinding("Structured Signals", 1, true),
);
assert.equal(structuredSeed.name, "Structured Signals");
assert.deepEqual(structuredSeed.sourceUrls, [
  "https://linktr.ee/structured-signals-1",
  "https://structured-signals-1.bandcamp.com/",
  "https://www.instagram.com/structured.signals.1/",
  "https://www.facebook.com/structured-signals-1/",
  `https://open.spotify.com/artist/${"a".repeat(22)}`,
]);
assert.equal(
  structuredSeed.youtubeUrl,
  `https://www.youtube.com/channel/UC${"b".repeat(22)}`,
);
const goldResearch = verifiedResearch();
const goldQualification = qualifyMahoganyBandResearch(goldResearch);
assert.equal(goldQualification.ready, true);
assert.equal(goldQualification.grade, "gold");
const gold = projectFromQualifiedBand(goldResearch, { batchId: "batch_test" });
assert.deepEqual(
  gold.actions.map((action) => action.iconId),
  MAHOGANY_BAND_PLATFORM_ORDER.slice(0, MAHOGANY_BAND_ACTION_COUNT),
);
assert.equal(gold.status, "draft");
assert.equal(gold.candidate.grade, "gold");
assert.equal(gold.candidate.linktreeUrl, "https://linktr.ee/the-copper-signals");
assert.equal(gold.video.kind, "youtube");
assert.equal(gold.video.embedStatus, "playable");
assert.equal(gold.video.embedVideoId, VIDEO_ID);

const silverResearch = verifiedResearch("The Silver Signals", { video: false });
const silverQualification = qualifyMahoganyBandResearch(silverResearch);
assert.equal(silverQualification.ready, true);
assert.equal(silverQualification.grade, "silver");
const silver = projectFromQualifiedBand(silverResearch);
assert.equal(silver.candidate.grade, "silver");
assert.equal(silver.video.kind, "mp4");
assert.ok(silver.candidate.reviewReasons.some((reason) => /YouTube/i.test(reason)));

for (const missingKind of MAHOGANY_BAND_PLATFORM_ORDER) {
  const incomplete = verifiedResearch(`Missing ${missingKind}`);
  incomplete.selections = incomplete.selections.filter(
    (selection) => selection.kind !== missingKind,
  );
  const result = qualifyMahoganyBandResearch(incomplete);
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), new RegExp(missingKind, "i"));
}
const noLinktree = verifiedResearch("No Linktree");
noLinktree.roots = [{ url: "https://no-linktree.example/" }];
assert.equal(qualifyMahoganyBandResearch(noLinktree).ready, false);

assert.deepEqual(
  summarizeCandidateRejections([
    { reasons: ["An artist-controlled Linktree was not verified."] },
    { reasons: ["Instagram was not verified.", "Spotify was not verified."] },
  ]),
  [
    { reason: "Instagram not verified", count: 1 },
    { reason: "Linktree not verified", count: 1 },
    { reason: "Spotify not verified", count: 1 },
  ],
);

const discovery = new MahoganyBandDiscoveryNetwork({
  researchNetwork: {
    async inspect() {
      return {
        ok: true,
        body: `<?xml version="1.0"?><rss><channel>${Array.from(
          { length: 30 },
          (_, index) =>
            `<item><title>Linktree Test Band ${index + 1} | Linktree</title><link>https://linktr.ee/linktree-test-band-${index + 1}</link></item>`,
        ).join("")}</channel></rss>`,
      };
    },
  },
});
const discovered = await discovery.discover({ limit: 25 });
assert.equal(discovered.length, 25);
assert.ok(discovered.every((seed) => seed.sourceUrls[0].startsWith("https://linktr.ee/")));

const structuredCalls = [];
const structuredDiscovery = new MahoganyBandDiscoveryNetwork({
  researchNetwork: {
    async inspect(url) {
      structuredCalls.push(url);
      return {
        ok: true,
        body: JSON.stringify({
          results: {
            bindings: Array.from({ length: 25 }, (_, index) =>
              wikidataBinding(`Structured Band ${index + 1}`, index + 1, index % 2 === 0),
            ),
          },
        }),
      };
    },
  },
});
const structuredDiscovered = await structuredDiscovery.discover({ limit: 20 });
assert.equal(structuredDiscovered.length, 20);
assert.equal(structuredCalls.length, 1);
assert.ok(structuredCalls[0].startsWith("https://query.wikidata.org/sparql?"));

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "mahogany-bands-"));
try {
  const seeds = Array.from({ length: 25 }, (_, index) => ({
    name: `Verified Test Band ${index + 1}`,
    sourceUrls: [
      `https://linktr.ee/verified-test-band-${index + 1}`,
      `https://verified-test-band-${index + 1}.bandcamp.com/`,
      `https://www.instagram.com/verified-test-band-${index + 1}/`,
      `https://www.facebook.com/verified-test-band-${index + 1}/`,
      `https://open.spotify.com/artist/${"a".repeat(22)}`,
    ],
    youtubeUrl: `https://www.youtube.com/channel/UC${"b".repeat(22)}`,
  }));
  const result = await runMahoganyBandCandidateBatch({
    projectRoot: temporary,
    discovery: {
      researchNetwork: {},
      async discover() {
        return seeds;
      },
    },
    researchNetwork: {},
    async research({ name, sourceUrls, youtubeUrl }, options) {
      assert.equal(options.requirements.requireFeaturedVideo, true);
      assert.equal(options.requirements.skipSearchWhenSupplied, true);
      assert.equal(sourceUrls.length, 5);
      assert.match(youtubeUrl, /youtube\.com\/channel\//);
      assert.deepEqual(
        options.requirements.requiredDestinationKinds,
        MAHOGANY_BAND_PLATFORM_ORDER,
      );
      const number = Number(name.match(/\d+$/)?.[0]);
      return verifiedResearch(name, { video: number % 2 === 1 });
    },
  });
  assert.equal(result.qualified, 20);
  assert.equal(result.shortfall, 0);
  assert.equal(result.gold, 10);
  assert.equal(result.silver, 10);
  const projects = await listMahoganyProjects(temporary);
  assert.equal(projects.length, 20);
  assert.ok(projects.every((project) => project.status === "draft"));

  const archived = await archiveMahoganyProject(temporary, projects[0].id);
  assert.match(archived.archivedPath, /archive[\\/]projects/);
  assert.equal((await listMahoganyProjects(temporary)).length, 19);

  const protectedProject = await saveMahoganyProject(temporary, {
    ...projects[1],
    status: "published",
    publication: { editionId: "dc_protected" },
  });
  await assert.rejects(
    archiveMahoganyProject(temporary, protectedProject.id),
    (error) => error.code === "project_identity_protected",
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}

console.log(
  "Mahogany candidate tests passed: 20-band Linktree intake, strict four-platform qualification, gold/silver YouTube grading, draft-only creation and protected archival deletion are locked.",
);

function platform(kind, url, confidence = 100) {
  return { kind, url, confidence, identityVerified: confidence >= 98 };
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function wikidataBinding(name, index, video) {
  const slugged = slug(name);
  return {
    item: { value: `http://www.wikidata.org/entity/Q${1000 + index}` },
    itemLabel: { value: name },
    linktree: { value: `${slugged}-${index}` },
    bandcamp: { value: `${slugged}-${index}` },
    instagram: { value: `${slugged.replaceAll("-", ".")}.${index}` },
    facebook: { value: `${slugged}-${index}` },
    spotify: { value: "a".repeat(22) },
    ...(video ? { youtube: { value: `UC${"b".repeat(22)}` } } : {}),
  };
}
