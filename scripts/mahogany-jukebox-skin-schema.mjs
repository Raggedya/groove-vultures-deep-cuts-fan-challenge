import {
  MAHOGANY_LEGACY_CUSTOM_LAYOUT_ID,
  MAHOGANY_MASTER_HEIGHT,
  MAHOGANY_MASTER_LAYOUT_ID,
  MAHOGANY_MASTER_WIDTH,
} from "./mahogany-jukebox-layout.mjs";

export const MAHOGANY_SKIN_SCHEMA = "mahogany-jukebox-skin/1";
export const MAHOGANY_SKIN_MAX_BYTES = 12 * 1024 * 1024;
export const MAHOGANY_SKIN_FORMATS = Object.freeze({
  png: Object.freeze({ extension: "png", mimeType: "image/png" }),
  jpeg: Object.freeze({ extension: "jpg", mimeType: "image/jpeg" }),
  webp: Object.freeze({ extension: "webp", mimeType: "image/webp" }),
});

export const MAHOGANY_SKIN_ALLOWED_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "layoutProfile",
  "fileName",
  "storageFileName",
  "format",
  "mimeType",
  "width",
  "height",
  "sizeBytes",
  "sha256",
]);

const DEFAULT_SKIN = Object.freeze({
  schemaVersion: MAHOGANY_SKIN_SCHEMA,
  kind: "default",
  layoutProfile: "",
  fileName: "",
  storageFileName: "",
  format: "",
  mimeType: "",
  width: 0,
  height: 0,
  sizeBytes: 0,
  sha256: "",
});

export function defaultMahoganySkin() {
  return { ...DEFAULT_SKIN };
}

export function normalizeMahoganySkin(value, { allowLegacy = true } = {}) {
  const source = value && typeof value === "object" ? value : {};
  if (source.kind !== "custom") return defaultMahoganySkin();
  const format = String(source.format || "").toLowerCase(),
    supported = MAHOGANY_SKIN_FORMATS[format],
    width = Number(source.width),
    height = Number(source.height),
    master = width === MAHOGANY_MASTER_WIDTH && height === MAHOGANY_MASTER_HEIGHT,
    legacy = allowLegacy && width === 864 && height === 1536;
  if (
    !supported ||
    (!master && !legacy) ||
    Number(source.sizeBytes) <= 0 ||
    Number(source.sizeBytes) > MAHOGANY_SKIN_MAX_BYTES ||
    !/^[a-f0-9]{64}$/.test(String(source.sha256 || ""))
  )
    return defaultMahoganySkin();
  return {
    schemaVersion: MAHOGANY_SKIN_SCHEMA,
    kind: "custom",
    layoutProfile: master
      ? MAHOGANY_MASTER_LAYOUT_ID
      : MAHOGANY_LEGACY_CUSTOM_LAYOUT_ID,
    fileName: clean(source.fileName, 180),
    storageFileName: `skin.${supported.extension}`,
    format,
    mimeType: supported.mimeType,
    width,
    height,
    sizeBytes: Number(source.sizeBytes),
    sha256: String(source.sha256),
  };
}

export function validateMahoganySkinDefinition(
  value,
  { allowDefault = true, allowLegacy = true, rejectUnknown = true } = {},
) {
  const source = value && typeof value === "object" ? value : {},
    errors = [],
    unknownKeys = Object.keys(source).filter(
      (key) => !MAHOGANY_SKIN_ALLOWED_KEYS.includes(key),
    );
  if (rejectUnknown && unknownKeys.length)
    errors.push(`Unsupported skin properties: ${unknownKeys.join(", ")}.`);
  if (source.kind !== "custom") {
    if (!allowDefault && source.kind !== "custom")
      errors.push("A custom skin is required.");
    return { valid: errors.length === 0 && allowDefault, errors, value: defaultMahoganySkin() };
  }
  const normalized = normalizeMahoganySkin(source, { allowLegacy });
  if (normalized.kind !== "custom")
    errors.push(
      allowLegacy
        ? "The skin must be an approved 941 × 1672 master skin or a preserved 864 × 1536 legacy skin."
        : `The skin must be exactly ${MAHOGANY_MASTER_WIDTH} × ${MAHOGANY_MASTER_HEIGHT} pixels.`,
    );
  if (source.layoutProfile && normalized.kind === "custom" && source.layoutProfile !== normalized.layoutProfile)
    errors.push("The skin layout profile does not match its verified pixel dimensions.");
  return { valid: errors.length === 0, errors, value: normalized };
}

function clean(value, max) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}
