import fs from "node:fs/promises";
import path from "node:path";

const sampleRate = 44100;
const durationSeconds = 0.92;
const sampleCount = Math.floor(sampleRate * durationSeconds);
const output = path.resolve("assets/audio/jukebox-coin-drop.wav");
const pcm = new Int16Array(sampleCount);

function envelope(time, start, attack, decay) {
  if (time < start) return 0;
  const elapsed = time - start;
  if (elapsed < attack) return elapsed / attack;
  return Math.exp(-(elapsed - attack) / decay);
}

function deterministicNoise(index) {
  const value = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

for (let index = 0; index < sampleCount; index += 1) {
  const time = index / sampleRate;
  let sample = 0;

  // Short metal slide into the mechanism.
  const slide = envelope(time, 0, 0.004, 0.075);
  const slideFrequency = 2600 - time * 7200;
  sample += slide * (Math.sin(2 * Math.PI * slideFrequency * time) * 0.16);
  sample += slide * deterministicNoise(index) * 0.055;

  // Internal latch click.
  const latch = envelope(time, 0.14, 0.0015, 0.025);
  sample += latch * (
    Math.sin(2 * Math.PI * 1780 * time) * 0.19 +
    Math.sin(2 * Math.PI * 2860 * time) * 0.09
  );

  // Three progressively lower impacts as the coin reaches the box.
  const impacts = [
    { start: 0.31, frequency: 1180, level: 0.28, decay: 0.07 },
    { start: 0.49, frequency: 760, level: 0.34, decay: 0.09 },
    { start: 0.66, frequency: 430, level: 0.42, decay: 0.14 },
  ];
  for (const impact of impacts) {
    const amount = envelope(time, impact.start, 0.001, impact.decay);
    sample += amount * Math.sin(2 * Math.PI * impact.frequency * (time - impact.start)) * impact.level;
    sample += amount * deterministicNoise(index + Math.floor(impact.frequency)) * 0.035;
  }

  // A quiet cabinet resonance makes the drop feel physical without becoming loud.
  const resonance = envelope(time, 0.66, 0.003, 0.22);
  sample += resonance * Math.sin(2 * Math.PI * 182 * (time - 0.66)) * 0.1;

  const softened = Math.tanh(sample * 1.35) * 0.78;
  pcm[index] = Math.round(Math.max(-1, Math.min(1, softened)) * 32767);
}

const dataSize = pcm.byteLength;
const wav = Buffer.alloc(44 + dataSize);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(dataSize, 40);
Buffer.from(pcm.buffer).copy(wav, 44);

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, wav);
console.log(`Created ${path.relative(process.cwd(), output)} (${durationSeconds.toFixed(2)}s).`);
