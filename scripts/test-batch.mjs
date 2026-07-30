import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseCsv} from './batch/csv.mjs';
import {Network} from './batch/network.mjs';
import {validateInput,isDirectDestination,isAuthenticationWall,HEADERS} from './batch/policy.mjs';

assert.deepEqual(parseCsv('a,b\n"x,y","he said ""yes"""\n'),[['a','b'],['x,y','he said "yes"']]);
assert.equal(isDirectDestination('spotify','https://open.spotify.com/artist/abc123'),true);
assert.equal(isDirectDestination('spotify','https://open.spotify.com/search/Artist/artists'),false);
assert.equal(isDirectDestination('youtube','https://www.youtube.com/results?search_query=artist'),false);
assert.equal(isDirectDestination('featuredVideo','https://www.youtube.com/watch?v=abc123'),true);
assert.equal(isDirectDestination('instagram','https://www.instagram.com/notdummy/'),true);
assert.equal(isDirectDestination('instagram','https://www.instagram.com/accounts/login/?next=%2Fnotdummy%2F'),false);
assert.equal(isDirectDestination('facebook','https://www.facebook.com/notdummyband/'),true);
assert.equal(isDirectDestination('facebook','https://www.facebook.com/login/?next=%2Fnotdummyband%2F'),false);
assert.equal(isAuthenticationWall('https://m.facebook.com/login/?next=%2Fnotdummyband%2F'),true);
const base=Object.fromEntries(Object.values(HEADERS).map(key=>[key,'https://example.com/value']));
Object.assign(base,{'Artist Name':'Test Artist','Location':'Melbourne','Genre':'Rock','Follower Count (approx.)':'2,001','Follower Platform':'Instagram'});
const valid=validateInput([{rowNumber:2,...base}])[0];assert.equal(valid.inputErrors.length,0);
const duplicate=validateInput([{rowNumber:2,...base},{rowNumber:3,...base}]);assert.equal(duplicate[1].inputErrors.some(item=>item.code==='DUPLICATE_ARTIST'),true);
const outOfRange=validateInput([{rowNumber:2,...base,'Follower Count (approx.)':'50,001'}])[0];assert.equal(outOfRange.inputErrors.some(item=>item.code==='FOLLOWER_RANGE_FAILED'),true);

const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'deep-cuts-network-'));
let calls=0,active=0,maxActive=0;
const fetchImpl=async url=>{
  calls+=1;active+=1;maxActive=Math.max(maxActive,active);
  await new Promise(resolve=>setTimeout(resolve,25));
  active-=1;
  return{ok:true,status:200,url,headers:new Headers({'content-type':'text/html'}),async text(){return`<title>${url}</title>`}};
};
try{
  const network=new Network({cacheDir,timeoutMs:1000,retries:1,minDelayMs:0,fetchImpl});
  const duplicateURL='https://one.example/artist';
  const [first,second]=await Promise.all([network.inspect(duplicateURL),network.inspect(duplicateURL)]);
  assert.equal(first.finalURL,duplicateURL);
  assert.deepEqual(second,first);
  assert.equal(calls,1,'Concurrent inspection of one URL must share a single request.');
  await Promise.all([network.inspect('https://two.example/artist'),network.inspect('https://three.example/artist')]);
  assert.equal(calls,3);
  assert.ok(maxActive>=2,'Independent origins should remain in flight together.');
  await network.inspect(duplicateURL);
  assert.equal(calls,3,'A verified result should remain in the in-memory cache for the batch.');
}finally{await fs.rm(cacheDir,{recursive:true,force:true})}

console.log('Deep Cuts batch unit tests passed.');
