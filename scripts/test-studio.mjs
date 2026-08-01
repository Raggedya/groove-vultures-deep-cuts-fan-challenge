import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  StudioValidationError,
  applyRevision,
  attachMp4,
  createProject,
  renderStudioPreview,
  updateProject
} from "./studio-model.mjs";
import {
  STUDIO_JOOKBOX_RESEARCH_SCHEMA,
  researchFingerprint
} from "./studio-jookbox-research.mjs";
import {createStudioServer} from "./studio-server.mjs";

const fixedDate=new Date("2026-07-29T00:00:00.000Z");
const music=createProject({
  name:"Test Artist",
  type:"music",
  aggitsOption:"none",
  sourceUrls:["official.example.com","https://official.example.com/about#history"],
  sourceLabels:["Official home","Artist story"],
  youtubeUrl:"https://youtu.be/dQw4w9WgXcQ",
  brief:"A concise discovery preview.",
  posterHeading:"Scan to discover Test Artist"
},fixedDate);

assert.match(music.id,/^studio_[a-f0-9]{12}$/);
assert.equal(music.input.aggitsOption,"aggits-original","Music drafts must retain the immutable approved Aggits artwork.");
assert.deepEqual(music.input.sourceUrls,["https://official.example.com/","https://official.example.com/about"]);
assert.deepEqual(music.input.sourceLabels,["Official home","Artist story"]);
assert.equal(music.input.posterHeading,"Scan to discover Test Artist");
assert.equal(music.readiness.productionReady,false,"Studio drafts may never bypass production verification.");
assert.equal(music.readiness.confidenceGate,98);
assert.equal(music.input.type,"music","Existing Studio category identifiers must remain readable.");
assert.equal(music.input.addWheel,false,"The optional wheel must default to No.");

const restaurant=createProject({
  name:"Test Restaurant",
  type:"restaurant",
  aggitsOption:"aggits-original",
  addWheel:true,
  sourceUrls:["https://restaurant.example.com"],
  brief:"A verified dining preview."
},fixedDate);
assert.equal(restaurant.input.type,"restaurant");
assert.equal(restaurant.input.addWheel,true);
assert.match(renderStudioPreview(restaurant),/OPTIONAL DISCOVERY WHEEL/);
assert.match(renderStudioPreview(restaurant),/SPIN TO EXPLORE/);

const jookBox=createProject({
  name:"Test JookBox Band",
  type:"jookbox",
  aggitsOption:"aggits-original",
  addWheel:true,
  sourceUrls:["https://band.example.com"]
},fixedDate);
assert.equal(jookBox.input.aggitsOption,"none","JookBox must never inherit Aggits.");
assert.equal(jookBox.input.addWheel,false,"JookBox must never inherit a spinning wheel.");
assert.match(renderStudioPreview(jookBox),/jookbox-atlas-reference-v1\.webp/);
assert.match(renderStudioPreview(jookBox),/RESEARCH NOT RUN/);

const barEditionDraft=createProject({
  name:"Shotkickers",
  type:"bar_jukebox",
  aggitsOption:"aggits-original",
  addWheel:true,
  sourceUrls:[
    "https://venue.example.com/gigs",
    "https://venue.example.com/menu",
    "https://venue.example.com/contact",
    "https://instagram.com/example.venue",
    "https://facebook.com/example.venue"
  ],
  sourceLabels:["Gigs","Menu","Contact Us","Instagram","Facebook"],
  youtubeUrl:"https://youtu.be/dQw4w9WgXcQ",
  tickerText:"SHOTKICKERS — LIVE MUSIC, GIGS, DRINKS AND GOOD TIMES IN MELBOURNE.",
  aboutText:"Administrator-approved Shotkickers location and venue information."
},fixedDate);
assert.equal(barEditionDraft.input.aggitsOption,"none","Bar Edition must never inherit Aggits.");
assert.equal(barEditionDraft.input.addWheel,false,"Bar Edition must never inherit a spinning wheel.");
assert.equal(barEditionDraft.input.youtubeUrl,"","Bar Edition uses the administrator's local MP4 rather than YouTube.");
assert.equal(barEditionDraft.input.aboutText,"Administrator-approved Shotkickers location and venue information.");
assert.equal(barEditionDraft.readiness.handoffReady,false,"The static handoff must wait for the local MP4.");
const barEdition=attachMp4(barEditionDraft,{fileName:"shotkickers-welcome.mp4",sizeBytes:1024,sha256:"a".repeat(64)},fixedDate);
assert.equal(barEdition.readiness.handoffReady,true);
const revisedBar=applyRevision(barEditionDraft,"Change About Us to Shotkickers venue story supplied by the administrator.",new Date("2026-07-29T00:00:30.000Z"));
assert.equal(revisedBar.project.input.aboutText,"Shotkickers venue story supplied by the administrator");
assert.match(revisedBar.entry.changes.join(" "),/About Us copy updated/);
const barPreview=renderStudioPreview(barEdition,{videoUrl:"/api/studio/projects/studio_example/video"});
assert.match(barPreview,/jookbox-bar-heritage-brass-v1\.png/);
assert.match(barPreview,/class="coin-label">INSERT COIN</);
assert.doesNotMatch(barPreview,/Drag coin up to play/);
assert.match(barPreview,/\.machine\.is-awake \.coin\{animation:none!important;opacity:0;filter:none;box-shadow:none\}/);
assert.match(barPreview,/machine\.classList\.remove\("is-powering","is-accepting"\)/);
assert.match(barPreview,/\.title\{[^}]*top:6\.15%;[^}]*height:12\.7%/);
assert.match(barPreview,/\.ticker span\{[^}]*white-space:nowrap/);
assert.match(barPreview,/\.copyright\{[^}]*background:linear-gradient\([^}]*#c69d58/);
assert.doesNotMatch(barPreview,/\.title small:after\{[^}]*content:"BAR EDITION"/);
assert.match(barPreview,/jukebox-real-coin-insert-cc0\.mp3/);
assert.match(barPreview,/WELCOME VIDEO|welcomeVideo/);
assert.match(barPreview,/Gigs/);
assert.match(barPreview,/Contact Us/);
assert.match(barPreview,/id="aboutKey"/);
assert.match(barPreview,/id="aboutScreen"/);
assert.doesNotMatch(barPreview,/id="shareKey"/);
assert.match(barPreview,/id="sharePanel"/);
assert.match(barPreview,/Administrator-approved Shotkickers location and venue information/);
assert.match(barPreview,/Share Shotkickers with your mates/);
assert.match(barPreview,/Public sharing activates after deployment/);
assert.doesNotMatch(barPreview,/url:location\.href/);
assert.match(barPreview,/target="_blank" rel="noopener noreferrer"/);
assert.match(barPreview,/setTimeout\(\(\)=>machine\.classList\.add\("is-neon-on"\),800\)/);
assert.match(barPreview,/video\.play\(\)/);
assert.match(barPreview,/No web lookup runs for Bar Edition/);

const school=createProject({
  name:"Test School",
  type:"school",
  aggitsOption:"aggits-original",
  sourceUrls:["https://school.example.edu.au"],
  brief:"A positive School Discovery preview."
},fixedDate);
assert.equal(school.input.aggitsOption,"none","School Discovery must never inherit Aggits.");

const hgm=createProject({
  name:"High Grade Mechanical",
  type:"business",
  aggitsOption:"hgm-owner-supplied",
  sourceUrls:["https://www.hgmechanical.com.au"],
  brief:"A locked HGM recruitment preview."
},fixedDate);
assert.equal(hgm.input.aggitsOption,"hgm-owner-supplied","The exact HGM project may select its owner-supplied orange hi-vis Aggits.");
const otherBusiness=createProject({
  name:"Another Business",
  type:"business",
  aggitsOption:"hgm-owner-supplied",
  sourceUrls:["https://business.example.com"],
  brief:"A different business preview."
},fixedDate);
assert.equal(otherBusiness.input.aggitsOption,"aggits-original","HGM-owned Aggits artwork must never be reusable by another business.");

assert.throws(
  ()=>createProject({name:"Unsafe",sourceUrls:["http://example.com"]},fixedDate),
  error=>error instanceof StudioValidationError&&error.code==="invalid_url"
);
assert.throws(
  ()=>createProject({name:"Bad video",youtubeUrl:"https://example.com/video"},fixedDate),
  error=>error instanceof StudioValidationError&&error.code==="invalid_youtube_url"
);

const revision=applyRevision(music,"Change the name to Test Artist Two. Change the type to individual band. Replace URL 2 with https://official.example.com/music. Change button 2 to Music archive. Change the poster heading to Scan for Test Artist Two. Add the spinning wheel. Remove the YouTube link.",new Date("2026-07-29T00:01:00.000Z"));
assert.equal(revision.project.input.name,"Test Artist Two");
assert.equal(revision.project.input.type,"individual_band");
assert.equal(revision.project.input.sourceUrls[1],"https://official.example.com/music");
assert.equal(revision.project.input.sourceLabels[1],"Music archive");
assert.equal(revision.project.input.posterHeading,"Scan for Test Artist Two");
assert.equal(revision.project.input.addWheel,true);
assert.equal(revision.project.input.youtubeUrl,"");
assert.equal(revision.entry.applied,true);
assert.equal(revision.entry.changes.length,7);

const unparsed=applyRevision(revision.project,"Make everything more exciting.",new Date("2026-07-29T00:02:00.000Z"));
assert.equal(unparsed.entry.applied,false);
assert.equal(unparsed.project.revisionHistory[0].instruction,"Make everything more exciting.");

const preview=renderStudioPreview(updateProject(school,school.input,fixedDate));
assert.match(preview,/DRAFT PREVIEW/);
assert.doesNotMatch(preview,/<img class="preview-aggits"/,"No-Aggits product contracts must omit character markup.");
assert.match(preview,/<footer aria-label="Deep Cuts platform"><strong>Deep Cuts<\/strong><br>Copyright Clearlight Creative<\/footer>/);
assert.doesNotMatch(preview,/<script/i,"Studio preview output must remain script-free.");

const sourceFiles=await Promise.all([
  fs.readFile("studio/index.html","utf8"),
  fs.readFile("studio/styles.css","utf8"),
  fs.readFile("studio/app.js","utf8"),
  fs.readFile("studio/venue-library.html","utf8"),
  fs.readFile("studio/venue-library.css","utf8"),
  fs.readFile("studio/venue-library.js","utf8"),
  fs.readFile("studio/desktop-main.mjs","utf8"),
  fs.readFile("scripts/studio-server.mjs","utf8"),
  fs.readFile("forge.config.cjs","utf8"),
  fs.readFile("package.json","utf8"),
  fs.readFile(".github/workflows/build-deep-cuts-studio-macos.yml","utf8"),
  fs.readFile("scripts/build-cloudflare.mjs","utf8"),
  fs.readFile("worker/index.js","utf8"),
  fs.readFile("js/app.js","utf8")
]);
const [html,css,app,venueHtml,venueCss,venueApp,desktopMain,serverSource,forgeConfig,packageSource,macWorkflow,cloudflareBuild,worker,discoveryApp]=sourceFiles;
assert.match(html,/Deep Cuts Studio/);
assert.match(html,/Copyright Clearlight Creative/);
assert.match(html,/APPLY EDITS &amp; RE-CREATE/);
assert.match(html,/id="poster-canvas" width="1080" height="1080"/);
assert.match(html,/id="logo-file"/);
assert.match(html,/Add a spinning wheel\?/);
assert.match(html,/id="research-result"/);
assert.match(html,/id="run-description"/);
assert.match(html,/id="bar-ticker"/);
assert.match(html,/id="bar-about"/);
assert.match(html,/id="mp4-file"/);
assert.match(html,/id="source-label-5"/);
assert.match(html,/id="source-url-5"/);
assert.match(html,/id="aggits-step"/);
assert.match(html,/id="project-name-label"/);
assert.match(html,/id="qr-output-title"/);
assert.match(html,/href="\/studio\/venue-library\.html"/);
assert.match(html,/<aside class="output-column" hidden aria-hidden="true">/,"The retired right-hand Studio column must remain absent from the visible interface.");
assert.match(html,/name="addWheel" value="yes"/);
assert.ok(html.indexOf('id="aggits-option"')<html.indexOf('id="project-name"'),"Aggits selection must be the first project input.");
assert.match(html,/<details class="optional-fields" id="optional-fields">/);
assert.match(html,/Optional media &amp; poster/);
assert.match(app,/SpeechRecognition/);
assert.match(app,/DOWNLOAD POSTER|downloadPoster/);
assert.match(app,/owner-supplied HGM orange hi-vis artwork/);
assert.match(app,/els\.aggitsStep\.hidden=jukeboxProduct/,"Both JookBox products must hide irrelevant Aggits controls.");
assert.match(app,/field\.hidden=jookBox/,"The JookBox intake must not ask the owner to label research URLs manually.");
assert.match(app,/type\?\.id==="bar_jukebox"/);
assert.match(app,/Build the local MP4 JookBox with five links, About Us and the Share bar/);
assert.match(app,/renderPublicationPendingPoster\(\)/);
assert.match(app,/PUBLIC QR CREATED AFTER DEPLOYMENT/);
assert.match(app,/els\.qr\.hidden=bar/);
assert.match(app,/els\.downloadPoster\.hidden=bar/);
assert.match(app,/els\.downloadQr\.hidden=bar/);
assert.doesNotMatch(app,/This QR opens the private preview on this computer/);
assert.match(css,/--orange:#f38a45/);
assert.match(css,/\.bar-jukebox-mode/);
assert.match(css,/Compact top-left production intake/);
assert.match(css,/Minimalist project controls/);
assert.match(css,/grid-template-columns:minmax\(500px,1fr\) 440px/,"Studio must use the simplified two-column builder and phone-preview layout.");
assert.match(venueHtml,/Venue Library/);
assert.match(venueHtml,/Synchronise Master CSV/);
assert.match(venueHtml,/Update All Venues/);
assert.match(venueHtml,/Requires hosted analytics/);
assert.match(venueCss,/\.health-card\.red/);
assert.match(venueApp,/\/api\/studio\/venues\/import\/preview/);
assert.match(venueApp,/BarcodeDetector/);
assert.match(discoveryApp,/rootPath\(editionEntry\.config\)/,"Dynamic edition configuration paths must tolerate an existing leading slash.");
assert.match(discoveryApp,/function rootPath\(value\)/,"The public loader must normalize root-relative configuration paths.");
assert.match(desktopMain,/app\.getPath\("userData"\)/,"Desktop drafts must live outside the packaged application.");
assert.match(desktopMain,/boundedSmokeTestSwitch="deep-cuts-bounded-smoke-test"/,"Packaged verification must be able to run without disturbing an already-open installed Studio.");
assert.match(desktopMain,/app\.commandLine\.hasSwitch\(boundedSmokeTestSwitch\)/,"Electron must recognise the bounded-test switch after Chromium command-line parsing.");
assert.match(desktopMain,/DEEP_CUTS_BOUNDED_SMOKE_TEST/,"Bounded verification must retain an environment fallback for packaged Windows tests.");
assert.match(desktopMain,/if\(isBoundedSmokeTest\)\{\s*app\.disableHardwareAcceleration\(\);[\s\S]*?app\.enableSandbox\(\);/,"Restricted smoke tests must disable GPU rendering before sandbox initialisation without changing normal desktop rendering.");
assert.match(desktopMain,/async function runBoundedPackageSmokeTest\(\)/,"The packaged smoke test must verify the local Studio server without requiring a sandbox GPU renderer.");
assert.match(desktopMain,/html\.includes\('class="output-column" hidden'\)/,"The packaged smoke test must verify the simplified owner interface.");
assert.match(desktopMain,/venueHtml\.includes\("Venue Library"\)/,"The packaged smoke test must verify the Venue Library surface.");
assert.match(desktopMain,/if\(isBoundedSmokeTest\)\{\s*await runBoundedPackageSmokeTest\(\);\s*await stopStudioServer\(\);\s*app\.exit\(0\);\s*return;/,"Bounded verification must close its local server and exit without opening a hardware-rendered test window.");
assert.match(desktopMain,/isBoundedSmokeTest\|\|app\.requestSingleInstanceLock\(\)/,"Normal desktop launches must retain the single-instance lock.");
assert.match(desktopMain,/contextIsolation:true/);
assert.match(desktopMain,/nodeIntegration:false/);
assert.match(desktopMain,/sandbox:true/);
assert.match(desktopMain,/listen\(0,"127\.0\.0\.1"/,"Desktop Studio must use a local ephemeral port.");
assert.match(desktopMain,/url\.protocol==="https:"/,"Desktop external navigation must permit validated HTTPS only.");
assert.match(serverSource,/listen\(port,"127\.0\.0\.1"/,"Studio must bind only to the local computer.");
assert.match(forgeConfig,/asar:\{unpack:/);
assert.match(forgeConfig,/@electron-forge\/maker-squirrel/);
assert.match(forgeConfig,/@electron-forge\/maker-dmg/);
assert.match(forgeConfig,/studio-jookbox-research\.mjs/);
assert.match(forgeConfig,/venue-library-server\.mjs/);
assert.match(forgeConfig,/jookbox-venue-qr-master-v1\.png/);
assert.match(forgeConfig,/jookbox-atlas-reference-v1\.webp/);
assert.match(forgeConfig,/jookbox-bar-heritage-brass-v1\.png/);
assert.match(forgeConfig,/jukebox-real-coin-insert-cc0\.mp3/);
assert.match(packageSource,/"studio:desktop": "electron-forge start"/);
assert.match(packageSource,/"studio:make": "node scripts\/build-studio-windows\.mjs"/);
const windowsBuilder=await fs.readFile(path.join(process.cwd(),"scripts","build-studio-windows.mjs"),"utf8");
assert.match(windowsBuilder,/electron-v\$\{electronVersion\}-win32-x64\.zip/);
assert.match(windowsBuilder,/iexpress\.exe/);
assert.match(windowsBuilder,/Deep-Cuts-Studio-\$\{version\}-Windows-x64\.zip/);
assert.match(windowsBuilder,/SHA256SUMS\.txt/);
assert.match(windowsBuilder,/INSTALL ON WINDOWS\.txt/);
assert.match(windowsBuilder,/venue-qr-artwork\.mjs/);
assert.match(windowsBuilder,/"sharp"/);
assert.match(windowsBuilder,/asar:\{unpack:/);
assert.match(macWorkflow,/arch:\s*\n\s*- arm64\s*\n\s*- x64/);
assert.match(macWorkflow,/npm run studio:test/);
assert.match(macWorkflow,/out\/make\/\*\*\/\*\.dmg/);
assert.doesNotMatch(cloudflareBuild,/['"]studio['"]/,"The private Studio must not be copied into the public Cloudflare bundle.");
assert.doesNotMatch(worker,/\/api\/studio\//,"The private Studio must not expose public Worker routes.");

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),"deep-cuts-studio-test-"));
const token="test-token";
const server=createStudioServer({
  root:process.cwd(),
  dataDir:temporary,
  token,
  researcher:async input=>verifiedResearch(input)
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;
try{
  const bootstrap=await fetch(`${origin}/api/studio/bootstrap`).then(response=>response.json());
  assert.equal(bootstrap.ok,true);
  assert.equal(bootstrap.token,token);
  assert.deepEqual(bootstrap.productTypes.map(item=>item.id),["bar_jukebox","jookbox","business","recruitment","individual_band","restaurant","tourist_attraction","town"]);
  assert.ok(bootstrap.legacyProductTypes.some(item=>item.id==="music"),"Legacy Studio drafts must remain loadable.");

  const missing=await fetch(`${origin}/studio/favicon.ico`);
  assert.equal(missing.status,404,"Missing static files must return 404 without crashing Studio.");

  const rejected=await fetch(`${origin}/api/studio/projects`,{
    method:"POST",
    headers:{"content-type":"application/json","origin":origin},
    body:JSON.stringify({input:{name:"Blocked"}})
  });
  assert.equal(rejected.status,400,"Mutating requests require the local Studio token.");

  const createdResponse=await fetch(`${origin}/api/studio/projects`,{
    method:"POST",
    headers:{"content-type":"application/json","origin":origin,"x-deep-cuts-studio-token":token},
    body:JSON.stringify({input:{name:"Server Test",type:"business",sourceUrls:["https://example.com"],brief:"A local server preview."}})
  });
  assert.equal(createdResponse.status,201);
  const created=await createdResponse.json();
  assert.equal(created.ok,true);
  assert.match(created.previewUrl,/\/preview$/);

  const previewResponse=await fetch(created.previewUrl);
  assert.equal(previewResponse.status,200);
  assert.match(await previewResponse.text(),/Server Test/);

  const audioResponse=await fetch(`${origin}/api/studio/projects/${created.project.id}/audio`,{
    method:"POST",
    headers:{"content-type":"audio/mpeg","origin":origin,"x-deep-cuts-studio-token":token,"x-studio-file-name":"demo.mp3"},
    body:Buffer.from("ID3test")
  });
  assert.equal(audioResponse.status,200);
  const withAudio=await audioResponse.json();
  assert.equal(withAudio.project.mp3.fileName,"demo.mp3");

  const onePixelPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
  const logoResponse=await fetch(`${origin}/api/studio/projects/${created.project.id}/logo`,{
    method:"POST",
    headers:{"content-type":"image/png","origin":origin,"x-deep-cuts-studio-token":token,"x-studio-file-name":"brand.png"},
    body:onePixelPng
  });
  assert.equal(logoResponse.status,200);
  const withLogo=await logoResponse.json();
  assert.equal(withLogo.project.logo.fileName,"brand.png");
  assert.equal(withLogo.project.logo.mimeType,"image/png");
  const servedLogo=await fetch(`${origin}/api/studio/projects/${created.project.id}/logo`);
  assert.equal(servedLogo.status,200);
  assert.equal((await servedLogo.arrayBuffer()).byteLength,onePixelPng.length);

  const handoffResponse=await fetch(withLogo.handoffUrl);
  assert.equal(handoffResponse.status,200);
  const handoff=await handoffResponse.json();
  assert.equal(handoff.publication.authorised,false);
  assert.equal(handoff.publication.confidenceGate,98);

  const jookBoxResponse=await fetch(`${origin}/api/studio/projects`,{
    method:"POST",
    headers:{"content-type":"application/json","origin":origin,"x-deep-cuts-studio-token":token},
    body:JSON.stringify({input:{name:"Studio Research Band",type:"jookbox",sourceUrls:["https://studio-research.example.com"]}})
  });
  assert.equal(jookBoxResponse.status,201);
  const jookBoxCreated=await jookBoxResponse.json();
  const researchResponse=await fetch(`${origin}/api/studio/projects/${jookBoxCreated.project.id}/research`,{
    method:"POST",
    headers:{"content-type":"application/json","origin":origin,"x-deep-cuts-studio-token":token},
    body:"{}"
  });
  assert.equal(researchResponse.status,200);
  const researched=await researchResponse.json();
  assert.equal(researched.project.research.passed,true);
  assert.equal(researched.project.readiness.researchReady,true);
  assert.equal(researched.project.input.aggitsOption,"none");
  const researchedPreview=await fetch(researched.previewUrl).then(response=>response.text());
  assert.match(researchedPreview,/100% VERIFIED/);
  assert.match(researchedPreview,/Bandcamp/);
  assert.match(researchedPreview,/jookbox-atlas-reference-v1\.webp/);
  assert.match(researchedPreview,/aspect-ratio:887\/1774/);
  assert.match(researchedPreview,/grid-template-columns:repeat\(3,1fr\)/);
  assert.match(researchedPreview,/Support Our Band/);
  assert.match(researchedPreview,/Copyright Clearlight Creative 2026\./);
  assert.doesNotMatch(researchedPreview,/preview-aggits/);
  const researchedHandoff=await fetch(researched.handoffUrl).then(response=>response.json());
  assert.equal(researchedHandoff.publication.automatedResearchPassed,true);
  assert.equal(researchedHandoff.publication.verificationRequired,false);

  const barResponse=await fetch(`${origin}/api/studio/projects`,{
    method:"POST",
    headers:{"content-type":"application/json","origin":origin,"x-deep-cuts-studio-token":token},
    body:JSON.stringify({input:{
      name:"Shotkickers",
      type:"bar_jukebox",
      sourceUrls:[
        "https://bar.example.com/gigs",
        "https://bar.example.com/menu",
        "https://bar.example.com/contact",
        "https://bar.example.com/instagram",
        "https://bar.example.com/facebook"
      ],
      sourceLabels:["Gigs","Menu","Contact Us","Instagram","Facebook"],
      tickerText:"SHOTKICKERS — LIVE MUSIC, GIGS, DRINKS AND GOOD TIMES.",
      aboutText:"Administrator-approved Shotkickers location and venue information."
    }})
  });
  assert.equal(barResponse.status,201);
  const barCreated=await barResponse.json();
  assert.equal(barCreated.project.readiness.handoffReady,false);
  const fakeMp4=Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from("ftyp"),Buffer.from("isom"),Buffer.alloc(12)]);
  const videoResponse=await fetch(`${origin}/api/studio/projects/${barCreated.project.id}/video`,{
    method:"POST",
    headers:{"content-type":"video/mp4","origin":origin,"x-deep-cuts-studio-token":token,"x-studio-file-name":"shotkickers-welcome.mp4"},
    body:fakeMp4
  });
  assert.equal(videoResponse.status,200);
  const barWithVideo=await videoResponse.json();
  assert.equal(barWithVideo.project.mp4.fileName,"shotkickers-welcome.mp4");
  assert.equal(barWithVideo.project.readiness.handoffReady,true);
  const barPreviewResponse=await fetch(barWithVideo.previewUrl);
  const renderedBarPreview=await barPreviewResponse.text();
  assert.equal(barPreviewResponse.status,200);
  assert.match(barPreviewResponse.headers.get("content-security-policy")||"",/script-src 'self' 'nonce-[^']+'/);
  assert.match(renderedBarPreview,/SHOTKICKERS/);
  assert.match(renderedBarPreview,/id="welcomeVideo"/);
  assert.match(renderedBarPreview,/id="aboutKey"/);
  assert.match(renderedBarPreview,/id="aboutScreen"/);
  assert.doesNotMatch(renderedBarPreview,/id="shareKey"/);
  assert.match(renderedBarPreview,/id="sharePanel"/);
  assert.match(renderedBarPreview,/Administrator-approved Shotkickers location and venue information/);
  assert.match(renderedBarPreview,/Share Shotkickers with your mates/);
  assert.match(renderedBarPreview,/Public sharing activates after deployment/);
  assert.doesNotMatch(renderedBarPreview,/url:location\.href/);
  assert.match(renderedBarPreview,/<script nonce="[^"]+">/);
  const rangedVideo=await fetch(`${origin}/api/studio/projects/${barCreated.project.id}/video`,{headers:{range:"bytes=0-7"}});
  assert.equal(rangedVideo.status,206);
  assert.equal(rangedVideo.headers.get("content-range"),`bytes 0-7/${fakeMp4.length}`);
  assert.equal((await rangedVideo.arrayBuffer()).byteLength,8);
  const barHandoff=await fetch(barWithVideo.handoffUrl).then(response=>response.json());
  assert.equal(barHandoff.publication.verificationRequired,false);
  assert.equal(barHandoff.project.input.sourceUrls.length,5);
  const removedVideo=await fetch(`${origin}/api/studio/projects/${barCreated.project.id}/video`,{
    method:"DELETE",
    headers:{"origin":origin,"x-deep-cuts-studio-token":token}
  }).then(response=>response.json());
  assert.equal(removedVideo.project.mp4,null);
  assert.equal(removedVideo.project.readiness.handoffReady,false);
}finally{
  await new Promise(resolve=>server.close(resolve));
  await fs.rm(temporary,{recursive:true,force:true});
}

console.log("Deep Cuts Studio tests passed: local isolation, Bar Edition MP4/coin/About Us/share preview, publication-safe QR boundary, HGM-only artwork, logo/MP3, labelled preview, 1080 poster, revisions and production gate are intact.");

function verifiedResearch(input){
  const verifiedAt="2026-07-30T01:00:00.000Z";
  const selections=[
    ["bandcamp-verified","Bandcamp","Listen and buy direct","bandcamp","https://studio-research.bandcamp.com/","website"],
    ["spotify-verified","Spotify","Listen on Spotify","spotify","https://open.spotify.com/artist/studioresearch","website"],
    ["youtube-verified","YouTube","Watch the official channel","youtube","https://www.youtube.com/@studio-research-band","youtube"],
    ["instagram-verified","Instagram","Follow official updates","instagram","https://www.instagram.com/studio.research.band/","instagram"]
  ].map(([id,label,detail,kind,url,platform])=>({
    id,sourceTitle:label,label,detail,kind,url,platform,confidence:100,verifiedAt,
    sourceURL:"https://studio-research.example.com",
    evidence:`${label} resolved directly from the identity-matched artist-controlled website.`
  }));
  return{
    schemaVersion:STUDIO_JOOKBOX_RESEARCH_SCHEMA,
    status:"passed",
    inputFingerprint:researchFingerprint(input),
    bandName:input.name,
    startedAt:verifiedAt,
    verifiedAt,
    confidence:100,
    confidenceGate:98,
    passed:true,
    discoveryMode:"artist_url_seeded",
    discoveryNotes:[],
    checks:{
      artistControlledIdentity:true,
      independentSources:true,
      sourcedBiography:true,
      officialFeaturedVideo:true,
      verifiedDestinations:true,
      everyDisplayedDestinationVerified:true
    },
    roots:[{url:"https://studio-research.example.com/",verifiedAt,identityVerified:true}],
    biography:{
      tickerBio:"STUDIO RESEARCH BAND — VERIFIED TEST BIOGRAPHY.",
      paragraphs:["Studio Research Band verified test biography."],
      sourceURL:"https://studio-research.example.com/"
    },
    featuredVideo:{
      title:"Studio Research Band — Official Video",
      youtubeURL:"https://www.youtube.com/watch?v=abcdefghijk",
      channelURL:"https://www.youtube.com/@studio-research-band",
      selectionBasis:"most-viewed-official",
      verifiedAt
    },
    links:{bandcamp:selections[0].url,spotify:selections[1].url,youtube:selections[2].url,instagram:selections[3].url},
    selections,
    displaySelectionIds:selections.map(selection=>selection.id),
    sources:[],
    omittedCandidates:[],
    blockers:[]
  };
}
