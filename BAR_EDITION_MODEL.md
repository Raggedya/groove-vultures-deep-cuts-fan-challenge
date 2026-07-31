# Deep Cuts Bar Edition

Bar Edition is the locked, static venue version of the ATLAS JookBox. It is an isolated product on the shared Deep Cuts engine and does not change Band Edition, Filthy Animals, ATLAS or any completed edition.

## Locked presentation and behaviour

- Product type: `bar_jukebox`
- Model: `bar-jukebox/1`
- Cabinet: `atlas-reference-cabinet/1`
- Key bank: `bar-six-key/1`
- Content mode: `administrator-static`
- Automatic web lookup: forbidden
- Aggits, quiz, spinning wheel and YouTube: excluded
- Global footer: `Deep Cuts` / `Copyright Clearlight Creative`
- Cabinet copyright: `Copyright Clearlight Creative 2026.`

The top marquee displays the venue name and uses the existing responsive title-fitting logic. The administrator supplies the ticker text, a local MP4 welcome video and exactly five button labels with five direct HTTPS destinations. Share is always the sixth key. The cabinet support strip below the keys is a second working Share control whose dynamic label reads `Share [Venue Name] with your mates`.

The visible cabinet instruction reads `INSERT COIN`. The visitor drags the visible coin upward, clicks it or activates it with Enter/Space. The direct gesture starts the real local coin sound, requests immediate MP4 playback, then runs the established mechanical, neon, CRT, key and ticker sequence. If a browser blocks audible autoplay, the native video controls remain visible so the visitor can press Play. The five venue destinations open securely in a new tab, preserving the powered JookBox in the original tab. Both Share controls remain dim and unavailable until the cabinet is awake, then share the canonical public edition URL.

## Create a Bar Edition in Deep Cuts Studio

1. Open Deep Cuts Studio.
2. Select **Bar Edition**.
3. Enter the venue name.
4. Enter exactly five short button labels and five HTTPS URLs.
5. Enter the scrolling ticker text.
6. select the local MP4 welcome video.
7. Press **Create Bar Edition**.
8. Test the coin, sound, video, ticker, all six keys and responsive title in the phone preview.
9. Make changes directly or through the typed/dictated revision field.
10. Confirm that the large venue Share panel unlocks after the coin.
11. Export the handoff when **Static Handoff Ready** appears.

Studio performs no venue research and does not infer, add or validate missing destinations. It is bound to an ephemeral private `127.0.0.1` address and must not generate a scannable preview QR: on a phone, that address refers to the phone rather than the Mac. Studio displays a publication-pending panel instead. The permanent public URL and QR pass through the platform isolation, asset-integrity, deployment and live-verification steps; only the deployed HTTPS URL is encoded and scan-tested.

## Production configuration

The edition-owned configuration lives only under `barJookBox`:

```json
{
  "editionType": "bar_jukebox",
  "brandName": "Bar Edition",
  "bandName": "Venue Name",
  "links": {},
  "barJookBox": {
    "modelVersion": "bar-jukebox/1",
    "contentMode": "administrator-static",
    "webLookupAllowed": false,
    "venueName": "Venue Name",
    "tickerText": "ADMINISTRATOR-SUPPLIED TICKER TEXT.",
    "localWelcomeVideo": "assets/editions/venue-slug/welcome.mp4",
    "localWelcomeVideoSha256": "64-character SHA-256",
    "actions": [
      {"id": "gigs", "label": "Gigs", "url": "https://venue.example/gigs"},
      {"id": "menu", "label": "Menu", "url": "https://venue.example/menu"},
      {"id": "contact", "label": "Contact Us", "url": "https://venue.example/contact"},
      {"id": "instagram", "label": "Instagram", "url": "https://instagram.com/venue"},
      {"id": "facebook", "label": "Facebook", "url": "https://facebook.com/venue"}
    ]
  }
}
```

The shared cabinet and real coin-sound asset remain integrity locked. The supplied MP4 receives its own edition-specific SHA-256 value during production.
