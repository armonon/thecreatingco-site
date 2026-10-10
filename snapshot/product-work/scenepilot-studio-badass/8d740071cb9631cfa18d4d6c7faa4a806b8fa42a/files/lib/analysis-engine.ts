import { yieldToBrowser } from "./scheduling.ts";
import { withDecodedSample } from "./decoded-sample.ts";
import { trackBeats, beatsToTimeline } from "./beat-tracker.ts";
import { detectDownbeats } from "./downbeat-model.ts";
import { createOnsetAccumulator, rawToSignals, FRAME_SIZE, HOP_SIZE } from "./onset-dsp.ts";
import { estimateTempo, tempoFromTrackedBeats } from "./tempo.ts";
import { computeStructureBoundaries } from "./structure.ts";
import { analyzeCinematicFootage, type CinematicAnalysis } from "./cinematic-analysis.ts";
import type { SemanticPersonFrameStats } from "./semantic-segmenter.ts";
import type { ProjectVisualSignature } from "./project-intelligence.ts";
import { refineBoundaryFrames, type BoundaryFrame, type RefinedBoundary } from "./scene-boundaries.ts";

export type AnalysisProgress = {
  phase: "audio" | "footage" | "effects" | "edit";
  progress: number;
  message: string;
};

export type AnalysisAsset = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

export type SignalPoint = {
  time: number;
  energy: number;
  onset: number;
  /** Kick/bass-band transient, 0..1. Optional for projects saved before bands. */
  lowOnset?: number;
  /** Snare/hat-band transient, 0..1. Optional for projects saved before bands. */
  highOnset?: number;
};

export type VisualPoint = {
  time: number;
  brightness: number;
  motion: number;
  cutScore: number;
  histogramDistance?: number;
  lumaDifference?: number;
  /** Spatial focus/edge energy and tonal spread, both normalized 0..1. */
  sharpness?: number;
  contrast?: number;
  /** Best global frame translation after sparse block matching. */
  cameraX?: number;
  cameraY?: number;
  cameraConfidence?: number;
  residualMotion?: number;
  /** Sparse person-model metadata. Only Cinematic mode pays this ML cost. */
  subject?: SemanticPersonFrameStats;
};

export type SceneCut = {
  time: number;
  confidence: number;
  transition?: "cut" | "flash" | "dissolve";
  precision?: "frame" | "coarse" | "manual";
};

export type EffectProfile = {
  assetId: string;
  peakTime: number;
  sourceDuration: number;
  brightness: number;
  flashiness: number;
  /** Mean per-channel colour 0..1 over the sampled frames — the clip's colour
   *  cast, used by auto shot colour matching (lib/color-match.ts). */
  color?: { r: number; g: number; b: number };
  /** Project-wide visual evidence. Cinematic mode adds sparse offline person
   * metadata; ordinary analysis still records the technical/background vector. */
  visualSignature?: ProjectVisualSignature;
  suggestedDuration: number;
};

export type DetectedSection = {
  id: string;
  name: string;
  start: number;
  end: number;
  energy: number;
};

export type AnalysisResult = {
  duration: number;
  bpm: number;
  confidence: number;
  beats: number[];
  signals: SignalPoint[];
  visuals: VisualPoint[];
  sceneCuts: SceneCut[];
  transitionCandidates?: SceneCut[];
  sections: DetectedSection[];
  effects: EffectProfile[];
  framesAnalyzed: number;
  cinematic?: CinematicAnalysis;
};

export type SmartPlacement = {
  id: string;
  assetId: string;
  sectionId: string;
  start: number;
  sourceStart: number;
  duration: number;
  scale: number;
  opacity: number;
};

export type DirectorPattern = "restrained" | "pulse" | "build" | "burst" | "release";
export type RhythmRate = "half" | "normal" | "double";
export type DirectorSection = {
  id: string;
  name: string;
  start: number;
  end: number;
  energy: number;
  enabled?: boolean;
  rhythm?: RhythmRate;
  pattern?: DirectorPattern;
  duration?: number;
  scale?: number;
};

const SECTION_NAMES = ["OPEN", "VERSE", "BUILD", "PEAK", "BREAK", "FINAL", "OUTRO"];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
}

function median(values: number[]) {
  return quantile(values, 0.5);
}

function nearestSignal(signals: SignalPoint[], time: number) {
  if (!signals.length) return { time, energy: 0, onset: 0 };
  const step = signals.length > 1 ? signals[1].time - signals[0].time : 0.02;
  return signals[Math.min(signals.length - 1, Math.max(0, Math.round(time / step)))];
}

function checkAborted(signal?: AbortSignal) {
  signal?.throwIfAborted();
}

async function yieldFrame(signal?: AbortSignal) {
  checkAborted(signal);
  await yieldToBrowser();
  checkAborted(signal);
}

export async function analyzeAudio(file: File, duration: number, report: (value: AnalysisProgress) => void, signal?: AbortSignal) {
  const { ALL_FORMATS, AudioSampleSink, BlobSource, Input } = await import("mediabunny");
  checkAborted(signal);
  const frameSize = FRAME_SIZE;
  const hopSize = HOP_SIZE;
  // The onset/band DSP is shared with the offline model trainer (lib/onset-dsp),
  // so both see identical features.
  const accumulator = createOnsetAccumulator();
  let sampleRate = 48000;
  let carry = new Float32Array(0);
  let lastProgressTime = -Infinity;
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) {
      // Silent footage is a valid cinematic source. Preserve a neutral beat
      // grid for optional manual timing, but report zero confidence so no
      // automation mistakes it for measured rhythm.
      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      const bpm = 120;
      const beatDuration = 60 / bpm;
      const beats = Array.from({ length: Math.floor(safeDuration / beatDuration) + 1 }, (_, index) => index * beatDuration);
      report({ phase: "audio", progress: 1, message: "No soundtrack detected; continuing with visual analysis" });
      return { bpm, beats, signals: [], confidence: 0 };
    }
    const sink = new AudioSampleSink(track);
    for await (const buffer of sink.samples(0, duration)) {
      try {
      checkAborted(signal);
      sampleRate = buffer.sampleRate;
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, planeIndex) => {
        const plane = new Float32Array(buffer.numberOfFrames);
        buffer.copyTo(plane, { planeIndex, format: "f32-planar" });
        return plane;
      });
      const mono = new Float32Array(buffer.numberOfFrames);
      for (const channel of channels) for (let index = 0; index < mono.length; index++) mono[index] += (channel[index] || 0) / channels.length;
      const combined = new Float32Array(carry.length + mono.length);
      combined.set(carry);
      combined.set(mono, carry.length);
      let consumed = 0;
      for (let start = 0; start + frameSize <= combined.length; start += hopSize) {
        accumulator.push(combined, start, start + frameSize);
        consumed = start + hopSize;
      }
      carry = combined.slice(consumed);
      const decodedThrough = buffer.timestamp + buffer.duration;
      if (decodedThrough - lastProgressTime >= 2 || decodedThrough >= duration - 0.05) {
        report({ phase: "audio", progress: Math.min(0.98, decodedThrough / duration), message: "Measuring transients and musical energy" });
        lastProgressTime = decodedThrough;
        await yieldFrame(signal);
      }
      } finally { buffer.close(); }
    }
    if (carry.length) accumulator.push(carry, 0, carry.length);
  } finally {
    input.dispose();
  }

  const raw = accumulator.raw;
  const frameRate = sampleRate / hopSize;
  const signals = rawToSignals(raw, frameRate);
  const onset = signals.map((point) => point.onset);
  const onsetFloor = quantile(raw.onset, 0.5);
  const onsetPeak = quantile(raw.onset, 0.95);
  const energyPeak = quantile(raw.energy, 0.9);
  // Need at least one full slowest-tempo period of onset frames, or the
  // autocorrelation below has no data at the longer lags and returns an
  // essentially random BPM. Shorter clips fall through to a plain 120 grid.
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const minTempoFrames = Math.ceil((60 / 72) * frameRate);
  const hasRhythmicSignal = raw.onset.length > minTempoFrames && energyPeak > 0.0005 && onsetPeak - onsetFloor > 0.00001;
  if (!hasRhythmicSignal) {
    const bpm = 120;
    const beatDuration = 60 / bpm;
    const beats = Array.from({ length: Math.floor(safeDuration / beatDuration) + 1 }, (_, index) => index * beatDuration);
    return { bpm, beats, signals, confidence: 0 };
  }
  // Tempo (octave-robust — see lib/tempo.ts). The confidence gates whether the
  // rest of the auto edit trusts the grid at all (hasReliableRhythm).
  const { bpm: bestBpm, confidence } = estimateTempo(onset, frameRate);

  // Beat phase + placement by dynamic-programming beat tracking: every beat is
  // pulled onto a real transient while staying near the estimated tempo, so the
  // grid follows drift instead of tiling a rigid period from one anchor. The
  // intro/outro (where there may be no onsets) are padded at the local tempo.
  const periodFrames = (60 / bestBpm) * frameRate;
  const beatFrames = trackBeats(onset, periodFrames);
  const trackedBeats = beatsToTimeline(beatFrames, frameRate, safeDuration);
  const snappedBeats = trackedBeats.length >= 2
    ? trackedBeats
    : Array.from({ length: Math.floor(safeDuration / (60 / bestBpm)) + 1 }, (_, index) => index * (60 / bestBpm));

  return { bpm: tempoFromTrackedBeats(snappedBeats, bestBpm), beats: snappedBeats, signals, confidence };
}

export function hasReliableRhythm(result: Pick<AnalysisResult, "confidence" | "beats" | "signals">) {
  return result.confidence >= 0.08 && result.beats.length >= 2 && result.signals.some((point) => point.onset >= 0.05);
}

export function mergeDirectedSectionPlacements<T extends { id: string; sectionId: string; start: number }>(
  current: T[],
  rebuilt: T[],
  sectionId: string,
  preserveManualClips = true,
) {
  return [
    ...current.filter((placement) => placement.sectionId !== sectionId || (preserveManualClips && placement.id.startsWith("manual-"))),
    ...rebuilt,
  ].sort((a, b) => a.start - b.start);
}

export function frameStats(data: Uint8ClampedArray, previous?: Uint8Array, frameWidth?: number) {
  const gray = new Uint8Array(data.length / 4);
  const histogram = new Float32Array(16);
  let brightness = 0;
  let difference = 0;
  let squareLuma = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (let source = 0, target = 0; source < data.length; source += 4, target++) {
    red += data[source];
    green += data[source + 1];
    blue += data[source + 2];
    const value = Math.round(data[source] * 0.2126 + data[source + 1] * 0.7152 + data[source + 2] * 0.0722);
    gray[target] = value;
    histogram[Math.min(15, value >> 4)]++;
    brightness += value;
    squareLuma += value * value;
    if (previous) difference += Math.abs(value - previous[target]);
  }
  for (let index = 0; index < histogram.length; index++) histogram[index] /= gray.length;
  const width = Math.max(1, Math.min(gray.length, Math.round(frameWidth ?? gray.length)));
  const height = Math.max(1, Math.floor(gray.length / width));
  let gradient = 0, gradientSamples = 0;
  for (let y = 0; y < height - 1; y += 2) for (let x = 0; x < width - 1; x += 2) {
    const index = y * width + x;
    gradient += Math.abs(gray[index] - gray[index + 1]) + Math.abs(gray[index] - gray[index + width]);
    gradientSamples += 2;
  }
  const meanLuma = brightness / Math.max(1, gray.length);
  const contrast = Math.sqrt(Math.max(0, squareLuma / Math.max(1, gray.length) - meanLuma * meanLuma)) / 127.5;

  let cameraX = 0, cameraY = 0, cameraConfidence = 0, residualMotion = previous ? difference / gray.length / 255 : 0;
  if (previous && previous.length === gray.length && width >= 6 && height >= 6) {
    let baseline = 0, baselineSamples = 0;
    for (let y = 2; y < height - 2; y += 3) for (let x = 2; x < width - 2; x += 3) {
      baseline += Math.abs(gray[y * width + x] - previous[y * width + x]); baselineSamples++;
    }
    baseline /= Math.max(1, baselineSamples);
    let best = baseline, bestX = 0, bestY = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      let error = 0, samples = 0;
      for (let y = 2; y < height - 2; y += 3) for (let x = 2; x < width - 2; x += 3) {
        error += Math.abs(gray[y * width + x] - previous[(y - dy) * width + x - dx]); samples++;
      }
      error /= Math.max(1, samples);
      if (error < best) { best = error; bestX = dx; bestY = dy; }
    }
    cameraX = bestX / 2;
    cameraY = bestY / 2;
    cameraConfidence = Math.max(0, Math.min(1, (baseline - best) / Math.max(8, baseline)));
    residualMotion = best / 255;
  }
  return {
    gray,
    histogram,
    brightness: brightness / gray.length / 255,
    difference: previous ? difference / gray.length / 255 : 0,
    sharpness: Math.max(0, Math.min(1, gradient / Math.max(1, gradientSamples) / 64)),
    contrast: Math.max(0, Math.min(1, contrast)),
    cameraX, cameraY, cameraConfidence, residualMotion,
    // Mean per-channel colour, 0..1 — used for auto shot colour matching.
    red: red / gray.length / 255,
    green: green / gray.length / 255,
    blue: blue / gray.length / 255,
  };
}

function waitForMedia(target: HTMLMediaElement, event: "loadeddata" | "seeked", signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(event, done);
      signal?.removeEventListener("abort", aborted);
    };
    const done = () => { cleanup(); resolve(); };
    const aborted = () => { cleanup(); reject(signal?.reason ?? new DOMException("Analysis canceled", "AbortError")); };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error(`Media ${event} timed out`)); }, 10000);
    target.addEventListener(event, done);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted();
  });
}

async function analyzeFootage(file: File, duration: number, report: (value: AnalysisProgress) => void, signal?: AbortSignal, enhanced = false) {
  const { ALL_FORMATS, BlobSource, Input, VideoSampleSink } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const track = await input.getPrimaryVideoTrack();
  if (!track) {
    input.dispose();
    report({ phase: "footage", progress: 1, message: "Audio source ready; building a visual canvas" });
    return { points: [], sceneCuts: [] };
  }
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 54;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas analysis is unavailable");
  const interval = Math.max(0.2, duration / 900);
  const points: VisualPoint[] = [];
  let previousGray: Uint8Array | undefined;
  let previousHistogram: Float32Array | undefined;
  let semanticAvailable = enhanced;
  const capture = async (time: number, inspectSubject = false) => {
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const stats = frameStats(image.data, previousGray, canvas.width);
    let histogramDistance = 0;
    if (previousHistogram) {
      for (let index = 0; index < 16; index++) histogramDistance += Math.abs(stats.histogram[index] - previousHistogram[index]);
      histogramDistance /= 2;
    }
    let subject: SemanticPersonFrameStats | undefined;
    if (semanticAvailable && inspectSubject) {
      try {
        const { analyzeSemanticPersonFrame } = await import("./semantic-segmenter.ts");
        subject = await analyzeSemanticPersonFrame(image);
      } catch {
        // Vision metadata is an enhancement. A missing GPU/model must never
        // prevent the ordinary cut and technical-quality scan from finishing.
        semanticAvailable = false;
      }
    }
    points.push({
      time,
      brightness: stats.brightness,
      motion: stats.difference,
      cutScore: histogramDistance * 0.62 + stats.difference * 0.38,
      histogramDistance,
      lumaDifference: stats.difference,
      sharpness: stats.sharpness,
      contrast: stats.contrast,
      cameraX: stats.cameraX,
      cameraY: stats.cameraY,
      cameraConfidence: stats.cameraConfidence,
      residualMotion: stats.residualMotion,
      subject,
    });
    previousGray = stats.gray;
    previousHistogram = stats.histogram;
  };

  let refined: RefinedBoundary[] | undefined;
  try {
    const sink = new VideoSampleSink(track);
    const timestamps = Array.from({ length: Math.max(1, Math.ceil(duration / interval)) }, (_, index) => Math.min(duration - 0.001, index * interval));
    const semanticStride = Math.max(1, Math.floor(timestamps.length / 24));
    let frame = 0;
    for await (const sample of sink.samplesAtTimestamps(timestamps)) {
      await withDecodedSample(sample, async (decoded) => {
        checkAborted(signal);
        const timestamp = timestamps[frame++] ?? 0;
        if (decoded) {
          decoded.draw(context, 0, 0, canvas.width, canvas.height);
          await capture(decoded.timestamp ?? timestamp, enhanced && ((frame - 1) % semanticStride === 0 || frame === timestamps.length));
        }
      });
      if (frame % 24 === 0 || frame === timestamps.length) {
        report({ phase: "footage", progress: Math.min(0.98, frame / timestamps.length), message: `Inspecting visual sample ${frame} of ${timestamps.length}` });
        await yieldFrame(signal);
      }
    }
    // Coarse scan finds regions, dense decoding finds actual frame boundaries.
    const scores = points.slice(1).map(p=>p.cutScore);
    const center = median(scores), threshold = center + Math.max(.035, median(scores.map(v=>Math.abs(v-center)))*2.5);
    const regions: Array<{start:number;end:number}> = [];
    for(let i=1;i<points.length;i++) if(points[i].cutScore>=threshold) {
      const start=Math.max(0,points[i-1].time-.12), end=Math.min(duration,points[i].time+.2);
      const last=regions.at(-1);
      if(last && start<=last.end) last.end=Math.max(last.end,end); else regions.push({start,end});
    }
    refined=[];
    for(let i=0;i<regions.length;i++) {
      const region=regions[i]; let window: BoundaryFrame[]=[];
      for await(const sample of sink.samples(region.start,region.end)) {
        try {
          checkAborted(signal); sample.draw(context,0,0,canvas.width,canvas.height);
          const stats=frameStats(context.getImageData(0,0,canvas.width,canvas.height).data,undefined,canvas.width);
          window.push({time:sample.timestamp,gray:stats.gray,histogram:stats.histogram,brightness:stats.brightness});
          if(window.length>=180) { refined.push(...refineBoundaryFrames(window));window=window.slice(-8); await yieldFrame(signal); }
        } finally { sample.close(); }
      }
      refined.push(...refineBoundaryFrames(window));
      report({phase:"footage",progress:.8+.2*(i+1)/Math.max(1,regions.length),message:`Refining scene boundaries ${i+1}/${regions.length}`});
      await yieldFrame(signal);
    }
    report({ phase: "footage", progress: 1, message: `Inspected ${points.length} visual samples` });
  } catch {
    checkAborted(signal);
    refined = undefined;
    points.length = 0;
    previousGray = undefined;
    previousHistogram = undefined;
    report({ phase: "footage", progress: 0, message: "Using compatibility scan for this video" });
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    const sourceUrl = URL.createObjectURL(file);
    video.src = sourceUrl;
    try {
      if (video.readyState < 2) await waitForMedia(video, "loadeddata", signal);
      const fallbackInterval = Math.max(0.35, duration / 600);
      const fallbackFrames = Math.max(1, Math.ceil(duration / fallbackInterval));
      const semanticStride = Math.max(1, Math.floor(fallbackFrames / 24));
      let frame = 0;
      for (let time = 0; time < duration; time += fallbackInterval) {
        checkAborted(signal);
        const targetTime = Math.min(time, Math.max(0, duration - 0.05));
        if (Math.abs(video.currentTime - targetTime) > 0.01) {
          video.currentTime = targetTime;
          await waitForMedia(video, "seeked", signal);
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        await capture(time, enhanced && (frame % semanticStride === 0 || frame + 1 === fallbackFrames));
        frame++;
        if (frame % 8 === 0) {
          report({ phase: "footage", progress: Math.min(0.98, time / duration), message: `Compatibility sample ${frame}` });
          await yieldFrame(signal);
        }
      }
      report({ phase: "footage", progress: 1, message: `Inspected ${points.length} visual samples` });
    } finally {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(sourceUrl);
    }
  } finally {
    input.dispose();
  }
  const scores = points.slice(1).map((point) => point.cutScore);
  const center = median(scores);
  const deviation = median(scores.map((value) => Math.abs(value - center)));
  const threshold = center + Math.max(0.045, deviation * 3.2);
  const sceneCuts: SceneCut[] = [];
  for (const point of points) {
    if (point.cutScore < threshold || point.time - (sceneCuts.at(-1)?.time ?? -10) < 0.3) continue;
    sceneCuts.push({ time: point.time, confidence: clamp((point.cutScore - center) / Math.max(0.08, threshold - center) / 2) });
  }
  const unique = refined ? [...new Map(refined.map(c=>[`${c.transition}-${Math.round(c.time*100000)}`,c])).values()].sort((a,b)=>a.time-b.time) : undefined;
  return { points, sceneCuts: unique ? unique.filter(c=>c.transition === "cut") : sceneCuts.map(c=>({...c,precision:"coarse" as const})), transitionCandidates: unique?.filter(c=>c.transition !== "cut") ?? [] };
}

async function analyzeEffect(asset: AnalysisAsset, signal?: AbortSignal, enhanced = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 54;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas analysis is unavailable");
  const brightness: number[] = [];
  const colors: Array<{ r: number; g: number; b: number }> = [];
  const sharpness: number[] = [];
  const contrast: number[] = [];
  const motion: number[] = [];
  const histograms: Float32Array[] = [];
  const subjects: SemanticPersonFrameStats[] = [];
  const times: number[] = [];
  let sourceDuration = Infinity;
  let previousGray: Uint8Array | undefined;
  let semanticAvailable = enhanced;
  const pushFrame = async (inspectSubject = false) => {
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const stats = frameStats(image.data, previousGray, canvas.width);
    brightness.push(stats.brightness);
    colors.push({ r: stats.red, g: stats.green, b: stats.blue });
    sharpness.push(stats.sharpness);
    contrast.push(stats.contrast);
    motion.push(stats.residualMotion);
    histograms.push(stats.histogram);
    previousGray = stats.gray;
    if (semanticAvailable && inspectSubject) {
      try {
        const { analyzeSemanticPersonFrame } = await import("./semantic-segmenter.ts");
        subjects.push(await analyzeSemanticPersonFrame(image));
      } catch { semanticAvailable = false; }
    }
  };

  if (asset.kind === "image") {
    const bitmap = await createImageBitmap(asset.file);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    await pushFrame(enhanced);
    times.push(0);
  } else {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    const sourceUrl = asset.url || URL.createObjectURL(asset.file);
    video.src = sourceUrl;
    const temporaryUrl = !asset.url;
    if (video.readyState < 2) await waitForMedia(video, "loadeddata", signal);
    sourceDuration = video.duration || 1;
    const inspectDuration = Math.min(8, sourceDuration);
    // Profile by seeking a video element. A background tab can throttle seeks
    // until they time out; if that happens we keep whatever samples we have
    // rather than aborting the whole analysis over one clip's brightness curve.
    try {
      for (let index = 0; index < 20; index++) {
        checkAborted(signal);
        const time = (inspectDuration * index) / 20;
        const targetTime = Math.min(time, Math.max(0, inspectDuration - 0.02));
        if (Math.abs(video.currentTime - targetTime) > 0.01) {
          video.currentTime = targetTime;
          await waitForMedia(video, "seeked", signal);
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        await pushFrame(enhanced && (index % 5 === 0 || index === 19));
        times.push(time);
      }
    } catch {
      checkAborted(signal); // a real cancel still propagates; a seek timeout does not
      if (!brightness.length) {
        brightness.push(0.5); colors.push({ r: 0.5, g: 0.5, b: 0.5 }); sharpness.push(.5); contrast.push(.5); motion.push(0);
        histograms.push(Float32Array.from({ length: 16 }, () => 1 / 16)); times.push(0);
      }
    }
    video.removeAttribute("src");
    video.load();
    if (temporaryUrl) URL.revokeObjectURL(sourceUrl);
  }

  let peakIndex = 0;
  let totalChange = 0;
  for (let index = 1; index < brightness.length; index++) {
    if (brightness[index] > brightness[peakIndex]) peakIndex = index;
    totalChange += Math.abs(brightness[index] - brightness[index - 1]);
  }
  const flashiness = clamp(totalChange / Math.max(1, brightness.length - 1) * 5);
  // Average the sampled frames' colour for a stable per-clip cast (a single
  // peak frame is noisy); auto colour matching neutralises this cast.
  const meanColor = colors.length
    ? colors.reduce((sum, c) => ({ r: sum.r + c.r, g: sum.g + c.g, b: sum.b + c.b }), { r: 0, g: 0, b: 0 })
    : { r: 0.5, g: 0.5, b: 0.5 };
  const color = { r: meanColor.r / (colors.length || 1), g: meanColor.g / (colors.length || 1), b: meanColor.b / (colors.length || 1) };
  const histogram = Array.from({ length: 16 }, (_, index) => mean(histograms.map((values) => values[index] ?? 0)));
  const subjectFrames = subjects.length;
  const visualSignature: ProjectVisualSignature = {
    sampleCount: brightness.length,
    brightness: mean(brightness), sharpness: mean(sharpness), contrast: mean(contrast), motion: mean(motion), color, histogram,
    subject: {
      frames: subjectFrames,
      presence: subjects.filter((subject) => subject.present).length / Math.max(1, subjectFrames),
      coverage: mean(subjects.map((subject) => subject.present ? subject.coverage : 0)),
      centerX: mean(subjects.map((subject) => subject.centerX)), centerY: mean(subjects.map((subject) => subject.centerY)),
      count: Math.round(mean(subjects.map((subject) => subject.count))), confidence: mean(subjects.map((subject) => subject.confidence)),
    },
  };
  return {
    assetId: asset.id,
    peakTime: times[peakIndex] || 0,
    sourceDuration,
    brightness: brightness[peakIndex] || 0.5,
    flashiness,
    color,
    visualSignature,
    suggestedDuration: asset.kind === "image" ? 0.22 : clamp(0.62 - flashiness * 0.42, 0.12, 0.7),
  };
}

function detectSections(duration: number, signals: SignalPoint[], scenes: SceneCut[]) {
  const gap = 12;
  const maxSections = Math.min(8, Math.max(4, Math.round(duration / 30)));
  // Musical structure first: where the texture changes (see lib/structure.ts),
  // not just where the loudness changes.
  const boundaries = computeStructureBoundaries(signals, duration, { minGap: gap, maxSections });
  // Blend in strong visual scene cuts — a hard cut in the footage is a real
  // structural moment too.
  for (const scene of [...scenes].sort((a, b) => b.confidence - a.confidence)) {
    if (boundaries.length >= maxSections + 1) break;
    if (scene.confidence >= 0.6 && scene.time > gap * 0.5 && scene.time < duration - gap * 0.5
      && boundaries.every((boundary) => Math.abs(boundary - scene.time) >= gap)) {
      boundaries.push(scene.time);
    }
  }
  boundaries.sort((a, b) => a - b);
  // A uniform song offers little structure; split the widest gaps so the
  // director still has a few sections to vary the edit across.
  const minSections = Math.min(4, Math.max(2, Math.round(duration / 45)));
  while (boundaries.length - 1 < minSections) {
    let index = 1, widest = 0;
    for (let i = 1; i < boundaries.length; i++) {
      const width = boundaries[i] - boundaries[i - 1];
      if (width > widest) { widest = width; index = i; }
    }
    if (widest < gap * 1.5) break;
    boundaries.splice(index, 0, boundaries[index - 1] + widest / 2);
  }
  const sections = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const values = signals.filter((point) => point.time >= start && point.time < end).map((point) => point.energy);
    return { id: `detected-${index}`, name: "", start, end, energy: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) };
  });
  const energyValues = sections.map((section) => section.energy);
  const high = quantile(energyValues, 0.7);
  const low = quantile(energyValues, 0.3);
  return sections.map((section, index) => ({
    ...section,
    name: index === 0 ? "OPEN" : index === sections.length - 1 ? "OUTRO" : section.energy >= high ? (index > sections.length / 2 ? "FINAL" : "PEAK") : section.energy <= low ? "BREAK" : SECTION_NAMES[Math.min(index, SECTION_NAMES.length - 1)],
  }));
}

export async function analyzeProject(
  file: File,
  _url: string,
  duration: number,
  assets: AnalysisAsset[],
  report: (value: AnalysisProgress) => void,
  signal?: AbortSignal,
  options: { cinematic?: boolean } = {},
): Promise<AnalysisResult> {
  report({ phase: "audio", progress: 0, message: "Opening the soundtrack" });
  const audio = await analyzeAudio(file, duration, report, signal);
  report({ phase: "footage", progress: 0, message: "Reading visual frames" });
  const footage = await analyzeFootage(file, duration, report, signal, options.cinematic === true);
  const effects: EffectProfile[] = [];
  for (let index = 0; index < assets.length; index++) {
    report({ phase: "effects", progress: index / Math.max(1, assets.length), message: `Reading effect ${index + 1} of ${assets.length}` });
    effects.push(await analyzeEffect(assets[index], signal, options.cinematic === true));
    report({ phase: "effects", progress: (index + 1) / Math.max(1, assets.length), message: `Profiled effect ${index + 1} of ${assets.length}` });
    await yieldFrame(signal);
  }
  report({ phase: "edit", progress: 0.6, message: "Finding musical sections" });
  const sections = detectSections(duration, audio.signals, footage.sceneCuts);
  report({ phase: "edit", progress: 1, message: "Building the edit map" });
  return {
    duration,
    bpm: audio.bpm,
    confidence: audio.confidence,
    beats: audio.beats,
    signals: audio.signals,
    visuals: footage.points,
    sceneCuts: footage.sceneCuts,
    transitionCandidates: "transitionCandidates" in footage ? footage.transitionCandidates : [],
    sections,
    effects,
    framesAnalyzed: footage.points.length,
    cinematic: footage.points.length ? analyzeCinematicFootage(duration, footage.points, footage.sceneCuts, audio.signals) : undefined,
  };
}

export function suggestDirectorPattern(section: Pick<DirectorSection, "name" | "energy">, index: number, count: number): DirectorPattern {
  const name = section.name.toUpperCase();
  if (name.includes("BUILD")) return "build";
  if (name.includes("PEAK") || name.includes("CHORUS") || name.includes("FINAL") || section.energy >= 0.7) return "burst";
  if (name.includes("OUTRO") || name.includes("BREAK") || index === count - 1) return "release";
  if (name.includes("OPEN") || name.includes("INTRO") || index === 0) return "restrained";
  return "pulse";
}

function sectionBeatGrid(beats: number[], section: DirectorSection) {
  const base = beats.filter((beat) => beat >= section.start && beat < section.end);
  if (section.rhythm === "half") return base.filter((_, index) => index % 2 === 0);
  if (section.rhythm !== "double") return base;
  const doubled: number[] = [];
  for (let index = 0; index < base.length; index++) {
    doubled.push(base[index]);
    const next = base[index + 1];
    if (next != null) doubled.push((base[index] + next) / 2);
  }
  return doubled;
}

export function buildDirectedPlacements(
  result: AnalysisResult,
  assetIds: string[],
  intensity: "smooth" | "dynamic" | "maximum",
  directedSections: DirectorSection[] = result.sections,
): SmartPlacement[] {
  if (!assetIds.length) return [];
  const placements: SmartPlacement[] = [];
  const intensityFactor = intensity === "smooth" ? 0.72 : intensity === "maximum" ? 1.35 : 1;
  // The real downbeats (neural model, heuristic fallback), not "every fourth
  // beat" — so the director favours placements that land on an actual bar's "1".
  const isDownbeat = new Set(detectDownbeats(result.beats, result.signals).downbeats.map((time) => Math.round(time * 1000)));

  directedSections.forEach((section, sectionIndex) => {
    if (section.enabled === false) return;
    const pattern = section.pattern ?? suggestDirectorPattern(section, sectionIndex, directedSections.length);
    const grid = sectionBeatGrid(result.beats, section);
    if (!grid.length) return;
    const candidates = grid.map((beat, index) => {
      const signal = nearestSignal(result.signals, beat);
      const visual = result.visuals.length
        ? result.visuals.reduce((best, point) => Math.abs(point.time - beat) < Math.abs(best.time - beat) ? point : best, result.visuals[0])
        : undefined;
      const nearestCut = result.sceneCuts.reduce((distance, cut) => Math.min(distance, Math.abs(cut.time - beat)), Infinity);
      const cutAffinity = nearestCut < 0.18 ? 1 : nearestCut < 0.45 ? 0.55 : 0;
      const downbeat = isDownbeat.has(Math.round(beat * 1000)) ? 1 : 0;
      const score = signal.onset * 0.4 + signal.energy * 0.24 + downbeat * 0.2 + cutAffinity * 0.11 + clamp(visual?.motion || 0) * 0.05;
      return { beat, index, signal, cutAffinity, score };
    });
    const strong = quantile(candidates.map((candidate) => candidate.score), intensity === "smooth" ? 0.72 : intensity === "maximum" ? 0.4 : 0.58);
    let selected = candidates.filter((candidate) => {
      const progress = candidate.index / Math.max(1, candidates.length - 1);
      if (pattern === "restrained") return candidate.index % Math.max(3, Math.round(4 / intensityFactor)) === 0 || candidate.cutAffinity === 1;
      if (pattern === "pulse") return candidate.index % Math.max(2, Math.round(3 / intensityFactor)) === 0 || candidate.score >= strong;
      if (pattern === "build") {
        const stride = progress > 0.72 ? 1 : progress > 0.38 ? 2 : 4;
        return candidate.index % Math.max(1, Math.round(stride / intensityFactor)) === 0;
      }
      if (pattern === "burst") {
        const cycle = intensity === "maximum" ? 6 : 8;
        const burstLength = intensity === "smooth" ? 2 : intensity === "maximum" ? 4 : 3;
        return candidate.index % cycle < burstLength || candidate.cutAffinity === 1;
      }
      return candidate.index === 0 || candidate.cutAffinity === 1 || (candidate.index % Math.max(4, Math.round(6 / intensityFactor)) === 0 && progress < 0.72);
    });
    if (!selected.length) selected = [candidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best, candidates[0])];

    selected.forEach((candidate, selectedIndex) => {
      const profiles = result.effects.length ? result.effects : assetIds.map((assetId) => ({ assetId, peakTime: 0, sourceDuration: Infinity, brightness: 0.5, flashiness: 0.5, suggestedDuration: 0.3 }));
      const desiredFlash = pattern === "burst" ? 0.85 : pattern === "build" ? 0.62 : pattern === "release" ? 0.25 : 0.45;
      const ranked = [...profiles].sort((a, b) => Math.abs(a.flashiness - desiredFlash) - Math.abs(b.flashiness - desiredFlash));
      const rankedProfile = ranked[(selectedIndex + sectionIndex) % ranked.length];
      const assetId = assetIds.includes(rankedProfile.assetId) ? rankedProfile.assetId : assetIds[(selectedIndex + sectionIndex) % assetIds.length];
      // Timing (peakTime, sourceDuration, suggestedDuration) must come from the
      // asset we actually place, not the ranked one — they differ when the
      // ranked asset isn't in the selected pool, which otherwise seeks the wrong
      // clip to the wrong in-point.
      const profile = profiles.find((entry) => entry.assetId === assetId) ?? rankedProfile;
      const tailMultiplier = pattern === "release" ? 1.35 : pattern === "burst" ? 0.72 : 1;
      const tail = profile.suggestedDuration * tailMultiplier * (0.8 + candidate.signal.energy * 0.55);
      const maximumDuration = pattern === "release" ? 2 : 1.6;
      const desiredDuration = clamp(tail + Math.min(profile.peakTime, 0.35), 0.1, maximumDuration);
      const leadIn = Math.min(profile.peakTime, clamp(desiredDuration * 0.35, 0.04, 0.4));
      const start = Math.max(section.start, candidate.beat - leadIn, 0);
      const sourceStart = Math.max(0, profile.peakTime - (candidate.beat - start));
      const availableSource = profile.sourceDuration - sourceStart;
      const requiredPeakWindow = candidate.beat - start + tail;
      const requestedDuration = Math.max(section.duration ?? 0, requiredPeakWindow, 0.1);
      const patternScale = pattern === "restrained" ? -4 : pattern === "burst" ? 16 : pattern === "build" ? Math.round((candidate.index / candidates.length) * 14) : 4;
      placements.push({
        id: `directed-${section.id}-${candidate.index}-${assetId}`,
        assetId,
        sectionId: section.id,
        start,
        sourceStart,
        duration: Math.max(0.05, Math.min(section.end - start, result.duration - start, availableSource, requestedDuration, maximumDuration)),
        scale: section.scale ?? Math.round(104 + candidate.score * (intensity === "maximum" ? 42 : 30) + patternScale),
        opacity: Math.round(clamp(74 + candidate.score * 25 + (pattern === "burst" ? 4 : 0), 50, 100)),
      });
    });
  });
  return placements.sort((a, b) => a.start - b.start);
}

export function buildSmartPlacements(
  result: AnalysisResult,
  assetIds: string[],
  intensity: "smooth" | "dynamic" | "maximum",
): SmartPlacement[] {
  return buildDirectedPlacements(result, assetIds, intensity);
}
