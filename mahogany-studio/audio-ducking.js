export const DUCKING_ANALYSIS_VERSION = "mahogany-vad/1";
export const DEFAULT_DUCKING_SETTINGS = Object.freeze({
  enabled: true,
  speakingLevel: 0.2,
  attackMs: 320,
  releaseMs: 950,
  holdMs: 1600,
  sensitivity: 0.55,
});

export function normalizeDuckingSettings(value = {}) {
  return {
    enabled: value.enabled !== false,
    speakingLevel: clamp(value.speakingLevel, 0.08, 0.5, 0.2),
    attackMs: Math.round(clamp(value.attackMs, 150, 700, 320)),
    releaseMs: Math.round(clamp(value.releaseMs, 300, 1800, 950)),
    holdMs: Math.round(clamp(value.holdMs, 400, 3000, 1600)),
    sensitivity: clamp(value.sensitivity, 0, 1, 0.55),
  };
}

export function analysePresenterAudio(audioBuffer, settings = {}) {
  if (!audioBuffer || !Number.isFinite(audioBuffer.sampleRate))
    throw new Error("The presenter audio could not be decoded.");
  const options = normalizeDuckingSettings(settings),
    sampleRate = audioBuffer.sampleRate,
    frameSeconds = 0.02,
    frameSamples = Math.max(1, Math.round(sampleRate * frameSeconds)),
    length = Number(audioBuffer.length) || 0,
    channels = Math.max(1, Number(audioBuffer.numberOfChannels) || 1),
    channelData = Array.from({ length: channels }, (_, channel) =>
      audioBuffer.getChannelData(channel),
    ),
    frames = [];
  for (let start = 0; start < length; start += frameSamples) {
    const end = Math.min(length, start + frameSamples);
    let energy = 0,
      crossings = 0,
      samples = 0,
      previous = 0;
    for (let index = start; index < end; index += 2) {
      let sample = 0;
      for (let channel = 0; channel < channels; channel++)
        sample += channelData[channel][index] || 0;
      sample /= channels;
      energy += sample * sample;
      if (samples && (sample >= 0) !== (previous >= 0)) crossings++;
      previous = sample;
      samples++;
    }
    const rms = Math.sqrt(energy / Math.max(1, samples));
    frames.push({
      start: start / sampleRate,
      end: end / sampleRate,
      db: 20 * Math.log10(Math.max(rms, 1e-7)),
      zcr: crossings / Math.max(1, samples - 1),
    });
  }
  if (!frames.length)
    return result(audioBuffer.duration || 0, [], -100, options);
  const levels = frames.map((frame) => frame.db).sort((a, b) => a - b),
    noiseFloor = percentile(levels, 0.2),
    marginDb = 14 - options.sensitivity * 7,
    thresholdDb = Math.max(-48, Math.min(-24, noiseFloor + marginDb));
  const active = frames.map(
      (frame) =>
        frame.db >= thresholdDb && frame.zcr >= 0.008 && frame.zcr <= 0.42,
    ),
    minFrames = Math.ceil(0.16 / frameSeconds),
    bridgeFrames = Math.ceil(options.holdMs / 1000 / frameSeconds);
  removeShortRuns(active, minFrames);
  bridgeShortGaps(active, bridgeFrames);
  const regions = booleanFramesToRegions(active, frames, {
    leadSeconds: 0.12,
    tailSeconds: 0.28,
    duration: Number(audioBuffer.duration) || length / sampleRate,
  });
  return result(audioBuffer.duration || length / sampleRate, regions, thresholdDb, options);
}

export function speechAtTime(regions, timeSeconds) {
  const time = Number(timeSeconds) || 0;
  return (Array.isArray(regions) ? regions : []).some(
    (region) => time >= Number(region[0]) && time <= Number(region[1]),
  );
}

function result(durationSeconds, regions, thresholdDb, settings) {
  return {
    version: DUCKING_ANALYSIS_VERSION,
    durationSeconds: round(durationSeconds),
    thresholdDb: Math.round(thresholdDb * 10) / 10,
    regions,
    settings,
  };
}

function removeShortRuns(values, minimum) {
  for (let index = 0; index < values.length; ) {
    if (!values[index]) {
      index++;
      continue;
    }
    let end = index + 1;
    while (end < values.length && values[end]) end++;
    if (end - index < minimum)
      for (let cursor = index; cursor < end; cursor++) values[cursor] = false;
    index = end;
  }
}

function bridgeShortGaps(values, maximum) {
  for (let index = 0; index < values.length; ) {
    if (values[index]) {
      index++;
      continue;
    }
    let end = index + 1;
    while (end < values.length && !values[end]) end++;
    if (index > 0 && end < values.length && end - index <= maximum)
      for (let cursor = index; cursor < end; cursor++) values[cursor] = true;
    index = end;
  }
}

function booleanFramesToRegions(values, frames, options) {
  const regions = [];
  for (let index = 0; index < values.length; ) {
    if (!values[index]) {
      index++;
      continue;
    }
    let end = index + 1;
    while (end < values.length && values[end]) end++;
    const startTime = Math.max(0, frames[index].start - options.leadSeconds),
      endTime = Math.min(options.duration, frames[end - 1].end + options.tailSeconds),
      previous = regions.at(-1);
    if (previous && startTime - previous[1] <= 0.08) previous[1] = round(endTime);
    else regions.push([round(startTime), round(endTime)]);
    index = end;
  }
  return regions;
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}
function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(minimum, Math.min(maximum, number))
    : fallback;
}
function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
