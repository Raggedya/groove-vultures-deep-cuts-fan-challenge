import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createDirectVenuePublisher } from "./bar-edition-publication.mjs";
import { createAggitsJukeboxQrArtwork } from "./aggits-jukebox-qr-artwork.mjs";
import { buildMahoganyManifest } from "./mahogany-jukebox-model.mjs";
import { MAHOGANY_RENDERER_VERSION } from "./aggits-jukebox-preview.mjs";
import { FULLNOISE_VU_RENDERER_VERSION } from "./fullnoise-vu-preview.mjs";
import { MAHOGANY_VU_RENDERER_VERSION } from "./mahogany-vu-preview.mjs";
import { isVuAppearance } from "./jukebox-product-profiles.mjs";

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
    musicPath = "",
    characterPath = "",
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
      if (isVuAppearance(manifest.appearance)) {
        if (manifest.vu.music.sizeBytes > 0 && currentJob.status === "prepared") {
          await onProgress("uploading", "Uploading the verified music track");
          await uploadVerifiedAsset({
            fetchImpl,
            url: `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/music`,
            identity: current,
            filePath: musicPath,
            expected: manifest.vu.music,
          });
          currentJob = {
            ...currentJob,
            status:
              manifest.vu.character.sizeBytes > 0
                ? "music_uploaded"
                : "video_uploaded",
          };
        }
        if (
          manifest.vu.character.sizeBytes > 0 &&
          ["prepared", "music_uploaded"].includes(currentJob.status)
        ) {
          await onProgress(
            "uploading",
            "Uploading the verified Aggits presenter video",
          );
          await uploadVerifiedAsset({
            fetchImpl,
            url: `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/character`,
            identity: current,
            filePath: characterPath,
            expected: manifest.vu.character,
          });
          currentJob = { ...currentJob, status: "video_uploaded" };
        }
      }
      if (manifest.video?.kind === "mp4" && currentJob.status === "prepared") {
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
        appearance: manifest.appearance || "mahogany-master",
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
    isVu = isVuAppearance(manifest.appearance),
    expectedRenderer =
      manifest.appearance === "fullnoise-vu"
        ? FULLNOISE_VU_RENDERER_VERSION
        : isVu
          ? MAHOGANY_VU_RENDERER_VERSION
          : MAHOGANY_RENDERER_VERSION,
    expectedProductLabel = manifest.title,
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
  if (isVu && manifest.vu.music.sizeBytes > 0)
    requests.push(
      fetchImpl(`${origin}/api/aggits-jukebox-assets/${job.editionId}/music`, {
        method: "HEAD",
        cache: "no-store",
      }),
    );
  if (isVu && manifest.vu.character.sizeBytes > 0)
    requests.push(
      fetchImpl(
        `${origin}/api/aggits-jukebox-assets/${job.editionId}/character`,
        { method: "HEAD", cache: "no-store" },
      ),
    );
  if (!isVu && manifest.video.kind === "mp4")
    requests.push(
      fetchImpl(`${origin}/api/aggits-jukebox-assets/${job.editionId}/video`, {
        method: "HEAD",
        cache: "no-store",
      }),
    );
  const responses = await Promise.all(requests),
    [page, config, qr, ...media] = responses,
    [html, json, qrBytes] = await Promise.all([
      page.text(),
      config.json().catch(() => null),
      qr.arrayBuffer(),
    ]),
    png = new Uint8Array(qrBytes);
  if (
    !page.ok ||
    !html.includes(expectedProductLabel) ||
    !html.includes(expectedRenderer) ||
    page.headers.get("x-deep-cuts-renderer") !== expectedRenderer
  )
    throw publicationError(
      "The public service is not running the accepted Mahogany Jukebox graphics. Publication was stopped safely.",
      "live_verification_failed",
    );
  if (
    !config.ok ||
    json?.bandName !== manifest.title ||
    json?.analytics?.editionId !== job.editionId ||
    json?.publicURL !== job.liveUrl ||
    (isVu
      ? json?.aggitsJukebox?.appearanceVariant !== manifest.appearance
      : isVuAppearance(json?.aggitsJukebox?.appearanceVariant)) ||
    json?.aggitsJukebox?.modelVersion !== expectedRenderer ||
    (isVu &&
      (json?.aggitsJukebox?.projectId !== manifest.projectId ||
        json?.aggitsJukebox?.title !== manifest.title ||
        json?.aggitsJukebox?.tickerText !== manifest.tickerText ||
        !publicationActionsMatch(
          json?.aggitsJukebox?.actions,
          manifest.actions,
        ) ||
        !publicationMediaMatches(
          json?.aggitsJukebox?.musicAudio,
          manifest.vu.music,
        ) ||
        !publicationMediaMatches(
          json?.aggitsJukebox?.presenterVideo,
          manifest.vu.character,
        )))
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
  if (media.some((item) => !item.ok))
    throw publicationError(
      "A live VU media asset failed verification.",
      "media_verification_failed",
    );
}

function publicationActionsMatch(liveActions, expectedActions) {
  if (!Array.isArray(liveActions) || !Array.isArray(expectedActions)) return false;
  if (liveActions.length !== expectedActions.length) return false;
  return expectedActions.every((expected, index) => {
    const live = liveActions[index];
    return (
      Number(live?.slot) === Number(expected?.slot) &&
      live?.iconId === expected?.iconId &&
      live?.label === expected?.label &&
      live?.actionType === expected?.actionType &&
      live?.href === expected?.href &&
      Boolean(live?.openInNewTab) === Boolean(expected?.openInNewTab)
    );
  });
}

function publicationMediaMatches(liveMedia, expectedMedia) {
  const expectedSize = Number(expectedMedia?.sizeBytes) || 0;
  return (
    (Number(liveMedia?.sizeBytes) || 0) === expectedSize &&
    String(liveMedia?.fileName || "") === String(expectedMedia?.fileName || "") &&
    String(liveMedia?.sha256 || "") === String(expectedMedia?.sha256 || "") &&
    String(liveMedia?.mimeType || "") === String(expectedMedia?.mimeType || "")
  );
}

async function uploadVerifiedAsset({
  fetchImpl,
  url,
  identity,
  filePath,
  expected,
}) {
  const bytes = await fs.readFile(filePath),
    sha = crypto.createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== expected.sizeBytes || sha !== expected.sha256)
    throw publicationError(
      "A selected VU media asset no longer matches the prepared preview.",
      "media_identity_mismatch",
    );
  await remoteBytes(fetchImpl, url, {
    identity,
    bytes,
    headers: {
      "content-type": expected.mimeType,
      "x-content-sha256": sha,
    },
  });
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
