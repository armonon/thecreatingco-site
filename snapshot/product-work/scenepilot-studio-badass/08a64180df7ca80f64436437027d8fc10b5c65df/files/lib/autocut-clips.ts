// AutoCut — clip analysis. Turns a clip's sparse frame samples (brightness,
// detail, motion, histogram change and, optionally, faces) into usable
// segments: stretches that are not black, blown out, blank or soft, split at
// the clip's own scene changes so one "shot" never hides an internal cut.
//
// The browser side measures the samples (lib/analysis-engine.ts `frameStats`
// on a tiny canvas); everything here is pure so it can be tested with
// synthetic sample streams.

export type ClipSample = {
  time: number;
  /** Mean luma 0..1. */
  brightness: number;
  /** Edge/detail energy 0..1 (frameStats.sharpness). */
  sharpness: number;
  /** Tonal spread 0..1 (frameStats.contrast). */
  contrast: number;
  /** Mean absolute luma change vs the previous sample, 0..1. */
  motion: number;
  /** Histogram distance vs the previous sample, 0..1. */
  histogramDistance: number;
  /** Faces found in this frame (only when face detection ran). */
  faces?: number;
  /** Horizontal centre of the largest face, 0..1. */
  faceX?: number;
};

export type FrameIssue = "black" | "white" | "blank" | "soft";

export type ClipSegment = {
  start: number;
  end: number;
  /** 0..1 — exposure, detail and motion quality averaged over the segment. */
  quality: number;
  motion: number;
  brightness: number;
  faces: boolean;
};

export type ClipProfile = {
  id: string;
  name: string;
  duration: number;
  segments: ClipSegment[];
  sceneCuts: number[];
  /** Seconds of usable footage. */
  usable: number;
  /** Visual energy 0..1 (motion + internal cutting); matched to the music's energy. */
  energy: number;
  /** 0..1 — how good the clip's best moment is; hero shots on section starts come from here. */
  hero: number;
  /** Where to centre a vertical/square crop, 0..1 (face centre when known). */
  focusX: number;
  faces: boolean;
  /** Human-readable problems ("mostly black", "static"...). */
  notes: string[];
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
}

/** Why a frame can't be used, or null when it's fine. `softBelow` is the clip-relative focus floor. */
export function frameIssue(sample: ClipSample, softBelow = 0): FrameIssue | null {
  if (sample.brightness < 0.06) return "black";
  if (sample.brightness > 0.96) return "white";
  if (sample.sharpness < 0.012 && sample.contrast < 0.04) return "blank";
  if (softBelow > 0 && sample.sharpness < softBelow) return "soft";
  return null;
}

/** 0..1 quality of a usable frame: exposure near mid-grey, detail, and motion that's alive but not chaos. */
export function frameQuality(sample: ClipSample, sharpRef: number): number {
  const exposure = clamp(1 - Math.abs(sample.brightness - 0.45) * 1.7);
  const detail = clamp(sample.sharpness / Math.max(0.02, sharpRef));
  const motion = sample.motion < 0.002 ? 0.35 : sample.motion < 0.01 ? 0.7 : sample.motion <= 0.12 ? 1 : sample.motion <= 0.25 ? 0.75 : 0.5;
  const face = sample.faces ? 0.12 : 0;
  return clamp(exposure * 0.3 + detail * 0.35 + motion * 0.35 + face);
}

/**
 * Scene changes inside a clip: isolated spikes of histogram + luma change far
 * above the clip's median (robust MAD threshold, as in the editor's footage
 * scan) and well above the neighbouring samples, at least 0.3 s apart.
 */
export function detectSceneCuts(samples: ClipSample[]): number[] {
  if (samples.length < 3) return [];
  const scores = samples.slice(1).map((sample) => sample.histogramDistance * 0.62 + sample.motion * 0.38);
  const center = quantile(scores, 0.5);
  const deviation = quantile(scores.map((value) => Math.abs(value - center)), 0.5);
  const threshold = center + Math.max(0.15, deviation * 4);
  const cuts: number[] = [];
  samples.slice(1).forEach((sample, index) => {
    // A cut is a spike: far above the clip's typical change AND well above its
    // neighbours. Continuous change (a pan, a colour sweep) raises every
    // sample's score together and isn't a cut.
    const neighbours = Math.max(scores[index - 1] ?? 0, scores[index + 1] ?? 0);
    if (scores[index] >= threshold && scores[index] >= neighbours * 1.8 && sample.time - (cuts.at(-1) ?? -10) >= 0.3) {
      // The change happened between the previous sample and this one.
      cuts.push((samples[index].time + sample.time) / 2);
    }
  });
  return cuts;
}

export type ProfileOptions = { minSegment?: number };

/** Build the clip profile from its frame samples. Samples must be ascending in time. */
export function profileClip(id: string, name: string, duration: number, samples: ClipSample[], options: ProfileOptions = {}): ClipProfile {
  const minSegment = options.minSegment ?? 0.4;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : samples.at(-1)?.time ?? 0;
  if (!samples.length || safeDuration <= 0) {
    return { id, name, duration: safeDuration, segments: [], sceneCuts: [], usable: 0, energy: 0, hero: 0, focusX: 0.5, faces: false, notes: ["no frames could be read"] };
  }
  const sceneCuts = detectSceneCuts(samples);
  // "Soft" is relative to the sharpest moments of the same scene, so a
  // naturally soft or low-detail shot isn't thrown away, but a focus miss
  // inside it is. Per scene, because a clip that cuts from a detailed shot to
  // a plain one isn't out of focus.
  const sceneOf = (time: number) => sceneCuts.filter((cut) => cut <= time).length;
  const sceneRefs = new Map<number, number>();
  for (let scene = 0; scene <= sceneCuts.length; scene++) {
    const values = samples.filter((sample) => sceneOf(sample.time) === scene).map((sample) => sample.sharpness);
    if (values.length >= 3) sceneRefs.set(scene, quantile(values, 0.9));
  }
  const clipRef = Math.max(0.02, quantile(samples.map((sample) => sample.sharpness), 0.9));
  const refFor = (time: number) => Math.max(0.02, sceneRefs.get(sceneOf(time)) ?? clipRef);
  const issues = samples.map((sample) => {
    const ref = refFor(sample.time);
    return frameIssue(sample, ref > 0.05 ? ref * 0.4 : 0);
  });

  const step = samples.length > 1 ? (samples[samples.length - 1].time - samples[0].time) / (samples.length - 1) : safeDuration;
  const half = step / 2;
  const segments: ClipSegment[] = [];
  let run: ClipSample[] = [];
  let runStart = 0;
  const flush = (end: number) => {
    if (run.length) {
      const start = Math.max(0, runStart);
      const stop = Math.min(safeDuration, end);
      if (stop - start >= minSegment) {
        segments.push({
          start,
          end: stop,
          quality: mean(run.map((sample) => frameQuality(sample, refFor(sample.time)))),
          motion: mean(run.map((sample) => sample.motion)),
          brightness: mean(run.map((sample) => sample.brightness)),
          faces: run.some((sample) => (sample.faces ?? 0) > 0),
        });
      }
    }
    run = [];
  };
  let cutIndex = 0;
  samples.forEach((sample, index) => {
    // Close the run at an internal scene cut (trim a hair either side of it).
    while (cutIndex < sceneCuts.length && sceneCuts[cutIndex] <= sample.time) {
      flush(sceneCuts[cutIndex] - 0.05);
      runStart = sceneCuts[cutIndex] + 0.05;
      cutIndex++;
    }
    if (issues[index]) {
      flush(sample.time - half);
      runStart = sample.time + half;
      return;
    }
    if (!run.length) runStart = Math.max(runStart, index === 0 ? 0 : sample.time - half);
    run.push(sample);
  });
  flush(safeDuration);

  const usable = segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
  const meanMotion = mean(samples.map((sample) => sample.motion));
  const cutRate = sceneCuts.length / Math.max(1, safeDuration);
  const energy = clamp(meanMotion * 7 + cutRate * 0.6);
  const best = segments.reduce((top, segment) => Math.max(top, segment.quality * clamp((segment.end - segment.start) / 2, 0.5, 1)), 0);
  const faceSamples = samples.filter((sample) => (sample.faces ?? 0) > 0 && sample.faceX != null);
  const faces = faceSamples.length > 0;
  const hero = clamp(best + (faces ? 0.15 : 0));
  const focusX = faces ? clamp(mean(faceSamples.map((sample) => sample.faceX as number)), 0.15, 0.85) : 0.5;

  const notes: string[] = [];
  const count = (issue: FrameIssue) => issues.filter((value) => value === issue).length / issues.length;
  if (count("black") > 0.5) notes.push("mostly black");
  if (count("white") > 0.5) notes.push("blown out");
  if (count("blank") > 0.5) notes.push("blank / flat frame");
  if (count("soft") > 0.3) notes.push("often out of focus");
  if (meanMotion < 0.002 && samples.length > 3) notes.push("static");
  if (!segments.length) notes.push("nothing usable — skipped");

  return { id, name, duration: safeDuration, segments, sceneCuts, usable, energy, hero, focusX, faces, notes };
}

/** Fraction (0..1) of [start, end) covered by usable segments — for synced takes, where the window is fixed by the song. */
export function usableCoverage(segments: ClipSegment[], start: number, end: number): number {
  if (end <= start) return 0;
  let covered = 0;
  for (const segment of segments) covered += Math.max(0, Math.min(end, segment.end) - Math.max(start, segment.start));
  return clamp(covered / (end - start));
}

/** Mean quality over [start, end), weighting each segment by its overlap. 0 where nothing is usable. */
export function windowQuality(segments: ClipSegment[], start: number, end: number): number {
  if (end <= start) return 0;
  let weighted = 0;
  for (const segment of segments) weighted += Math.max(0, Math.min(end, segment.end) - Math.max(start, segment.start)) * segment.quality;
  return clamp(weighted / (end - start));
}
