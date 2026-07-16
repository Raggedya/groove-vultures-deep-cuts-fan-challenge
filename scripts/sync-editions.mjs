import fs from 'node:fs';

const baseURL=String(process.env.DEEP_CUTS_API_URL||'').replace(/\/$/,'');
const token=process.env.DEEP_CUTS_ADMIN_TOKEN||'';
if(!baseURL||!token)throw new Error('DEEP_CUTS_API_URL and DEEP_CUTS_ADMIN_TOKEN are required.');
const platform=JSON.parse(fs.readFileSync('platform.json','utf8'));
for(const edition of platform.editions){
  const response=await fetch(`${baseURL}/api/editions`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({edition_id:edition.editionId,band_name:edition.name,config_path:edition.config,canonical_path:edition.canonicalPath,active:edition.active,deployed_at:new Date().toISOString(),commit_sha:process.env.GITHUB_SHA||''})});
  if(!response.ok)throw new Error(`${edition.name}: edition sync returned ${response.status} ${await response.text()}`);
}
console.log(`Synced ${platform.editions.length} Deep Cuts editions.`);
