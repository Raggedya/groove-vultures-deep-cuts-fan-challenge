# Deep Cuts — Codex Mac Handover

Snapshot date: 28 July 2026 (Australia/Sydney)

This document is the practical handover for continuing Deep Cuts in a new Codex session on macOS. It records the current purpose, architecture, locked product rules, repository structure, dependencies, completed work, known limitations, exact commands, deployment model, and recommended next steps.

## 1. Start here on the Mac

The GitHub repository is the source of truth:

- Repository: `https://github.com/Raggedya/groove-vultures-deep-cuts-fan-challenge`
- Production: `https://deep-cuts.andrewharris501.workers.dev`
- Cloudflare Worker name: `deep-cuts`
- Current D1 database name: `deep-cuts-production`

Clone a fresh copy rather than manually copying generated folders from Windows:

```bash
brew install git gh node python
gh auth login
git clone https://github.com/Raggedya/groove-vultures-deep-cuts-fan-challenge.git
cd groove-vultures-deep-cuts-fan-challenge
git switch main
git pull --ff-only origin main
npm install --ignore-scripts --no-audit --no-fund
python3 -m pip install --upgrade pip
python3 scripts/ensure-python-deps.py
npm run validate
npm run build
```

The validated CI toolchain is Node.js 22 and Python 3.12. The repository does not currently contain a package lock, so use `npm install`, not `npm ci`.

Before doing any work, the new Codex session must read these files completely and in this order:

1. `AGENTS.md`
2. `PLATFORM_ARCHITECTURE_DIRECTIVE.md`
3. `DEEP_CUTS_PRODUCTION_MANUAL.md`
4. `CLAUDE.md`
5. `ROADMAP.md`
6. `.agents/skills/deep-cuts-factory/SKILL.md`

For independent-label work, also read `INDIE_LABEL_MODEL.md`. For Record Company Edition work, read `RECORD_COMPANY_EDITION.md` and `HOW_TO_CREATE_A_RECORD_COMPANY_DEEP_CUTS_ECOSYSTEM.md`. For Commercial Instinct work, read `SALES_INTELLIGENCE.md`.

## 2. Project purpose

Deep Cuts is one permanent, mobile-first discovery platform that creates isolated commercial editions for artists, labels, record companies, cars, clubs, schools, and selected business use cases.

Its central operating principle is:

> Every completed edition is a finished commercial product. Preserve it forever. Future work extends the platform; it does not overwrite, weaken, or accidentally restyle an existing edition.

The platform is intended to:

- turn verified public information into polished discovery experiences;
- send visitors to direct, identity-verified destinations;
- generate permanent opaque URLs and scan-tested QR assets;
- collect privacy-conscious engagement analytics;
- automate production, deployment, reporting, and delivery;
- require as little repetitive owner input as safely possible.

It is not a generic CMS, streaming platform, social network, or per-client collection of copied applications.

## 3. Non-negotiable product rules

These rules supersede convenience:

- One shared repository and engine. Never create or copy a repository for an edition.
- Every edition is isolated. A change to one product must not alter another product.
- Backward compatibility is mandatory unless Andrew explicitly authorises a named impact.
- Perform the impact assessment in `PLATFORM_ARCHITECTURE_DIRECTIVE.md` before editing.
- Public artist routes are opaque: `/e/<editionId>`. Artist names never appear in public routes.
- QR entry routes are `/q/<editionId>` and must continue resolving to the same permanent edition.
- Existing edition IDs are never changed or recycled.
- Search results are not destination evidence.
- Never invent links, biographies, questions, answers, musical relationships, release data, or claims.
- Unverified or unavailable destinations are omitted, not guessed or shown disabled.
- The identity and direct-destination confidence gate is 98% and fail-closed.
- One failed artist must not stop an unattended batch or Record Company build.
- Aggits assets are immutable and protected by integrity tests.
- Tipping is retired and must not be restored.
- No secrets, transient checkpoints, or private credentials enter Git.
- GitHub is the source of truth. Work on a branch, validate, open a PR, merge only after green checks, then verify deployment.
- Every public product, edition, quiz, result, error, and legal screen must end with exactly:

```text
Deep Cuts
Copyright Clearlight Creative
```

This footer is owned by the Core Engine. Edition configuration must never replace, suppress, or restyle it out of existence.

## 4. Current architecture

### 4.1 Shared discovery renderer

The main experience is a configuration-driven static application:

- `index.html` — shared public shell and screen structure.
- `styles.css` — shared responsive presentation plus carefully scoped edition variants.
- `js/app.js` — edition loading, rendering, navigation, wheel behavior, destination handling, and main state.
- `js/engine.js` — shared data/selection helpers.
- `js/interactions.js` — reusable interaction behavior.
- `js/analytics.js` — central client analytics transport and local resilience.
- `js/reporting.js` and `js/report.js` — reporting-related client logic.
- `js/school-quiz.js` — isolated School Discovery quiz.
- `js/laneway-quiz.js` — isolated artist-specific Laneway quiz.
- `js/laneway-company-quiz.js` — isolated Laneway company/Indie Label wheel quiz.

The renderer loads the selected record from `platform.json`, then loads that edition's structured files from `editions/<slug>/`.

Business Recruitment is now an isolated shared-engine type. `js/business-quiz.js` owns its ten-question quiz, while `config.business.jobs` contains direct verified vacancies. High Grade Mechanical is the first edition at opaque ID `dc_4a71b2c8e9`; its exact owner-supplied `assets/hgm-aggits-owner-supplied.jpg` and official `assets/hgm-logo-official.png` are protected by `scripts/test-high-grade-mechanical.mjs`. HGM keeps that exact Aggits artwork in its QR and delivery assets but intentionally omits the large artwork and duplicated company-name title from the live page through edition-owned display flags. Its two `business.rolePaths` appear before the eight vacancy cards and share HGM's verified public contact page; `business.buttonLightSequence` opts only this edition into the accessible top-to-bottom carnival-light sequence across role, vacancy, quiz, service-map wheel and utility controls. The HGM-only `business.locationWheel` renders directly below the quiz button and holds seven centrally maintained, officially sourced service regions and advertised mining work settings. Every result links to its supporting HGM page; named client mine relationships must never be inferred.

### 4.2 Edition registry and contracts

- `platform.json` is the canonical public edition registry and permanent base URL.
- `edition-contracts.json` is the machine-readable contract registry.
- `editions/<slug>/edition.json` is the central edition configuration.
- Optional edition files include:
  - `research.json`
  - `questions.json`
  - `laneway-questions.json`
  - `school-questions.json`
  - `roster.json`
  - `artist-impact.json`
  - `artist-videos.json`

At this handover there are 32 active registered editions. Do not maintain that number manually; `platform.json` is authoritative.

Useful registry check:

```bash
node -e "const p=require('./platform.json'); console.log(p.editions.filter(e=>e.active).length); for(const e of p.editions) console.log(e.editionId, e.slug, e.name, e.canonicalPath)"
```

### 4.3 Cloudflare Worker and APIs

- `worker/index.js` — Worker entry point, opaque edition/QR routing, analytics APIs, reporting APIs, health checks, static asset fallback, and product routing.
- `worker/record-company.js` — Record Company job, roster, edition, analytics, and export APIs.
- `worker/sales.js` — Commercial Instinct APIs.
- `worker/commercial-research.js` — evidence-aware commercial research helpers.
- `worker/laneway-report.js` — Laneway weekly report generation.
- `wrangler.jsonc` — Worker, static assets, Workers AI, D1, migrations, and hourly cron configuration.

Cloudflare bindings:

- `ASSETS` — built static bundle from `dist/`.
- `DB` — D1 database `deep-cuts-production`.
- `AI` — Cloudflare Workers AI.

The cron is `0 * * * *`. Time-sensitive jobs, including the Friday report, decide whether to run inside the Worker.

### 4.4 D1 data

Migrations:

- `migrations/0001_deep_cuts.sql` — core editions, analytics, delivery, and reporting data.
- `migrations/0002_sales_intelligence.sql` — `sales_*` Commercial Instinct data.
- `migrations/0003_record_company.sql` — `record_company_*` ecosystem data.

D1 is the production source of truth for analytics/reporting and server-side workflow state. Do not substitute browser-local data for production reporting.

### 4.5 Product families

The same repository contains separately locked contracts:

- Standard Music editions.
- Cars editions (`editionType: car`) with automotive destinations.
- Clubs editions (`editionType: club`) with club-specific destinations.
- School Discovery with no copied school logo/Aggits and exactly six positive timed questions.
- Artist-specific Laneway editions with approved reverse-white Laneway identity, no Aggits, official label video, and exactly five sourced questions.
- Standalone Laneway company wheel at `dc_b9e7b66620`.
- Independent-label wheels (`indie_wheel`) based on locked model `indie_label/1`.
- Record Company Edition under `/record-company/*`, with its own renderer, APIs, D1 tables, jobs, generated deliverables, and 98% gate.
- Commercial Instinct under `/sell/` and `/api/sell/*`; it is not an edition and never enters `platform.json`.

No product may import another product's private presentation or business rules merely because they are visually similar.

## 5. Repository map

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Repository instructions automatically supplied to Codex. |
| `PLATFORM_ARCHITECTURE_DIRECTIVE.md` | Highest-priority preservation and isolation constitution. |
| `DEEP_CUTS_PRODUCTION_MANUAL.md` | Permanent operating, research, QR, analytics, deployment, and delivery rules. |
| `CLAUDE.md` | Agent execution rules and locked product variants. |
| `ROADMAP.md` | Completed work and ordered future automation work. |
| `README.md` | Concise platform overview and standard owner requests. |
| `INDIE_LABEL_MODEL.md` | Locked final independent-label wheel contract. |
| `edition-contracts.json` | Machine-readable product boundaries and immutable footer contract. |
| `platform.json` | Active edition registry, opaque IDs, config paths, analytics settings, and base URL. |
| `index.html`, `styles.css`, `js/` | Shared mobile discovery application. |
| `editions/` | Isolated edition configuration, questions, evidence, rosters, impact copy, and videos. |
| `assets/` | Shared and edition-specific static assets; approved Aggits files are immutable. |
| `scripts/` | Factory, validation, QR, build, delivery, batch, test, sync, and reporting automation. |
| `scripts/batch/` | Batch-controller helpers. |
| `scripts/record-company/` | Record Company build, research, delivery, and artifact tooling. |
| `worker/` | Cloudflare Worker routes, APIs, reports, research, analytics, and scheduled jobs. |
| `migrations/` | D1 schema migrations. |
| `record-company/` | Separate Record Company public application and executable schemas. |
| `record-company-output/` | Published Record Company delivery packages. |
| `sell/` | Isolated Commercial Instinct application and schemas. |
| `.github/workflows/` | CI, deployment, batch, Record Company, QR asset, and email-delivery workflows. |
| `data/incoming/` | Repository-hosted unattended batch CSV input. |
| `reports/` | Batch reports and exception records. |
| `build-records/` | Durable build timing/usage records. |
| `.deep-cuts/` | Transient local job/checkpoint state; never commit secrets or ephemeral state. |
| `.tools/python/` | Repo-local Python dependency target generated by the dependency helper. |
| `dist/` | Generated Cloudflare static bundle. |
| `output/` | Generated per-edition delivery assets. |

Generated paths may be absent in a clean clone until their build command is run. Never assume a generated file is canonical when its source config or script exists.

## 6. Dependencies

### JavaScript

`package.json` currently has one development dependency:

- `wrangler ^4.0.0`

The application itself intentionally avoids a heavy browser framework.

Install:

```bash
npm install --ignore-scripts --no-audit --no-fund
```

### Python

Pinned in `requirements.txt`:

- Pillow 12.3.0
- qrcode 8.2
- zxing-cpp 2.3.0
- openpyxl 3.1.5

Install into the repository's private tools location:

```bash
python3 scripts/ensure-python-deps.py
```

Or install into the active environment when needed:

```bash
python3 -m pip install -r requirements.txt
```

The build scripts use `DEEP_CUTS_PYTHON` when provided and otherwise use the available Python 3 interpreter. Do not copy Windows executable paths into the Mac configuration.

### External services

- GitHub and GitHub Actions.
- Cloudflare Workers.
- Cloudflare D1.
- Cloudflare Workers AI for the isolated research/decision-intelligence paths.
- Resend for delivery and scheduled report email.
- Direct HTTPS artist, label, YouTube, Spotify, Bandcamp, store, social, and official-site destinations.

## 7. Exact local commands

Run all commands from the repository root.

### Validate everything

```bash
npm run validate
```

This is the authoritative cross-edition JavaScript validation suite. It checks the registry, contracts, isolation, global footer, discovery engine, schools, Laneway, Indie Label model, Cool Death/Nastyboy wheels, analytics, reporting, Record Company, Worker, Commercial Instinct, secrets contract, factory, batch controller, and syntax.

CI additionally runs:

```bash
python3 scripts/test-record-company-deliverables.py
python3 scripts/generate-social-assets.py
```

### Build the complete Cloudflare bundle

```bash
npm run build
```

### Build one edition and its scan-tested assets

```bash
npm run build:edition -- <edition-slug>
```

Examples:

```bash
npm run build:edition -- laneway-music-one-off
npm run build:edition -- nastyboy-records
```

### Simple static preview

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open an edition through the legacy local selector:

```text
http://127.0.0.1:4173/index.html?edition=nastyboy-records
```

The static server does not emulate Worker APIs, D1, scheduled jobs, or real opaque-route routing.

### Full Worker preview

```bash
npm run cloudflare:dev
```

Use this when testing `/e/<editionId>`, `/q/<editionId>`, API routes, assets, or Worker behavior. Local bindings and remote service access may require a Wrangler login and appropriate local configuration.

### Commercial Instinct demo

```bash
npm run sales:demo
```

### Targeted tests

```bash
npm run test:tracking
npm run test:analytics
npm run test:worker
npm run record-company:test
npm run deepcuts:batch:test
```

### D1 migrations and manual Cloudflare operations

```bash
npm run cloudflare:migrate
npm run cloudflare:sync
npm run cloudflare:deploy
```

Normal production releases should flow through GitHub Actions rather than a manual Mac deployment.

## 8. Exact edition factory commands

The standard owner request is:

```text
Deep Cuts [Artist]
```

That instruction authorises the full normal factory workflow without routine intermediate approval.

Start the durable build clock before research:

```bash
node scripts/start-edition.mjs "Artist Name"
```

Research identity and every direct destination. Store the completed factory input outside the target edition directory, then create the isolated edition:

```bash
node scripts/create-edition.mjs /absolute/path/to/verified-input.json
```

Build and validate:

```bash
npm run build:edition -- <edition-slug>
npm run validate
```

Useful direct script aliases:

```bash
npm run factory:start -- "Artist Name"
npm run factory:create -- /absolute/path/to/verified-input.json
npm run delivery -- <edition-slug>
npm run publish -- <edition-slug>
```

Build tracking:

```bash
npm run build:start -- <edition-slug> --artist "Artist Name"
npm run build:usage -- <build-id> --file /absolute/path/to/usage.json
npm run build:complete -- <edition-slug> --url "https://live-url.example/" --commit <git-sha>
npm run build:fail -- <edition-slug> --reason "Failure reason"
```

Follow `.agents/skills/deep-cuts-factory/SKILL.md` exactly. A completed edition requires identity verification, validated links, configuration validation, QR scan-back, PR validation, production deployment, live verification, and confirmed delivery.

## 9. Exact unattended batch commands

The permanent batch entry point is:

```bash
npm run deepcuts:batch -- run --input <csv>
```

Typical commands:

```bash
npm run deepcuts:batch -- validate --input data/incoming/artists.csv
npm run deepcuts:batch -- test --input data/incoming/artists.csv
npm run deepcuts:batch -- run --input data/incoming/artists.csv
npm run deepcuts:batch -- status
npm run deepcuts:batch -- resume
npm run deepcuts:batch -- retry
npm run deepcuts:batch -- force --input data/incoming/artists.csv --artist "Artist Name"
```

Use the exact current CLI help before using less common options:

```bash
npm run deepcuts:batch -- --help
```

Rules:

- completed editions are skipped unless explicitly forced;
- transient failures are retried with bounded backoff;
- one failure is isolated and recorded without stopping the batch;
- publication remains fail-closed at 98% confidence;
- accepted artists use the shared engine and factory;
- rejected artists are recorded in `reports/REJECTED_ARTISTS.csv`;
- checkpoints and secrets never enter Git.

The GitHub workflow is `.github/workflows/deep-cuts-batch.yml`. It can be manually dispatched with a repository CSV path and mode, or triggered by a CSV pushed under `data/incoming/`.

## 10. Record Company Edition workflow

A Record Company Edition is started with one verified official company URL. It does not require per-artist approval.

Preferred production route:

1. Open GitHub Actions.
2. Run `Build Record Company Deep Cuts`.
3. Supply `record_company_url`.
4. Optionally supply an approved logo URL, notification email, or refresh flag.
5. Monitor the job through research, 98% gates, QR/report generation, validation, publication, and completion email.

Equivalent GitHub CLI dispatch:

```bash
gh workflow run record-company-build.yml \
  --ref main \
  -f record_company_url="https://official-label.example/"
```

Local entry point, mainly for engineering and controlled testing:

```bash
npm run record-company:start -- "https://official-label.example/"
```

Record Company output is isolated under `record-company-output/<company-slug>/`. Artists that fail the evidence gate are exceptions and must not enter published discovery, recommendations, or QR sheets.

## 11. Git and release workflow

Use a fresh branch from current `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c agent/<short-purpose>
```

Before committing:

```bash
git status -sb
git diff --check
npm run validate
npm run build
```

Commit only intended files:

```bash
git add <explicit-files>
git commit -m "Concise description"
git push -u origin HEAD
```

Open a pull request, wait for the validation checks, then merge only after the head SHA and all required checks are green. A merge to `main` triggers:

1. full validation;
2. Python delivery checks and asset generation;
3. D1 migrations;
4. Cloudflare deployment;
5. runtime secret installation;
6. edition registry synchronization;
7. `/api/health` and live smoke checks;
8. deployed QR verification;
9. delivery for newly detected editions;
10. Resend delivery confirmation where applicable.

Do not report success merely because a commit exists. Verify the production workflow and live URL.

## 12. GitHub Actions

| Workflow | Purpose |
| --- | --- |
| `.github/workflows/deep-cuts-ci.yml` | Complete cross-edition validation on PRs, `main`, and manual runs. |
| `.github/workflows/deploy-cloudflare.yml` | Validate, migrate, deploy, install secrets, sync, smoke-test, verify QR, and deliver new editions. |
| `.github/workflows/deep-cuts-delivery-assets.yml` | Generate and retain scan-tested edition assets. |
| `.github/workflows/verify-email-delivery.yml` | Manually send/verify one edition delivery. |
| `.github/workflows/deep-cuts-batch.yml` | Permanent unattended CSV batch controller. |
| `.github/workflows/record-company-build.yml` | One-URL unattended Record Company build and delivery. |
| `.github/workflows/record-company-delivery-recovery.yml` | Recover incomplete Record Company delivery. |

Validated GitHub Actions versions are Node 22 and Python 3.12.

## 13. Environment variables and secrets

Never put values in this file or commit a populated `.env`.

### Required GitHub production secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `DEEP_CUTS_ADMIN_TOKEN`
- `RESEND_API_KEY`
- `REPORT_RECIPIENT`
- `REPORT_FROM_EMAIL`

### Optional GitHub/Worker secrets

- `RESEND_WEBHOOK_SECRET`
- `SALES_RESEARCH_API_URL`
- `SALES_RESEARCH_API_KEY`

### GitHub repository variable

- `DEEP_CUTS_BASE_URL` — optional override; production defaults to the permanent workers.dev URL.

### Useful local/runtime overrides

- `DEEP_CUTS_API_URL`
- `DEEP_CUTS_ADMIN_TOKEN`
- `DEEP_CUTS_BASE_URL`
- `DEEP_CUTS_PYTHON`
- `DEEP_CUTS_NODE`
- `DEEP_CUTS_ROOT`
- `DEEP_CUTS_REPORTING_CURRENCY`
- `DEEP_CUTS_EMAIL_RECIPIENT`
- `DEEP_CUTS_DETAILED_USAGE_EMAIL`
- `DEEP_CUTS_LOG_FAILED_BUILDS`
- `DEEP_CUTS_PRICING_FILE`
- `DEEP_CUTS_AUD_EXCHANGE_RATE`
- `DEEP_CUTS_EXCHANGE_RATE_DATE`
- `DEEP_CUTS_EXCHANGE_RATE_SOURCE`
- `DEEP_CUTS_BUILD_ID`
- `DEEP_CUTS_QR_VERIFY_ATTEMPTS`
- `DEEP_CUTS_QR_VERIFY_DELAY_MS`
- `DEEP_CUTS_QR_DELIVERY_ATTEMPTS`
- `DEEP_CUTS_QR_DELIVERY_DELAY_MS`
- `RECORD_COMPANY_AI_MODEL`
- `RECORD_COMPANY_RESEARCH_PROVIDER`
- `RECORD_COMPANY_POLL_MS`
- `RECORD_COMPANY_TIMEOUT_MS`
- `SALES_AI_MODEL`

Templates are in `.env.example` and `.env.record-company.example`.

Wrangler writes authenticated machine state outside the repository. Log in again on the Mac:

```bash
npx wrangler login
npx wrangler whoami
```

GitHub-hosted production deployment does not require copying Cloudflare or Resend secrets to the Mac when the repository/environment secrets are already configured.

## 14. Analytics and reporting

Analytics is anonymous and privacy-conscious:

- central client event layer;
- versioned allow-list of scalar metadata;
- no accounts or fingerprinting;
- event IDs deduplicated in D1;
- edition, source, artist/destination, session, and timestamp attribution where applicable;
- reporting fails closed rather than silently truncating.

Core events include page/QR activity, destination clicks, and discovery interactions. The Laneway company wheel additionally measures spins, artist results, directory/search activity, winner video impressions, winner-versus-directory Spotify clicks, quiz progression/completion, and services-contact intent.

Important limitation: outbound clicks show intent. They do not prove that Spotify streamed a track, YouTube completed a view, or a store completed a purchase.

The Laneway reporting workflow sends, at 9:00 a.m. Australia/Sydney each Friday:

- a branded one-page A4 landscape PDF;
- a complete Excel workbook;
- the backward-compatible all-edition CSV.

The workbook includes all 35 verified Laneway artists, including zero-activity rows, plus wheel/directory attribution, quiz intelligence, audience/source summaries, raw event audit, and definitions.

## 15. Locked final Indie Label model

The final model is `indie_label/1`.

Reference edition:

- Laneway Music company wheel.
- Edition ID: `dc_b9e7b66620`.
- Live URL: `https://deep-cuts.andrewharris501.workers.dev/e/dc_b9e7b66620`.

Preserve:

- the restored wheel-led experience, not the rejected catalogue-discovery overhaul;
- equal-chance artist wheel;
- compact in-circle spinning spiral;
- winner destination button;
- sourced artist-impact sentence and one-shot attention flash;
- verified optional Buy Music/Buy Merch controls;
- conditional verified winner YouTube panel;
- searchable roster;
- delayed quiz invitation 10 seconds after the first completed result;
- ten-question positive, sourced catalogue quiz;
- contact/result experience;
- anonymous reporting;
- pale-teal decorative system with red reserved for the illuminated wheel pointer.

Future labels use isolated `indie_wheel` data. Change only the new label's verified logo, palette, roster, primary platform, destinations, descriptions, quiz, contact, and source-credit metadata. Never modify Laneway or Cool Death to manufacture a new label.

Completed label editions:

- Cool Death Records — `dc_b553e37627`
- Nastyboy Records — `dc_42e5242568`

## 16. Most recently completed work

### Global footer contract

The permanent footer rule was completed and deployed:

```text
Deep Cuts
Copyright Clearlight Creative
```

It now covers:

- every discovery edition;
- quiz and result states;
- unavailable/error states;
- Commercial Instinct;
- Record Company public screens;
- privacy and terms pages.

The contract is documented in the architecture/manual/agent instructions and enforced by `scripts/test-global-footer.mjs`, which is included in `npm run validate`.

Merged pull request:

- PR `#107`
- Merge commit `a5d20bb99cdca6545fe02feb430e1bdb2dfe1940`

All validation, delivery-assets, deployment, and Pages workflows passed for that release.

### Nastyboy Records Indie Wheel

Completed and deployed:

- Edition ID: `dc_42e5242568`
- Live: `https://deep-cuts.andrewharris501.workers.dev/e/dc_42e5242568`
- QR route: `https://deep-cuts.andrewharris501.workers.dev/q/dc_42e5242568`
- PR `#106`
- Merge commit `4f1254063a77fedb71d1531883706cbe1ad5dca8`

Verified roster:

- El Terricola
- Jay Roxxx
- MC Magic
- Nastyboy Klick
- NB Ridaz

Implementation includes the official black/gold identity, Spotify as the primary roster/winner destination, selectively verified purchase destinations, verified conditional videos, a ten-question quiz, and full isolation under `editions/nastyboy-records/`.

Relevant test:

- `scripts/test-nastyboy-indie-wheel.mjs`

### Laneway company wheel evolution

The locked production reference includes:

- 35 verified Laneway artists;
- mobile wheel and deterministic selection behavior;
- central accessible spinning spiral;
- pale-teal accents with the pointer as the only red focal marker;
- winner Spotify action;
- sourced impact description with brief attention reveal;
- conditional verified Buy Music/Buy Merch buttons;
- 28 verified, playable, privacy-enhanced winner videos, omitted for artists without safe evidence;
- searchable artist directory;
- ten-second, visibility-aware quiz invitation after the first completed result;
- ten-question catalogue quiz with positive correct/incorrect feedback, sources, score, return-home behavior, and subtle licensing/contact CTA;
- trusted D1 analytics and Friday PDF/XLSX/CSV reporting.

The later broad catalogue-discovery overhaul was explicitly rejected and reverted. Do not reintroduce Surprise Me, related-artist networks, reordered catalogue journeys, or other rejected scope into this reference unless Andrew explicitly requests it again.

### Other completed platform capabilities

- 32 active opaque-routed editions.
- One reusable engine with separately typed Music, Cars, Clubs, Schools, Business Recruitment, Laneway, Indie Wheel, Record Company, and Commercial Instinct contracts.
- Immutable Aggits artwork verification.
- Verified featured-video selection with privacy-enhanced YouTube embeds.
- Automatic omission/rebalancing of unavailable destinations.
- Permanent unattended CSV batch controller with retries, checkpoints, duplicate handling, 98% gates, reports, and GitHub handoff.
- One-URL Record Company Edition workflow with roster isolation, master QR/report package, D1 reporting, and completion email.
- Commercial Instinct decision-intelligence product and owner-controlled Banjo Strategy Brief handoff.

## 17. Current production and Git state

Production is live at:

```text
https://deep-cuts.andrewharris501.workers.dev
```

The current GitHub `main` source of truth includes the global footer release through merge commit:

```text
a5d20bb99cdca6545fe02feb430e1bdb2dfe1940
```

On the Mac, verify rather than assume:

```bash
git switch main
git pull --ff-only origin main
git log -5 --oneline --decorate
git status -sb
```

Expected latest history includes PR `#107` (global footer) after PR `#106` (Nastyboy Records).

Useful live checks:

```bash
curl -fsS https://deep-cuts.andrewharris501.workers.dev/api/health
curl -I -L https://deep-cuts.andrewharris501.workers.dev/e/dc_b9e7b66620
curl -I -L https://deep-cuts.andrewharris501.workers.dev/e/dc_42e5242568
```

## 18. Known limitations and unresolved work

These are deliberate known gaps, not permission to guess:

- Some social/follower platforms block reliable anonymous metadata. Provider-backed follower verification remains on the roadmap.
- Direct-destination discovery is not yet fully self-healing across artist-controlled link graphs.
- Evidence freshness is stored but not yet automatically rechecked before all stale editions are republished.
- Duplicate normalization exists, but more comprehensive artist identity-collision detection remains planned.
- Delivery latency and deployment duration trend reporting is not yet in the backward-compatible all-edition CSV.
- Automatic production rollback after a live QR/page verification failure remains planned.
- An edition with no identity-verified platform link or playable video intentionally omits that control.
- Analytics records outbound intent, not confirmed third-party consumption or purchases.
- Static local preview cannot reproduce Worker routing, D1, Workers AI, cron, or authenticated delivery behavior.
- The 98% research gate means some artists may be excluded from Record Company or batch output. Do not reduce the gate to increase apparent completion.
- The conversation may appear on the Mac if Codex account/thread synchronization supports it, but the repository, this handover, committed evidence, tests, and production logs are the authoritative continuity mechanism.

## 19. Recommended next steps

In priority order:

1. Complete the Mac bootstrap commands in section 1 and confirm `npm run validate` plus `npm run build` pass before changing code.
2. Confirm GitHub CLI, Wrangler, and production access without copying secrets into the repository.
3. Verify the three key live editions: Laneway company (`dc_b9e7b66620`), Cool Death (`dc_b553e37627`), and Nastyboy (`dc_42e5242568`).
4. Continue new artist work only through the permanent factory skill and new label work only through isolated `indie_wheel` configuration.
5. Implement the roadmap item with the highest production-time benefit: provider-backed verification or self-healing direct destinations, while preserving fail-closed evidence rules.
6. Add scheduled evidence-freshness checks and exception-only owner notification.
7. Add stronger duplicate identity-collision detection before research.
8. Add deployment/delivery duration trends to the existing report without breaking its CSV contract.
9. Add safe automatic rollback only after deployment and live QR/page verification behavior is fully tested.

Do not begin these roadmap items merely because they are listed. Each still requires the directive's impact assessment and tests.

## 20. New Codex session opening instruction

Paste this into the first Codex request on the Mac if the existing conversation is unavailable:

```text
Open this Deep Cuts repository and read AGENTS.md, PLATFORM_ARCHITECTURE_DIRECTIVE.md, DEEP_CUTS_PRODUCTION_MANUAL.md, CLAUDE.md, ROADMAP.md, .agents/skills/deep-cuts-factory/SKILL.md, and codex_handover.md completely before acting. GitHub main is the source of truth. Preserve every completed edition and the global Deep Cuts / Copyright Clearlight Creative footer. Run the baseline validation and build, report the current branch and production state, and do not change anything until I give the next product request.
```

## 21. Handover acceptance checklist

The Mac handover is successful when:

- the repository was cloned from GitHub;
- the Mac is on current `main`;
- Node 22-compatible tooling and Python 3.12 are available;
- JavaScript and Python dependencies are installed;
- `npm run validate` passes;
- `npm run build` passes;
- the live health endpoint responds;
- the Laneway, Cool Death, and Nastyboy URLs load;
- GitHub CLI is authenticated;
- Wrangler identity is available when local Worker work is required;
- no secrets were copied into tracked files;
- the new Codex session has read the mandatory architecture and factory documents;
- any future change starts with an edition-impact assessment.

This file should be updated whenever the platform architecture, commands, production workflow, locked product contracts, or current handover state materially changes.
