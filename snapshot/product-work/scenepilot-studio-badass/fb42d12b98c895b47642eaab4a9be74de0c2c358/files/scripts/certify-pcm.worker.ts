import { mixAudioClipSamples, renderAudioProject, renderProject, type RenderAudioClip } from "../lib/render-engine.ts";
import { Input, BlobSource, ALL_FORMATS } from "mediabunny";
import { analyzeAudio } from "../lib/analysis-engine.ts";

type Request = { files: File[] };
type Response = {
  passed: boolean;
  frames?: number;
  chunks?: number;
  peak?: number;
  leftRms?: number;
  rightRms?: number;
  earlyRms?: number;
  middleRms?: number;
  hash?: string;
  encodedBytes?: number;
  wavBytes?: number;
  wavHeader?: string;
  cancellationPassed?: boolean;
  explicitSilencePassed?: boolean;
  varispeed?: Array<{ rate: number; frequency: number; tailPeak: number; passed: boolean }>;
  pitchPreserving?: Array<{ rate: number; frequency: number; passed: boolean }>;
  workerAnalysisPassed?: boolean;
  error?: string;
};

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: Response): void;
};

function clips(files: File[]): RenderAudioClip[] {
  return [
    {
      id: "left-tone", file: files[0], start: 0, sourceStart: 0, duration: 1,
      gain: 0.7, pan: -0.8, fadeIn: 0.1, fadeOut: 0.1,
      automation: [{ time: 0, gain: 0.25 }, { time: 0.5, gain: 1 }],
      processing: { highPassHz: 20, lowDb: 1, midDb: -1, highDb: 2, compressorThreshold: -12, compressorRatio: 3, limiter: true, makeupGain: 1.1 },
    },
    {
      id: "right-tone", file: files[1], start: 0.25, sourceStart: 0.1, duration: 0.65,
      gain: 0.55, pan: 0.75, fadeIn: 0.05, fadeOut: 0.1,
      processing: { highPassHz: 40, lowDb: -1, midDb: 2, highDb: 0, compressorThreshold: -18, compressorRatio: 2, limiter: true, makeupGain: 1 },
    },
  ];
}

scope.onmessage = async (event) => {
  try {
    const audioClips = clips(event.data.files);
    const measured = await analyzeAudio(event.data.files[0], 2, () => {});
    const workerAnalysisPassed = Number.isFinite(measured.bpm) && measured.signals.length > 0;
    const varispeed = [];
    const pitchPreserving = [];
    for (const rate of [.5, 128 / 120, 2]) {
      let frame = 0, previous = 0, crossings = 0;
      const duration = 2 / rate;
      for await (const sample of mixAudioClipSamples([{ id: "pitch-lock", file: event.data.files[0], start: 0, sourceStart: 0, duration, playbackRate: rate, preservePitch: true, rawSource: true, gain: 1, pan: 0, fadeIn: 0, fadeOut: 0 }], duration)) {
        try {
          const values = new Float32Array(sample.numberOfFrames);
          sample.copyTo(values, { planeIndex: 0, format: "f32-planar" });
          for (const value of values) { const time = frame++ / sample.sampleRate; if (time >= .2 && time < .7 && previous <= 0 && value > 0) crossings++; previous = value; }
        } finally { sample.close(); }
      }
      const frequency = crossings / .5;
      pitchPreserving.push({ rate, frequency, passed: Math.abs(frequency - 440) <= 5 && frame === Math.ceil(duration * 48000) });
    }
    for (const rate of [.5, 2]) {
      let frame = 0, crossings = 0, previous = 0, tailPeak = 0;
      const outputDuration = 2 / rate + .1;
      for await (const sample of mixAudioClipSamples([{ id: "speed", file: event.data.files[0], start: 0, sourceStart: 0, duration: outputDuration, playbackRate: rate, gain: 1, pan: 0, fadeIn: 0, fadeOut: 0 }], outputDuration)) {
        try {
          const values = new Float32Array(sample.numberOfFrames);
          sample.copyTo(values, { planeIndex: 0, format: "f32-planar" });
          for (const value of values) {
            const time = frame++ / sample.sampleRate;
            if (time >= .1 && time < .6 && previous <= 0 && value > 0) crossings++;
            if (time >= 2 / rate + .01) tailPeak = Math.max(tailPeak, Math.abs(value));
            previous = value;
          }
        } finally { sample.close(); }
      }
      const frequency = crossings / .5;
      varispeed.push({ rate, frequency, tailPeak, passed: Math.abs(frequency - 440 * rate) < 5 && tailPeak < 1e-6 && frame === Math.ceil(outputDuration * 48000) });
    }
    const canceled = new AbortController();
    canceled.abort();
    let cancellationPassed = false;
    try {
      for await (const sample of mixAudioClipSamples(audioClips, 1, canceled.signal)) sample.close();
    } catch (error) {
      cancellationPassed = error instanceof DOMException && error.name === "AbortError";
    }
    let frames = 0;
    let chunks = 0;
    let peak = 0;
    let leftSquares = 0;
    let rightSquares = 0;
    let earlySquares = 0;
    let earlyCount = 0;
    let middleSquares = 0;
    let middleCount = 0;
    let hash = 2_166_136_261;
    for await (const sample of mixAudioClipSamples(audioClips, 1)) {
      try {
        if (sample.sampleRate !== 48_000 || sample.numberOfChannels !== 2 || sample.numberOfFrames > 1_024) {
          throw new Error("PCM chunk contract changed");
        }
        const left = new Float32Array(sample.numberOfFrames);
        const right = new Float32Array(sample.numberOfFrames);
        sample.copyTo(left, { planeIndex: 0, format: "f32-planar" });
        sample.copyTo(right, { planeIndex: 1, format: "f32-planar" });
        for (let index = 0; index < sample.numberOfFrames; index++) {
          const timelineFrame = frames + index;
          const l = left[index];
          const r = right[index];
          peak = Math.max(peak, Math.abs(l), Math.abs(r));
          leftSquares += l * l;
          rightSquares += r * r;
          if (timelineFrame < 4_800) {
            earlySquares += l * l + r * r;
            earlyCount += 2;
          }
          if (timelineFrame >= 24_000 && timelineFrame < 28_800) {
            middleSquares += l * l + r * r;
            middleCount += 2;
          }
          const quantized = Math.max(-32_768, Math.min(32_767, Math.round((l + r) * 16_383)));
          hash ^= quantized & 0xffff;
          hash = Math.imul(hash, 16_777_619) >>> 0;
        }
        frames += sample.numberOfFrames;
        chunks++;
      } finally {
        sample.close();
      }
    }

    const encoded = await renderProject({
      mainFile: null,
      assets: [],
      placements: [],
      audioClips,
      duration: 0.25,
      frameRate: 24,
      maxDimension: 1280,
      sourceSize: { width: 160, height: 90 },
      format: "mp4-h264",
      hardwareAcceleration: "no-preference",
    });
    const silent = await renderProject({ mainFile: event.data.files[0], assets: [], placements: [], audioClips: [], useMainAudio: false, duration: .25, frameRate: 24, sourceSize: { width: 160, height: 90 }, format: "mp4-h264" });
    if (!silent) throw new Error("Silent master returned no encoded output.");
    const silentInput = new Input({ formats: ALL_FORMATS, source: new BlobSource(silent) });
    const explicitSilencePassed = await silentInput.getPrimaryAudioTrack() === null;
    silentInput.dispose();
    const wav = await renderAudioProject({ clips: audioClips, duration: 0.25 });
    const wavBuffer = wav ? new Uint8Array(await wav.arrayBuffer()) : new Uint8Array();
    const wavHeader = String.fromCharCode(...wavBuffer.subarray(0, 4)) + ":" + String.fromCharCode(...wavBuffer.subarray(8, 12));
    const leftRms = Math.sqrt(leftSquares / Math.max(1, frames));
    const rightRms = Math.sqrt(rightSquares / Math.max(1, frames));
    const earlyRms = Math.sqrt(earlySquares / Math.max(1, earlyCount));
    const middleRms = Math.sqrt(middleSquares / Math.max(1, middleCount));
    const encodedBytes = encoded?.size ?? 0;
    const wavBytes = wav?.size ?? 0;
    const passed = frames === 48_000
      && chunks === 47
      && peak > 0.05 && peak <= 1
      && leftRms > rightRms
      && middleRms > earlyRms * 1.5
      && cancellationPassed
      && explicitSilencePassed
      && varispeed.every((check) => check.passed)
      && pitchPreserving.every(check => check.passed)
      && workerAnalysisPassed
      && encodedBytes > 1_000
      && wavBytes > 30_000
      && wavHeader === "RIFF:WAVE";
    scope.postMessage({ passed, frames, chunks, peak, leftRms, rightRms, earlyRms, middleRms, hash: hash.toString(16).padStart(8, "0"), encodedBytes, wavBytes, wavHeader, cancellationPassed, explicitSilencePassed, varispeed, pitchPreserving, workerAnalysisPassed });
  } catch (error) {
    scope.postMessage({ passed: false, error: error instanceof Error ? error.stack ?? error.message : String(error) });
  }
};
