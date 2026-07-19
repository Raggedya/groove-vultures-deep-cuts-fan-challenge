---
name: deep-cuts-factory
description: Research, configure, validate, auto-publish and deliver one permanent Deep Cuts artist-discovery edition from a single "Deep Cuts [Artist]" instruction. Use for every new band or artist edition and for verified destination updates.
---

# Deep Cuts Factory

Read `PLATFORM_ARCHITECTURE_DIRECTIVE.md` first, then read `DEEP_CUTS_PRODUCTION_MANUAL.md`, `CLAUDE.md` and `ROADMAP.md` completely before acting. Complete the directive's impact assessment and preserve every unrelated edition.

For `Deep Cuts [Artist]`:

1. Run `node scripts/start-edition.mjs "Artist"` before research. Never restart the clock.
2. Research current official artist-controlled sources first. Open and identity-check every proposed destination. When an official YouTube channel exists, verify its most-viewed official music video for the featured player. Record evidence using `references/research-contract.md`. Omit every unavailable destination.
3. Save the completed research input outside the edition folder, then run `node scripts/create-edition.mjs <input.json>`. This creates only edition configuration, evidence and the opaque route.
4. Run the complete validation and the edition QR scan-back. Fix failures without involving the owner.

For `Deep Cuts Cars [Make and Model]`, follow the same clock, validation, opaque-route, QR, deployment and delivery workflow with `editionType: car`. Verify the automotive identity and the model-specific history, specifications, buyer guidance, authoritative video, owners' community, restoration parts, live sales and editorial sources. Do not alter Music definitions.

For `Deep Cuts Clubs [Club name and location]`, use `editionType: club` and the same unattended clock-to-delivery workflow. Verify the exact club and its direct official website, calendar, news, events, membership, public participation, competition, venue, history, contact, social and governing-body destinations. Omit login, share, search, generic and uncertain links. Do not alter Music or Cars definitions.
5. Create an `agent/deep-cuts-<slug>` branch and pull request through the connected GitHub app. Mark it ready and wait for green validation. Enable auto-merge when the repository allows it; otherwise merge through the authorised GitHub connector only after the head SHA and green checks are re-confirmed. Do not ask the owner to merge or use PowerShell.
6. Monitor the main-branch deployment. It regenerates and verifies artwork, registers analytics, emails the live opaque URL and QR PNG, and waits for the signed `email.delivered` webhook.
7. Report the live link only after the deployment and confirmed email delivery are green. Report exceptions only when credentials, ambiguous identity or missing authority make safe completion impossible.

For a destination update, modify only the verified edition configuration and evidence, preserve the existing `editionId`, validate, auto-merge and deploy. The QR must not change.

Never create another repository, expose a band name in a public URL, invent a link or video, redraw Aggits, bypass QR scan-back, or ask the owner to perform repeatable engineering work. Analytics is best effort and must never interrupt navigation. Every repeated manual step is an automation opportunity.

