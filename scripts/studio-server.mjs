import crypto from "node:crypto";
import {createReadStream} from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  AGGITS_OPTIONS,
  LEGACY_PRODUCT_TYPES,
  PRODUCT_TYPES,
  StudioValidationError,
  applyRevision,
  assertProjectId,
  attachJookBoxResearch,
  attachLogo,
  attachMp3,
  attachMp4,
  createProject,
  projectSummary,
  removeLogo,
  removeMp3,
  removeMp4,
  renderStudioPreview,
  updateProject
} from "./studio-model.mjs";
import {researchStudioJookBox} from "./studio-jookbox-research.mjs";

const DEFAULT_ROOT=path.resolve(process.env.DEEP_CUTS_ROOT||process.cwd());
const DEFAULT_DATA=path.resolve(process.env.DEEP_CUTS_STUDIO_DATA_DIR||path.join(DEFAULT_ROOT,".deep-cuts","studio"));
const MAX_JSON_BYTES=80*1024;
const MAX_MP3_BYTES=25*1024*1024;
const MAX_MP4_BYTES=500*1024*1024;
const CONTENT_TYPES={
  ".css":"text/css; charset=utf-8",
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".json":"application/json; charset=utf-8",
  ".mp3":"audio/mpeg",
  ".mp4":"video/mp4",
  ".png":"image/png",
  ".webp":"image/webp"
};

export function createStudioServer({
  root=DEFAULT_ROOT,
  dataDir=DEFAULT_DATA,
  token=crypto.randomBytes(24).toString("hex"),
  researcher=researchStudioJookBox
}={}){
  const studioRoot=path.join(root,"studio");
  const assetRoot=path.join(root,"assets");
  const projectRoot=path.join(dataDir,"projects");

  return http.createServer(async(request,response)=>{
    addSecurityHeaders(response);
    try{
      const url=new URL(request.url,`http://${request.headers.host||"127.0.0.1"}`);
      if(url.pathname.startsWith("/api/studio/")){
        if(request.method!=="GET")authorizeMutation(request,token);
        return await handleApi({request,response,url,projectRoot,token,researcher});
      }
      if(url.pathname==="/studio")return redirect(response,"/studio/");
      if(url.pathname==="/vendor/qrcode.min.js")return await serveFile(response,path.join(root,"scripts","vendor","qrcode.min.js"),path.join(root,"scripts","vendor"));
      if(url.pathname.startsWith("/assets/"))return await serveWithin(response,assetRoot,url.pathname.replace(/^\/assets\//,""));
      const requested=url.pathname==="/"||url.pathname==="/studio/"?"index.html":url.pathname.replace(/^\/studio\//,"");
      return await serveWithin(response,studioRoot,requested);
    }catch(error){
      const status=error instanceof StudioValidationError?400:error.code==="ENOENT"?404:500;
      if(status===500)console.error("[Deep Cuts Studio]",error);
      return sendJson(response,status,{ok:false,error:status===500?"Studio could not complete that request.":error.message,code:error.code||"studio_error"});
    }
  });
}

async function handleApi({request,response,url,projectRoot,token,researcher}){
  if(request.method==="GET"&&url.pathname==="/api/studio/bootstrap"){
    const projects=await listProjects(projectRoot);
    return sendJson(response,200,{ok:true,token,productTypes:PRODUCT_TYPES,legacyProductTypes:LEGACY_PRODUCT_TYPES,aggitsOptions:AGGITS_OPTIONS,projects});
  }
  if(request.method==="GET"&&url.pathname==="/api/studio/projects"){
    return sendJson(response,200,{ok:true,projects:await listProjects(projectRoot)});
  }
  if(request.method==="POST"&&url.pathname==="/api/studio/projects"){
    const body=await readJson(request);
    const project=createProject(body.input||body);
    await saveProject(projectRoot,project);
    return sendProject(response,201,project,request);
  }

  const match=url.pathname.match(/^\/api\/studio\/projects\/(studio_[a-f0-9]{12})(?:\/(preview|audio|video|logo|revise|research|handoff))?$/);
  if(!match)throw Object.assign(new Error("Studio route not found."),{code:"ENOENT"});
  const id=assertProjectId(match[1]),action=match[2]||"project";
  const project=await loadProject(projectRoot,id);

  if(request.method==="GET"&&action==="project")return sendProject(response,200,project,request);
  if(request.method==="PUT"&&action==="project"){
    const body=await readJson(request);
    const updated=updateProject(project,body.input||body);
    await saveProject(projectRoot,updated);
    return sendProject(response,200,updated,request);
  }
  if(request.method==="GET"&&action==="preview"){
    const audioUrl=project.mp3?`/api/studio/projects/${id}/audio`:"";
    const logoUrl=project.logo?`/api/studio/projects/${id}/logo`:"";
    const videoUrl=project.mp4?`/api/studio/projects/${id}/video`:"";
    const scriptNonce=crypto.randomBytes(18).toString("base64");
    return sendHtml(response,renderStudioPreview(project,{audioUrl,logoUrl,videoUrl,scriptNonce}),{scriptNonce});
  }
  if(request.method==="POST"&&action==="revise"){
    const body=await readJson(request);
    const result=applyRevision(project,body.instruction);
    await saveProject(projectRoot,result.project);
    return sendJson(response,200,{ok:true,...projectPayload(result.project,request),revisionResult:result.entry});
  }
  if(request.method==="POST"&&action==="research"){
    if(project.input.type!=="jookbox")throw new StudioValidationError("Choose JookBox Band before running automatic band research.","wrong_research_type");
    let result;
    try{
      result=await researcher(project.input);
    }catch(error){
      throw new StudioValidationError(error.message||"JookBox research could not be completed.",error.code||"jookbox_research_failed");
    }
    const updated=attachJookBoxResearch(project,result);
    await saveProject(projectRoot,updated);
    return sendProject(response,200,updated,request);
  }
  if(request.method==="POST"&&action==="audio"){
    const fileName=decodeURIComponent(String(request.headers["x-studio-file-name"]||"audio.mp3"));
    if(!/\.mp3$/i.test(fileName))throw new StudioValidationError("Studio currently accepts MP3 files only.","invalid_audio_type");
    const bytes=await readBytes(request,MAX_MP3_BYTES);
    if(!looksLikeMp3(bytes))throw new StudioValidationError("The selected file does not appear to be a valid MP3.","invalid_audio_file");
    const directory=projectDirectory(projectRoot,id);
    await fs.mkdir(directory,{recursive:true});
    await fs.writeFile(path.join(directory,"audio.mp3"),bytes);
    const updated=attachMp3(project,{fileName,sizeBytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex")});
    await saveProject(projectRoot,updated);
    return sendProject(response,200,updated,request);
  }
  if(request.method==="POST"&&action==="video"){
    if(project.input.type!=="bar_jukebox")throw new StudioValidationError("Choose Bar Edition before adding a local MP4 welcome video.","wrong_video_type");
    const fileName=decodeURIComponent(String(request.headers["x-studio-file-name"]||"welcome.mp4"));
    if(!/\.mp4$/i.test(fileName))throw new StudioValidationError("Bar Edition accepts MP4 welcome videos only.","invalid_video_type");
    const directory=projectDirectory(projectRoot,id);
    await fs.mkdir(directory,{recursive:true});
    const temporary=path.join(directory,`welcome-${process.pid}.tmp`);
    let uploaded;
    try{
      uploaded=await streamUpload(request,temporary,MAX_MP4_BYTES);
      if(!looksLikeMp4(uploaded.header))throw new StudioValidationError("The selected file does not appear to be a valid MP4.","invalid_video_file");
      await fs.rm(path.join(directory,"welcome.mp4"),{force:true});
      await fs.rename(temporary,path.join(directory,"welcome.mp4"));
    }catch(error){
      await fs.rm(temporary,{force:true});
      throw error;
    }
    const updated=attachMp4(project,{fileName,sizeBytes:uploaded.sizeBytes,sha256:uploaded.sha256});
    await saveProject(projectRoot,updated);
    return sendProject(response,200,updated,request);
  }
  if(request.method==="POST"&&action==="logo"){
    const fileName=decodeURIComponent(String(request.headers["x-studio-file-name"]||"logo.png"));
    const bytes=await readBytes(request,6*1024*1024);
    const logoType=detectLogoType(bytes);
    if(!logoType)throw new StudioValidationError("Studio accepts PNG, JPEG or WebP logo files only.","invalid_logo_file");
    const directory=projectDirectory(projectRoot,id);
    await fs.mkdir(directory,{recursive:true});
    await removeLogoFiles(directory);
    await fs.writeFile(path.join(directory,`logo.${logoType.extension}`),bytes);
    const updated=attachLogo(project,{fileName,sizeBytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex"),mimeType:logoType.mimeType,extension:logoType.extension});
    await saveProject(projectRoot,updated);
    return sendProject(response,200,updated,request);
  }
  if(request.method==="DELETE"&&action==="audio"){
    await fs.rm(path.join(projectDirectory(projectRoot,id),"audio.mp3"),{force:true});
    const updated=removeMp3(project);
    await saveProject(projectRoot,updated);
    return sendProject(response,200,updated,request);
  }
  if(request.method==="DELETE"&&action==="video"){
    await fs.rm(path.join(projectDirectory(projectRoot,id),"welcome.mp4"),{force:true});
    const updated=removeMp4(project);
    await saveProject(projectRoot,updated);
    return sendProject(response,200,updated,request);
  }
  if(request.method==="DELETE"&&action==="logo"){
    await removeLogoFiles(projectDirectory(projectRoot,id));
    const updated=removeLogo(project);
    await saveProject(projectRoot,updated);
    return sendProject(response,200,updated,request);
  }
  if(request.method==="GET"&&action==="audio"){
    if(!project.mp3)throw Object.assign(new Error("Audio not found."),{code:"ENOENT"});
    return serveFile(response,path.join(projectDirectory(projectRoot,id),"audio.mp3"),projectDirectory(projectRoot,id),{
      "content-type":"audio/mpeg",
      "content-disposition":`inline; filename="${safeDownloadName(project.mp3.fileName)}"`
    });
  }
  if(request.method==="GET"&&action==="video"){
    if(!project.mp4)throw Object.assign(new Error("Welcome video not found."),{code:"ENOENT"});
    return serveMediaFile(request,response,path.join(projectDirectory(projectRoot,id),"welcome.mp4"),"video/mp4");
  }
  if(request.method==="GET"&&action==="logo"){
    if(!project.logo)throw Object.assign(new Error("Logo not found."),{code:"ENOENT"});
    return serveFile(response,path.join(projectDirectory(projectRoot,id),`logo.${project.logo.extension}`),projectDirectory(projectRoot,id),{"content-type":project.logo.mimeType});
  }
  if(request.method==="GET"&&action==="handoff"){
    const manifest={
      schemaVersion:"deep-cuts-studio-handoff/1",
      exportedAt:new Date().toISOString(),
      project,
      publication:{
        authorised:false,
        verificationRequired:project.input.type==="bar_jukebox"?false:project.research?.passed!==true,
        automatedResearchPassed:project.research?.passed===true,
        confidence:Number(project.research?.confidence||0),
        confidenceGate:98,
        note:project.input.type==="bar_jukebox"
          ?"Bar Edition uses static administrator-supplied content and performs no web lookup. Publication still requires the existing isolation, file, link, deployment and live-verification checks."
          :project.research?.passed===true
          ?"Studio's automated JookBox research passed the 98% gate. Publication still requires the existing isolation, configuration, QR, deployment and live-verification factory stages."
          :"This Studio draft has not passed verified research and must complete the existing Deep Cuts production workflow before publication."
      }
    };
    response.setHeader("content-disposition",`attachment; filename="${safeDownloadName(project.input.name||"deep-cuts")}-studio-handoff.json"`);
    return sendJson(response,200,manifest);
  }
  throw Object.assign(new Error("Studio method not allowed."),{code:"method_not_allowed"});
}

function projectPayload(project,request){
  const origin=`http://${request.headers.host||"127.0.0.1"}`;
  return{
    project,
    previewUrl:`${origin}/api/studio/projects/${project.id}/preview`,
    handoffUrl:`${origin}/api/studio/projects/${project.id}/handoff`
  };
}
function sendProject(response,status,project,request){return sendJson(response,status,{ok:true,...projectPayload(project,request)})}
async function saveProject(projectRoot,project){
  const directory=projectDirectory(projectRoot,project.id);
  await fs.mkdir(directory,{recursive:true});
  const target=path.join(directory,"project.json");
  const temporary=path.join(directory,`project-${process.pid}.tmp`);
  await fs.writeFile(temporary,`${JSON.stringify(project,null,2)}\n`,"utf8");
  await fs.rename(temporary,target);
}
async function loadProject(projectRoot,id){
  const raw=await fs.readFile(path.join(projectDirectory(projectRoot,id),"project.json"),"utf8");
  return JSON.parse(raw);
}
async function listProjects(projectRoot){
  const entries=await fs.readdir(projectRoot,{withFileTypes:true}).catch(error=>error.code==="ENOENT"?[]:Promise.reject(error));
  const projects=[];
  for(const entry of entries){
    if(!entry.isDirectory()||!/^studio_[a-f0-9]{12}$/.test(entry.name))continue;
    try{projects.push(projectSummary(await loadProject(projectRoot,entry.name)))}catch{}
  }
  return projects.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,50);
}
function projectDirectory(projectRoot,id){
  assertProjectId(id);
  const resolved=path.resolve(projectRoot,id);
  if(!resolved.startsWith(path.resolve(projectRoot)+path.sep))throw new StudioValidationError("Invalid project path.","invalid_project_id");
  return resolved;
}
async function serveWithin(response,base,relative){
  const resolved=path.resolve(base,String(relative||"").replace(/^[/\\]+/,""));
  if(resolved!==path.resolve(base)&&!resolved.startsWith(path.resolve(base)+path.sep))throw new StudioValidationError("Forbidden path.","forbidden");
  let file=resolved;
  const stat=await fs.stat(file);
  if(stat.isDirectory())file=path.join(file,"index.html");
  return serveFile(response,file,base);
}
async function serveFile(response,file,base,headers={}){
  const resolved=path.resolve(file);
  if(base&&resolved!==path.resolve(base)&&!resolved.startsWith(path.resolve(base)+path.sep))throw new StudioValidationError("Forbidden path.","forbidden");
  const body=await fs.readFile(resolved);
  response.writeHead(200,{
    "content-type":CONTENT_TYPES[path.extname(resolved).toLowerCase()]||"application/octet-stream",
    "cache-control":"no-store",
    ...headers
  });
  response.end(body);
}
async function readJson(request){
  const bytes=await readBytes(request,MAX_JSON_BYTES);
  if(!bytes.length)return{};
  try{return JSON.parse(bytes.toString("utf8"))}
  catch{throw new StudioValidationError("Request body must be valid JSON.","invalid_json")}
}
async function readBytes(request,limit){
  const chunks=[];let total=0;
  for await(const chunk of request){
    total+=chunk.length;
    if(total>limit)throw new StudioValidationError(`Upload exceeds the ${Math.round(limit/1024/1024)} MB Studio limit.`,"payload_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function streamUpload(request,target,limit){
  const handle=await fs.open(target,"w");
  const hash=crypto.createHash("sha256");
  const headerChunks=[];
  let headerBytes=0;
  let sizeBytes=0;
  try{
    for await(const chunk of request){
      sizeBytes+=chunk.length;
      if(sizeBytes>limit)throw new StudioValidationError(`Upload exceeds the ${Math.round(limit/1024/1024)} MB Studio limit.`,"payload_too_large");
      if(headerBytes<32){
        const slice=chunk.subarray(0,Math.min(chunk.length,32-headerBytes));
        headerChunks.push(slice);
        headerBytes+=slice.length;
      }
      hash.update(chunk);
      await handle.write(chunk);
    }
  }finally{
    await handle.close();
  }
  return{sizeBytes,sha256:hash.digest("hex"),header:Buffer.concat(headerChunks)};
}
function looksLikeMp3(bytes){
  return bytes.length>3&&(bytes.subarray(0,3).toString("ascii")==="ID3"||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0));
}
function looksLikeMp4(bytes){
  return bytes.length>=12&&bytes.subarray(4,8).toString("ascii")==="ftyp";
}
function detectLogoType(bytes){
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return{extension:"png",mimeType:"image/png"};
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return{extension:"jpg",mimeType:"image/jpeg"};
  if(bytes.length>=12&&bytes.subarray(0,4).toString("ascii")==="RIFF"&&bytes.subarray(8,12).toString("ascii")==="WEBP")return{extension:"webp",mimeType:"image/webp"};
  return null;
}
async function removeLogoFiles(directory){
  await Promise.all(["png","jpg","webp"].map(extension=>fs.rm(path.join(directory,`logo.${extension}`),{force:true})));
}
async function serveMediaFile(request,response,file,contentType){
  const stat=await fs.stat(file);
  const range=String(request.headers.range||"");
  if(!range){
    response.writeHead(200,{
      "content-type":contentType,
      "content-length":stat.size,
      "accept-ranges":"bytes",
      "cache-control":"no-store"
    });
    createReadStream(file).pipe(response);
    return;
  }
  const match=range.match(/^bytes=(\d*)-(\d*)$/);
  if(!match){
    response.writeHead(416,{"content-range":`bytes */${stat.size}`});
    response.end();
    return;
  }
  const start=match[1]?Number(match[1]):0;
  const end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||start>=stat.size){
    response.writeHead(416,{"content-range":`bytes */${stat.size}`});
    response.end();
    return;
  }
  response.writeHead(206,{
    "content-type":contentType,
    "content-length":end-start+1,
    "content-range":`bytes ${start}-${end}/${stat.size}`,
    "accept-ranges":"bytes",
    "cache-control":"no-store"
  });
  createReadStream(file,{start,end}).pipe(response);
}
function authorizeMutation(request,token){
  const expectedOrigin=`http://${request.headers.host||"127.0.0.1"}`;
  if(request.headers.origin&&request.headers.origin!==expectedOrigin)throw new StudioValidationError("Studio rejected a cross-origin request.","invalid_origin");
  if(request.headers["x-deep-cuts-studio-token"]!==token)throw new StudioValidationError("Studio session token is missing or expired.","invalid_session");
}
function addSecurityHeaders(response){
  response.setHeader("x-content-type-options","nosniff");
  response.setHeader("x-frame-options","SAMEORIGIN");
  response.setHeader("referrer-policy","strict-origin-when-cross-origin");
  response.setHeader("permissions-policy","camera=(), geolocation=(), microphone=(self)");
  response.setHeader("content-security-policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; frame-src 'self' https://www.youtube-nocookie.com; connect-src 'self'");
}
function redirect(response,location){response.writeHead(302,{location});response.end()}
function sendHtml(response,html,{scriptNonce=""}={}){
  if(scriptNonce)response.setHeader("content-security-policy",`default-src 'self'; script-src 'self' 'nonce-${scriptNonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; frame-src 'self' https://www.youtube-nocookie.com; connect-src 'self'`);
  response.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
  response.end(html);
}
function sendJson(response,status,body){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body))}
function safeDownloadName(value){return String(value||"deep-cuts").replace(/[^a-z0-9._-]+/gi,"-").replace(/^-|-$/g,"").slice(0,100)||"deep-cuts"}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const port=Number(process.env.DEEP_CUTS_STUDIO_PORT||4380);
  const server=createStudioServer();
  server.listen(port,"127.0.0.1",()=>{
    console.log(`Deep Cuts Studio: http://127.0.0.1:${port}/studio/`);
    console.log("Local-only mode: drafts stay in .deep-cuts/studio and public editions are unchanged.");
  });
}
