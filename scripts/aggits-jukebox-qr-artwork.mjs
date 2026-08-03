import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import sharp from "sharp";

export const AGGITS_JUKEBOX_QR_SIZE=1254;
export const AGGITS_JUKEBOX_QR_SCHEMA="deep-cuts-aggits-jukebox-qr/1";
export const AGGITS_JUKEBOX_QR_MASTER_SHA256="1750e428f4445b7be57b2bcc9ad681681c2c070930b1ade019c237ed68fdb684";
export const AGGITS_JUKEBOX_QR_PANEL=Object.freeze({left:751,top:543,width:354,height:384});

export async function createAggitsJukeboxQrArtwork({root,title,destination}={}){
  const sourceRoot=path.resolve(root||process.cwd()),payload=assertDestination(destination),displayTitle=cleanTitle(title);
  const masterPath=path.join(sourceRoot,"assets","aggits-jukebox-qr-master-v1.png"),qrSourcePath=path.join(sourceRoot,"scripts","vendor","qrcode.min.js");
  const [master,qrSource]=await Promise.all([fs.readFile(masterPath),fs.readFile(qrSourcePath,"utf8")]);
  const digest=crypto.createHash("sha256").update(master).digest("hex");
  if(digest!==AGGITS_JUKEBOX_QR_MASTER_SHA256)throw qrError("The owner-approved Aggits QR master identity changed.","qr_master_identity_changed");
  const metadata=await sharp(master).metadata();
  if(metadata.width!==AGGITS_JUKEBOX_QR_SIZE||metadata.height!==AGGITS_JUKEBOX_QR_SIZE)throw qrError("The Aggits QR master must remain 1254 x 1254.","qr_master_invalid");
  const matrix=qrMatrix(qrSource,payload),placement=qrPlacement(matrix.length),overlay=Buffer.from(renderOverlay(matrix,placement,displayTitle));
  const png=await sharp(master,{failOn:"error"}).composite([{input:overlay,left:0,top:0}]).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
  await verifyMatrix(png,matrix,placement,1);await verifyMatrix(png,matrix,placement,.5);
  return{schemaVersion:AGGITS_JUKEBOX_QR_SCHEMA,bytes:png,sha256:crypto.createHash("sha256").update(png).digest("hex"),destination:payload,width:AGGITS_JUKEBOX_QR_SIZE,height:AGGITS_JUKEBOX_QR_SIZE,scanProof:"rendered-matrix:full+627x627"};
}

function qrMatrix(source,text){
  const element={innerHTML:"",title:"",childNodes:[{offsetWidth:256,offsetHeight:256,style:{}}]},context={navigator:{userAgent:""},document:{documentElement:{tagName:"html"},getElementById(){return element}},console};
  vm.createContext(context);vm.runInContext(source,context,{timeout:2000});const instance=new context.QRCode(element,{text,correctLevel:context.QRCode.CorrectLevel.H,width:256,height:256});
  const actual=instance._oQRCode;
  if(!actual)throw qrError("The QR matrix could not be generated.","qr_matrix_invalid");
  const count=actual.getModuleCount();return Array.from({length:count},(_,row)=>Array.from({length:count},(_,column)=>Boolean(actual.isDark(row,column))));
}

function qrPlacement(count){const panel=AGGITS_JUKEBOX_QR_PANEL,border=4,module=Math.floor((panel.width-10)/(count+border*2)),size=module*(count+border*2);if(module<3)throw qrError("The permanent URL is too long for the locked QR panel.","qr_payload_too_long");return{border,module,size,left:panel.left+Math.floor((panel.width-size)/2),top:panel.top+Math.floor((panel.height-size)/2)}}
function renderOverlay(matrix,p,title){
  const modules=[];for(let row=0;row<matrix.length;row++)for(let column=0;column<matrix.length;column++)if(matrix[row][column])modules.push(`<rect x="${p.left+(column+p.border)*p.module}" y="${p.top+(row+p.border)*p.module}" width="${p.module}" height="${p.module}" fill="#050403"/>`);
  const lines=titleLines(title),fontSize=fitTitle(lines);
  const titleMarkup=lines.length===1?`<text x="930" y="406">${xml(lines[0])}</text>`:`<text x="930" y="385">${xml(lines[0])}</text><text x="930" y="430">${xml(lines[1])}</text>`;
  const panel=AGGITS_JUKEBOX_QR_PANEL;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254"><rect x="724" y="335" width="411" height="133" rx="28" fill="#0d0a06" opacity=".97"/><g fill="#e2b86d" stroke="#3c210b" stroke-width="1.2" paint-order="stroke" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="${fontSize}" font-weight="800" letter-spacing="2">${titleMarkup}</g><rect x="${panel.left}" y="${panel.top}" width="${panel.width}" height="${panel.height}" rx="4" fill="#fffaf0"/>${modules.join("")}</svg>`;
}
async function verifyMatrix(png,matrix,p,scale){const {data,info}=await sharp(png).resize(Math.round(AGGITS_JUKEBOX_QR_SIZE*scale),Math.round(AGGITS_JUKEBOX_QR_SIZE*scale),{kernel:sharp.kernel.nearest}).removeAlpha().raw().toBuffer({resolveWithObject:true});let mismatches=0,total=0;for(let row=0;row<matrix.length;row++)for(let column=0;column<matrix.length;column++){const x=Math.round((p.left+(column+p.border+.5)*p.module)*scale),y=Math.round((p.top+(row+p.border+.5)*p.module)*scale),i=(Math.min(info.height-1,y)*info.width+Math.min(info.width-1,x))*info.channels,dark=(data[i]+data[i+1]+data[i+2])/3<128;if(dark!==matrix[row][column])mismatches++;total++}if(mismatches>Math.max(1,Math.floor(total*.002)))throw qrError(`The ${info.width} x ${info.height} QR scan-back failed.`,"qr_scanback_failed")}
function titleLines(value){const words=value.split(/\s+/);if(value.length<=23||words.length<2)return[value];let at=1,diff=Infinity;for(let i=1;i<words.length;i++){const next=Math.abs(words.slice(0,i).join(" ").length-words.slice(i).join(" ").length);if(next<diff){diff=next;at=i}}return[words.slice(0,at).join(" "),words.slice(at).join(" ")]}
function fitTitle(lines){const longest=Math.max(...lines.map(line=>[...line].reduce((n,c)=>n+("MW@#".includes(c)?1.1:("I1 ".includes(c)?0.48:0.78)),0)));return Math.max(lines.length===1?24:19,Math.min(lines.length===1?45:34,Math.floor(330/Math.max(1,longest))))}
function assertDestination(value){let url;try{url=new URL(String(value||"").trim())}catch{throw qrError("The permanent QR destination is invalid.","qr_destination_invalid")}if(url.protocol!=="https:"||url.username||url.password||!/^\/q\/dc_[a-f0-9]{10}$/.test(url.pathname))throw qrError("The QR must target an opaque public Deep Cuts route.","qr_destination_invalid");return url.href}
function cleanTitle(value){const text=String(value||"").trim().replace(/\s+/g," ").toUpperCase().slice(0,120);if(!text)throw qrError("The QR title is required.","qr_title_missing");return text}
function xml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]))}
function qrError(message,code){return Object.assign(new Error(message),{name:"AggitsJukeboxQrError",code})}
