# Deep Cuts Studio

Deep Cuts Studio is the private desktop control surface for creating and reviewing Deep Cuts products. It uses the permanent shared platform and never creates a separate application or repository for an edition.

## Bar Edition workflow

Choose **Bar Edition**. Enter the venue name, exactly five short button labels and five HTTPS destinations, the scrolling ticker copy, and a local MP4 welcome video up to 500 MB. Share is the permanent sixth key.

Studio does not search the web or infer Bar Edition content. The supplied information remains local and private. The phone preview uses the locked ATLAS cabinet and reproduces the production interaction:

1. the cabinet begins asleep;
2. the visitor drags the coin upward, clicks it, or presses Enter/Space;
3. the real coin-slot recording plays;
4. the local MP4 requests immediate audible playback from the direct gesture;
5. the neon, screen, six keys and ticker wake in the established sequence;
6. the five external actions unlock, Share occupies the sixth key, and the large `Share [Venue Name] with your mates` panel becomes active;
7. one restrained light advances through all six keys.

Native video controls stay available because Safari, Chrome or a device policy can still block audible autoplay. A refresh in the same browser session restores the awake cabinet without replaying the coin sound or forcing the video.

The Studio readiness panel becomes **Static Handoff Ready** only after all five labelled destinations, ticker text and MP4 are present. The desktop preview is served from a private ephemeral `127.0.0.1` address that is intentionally accessible only on that computer. Studio therefore does not display or download a Bar Edition preview QR; a phone would treat `127.0.0.1` as the phone itself and could not connect. Instead, Studio displays **Public QR Created After Deployment** and exports the handoff. Production generates and scan-tests the permanent QR only after the public HTTPS edition is deployed. See [BAR_EDITION_MODEL.md](BAR_EDITION_MODEL.md).

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

Bar Edition additionally accepts five labelled destinations, administrator ticker copy and one local MP4. It excludes automatic research, YouTube, Aggits and the optional wheel. It creates a live mobile preview, a publication-pending output panel and a structured handoff manifest; its permanent QR and QR poster are created after deployment.

Other Studio project types retain their existing live mobile preview, local preview QR, 1080 × 1080 draft poster and structured handoff manifest.

## Mac desktop application

The macOS build is produced as both a DMG and ZIP for:

- Apple Silicon Macs (`arm64`: M1, M2, M3, M4 and later);
- Intel Macs (`x64`).

Automated macOS builds run on genuine GitHub-hosted macOS hardware through:

```text
.github/workflows/build-deep-cuts-studio-macos.yml
```

The development build is not Apple-notarised. On first launch, macOS may require Control-clicking **Deep Cuts Studio**, choosing **Open**, then confirming **Open**. Production public distribution requires Clearlight Creative's Apple Developer signing and notarisation credentials; no credential is stored in the repository.

Desktop drafts live in the operating system's private Deep Cuts Studio application-data folder. They survive application updates and are not placed inside the public website.

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

Windows:

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
