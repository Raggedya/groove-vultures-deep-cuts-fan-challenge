# Deep Cuts analytics

Deep Cuts uses the platform Worker and Cloudflare D1 as its permanent, first-party analytics system. Every event is assigned to an opaque edition identifier. Public URLs never contain the artist name.

## Recorded actions

- verified QR route opened (`qr_scan`)
- artist discovery page viewed
- share button and share method selected
- native share completed, only when the browser confirms it
- copy-link selected and successfully copied
- outbound destination clicked, recorded separately for Buy Music, Spotify, Instagram, Bandcamp, YouTube, Facebook, band website, merchandise, Tip the Band and News & Reviews

Every event includes an event ID, edition ID, timestamp, anonymous browser-session ID, referring source and device category. Cloudflare may add country and region codes from the incoming request. Deep Cuts does not store raw IP addresses, precise location, account credentials or payment details.

Analytics is best-effort and never delays or blocks a destination. A click records intent only: it does not prove a stream, follow, purchase, payment or published share.

## Reporting

The protected `/api/reports/weekly.csv` endpoint produces band-level totals. A scheduled Worker sends the same CSV to the configured owner every Friday at 9:00am Australia/Sydney time. The report includes QR scans, page views, outbound totals, every platform total, Tip clicks and share actions.

## Delivery integrity

Completion email acceptance and confirmed delivery are recorded separately. Resend webhook payloads are verified against their signing secret, rejected when stale or altered, and deduplicated by the provider event ID. Production time ends only after a verified `email.delivered` event.
