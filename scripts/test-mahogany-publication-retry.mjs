import assert from "node:assert/strict";
import { MAHOGANY_RENDERER_VERSION } from "./aggits-jukebox-preview.mjs";
import { verifyMahoganyPublication } from "./mahogany-jukebox-publication.mjs";

const job = {
    id: "ajjob_verification_retry",
    editionId: "dc_verification_retry",
    liveUrl: "https://deep-cuts.example/e/dc_verification_retry",
    qrImageUrl: "https://deep-cuts.example/qr/dc_verification_retry.png",
  },
  manifest = {
    title: "Verification Retry",
    layoutProfile: "master-structure/1",
    video: { kind: "youtube" },
    skin: { kind: "default" },
    secretVideo: null,
  },
  config = {
    bandName: manifest.title,
    aggitsJukebox: {
      videoKind: manifest.video.kind,
      layoutProfile: manifest.layoutProfile,
      skin: { kind: "default" },
      modelVersion: MAHOGANY_RENDERER_VERSION,
    },
  },
  qrBytes = Buffer.alloc(10001, 0);
qrBytes[0] = 0x89;
qrBytes[1] = 0x50;

function responseFor(url, renderer) {
  if (url.startsWith(job.liveUrl))
    return new Response(
      `<html><head><meta name="deep-cuts-renderer" content="${renderer}"></head><body>Mahogany Jukebox</body></html>`,
      { status: 200, headers: { "x-deep-cuts-renderer": renderer } },
    );
  if (url.includes("/config")) return Response.json(config);
  if (url === job.qrImageUrl)
    return new Response(qrBytes, {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  throw new Error(`Unexpected verification URL: ${url}`);
}

let pageAttempts = 0;
await verifyMahoganyPublication(
  async (url) => {
    if (url.startsWith(job.liveUrl)) pageAttempts += 1;
    return responseFor(
      url,
      pageAttempts === 1 ? "mahogany-jukebox/stale" : MAHOGANY_RENDERER_VERSION,
    );
  },
  job,
  manifest,
  { sleep: async () => {}, retryMs: 0, maxAttempts: 2 },
);
assert.equal(pageAttempts, 2, "verification must retry a propagation-stale renderer");

await assert.rejects(
  verifyMahoganyPublication(
    async (url) => responseFor(url, "mahogany-jukebox/stale"),
    job,
    manifest,
    { sleep: async () => {}, retryMs: 0, maxAttempts: 2 },
  ),
  (error) => error?.code === "live_verification_failed",
  "verification must remain fail-closed when the exact renderer never appears",
);

console.log("Mahogany publication exact-contract retry tests passed.");
