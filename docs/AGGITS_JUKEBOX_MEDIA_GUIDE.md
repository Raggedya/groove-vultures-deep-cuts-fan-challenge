# Aggits Jukebox media guide

The isolated `aggits_jukebox` product uses the owner-supplied `AGGITS_JUKEBOX.jpeg` cabinet and `AGGITS_ICONS.jpeg` icon library as immutable visual masters.

## Camtasia export

- Canvas aspect ratio: **7:8** (portrait).
- Normal export: **1120 × 1280 pixels**.
- High-resolution export: **1680 × 1920 pixels**.
- Format: MP4 with H.264 video and AAC audio.
- Frame rate: use the source frame rate; **30 fps** is the normal recommendation. Use 60 fps only when the source was captured at 60 fps.
- Audio: AAC, 48 kHz, 192–320 kbps stereo.
- Camtasia placement: scale and crop the source to **Fill** the entire 7:8 canvas.
- Do not use Fit when it produces empty space. Do not add a black canvas, black border, letterbox or pillarbox.

The live player fills the complete implemented video opening with `object-fit: cover`. A source exported at 7:8 fills it without browser-created borders or distortion. A different source ratio is centre-cropped minimally; it is never stretched.

Playback completion is driven only by the video element's genuine `ended` event. Startup timers control cabinet lighting, not video duration or completion.

## Edition fields

Studio stores the display title, ticker message, local MP4 and four ordered actions in the existing project record. Each action stores its enabled state, approved icon ID, label, action type, raw value, normalized safe destination and new-tab preference. Telephone and email values become `tel:` and `mailto:` actions; web and map values require HTTPS.

The 110 approved icons are generated from the locked icon master into `assets/aggits-jukebox-icons/`. Rebuild them only from that same master with `node scripts/build-aggits-jukebox-icons.mjs` and revalidate its SHA-256 identity.
