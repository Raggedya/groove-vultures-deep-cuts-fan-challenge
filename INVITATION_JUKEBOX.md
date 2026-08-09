# Invitation Jukebox

Invitation Jukebox is an isolated desktop product built beside the existing
Mahogany/Aggits band jukebox. It does not rename, repurpose, or overwrite any
existing band, bar, venue, or artist edition.

## Launch libraries

- Wedding — black lacquer, antique brass, champagne and ivory floral detail.
- Birthday — plum, teal, gold, stars and restrained celebration ribbons.
- Corporate — midnight navy, satin black, cool light and geometric brass.
- Seasonal — oxblood, forest green, holly and warm festive lighting.
- Group Trip — black leather, burnished copper, red and touring details.

Each invitation is stored under its immutable type:

`<app data>/invitation-jukebox/invitations/<type>/<invitation_id>/project.json`

Changing an invitation's type after creation is intentionally blocked. This
prevents a Wedding project from leaking into the Birthday or Corporate library.

## Workflow

1. Select one of the five invitation types.
2. Create and autosave the invitation in the central workspace.
3. Add title, names, event details, ticker, message, welcome media, and four
   destination keys.
4. Review the exact cabinet in the live preview.
5. Use **Create, publish & email** to reserve a permanent URL, create and
   scan-check a QR image, publish the page, verify it, and email the link and QR.
6. Open **Libraries** to search or filter saved invitations by type.

Published invitations use `invitation-jukebox/2026-08-09-v1` and contain an
immutable cabinet plaque reading **Copyright Clearlight Creative 2026**. The
global public footer remains **Deep Cuts / Copyright Clearlight Creative**.

## Source entry points

- Desktop: `studio/invitation-desktop-main.mjs`
- Local server: `scripts/invitation-studio-server.mjs`
- UI: `invitation-studio/`
- Model: `scripts/invitation-jukebox-model.mjs`
- Renderer: `scripts/invitation-jukebox-preview.mjs`
- Protected publication: `scripts/invitation-jukebox-publication.mjs`
- QR artwork: `scripts/invitation-jukebox-qr-artwork.mjs`

Development commands:

```text
npm run invitation:server
npm run invitation:desktop
npm run invitation:test
npm run invitation:make
```

When this lightweight workspace intentionally omits `node_modules`, the Windows
builder can reuse an existing verified dependency cache by setting
`DEEP_CUTS_DEPENDENCY_ROOT` to that checkout before running `invitation:make`.

For the one-time production Cloudflare authorization, double-click
`AUTHORIZE-AND-DEPLOY-CLOUDFLARE.cmd`. It opens Cloudflare's official Wrangler
OAuth page in the normal Windows browser. After the owner clicks **Authorize**,
the launcher verifies the account, rebuilds the static bundle, deploys the
worker, checks the public health endpoint, and logs Wrangler out. Its temporary
OAuth files are kept under the Git-ignored `.wrangler-auth/` directory.

## Suggested next libraries

The cleanest next additions are Engagement, Anniversary, Baby Shower,
Fundraiser/Gala, Reunion, and Product Launch. Each should receive a dedicated
cabinet master and new type contract rather than reusing a launch library's
visual identity.
