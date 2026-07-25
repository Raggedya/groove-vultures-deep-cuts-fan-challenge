import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  PUBLICATION_CONFIDENCE,canonicalDomain,safeSlug,validHttpsUrl,validateQuiz
} from "../record-company/schemas.js";
import {__test} from "../worker/record-company.js";

const fixtureRoot="scripts/fixtures/record-company";
const home=await fs.readFile(`${fixtureRoot}/home.html`,"utf8");
const roster=await fs.readFile(`${fixtureRoot}/artists.html`,"utf8");
const neon=await fs.readFile(`${fixtureRoot}/neon-tide.html`,"utf8");
const profile=__test.extractCompanyProfile(home,"https://midnightharbour.example/");
assert.equal(profile.name,"Midnight Harbour Records");
assert.equal(profile.canonicalDomain,"midnightharbour.example");
assert.equal(profile.slug,"midnight-harbour-records");
assert.equal(profile.confidenceScore,0.99);
assert.match(profile.logoUrl,/\/media\/logo\.svg$/);
assert.ok(/^#[0-9a-f]{6}$/i.test(profile.brandPalette.primary));

const candidates=__test.extractArtistCandidates(roster,"https://midnightharbour.example/artists","https://midnightharbour.example/");
const unique=__test.dedupeCandidates(candidates);
assert.deepEqual(unique.map(item=>item.name),["Neon Tide","Paper Moons"]);
assert.equal(new Set(unique.map(item=>item.url)).size,2);
assert.ok(unique.every(item=>item.confidenceScore>=PUBLICATION_CONFIDENCE));

const links=__test.extractLinks(neon,"https://midnightharbour.example/artists/neon-tide","artist");
assert.deepEqual(links.map(item=>item.type).sort(),["instagram","spotify","youtube"]);
assert.ok(links.every(item=>item.validationStatus==="verified"));

assert.equal(canonicalDomain("https://www.example.com/artists"),"example.com");
assert.equal(safeSlug("The Déjà Vu!"),"deja-vu");
for(const blocked of ["https://localhost/test","https://127.0.0.1/test","https://10.0.0.2/test","http://example.com"])assert.equal(validHttpsUrl(blocked),false);
assert.equal(validHttpsUrl("https://records.example/artists"),true);
assert.equal(__test.destinationAllowed("facebook","https://www.facebook.com/login"),false);
assert.equal(__test.destinationAllowed("instagram","https://www.instagram.com/"),false);
assert.equal(__test.destinationAllowed("facebook","https://www.facebook.com/midnightharbourrecords"),true);
assert.equal(__test.robotsAllowsPath("User-agent: *\nDisallow: /private\nAllow: /private/press","/private/press/artist"),true);
assert.equal(__test.robotsAllowsPath("User-agent: *\nDisallow: /private","/private/artist"),false);

const questions=Array.from({length:5},(_,index)=>({
  id:`q${index+1}`,displayOrder:index+1,question:`Which verified detail belongs to question number ${index+1}?`,
  options:["First answer","Second answer","Third answer","Fourth answer"],correctAnswer:"First answer",
  explanation:"The official artist profile states this positive and informative detail clearly.",
  sourceUrl:"https://midnightharbour.example/artists/neon-tide",evidence:"Official artist profile evidence.",confidenceScore:0.99
}));
assert.equal(validateQuiz({questions}),true);
assert.equal(validateQuiz({questions:questions.slice(0,4)}),false);
assert.equal(validateQuiz({questions:questions.map((item,index)=>index===2?{...item,confidenceScore:0.97}:item)}),false);
const aiQuiz=await __test.generateQuiz({RECORD_COMPANY_RESEARCH_PROVIDER:{analyse:async()=>({title:"Discover Neon Tide",questions})}},{
  entityType:"artist",name:"Neon Tide",description:"Official artist",pageText:"Official facts",sourceUrl:"https://midnightharbour.example/artists/neon-tide"
});
assert.equal(validateQuiz(aiQuiz),true);

const contracts=JSON.parse(await fs.readFile("edition-contracts.json","utf8"));
assert.deepEqual(contracts.editionTypes.record_company.brandNames,["Deep Cuts — Record Company Edition"]);
assert.deepEqual(contracts.editionTypes.record_company.exclusiveConfig,["recordCompany"]);
const worker=await fs.readFile("worker/record-company.js","utf8");
const workerIndex=await fs.readFile("worker/index.js","utf8");
const frontend=await fs.readFile("record-company/app.js","utf8");
const html=await fs.readFile("record-company/index.html","utf8");
const css=await fs.readFile("record-company/styles.css","utf8");
const migration=await fs.readFile("migrations/0003_record_company.sql","utf8");
const workflow=await fs.readFile(".github/workflows/record-company-build.yml","utf8");
const deliverables=await fs.readFile("scripts/record-company/generate-deliverables.py","utf8");
const terms=await fs.readFile("record-company/terms.html","utf8");
const privacy=await fs.readFile("record-company/privacy.html","utf8");
const wrangler=await fs.readFile("wrangler.jsonc","utf8");

for(const table of ["record_companies","record_company_artists","record_company_links","record_company_quizzes","record_company_qr_codes","record_company_jobs","record_company_analytics","record_company_sources"])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
for(const route of ["/api/record-company/","/record-company/q/","/record-company/index.html"])assert.ok(workerIndex.includes(route));
for(const securityMarker of ["content-security-policy","frame-ancestors 'none'","x-content-type-options","permissions-policy"])assert.ok(workerIndex.includes(securityMarker));
for(const legalMarker of ["recordCompanyLegalDocument","Record Company Edition terms","Record Company Edition privacy"])assert.ok(workerIndex.includes(legalMarker));
for(const deliveryMarker of ['jobType==="record_company"',"notification_email_status='delivered'","email.bounced"])assert.ok(workerIndex.includes(deliveryMarker));
for(const stage of ["discovering_company","discovering_roster","researching_artists","generating_quizzes","generating_pages","generating_qr_codes","validating_output","generating_reports","ready_for_delivery"])assert.ok(worker.includes(`"${stage}"`)||worker.includes(`'${stage}'`));
for(const reliabilityMarker of ['["queued","validating"]',"settings.refreshExisting","removed_from_current_roster","while(queue.length&&seen.size<25)","robotsAllows","validateOfficialLinks","recordExternalStage","generating_master_qr_image","sending_completion_email"])assert.ok(worker.includes(reliabilityMarker));
for(const required of ["Discover Our Bands &amp; Artists","Recommended For You","Back to","quiz_completed","quiz_abandoned","outbound_click","source_opened","response_seconds","completion_seconds"])assert.ok(frontend.includes(required));
assert.match(frontend,/item\.id!==excludeId/);
assert.match(frontend,/const unseen=eligible\.filter/);
assert.match(frontend,/Math\.random\(\)\*finalPool\.length/);
assert.ok(html.includes('src="/assets/ding.mp3"'));
for(const audioMarker of ["AudioContext","decodeAudioData","unlockAudio","visibilitychange","performance.now()"])assert.ok(frontend.includes(audioMarker));
assert.ok(frontend.includes("/record-company/terms.html")&&frontend.includes("/record-company/privacy.html"));
assert.match(terms,/no endorsement/i);
assert.match(privacy,/does not store raw IP addresses/i);
assert.match(wrangler,/"run_worker_first": true/);
assert.ok(css.includes("prefers-reduced-motion"));
assert.doesNotMatch(`${frontend}\n${html}\n${css}\n${worker}`,/Aggits/i);
assert.match(deliverables,/min\(5, max\(1, len\(items\)\)\)/);
assert.match(deliverables,/max\(3840,/);
assert.match(deliverables,/zxingcpp\.read_barcode/);
assert.match(deliverables,/sorted\(\s*\[artist/);
for(const text of ["record_company_url","generate-deliverables.py","send-completion.mjs","gh pr checks","gh pr merge","generating_master_qr_image"])assert.ok(workflow.includes(text));
console.log("Record Company Edition tests passed: isolated contract, safe ingestion, 98% gate, five-question schema, discovery navigation, QR production and unattended delivery workflow.");
