import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderAggitsJukeboxStudioPreview } from "./aggits-jukebox-preview.mjs";
import { renderFullnoiseVuPreview } from "./fullnoise-vu-preview.mjs";
import { renderMahoganyVuPreview } from "./mahogany-vu-preview.mjs";
import { createMahoganyJukeboxPublisher } from "./mahogany-jukebox-publication.mjs";
import { runMahoganyBandCandidateBatch } from "./mahogany-band-candidates.mjs";
import {
  addBandcampDiscoveriesToLibrary,
  runBandcampDiscoveryBatch,
} from "./bandcamp-band-discovery.mjs";
import {
  archiveMahoganyProject,
  listMahoganyProjects,
  loadMahoganyProject,
  mahoganyIconCatalog,
  newMahoganyProject,
  normalizeMahoganyProject,
  removeMahoganyVuMedia,
  saveMahoganyProject,
  setMahoganyVuDucking,
  storeMahoganyMp4,
  storeMahoganyVuCharacter,
  storeMahoganyVuMusic,
  toPreviewProject,
  validateMahoganyProject,
} from "./mahogany-jukebox-model.mjs";
import {
  isVuAppearance,
  jukeboxProductProfile,
} from "./jukebox-product-profiles.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export function createMahoganyStudioServer({
  root = path.resolve(here, ".."),
  dataDir = path.join(root, ".mahogany-studio"),
  credentialStore,
  publisher,
  bandCandidateRunner = runMahoganyBandCandidateBatch,
  bandDiscoveryRunner = runBandcampDiscoveryBatch,
  fetchImpl = fetch,
  appVersion = "1.0.0",
} = {}) {
  const projectRoots = {
      mahogany: path.join(dataDir, jukeboxProductProfile("mahogany").projectFolder),
      fullnoise: path.join(dataDir, jukeboxProductProfile("fullnoise").projectFolder),
    },
    candidateJobs = new Map(),
    discoveryJobs = new Map(),
    directPublisher =
      publisher ||
      (credentialStore
        ? createMahoganyJukeboxPublisher({ credentialStore, root, appVersion })
        : null);
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname.startsWith("/api/fullnoise/")) {
        const routedUrl = new URL(url);
        routedUrl.pathname = routedUrl.pathname.replace(
          /^\/api\/fullnoise/,
          "/api/mahogany",
        );
        return await api({
          request,
          response,
          url: routedUrl,
          root,
          projectRoot: projectRoots.fullnoise,
          product: "fullnoise",
          apiBase: "/api/fullnoise",
          publisher: directPublisher,
          candidateJobs,
          bandCandidateRunner,
          discoveryJobs,
          bandDiscoveryRunner,
          fetchImpl,
        });
      }
      if (url.pathname.startsWith("/api/mahogany/"))
        return await api({
          request,
          response,
          url,
          root,
          projectRoot: projectRoots.mahogany,
          product: "mahogany",
          apiBase: "/api/mahogany",
          publisher: directPublisher,
          candidateJobs,
          bandCandidateRunner,
          discoveryJobs,
          bandDiscoveryRunner,
          fetchImpl,
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
      if (
        url.pathname === "/fullnoise-studio" ||
        url.pathname === "/fullnoise-studio/"
      )
        return serve(
          response,
          path.join(root, "fullnoise-studio", "index.html"),
          path.join(root, "fullnoise-studio"),
        );
      if (url.pathname.startsWith("/fullnoise-studio/"))
        return serve(
          response,
          path.join(root, url.pathname.replace(/^\//, "")),
          path.join(root, "fullnoise-studio"),
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
      const status =
        error.code === "project_not_found"
          ? 404
          : error.code === "project_identity_protected"
            ? 409
            : 400;
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
  product = "mahogany",
  apiBase = "/api/mahogany",
  publisher,
  candidateJobs,
  bandCandidateRunner,
  discoveryJobs,
  bandDiscoveryRunner,
  fetchImpl,
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
      newMahoganyProject({ product }),
    );
    return sendJson(response, 201, { ok: true, project });
  }
  if (
    product === "fullnoise" &&
    (url.pathname.includes("band-discovery") ||
      url.pathname.includes("candidate-batches"))
  ) {
    response.writeHead(404);
    response.end("Fullnoise uses its own manual production library.");
    return;
  }
  if (
    request.method === "POST" &&
    url.pathname === "/api/mahogany/band-discovery"
  ) {
    const running = [...discoveryJobs.values()].find(
      (job) => job.status === "running",
    );
    if (running) return sendJson(response, 202, { ok: true, job: publicDiscoveryJob(running) });
    const body = await readJson(request),
      job = {
        id: `banddiscovery_${crypto.randomBytes(8).toString("hex")}`,
        status: "running",
        stage: "queued",
        message: "Bandcamp discovery is queued.",
        location: cleanText(body.location, 100),
        found: 0,
        requested: 20,
        reviewed: 0,
        cancelled: false,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        result: null,
        error: "",
      };
    discoveryJobs.set(job.id, job);
    setImmediate(async () => {
      try {
        const result = await bandDiscoveryRunner({
          count: 20,
          location: job.location,
          existingProjects: await listMahoganyProjects(projectRoot),
          shouldCancel: () => job.cancelled,
          onProgress(progress) {
            Object.assign(job, progress, { updatedAt: new Date().toISOString() });
          },
        });
        Object.assign(job, {
          status: result.cancelled ? "cancelled" : "completed",
          stage: result.cancelled ? "cancelled" : "ready",
          message: result.cancelled
            ? `Cancelled with ${result.found} band${result.found === 1 ? "" : "s"} retained for review.`
            : `${result.found} bands ready`,
          found: result.found,
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
    return sendJson(response, 202, { ok: true, job: publicDiscoveryJob(job) });
  }
  const discoveryMatch = url.pathname.match(
    /^\/api\/mahogany\/band-discovery\/(banddiscovery_[a-f0-9]{16})(?:\/(cancel|to-library))?$/,
  );
  if (discoveryMatch) {
    const job = discoveryJobs.get(discoveryMatch[1]);
    if (!job) throw apiError("Band discovery job not found.", "discovery_job_not_found");
    const action = discoveryMatch[2] || "status";
    if (request.method === "GET" && action === "status")
      return sendJson(response, 200, { ok: true, job: publicDiscoveryJob(job) });
    if (request.method === "POST" && action === "cancel") {
      job.cancelled = true;
      job.message = "Cancelling after the current Bandcamp check...";
      job.updatedAt = new Date().toISOString();
      return sendJson(response, 202, { ok: true, job: publicDiscoveryJob(job) });
    }
    if (request.method === "POST" && action === "to-library") {
      if (!job.result)
        throw apiError("Discovery results are not ready.", "discovery_not_ready");
      const body = await readJson(request),
        selectedIds = Array.isArray(body.ids) ? body.ids.slice(0, 20) : [],
        outcome = await addBandcampDiscoveriesToLibrary({
          projectRoot,
          discoveries: job.result.results,
          selectedIds,
          existingProjects: await listMahoganyProjects(projectRoot),
        });
      const addedIds = new Set(outcome.added.map((project) => project.candidate?.bandId));
      const duplicateIds = new Set(outcome.duplicates.map((item) => item.discoveryId));
      for (const item of job.result.results) {
        if (addedIds.has(item.bandId)) item.libraryStatus = "added";
        else if (duplicateIds.has(item.id)) item.libraryStatus = "duplicate";
      }
      job.updatedAt = new Date().toISOString();
      return sendJson(response, 200, {
        ok: true,
        added: outcome.added,
        duplicates: outcome.duplicates,
        job: publicDiscoveryJob(job),
      });
    }
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
    /^\/api\/mahogany\/projects\/(studio_[a-f0-9]{12})(?:\/(preview|video|music|character|analysis|qr|publish|create|accept|state))?$/,
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
  if (request.method === "DELETE" && action === "project") {
    await archiveMahoganyProject(projectRoot, id);
    return sendJson(response, 200, {
      ok: true,
      id,
      archived: true,
    });
  }
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
        product,
        appearance:
          product === "fullnoise" ? "fullnoise-vu" : body.appearance,
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
  if (request.method === "PUT" && action === "music") {
    const project = await loadMahoganyProject(projectRoot, id),
      bytes = await readBytes(request, 48 * 1024 * 1024),
      updated = await storeMahoganyVuMusic(
        projectRoot,
        project,
        bytes,
        decodeURIComponent(request.headers["x-file-name"] || "music.mp3"),
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
  if (request.method === "GET" && action === "music") {
    const project = await loadMahoganyProject(projectRoot, id),
      media = project.vu.music,
      extension = media.mimeType === "audio/wav" ? "wav" : "mp3";
    return serveMedia(
      request,
      response,
      path.join(projectRoot, id, `music.${extension}`),
      media.mimeType || "audio/mpeg",
    );
  }
  if (request.method === "DELETE" && action === "music") {
    const project = await loadMahoganyProject(projectRoot, id),
      updated = await removeMahoganyVuMedia(projectRoot, project, "music");
    return sendJson(response, 200, {
      ok: true,
      project: await saveMahoganyProject(projectRoot, {
        ...updated,
        status: "draft",
        prepared: null,
      }),
    });
  }
  if (request.method === "PUT" && action === "character") {
    const project = await loadMahoganyProject(projectRoot, id),
      bytes = await readBytes(request, 24 * 1024 * 1024),
      updated = await storeMahoganyVuCharacter(
        projectRoot,
        project,
        bytes,
        decodeURIComponent(request.headers["x-file-name"] || "character.mp4"),
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
  if (request.method === "GET" && action === "character")
    return serveMedia(
      request,
      response,
      path.join(projectRoot, id, "character.mp4"),
      "video/mp4",
    );
  if (request.method === "DELETE" && action === "character") {
    const project = await loadMahoganyProject(projectRoot, id),
      updated = await removeMahoganyVuMedia(projectRoot, project, "character");
    return sendJson(response, 200, {
      ok: true,
      project: await saveMahoganyProject(projectRoot, {
        ...updated,
        status: "draft",
        prepared: null,
      }),
    });
  }
  if (request.method === "PUT" && action === "analysis") {
    const project = await loadMahoganyProject(projectRoot, id),
      body = await readJson(request),
      updated = setMahoganyVuDucking(project, body);
    return sendJson(response, 200, {
      ok: true,
      project: await saveMahoganyProject(projectRoot, {
        ...updated,
        status: "draft",
        prepared: null,
      }),
    });
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
      publicationAppearance =
        project.publication?.appearance || "mahogany-master",
      canonicalUrl =
        (publicationAppearance === project.appearance
          ? project.publication?.liveUrl
          : "") || project.prepared?.liveUrl || "",
      html =
        project.appearance === "fullnoise-vu"
          ? renderFullnoiseVuPreview(preview, {
              musicUrl: project.vu.music.fileName
                ? `${apiBase}/projects/${id}/music`
                : "",
              characterUrl: project.vu.character.fileName
                ? `${apiBase}/projects/${id}/character`
                : "",
              canonicalUrl,
            })
          : project.appearance === "mahogany-vu"
            ? renderMahoganyVuPreview(preview, {
                musicUrl: project.vu.music.fileName
                  ? `${apiBase}/projects/${id}/music`
                  : "",
                characterUrl: project.vu.character.fileName
                  ? `${apiBase}/projects/${id}/character`
                  : "",
                canonicalUrl,
              })
          : renderAggitsJukeboxStudioPreview(preview, {
              videoUrl:
                project.video.kind === "mp4"
                  ? `${apiBase}/projects/${id}/video`
                  : "",
              youtubeUrl:
                project.video.kind === "youtube" ? project.video.youtubeUrl : "",
              canonicalUrl,
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
    let project = await loadMahoganyProject(projectRoot, id),
      identityRepair = null;
    if (
      project.publication?.editionId &&
      String(project.publication.publishedTitle || "").toLocaleLowerCase() !==
        project.name.toLocaleLowerCase()
    ) {
      const repaired = await repairReusedPublicationIdentity(projectRoot, project, {
        fetchImpl,
      });
      project = repaired.project;
      identityRepair = repaired.identityRepair;
    }
    const publicationProjectId = project.id;
    const readiness = validateMahoganyProject(project, {
      requireStoredMp4: true,
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
        const qrBytes = await fs.readFile(
          path.join(projectRoot, publicationProjectId, "qr.png"),
        );
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
        await fs.writeFile(
          path.join(projectRoot, publicationProjectId, "qr.png"),
          prepared.qrBytes,
        );
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
            ? path.join(projectRoot, publicationProjectId, "video.mp4")
            : "",
        musicPath:
          isVuAppearance(project.appearance) && project.vu.music.fileName
            ? path.join(
                projectRoot,
                publicationProjectId,
                project.vu.music.mimeType === "audio/wav"
                  ? "music.wav"
                  : "music.mp3",
              )
            : "",
        characterPath:
          isVuAppearance(project.appearance) && project.vu.character.fileName
            ? path.join(
                projectRoot,
                publicationProjectId,
                "character.mp4",
              )
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
          publishedTitle: project.name,
          publishedAt: new Date().toISOString(),
        },
        publicationProgress: {
          stage: "completed",
          message: "Published, verified and delivered by email.",
          updatedAt: new Date().toISOString(),
        },
      });
      return sendJson(response, 200, {
        ok: true,
        project,
        publication,
        identityRepair,
      });
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
      readiness = validateMahoganyProject(project, { requireStoredMp4: true });
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
      previewUrl: `${apiBase}/projects/${id}/preview`,
      qrPreviewUrl: `${apiBase}/projects/${id}/qr?revision=${Date.now()}`,
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
        musicPath:
          isVuAppearance(project.appearance) && project.vu.music.fileName
            ? path.join(
                projectRoot,
                id,
                project.vu.music.mimeType === "audio/wav"
                  ? "music.wav"
                  : "music.mp3",
              )
            : "",
        characterPath:
          isVuAppearance(project.appearance) && project.vu.character.fileName
            ? path.join(projectRoot, id, "character.mp4")
            : "",
      });
      project = await saveMahoganyProject(projectRoot, {
        ...project,
        status: "published",
        prepared: null,
        publication: {
          ...publication,
          published: true,
          publishedTitle: project.name,
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

export async function repairReusedPublicationIdentity(
  projectRoot,
  project,
  { fetchImpl = fetch } = {},
) {
  const editionId = String(project?.publication?.editionId || ""),
    liveUrl = String(project?.publication?.liveUrl || "");
  if (!/^dc_[a-f0-9]{10}$/.test(editionId) || !liveUrl)
    return { project, identityRepair: null };
  let origin;
  try {
    origin = new URL(liveUrl).origin;
  } catch {
    throw apiError(
      "The existing permanent Jukebox URL is invalid.",
      "project_identity_check_failed",
    );
  }
  const response = await fetchImpl(
    `${origin}/api/aggits-jukebox-editions/${editionId}/config`,
    { cache: "no-store" },
  ).catch(() => null);
  if (!response?.ok)
    throw apiError(
      "The existing permanent Jukebox identity could not be checked safely. Nothing was published.",
      "project_identity_check_failed",
    );
  const remote = await response.json().catch(() => null),
    remoteJukebox = remote?.aggitsJukebox || {},
    remoteTitle = cleanText(remote?.bandName || remoteJukebox.title, 120);
  if (!remoteTitle)
    throw apiError(
      "The existing permanent Jukebox identity returned invalid information.",
      "project_identity_check_failed",
    );
  if (remoteJukebox.projectId && remoteJukebox.projectId !== project.id)
    throw apiError(
      "This permanent URL belongs to a different library item. Nothing was published.",
      "project_identity_check_failed",
    );
  if (remoteTitle.toLocaleLowerCase() === project.name.toLocaleLowerCase())
    return { project, identityRepair: null };

  const oldActions = Array.isArray(remoteJukebox.actions)
      ? remoteJukebox.actions
      : [],
    repairedActions = await repairInheritedDestinations(
      project.actions,
      oldActions,
      fetchImpl,
    ),
    fresh = newMahoganyProject({ product: project.product }),
    clone = await saveMahoganyProject(projectRoot, {
      ...project,
      id: fresh.id,
      actions: repairedActions,
      status: "draft",
      publication: null,
      publicationProgress: null,
      prepared: null,
      lastError: "",
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
      identitySeparatedFrom: {
        projectId: project.id,
        editionId,
        title: remoteTitle,
        separatedAt: new Date().toISOString(),
      },
    });
  await copyProjectMedia(projectRoot, project.id, clone.id);

  const restoredBase = newMahoganyProject({ product: project.product }),
    restoredAppearance =
      ["mahogany-vu", "fullnoise-vu"].includes(
        remoteJukebox.appearanceVariant,
      )
        ? remoteJukebox.appearanceVariant
        : "mahogany-master",
    restored = await saveMahoganyProject(projectRoot, {
      ...project,
      name: remoteTitle,
      tickerText: cleanText(remoteJukebox.tickerText, 500),
      appearance: restoredAppearance,
      video: {
        ...project.video,
        kind: remoteJukebox.videoKind === "mp4" ? "mp4" : "youtube",
        youtubeUrl: cleanText(remoteJukebox.youtubeUrl, 300),
      },
      vu: isVuAppearance(restoredAppearance) ? project.vu : restoredBase.vu,
      actions: oldActions.map((item, index) => ({
        slot: index + 1,
        iconId: item.iconId,
        label: item.label,
        href: item.href,
        openInNewTab: item.openInNewTab !== false,
      })),
      status: "published",
      publicationProgress: {
        stage: "completed",
        message: "Published identity preserved.",
        updatedAt: new Date().toISOString(),
      },
      prepared: null,
      lastError: "",
    });
  return {
    project: clone,
    identityRepair: {
      restoredProject: restored,
      previousTitle: remoteTitle,
      newTitle: clone.name,
      replacedDestinations: repairedActions.filter(
        (item, index) => item.href !== project.actions[index]?.href,
      ).length,
    },
  };
}

async function repairInheritedDestinations(current, previous, fetchImpl) {
  const previousUrls = new Set(
      previous.map((item) => String(item.href || "").trim()).filter(Boolean),
    ),
    bandcampUrl = current
      .map((item) => String(item.href || "").trim())
      .find((href) => {
        try {
          return (
            new URL(href).hostname.endsWith("bandcamp.com") &&
            !previousUrls.has(href)
          );
        } catch {
          return false;
        }
      });
  let official = [];
  if (bandcampUrl) {
    const response = await fetchImpl(bandcampUrl, { cache: "no-store" }).catch(
      () => null,
    );
    if (response?.ok) {
      const html = (await response.text()).replaceAll("&amp;", "&");
      official = [...html.matchAll(/href=["']([^"']+)["']/gi)]
        .map((match) => {
          try {
            return new URL(match[1], bandcampUrl).toString();
          } catch {
            return "";
          }
        })
        .filter(Boolean);
    }
  }
  const platform = (host) =>
      official.find((href) => {
        try {
          return new URL(href).hostname.replace(/^www\./, "") === host;
        } catch {
          return false;
        }
      }) || "",
    contact =
      official.find((href) => {
        try {
          const url = new URL(href);
          return url.hostname.endsWith("bandcamp.com") && url.pathname === "/contact";
        } catch {
          return false;
        }
      }) || "";
  let contactUsed = false;
  return current.map((item) => {
    if (!previousUrls.has(String(item.href || "").trim())) return item;
    if (item.iconId === "instagram") {
      const href = platform("instagram.com");
      if (href) return { ...item, href };
    }
    if (item.iconId === "facebook") {
      const href = platform("facebook.com");
      if (href) return { ...item, href };
    }
    if (contact && !contactUsed) {
      contactUsed = true;
      return { ...item, iconId: "contact", label: "Contact", href: contact };
    }
    return { ...item, href: "" };
  });
}

async function copyProjectMedia(projectRoot, sourceId, destinationId) {
  const source = path.join(projectRoot, sourceId),
    destination = path.join(projectRoot, destinationId);
  await fs.mkdir(destination, { recursive: true });
  for (const file of [
    "video.mp4",
    "music.mp3",
    "music.wav",
    "character.mp4",
  ])
    await fs
      .copyFile(path.join(source, file), path.join(destination, file))
      .catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
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

function publicDiscoveryJob(job) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    message: job.message,
    location: job.location,
    found: Number(job.found) || 0,
    requested: Number(job.requested) || 20,
    reviewed: Number(job.reviewed) || 0,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    result: job.result,
    error: job.error,
  };
}

function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const server = createMahoganyStudioServer({
    ...(process.env.MAHOGANY_STUDIO_DATA_DIR
      ? { dataDir: path.resolve(process.env.MAHOGANY_STUDIO_DATA_DIR) }
      : {}),
  });
  const studioHost = process.env.MAHOGANY_STUDIO_HOST || "127.0.0.1";
  server.listen(Number(process.env.PORT) || 4390, studioHost, () =>
    console.log(
      `Mahogany Jukebox Studio: http://127.0.0.1:${server.address().port}/mahogany-studio/`,
    ),
  );
}
