# Deep Cuts

## Decision intelligence

The isolated mobile product **Commercial Instinct** is available at `/sell/`. It accepts the official URLs for **My Company** and **Target Company**, securely researches their public official pages, confirms the target identity and produces a layered, evidence-led briefing through individual Deep Cuts blue buttons, with private saving and PDF export. See [SALES_INTELLIGENCE.md](SALES_INTELLIGENCE.md) for setup, schemas, provider configuration, privacy rules and testing.

Validated reports can also produce an editable, two-minute **Banjo Strategy Brief** download for Andy's Lip Sync Engine. This optional handoff is isolated to `/sell/`, excludes the full evidence register and uses an explicitly consented owner recording in its first version.

All development is governed by `PLATFORM_ARCHITECTURE_DIRECTIVE.md`: completed editions are isolated commercial products, backward compatibility is mandatory, and new editions extend rather than modify existing products. `edition-contracts.json` and the CI isolation test enforce the current Music, JookBox, Cars, Clubs, Schools, Business Recruitment, Laneway and Indie Label boundaries.

Every public screen in every product and edition ends with the locked platform footer `Deep Cuts` above `Copyright Clearlight Creative`. Edition configuration cannot override it.

The final independent-label wheel model is locked as `indie_label/1`. Its reference is the restored Laneway Music company edition, while every future label supplies its own verified branding, roster, platform links and quiz through isolated `indie_wheel` configuration. See `INDIE_LABEL_MODEL.md`.

Deep Cuts is one permanent artist-discovery platform. A fan scans an artist-specific QR and opens a calm page containing the artist's verified featured YouTube video and only the music, social, website, merchandise and editorial destinations that are genuinely available.

The same permanent engine also supports separately typed `Deep Cuts Cars` and `Deep Cuts Clubs` editions. Clubs present verified official information, membership, events, participation, venue, history, contact and relevant governing-body links. Music, Cars and Clubs keep independent locked definitions without duplicating the application.

The isolated `business` product type supports verified recruitment experiences: company branding, an owner-approved Aggits asset, featured video, direct current job cards and a sourced ten-question “Learn About” quiz. High Grade Mechanical is the first locked Business Recruitment edition; Hays is the second and demonstrates reusable official-job-prefix validation and edition-owned logo treatments without changing HGM.

The isolated `jukebox` product type provides the reusable `jookbox/2` band model: no Aggits, quiz or spinning wheel; a push-coin, sound-and-light start; user-initiated playback of the verified featured YouTube video; self-balancing physical keys generated from a dated, verified Linktree snapshot; and a sourced Learn More biography screen. Filthy Animals is the first completed JookBox edition.

## Standard owner request

`Deep Cuts [Band or Artist]`

`Deep Cuts Cars [Make and Model]`

`Deep Cuts Clubs [Club name and location]`

`Laneway [Band or Artist]`

`JookBox [Band]`

Laneway is a separate charcoal-and-white music edition using the approved Laneway Music logo, no Aggits, and exactly five positive sourced questions about the nominated artist. It does not change the standard Deep Cuts music model.

The production factory records the submission time, verifies the artist and destinations, creates configuration and promotional assets, validates the QR, deploys the edition and emails the finished package. It never creates another repository.

Public URLs use opaque IDs and never expose the artist name:

- `/q/<editionId>` records a QR visit and redirects.
- `/e/<editionId>` is the canonical artist page.

## Platform components

- Static mobile interface and edition configuration
- Cloudflare Worker routing and APIs
- Cloudflare D1 anonymous analytics and production timing
- GitHub validation and deployment workflows
- Automated Friday client report with a one-page branded PDF, auditable Excel workbook and backward-compatible all-edition CSV
- Automated completion delivery with QR PNG
- Laneway company-wheel winner summaries with a one-shot attention flash and independently omitted, verified Buy Music / Buy Merch destinations
- A spectacular pale-blue Laneway quiz invitation 10 seconds after the first completed wheel result, plus accessible light-blue heartbeats for verified winner purchase buttons
- A compact generated spiral inside the standalone Laneway wheel control while it spins, returning to `Spin` after every result
- A conditional privacy-enhanced winner video beneath the selected artist details, sourced from a central verified map and omitted when unavailable
- A cohesive pale-teal Laneway reference palette with red reserved for the illuminated wheel pointer
- A fail-closed final Indie Label model contract that protects the restored experience from feature creep
- An isolated Business Recruitment renderer with verified direct vacancy cards and a positive sourced 10-question company quiz
- An isolated JookBox renderer with a privacy-enhanced featured-video cabinet, verified selection-key destinations, reduced-motion lighting and no quiz, wheel or Aggits

## Validation

`npm run validate` checks the locked UI, approved Aggits hashes, edition routes, analytics, build tracking and Worker contract. `npm run build` creates the Cloudflare static bundle.

Secrets and account identifiers are configured once after the Cloudflare and email accounts are connected. They are never committed.
