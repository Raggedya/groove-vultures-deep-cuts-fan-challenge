import fs from 'node:fs/promises';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const slug=process.argv[2]||platform.defaultEdition;
const edition=platform.editions.find(item=>item.slug===slug&&item.active);
if(!edition)throw new Error(`Unknown active edition: ${slug}`);
const baseURL=String(process.env.DEEP_CUTS_API_URL||platform.publicBaseURL||'').replace(/\/$/,'');
const token=process.env.DEEP_CUTS_ADMIN_TOKEN||'';
if(!/^https:\/\//.test(baseURL)||!token)throw new Error('DEEP_CUTS_API_URL and DEEP_CUTS_ADMIN_TOKEN are required.');

const jobId=process.env.DEEP_CUTS_DELIVERY_JOB_ID||`delivery-${edition.editionId}-${Date.now()}`;
const liveURL=`${baseURL}${edition.canonicalPath}`;
const qrImageURL=`${baseURL}/output/${encodeURIComponent(slug)}/instagram-qr.png`;

const qrResponse=await fetch(qrImageURL,{headers:{accept:'image/png'}});
if(!qrResponse.ok||!(qrResponse.headers.get('content-type')||'').toLowerCase().includes('image/png'))throw new Error('The public scan-tested QR PNG is unavailable; email delivery was blocked.');

await post('/api/builds',{job_id:jobId,edition_id:edition.editionId,band_name:edition.name,stage:'submitted',timestamp:new Date().toISOString()});
await post('/api/builds',{job_id:jobId,edition_id:edition.editionId,band_name:edition.name,stage:'deployed',timestamp:new Date().toISOString()});
const delivery=await post('/api/delivery',{job_id:jobId,edition_id:edition.editionId,band_name:edition.name,live_url:liveURL,qr_image_url:qrImageURL});
console.log(JSON.stringify({ok:true,job_id:jobId,email_id:delivery.email_id,live_url:liveURL,qr_image_url:qrImageURL},null,2));

async function post(path,body){
  const response=await fetch(`${baseURL}${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw new Error(`${path} failed with status ${response.status}: ${result.error||'unknown error'}`);
  return result;
}

