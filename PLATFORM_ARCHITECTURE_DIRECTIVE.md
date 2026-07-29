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
- The reusable model name and version are exactly `JookBox` and `jookbox/1`.
- JookBox uses an HGM-related deep-navy foundation with its own old-school illuminated jukebox cabinet, warm chrome/gold and red-orange detail, sequential selection-key lights and privacy-enhanced featured-video screen.
- JookBox never displays Aggits, a quiz or a spinning wheel.
- The featured video is the most-viewed embeddable official video visible through the artist-controlled YouTube channel at verification time.
- Only dated, identity-verified Spotify, YouTube, website, social, merchandise and contact destinations may appear. Missing destinations are omitted.
- Its bright lights become static when reduced motion is requested and stop spending attention in hidden tabs.
- Filthy Animals `dc_a3c049e4bc` is the first completed JookBox edition. Its configuration and evidence remain isolated from every future band.

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
