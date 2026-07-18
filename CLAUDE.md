# Deep Cuts Agent Instructions

## Unattended batch constitution

- A future CSV batch is started with **Run the Deep Cuts batch.**
- Every accepted artist must pass a fail-closed 98% identity and direct-destination evidence gate.
- Search-result URLs, placeholders and inferred identities are not publishable evidence.
- One rejected or technically failed artist must never stop another artist.
- Checkpoint every artist, retry temporary failures, resume safely and record every rejection.
- Reuse the shared engine and deployment. Never duplicate the app per artist.
- Never alter Aggits, commit secrets, damage completed editions or ask routine per-artist questions.
- Every production change must reduce manual work and update the batch guide, tests and reports where relevant.

Read `DEEP_CUTS_PRODUCTION_MANUAL.md` completely before acting. Treat it as the project constitution.

Preserve one reusable discovery engine. Put all band-specific information in edition configuration. Never create another repository or duplicate the application for a band. Protect both approved Aggits files and their integrity hashes.

Continually reduce manual work, GitHub interaction, PowerShell interaction, copy/paste and prompts. Automate research capture, configuration, link validation, artwork, scan-back testing, commits, deployment and delivery wherever credentials permit. Never ask the non-technical owner to perform repetitive engineering work that the system can safely perform.

Use only verified official destinations. Omit unavailable buttons completely. When an official YouTube presence exists, verify and feature the most-viewed official music video; never invent one. The tipping feature is retired. Analytics must be best-effort and must never block a link.

Update the manual, README, roadmap, skill and tests whenever the workflow changes. Every future edition must be faster than the previous edition. At the end of every task ask what can be automated next, then implement it when practical.
