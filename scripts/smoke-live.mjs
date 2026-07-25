const base=String(process.env.DEEP_CUTS_BASE_URL||'').replace(/\/$/,'');
if(!/^https:\/\//.test(base))throw new Error('DEEP_CUTS_BASE_URL must be configured.');
for(const path of ['/api/health','/platform.json']){
  const response=await fetch(`${base}${path}`,{redirect:'manual'});
  if(!response.ok)throw new Error(`${path} returned ${response.status}`);
}
const platform=await (await fetch(`${base}/platform.json`)).json();
const recordCompanyTerms=await fetch(`${base}/record-company/terms.html`,{cache:"no-store"});
const recordCompanyTermsBody=await recordCompanyTerms.text();
if(!recordCompanyTerms.ok||!recordCompanyTermsBody.includes("Record Company Edition terms")){
  throw new Error("/record-company/terms.html did not return the isolated legal page.");
}
if(!String(recordCompanyTerms.headers.get("content-security-policy")||"").includes("frame-ancestors 'none'")){
  throw new Error("/record-company/terms.html did not pass through the Record Company security middleware.");
}
for(const [assetPath,expectedType] of [["/record-company/app.js","javascript"],["/record-company/styles.css","text/css"],["/record-company/schemas.js","javascript"]]){
  const asset=await fetch(`${base}${assetPath}`,{cache:"no-store"});
  const contentType=asset.headers.get("content-type")||"";
  if(!asset.ok||!contentType.includes(expectedType)){
    throw new Error(`${assetPath} returned ${asset.status} ${contentType||"without a content type"} instead of ${expectedType}.`);
  }
}
const recordCompanyEntry=await fetch(`${base}/record-company/`,{redirect:"manual",cache:"no-store"});
if(recordCompanyEntry.status!==302||!String(recordCompanyEntry.headers.get("location")||"").includes("/record-company/")){
  throw new Error("/record-company/ did not redirect to an active collection.");
}
const recordCompanyTarget=new URL(recordCompanyEntry.headers.get("location"),base);
const recordCompanyPage=await fetch(recordCompanyTarget,{redirect:"manual",cache:"no-store"});
if(!recordCompanyPage.ok||recordCompanyPage.status>=300){
  throw new Error(`${recordCompanyTarget.pathname} did not preserve its collection route while loading the application shell.`);
}
for(const edition of platform.editions.filter(item=>item.active)){
  const page=await fetch(`${base}${edition.canonicalPath}`);
  if(!page.ok)throw new Error(`${edition.canonicalPath} returned ${page.status}`);
  const qr=await fetch(`${base}/q/${edition.editionId}`,{redirect:'manual'});
  if(qr.status!==302)throw new Error(`/q/${edition.editionId} did not return a scan redirect.`);
}
console.log(`Live Deep Cuts smoke test passed for ${platform.editions.length} edition(s).`);
