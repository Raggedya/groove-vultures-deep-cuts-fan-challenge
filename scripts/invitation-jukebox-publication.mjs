import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createDirectVenuePublisher } from "./bar-edition-publication.mjs";
import { buildInvitationManifest } from "./invitation-jukebox-model.mjs";
import { createInvitationQrArtwork } from "./invitation-jukebox-qr-artwork.mjs";
import { INVITATION_RENDERER_VERSION } from "./invitation-jukebox-preview.mjs";

export const DEFAULT_INVITATION_PUBLISHER_URL = "https://deep-cuts.andrewharris501.workers.dev";

export function createInvitationJukeboxPublisher({ serviceUrl = process.env.DEEP_CUTS_PUBLISHER_URL || DEFAULT_INVITATION_PUBLISHER_URL, credentialStore, fetchImpl = fetch, sleep = delay, root = process.cwd(), appVersion = "1.0.0", pollMs = 2500, maxPolls = 300 } = {}) {
  if (!credentialStore) throw new Error("The encrypted publisher credential store is required.");
  const baseUrl = origin(serviceUrl);
  const activation = createDirectVenuePublisher({ serviceUrl: baseUrl, credentialStore, fetchImpl, sleep, root, appVersion, pollMs, maxPolls });
  const identity = async () => ({ installationId: await credentialStore.getInstallationId(), token: await credentialStore.getToken() });
  async function prepare({ project } = {}) {
    const current = await identity();
    if (!current.token) throw failure("Activate secure publishing once on this Windows installation.", "publisher_activation_required");
    const manifest = buildInvitationManifest(project);
    const prepared = await remoteJson(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications`, { method: "POST", identity: current, body: manifest });
    if (!prepared.job?.id || !prepared.qrPayload) throw failure("The publisher did not reserve the invitation identity.", "publisher_prepare_invalid");
    try {
      const qr = await createInvitationQrArtwork({ root, title: manifest.title, invitationType: manifest.invitationType, destination: prepared.qrPayload });
      return { schemaVersion: "deep-cuts-invitation-jukebox-publication/1", manifest, job: prepared.job, qrPayload: prepared.qrPayload, qrBytes: qr.bytes, qrSha256: qr.sha256, qrScanProof: qr.scanProof, editionId: prepared.job.editionId, slug: prepared.job.slug, liveUrl: prepared.job.liveUrl, qrImageUrl: prepared.job.qrImageUrl };
    } catch (error) {
      await remoteJson(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications/${prepared.job.id}/rollback`, { method: "POST", identity: current, body: {} }).catch(() => {});
      throw error;
    }
  }
  async function accept({ prepared, videoPath = "", onProgress = async () => {} } = {}) {
    const current = await identity(), job = prepared?.job, manifest = prepared?.manifest;
    if (!current.token) throw failure("Secure publishing is not activated.", "publisher_activation_required");
    if (!job?.id || !manifest || !prepared.qrBytes) throw failure("Publication preparation is missing.", "publication_not_prepared");
    try {
      let currentJob = (await remoteJson(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}`, { identity: current })).job;
      if (manifest.video.kind === "mp4" && currentJob.status === "prepared") {
        await onProgress("uploading", "Uploading the verified invitation MP4");
        const bytes = await fs.readFile(videoPath), sha = crypto.createHash("sha256").update(bytes).digest("hex");
        if (bytes.length !== manifest.video.sizeBytes || sha !== manifest.video.sha256) throw failure("The stored MP4 no longer matches the preview.", "video_identity_mismatch");
        await remoteBytes(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/video`, { identity: current, bytes, headers: { "content-type": "video/mp4", "x-content-sha256": sha } });
        currentJob.status = "video_uploaded";
      }
      if (currentJob.status === "video_uploaded") {
        await onProgress("qr", "Uploading the scan-tested invitation QR artwork");
        await remoteBytes(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/qr`, { identity: current, bytes: prepared.qrBytes, headers: { "content-type": "image/png", "x-content-sha256": prepared.qrSha256, "x-deep-cuts-qr-payload": prepared.qrPayload, "x-deep-cuts-qr-scan-proof": prepared.qrScanProof } });
        currentJob.status = "qr_uploaded";
      }
      if (currentJob.status === "qr_uploaded") {
        await onProgress("publishing", "Publishing the permanent invitation and emailing the link");
        await remoteJson(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/commit`, { method: "POST", identity: current, body: {} });
        currentJob.status = "awaiting_delivery";
      }
      for (let attempt = 0; attempt < maxPolls && currentJob.status !== "published"; attempt++) {
        currentJob = (await remoteJson(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}`, { identity: current })).job;
        if (currentJob.status === "failed") throw failure(currentJob.error || "Publication failed safely.", currentJob.errorCode || "publication_failed");
        if (currentJob.status !== "published") { await onProgress("delivery", "Waiting for confirmed email delivery"); await sleep(pollMs); }
      }
      if (currentJob.status !== "published") throw failure("Email delivery was not confirmed in time.", "delivery_timeout");
      await verifyInvitationPublication(fetchImpl, currentJob, manifest);
      return { editionId: currentJob.editionId, slug: currentJob.slug, liveUrl: currentJob.liveUrl, qrImageUrl: currentJob.qrImageUrl, jobId: currentJob.id, deploymentUrl: baseUrl, published: true };
    } catch (error) {
      await remoteJson(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications/${job.id}/rollback`, { method: "POST", identity: current, body: {} }).catch(() => {});
      throw error;
    }
  }
  async function setPublished({ editionId, published } = {}) {
    const current = await identity();
    const result = await remoteJson(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/editions/${editionId}/state`, { method: "PUT", identity: current, body: { published: Boolean(published) } });
    return { editionId: result.editionId, slug: result.slug, liveUrl: result.liveUrl, qrImageUrl: result.qrImageUrl, published: Boolean(result.published) };
  }
  async function rollback(prepared) { const current = await identity(); if (prepared?.job?.id) await remoteJson(fetchImpl, `${baseUrl}/api/aggits-jukebox-publisher/publications/${prepared.job.id}/rollback`, { method: "POST", identity: current, body: {} }).catch(() => {}); }
  return { authentication: activation.authentication, startActivation: activation.startActivation, completeActivation: activation.completeActivation, prepare, accept, setPublished, rollback };
}

export async function verifyInvitationPublication(fetchImpl, job, manifest) {
  const origin = new URL(job.liveUrl).origin;
  const [page, config, qr] = await Promise.all([fetchImpl(job.liveUrl, { cache: "no-store" }), fetchImpl(`${origin}/api/aggits-jukebox-editions/${job.editionId}/config`, { cache: "no-store" }), fetchImpl(job.qrImageUrl, { cache: "no-store" })]);
  const [html, json, qrBytes] = await Promise.all([page.text(), config.json().catch(() => null), qr.arrayBuffer()]);
  if (!page.ok || !html.includes("Copyright Clearlight Creative 2026") || !html.includes(`content="${INVITATION_RENDERER_VERSION}"`) || page.headers.get("x-deep-cuts-renderer") !== INVITATION_RENDERER_VERSION) throw failure("The live invitation renderer failed verification.", "live_verification_failed");
  if (!config.ok || json?.editionType !== "invitation_jukebox" || json?.invitationJukebox?.invitationType !== manifest.invitationType) throw failure("The live invitation configuration did not match the preview.", "config_verification_failed");
  const png = new Uint8Array(qrBytes); if (!qr.ok || png.length < 10000 || png[0] !== 0x89 || png[1] !== 0x50) throw failure("The live QR artwork failed verification.", "qr_verification_failed");
}

async function remoteJson(fetchImpl, url, { method = "GET", identity, body } = {}) { const response = await fetchImpl(url, { method, headers: authHeaders(identity, body === undefined ? {} : { "content-type": "application/json" }), body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" }), result = await response.json().catch(() => ({})); if (!response.ok || result.ok === false) throw failure(result.error || `Publisher returned ${response.status}.`, result.code || "publisher_request_failed"); return result; }
async function remoteBytes(fetchImpl, url, { identity, bytes, headers = {} } = {}) { const response = await fetchImpl(url, { method: "PUT", headers: authHeaders(identity, { ...headers, "content-length": String(bytes.length) }), body: bytes }), result = await response.json().catch(() => ({})); if (!response.ok || result.ok === false) throw failure(result.error || `Upload returned ${response.status}.`, result.code || "publisher_upload_failed"); return result; }
function authHeaders(identity, extra) { return { authorization: `Bearer ${identity.token}`, "x-deep-cuts-installation-id": identity.installationId, ...extra }; }
function origin(value) { try { const url = new URL(String(value || "")); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); return url.origin; } catch { throw failure("The publishing service URL is invalid.", "publisher_url_invalid"); } }
function failure(message, code) { return Object.assign(new Error(message), { name: "InvitationJukeboxPublicationError", code }); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
