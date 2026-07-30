# Deep Cuts acquisition hardening — Phase 0

This document is the operational handover for the first acquisition-hardening release. It does not change edition content, public edition IDs, routes, locked visual models, Aggits assets, or the production data model beyond the aggregate quota table described below.

## What changed

- `scripts/build-cloudflare.mjs` now creates a fail-closed public bundle from an exact runtime allowlist.
- Active edition configurations and their explicitly referenced local assets are included.
- Only the approved public QR and discovery images are included from `output/`.
- Research files, delivery manifests, record-company export packages, reports, checkpoints, Studio, scripts, Worker source, migrations, repository metadata, and future unlisted files are excluded.
- The Worker returns `404` before the asset binding can serve known internal paths.
- A consistent security-header baseline wraps static pages, editions, sales, record-company pages, APIs, redirects, and errors.
- `/api/events` now has bounded JSON parsing, a strict schema, active-edition checks, typed metadata, timestamp and identifier checks, discovery-source validation, native rate limiting, and production/non-production classification.
- Public sales/research operations now have strict per-route body schemas and size limits, general and operation-specific native rate limits, a per-isolate concurrent-request guard, bounded provider/crawl responses, timeouts, safer public-URL validation, redirect limits, and a database-backed daily cost ceiling.

## Public files deliberately retained

- The root discovery application, styles, analytics interface, and browser JavaScript.
- `platform.json`.
- Every active edition's `edition.json`.
- Local question, roster, impact, video, logo, image, and audio files referenced by active edition data or the approved public interfaces.
- The public `sell/` interface.
- The public `record-company/` interface and legal pages.
- `output/<edition>/instagram-qr.png` and `output/<edition>/instagram-discovery.png` when present.

The build fails if an approved runtime file is missing or an edition attempts to reference a forbidden private file.

## Internal files excluded

- Every `research.json`.
- All of `record-company-output/`.
- Delivery and build-export manifests.
- CSV, spreadsheet, ZIP, SQL, and SQLite artifacts.
- Batch checkpoints, incoming data, reports, Studio source, scripts, Worker source, migrations, hidden repository directories, and unlisted future files.

## Required Cloudflare configuration

`wrangler.jsonc` defines three native rate-limit bindings:

- `ANALYTICS_RATE_LIMITER`: 120 requests per client per minute.
- `SALES_RATE_LIMITER`: 30 requests per client per minute.
- `SALES_RESEARCH_RATE_LIMITER`: 4 cost-bearing operations per client per minute.

It also defines:

- `SALES_DAILY_REQUEST_LIMIT=100`: aggregate daily cost-bearing research operations. Adjust this non-secret value only after reviewing provider capacity and expected usage.
- `PRODUCTION_HOST=deep-cuts.andrewharris501.workers.dev`: classifies analytics as production or non-production.

The keyed client hash is used only inside Cloudflare's limiter and the short-lived in-memory concurrency set. Deep Cuts does not write raw IP addresses or the rate-limit key to D1.

Migration `0004_security_hardening.sql` is genuinely required for the aggregate daily ceiling. It stores only date, usage type, aggregate request count, and update time. It stores no visitor identifier.

## Pre-deployment review

1. Review the pull-request diff and confirm that `platform.json`, all active edition configurations, locked asset hashes, and public edition IDs are unchanged.
2. Run the full validation suite and production build.
3. Inspect `dist/` and confirm there is no `research.json`, `record-company-output/`, delivery manifest, private report, checkpoint, spreadsheet, ZIP, Studio file, Worker source, or migration.
4. Review the current deployed copies of potentially exposed paths. Treat any personal contact information, private report, token, credential, or unpublished commercial information found there as exposed.
5. Search Git history and current build/export files for credentials. Rotate a credential only if the review finds that it was committed or publicly served. Do not rotate blindly.
6. Confirm the three Cloudflare rate-limit namespaces do not conflict with another Worker in the same account.

## Deployment sequence

1. Merge the reviewed pull request through the protected main-branch process.
2. Let the existing deployment workflow install dependencies and run the complete validation suite.
3. Apply D1 migrations, including `0004_security_hardening.sql`, before the new Worker begins serving sales/research requests.
4. Build the allowlisted `dist/` bundle.
5. Deploy the Worker and static assets.
6. Run the existing edition sync and smoke checks.
7. Confirm the production health endpoint and representative edition routes.
8. Confirm valid analytics ingestion and a valid, deliberately limited sales demonstration request.

Do not manually upload the repository, `editions/`, `output/`, or `record-company-output/` as static directories.

## Cache removal after deployment

Previously served internal artifacts may remain in edge or browser caches even after they disappear from the new bundle.

1. In Cloudflare, purge cached URLs for all known leaked files.
2. Purge by prefix for `/record-company-output/` and all known private `/output/` and `/editions/*/research.json` paths if the account supports prefix purging.
3. If complete coverage cannot be proven, use a one-time full-zone cache purge during a quiet period.
4. Re-request every known private path without browser cache and confirm `404`.
5. Confirm the Worker path guard returns `404` even when a stale static object would otherwise exist.

## Post-deployment verification

Verify at minimum:

- Root, representative edition, JookBox, wheel, quiz, business, school, sales, and record-company pages render.
- Existing opaque edition URLs and QR redirects still work.
- YouTube embeds remain permitted by the CSP.
- Required question, roster, image, logo, audio, QR, and discovery assets return successfully.
- Internal paths return `404`.
- Main, edition, sales, record-company, API, redirect, and error responses include the security baseline.
- Valid analytics events are accepted; unknown editions, malformed events, unsupported fields, and excessive traffic are rejected.
- Sales research rejects unsafe URLs and excessive/repeated requests without exposing provider details.

## Safe rollback

Do not redeploy the entire pre-hardening revision: its broad static-copy behaviour can re-expose internal artifacts.

If a compatibility issue appears:

1. Keep the new public allowlist and Worker path guard in place.
2. Create a hotfix that reverts only the incompatible API validation, rate, or header rule.
3. Keep migration `0004` applied; it is additive and safe to leave unused.
4. Deploy the hotfix through the same validation workflow.
5. Re-run private-path and edition smoke tests.

If Cloudflare rate-limit bindings cause the issue, adjust their numeric limits or temporarily disable only the affected public research operation. Do not remove static containment.

## Remaining Phase 1 risks

- Public analytics can be made abuse-resistant, not fraud-proof.
- Cloudflare's native rate limiting is distributed and intentionally approximate.
- The in-memory concurrency guard prevents duplicate work within an isolate; a Durable Object would be needed for a globally serialised lock.
- Hostname validation blocks private, local, numeric, IPv6, credential-bearing, cross-host redirect, and common metadata destinations. DNS rebinding remains dependent on Cloudflare's network-egress protections; a dedicated outbound proxy would provide stronger central control.
- CSP still permits inline styles because the existing interfaces use them. Moving to nonce- or hash-based styles is a later compatibility project.
- Record-company analytics has a separate ingestion path and should receive the same typed-contract treatment in Phase 1.
- Administrator access still relies on a single bearer secret.
- Release approvals, branch protection, dependency scanning, alerting, retention policy, backup/restore evidence, and software-bill-of-materials automation remain Phase 1 acquisition work.
