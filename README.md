# Deep Cuts

## Deep Cuts Studio

The private desktop production interface can be opened with:

```powershell
npm run studio:desktop
```

Create a platform-specific installer with:

```powershell
npm run studio:make
```

See `DEEP_CUTS_STUDIO.md` for the local browser mode, project contract, verification boundary and packaging notes.

The private one-screen authoring workspace starts with `npm run studio` and opens at `http://127.0.0.1:4380/studio/`. Its JookBox Band workflow accepts a band name and preferably an artist-controlled URL, independently verifies identity, biography, direct platforms and the official featured video, and populates no more than eight keys only after the mandatory 98% gate passes. Name-only discovery is supported but fails closed when identity cannot be established. Business, Recruitment, Individual Band, Restaurants, Tourist Attractions and Towns retain their existing contracts, including the optional-wheel and artwork rules. Studio creates a live phone preview, local QR, 1080 × 1080 poster and factory handoff without directly altering or publishing an edition. See [DEEP_CUTS_STUDIO.md](DEEP_CUTS_STUDIO.md).

## Decision intelligence

The isolated mobile product **Commercial Instinct** is available at `/sell/`. It accepts the official URLs for **My Company** and **Target Company**, securely researches their public official pages, confirms the target identity and produces a layered, evidence-led briefing through individual Deep Cuts blue buttons, with private saving and PDF export. See [SALES_INTELLIGENCE.md](SALES_INTELLIGENCE.md) for setup, schemas, provider configuration, privacy rules and testing.

Validated reports can also produce an editable, two-minute **Banjo Strategy Brief** download for Andy's Lip Sync Engine. This optional handoff is isolated to `/sell/`, excludes the full evidence register and uses an explicitly consented owner recording in its first version.

All development is governed by `PLATFORM_ARCHITECTURE_DIRECTIVE.md`: completed editions are isolated commercial products, backward compatibility is mandatory, and new editions extend rather than modify existing products. `edition-contracts.json` and the CI isolation test enforce the current Music, JookBox, Cars, Clubs, Schools, Business Recruitment, Laneway and Indie Label boundaries.

Every public screen in every product and edition ends with the locked platform footer `Deep Cuts` above `Copyright Clearlight Creative`. Edition configuration cannot override it.

The final independent-label wheel model is locked as `indie_label/1`. Its reference is the restored Laneway Music company edition, while every future label supplies its own verified branding, roster, platform links and quiz through isolated `indie_wheel` configuration. See `INDIE_LABEL_MODEL.md`.

Deep Cuts is one permanent artist-discovery platform. A fan scans an artist-specific QR and opens a calm page containing the artist's verified featured YouTube video and only the music, social, website, merchandise and editorial destinations that are genuinely available.

The same permanent engine also supports separately typed `Deep Cuts Cars` and `Deep Cuts Clubs` editions. Clubs present verified official information, membership, events, participation, venue, history, contact and relevant governing-body links. Music, Cars and Clubs keep independent locked definitions without duplicating the application.

The isolated `business` product type supports verified recruitment experiences: company branding, an owner-approved Aggits asset, featured video, direct current job cards and a sourced ten-question “Learn About” quiz. High Grade Mechanical is the first locked Business Recruitment edition; Hays is the second and demonstrates reusable official-job-prefix validation and edition-owned logo treatments without changing HGM.

The isolated `jukebox` product type provides the reusable `jookbox/3` band model: no Aggits, quiz or spinning wheel; a four-state session-restored coin wake-up; a sourced and licensed local real coin-slot recording; restrained neon and screen activation; a verified YouTube feature with a browser-safe manual playback fallback; and only independently verified destinations. From 2026-07-31 onward, every new edition is required to use the permanent `atlas-reference-cabinet/1` visual and `six-key/1`; factory input cannot opt into the retired design. This is the SHA-256-locked 887 × 1774 black-walnut, chrome and neon cabinet first approved for ATLAS, with a broad upper biography ticker, left coin bay, video hero, six uniform keys, working `Support Our Band` / `Please share our JookBox` panel and `Copyright Clearlight Creative 2026.` status hardware. The top marquee automatically measures and fits each band name without clipping, using balanced multiple lines only when necessary. Four to six verified destinations are followed by Learn More and then Share only when gaps exist; one gentle light moves through all six keys in reading order. Filthy Animals remains the sole immutable legacy-cabinet composition.

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
- An isolated JookBox renderer with a privacy-enhanced video-first cabinet, a fixed verified destination set, an inline sourced biography control, reduced-motion lighting and no quiz, wheel, sticky navigation or Aggits

## Validation

`npm run validate` checks the locked UI, approved Aggits hashes, edition routes, analytics, build tracking and Worker contract through the bounded parallel validation runner. It prints live per-check timings; pass `-- --jobs <n> --profile <path.json>` to capture a machine-readable profile. `npm run build` creates the Cloudflare static bundle. `npm run build:artwork` validates once, renders every active edition with bounded parallelism, and then SHA-256-checks and scan-tests every QR at full and social-media size.

Secrets and account identifiers are configured once after the Cloudflare and email accounts are connected. They are never committed.
