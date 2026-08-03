# Platform Architecture Directive — Edition Protection and Isolation

**Status: permanent, governing and non-negotiable.**

Deep Cuts is one platform supporting multiple independent commercial product editions, including Bands, Artists, Businesses, Cafés, Restaurants, Classic Cars, Car Clubs, Bowls Clubs, Sporting Clubs, Museums and future editions.

Unless the owner explicitly overrides this directive in writing, preserving every completed edition takes priority over implementing a new feature.

## Core principles

1. **Every edition is an independent product.** Each edition has its own layouts, prompts, workflows, UI, data sources, branding, content rules, navigation, buttons, categories, analytics configuration and business logic. A change to one edition must never alter another edition.
2. **Backward compatibility is mandatory.** Every enhancement must preserve all previously completed editions unless the owner explicitly authorises a change to a named edition. Existing functionality must never be degraded, removed or unintentionally modified.
3. **Edition isolation is mandatory.** Edition-specific assets, prompts, templates, configuration, styling, images and business rules must remain isolated. No edition may depend directly on another edition.
4. **Only genuinely reusable services belong in the Core Engine.** Core services include page rendering, responsive foundations, QR generation, analytics, caching, search, safe external-link handling, API integrations, AI summarisation, logging, performance, security, error handling, the UI framework and reusable components. Core improvements may benefit all editions, but must not change an edition's unique behaviour.
5. **Edition-specific functionality stays with its edition.** It must not move into the Core Engine unless it is demonstrably reusable across multiple editions and preserves all existing outputs.
6. **Every change requires an impact assessment.** Before implementation, determine whether it could affect another edition, an existing UI, prompts, workflows, business logic or production output. If yes, do not proceed without explicit owner authority.
7. **Future editions plug in as separate modules.** Extend the platform framework; never modify an existing edition to make room for a new one.
8. **Never overwrite an existing edition.** Extend the platform instead.
9. **Preserve visual identity.** Each edition retains its appearance, navigation, button arrangement, content strategy and overall experience.
10. **Protect production reliability.** Optimisation must increase automation, speed, scalability or maintainability while producing identical outputs for existing editions.
11. **Treat the platform as a long-term commercial product.** Favour scalability, maintainability, modularity, reliability, performance, backward compatibility, easy addition of new editions, minimal manual effort and maximum safe automation.
12. **Preservation is the default.** Ambiguous changes must be resolved in favour of leaving completed editions unchanged.

## Global footer contract

- Every public Deep Cuts product, version, edition, quiz, result, error and legal screen ends with the same two-line platform footer.
- The first line is exactly `Deep Cuts`.
- The second line is exactly `Copyright Clearlight Creative`.
- The footer is a Core Engine invariant. Edition configuration may not rename, replace, suppress or claim ownership of it.
- Edition-specific identity, copyright evidence and source credits remain available in their own configuration and delivery metadata, but they never replace this live platform footer.

## Mandatory change protocol

Every pull request must:

1. Name the edition or Core Engine surface being changed.
2. State which completed editions could be affected.
3. Confirm that layouts, prompts, workflows, navigation, buttons, analytics and business rules for all other editions remain unchanged.
4. Add or update edition-specific tests where behaviour changes.
5. Run the full cross-edition validation suite.
6. Fail closed if isolation or backward compatibility cannot be demonstrated.

## Permanent rule

Treat every completed edition as a finished commercial product that must remain stable forever. Future work extends the platform; it does not modify, replace or compromise existing editions. This directive applies to every future development task unless the owner explicitly overrides it in writing.

## School Discovery contract

- School Discovery is an independent edition and never inherits Music, Cars or Clubs presentation rules.
- Aggits is completely absent from the School Discovery page and every School Discovery delivery asset.
- A featured, identity-verified YouTube video is mandatory.
- The colour scheme is derived from the current official school website and recorded with dated evidence.
- The school logo, crest or emblem is never copied or displayed. Only verified website colour values inform the palette.
- QR artwork uses the heading `Discover Our School` and the edition-specific school name.
- School Discovery alone includes a six-question positive school challenge. Music, Cars and Clubs remain discovery-only and must not inherit any quiz interface or logic.
- The challenge CTA is placed immediately before the School Upgrade destination. It reads `How Well Do You Know Our School?` and `Take the Challenge` and uses the edition's verified school accent colour.
- Each question has four choices, a 15-second countdown, a time-up bell at zero, a ten-second positive fact explanation and a verified authoritative source. Exactly six questions are required.
- Results use encouraging, non-punitive ratings. The challenge always provides an explicit School Home control, and browser Back also restores the school discovery page without requiring another QR scan.

## Business Recruitment contract

- `business` is an isolated recruitment and company-discovery product. It never changes Music, Cars, Clubs, Schools, Laneway or Indie Label output.
- The business logo, palette, character artwork, current job destinations, featured video and quiz belong only to that edition and require dated source evidence or explicit owner approval.
- Job cards open direct current vacancy pages. Search results, generic recruitment listings and guessed roles are forbidden.
- Each Business edition declares the direct official vacancy URL prefix for its employer. Validation requires every job card to remain beneath that prefix and to have matching dated evidence.
- Business editions contain exactly ten positive, factual, sourced questions and always return to the job directory after the quiz.
- High Grade Mechanical `dc_4a71b2c8e9` alone uses `assets/hgm-aggits-owner-supplied.jpg`. Its SHA-256 identity is fail-closed; it must never be replaced by another Aggits version.
- Hays `dc_3481f25897` uses the standard immutable Aggits artwork and a separate official Hays brand asset. Its owner-selected HGM video is demo material only and must always be labelled so no official Hays association is implied.

## JookBox contract

- `jukebox` is an isolated band-discovery product. It never changes Music, Cars, Clubs, Schools, Business Recruitment, Laneway or Indie Label output.
- The reusable model name and version are exactly `JookBox` and `jookbox/3`. Filthy Animals `dc_a3c049e4bc` remains an immutable completed legacy composition and its supplied 762 × 1280 cabinet artwork is protected by SHA-256.
- From 2026-07-31 onward, the owner-approved `atlas-reference-cabinet/1` is mandatory for every new JookBox and cannot be overridden by factory input. It is a SHA-256-locked 887 × 1774 photoreal black-walnut, chrome and neon cabinet with a live marquee, hero biography ticker, left coin mechanism, privacy-enhanced YouTube screen, three-by-two key bank, prominent `Support Our Band` share action and lower status hardware. This shared core asset is never copied from or made dependent on another edition. Filthy Animals is the sole permitted legacy-cabinet exception.
- The cabinet has the explicit states `sleeping`, `acceptingCoin`, `poweringUp` and `awake`. One accessible coin control plays the locally stored, sourced and licensed real coin-slot recording at full audible level after direct interaction, runs the restrained neon and CRT start-up sequence and stores only the awake flag in edition-specific `sessionStorage`. Every Band, Bar, Aggits and Studio renderer must use the shared coin-audio engine: pre-decoded Web Audio after the direct gesture with HTML audio as the cross-browser fallback. Electronic synthesis, silent failure handlers and renderer-specific substitute sounds are forbidden. Refresh restores the awake state without replaying the sound or start-up.
- The artist-controlled source remains a dated, verified build-time research snapshot. New factory editions expose four to six verified snapshot entries through an explicit ordered `displaySelectionIds` list; sources are never scraped at runtime and unverified entries cannot render. Filthy Animals permanently retains its eight owner-approved legacy ticket, newsletter and YouTube keys.
- `six-key/1` is the permanent new-edition JookBox key-bank contract. It always renders six uniform physical positions in a three-by-two grid and requires four to six verified external destinations. External destinations retain their configured order. If fewer than six are available, `Learn More` fills the first gap and `Share` fills the next; production fails closed below four verified external destinations. The six keys illuminate gently one at a time in reading order: top-left, top-centre, top-right, bottom-left, bottom-centre, bottom-right, then repeat. The exact ATLAS-approved key shape, typography, spacing, colours, borders, dimensions and resting/active appearance are immutable and shared by every new edition using this appearance.
- The live band marquee measures its rendered text after fonts load and whenever its cabinet resizes. Names that fit retain the approved ATLAS size; longer names are progressively reduced and, only when necessary, balanced across multiple lines inside the same top display. A future band name must never overflow, clip or replace the locked cabinet composition.
- The embedded featured video supplies its own real playback controls and requests playback synchronously within the direct coin interaction, without a post-coin delay. Browser autoplay policy may still block audible playback, so the standard YouTube play control always remains visible as the reliable manual fallback; restored sessions do not replay or request autoplay.
- Every verified external JookBox destination is classified by the Core Engine against the current origin, opens with `target="_blank"` and `rel="noopener noreferrer"`, and leaves the live cabinet untouched in its original tab. Same-origin and relative links retain their existing navigation behaviour.
- The biography ticker is configuration-driven, large, bright amber, clipped inside the broad upper cabinet display and moves right-to-left in natural reading order only after start-up. Before the coin interaction, all selection keys remain visibly dimmed, unfocusable and unavailable; after activation they illuminate gently one at a time in sequence and become usable only when the cabinet reaches `awake`. Both animations pause in hidden tabs; reduced-motion users receive a simplified screen fade, static biography and gentle non-flashing controls.
- The permanent six-key cabinet uses a working `Support Our Band` / `Please share our JookBox` panel with a heart and small share icon. Its lower status hardware reads `Copyright Clearlight Creative 2026.` without replacing or changing the immutable global footer. Learn More and Share fill only genuine key-bank gaps and suppress only duplicate standalone utilities.
- JookBox never displays Aggits, a quiz or a spinning wheel.
- Owner override dated 2026-08-03: new Band JookBox delivery packages use the SHA-256-locked 1254 x 1254 character QR poster (`aggits-character-poster/1`). This exception applies only to the emailed/downloadable QR poster; Aggits remains absent from the live Band JookBox page, its discovery artwork and its interaction model. The permanent opaque HTTPS route, fitted band title, centred high-contrast matrix, four-module quiet zone and full-size, 627-pixel and 360-pixel scan-back are fail-closed publication requirements. Existing completed delivery artwork remains unchanged unless separately republished by the owner.
- The featured video is the most-viewed embeddable official video visible through the artist-controlled YouTube channel at verification time.
- Only dated, identity-verified destinations named by the edition's explicit display-key list may appear. Missing or stale destinations are omitted.
- Its bright lights become static when reduced motion is requested and stop spending attention in hidden tabs.
- Filthy Animals `dc_a3c049e4bc` is the first completed JookBox edition. Its configuration and evidence remain isolated from every future band.

## Bar Edition JookBox contract

- `bar_jukebox` is an isolated static venue product on the shared engine. It must never change, import from or weaken the locked Band Edition `jukebox` contract.
- Its model is `bar-jukebox/1`, appearance is `atlas-reference-cabinet/1`, and key bank is `bar-six-key/1`.
- The owner-approved Bar presentation is the SHA-256-locked `jookbox-bar-heritage-brass-v1.png`: a full-height, well-used mahogany and aged-brass cabinet with a fitted arched venue name, broad single-line amber ticker, left coin mechanism, large welcome-video screen, six parchment/brass destination keys, one wide venue-share plate and a bottom brass `Copyright Clearlight Creative 2026.` plate. The legacy appearance identifier remains in stored Bar records for backward compatibility; the Bar-only renderer applies this surface and must never restyle Band Edition.
- Its cabinet marquee shows only the fitted venue name and `JOOKBOX` tagline in a compact lower arch position immediately above the ticker; `BAR EDITION` never appears inside the cabinet.
- The venue administrator supplies the venue name, fallback ticker, About Us copy, local MP4 and exactly five labelled HTTPS destinations. `About Us` is the permanent internal sixth key. The private Venue Library reads the configured official Gigs destination during publication, extracts only supported structured upcoming-event facts and persists the resulting static ticker; the approved fallback remains when no supported events are available. No public-runtime lookup, inference or scraping is permitted.
- The support strip below the six keys is the sole working Share control, visibly labelled exactly `SHARE`; it remains locked until the coin wakes the cabinet and shares the canonical public edition URL.
- The drag/click/keyboard coin interaction, shared dual-path real coin audio, four-state session model, neon/CRT start-up, title fitting and reduced-motion behavior reuse the shared JookBox engine. Bar Edition uses a locked six-stage single-key incandescent sequence in reading order. Illumination is clipped inside each parchment face and may not cast a square or bloom outside its bronze frame. The yellow coin may pulse only while the Bar Edition cabinet is sleeping; once activation begins it inserts and disappears, and it never pulses or glows in an awake or session-restored cabinet. The MP4 playback request occurs synchronously inside the coin gesture and retains native controls when browser autoplay is blocked.
- Bar Edition has no Aggits, YouTube, quiz or spinning wheel. Its five external destinations use the shared secure external-tab policy. Its cabinet and global Clearlight copyright treatments are immutable.
- The private Studio must never issue a scannable QR for its ephemeral `127.0.0.1` preview. It displays a publication-pending panel instead. A permanent QR is generated and scan-tested only after deployment supplies the canonical public HTTPS edition URL.
- ATLAS `dc_e22f1cb651` remains the first completed visual reference for `atlas-reference-cabinet/1`; Southern Culture on the Skids `dc_f3f4750b1b` is the first factory edition corrected to the permanent default. Both own their band data and evidence independently. Promoting this shared appearance never changes Filthy Animals or any other completed edition.

## Aggits four-button Jukebox contract

- `aggits_jukebox` is a separate Studio product using model `Aggits Jukebox` and version `aggits-jukebox/1`. It never changes, imports from or weakens either the locked Band Edition `jukebox` contract or the locked `bar_jukebox` contract.
- The owner-supplied `AGGITS_JUKEBOX.jpeg` cabinet and `AGGITS_ICONS.jpeg` sheet are immutable visual masters. Their stored SHA-256 identities are fail-closed, and all 110 selectable action icons are deterministic crops from the locked icon master.
- Each edition stores one fitted title, one ticker message, one local MP4 and four ordered action slots. Each action stores enabled state, approved icon ID, display label, action type, raw administrator value, normalized destination and external-tab preference. Public action keys render only the approved icon at a slightly reduced scale; stored labels remain available for Studio and accessible names but never appear beneath the icon. Missing or disabled actions remain inert.
- One accessible coin control presents as an opaque, polished round gold coin, plays the established local real coin-slot recording through the shared dual-path audio engine after direct interaction, requests local video playback within that same gesture and prevents overlapping activation. After approximately 2.6 seconds, enabled action keys become usable together in one restrained static state. Aggits Jukebox action keys never pulse, sequence, glow or cast lighting outside their physical faces.
- The video opening is exactly `7:8`; normal media is exported at `1120 × 1280` and high-resolution media at `1680 × 1920`. The player uses cover rendering without browser borders and treats only the media element's genuine `ended` event as completion. Start-up timers must never limit playback duration or hide final frames or audio.
- The physical Share and copyright plates remain part of the locked cabinet. The Share plate uses native sharing when available and a clipboard fallback, while the immutable global Deep Cuts footer remains present below the product.
- Protected publication is isolated from both Band Edition and Bar Edition. First publication assigns a stable opaque `/e/dc_*` identity, uploads a versioned MP4, stores the edition in dedicated Aggits Jukebox tables and preserves that identity for future updates.
- The owner-supplied 1254 x 1254 Aggits QR artwork is SHA-256 locked. Publication fits the edition title into its upper plaque and places the permanent QR as one centred insert inside the measured bright QR opening, with balanced margins and no overlap onto the surrounding cabinet frame. The finished artwork must decode at full and phone-sized resolution before activation.
- Delivery is part of the publication gate. The single owner-facing Publish action saves the edition, publishes it and automatically requests the delivery email without a second click or separate email step. The owner email must identify the edition, include both a clickable and plain-copy permanent URL, and attach the fitted QR artwork. The edition is not marked live until confirmed delivery and live page, MP4 and QR verification succeed.
- Bulk intake is a private Studio draft-creation boundary, never a publisher. It accepts only the versioned 40-column CSV contract or the exact `Import Ready` Excel worksheet, validates every identity, mapping, action and destination fail-closed, and writes no more than 1,000 isolated `aggits_jukebox` drafts per confirmed batch. Stable identities, source checksums, reconciliation reports, draft snapshots and recoverable rollback are mandatory. Unknown mappings, spreadsheet formulas and published-record updates fail closed; every imported draft still passes the existing individual media and publication gates.

## Private Venue Library contract

- Venue Library is a private local operations module inside Deep Cuts Studio. It is not a public edition and never mutates a completed Band Edition, Bar Edition or public registry record.
- Its versioned local schema is `deep-cuts-venue-library/1`. Master ID is the immutable CSV identity key; CSV-managed, automatically retrieved and administrator-managed data remain structurally separate.
- Synchronisation is idempotent and preserves custom videos, overrides, pinned notices, public/QR URLs, notes, publication state, analytics placeholders, health, update and audit history. A missing CSV row never deletes a venue.
- On-demand URL, gig, ticker and QR-readiness jobs run only while Studio is open. Venue failures are isolated, the last valid automated data is preserved, and unsupported extraction fails visibly instead of fabricating content.
- Venue preview output may reuse the locked static Bar cabinet contract, but the Venue Library research/update engine is never embedded in the public Bar Edition runtime. Public Bar editions remain static administrator-supplied products.
- The supplied Aggits venue QR master is a separate owner-approved campaign-export asset. It does not add Aggits to the live Bar cabinet. QR artwork is not distribution-ready until it targets the deployed public HTTPS edition and passes payload validation plus a real scan test.
- The owner-facing publication control is one inline `Published` / `Unpublished` switch. First publication still performs every protected validation, versioned Cloudflare upload, scan-tested permanent QR, delivery confirmation and live verification before the switch settles on. Switching off changes only the remote active state: it never deletes the D1 edition, versioned assets, opaque edition ID, URL, QR payload, local video, configuration or audit history. Switching on again validates preserved assets and restores the same permanent URL and QR. Device activation remains an internal security prerequisite and is not exposed as a routine workflow.
- A complete Bar Edition draft may enter that protected workflow through the single Studio control `SAVE VENUE + PUBLISH`. The control must save or update exactly one stable Venue Library record, transfer and hash-check its MP4, queue the existing fail-closed publisher, and report the permanent live URL only after publication, QR verification and delivery succeed. It never bypasses the library, validation, device credential or publication audit trail.
- The August 2026 library reset is a one-time, reversible archive migration. Existing venue records are hidden from the active library without changing their public state or deleting any data. The owner returns archived venues to the active library one at a time through `Add Venue`; a CSV row missing from a later import still never deletes or reactivates a venue.
- Public Bar Edition MP4 assets must be no larger than 24 MiB so the protected Cloudflare static-asset deployment fails closed below the platform's 25 MiB file ceiling. Larger local MP4 files may remain available for private preview but cannot be published.
- Local reporting covers only evidence Studio can measure. Public visits, QR scans and visitor clicks remain unavailable until a hosted analytics boundary exists and must never be inferred.

## Commercial Instinct contract

- Commercial Instinct is isolated at `/sell/` with API routes under `/api/sell/*`; it never enters or changes the edition registry.
- Its intake consists of the official **My Company** and **Target Company** URLs. The target identity must be confirmed before research.
- It reuses only the immutable original Aggits cutout and the Deep Cuts blue-black design language. Music, Cars, Clubs and Schools layouts remain unchanged.
- Every sales-intelligence parameter has its own blue button and focused view. Advice is candid, concise and plain-language, while facts, interpretations, unknowns, confidence and evidence remain distinguishable.
- A research provider must compare both companies. It may never infer capabilities from a domain alone or invent a fit when supplier research is unavailable.

## Laneway contract

- Laneway is an independent music-discovery edition. It does not inherit the Music/Aggits, Cars, Clubs, Schools or Commercial Instinct visual contracts.
- Aggits is absent from the Laneway page and every Laneway delivery asset.
- The exact approved Laneway Music source logo is preserved. Its deterministic transparent reverse-white rendition is used over the predominantly charcoal and black interface so no rectangular image background can appear on any browser.
- Laneway QR and social delivery images use `DEEP CUTS` immediately above the copyright notice; they never repeat `Laneway` in that footer position.
- Laneway's live footer also uses `Deep Cuts` immediately above the copyright notice.
- The locked hero labels are `Listen`, `Watch`, `Discover`, `Buy`, followed immediately by the verified YouTube video selected on the official Laneway Music artist page.
- An explicit owner-supplied replacement video may override the label selection for a named Laneway edition. It must be identity-checked, embeddable, recorded as `owner-selected` and must never be misrepresented as an official-label selection.
- Verified artist destinations follow the video. The five-question challenge appears after those destinations and immediately before a compact `Home`, `Share`, `Recommended` row.
- `Home` opens the official Laneway Music home page. `Recommended` opens Laneway Music's official artist catalogue. Both are analytics-tracked, direct HTTPS destinations and must never be guessed.
- Each Laneway edition contains exactly five positive, informative, sourced multiple-choice questions about the nominated band or artist.
- Questions, answer explanations and source evidence live in the isolated `lanewayChallenge` configuration and `laneway-questions.json`; no other edition may render or depend on them.
- Unavailable or uncertain destinations are omitted. Verified music, video, social, website, merchandise and editorial links retain the Music destination integrity standard.
- The standard instruction is `Laneway [Band or Artist]`.

## Decision-intelligence module contract

“I Want to Sell to This Company” is an isolated decision-intelligence module, not an edition. Its public route is `/sell/`, its Worker namespace is `/api/sell/*`, its data tables use the `sales_` prefix and its executable schema lives in `sell/schemas.js`. It must never import edition-specific business rules or store sales data in edition tables. Existing editions must remain operational if this module is removed.

## Record Company Edition contract

- `record_company` is an independent parent/child discovery ecosystem. It uses `/record-company/*`, `/api/record-company/*` and D1 tables prefixed `record_company_`.
- It never enters or modifies standard Music, Cars, Clubs, Schools, Laneway or Commercial Instinct configuration.
- One official company URL authorises unattended processing of the complete accessible roster. Failures are isolated and recorded.
- Publication requires at least 98% confidence in company association, artist identity, direct destinations and every question.
- The company and each published artist have exactly five positive, sourced questions and stable tracked QR routes.
- Aggits is absent from every page, state, quiz, QR, report and email.
- The company page provides fair random discovery. Artist pages provide same-roster recommendations and a direct company-home route.
- Every QR is decoded individually and from the Ultra HD master grid before delivery.
- D1 is the reporting source of truth. Completion delivery uses the existing encrypted Resend integration.

## Final Indie Label Model contract

- `indie_label/1` is final and locked. Its reference is the restored Laneway Music company edition `dc_b9e7b66620` in the production state restored by PR #102.
- The locked journey is the label-branded waveform, equal-chance artist wheel, in-circle spinning spiral, winner destination and sourced impact line, optional verified purchase links, a conditional verified winner-video panel, searchable roster, delayed 10-question catalogue quiz, positive sourced feedback, contact result and anonymous reporting.
- In the Laneway reference, pale teal/light blue is the unified decorative accent for headings, buttons, borders, glows, video and quiz surfaces. The illuminated wheel pointer is the sole red interface element.
- The discarded catalogue-discovery overhaul is not part of the model. Surprise Me, rich related-artist cards, recommendation panels and quiz-result artist recommendations must not be restored without explicit owner authority.
- A new independent-label product uses isolated `indie_wheel` configuration. Its logo, colours, roster, platform, verified links, impact copy, questions, contact and copyright belong only to that edition.
- The reference Laneway edition and completed Cool Death Records edition are immutable commercial products. A future label edition must never overwrite either one.
- The machine-readable contract is `edition-contracts.json`; `scripts/test-indie-label-model.mjs` is the fail-closed regression guard.
