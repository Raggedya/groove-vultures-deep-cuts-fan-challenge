# Deep Cuts Racing — Version 1

Deep Cuts Racing is an isolated product module. It does not use or alter the Music, Cars, Clubs or Schools renderers, edition records, artwork, links or business rules.

## Protected architecture

- Public user interface: `/racing/`
- Backend boundary: `/api/racing/*`
- Database ownership: tables prefixed `racing_`
- Analysis engine: `racing/engine.js`
- Provider boundary: `worker/racing-provider.js`
- Racing API and reporting: `worker/racing.js`

Removing those files, the single route registration, the build-directory registration and migration leaves every existing edition operational.

## Evidence rules

The production service must receive a normalized race from a legally permitted structured provider. Missing values remain missing. Unavailable values are not counted as considered evidence. Sources include their name, URL, retrieval time, official status and staleness state. Duplicated tipster/outlet pairs count once.

The analysis is deterministic and transparent. It calculates runner evidence scores, normalized win probabilities and Plackett–Luce top-three probabilities. Confidence reflects evidence coverage, source quality, conflicts and separation between leading runners. It is not the same as win probability.

The engine abstains with `NO CLEAR SELECTION` when evidence is insufficient, conditions or scratchings are unresolved, sources materially conflict, the leaders are too close or confidence is low.

## Live provider contract

Configure the Cloudflare Worker secrets `RACING_DATA_API_URL` and `RACING_DATA_API_KEY` only after obtaining a permitted race/form feed. The configured service must expose:

- `GET {base}/race?date=YYYY-MM-DD&location=...&race_number=N`
- `GET {base}/result/{raceId}`

Without both secrets the public service deliberately returns `NO CLEAR SELECTION — Live official race data is not yet connected.` Test fixtures never run in production.

## Confirmed source limitations

- Racing Australia marks Victorian fields, form and results as copyrighted. Do not scrape or reproduce them without permission.
- Racing Victoria prohibits unauthorised reproduction. Use approved access or a licensed provider.
- Racing Queensland identifies a structured open-data service, making it a candidate future jurisdiction adapter subject to its current terms.
- Bureau of Meteorology commercial or service-continuity use may require registered or paid access and an appropriate licence.
- Regulated market feeds are optional and credential/licence controlled. Market movement is never described as inside information.
- Public previews are counted only when legally accessible, attributable and non-duplicated. Paywalls and access controls are never bypassed.

## Administration

The existing Deep Cuts admin token protects `/api/racing/dashboard`, `/api/racing/export.csv` and `/api/racing/results/sync`. The hourly scheduler checks for official results; without a provider it makes no change. CSV is Excel-compatible.

## Responsible-use boundary

Deep Cuts Racing provides statistical estimates and information. It never places bets, recommends stakes, chases losses or claims certainty or profit.
