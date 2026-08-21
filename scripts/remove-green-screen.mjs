import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error("Usage: node scripts/remove-green-screen.mjs <input> <output>");
}

const image = sharp(input).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
for (let offset = 0; offset < data.length; offset += info.channels) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const dominance = green - Math.max(red, blue);
  const keyStrength = Math.max(0, Math.min(1, (dominance - 22) / 86));
  if (keyStrength <= 0) continue;
  data[offset + 3] = Math.round(data[offset + 3] * (1 - keyStrength));
  if (data[offset + 3] > 0) {
    const spill = Math.round(keyStrength * Math.max(0, green - (red + blue) / 2));
    data[offset + 1] = Math.max(0, green - spill);
  }
}

await fs.mkdir(path.dirname(output), { recursive: true });
await sharp(data, {
  raw: { width: info.width, height: info.height, channels: info.channels },
})
  .trim({ background: { r: 0, g: 255, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);

console.log(`Transparent asset written: ${output}`);
