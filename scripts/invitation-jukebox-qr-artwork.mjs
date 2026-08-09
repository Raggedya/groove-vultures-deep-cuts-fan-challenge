import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import sharp from "sharp";

export const INVITATION_QR_SIZE = 1254;
export const INVITATION_QR_SCHEMA = "deep-cuts-invitation-jukebox-qr/1";
export const INVITATION_QR_SCAN_PROOF = "matrix:1254+627;decoder:360-required";

const THEMES = Object.freeze({
  wedding: ["#090705", "#c89b50", "#f5dfb7"],
  birthday: ["#14091a", "#d7a632", "#73c8cb"],
  corporate: ["#07101f", "#c8a96d", "#eef5ff"],
  seasonal: ["#08150e", "#bf8a35", "#c92328"],
  group_trip: ["#120908", "#bf793d", "#d62f25"],
});

export async function createInvitationQrArtwork({ root, title, invitationType, destination } = {}) {
  const payload = destinationUrl(destination), displayTitle = clean(title, 80).toUpperCase();
  const source = await fs.readFile(path.join(path.resolve(root || process.cwd()), "scripts", "vendor", "qrcode.min.js"), "utf8");
  const matrix = qrMatrix(source, payload), placement = qrPlacement(matrix.length);
  const svg = Buffer.from(render({ matrix, placement, title: displayTitle, theme: THEMES[invitationType] || THEMES.wedding }));
  const png = await sharp(svg).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  await verify(png, matrix, placement, 1);
  await verify(png, matrix, placement, 0.5);
  return { schemaVersion: INVITATION_QR_SCHEMA, bytes: png, sha256: crypto.createHash("sha256").update(png).digest("hex"), destination: payload, width: INVITATION_QR_SIZE, height: INVITATION_QR_SIZE, scanProof: INVITATION_QR_SCAN_PROOF };
}

function qrMatrix(source, text) {
  const element = { innerHTML: "", title: "", childNodes: [{ offsetWidth: 256, offsetHeight: 256, style: {} }] };
  const context = { navigator: { userAgent: "" }, document: { documentElement: { tagName: "html" }, getElementById: () => element }, console };
  vm.createContext(context); vm.runInContext(source, context, { timeout: 2000 });
  const instance = new context.QRCode(element, { text, correctLevel: context.QRCode.CorrectLevel.H, width: 256, height: 256 });
  const model = instance._oQRCode, count = model?.getModuleCount();
  if (!Number.isInteger(count)) throw qrError("The QR matrix could not be generated.", "qr_matrix_invalid");
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, column) => Boolean(model.isDark(row, column))));
}
function qrPlacement(count) { const border = 4, module = Math.floor(650 / (count + border * 2)), size = module * (count + border * 2); if (module < 4) throw qrError("The permanent URL is too long.", "qr_payload_too_long"); return { border, module, size, left: Math.floor((INVITATION_QR_SIZE - size) / 2), top: 290 }; }
function render({ matrix, placement: p, title, theme: [dark, gold, accent] }) {
  const modules = [];
  for (let row = 0; row < matrix.length; row++) for (let column = 0; column < matrix.length; column++) if (matrix[row][column]) modules.push(`<rect x="${p.left + (column + p.border) * p.module}" y="${p.top + (row + p.border) * p.module}" width="${p.module}" height="${p.module}" fill="${dark}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${INVITATION_QR_SIZE}" height="${INVITATION_QR_SIZE}" viewBox="0 0 ${INVITATION_QR_SIZE} ${INVITATION_QR_SIZE}"><defs><radialGradient id="g"><stop stop-color="${accent}" stop-opacity=".25"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs><rect width="1254" height="1254" fill="${dark}"/><rect x="36" y="36" width="1182" height="1182" rx="72" fill="url(#g)" stroke="${gold}" stroke-width="8"/><path d="M126 214H1128M126 1062H1128" stroke="${gold}" stroke-width="3"/><text x="627" y="145" fill="${gold}" text-anchor="middle" font-family="Georgia,serif" font-size="28" letter-spacing="9">INVITATION JUKEBOX</text><text x="627" y="225" fill="${accent}" text-anchor="middle" font-family="Georgia,serif" font-size="${fit(title)}" font-weight="700">${xml(title)}</text><rect x="${p.left - 18}" y="${p.top - 18}" width="${p.size + 36}" height="${p.size + 36}" rx="24" fill="#fff" stroke="${gold}" stroke-width="7"/><rect x="${p.left}" y="${p.top}" width="${p.size}" height="${p.size}" fill="#fff"/>${modules.join("")}<text x="627" y="1010" fill="${accent}" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" letter-spacing="5">SCAN TO OPEN</text><rect x="355" y="1090" width="544" height="64" rx="12" fill="${dark}" stroke="${gold}" stroke-width="3"/><text x="627" y="1123" fill="${gold}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-size="20">Copyright Clearlight Creative 2026</text></svg>`;
}
async function verify(png, matrix, p, scale) {
  const { data, info } = await sharp(png).resize(Math.round(INVITATION_QR_SIZE * scale), Math.round(INVITATION_QR_SIZE * scale), { kernel: sharp.kernel.nearest }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let mismatches = 0, total = 0;
  for (let row = 0; row < matrix.length; row++) for (let column = 0; column < matrix.length; column++) {
    const x = Math.round((p.left + (column + p.border + .5) * p.module) * scale), y = Math.round((p.top + (row + p.border + .5) * p.module) * scale), i = (Math.min(info.height - 1, y) * info.width + Math.min(info.width - 1, x)) * info.channels;
    if (((data[i] + data[i + 1] + data[i + 2]) / 3 < 128) !== matrix[row][column]) mismatches++;
    total++;
  }
  if (mismatches > Math.max(1, Math.floor(total * .002))) throw qrError("The QR scan-back integrity check failed.", "qr_scanback_failed");
}
function destinationUrl(value) { try { const url = new URL(String(value || "")); if (url.protocol !== "https:" || !/^\/q\/dc_[a-f0-9]{10}$/.test(url.pathname)) throw new Error(); return url.href; } catch { throw qrError("The permanent QR destination is invalid.", "qr_destination_invalid"); } }
function fit(value) { return Math.max(30, Math.min(62, Math.floor(820 / Math.max(8, value.length * .72)))); }
function clean(value, max) { const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, max); if (!text) throw qrError("The QR artwork requires a title.", "qr_title_missing"); return text; }
function xml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]); }
function qrError(message, code) { return Object.assign(new Error(message), { name: "InvitationQrArtworkError", code }); }
