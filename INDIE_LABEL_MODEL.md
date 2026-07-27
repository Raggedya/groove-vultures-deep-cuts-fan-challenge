# Indie Label Model

## Final locked reference

The final Indie Label model is version `indie_label/1`. Its permanent reference is the restored Laneway Music company edition:

- edition type: `laneway_company`
- edition ID: `dc_b9e7b66620`
- live route: `/e/dc_b9e7b66620`
- approved state: the production state restored by PR #102, immediately before the rejected catalogue-discovery overhaul

This model is final and locked. Future label editions extend the platform through isolated configuration; they never alter the reference edition or another completed label edition.

## Locked experience

The model preserves:

- the mobile-first label-branded header and waveform
- the equal-chance artist wheel with illuminated pointer
- the compact in-circle spiral while the wheel spins
- the winner destination button, sourced artist-impact line, verified optional purchase buttons and conditional verified artist video
- the searchable complete artist roster with direct platform buttons
- the delayed 10-question catalogue quiz with positive sourced feedback
- score, replay, wheel return and label-contact result actions
- anonymous interaction analytics and the existing secure weekly reporting workflow

The discarded catalogue-discovery overhaul is not part of this model. `Surprise Me`, rich related-artist cards, cross-catalogue recommendation panels, quiz-result artist recommendations and the reordered discovery journey must not be added to the reference edition without a new explicit owner instruction.

## Edition-owned configuration

Each new indie label edition owns its:

- name, logo, colours and copyright
- verified artist roster
- primary outbound platform and button wording
- verified music and merchandise purchase links
- verified artist-video data, with unavailable videos omitted
- sourced artist-impact copy
- 10 sourced quiz questions and classifications
- official contact and catalogue destinations

Missing or unverified destinations are omitted. A future edition may use Spotify, Bandcamp or another verified direct platform without changing the model or any completed edition.

## Change control

`edition-contracts.json` is the machine-readable source of truth. `scripts/test-indie-label-model.mjs` protects the reference state and fails validation if its identity, core journey or explicitly rejected additions change.

The generic `indie_wheel` edition type is the configuration pathway for future independent labels. Cool Death Records remains its own completed, separately branded product and is not overwritten by this reference.
