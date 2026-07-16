import fs from 'node:fs';

const baseURL=String(process.env.DEEP_CUTS_API_URL||'').replace(/\/$/,'');
const token=process.env.DEEP_CUTS_ADMIN_TOKEN||'';
if(!baseURL||!token)throw new Error('DEEP_CUTS_API_URL and DEEP_CUTS_ADMIN_TOKEN are required.');

const healthResponse=await fetch(`${baseURL}/api/health`,{headers:{accept:'application/json'}});
const health=await readJson(healthResponse,'Platform health check');
if(!healthResponse.ok||health?.ok!==true||health?.service!=='deep-cuts'){
  throw new Error(`Platform health check failed at ${baseURL}.`);
}

const platform=JSON.parse(fs.readFileSync('platform.json','utf8'));
for(const edition of platform.editions){
  const response=await fetch(`${baseURL}/api/editions`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({edition_id:edition.editionId,band_name:edition.name,config_path:edition.config,canonical_path:edition.canonicalPath,active:edition.active,deployed_at:new Date().toISOString(),commit_sha:process.env.GITHUB_SHA||''})});
  const result=await readJson(response,`${edition.name}: edition sync`);
  if(!response.ok||result?.ok!==true)throw new Error(`${edition.name}: edition sync returned ${response.status}.`);
}
console.log(`Synced ${platform.editions.length} Deep Cuts editions.`);

async function readJson(response,label){
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.toLowerCase().includes('application/json')){
    throw new Error(`${label} expected the Deep Cuts API but received ${contentType||'an unknown response type'} from ${response.url}.`);
  }
  try{return await response.json()}
  catch{throw new Error(`${label} returned unreadable API data from ${response.url}.`)}
}
