import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, "$1:");
const port = Number(process.env.PORT || 4177);
const mime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".webm": "video/webm"
};

createServer(async (req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    const rel = requested === "/" ? "index.html" : requested.slice(1);
    const file = normalize(join(root, rel));
    if (!file.startsWith(normalize(root))) throw new Error("invalid path");
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not file");
    res.writeHead(200, { "content-type": mime[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () => console.log(`CLEarlight Archive Jukebox: http://localhost:${port}`));
