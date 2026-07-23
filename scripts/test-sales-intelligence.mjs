import assert from "node:assert/strict";
import fs from "node:fs";
import {buildTelstraReport,TELSTRA_IDENTITY,telstraMatches} from "../sell/demo-data.js";
import {SALES_SECTION_ORDER,validateIdentity,validateReport} from "../sell/schemas.js";
import {__test as salesTest} from "../worker/sales.js";
import {buildCommercialReport,identifyOfficialCompany,__test as researchTest} from "../worker/commercial-research.js";

assert.equal(validateIdentity(TELSTRA_IDENTITY).length,0,"Demo business identity must be valid");
assert.equal(telstraMatches("Telstra").length,1,"Business resolution must find the verified demo");
assert.equal(telstraMatches("Target","https://www.telstra.com.au").length,1,"Official target URL must resolve the verified demo");
assert.equal(telstraMatches("Telstra Plumbing").length,0,"Similar names must not silently resolve to Telstra");

const report=buildTelstraReport({description:"Cybersecurity software",businessName:"Example Supplier"});
assert.deepEqual(validateReport(report),[],"Verified demo report must satisfy the strict evidence schema");
for(const [key] of SALES_SECTION_ORDER)assert.ok(report.sections[key],`Required sales section missing: ${key}`);
assert.match(report.sections.opportunities.items[0].relevance,/fit/i,"Offering must affect the opportunity analysis");
assert.ok(report.sections.executives.people.length>0,"Verified executives must be present in the complete demo");
assert.ok(report.sections.questions.items.length>=8,"Questions must cover the eight required discovery categories");
assert.ok(report.sections.approach.items.length>=10,"Approach guidance must cover the complete sales strategy");
assert.ok(report.sections.tomorrow.items.length>=9,"Tomorrow briefing must contain the complete meeting-ready checklist");

const unsupported=structuredClone(report);
unsupported.sections.priorities.items[0].sourceIds=[];
assert.ok(validateReport(unsupported).some(error=>error.includes("no evidence")),"Unsupported claims must be rejected");
const guessedContact=structuredClone(report);
guessedContact.sections.executives.people[0].email="guessed@example.com";
assert.ok(validateReport(guessedContact).some(error=>error.includes("prohibited")),"Guessed executive contact details must be rejected");
const stalePerson=structuredClone(report);
stalePerson.sections.executives.people[0].verifiedAt="not-a-date";
assert.ok(validateReport(stalePerson).some(error=>error.includes("not current")),"Unverified executive records must be rejected");

for(const name of ["business_searched","business_confirmed","offering_entered","research_started","research_completed","section_opened","executive_section_opened","source_opened","strategy_viewed","meeting_briefing_viewed","report_exported","new_search_started"])assert.ok(salesTest.EVENTS.has(name),`Privacy-conscious event missing: ${name}`);
assert.equal(salesTest.providerReady({}),false,"Missing provider credentials must fail closed");
assert.equal(salesTest.providerReady({SALES_RESEARCH_API_URL:"http://provider.example",SALES_RESEARCH_API_KEY:"secret"}),false,"Research providers must use HTTPS");
assert.equal(salesTest.providerReady({SALES_RESEARCH_API_URL:"https://provider.example",SALES_RESEARCH_API_KEY:"secret"}),true);
assert.equal(salesTest.providerReady({AI:{run(){}}}),true,"Workers AI must activate internal official-website research without browser credentials");
assert.equal(researchTest.validPublicHttps("https://example.com/about"),"https://example.com/about");
assert.equal(researchTest.validPublicHttps("http://example.com"),"","Research must require HTTPS");
assert.equal(researchTest.validPublicHttps("https://127.0.0.1/private"),"","Research must reject private network targets");
assert.equal(researchTest.validPublicHttps("https://user:secret@example.com"),"","Research must reject credential-bearing URLs");
assert.match(researchTest.htmlToText("<style>x</style><h1>Useful evidence</h1><script>bad()</script>"),/^Useful evidence$/);

const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>new Response(`<html><head><title>${String(url).includes("target")?"Target Company":"Seller Company"}</title><meta name="description" content="Public company evidence"></head><body><h1>Official company page</h1><p>We provide reliable services to customers and publish current business information.</p></body></html>`,{status:200,headers:{"content-type":"text/html"}});
const ai={run:async (_model,input)=>{
  const prompt=input.messages.at(-1).content;
  if(prompt.includes("Return exactly this shape")){
    const sections=Object.fromEntries(SALES_SECTION_ORDER.map(([key])=>[key,{items:[{title:`${key} finding`,status:"confirmed_fact",found:"The official target website publishes relevant business information.",meaning:"This provides a grounded starting point.",relevance:"The salesperson can prepare around published evidence.",action:"Validate the fit in a short discovery conversation.",question:"How does this priority affect your team today?",confidence:"Moderate confidence",sourceIds:["target-1"]}],...(key==="executives"?{people:[]}: {})}]));
    return {response:JSON.stringify({sections,unknowns:["Internal buying timing is not public"]})};
  }
  return {response:JSON.stringify({officialName:"Target Company Pty Ltd",tradingName:"Target Company",industry:"Business services",location:"Australia",publicStatus:"Private company"})};
}};
const arbitraryIdentity=await identifyOfficialCompany("https://target.example/",{AI:ai});
assert.equal(validateIdentity(arbitraryIdentity).length,0,"An arbitrary official website must produce a confirmable identity");
const arbitraryReport=await buildCommercialReport({business:arbitraryIdentity,offering:{website:"https://seller.example/",businessName:"Seller Company"}},{AI:ai});
assert.deepEqual(validateReport(arbitraryReport),[],"The internal provider must produce a schema-valid evidence-linked briefing for arbitrary company URLs");
assert.equal(arbitraryReport.researchMode,"official_websites_workers_ai");
assert.equal(arbitraryReport.sections.opportunities.items[0].status,"unknown","A claimed opportunity without both seller and target evidence must be downgraded");
assert.match(arbitraryReport.sections.opportunities.items[0].action,/discovery conversation/i,"Unsupported fit advice must be replaced with honest discovery guidance");
globalThis.fetch=originalFetch;
const token="private-token";const digest=await salesTest.hash(token);assert.equal(await salesTest.equalHash(digest,token),true);assert.equal(await salesTest.equalHash(digest,"wrong"),false);

const html=fs.readFileSync("sell/index.html","utf8");
const app=fs.readFileSync("sell/app.js","utf8");
const worker=fs.readFileSync("worker/index.js","utf8");
const salesWorker=fs.readFileSync("worker/sales.js","utf8");
const researchWorker=fs.readFileSync("worker/commercial-research.js","utf8");
const wrangler=JSON.parse(fs.readFileSync("wrangler.jsonc","utf8"));
const migration=fs.readFileSync("migrations/0002_sales_intelligence.sql","utf8");
for(const phrase of ["Commercial Instinct","My Company","Target Company","I want to sell to this company","Save privately","Export PDF"])assert.ok(html.includes(phrase),`Required user experience missing: ${phrase}`);
for(const action of ["back-search","home","new-search","edit-companies","copy-section"])assert.ok(html.includes(`data-action=\"${action}\"`),`Navigation control missing: ${action}`);
assert.ok(html.includes('/assets/aggits-original-cutout-v4.png'),"Commercial Instinct must reuse the protected original Aggits asset");
assert.ok(!html.includes("offer-description"),"Commercial Instinct intake must remain a simple two-company URL experience");
assert.ok(app.includes("window.print()"),"PDF/print export must be operational");
assert.ok(app.includes("navigator.clipboard.writeText"),"Copy and private share actions must be operational");
assert.ok(app.includes('targetWebsite:targetUrl')&&app.includes('sellerWebsite:myUrl'),"Both company URLs must enter the research contract");
assert.ok(worker.includes('url.pathname.startsWith("/api/sell/")'),"Worker must isolate the sales-intelligence API namespace");
assert.equal(wrangler.ai.binding,"AI","Commercial Instinct must use the private Workers AI binding");
assert.ok(salesWorker.includes("identifyOfficialCompany")&&salesWorker.includes("buildCommercialReport"),"Arbitrary-company research must be connected to the live sales API");
assert.ok(researchWorker.toLowerCase().includes("official website evidence")&&researchWorker.includes("Never invent"),"Research instructions must preserve evidence and anti-fabrication rules");
for(const table of ["sales_briefings","sales_research_runs","sales_events"])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
assert.ok(!migration.includes("FOREIGN KEY (business_id) REFERENCES editions"),"Sales records must not depend on edition records");
const privateIdentity={...TELSTRA_IDENTITY,id:"au-private-example",officialName:"Example Private Company Pty Ltd",publicStatus:"Private company",registration:"ABN not included in demo"};
assert.equal(validateIdentity(privateIdentity).length,0,"Private companies must be supported without fabricated financial data");
console.log("Deep Cuts sales-intelligence contracts passed.");
