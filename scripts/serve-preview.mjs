import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'dist');
const port=Number(process.env.DEEP_CUTS_PREVIEW_PORT||8791);
const contentTypes={
  '.css':'text/css; charset=utf-8',
  '.html':'text/html; charset=utf-8',
  '.ico':'image/x-icon',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.svg':'image/svg+xml',
  '.webp':'image/webp'
};

http.createServer(async(request,response)=>{
  try{
    const url=new URL(request.url,`http://${request.headers.host}`);
    const requested=url.pathname==='/'?'index.html':url.pathname.replace(/^\/+/,'');
    let file=path.resolve(root,requested);
    if(!file.startsWith(root))return send(response,403,'Forbidden');
    try{
      const stat=await fs.stat(file);
      if(stat.isDirectory())file=path.join(file,'index.html');
    }catch{
      if(!path.extname(requested))file=path.join(root,'index.html');
    }
    const body=await fs.readFile(file);
    response.writeHead(200,{'content-type':contentTypes[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    response.end(body);
  }catch(error){
    send(response,error.code==='ENOENT'?404:500,error.code==='ENOENT'?'Not found':'Preview error');
  }
}).listen(port,'127.0.0.1',()=>console.log(`Deep Cuts preview: http://127.0.0.1:${port}`));

function send(response,status,body){
  response.writeHead(status,{'content-type':'text/plain; charset=utf-8'});
  response.end(body);
}
