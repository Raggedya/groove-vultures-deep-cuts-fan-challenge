# Deep Cuts Production Manual

Version: 1.1
Status: Permanent project constitution  
Primary KPI: Reduce elapsed production time and owner interaction for every new edition.  
Secondary KPI: Improve research, product and visual quality without slowing repeat production.

## 1. Product definition

Deep Cuts is a reusable publishing platform for premium, mobile-first band and artist fan challenges. It is not a collection of unrelated quiz repositories.

The platform turns one short instruction—normally `Deep Cut [Band or Artist]`—into:

1. a researched, source-linked Deep Cuts edition;
2. a public playable link hosted from this permanent repository;
3. a square Instagram promotional image;
4. a square branded QR image linking to the edition; and
5. one completion email containing the link and both images.

The owner is not a software developer. Repetitive GitHub, PowerShell, file-copying, configuration and deployment work must be automated rather than delegated to the owner.

## 2. Product philosophy

Every question must satisfy this test:

> The band themselves should smile and ask: “How did they know that?”

Deep Cuts must reward curiosity rather than memorisation of obvious facts. Wikipedia-style trivia, chart-position lists, birth dates, generic discographies and facts visible in the first paragraph of a search result are unacceptable unless they unlock a genuinely interesting story.

Every answer should reveal an interesting story. Every edition should teach fans something. The player should finish knowing more about the people, recordings, creative process and lived history behind the music.

## 3. Engineering philosophy

- Maintain one engine, one validation system, one publishing workflow and one deployment target.
- Store edition-specific content only in edition configuration, question data and generated edition assets.
- Never duplicate engine code, styles, audio logic, workflows or deployment configuration for an edition.
- Prefer deterministic scripts for repeated operations.
- Make every future edition faster than the previous edition.
- Convert any repeated manual step into automation when practical.
- Keep the owner out of PowerShell and GitHub whenever an authorised tool or workflow can complete the work.
- Preserve backwards compatibility for published edition URLs whenever reasonably possible.
- Update this manual, `CLAUDE.md`, `AGENTS.md`, the Deep Cuts Factory skill and `ROADMAP.md` whenever the production workflow changes.

## 4. Locked experience

Unless this constitution is deliberately amended, every Deep Cuts edition uses:

- 36 active, source-verified questions;
- three fresh games of 12 questions before any question repeats;
- 3 easy, 6 medium and 3 hard questions per game;
- 3 Album Deep Cuts, 3 Song / Recording Deep Cuts, 2 Band Member, 2 Touring / Live and 2 Behind the Scenes questions per game;
- four unique answer choices;
- a 15-second countdown;
- silence from 15 through 4;
- one short beep at 3, 2 and 1;
- the established ding once, and only once, when time reaches zero;
- no ding when an answer is selected early;
- 10 seconds of answer, explanation and source feedback;
- automatic movement to the next question after feedback;
- a final fan rating, score and discovery links;
- a replay that draws a fresh unused 12-question group until all 36 questions have appeared.

## 5. Question standards

Each question must:

- be answerable from its linked source;
- contain one unambiguous correct answer;
- provide three plausible but clearly incorrect alternatives;
- avoid trick wording and avoid relying on an ambiguous date, lineup or interpretation;
- use an explanation of 15–40 words that adds story or context rather than merely repeating the answer;
- name the source and link to an HTTPS source;
- use a unique ID, category, difficulty and round group;
- remain concise enough for a common mobile portrait screen;
- be original writing, not copied prose.

Reject questions that are:

- generic biography facts;
- easily guessed from the band name or question wording;
- unsupported fan lore;
- based only on scraped snippets when the underlying source cannot be verified;
- duplicated in meaning, even if phrased differently;
- time-sensitive without a stable source and clear date context;
- defamatory, invasive, unsafe or unrelated to the music and public creative work.

## 6. Research standards

Use this source hierarchy, strongest first:

1. official artist releases, liner notes, Bandcamp credits, official websites and verified artist channels;
2. direct interviews containing the band’s own words;
3. reputable music publications, broadcasters and venue or festival archives;
4. specialist reviews when they describe an observable musical or narrative detail;
5. secondary databases only to corroborate, never as the sole basis for a “Deep Cut.”

For every question:

- open and inspect the supporting source;
- distinguish direct facts from interpretation;
- cross-check unstable facts such as current lineup and platform links;
- record the canonical source URL;
- exclude any fact with material unresolved uncertainty.

Official Spotify, YouTube, Bandcamp and Instagram links must be verified. Never invent or guess a platform URL.

## 7. Brand and visual integrity

- Use the exact approved original Aggits artwork. Never redraw, regenerate, reinterpret or replace the character.
- Show Aggits once on the opening cover, prominently and without overlapping imagery.
- Preserve the character’s proportions, face, tattoos, clothing, name and colour pixels.
- Use the calm premium blue-to-black Deep Cuts vignette. Do not introduce green or gold as the principal palette.
- Show the band name once on the cover, large, clear and visually dominant.
- Keep the cover minimal: `The Official Fan Challenge`, band name, Aggits, start control, sound control and the subtle copyright line only.
- Display `copyright Clearlight Creative` in tiny, unobtrusive text at the bottom of the cover.
- Keep the countdown circle centred and prominent.
- Make official music-platform links visibly pulse and glow while respecting reduced-motion preferences.

## 8. Required social outputs

Every completed edition must generate two 1080 × 1080 PNG files:

### Instagram promotional image

- premium blue-black Deep Cuts background;
- exact Aggits head and shoulders;
- band or artist name above Aggits;
- `OFFICIAL FAN CHALLENGE` at the bottom;
- high contrast and safe margins for Instagram cropping.

### Branded QR image

- a high-error-correction QR code pointing to the final public edition URL;
- band or artist name and Deep Cuts styling;
- exact Aggits artwork incorporated without reducing scan reliability;
- a quiet-zone and contrast check;
- automated scan-back verification before delivery.

Do not use generative image tools to recreate Aggits. Social assets must be composed deterministically from the approved master artwork.

## 9. Repository and edition structure

This repository is the permanent Deep Cuts master repository.

- Shared engine code belongs in `js/`, shared styles in `styles.css`, shared audio and approved brand assets in `assets/`.
- Each edition belongs in `editions/<slug>/` and contains only its configuration, questions and edition-specific generated metadata.
- Generated delivery assets belong in `output/<slug>/`.
- The edition registry determines which editions are published.
- A new edition must never require copying the application engine or creating another repository.

## 10. Validation and testing gates

Publishing must stop automatically if any required check fails.

Required automated checks:

1. valid JSON and required configuration fields;
2. exactly 36 active questions;
3. unique question IDs and normalised question text;
4. four unique options and one exact correct answer per question;
5. explanations between 15 and 40 words;
6. HTTPS source URLs and source names;
7. exact difficulty and category mix for each 12-question round group;
8. three games with no repeated question before bank exhaustion;
9. JavaScript syntax and engine tests;
10. 15-second timer, 3–2–1 beeps, timeout ding and early-answer cancellation;
11. 10-second feedback and results classifications;
12. responsive cover, quiz and result layouts;
13. exactly one cover Aggits and one band-name heading;
14. valid official platform links;
15. generated 1080 × 1080 social files;
16. QR scan-back resolves to the intended public URL;
17. clean browser console on the live edition.

## 11. Deployment standard

- Publish all editions from this single repository and GitHub Pages site.
- Use stable edition URLs derived from the edition slug.
- Run local validation before committing.
- Run continuous integration on every proposed platform change.
- Deploy only a validated build.
- Verify the live URL, not merely the repository files.
- Never require the owner to create a repository, select a branch, enable Pages or paste repetitive commands for a normal edition.

## 12. Completion and delivery standard

An edition is complete only when:

- the 36-question bank passes all checks;
- the live playable URL returns and works;
- mobile cover, gameplay, results, replay and official links are verified;
- both square social assets pass size and QR checks;
- the final link and both image files are emailed automatically to `andrewharris501@gmail.com`;
- the final response leads with the playable link and confirms email delivery.

The completion email must include the playable link, repository/platform link, edition summary and both PNG attachments.

### Automatic build record and email summary

Every edition begins by creating a unique build record before research starts. The same record remains open through research, source verification, question and image production, testing, correction, GitHub publication, deployment verification and completion-email preparation.

The completion email must always contain a clearly visible `BUILD SUMMARY` with the build cost in Australian dollars when honestly measurable, the Actual/Calculated/Estimated/Unavailable cost basis, full elapsed production time, completion date, build ID, live URL and Git commit.

Completed and failed records are permanently appended to `build-records/builds.jsonl`. A failed build retains elapsed time, available usage and its failure reason. A resumed run must link to the original build ID or deliberately continue the existing record.

Cost reporting includes only measurable AI and metered-service usage attributable to the edition. It never includes owner labour, salary, review time or an arbitrary share of a subscription. Usage may record provider, model, calls, input, cached input, output and reasoning tokens, direct charges, image charges and research charges.

Use actual provider charges when available. Otherwise calculate from recorded usage and current official rates in `config/ai-pricing.json`. Convert measurable USD totals using the configured USD-to-AUD rate or public rate source, and store the rate, date and source. If Codex exposes insufficient per-build data, report `AI build cost: unavailable from current Codex usage data`; never invent precision.

Build-tracking defaults live in `config/build-tracking.json`. Environment overrides are documented in `.env.example`; secrets must never be stored in source code.

## 13. Change control

Protect these invariants unless the owner explicitly changes the constitution:

- exact original Aggits;
- 36 questions and three fresh 12-question games;
- 15-second countdown;
- 10-second feedback;
- established beep and ding behaviour;
- blue-black premium visual system;
- one permanent repository and shared engine;
- automatic social assets and completion email.
- automatic complete-build timing, honest AI cost classification and the email build summary.

Before accepting a change, ask internally:

1. Does it reduce production time?
2. Does it reduce owner interaction?
3. Does it preserve or improve quality?
4. Can it be implemented once in the platform instead of per edition?

At the end of every task, ask: **“What can I automate next?”** Implement the answer when practical and safe.
