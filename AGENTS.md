# Deep Cuts repository instructions

## Permanent unattended batch rules

The permanent batch entry point is `npm run deepcuts:batch -- run --input <csv>`. Use the shared engine and existing factory scripts; never create a separate application per artist. The 98% confidence gate is mandatory and fail-closed. Search results are not destinations. A failure is isolated, retried when technical, then recorded without stopping the batch. Completed editions are skipped unless explicitly forced. Secrets and transient checkpoints never enter Git. Aggits assets are immutable. Tipping is retired and must not be restored. Unavailable destinations are omitted by the current discovery interface.

Read `DEEP_CUTS_PRODUCTION_MANUAL.md`, `CLAUDE.md`, `ROADMAP.md`, then `.agents/skills/deep-cuts-factory/SKILL.md` before acting.

This is the one permanent Deep Cuts artist-discovery platform. Never create or copy a repository for an edition. A request in the form `Deep Cut [Artist]` authorises the normal factory workflow: start a build record; verify the artist and official links; configure one edition; verify the most-viewed embeddable official YouTube video; validate; generate a square image and scan-tested approved Aggits QR poster; deploy; verify; complete the build record; and automatically deliver the URL and assets.

`Deep Cuts Cars [Make and Model]` uses the separately locked automotive configuration on the same engine. It must never change the Music destination set. Verify model history, specifications, buying guidance, an authoritative video, owners' community, restoration parts, current sale listings and credible editorial coverage; omit any destination that cannot be verified.

`Deep Cuts Clubs [Club name and location]` uses a third separately locked configuration. Verify the exact club identity and direct official website, calendar, news, events, membership, participation, competition, venue, history, contact, social and governing-body destinations. Omit unavailable or uncertain links, especially social links that lead only to login or generic pages. Never change the Music or Cars definitions.

Never invent destinations. Unavailable destinations are omitted. Preserve the approved Aggits assets and their integrity checks. Public artist routes use opaque edition IDs, never band names. Optimise every change for less production time and less owner interaction.
