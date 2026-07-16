const base=String(process.env.DEEP_CUTS_BASE_URL||'').replace(/\/$/,'');
if(!/^https:\/\//.test(base))throw new Error('DEEP_CUTS_BASE_URL must be configured.');
for(const path of ['/api/health','/platform.json']){
  const response=await fetch(`${base}${path}`,{redirect:'manual'});
  if(!response.ok)throw new Error(`${path} returned ${response.status}`);
}
const platform=await (await fetch(`${base}/platform.json`)).json();
for(const edition of platform.editions.filter(item=>item.active)){
  const page=await fetch(`${base}${edition.canonicalPath}`);
  if(!page.ok)throw new Error(`${edition.canonicalPath} returned ${page.status}`);
  const qr=await fetch(`${base}/q/${edition.editionId}`,{redirect:'manual'});
  if(qr.status!==302)throw new Error(`/q/${edition.editionId} did not return a scan redirect.`);
}
console.log(`Live Deep Cuts smoke test passed for ${platform.editions.length} edition(s).`);
