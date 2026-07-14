# Deep Cuts Analytics

Deep Cuts now has one shared, privacy-conscious analytics layer for every band edition. Analytics is deliberately non-blocking: gameplay, sharing, copying and outbound navigation continue even when storage, Google Analytics or a collection endpoint fails.

## Current operating modes

The tracker always records a bounded local event log in the visitor's browser. This makes instrumentation testable and powers the built-in report at [`analytics.html`](analytics.html), whose heading clearly identifies that local-browser scope.

For aggregated reporting across all visitors, configure either:

- `platform.analytics.measurementId` with a GA4 web-stream ID such as `G-ABC123`; or
- `platform.analytics.endpoint` with an HTTPS first-party event collector and `platform.analytics.reportingEndpoint` with an HTTPS endpoint returning `{ "events": [...] }` for the built-in report.

No analytics account, measurement ID, collection endpoint or reporting credential is stored in this repository today. Adding one requires the platform owner's analytics-account authority and privacy approval. Never place an API secret in client-side files.

## Event context

Every event contains:

- `event_id` and ISO `timestamp`;
- `edition_id` and `band_name`;
- stable `quiz_identifier` and per-play `quiz_run_id` when a run exists;
- `referring_source`, reduced to an explicit campaign source or referring hostname;
- `device_category` (`mobile`, `tablet` or `desktop`);
- event-specific values such as `final_score`, `completion_time_seconds`, `destination_platform`, `share_method` and `share_action_id`.

The tracker does not collect names, email addresses, social logins, social-account identities or message contents. Outbound URLs are reduced to their origin before being stored.

## Events

Core journey:

- `quiz_page_viewed`
- `quiz_started`
- `quiz_completed` with final score, maximum score, completion time and classification

Sharing:

- `share_button_clicked`
- `share_method_selected`
- `native_share_opened`
- `native_share_completed` only after the browser resolves the Web Share request
- `native_share_cancelled` when the browser reports an abort
- `copy_link_clicked`
- `copy_link_succeeded` only after the Clipboard API resolves

The selected method is recorded separately as `native_device`, `facebook`, `x`, `whatsapp`, `messenger`, `email` or `copy_link`. A method selection is an attempted share action, not proof that content was published.

Outbound discovery:

- `spotify_clicked`
- `bandcamp_clicked`
- `instagram_clicked`
- `youtube_clicked`
- `facebook_clicked`
- `tiktok_clicked`
- `website_clicked`
- `tickets_clicked`
- `merchandise_clicked`
- `mailing_list_clicked`

Each outbound event is fired synchronously in the link click handler before the browser follows the link. It is never awaited. A click does not prove a stream, follow, ticket purchase, merchandise sale or any other conversion.

## Reporting formulas

The built-in report groups events by edition and displays:

- total page views, quiz starts and quiz completions;
- completion rate = completed quizzes ÷ quiz starts;
- average final score;
- share actions and share rate = share method selections ÷ completed quizzes;
- total outbound clicks and platform-specific clicks;
- outbound click-through rate = total outbound clicks ÷ completed quizzes.

Rapid duplicate taps on the same outbound or share control are suppressed for 500 milliseconds. Page views and completion events have stronger once-only guards, and UI listeners are registered only once at application startup.

## GA4 privacy configuration

When a GA4 measurement ID is supplied, Deep Cuts disables Google Signals and ad-personalisation signals in its configuration and prevents GA4's automatic page-view event so the explicit edition-aware event remains authoritative. The owner must still review local privacy, consent and disclosure obligations before enabling GA4.

## Validation

`scripts/test-analytics.mjs` verifies common context, correct edition assignment, duplicate suppression, independent platform events, sharing hooks and all reporting formulas. It is part of the normal `npm run validate` gate.
