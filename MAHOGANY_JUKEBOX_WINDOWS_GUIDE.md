# Mahogany Jukebox for Windows

Mahogany Jukebox is a separate two-screen Windows application for manually creating and managing locked Mahogany Jukebox editions. It shares the protected Deep Cuts publication service but does not expose GitHub or Cloudflare and does not alter completed editions.

## Create or edit

1. Enter the Jukebox name.
2. Choose exactly one video source:
   - paste a YouTube video URL; or
   - choose a local MP4 no larger than 24 MiB.
3. Configure all four physical action keys:
   - press the round icon to open the searchable 110-icon library;
   - select an icon;
   - enter the accessible label;
   - enter the HTTPS, telephone or email destination.
4. Enter the ticker message.
5. Press **Save draft** to keep the work locally.
6. Press **Create** to reserve the permanent opaque URL and generate the perspective-fitted Aggits QR poster.
7. Review both previews, then press **Accept & publish**.

Acceptance publishes the exact preview, verifies the live page and video, confirms the fitted QR poster and completion email, and records the item in Library as Published. Publication errors leave the project safe and unpublished.

## Video guidance

- YouTube accepts ordinary watch, short, live, embed and `youtu.be` links.
- MP4 is optional and mutually exclusive with YouTube.
- Recommended MP4 export: H.264, 1120 × 1280 pixels, 7:8, fill the canvas, no black padding, maximum 24 MiB.
- The coin interaction and genuine local coin-slot recording remain part of the locked output for either video source. Browser media rules can still require a deliberate play press for some YouTube videos.

## Library

- Search by Jukebox name or status.
- **Edit** returns the exact item to Create/Edit without changing its opaque identity.
- The Published switch unpublishes or republishes the item.
- Unpublishing preserves the URL, QR, media, configuration and local history.
- The QR button opens the permanent poster after acceptance.

## Permanent QR standard

The 1254 × 1254 Aggits poster is generated from the immutable approved master. The edition title is fitted into the upper plaque. The QR modules are projected into these measured frame corners:

- top left: 751, 543
- top right: 1111, 543
- bottom right: 1105, 928
- bottom left: 758, 928

That four-corner projection follows the photographed trapezoid. A flat rectangular QR overlay is not permitted. Generation validates the rendered matrix at full and half resolution; the protected publication stage then scan-tests the deployed poster before the edition can become Published.

## Local data and security

- Project data is stored separately under the Windows application-data directory for Mahogany Jukebox.
- The publisher credential is encrypted by Windows through Electron `safeStorage` and is not bundled into the installer.
- A single existing Deep Cuts Studio activation can be reused on the same Windows account.
- External Jukebox destinations open outside the app so the original Jukebox remains available.

## Developer commands

```powershell
npm run mahogany:test
npm run mahogany:server
npm run mahogany:desktop
npm run mahogany:make
```

`mahogany:make` stages a minimal isolated runtime, verifies the cached Electron distribution against its official SHA-256 checksum, packages the application, runs the bounded smoke test, and creates the setup EXE, portable ZIP, checksums and installation notes under `output/Mahogany-Jukebox-Windows-1.0.0/`.
