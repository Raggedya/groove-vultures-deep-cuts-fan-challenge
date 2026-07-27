# Laneway Music catalogue-discovery maintenance

This document applies only to the isolated `laneway_company` edition at `dc_b9e7b66620`. It does not change the normal `Laneway [Artist]` factory or Indie Wheel.

## Data ownership

- `editions/laneway-music-one-off/roster.json` is the verified artist and destination source.
- `editions/laneway-music-one-off/artist-impact.json` is the maintained discovery layer.
- `editions/laneway-music-one-off/laneway-company-questions.json` is the ten-question quiz.
- `editions/laneway-music-one-off/edition.json` owns presentation labels and verified Laneway company destinations.

## Add or update an artist

1. Verify the exact Laneway roster identity and direct Spotify artist URL.
2. Add or update the artist once in `roster.json`, retaining the official Laneway `sourceURL` and verification evidence.
3. Add a matching `artist-impact.json` record with a sourced `description`, concise `reasonToListen`, optional verified `startWith`, and two or three `related` entries.
4. Every related artist must already exist in the same roster, must not point to itself, and needs a short evidence-grounded reason.
5. Update `sourceArtistCount` and `verifiedArtistCount` together. `pendingArtistCount` must remain zero for publication.
6. Run platform validation and the Laneway one-off regression test before deployment.

## Add platform links

Optional `buyMusicURL`, `buyMerchURL`, `youtubeURL`, `websiteURL` and `instagramURL` fields belong on the artist's roster record only after direct identity verification. Purchase links require the existing dated `purchaseVerification` evidence. The interface hides every blank or invalid optional link. Never use search results, login walls, generic platform homepages or guessed URLs.

## Change recommendations

Edit only the artist's `related` array in `artist-impact.json`. Recommendations are explicit and deterministic; there is no runtime AI call. Keep two or three onward paths for every artist so no discovery becomes a dead end. Base each reason on documented sound, era, scene, musical connection or catalogue context and do not claim an undocumented relationship.

## Update quiz questions

The quiz must retain exactly ten active, sourced multiple-choice records. Each has four unique options, a `category` that exactly matches a verified roster artist, one correct answer, a useful explanation and a direct HTTPS source represented in `research.json`. Quiz-result recommendations are generated deterministically from correct and incorrect category answers plus the curated related-artist map.

## Analytics contract

All Laneway events pass through `trackLanewayEvent`, which adds the isolated edition type and `laneway-weekly-v2` contract. Artist selections include `artist_name`, `discovery_source`, anonymous session identity and timestamp. Destination events add `destination_platform` and origin. The Worker accepts only its scalar allow-list and stores no raw IP address, account, email, precise location or fingerprint.

The authenticated Friday PDF/XLSX reports require the existing `ADMIN_TOKEN`, `RESEND_API_KEY`, `REPORT_RECIPIENT`, `REPORT_FROM_EMAIL` and optional `RESEND_WEBHOOK_SECRET`. No new environment variable is required by the catalogue-discovery upgrade.
