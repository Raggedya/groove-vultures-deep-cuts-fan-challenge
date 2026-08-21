import crypto from "node:crypto";
import {
  newMahoganyProject,
  normalizeMahoganyProject,
  saveMahoganyProject,
} from "./mahogany-jukebox-model.mjs";
import {
  researchStudioJookBox,
  StudioResearchNetwork,
  STUDIO_JOOKBOX_CONFIDENCE_GATE,
} from "./studio-jookbox-research.mjs";

export const MAHOGANY_BAND_CANDIDATE_SCHEMA =
  "mahogany-jukebox-band-candidates/1";
export const MAHOGANY_BAND_PLATFORM_ORDER = Object.freeze([
  "bandcamp",
  "instagram",
  "facebook",
  "spotify",
]);
export const MAHOGANY_BAND_ACTION_COUNT = 4;
export const MAHOGANY_BAND_BATCH_SIZE = 10;
export const MAHOGANY_BAND_INTAKE_CONFIDENCE = 75;

const DISCOVERY_QUERIES = Object.freeze([
  'site:bandcamp.com/album "by" independent band',
  'site:bandcamp.com/track "by" independent band',
  'site:bandcamp.com/music band',
  'site:bandcamp.com "indie rock" band',
  'site:bandcamp.com "garage rock" band',
  'site:bandcamp.com "post-punk" band',
  'site:bandcamp.com "alternative rock" band',
  'site:bandcamp.com "pop rock" band',
]);
const MUSICBRAINZ_DISCOVERY_QUERIES = Object.freeze([
  "type:group AND tag:rock",
  'type:group AND tag:"indie rock"',
  'type:group AND tag:"alternative rock"',
  'type:group AND tag:"post-punk"',
  'type:group AND tag:"garage rock"',
  'type:group AND tag:"pop rock"',
]);

export class MahoganyBandDiscoveryNetwork {
  constructor({ researchNetwork = new StudioResearchNetwork() } = {}) {
    this.researchNetwork = researchNetwork;
  }

  async discover({ existingNames = [], limit = 200 } = {}) {
    const ignored = new Set(existingNames.map(compactName));
    const searches = await Promise.all(
      DISCOVERY_QUERIES.map((query) =>
        this.researchNetwork.inspect(
          `https://www.bing.com/search?format=rss&count=50&q=${encodeURIComponent(query)}`,
        ),
      ),
    );
    const seeds = [];
    for (const page of searches) {
      if (!page.ok) continue;
      for (const item of bingItems(page.body)) {
        const name = bandNameFromSearchItem(item);
        if (!name || ignored.has(compactName(name))) continue;
        seeds.push({ name, sourceUrls: [item.url], discoveryURL: item.url });
      }
    }
    if (seeds.length < limit) {
      const discoveryIgnored = new Set([
        ...ignored,
        ...seeds.map((seed) => compactName(seed.name)),
      ]);
      const musicBrainz = await this.musicBrainzSeeds(
        limit - seeds.length,
        discoveryIgnored,
      ).catch(() => []);
      seeds.push(...musicBrainz);
    }
    return uniqueSeeds(seeds).slice(0, limit);
  }

  async musicBrainzSeeds(limit, ignored) {
    const dailyOffset = Math.floor(Date.now() / 86_400_000) % 400;
    const pages = await Promise.all(
      MUSICBRAINZ_DISCOVERY_QUERIES.map((query, index) =>
        this.researchNetwork.inspect(
          `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=100&offset=${dailyOffset + index * 100}`,
        ).catch(() => null),
      ),
    );
    const names = [];
    for (const page of pages) {
      if (!page?.ok) continue;
      let body;
      try {
        body = JSON.parse(page.body);
      } catch {
        continue;
      }
      for (const artist of Array.isArray(body.artists) ? body.artists : []) {
        if (Number(artist.score) < 85) continue;
        const name = cleanName(artist.name);
        if (!name || ignored.has(compactName(name))) continue;
        names.push(name);
      }
    }
    return uniqueSeeds(
      names.map((name) => ({ name, sourceUrls: [], discoveryURL: "" })),
    ).slice(0, limit);
  }
}

export async function runMahoganyBandCandidateBatch({
  projectRoot,
  count = MAHOGANY_BAND_BATCH_SIZE,
  existingProjects = [],
  discovery = new MahoganyBandDiscoveryNetwork(),
  research = researchStudioJookBox,
  researchNetwork = discovery.researchNetwork,
  maxAttempts = 200,
  onProgress = () => {},
} = {}) {
  if (!projectRoot) throw candidateError("Candidate storage is unavailable.");
  const requested = Math.max(1, Math.min(10, Number(count) || 10));
  const batchId = `bandbatch_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
  const existingNames = existingProjects.map((project) => project.name);
  onProgress({
    stage: "discovering",
    message: "Finding possible bands from current public catalogues.",
    reviewed: 0,
    qualified: 0,
    rejected: 0,
  });
  const seeds = await discovery.discover({
    existingNames,
    limit: maxAttempts,
  });
  const accepted = [];
  const rejected = [];
  const candidates = seeds.slice(0, maxAttempts);
  for (let offset = 0; offset < candidates.length; offset += 3) {
    if (accepted.length >= requested) break;
    const group = candidates.slice(offset, offset + 3);
    const outcomes = await Promise.all(
      group.map(async (seed) => {
        onProgress({
          stage: "qualifying",
          message: `Checking ${seed.name}: resolving a direct Bandcamp lead and collecting any available Instagram, Facebook, Spotify and biography.`,
          reviewed: accepted.length + rejected.length,
          qualified: accepted.length,
          rejected: rejected.length,
        });
        try {
          const result = await research(
            { name: seed.name, sourceUrls: seed.sourceUrls },
            {
              network: researchNetwork,
              requirements: {
                requireFeaturedVideo: false,
                requiredDestinationKinds: MAHOGANY_BAND_PLATFORM_ORDER,
              },
            },
          );
          const qualification = qualifyMahoganyBandResearch(result);
          return { seed, result, qualification };
        } catch (error) {
          return { seed, error };
        }
      }),
    );
    for (const outcome of outcomes) {
      if (accepted.length >= requested) break;
      if (outcome.error) {
        rejected.push({
          name: outcome.seed.name,
          reasons: [outcome.error.message],
        });
      } else if (!outcome.qualification.ready) {
        rejected.push({
          name: outcome.seed.name,
          reasons: outcome.qualification.reasons,
        });
      } else {
        const project = await saveMahoganyProject(
          projectRoot,
          projectFromQualifiedBand(outcome.result, { batchId }),
        );
        accepted.push(project);
        existingNames.push(project.name);
      }
      onProgress({
        stage: "qualifying",
        message: `${accepted.length} reviewable Bandcamp lead${accepted.length === 1 ? "" : "s"} ready; unresolved Bandcamp results remain excluded.`,
        reviewed: accepted.length + rejected.length,
        qualified: accepted.length,
        rejected: rejected.length,
        rejectionReasons: summarizeCandidateRejections(rejected).slice(0, 5),
      });
    }
  }
  const shortfall = requested - accepted.length;
  const summary = {
    schemaVersion: MAHOGANY_BAND_CANDIDATE_SCHEMA,
    batchId,
    requested,
    qualified: accepted.length,
    rejected: rejected.length,
    reviewed: accepted.length + rejected.length,
    shortfall,
    projectIds: accepted.map((project) => project.id),
    manualReview: accepted.filter((project) => project.candidate?.status === "manual_review").length,
    fullyVerified: accepted.filter((project) => project.candidate?.status === "verified").length,
    rejections: rejected.slice(0, 40),
    rejectionReasons: summarizeCandidateRejections(rejected),
  };
  onProgress({
    stage: shortfall ? "completed_with_shortfall" : "completed",
    message: shortfall
      ? `${accepted.length} direct Bandcamp lead${accepted.length === 1 ? "" : "s"} reached manual review. ${shortfall} places remain empty because no direct Bandcamp page resolved.`
      : "10 direct Bandcamp leads were added as unpublished manual-review drafts.",
    reviewed: summary.reviewed,
    qualified: summary.qualified,
    rejected: summary.rejected,
    rejectionReasons: summary.rejectionReasons,
  });
  return summary;
}

export function qualifyMahoganyBandResearch(research) {
  const reasons = [];
  const confidence = Number(research?.confidence) || 0;
  const selections = selectionsByRequiredKind(
    [...(research?.reviewCandidates || []), ...(research?.selections || [])],
    MAHOGANY_BAND_INTAKE_CONFIDENCE,
  );
  const selectedKinds = [...MAHOGANY_BAND_PLATFORM_ORDER];
  const verifiedKinds = selectedKinds.filter((kind) => selections[kind]);
  if (!selections.bandcamp) reasons.push("Bandcamp was not verified.");
  const missingKinds = selectedKinds.filter((kind) => !selections[kind]);
  const hasSourcedBiography = Boolean(
    research?.biography?.tickerBio && research.biography.sourceURL,
  );
  const fullyVerified = Boolean(
    research?.passed &&
      confidence >= STUDIO_JOOKBOX_CONFIDENCE_GATE &&
      missingKinds.length === 0 &&
      hasSourcedBiography,
  );
  return {
    ready: reasons.length === 0,
    reasons,
    selections,
    selectedKinds,
    verifiedKinds,
    missingKinds,
    hasSourcedBiography,
    fullyVerified,
  };
}

export function projectFromQualifiedBand(research, { batchId = "" } = {}) {
  const checked = qualifyMahoganyBandResearch(research);
  if (!checked.ready)
    throw candidateError(checked.reasons.join(" "), "candidate_not_qualified");
  const now = new Date().toISOString();
  return normalizeMahoganyProject({
    ...newMahoganyProject(),
    name: research.bandName,
    tickerText: research.biography?.tickerBio || "",
    video: {
      kind: "mp4",
      youtubeUrl: "",
      embedStatus: "",
      embedVideoId: "",
      embedCheckedAt: "",
      fileName: "",
      sizeBytes: 0,
      sha256: "",
    },
    actions: checked.selectedKinds.map((kind, index) => ({
      slot: index + 1,
      iconId: kind,
      label: title(kind),
      href: checked.selections[kind]?.url || "",
      openInNewTab: true,
    })),
    status: "draft",
    candidate: {
      kind: "band",
      source: "automatic_batch",
      status: checked.fullyVerified ? "verified" : "manual_review",
      confidence: checked.fullyVerified
        ? Number(research.confidence) || STUDIO_JOOKBOX_CONFIDENCE_GATE
        : Math.max(
            MAHOGANY_BAND_INTAKE_CONFIDENCE,
            Number(checked.selections.bandcamp?.confidence) || 0,
          ),
      verifiedAt: research.verifiedAt || now,
      batchId,
      platformOrder: [...checked.selectedKinds],
      missingPlatforms: [...checked.missingKinds],
      reviewReasons: [
        ...checked.missingKinds.map((kind) => `${title(kind)} requires manual completion.`),
        ...(!checked.hasSourcedBiography
          ? ["Ticker biography requires manual completion."]
          : []),
        ...(!research?.checks?.artistControlledIdentity
          ? ["Band identity requires owner confirmation before publication."]
          : []),
      ],
      evidenceUrls: (research.sources || []).map((source) => source.url),
    },
  });
}

function selectionsByRequiredKind(items, minimumConfidence = STUDIO_JOOKBOX_CONFIDENCE_GATE) {
  const selected = {};
  for (const item of items) {
    if (
      MAHOGANY_BAND_PLATFORM_ORDER.includes(item.kind) &&
      Number(item.confidence) >= minimumConfidence &&
      directPlatformURL(item.kind, item.url) &&
      !selected[item.kind]
    )
      selected[item.kind] = item;
  }
  return selected;
}

function directPlatformURL(kind, value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (url.protocol !== "https:") return false;
    if (kind === "bandcamp") return host.endsWith(".bandcamp.com");
    if (kind === "instagram") return host === "instagram.com";
    if (kind === "facebook") return ["facebook.com", "m.facebook.com"].includes(host);
    if (kind === "spotify")
      return host === "open.spotify.com" && /^\/artist\/[a-z0-9]+/i.test(url.pathname);
    if (kind === "youtube")
      return ["youtube.com", "m.youtube.com"].includes(host) &&
        (/^\/(?:channel|c|user)\//i.test(url.pathname) || /^\/@[^/]+/i.test(url.pathname));
    if (kind === "website")
      return ![
        "bing.com",
        "google.com",
        "instagram.com",
        "facebook.com",
        "m.facebook.com",
        "open.spotify.com",
        "youtube.com",
        "m.youtube.com",
        "youtu.be",
      ].includes(host) && !host.endsWith(".bandcamp.com");
    return false;
  } catch {
    return false;
  }
}

export function summarizeCandidateRejections(rejections = []) {
  const counts = new Map();
  for (const rejection of rejections) {
    for (const reason of rejection.reasons || ["Unknown rejection."]) {
      const category = rejectionCategory(reason);
      counts.set(category, (counts.get(category) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function rejectionCategory(reason) {
  const value = String(reason || "").toLowerCase();
  if (value.includes("bandcamp")) return "Bandcamp not verified";
  if (value.includes("instagram")) return "Instagram not verified";
  if (value.includes("facebook")) return "Facebook not verified";
  if (value.includes("spotify")) return "Spotify not verified";
  if (value.includes("biograph")) return "Sourced biography not verified";
  if (value.includes("identity") || value.includes("98%")) return "Identity confidence below 98%";
  if (value.includes("network") || value.includes("fetch") || value.includes("timeout")) return "Temporary network failure";
  return cleanName(reason) || "Other verification failure";
}

function bingItems(xml) {
  const output = [];
  for (const match of String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const title = xmlValue(match[1], "title");
    const url = xmlValue(match[1], "link");
    if (/^https:\/\//i.test(url)) output.push({ title, url });
  }
  return output;
}

function bandNameFromSearchItem({ title, url }) {
  let value = decodeXml(title)
    .replace(/\s*[|\-–—]\s*Bandcamp\s*$/i, "")
    .replace(/^Music\s*[|\-–—]\s*/i, "")
    .trim();
  const by = value.match(/,\s*by\s+(.+)$/i);
  if (by) value = by[1];
  const pipe = value.split(/\s*\|\s*/).filter(Boolean);
  if (pipe.length > 1) value = pipe.at(-1);
  value = cleanName(value);
  if (value && !/^(bandcamp|music|album|track)$/i.test(value)) return value;
  try {
    const host = new URL(url).hostname.replace(/\.bandcamp\.com$/i, "");
    return cleanName(host.replace(/[-_]+/g, " "));
  } catch {
    return "";
  }
}

function xmlValue(item, tag) {
  return decodeXml(
    item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "",
  ).replace(/^<!\[CDATA\[|\]\]>$/g, "");
}
function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
function cleanName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
  return name.length >= 2 && name.length <= 120 ? name : "";
}
function compactName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function uniqueSeeds(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = compactName(item.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function title(value) {
  return value === "bandcamp"
    ? "Bandcamp"
    : value.charAt(0).toUpperCase() + value.slice(1);
}
function candidateError(message, code = "candidate_batch_failed") {
  return Object.assign(new Error(message), { code });
}
