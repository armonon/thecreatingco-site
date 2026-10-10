import type { BaseCut } from "./sequencer.ts";
import { sliceTransformKeyframes } from "./keyframes.ts";
import type { OutputAspect } from "./aspect.ts";
import { audioFadeGainAt, audioEnvelopesGainAt, replaceAudioFade, type AudioEnvelope, type AudioFadeShape } from "./audio-crossfade.ts";
import { hasTimeRemap, sampleTimeRemap, sliceTimeRemap } from "./time-remap.ts";

export type TimelineTool =
  | "select"
  | "razor"
  | "rate"
  | "slip"
  | "slide"
  | "roll"
  | "fade"
  | "hand"
  | "zoom";

export type TimelineMarker = {
  id: string;
  time: number;
  label: string;
  color: string;
  kind: "marker" | "chapter" | "sync" | "comment";
  /** Optional span, seconds — a range/duration marker highlighting a region
   *  (e.g. a section to revisit) instead of a single instant. */
  duration?: number;
};

export type TimelineRange = {
  inPoint: number | null;
  outPoint: number | null;
};

export type AudioTrack = {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  gain: number;
  pan: number;
  processing?: AudioEffectRack;
  busId?: string;
  target?: boolean;
  syncLock?: boolean;
};

export type AudioEffectRack = {
  highPassHz: number;
  lowDb: number;
  midDb: number;
  highDb: number;
  compressorThreshold: number;
  compressorRatio: number;
  limiter: boolean;
  makeupGain: number;
};

export const DEFAULT_AUDIO_EFFECT_RACK: AudioEffectRack = {
  highPassHz: 20,
  lowDb: 0,
  midDb: 0,
  highDb: 0,
  compressorThreshold: -24,
  compressorRatio: 1,
  limiter: true,
  makeupGain: 1,
};

export function coerceAudioEffectRack(value?: Partial<AudioEffectRack>): AudioEffectRack {
  const source = { ...DEFAULT_AUDIO_EFFECT_RACK, ...value };
  return {
    highPassHz: Math.max(20, Math.min(400, source.highPassHz)),
    lowDb: Math.max(-18, Math.min(18, source.lowDb)),
    midDb: Math.max(-18, Math.min(18, source.midDb)),
    highDb: Math.max(-18, Math.min(18, source.highDb)),
    compressorThreshold: Math.max(-60, Math.min(0, source.compressorThreshold)),
    compressorRatio: Math.max(1, Math.min(20, source.compressorRatio)),
    limiter: source.limiter !== false,
    makeupGain: Math.max(0.25, Math.min(4, source.makeupGain)),
  };
}

/** ITU-style gated loudness is expensive; this deterministic RMS estimate is
 * used for fast timeline guidance. Final delivery meters can replace it with a
 * native BS.1770 pass without changing the project schema. */
export function estimateIntegratedLufs(samples: ArrayLike<number>) {
  if (!samples.length) return Number.NEGATIVE_INFINITY;
  let squareSum = 0;
  for (let index = 0; index < samples.length; index++) squareSum += Number(samples[index] ?? 0) ** 2;
  const meanSquare = squareSum / samples.length;
  return meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : Number.NEGATIVE_INFINITY;
}

export type AudioClip = {
  /** Per-source beat map in original source seconds; persisted with undo/projects. */
  beatMap?: import("./song-beat-map.ts").SongBeatMap;
  id: string;
  assetId: string;
  trackId: string;
  name: string;
  start: number;
  sourceStart: number;
  /** Varispeed, matching the linked picture. Missing means normal speed. */
  playbackRate?: number;
  duration: number;
  gain: number;
  pan: number;
  fadeIn: number;
  fadeOut: number;
  /** Curve for both fades. Absent = linear (the original behaviour); an audio
   *  crossfade sets this to "equalPower". See lib/audio-crossfade.ts. */
  fadeShape?: AudioFadeShape;
  envelopes?: AudioEnvelope[];
  muted: boolean;
  automation?: VolumeKeyframe[];
  linkedVideoId?: string;
};

export type VolumeKeyframe = {
  id: string;
  /** Seconds from the beginning of the audio clip. */
  time: number;
  /** Linear gain multiplier. 1 is unity, 2 is +6 dB. */
  gain: number;
};

export function automationGainAt(points: Array<Pick<VolumeKeyframe, "time" | "gain">> | undefined, time: number) {
  return createAutomationGainSampler(points)(time);
}

export function createAutomationGainSampler(points: Array<Pick<VolumeKeyframe, "time" | "gain">> | undefined) {
  const automation = [...(points ?? [])]
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.gain))
    .sort((a, b) => a.time - b.time);
  return (time: number) => {
  if (!automation.length) return 1;
  if (time <= automation[0].time) return automation[0].gain;
  if (time >= automation[automation.length - 1].time) return automation[automation.length - 1].gain;
  let lo = 1, hi = automation.length - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (automation[mid].time < time) lo = mid + 1; else hi = mid; }
  const rightIndex = lo;
  const left = automation[rightIndex - 1];
  const right = automation[rightIndex];
  const progress = (time - left.time) / Math.max(0.0001, right.time - left.time);
  return left.gain + (right.gain - left.gain) * progress;
  };
}

export type ProxyState = "original" | "queued" | "building" | "ready" | "failed";

export type MediaBin = {
  id: string;
  name: string;
  parentId: string | null;
};

export type RenderFormat = "mp4-h264" | "mp4-hevc" | "webm-vp9" | "webm-vp9-alpha";

export type RenderJob = {
  id: string;
  projectId?: string;
  compositionId?: string;
  name: string;
  format: RenderFormat | "wav-pcm";
  kind?: "video" | "audio-stem";
  audioStem?: import("./audio-stems.ts").AudioStem;
  status: "queued" | "preparing" | "awaiting-destination" | "rendering" | "finalizing" | "completed" | "failed" | "canceled";
  progress: number;
  message: string;
  createdAt: number;
  frameRate?: 24 | 25 | 30 | 50 | 60;
  maxDimension?: 1920 | 3840;
  range?: TimelineRange;
  aspect?: OutputAspect;
  customSize?: { width: number; height: number };
  outputPath?: string;
  error?: string;
  /** Durable diagnostic marker used to report where an interrupted render
   * stopped. Retry intentionally starts a clean encode; the UI never promises
   * byte-level continuation that the current muxers cannot safely provide. */
  checkpoint?: { progress: number; frame: number; updatedAt: number };
};

const MIN_CLIP_DURATION = 0.05;

export function clipPlaybackRate(cut: Pick<BaseCut, "playbackRate">) {
  return Math.max(0.1, Math.min(8, cut.playbackRate ?? 1));
}

/** Resolve a timeline instant to the exact source frame for a retimed clip.
 *  A keyframed time remap (2+ keys) fully defines the mapping; otherwise a
 *  reversed clip mirrors the elapsed source time within the clip's span, and the
 *  default is a straight rate scaling. */
export function sourceTimeForCut(cut: Pick<BaseCut, "start" | "sourceStart" | "playbackRate" | "duration" | "reversed" | "timeRemap">, timelineTime: number) {
  const localTime = Math.max(0, timelineTime - cut.start);
  if (hasTimeRemap(cut.timeRemap)) return sampleTimeRemap(cut.timeRemap, localTime);
  const rate = clipPlaybackRate(cut);
  const elapsed = localTime * rate;
  if (cut.reversed) {
    const span = (cut.duration ?? 0) * rate;
    return cut.sourceStart + Math.max(0, span - elapsed);
  }
  return cut.sourceStart + elapsed;
}

/**
 * Change a clip's timeline length while preserving the source frames it uses.
 * This is the core of a Premiere-style Rate Stretch edit.
 */
export function rateStretchCut(cut: BaseCut, requestedDuration: number, sourceDuration = Number.POSITIVE_INFINITY): BaseCut {
  const rate = clipPlaybackRate(cut);
  const available = Math.max(0.005, sourceDuration - cut.sourceStart);
  const sourceSpan = Math.min(available, cut.duration * rate);
  const minimumDuration = Math.max(MIN_CLIP_DURATION, sourceSpan / 8);
  const maximumDuration = Math.max(minimumDuration, sourceSpan / 0.1);
  const duration = Math.max(minimumDuration, Math.min(maximumDuration, requestedDuration));
  return { ...cut, duration, playbackRate: Math.max(0.1, Math.min(8, sourceSpan / duration)) };
}

export function snapTime(
  time: number,
  candidates: number[],
  threshold: number,
  enabled = true,
) {
  if (!enabled || !candidates.length) return Math.max(0, time);
  let best = Math.max(0, time);
  let distance = threshold;
  for (const candidate of candidates) {
    const nextDistance = Math.abs(candidate - time);
    if (nextDistance <= distance) {
      best = candidate;
      distance = nextDistance;
    }
  }
  return Math.max(0, best);
}

export function razorCut(cut: BaseCut, time: number): [BaseCut, BaseCut] | null {
  const elapsed = time - cut.start;
  if (elapsed < MIN_CLIP_DURATION || cut.duration - elapsed < MIN_CLIP_DURATION) return null;
  const splitId = `${cut.id}-split-${Math.round(time * 1000)}`;
  const rate = clipPlaybackRate(cut);
  // A forward split advances the right half into the source; a reversed split
  // mirrors it — the right half keeps the source-out anchor and the left half
  // starts deeper in (since reverse counts down from the window's end).
  const leftSourceStart = cut.reversed ? cut.sourceStart + (cut.duration - elapsed) * rate : cut.sourceStart;
  const rightSourceStart = cut.reversed ? cut.sourceStart : cut.sourceStart + elapsed * rate;
  return [
    {
      ...cut,
      sourceStart: leftSourceStart,
      duration: elapsed,
      fadeOut: 0,
      transformKeyframes: sliceTransformKeyframes(cut.transformKeyframes, 0, elapsed, `${cut.id}-left`),
      timeRemap: sliceTimeRemap(cut.timeRemap, 0, elapsed, `${cut.id}-left`),
    },
    {
      ...cut,
      id: splitId,
      start: time,
      sourceStart: rightSourceStart,
      duration: cut.duration - elapsed,
      fadeIn: 0,
      transitionType: undefined,
      transitionDuration: undefined,
      transformKeyframes: sliceTransformKeyframes(cut.transformKeyframes, elapsed, cut.duration, `${splitId}-right`),
      timeRemap: sliceTimeRemap(cut.timeRemap, elapsed, cut.duration, `${splitId}-right`),
    },
  ];
}

export function slipCut(cut: BaseCut, delta: number, sourceDuration: number): BaseCut {
  const rate = clipPlaybackRate(cut);
  const maxStart = Math.max(0, sourceDuration - cut.duration * rate);
  return { ...cut, sourceStart: Math.max(0, Math.min(maxStart, cut.sourceStart + delta * rate)) };
}

export function setClipFade<T extends { duration: number; fadeIn?: number; fadeOut?: number; envelopes?: AudioEnvelope[] }>(cut: T, edge: "in" | "out", seconds: number): T {
  return replaceAudioFade(cut, edge, seconds);
}

/**
 * Slide a clip while preserving the outer edit duration. The preceding and
 * following clips are trimmed/extended at their shared edit points.
 */
export function slideCut(cuts: BaseCut[], cutId: string, delta: number): BaseCut[] {
  const ordered = [...cuts].sort((a, b) => a.start - b.start);
  const index = ordered.findIndex((cut) => cut.id === cutId);
  if (index <= 0 || index >= ordered.length - 1) return cuts;
  const previous = ordered[index - 1];
  const selected = ordered[index];
  const next = ordered[index + 1];
  const minDelta = Math.max(
    MIN_CLIP_DURATION - previous.duration,
    next.sourceStart > 0 ? -next.sourceStart : -Infinity,
  );
  const maxDelta = Math.min(
    next.duration - MIN_CLIP_DURATION,
    selected.start + selected.duration - MIN_CLIP_DURATION - selected.start,
  );
  const safeDelta = Math.max(minDelta, Math.min(maxDelta, delta));
  return ordered.map((cut) => {
    if (cut.id === previous.id) return { ...cut, duration: cut.duration + safeDelta };
    if (cut.id === selected.id) return { ...cut, start: cut.start + safeDelta };
    if (cut.id === next.id) {
      const sourceDelta = safeDelta * clipPlaybackRate(cut);
      return {
        ...cut,
        start: cut.start + safeDelta,
        sourceStart: Math.max(0, cut.sourceStart + sourceDelta),
        duration: cut.duration - safeDelta,
      };
    }
    return cut;
  });
}

/**
 * Move the edit point between adjacent clips without changing their combined
 * timeline duration.
 */
export function rollEdit(cuts: BaseCut[], leftId: string, delta: number): BaseCut[] {
  const ordered = [...cuts].sort((a, b) => a.start - b.start);
  const index = ordered.findIndex((cut) => cut.id === leftId);
  if (index < 0 || index >= ordered.length - 1) return cuts;
  const left = ordered[index];
  const right = ordered[index + 1];
  const safeDelta = Math.max(
    MIN_CLIP_DURATION - left.duration,
    Math.min(right.duration - MIN_CLIP_DURATION, delta),
  );
  return ordered.map((cut) => {
    if (cut.id === left.id) return { ...cut, duration: cut.duration + safeDelta };
    if (cut.id === right.id) {
      const sourceDelta = safeDelta * clipPlaybackRate(cut);
      return {
        ...cut,
        start: cut.start + safeDelta,
        sourceStart: Math.max(0, cut.sourceStart + sourceDelta),
        duration: cut.duration - safeDelta,
      };
    }
    return cut;
  });
}

export function clipGainAt(clip: AudioClip, time: number, trackGain = 1) {
  return createClipGainSampler(clip, trackGain)(time);
}

export function createClipGainSampler(clip: AudioClip, trackGain = 1) {
  const automation = createAutomationGainSampler(clip.automation);
  return (time: number) => {
  if (clip.muted || time < clip.start || time >= clip.start + clip.duration) return 0;
  const local = time - clip.start;
  const fade = audioFadeGainAt(local, clip.duration, clip.fadeIn, clip.fadeOut, clip.fadeShape);
  const automatedGain = automation(local);
  return Math.max(0, clip.gain * automatedGain * trackGain * fade * audioEnvelopesGainAt(clip.envelopes, local));
  };
}

export function markerSnapCandidates(
  cuts: BaseCut[],
  markers: TimelineMarker[],
  beats: number[],
  range: TimelineRange,
) {
  return [
    0,
    ...beats,
    ...markers.map((marker) => marker.time),
    ...cuts.flatMap((cut) => [cut.start, cut.start + cut.duration]),
    ...(range.inPoint === null ? [] : [range.inPoint]),
    ...(range.outPoint === null ? [] : [range.outPoint]),
  ].filter((time) => Number.isFinite(time) && time >= 0);
}

export function hasCompositionCycle(
  compositions: Array<{ id: string; layers: Array<{ compositionId?: string }> }>,
  parentId: string,
  childId: string,
) {
  if (parentId === childId) return true;
  const byId = new Map(compositions.map((composition) => [composition.id, composition]));
  const visit = (id: string, seen: Set<string>): boolean => {
    if (id === parentId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (byId.get(id)?.layers ?? []).some((layer) =>
      layer.compositionId ? visit(layer.compositionId, seen) : false);
  };
  return visit(childId, new Set());
}
