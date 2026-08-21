import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  MAHOGANY_BAND_ACTION_COUNT,
  MahoganyBandDiscoveryNetwork,
  MAHOGANY_BAND_PLATFORM_ORDER,
  projectFromQualifiedBand,
  qualifyMahoganyBandResearch,
  runMahoganyBandCandidateBatch,
  summarizeCandidateRejections,
} from "./mahogany-band-candidates.mjs";
import { selectStudioResearchSeeds } from "./studio-jookbox-research.mjs";
import { listMahoganyProjects } from "./mahogany-jukebox-model.mjs";

const verifiedResearch = (name = "The Copper Signals") => ({
  bandName: name,
  status: "passed",
  passed: true,
  confidence: 100,
  checks: { artistControlledIdentity: true },
  verifiedAt: "2026-08-06T01:00:00.000Z",
  biography: {
    tickerBio:
      `${name.toUpperCase()} — AN INDEPENDENT GUITAR BAND WITH A VERIFIED CATALOGUE AND OFFICIAL PROFILES.`,
    sourceURL: `https://${slug(name)}.example/about`,
  },
  featuredVideo: null,
  selections: [
    platform("spotify", `https://open.spotify.com/artist/${"a".repeat(22)}`),
    platform("facebook", `https://www.facebook.com/${slug(name)}/`),
    platform("bandcamp", `https://${slug(name)}.bandcamp.com/`),
    platform("instagram", `https://www.instagram.com/${slug(name)}/`),
  ],
  sources: [
    {
      url: `https://${slug(name)}.example/about`,
      identityVerified: true,
    },
  ],
});

const qualified = verifiedResearch();
assert.equal(qualifyMahoganyBandResearch(qualified).ready, true);
const generated = projectFromQualifiedBand(qualified, { batchId: "batch_test" });
assert.deepEqual(
  generated.actions.map((action) => action.iconId),
  MAHOGANY_BAND_PLATFORM_ORDER.slice(0, MAHOGANY_BAND_ACTION_COUNT),
);
assert.deepEqual(
  generated.actions.map((action) => action.label),
  ["Bandcamp", "Instagram", "Facebook", "Spotify"],
);
assert.equal(generated.status, "draft");
assert.equal(generated.candidate.status, "verified");
assert.equal(generated.candidate.confidence, 100);
assert.equal(generated.name, "The Copper Signals");
assert.equal(generated.video.kind, "mp4");
assert.equal(generated.video.fileName, "");

const flexible = verifiedResearch("The Flexible Signals");
flexible.selections = flexible.selections.filter(
  (selection) => selection.kind !== "instagram",
);
flexible.selections.push(
  platform("website", "https://the-flexible-signals.example/"),
  platform("youtube", "https://www.youtube.com/@theflexiblesignals"),
);
const flexibleQualification = qualifyMahoganyBandResearch(flexible);
assert.equal(flexibleQualification.ready, true);
assert.equal(flexibleQualification.fullyVerified, false);
assert.deepEqual(flexibleQualification.missingKinds, ["instagram"]);
const flexibleDraft = projectFromQualifiedBand(flexible);
assert.equal(flexibleDraft.candidate.status, "manual_review");
assert.equal(flexibleDraft.actions.find((action) => action.iconId === "instagram").href, "");

const incomplete = verifiedResearch("The Missing Platform");
incomplete.selections = incomplete.selections.filter(
  (selection) => selection.kind !== "bandcamp",
);
const rejected = qualifyMahoganyBandResearch(incomplete);
assert.equal(rejected.ready, false);
assert.match(rejected.reasons.join(" "), /Bandcamp was not verified/);

const tooFew = verifiedResearch("The Sparse Signals");
tooFew.selections = tooFew.selections.filter((selection) =>
  ["bandcamp", "spotify", "facebook"].includes(selection.kind),
);
const tooFewResult = qualifyMahoganyBandResearch(tooFew);
assert.equal(tooFewResult.ready, true);
assert.equal(tooFewResult.fullyVerified, false);

const bandcampOnly = verifiedResearch("The One Link Signals");
bandcampOnly.selections = bandcampOnly.selections.filter(
  (selection) => selection.kind === "bandcamp",
);
const bandcampOnlyResult = qualifyMahoganyBandResearch(bandcampOnly);
assert.equal(bandcampOnlyResult.ready, true);
assert.equal(bandcampOnlyResult.fullyVerified, false);
assert.deepEqual(bandcampOnlyResult.missingKinds, ["instagram", "facebook", "spotify"]);
const bandcampOnlyDraft = projectFromQualifiedBand(bandcampOnly);
assert.equal(bandcampOnlyDraft.candidate.status, "manual_review");
assert.equal(bandcampOnlyDraft.actions.filter((action) => action.href).length, 1);

const searchLead = verifiedResearch("The Search Lead");
searchLead.status = "needs_review";
searchLead.passed = false;
searchLead.confidence = 42;
searchLead.checks.artistControlledIdentity = false;
searchLead.biography = { tickerBio: "", sourceURL: "" };
searchLead.selections = [];
searchLead.reviewCandidates = [
  platform("bandcamp", "https://the-search-lead.bandcamp.com/", 75),
];
const searchLeadResult = qualifyMahoganyBandResearch(searchLead);
assert.equal(searchLeadResult.ready, true);
assert.equal(searchLeadResult.fullyVerified, false);
const searchLeadDraft = projectFromQualifiedBand(searchLead);
assert.equal(searchLeadDraft.candidate.confidence, 75);
assert.equal(searchLeadDraft.tickerText, "");
assert.ok(searchLeadDraft.candidate.reviewReasons.some((reason) => /Ticker biography/.test(reason)));

const noVideo = verifiedResearch("The Silent Signals");
assert.equal(qualifyMahoganyBandResearch(noVideo).ready, true);

const balancedSeeds = selectStudioResearchSeeds(
  [
    "https://example-band.bandcamp.com/",
    "https://www.instagram.com/exampleband/",
    "https://www.facebook.com/exampleband/",
    `https://open.spotify.com/artist/${"b".repeat(22)}`,
    "https://linktr.ee/exampleband",
  ],
  "Example Band",
  { requiredDestinationKinds: MAHOGANY_BAND_PLATFORM_ORDER },
);
assert.equal(balancedSeeds.length, 5);
assert.ok(balancedSeeds.some((url) => url.includes("bandcamp.com")));
assert.ok(balancedSeeds.some((url) => url.includes("instagram.com")));
assert.ok(balancedSeeds.some((url) => url.includes("facebook.com")));
assert.ok(balancedSeeds.some((url) => url.includes("open.spotify.com")));

assert.deepEqual(
  summarizeCandidateRejections([
    { reasons: ["Instagram was not verified."] },
    { reasons: ["Instagram was not verified.", "Spotify was not verified."] },
  ]),
  [
    { reason: "Instagram not verified", count: 2 },
    { reason: "Spotify not verified", count: 1 },
  ],
);

const discoveryCalls = [];
const boundedDiscovery = new MahoganyBandDiscoveryNetwork({
  researchNetwork: {
    async inspect(value) {
      discoveryCalls.push(value);
      if (value.includes("bing.com")) return { ok: true, body: "" };
      const query = new URL(value).searchParams.get("query") || "rock";
      const tag = slug(query);
      return {
        ok: true,
        body: JSON.stringify({
          artists: Array.from({ length: 20 }, (_, index) => ({
            name: `${tag} Candidate ${index + 1}`,
            score: 100,
          })),
        }),
      };
    },
  },
});
const replenished = await boundedDiscovery.discover({ limit: 80 });
assert.equal(replenished.length, 80);
assert.ok(discoveryCalls.some((value) => value.includes("musicbrainz.org")));

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "mahogany-bands-"));
try {
  const seeds = Array.from({ length: 12 }, (_, index) => ({
    name: `Verified Test Band ${index + 1}`,
    sourceUrls: [`https://test-band-${index + 1}.example/`],
  }));
  const progress = [];
  const result = await runMahoganyBandCandidateBatch({
    projectRoot: temporary,
    discovery: {
      researchNetwork: {},
      async discover() {
        return seeds;
      },
    },
    researchNetwork: {},
    async research({ name }, options) {
      assert.equal(options.requirements.requireFeaturedVideo, false);
      assert.deepEqual(
        options.requirements.requiredDestinationKinds,
        MAHOGANY_BAND_PLATFORM_ORDER,
      );
      return verifiedResearch(name);
    },
    onProgress(update) {
      progress.push(update);
    },
  });
  assert.equal(result.qualified, 10);
  assert.equal(result.shortfall, 0);
  const projects = await listMahoganyProjects(temporary);
  assert.equal(projects.length, 10);
  for (const project of projects) {
    assert.equal(project.status, "draft");
    assert.equal(project.candidate.source, "automatic_batch");
    assert.deepEqual(
      project.actions.map((action) => action.iconId),
      MAHOGANY_BAND_PLATFORM_ORDER.slice(0, MAHOGANY_BAND_ACTION_COUNT),
    );
  }
  assert.equal(progress.at(-1).stage, "completed");
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}

console.log(
  "Mahogany automatic band candidate tests passed: direct Bandcamp lead intake, strict publication completion, MP4-first drafts and Bandcamp-first ordering are locked.",
);

function platform(kind, url, confidence = 100) {
  return { kind, url, confidence, identityVerified: confidence >= 98 };
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
