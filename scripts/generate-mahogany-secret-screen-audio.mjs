import fs from "node:fs";
import path from "node:path";

const sampleRate = 22050;
const durationSeconds = 3;
const frameCount = sampleRate * durationSeconds;

function writePcmWav(destination, direction) {
  const dataBytes = frameCount * 2;
  const output = Buffer.alloc(44 + dataBytes);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataBytes, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataBytes, 40);

  let noise = direction === "open" ? 0x4d595df4 : 0x7f4a7c15;
  for (let index = 0; index < frameCount; index += 1) {
    const time = index / sampleRate;
    const progress = time / durationSeconds;
    const travel = direction === "open" ? progress : 1 - progress;
    const ramp = Math.min(1, time / 0.09, (durationSeconds - time) / 0.13);
    const motorHz = 58 + travel * 23 + Math.sin(time * 2.8) * 1.7;
    const gearHz = 13.5 + travel * 2.2;
    noise ^= noise << 13;
    noise ^= noise >>> 17;
    noise ^= noise << 5;
    const hiss = ((noise >>> 0) / 0xffffffff) * 2 - 1;
    const motor = Math.sin(Math.PI * 2 * motorHz * time) * 0.42;
    const harmonic = Math.sin(Math.PI * 2 * motorHz * 2.03 * time) * 0.16;
    const gear = Math.sign(Math.sin(Math.PI * 2 * gearHz * time)) * 0.09;
    const bearing = hiss * (0.075 + 0.025 * Math.sin(Math.PI * 2 * gearHz * time));
    const sample = Math.max(-1, Math.min(1, (motor + harmonic + gear + bearing) * ramp * 0.62));
    output.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  fs.writeFileSync(destination, output);
}

const audioDirectory = path.resolve("assets", "audio");
fs.mkdirSync(audioDirectory, { recursive: true });
writePcmWav(path.join(audioDirectory, "jukebox-screen-motor-open-original.wav"), "open");
writePcmWav(path.join(audioDirectory, "jukebox-screen-motor-close-original.wav"), "close");
