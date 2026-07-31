const packagedFiles=new Set([
  "/package.json",
  "/studio/desktop-main.mjs",
  "/studio/index.html",
  "/studio/styles.css",
  "/studio/app.js",
  "/scripts/studio-model.mjs",
  "/scripts/studio-jookbox-research.mjs",
  "/scripts/studio-server.mjs",
  "/scripts/vendor/qrcode.min.js",
  "/assets/aggits-original-cutout-v4.png",
  "/assets/hgm-aggits-owner-supplied.jpg",
  "/assets/jookbox-cabinet-photoreal-v1.webp",
  "/assets/jookbox-atlas-reference-v1.webp"
]);

function shouldIgnore(filePath){
  const normalized=String(filePath||"").replaceAll("\\","/");
  if(!normalized)return false;
  if(normalized==="/node_modules")return false;
  if(normalized==="/node_modules/electron-squirrel-startup"||normalized.startsWith("/node_modules/electron-squirrel-startup/"))return false;
  if(normalized.startsWith("/node_modules/"))return true;
  if(["/studio","/scripts","/scripts/vendor","/assets"].includes(normalized))return false;
  return !packagedFiles.has(normalized);
}

module.exports={
  packagerConfig:{
    asar:true,
    name:"Deep Cuts Studio",
    executableName:"deep-cuts-studio",
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
