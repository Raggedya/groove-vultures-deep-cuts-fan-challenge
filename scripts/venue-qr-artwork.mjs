import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import sharp from "sharp";

export const VENUE_QR_WIDTH=1920;
export const VENUE_QR_HEIGHT=1080;
export const VENUE_QR_SCHEMA="deep-cuts-venue-qr/1";

export async function createVenueQrArtwork({root,venueName,destination}={}){
  const sourceRoot=path.resolve(root||process.cwd());
  const payload=assertQrDestination(destination);
  const name=cleanVenueName(venueName);
  const masterPath=path.join(sourceRoot,"assets","jookbox-venue-qr-master-v1.png");
  const qrCodePath=path.join(sourceRoot,"scripts","vendor","qrcode.min.js");
  const [master,qrCodeSource]=await Promise.all([fs.readFile(masterPath),fs.readFile(qrCodePath,"utf8")]);
  const masterMetadata=await sharp(master).metadata();
  if(masterMetadata.width!==VENUE_QR_WIDTH||masterMetadata.height!==VENUE_QR_HEIGHT)throw qrError("The locked venue QR master is not 1920 x 1080.","qr_master_invalid");
  const matrix=qrMatrix(qrCodeSource,payload);
  const placement=qrPlacement(matrix.length);
  const overlay=Buffer.from(renderOverlay({matrix,placement,name}));
  const png=await sharp(master,{failOn:"error"}).composite([{input:overlay,left:0,top:0}]).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
  const metadata=await sharp(png).metadata();
  if(metadata.width!==VENUE_QR_WIDTH||metadata.height!==VENUE_QR_HEIGHT||metadata.format!=="png")throw qrError("The rendered venue QR artwork has invalid dimensions.","qr_render_invalid");
  await verifyRenderedMatrix(png,matrix,placement,1);
  await verifyRenderedMatrix(png,matrix,placement,.5);
  return{
    schemaVersion:VENUE_QR_SCHEMA,
    bytes:png,
    sha256:crypto.createHash("sha256").update(png).digest("hex"),
    destination:payload,
    width:VENUE_QR_WIDTH,
    height:VENUE_QR_HEIGHT,
    scanProof:"rendered-matrix:full+960x540"
  };
}

function qrMatrix(source,text){
  const element={innerHTML:"",title:"",childNodes:[{offsetWidth:256,offsetHeight:256,style:{}}]};
  const context={navigator:{userAgent:""},document:{documentElement:{tagName:"html"},getElementById(){return element}},console};
  vm.createContext(context);vm.runInContext(source,context,{timeout:2000});
  const qr=new context.QRCode(element,{text,correctLevel:context.QRCode.CorrectLevel.H,width:256,height:256});
  const model=qr._oQRCode,count=model.getModuleCount();
  if(!Number.isInteger(count)||count<21||count>177)throw qrError("The QR matrix could not be generated.","qr_matrix_invalid");
  return Array.from({length:count},(_,row)=>Array.from({length:count},(_,column)=>Boolean(model.isDark(row,column))));
}

function qrPlacement(count){
  const border=4,module=Math.floor(384/(count+border*2)),size=module*(count+border*2);
  if(module<3)throw qrError("The permanent QR destination is too long.","qr_payload_too_long");
  return{border,module,size,left:952+Math.floor((384-size)/2),top:409+Math.floor((384-size)/2)};
}

function renderOverlay({matrix,placement,name}){
  const modules=[];
  for(let row=0;row<matrix.length;row++)for(let column=0;column<matrix.length;column++)if(matrix[row][column]){
    const x=placement.left+(column+placement.border)*placement.module;
    const y=placement.top+(row+placement.border)*placement.module;
    modules.push(`<rect x="${x}" y="${y}" width="${placement.module}" height="${placement.module}" fill="#020914"/>`);
  }
  const fontSize=fitTitleSize(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VENUE_QR_WIDTH}" height="${VENUE_QR_HEIGHT}" viewBox="0 0 ${VENUE_QR_WIDTH} ${VENUE_QR_HEIGHT}">
    <rect x="919" y="376" width="450" height="450" fill="#fff"/>
    <rect x="${placement.left}" y="${placement.top}" width="${placement.size}" height="${placement.size}" fill="#fff"/>
    ${modules.join("")}
    <rect x="835" y="903" width="649" height="99" rx="8" fill="#07152d" stroke="#1576ff" stroke-width="3"/>
    <text x="1160" y="956" fill="#f6f8fb" text-anchor="middle" dominant-baseline="middle" font-family="Impact, Arial Black, DejaVu Sans, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="1">${escapeXml(name)}</text>
  </svg>`;
}

async function verifyRenderedMatrix(png,matrix,placement,scale){
  const width=Math.round(VENUE_QR_WIDTH*scale),height=Math.round(VENUE_QR_HEIGHT*scale);
  const {data,info}=await sharp(png).resize(width,height,{kernel:sharp.kernel.lanczos3}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let mismatches=0,total=0;
  const samples=[.32,.5,.68];
  for(let row=0;row<matrix.length;row++)for(let column=0;column<matrix.length;column++){
    let darkness=0,count=0;
    for(const xSample of samples)for(const ySample of samples){
      const x=Math.min(info.width-1,Math.max(0,Math.round((placement.left+(column+placement.border+xSample)*placement.module)*scale)));
      const y=Math.min(info.height-1,Math.max(0,Math.round((placement.top+(row+placement.border+ySample)*placement.module)*scale)));
      const index=(y*info.width+x)*info.channels;
      darkness+=(data[index]+data[index+1]+data[index+2])/3;count++;
    }
    const renderedDark=darkness/count<128;
    if(renderedDark!==matrix[row][column])mismatches++;
    total++;
  }
  if(mismatches>Math.max(1,Math.floor(total*.002)))throw qrError(`The ${width} x ${height} QR scan-back failed (${mismatches} module mismatches).`,"qr_scanback_failed");
}

function fitTitleSize(value){
  const weighted=[...value].reduce((sum,char)=>sum+("MW@#".includes(char)?1.15:("I1 ".includes(char)?0.48:0.78)),0);
  return Math.max(28,Math.min(64,Math.floor(585/Math.max(1,weighted))));
}
function assertQrDestination(value){const text=String(value||"").trim();let url;try{url=new URL(text)}catch{throw qrError("The permanent QR destination is invalid.","qr_destination_invalid")}if(url.protocol!=="https:"||!/^\/q\/dc_[a-f0-9]{10}$/.test(url.pathname)||url.username||url.password)throw qrError("The permanent QR must target an opaque Deep Cuts HTTPS QR route.","qr_destination_invalid");return url.href}
function cleanVenueName(value){const text=String(value||"").trim().replace(/\s+/g," ").toUpperCase().slice(0,120);if(!text)throw qrError("The QR artwork requires a venue name.","qr_venue_name_missing");return text}
function escapeXml(value){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]))}
function qrError(message,code){return Object.assign(new Error(message),{name:"VenueQrArtworkError",code})}
