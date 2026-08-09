import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { aggitsJukeboxIcon } from "./aggits-jukebox-icons.mjs";

export const INVITATION_PROJECT_SCHEMA = "invitation-jukebox-project/1";
export const INVITATION_PUBLICATION_MANIFEST_SCHEMA =
  "deep-cuts-invitation-jukebox-publication/1";
export const INVITATION_VIDEO_MAX_BYTES = 24 * 1024 * 1024;
export const INVITATION_ACTION_COUNT = 4;

const TYPES = Object.freeze({
  wedding: type("Wedding", "For ceremonies and receptions", "wedding-cabinet.png", [
    action("calendar", "Details"), action("gift_cards", "Registry"),
    action("location", "Location"), action("email", "RSVP"),
  ]),
  birthday: type("Birthday", "For every age and milestone", "birthday-cabinet.png", [
    action("calendar", "Details"), action("gift_cards", "Wishlist"),
    action("location", "Location"), action("message", "RSVP"),
  ]),
  corporate: type("Corporate", "Conferences, launches and functions", "corporate-cabinet.png", [
    action("calendar", "Agenda"), action("location", "Venue"),
    action("tickets", "Register"), action("email", "Contact"),
  ]),
  seasonal: type("Seasonal", "Christmas and end-of-year events", "seasonal-cabinet.png", [
    action("calendar", "Event Details"), action("gift_cards", "Gift Guide"),
    action("specials", "Specials"), action("contact", "Contact"),
  ]),
  group_trip: type("Group Trip", "Weekends away and shared adventures", "group-trip-cabinet.png", [
    action("map", "Itinerary"), action("calendar", "Event Info"),
    action("accommodation", "Accommodation"), action("info", "What To Bring"),
  ]),
});

export function invitationTypeCatalog() {
  return Object.entries(TYPES).map(([id, value]) => ({ id, ...value }));
}

export function newInvitationProject(invitationType = "wedding") {
  const selected = TYPES[invitationType] ? invitationType : "wedding";
  const now = new Date().toISOString();
  return {
    schemaVersion: INVITATION_PROJECT_SCHEMA,
    id: `invitation_${crypto.randomBytes(6).toString("hex")}`,
    invitationType: selected,
    title: "",
    hostNames: "",
    tickerText: "",
    event: { date: "", time: "", timezone: "Australia/Sydney", venue: "", address: "" },
    message: "",
    video: {
      kind: "youtube", youtubeUrl: "", embedStatus: "", embedVideoId: "",
      embedCheckedAt: "", fileName: "", sizeBytes: 0, sha256: "",
    },
    actions: TYPES[selected].actions.map((item, index) => ({
      slot: index + 1, ...item, href: "", openInNewTab: true,
    })),
    status: "draft",
    publicationProgress: null,
    publication: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeInvitationProject(value) {
  const source = value && typeof value === "object" ? value : {};
  const selected = TYPES[source.invitationType] ? source.invitationType : "wedding";
  const base = newInvitationProject(selected);
  const event = source.event && typeof source.event === "object" ? source.event : {};
  const video = source.video && typeof source.video === "object" ? source.video : {};
  const incoming = Array.isArray(source.actions) ? source.actions : [];
  return {
    ...base,
    ...source,
    schemaVersion: INVITATION_PROJECT_SCHEMA,
    id: /^invitation_[a-f0-9]{12}$/.test(String(source.id || "")) ? source.id : base.id,
    invitationType: selected,
    title: clean(source.title, 120),
    hostNames: clean(source.hostNames, 120),
    tickerText: multiline(source.tickerText, 500),
    event: {
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(event.date || "")) ? event.date : "",
      time: /^\d{2}:\d{2}$/.test(String(event.time || "")) ? event.time : "",
      timezone: clean(event.timezone, 80) || "Australia/Sydney",
      venue: clean(event.venue, 160),
      address: clean(event.address, 240),
    },
    message: multiline(source.message, 900),
    video: {
      kind: video.kind === "mp4" ? "mp4" : "youtube",
      youtubeUrl: clean(video.youtubeUrl, 300),
      embedStatus: video.embedStatus === "playable" ? "playable" : "",
      embedVideoId: /^[A-Za-z0-9_-]{11}$/.test(String(video.embedVideoId || "")) ? String(video.embedVideoId) : "",
      embedCheckedAt: validDate(video.embedCheckedAt),
      fileName: clean(video.fileName, 180),
      sizeBytes: Number(video.sizeBytes) || 0,
      sha256: /^[a-f0-9]{64}$/.test(String(video.sha256 || "")) ? String(video.sha256) : "",
    },
    actions: Array.from({ length: INVITATION_ACTION_COUNT }, (_, index) => {
      const fallback = TYPES[selected].actions[index];
      const item = incoming[index] || {};
      return {
        slot: index + 1,
        iconId: aggitsJukeboxIcon(item.iconId) ? item.iconId : fallback.iconId,
        label: clean(item.label, 22) || fallback.label,
        href: clean(item.href, 500),
        openInNewTab: item.openInNewTab !== false,
      };
    }),
    status: ["draft", "prepared", "publishing", "published", "unpublished", "failed"].includes(source.status) ? source.status : "draft",
    publicationProgress: source.publicationProgress && typeof source.publicationProgress === "object" ? source.publicationProgress : null,
    publication: source.publication && typeof source.publication === "object" ? source.publication : null,
    createdAt: validDate(source.createdAt) || base.createdAt,
    updatedAt: validDate(source.updatedAt) || base.updatedAt,
  };
}

export function validateInvitationProject(project, { requireStoredMp4 = false } = {}) {
  const value = normalizeInvitationProject(project), errors = [];
  if (!value.title) errors.push("Enter the invitation title.");
  if (!value.hostNames) errors.push("Enter the host or guest names.");
  if (!value.tickerText) errors.push("Enter the ticker message.");
  if (!value.event.date) errors.push("Choose the event date.");
  if (!value.event.venue) errors.push("Enter the venue.");
  if (!value.message) errors.push("Enter the invitation message.");
  if (value.video.kind === "youtube") {
    const id = youtubeVideoId(value.video.youtubeUrl);
    if (!id) errors.push("Enter a valid YouTube video URL.");
    else if (value.video.embedStatus !== "playable" || value.video.embedVideoId !== id || !value.video.embedCheckedAt)
      errors.push("Create must verify that YouTube allows this video to be embedded.");
  } else {
    if (!value.video.fileName || !value.video.sha256 || value.video.sizeBytes <= 0) errors.push("Choose a valid local MP4.");
    if (value.video.sizeBytes > INVITATION_VIDEO_MAX_BYTES) errors.push("The public MP4 must be 24 MiB or smaller.");
    if (requireStoredMp4 && !value.video.fileName) errors.push("The stored MP4 is missing.");
  }
  for (const item of value.actions) {
    if (!item.label) errors.push(`Enter a label for key ${item.slot}.`);
    if (!safeDestination(item.href)) errors.push(`Enter a valid destination for key ${item.slot}.`);
  }
  return { ready: errors.length === 0, errors, value };
}

export function toInvitationPreviewProject(project) {
  const value = normalizeInvitationProject(project);
  return {
    schemaVersion: "deep-cuts-invitation-preview/1",
    id: value.id,
    invitationType: value.invitationType,
    title: value.title,
    hostNames: value.hostNames,
    tickerText: value.tickerText,
    event: value.event,
    message: value.message,
    video: value.video,
    actions: value.actions,
    readiness: validateInvitationProject(value),
    status: value.status,
    editionId: value.publication?.editionId || "",
  };
}

export function buildInvitationManifest(project) {
  const checked = validateInvitationProject(project, { requireStoredMp4: true });
  if (!checked.ready) throw modelError(checked.errors.join(" "), "project_not_ready");
  const value = checked.value, youtubeId = youtubeVideoId(value.video.youtubeUrl);
  return {
    schemaVersion: INVITATION_PUBLICATION_MANIFEST_SCHEMA,
    product: "invitation_jukebox",
    projectId: value.id,
    invitationType: value.invitationType,
    title: value.title,
    hostNames: value.hostNames,
    tickerText: value.tickerText,
    event: value.event,
    message: value.message,
    actions: value.actions.map((item) => ({ ...item, actionType: actionType(item.href), href: safeDestination(item.href) })),
    video: value.video.kind === "youtube" ? {
      kind: "youtube", youtubeUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      embedStatus: value.video.embedStatus, embedVideoId: value.video.embedVideoId,
      embedCheckedAt: value.video.embedCheckedAt,
      sha256: crypto.createHash("sha256").update(`youtube:${youtubeId}`).digest("hex"),
    } : { kind: "mp4", fileName: value.video.fileName, sizeBytes: value.video.sizeBytes, sha256: value.video.sha256 },
  };
}

export async function saveInvitationProject(projectRoot, project) {
  const value = normalizeInvitationProject({ ...project, updatedAt: new Date().toISOString() });
  const directory = path.join(projectRoot, value.invitationType, value.id);
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, "project.json"), temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, file);
  return value;
}

export async function loadInvitationProject(projectRoot, id) {
  if (!/^invitation_[a-f0-9]{12}$/.test(String(id || ""))) throw modelError("Invalid invitation identity.", "project_invalid");
  for (const typeId of Object.keys(TYPES)) {
    try {
      return normalizeInvitationProject(JSON.parse(await fs.readFile(path.join(projectRoot, typeId, id, "project.json"), "utf8")));
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  throw modelError("Invitation not found.", "project_not_found");
}

export async function listInvitationProjects(projectRoot, invitationType = "") {
  const typeIds = invitationType && TYPES[invitationType] ? [invitationType] : Object.keys(TYPES);
  const projects = [];
  for (const typeId of typeIds) {
    const directory = path.join(projectRoot, typeId);
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
    for (const entry of entries) if (entry.isDirectory() && /^invitation_[a-f0-9]{12}$/.test(entry.name)) {
      try { projects.push(await loadInvitationProject(projectRoot, entry.name)); } catch {}
    }
  }
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function storeInvitationMp4(projectRoot, project, bytes, fileName) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp") throw modelError("Choose a valid MP4 file.", "video_invalid");
  if (bytes.length > INVITATION_VIDEO_MAX_BYTES) throw modelError("The public MP4 must be 24 MiB or smaller.", "video_too_large");
  const directory = path.join(projectRoot, project.invitationType, project.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "video.mp4"), bytes);
  return normalizeInvitationProject({ ...project, video: { kind: "mp4", youtubeUrl: "", fileName: clean(fileName, 180) || "video.mp4", sizeBytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") } });
}

export function invitationProjectDirectory(projectRoot, project) {
  return path.join(projectRoot, project.invitationType, project.id);
}

export function youtubeVideoId(value) {
  const text = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === "youtu.be") return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : "";
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return "";
    const id = url.pathname === "/watch" ? url.searchParams.get("v") : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1];
    return /^[A-Za-z0-9_-]{11}$/.test(String(id || "")) ? String(id) : "";
  } catch { return ""; }
}

function type(label, description, cabinetAsset, actions) { return Object.freeze({ label, description, cabinetAsset, actions: Object.freeze(actions) }); }
function action(iconId, label) { return Object.freeze({ iconId, label }); }
function safeDestination(value) {
  const text = String(value || "").trim();
  if (/^tel:\+?[0-9(). -]{6,25}$/i.test(text) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(text)) return text;
  try { const url = new URL(text); return url.protocol === "https:" && !url.username && !url.password && !blockedHost(url.hostname) ? url.href : ""; } catch { return ""; }
}
function blockedHost(value) { const host = String(value || "").toLowerCase(); return host === "localhost" || host.endsWith(".local") || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host); }
function actionType(href) { return String(href).startsWith("tel:") ? "tel" : String(href).startsWith("mailto:") ? "email" : "web"; }
function clean(value, max) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, max); }
function multiline(value, max) { return String(value || "").trim().replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").slice(0, max); }
function validDate(value) { const time = Date.parse(String(value || "")); return Number.isFinite(time) ? new Date(time).toISOString() : ""; }
function modelError(message, code) { return Object.assign(new Error(message), { name: "InvitationJukeboxModelError", code }); }

export const __test = { safeDestination, actionType };
