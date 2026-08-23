# Canonical Jukebox Module Lock

**Contract:** `canonical-mahogany-jukebox/v1`
**Status:** permanent, production-approved and immutable
**Known-good source:** `511084aa3b774098e0b2074c2f382a3e66ae296e`
**Known-good production Worker:** `774923fb-bf5a-4bc5-9a00-bd3aa601f266`

This file is the governing contract for the current Mahogany Jukebox widget/module. It supplements `PLATFORM_ARCHITECTURE_DIRECTIVE.md`. Preservation wins if the two are ever read ambiguously.

## North-star rule

The current Jukebox is a finished product surface. Functional expansion happens behind it, through its documented data inputs, inside its already designated content regions, or in separately mounted modules. It does not happen by rebuilding the machine.

For an ordinary future task:

- functional change to the requested isolated module may be allowed;
- unrequested change to `canonical-mahogany-jukebox/v1` must be zero;
- a feature that does not fit must be redesigned rather than moving the chassis.

General instructions such as “fix the app”, “make it better”, “implement the feature” or “do whatever is necessary” do not authorise a change to this contract.

## Canonical boundary

The machine-readable source of truth is `contracts/canonical-mahogany-jukebox-v1.json`. The fail-closed guard is `scripts/test-canonical-mahogany-jukebox-lock.mjs` and runs in the normal CI validation plan.

The protected module includes:

- renderer DOM hierarchy and structural class names;
- cabinet dimensions, aspect ratios and responsive master scaling;
- ticker, video, coin, four-key bank, Share, main-play and footer geometry;
- clipping, overflow, transforms, stacking and z-index relationships;
- fixed button hit areas and icon centring rules;
- coin, key and secret-screen interaction behaviour;
- animation geometry and timing;
- media fit and genuine-ended behaviour;
- external-tab, sharing, session restoration and accessibility behaviour;
- the current master, Miner’s Rest and preserved legacy layout profiles;
- current protected cabinet, marquee, coin and sound assets;
- the current renderer output and supported public input contract.

The central screen is a fixed viewport. Internal content adapts to it; it never expands for content. The ticker is a separate fixed viewport and is not screen space. The four physical buttons, coin, Share area and play control remain exactly where the canonical profiles place them.

## Permitted future extension points

Future work may be added without changing v1 through:

- customer data and content;
- existing title, ticker, video, skin and four-action inputs;
- approved content inside the current screen viewport;
- adapters translating new feature data into existing inputs;
- services for research, publishing, analytics, reporting and automation;
- separately scoped feature modules and locally scoped styles;
- an explicitly versioned successor module with an owner-approved migration.

Feature modules must not query or mutate protected DOM internals, inject geometry, override Jukebox CSS variables, introduce global selectors that reach the Jukebox, or depend on another customer’s configuration.

## Forbidden incidental changes

Without explicit, narrow owner authorisation, do not:

- reposition, resize, realign or re-space existing elements;
- alter screen, ticker, button, coin, Share, play, grille, trim or footer geometry;
- change proportions, breakpoints, responsive scaling, clipping or stacking;
- rename structural classes, simplify the DOM or replace positioning systems;
- consolidate, reorganise or modernise protected CSS;
- change animation or audio timing;
- change interaction hit areas, icon centring or media-fit behaviour;
- replace, regenerate or reinterpret protected assets;
- alter existing public configuration or renderer output;
- update a snapshot or hash merely to make CI pass;
- place a customer-specific exception in the shared canonical profile.

Stability takes priority over refactoring elegance.

## Mandatory impact assessment

Before every future task that can reach the Jukebox, record:

```text
Files expected to change:
[list]

Protected files or contracts affected:
[none, or exact paths/sections]

Geometry risk:
[low / medium / high]

Behavioural risk:
[low / medium / high]

Isolation strategy:
[how the requested work stays outside canonical v1]

Regression plan:
[focused tests, immutable guard, full validation and visual checks]
```

If a protected file, asset, snapshot, hash, geometry value or renderer contract appears to require modification, stop before editing and report:

1. the exact protected target;
2. why it appears necessary;
3. visible or behavioural effects;
4. isolated alternatives;
5. required regression coverage;
6. rollback and migration plan.

Proceed only after the owner explicitly authorises that exact protected change and its acceptance criteria.

## Versioning and baseline changes

Never silently redefine `canonical-mahogany-jukebox/v1`. A fundamental authorised change creates a named successor such as `canonical-mahogany-jukebox/v2`. Preserve v1, preserve existing published identities, add new baselines and provide an explicit migration and rollback plan. Existing editions do not migrate automatically.

Updating `contracts/canonical-mahogany-jukebox-v1.json`, any protected visual baseline, or the immutable guard is itself a protected change. It requires the same explicit owner authorisation as changing the renderer.

## Mandatory verification

Every Jukebox-adjacent change must run:

1. `node scripts/test-canonical-mahogany-jukebox-lock.mjs`;
2. the relevant focused Jukebox tests;
3. `npm run validate`;
4. visual comparison at the supported mobile and desktop widths when rendered output can be affected.

Automatic rejection conditions include a moved ticker, screen/ticker overlap, video outside the bevel, changed machine height, moved or off-centre buttons, content outside the screen, altered responsive scaling, changed protected output, weakened assertions or unexplained baseline regeneration.

## Final reporting requirement

Every completed Jukebox-adjacent task reports:

- files changed;
- whether protected files changed;
- functional, visual, behavioural and geometry effects;
- immutable-guard and full-validation results;
- viewport regression results where applicable;
- rollback point;
- remaining known risks.

A task is not complete merely because its new feature works. It is complete only when the requested change works and unauthorised canonical-module change remains zero.
