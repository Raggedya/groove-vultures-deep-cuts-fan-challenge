import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {AGGITS_JUKEBOX_ICONS,AGGITS_JUKEBOX_ICON_MASTER} from "./aggits-jukebox-icons.mjs";

const root=path.resolve(import.meta.dirname,"..");
const source=path.join(root,AGGITS_JUKEBOX_ICON_MASTER);
const output=path.join(root,"assets","aggits-jukebox-icons");
const centresX=[130,246,362,478,594,710,826,942,1058,1174];
const centresY=[305,450,595,740,885,1030,1175,1320,1447,1578,1702];
const cropSize=104;

await fs.mkdir(output,{recursive:true});
for(const icon of AGGITS_JUKEBOX_ICONS){
  const left=centresX[icon.column-1]-cropSize/2;
  const top=centresY[icon.row-1]-cropSize/2;
  await sharp(source)
    .extract({left,top,width:cropSize,height:cropSize})
    .webp({quality:92,smartSubsample:true})
    .toFile(path.join(output,`${icon.id}.webp`));
}
console.log(`Prepared ${AGGITS_JUKEBOX_ICONS.length} canonical Aggits Jukebox icons.`);
