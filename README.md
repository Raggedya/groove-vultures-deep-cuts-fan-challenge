# Deep Cuts

Deep Cuts is a reusable mobile artist-discovery platform. Each band has a single configuration-driven page containing verified music, video, social, tickets, merchandise, mailing-list and optional Tip links, plus a share function and an optional embedded official video.

## Standard request

`Deep Cut [Band Name]`

The factory researches official links, registers the edition, validates it, creates scan-tested promotional assets, deploys it and prepares delivery. Missing or unverified destinations are hidden rather than guessed.

## Local checks

- `npm run validate` validates every edition, approved Aggits integrity, discovery UI and analytics.
- `npm run build -- <slug>` additionally creates social and QR outputs.
- `npm run register -- <slug> "Band Name"` creates one configuration-only draft.

The historical quiz engine and question archives remain in Git history but are not loaded by the public discovery page.
