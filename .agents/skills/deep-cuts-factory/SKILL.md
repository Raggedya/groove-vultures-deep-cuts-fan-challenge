---
name: deep-cuts-factory
description: Research, configure, validate, auto-publish and deliver one permanent Deep Cuts artist-discovery edition from a single "Deep Cuts [Artist]" instruction. Use for every new band or artist edition and for verified destination or Tip-link updates.
---

# Deep Cuts Factory

Read `DEEP_CUTS_PRODUCTION_MANUAL.md`, `CLAUDE.md` and `ROADMAP.md` completely before acting.

For `Deep Cuts [Artist]`:

1. Run `node scripts/start-edition.mjs "Artist"` before research. Never restart the clock.
2. Research current official artist-controlled sources first. Open and identity-check every proposed destination. Record evidence using `references/research-contract.md`. Never infer a Tip destination.
3. Save the completed research input outside the edition folder, then run `node scripts/create-edition.mjs <input.json>`. This creates only edition configuration, evidence and the opaque route.
4. Run the complete validation and the edition QR scan-back. Fix failures without involving the owner.
5. Create an `agent/deep-cuts-<slug>` branch and pull request through the connected GitHub app. Mark it ready and wait for green validation. Enable auto-merge when the repository allows it; otherwise merge through the authorised GitHub connector only after the head SHA and green checks are re-confirmed. Do not ask the owner to merge or use PowerShell.
6. Monitor the main-branch deployment. It regenerates and verifies artwork, registers analytics, emails the live opaque URL and QR PNG, and waits for the signed `email.delivered` webhook.
7. Report the live link only after the deployment and confirmed email delivery are green. Report exceptions only when credentials, ambiguous identity or missing authority make safe completion impossible.

For a destination or Tip update, modify only the verified edition configuration and evidence, preserve the existing `editionId`, validate, auto-merge and deploy. The QR must not change.

Never create another repository, expose a band name in a public URL, invent a link, infer a payment destination, redraw Aggits, bypass QR scan-back, or ask the owner to perform repeatable engineering work. Analytics is best effort and must never interrupt navigation. Every repeated manual step is an automation opportunity.

