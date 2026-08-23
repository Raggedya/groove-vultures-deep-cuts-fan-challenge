# Mahogany Jukebox fixed-layout engine

The complete approved module is locked by `CANONICAL_JUKEBOX_MODULE_LOCK.md` and `contracts/canonical-mahogany-jukebox-v1.json`. Run `node scripts/test-canonical-mahogany-jukebox-lock.mjs` before and after any potentially related work.

Version 1.4.12 uses the shared canonical `master-structure/1` geometry and the isolated approved `miners-rest-941/1` property profile, both defined only in `scripts/mahogany-jukebox-layout.mjs`. Their 941 × 1672 compositions and interaction timing are immutable. Previously published legacy layouts retain their named, isolated profiles.

This document describes the layout engine; it does not authorise changing it. The module-level lock governs if any instruction conflicts.

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

Do not edit the layout module, slot percentages or timing constants for a customer skin or an unrelated feature. New functionality must adapt inside the existing fixed viewports and public interfaces.

Any future geometry change requires the user's exact explicit authorization to change the canonical module, a new named contract and layout-profile version, new regression baselines, an impact assessment, a source-control recovery point and an explicit migration and rollback plan. Never overwrite a baseline or overload an existing profile ID.
