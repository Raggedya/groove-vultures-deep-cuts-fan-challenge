# JookBox Venue Library — administrator guide

## What this module is

Venue Library is the private, local-first operations area inside Deep Cuts Studio 3.4.1. It synchronises a venue master CSV, stores protected administrator work, checks official destinations on demand, retrieves structured gig data where a venue exposes it, prepares ticker copy, securely publishes isolated Bar Editions, creates branded QR artwork and reports local operational health.

It is not a public website and it does not run while Deep Cuts Studio is closed. Public visitor analytics require a separately hosted service and are deliberately not estimated here.

Venue Library is operational tooling. It does not change the locked Band Edition or Bar Edition contracts. A generated venue preview reuses the locked static Bar cabinet, but importing or updating a venue never edits a completed public edition.

## First use

1. Open **Deep Cuts Studio**.
2. Select **Venue Library** in the top navigation.
3. The active library initially appears empty. Existing records are safely archived and hidden; their live pages, URLs and QR codes are unchanged.
4. Press **Add Venue**, choose one archived venue and press **Add Venue** again to return only that venue to the active library.
5. To add a genuinely new record, press **Import CSV**, select a UTF-8 CSV and review the preview counts, warnings, rejected rows and duplicates.
6. Press **Synchronise valid venues** only when the preview is correct.

The supplied file named `melbourne_venue_prospects_210.csv` contains 31 data records, `Aggits_001` through `Aggits_031`. Studio always parses the file; it never trusts the number in the filename.

## CSV rules

The CSV must retain these exact headers and their order:

`Research Date`, `Master ID`, `Venue Name`, `Venue Type`, `Website`, `Gigs / Shows / What’s On`, `Menu`, `Contact Us`, `Instagram`, `Facebook`, `About Us`, `Location`, `Street Address`, `Suburb / City / Town`, `State`, `Postcode`, `Phone`, `Email`, `Venue Capacity`, `Verification Notes`.

`Master ID` is the stable unique key. Add new venues with new Master IDs. Never reuse an existing Master ID for another venue. A missing row does not delete a venue.

CSV synchronisation controls the verified research fields only. It preserves:

- custom MP4 videos;
- manual ticker and About Us overrides;
- pinned notices;
- public and intended QR destinations;
- private notes;
- publication state;
- health, update and audit history.

Repeatedly importing the same file is safe and produces unchanged records.

## Updating venues

Use **Update All Venues**, select rows and use **Update Selected**, or open a venue and use **Update this venue**. Before a run begins, select the required stages:

- destination URL checks;
- gig retrieval;
- ticker regeneration;
- QR-readiness checks.

Studio processes venues independently. One failure does not stop other venues, and failed retrieval preserves the last valid automated data. **Cancel update** safely stops after the current venue. **Retry failures** creates a linked retry run. **Export results** saves a UTF-8 CSV for the run.

Updates run only while Studio remains open. If the application is closed, no background or scheduled work occurs.

## Gig information and ticker copy

Studio starts from each venue’s verified `Gigs / Shows / What’s On` URL. The first release supports schema.org Event JSON-LD and is designed for future site-specific adapters. If an official page is reachable but exposes no supported structured events, Studio records a review warning rather than inventing events.

Generated events are kept under the venue’s immutable ID, deduplicated across runs and expired when they pass. Generated ticker copy uses Australia/Melbourne time. A manual ticker override always wins; clearing it resumes automated or factual fallback copy. Pinned notices remain protected during CSV synchronisation.

## Health lights

- **Green:** recent checks succeeded and required local data is current.
- **Amber:** partial success, incomplete or stale data, a slow destination, or one recent failure.
- **Red:** repeated or critical failure requiring attention.
- **Grey:** never checked or insufficient information.

The editor shows component-level health and the latest result. Red is not assigned for a single minor transient failure unless the failure is critical.

## QR artwork

Enter either a confirmed public HTTPS edition URL or an intended future HTTPS destination, then press **Generate QR artwork**. Studio places a unique QR and fitted venue name into the owner-supplied 1920 × 1080 master artwork.

A QR made from only an intended destination is a preview and is not approved for distribution. A public poster must use the deployed HTTPS edition, pass Studio’s payload validation and then be scan-tested from the exported PNG or printed PDF before delivery. The private `127.0.0.1` preview is never a valid phone QR destination.

## Published / Unpublished switch

Open one venue and complete all five verified HTTPS destinations, ticker copy, About Us copy and a custom MP4. The live MP4 must be 24 MiB or smaller. A larger file continues to work in the local preview, but must be re-exported at a lower bitrate before publication.

Use the single **Published / Unpublished** switch in the venue editor. No activation form or separate Publish Venue button is shown. The existing device-scoped credential remains encrypted by Windows and is not written to `library.json`, the repository or a venue record. Switch a ready venue to **Published** and keep Studio open while it automatically performs:

1. validating the static Bar Edition and its exactly five public HTTPS destinations;
2. checking the ticker, About Us copy, MP4 signature, SHA-256 identity and 24 MiB ceiling;
3. uploading the versioned MP4 to the isolated Cloudflare asset store;
4. generating the 1920 × 1080 permanent QR locally and scan-checking its matrix at full and half size before upload;
5. activating only that venue's isolated Cloudflare edition and sending the permanent QR by email;
6. waiting for confirmed email delivery, then verifying the live page, QR, configuration and MP4 before marking the venue **Published**.

If validation, upload, email delivery or live verification fails, Studio records the failure and leaves the venue unmarked. A failed update restores the previous live venue record. It never activates an unvalidated edition. Closing Studio interrupts the local monitor; the remote job remains fail-closed and the venue can be reviewed and retried safely.

Switching a published venue to **Unpublished** hides its public route but does not delete its opaque edition ID, permanent URL, QR payload, stored video, configuration or history. Switching it back to **Published** runs the complete protected pipeline against the current local content and reuses the same permanent URL and QR identity.

## Reports

**Export operational CSV** creates a filter-aware UTF-8 report. **Print / Save PDF** opens a presentation-ready local summary that can be printed or saved as PDF. Reports truthfully cover imports, update runs, URL checks, gig retrieval, ticker readiness, publication and QR readiness. They do not claim public visits, scans or outbound clicks.

## Local data, backup and updates

Electron stores the library beneath its private application-data directory, normally:

`%APPDATA%\Deep Cuts Studio\studio\venue-library\`

The atomic source of truth is `library.json`; custom videos are stored in its `videos` folder. Close Studio before copying this directory as a backup. Application installers do not remove this data, so a newer installer can be installed over the existing version.

The data file declares schema `deep-cuts-venue-library/1`. Loading runs a backward-compatible migration/defaulting step before every transaction. The existing Studio has no SQL database, so this module correctly extends the established versioned JSON architecture rather than introducing a second database technology.

## Security

The private server binds only to `127.0.0.1`. Mutations require Studio’s session token. URL retrieval allows HTTP/HTTPS only, validates every redirect, blocks credentials, localhost, private/link-local ranges and metadata endpoints, applies timeouts and size limits, and sanitises extracted text. The Electron renderer remains sandboxed without Node.js access.

## Troubleshooting

- **CSV rejected:** keep the exact headers, UTF-8 encoding, unique Master IDs and complete HTTP/HTTPS URLs.
- **OneDrive file moved:** choose it again with **Import CSV**; no saved venue is deleted.
- **Gig page reachable but empty:** the page may be client-rendered or lack structured events. Preserve manual copy and add a tested site adapter later.
- **Red URL after one outage:** run **Check URLs now** again. Repeated failures, not one minor transient failure, drive red health.
- **QR says preview only:** configure and deploy the permanent public HTTPS edition, then regenerate and scan-test.
- **A venue is missing from the active list:** press **Add Venue** and restore it from the archived list. This does not change its live status, URL or QR.
- **MP4 is too large to publish:** re-export it below 24 MiB; keep the same cabinet aspect ratio and test it locally before publishing.
- **No public activity numbers:** deploy the future hosted redirect/analytics service; local Studio will not fabricate those metrics.
