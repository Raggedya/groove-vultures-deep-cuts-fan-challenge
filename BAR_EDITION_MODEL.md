# Deep Cuts Bar Edition

Bar Edition is the locked, static venue JookBox. It is an isolated product on the shared Deep Cuts engine and does not change Band Edition, Filthy Animals, ATLAS or any completed edition. Its stored ATLAS appearance identifier is retained for data compatibility, while the Bar-only renderer uses the owner-approved heritage mahogany and aged-brass cabinet.

## Locked presentation and behaviour

- Product type: `bar_jukebox`
- Model: `bar-jukebox/1`
- Cabinet: `atlas-reference-cabinet/1`
- Bar visual surface: SHA-256-locked `assets/jookbox-bar-heritage-brass-v1.png`
- Key bank: `bar-six-key/1`
- Content mode: `administrator-static`
- Automatic web lookup: forbidden
- Aggits, quiz, spinning wheel and YouTube: excluded
- Global footer: `Deep Cuts` / `Copyright Clearlight Creative`
- Cabinet copyright: `Copyright Clearlight Creative 2026.`

The top marquee displays only the venue name and the `JOOKBOX` tagline; it never displays `BAR EDITION`. The editable venue name follows the engraved heritage arch on a responsive SVG path and is automatically fitted without flattening the curve. The broad cabinet ticker uses large, bright yellow type and remains one clipped scrolling line. The administrator supplies the ticker text, administrator-approved About Us copy, a local MP4 welcome video and exactly five button labels with five direct HTTPS destinations. About Us is always the internal sixth parchment/brass key. The six physical keys use one coherent monochrome antique SVG icon set. While awake they illuminate in three warm incandescent stages: Gigs plus Menu, Contact Us plus Instagram, then Facebook plus About Us. The cabinet support strip below the keys is the sole working Share control and its dynamic label reads `Share [Venue Name] with your mates`. `Copyright Clearlight Creative 2026.` is displayed on its own brass plate at the bottom of the cabinet.

The visible cabinet instruction reads `INSERT COIN`. The visitor drags the visible coin upward, clicks it or activates it with Enter/Space. The yellow coin pulses gently only while the cabinet is sleeping; it inserts and disappears during activation, then remains non-glowing and non-pulsing for the entire awake session, including a restored session after refresh. The direct gesture starts the real local coin sound, requests immediate MP4 playback, then runs the established mechanical, neon, CRT, key and ticker sequence. If a browser blocks audible autoplay, the native video controls remain visible so the visitor can press Play. The five venue destinations open securely in a new tab, preserving the powered JookBox in the original tab. About Us opens an internal venue-information screen and returns to the still-powered JookBox. The long Share control remains dim and unavailable until the cabinet is awake, then shares the canonical public edition URL.

## Create a Bar Edition in Deep Cuts Studio

1. Open Deep Cuts Studio.
2. Select **Bar Edition**.
3. Enter the venue name.
4. Enter exactly five short button labels and five HTTPS URLs.
5. Enter the scrolling ticker text.
6. Enter administrator-approved About Us copy containing the verified location, venue story and any optional approved review wording.
7. Select the local MP4 welcome video. For live publication, export it at 24 MiB or smaller.
8. Press **Create Bar Edition**.
9. Test the coin, sound, video, ticker, all six keys, About Us return behavior and responsive title in the phone preview.
10. Make changes directly or through the typed/dictated revision field.
11. Confirm that the single large venue Share panel unlocks after the coin.
12. On the first production use, press **Activate Publishing**, enter the six-digit code sent to the owner email, then press **Publish Venue**. Later venues require only **Publish Venue**. Keep Studio open until direct Cloudflare publication, live verification, permanent QR scan-back and completion email are confirmed.

Studio performs no venue research and does not infer, add or validate missing destinations. It is bound to an ephemeral private `127.0.0.1` address and must not generate a scannable preview QR: on a phone, that address refers to the phone rather than the Mac. Studio displays a publication-pending panel instead. The permanent public URL and QR pass through the platform isolation, asset-integrity, deployment and live-verification steps; only the deployed HTTPS URL is encoded and scan-tested.

The private publisher never exposes Cloudflare credentials to Studio and does not require GitHub. Email activation issues a device-scoped token that Electron encrypts with Windows `safeStorage`. Each publication validates exactly five HTTPS destinations, required copy and the 24 MiB MP4 ceiling; uploads versioned MP4 and permanent QR objects; activates only the venue's isolated D1 record; and sends the QR by email. Publication state changes only after email delivery and independent live page, QR and MP4 verification succeed. A failed update rolls back to the previous live record.

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
    "aboutText": "ADMINISTRATOR-APPROVED VENUE DESCRIPTION, VERIFIED LOCATION AND OPTIONAL APPROVED REVIEW WORDING.",
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
