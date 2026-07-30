import fs from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const dist=path.join(root,"dist");

// The static bundle is a commercial public surface, not a repository mirror.
// Every file must be named here, referenced by an active edition, or be one of
// the two approved public delivery images.
const PUBLIC_ROOT_FILES=[
  "index.html",
  "styles.css",
  "platform.json",
  "analytics.html",
  "analytics.css"
];
const PUBLIC_JS_FILES=[
  "js/analytics.js",
  "js/app.js",
  "js/business-profile.js",
  "js/business-quiz.js",
  "js/engine.js",
  "js/interactions.js",
  "js/laneway-company-quiz.js",
  "js/laneway-quiz.js",
  "js/report.js",
  "js/reporting.js",
  "js/school-quiz.js"
];
const PUBLIC_SELL_FILES=[
  "sell/app.js",
  "sell/banjo-brief.js",
  "sell/demo-data.js",
  "sell/index.html",
  "sell/schemas.js",
  "sell/styles.css"
];
const PUBLIC_RECORD_COMPANY_FILES=[
  "record-company/app.js",
  "record-company/index.html",
  "record-company/privacy.html",
  "record-company/schemas.js",
  "record-company/styles.css",
  "record-company/terms.html"
];
const PUBLIC_DELIVERY_FILES=new Set(["instagram-discovery.png","instagram-qr.png"]);
const PRIVATE_BASENAMES=new Set(["research.json","delivery-manifest.json","build-export.json"]);
const PRIVATE_EXTENSIONS=new Set([".csv",".sql",".sqlite",".xls",".xlsx",".zip"]);
const LOCAL_PUBLIC_PREFIXES=["assets/","editions/"];
const SOURCE_ASSET_PATTERN=/(?:^|["'=(\s])\/?(assets\/[a-zA-Z0-9_.\/-]+\.[a-zA-Z0-9]+)(?=$|["')?#\s])/g;

const platform=JSON.parse(await fs.readFile(path.join(root,"platform.json"),"utf8"));
const activeEditions=(Array.isArray(platform.editions)?platform.editions:[]).filter(edition=>edition?.active!==false);
if(!activeEditions.length)throw new Error("The public build cannot proceed without active editions.");

const publicFiles=new Set([
  ...PUBLIC_ROOT_FILES,
  ...PUBLIC_JS_FILES,
  ...PUBLIC_SELL_FILES,
  ...PUBLIC_RECORD_COMPANY_FILES
]);

for(const edition of activeEditions){
  const configPath=publicPath(edition.config,`configuration for ${edition.editionId||edition.slug||"unknown edition"}`);
  if(!configPath.startsWith("editions/")||!configPath.endsWith("/edition.json")){
    throw new Error(`Active edition ${edition.editionId||edition.slug} has an invalid public configuration path.`);
  }
  publicFiles.add(configPath);
  if(!(await isFile(sourcePath(configPath))))throw new Error(`Active edition configuration is missing or is not a regular file: ${configPath}`);
  const config=JSON.parse(await fs.readFile(sourcePath(configPath),"utf8"));
  collectConfigReferences(config,publicFiles);
}

// Runtime fallbacks and fixed interface assets live in source code rather than
// edition configuration. Discover only literal asset paths in the approved
// browser files; a new public source file still requires an explicit entry above.
for(const relativePath of [...PUBLIC_ROOT_FILES,...PUBLIC_JS_FILES,...PUBLIC_SELL_FILES,...PUBLIC_RECORD_COMPANY_FILES]){
  const source=await fs.readFile(sourcePath(relativePath),"utf8");
  for(const match of source.matchAll(SOURCE_ASSET_PATTERN)){
    const assetPath=publicPath(match[1],`asset reference in ${relativePath}`);
    if(await isFile(sourcePath(assetPath)))publicFiles.add(assetPath);
  }
}

await fs.rm(dist,{recursive:true,force:true});
await fs.mkdir(dist,{recursive:true});
for(const relativePath of [...publicFiles].sort())await copyPublicFile(relativePath);
await copyApprovedDeliveryImages();

console.log(`Deep Cuts static bundle created at ${dist} with ${await countFiles(dist)} explicitly approved public files.`);

function collectConfigReferences(value,output){
  if(Array.isArray(value)){
    for(const item of value)collectConfigReferences(item,output);
    return;
  }
  if(value&&typeof value==="object"){
    for(const item of Object.values(value))collectConfigReferences(item,output);
    return;
  }
  if(typeof value!=="string")return;
  const candidate=value.trim().replace(/^\/+/,"").split(/[?#]/,1)[0];
  if(!LOCAL_PUBLIC_PREFIXES.some(prefix=>candidate.startsWith(prefix)))return;
  output.add(publicPath(candidate,"edition data reference"));
}

async function copyApprovedDeliveryImages(){
  const outputRoot=path.join(root,"output");
  let directories=[];
  try{directories=await fs.readdir(outputRoot,{withFileTypes:true})}
  catch(error){if(error.code==="ENOENT")return;throw error}
  for(const directory of directories){
    if(!directory.isDirectory()||!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(directory.name))continue;
    for(const fileName of PUBLIC_DELIVERY_FILES){
      const relativePath=publicPath(`output/${directory.name}/${fileName}`,"public delivery image");
      if(await isFile(sourcePath(relativePath)))await copyPublicFile(relativePath);
    }
  }
}

async function copyPublicFile(relativePath){
  const source=sourcePath(relativePath);
  if(!(await isFile(source)))throw new Error(`Approved public file is missing: ${relativePath}`);
  const target=targetPath(relativePath);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(source,target);
}

function publicPath(value,description){
  const normalized=String(value||"").replaceAll("\\","/").replace(/^\/+/,"");
  if(!normalized||normalized.includes("\0")||normalized.split("/").some(segment=>segment===""||segment==="."||segment==="..")){
    throw new Error(`Unsafe ${description}: ${value}`);
  }
  const lower=normalized.toLowerCase();
  const basename=lower.split("/").at(-1);
  const extension=basename.includes(".")?basename.slice(basename.lastIndexOf(".")):"";
  if(lower.startsWith("record-company-output/")||PRIVATE_BASENAMES.has(basename)||PRIVATE_EXTENSIONS.has(extension)){
    throw new Error(`Private file cannot enter the public bundle (${description}): ${value}`);
  }
  return normalized;
}

function sourcePath(relativePath){
  return containedPath(root,relativePath,"source");
}

function targetPath(relativePath){
  return containedPath(dist,relativePath,"target");
}

function containedPath(base,relativePath,label){
  const resolved=path.resolve(base,...relativePath.split("/"));
  const prefix=`${path.resolve(base)}${path.sep}`;
  if(resolved!==path.resolve(base)&&!resolved.startsWith(prefix))throw new Error(`Public build ${label} escapes its root: ${relativePath}`);
  return resolved;
}

async function isFile(filePath){
  try{return (await fs.lstat(filePath)).isFile()}
  catch(error){if(error.code==="ENOENT")return false;throw error}
}

async function countFiles(directory){
  let total=0;
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    if(entry.isDirectory())total+=await countFiles(path.join(directory,entry.name));
    else if(entry.isFile())total+=1;
  }
  return total;
}
