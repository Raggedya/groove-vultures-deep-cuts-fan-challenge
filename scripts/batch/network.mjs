import fs from 'node:fs/promises';
import path from 'node:path';

export class Network{
  constructor({cacheDir='.deep-cuts/batch-cache',timeoutMs=18000,retries=3,minDelayMs=350}={}){this.cacheDir=cacheDir;this.timeoutMs=timeoutMs;this.retries=retries;this.minDelayMs=minDelayMs;this.last=0;}
  async inspect(url,{cache=true}={}){
    const key=Buffer.from(url).toString('base64url');const file=path.join(this.cacheDir,`${key}.json`);
    if(cache)try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{}
    let lastError;
    for(let attempt=1;attempt<=this.retries;attempt++)try{
      const wait=Math.max(0,this.minDelayMs-(Date.now()-this.last));if(wait)await delay(wait);this.last=Date.now();
      const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(this.timeoutMs),headers:{'user-agent':'Mozilla/5.0 (compatible; DeepCutsVerification/1.0)','accept':'text/html,application/xhtml+xml'}});
      const contentType=response.headers.get('content-type')||'';const body=contentType.includes('text')?(await response.text()).slice(0,2_000_000):'';
      const result={ok:response.ok||[401,403,429].includes(response.status),status:response.status,requestedURL:url,finalURL:response.url,contentType,body,checkedAt:new Date().toISOString()};
      await fs.mkdir(this.cacheDir,{recursive:true});await fs.writeFile(file,JSON.stringify(result));return result;
    }catch(error){lastError=error;if(attempt<this.retries)await delay(500*2**(attempt-1));}
    return{ok:false,status:0,requestedURL:url,finalURL:url,body:'',error:lastError?.message||'Network request failed',checkedAt:new Date().toISOString()};
  }
}
export function extractLinks(page,base){
  const values=[];const regex=/\bhref\s*=\s*["']([^"']+)["']/gi;let match;
  while((match=regex.exec(page||'')))try{const url=new URL(match[1].replaceAll('&amp;','&'),base);if(url.protocol==='https:')values.push(url.href)}catch{}
  return [...new Set(values)];
}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
