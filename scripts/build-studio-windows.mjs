import crypto from "node:crypto";
import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {promisify} from "node:util";

const require=createRequire(import.meta.url);
const packagerModule=require("@electron/packager");
const packager=packagerModule.packager||packagerModule.default||packagerModule;
const {zip}=require("cross-zip");
const electronPackage=require("electron/package.json");
const electronChecksums=require("electron/checksums.json");
const execFileAsync=promisify(execFile);
const zipAsync=promisify(zip);

const root=process.cwd();
const packageData=JSON.parse(await fs.readFile(path.join(root,"package.json"),"utf8"));
const version=String(packageData.version||"").trim();
const productName=String(packageData.productName||"Deep Cuts Studio").trim();
const executableName="deep-cuts-studio";
const electronVersion=String(electronPackage.version||"").trim();
const electronZipName=`electron-v${electronVersion}-win32-x64.zip`;
const expectedElectronHash=String(electronChecksums[electronZipName]||"").toLowerCase();
const outputDirectory=path.join(root,"output",`Deep-Cuts-Studio-Windows-${version}`);
const temporaryRoot=await fs.mkdtemp(path.join(os.tmpdir(),"deep-cuts-studio-windows-"));
const sourceDirectory=path.join(temporaryRoot,"source");
const packagedDirectory=path.join(temporaryRoot,"packaged");

const runtimeFiles=[
  "studio/desktop-main.mjs",
  "studio/index.html",
  "studio/styles.css",
  "studio/app.js",
  "studio/import-editions.html",
  "studio/import-editions.css",
  "studio/import-editions.js",
  "studio/venue-library.html",
  "studio/venue-library.css",
  "studio/venue-library.js",
  "scripts/studio-model.mjs",
  "scripts/aggits-jukebox-icons.mjs",
  "scripts/aggits-jukebox-import.mjs",
  "scripts/aggits-jukebox-preview.mjs",
  "scripts/aggits-jukebox-publication.mjs",
  "scripts/aggits-jukebox-qr-artwork.mjs",
  "scripts/studio-jookbox-research.mjs",
  "scripts/studio-server.mjs",
  "scripts/venue-library.mjs",
  "scripts/venue-library-server.mjs",
  "scripts/venue-batch-publication.mjs",
  "scripts/bar-edition-publication.mjs",
  "scripts/venue-qr-artwork.mjs",
  "scripts/vendor/qrcode.min.js",
  "platform.json",
  "assets/aggits-original-cutout-v4.png",
  "assets/hgm-aggits-owner-supplied.jpg",
  "assets/jookbox-cabinet-photoreal-v1.webp",
  "assets/jookbox-atlas-reference-v1.webp",
  "assets/jookbox-bar-heritage-brass-v1.png",
  "assets/jookbox-venue-qr-master-v1.png",
  "assets/aggits-jukebox-master-v1.jpg",
  "assets/aggits-jukebox-oval-master-v2.jpg",
  "assets/aggits-jukebox-icons-master-v1.jpg",
  "assets/aggits-jukebox-integrity.json",
  "assets/aggits-jukebox-qr-master-v1.png",
  "assets/audio/jukebox-real-coin-insert-cc0.mp3",
  "assets/audio/jukebox-real-coin-insert-cc0.LICENSE.txt",
  "assets/audio/jukebox-mechanical-button-clunk-public-domain.ogg",
  "assets/audio/jukebox-mechanical-button-clunk-public-domain.LICENSE.txt",
  "assets/js/jookbox-coin-audio.js"
];

function log(message){
  console.log(`[Windows Studio] ${message}`);
}

function assertSafeOutput(target){
  const relative=path.relative(path.join(root,"output"),target);
  if(!relative||relative.startsWith("..")||path.isAbsolute(relative)){
    throw new Error(`Unsafe Windows output path: ${target}`);
  }
}

function assertSafeTemporary(target){
  const relative=path.relative(os.tmpdir(),target);
  if(relative.startsWith("..")||path.isAbsolute(relative)||!path.basename(target).startsWith("deep-cuts-studio-windows-")){
    throw new Error(`Unsafe temporary build path: ${target}`);
  }
}

async function copyRuntimeFile(relativePath){
  const source=path.join(root,relativePath);
  const destination=path.join(sourceDirectory,relativePath);
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.copyFile(source,destination);
}

async function sha256(filePath){
  const hash=crypto.createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function findFileBelow(directory,fileName,depth=3){
  if(!directory||depth<0)return "";
  try{
    const direct=path.join(directory,fileName);
    const stats=await fs.stat(direct).catch(()=>null);
    if(stats?.isFile())return direct;
    const entries=await fs.readdir(directory,{withFileTypes:true});
    for(const entry of entries){
      if(!entry.isDirectory())continue;
      const found=await findFileBelow(path.join(directory,entry.name),fileName,depth-1);
      if(found)return found;
    }
  }catch{
    return "";
  }
  return "";
}

async function locateElectronZip(){
  const candidates=[
    process.env.DEEP_CUTS_ELECTRON_ZIP_DIR,
    path.join(root,".tools","localappdata","electron","Cache"),
    process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,"electron","Cache"):"",
    path.join(os.homedir(),"AppData","Local","electron","Cache")
  ].filter(Boolean);
  for(const candidate of candidates){
    const found=await findFileBelow(candidate,electronZipName);
    if(found)return found;
  }
  return "";
}

async function writeDeliveryNotes(installerFiles){
  const hashes=[];
  for(const filePath of installerFiles){
    hashes.push(`${await sha256(filePath)}  ${path.basename(filePath)}`);
  }
  await fs.writeFile(
    path.join(outputDirectory,"SHA256SUMS.txt"),
    `${hashes.join("\r\n")}\r\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(outputDirectory,"INSTALL ON WINDOWS.txt"),
    [
      `DEEP CUTS STUDIO ${version} — WINDOWS`,
      "",
      "1. Double-click the file named:",
      `   ${productName}-${version} Setup.exe`,
      "",
      "2. If Windows displays a protection message, choose More info, then Run anyway.",
      "",
      "3. Wait for installation to finish. Deep Cuts Studio will open automatically.",
      "",
      "4. Future updates can be installed over this version. Your Studio drafts are stored",
      "   separately in your Windows application-data folder and are not removed.",
      "",
      "This installer is for 64-bit Windows 10 or Windows 11.",
      "Copyright Clearlight Creative 2026."
    ].join("\r\n"),
    "utf8"
  );
}

async function createIExpressInstaller(appDirectory){
  const portableZipName=`Deep-Cuts-Studio-${version}-Windows-x64.zip`;
  const portableZip=path.join(outputDirectory,portableZipName);
  const setupExeName=`${productName}-${version} Setup.exe`;
  const setupExe=path.join(outputDirectory,setupExeName);
  const bootstrapDirectory=path.join(temporaryRoot,"installer");
  await fs.mkdir(bootstrapDirectory,{recursive:true});

  log("Creating the portable Windows application archive.");
  await zipAsync(appDirectory,portableZip);
  await fs.copyFile(portableZip,path.join(bootstrapDirectory,portableZipName));

  const installPowerShell=[
    "param([Parameter(Mandatory=$true)][string]$Archive)",
    "$ErrorActionPreference='Stop'",
    `$installDirectory=Join-Path $env:LOCALAPPDATA 'Programs\\${productName}'`,
    "New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null",
    "Expand-Archive -LiteralPath $Archive -DestinationPath $installDirectory -Force",
    `$application=Join-Path $installDirectory '${executableName}.exe'`,
    "if(-not (Test-Path -LiteralPath $application)){throw 'Deep Cuts Studio executable was not installed.'}",
    "$shell=New-Object -ComObject WScript.Shell",
    "function Set-StudioShortcut([string]$shortcutPath){",
    "  $shortcut=$shell.CreateShortcut($shortcutPath)",
    "  $shortcut.TargetPath=$application",
    "  $shortcut.WorkingDirectory=$installDirectory",
    `  $shortcut.Description='${productName}'`,
    "  $shortcut.Save()",
    "}",
    `$desktopShortcut=Join-Path ([Environment]::GetFolderPath('Desktop')) '${productName}.lnk'`,
    `$startMenuDirectory=Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\${productName}'`,
    "New-Item -ItemType Directory -Force -Path $startMenuDirectory | Out-Null",
    `$startMenuShortcut=Join-Path $startMenuDirectory '${productName}.lnk'`,
    "Set-StudioShortcut $desktopShortcut",
    "Set-StudioShortcut $startMenuShortcut",
    "Start-Process -FilePath $application"
  ].join("\r\n");
  await fs.writeFile(path.join(bootstrapDirectory,"install.ps1"),installPowerShell,"utf8");
  await fs.writeFile(
    path.join(bootstrapDirectory,"install.cmd"),
    [
      "@ECHO OFF",
      `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Archive "%~dp0${portableZipName}"`,
      "EXIT /B %ERRORLEVEL%"
    ].join("\r\n"),
    "utf8"
  );

  const sedPath=path.join(bootstrapDirectory,"windows-installer.sed");
  const sed=[
    "[Version]",
    "Class=IEXPRESS",
    "SEDVersion=3",
    "[Options]",
    "PackagePurpose=InstallApp",
    "ShowInstallProgramWindow=1",
    "HideExtractAnimation=0",
    "UseLongFileName=1",
    "InsideCompressed=0",
    "CAB_FixedSize=0",
    "CAB_ResvCodeSigning=0",
    "RebootMode=N",
    "InstallPrompt=",
    "DisplayLicense=",
    "FinishMessage=",
    `TargetName=${setupExe}`,
    `FriendlyName=${productName} ${version}`,
    "AppLaunched=install.cmd",
    "PostInstallCmd=<None>",
    "AdminQuietInstCmd=install.cmd",
    "UserQuietInstCmd=install.cmd",
    "SourceFiles=SourceFiles",
    "[Strings]",
    `FILE0="${portableZipName}"`,
    'FILE1="install.cmd"',
    'FILE2="install.ps1"',
    "[SourceFiles]",
    `SourceFiles0=${bootstrapDirectory}${path.sep}`,
    "[SourceFiles0]",
    "%FILE0%=",
    "%FILE1%=",
    "%FILE2%="
  ].join("\r\n");
  await fs.writeFile(sedPath,sed,"utf8");

  log("Creating the one-click Windows Setup executable.");
  await execFileAsync(path.join(process.env.SystemRoot||"C:\\Windows","System32","iexpress.exe"),[
    "/N",
    "/Q",
    sedPath
  ],{windowsHide:true,maxBuffer:16*1024*1024});
  if(!(await fs.stat(setupExe).catch(()=>null))?.isFile()){
    throw new Error(`Windows Setup executable was not created: ${setupExe}`);
  }
  return{portableZip,setupExe};
}

if(process.platform!=="win32"){
  throw new Error("The Deep Cuts Studio Windows installer must be built on Windows.");
}
if(!version)throw new Error("The Studio package version is missing.");
if(!electronVersion||!expectedElectronHash){
  throw new Error("The locked Electron version or official checksum is unavailable.");
}

assertSafeOutput(outputDirectory);
assertSafeTemporary(temporaryRoot);

try{
  log(`Preparing ${productName} ${version} from the validated runtime files.`);
  await fs.mkdir(sourceDirectory,{recursive:true});
  for(const relativePath of runtimeFiles)await copyRuntimeFile(relativePath);
  const iconDirectory=path.join("assets","aggits-jukebox-icons-oval-v4");
  const iconFiles=(await fs.readdir(path.join(root,iconDirectory))).filter(file=>file.toLowerCase().endsWith(".svg"));
  if(iconFiles.length!==111)throw new Error(`Expected 111 Aggits Jukebox icon assets, found ${iconFiles.length}.`);
  for(const file of iconFiles)await copyRuntimeFile(path.join(iconDirectory,file));

  const stagedPackage={
    name:packageData.name,
    productName,
    type:"module",
    private:true,
    version,
    description:packageData.description,
    main:packageData.main,
    author:packageData.author,
    dependencies:packageData.dependencies
  };
  await fs.writeFile(
    path.join(sourceDirectory,"package.json"),
    `${JSON.stringify(stagedPackage,null,2)}\n`,
    "utf8"
  );
  await fs.mkdir(path.join(sourceDirectory,"node_modules"),{recursive:true});
  const runtimeModules=["electron-squirrel-startup","sharp","detect-libc","semver","@img/colour","@img/sharp-win32-x64","yauzl","fd-slicer","pend","buffer-crc32"];
  for(const moduleName of runtimeModules){
    await fs.cp(
      path.join(root,"node_modules",...moduleName.split("/")),
      path.join(sourceDirectory,"node_modules",...moduleName.split("/")),
      {recursive:true}
    );
  }

  const electronZip=await locateElectronZip();
  if(!electronZip){
    throw new Error(
      `The verified ${electronZipName} package is not cached. Run npm ci once with internet access, then rebuild.`
    );
  }
  const electronHash=await sha256(electronZip);
  if(electronHash!==expectedElectronHash){
    throw new Error(`The cached Electron package failed its official SHA-256 check: ${electronZip}`);
  }
  log(`Verified Electron ${electronVersion} (${electronHash.slice(0,12)}…).`);

  const packagedPaths=await packager({
    dir:sourceDirectory,
    out:packagedDirectory,
    platform:"win32",
    arch:"x64",
    electronVersion,
    electronZipDir:path.dirname(electronZip),
    asar:{unpack:"**/*.{node,dll}"},
    overwrite:true,
    prune:false,
    name:productName,
    executableName
  });
  if(packagedPaths.length!==1)throw new Error("Windows packaging did not produce exactly one application.");
  log("Native Windows application packaged.");

  const packagedApplication=path.join(packagedPaths[0],`${executableName}.exe`);
  log("Running the bounded packaged-application smoke test.");
  await execFileAsync(packagedApplication,["--deep-cuts-bounded-smoke-test"],{
    windowsHide:true,
    timeout:45_000,
    maxBuffer:16*1024*1024
  });
  log("Bounded packaged-application smoke test passed.");

  await fs.rm(outputDirectory,{recursive:true,force:true});
  await fs.mkdir(outputDirectory,{recursive:true});
  const {portableZip,setupExe}=await createIExpressInstaller(packagedPaths[0]);
  await writeDeliveryNotes([setupExe,portableZip]);
  await fs.copyFile(path.join(root,"VENUE_LIBRARY_ADMIN_GUIDE.md"),path.join(outputDirectory,"VENUE LIBRARY ADMIN GUIDE.md"));
  log(`Installer ready: ${setupExe}`);
  log(`Checksums and installation instructions: ${outputDirectory}`);
}finally{
  assertSafeTemporary(temporaryRoot);
  await fs.rm(temporaryRoot,{recursive:true,force:true});
}
