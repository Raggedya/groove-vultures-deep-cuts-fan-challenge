# Deep Cuts Publishing Platform

This is the permanent master repository for every Deep Cuts Fan Challenge. Future editions are configuration and researched content inside this platform—not separate software projects or repositories.

## Owner workflow

The normal owner instruction is simply:

> `Deep Cut [Band or Artist]`

Codex then researches, builds, validates, publishes and verifies the edition; generates the square Instagram and branded QR images; and emails the playable link and both images to the owner. The owner should not need PowerShell, GitHub steps, copy/paste or coding knowledge.

## Permanent rules

The project constitution is [DEEP_CUTS_PRODUCTION_MANUAL.md](DEEP_CUTS_PRODUCTION_MANUAL.md). Agent behaviour is defined in [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) and the project-local Deep Cuts Factory skill. Production priorities are ordered by time saved in [ROADMAP.md](ROADMAP.md).

The locked product model includes:

- 36 source-verified Deep Cuts questions;
- three fresh 12-question games before the bank resets;
- a fixed difficulty and category mix;
- 15-second answering time with the established audio sequence;
- 10-second answer, story and source feedback;
- premium blue-black presentation and the exact approved Aggits artwork;
- verified discovery links, fan ratings and automatic social delivery assets.

## Platform structure

- `platform.json` — edition registry and default edition.
- `editions/<slug>/edition.json` — edition identity, public URL, links, timing and theme.
- `editions/<slug>/questions.json` — the edition’s 36 source-linked questions.
- `js/` and `styles.css` — the single shared application engine and interface.
- `assets/` — shared audio and approved immutable Aggits artwork.
- `output/<slug>/` — generated delivery images and manifests; these are rebuilt, not committed.
- `scripts/` — registration, validation, testing, social generation, packaging and publishing automation.

## Automated production commands

These commands exist for Codex and continuous integration; the owner is not expected to run them.

```powershell
npm run validate
npm run build -- groove-vultures
npm run publish -- groove-vultures
```

The publish command runs the full build and prepares the completion delivery package. `--deploy` is reserved for an authenticated, editorially approved production run.

## Current edition

[Play the Groove Vultures Deep Cuts Fan Challenge](https://raggedya.github.io/groove-vultures-deep-cuts-fan-challenge/?edition=groove-vultures)

## Integrity and deployment

The approved Aggits character is protected by a SHA-256 identity check. The build stops if that exact asset changes, if content balance fails, or if the generated QR image does not scan back to the intended edition URL. GitHub Actions repeats the automated checks on every platform change, and GitHub Pages serves every active edition from this single site.
