# Deep Cuts Production Manual

`PLATFORM_ARCHITECTURE_DIRECTIVE.md` governs this manual. Every completed edition is an isolated commercial product. Edition preservation and backward compatibility are mandatory and take priority over new features.

## Unattended artist batches

Deep Cuts accepts CSV batches through one permanent controller. Intake data is evidence to verify, not truth to copy. Every artist is normalized, duplicate-checked, range-checked, researched and independently gated. Publication requires at least 98% confidence in artist identity and every mandatory direct destination. Search pages, guesses and placeholders are forbidden. Rejections are recorded and isolated. Temporary failures receive bounded retries with exponential backoff; checkpoints allow safe resume. Accepted artists flow through the existing factory, immutable artwork checks, QR scan-back, shared Cloudflare deployment, live verification, analytics registration and email delivery.

The current product is a discovery platform, not a quiz. Legacy batch requirements for question counts, scoring or timers are not applicable; reports record `question_count` as zero to make that explicit.

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

Collect only anonymous session IDs, source, device category and coarse country/region supplied at the network edge. Do not store raw IP addresses, precise coordinates, passwords, payment details or social logins.

## Production timing

Every build records: submitted, research started, research completed, artwork completed, validation completed, deployed, email accepted, email delivered and completed. The definitive total is `submitted_at` to `email_delivered_at`. Failed jobs retain their stage and error for process improvement.

## Deployment and delivery

GitHub is the source of truth. All work occurs on a branch and passes automated validation before main. Cloudflare deployment occurs only after validation. Runtime credentials are encrypted secrets and never committed.

Every deployment synchronises and smoke-tests against the exact Cloudflare URL returned by that deployment. The workflow must verify `/api/health` before writing edition data; saved legacy URLs must never override a fresh deployment address.

GitHub installs delivery artwork dependencies once into the exact Python environment used by the generator and verifies Pillow, QR and scan-back imports before rendering. Local production may use the repository's private Python tools directory, which the generator must add to its import path and verify before rendering any edition.

The deployment workflow installs the encrypted administration, Resend API, report-recipient and sender values into the Cloudflare Worker on every release. Missing required runtime secrets block deployment before edition synchronisation. The Resend webhook signing secret is installed automatically when configured.

Completion email goes automatically to `andrewharris501@gmail.com` and contains the verified live URL plus scan-tested QR PNG. A scheduled Friday report contains band-level scans, views, destination clicks, shares, production timing and link health in CSV format.

The delivery service refuses to send if the deployed PNG cannot be retrieved as an image. Resend webhook signatures are verified before delivery confirmation is recorded; only `email.delivered` completes the measured production job.

New active edition IDs are detected automatically on the main-branch deployment. Only those new editions receive completion emails; ordinary engine changes and destination updates do not resend them. The deployment remains in progress until the signed Resend webhook confirms delivery.

## Definition of done

An edition is complete only when identity is verified; configuration validates; all active links resolve to the correct artist; unavailable buttons are disabled; the locked screen passes mobile checks; analytics event names and edition IDs pass tests; the final QR scan-back matches; deployment is live; the live smoke test passes; and the delivery email is confirmed.

After every change ask: â€œWhat can I automate next?â€ Implement the practical answer.

