# Deep Cuts Decision Intelligence: Sell to this company

This module is a private, evidence-led sales-preparation pathway. It is not a company directory, lead scraper or outreach tool. It turns current public evidence into clearly labelled facts, interpretations, unknowns and practical questions.

## Architecture and isolation

The module lives at `/sell/` and its API lives only under `/api/sell/*`. It does not enter the edition registry and does not import from Music, Cars, Clubs or Schools.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Mobile client | `sell/index.html`, `sell/styles.css`, `sell/app.js` | Search, confirmation, supplier context, layered briefing, copy, print/PDF and private sharing |
| Shared sales schema | `sell/schemas.js` | Business identity, evidence, interpretation, confidence and current-person validation |
| Verified demo | `sell/demo-data.js` | Complete Telstra workflow with dated public evidence; not a hard-coded application architecture |
| Worker API | `worker/sales.js` | Identification, research-provider boundary, validation, private saving and anonymous analytics |
| Private storage | `migrations/0002_sales_intelligence.sql` | Sales-only tables; no dependency on edition tables |
| Regression gate | `scripts/test-sales-intelligence.mjs` | Evidence, privacy, executive and navigation invariants |

Existing edition routes, configurations, renderers and assets are not changed. The only shared Worker change is one namespaced dispatch line. The Cloudflare bundler copies the new `sell` directory without altering prior outputs.

## Local setup

1. Run `npm run validate`.
2. Run `npm run build`.
3. Run `npm run sales:demo` for a credential-free local preview, or `npx wrangler dev` for the full Worker.
4. Open `/sell/` and enter `Telstra`.

The Telstra demo exercises business confirmation, optional supplier input, honest progress, all 17 Deep Cuts, current leadership, evidence, unknowns, copying, saving and PDF export.

## Live research provider

Generic live research passes through one private provider adapter. Configure these optional Cloudflare secrets:

* `SALES_RESEARCH_API_URL` — HTTPS endpoint for the approved research service.
* `SALES_RESEARCH_API_KEY` — bearer credential sent only from the Worker.

The browser never receives either value. If they are absent, the verified demonstration continues to work and arbitrary research fails clearly. The product never fills the gap with invented information.

### Provider request contract

The Worker sends one of two POST requests:

* `{ operation: "identify", query, website, location }`
* `{ operation: "research", business, offering, objective: "sell_to_company", requiredSchema: "deep-cuts-sales-1.0" }`

Identification must return `{ matches: BusinessIdentity[] }`. Research must return `{ report: SalesReport }`. The Worker rejects malformed identities, reports without sources, unsupported insights, invalid source references, unverifiable executives and any person record containing email or phone data.

The provider must use public, legally accessible sources. It must not bypass logins, paywalls, robots controls or rate limits. Source retrieval and AI synthesis can happen inside the provider, but returned evidence, facts and recommendations must remain separate.

## Schemas, evidence and confidence

`sell/schemas.js` is the executable contract. Every report includes a confirmed identity, optional supplier context, research dates, a full source register, all required sections, explicit claim status, confidence, source IDs and visible unknowns.

A recommendation is never stored as a source fact. A fact can support an interpretation; an interpretation can support a recommendation; all three remain distinguishable.

Prefer official company sources, regulators, stock-exchange material, official procurement portals and credible industry or news sources in that order. Important claims should use more than one source where practical. Publication and access dates must be retained. Historical information must be labelled. Conflicting sources must both be shown and explained.

* **High confidence** — direct, current and authoritative evidence with no material unresolved conflict.
* **Moderate confidence** — credible evidence supports a reasonable interpretation, but an internal condition or current detail remains unverified.
* **Low confidence** — limited public evidence supports only a tentative hypothesis.

Low confidence is not hidden. An unknown is useful when paired with a question that can validate it.

## Executive verification

Named people must come from a current official company page or another credible professional source. Each record needs a verification date and source. The module never guesses email addresses, supplies private phone numbers, builds personal profiles or recommends bypassing procurement. If a person cannot be verified, show relevant teams and roles instead.

## Privacy and security

Sales briefings are separate from edition analytics. Product events record only an anonymous session ID, event name, section, device category and limited outcome metadata. Target-company search terms and supplier strategy are not stored in analytics.

Saved briefings use a random 256-bit access token. Only its SHA-256 hash is stored. The raw token is placed in the URL fragment, which is not sent to the server as part of the URL request. A bearer token is required to retrieve the briefing. Saved briefings expire after 30 days. The application is marked `noindex,nofollow`.

This is decision support, not a promise that a company will buy or that public information reveals internal conditions. No outreach, supplier form or contact action is automated.

## Save, export and share

“Save privately” stores a validated report and copies a private 30-day link. “Export PDF” opens the device’s print dialogue with a clean, complete briefing; choose Save as PDF. Individual sections can be copied. Source links remain clickable.

## Analytics

The sales-only allow-list includes business search and confirmation, supplier context, research start/completion/failure, section/source/strategy/meeting views, export, save, private-share creation, low-confidence result and new search. Analytics failure never interrupts research, navigation, saving or export.

## Testing and deployment

`npm run validate` runs every existing edition regression suite plus the sales-intelligence suite. The new suite checks disambiguation, offering-aware analysis, required sections, source attribution, unsupported-claim rejection, current executive validation, prohibition of guessed contacts, token hashing, navigation, copy/export, isolated API routes and independent tables.

`npm run build` includes `/sell/` in `dist`. Existing Cloudflare deployment applies the D1 migration automatically. Research-provider secrets are optional, so their absence cannot break existing deployment.

## Adding a future decision pathway

Add a separate route, schema, provider objective, storage namespace, UI and test contract. Reuse neutral services only when behaviour is genuinely shared. Do not expose a partial option. A future pathway must be complete, isolated and removable before release.
