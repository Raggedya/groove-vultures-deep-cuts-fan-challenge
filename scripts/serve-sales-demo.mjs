import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {buildTelstraReport,telstraMatches} from "../sell/demo-data.js";

const port=Number(process.env.PORT||4173);
const root=path.resolve("sell");
const saved=new Map();
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};

http.createServer(async(request,response)=>{
  try{
    const url=new URL(request.url,`http://${request.headers.host}`);
    if(request.method==="POST"&&url.pathname==="/api/sell/identify"){
      const body=await jsonBody(request);return send(response,200,{ok:true,matches:telstraMatches(body.query),source:"verified_demo"});
    }
    if(request.method==="POST"&&url.pathname==="/api/sell/research"){
      const body=await jsonBody(request);if(body.business?.id!=="au-asx-tls")return send(response,503,{ok:false,error:"The local preview provides the Telstra demonstration only."});
      return send(response,200,{ok:true,runId:crypto.randomUUID(),report:buildTelstraReport(body.offering||{})});
    }
    if(request.method==="POST"&&url.pathname==="/api/sell/events"){await jsonBody(request);return send(response,200,{ok:true})}
    if(request.method==="POST"&&url.pathname==="/api/sell/briefings"){
      const body=await jsonBody(request),briefingId=crypto.randomUUID(),accessToken=crypto.randomBytes(32).toString("hex");saved.set(briefingId,{accessToken,report:body.report});return send(response,200,{ok:true,briefingId,accessToken,expiresAt:new Date(Date.now()+86400000).toISOString()});
    }
    if(request.method==="GET"&&url.pathname.startsWith("/api/sell/briefings/")){
      const id=url.pathname.split("/").pop(),entry=saved.get(id),token=(request.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!entry||entry.accessToken!==token)return send(response,404,{ok:false,error:"Private briefing not found"});return send(response,200,{ok:true,report:entry.report});
    }
    const relative=url.pathname==="/sell/"||url.pathname==="/"?"index.html":url.pathname.replace(/^\/sell\//,"");
    const file=path.resolve(root,relative);if(!file.startsWith(root))return send(response,403,{error:"Forbidden"});
    const data=await fs.readFile(file);response.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream"});response.end(data);
  }catch(error){if(error.code==="ENOENT")return send(response,404,{error:"Not found"});send(response,500,{error:"Preview error"})}
}).listen(port,"127.0.0.1",()=>console.log(`Sales demo preview: http://127.0.0.1:${port}/sell/`));

async function jsonBody(request){let raw="";for await(const chunk of request)raw+=chunk;return raw?JSON.parse(raw):{}}
function send(response,status,body){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body))}
