# CLEarlight Archive Jukebox — Stage 1

A completely standalone, disposable proof-of-concept for random discovery of rights-checked historical audio and video. It does not import from or modify Aggits, Fullnoise, Deep Cuts, invitation, business or production jukebox applications.

## Run locally

On Mac, Windows or Linux with Node.js 20+:

```sh
cd CLEarlight_ARCHIVE_JUKEBOX
npm start
```

Open `http://localhost:4177`. On a phone connected to the same Wi-Fi, open `http://<computer-lan-address>:4177` while the server is running.

No package installation is required. The prototype has no third-party runtime dependency.

## Locked interaction order

The physical controls are permanently ordered:

`VIDEO | AUDIO | SURPRISE ME | SELECT CATEGORY`

## Catalogue and rights policy

`data/archive-catalogue.js` contains 50 hand-curated Stage 1 records. Each includes a source page, licence statement, provenance, contextual ticker and `approved` flag. `data/media-manifest.js` stores the official browser-compatible Wikimedia MP3/WebM transcode resolved at build time. The player service exposes only records where `approved === true`.

The prototype deliberately favours false negatives. A public page is not treated as permission. Records are limited to item-level public-domain or open-licence declarations on Wikimedia Commons, including original archive attribution. Source & Rights remains available in the interface for every selected item.

The checked-in media manifest avoids depending on original archive codecs that mobile browsers may reject. Failed media is still logged, the machine stops all animation, displays a friendly notice, and attempts another approved record.

## Architecture

- `src/archive-service.js` is the data boundary. A future database/API can implement the same `getRandom({ mediaType, category, excludeIds })` contract.
- `src/app.js` owns the state machine: idle, loading, playing, paused, complete and failed.
- HTML media stays inside the cabinet. HOME resets internal state without navigation. NEXT preserves category and media type.
- The audio path uses Web Audio `AnalyserNode` when cross-origin analysis is permitted and a restrained visual fallback when it is not.
- Categories persist locally after HOME or refresh. Recent history excludes up to eight items.

## Stage 1 limitations

- The catalogue is intentionally local and manually curated. There is no crawler or Stage 2 harvesting system.
- Remote archive availability can change after validation.
- Mobile browsers require a user tap before media starts; the four physical buttons provide that gesture.
- Some original historical films are long. Stage 1 streams them from their source rather than copying or re-hosting them.
- Live VU analysis depends on the source permitting cross-origin audio analysis. When unavailable, a subtle believable fallback movement is used; playback itself remains unmodified.

## Tests

```sh
npm test
```

The tests enforce catalogue size and provenance, approved-only selection, filtering/recent exclusion, and the exact four-button order.

## Asset

`assets/clearlight-archive-cabinet-master.webp` is an isolated cabinet master derived non-destructively from the supplied visual reference. It is used only by this experiment.
