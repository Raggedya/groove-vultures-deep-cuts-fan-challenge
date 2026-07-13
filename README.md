# Groove Vultures Deep Cuts Fan Challenge

A premium, mobile-first fan quiz built from 36 source-verified Groove Vultures questions. Players receive twelve questions per game, with three completely fresh games before the library resets and reshuffles.

## The locked game model

- 36 active Deep Cuts questions, divided into three balanced 12-question groups.
- Every game contains 3 easy, 6 medium and 3 hard questions.
- Every game contains 3 Album Deep Cuts, 3 Song / Recording Deep Cuts, 2 Band Member, 2 Touring / Live and 2 Behind the Scenes questions.
- No question repeats during the first three games. A new shuffled cycle begins only after all 36 have appeared.
- Each question has four choices and a precise 15-second timer.
- Seconds 15-4 are silent; a short beep plays once at 3, 2 and 1.
- The established ding plays only when time reaches zero. Answering early cancels pending audio.
- The correct answer, short explanation and linked source remain visible for 10 seconds before the next question.
- The final screen shows the fan rating, statistics, original Aggits artwork and official Groove Vultures discovery links.

## Content and sources

Questions live in `data/questions.json`. Each item includes a unique ID, `roundGroup`, category, difficulty, four options, exact correct answer, 15-40-word explanation, source name, HTTPS source URL and active status.

Research is drawn from the band's own Bandcamp credits, its triple j Unearthed profile, and published interviews and reviews. Unverified trivia and guessed links are deliberately excluded.

Run the checks with Node.js:

```powershell
node scripts/validate-questions.mjs
node scripts/test-engine.mjs
node --check js/app.js
```

## Branding and artwork

- `assets/seven-seconds-aggits-master.png` is the approved original Aggits master. Do not redraw, regenerate or replace it.
- `assets/aggits-original-cutout-v4.png` preserves the exact original Aggits colour pixels with only the surrounding background made transparent.
- The cover uses one centred Aggits against the calm premium blue-to-black vignette, with no green background, duplicate character or decorative forehead line.
- Supporting screens use an original code-built blue-black gradient, so no artwork from another band is inherited.

## Official links

- Spotify: https://open.spotify.com/artist/4mxU5Dnd342CsqAS6viJuj
- Bandcamp: https://groovevultures.bandcamp.com/
- YouTube: https://www.youtube.com/@GrooveVultures
- Instagram: https://www.instagram.com/groovevultures/

## Local preview

Serve the folder through a small local server because the game loads JSON files:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`. No build step is required.

Before publishing, check common phone widths, all three fresh-game cycles, the 3-2-1 audio sequence, timeout ding, early-answer cancellation, result rankings, sharing, source links and the browser console.
