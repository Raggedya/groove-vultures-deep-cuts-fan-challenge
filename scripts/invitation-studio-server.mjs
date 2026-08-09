import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderInvitationJukeboxPreview } from "./invitation-jukebox-preview.mjs";
import {
  invitationProjectDirectory, invitationTypeCatalog, listInvitationProjects,
  loadInvitationProject, newInvitationProject, normalizeInvitationProject,
  saveInvitationProject, storeInvitationMp4, toInvitationPreviewProject,
  validateInvitationProject,
} from "./invitation-jukebox-model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export function createInvitationStudioServer({ root = path.resolve(here, ".."), dataDir = path.join(root, ".invitation-studio"), publisher } = {}) {
  const projectRoot = path.join(dataDir, "invitations");
  const directPublisher = publisher || null;
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname.startsWith("/api/invitations/")) return api({ request, response, url, root, projectRoot, publisher: directPublisher });
      if (["/", "/invitation-studio", "/invitation-studio/"].includes(url.pathname)) return serve(response, path.join(root, "invitation-studio", "index.html"), path.join(root, "invitation-studio"));
      if (url.pathname.startsWith("/invitation-studio/")) return serve(response, path.join(root, url.pathname.slice(1)), path.join(root, "invitation-studio"));
      if (url.pathname.startsWith("/assets/")) return serve(response, path.join(root, url.pathname.slice(1)), path.join(root, "assets"));
      response.writeHead(404); response.end("Not found");
    } catch (error) {
      sendJson(response, error.code === "project_not_found" ? 404 : 400, { ok: false, error: error.message, code: error.code || "invitation_error" });
    }
  });
}

async function api({ request, response, url, projectRoot, publisher }) {
  if (request.method === "GET" && url.pathname === "/api/invitations/bootstrap") {
    const authentication = publisher ? await publisher.authentication().catch((error) => ({ available: false, state: "error", reason: error.message })) : { available: false, state: "unavailable", reason: "Installed Windows publishing is required." };
    return sendJson(response, 200, { ok: true, types: invitationTypeCatalog(), projects: await listInvitationProjects(projectRoot, url.searchParams.get("type") || ""), authentication });
  }
  if (request.method === "POST" && url.pathname === "/api/invitations/projects") {
    const body = await readJson(request), project = await saveInvitationProject(projectRoot, newInvitationProject(body.invitationType));
    return sendJson(response, 201, { ok: true, project });
  }
  if (request.method === "POST" && url.pathname === "/api/invitations/activation/start") {
    if (!publisher) throw apiError("Installed Windows publishing is unavailable.", "publisher_unavailable");
    return sendJson(response, 200, { ok: true, ...(await publisher.startActivation()) });
  }
  if (request.method === "POST" && url.pathname === "/api/invitations/activation/complete") {
    if (!publisher) throw apiError("Installed Windows publishing is unavailable.", "publisher_unavailable");
    const body = await readJson(request); return sendJson(response, 200, { ok: true, authentication: await publisher.completeActivation(body.code) });
  }
  const match = url.pathname.match(/^\/api\/invitations\/projects\/(invitation_[a-f0-9]{12})(?:\/(preview|video|qr|publish|state))?$/);
  if (!match) { response.writeHead(404); response.end("Unknown Invitation API route"); return; }
  const id = match[1], action = match[2] || "project";
  if (request.method === "GET" && action === "project") return sendJson(response, 200, { ok: true, project: await loadInvitationProject(projectRoot, id) });
  if (request.method === "PUT" && action === "project") {
    const current = await loadInvitationProject(projectRoot, id), body = await readJson(request);
    if (body.invitationType && body.invitationType !== current.invitationType) throw apiError("Invitation type is fixed after creation. Create a new invitation to change libraries.", "invitation_type_locked");
    const project = await saveInvitationProject(projectRoot, normalizeInvitationProject({ ...current, ...body, id, invitationType: current.invitationType, status: ["published", "unpublished"].includes(current.status) ? current.status : "draft", publication: current.publication }));
    return sendJson(response, 200, { ok: true, project, readiness: validateInvitationProject(project) });
  }
  if (request.method === "PUT" && action === "video") {
    const project = await loadInvitationProject(projectRoot, id), bytes = await readBytes(request, 24 * 1024 * 1024);
    const updated = await storeInvitationMp4(projectRoot, project, bytes, decodeURIComponent(request.headers["x-file-name"] || "video.mp4"));
    return sendJson(response, 200, { ok: true, project: await saveInvitationProject(projectRoot, { ...updated, status: "draft", publicationProgress: null }) });
  }
  if (request.method === "GET" && action === "video") {
    const project = await loadInvitationProject(projectRoot, id);
    return serveMedia(request, response, path.join(invitationProjectDirectory(projectRoot, project), "video.mp4"), "video/mp4");
  }
  if (request.method === "GET" && action === "qr") {
    const project = await loadInvitationProject(projectRoot, id), directory = invitationProjectDirectory(projectRoot, project);
    return serve(response, path.join(directory, "qr.png"), directory, { "cache-control": "no-store" });
  }
  if (request.method === "GET" && action === "preview") {
    const project = await loadInvitationProject(projectRoot, id), preview = toInvitationPreviewProject(project);
    const html = renderInvitationJukeboxPreview(preview, { videoUrl: project.video.kind === "mp4" ? `/api/invitations/projects/${id}/video` : "", youtubeUrl: project.video.kind === "youtube" ? project.video.youtubeUrl : "", canonicalUrl: project.publication?.liveUrl || "" });
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'self'; img-src 'self' data:; media-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com; style-src 'unsafe-inline'; frame-src https://www.youtube-nocookie.com; connect-src 'self';" });
    response.end(html); return;
  }
  if (request.method === "POST" && action === "publish") {
    if (!publisher) throw apiError("Protected publishing is available in the installed Windows app.", "publisher_unavailable");
    let project = await loadInvitationProject(projectRoot, id);
    const readiness = validateInvitationProject(project, { requireStoredMp4: true });
    if (!readiness.ready) throw apiError(readiness.errors.join(" "), "project_not_ready");
    const saveProgress = async (stage, message) => { project = await saveInvitationProject(projectRoot, { ...project, status: "publishing", publicationProgress: { stage, message, updatedAt: new Date().toISOString() } }); };
    try {
      await saveProgress("preparing", "Reserving the permanent invitation URL and generating its QR image.");
      const prepared = await publisher.prepare({ project });
      const directory = invitationProjectDirectory(projectRoot, project);
      await fs.writeFile(path.join(directory, "qr.png"), prepared.qrBytes);
      project = await saveInvitationProject(projectRoot, { ...project, status: "publishing", prepared: { ...prepared, qrBytes: undefined }, publicationProgress: { stage: "prepared", message: "Permanent URL and QR image are ready.", updatedAt: new Date().toISOString() } });
      const publication = await publisher.accept({ prepared, videoPath: project.video.kind === "mp4" ? path.join(directory, "video.mp4") : "", onProgress: saveProgress });
      project = await saveInvitationProject(projectRoot, { ...project, status: "published", prepared: null, publication: { ...publication, published: true, publishedAt: new Date().toISOString() }, publicationProgress: { stage: "completed", message: "Published, verified and delivered by email.", updatedAt: new Date().toISOString() } });
      return sendJson(response, 200, { ok: true, project, publication });
    } catch (error) {
      project = await saveInvitationProject(projectRoot, { ...project, status: "failed", prepared: null, lastError: error.message, publicationProgress: { stage: "failed", message: error.message, updatedAt: new Date().toISOString() } });
      throw error;
    }
  }
  if (request.method === "PUT" && action === "state") {
    if (!publisher) throw apiError("Protected publishing is unavailable.", "publisher_unavailable");
    let project = await loadInvitationProject(projectRoot, id); if (!project.publication?.editionId) throw apiError("Publish this invitation first.", "edition_identity_missing");
    const body = await readJson(request), publication = await publisher.setPublished({ editionId: project.publication.editionId, published: body.published === true });
    project = await saveInvitationProject(projectRoot, { ...project, status: publication.published ? "published" : "unpublished", publication: { ...project.publication, ...publication } });
    return sendJson(response, 200, { ok: true, project });
  }
  response.writeHead(405); response.end("Method not allowed");
}

async function serve(response, file, base, headers = {}) { const resolved = path.resolve(file), allowed = path.resolve(base); if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) { response.writeHead(403); response.end("Forbidden"); return; } try { const bytes = await fs.readFile(resolved); response.writeHead(200, { "content-type": mime(resolved), "cache-control": "no-store", ...headers }); response.end(bytes); } catch (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500); response.end("Asset unavailable"); } }
async function serveMedia(request, response, file, type) { try { const stat = await fs.stat(file), range = String(request.headers.range || "").match(/^bytes=(\d+)-(\d*)$/), bytes = await fs.readFile(file); if (range) { const start = Number(range[1]), end = range[2] ? Number(range[2]) : stat.size - 1, slice = bytes.subarray(start, Math.min(end + 1, bytes.length)); response.writeHead(206, { "content-type": type, "content-length": slice.length, "content-range": `bytes ${start}-${start + slice.length - 1}/${stat.size}`, "accept-ranges": "bytes" }); response.end(slice); return; } response.writeHead(200, { "content-type": type, "content-length": stat.size, "accept-ranges": "bytes" }); response.end(bytes); } catch { response.writeHead(404); response.end("Video unavailable"); } }
async function readJson(request) { const bytes = await readBytes(request, 2 * 1024 * 1024); try { return bytes.length ? JSON.parse(bytes.toString("utf8")) : {}; } catch { throw apiError("Request JSON is invalid.", "invalid_json"); } }
function readBytes(request, max) { return new Promise((resolve, reject) => { const chunks = []; let total = 0; request.on("data", (chunk) => { total += chunk.length; if (total > max) { request.destroy(); reject(apiError("Request is too large.", "request_too_large")); return; } chunks.push(chunk); }); request.on("end", () => resolve(Buffer.concat(chunks))); request.on("error", reject); }); }
function sendJson(response, status, value) { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(value)); }
function mime(file) { return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
function apiError(message, code) { return Object.assign(new Error(message), { code }); }
