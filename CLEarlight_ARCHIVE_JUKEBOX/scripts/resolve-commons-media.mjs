import catalogue from "../data/archive-catalogue.js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

let resolved = {};
const target = new URL("../data/media-manifest.js", import.meta.url);
if (existsSync(target)) {
  const prior = readFileSync(target,"utf8").replace(/^.*?export default /s,"").replace(/;\s*$/,"");
  try { resolved = JSON.parse(prior); } catch { resolved = {}; }
}
for (const record of catalogue) {
  if (resolved[record.id]) continue;
  const marker = "/wiki/File:";
  const encoded = record.sourcePageUrl.slice(record.sourcePageUrl.indexOf(marker) + marker.length);
  const title = `File:${decodeURIComponent(encoded).replaceAll("_", " ")}`;
  const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=videoinfo&viprop=url%7Cmime%7Cderivatives&format=json&origin=*`;
  let json;
  for (let attempt=1; attempt<=4; attempt++) {
    try {
      const body=execFileSync("curl.exe", ["-L", "-s", "--retry", "3", "--retry-all-errors", endpoint], { encoding:"utf8", maxBuffer:15_000_000 });
      json=JSON.parse(body); break;
    } catch(error) { if(attempt===4) throw error; await new Promise(resolve=>setTimeout(resolve,attempt*900)); }
  }
  const info = Object.values(json.query?.pages || {})[0]?.videoinfo?.[0];
  if (!info) throw new Error(`No playable media information for ${title}`);
  const candidates = info.derivatives || [];
  let chosen;
  if (record.mediaType === "audio") {
    chosen = candidates.find(item => item.type === "audio/mpeg") || candidates.find(item => item.type?.startsWith("audio/"));
  } else {
    const webm = candidates.filter(item => item.type?.startsWith("video/webm") && item.width <= 640).sort((a,b)=>b.width-a.width);
    chosen = webm[0] || candidates.find(item => item.type?.startsWith("video/"));
  }
  resolved[record.id] = chosen?.src || info.url;
  writeFileSync(target, `// Generated from item-level Wikimedia Commons media metadata.\nexport default ${JSON.stringify(resolved,null,2)};\n`);
  console.log(`${record.id}: ${chosen?.type || info.mime}`);
}

writeFileSync(target, `// Generated from item-level Wikimedia Commons media metadata.\nexport default ${JSON.stringify(resolved,null,2)};\n`);
