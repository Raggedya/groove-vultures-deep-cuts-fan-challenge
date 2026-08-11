import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AGGITS_JUKEBOX_ICONS,
  aggitsJukeboxIcon,
} from "./aggits-jukebox-icons.mjs";
import {
  DEFAULT_DUCKING_SETTINGS,
  DUCKING_ANALYSIS_VERSION,
  normalizeDuckingSettings,
} from "../mahogany-studio/audio-ducking.js";

export const MAHOGANY_PROJECT_SCHEMA = "mahogany-jukebox-project/1";
export const MAHOGANY_PUBLICATION_MANIFEST_SCHEMA =
  "deep-cuts-mahogany-jukebox-publication/2";
export const MAHOGANY_VIDEO_MAX_BYTES = 24 * 1024 * 1024;
export const MAHOGANY_AUDIO_MAX_BYTES = 48 * 1024 * 1024;
export const MAHOGANY_CHARACTER_MAX_BYTES = 24 * 1024 * 1024;
export const MAHOGANY_ACTION_COUNT = 4;

export function newMahoganyProject() {
  const now = new Date().toISOString();
  return {
    schemaVersion: MAHOGANY_PROJECT_SCHEMA,
    id: `studio_${crypto.randomBytes(6).toString("hex")}`,
    name: "",
    tickerText: "",
    appearance: "mahogany-master",
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
    vu: {
      music: {
        fileName: "",
        trackName: "",
        sizeBytes: 0,
        sha256: "",
        mimeType: "",
      },
      character: { fileName: "", sizeBytes: 0, sha256: "", mimeType: "" },
      ducking: {
        ...DEFAULT_DUCKING_SETTINGS,
        analysis: {
          status: "none",
          version: "",
          sourceSha256: "",
          durationSeconds: 0,
          regions: [],
          analysedAt: "",
          error: "",
        },
      },
    },
    actions: Array.from({ length: MAHOGANY_ACTION_COUNT }, (_, index) => ({
      slot: index + 1,
      iconId: ["spotify", "youtube", "instagram", "facebook"][index],
      label: ["Spotify", "YouTube", "Instagram", "Facebook"][index],
      href: "",
      openInNewTab: true,
    })),
    status: "draft",
    candidate: null,
    publicationProgress: null,
    publication: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeMahoganyProject(value) {
  const base = newMahoganyProject(),
    source = value && typeof value === "object" ? value : {};
  const project = { ...base, ...source };
  project.schemaVersion = MAHOGANY_PROJECT_SCHEMA;
  project.id = /^studio_[a-f0-9]{12}$/.test(String(source.id || ""))
    ? source.id
    : base.id;
  project.name = clean(source.name, 120);
  project.tickerText = multiline(source.tickerText, 500);
  project.appearance =
    source.appearance === "mahogany-vu" ? "mahogany-vu" : "mahogany-master";
  const video =
    source.video && typeof source.video === "object" ? source.video : {};
  project.video = {
    kind: video.kind === "mp4" ? "mp4" : "youtube",
    youtubeUrl: clean(video.youtubeUrl, 300),
    embedStatus: video.embedStatus === "playable" ? "playable" : "",
    embedVideoId: /^[A-Za-z0-9_-]{11}$/.test(String(video.embedVideoId || ""))
      ? String(video.embedVideoId)
      : "",
    embedCheckedAt: validDate(video.embedCheckedAt),
    fileName: clean(video.fileName, 180),
    sizeBytes: Number(video.sizeBytes) || 0,
    sha256: /^[a-f0-9]{64}$/.test(String(video.sha256 || ""))
      ? String(video.sha256)
      : "",
  };
  const vu = source.vu && typeof source.vu === "object" ? source.vu : {},
    music = vu.music && typeof vu.music === "object" ? vu.music : {},
    character =
      vu.character && typeof vu.character === "object" ? vu.character : {};
  project.vu = {
    music: normalizeStoredMedia(music, ["audio/mpeg", "audio/wav"]),
    character: normalizeStoredMedia(character, ["video/mp4"]),
    ducking: normalizeDucking(vu.ducking),
  };
  const incoming = Array.isArray(source.actions) ? source.actions : [];
  project.actions = Array.from(
    { length: MAHOGANY_ACTION_COUNT },
    (_, index) => {
      const fallback = base.actions[index],
        item = incoming[index] || {};
      return {
        slot: index + 1,
        iconId: aggitsJukeboxIcon(item.iconId) ? item.iconId : fallback.iconId,
        label: clean(item.label, 22),
        href: clean(item.href, 500),
        openInNewTab: item.openInNewTab !== false,
      };
    },
  );
  project.status = [
    "draft",
    "prepared",
    "publishing",
    "published",
    "unpublished",
    "failed",
  ].includes(source.status)
    ? source.status
    : "draft";
  project.candidate =
    source.candidate && typeof source.candidate === "object"
      ? {
          kind: source.candidate.kind === "band" ? "band" : "",
          source:
            ["automatic_batch", "bandcamp_discovery"].includes(
              source.candidate.source,
            )
              ? source.candidate.source
              : "",
          status:
            ["verified", "manual_review"].includes(source.candidate.status)
              ? source.candidate.status
              : "",
          grade: ["gold", "silver"].includes(source.candidate.grade)
            ? source.candidate.grade
            : "",
          confidence: Math.max(
            0,
            Math.min(100, Number(source.candidate.confidence) || 0),
          ),
          verifiedAt: validDate(source.candidate.verifiedAt),
          batchId: clean(source.candidate.batchId, 80),
          linktreeUrl: clean(source.candidate.linktreeUrl, 500),
          catalogueUrl: clean(source.candidate.catalogueUrl, 500),
          youtubeEligible: source.candidate.youtubeEligible === true,
          platformOrder: Array.isArray(source.candidate.platformOrder)
            ? source.candidate.platformOrder
                .map((item) => clean(item, 30))
                .filter(Boolean)
                .slice(0, MAHOGANY_ACTION_COUNT)
            : [],
          missingPlatforms: Array.isArray(source.candidate.missingPlatforms)
            ? source.candidate.missingPlatforms
                .map((item) => clean(item, 30))
                .filter(Boolean)
                .slice(0, MAHOGANY_ACTION_COUNT)
            : [],
          reviewReasons: Array.isArray(source.candidate.reviewReasons)
            ? source.candidate.reviewReasons
                .map((item) => clean(item, 180))
                .filter(Boolean)
                .slice(0, 8)
            : [],
          evidenceUrls: Array.isArray(source.candidate.evidenceUrls)
            ? source.candidate.evidenceUrls
                .map((item) => clean(item, 500))
                .filter(Boolean)
                .slice(0, 20)
            : [],
          bandId: clean(source.candidate.bandId, 80),
          location: clean(source.candidate.location, 120),
          bandcampUrl: clean(source.candidate.bandcampUrl, 500),
          bandcampStoreUrl: clean(source.candidate.bandcampStoreUrl, 500),
          facebookUrl: clean(source.candidate.facebookUrl, 500),
          spotifyUrl: clean(source.candidate.spotifyUrl, 500),
          linkScore: Math.max(
            1,
            Math.min(4, Number(source.candidate.linkScore) || 1),
          ),
          dateDiscovered: validDate(source.candidate.dateDiscovered),
          discoverySource:
            source.candidate.discoverySource === "Bandcamp" ? "Bandcamp" : "",
          audioStatus:
            source.candidate.audioStatus === "Added" ? "Added" : "Not Added",
          audioFile: clean(source.candidate.audioFile, 180),
          trackName: clean(source.candidate.trackName, 180),
          purchaseStatus:
            source.candidate.purchaseStatus === "Purchased"
              ? "Purchased"
              : "Not Purchased",
          notes: multiline(source.candidate.notes, 1000),
        }
      : null;
  project.publication =
    source.publication && typeof source.publication === "object"
      ? source.publication
      : null;
  project.publicationProgress =
    source.publicationProgress &&
    typeof source.publicationProgress === "object"
      ? {
          stage: clean(source.publicationProgress.stage, 60),
          message: clean(source.publicationProgress.message, 240),
          updatedAt: validDate(source.publicationProgress.updatedAt),
        }
      : null;
  project.createdAt = validDate(source.createdAt) || base.createdAt;
  project.updatedAt = validDate(source.updatedAt) || base.updatedAt;
  return project;
}

export function validateMahoganyProject(
  project,
  { requireStoredMp4 = false } = {},
) {
  const value = normalizeMahoganyProject(project),
    errors = [];
  if (!value.name) errors.push("Enter the Jukebox name.");
  if (!value.tickerText) errors.push("Enter the ticker text.");
  if (value.appearance === "mahogany-vu") {
    const hasMusic = Boolean(
        value.vu.music.fileName &&
          value.vu.music.sha256 &&
          value.vu.music.sizeBytes > 0,
      ),
      hasPresenter = Boolean(
        value.vu.character.fileName &&
          value.vu.character.sha256 &&
          value.vu.character.sizeBytes > 0,
      );
    if (!hasMusic && !hasPresenter)
      errors.push("Choose an MP3/WAV song or an Aggits presenter video.");
    if (value.vu.music.sizeBytes > MAHOGANY_AUDIO_MAX_BYTES)
      errors.push("The VU music file must be 48 MiB or smaller.");
  } else if (value.video.kind === "youtube") {
    const youtubeId = youtubeVideoId(value.video.youtubeUrl);
    if (!youtubeId)
      errors.push("Enter a valid YouTube video URL.");
    else if (
      value.video.embedStatus !== "playable" ||
      value.video.embedVideoId !== youtubeId ||
      !value.video.embedCheckedAt
    )
      errors.push(
        "Publish to verify that YouTube allows this video to be embedded.",
      );
  } else {
    if (
      !value.video.fileName ||
      !value.video.sha256 ||
      value.video.sizeBytes <= 0
    )
      errors.push("Choose a valid local MP4.");
    if (value.video.sizeBytes > MAHOGANY_VIDEO_MAX_BYTES)
      errors.push("The public MP4 must be 24 MiB or smaller.");
    if (requireStoredMp4 && !value.video.fileName)
      errors.push("The stored MP4 is missing.");
  }
  if (value.actions.length !== MAHOGANY_ACTION_COUNT)
    errors.push("Exactly four action keys are required.");
  for (const action of value.actions) {
    if (!aggitsJukeboxIcon(action.iconId))
      errors.push(`Choose an approved icon for key ${action.slot}.`);
    if (!action.label) errors.push(`Enter a label for key ${action.slot}.`);
    if (!safeDestination(action.href))
      errors.push(`Enter a valid destination for key ${action.slot}.`);
  }
  return { ready: errors.length === 0, errors, value };
}

export function toPreviewProject(project) {
  const value = normalizeMahoganyProject(project);
  return {
    schemaVersion: "deep-cuts-studio-project/1",
    id: value.id,
    appearance: value.appearance,
    vu: value.vu,
    input: {
      type: "aggits_jukebox",
      name: value.name,
      tickerText: value.tickerText,
      youtubeUrl: value.video.kind === "youtube" ? value.video.youtubeUrl : "",
      actionButtons: value.actions.map((action) => ({
        enabled: true,
        ...action,
        actionType: actionType(action.href),
      })),
    },
    mp4:
      value.video.kind === "mp4"
        ? {
            fileName: value.video.fileName,
            sizeBytes: value.video.sizeBytes,
            sha256: value.video.sha256,
          }
        : null,
    readiness: { handoffReady: validateMahoganyProject(value).ready },
    revision: 1,
    status: value.status,
    editionId: value.publication?.editionId || "",
  };
}

export function buildMahoganyManifest(project) {
  const checked = validateMahoganyProject(project, { requireStoredMp4: true });
  if (!checked.ready)
    throw modelError(checked.errors.join(" "), "project_not_ready");
  const value = checked.value,
    youtubeId = youtubeVideoId(value.video.youtubeUrl);
  if (value.appearance === "mahogany-vu")
    return {
      schemaVersion: MAHOGANY_PUBLICATION_MANIFEST_SCHEMA,
      projectId: value.id,
      appearance: "mahogany-vu",
      title: value.name,
      tickerText: value.tickerText,
      actions: value.actions.map((action) => ({
        slot: action.slot,
        iconId: action.iconId,
        label: action.label,
        actionType: actionType(action.href),
        href: safeDestination(action.href),
        openInNewTab: action.openInNewTab,
      })),
      vu: {
        music: { ...value.vu.music },
        character: { ...value.vu.character },
        ducking: JSON.parse(JSON.stringify(value.vu.ducking)),
      },
    };
  return {
    schemaVersion: MAHOGANY_PUBLICATION_MANIFEST_SCHEMA,
    projectId: value.id,
    appearance: "mahogany-master",
    title: value.name,
    tickerText: value.tickerText,
    actions: value.actions.map((action) => ({
      slot: action.slot,
      iconId: action.iconId,
      label: action.label,
      actionType: actionType(action.href),
      href: safeDestination(action.href),
      openInNewTab: action.openInNewTab,
    })),
    video:
      value.video.kind === "youtube"
        ? {
            kind: "youtube",
            youtubeUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
            embedStatus: value.video.embedStatus,
            embedVideoId: value.video.embedVideoId,
            embedCheckedAt: value.video.embedCheckedAt,
            sha256: crypto
              .createHash("sha256")
              .update(`youtube:${youtubeId}`)
              .digest("hex"),
          }
        : {
            kind: "mp4",
            fileName: value.video.fileName,
            sizeBytes: value.video.sizeBytes,
            sha256: value.video.sha256,
          },
  };
}

export async function saveMahoganyProject(projectRoot, project) {
  const value = normalizeMahoganyProject({
    ...project,
    updatedAt: new Date().toISOString(),
  });
  const directory = path.join(projectRoot, value.id);
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, "project.json"),
    temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, file);
  return value;
}

export async function loadMahoganyProject(projectRoot, id) {
  if (!/^studio_[a-f0-9]{12}$/.test(String(id || "")))
    throw modelError("Invalid Mahogany Jukebox identity.", "project_invalid");
  try {
    return normalizeMahoganyProject(
      JSON.parse(
        await fs.readFile(path.join(projectRoot, id, "project.json"), "utf8"),
      ),
    );
  } catch (error) {
    if (error.code === "ENOENT")
      throw modelError("Mahogany Jukebox not found.", "project_not_found");
    throw error;
  }
}

export async function listMahoganyProjects(projectRoot) {
  const entries = await fs
      .readdir(projectRoot, { withFileTypes: true })
      .catch((error) => (error.code === "ENOENT" ? [] : Promise.reject(error))),
    projects = [];
  for (const entry of entries)
    if (entry.isDirectory() && /^studio_[a-f0-9]{12}$/.test(entry.name)) {
      try {
        projects.push(await loadMahoganyProject(projectRoot, entry.name));
      } catch {}
    }
  return projects.sort((a, b) =>
    String(b.updatedAt).localeCompare(String(a.updatedAt)),
  );
}

export async function archiveMahoganyProject(projectRoot, id) {
  const project = await loadMahoganyProject(projectRoot, id);
  if (
    ["published", "unpublished"].includes(project.status) ||
    project.publication?.editionId ||
    project.prepared?.editionId
  )
    throw modelError(
      "Published jukeboxes cannot be deleted because their permanent URL and QR identity must be preserved.",
      "project_identity_protected",
    );
  const archiveRoot = path.join(path.dirname(projectRoot), "archive", "projects");
  await fs.mkdir(archiveRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivedPath = path.join(archiveRoot, `${id}-${stamp}`);
  await fs.rename(path.join(projectRoot, id), archivedPath);
  return { project, archivedPath };
}

export async function storeMahoganyMp4(projectRoot, project, bytes, fileName) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length < 12 ||
    String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp"
  )
    throw modelError("Choose a valid MP4 file.", "video_invalid");
  if (bytes.length > MAHOGANY_VIDEO_MAX_BYTES)
    throw modelError(
      "The public MP4 must be 24 MiB or smaller.",
      "video_too_large",
    );
  const directory = path.join(projectRoot, project.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "video.mp4"), bytes);
  return normalizeMahoganyProject({
    ...project,
    video: {
      kind: "mp4",
      youtubeUrl: "",
      fileName: clean(fileName, 180) || "video.mp4",
      sizeBytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    },
  });
}

export async function storeMahoganyVuMusic(
  projectRoot,
  project,
  bytes,
  fileName,
) {
  const name = clean(fileName, 180),
    isWav =
      bytes instanceof Uint8Array &&
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WAVE",
    isMp3 =
      bytes instanceof Uint8Array &&
      bytes.length >= 3 &&
      (String.fromCharCode(...bytes.subarray(0, 3)) === "ID3" ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  if (!isWav && !isMp3)
    throw modelError("Choose a valid MP3 or WAV file.", "audio_invalid");
  if (bytes.length > MAHOGANY_AUDIO_MAX_BYTES)
    throw modelError("The VU music file must be 48 MiB or smaller.", "audio_too_large");
  const extension = isWav ? "wav" : "mp3",
    mimeType = isWav ? "audio/wav" : "audio/mpeg",
    trackName = clean(
      String(name || `music.${extension}`)
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      180,
    ),
    directory = path.join(projectRoot, project.id),
    target = path.join(directory, `music.${extension}`);
  await fs.mkdir(directory, { recursive: true });
  await Promise.all([
    fs.rm(path.join(directory, extension === "wav" ? "music.mp3" : "music.wav"), {
      force: true,
    }),
    fs.writeFile(target, bytes),
  ]);
  return normalizeMahoganyProject({
    ...project,
    appearance: "mahogany-vu",
    candidate:
      project.candidate?.source === "bandcamp_discovery"
        ? {
            ...project.candidate,
            audioStatus: "Added",
            audioFile: name || `music.${extension}`,
            trackName: project.candidate.trackName || trackName,
          }
        : project.candidate,
    vu: {
      ...project.vu,
      music: {
        fileName: name || `music.${extension}`,
        trackName,
        sizeBytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        mimeType,
      },
    },
  });
}

export async function storeMahoganyVuCharacter(
  projectRoot,
  project,
  bytes,
  fileName,
) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length < 12 ||
    String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp"
  )
    throw modelError("Choose a valid MP4 character video.", "character_invalid");
  if (bytes.length > MAHOGANY_CHARACTER_MAX_BYTES)
    throw modelError(
      "The optional Aggits character MP4 must be 24 MiB or smaller.",
      "character_too_large",
    );
  const directory = path.join(projectRoot, project.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "character.mp4"), bytes);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  return normalizeMahoganyProject({
    ...project,
    appearance: "mahogany-vu",
    vu: {
      ...project.vu,
      character: {
        fileName: clean(fileName, 180) || "character.mp4",
        sizeBytes: bytes.length,
        sha256,
        mimeType: "video/mp4",
      },
      ducking: {
        ...project.vu.ducking,
        analysis: {
          status: "pending",
          version: DUCKING_ANALYSIS_VERSION,
          sourceSha256: sha256,
          durationSeconds: 0,
          regions: [],
          analysedAt: "",
          error: "",
        },
      },
    },
  });
}

export function setMahoganyVuDucking(project, payload) {
  const current = normalizeMahoganyProject(project),
    analysis = payload?.analysis && typeof payload.analysis === "object"
      ? payload.analysis
      : {},
    sourceSha256 = String(analysis.sourceSha256 || "");
  if (
    sourceSha256 &&
    sourceSha256 !== current.vu.character.sha256
  )
    throw modelError(
      "Speech analysis does not match the current presenter video.",
      "analysis_identity_mismatch",
    );
  const status = ["pending", "complete", "failed", "none"].includes(
    analysis.status,
  )
    ? analysis.status
    : "failed";
  return normalizeMahoganyProject({
    ...current,
    vu: {
      ...current.vu,
      ducking: {
        ...current.vu.ducking,
        ...normalizeDuckingSettings(payload?.settings || current.vu.ducking),
        analysis: {
          status,
          version:
            status === "complete" ? DUCKING_ANALYSIS_VERSION : "",
          sourceSha256: current.vu.character.sha256,
          durationSeconds: Number(analysis.durationSeconds) || 0,
          regions: normalizeRegions(analysis.regions),
          analysedAt: status === "complete" ? new Date().toISOString() : "",
          error: status === "failed" ? clean(analysis.error, 240) : "",
        },
      },
    },
  });
}

export async function removeMahoganyVuMedia(projectRoot, project, kind) {
  const current = normalizeMahoganyProject(project),
    directory = path.join(projectRoot, current.id);
  if (kind === "music") {
    await Promise.all([
      fs.rm(path.join(directory, "music.mp3"), { force: true }),
      fs.rm(path.join(directory, "music.wav"), { force: true }),
    ]);
    return normalizeMahoganyProject({
      ...current,
      candidate:
        current.candidate?.source === "bandcamp_discovery"
          ? {
              ...current.candidate,
              audioStatus: "Not Added",
              audioFile: "",
              trackName: "",
            }
          : current.candidate,
      vu: {
        ...current.vu,
        music: {
          fileName: "",
          trackName: "",
          sizeBytes: 0,
          sha256: "",
          mimeType: "",
        },
      },
    });
  }
  if (kind !== "character")
    throw modelError("Unknown VU media type.", "media_kind_invalid");
  await fs.rm(path.join(directory, "character.mp4"), { force: true });
  return normalizeMahoganyProject({
    ...current,
    vu: {
      ...current.vu,
      character: { fileName: "", sizeBytes: 0, sha256: "", mimeType: "" },
      ducking: {
        ...current.vu.ducking,
        analysis: {
          status: "none",
          version: "",
          sourceSha256: "",
          durationSeconds: 0,
          regions: [],
          analysedAt: "",
          error: "",
        },
      },
    },
  });
}

function normalizeStoredMedia(value, allowedMimeTypes) {
  return {
    fileName: clean(value.fileName, 180),
    trackName: clean(value.trackName, 180),
    sizeBytes: Math.max(0, Number(value.sizeBytes) || 0),
    sha256: /^[a-f0-9]{64}$/.test(String(value.sha256 || ""))
      ? String(value.sha256)
      : "",
    mimeType: allowedMimeTypes.includes(value.mimeType) ? value.mimeType : "",
  };
}

function normalizeDucking(value) {
  const source = value && typeof value === "object" ? value : {},
    settings = normalizeDuckingSettings(source),
    analysis =
      source.analysis && typeof source.analysis === "object"
        ? source.analysis
        : {};
  return {
    ...settings,
    analysis: {
      status: ["none", "pending", "complete", "failed"].includes(
        analysis.status,
      )
        ? analysis.status
        : "none",
      version: clean(analysis.version, 40),
      sourceSha256: /^[a-f0-9]{64}$/.test(String(analysis.sourceSha256 || ""))
        ? String(analysis.sourceSha256)
        : "",
      durationSeconds: Math.max(0, Number(analysis.durationSeconds) || 0),
      regions: normalizeRegions(analysis.regions),
      analysedAt: validDate(analysis.analysedAt),
      error: clean(analysis.error, 240),
    },
  };
}

function normalizeRegions(value) {
  return (Array.isArray(value) ? value : [])
    .map((region) => [Number(region?.[0]), Number(region?.[1])])
    .filter(
      ([start, end]) =>
        Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start,
    )
    .slice(0, 2000)
    .map(([start, end]) => [
      Math.round(start * 100) / 100,
      Math.round(end * 100) / 100,
    ]);
}

export function mahoganyIconCatalog() {
  return AGGITS_JUKEBOX_ICONS;
}
export function youtubeVideoId(value) {
  const text = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === "youtu.be")
      return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1))
        ? url.pathname.slice(1)
        : "";
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return "";
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1];
    return /^[A-Za-z0-9_-]{11}$/.test(String(id || "")) ? String(id) : "";
  } catch {
    return "";
  }
}
function safeDestination(value) {
  const text = String(value || "").trim();
  if (
    /^tel:\+?[0-9(). -]{6,25}$/i.test(text) ||
    /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(text)
  )
    return text;
  try {
    const url = new URL(text);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !blockedHost(url.hostname)
      ? url.href
      : "";
  } catch {
    return "";
  }
}
function blockedHost(value) {
  const host = String(value || "").toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
  );
}
function actionType(href) {
  return String(href).startsWith("tel:")
    ? "tel"
    : String(href).startsWith("mailto:")
      ? "email"
      : "web";
}
function clean(value, max) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}
function multiline(value, max) {
  return String(value || "")
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .slice(0, max);
}
function validDate(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}
function modelError(message, code) {
  return Object.assign(new Error(message), {
    name: "MahoganyJukeboxModelError",
    code,
  });
}

export const __test = { safeDestination, actionType };
