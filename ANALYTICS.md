# Deep Cuts Analytics

The discovery page records a band identifier, page identifier, timestamp, referring source and device category with each event. It separately records page views, share actions, successful native shares when the browser confirms them, copy actions, and Spotify, Bandcamp, Instagram, YouTube, Facebook, TikTok, website, ticket, merchandise, mailing-list and Tip clicks.

Open `analytics.html` to view band-level page views, shares, outbound clicks, platform totals, tip clicks and rates. With no reporting endpoint configured it shows only events stored in that browser. A configured HTTPS reporting endpoint can provide cross-visitor reporting.

Analytics is best-effort. It runs immediately before navigation and failures are ignored. Clicks measure intent only; they do not prove a stream, follow, sale, payment or published share. No passwords, payment details or social login data are collected.
