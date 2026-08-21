# Mahogany Jukebox fixed-layout engine

Version 1.4.12 has one canonical new-edition geometry: `master-structure/1`, defined only in `scripts/mahogany-jukebox-layout.mjs`. Its 941 × 1672 composition and interaction timing are immutable.

## Separation of responsibilities

- `mahogany-jukebox-layout.mjs` owns coordinates, clipping, hit areas, responsive aspect ratio and timing.
- `mahogany-jukebox-skin-schema.mjs` owns the strict presentation-only skin whitelist and dimension validation.
- `mahogany-jukebox-model.mjs` owns project content and persisted state.
- `aggits-jukebox-preview.mjs` renders the same resolved profile in Studio and public pages.
- `worker/aggits-jukebox-publisher.js` validates the same manifest contract before accepting assets.

Skin records cannot contain geometry or timing. Unknown properties are rejected. A new custom skin must be exactly 941 × 1672. Default and invalid skin states fall back to the locked master without changing the active layout profile.

## Backward compatibility

Previously stored and published 864 × 1536 editions resolve to an isolated legacy profile. Existing IDs, URLs, QR codes and edition data remain unchanged. New projects default to `master-structure/1`; opening an old project does not migrate it silently.

## Changing geometry

Do not edit the layout module, slot percentages or timing constants for a customer skin. Any authorised future geometry change requires a new named layout profile, new regression baselines and an explicit migration plan. Never overload an existing profile ID.
