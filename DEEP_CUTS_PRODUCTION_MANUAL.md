# Deep Cuts Production Manual

Version 3.0 — Permanent Artist Discovery Platform

## Constitution

Deep Cuts is one permanent, mobile-first artist discovery and support platform. It is not a quiz and it is never copied into a band-specific repository. The engine, backend, analytics and deployment are maintained once. Each artist is configuration, verified destinations and generated promotional artwork.

The primary production KPI is elapsed time from artist-name submission to confirmed delivery email. The secondary KPI is verified content quality. Every change must reduce production time, reduce owner interaction or improve integrity without weakening either.

## Locked visual model

The user-approved screen in `assets/main-screen-master-reference.png` is the immutable visual reference. The live implementation must preserve its blue-black composition, original Aggits character, artist title, concise biography, unique sonic signature, fixed destination structure, small Share control and restrained footer.

The original `assets/aggits-original-cutout-v4.png` appears once on the live page and is never redrawn, recoloured, stretched or substituted. `assets/aggits-qr-master-final.png` is the immutable square QR-poster reference. Both are protected by SHA-256 checks.

Every destination remains visible in the standard position. Verified destinations are active. Missing or uncertain destinations are visibly disabled and cannot be clicked. The waveform pulses once on opening and every ten seconds; verified destinations receive one restrained sequential glow. Disabled destinations do not animate. Reduced-motion settings and hidden tabs stop animation.

## Permanent public URL model

No artist or band name may appear in the public URL. Each edition receives a stable opaque `editionId` and these routes:

- Canonical page: `/e/<editionId>`
- QR entry: `/q/<editionId>`

The QR route records a `qr_scan` event and redirects to the canonical page. Existing edition IDs are never recycled. A changed destination or Tip link never requires a replacement QR.

## Research and destination integrity

Use official artist-controlled sources first: official website, verified Spotify and Bandcamp artist pages, official social profiles, official YouTube channel, official store and direct ticket destinations. Cross-check identity before publication. Never guess a destination.

Every active link must be HTTPS, resolve successfully, belong to the correct artist and retain evidence plus a verification timestamp. Ambiguous or unverified links remain disabled. A payment or Tip destination is never inferred; it must be explicitly supplied by the owner or officially published by the artist.

News & Reviews links to the strongest recent credible accessible interview, feature or review, not search results, scraped directories or low-quality aggregation. If no suitable coverage exists, it remains disabled.

## QR production standard

The QR promotion is a square 1080 × 1080 PNG using the locked QR master composition. The final QR is generated deterministically from `/q/<editionId>`, uses black modules on white, retains a four-module quiet zone, is not skewed or decorated, and is placed only within the card held by Aggits.

The final rendered PNG must be decoded automatically and the decoded URL must exactly match the intended QR route. It must also decode after representative social-media resizing. A failed or mismatched scan blocks publication.

## Analytics contract

The Cloudflare Worker and D1 database are the authoritative analytics backend. Track:

- QR scans and anonymous unique QR sessions
- Artist page views
- Each outbound destination separately
- Share-button actions and confirmed native shares where the browser reports confirmation
- Production stages and duration
- Delivery accepted and delivery confirmed

Clicks represent intent only. A Spotify click is not a stream, a Tip click is not a payment, and a share action is not proof of publication. Analytics failure must never delay or prevent navigation.

Collect only anonymous session IDs, source, device category and coarse country/region supplied at the network edge. Do not store raw IP addresses, precise coordinates, passwords, payment details or social logins.

## Production timing

Every build records: submitted, research started, research completed, artwork completed, validation completed, deployed, email accepted, email delivered and completed. The definitive total is `submitted_at` to `email_delivered_at`. Failed jobs retain their stage and error for process improvement.

## Deployment and delivery

GitHub is the source of truth. All work occurs on a branch and passes automated validation before main. Cloudflare deployment occurs only after validation. Runtime credentials are encrypted secrets and never committed.

Every deployment synchronises and smoke-tests against the exact Cloudflare URL returned by that deployment. The workflow must verify `/api/health` before writing edition data; saved legacy URLs must never override a fresh deployment address.

Completion email goes automatically to `andrewharris501@gmail.com` and contains the verified live URL plus scan-tested QR PNG. A scheduled Friday report contains band-level scans, views, destination clicks, shares, production timing and link health in CSV format.

## Definition of done

An edition is complete only when identity is verified; configuration validates; all active links resolve to the correct artist; unavailable buttons are disabled; the locked screen passes mobile checks; analytics event names and edition IDs pass tests; the final QR scan-back matches; deployment is live; the live smoke test passes; and the delivery email is confirmed.

After every change ask: “What can I automate next?” Implement the practical answer.
