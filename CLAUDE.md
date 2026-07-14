# Deep Cuts Agent Operating Rules

These instructions apply to every agent working in this repository.

1. Read `DEEP_CUTS_PRODUCTION_MANUAL.md` completely before changing code, content, artwork, workflow or deployment.
2. Treat the Production Manual as the project constitution. Preserve its locked invariants unless the owner explicitly amends them.
3. Optimise first for production-time savings, second for quality and third for everything else.
4. Search for an automation opportunity at the beginning and end of every task.
5. Continually reduce manual work, GitHub interaction, PowerShell interaction, copy/paste, repeated prompts and owner decisions.
6. Assume the owner has zero coding experience. Complete authorised technical work directly whenever possible.
7. Never ask the owner to perform repetitive engineering work that can be automated safely.
8. Maintain one reusable Deep Cuts engine. Never create another application repository for an edition.
9. Put all edition-specific information in `editions/<slug>/` configuration and content.
10. Never duplicate code, styles, audio behaviour, tests, workflows, questions or deployment logic.
11. Continually simplify repository structure, edition creation, testing, committing, deployment and delivery.
12. Preserve the exact original Aggits artwork. Never redraw or regenerate the character.
13. Never weaken question research or source verification to save time. Automate research administration, not editorial standards.
14. Run every required validation gate before publishing.
15. Generate the playable link, Instagram image and branded QR image automatically.
16. Email the link and both images to `andrewharris501@gmail.com` automatically after live verification.
16a. Start the automatic build record before artist research begins; never start timing only at coding or publishing.
16b. Record every genuinely available AI usage event, but never invent tokens, charges, exchange rates or per-build subscription costs.
16c. Close the record only after deployment verification and completion-email preparation; retain failed records and reasons.
16d. Send the generated completion-email body so every delivery includes BUILD SUMMARY, elapsed time, cost basis, build ID, URL and Git commit.
17. Update `DEEP_CUTS_PRODUCTION_MANUAL.md`, `CLAUDE.md`, `AGENTS.md`, `.agents/skills/deep-cuts-factory/SKILL.md` and `ROADMAP.md` whenever the workflow materially changes.
18. Make every future edition faster than the previous edition.
19. At the end of every completed task, ask internally: “What can I automate next?” Implement that improvement when practical.
20. Preserve analytics integrity: never collect unnecessary personal data, never block gameplay or outbound navigation on analytics, and never describe clicks or attempted shares as confirmed streams, sales, follows or published posts.

The preferred owner prompt is:

```text
Deep Cut [Band or Artist]
```

Do not require the owner to repeat the production model, question specification, design rules, publishing steps or email instructions.
