import fs from "node:fs/promises";
import path from "node:path";
import { createAggitsJukeboxQrArtwork } from "./aggits-jukebox-qr-artwork.mjs";

const options=parseOptions(process.argv.slice(2));
if(!options.title||!options.destination||!options.output){
  throw new Error("Usage: node scripts/render-character-jookbox-qr.mjs --title <name> --destination <https-url> --output <png>");
}

const artwork=await createAggitsJukeboxQrArtwork({
  root:process.cwd(),
  title:options.title,
  destination:options.destination
});
const output=path.resolve(options.output);
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,artwork.bytes);
process.stdout.write(JSON.stringify({
  ok:true,
  output,
  destination:artwork.destination,
  width:artwork.width,
  height:artwork.height,
  sha256:artwork.sha256,
  scanProof:artwork.scanProof
}));

function parseOptions(args){
  const parsed={};
  for(let index=0;index<args.length;index+=1){
    if(!args[index].startsWith("--"))continue;
    const key=args[index].slice(2);
    parsed[key]=args[index+1]&&!args[index+1].startsWith("--")?args[++index]:"true";
  }
  return parsed;
}
