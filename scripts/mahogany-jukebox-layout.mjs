export const MAHOGANY_MASTER_LAYOUT_ID = "master-structure/1";
export const MAHOGANY_LEGACY_LAYOUT_ID = "mahogany-master-864/1";
export const MAHOGANY_LEGACY_CUSTOM_LAYOUT_ID = "custom-skin-864/1";

export const MAHOGANY_MASTER_WIDTH = 941;
export const MAHOGANY_MASTER_HEIGHT = 1672;
export const MAHOGANY_LEGACY_WIDTH = 864;
export const MAHOGANY_LEGACY_HEIGHT = 1536;

export const MAHOGANY_LOCKED_TIMING = Object.freeze({
  powerUpMs: Object.freeze({
    accepting: 0,
    cabinet: 180,
    screen: 780,
    ticker: 1280,
    awake: 1800,
    actions: 2600,
  }),
  coinInsertMs: 620,
  reducedCoinInsertMs: 180,
  neonStartupMs: 2240,
  secretScreenTravelMs: 3000,
  reducedSecretScreenTravelMs: 180,
  secretScreenFallbackPaddingMs: 180,
  outboundDelayMs: 500,
  attentionStartSeconds: 45.14,
  attentionFlashSeconds: 0.5,
  attentionButtonCount: 4,
  attentionCycles: 3,
});

const profile = (id, width, height, slots) =>
  Object.freeze({
    id,
    width,
    height,
    aspectRatio: `${width}/${height}`,
    slots: Object.freeze(
      Object.fromEntries(
        Object.entries(slots).map(([name, value]) => [
          name,
          Array.isArray(value)
            ? Object.freeze(value.map((item) => Object.freeze({ ...item })))
            : Object.freeze({ ...value }),
        ]),
      ),
    ),
  });

/*
 * MASTER STRUCTURE.png is the authoritative 941 × 1672 geometry reference.
 * Values below are percentages of that immutable canvas. They are owned only
 * by this module: skin definitions cannot add to or override them.
 */
export const MAHOGANY_MASTER_LAYOUT = profile(
  MAHOGANY_MASTER_LAYOUT_ID,
  MAHOGANY_MASTER_WIDTH,
  MAHOGANY_MASTER_HEIGHT,
  {
    ticker: { top: 24.28, left: 13.62, width: 72.7, height: 3.18, radius: 5 },
    // Measured against the true inner screen aperture in the immutable
    // 941 × 1672 MASTER STRUCTURE.  Keep the media inside the photographed
    // chrome/red bezel instead of covering it with the generic outer frame.
    video: { top: 28.17, left: 26.89, width: 57.92, height: 32.36, radius: 3.7 },
    coin: { top: 34.15, left: 16.7, width: 9.4 },
    actions: { top: 65.55, left: 0, width: 100, height: 16.9, gap: 0, padY: 0, padX: 0 },
    actionKeys: [
      // The fixed 18%-wide hit areas are centred on the measured physical
      // oval centres in MASTER-STRUCTURE-941x1672.png: 199, 377, 564 and
      // 739 source pixels. Keep these shared coordinates data-driven; never
      // compensate for individual icon artwork with CSS offsets.
      { top: 0, left: 12.1477, width: 18, height: 100 },
      { top: 0, left: 31.0638, width: 18, height: 100 },
      { top: 0, left: 50.9362, width: 18, height: 100 },
      { top: 0, left: 69.5335, width: 18, height: 100 },
    ],
    share: { top: 82.72, left: 13.55, width: 72.9, height: 5.35 },
    mainPlay: { top: 89.35, left: 38.6, width: 22.8, height: 8.45 },
    footer: { top: 97.05, left: 14.2, width: 71.6, height: 2.1 },
  },
);

export const MAHOGANY_LEGACY_LAYOUT = profile(
  MAHOGANY_LEGACY_LAYOUT_ID,
  MAHOGANY_LEGACY_WIDTH,
  MAHOGANY_LEGACY_HEIGHT,
  {
    ticker: { top: 19.02, left: 13.65, width: 72.65, height: 5.05, radius: 8 },
    video: { top: 25.84, left: 23.55, width: 64.78, height: 29.3, radius: 1.8 },
    coin: { top: 34.15, left: 16.7, width: 9.4 },
    actions: { top: 55.9, left: 12.05, width: 73.5, height: 18.2, gap: 1.45, padY: 0.5, padX: 0.25 },
    actionKeys: [],
    share: { top: 77.15, left: 13.35, width: 73.3, height: 5.95 },
    mainPlay: { top: 84.1, left: 38.6, width: 22.8, height: 8.45 },
    footer: { top: 96.2, left: 14.2, width: 71.6, height: 2.1 },
  },
);

export const MAHOGANY_LEGACY_CUSTOM_LAYOUT = profile(
  MAHOGANY_LEGACY_CUSTOM_LAYOUT_ID,
  MAHOGANY_LEGACY_WIDTH,
  MAHOGANY_LEGACY_HEIGHT,
  MAHOGANY_MASTER_LAYOUT.slots,
);

export const MAHOGANY_LAYOUT_PROFILES = Object.freeze({
  [MAHOGANY_MASTER_LAYOUT_ID]: MAHOGANY_MASTER_LAYOUT,
  [MAHOGANY_LEGACY_LAYOUT_ID]: MAHOGANY_LEGACY_LAYOUT,
  [MAHOGANY_LEGACY_CUSTOM_LAYOUT_ID]: MAHOGANY_LEGACY_CUSTOM_LAYOUT,
});

export function mahoganyLayoutProfile(id) {
  return MAHOGANY_LAYOUT_PROFILES[String(id || "")] || null;
}

export function resolveMahoganyLayoutProfile({ layoutProfile, skin } = {}) {
  const explicit = mahoganyLayoutProfile(layoutProfile);
  if (explicit) return explicit;
  if (skin?.kind === "custom") {
    if (
      Number(skin.width) === MAHOGANY_MASTER_WIDTH &&
      Number(skin.height) === MAHOGANY_MASTER_HEIGHT
    )
      return MAHOGANY_MASTER_LAYOUT;
    return MAHOGANY_LEGACY_CUSTOM_LAYOUT;
  }
  return MAHOGANY_LEGACY_LAYOUT;
}

const pct = (value) => `${Number(value)}%`;

export function mahoganyLayoutCssVariables(layout) {
  const selected = mahoganyLayoutProfile(layout?.id) || MAHOGANY_LEGACY_LAYOUT,
    { slots } = selected,
    variables = {
      "--machine-aspect": selected.aspectRatio,
      "--ticker-top": pct(slots.ticker.top),
      "--ticker-left": pct(slots.ticker.left),
      "--ticker-width": pct(slots.ticker.width),
      "--ticker-height": pct(slots.ticker.height),
      "--ticker-radius": pct(slots.ticker.radius),
      "--video-top": pct(slots.video.top),
      "--video-left": pct(slots.video.left),
      "--video-width": pct(slots.video.width),
      "--video-height": pct(slots.video.height),
      "--video-radius": pct(slots.video.radius),
      "--coin-top": pct(slots.coin.top),
      "--coin-left": pct(slots.coin.left),
      "--coin-width": pct(slots.coin.width),
      "--actions-top": pct(slots.actions.top),
      "--actions-left": pct(slots.actions.left),
      "--actions-width": pct(slots.actions.width),
      "--actions-height": pct(slots.actions.height),
      "--actions-gap": pct(slots.actions.gap || 0),
      "--actions-padding": `${pct(slots.actions.padY || 0)} ${pct(slots.actions.padX || 0)}`,
      "--share-top": pct(slots.share.top),
      "--share-left": pct(slots.share.left),
      "--share-width": pct(slots.share.width),
      "--share-height": pct(slots.share.height),
      "--main-play-top": pct(slots.mainPlay.top),
      "--main-play-left": pct(slots.mainPlay.left),
      "--main-play-width": pct(slots.mainPlay.width),
      "--main-play-height": pct(slots.mainPlay.height),
    };
  slots.actionKeys.forEach((slot, index) => {
    variables[`--action-${index + 1}-top`] = pct(slot.top);
    variables[`--action-${index + 1}-left`] = pct(slot.left);
    variables[`--action-${index + 1}-width`] = pct(slot.width);
    variables[`--action-${index + 1}-height`] = pct(slot.height);
  });
  variables["--action-width"] = pct(slots.actionKeys[0]?.width || 0);
  return Object.entries(variables)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

export function mahoganyGeometrySnapshot(layout = MAHOGANY_MASTER_LAYOUT) {
  const selected = mahoganyLayoutProfile(layout?.id) || MAHOGANY_MASTER_LAYOUT,
    canonical = JSON.stringify({
      id: selected.id,
      width: selected.width,
      height: selected.height,
      slots: selected.slots,
      timing: MAHOGANY_LOCKED_TIMING,
    });
  return {
    ...JSON.parse(canonical),
    canonical,
  };
}
