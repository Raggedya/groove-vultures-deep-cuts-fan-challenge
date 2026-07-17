# Research input contract

Create one UTF-8 JSON file with:

```json
{
  "bandName": "Artist name",
  "bio": "One concise, verified sentence describing the artist.",
  "newsLabel": "Optional short label for the selected coverage",
  "links": {
    "buyMusic": "", "spotify": "", "instagram": "", "bandcamp": "",
    "youtube": "", "facebook": "", "website": "", "merchandise": "",
    "tip": "", "newsReviews": ""
  },
  "sources": [
    {
      "destination": "spotify",
      "url": "https://...",
      "sourceType": "official artist profile",
      "identityVerified": true,
      "verifiedAt": "2026-07-17T00:00:00.000Z",
      "evidence": "Concise identity match evidence"
    }
  ]
}
```

Use exactly the fixed destination keys shown. Leave missing destinations blank. Include at least two identity-checked sources and at least one official artist-controlled source. Every enabled link needs matching evidence with the same normalized URL. For `newsReviews`, set `credibleEditorial: true`. For `tip`, set `authorization` to `artist-provided` or `owner-provided`; otherwise leave it blank.

