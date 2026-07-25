# Laneway Edition

## Permanent product contract

Laneway is a separately typed Deep Cuts platform edition. The standard request is:

`Laneway [Band or Artist]`

It must not modify or inherit the appearance or quiz behaviour of Music, Cars, Clubs, Schools, Commercial Instinct or any lip-sync product.

## Locked presentation

- Exact source asset: `assets/laneway-music-logo-source.jpg`
- Treatment: deterministic reverse white; never redraw, restyle or retype the logo
- Palette: predominantly charcoal grey and black with white and restrained grey detail
- Character: none; Aggits is forbidden on the page, social image and QR artwork
- Buttons: charcoal surfaces, fine pale borders, white type
- Layout: mobile-first and consistent with the Deep Cuts discovery structure
- Hero labels: `Listen`, `Watch`, `Discover`, `Buy`
- Content order: official-label-selected featured YouTube video, verified artist destinations, five-question challenge, then `Home / Share / Recommended`
- Home and Recommended: verified direct links to the official Laneway Music home and artist catalogue
- Live and delivery footer: `DEEP CUTS` appears immediately above `copyright Clearlight Creative`; the word `Laneway` is not repeated in this footer

## Five-question challenge

Every edition has exactly five active questions in `editions/<slug>/laneway-questions.json`. Each question requires:

- a positive, informative prompt
- four unique choices
- one best answer
- a concise explanation that teaches something worthwhile
- a direct HTTPS source name and URL
- matching dated, identity-verified evidence in `research.json`

The experience gives immediate, friendly feedback and an encouraging result. It never mocks a wrong answer and never presents unsupported trivia.

## Research and publication

The official Laneway Music artist page supplies the verified featured YouTube selection. Verified music destinations follow the normal direct-link standard. Unavailable destinations are omitted. The factory, platform validator and Laneway-specific regression test must pass before publication. Delivery artwork uses the approved logo and charcoal identity, and the QR must scan back to the opaque `/q/<editionId>` route at full and reduced social-media size.

## One-off Laneway Music company page

The separately typed `laneway_company` edition is an approved one-off and does not change the standard `Laneway [Band or Artist]` workflow above. It has a logo-only heading, the owner-selected Celibate Rifles feature video, an isolated eight-question company quiz, and a searchable artist directory.

The directory begins with the official Laneway Music roster. An artist is published only when its official Laneway profile or a distinctive exact-name verification resolves to a direct `open.spotify.com/artist/...` destination. Ambiguous names fail closed. An official artist website is optional and appears only when it is explicitly published through a reliable artist or Laneway source. The resolver checkpoints its work, records omissions, and must finish with zero pending entries before publication.
