# Mahogany Jukebox Master

**Status: final, owner-approved and permanently locked on 2026-08-04.**

The permanent Band JookBox master is named **Mahogany Jukebox Master**. Its approved live reference is Savage Garden edition `dc_e65763b78b` after the final mobile coin-motion and four-key proportion corrections.

Every new or regenerated Band JookBox must use the fail-closed constants in `scripts/jookbox-locked-model.mjs`. No factory input, import, batch, Studio draft or regeneration may select ATLAS, neon or another Band cabinet/key format. Historical completed routes remain frozen only because the platform's backward-compatibility directive forbids deleting or altering commercial products; they are not templates and are ignored by every current Band factory boundary.

## Immutable presentation and behaviour

- `jookbox/3` with `coin-awakening/1`.
- `mahogany-jookbox-master/1` cabinet and its SHA-256-locked asset.
- Fitted band title, bright right-to-left amber ticker and privacy-enhanced featured-video screen.
- Four equal, proportional, circular icon-only physical keys using `mahogany-four-key/1`.
- No visible key labels, key lighting, glow, pulse or sequence.
- One accessible coin that visibly slides and shrinks into the slot.
- The licensed genuine local coin-slot recording; video focus waits for the recording's real end.
- Four-state session model: `sleeping`, `acceptingCoin`, `poweringUp`, `awake`.
- Full-width working brass plate labelled exactly `SHARE`.
- In-cabinet hardware reading exactly `Copyright Clearlight Creative 2026.`.
- Secure external tabs, reduced-motion handling and edition-specific session restoration.
- Perspective-fitted, scan-tested character QR delivery poster; Aggits remains absent from the live Band page.

Band identity, verified destinations, featured video, ticker biography and evidence remain edition data. They may change per band without changing this master.

## Enforcement

The master is enforced by:

- `scripts/jookbox-locked-model.mjs` — the single immutable factory contract;
- `scripts/create-edition.mjs` — emits master values rather than accepting presentation overrides;
- `scripts/validate-platform.mjs` — rejects incompatible active or regenerated Band configurations;
- `scripts/test-jookbox.mjs` — protects the exact reference, assets, coin interaction and four-key presentation;
- `edition-contracts.json` — machine-readable final-lock metadata.

Any future visual or behavioural change requires a new explicit written owner override and a new versioned master. It must never silently mutate `mahogany-jookbox-master/1`.
