import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AGGITS_JUKEBOX_ICONS,
  aggitsJukeboxIcon,
} from "./aggits-jukebox-icons.mjs";

export const MAHOGANY_PROJECT_SCHEMA = "mahogany-jukebox-project/1";
export const MAHOGANY_PUBLICATION_MANIFEST_SCHEMA =
  "deep-cuts-mahogany-jukebox-publication/2";
export const MAHOGANY_VIDEO_MAX_BYTES = 24 * 1024 * 1024;
export const MAHOGANY_ACTION_COUNT = 4;

export function newMahoganyProject() {
  const now = new Date().toISOString();
  return {
    schemaVersion: MAHOGANY_PROJECT_SCHEMA,
    id: `studio_${crypto.randomBytes(6).toString("hex")}`,
    name: "",
    tickerText: "",
    video: {
      kind: "youtube",
      youtubeUrl: "",
      embedStatus: "",
      embedVideoId: "",
      embedCheckedAt: "",
      fileName: "",
      sizeBytes: 0,
      sha256: "",
    },
    actions: Array.from({ length: MAHOGANY_ACTION_COUNT }, (_, index) => ({
      slot: index + 1,
      iconId: ["spotify", "youtube", "instagram", "facebook"][index],
      label: ["Spotify", "YouTube", "Instagram", "Facebook"][index],
      href: "",
      openInNewTab: true,
    })),
    status: "draft",
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
    "published",
    "unpublished",
    "failed",
  ].includes(source.status)
    ? source.status
    : "draft";
  project.publication =
    source.publication && typeof source.publication === "object"
      ? source.publication
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
  if (value.video.kind === "youtube") {
    const youtubeId = youtubeVideoId(value.video.youtubeUrl);
    if (!youtubeId)
      errors.push("Enter a valid YouTube video URL.");
    else if (
      value.video.embedStatus !== "playable" ||
      value.video.embedVideoId !== youtubeId ||
      !value.video.embedCheckedAt
    )
      errors.push("Press Create to verify that YouTube allows this video to be embedded.");
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
  return {
    schemaVersion: MAHOGANY_PUBLICATION_MANIFEST_SCHEMA,
    projectId: value.id,
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
