import fs from 'node:fs/promises';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const baseURL=String(process.env.DEEP_CUTS_BASE_URL||platform.publicBaseURL||'').replace(/\/$/,'');
if(!/^https:\/\//.test(baseURL))throw new Error('A deployed HTTPS Deep Cuts URL is required.');

for(const edition of platform.editions.filter(item=>item.active)){
  const url=`${baseURL}/output/${encodeURIComponent(edition.slug)}/instagram-qr.png`;
  const response=await fetch(url,{headers:{accept:'image/png'}});
  const contentType=response.headers.get('content-type')||'';
  if(!response.ok||!contentType.toLowerCase().includes('image/png'))throw new Error(`${edition.name}: deployed QR artwork is unavailable at ${url}.`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<10000||bytes[0]!==0x89||bytes[1]!==0x50||bytes[2]!==0x4e||bytes[3]!==0x47)throw new Error(`${edition.name}: deployed QR artwork is not a valid PNG.`);
}
console.log(`Verified ${platform.editions.filter(item=>item.active).length} deployed QR artwork file(s).`);

