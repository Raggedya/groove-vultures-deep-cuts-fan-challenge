# Deep Cuts Production Manual

Version 2.0 — Artist Discovery Platform

## Product constitution

Deep Cuts is a reusable, mobile-first artist discovery and support platform. A fan scans a band-specific QR code and opens one focused page containing verified music, video, social, ticket, merchandise, mailing-list and optional tipping links. It is no longer a quiz product.

The shared engine is changed once. Each new band is configuration and generated artwork, never a copied software project.

## Permanent experience

- One calm blue-black mobile page.
- The band name is prominent.
- The original approved Aggits character appears once on the live page.
- Only verified, useful destinations are displayed; blank destinations remain hidden.
- The featured video is the verified most-viewed embeddable video from the band’s official YouTube presence when that can be established reliably.
- “Tip the Band” appears only when the band supplies or officially publishes a verified HTTPS PayPal, Venmo or equivalent payment page. Never infer or invent a payment destination.
- Sharing and copying are always available.
- Analytics never delays or breaks navigation.

## Approved artwork

`assets/aggits-original-cutout-v4.png` is the immutable live-page character. `assets/aggits-qr-holder-approved.png` is the user-approved QR-poster character. Both are protected by SHA-256 checks. Never redraw, regenerate, recolour or substitute them.

## Research standard

Use primary artist sources first: official website, verified social profiles, official Spotify/Bandcamp pages, official YouTube channel, official ticket and merchandise stores. Cross-check identity before publishing. Do not guess missing links. Record only HTTPS destinations. A YouTube channel link is not sufficient evidence for a “most viewed” video; verify the specific official video and ensure embedding is permitted.

## Edition configuration

Each edition lives only in `editions/<slug>/edition.json`. It contains the band name, public URL, theme, verified destinations, optional tip URL, and optional featured video. The player engine must contain no band-specific content.

## QR and social output

Every active edition produces a square band image and a scan-tested QR poster. The QR must resolve to the canonical edition URL and be decoded from the final rendered file before release. The QR poster uses the approved Aggits QR-holder artwork.

## Analytics and privacy

Measure page views, share actions and every destination separately, including tips. Clicks indicate intent only: a Spotify click is not a stream, a Tip click is not a payment, and a share action is not proof of publication. Do not collect passwords, payment details, social logins or unnecessary personal information.

## Definition of done

An edition is complete only when configuration validates; every visible destination resolves to the correct band; hidden empty links remain hidden; the embedded video is correct; sharing and copying work; analytics failures do not interrupt use; the QR scan-back matches the canonical URL; mobile layout is visually checked; deployment is live; and the link and approved promotional assets are delivered automatically.

After every change ask: “What can I automate next?” Implement the practical answer.
