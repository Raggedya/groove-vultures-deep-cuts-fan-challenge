# Deep Cuts Production Manual

> Decision intelligence: the isolated “I Want to Sell to This Company” pathway is governed by [SALES_INTELLIGENCE.md](SALES_INTELLIGENCE.md). It must preserve every edition contract and must never turn an interpretation into a sourced fact.

`PLATFORM_ARCHITECTURE_DIRECTIVE.md` governs this manual. Every completed edition is an isolated commercial product. Edition preservation and backward compatibility are mandatory and take priority over new features.

## School Discovery permanent rules

School Discovery is a separate product contract. Research begins with the official school website, from which the engine records the primary, secondary, accent, surface and content-background colours. These values may be used for the School Discovery interface and QR artwork; the school logo, crest and emblem must not be copied or displayed. Aggits is never used. Every edition requires a verified, authoritative featured YouTube video and direct official school links. Existing Music, Cars and Clubs output remains unchanged.

Every Schools Edition also includes exactly six positive, factual multiple-choice questions in a separate `school-questions.json` file. Questions draw on official school pages, annual reports, government project pages and other authoritative evidence. Each question has four unique choices, a verified answer, a useful positive explanation and a direct HTTPS source. The locked experience is a 15-second countdown, the existing ding only at zero, ten seconds to read the explanation, automatic progression, an encouraging final rating, replay and School Home return. The red challenge card appears immediately before School Upgrade. No other edition receives this feature.

## Laneway permanent rules

`Laneway [Band or Artist]` creates an isolated Laneway edition on the permanent platform. It preserves the exact supplied Laneway Music source logo and displays a deterministic transparent reverse-white rendition, preventing a rectangular image background on every browser. It uses a charcoal/black interface and no Aggits character or Aggits artwork. Its QR and social delivery images show `DEEP CUTS` immediately above `copyright Clearlight Creative`, never `Laneway` in that footer position. It must never change the standard Deep Cuts Music edition.

The permanent Laneway discovery order is: `Listen / Watch / Discover / Buy`; the official-label-selected YouTube video; verified artist destination cards; the five-question challenge; then the compact `Home / Share / Recommended` controls. Home and Recommended use the verified Laneway Music home/artist-catalogue destination. The live footer reads `Deep Cuts` above the copyright notice. Missing or unverified artist destination cards remain omitted without changing this order.

The owner may explicitly replace the featured video for a named Laneway edition. The replacement must be identity-checked and embeddable, stored as `owner-selected`, and supported by dated evidence. This exception changes only that edition and does not alter the official-label default for future editions.

Every Laneway edition contains exactly five positive, informative multiple-choice questions. Each question has four distinct options, one best answer, a concise story-led explanation and matching dated, identity-verified HTTPS evidence. The tone celebrates and teaches rather than catching fans out. The quiz has its own engine, configuration and question file, and results remain encouraging at every score.

## Commercial Instinct permanent rules

Commercial Instinct compares a seller and target from their two official public website URLs. It is a separate decision-intelligence product, not an edition and not a generic company report. The original Aggits cutout, blue-black Deep Cuts presentation and one-blue-button-per-parameter navigation are locked. Each opened section leads with a short, candid commercial read, practical advice and a useful question; evidence and confidence remain available without dominating the phone screen. The system must never pretend that a domain name proves capabilities, that public strategy proves live demand, or that an interpretation is an internal fact.

Its optional Banjo Strategy Brief is a versioned, removable handoff containing an owner-reviewed script rather than the private report. It has an independent two-minute ceiling, requires explicit owner-voice consent and does not change any edition or the 40-second business-advertisement workflow.

## Record Company Edition permanent rules

The only required input is an official record-company website URL. The permanent workflow discovers the official roster, processes each artist independently, publishes only identities and questions that pass the 98% evidence gate, generates stable tracked QR codes, reconciles reports, publishes generated assets and sends the master QR/report package without repeated owner interaction.

The edition uses its own public renderer, Worker API, D1 tables, job stages, analytics and generated-output directory. No Aggits asset or standard Music layout is imported. Failed artists never stop the batch and never enter discovery, recommendations or QR sheets. QR scan reliability takes priority over decoration.

## Unattended artist batches

Deep Cuts accepts CSV batches through one permanent controller. Intake data is evidence to verify, not truth to copy. Every artist is normalized, duplicate-checked, range-checked, researched and independently gated. Publication requires at least 98% confidence in artist identity and every mandatory direct destination. Search pages, guesses and placeholders are forbidden. Rejections are recorded and isolated. Temporary failures receive bounded retries with exponential backoff; checkpoints allow safe resume. Accepted artists flow through the existing factory, immutable artwork checks, QR scan-back, shared Cloudflare deployment, live verification, analytics registration and email delivery.

Music, Cars and Clubs are discovery products, not quizzes; their legacy question count remains zero. School Discovery and Laneway are explicit, separately isolated exceptions with six-question and five-question positive challenge contracts respectively.

Version 3.0 â€” Permanent Artist Discovery Platform

## Constitution

Deep Cuts is one permanent, mobile-first artist discovery and support platform. It is not a quiz and it is never copied into a band-specific repository. The engine, backend, analytics and deployment are maintained once. Each artist is configuration, verified destinations and generated promotional artwork.

The primary production KPI is elapsed time from artist-name submission to confirmed delivery email. The secondary KPI is verified content quality. Every change must reduce production time, reduce owner interaction or improve integrity without weakening either.

The standard owner instruction is `Deep Cuts [Artist]`. It authorizes the factory to research, configure, validate, create a branch and pull request, merge through the authorised GitHub connector only after green checks, deploy, verify and send the completion email without intermediate owner interaction. Repository auto-merge may be used when available but is not required. Only ambiguous artist identity, unavailable credentials or a destination requiring explicit authority may stop the factory.

The automotive instruction is `Deep Cuts Cars [Make and Model]`. Cars editions run on the same permanent engine and deployment but use a separately locked configuration, labels and evidence standard. They never replace or mutate the Music template. The standard Cars destinations are model history, specifications, buyer's guide, authoritative video, owners' community, parts and restoration, current cars for sale, and credible articles or features. Every active destination must resolve to the nominated make and model; unavailable destinations are omitted.

The club instruction is `Deep Cuts Clubs [Club name and location]`. Clubs run on the same permanent engine and deployment with a third separately locked configuration. They never replace or mutate Music or Cars. Standard Club destinations are the official website, calendar, club news, events, membership and coaching, public participation, competition, venue hire, history, contact, verified official social presence and a relevant governing body. A social destination is omitted if it resolves only to login, search, sharing or generic platform content. The location supplied in the instruction is part of the identity check.

## Locked visual model

The user-approved screen in `assets/main-screen-master-reference.png` remains the visual foundation. The live implementation must preserve its blue-black composition, original Aggits character, artist title, concise biography, unique sonic signature, small Share control and restrained footer. Directly below Listen / Watch / Follow / Buy Stuff, a restrained 16:9 YouTube screen presents the artist's verified most-viewed official music video when one exists.

The original `assets/aggits-original-cutout-v4.png` appears once on the live page and is never redrawn, recoloured, stretched or substituted. `assets/aggits-qr-master-final.png` is the immutable square QR-poster reference. Both are protected by SHA-256 checks.

Only verified, currently available destinations appear. Missing or uncertain destinations are omitted completely, and the remaining cards automatically rebalance into a deliberate full-width and paired composition without gaps. The waveform pulses once on opening and every ten seconds; verified destinations receive one restrained sequential glow. Reduced-motion settings and hidden tabs stop animation.

## Permanent public URL model

No artist or band name may appear in the public URL. Each edition receives a stable opaque `editionId` and these routes:

- Canonical page: `/e/<editionId>`
- QR entry: `/q/<editionId>`

The QR route records a `qr_scan` event and redirects to the canonical page. Existing edition IDs are never recycled. A changed destination never requires a replacement QR.

## Research and destination integrity

Use official artist-controlled sources first: official website, verified Spotify and Bandcamp artist pages, official social profiles, official YouTube channel, official store and direct ticket destinations. Cross-check identity before publication. Never guess a destination.

Every active link must be HTTPS, resolve successfully, belong to the correct artist and retain evidence plus a verification timestamp. Ambiguous or unverified links are omitted. The tipping destination and tipping button are retired from the product.

When an official YouTube channel exists, research selects the most-viewed official music video visible on that artist-controlled channel at verification time. The title, URL, verification timestamp and selection evidence are stored with the edition. The live player uses YouTube's privacy-enhanced embed domain. If no official video can be verified, the entire video screen is omitted rather than guessed.

News & Reviews links to the strongest recent credible accessible interview, feature or review, not search results, scraped directories or low-quality aggregation. If no suitable coverage exists, it remains disabled.

## QR production standard

The QR promotion is a square 1080 Ã— 1080 PNG using the locked QR master composition. The final QR is generated deterministically from `/q/<editionId>`, uses black modules on white, retains a four-module quiet zone, is not skewed or decorated, and is placed only within the card held by Aggits.

The final rendered PNG must be decoded automatically and the decoded URL must exactly match the intended QR route. It must also decode after representative social-media resizing. A failed or mismatched scan blocks publication.

The permanent base address is stored once in `platform.json`. Placeholder addresses are forbidden. Deployment regenerates every active edition's artwork against that permanent address before packaging, publishes the scan-tested PNG with the platform, and verifies that each deployed QR PNG is publicly available before any completion email can be sent.

## Analytics contract

The Cloudflare Worker and D1 database are the authoritative analytics backend. Track:

- QR scans and anonymous unique QR sessions
- Artist page views
- Each outbound destination separately
- Share-button actions and confirmed native shares where the browser reports confirmation
- Production stages and duration
- Delivery accepted and delivery confirmed

Clicks represent intent only. A Spotify click is not a stream, and a share action is not proof of publication. Analytics failure must never delay or prevent navigation. Historical Tip-click fields may remain in reporting solely to preserve old analytics records; no current page displays or records a new Tip action.

The Laneway company edition additionally records intentional wheel spins, completed artist selections, winner-versus-directory Spotify clicks by verified artist, anonymous directory searches, quiz starts, answers, completions, abandonments and replays, and services-contact intent. The Worker accepts only a versioned allow-list of scalar metadata. Duplicate event IDs are ignored by D1, reports reconcile against the raw event audit, every verified roster artist is included even when the result is zero, and report generation fails closed instead of silently truncating data.

After a Laneway company-wheel result, the sourced artist-impact line receives one brief visual attention flash. The winner may then expose `Buy Music` and `Buy Merch` independently. Each purchase destination must be a direct, identity-verified HTTPS artist or label-store page with dated evidence in the isolated roster; a search result, generic storefront, ambiguous identity, sold-out-only merch page or unavailable destination is omitted. Purchase clicks use the existing trusted `artist_destination_clicked` event with `wheel_winner` attribution. This rule is exclusive to the Laneway company edition and must not change artist-specific Laneway, Indie Wheel, Music, Cars, Clubs, Schools or Record Company editions.

Collect only anonymous session IDs, source, device category and coarse country/region supplied at the network edge. Do not store raw IP addresses, precise coordinates, passwords, payment details or social logins.

## Production timing

Every build records: submitted, research started, research completed, artwork completed, validation completed, deployed, email accepted, email delivered and completed. The definitive total is `submitted_at` to `email_delivered_at`. Failed jobs retain their stage and error for process improvement.

## Deployment and delivery

GitHub is the source of truth. All work occurs on a branch and passes automated validation before main. Cloudflare deployment occurs only after validation. Runtime credentials are encrypted secrets and never committed.

Every deployment synchronises and smoke-tests against the exact Cloudflare URL returned by that deployment. The workflow must verify `/api/health` before writing edition data; saved legacy URLs must never override a fresh deployment address.

GitHub installs delivery artwork dependencies once into the exact Python environment used by the generator and verifies Pillow, QR and scan-back imports before rendering. Local production may use the repository's private Python tools directory, which the generator must add to its import path and verify before rendering any edition.

The deployment workflow installs the encrypted administration, Resend API, report-recipient and sender values into the Cloudflare Worker on every release. Missing required runtime secrets block deployment before edition synchronisation. The Resend webhook signing secret is installed automatically when configured.

Completion email goes automatically to `andrewharris501@gmail.com` and contains the verified live URL plus scan-tested QR PNG. At 9:00 a.m. Australia/Sydney each Friday, the existing encrypted Resend integration sends one branded Laneway email containing a polished one-page A4 landscape PDF and a complete Excel workbook. The workbook includes an executive dashboard, all 35 verified artists including zero rows, wheel-versus-directory Spotify attribution, quiz intelligence, audience/source summaries, an event audit and metric definitions. The backward-compatible all-edition CSV remains attached and available from its authenticated endpoint.

The PDF and email state that Spotify clicks indicate outbound intent only, not confirmed streams, follows, saves or purchases. Reports use anonymous session identifiers and coarse region data; they do not identify individual visitors. An authenticated administrator can also download the current Laneway PDF or workbook from `/api/reports/laneway-weekly.pdf` and `/api/reports/laneway-weekly.xlsx`.

The delivery service refuses to send if the deployed PNG cannot be retrieved as an image. Resend webhook signatures are verified before delivery confirmation is recorded; only `email.delivered` completes the measured production job.

New active edition IDs are detected automatically on the main-branch deployment. Only those new editions receive completion emails; ordinary engine changes and destination updates do not resend them. The deployment remains in progress until the signed Resend webhook confirms delivery.

## Definition of done

An edition is complete only when identity is verified; configuration validates; all active links resolve to the correct artist; unavailable buttons are disabled; the locked screen passes mobile checks; analytics event names and edition IDs pass tests; the final QR scan-back matches; deployment is live; the live smoke test passes; and the delivery email is confirmed.

After every change ask: â€œWhat can I automate next?â€ Implement the practical answer.

