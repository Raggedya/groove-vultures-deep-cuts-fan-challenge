import crypto from "node:crypto";
import {
  newMahoganyProject,
  normalizeMahoganyProject,
  saveMahoganyProject,
} from "./mahogany-jukebox-model.mjs";
import { StudioResearchNetwork } from "./studio-jookbox-research.mjs";

export const BANDCAMP_DISCOVERY_SCHEMA = "aggits-bandcamp-discovery/1";
export const BANDCAMP_DISCOVERY_BATCH_SIZE = 20;
export const BANDCAMP_LINK_ORDER = Object.freeze([
  "bandcamp",
  "store",
  "facebook",
  "spotify",
]);

const SEARCH_QUERIES = Object.freeze([
  'site:bandcamp.com/album "{location}" band',
  'site:bandcamp.com/track "{location}" band',
  'site:bandcamp.com/music "{location}" band',
  'site:bandcamp.com/merch "{location}" band',
  'site:bandcamp.com "{location}" music band',
  'site:bandcamp.com "{location}" "about"',
]);
const WIKIDATA_BANDCAMP_QUERY = `
SELECT DISTINCT ?item ?itemLabel ?bandcamp ?spotify WHERE {
  ?item wdt:P31 wd:Q215380;
        wdt:P3283 ?bandcamp;
        wdt:P1902 ?spotify.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?item
LIMIT 500
`;

export class BandcampDiscoveryNetwork {
  constructor({ network = new StudioResearchNetwork() } = {}) {
    this.network = network;
  }

  async inspect(url) {
    return this.network.inspect(url);
  }

  async search(query) {
    const page = await this.inspect(
      `https://www.bing.com/search?format=rss&count=50&q=${encodeURIComponent(query)}`,
    );
    const bing = page?.ok ? bingItems(page.body) : [];
    if (bing.length) return bing;
    const fallback = await this.inspect(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    );
    return fallback?.ok ? duckDuckGoItems(fallback.body) : [];
  }

  async discoverSeeds({ location = "", limit = 80 } = {}) {
    const locationTerm = clean(location, 100) || "independent music";
    const structured = await this.wikidataSeeds({
      location: locationTerm,
      limit,
    }).catch(() => []);
    if (structured.length >= limit) return structured.slice(0, limit);
    const pages = await Promise.all(
      SEARCH_QUERIES.map((template) =>
        this.search(template.replace("{location}", locationTerm)).catch(() => []),
      ),
    );
    const seeds = [...structured];
    for (const item of pages.flat()) {
      const url = cleanBandcampURL(item.url);
      if (!url) continue;
      seeds.push({ url, title: item.title, description: item.description });
    }
    return uniqueBy(seeds, (seed) => canonicalURL(seed.url)).slice(0, limit);
  }

  async wikidataSeeds({ location = "", limit = 80 } = {}) {
    const keyword = clean(location, 100)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .find((token) => token.length > 3),
      locationQuery = keyword
        ? `
SELECT DISTINCT ?item ?itemLabel ?bandcamp ?spotify ?placeLabel WHERE {
  ?item wdt:P31 wd:Q215380;
        wdt:P3283 ?bandcamp;
        wdt:P1902 ?spotify.
  { ?item wdt:P740 ?place. } UNION { ?item wdt:P495 ?place. }
  ?place rdfs:label ?placeLabel.
  FILTER(LANG(?placeLabel) = "en" && CONTAINS(LCASE(STR(?placeLabel)), "${keyword}"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?item
LIMIT 200
`
        : "",
      queries = [locationQuery, WIKIDATA_BANDCAMP_QUERY].filter(Boolean),
      seeds = [];
    for (const query of queries) {
      const page = await this.inspect(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      );
      if (!page?.ok) continue;
      try {
        for (const binding of JSON.parse(page.body)?.results?.bindings || []) {
          const seed = wikidataSeed(binding);
          if (seed) seeds.push(seed);
        }
      } catch {}
      if (uniqueBy(seeds, (seed) => canonicalURL(seed.url)).length >= limit)
        break;
    }
    return uniqueBy(seeds, (seed) => canonicalURL(seed.url))
      .sort(
        (left, right) =>
          locationScore(right.location, location) -
            locationScore(left.location, location) ||
          left.name.localeCompare(right.name),
      )
      .slice(0, limit);
  }

  async findPlatform({ kind, bandName, location = "", evidence = [] }) {
    const direct = firstPlatformURL(kind, evidence);
    if (direct)
      return field(
        direct,
        "confirmed",
        "Direct platform identifier confirmed from Bandcamp or a structured artist record.",
      );
    const domain = kind === "spotify" ? "open.spotify.com/artist" : "facebook.com";
    const query = `"${bandName}" ${location ? `"${location}" ` : ""}site:${domain}`;
    const items = await this.search(query).catch(() => []);
    let possible = "";
    for (const item of items.slice(0, 6)) {
      const url = directPlatformURL(kind, item.url);
      if (!url) continue;
      const match = identityMatch(bandName, `${item.title} ${item.description}`);
      if (match === "confirmed")
        return field(url, "confirmed", "Artist identity matched in search evidence.");
      if (!possible && match === "possible") possible = url;
    }
    return possible
      ? field(possible, "possible", "A possible match needs manual confirmation.")
      : field("", "not_found", "No identity-confirmed page was found.");
  }
}

export async function runBandcampDiscoveryBatch({
  count = BANDCAMP_DISCOVERY_BATCH_SIZE,
  location = "",
  existingProjects = [],
  discovery = new BandcampDiscoveryNetwork(),
  onProgress = () => {},
  shouldCancel = () => false,
  maxSeeds = 80,
} = {}) {
  const requested = Math.max(1, Math.min(20, Number(count) || 20));
  const existing = duplicateIndex(existingProjects);
  onProgress({
    stage: "searching_bandcamp",
    message: "Searching Bandcamp...",
    found: 0,
    requested,
    reviewed: 0,
  });
  const seeds = await discovery.discoverSeeds({ location, limit: maxSeeds });
  const results = [];
  let reviewed = 0;
  for (let offset = 0; offset < seeds.length && results.length < requested; offset += 3) {
    if (shouldCancel()) break;
    const outcomes = await Promise.all(
      seeds.slice(offset, offset + 3).map((seed) =>
        inspectBandcampCandidate(seed, { location, discovery }).catch(() => null),
      ),
    );
    for (const result of outcomes) {
      reviewed += 1;
      if (!result || isDuplicateDiscovery(result, existing)) continue;
      if (results.some((item) => duplicateBand(item, result))) continue;
      results.push(result);
      onProgress({
        stage: results.length < requested ? "validating_links" : "ready",
        message:
          results.length < requested
            ? `Validating links... ${results.length} / ${requested} bands found`
            : `${requested} bands ready`,
        found: results.length,
        requested,
        reviewed,
      });
      if (results.length >= requested) break;
    }
  }
  const cancelled = shouldCancel();
  return {
    schemaVersion: BANDCAMP_DISCOVERY_SCHEMA,
    requested,
    found: results.length,
    reviewed,
    location: clean(location, 100),
    cancelled,
    results,
  };
}

export async function addBandcampDiscoveriesToLibrary({
  projectRoot,
  discoveries = [],
  selectedIds = [],
  existingProjects = [],
} = {}) {
  if (!projectRoot) throw discoveryError("Band Library storage is unavailable.");
  const wanted = new Set(selectedIds.map(String));
  const existing = [...existingProjects];
  const added = [];
  const duplicates = [];
  for (const discovery of discoveries) {
    if (!wanted.has(discovery.id)) continue;
    const duplicate = findDuplicateProject(discovery, existing);
    if (duplicate) {
      duplicates.push({ discoveryId: discovery.id, projectId: duplicate.id });
      continue;
    }
    const project = await saveMahoganyProject(
      projectRoot,
      projectFromBandcampDiscovery(discovery),
    );
    existing.push(project);
    added.push(project);
  }
  return { added, duplicates };
}

export function projectFromBandcampDiscovery(discovery) {
  if (discovery?.links?.bandcamp?.status !== "confirmed")
    throw discoveryError("A confirmed Bandcamp anchor is required.");
  const now = new Date().toISOString();
  const actions = [
    ["bandcamp", "bandcamp", "Bandcamp"],
    ["store", "shop", "Store"],
    ["facebook", "facebook", "Facebook"],
    ["spotify", "spotify", "Spotify"],
  ].map(([kind, iconId, label], index) => ({
    slot: index + 1,
    iconId,
    label,
    href:
      discovery.links?.[kind]?.status === "confirmed"
        ? discovery.links[kind].url
        : "",
    openInNewTab: true,
  }));
  return normalizeMahoganyProject({
    ...newMahoganyProject(),
    name: discovery.bandName,
    tickerText: [discovery.bandName, discovery.location].filter(Boolean).join(" · "),
    appearance: "mahogany-vu",
    actions,
    status: "draft",
    candidate: {
      kind: "band",
      source: "bandcamp_discovery",
      status: "manual_review",
      grade: "",
      confidence: 0,
      verifiedAt: now,
      batchId: discovery.batchId || "",
      platformOrder: [...BANDCAMP_LINK_ORDER],
      missingPlatforms: BANDCAMP_LINK_ORDER.filter(
        (kind) => discovery.links?.[kind]?.status !== "confirmed",
      ),
      evidenceUrls: BANDCAMP_LINK_ORDER.map(
        (kind) => discovery.links?.[kind]?.url,
      ).filter(Boolean),
      bandId: discovery.bandId || discovery.id,
      location: discovery.location || "",
      bandcampUrl: discovery.links.bandcamp.url,
      bandcampStoreUrl:
        discovery.links.store?.status === "confirmed"
          ? discovery.links.store.url
          : "",
      facebookUrl:
        discovery.links.facebook?.status === "confirmed"
          ? discovery.links.facebook.url
          : "",
      spotifyUrl:
        discovery.links.spotify?.status === "confirmed"
          ? discovery.links.spotify.url
          : "",
      linkScore: discovery.linkScore,
      dateDiscovered: discovery.dateDiscovered || now,
      discoverySource: "Bandcamp",
      audioStatus: "Not Added",
      audioFile: "",
      trackName: "",
      purchaseStatus: "Not Purchased",
      notes: "",
    },
  });
}

async function inspectBandcampCandidate(seed, { location, discovery }) {
  const page = await discovery.inspect(seed.url);
  if (!page?.ok) return null;
  const bandcampUrl = cleanBandcampURL(page.finalURL || seed.url);
  if (!bandcampUrl) return null;
  const identity = bandcampIdentity(page, seed);
  if (!identity.bandName) return null;
  if (seed.name && !sameArtistIdentity(identity.bandName, seed.name)) return null;
  const host = new URL(bandcampUrl).hostname.toLowerCase();
  const artistUrl = `https://${host}/`;
  const bodyURLs = extractURLs(page.body);
  const storeCandidate =
    bodyURLs.find((url) => sameHostPath(url, host, "/merch")) ||
    `https://${host}/merch`;
  const storePage = await discovery.inspect(storeCandidate).catch(() => null);
  const store =
    storePage?.ok &&
    sameHostPath(storePage.finalURL || storeCandidate, host, "/merch") &&
    hasBandcampMerch(storePage.body)
      ? field(storePage.finalURL || storeCandidate, "confirmed", "Confirmed Bandcamp merchandise page.")
      : field("", "not_found", "No Bandcamp merchandise page was confirmed.");
  const evidence = [
    ...bodyURLs,
    ...extractURLs(storePage?.body || ""),
    seed.facebookUrl || "",
    seed.spotifyUrl || "",
  ].filter(Boolean);
  const facebook = await discovery.findPlatform({
    kind: "facebook",
    bandName: identity.bandName,
    location: identity.location || location,
    evidence,
  });
  const spotify = await discovery.findPlatform({
    kind: "spotify",
    bandName: identity.bandName,
    location: identity.location || location,
    evidence,
  });
  const links = {
    bandcamp: field(artistUrl, "confirmed", "Bandcamp artist identity confirmed."),
    store,
    facebook,
    spotify,
  };
  const linkScore = BANDCAMP_LINK_ORDER.filter(
    (kind) => links[kind].status === "confirmed",
  ).length;
  return {
    id: `band_${crypto.createHash("sha256").update(canonicalURL(artistUrl)).digest("hex").slice(0, 12)}`,
    bandId: `bc_${crypto.createHash("sha256").update(canonicalURL(artistUrl)).digest("hex").slice(0, 16)}`,
    bandName: identity.bandName,
    location: identity.location || seed.location || "",
    links,
    linkScore,
    status: scoreStatus(linkScore),
    dateDiscovered: new Date().toISOString(),
    discoverySource: "Bandcamp",
  };
}

function hasBandcampMerch(html) {
  return /(?:merch-item|merch-grid|merch_title|package_art|buyItemPackage|item_type["']?\s*:\s*["']?p)/i.test(
    String(html || ""),
  );
}

function bandcampIdentity(page, seed) {
  const body = decodeHtml(String(page.body || ""));
  const jsonArtist = body.match(/"artist"\s*:\s*"([^"]{2,120})"/i)?.[1];
  const title = decodeHtml(page.title || seed.title || "").replace(/\s+/g, " ").trim();
  const byMatch = title.match(/\bby\s+([^|]+?)(?:\s*\||$)/i);
  const pipe = title.split(/\s*\|\s*/).filter(Boolean);
  const bandName = clean(
    jsonArtist || byMatch?.[1] || (pipe.length > 1 ? pipe.at(-1) : "") || seed.name,
    120,
  ).replace(/\s*[-–—]\s*Bandcamp$/i, "");
  const location = clean(
    body.match(/"location"\s*:\s*"([^"]{2,100})"/i)?.[1] ||
      body.match(/class="location[^>]*>\s*([^<]{2,100})</i)?.[1] ||
      "",
    100,
  );
  return { bandName, location };
}

function wikidataSeed(binding) {
  const name = clean(binding?.itemLabel?.value, 120),
    handle = String(binding?.bandcamp?.value || "").trim().toLowerCase(),
    facebook = String(binding?.facebook?.value || "").trim(),
    spotify = String(binding?.spotify?.value || "").trim(),
    formation = clean(
      binding?.placeLabel?.value || binding?.formationLabel?.value,
      100,
    ),
    country = clean(binding?.countryLabel?.value, 100),
    location = uniqueBy(
      [formation, country].filter(Boolean),
      (value) => value.toLowerCase(),
    ).join(", ");
  if (!name || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle)) return null;
  return {
    name,
    location,
    url: `https://${handle}.bandcamp.com/`,
    title: `Music | ${name}`,
    description: location,
    facebookUrl: /^[A-Za-z0-9._-]+$/.test(facebook)
      ? `https://www.facebook.com/${facebook}`
      : "",
    spotifyUrl: /^[A-Za-z0-9]{22}$/.test(spotify)
      ? `https://open.spotify.com/artist/${spotify}`
      : "",
  };
}

function locationScore(candidate, requested) {
  const haystack = clean(candidate, 200).toLowerCase(),
    tokens = clean(requested, 100)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2);
  return tokens.reduce(
    (score, token, index) => score + (haystack.includes(token) ? 10 - Math.min(index, 5) : 0),
    0,
  );
}

function field(url, status, reason) {
  return { url: url || "", status, reason };
}

function scoreStatus(score) {
  return score === 4
    ? "COMPLETE"
    : score === 3
      ? "GOOD"
      : score === 2
        ? "PARTIAL"
        : "BANDCAMP ONLY";
}

function duplicateIndex(projects) {
  return {
    names: new Set(projects.map((project) => compact(project.name)).filter(Boolean)),
    bandcamp: new Set(
      projects.map((project) => canonicalURL(project.candidate?.bandcampUrl)).filter(Boolean),
    ),
    spotify: new Set(projects.map((project) => spotifyArtistId(project.candidate?.spotifyUrl)).filter(Boolean)),
  };
}

function isDuplicateDiscovery(discovery, index) {
  return (
    index.names.has(compact(discovery.bandName)) ||
    index.bandcamp.has(canonicalURL(discovery.links.bandcamp.url)) ||
    Boolean(
      spotifyArtistId(discovery.links.spotify.url) &&
        index.spotify.has(spotifyArtistId(discovery.links.spotify.url)),
    )
  );
}

function findDuplicateProject(discovery, projects) {
  return projects.find((project) =>
    duplicateBand(
      {
        bandName: project.name,
        links: {
          bandcamp: { url: project.candidate?.bandcampUrl || "" },
          spotify: { url: project.candidate?.spotifyUrl || "" },
        },
      },
      discovery,
    ),
  );
}

function duplicateBand(left, right) {
  const leftSpotify = spotifyArtistId(left.links?.spotify?.url);
  const rightSpotify = spotifyArtistId(right.links?.spotify?.url);
  return (
    compact(left.bandName) === compact(right.bandName) ||
    (canonicalURL(left.links?.bandcamp?.url) &&
      canonicalURL(left.links?.bandcamp?.url) === canonicalURL(right.links?.bandcamp?.url)) ||
    (leftSpotify && leftSpotify === rightSpotify)
  );
}

function identityMatch(name, evidence) {
  const wanted = compact(name);
  const found = compact(decodeHtml(evidence));
  if (!wanted || !found.includes(wanted)) return "none";
  const nameWords = clean(name, 120).toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  return nameWords.length > 1 || /\b(?:band|artist|music|spotify|facebook)\b/i.test(evidence)
    ? "confirmed"
    : "possible";
}

function sameArtistIdentity(left, right) {
  const a = compact(left),
    b = compact(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b,
    longer = a.length > b.length ? a : b;
  return shorter.length >= 7 && longer.includes(shorter);
}

function firstPlatformURL(kind, urls) {
  for (const item of urls) {
    const url = directPlatformURL(kind, item);
    if (url) return url;
  }
  return "";
}

function directPlatformURL(kind, value) {
  try {
    const url = new URL(decodeHtml(value));
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (url.protocol !== "https:") return "";
    if (kind === "spotify" && host === "open.spotify.com" && /^\/artist\/[A-Za-z0-9]+/.test(url.pathname))
      return `https://open.spotify.com${url.pathname}`;
    if (kind === "facebook" && ["facebook.com", "m.facebook.com"].includes(host)) {
      const first = url.pathname.split("/").filter(Boolean)[0] || "";
      if (
        first &&
        ![
          "dialog",
          "events",
          "groups",
          "help",
          "login",
          "pages",
          "plugins",
          "privacy",
          "share",
          "sharer",
        ].includes(first.toLowerCase())
      )
        return `https://www.facebook.com/${first}`;
    }
  } catch {}
  return "";
}

function cleanBandcampURL(value) {
  try {
    const url = new URL(decodeHtml(value));
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (url.protocol !== "https:" || !host.endsWith(".bandcamp.com")) return "";
    if (["bandcamp.com", "daily.bandcamp.com"].includes(host)) return "";
    url.hash = "";
    url.search = "";
    return url.href;
  } catch {
    return "";
  }
}

function sameHostPath(value, host, prefix) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === host && url.pathname.toLowerCase().startsWith(prefix);
  } catch {
    return false;
  }
}

function spotifyArtistId(value) {
  try {
    const match = new URL(value || "").pathname.match(/^\/artist\/([A-Za-z0-9]+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function extractURLs(html) {
  const decoded = decodeHtml(String(html || "").replaceAll("\\/", "/"));
  return uniqueBy(
    [...decoded.matchAll(/https:\/\/[^\s"'<>\\]+/gi)].map((match) => match[0].replace(/[),.;]+$/, "")),
    canonicalURL,
  );
}

function bingItems(xml) {
  const output = [];
  for (const match of String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const title = xmlValue(item, "title");
    const url = xmlValue(item, "link");
    const description = xmlValue(item, "description");
    if (/^https:\/\//i.test(url)) output.push({ title, url, description });
  }
  return output;
}

function duckDuckGoItems(html) {
  const output = [];
  for (const match of String(html || "").matchAll(
    /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/gi,
  )) {
    try {
      const redirect = new URL(decodeHtml(match[1]), "https://duckduckgo.com"),
        url = redirect.searchParams.get("uddg") || redirect.href,
        title = clean(match[2], 240),
        description = clean(match[3], 500);
      if (/^https:\/\//i.test(url)) output.push({ title, url, description });
    } catch {}
  }
  return output;
}

function xmlValue(item, tag) {
  return decodeHtml(
    item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "",
  ).replace(/^<!\[CDATA\[|\]\]>$/g, "");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function canonicalURL(value) {
  try {
    const url = new URL(value || "");
    url.hash = "";
    url.search = "";
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "") || "/"}`;
  } catch {
    return "";
  }
}

function compact(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function clean(value, max) {
  return decodeHtml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function uniqueBy(items, keyFor) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function discoveryError(message, code = "bandcamp_discovery_failed") {
  return Object.assign(new Error(message), { code });
}

export const __test = {
  bandcampIdentity,
  bingItems,
  duckDuckGoItems,
  cleanBandcampURL,
  directPlatformURL,
  duplicateBand,
  extractURLs,
  identityMatch,
  hasBandcampMerch,
  locationScore,
  sameArtistIdentity,
  scoreStatus,
  spotifyArtistId,
  wikidataSeed,
};
