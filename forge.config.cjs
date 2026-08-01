const electronChecksums=require("electron/checksums.json");

const packagedFiles=new Set([
  "/package.json",
  "/studio/desktop-main.mjs",
  "/studio/index.html",
  "/studio/styles.css",
  "/studio/app.js",
  "/studio/venue-library.html",
  "/studio/venue-library.css",
  "/studio/venue-library.js",
  "/scripts/studio-model.mjs",
  "/scripts/studio-jookbox-research.mjs",
  "/scripts/studio-server.mjs",
  "/scripts/venue-library.mjs",
  "/scripts/venue-library-server.mjs",
  "/scripts/bar-edition-publication.mjs",
  "/scripts/venue-qr-artwork.mjs",
  "/scripts/vendor/qrcode.min.js",
  "/platform.json",
  "/assets/aggits-original-cutout-v4.png",
  "/assets/hgm-aggits-owner-supplied.jpg",
  "/assets/jookbox-cabinet-photoreal-v1.webp",
  "/assets/jookbox-atlas-reference-v1.webp",
  "/assets/jookbox-venue-qr-master-v1.png",
  "/assets/audio/jukebox-real-coin-insert-cc0.mp3",
  "/assets/audio/jukebox-real-coin-insert-cc0.LICENSE.txt"
]);

function shouldIgnore(filePath){
  const normalized=String(filePath||"").replaceAll("\\","/");
  if(!normalized)return false;
  if(normalized==="/node_modules")return false;
  const packagedModules=[
    "/node_modules/electron-squirrel-startup",
    "/node_modules/sharp",
    "/node_modules/detect-libc",
    "/node_modules/semver",
    "/node_modules/@img/colour",
    "/node_modules/@img/sharp-win32-x64"
  ];
  if(normalized==="/node_modules/@img")return false;
  if(packagedModules.some(modulePath=>normalized===modulePath||normalized.startsWith(`${modulePath}/`)))return false;
  if(normalized.startsWith("/node_modules/"))return true;
  if(["/studio","/scripts","/scripts/vendor","/assets"].includes(normalized))return false;
  return !packagedFiles.has(normalized);
}

module.exports={
  packagerConfig:{
    asar:{unpack:"**/*.{node,dll}"},
    name:"Deep Cuts Studio",
    executableName:"deep-cuts-studio",
    download:{
      checksums:electronChecksums
    },
    ignore:shouldIgnore
  },
  rebuildConfig:{},
  makers:[
    {
      name:"@electron-forge/maker-squirrel",
      platforms:["win32"],
      config:{
        name:"DeepCutsStudio",
        authors:"Clearlight Creative",
        description:"Private Deep Cuts product creation studio."
      }
    },
    {
      name:"@electron-forge/maker-zip",
      platforms:["darwin"]
    },
    {
      name:"@electron-forge/maker-dmg",
      platforms:["darwin"],
      config:{
        name:"Deep Cuts Studio"
      }
    }
  ]
};
