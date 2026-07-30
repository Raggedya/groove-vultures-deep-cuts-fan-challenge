import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  StudioValidationError,
  applyRevision,
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
assert.match(renderStudioPreview(jookBox),/jookbox-cabinet-photoreal-v1\.webp/);
assert.match(renderStudioPreview(jookBox),/RESEARCH NOT RUN/);

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
  fs.readFile("studio/desktop-main.mjs","utf8"),
  fs.readFile("scripts/studio-server.mjs","utf8"),
  fs.readFile("forge.config.cjs","utf8"),
  fs.readFile("package.json","utf8"),
  fs.readFile(".github/workflows/build-deep-cuts-studio-macos.yml","utf8"),
  fs.readFile("scripts/build-cloudflare.mjs","utf8"),
  fs.readFile("worker/index.js","utf8")
]);
const [html,css,app,desktopMain,serverSource,forgeConfig,packageSource,macWorkflow,cloudflareBuild,worker]=sourceFiles;
assert.match(html,/Deep Cuts Studio/);
assert.match(html,/Copyright Clearlight Creative/);
assert.match(html,/APPLY EDITS &amp; RE-CREATE/);
assert.match(html,/id="poster-canvas" width="1080" height="1080"/);
assert.match(html,/id="logo-file"/);
assert.match(html,/Add a spinning wheel\?/);
assert.match(html,/id="research-result"/);
assert.match(html,/id="run-description"/);
assert.match(html,/id="aggits-step"/);
assert.match(html,/id="project-name-label"/);
assert.match(html,/name="addWheel" value="yes"/);
assert.ok(html.indexOf('id="aggits-option"')<html.indexOf('id="project-name"'),"Aggits selection must be the first project input.");
assert.match(html,/<details class="optional-fields" id="optional-fields">/);
assert.match(html,/Optional media &amp; poster/);
assert.match(app,/SpeechRecognition/);
assert.match(app,/DOWNLOAD POSTER|downloadPoster/);
assert.match(app,/owner-supplied HGM orange hi-vis artwork/);
assert.match(app,/els\.aggitsStep\.hidden=jookBox/,"The JookBox intake must hide irrelevant Aggits controls.");
assert.match(app,/field\.hidden=jookBox/,"The JookBox intake must not ask the owner to label research URLs manually.");
assert.match(css,/--orange:#f38a45/);
assert.match(css,/Compact top-left production intake/);
assert.match(css,/Minimalist project controls/);
assert.match(desktopMain,/app\.getPath\("userData"\)/,"Desktop drafts must live outside the packaged application.");
assert.match(desktopMain,/contextIsolation:true/);
assert.match(desktopMain,/nodeIntegration:false/);
assert.match(desktopMain,/sandbox:true/);
assert.match(desktopMain,/listen\(0,"127\.0\.0\.1"/,"Desktop Studio must use a local ephemeral port.");
assert.match(desktopMain,/url\.protocol==="https:"/,"Desktop external navigation must permit validated HTTPS only.");
assert.match(serverSource,/listen\(port,"127\.0\.0\.1"/,"Studio must bind only to the local computer.");
assert.match(forgeConfig,/asar:true/);
assert.match(forgeConfig,/@electron-forge\/maker-squirrel/);
assert.match(forgeConfig,/@electron-forge\/maker-dmg/);
assert.match(forgeConfig,/studio-jookbox-research\.mjs/);
assert.match(forgeConfig,/jookbox-cabinet-photoreal-v1\.webp/);
assert.match(packageSource,/"studio:desktop": "electron-forge start"/);
assert.match(packageSource,/"studio:make": "electron-forge make"/);
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
  assert.deepEqual(bootstrap.productTypes.map(item=>item.id),["jookbox","business","recruitment","individual_band","restaurant","tourist_attraction","town"]);
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
  assert.doesNotMatch(researchedPreview,/preview-aggits/);
  const researchedHandoff=await fetch(researched.handoffUrl).then(response=>response.json());
  assert.equal(researchedHandoff.publication.automatedResearchPassed,true);
  assert.equal(researchedHandoff.publication.verificationRequired,false);
}finally{
  await new Promise(resolve=>server.close(resolve));
  await fs.rm(temporary,{recursive:true,force:true});
}

console.log("Deep Cuts Studio tests passed: local isolation, HGM-only artwork, logo/MP3, labelled preview, 1080 poster, revisions, QR handoff and production gate are intact.");

function verifiedResearch(input){
  const verifiedAt="2026-07-30T01:00:00.000Z";
  const selection={
    id:"bandcamp-verified",
    sourceTitle:"Bandcamp",
    label:"Bandcamp",
    detail:"Listen and buy direct",
    kind:"bandcamp",
    url:"https://studio-research.bandcamp.com/",
    platform:"website",
    confidence:100,
    verifiedAt,
    sourceURL:"https://studio-research.example.com",
    evidence:"Bandcamp resolved directly from the identity-matched artist-controlled website."
  };
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
    links:{bandcamp:selection.url},
    selections:[selection],
    displaySelectionIds:[selection.id],
    sources:[],
    omittedCandidates:[],
    blockers:[]
  };
}
