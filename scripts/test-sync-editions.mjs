import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import fs from 'node:fs';

const platform=JSON.parse(fs.readFileSync('platform.json','utf8'));

const success=await withServer(async(request,response,state)=>{
  if(request.url==='/api/health')return sendJson(response,200,{ok:true,service:'deep-cuts'});
  if(request.url==='/api/editions'&&request.method==='POST'){
    state.posts+=1;
    assert.equal(request.headers.authorization,'Bearer test-admin-token');
    return sendJson(response,200,{ok:true});
  }
  response.writeHead(404).end();
},base=>runSync(base));
assert.equal(success.code,0,success.stderr);
assert.equal(success.state.posts,platform.editions.length);

const wrongDestination=await withServer((_request,response)=>{
  response.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end('<html><body>legacy website</body></html>');
},base=>runSync(base));
assert.notEqual(wrongDestination.code,0);
assert.match(wrongDestination.stderr,/expected the Deep Cuts API but received text\/html/i);
assert.doesNotMatch(wrongDestination.stderr,/legacy website/);

console.log('Deployment edition synchronisation tests passed.');

async function withServer(handler,run){
  const state={posts:0};
  const server=http.createServer((request,response)=>handler(request,response,state));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{return {...await run(`http://127.0.0.1:${server.address().port}`),state}}
  finally{await new Promise(resolve=>server.close(resolve))}
}

function runSync(baseURL){
  return new Promise(resolve=>{
    const child=spawn(process.execPath,['scripts/sync-editions.mjs'],{
      cwd:process.cwd(),
      env:{...process.env,DEEP_CUTS_API_URL:baseURL,DEEP_CUTS_ADMIN_TOKEN:'test-admin-token'},
      stdio:['ignore','pipe','pipe']
    });
    let stdout='';let stderr='';
    child.stdout.on('data',chunk=>stdout+=chunk);
    child.stderr.on('data',chunk=>stderr+=chunk);
    child.on('close',code=>resolve({code,stdout,stderr}));
  });
}

function sendJson(response,status,body){
  response.writeHead(status,{'content-type':'application/json; charset=utf-8'}).end(JSON.stringify(body));
}
