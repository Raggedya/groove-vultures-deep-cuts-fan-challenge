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
    "newsReviews": ""
  },
  "featuredVideo": {
    "title": "Official video title",
    "youtubeURL": "https://www.youtube.com/watch?v=...",
    "selectionBasis": "most-viewed-official"
  },
  "sources": [
    {
      "destination": "spotify",
      "url": "https://...",
      "sourceType": "official artist profile",
      "identityVerified": true,
      "verifiedAt": "2026-07-17T00:00:00.000Z",
      "evidence": "Concise identity match evidence"
    },
    {
      "destination": "featuredVideo",
      "url": "https://www.youtube.com/watch?v=...",
      "sourceType": "official YouTube channel",
      "identityVerified": true,
      "verifiedAt": "2026-07-17T00:00:00.000Z",
      "evidence": "Most-viewed official music video on the artist's official channel at verification time"
    }
  ]
}
```

Use exactly the destination keys shown. Leave missing destinations blank; the live page omits them completely. Include at least two identity-checked sources and at least one official artist-controlled source. Every enabled link needs matching evidence with the same normalized URL. When an official YouTube presence exists, select the most-viewed official music video visible on the official artist channel at verification time and record matching `featuredVideo` evidence. For `newsReviews`, set `credibleEditorial: true`.

