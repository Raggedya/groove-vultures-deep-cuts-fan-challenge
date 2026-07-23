# Deep Cuts

## Decision intelligence

The isolated mobile product **Commercial Instinct** is available at `/sell/`. It accepts the official URLs for **My Company** and **Target Company**, securely researches their public official pages, confirms the target identity and produces a layered, evidence-led briefing through individual Deep Cuts blue buttons, with private saving and PDF export. See [SALES_INTELLIGENCE.md](SALES_INTELLIGENCE.md) for setup, schemas, provider configuration, privacy rules and testing.

Validated reports can also produce an editable, two-minute **Banjo Strategy Brief** download for Andy's Lip Sync Engine. This optional handoff is isolated to `/sell/`, excludes the full evidence register and uses an explicitly consented owner recording in its first version.

All development is governed by `PLATFORM_ARCHITECTURE_DIRECTIVE.md`: completed editions are isolated commercial products, backward compatibility is mandatory, and new editions extend rather than modify existing products. `edition-contracts.json` and the CI isolation test enforce the current Music, Cars and Clubs boundaries.

Deep Cuts is one permanent artist-discovery platform. A fan scans an artist-specific QR and opens a calm page containing the artist's verified featured YouTube video and only the music, social, website, merchandise and editorial destinations that are genuinely available.

The same permanent engine also supports separately typed `Deep Cuts Cars` and `Deep Cuts Clubs` editions. Clubs present verified official information, membership, events, participation, venue, history, contact and relevant governing-body links. Music, Cars and Clubs keep independent locked definitions without duplicating the application.

## Standard owner request

`Deep Cuts [Band or Artist]`

`Deep Cuts Cars [Make and Model]`

`Deep Cuts Clubs [Club name and location]`

The production factory records the submission time, verifies the artist and destinations, creates configuration and promotional assets, validates the QR, deploys the edition and emails the finished package. It never creates another repository.

Public URLs use opaque IDs and never expose the artist name:

- `/q/<editionId>` records a QR visit and redirects.
- `/e/<editionId>` is the canonical artist page.

## Platform components

- Static mobile interface and edition configuration
- Cloudflare Worker routing and APIs
- Cloudflare D1 anonymous analytics and production timing
- GitHub validation and deployment workflows
- Automated Friday CSV report
- Automated completion delivery with QR PNG

## Validation

`npm run validate` checks the locked UI, approved Aggits hashes, edition routes, analytics, build tracking and Worker contract. `npm run build` creates the Cloudflare static bundle.

Secrets and account identifiers are configured once after the Cloudflare and email accounts are connected. They are never committed.
