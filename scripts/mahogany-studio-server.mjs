import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderAggitsJukeboxStudioPreview } from "./aggits-jukebox-preview.mjs";
import { createMahoganyJukeboxPublisher } from "./mahogany-jukebox-publication.mjs";
import { runMahoganyBandCandidateBatch } from "./mahogany-band-candidates.mjs";
import {
  listMahoganyProjects,
  loadMahoganyProject,
  mahoganyIconCatalog,
  mahoganySecretVideoPath,
  mahoganySkinPath,
  MAHOGANY_SECRET_VIDEO_MAX_BYTES,
  MAHOGANY_SKIN_MAX_BYTES,
  newMahoganyProject,
  normalizeMahoganyProject,
  restoreDefaultMahoganySkin,
  removeMahoganySecretVideo,
  saveMahoganyProject,
  storeMahoganyMp4,
  storeMahoganySecretVideo,
  storeMahoganySkin,
  toPreviewProject,
  validateMahoganyProject,
} from "./mahogany-jukebox-model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export function createMahoganyStudioServer({
  root = path.resolve(here, ".."),
  dataDir = path.join(root, ".mahogany-studio"),
  credentialStore,
  publisher,
  bandCandidateRunner = runMahoganyBandCandidateBatch,
  appVersion = "1.0.0",
} = {}) {
  const projectRoot = path.join(dataDir, "projects"),
    candidateJobs = new Map(),
    directPublisher =
      publisher ||
      (credentialStore
        ? createMahoganyJukeboxPublisher({ credentialStore, root, appVersion })
        : null);
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname.startsWith("/api/mahogany/"))
        return await api({
          request,
          response,
          url,
          root,
          projectRoot,
          publisher: directPublisher,
          candidateJobs,
          bandCandidateRunner,
        });
      if (
        url.pathname === "/" ||
        url.pathname === "/mahogany-studio" ||
        url.pathname === "/mahogany-studio/"
      )
        return serve(
          response,
          path.join(root, "mahogany-studio", "index.html"),
          path.join(root, "mahogany-studio"),
        );
      if (url.pathname.startsWith("/mahogany-studio/"))
        return serve(
          response,
          path.join(root, url.pathname.replace(/^\//, "")),
          path.join(root, "mahogany-studio"),
        );
      if (url.pathname.startsWith("/assets/"))
        return serve(
          response,
          path.join(root, url.pathname.replace(/^\//, "")),
          path.join(root, "assets"),
        );
      response.writeHead(404);
      response.end("Not found");
    } catch (error) {
      const status = error.code === "project_not_found" ? 404 : 400;
      sendJson(response, status, {
        ok: false,
        error: error.message,
        code: error.code || "mahogany_error",
      });
    }
  });
}

async function api({
  request,
  response,
  url,
  root,
  projectRoot,
  publisher,
  candidateJobs,
  bandCandidateRunner,
}) {
  if (request.method === "GET" && url.pathname === "/api/mahogany/bootstrap") {
    const authentication = publisher
      ? await publisher
          .authentication()
          .catch((error) => ({
            available: false,
            state: "error",
            reason: error.message,
          }))
      : {
          available: false,
          state: "unavailable",
          reason: "Installed Windows publishing is required.",
        };
    return sendJson(response, 200, {
      ok: true,
      icons: mahoganyIconCatalog(),
      projects: await listMahoganyProjects(projectRoot),
      authentication,
    });
  }
  if (request.method === "POST" && url.pathname === "/api/mahogany/projects") {
    const project = await saveMahoganyProject(
      projectRoot,
      newMahoganyProject(),
    );
    return sendJson(response, 201, { ok: true, project });
  }
  if (
    request.method === "POST" &&
    url.pathname === "/api/mahogany/candidate-batches/bands"
  ) {
    const running = [...candidateJobs.values()].find(
      (job) => job.kind === "band" && job.status === "running",
    );
    if (running) return sendJson(response, 202, { ok: true, job: running });
    const job = {
      id: `candidate_${crypto.randomBytes(8).toString("hex")}`,
      kind: "band",
      status: "running",
      stage: "queued",
      message: "Band discovery is queued.",
      reviewed: 0,
      qualified: 0,
      rejected: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: null,
      error: "",
    };
    candidateJobs.set(job.id, job);
    setImmediate(async () => {
      try {
        const result = await bandCandidateRunner({
          projectRoot,
          existingProjects: await listMahoganyProjects(projectRoot),
          onProgress(progress) {
            Object.assign(job, progress, {
              updatedAt: new Date().toISOString(),
            });
          },
        });
        Object.assign(job, {
          status: "completed",
          result,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        Object.assign(job, {
          status: "failed",
          stage: "failed",
          message: error.message,
          error: error.message,
          updatedAt: new Date().toISOString(),
        });
      }
    });
    return sendJson(response, 202, { ok: true, job });
  }
  const candidateJobMatch = url.pathname.match(
    /^\/api\/mahogany\/candidate-batches\/(candidate_[a-f0-9]{16})$/,
  );
  if (request.method === "GET" && candidateJobMatch) {
    const job = candidateJobs.get(candidateJobMatch[1]);
    if (!job) throw apiError("Candidate batch not found.", "candidate_job_not_found");
    return sendJson(response, 200, { ok: true, job });
  }
  if (
    request.method === "POST" &&
    url.pathname === "/api/mahogany/activation/start"
  ) {
    if (!publisher)
      throw apiError(
        "Installed Windows publishing is unavailable.",
        "publisher_unavailable",
      );
    return sendJson(response, 200, {
      ok: true,
      ...(await publisher.startActivation()),
    });
  }
  if (
    request.method === "POST" &&
    url.pathname === "/api/mahogany/activation/complete"
  ) {
    if (!publisher)
      throw apiError(
        "Installed Windows publishing is unavailable.",
        "publisher_unavailable",
      );
    const body = await readJson(request);
    return sendJson(response, 200, {
      ok: true,
      authentication: await publisher.completeActivation(body.code),
    });
  }
  const match = url.pathname.match(
    /^\/api\/mahogany\/projects\/(studio_[a-f0-9]{12})(?:\/(preview|video|secret-video|skin|qr|publish|create|accept|state))?$/,
  );
  if (!match) {
    response.writeHead(404);
    response.end("Unknown Mahogany Jukebox API route");
    return;
  }
  const id = match[1],
    action = match[2] || "project";
  if (request.method === "GET" && action === "project")
    return sendJson(response, 200, {
      ok: true,
      project: await loadMahoganyProject(projectRoot, id),
    });
  if (request.method === "PUT" && action === "project") {
    const current = await loadMahoganyProject(projectRoot, id),
      body = await readJson(request);
    if (
      ["prepared", "publishing"].includes(current.status) &&
      current.prepared &&
      publisher
    )
      await publisher
        .rollback({ ...current.prepared, qrBytes: Buffer.alloc(1) })
        .catch(() => {});
    const project = await saveMahoganyProject(
      projectRoot,
      normalizeMahoganyProject({
        ...current,
        ...body,
        id,
        status:
          current.status === "published" || current.status === "unpublished"
            ? current.status
            : "draft",
        prepared: null,
        publicationProgress: null,
        publication: current.publication,
      }),
    );
    return sendJson(response, 200, {
      ok: true,
      project,
      readiness: validateMahoganyProject(project),
    });
  }
  if (request.method === "PUT" && action === "video") {
    const project = await loadMahoganyProject(projectRoot, id),
      bytes = await readBytes(request, 24 * 1024 * 1024),
      updated = await storeMahoganyMp4(
        projectRoot,
        project,
        bytes,
        decodeURIComponent(request.headers["x-file-name"] || "video.mp4"),
      );
    return sendJson(response, 200, {
      ok: true,
      project: await saveMahoganyProject(projectRoot, {
        ...updated,
        status: "draft",
        prepared: null,
        publicationProgress: null,
      }),
    });
  }
  if (request.method === "GET" && action === "video")
    return serveMedia(
      request,
      response,
      path.join(projectRoot, id, "video.mp4"),
      "video/mp4",
    );
  if (request.method === "PUT" && action === "secret-video") {
    const project = await loadMahoganyProject(projectRoot, id),
      bytes = await readBytes(request, MAHOGANY_SECRET_VIDEO_MAX_BYTES),
      updated = await storeMahoganySecretVideo(
        projectRoot,
        project,
        bytes,
        decodeURIComponent(request.headers["x-file-name"] || "secret-video.mp4"),
      );
    return sendJson(response, 200, {
      ok: true,
      project: await saveMahoganyProject(projectRoot, {
        ...updated,
        status: "draft",
        prepared: null,
        publicationProgress: null,
      }),
    });
  }
  if (request.method === "GET" && action === "secret-video") {
    const project = await loadMahoganyProject(projectRoot, id);
    if (!project.secretVideo?.sha256)
      throw apiError("No secret video is configured.", "secret_video_missing");
    return serveMedia(
      request,
      response,
      mahoganySecretVideoPath(projectRoot, project),
      "video/mp4",
    );
  }
  if (request.method === "DELETE" && action === "secret-video") {
    const project = await loadMahoganyProject(projectRoot, id),
      updated = await removeMahoganySecretVideo(projectRoot, project);
    return sendJson(response, 200, {
      ok: true,
      project: await saveMahoganyProject(projectRoot, {
        ...updated,
        status: "draft",
        prepared: null,
        publicationProgress: null,
      }),
    });
  }
  if (request.method === "PUT" && action === "skin") {
    const project = await loadMahoganyProject(projectRoot, id),
      bytes = await readBytes(request, MAHOGANY_SKIN_MAX_BYTES),
      updated = await storeMahoganySkin(
        projectRoot,
        project,
        bytes,
        decodeURIComponent(request.headers["x-file-name"] || "skin.png"),
      );
    return sendJson(response, 200, {
      ok: true,
      project: await saveMahoganyProject(projectRoot, {
        ...updated,
        status: "draft",
        prepared: null,
        publicationProgress: null,
      }),
    });
  }
  if (request.method === "DELETE" && action === "skin") {
    const project = await loadMahoganyProject(projectRoot, id),
      updated = await restoreDefaultMahoganySkin(projectRoot, project);
    return sendJson(response, 200, {
      ok: true,
      project: await saveMahoganyProject(projectRoot, {
        ...updated,
        status: "draft",
        prepared: null,
        publicationProgress: null,
      }),
    });
  }
  if (request.method === "GET" && action === "skin") {
    const project = await loadMahoganyProject(projectRoot, id);
    if (project.skin.kind !== "custom")
      throw apiError("This project uses the Mahogany master skin.", "skin_default");
    return serveMedia(
      request,
      response,
      mahoganySkinPath(projectRoot, project),
      project.skin.mimeType,
    );
  }
  if (request.method === "GET" && action === "qr")
    return serve(
      response,
      path.join(projectRoot, id, "qr.png"),
      path.join(projectRoot, id),
      { "cache-control": "no-store" },
    );
  if (request.method === "GET" && action === "preview") {
    const project = await loadMahoganyProject(projectRoot, id),
      preview = toPreviewProject(project),
      html = renderAggitsJukeboxStudioPreview(preview, {
        videoUrl:
          project.video.kind === "mp4"
            ? `/api/mahogany/projects/${id}/video`
            : "",
        secretVideoUrl: project.secretVideo?.sha256
          ? `/api/mahogany/projects/${id}/secret-video?v=${project.secretVideo.sha256.slice(0, 12)}`
          : "",
        youtubeUrl:
          project.video.kind === "youtube" ? project.video.youtubeUrl : "",
        skinUrl:
          project.skin.kind === "custom"
            ? `/api/mahogany/projects/${id}/skin?v=${project.skin.sha256.slice(0, 12)}`
            : "",
        canonicalUrl:
          project.publication?.liveUrl || project.prepared?.liveUrl || "",
      });
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'self'; img-src 'self' data:; media-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; frame-src https://www.youtube-nocookie.com; connect-src 'self';",
    });
    response.end(html);
    return;
  }
  if (request.method === "POST" && action === "publish") {
    if (!publisher)
      throw apiError(
        "Protected publishing is available in the installed Windows app.",
        "publisher_unavailable",
      );
    let project = await loadMahoganyProject(projectRoot, id);
    const readiness = validateMahoganyProject(project, {
      requireStoredMp4: true,
      requireStoredSkin: true,
    });
    if (!readiness.ready)
      throw apiError(readiness.errors.join(" "), "project_not_ready");
    const saveProgress = async (stage, message) => {
      project = await saveMahoganyProject(projectRoot, {
        ...project,
        status: "publishing",
        publicationProgress: {
          stage,
          message,
          updatedAt: new Date().toISOString(),
        },
      });
    };
    try {
      let prepared;
      if (project.prepared) {
        const qrBytes = await fs.readFile(path.join(projectRoot, id, "qr.png"));
        prepared = { ...project.prepared, qrBytes };
        await saveProgress(
          "resuming",
          "Resuming the protected publication from its last safe stage.",
        );
      } else {
        await saveProgress(
          "preparing",
          "Reserving the permanent URL and generating the QR poster.",
        );
        prepared = await publisher.prepare({ project });
        await fs.writeFile(path.join(projectRoot, id, "qr.png"), prepared.qrBytes);
        const storedPrepared = {
          schemaVersion: prepared.schemaVersion,
          manifest: prepared.manifest,
          job: prepared.job,
          qrPayload: prepared.qrPayload,
          qrSha256: prepared.qrSha256,
          qrScanProof: prepared.qrScanProof,
          editionId: prepared.editionId,
          slug: prepared.slug,
          liveUrl: prepared.liveUrl,
          qrImageUrl: prepared.qrImageUrl,
        };
        project = await saveMahoganyProject(projectRoot, {
          ...project,
          status: "publishing",
          prepared: storedPrepared,
          publicationProgress: {
            stage: "prepared",
            message: "Permanent URL and scan-tested QR are ready.",
            updatedAt: new Date().toISOString(),
          },
        });
        prepared = { ...storedPrepared, qrBytes: prepared.qrBytes };
      }
      const publication = await publisher.accept({
        prepared,
        videoPath:
          project.video.kind === "mp4"
            ? path.join(projectRoot, id, "video.mp4")
            : "",
        skinPath:
          project.skin.kind === "custom"
            ? mahoganySkinPath(projectRoot, project)
            : "",
        secretVideoPath: project.secretVideo?.sha256
          ? mahoganySecretVideoPath(projectRoot, project)
          : "",
        onProgress: saveProgress,
      });
      project = await saveMahoganyProject(projectRoot, {
        ...project,
        status: "published",
        prepared: null,
        publication: {
          ...publication,
          published: true,
          publishedAt: new Date().toISOString(),
        },
        publicationProgress: {
          stage: "completed",
          message: "Published, verified and delivered by email.",
          updatedAt: new Date().toISOString(),
        },
      });
      return sendJson(response, 200, { ok: true, project, publication });
    } catch (error) {
      project = await saveMahoganyProject(projectRoot, {
        ...project,
        status: "failed",
        prepared: null,
        lastError: error.message,
        publicationProgress: {
          stage: "failed",
          message: error.message,
          updatedAt: new Date().toISOString(),
        },
      });
      throw error;
    }
  }
  if (request.method === "POST" && action === "create") {
    if (!publisher)
      throw apiError(
        "Protected publishing is available in the installed Windows app.",
        "publisher_unavailable",
      );
    let project = await loadMahoganyProject(projectRoot, id),
      readiness = validateMahoganyProject(project, {
        requireStoredMp4: true,
        requireStoredSkin: true,
      });
    if (!readiness.ready)
      throw apiError(readiness.errors.join(" "), "project_not_ready");
    if (project.prepared)
      await publisher
        .rollback({ ...project.prepared, qrBytes: Buffer.alloc(1) })
        .catch(() => {});
    const prepared = await publisher.prepare({ project }),
      qrPath = path.join(projectRoot, id, "qr.png");
    await fs.writeFile(qrPath, prepared.qrBytes);
    const storedPrepared = {
      schemaVersion: prepared.schemaVersion,
      manifest: prepared.manifest,
      job: prepared.job,
      qrPayload: prepared.qrPayload,
      qrSha256: prepared.qrSha256,
      qrScanProof: prepared.qrScanProof,
      editionId: prepared.editionId,
      slug: prepared.slug,
      liveUrl: prepared.liveUrl,
      qrImageUrl: prepared.qrImageUrl,
    };
    project = await saveMahoganyProject(projectRoot, {
      ...project,
      status: "prepared",
      prepared: storedPrepared,
      updatedAt: new Date().toISOString(),
    });
    return sendJson(response, 200, {
      ok: true,
      project,
      previewUrl: `/api/mahogany/projects/${id}/preview`,
      qrPreviewUrl: `/api/mahogany/projects/${id}/qr?revision=${Date.now()}`,
    });
  }
  if (request.method === "POST" && action === "accept") {
    if (!publisher)
      throw apiError(
        "Protected publishing is unavailable.",
        "publisher_unavailable",
      );
    let project = await loadMahoganyProject(projectRoot, id);
    if (!project.prepared)
      throw apiError("Press Create before Accept.", "publication_not_prepared");
    const qrBytes = await fs.readFile(path.join(projectRoot, id, "qr.png")),
      prepared = { ...project.prepared, qrBytes };
    try {
      const publication = await publisher.accept({
        prepared,
        videoPath:
          project.video.kind === "mp4"
            ? path.join(projectRoot, id, "video.mp4")
            : "",
        skinPath:
          project.skin.kind === "custom"
            ? mahoganySkinPath(projectRoot, project)
            : "",
        secretVideoPath: project.secretVideo?.sha256
          ? mahoganySecretVideoPath(projectRoot, project)
          : "",
      });
      project = await saveMahoganyProject(projectRoot, {
        ...project,
        status: "published",
        prepared: null,
        publication: {
          ...publication,
          published: true,
          publishedAt: new Date().toISOString(),
        },
      });
      return sendJson(response, 200, { ok: true, project, publication });
    } catch (error) {
      project = await saveMahoganyProject(projectRoot, {
        ...project,
        status: "failed",
        prepared: null,
        lastError: error.message,
      });
      throw error;
    }
  }
  if (request.method === "PUT" && action === "state") {
    if (!publisher)
      throw apiError(
        "Protected publishing is unavailable.",
        "publisher_unavailable",
      );
    let project = await loadMahoganyProject(projectRoot, id);
    if (!project.publication?.editionId)
      throw apiError(
        "Accept this Jukebox before changing publication state.",
        "edition_identity_missing",
      );
    const body = await readJson(request),
      publication = await publisher.setPublished({
        editionId: project.publication.editionId,
        published: body.published === true,
      });
    project = await saveMahoganyProject(projectRoot, {
      ...project,
      status: publication.published ? "published" : "unpublished",
      publication: { ...project.publication, ...publication },
    });
    return sendJson(response, 200, { ok: true, project });
  }
  response.writeHead(405);
  response.end("Method not allowed");
}

async function serve(response, file, base, headers = {}) {
  const resolved = path.resolve(file),
    allowed = path.resolve(base);
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const bytes = await fs.readFile(resolved);
    response.writeHead(200, {
      "content-type": mime(resolved),
      "cache-control": "no-store",
      ...headers,
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end("Asset unavailable");
  }
}
async function serveMedia(request, response, file, type) {
  try {
    const stat = await fs.stat(file),
      range = String(request.headers.range || "").match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]),
        end = range[2] ? Number(range[2]) : stat.size - 1,
        bytes = await fs.readFile(file),
        slice = bytes.subarray(start, Math.min(end + 1, bytes.length));
      response.writeHead(206, {
        "content-type": type,
        "content-length": slice.length,
        "content-range": `bytes ${start}-${start + slice.length - 1}/${stat.size}`,
        "accept-ranges": "bytes",
      });
      response.end(slice);
      return;
    }
    response.writeHead(200, {
      "content-type": type,
      "content-length": stat.size,
      "accept-ranges": "bytes",
    });
    response.end(await fs.readFile(file));
  } catch {
    response.writeHead(404);
    response.end("Video unavailable");
  }
}
async function readJson(request) {
  const bytes = await readBytes(request, 2 * 1024 * 1024);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw apiError("Request JSON is invalid.", "invalid_json");
  }
}
function readBytes(request, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > max) {
        request.destroy();
        reject(apiError("Request is too large.", "request_too_large"));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}
function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}
function mime(file) {
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".mp3": "audio/mpeg",
      ".ogg": "audio/ogg",
      ".mp4": "video/mp4",
    }[path.extname(file).toLowerCase()] || "application/octet-stream"
  );
}
function apiError(message, code) {
  return Object.assign(new Error(message), {
    name: "MahoganyStudioError",
    code,
  });
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const server = createMahoganyStudioServer();
  server.listen(Number(process.env.PORT) || 4390, "127.0.0.1", () =>
    console.log(
      `Mahogany Jukebox Studio: http://127.0.0.1:${server.address().port}/mahogany-studio/`,
    ),
  );
}
