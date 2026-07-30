import {mapLimit} from './lib/parallel.mjs';

const base=String(process.env.DEEP_CUTS_BASE_URL||'').replace(/\/$/,'');
if(!/^https:\/\//.test(base))throw new Error('DEEP_CUTS_BASE_URL must be configured.');
const [healthResponse,platformResponse,recordCompanyTerms,...recordCompanyAssets]=await Promise.all([
  fetch(`${base}/api/health`,{redirect:'manual'}),
  fetch(`${base}/platform.json`,{redirect:'manual'}),
  fetch(`${base}/record-company/terms.html`,{cache:"no-store"}),
  ...[["/record-company/app.js","javascript"],["/record-company/styles.css","text/css"],["/record-company/schemas.js","javascript"]]
    .map(([assetPath])=>fetch(`${base}${assetPath}`,{cache:"no-store"}))
]);
if(!healthResponse.ok)throw new Error(`/api/health returned ${healthResponse.status}`);
if(!platformResponse.ok)throw new Error(`/platform.json returned ${platformResponse.status}`);
const platform=await platformResponse.json();
const recordCompanyTermsBody=await recordCompanyTerms.text();
if(!recordCompanyTerms.ok||!recordCompanyTermsBody.includes("Record Company Edition terms")){
  throw new Error("/record-company/terms.html did not return the isolated legal page.");
}
if(!String(recordCompanyTerms.headers.get("content-security-policy")||"").includes("frame-ancestors 'none'")){
  throw new Error("/record-company/terms.html did not pass through the Record Company security middleware.");
}
const recordCompanyAssetDefinitions=[["/record-company/app.js","javascript"],["/record-company/styles.css","text/css"],["/record-company/schemas.js","javascript"]];
for(let index=0;index<recordCompanyAssetDefinitions.length;index+=1){
  const [assetPath,expectedType]=recordCompanyAssetDefinitions[index];
  const asset=recordCompanyAssets[index];
  const contentType=asset.headers.get("content-type")||"";
  if(!asset.ok||!contentType.includes(expectedType)){
    throw new Error(`${assetPath} returned ${asset.status} ${contentType||"without a content type"} instead of ${expectedType}.`);
  }
}
const recordCompanyEntry=await fetch(`${base}/record-company/`,{redirect:"manual",cache:"no-store"});
const restoredLanewayPath="/e/dc_f63a383fac";
if(recordCompanyEntry.status!==302||new URL(recordCompanyEntry.headers.get("location"),base).pathname!==restoredLanewayPath){
  throw new Error("/record-company/ did not restore the standalone Celibate Rifles edition.");
}
const recordCompanyTarget=new URL(recordCompanyEntry.headers.get("location"),base);
const [recordCompanyPage,previousLanewayEntry]=await Promise.all([
  fetch(recordCompanyTarget,{redirect:"manual",cache:"no-store"}),
  fetch(`${base}/record-company/laneway-music`,{redirect:"manual",cache:"no-store"})
]);
if(!recordCompanyPage.ok||recordCompanyPage.status>=300){
  throw new Error(`${recordCompanyTarget.pathname} did not load the restored Celibate Rifles edition.`);
}
if(previousLanewayEntry.status!==302||new URL(previousLanewayEntry.headers.get("location"),base).pathname!==restoredLanewayPath){
  throw new Error("/record-company/laneway-music did not restore the standalone Celibate Rifles edition.");
}
const activeEditions=platform.editions.filter(item=>item.active);
const jobs=Math.max(1,Math.min(8,Number(process.env.DEEP_CUTS_DEPLOY_JOBS||6)));
await mapLimit(activeEditions,jobs,async edition=>{
  const [page,qr]=await Promise.all([
    fetch(`${base}${edition.canonicalPath}`),
    fetch(`${base}/q/${edition.editionId}`,{redirect:'manual'})
  ]);
  if(!page.ok)throw new Error(`${edition.canonicalPath} returned ${page.status}`);
  if(qr.status!==302)throw new Error(`/q/${edition.editionId} did not return a scan redirect.`);
},{onProgress:({completed,total,item})=>console.log(`[${completed}/${total}] Verified ${item.name}.`)});
console.log(`Live Deep Cuts smoke test passed for ${platform.editions.length} edition(s).`);
