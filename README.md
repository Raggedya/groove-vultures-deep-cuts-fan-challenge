# Deep Cuts

Deep Cuts is one permanent artist-discovery platform. A fan scans an artist-specific QR and opens a calm one-screen page containing verified music, social, website, merchandise, Tip and editorial destinations.

## Standard owner request

`Deep Cuts [Band or Artist]`

The production factory records the submission time, verifies the artist and destinations, creates configuration and promotional assets, validates the QR, deploys the edition and emails the finished package. It never creates another repository.

Public URLs use opaque IDs and never expose the artist name:

- `/q/<editionId>` records a QR visit and redirects.
- `/e/<editionId>` is the canonical artist page.

## Platform components

- Static mobile interface and edition configuration
- Cloudflare Worker routing and APIs
- Cloudflare D1 anonymous analytics and production timing
- GitHub validation and deployment workflows
- Automated Friday CSV report
- Automated completion delivery with QR PNG

## Validation

`npm run validate` checks the locked UI, approved Aggits hashes, edition routes, analytics, build tracking and Worker contract. `npm run build` creates the Cloudflare static bundle.

Secrets and account identifiers are configured once after the Cloudflare and email accounts are connected. They are never committed.
