import crypto from "node:crypto";
import {
  newMahoganyProject,
  normalizeMahoganyProject,
  saveMahoganyProject,
  youtubeVideoId,
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
export const MAHOGANY_BAND_BATCH_SIZE = 20;
export const MAHOGANY_BAND_INTAKE_CONFIDENCE = 98;

const DISCOVERY_QUERIES = Object.freeze([
  'site:linktr.ee band "bandcamp" "spotify"',
  'site:linktr.ee "indie band"',
  'site:linktr.ee "rock band"',
  'site:linktr.ee "garage rock" band',
  'site:linktr.ee "post-punk" band',
  'site:linktr.ee "alternative rock" band',
  'site:linktr.ee "punk band"',
  'site:linktr.ee "pop band"',
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
const WIKIDATA_CANDIDATE_QUERY = `
SELECT DISTINCT ?item ?itemLabel ?linktree ?bandcamp ?instagram ?facebook ?spotify ?youtube WHERE {
  ?item wdt:P31 wd:Q215380;
        wdt:P11079 ?linktree;
        wdt:P3283 ?bandcamp;
        wdt:P2003 ?instagram;
        wdt:P2013 ?facebook;
        wdt:P1902 ?spotify.
  OPTIONAL { ?item wdt:P2397 ?youtube. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?item
`;

export class MahoganyBandDiscoveryNetwork {
  constructor({
    researchNetwork = new StudioResearchNetwork(),
    catalogueDelayMs = researchNetwork instanceof StudioResearchNetwork
      ? 1_100
      : 0,
  } = {}) {
    this.researchNetwork = researchNetwork;
    this.catalogueDelayMs = catalogueDelayMs;
  }

  async discover({ existingNames = [], limit = 200 } = {}) {
    const ignored = new Set(existingNames.map(compactName));
    const structured = await this.wikidataSeeds(limit, ignored).catch(() => []);
    if (structured.length >= limit) return structured.slice(0, limit);
    const searches = await Promise.all(
      DISCOVERY_QUERIES.map((query) =>
        this.researchNetwork.inspect(
          query.includes("site:linktr.ee")
            ? `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
            : `https://www.bing.com/search?format=rss&count=50&q=${encodeURIComponent(query)}`,
        ),
      ),
    );
    const seeds = [...structured];
    for (const page of searches) {
      if (!page.ok) continue;
      for (const item of [
        ...duckDuckGoItems(page.body),
        ...bingItems(page.body),
      ]) {
        const linktree = isLinktreeURL(item.url);
        const bandcamp = isBandcampURL(item.url);
        const name = linktree
          ? bandNameFromLinktreeSearchItem(item)
          : bandNameFromSearchItem(item);
        if (!name || (!linktree && !bandcamp) || ignored.has(compactName(name)))
          continue;
        seeds.push({ name, sourceUrls: [item.url], discoveryURL: item.url });
      }
    }
    if (seeds.length < limit) {
      const discoveryIgnored = new Set([
        ...ignored,
        ...seeds.map((seed) => compactName(seed.name)),
      ]);
      seeds.push(
        ...(await this.musicBrainzSeeds(
          limit - seeds.length,
          discoveryIgnored,
        ).catch(() => [])),
      );
    }
    return uniqueSeeds(seeds).slice(0, limit);
  }

  async wikidataSeeds(limit, ignored) {
    const queryLimit = Math.max(100, Math.min(500, Number(limit) * 2));
    const url =
      "https://query.wikidata.org/sparql?format=json&query=" +
      encodeURIComponent(`${WIKIDATA_CANDIDATE_QUERY}\nLIMIT ${queryLimit}`);
    const page = await this.researchNetwork.inspect(url);
    if (!page?.ok) return [];
    let bindings;
    try {
      bindings = JSON.parse(page.body)?.results?.bindings;
    } catch {
      return [];
    }
    if (!Array.isArray(bindings)) return [];
    return uniqueSeeds(
      bindings
        .map(structuredWikidataSeed)
        .filter(
          (seed) => seed && !ignored.has(compactName(seed.name)),
        ),
    ).slice(0, limit);
  }

  async musicBrainzSeeds(limit, ignored) {
    const dailyOffset = Math.floor(Date.now() / 86_400_000) % 400;
    const pages = [];
    for (const [index, query] of MUSICBRAINZ_DISCOVERY_QUERIES.entries()) {
      if (index && this.catalogueDelayMs)
        await new Promise((resolve) => setTimeout(resolve, this.catalogueDelayMs));
      pages.push(
        await this.researchNetwork
          .inspect(
            `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=100&offset=${dailyOffset + index * 100}`,
          )
          .catch(() => null),
      );
      if (uniqueMusicBrainzNames(pages, ignored).length >= limit) break;
    }
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
        if (Number(artist.score) < 60) continue;
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

function uniqueMusicBrainzNames(pages, ignored) {
  const names = [];
  for (const page of pages) {
    if (!page?.ok) continue;
    try {
      for (const artist of JSON.parse(page.body).artists || []) {
        if (Number(artist.score) < 60) continue;
        const name = cleanName(artist.name);
        if (name && !ignored.has(compactName(name))) names.push(name);
      }
    } catch {}
  }
  return [...new Set(names)];
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
  const requested = Math.max(1, Math.min(20, Number(count) || 20));
  const batchId = `bandbatch_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
  const existingNames = existingProjects.map((project) => project.name);
  onProgress({
    stage: "discovering",
    message: "Reading structured band records that already contain Linktree and the four required platform IDs.",
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
          message: `Checking ${seed.name}: verifying Linktree, Bandcamp, Instagram, Facebook, Spotify and an embeddable official YouTube video.`,
          reviewed: accepted.length + rejected.length,
          qualified: accepted.length,
          rejected: rejected.length,
        });
        try {
          const result = await research(
            {
              name: seed.name,
              sourceUrls: seed.sourceUrls,
              youtubeUrl: seed.youtubeUrl || "",
            },
            {
              network: researchNetwork,
              requirements: {
                requireFeaturedVideo: true,
                requiredDestinationKinds: MAHOGANY_BAND_PLATFORM_ORDER,
                skipSearchWhenSupplied: seed.sourceUrls.length >= 5,
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
          projectFromQualifiedBand(outcome.result, {
            batchId,
            linktreeUrl: outcome.qualification.linktreeUrl,
            catalogueUrl: outcome.seed.catalogueUrl || "",
          }),
        );
        accepted.push(project);
        existingNames.push(project.name);
      }
      onProgress({
        stage: "qualifying",
        message: `${accepted.length} qualified Linktree band${accepted.length === 1 ? "" : "s"} ready; incomplete platform sets remain excluded.`,
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
    gold: accepted.filter((project) => project.candidate?.grade === "gold").length,
    silver: accepted.filter((project) => project.candidate?.grade === "silver").length,
    rejections: rejected.slice(0, 40),
    rejectionReasons: summarizeCandidateRejections(rejected),
  };
  onProgress({
    stage: shortfall ? "completed_with_shortfall" : "completed",
    message: shortfall
      ? `${accepted.length} qualified Linktree band${accepted.length === 1 ? "" : "s"} reached the library. ${shortfall} places remain empty because incomplete results were rejected.`
      : "20 qualified bands were added as unpublished gold or silver drafts.",
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
  const linktreeUrl =
    (research?.roots || []).map((root) => root.url).find(isLinktreeURL) || "";
  if (!linktreeUrl)
    reasons.push("An artist-controlled Linktree was not verified.");
  const missingKinds = selectedKinds.filter((kind) => !selections[kind]);
  for (const kind of missingKinds)
    reasons.push(`${title(kind)} was not verified.`);
  const hasSourcedBiography = Boolean(
    research?.biography?.tickerBio && research.biography.sourceURL,
  );
  const featuredVideoUrl = research?.featuredVideo?.youtubeURL || "";
  const featuredVideoId = youtubeVideoId(featuredVideoUrl);
  const hasEmbeddableVideo = Boolean(featuredVideoId);
  return {
    ready: reasons.length === 0,
    reasons,
    selections,
    selectedKinds,
    verifiedKinds,
    missingKinds,
    linktreeUrl,
    featuredVideoUrl,
    featuredVideoId,
    hasEmbeddableVideo,
    grade: hasEmbeddableVideo ? "gold" : "silver",
    hasSourcedBiography,
    fullyVerified: reasons.length === 0,
  };
}

export function projectFromQualifiedBand(
  research,
  { batchId = "", linktreeUrl = "", catalogueUrl = "" } = {},
) {
  const checked = qualifyMahoganyBandResearch(research);
  if (!checked.ready)
    throw candidateError(checked.reasons.join(" "), "candidate_not_qualified");
  const now = new Date().toISOString();
  return normalizeMahoganyProject({
    ...newMahoganyProject(),
    name: research.bandName,
    tickerText: research.biography?.tickerBio || "",
    video: checked.hasEmbeddableVideo
      ? {
          kind: "youtube",
          youtubeUrl: checked.featuredVideoUrl,
          embedStatus: "playable",
          embedVideoId: checked.featuredVideoId,
          embedCheckedAt: research.featuredVideo?.verifiedAt || now,
          fileName: "",
          sizeBytes: 0,
          sha256: "",
        }
      : {
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
      status: "verified",
      grade: checked.grade,
      confidence: Math.max(
        MAHOGANY_BAND_INTAKE_CONFIDENCE,
        Math.min(
          ...checked.selectedKinds.map(
            (kind) => Number(checked.selections[kind]?.confidence) || 0,
          ),
        ),
      ),
      verifiedAt: research.verifiedAt || now,
      batchId,
      linktreeUrl: linktreeUrl || checked.linktreeUrl,
      catalogueUrl,
      youtubeEligible: checked.hasEmbeddableVideo,
      platformOrder: [...checked.selectedKinds],
      missingPlatforms: [...checked.missingKinds],
      reviewReasons: [
        ...(!checked.hasEmbeddableVideo
          ? [
              "Add an embeddable official YouTube video to upgrade this silver draft to gold.",
            ]
          : []),
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

function structuredWikidataSeed(binding) {
  const name = cleanName(binding?.itemLabel?.value);
  const linktreeId = identifier(binding?.linktree?.value, 120);
  const bandcampId = hostnameIdentifier(binding?.bandcamp?.value);
  const instagramId = identifier(binding?.instagram?.value, 120);
  const facebookId = identifier(binding?.facebook?.value, 160);
  const spotifyId = /^[A-Za-z0-9]{22}$/.test(binding?.spotify?.value || "")
    ? binding.spotify.value
    : "";
  const youtubeId = /^UC[A-Za-z0-9_-]{22}$/.test(binding?.youtube?.value || "")
    ? binding.youtube.value
    : "";
  const itemId = /^Q\d+$/.test(String(binding?.item?.value || "").split("/").at(-1))
    ? String(binding.item.value).split("/").at(-1)
    : "";
  if (!name || !linktreeId || !bandcampId || !instagramId || !facebookId || !spotifyId)
    return null;
  return {
    name,
    sourceUrls: [
      `https://linktr.ee/${encodeURIComponent(linktreeId)}`,
      `https://${bandcampId}.bandcamp.com/`,
      `https://www.instagram.com/${encodeURIComponent(instagramId)}/`,
      `https://www.facebook.com/${encodeURIComponent(facebookId)}/`,
      `https://open.spotify.com/artist/${spotifyId}`,
    ],
    youtubeUrl: youtubeId
      ? `https://www.youtube.com/channel/${youtubeId}`
      : "",
    catalogueUrl: itemId ? `https://www.wikidata.org/wiki/${itemId}` : "",
    discoveryURL: itemId ? `https://www.wikidata.org/wiki/${itemId}` : "",
  };
}

function identifier(value, max) {
  const text = String(value || "").trim();
  return text && text.length <= max && /^[A-Za-z0-9._-]+$/.test(text)
    ? text
    : "";
}

function hostnameIdentifier(value) {
  const text = String(value || "").trim().toLowerCase();
  return text && text.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(text)
    ? text
    : "";
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
  if (value.includes("linktree")) return "Linktree not verified";
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

function duckDuckGoItems(html) {
  const output = [];
  for (const match of String(html || "").matchAll(
    /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    try {
      const redirect = new URL(decodeXml(match[1]), "https://duckduckgo.com");
      const url = redirect.searchParams.get("uddg") || redirect.href;
      const title = decodeXml(match[2].replace(/<[^>]+>/g, " "));
      if (/^https:\/\//i.test(url)) output.push({ title, url });
    } catch {}
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

function bandNameFromLinktreeSearchItem({ title, url }) {
  let value = decodeXml(title)
    .replace(/\s*[|\-–—]\s*Linktree\s*$/i, "")
    .trim();
  const pipe = value.split(/\s*\|\s*/).filter(Boolean);
  if (pipe.length > 1) value = pipe[0];
  value = cleanName(value);
  if (value && !/^(linktree|music|band|artist)$/i.test(value)) return value;
  try {
    const parsed = new URL(url);
    return cleanName(
      parsed.pathname.split("/").filter(Boolean)[0]?.replace(/[-_]+/g, " "),
    );
  } catch {
    return "";
  }
}

function isLinktreeURL(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.replace(/^www\./, "").toLowerCase() === "linktr.ee" &&
      url.pathname.split("/").filter(Boolean).length === 1
    );
  } catch {
    return false;
  }
}

function isBandcampURL(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase().endsWith(".bandcamp.com")
    );
  } catch {
    return false;
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

export const __test = {
  duckDuckGoItems,
  isLinktreeURL,
  isBandcampURL,
  bandNameFromLinktreeSearchItem,
  structuredWikidataSeed,
};
