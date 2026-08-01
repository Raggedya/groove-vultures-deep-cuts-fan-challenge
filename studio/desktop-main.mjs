import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import {createRequire} from "node:module";
import {app,BrowserWindow,Menu,safeStorage,session,shell} from "electron";
import {createStudioServer} from "../scripts/studio-server.mjs";
import {publishVenueBatch} from "../scripts/venue-batch-publication.mjs";

const require=createRequire(import.meta.url);
const squirrelStartup=require("electron-squirrel-startup");
const isSquirrelStartup=Boolean(squirrelStartup);
const boundedSmokeTestSwitch="deep-cuts-bounded-smoke-test";
const isBoundedSmokeTest=
  process.argv.includes(`--${boundedSmokeTestSwitch}`)||
  app.commandLine.hasSwitch(boundedSmokeTestSwitch)||
  process.env.DEEP_CUTS_BOUNDED_SMOKE_TEST==="1";
const venueBatchSwitch="deep-cuts-publish-venue-batch";
const isVenueBatchPublish=process.argv.includes(`--${venueBatchSwitch}`)||app.commandLine.hasSwitch(venueBatchSwitch);
let mainWindow=null;
let studioServer=null;
let studioOrigin="";

if(isBoundedSmokeTest){
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
}
if(isVenueBatchPublish){
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
}
app.enableSandbox();

function isStudioUrl(value){
  try{
    const url=new URL(value);
    return Boolean(studioOrigin)&&url.origin===studioOrigin;
  }catch{
    return false;
  }
}

function isSafeExternalUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==="https:";
  }catch{
    return false;
  }
}

function secureWebPreferences(){
  return{
    contextIsolation:true,
    nodeIntegration:false,
    sandbox:true,
    webSecurity:true,
    allowRunningInsecureContent:false
  };
}

function configureWebContents(contents){
  contents.setWindowOpenHandler(({url})=>{
    if(isStudioUrl(url)){
      return{
        action:"allow",
        overrideBrowserWindowOptions:{
          width:540,
          height:900,
          minWidth:390,
          minHeight:640,
          backgroundColor:"#030b16",
          autoHideMenuBar:true,
          webPreferences:secureWebPreferences()
        }
      };
    }
    if(isSafeExternalUrl(url))void shell.openExternal(url);
    return{action:"deny"};
  });

  contents.on("will-navigate",(event,url)=>{
    if(isStudioUrl(url))return;
    event.preventDefault();
    if(isSafeExternalUrl(url))void shell.openExternal(url);
  });
}

async function startStudioServer(){
  const root=app.getAppPath();
  const dataDir=path.join(app.getPath("userData"),"studio");
  const venueCredentialStore=createPublisherCredentialStore(path.join(dataDir,"publisher-credential.json"));
  studioServer=createStudioServer({root,dataDir,venueCredentialStore});
  await new Promise((resolve,reject)=>{
    studioServer.once("error",reject);
    studioServer.listen(0,"127.0.0.1",resolve);
  });
  const address=studioServer.address();
  studioOrigin=`http://127.0.0.1:${address.port}`;
}

async function createMainWindow(){
  if(!studioOrigin)await startStudioServer();
  mainWindow=new BrowserWindow({
    title:"Deep Cuts Studio",
    width:1480,
    height:940,
    minWidth:1060,
    minHeight:720,
    show:false,
    backgroundColor:"#030b16",
    autoHideMenuBar:true,
    webPreferences:secureWebPreferences()
  });
  configureWebContents(mainWindow.webContents);
  mainWindow.once("ready-to-show",()=>mainWindow?.show());
  mainWindow.on("closed",()=>{mainWindow=null});
  await mainWindow.loadURL(`${studioOrigin}/studio/`);
}

function createPublisherCredentialStore(filePath){
  async function read(){try{return JSON.parse(await fs.readFile(filePath,"utf8"))}catch(error){if(error.code==="ENOENT")return{};throw error}}
  async function write(value){
    await fs.mkdir(path.dirname(filePath),{recursive:true});
    const temporary=`${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary,`${JSON.stringify(value,null,2)}\n`,{encoding:"utf8",mode:0o600});
    await fs.rename(temporary,filePath);
  }
  async function getInstallationId(){
    const record=await read();
    if(/^studio_[a-f0-9]{32}$/.test(String(record.installationId||"")))return record.installationId;
    record.installationId=`studio_${crypto.randomBytes(16).toString("hex")}`;record.createdAt=new Date().toISOString();await write(record);return record.installationId;
  }
  async function getToken(){
    const record=await read();if(!record.encryptedToken)return"";
    if(!safeStorage.isEncryptionAvailable())throw new Error("Windows secure credential storage is unavailable.");
    try{return safeStorage.decryptString(Buffer.from(record.encryptedToken,"base64"))}catch{return""}
  }
  async function setToken(token){
    if(!safeStorage.isEncryptionAvailable())throw new Error("Windows secure credential storage is unavailable.");
    const record=await read();record.installationId=await getInstallationId();record.encryptedToken=safeStorage.encryptString(String(token)).toString("base64");record.activatedAt=new Date().toISOString();await write(record);
  }
  async function clearToken(){const record=await read();delete record.encryptedToken;delete record.activatedAt;await write(record)}
  return{activationSupported:true,getInstallationId,getToken,setToken,clearToken};
}

async function runBoundedPackageSmokeTest(){
  if(!studioOrigin)await startStudioServer();
  const [response,venueResponse]=await Promise.all([
    fetch(`${studioOrigin}/studio/`),
    fetch(`${studioOrigin}/studio/venue-library.html`)
  ]);
  const [html,venueHtml]=await Promise.all([response.text(),venueResponse.text()]);
  if(!response.ok||!venueResponse.ok||!html.includes("Deep Cuts Studio")||!html.includes('class="output-column" hidden')||!venueHtml.includes("Venue Library")||!venueHtml.includes("Secure Publish Venue")){
    throw new Error("The packaged Studio server did not return the simplified owner interface.");
  }
}

async function stopStudioServer(){
  if(!studioServer)return;
  const server=studioServer;
  studioServer=null;
  await new Promise(resolve=>server.close(resolve));
}

if(isSquirrelStartup){
  app.quit();
}else{
  const hasSingleInstanceLock=isVenueBatchPublish||(isBoundedSmokeTest||app.requestSingleInstanceLock());
  if(!hasSingleInstanceLock){
    app.quit();
  }else{
    app.on("second-instance",()=>{
      if(mainWindow){
        if(mainWindow.isMinimized())mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(async()=>{
      if(process.platform!=="darwin")Menu.setApplicationMenu(null);
      if(isVenueBatchPublish){
        const dataDir=path.join(app.getPath("userData"),"studio");
        const venueCredentialStore=createPublisherCredentialStore(path.join(dataDir,"publisher-credential.json"));
        const videoPath=commandValue("video");
        const force=process.argv.includes("--force")||app.commandLine.hasSwitch("force");
        const result=await publishVenueBatch({dataDir,workspaceRoot:app.getAppPath(),videoPath,credentialStore:venueCredentialStore,appVersion:app.getVersion(),force,onProgress:event=>console.log(`[Venue batch ${event.position||""}] ${event.masterId||""} ${event.venueName||""} — ${event.stage||event.status}: ${event.message||""}`)});
        console.log(`VENUE_BATCH_RESULT=${JSON.stringify({batchId:result.batchId,total:result.total,published:result.published,failed:result.failed,reportPath:result.reportPath})}`);
        app.exit(result.failed?1:0);return;
      }
      session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{
        const requestingUrl=details.requestingUrl||webContents.getURL();
        callback(permission==="media"&&isStudioUrl(requestingUrl));
      });
      if(isBoundedSmokeTest){
        await runBoundedPackageSmokeTest();
        await stopStudioServer();
        app.exit(0);
        return;
      }
      await createMainWindow();
      app.on("activate",async()=>{
        if(BrowserWindow.getAllWindows().length===0)await createMainWindow();
      });
    }).catch(error=>{
      console.error("[Deep Cuts Studio Desktop]",error);
      app.quit();
    });

    app.on("window-all-closed",()=>{
      if(process.platform!=="darwin")app.quit();
    });
    app.on("before-quit",()=>{void stopStudioServer()});
  }
}

function commandValue(name){const prefix=`--${name}=`;const inline=process.argv.find(value=>value.startsWith(prefix));if(inline)return inline.slice(prefix.length);const index=process.argv.indexOf(`--${name}`);return index>=0?String(process.argv[index+1]||""):""}
