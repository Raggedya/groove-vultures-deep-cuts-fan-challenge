import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createDirectVenuePublisher } from "./bar-edition-publication.mjs";
import { createAggitsJukeboxQrArtwork } from "./aggits-jukebox-qr-artwork.mjs";
import { buildMahoganyManifest } from "./mahogany-jukebox-model.mjs";
import { MAHOGANY_RENDERER_VERSION } from "./aggits-jukebox-preview.mjs";

export const MAHOGANY_PUBLICATION_SCHEMA =
  "deep-cuts-mahogany-jukebox-publication/2";
export const DEFAULT_MAHOGANY_PUBLISHER_URL =
  "https://deep-cuts.andrewharris501.workers.dev";

export function createMahoganyJukeboxPublisher({
  serviceUrl = process.env.DEEP_CUTS_PUBLISHER_URL ||
    DEFAULT_MAHOGANY_PUBLISHER_URL,
  credentialStore,
  fetchImpl = fetch,
  sleep = delay,
  root = process.cwd(),
  appVersion = "1.0.0",
  pollMs = 2500,
  maxPolls = 300,
} = {}) {
  if (!credentialStore)
    throw new Error("The encrypted publisher credential store is required.");
  const baseUrl = serviceOrigin(serviceUrl),
    activation = createDirectVenuePublisher({
      serviceUrl: baseUrl,
      credentialStore,
      fetchImpl,
      sleep,
      root,
      appVersion,
      pollMs,
      maxPolls,
    });
  async function identity() {
    return {
      installationId: await credentialStore.getInstallationId(),
      token: await credentialStore.getToken(),
    };
  }
  async function prepare({ project } = {}) {
    const current = await identity();
    if (!current.token)
      throw publicationError(
        "Activate secure publishing once on this Windows installation.",
        "publisher_activation_required",
      );
    const manifest = buildMahoganyManifest(project);
    let prepared;
    try {
      prepared = await remoteJson(
        fetchImpl,
        `${baseUrl}/api/aggits-jukebox-publisher/publications`,
        { method: "POST", identity: current, body: manifest },
      );
      if (!prepared.job?.id || !prepared.qrPayload)
        throw publicationError(
          "The publisher did not reserve the permanent Mahogany Jukebox identity.",
          "publisher_prepare_invalid",
        );
      const qr = await createAggitsJukeboxQrArtwork({
        root,
        title: manifest.title,
        destination: prepared.qrPayload,
      });
      return {
        schemaVersion: MAHOGANY_PUBLICATION_SCHEMA,
        manifest,
        job: prepared.job,
        qrPayload: prepared.qrPayload,
        qrBytes: qr.bytes,
        qrSha256: qr.sha256,
        qrScanProof: qr.scanProof,
        editionId: prepared.job.editionId,
        slug: prepared.job.slug,
        liveUrl: prepared.job.liveUrl,
        qrImageUrl: prepared.job.qrImageUrl,
      };
    } catch (error) {
      if (
        prepared?.job?.id &&
        prepared.job.status !== "awaiting_delivery"
      )
        await remoteJson(
          fetchImpl,
          `${baseUrl}/api/aggits-jukebox-publisher/publications/${prepared.job.id}/rollback`,
          { method: "POST", identity: current, body: {} },
        ).catch(() => {});
      throw error;
    }
  }
  async function accept({
    prepared,
    videoPath = "",
    onProgress = async () => {},
  } = {}) {
    const current = await identity(),
      job = prepared?.job,
      manifest = prepared?.manifest;
    if (!current.token)
      throw publicationError(
        "Secure publishing is not activated.",
        "publisher_activation_required",
      );
    if (!job?.id || !manifest || !prepared.qrBytes)
      throw publicationError(
        "Publication preparation is missing.",
        "publication_not_prepared",
      );
    try {
      let currentJob = (
        await remoteJson(
          fetchImpl,
          `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}`,
          { identity: current },
        )
      ).job;
      if (currentJob.status === "failed")
        throw publicationError(
          currentJob.error || "Publication failed safely.",
          currentJob.errorCode || "publication_failed",
        );
      if (manifest.video.kind === "mp4" && currentJob.status === "prepared") {
        await onProgress("uploading", "Uploading the verified MP4");
        const bytes = await fs.readFile(videoPath),
          sha = crypto.createHash("sha256").update(bytes).digest("hex");
        if (
          bytes.length !== manifest.video.sizeBytes ||
          sha !== manifest.video.sha256
        )
          throw publicationError(
            "The stored MP4 no longer matches the prepared preview.",
            "video_identity_mismatch",
          );
        await remoteBytes(
          fetchImpl,
          `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/video`,
          {
            identity: current,
            bytes,
            headers: { "content-type": "video/mp4", "x-content-sha256": sha },
          },
        );
        currentJob = { ...currentJob, status: "video_uploaded" };
      }
      if (currentJob.status === "video_uploaded") {
        await onProgress(
          "qr",
          "Uploading the perspective-fitted, scan-tested QR poster",
        );
        await remoteBytes(
          fetchImpl,
          `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/qr`,
          {
            identity: current,
            bytes: prepared.qrBytes,
            headers: {
              "content-type": "image/png",
              "x-content-sha256": prepared.qrSha256,
              "x-deep-cuts-qr-payload": prepared.qrPayload,
              "x-deep-cuts-qr-scan-proof": prepared.qrScanProof,
            },
          },
        );
        currentJob = { ...currentJob, status: "qr_uploaded" };
      }
      if (currentJob.status === "qr_uploaded") {
        await onProgress(
          "publishing",
          "Publishing the permanent Jukebox and sending the completion email",
        );
        await remoteJson(
          fetchImpl,
          `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/commit`,
          { method: "POST", identity: current, body: {} },
        );
        currentJob = { ...currentJob, status: "awaiting_delivery" };
      }
      if (!["awaiting_delivery", "published"].includes(currentJob.status))
        throw publicationError(
          `Publication cannot resume from ${currentJob.status}.`,
          "publication_stage_invalid",
        );
      for (let attempt = 0; attempt < maxPolls; attempt++) {
        if (currentJob.status === "published") break;
        currentJob = (
          await remoteJson(
            fetchImpl,
            `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}`,
            { identity: current },
          )
        ).job;
        if (currentJob.status === "published") break;
        if (currentJob.status === "failed")
          throw publicationError(
            currentJob.error || "Publication failed safely.",
            currentJob.errorCode || "publication_failed",
          );
        await onProgress("delivery", "Waiting for confirmed email delivery");
        await sleep(pollMs);
      }
      if (currentJob.status !== "published")
        throw publicationError(
          "Email delivery was not confirmed in time.",
          "delivery_timeout",
        );
      await onProgress(
        "verifying",
        "Verifying the live page, QR and selected video",
      );
      await verifyMahoganyPublication(fetchImpl, currentJob, manifest);
      return {
        schemaVersion: MAHOGANY_PUBLICATION_SCHEMA,
        editionId: currentJob.editionId,
        slug: currentJob.slug,
        liveUrl: currentJob.liveUrl,
        qrImageUrl: currentJob.qrImageUrl,
        jobId: currentJob.id,
        deploymentUrl: baseUrl,
        published: true,
      };
    } catch (error) {
      await remoteJson(
        fetchImpl,
        `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/rollback`,
        { method: "POST", identity: current, body: {} },
      ).catch(() => {});
      throw error;
    }
  }
  async function setPublished({ editionId, published } = {}) {
    const current = await identity();
    if (!current.token)
      throw publicationError(
        "Secure publishing is not activated.",
        "publisher_activation_required",
      );
    const result = await remoteJson(
      fetchImpl,
      `${baseUrl}/api/aggits-jukebox-publisher/editions/${editionId}/state`,
      {
        method: "PUT",
        identity: current,
        body: { published: Boolean(published) },
      },
    );
    return {
      editionId: result.editionId,
      slug: result.slug,
      liveUrl: result.liveUrl,
      qrImageUrl: result.qrImageUrl,
      published: Boolean(result.published),
    };
  }
  async function rollback(prepared) {
    const current = await identity();
    if (prepared?.job?.id)
      await remoteJson(
        fetchImpl,
        `${baseUrl}/api/aggits-jukebox-publisher/publications/${prepared.job.id}/rollback`,
        { method: "POST", identity: current, body: {} },
      ).catch(() => {});
  }
  return {
    authentication: activation.authentication,
    startActivation: activation.startActivation,
    completeActivation: activation.completeActivation,
    prepare,
    accept,
    setPublished,
    rollback,
  };
}

export async function verifyMahoganyPublication(fetchImpl, job, manifest) {
  const origin = new URL(job.liveUrl).origin,
    requests = [
      fetchImpl(`${job.liveUrl}?publication=${encodeURIComponent(job.id)}`, {
        cache: "no-store",
      }),
      fetchImpl(
        `${origin}/api/aggits-jukebox-editions/${job.editionId}/config`,
        { cache: "no-store" },
      ),
      fetchImpl(job.qrImageUrl, { cache: "no-store" }),
    ];
  if (manifest.video.kind === "mp4")
    requests.push(
      fetchImpl(`${origin}/api/aggits-jukebox-assets/${job.editionId}/video`, {
        method: "HEAD",
        cache: "no-store",
      }),
    );
  const responses = await Promise.all(requests),
    [page, config, qr, video] = responses,
    [html, json, qrBytes] = await Promise.all([
      page.text(),
      config.json().catch(() => null),
      qr.arrayBuffer(),
    ]),
    png = new Uint8Array(qrBytes);
  if (
    !page.ok ||
    !html.includes("Mahogany Jukebox") ||
    !html.includes(`content="${MAHOGANY_RENDERER_VERSION}"`) ||
    page.headers.get("x-deep-cuts-renderer") !== MAHOGANY_RENDERER_VERSION
  )
    throw publicationError(
      "The public service is not running the accepted Mahogany Jukebox graphics. Publication was stopped safely.",
      "live_verification_failed",
    );
  if (
    !config.ok ||
    json?.bandName !== manifest.title ||
    json?.aggitsJukebox?.videoKind !== manifest.video.kind ||
    json?.aggitsJukebox?.modelVersion !== MAHOGANY_RENDERER_VERSION
  )
    throw publicationError(
      "The live configuration did not match the accepted preview.",
      "config_verification_failed",
    );
  if (!qr.ok || png.length < 10000 || png[0] !== 0x89 || png[1] !== 0x50)
    throw publicationError(
      "The live QR poster failed verification.",
      "qr_verification_failed",
    );
  if (
    video &&
    (!video.ok ||
      !(video.headers.get("content-type") || "").includes("video/mp4"))
  )
    throw publicationError(
      "The live MP4 failed verification.",
      "video_verification_failed",
    );
}
async function remoteJson(
  fetchImpl,
  url,
  { method = "GET", identity, body } = {},
) {
  const response = await fetchImpl(url, {
      method,
      headers: headers(
        identity,
        body !== undefined ? { "content-type": "application/json" } : {},
      ),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    }),
    result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false)
    throw Object.assign(
      publicationError(
        result.error || `Publisher returned ${response.status}.`,
        result.code || "publisher_request_failed",
      ),
      { status: response.status },
    );
  return result;
}
async function remoteBytes(
  fetchImpl,
  url,
  { identity, bytes, headers: extra = {} } = {},
) {
  const response = await fetchImpl(url, {
      method: "PUT",
      headers: headers(identity, {
        ...extra,
        "content-length": String(bytes.length),
      }),
      body: bytes,
    }),
    result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false)
    throw publicationError(
      result.error || `Asset upload returned ${response.status}.`,
      result.code || "publisher_upload_failed",
    );
  return result;
}
function headers(identity, extra) {
  return {
    authorization: `Bearer ${identity.token}`,
    "x-deep-cuts-installation-id": identity.installationId,
    ...extra,
  };
}
function serviceOrigin(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw publicationError(
      "The publishing service URL is invalid.",
      "publisher_url_invalid",
    );
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw publicationError(
      "The publisher requires HTTPS.",
      "publisher_url_invalid",
    );
  return url.origin;
}
function publicationError(message, code) {
  return Object.assign(new Error(message), {
    name: "MahoganyJukeboxPublicationError",
    code,
  });
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
