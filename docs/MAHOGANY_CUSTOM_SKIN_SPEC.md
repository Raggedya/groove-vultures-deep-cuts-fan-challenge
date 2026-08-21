# Mahogany Jukebox skin contract

`docs/assets/MASTER-STRUCTURE-941x1672.png` is the approved visual reference for every new skin. New skins must be exactly **941 × 1672 pixels**. Studio validates the original bytes; it does not resize, crop, stretch or re-encode them.

The skin is presentation only. It may contain textures, colours, logos, display text and decoration, but it cannot provide CSS, coordinates, sizes, transforms, breakpoints, scripts or animation timing.

| Fixed functional slot | Pixel geometry on the 941 × 1672 master |
| --- | --- |
| Ticker aperture | `x 128`, `y 406`, `w 684`, `h 53` |
| Video aperture | `x 239`, `y 473`, `w 567`, `h 540` |
| Coin interaction region | `x 157`, `y 571`, `w 88` |
| Four-key region | `x 0`, `y 1096`, `w 941`, `h 283` |
| Key 1 | `x 114`, `y 1096`, `w 169`, `h 283` |
| Key 2 | `x 297`, `y 1096`, `w 169`, `h 283` |
| Key 3 | `x 481`, `y 1096`, `w 169`, `h 283` |
| Key 4 | `x 666`, `y 1096`, `w 169`, `h 283` |
| Share bar | `x 128`, `y 1383`, `w 686`, `h 89` |
| Main play control | `x 363`, `y 1494`, `w 215`, `h 141` |
| Footer plate | `x 134`, `y 1623`, `w 674`, `h 35` |

Keep every functional aperture empty and unobstructed. The engine supplies video, ticker content, coin, four selected icons, interactions and state effects inside these immutable slots.

The only accepted formats are PNG, JPEG and WebP, up to 12 MiB. Any incorrect dimensions, unsupported properties or malformed metadata fail closed. Existing 864 × 1536 editions remain supported by their preserved legacy profile; they are never silently migrated.

## Camtasia video master

- Canvas: **1890 × 1800 px** (exact `21:20` aspect ratio).
- Export: MP4, H.264, 30 fps, progressive, AAC 48 kHz.
- Scale or crop the source until it fills the complete 1890 × 1800 canvas.
- Do not use Fit if it produces bars. Do not add black padding or a border.
- Keep essential faces and text at least 5% inside the canvas edge.
- Keep the final public MP4 below the upload limit enforced by Studio.

The player uses `object-fit: cover`, centred, and clips within the fixed 567 × 540 master aperture.
