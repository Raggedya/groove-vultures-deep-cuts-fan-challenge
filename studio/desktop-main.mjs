import path from "node:path";
import {createRequire} from "node:module";
import {app,BrowserWindow,Menu,session,shell} from "electron";
import {createStudioServer} from "../scripts/studio-server.mjs";

const require=createRequire(import.meta.url);
const squirrelStartup=require("electron-squirrel-startup");
const isSquirrelStartup=Boolean(squirrelStartup);
let mainWindow=null;
let studioServer=null;
let studioOrigin="";

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
  studioServer=createStudioServer({root,dataDir});
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

async function stopStudioServer(){
  if(!studioServer)return;
  const server=studioServer;
  studioServer=null;
  await new Promise(resolve=>server.close(resolve));
}

if(isSquirrelStartup){
  app.quit();
}else{
  const hasSingleInstanceLock=app.requestSingleInstanceLock();
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
      session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{
        const requestingUrl=details.requestingUrl||webContents.getURL();
        callback(permission==="media"&&isStudioUrl(requestingUrl));
      });
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
