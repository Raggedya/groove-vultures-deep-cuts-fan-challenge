import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [
  contracts,
  discoveryHtml,
  discoveryApp,
  commercialHtml,
  recordCompanyHtml,
  recordCompanyApp,
  recordCompanyTerms,
  recordCompanyPrivacy,
  studioHtml,
  worker
]=await Promise.all([
  fs.readFile("edition-contracts.json","utf8").then(JSON.parse),
  fs.readFile("index.html","utf8"),
  fs.readFile("js/app.js","utf8"),
  fs.readFile("sell/index.html","utf8"),
  fs.readFile("record-company/index.html","utf8"),
  fs.readFile("record-company/app.js","utf8"),
  fs.readFile("record-company/terms.html","utf8"),
  fs.readFile("record-company/privacy.html","utf8"),
  fs.readFile("studio/index.html","utf8"),
  fs.readFile("worker/index.js","utf8")
]);

assert.deepEqual(contracts.globalFooter,{
  status:"permanent-locked",
  line1:"Deep Cuts",
  line2:"Copyright Clearlight Creative",
  scope:["all-products","all-editions","all-screen-states"]
});
assert.ok(!contracts.productModels.indie_label.editionOwnedFields.includes("footer-and-copyright"),"No edition may own or override the platform footer.");

assert.match(discoveryHtml,/<footer class="page-footer" aria-label="Deep Cuts platform">\s*<span id="poweredByLabel">Deep Cuts<\/span>\s*<small id="coverCopyright">Copyright Clearlight Creative<\/small>/);
for(const screenId of ["errorScreen","schoolQuizScreen","schoolResultScreen","lanewayQuizScreen","lanewayResultScreen","lanewayCompanyQuizScreen","lanewayCompanyResultScreen"]){
  assert.ok(discoveryHtml.indexOf('class="page-footer"')>discoveryHtml.indexOf(`id="${screenId}"`),`The global footer must follow ${screenId}.`);
}
assert.doesNotMatch(discoveryApp,/els\.(?:poweredBy|copyright)\.textContent/,"Runtime edition configuration must not replace the global footer.");
assert.doesNotMatch(discoveryApp,/config\.social\?\.copyright/,"Edition copyright metadata must not replace the live footer.");

assert.match(commercialHtml,/<footer aria-label="Deep Cuts platform"><strong>Deep Cuts<\/strong><br>Copyright Clearlight Creative<\/footer>/);
assert.match(recordCompanyHtml,/<footer class="rc-footer" aria-label="Deep Cuts platform"><strong>Deep Cuts<\/strong><br><span>Copyright Clearlight Creative<\/span><\/footer>/);
assert.match(recordCompanyApp,/aria-label="Deep Cuts platform"><strong>Deep Cuts<\/strong><br><span>Copyright Clearlight Creative<\/span>/);
assert.match(studioHtml,/<footer class="studio-footer" aria-label="Deep Cuts platform"><strong>Deep Cuts<\/strong><br>Copyright Clearlight Creative<\/footer>/);
assert.match(recordCompanyApp,/renderError\(message\).*footer\(null\)/s,"Record Company errors must retain the global footer.");
for(const legalHtml of [recordCompanyTerms,recordCompanyPrivacy]){
  assert.match(legalHtml,/<footer class="rc-footer" aria-label="Deep Cuts platform"><strong>Deep Cuts<\/strong><br><span>Copyright Clearlight Creative<\/span><\/footer>/);
}
assert.match(worker,/aria-label="Deep Cuts platform"><strong>Deep Cuts<\/strong><br><span>Copyright Clearlight Creative<\/span>/,"Worker-rendered legal screens must retain the global footer.");

for(const publicSurface of [discoveryHtml,commercialHtml,recordCompanyHtml,recordCompanyApp,recordCompanyTerms,recordCompanyPrivacy,studioHtml]){
  assert.doesNotMatch(publicSurface,/Powered by Deep Cuts/i,"The locked footer wording is Deep Cuts, not Powered by Deep Cuts.");
}

console.log("Global footer contract passed: every public product and screen state ends with Deep Cuts and Copyright Clearlight Creative.");
