# Deep Cuts — Record Company Edition

## Purpose

The Record Company Edition turns one official record-company website into a contained discovery collection: one company home page, one positive five-question company quiz, verified artist pages, five-question artist quizzes, fair discovery navigation, stable QR routes, a scan-tested Ultra HD QR collection, reporting exports and a completion email.

It is registered as the isolated `record_company` contract. It does not enter the standard artist-edition registry and it does not modify Music, Cars, Clubs, Schools, Laneway or Commercial Instinct.

## Architecture

- `record-company/` — mobile-first public renderer, quiz and discovery navigation.
- `worker/record-company.js` — protected job API, official-site ingestion, checkpointed processing, public data API, QR redirects, analytics and reporting.
- `migrations/0003_record_company.sql` — logically isolated D1 tables using the `record_company_` prefix.
- `scripts/record-company/` — one-input launcher, QR/report generation and completion delivery.
- `.github/workflows/record-company-build.yml` — unattended production controller.
- `record-company-output/<company-slug>/` — generated, validated delivery package.

The Worker stores source evidence, job progress, exceptions and publication state. GitHub Actions supplies a restart-safe long-running controller, generates lossless QR/report files, opens and merges a validated generated-assets pull request, and sends the completion email through the existing Resend account.

## Input

Required:

```json
{"recordCompanyUrl":"https://official-label.example"}
```

Optional:

- `recordCompanyLogo` — an approved public HTTPS asset.
- `notificationEmail`.
- `projectName`.
- `refreshExisting`.
- `preferredDeploymentTarget`.
- `analyticsEnabled`.
- `sendCompletionEmail`.

## Starting a build

The normal non-technical production entry point is the GitHub Actions workflow **Build Record Company Deep Cuts**. Enter the official website URL and select **Run workflow**. Codex can trigger the same workflow for the owner, eliminating GitHub interaction.

Command-line equivalent:

```powershell
gh workflow run record-company-build.yml -R Raggedya/groove-vultures-deep-cuts-fan-challenge -f record_company_url=https://official-label.example
```

No artist-by-artist approval is requested. A failure is recorded and isolated; remaining artists continue.

## Job stages and recovery

Jobs persist in D1 and move through:

`queued → validating → discovering_company → discovering_roster → researching_artists → generating_quizzes → generating_pages → generating_qr_codes → validating_output → generating_reports → ready_for_delivery → generating_master_qr_image → sending_completion_email → completed`

Each status poll advances one bounded slice and the hourly Worker schedule resumes interrupted jobs. A short D1 lease prevents duplicate workers. Existing entity IDs, routes and QR tracking codes are upserted, so safe retries do not duplicate pages.

## Roster discovery

The crawler:

1. validates a public HTTPS URL and blocks local/private targets;
2. stays on the canonical official domain;
3. reads roster, artist, band, act or talent navigation;
4. follows accessible pagination-like internal roster links;
5. excludes obvious staff, news, release, store and utility entries;
6. deduplicates identities;
7. stores the discovery source for every candidate.

No login, paywall, anti-bot or access control is bypassed. If the roster is unavailable, the job fails honestly with attempted locations recorded.

## Confidence and evidence

Publication is fail-closed. Every artist must:

- originate on the official company roster;
- retain at least `0.98` identity confidence;
- have verified direct links explicitly connected from the official profile;
- have exactly five sourced questions at `0.98` confidence or higher;
- avoid unresolved name collisions.

Skipped artists remain in the exception report and never enter random discovery or QR output.

## Research and quizzes

The production Worker uses its configured Workers AI binding through a strict JSON adapter. The model receives official source text only and may not supplement gaps from memory. Each question stores its source URL, evidence summary, answer, explanation and confidence.

`RECORD_COMPANY_AI_MODEL` may override the default Workers AI model. A future provider can implement the same structured adapter without changing the edition.

## QR production

Every company and published artist receives a stable route:

- `/record-company/q/<tracking-code>` — analytics redirect.
- `/record-company/<company-slug>` — company page.
- `/record-company/<company-slug>/artists/<artist-slug>` — artist page.

The Python delivery generator creates PNG and SVG QR files with high error correction and a four-module quiet zone. Every individual QR is decoded. Every QR crop inside the master image is decoded again. A mismatch blocks delivery.

The master PNG is at least 3840 pixels wide, lossless, company-first, then artists alphabetically. Large rosters expand the canvas rather than shrinking codes below the scan-safe cell size.

## Reporting

D1 is the source of truth. The retained delivery package includes:

- summary CSV;
- artist build status CSV;
- exceptions CSV;
- link and source CSVs;
- QR JSON/CSV manifest;
- Excel-compatible XLSX workbook;
- ZIP reporting bundle.

Ongoing privacy-conscious analytics can be exported from:

`GET /api/record-company/reports/<company-slug>?format=csv`

with the administration bearer token.

Tracked events include company/artist views, random discovery, recommendations, home returns, outbound clicks, quiz starts/responses/completions/replays and QR scans. Raw IP addresses and invasive fingerprints are never stored.

## Link health

The hourly Worker checks one stale destination at a bounded rate and records HTTP status, redirect destination, last check and broken state. Analytics and link-health failures never interrupt public navigation.

## Email delivery

The existing Resend variables are reused:

- `RESEND_API_KEY`
- `REPORT_RECIPIENT`
- `REPORT_FROM_EMAIL`
- `DEEP_CUTS_ADMIN_TOKEN`

The completion email includes status, totals, live collection link and exceptions. It attaches the Ultra HD master QR PNG, XLSX report and reporting ZIP. Provider message ID and delivery state are recorded.

## Testing

`npm run record-company:test` validates URL safety, canonical domains, fixture roster discovery, duplicates, confidence rejection, direct links, five-question schemas, discovery rules, no-character isolation, routes, migrations, QR scan-back code, Ultra HD layout and unattended workflow.

`npm run validate` also runs every existing edition regression test.

## Legal and privacy

Only accessible public information is used. Source dates and confidence remain auditable. The edition does not imply label endorsement. Marks are used only where official and technically appropriate. No private data, guessed contact details, credentials or raw IP addresses are stored.
