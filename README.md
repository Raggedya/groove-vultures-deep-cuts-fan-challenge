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
- `js/analytics.js`, `js/reporting.js` and `analytics.html` — shared non-blocking event instrumentation and band-level reporting.
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

## Automatic production time and AI cost tracking

Every one-prompt edition starts a build record before research. The record measures complete elapsed production time through live verification and email preparation. Completed and failed runs are saved permanently in `build-records/builds.jsonl`, and a `BUILD SUMMARY` is added automatically to the delivery email.

AI cost is labelled Actual, Calculated, Estimated or Unavailable. Codex currently does not expose reliable per-build billing or token totals to this repository, so an edition without provider usage data truthfully reports `Build cost: Unavailable`. The system never divides a subscription fee or invents token counts.

When a provider exposes usage, the production agent records it with `npm run build:usage`. Token prices come from `config/ai-pricing.json`; direct metered charges can also be recorded. Measurable USD totals are converted to AUD using an environment override or the public rate source in `config/build-tracking.json`. `.env.example` documents every optional override. No email password or API key belongs in these files.

The relevant automation commands are:

```powershell
npm run build:start -- artist-slug --artist "Artist Name"
npm run build:usage -- BUILD-ID --file usage.json
npm run publish -- artist-slug --deploy
```

The owner is not expected to run these commands; the Deep Cuts Factory performs them as part of the one-prompt workflow.

## Analytics

Every edition now records the complete quiz, sharing and outbound-discovery journey with a band identifier, quiz identifier, timestamp, referral source and device category. The built-in report is available at [Deep Cuts Analytics](analytics.html). Until an aggregated analytics service is connected, that view accurately reports events from the current browser only.

Cross-visitor reporting requires a one-time GA4 measurement ID or a first-party collection/reporting endpoint. These account credentials do not exist in the repository and cannot safely be invented. Configuration, event definitions, formulas and privacy safeguards are documented in [ANALYTICS.md](ANALYTICS.md).
