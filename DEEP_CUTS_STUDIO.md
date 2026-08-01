# Deep Cuts Studio

Deep Cuts Studio is the private desktop control surface for creating and reviewing Deep Cuts products. It uses the permanent shared platform and never creates a separate application or repository for an edition.

## Bar Edition workflow

Choose **Bar Edition**. Enter the venue name, exactly five short button labels and five HTTPS destinations, the scrolling ticker copy, administrator-approved About Us copy, and a local MP4 welcome video up to 500 MB. About Us is the permanent sixth key; the long venue panel is the sole Share control.

Studio does not search the web or infer Bar Edition content. The supplied information remains local and private. The phone preview uses the locked ATLAS cabinet and reproduces the production interaction:

1. the cabinet begins asleep;
2. the visitor drags the coin upward, clicks it, or presses Enter/Space;
3. the real coin-slot recording plays;
4. the local MP4 requests immediate audible playback from the direct gesture;
5. the neon, screen, six keys and ticker wake in the established sequence;
6. the five external actions and internal About Us key unlock, and the large `Share [Venue Name] with your mates` panel becomes active;
7. one restrained light advances through all six keys.

Native video controls stay available because Safari, Chrome or a device policy can still block audible autoplay. A refresh in the same browser session restores the awake cabinet without replaying the coin sound or forcing the video.

Studio's internal readiness state becomes **Static Handoff Ready** only after all five labelled destinations, ticker text, About Us copy and MP4 are present. The desktop preview is served from a private ephemeral `127.0.0.1` address that is intentionally accessible only on that computer. Studio therefore does not create a Bar Edition preview QR; a phone would treat `127.0.0.1` as the phone itself and could not connect. Production generates and scan-tests the permanent QR only after the public HTTPS edition is deployed. See [BAR_EDITION_MODEL.md](BAR_EDITION_MODEL.md).

## JookBox workflow

Choose **JookBox Band**, enter the band name and press **Research & Create JookBox**.

An artist-controlled URL is strongly recommended. A Linktree, official website, Bandcamp page, official YouTube channel or verified social profile gives Studio a reliable identity starting point. Up to three source URLs and an optional YouTube lead may be supplied.

Studio then:

1. verifies the exact band identity;
2. follows artist-controlled links as research leads;
3. resolves and independently checks each direct destination;
4. sources concise band information for the biography ticker;
5. checks the official YouTube channel and its Popular ordering;
6. confirms the featured video identity and embeddability;
7. assigns the deterministic confidence result;
8. populates no more than eight JookBox keys with destinations that reach the mandatory 98% gate;
9. omits uncertain, broken, indirect or unsupported destinations;
10. creates the mobile JookBox preview and verified factory handoff.

Band name alone is supported as a best-effort discovery mode. It must still find and independently verify an artist-controlled source before it can pass. If it cannot reach 98%, Studio stops safely and asks for a stronger official URL instead of guessing.

Search-result pages are never treated as destinations or evidence. Studio does not invent biographies, platform links, stores, shows or relationships.

## Other Studio projects

The same one-screen interface also supports:

- Business
- Recruitment
- Individual Band
- Restaurants
- Tourist Attractions
- Towns

Those existing workflows preserve their approved Aggits and optional-wheel contracts. The owner-supplied orange hi-vis HGM Aggits remains available only to the exact High Grade Mechanical Business or Recruitment project. A JookBox never uses Aggits or a spinning wheel.

Studio accepts:

- a version or company name;
- up to three official source URLs;
- an optional direct YouTube link;
- PNG, JPEG or WebP logo artwork;
- one MP3 up to 25 MB;
- a project brief;
- QR-poster wording;
- typed or supported browser dictation revisions.

Bar Edition additionally accepts five labelled destinations, administrator ticker copy, administrator-approved About Us copy and one local MP4. It excludes automatic research, YouTube, Aggits and the optional wheel. It creates a live mobile preview and structured handoff manifest; its permanent QR and QR poster are created after deployment.

Other Studio project types retain their existing live mobile preview, local preview QR, 1080 × 1080 draft poster and structured handoff manifest.

## Windows desktop application

Windows x64 is the primary Deep Cuts Studio desktop target. It contains the complete current Studio, including the locked Band and Bar Edition workflows. Create the Windows installer on a Windows computer with:

```powershell
npm run studio:make
```

Desktop drafts live in the private Deep Cuts Studio application-data folder. They survive application updates and are not placed inside the public website.

The active Windows interface uses two visible columns only: the compact project controls and the mobile preview. The former output, revision and production-safety column remains internal and is intentionally absent from the owner interface.

## Venue Library

Studio 3.4.0 includes a separate **Venue Library** for locally operating a large venue-edition catalogue. It parses the real CSV contents, synchronises by immutable Master ID, preserves administrator work, searches and filters venues, runs selected URL/gig/ticker/QR-readiness stages on demand, displays red/amber/green/grey health, retains update and audit history, exports CSV reports, prints PDF-ready summaries and generates venue-specific QR artwork from the supplied 1920 × 1080 master.

An open venue includes **Secure Publish Venue**. On first use, **Activate Publishing** emails the owner a six-digit code. After the code is entered, Electron stores only a device-scoped token encrypted by Windows `safeStorage`; Studio never receives Cloudflare credentials and requires no GitHub account. **Publish Venue** then validates the isolated edition, uploads the SHA-256-verified MP4 and locally generated two-size scan-tested permanent QR, activates the venue record in Cloudflare, confirms completion-email delivery, verifies the live venue page, QR and MP4, then records the live URL. The public MP4 limit is 24 MiB; larger files remain usable in local preview but must be re-exported smaller. Failed verification restores the previous live version and leaves the attempt unpublished.

The first supplied CSV contains 31 venues (`Aggits_001`–`Aggits_031`), regardless of the `210` in its filename. Updates run only while Studio is open. Public activity analytics remain explicitly unavailable until hosting is added. Full operating and backup instructions are in [VENUE_LIBRARY_ADMIN_GUIDE.md](VENUE_LIBRARY_ADMIN_GUIDE.md).

## macOS packaging (paused)

The macOS build is produced as both a DMG and ZIP for:

- Apple Silicon Macs (`arm64`: M1, M2, M3, M4 and later);
- Intel Macs (`x64`).

Automated macOS builds run on genuine GitHub-hosted macOS hardware through:

```text
.github/workflows/build-deep-cuts-studio-macos.yml
```

The development build is not Apple-notarised. On first launch, macOS may require Control-clicking **Deep Cuts Studio**, choosing **Open**, then confirming **Open**. Production public distribution requires Clearlight Creative's Apple Developer signing and notarisation credentials; no credential is stored in the repository.

macOS packaging remains available for future use, but Windows is the active production target.

## Run locally

Install the locked dependencies:

```powershell
npm ci
```

Open the native desktop application:

```powershell
npm run studio:desktop
```

Run the same local interface in a browser:

```powershell
npm run studio
```

Then open:

```text
http://127.0.0.1:4380/studio/
```

Browser-development drafts are stored under ignored `.deep-cuts/studio/projects/` data.

## Build packages

Windows x64 (primary):

```powershell
npm run studio:make
```

macOS Apple Silicon:

```bash
npm run studio:make:mac:arm64
```

macOS Intel:

```bash
npm run studio:make:mac:x64
```

Electron packages are operating-system specific. The Mac downloads must be built on macOS; the Windows installer must be built on Windows.

## Security and publication boundary

The Electron renderer is sandboxed, has context isolation enabled and has no Node.js access. Its private server binds only to an ephemeral `127.0.0.1` port. External navigation is limited to HTTPS and opens in the system browser.

The research client:

- accepts HTTPS only;
- blocks local and private network destinations, including redirects;
- applies timeouts, retry limits and response-size limits;
- strips common tracking parameters;
- stores verification evidence and timestamps;
- fails closed below 98%.

Passing JookBox research authorises verified preview population, not direct public deployment. A permanent opaque Deep Cuts URL and scan-tested QR still pass through the existing isolation, configuration, build, deployment and live-verification stages. Studio never writes directly to `platform.json`, `editions/`, completed build records or the public Worker.

## Project data

Studio projects use `deep-cuts-studio-project/1`. JookBox research uses `deep-cuts-studio-jookbox-research/1`; exported handoffs use `deep-cuts-studio-handoff/1`.

The JookBox research record includes:

- input fingerprint;
- band identity sources;
- confidence and individual gate checks;
- sourced ticker biography;
- verified featured-video evidence;
- verified destinations and discovery source;
- displayed selection IDs;
- omitted uncertain candidates and reasons;
- verification timestamps.

Changing the band name, source URL or YouTube lead invalidates the prior research result and requires a fresh run.

## Test

```powershell
npm run studio:test
```

The suite covers local isolation, immutable artwork rules, source and media handling, preview output, revisions, footer preservation, name-plus-URL research, name-only research, independent destination checks, official video verification, 98% fail-closed behaviour and structured handoff generation.
