import assert from "node:assert/strict";
import fs from "node:fs";
import {buildTelstraReport,TELSTRA_IDENTITY,telstraMatches} from "../sell/demo-data.js";
import {SALES_SECTION_ORDER,validateIdentity,validateReport} from "../sell/schemas.js";
import {__test as salesTest} from "../worker/sales.js";

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
const token="private-token";const digest=await salesTest.hash(token);assert.equal(await salesTest.equalHash(digest,token),true);assert.equal(await salesTest.equalHash(digest,"wrong"),false);

const html=fs.readFileSync("sell/index.html","utf8");
const app=fs.readFileSync("sell/app.js","utf8");
const worker=fs.readFileSync("worker/index.js","utf8");
const migration=fs.readFileSync("migrations/0002_sales_intelligence.sql","utf8");
for(const phrase of ["Commercial Instinct","My Company","Target Company","I want to sell to this company","Save privately","Export PDF"])assert.ok(html.includes(phrase),`Required user experience missing: ${phrase}`);
for(const action of ["back-search","home","new-search","edit-companies","copy-section"])assert.ok(html.includes(`data-action=\"${action}\"`),`Navigation control missing: ${action}`);
assert.ok(html.includes('/assets/aggits-original-cutout-v4.png'),"Commercial Instinct must reuse the protected original Aggits asset");
assert.ok(!html.includes("offer-description"),"Commercial Instinct intake must remain a simple two-company URL experience");
assert.ok(app.includes("window.print()"),"PDF/print export must be operational");
assert.ok(app.includes("navigator.clipboard.writeText"),"Copy and private share actions must be operational");
assert.ok(app.includes('targetWebsite:targetUrl')&&app.includes('sellerWebsite:myUrl'),"Both company URLs must enter the research contract");
assert.ok(worker.includes('url.pathname.startsWith("/api/sell/")'),"Worker must isolate the sales-intelligence API namespace");
for(const table of ["sales_briefings","sales_research_runs","sales_events"])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
assert.ok(!migration.includes("FOREIGN KEY (business_id) REFERENCES editions"),"Sales records must not depend on edition records");
const privateIdentity={...TELSTRA_IDENTITY,id:"au-private-example",officialName:"Example Private Company Pty Ltd",publicStatus:"Private company",registration:"ABN not included in demo"};
assert.equal(validateIdentity(privateIdentity).length,0,"Private companies must be supported without fabricated financial data");
console.log("Deep Cuts sales-intelligence contracts passed.");
