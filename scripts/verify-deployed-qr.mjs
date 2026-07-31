import fs from 'node:fs/promises';
import {mapLimit} from './lib/parallel.mjs';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const baseURL=String(process.env.DEEP_CUTS_BASE_URL||platform.publicBaseURL||'').replace(/\/$/,'');
if(!/^https:\/\//.test(baseURL))throw new Error('A deployed HTTPS Deep Cuts URL is required.');

const activeEditions=platform.editions.filter(item=>item.active);
const jobs=Math.max(1,Math.min(8,Number(process.env.DEEP_CUTS_DEPLOY_JOBS||6)));
await mapLimit(activeEditions,jobs,async edition=>{
  const url=`${baseURL}/output/${encodeURIComponent(edition.slug)}/instagram-qr.png`;
  const response=await fetchWithPropagationRetry(url);
  const contentType=response.headers.get('content-type')||'';
  if(!response.ok||!contentType.toLowerCase().includes('image/png'))throw new Error(`${edition.name}: deployed QR artwork is unavailable at ${url}.`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<10000||bytes[0]!==0x89||bytes[1]!==0x50||bytes[2]!==0x4e||bytes[3]!==0x47)throw new Error(`${edition.name}: deployed QR artwork is not a valid PNG.`);
},{onProgress:({completed,total,item})=>console.log(`[${completed}/${total}] Verified deployed QR artwork for ${item.name}.`)});
console.log(`Verified ${activeEditions.length} deployed QR artwork file(s).`);

async function fetchWithPropagationRetry(url){
  const attempts=Number(process.env.DEEP_CUTS_QR_VERIFY_ATTEMPTS||12);
  const delayMs=Number(process.env.DEEP_CUTS_QR_VERIFY_DELAY_MS||5000);
  let response;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    response=await fetch(url,{headers:{accept:'image/png'}});
    const contentType=response.headers.get('content-type')||'';
    if(response.ok&&contentType.toLowerCase().includes('image/png'))return response;
    if(attempt<attempts){
      console.log(`QR artwork is still propagating (${attempt}/${attempts}): ${url}`);
      await new Promise(resolve=>setTimeout(resolve,delayMs));
    }
  }
  return response;
}

