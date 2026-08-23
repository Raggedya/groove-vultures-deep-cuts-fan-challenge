import {
  AGGITS_JUKEBOX_APPEARANCE,
  AGGITS_JUKEBOX_ICONS,
} from "../scripts/aggits-jukebox-icons.mjs";
import {
  MAHOGANY_OVAL_CABINET_ASSET,
  MAHOGANY_RENDERER_VERSION,
  renderAggitsJukeboxStudioPreview,
} from "../scripts/aggits-jukebox-preview.mjs";
import {
  MAHOGANY_LEGACY_LAYOUT_ID,
  resolveMahoganyLayoutProfile,
} from "../scripts/mahogany-jukebox-layout.mjs";
import {
  MAHOGANY_SKIN_MAX_BYTES,
  normalizeMahoganySkin,
  validateMahoganySkinDefinition,
} from "../scripts/mahogany-jukebox-skin-schema.mjs";

const JSON_HEADERS = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
  VIDEO_MAX_BYTES = 24 * 1024 * 1024,
  QR_MAX_BYTES = 8 * 1024 * 1024,
  SKIN_MAX_BYTES = MAHOGANY_SKIN_MAX_BYTES;
const ICON_IDS = new Set(AGGITS_JUKEBOX_ICONS.map((item) => item.id));

export async function handleAggitsJukeboxPublisher(request, env, url) {
  if (!env.DB || !env.BAR_ASSETS || !env.ADMIN_TOKEN)
    return json(
      {
        ok: false,
        error: "Automatic Aggits Jukebox publishing is not configured.",
      },
      503,
    );
  const path = url.pathname.replace(/^\/api\/aggits-jukebox-publisher\/?/, ""),
    device = await authorize(request, env);
  if (!device)
    return json(
      {
        ok: false,
        error: "Secure Studio activation is required.",
        code: "publisher_activation_required",
      },
      401,
    );
  if (path === "session" && request.method === "GET")
    return json({
      ok: true,
      active: true,
      installationId: device.installation_id,
    });
  if (path === "publications" && request.method === "POST")
    return prepare(request, env, device, url);
  const state = path.match(/^editions\/(dc_[a-f0-9]{10})\/state$/);
  if (state && request.method === "PUT")
    return setState(request, env, state[1], url, device);
  const match = path.match(
    /^publications\/(ajjob_[a-f0-9-]+)(?:\/(video|skin|secret-video|qr|commit|rollback))?$/,
  );
  if (!match)
    return json({ ok: false, error: "Publisher route not found." }, 404);
  const job = await ownedJob(env, match[1], device.installation_id);
  if (!job)
    return json({ ok: false, error: "Publication job not found." }, 404);
  const action = match[2] || "status";
  if (action === "status" && request.method === "GET")
    return json({ ok: true, job: publicJob(job) });
  if (action === "video" && request.method === "PUT")
    return uploadVideo(request, env, job);
  if (action === "skin" && request.method === "PUT")
    return uploadSkin(request, env, job);
  if (action === "secret-video" && request.method === "PUT")
    return uploadSecretVideo(request, env, job);
  if (action === "qr" && request.method === "PUT")
    return uploadQr(request, env, job);
  if (action === "commit" && request.method === "POST") return commit(env, job);
  if (action === "rollback" && request.method === "POST")
    return rollback(
      env,
      job,
      "client_verification_failed",
      "Studio could not verify the live Jukebox.",
    );
  return json({ ok: false, error: "Publisher method not allowed." }, 405);
}

export async function handleAggitsJukeboxPublicAsset(request, env, url) {
  if (!env.DB || !env.BAR_ASSETS) return null;
  const page = url.pathname.match(/^\/e\/(dc_[a-f0-9]{10})$/);
  if (page && ["GET", "HEAD"].includes(request.method)) {
    const row = await env.DB.prepare(
      "SELECT config_json FROM aggits_jukebox_editions WHERE edition_id=?1 AND status='active'",
    )
      .bind(page[1])
      .first();
    if (!row) return null;
    const config = JSON.parse(row.config_json),
      project = publicProject(config, page[1]),
      html = renderAggitsJukeboxStudioPreview(project, {
        videoUrl:
          config.aggitsJukebox?.videoKind === "mp4"
            ? `/api/aggits-jukebox-assets/${page[1]}/video`
            : "",
        youtubeUrl: config.aggitsJukebox?.youtubeUrl || "",
        skinUrl:
          config.aggitsJukebox?.skin?.kind === "custom"
            ? `/api/aggits-jukebox-assets/${page[1]}/skin?v=${String(config.aggitsJukebox.skin.sha256 || "").slice(0, 12)}`
            : "",
        secretVideoUrl: config.aggitsJukebox?.secretVideo?.publicPath || "",
        publicMode: true,
        canonicalUrl: `${url.origin}${url.pathname}`,
      });
    return new Response(request.method === "HEAD" ? null : html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-deep-cuts-renderer": MAHOGANY_RENDERER_VERSION,
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    });
  }
  const config = url.pathname.match(
    /^\/api\/aggits-jukebox-editions\/(dc_[a-f0-9]{10})\/config$/,
  );
  if (config && ["GET", "HEAD"].includes(request.method)) {
    const row = await env.DB.prepare(
      "SELECT config_json FROM aggits_jukebox_editions WHERE edition_id=?1 AND status='active'",
    )
      .bind(config[1])
      .first();
    if (!row) return new Response("Unknown Deep Cuts edition", { status: 404 });
    return new Response(request.method === "HEAD" ? null : row.config_json, {
      headers: { ...JSON_HEADERS, "cache-control": "public, max-age=60" },
    });
  }
  const video = url.pathname.match(
    /^\/api\/aggits-jukebox-assets\/(dc_[a-f0-9]{10})\/video$/,
  );
  if (video && ["GET", "HEAD"].includes(request.method))
    return serveObjectForEdition(request, env, video[1], "video");
  const secretVideo = url.pathname.match(
    /^\/api\/aggits-jukebox-assets\/(dc_[a-f0-9]{10})\/secret-video$/,
  );
  if (secretVideo && ["GET", "HEAD"].includes(request.method))
    return serveSecretVideoForEdition(request, env, secretVideo[1]);
  const skin = url.pathname.match(
    /^\/api\/aggits-jukebox-assets\/(dc_[a-f0-9]{10})\/skin$/,
  );
  if (skin && ["GET", "HEAD"].includes(request.method))
    return serveSkinForEdition(request, env, skin[1]);
  const qr = url.pathname.match(
    /^\/output\/(aggits-jukebox-[a-z0-9-]+)\/instagram-qr\.png$/,
  );
  if (qr && ["GET", "HEAD"].includes(request.method)) {
    const row = await env.DB.prepare(
      "SELECT qr_key FROM aggits_jukebox_editions WHERE slug=?1 AND status='active'",
    )
      .bind(qr[1])
      .first();
    return row
      ? serveObject(request, env.BAR_ASSETS, row.qr_key, "image/png")
      : new Response("QR artwork not found", { status: 404 });
  }
  return null;
}

export async function augmentAggitsJukeboxManifest(staticResponse, env) {
  if (
    !env.DB ||
    !staticResponse.ok ||
    !(staticResponse.headers.get("content-type") || "").includes("json")
  )
    return staticResponse;
  let platform;
  try {
    platform = await staticResponse.json();
  } catch {
    return staticResponse;
  }
  let rows;
  try {
    rows = await env.DB.prepare(
      "SELECT edition_id,slug,title FROM aggits_jukebox_editions WHERE status='active' ORDER BY created_at",
    ).all();
  } catch {
    return json(platform, 200, { "cache-control": "no-store" });
  }
  const existing = new Set(
    (platform.editions || []).map((item) => item.editionId),
  );
  for (const row of rows.results || [])
    if (!existing.has(row.edition_id))
      platform.editions.push({
        slug: row.slug,
        editionId: row.edition_id,
        canonicalPath: `/e/${row.edition_id}`,
        name: row.title,
        config: `api/aggits-jukebox-editions/${row.edition_id}/config`,
        active: true,
        dynamic: true,
      });
  return json(platform, 200, { "cache-control": "no-store" });
}

export async function handleAggitsJukeboxDeliveryEvent(
  env,
  { body, tags, occurredAt },
) {
  if (tags.job_type !== "aggits_jukebox" || !tags.job_id) return false;
  const job = await env.DB.prepare(
    "SELECT * FROM aggits_jukebox_publication_jobs WHERE job_id=?1",
  )
    .bind(clean(tags.job_id, 100))
    .first();
  if (!job) return true;
  if (body.type === "email.delivered")
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE aggits_jukebox_publication_jobs SET status='published',stage='published',completed_at=?1,updated_at=?1,error_code=NULL,error_message=NULL WHERE job_id=?2",
      ).bind(occurredAt, job.job_id),
      env.DB.prepare(
        "UPDATE aggits_jukebox_editions SET status='active',updated_at=?1 WHERE edition_id=?2 AND current_job_id=?3",
      ).bind(occurredAt, job.edition_id, job.job_id),
      env.DB.prepare(
        "UPDATE editions SET status='active',updated_at=?1 WHERE edition_id=?2",
      ).bind(occurredAt, job.edition_id),
      env.DB.prepare(
        "UPDATE production_jobs SET email_delivered_at=?1,status='completed',completed_at=?1,updated_at=?1 WHERE job_id=?2",
      ).bind(occurredAt, job.job_id),
    ]);
  else if (
    ["email.bounced", "email.failed", "email.complained"].includes(body.type)
  )
    await rollback(
      env,
      job,
      "email_delivery_failed",
      `Completion email reported ${body.type}.`,
    );
  return true;
}

async function prepare(request, env, device, url) {
  const manifest = validateManifest(await safeJson(request));
  if (!manifest.ok)
    return json(
      { ok: false, error: manifest.error, code: "publication_not_ready" },
      400,
    );
  let active = await env.DB.prepare(
    "SELECT * FROM aggits_jukebox_publication_jobs WHERE project_id=?1 AND status IN ('prepared','video_uploaded','skin_uploaded','secret_video_uploaded','qr_uploaded','awaiting_delivery') LIMIT 1",
  )
    .bind(manifest.value.projectId)
    .first();
  if (active) {
    const sameDevice = active.installation_id === device.installation_id,
      sameManifest = publicationManifestsMatch(
        JSON.parse(active.manifest_json || "null"),
        manifest.value,
      );
    if (
      sameDevice &&
      sameManifest &&
      active.status === "video_uploaded" &&
      manifest.value.skin.kind === "default"
    ) {
      const migratedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE aggits_jukebox_publication_jobs SET status='skin_uploaded',stage='skin_uploaded',updated_at=?1 WHERE job_id=?2 AND status='video_uploaded'",
      )
        .bind(migratedAt, active.job_id)
        .run();
      active = {
        ...active,
        status: "skin_uploaded",
        stage: "skin_uploaded",
        updated_at: migratedAt,
      };
    }
    if (
      sameDevice &&
      sameManifest &&
      active.status === "skin_uploaded" &&
      !manifest.value.secretVideo
    ) {
      const migratedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE aggits_jukebox_publication_jobs SET status='secret_video_uploaded',stage='secret_video_uploaded',updated_at=?1 WHERE job_id=?2 AND status='skin_uploaded'",
      )
        .bind(migratedAt, active.job_id)
        .run();
      active = {
        ...active,
        status: "secret_video_uploaded",
        stage: "secret_video_uploaded",
        updated_at: migratedAt,
      };
    }
    if (sameDevice && sameManifest)
      return json({
        ok: true,
        resumed: true,
        job: publicJob(active),
        qrPayload: `${active.base_url || url.origin}/q/${active.edition_id}`,
      });
    if (sameDevice && active.status !== "awaiting_delivery")
      await rollback(
        env,
        active,
        "publication_superseded",
        "A newer publication replaced this unfinished draft.",
      );
    else
      return json(
        {
          ok: false,
          error:
            active.status === "awaiting_delivery"
              ? "The completion email is still being confirmed. Try this button again shortly."
              : "This Jukebox is being published by another authorised installation.",
          code: "publication_in_progress",
        },
        409,
      );
  }
  const now = new Date().toISOString(),
    existing = await env.DB.prepare(
      "SELECT * FROM aggits_jukebox_editions WHERE project_id=?1",
    )
      .bind(manifest.value.projectId)
      .first(),
    editionId = existing?.edition_id || (await uniqueEditionId(env)),
    slug = existing?.slug || stableSlug(manifest.value.projectId),
    jobId = `ajjob_${crypto.randomUUID()}`,
    baseUrl = url.origin,
    videoKey =
      manifest.value.video.kind === "mp4"
        ? `aggits-jukebox/${editionId}/${jobId}/welcome.mp4`
        : `youtube:${manifest.value.video.youtubeId}`,
    qrKey = `aggits-jukebox/${editionId}/${jobId}/qr.png`,
    customSkin = manifest.value.skin.kind === "custom",
    initialStatus =
      manifest.value.video.kind === "youtube"
        ? customSkin
          ? "video_uploaded"
          : manifest.value.secretVideo
            ? "skin_uploaded"
            : "secret_video_uploaded"
        : "prepared",
    initialStage = initialStatus;
  await env.DB.prepare(
    `INSERT INTO aggits_jukebox_publication_jobs (job_id,installation_id,project_id,edition_id,slug,title,status,stage,manifest_json,previous_record_json,base_url,video_key,qr_key,video_sha256,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)`,
  )
    .bind(
      jobId,
      device.installation_id,
      manifest.value.projectId,
      editionId,
      slug,
      manifest.value.title,
      initialStatus,
      initialStage,
      JSON.stringify(manifest.value),
      existing ? JSON.stringify(existing) : null,
      baseUrl,
      videoKey,
      qrKey,
      manifest.value.video.sha256,
      now,
    )
    .run();
  return json({
    ok: true,
    job: publicJob({
      job_id: jobId,
      edition_id: editionId,
      slug,
      title: manifest.value.title,
      status: initialStatus,
      stage: initialStage,
      base_url: baseUrl,
      updated_at: now,
    }),
    qrPayload: `${baseUrl}/q/${editionId}`,
  });
}
async function uploadVideo(request, env, job) {
  if (!["prepared", "video_uploaded"].includes(job.status))
    return json(
      { ok: false, error: "The publication is not accepting a video." },
      409,
    );
  const publicationManifest = JSON.parse(job.manifest_json),
    expected = publicationManifest.video;
  if (expected.kind !== "mp4")
    return json(
      {
        ok: false,
        error: "This edition uses YouTube and does not accept an MP4 upload.",
      },
      409,
    );
  const length = contentLength(request);
  if (length <= 0 || length > VIDEO_MAX_BYTES || length !== expected.sizeBytes)
    return json(
      { ok: false, error: "The MP4 size does not match the manifest." },
      400,
    );
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (
    bytes.length !== length ||
    !isMp4(bytes) ||
    (await sha256(bytes)) !== expected.sha256
  )
    return json(
      { ok: false, error: "The MP4 failed format or SHA-256 validation." },
      400,
    );
  await env.BAR_ASSETS.put(job.video_key, bytes, {
    httpMetadata: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      sha256: expected.sha256,
      jobId: job.job_id,
      editionId: job.edition_id,
    },
  });
  const nextStatus =
    publicationManifest.skin?.kind === "custom"
      ? "video_uploaded"
      : publicationManifest.secretVideo
        ? "skin_uploaded"
        : "secret_video_uploaded";
  await env.DB.prepare(
    "UPDATE aggits_jukebox_publication_jobs SET status=?1,stage=?1,updated_at=?2 WHERE job_id=?3",
  )
    .bind(nextStatus, new Date().toISOString(), job.job_id)
    .run();
  return json({ ok: true, stage: nextStatus });
}
async function uploadSkin(request, env, job) {
  if (!["video_uploaded", "skin_uploaded"].includes(job.status))
    return json(
      { ok: false, error: "Validate the selected video before the skin." },
      409,
    );
  const expected = JSON.parse(job.manifest_json).skin;
  if (expected?.kind !== "custom")
    return json(
      { ok: false, error: "This edition uses the Mahogany Master skin." },
      409,
    );
  const length = contentLength(request),
    type = String(request.headers.get("content-type") || "").toLowerCase();
  if (
    length <= 0 ||
    length > SKIN_MAX_BYTES ||
    length !== expected.sizeBytes ||
    type !== expected.mimeType
  )
    return json(
      { ok: false, error: "The cabinet skin size or media type does not match the manifest." },
      400,
    );
  const bytes = new Uint8Array(await request.arrayBuffer()),
    actualSha = await sha256(bytes);
  if (
    bytes.length !== length ||
    actualSha !== expected.sha256 ||
    !isSupportedSkin(bytes, expected.format, expected.width, expected.height)
  )
    return json(
      { ok: false, error: "The cabinet skin failed format, geometry or SHA-256 validation." },
      400,
    );
  const objectKey = skinObjectKey(job, expected);
  await env.BAR_ASSETS.put(objectKey, bytes, {
    httpMetadata: {
      contentType: expected.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      sha256: expected.sha256,
      width: String(expected.width),
      height: String(expected.height),
      layoutProfile: String(expected.layoutProfile || ""),
      jobId: job.job_id,
      editionId: job.edition_id,
    },
  });
  await env.DB.prepare(
    "UPDATE aggits_jukebox_publication_jobs SET status=?1,stage=?1,updated_at=?2 WHERE job_id=?3",
  )
    .bind(
      JSON.parse(job.manifest_json).secretVideo ? "skin_uploaded" : "secret_video_uploaded",
      new Date().toISOString(),
      job.job_id,
    )
    .run();
  return json({
    ok: true,
    stage: JSON.parse(job.manifest_json).secretVideo
      ? "skin_uploaded"
      : "secret_video_uploaded",
  });
}
async function uploadSecretVideo(request, env, job) {
  if (!['skin_uploaded', 'secret_video_uploaded'].includes(job.status))
    return json(
      { ok: false, error: "Validate the selected skin before the secret video." },
      409,
    );
  const expected = JSON.parse(job.manifest_json).secretVideo;
  if (!expected)
    return json({ ok: false, error: "This edition has no secret video." }, 409);
  const length = contentLength(request);
  if (
    length <= 0 ||
    length > VIDEO_MAX_BYTES ||
    length !== Number(expected.sizeBytes)
  )
    return json(
      { ok: false, error: "The secret MP4 size does not match the manifest." },
      400,
    );
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (
    bytes.length !== length ||
    !isMp4(bytes) ||
    (await sha256(bytes)) !== expected.sha256
  )
    return json(
      { ok: false, error: "The secret MP4 failed format or SHA-256 validation." },
      400,
    );
  await env.BAR_ASSETS.put(secretVideoObjectKey(job, expected), bytes, {
    httpMetadata: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      sha256: expected.sha256,
      jobId: job.job_id,
      editionId: job.edition_id,
    },
  });
  await env.DB.prepare(
    "UPDATE aggits_jukebox_publication_jobs SET status='secret_video_uploaded',stage='secret_video_uploaded',updated_at=?1 WHERE job_id=?2",
  )
    .bind(new Date().toISOString(), job.job_id)
    .run();
  return json({ ok: true, stage: "secret_video_uploaded" });
}
async function uploadQr(request, env, job) {
  if (!["secret_video_uploaded", "qr_uploaded"].includes(job.status))
    return json(
      { ok: false, error: "Validate the selected video before the QR." },
      409,
    );
  const length = contentLength(request),
    bytes = new Uint8Array(await request.arrayBuffer()),
    payload = request.headers.get("x-deep-cuts-qr-payload") || "",
    proof = request.headers.get("x-deep-cuts-qr-scan-proof") || "";
  if (
    length <= 0 ||
    length > QR_MAX_BYTES ||
    !isPng(bytes, 1254, 1254) ||
    payload !== `${job.base_url}/q/${job.edition_id}` ||
    proof !== "perspective-matrix:1254+627;decoder:360-required"
  )
    return json(
      {
        ok: false,
        error:
          "The permanent perspective-fitted QR artwork or scan proof is invalid.",
      },
      400,
    );
  const sha = await sha256(bytes);
  if (
    sha !== String(request.headers.get("x-content-sha256") || "").toLowerCase()
  )
    return json({ ok: false, error: "The QR SHA-256 identity failed." }, 400);
  await env.BAR_ASSETS.put(job.qr_key, bytes, {
    httpMetadata: {
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      sha256: sha,
      payload,
      scanProof: proof,
      jobId: job.job_id,
      editionId: job.edition_id,
    },
  });
  await env.DB.prepare(
    "UPDATE aggits_jukebox_publication_jobs SET status='qr_uploaded',stage='qr_uploaded',qr_sha256=?1,updated_at=?2 WHERE job_id=?3",
  )
    .bind(sha, new Date().toISOString(), job.job_id)
    .run();
  return json({ ok: true, stage: "qr_uploaded", sha256: sha });
}
async function commit(env, input) {
  const job = await env.DB.prepare(
    "SELECT * FROM aggits_jukebox_publication_jobs WHERE job_id=?1",
  )
    .bind(input.job_id)
    .first();
  if (job.status !== "qr_uploaded")
    return json(
      {
        ok: false,
        error: "The validated video selection and QR are required.",
      },
      409,
    );
  const manifest = JSON.parse(job.manifest_json);
  const [video, skin, secretVideo, qr] = await Promise.all([
    manifest.video.kind === "mp4"
      ? env.BAR_ASSETS.head(job.video_key)
      : Promise.resolve({ customMetadata: { sha256: job.video_sha256 } }),
    manifest.skin?.kind === "custom"
      ? env.BAR_ASSETS.head(skinObjectKey(job, manifest.skin))
      : Promise.resolve({ customMetadata: { sha256: "default" } }),
    manifest.secretVideo
      ? env.BAR_ASSETS.head(secretVideoObjectKey(job, manifest.secretVideo))
      : Promise.resolve({ customMetadata: { sha256: "none" } }),
    env.BAR_ASSETS.head(job.qr_key),
  ]);
  if (
    !video ||
    video.customMetadata?.sha256 !== job.video_sha256 ||
    !skin ||
    skin.customMetadata?.sha256 !==
      (manifest.skin?.kind === "custom" ? manifest.skin.sha256 : "default") ||
    !secretVideo ||
    secretVideo.customMetadata?.sha256 !==
      (manifest.secretVideo ? manifest.secretVideo.sha256 : "none") ||
    !qr ||
    qr.customMetadata?.sha256 !== job.qr_sha256
  )
    return rollback(
      env,
      job,
      "asset_verification_failed",
      "Stored assets failed identity verification.",
    );
  const now = new Date().toISOString(),
    config = buildConfig(job, manifest);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO aggits_jukebox_editions (edition_id,project_id,slug,title,config_json,video_key,qr_key,status,current_job_id,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'active',?8,?9,?9) ON CONFLICT(edition_id) DO UPDATE SET title=excluded.title,config_json=excluded.config_json,video_key=excluded.video_key,qr_key=excluded.qr_key,status='active',current_job_id=excluded.current_job_id,updated_at=excluded.updated_at`,
    ).bind(
      job.edition_id,
      job.project_id,
      job.slug,
      job.title,
      JSON.stringify(config),
      job.video_key,
      job.qr_key,
      job.job_id,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO editions (edition_id,band_name,config_path,canonical_path,status,deployed_at,commit_sha,created_at,updated_at) VALUES (?1,?2,?3,?4,'active',?5,NULL,?5,?5) ON CONFLICT(edition_id) DO UPDATE SET band_name=excluded.band_name,config_path=excluded.config_path,canonical_path=excluded.canonical_path,status='active',deployed_at=excluded.deployed_at,updated_at=excluded.updated_at`,
    ).bind(
      job.edition_id,
      job.title,
      `api/aggits-jukebox-editions/${job.edition_id}/config`,
      `/e/${job.edition_id}`,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO production_jobs (job_id,edition_id,band_name,status,submitted_at,research_completed_at,validation_completed_at,deployed_at,updated_at) VALUES (?1,?2,?3,'deployed',?4,?4,?4,?4,?4) ON CONFLICT(job_id) DO UPDATE SET status='deployed',updated_at=?4`,
    ).bind(job.job_id, job.edition_id, job.title, now),
    env.DB.prepare(
      "UPDATE aggits_jukebox_publication_jobs SET status='awaiting_delivery',stage='email_delivery',updated_at=?1 WHERE job_id=?2",
    ).bind(now, job.job_id),
  ]);
  const object = await env.BAR_ASSETS.get(job.qr_key),
    email = await sendEmail(
      env,
      job,
      new Uint8Array(await object.arrayBuffer()),
    );
  if (!email.ok)
    return rollback(
      env,
      { ...job, status: "awaiting_delivery" },
      "email_request_failed",
      email.error,
    );
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE aggits_jukebox_publication_jobs SET email_id=?1,updated_at=?2 WHERE job_id=?3",
    ).bind(email.id, now, job.job_id),
    env.DB.prepare(
      "UPDATE production_jobs SET status='email_accepted',email_accepted_at=?1,updated_at=?1 WHERE job_id=?2",
    ).bind(now, job.job_id),
  ]);
  return json(
    {
      ok: true,
      job: publicJob({
        ...job,
        status: "awaiting_delivery",
        stage: "email_delivery",
        email_id: email.id,
        updated_at: now,
      }),
    },
    202,
  );
}
async function sendEmail(env, job, bytes) {
  if (!env.RESEND_API_KEY || !env.REPORT_RECIPIENT || !env.REPORT_FROM_EMAIL)
    return { ok: false, error: "Completion email is not configured." };
  const liveUrl = `${job.base_url}/e/${job.edition_id}`,
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": `aggits-jukebox-${job.job_id}`,
      },
      body: JSON.stringify({
        from: env.REPORT_FROM_EMAIL,
        to: [env.REPORT_RECIPIENT],
        subject: `JookBox published: ${clean(job.title, 200)}`,
        html: `<p><strong>${escapeHtml(job.title)}</strong> has passed protected publication and is live.</p><p><a href="${escapeHtml(liveUrl)}">Open ${escapeHtml(job.title)}</a></p><p>Copyable permanent URL:</p><p><code style="font-size:16px;user-select:all">${escapeHtml(liveUrl)}</code></p><p>The fitted, scan-tested QR artwork is attached.</p>`,
        attachments: [
          { content: bytesBase64(bytes), filename: `${job.slug}-qr.png` },
        ],
        tags: [
          { name: "job_id", value: job.job_id },
          { name: "edition_id", value: job.edition_id },
          { name: "job_type", value: "aggits_jukebox" },
        ],
      }),
    }),
    result = await response.json().catch(() => ({}));
  return response.ok
    ? { ok: true, id: clean(result.id, 160) }
    : { ok: false, error: "Completion email was rejected." };
}
async function rollback(env, job, code, message) {
  const previous = job.previous_record_json
      ? JSON.parse(job.previous_record_json)
      : null,
    now = new Date().toISOString(),
    batch = [];
  if (previous) {
    batch.push(
      env.DB.prepare(
        "UPDATE aggits_jukebox_editions SET title=?1,config_json=?2,video_key=?3,qr_key=?4,status=?5,current_job_id=?6,updated_at=?7 WHERE edition_id=?8",
      ).bind(
        previous.title,
        previous.config_json,
        previous.video_key,
        previous.qr_key,
        previous.status,
        previous.current_job_id,
        now,
        job.edition_id,
      ),
    );
    batch.push(
      env.DB.prepare(
        "UPDATE editions SET band_name=?1,status=?2,updated_at=?3 WHERE edition_id=?4",
      ).bind(previous.title, previous.status, now, job.edition_id),
    );
  } else {
    batch.push(
      env.DB.prepare(
        "DELETE FROM aggits_jukebox_editions WHERE edition_id=?1 AND current_job_id=?2",
      ).bind(job.edition_id, job.job_id),
    );
    batch.push(
      env.DB.prepare(
        "UPDATE editions SET status='inactive',updated_at=?1 WHERE edition_id=?2",
      ).bind(now, job.edition_id),
    );
  }
  batch.push(
    env.DB.prepare(
      "UPDATE aggits_jukebox_publication_jobs SET status='failed',stage='failed',error_code=?1,error_message=?2,updated_at=?3,completed_at=?3 WHERE job_id=?4",
    ).bind(code, clean(message, 600), now, job.job_id),
  );
  await env.DB.batch(batch);
  const manifest = JSON.parse(job.manifest_json || "null");
  await Promise.all([
    String(job.video_key || "").startsWith("aggits-jukebox/")
      ? env.BAR_ASSETS.delete(job.video_key)
      : Promise.resolve(),
    job.qr_key ? env.BAR_ASSETS.delete(job.qr_key) : Promise.resolve(),
    manifest?.skin?.kind === "custom"
      ? env.BAR_ASSETS.delete(skinObjectKey(job, manifest.skin))
      : Promise.resolve(),
    manifest?.secretVideo
      ? env.BAR_ASSETS.delete(secretVideoObjectKey(job, manifest.secretVideo))
      : Promise.resolve(),
  ]).catch(() => {});
  return json(
    {
      ok: false,
      error: message,
      code,
      job: publicJob({
        ...job,
        status: "failed",
        error_code: code,
        error_message: message,
      }),
    },
    409,
  );
}
async function setState(request, env, editionId, url, device) {
  const body = await safeJson(request),
    published = body?.published === true,
    row = await env.DB.prepare(
      "SELECT ae.* FROM aggits_jukebox_editions ae JOIN aggits_jukebox_publication_jobs aj ON aj.job_id=ae.current_job_id WHERE ae.edition_id=?1 AND aj.installation_id=?2",
    )
      .bind(editionId, device.installation_id)
      .first();
  if (!row)
    return json(
      { ok: false, error: "The permanent edition was not found." },
      404,
    );
  if (published) {
    const config = JSON.parse(row.config_json);
    const requiresStoredVideo = config.aggitsJukebox?.videoKind !== "youtube";
    const [video, skin, secretVideo, qr] = await Promise.all([
      requiresStoredVideo
        ? env.BAR_ASSETS.head(row.video_key)
        : Promise.resolve(true),
      config.aggitsJukebox?.skin?.kind === "custom"
        ? env.BAR_ASSETS.head(config.aggitsJukebox.skin.objectKey)
        : Promise.resolve(true),
      config.aggitsJukebox?.secretVideo?.objectKey
        ? env.BAR_ASSETS.head(config.aggitsJukebox.secretVideo.objectKey)
        : Promise.resolve(true),
      env.BAR_ASSETS.head(row.qr_key),
    ]);
    if (!video || !skin || !secretVideo || !qr)
      return json(
        { ok: false, error: "Preserved assets did not pass validation." },
        409,
      );
  }
  const status = published ? "active" : "inactive",
    now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE aggits_jukebox_editions SET status=?1,updated_at=?2 WHERE edition_id=?3",
    ).bind(status, now, editionId),
    env.DB.prepare(
      "UPDATE editions SET status=?1,updated_at=?2 WHERE edition_id=?3",
    ).bind(status, now, editionId),
  ]);
  return json({
    ok: true,
    editionId,
    slug: row.slug,
    published,
    liveUrl: `${url.origin}/e/${editionId}`,
    qrImageUrl: `${url.origin}/output/${row.slug}/instagram-qr.png`,
    identityPreserved: true,
  });
}

function buildConfig(job, m) {
  const now = new Date().toISOString(),
    layoutProfile =
      String(m.layoutProfile || "") ||
      resolveMahoganyLayoutProfile({
        layoutProfile: m.skin?.layoutProfile,
        skin: m.skin,
      }).id;
  return {
    brandName: "Mahogany Jukebox",
    editionType: "aggits_jukebox",
    bandName: m.title,
    editionTitle: m.title,
    description: m.tickerText,
    mode: "discovery",
    slug: job.slug,
    publicURL: `${job.base_url}/e/${job.edition_id}`,
    social: {
      copyright: "Copyright Clearlight Creative",
      qrImage: `output/${job.slug}/instagram-qr.png`,
    },
    analytics: {
      editionId: job.edition_id,
      pageIdentifier: `${job.edition_id}:aggits-jukebox-v1`,
    },
    production: {
      jobId: job.job_id,
      submittedAt: job.created_at,
      updatedAt: now,
    },
    aggitsJukebox: {
      modelVersion: MAHOGANY_RENDERER_VERSION,
      appearanceVariant: AGGITS_JUKEBOX_APPEARANCE,
      layoutProfile,
      projectId: m.projectId,
      title: m.title,
      tickerText: m.tickerText,
      videoKind: m.video.kind,
      youtubeUrl: m.video.kind === "youtube" ? m.video.youtubeUrl : "",
      localWelcomeVideo:
        m.video.kind === "mp4"
          ? `/api/aggits-jukebox-assets/${job.edition_id}/video`
          : "",
      localWelcomeVideoSha256: m.video.sha256,
      secretVideo: m.secretVideo
        ? {
            ...m.secretVideo,
            objectKey: secretVideoObjectKey(job, m.secretVideo),
            publicPath: `/api/aggits-jukebox-assets/${job.edition_id}/secret-video`,
          }
        : null,
      skin:
        m.skin?.kind === "custom"
          ? {
              ...m.skin,
              objectKey: skinObjectKey(job, m.skin),
              publicPath: `/api/aggits-jukebox-assets/${job.edition_id}/skin`,
            }
          : { kind: "default", layoutProfile },
      cabinetArtwork:
        m.skin?.kind === "custom"
          ? `/api/aggits-jukebox-assets/${job.edition_id}/skin`
          : MAHOGANY_OVAL_CABINET_ASSET.replace(/^\//, ""),
      coinSound: "assets/audio/jukebox-real-coin-insert-cc0.mp3",
      coinSoundSha256:
        "0d5af258fc72136626d4888c3b6a75240afe8d7b6c00d5837576b92c4ebadec0",
      coinSoundSource: "https://freesound.org/people/kyles/sounds/637369/",
      coinSoundLicense: "CC0-1.0",
      buttonClunkSound:
        "assets/audio/jukebox-mechanical-button-clunk-public-domain.ogg",
      buttonClunkSoundSha256:
        "d45c44c7cf8d700216c7f56182a430183df64880fe6aab834552daa6af6d5919",
      buttonClunkSoundSource:
        "https://commons.wikimedia.org/wiki/File:Mechanical_tack.ogg",
      buttonClunkSoundLicense: "Public Domain",
      externalLinkDelayMs: 500,
      sessionStorageKey: `aggitsJukeboxActivated:${job.edition_id}`,
      actions: m.actions,
    },
  };
}
function publicProject(config, editionId) {
  const a = config.aggitsJukebox;
  return {
    schemaVersion: "deep-cuts-studio-project/1",
    id: `studio_${a.projectId.replace(/^studio_/, "")}`,
    input: {
      type: "aggits_jukebox",
      name: a.title,
      tickerText: a.tickerText,
      youtubeUrl: a.youtubeUrl || "",
      layoutProfile: a.layoutProfile || MAHOGANY_LEGACY_LAYOUT_ID,
      actionButtons: a.actions.map((item) => ({
        enabled: true,
        ...item,
        value: item.href,
      })),
      cabinetSkin: a.skin || {
        kind: "default",
        layoutProfile: a.layoutProfile || MAHOGANY_LEGACY_LAYOUT_ID,
      },
      secretVideo: a.secretVideo
        ? {
            fileName: a.secretVideo.fileName,
            mimeType: "video/mp4",
            sizeBytes: a.secretVideo.sizeBytes,
            sha256: a.secretVideo.sha256,
            storageName: a.secretVideo.storageName,
            loop: a.secretVideo.loop === true,
            updatedAt: a.secretVideo.updatedAt || "",
          }
        : null,
    },
    mp4:
      a.videoKind === "mp4"
        ? {
            fileName: "welcome.mp4",
            sizeBytes: 1,
            sha256: a.localWelcomeVideoSha256,
          }
        : null,
    readiness: { handoffReady: true },
    revision: 1,
    status: "published",
    editionId,
  };
}
function validateManifest(body) {
  const requestedSchema = clean(body?.schemaVersion, 80),
    projectId = clean(body?.projectId, 40),
    title = clean(body?.title, 120),
    tickerText = multiline(body?.tickerText, 500),
    actions = Array.isArray(body?.actions) ? body.actions : [],
    video = body?.video || {},
    secretVideoInput = body?.secretVideo || null,
    skinInput = body?.skin && typeof body.skin === "object" ? body.skin : {},
    skinCheck = validateMahoganySkinDefinition(skinInput, {
      allowDefault: true,
      allowLegacy: true,
      rejectUnknown: true,
    });
  if (!/^studio_[a-f0-9]{12}$/.test(projectId) || !title || !tickerText)
    return {
      ok: false,
      error: "A stable project, title and ticker are required.",
    };
  if (actions.length < 1 || actions.length > 4)
    return { ok: false, error: "One to four enabled actions are required." };
  const cleaned = [];
  for (const item of actions) {
    const iconId = clean(item.iconId, 40),
      label = clean(item.label, 22),
      actionType = clean(item.actionType, 12),
      href = safeActionHref(item.href, actionType);
    if (!ICON_IDS.has(iconId) || !label || !href)
      return {
        ok: false,
        error: "Every action requires an approved icon, label and destination.",
      };
    cleaned.push({
      slot: cleaned.length + 1,
      iconId,
      label,
      actionType,
      href,
      openInNewTab:
        ["web", "map"].includes(actionType) && item.openInNewTab !== false,
    });
  }
  const videoKind = video.kind === "youtube" ? "youtube" : "mp4";
  const youtubeId =
    videoKind === "youtube" ? safeYouTubeId(video.youtubeUrl) : "";
  if (videoKind === "youtube" && !youtubeId)
    return { ok: false, error: "Enter a valid YouTube video URL." };
  if (videoKind === "youtube" && /\/(?:2|3)$/.test(requestedSchema)) {
    const embedCheckedAt = Date.parse(String(video.embedCheckedAt || "")),
      proofIsFresh =
        Number.isFinite(embedCheckedAt) &&
        Math.abs(Date.now() - embedCheckedAt) <= 24 * 60 * 60 * 1000;
    if (
      video.embedStatus !== "playable" ||
      video.embedVideoId !== youtubeId ||
      !proofIsFresh
    )
      return {
        ok: false,
        error:
          "Create must confirm that YouTube allows this video to play inside websites before publication.",
      };
  }
  if (
    videoKind === "mp4" &&
    (!Number.isInteger(Number(video.sizeBytes)) ||
      video.sizeBytes <= 0 ||
      video.sizeBytes > VIDEO_MAX_BYTES ||
      !/^[a-f0-9]{64}$/.test(String(video.sha256 || "")))
  )
    return {
      ok: false,
      error:
        "The MP4 must be 24 MiB or smaller and have a valid SHA-256 identity.",
    };
  if (!/^[a-f0-9]{64}$/.test(String(video.sha256 || "")))
    return {
      ok: false,
      error: "The selected video requires a SHA-256 identity.",
    };
  let secretVideo = null;
  if (secretVideoInput) {
    const sizeBytes = Number(secretVideoInput.sizeBytes),
      sha = String(secretVideoInput.sha256 || "").toLowerCase();
    if (
      !Number.isInteger(sizeBytes) ||
      sizeBytes <= 0 ||
      sizeBytes > VIDEO_MAX_BYTES ||
      !/^[a-f0-9]{64}$/.test(sha) ||
      String(secretVideoInput.mimeType || "").toLowerCase() !== "video/mp4"
    )
      return {
        ok: false,
        error: "The secret video must be a verified MP4 no larger than 24 MiB.",
      };
    secretVideo = {
      fileName: clean(secretVideoInput.fileName, 180),
      mimeType: "video/mp4",
      sizeBytes,
      sha256: sha,
      storageName: clean(secretVideoInput.storageName, 220),
      loop: secretVideoInput.loop === true,
      updatedAt: clean(secretVideoInput.updatedAt, 60),
    };
  }
  if (!skinCheck.valid)
    return { ok: false, error: skinCheck.errors.join(" ") };
  const skin = normalizeMahoganySkin(skinCheck.value, { allowLegacy: true }),
    requestedLayoutProfile = String(body?.layoutProfile || ""),
    resolvedLayoutProfile = resolveMahoganyLayoutProfile({
      layoutProfile: body?.layoutProfile || skin.layoutProfile,
      skin,
      secretVideo,
    }).id,
    layoutProfile =
      requestedLayoutProfile && requestedLayoutProfile === skin.layoutProfile
        ? requestedLayoutProfile
        : resolvedLayoutProfile;
  if (
    requestedLayoutProfile &&
    requestedLayoutProfile !== resolvedLayoutProfile &&
    requestedLayoutProfile !== skin.layoutProfile
  )
    return {
      ok: false,
      error: "The publication layout profile does not match the verified skin geometry.",
    };
  return {
    ok: true,
    value: {
      schemaVersion: "deep-cuts-aggits-jukebox-publication/1",
      projectId,
      title,
      tickerText,
      layoutProfile,
      skin,
      secretVideo,
      actions: cleaned,
      video: {
        kind: videoKind,
        youtubeId,
        youtubeUrl:
          videoKind === "youtube"
            ? `https://www.youtube.com/watch?v=${youtubeId}`
            : "",
        embedStatus:
          videoKind === "youtube" && /\/(?:2|3)$/.test(requestedSchema)
            ? "playable"
            : "legacy_unchecked",
        embedVideoId:
          videoKind === "youtube" && /\/(?:2|3)$/.test(requestedSchema)
            ? youtubeId
            : "",
        embedCheckedAt:
          videoKind === "youtube" && /\/(?:2|3)$/.test(requestedSchema)
            ? new Date(video.embedCheckedAt).toISOString()
            : "",
        sizeBytes: videoKind === "mp4" ? Number(video.sizeBytes) : 0,
        sha256: String(video.sha256),
        fileName: videoKind === "mp4" ? clean(video.fileName, 180) : "",
      },
    },
  };
}
function publicJob(j) {
  return {
    id: j.job_id,
    editionId: j.edition_id,
    slug: j.slug,
    title: j.title,
    status: j.status,
    stage: j.stage,
    liveUrl: j.base_url ? `${j.base_url}/e/${j.edition_id}` : "",
    qrImageUrl: j.base_url
      ? `${j.base_url}/output/${j.slug}/instagram-qr.png`
      : "",
    errorCode: j.error_code || "",
    error: j.error_message || "",
    updatedAt: j.updated_at || "",
  };
}
function publicationManifestsMatch(left, right) {
  return (
    JSON.stringify(stablePublicationValue(comparablePublicationManifest(left))) ===
    JSON.stringify(stablePublicationValue(comparablePublicationManifest(right)))
  );
}
function comparablePublicationManifest(value) {
  if (!value || typeof value !== "object") return value || null;
  const skin =
    value.skin && typeof value.skin === "object" && value.skin.kind === "custom"
      ? value.skin
      : { kind: "default" };
  return {
    ...value,
    skin,
  };
}
function stablePublicationValue(value) {
  if (Array.isArray(value)) return value.map(stablePublicationValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stablePublicationValue(value[key])]),
  );
}
async function authorize(request, env) {
  const installationId = installation(
      request.headers.get("x-deep-cuts-installation-id"),
    ),
    token = (request.headers.get("authorization") || "").replace(
      /^Bearer /,
      "",
    );
  if (!installationId || !/^bpub_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = await keyedHash(env, `token:${installationId}:${token}`),
    device = await env.DB.prepare(
      "SELECT installation_id,status FROM bar_publisher_devices WHERE installation_id=?1 AND token_hash=?2 AND status='active'",
    )
      .bind(installationId, hash)
      .first();
  return device || null;
}
async function ownedJob(env, id, installationId) {
  return env.DB.prepare(
    "SELECT * FROM aggits_jukebox_publication_jobs WHERE job_id=?1 AND installation_id=?2",
  )
    .bind(id, installationId)
    .first();
}
async function uniqueEditionId(env) {
  for (let i = 0; i < 20; i++) {
    const id = `dc_${randomHex(5)}`;
    if (
      !(await env.DB.prepare(
        "SELECT edition_id FROM editions WHERE edition_id=?1",
      )
        .bind(id)
        .first())
    )
      return id;
  }
  throw new Error("Could not allocate edition ID.");
}
function stableSlug(id) {
  return `aggits-jukebox-${id.replace(/^studio_/, "")}`;
}
function safeYouTubeId(value) {
  const text = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    }
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return "";
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1];
    return /^[A-Za-z0-9_-]{11}$/.test(String(id || "")) ? id : "";
  } catch {
    return "";
  }
}
function safeActionHref(value, type) {
  const text = String(value || "").trim();
  if (type === "tel") return /^tel:\+?[0-9(). -]{6,25}$/.test(text) ? text : "";
  if (type === "email")
    return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(text) ? text : "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !blocked(url.hostname)
      ? url.href
      : "";
  } catch {
    return "";
  }
}
function blocked(host) {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(h)
  );
}
async function serveObjectForEdition(request, env, id, kind) {
  const row = await env.DB.prepare(
    `SELECT ${kind === "video" ? "video_key" : "qr_key"} object_key FROM aggits_jukebox_editions WHERE edition_id=?1 AND status='active'`,
  )
    .bind(id)
    .first();
  return row
    ? serveObject(
        request,
        env.BAR_ASSETS,
        row.object_key,
        kind === "video" ? "video/mp4" : "image/png",
      )
    : new Response("Unknown Deep Cuts edition", { status: 404 });
}
async function serveSkinForEdition(request, env, id) {
  const row = await env.DB.prepare(
    "SELECT config_json FROM aggits_jukebox_editions WHERE edition_id=?1 AND status='active'",
  )
    .bind(id)
    .first();
  if (!row) return new Response("Unknown Deep Cuts edition", { status: 404 });
  const config = JSON.parse(row.config_json || "null"),
    skin = config?.aggitsJukebox?.skin,
    objectKey = String(skin?.objectKey || "");
  if (
    skin?.kind !== "custom" ||
    !objectKey.startsWith(`aggits-jukebox/${id}/`)
  )
    return new Response("Custom skin not found", { status: 404 });
  return serveObject(request, env.BAR_ASSETS, objectKey, skin.mimeType);
}
async function serveSecretVideoForEdition(request, env, id) {
  const row = await env.DB.prepare(
    "SELECT config_json FROM aggits_jukebox_editions WHERE edition_id=?1 AND status='active'",
  )
    .bind(id)
    .first();
  if (!row) return new Response("Unknown Deep Cuts edition", { status: 404 });
  const config = JSON.parse(row.config_json || "null"),
    secretVideo = config?.aggitsJukebox?.secretVideo,
    objectKey = String(secretVideo?.objectKey || "");
  if (!objectKey.startsWith(`aggits-jukebox/${id}/`))
    return new Response("Secret video not found", { status: 404 });
  return serveObject(request, env.BAR_ASSETS, objectKey, "video/mp4");
}
async function serveObject(request, bucket, key, type) {
  const range = parseRange(request.headers.get("range")),
    object = await bucket.get(key, range ? { range } : undefined);
  if (!object) return new Response("Asset not found", { status: 404 });
  const h = new Headers();
  object.writeHttpMetadata?.(h);
  h.set("content-type", h.get("content-type") || type);
  h.set("etag", object.httpEtag);
  h.set("accept-ranges", "bytes");
  if (request.method === "HEAD") return new Response(null, { headers: h });
  if (object.range) {
    h.set(
      "content-range",
      `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`,
    );
    return new Response(object.body, { status: 206, headers: h });
  }
  return new Response(object.body, { headers: h });
}
function parseRange(value) {
  const m = String(value || "").match(/^bytes=(\d+)-(\d*)$/);
  return m
    ? {
        offset: Number(m[1]),
        ...(m[2] ? { length: Number(m[2]) - Number(m[1]) + 1 } : {}),
      }
    : null;
}
async function keyedHash(env, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(env.ADMIN_TOKEN)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesHex(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
    ),
  );
}
async function sha256(bytes) {
  return bytesHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
function bytesHex(bytes) {
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function randomHex(n) {
  return bytesHex(crypto.getRandomValues(new Uint8Array(n)));
}
function bytesBase64(bytes) {
  let out = "";
  for (let o = 0; o < bytes.length; o += 0x8000)
    for (const b of bytes.subarray(o, o + 0x8000))
      out += String.fromCharCode(b);
  return btoa(out);
}
function contentLength(r) {
  return Number(r.headers.get("content-length") || 0);
}
function isMp4(b) {
  return b.length >= 12 && String.fromCharCode(...b.subarray(4, 8)) === "ftyp";
}
function isPng(b, w, h) {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return false;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return v.getUint32(16) === w && v.getUint32(20) === h;
}
function isSupportedSkin(bytes, format, width, height) {
  const size = imageDimensions(bytes, format);
  return size?.width === width && size?.height === height;
}
function imageDimensions(bytes, format) {
  if (!(bytes instanceof Uint8Array)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === "png")
    return bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50
      ? { width: view.getUint32(16), height: view.getUint32(20) }
      : null;
  if (format === "jpeg" && bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1],
        length = view.getUint16(offset + 2);
      if (length < 2) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker))
        return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += 2 + length;
    }
    return null;
  }
  if (
    format === "webp" &&
    bytes.length >= 30 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === "VP8X")
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    if (chunk === "VP8L" && bytes.length >= 25) {
      const bits = view.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === "VP8 " && bytes.length >= 30)
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
  }
  return null;
}
function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
function skinObjectKey(job, skin) {
  const extension = skin?.format === "jpeg" ? "jpg" : skin?.format;
  return `aggits-jukebox/${job.edition_id}/${job.job_id}/skin.${extension}`;
}
function secretVideoObjectKey(job, secretVideo) {
  return `aggits-jukebox/${job.edition_id}/${job.job_id}/secret-video-${secretVideo.sha256}.mp4`;
}
function installation(v) {
  const s = String(v || "").trim();
  return /^studio_[a-f0-9]{32}$/.test(s) ? s : "";
}
function clean(v, n = 200) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, n);
}
function multiline(v, n) {
  return String(v || "")
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .slice(0, n);
}
function escapeHtml(v) {
  return String(v || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}
async function safeJson(r) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

export const __test = {
  validateManifest,
  buildConfig,
  publicJob,
  publicationManifestsMatch,
  isPng,
  stableSlug,
};
