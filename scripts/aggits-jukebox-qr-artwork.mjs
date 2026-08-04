import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import sharp from "sharp";

export const AGGITS_JUKEBOX_QR_SIZE = 1254;
export const AGGITS_JUKEBOX_QR_SCHEMA = "deep-cuts-aggits-jukebox-qr/2";
export const AGGITS_JUKEBOX_QR_MASTER_SHA256 =
  "1750e428f4445b7be57b2bcc9ad681681c2c070930b1ade019c237ed68fdb684";
export const AGGITS_JUKEBOX_QR_PANEL = Object.freeze({
  topLeft: Object.freeze({ x: 751, y: 543 }),
  topRight: Object.freeze({ x: 1111, y: 543 }),
  bottomRight: Object.freeze({ x: 1105, y: 928 }),
  bottomLeft: Object.freeze({ x: 758, y: 928 }),
});

export async function createAggitsJukeboxQrArtwork({
  root,
  title,
  destination,
} = {}) {
  const sourceRoot = path.resolve(root || process.cwd()),
    payload = assertDestination(destination),
    displayTitle = cleanTitle(title);
  const masterPath = path.join(
      sourceRoot,
      "assets",
      "aggits-jukebox-qr-master-v1.png",
    ),
    qrSourcePath = path.join(sourceRoot, "scripts", "vendor", "qrcode.min.js");
  const [master, qrSource] = await Promise.all([
    fs.readFile(masterPath),
    fs.readFile(qrSourcePath, "utf8"),
  ]);
  const digest = crypto.createHash("sha256").update(master).digest("hex");
  if (digest !== AGGITS_JUKEBOX_QR_MASTER_SHA256)
    throw qrError(
      "The owner-approved Aggits QR master identity changed.",
      "qr_master_identity_changed",
    );
  const metadata = await sharp(master).metadata();
  if (
    metadata.width !== AGGITS_JUKEBOX_QR_SIZE ||
    metadata.height !== AGGITS_JUKEBOX_QR_SIZE
  )
    throw qrError(
      "The Aggits QR master must remain 1254 x 1254.",
      "qr_master_invalid",
    );
  const matrix = qrMatrix(qrSource, payload),
    placement = qrPlacement(matrix.length),
    overlay = Buffer.from(renderOverlay(matrix, placement, displayTitle));
  const png = await sharp(master, { failOn: "error" })
    .composite([{ input: overlay, left: 0, top: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await verifyMatrix(png, matrix, placement, 1);
  await verifyMatrix(png, matrix, placement, 0.5);
  return {
    schemaVersion: AGGITS_JUKEBOX_QR_SCHEMA,
    bytes: png,
    sha256: crypto.createHash("sha256").update(png).digest("hex"),
    destination: payload,
    width: AGGITS_JUKEBOX_QR_SIZE,
    height: AGGITS_JUKEBOX_QR_SIZE,
    // Full- and half-resolution matrix validation proves the perspective
    // projection itself. Publication performs the final phone-scale decoder
    // check against the deployed, unscaled PNG.
    scanProof: "perspective-matrix:1254+627;decoder:360-required",
  };
}

function qrMatrix(source, text) {
  const element = {
      innerHTML: "",
      title: "",
      childNodes: [{ offsetWidth: 256, offsetHeight: 256, style: {} }],
    },
    context = {
      navigator: { userAgent: "" },
      document: {
        documentElement: { tagName: "html" },
        getElementById() {
          return element;
        },
      },
      console,
    };
  vm.createContext(context);
  vm.runInContext(source, context, { timeout: 2000 });
  const instance = new context.QRCode(element, {
    text,
    correctLevel: context.QRCode.CorrectLevel.H,
    width: 256,
    height: 256,
  });
  const actual = instance._oQRCode;
  if (!actual)
    throw qrError("The QR matrix could not be generated.", "qr_matrix_invalid");
  const count = actual.getModuleCount();
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) =>
      Boolean(actual.isDark(row, column)),
    ),
  );
}

function qrPlacement(count) {
  const border = 4,
    total = count + border * 2;
  if (total > 109)
    throw qrError(
      "The permanent URL is too long for the locked QR panel.",
      "qr_payload_too_long",
    );
  return { border, total, panel: AGGITS_JUKEBOX_QR_PANEL };
}
function projectPoint(panel, u, v) {
  const top = {
    x: panel.topLeft.x + (panel.topRight.x - panel.topLeft.x) * u,
    y: panel.topLeft.y + (panel.topRight.y - panel.topLeft.y) * u,
  };
  const bottom = {
    x: panel.bottomLeft.x + (panel.bottomRight.x - panel.bottomLeft.x) * u,
    y: panel.bottomLeft.y + (panel.bottomRight.y - panel.bottomLeft.y) * u,
  };
  return {
    x: top.x + (bottom.x - top.x) * v,
    y: top.y + (bottom.y - top.y) * v,
  };
}
function polygon(points) {
  return points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
}
function renderOverlay(matrix, p, title) {
  const modules = [];
  for (let row = 0; row < matrix.length; row++)
    for (let column = 0; column < matrix.length; column++)
      if (matrix[row][column]) {
        const left = (column + p.border) / p.total,
          right = (column + p.border + 1) / p.total,
          top = (row + p.border) / p.total,
          bottom = (row + p.border + 1) / p.total;
        modules.push(
          `<polygon points="${polygon([projectPoint(p.panel, left, top), projectPoint(p.panel, right, top), projectPoint(p.panel, right, bottom), projectPoint(p.panel, left, bottom)])}" fill="#050403"/>`,
        );
      }
  const lines = titleLines(title),
    fontSize = fitTitle(lines);
  const titleMarkup =
    lines.length === 1
      ? `<text x="930" y="406">${xml(lines[0])}</text>`
      : `<text x="930" y="385">${xml(lines[0])}</text><text x="930" y="430">${xml(lines[1])}</text>`;
  const panel = AGGITS_JUKEBOX_QR_PANEL;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254"><defs><clipPath id="title-inset"><rect x="736" y="347" width="387" height="109" rx="20"/></clipPath></defs><rect x="724" y="335" width="411" height="133" rx="28" fill="#0d0a06" opacity=".97"/><g clip-path="url(#title-inset)" fill="#e2b86d" stroke="#3c210b" stroke-width="1.2" paint-order="stroke" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="${fontSize}" font-weight="800" letter-spacing="2">${titleMarkup}</g><polygon points="${polygon([panel.topLeft, panel.topRight, panel.bottomRight, panel.bottomLeft])}" fill="#fffaf0"/>${modules.join("")}</svg>`;
}
async function verifyMatrix(png, matrix, p, scale) {
  const { data, info } = await sharp(png)
    .resize(
      Math.round(AGGITS_JUKEBOX_QR_SIZE * scale),
      Math.round(AGGITS_JUKEBOX_QR_SIZE * scale),
      { kernel: sharp.kernel.nearest },
    )
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let mismatches = 0,
    total = 0;
  for (let row = 0; row < matrix.length; row++)
    for (let column = 0; column < matrix.length; column++) {
      const point = projectPoint(
          p.panel,
          (column + p.border + 0.5) / p.total,
          (row + p.border + 0.5) / p.total,
        ),
        x = Math.round(point.x * scale),
        y = Math.round(point.y * scale),
        i =
          (Math.min(info.height - 1, y) * info.width +
            Math.min(info.width - 1, x)) *
          info.channels,
        dark = (data[i] + data[i + 1] + data[i + 2]) / 3 < 128;
      if (dark !== matrix[row][column]) mismatches++;
      total++;
    }
  const tolerance = scale < 0.4 ? 0.02 : 0.002;
  if (mismatches > Math.max(1, Math.floor(total * tolerance)))
    throw qrError(
      `The ${info.width} x ${info.height} QR matrix-integrity check failed.`,
      "qr_scanback_failed",
    );
}
function titleLines(value) {
  const words = value.split(/\s+/);
  if (value.length <= 18 || words.length < 2) return [value];
  let at = 1,
    diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const next = Math.abs(
      words.slice(0, i).join(" ").length - words.slice(i).join(" ").length,
    );
    if (next < diff) {
      diff = next;
      at = i;
    }
  }
  return [words.slice(0, at).join(" "), words.slice(at).join(" ")];
}
function fitTitle(lines) {
  const longest = lines.reduce(
      (current, line) => {
        const units = [...line].reduce(
          (n, c) =>
            n + ("MW@#".includes(c) ? 1.1 : "I1 ".includes(c) ? 0.48 : 0.78),
          0,
        );
        return units > current.units ? { line, units } : current;
      },
      { line: "", units: 0 },
    ),
    letterSpacing = Math.max(0, longest.line.length - 1) * 2,
    available = 360 - letterSpacing;
  return Math.max(
    lines.length === 1 ? 16 : 15,
    Math.min(
      lines.length === 1 ? 45 : 34,
      Math.floor(available / Math.max(1, longest.units)),
    ),
  );
}
function assertDestination(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw qrError(
      "The permanent QR destination is invalid.",
      "qr_destination_invalid",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !/^\/q\/dc_[a-f0-9]{10}$/.test(url.pathname)
  )
    throw qrError(
      "The QR must target an opaque public Deep Cuts route.",
      "qr_destination_invalid",
    );
  return url.href;
}
function cleanTitle(value) {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .slice(0, 120);
  if (!text) throw qrError("The QR title is required.", "qr_title_missing");
  return text;
}
function xml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
}
function qrError(message, code) {
  return Object.assign(new Error(message), {
    name: "AggitsJukeboxQrError",
    code,
  });
}
