// Audio fade shapes + constant-power crossfades — the Premiere "Constant Power"
// transition. A single fade maps a 0..1 progress to a gain; a crossfade pairs a
// fade-out and a fade-in so their powers sum to unity, avoiding the mid-point
// dip you get when you linearly crossfade correlated material. Pure and
// deterministic so preview and export mix identically.

import type { AudioClip } from "./pro-editor.ts";
import { audioPlaybackRate } from "./audio-timing.ts";

export type AudioFadeShape = "linear" | "equalPower" | "exponential";

/** Original envelope clock survives range crops and nested composition clips. */
export type AudioEnvelope = { offset: number; duration: number; fadeIn: number; fadeOut: number; shape?: AudioFadeShape; origin?: "clip-in" | "clip-out" };

/** Preserve the original gain curve, including cuts made partway through a fade. */
export function sliceAudioFades(clip: { duration: number; fadeIn: number; fadeOut: number; fadeShape?: AudioFadeShape; envelopes?: AudioEnvelope[] }, from: number, to: number) {
  const duration = to - from;
  const envelopes = (clip.envelopes ?? []).map((item) => ({ ...item, offset: item.offset + from }));
  const head = Math.min(clip.duration, Math.max(0, clip.fadeIn));
  const tail = Math.min(clip.duration, Math.max(0, clip.fadeOut));
  const fadeIn = from === 0 && duration >= head ? head : 0;
  const fadeOut = to === clip.duration && duration >= tail ? tail : 0;
  if (!fadeIn && from < head) envelopes.push({ offset: from, duration: clip.duration, fadeIn: head, fadeOut: 0, shape: clip.fadeShape, origin: "clip-in" });
  if (!fadeOut && to > clip.duration - tail) envelopes.push({ offset: from, duration: clip.duration, fadeIn: 0, fadeOut: tail, shape: clip.fadeShape, origin: "clip-out" });
  return { fadeIn, fadeOut, ...(envelopes.length || clip.envelopes ? { envelopes } : {}) };
}

/** Explicitly editing an edge replaces its retained curve, never group fades. */
export function replaceAudioFade<T extends { duration: number; fadeIn?: number; fadeOut?: number; envelopes?: AudioEnvelope[] }>(clip: T, edge: "in" | "out", seconds: number): T {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.min(clip.duration, seconds)) : 0;
  return { ...clip, [edge === "in" ? "fadeIn" : "fadeOut"]: value,
    ...(clip.envelopes ? { envelopes: clip.envelopes.filter((item) => item.origin !== `clip-${edge}`) } : {}) };
}

export function audioEnvelopesGainAt(envelopes: AudioEnvelope[] | undefined, time: number) {
  return (envelopes ?? []).reduce((gain, envelope) => gain * audioFadeGainAt(time + envelope.offset, envelope.duration, envelope.fadeIn, envelope.fadeOut, envelope.shape), 1);
}

export const AUDIO_FADE_SHAPES: AudioFadeShape[] = ["linear", "equalPower", "exponential"];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Gain (0..1) for a fade at `progress` (0 = silent edge, 1 = full level).
 * - `linear` — the raw ramp.
 * - `equalPower` — a quarter-sine; two of these in opposition hold constant power.
 * - `exponential` — a slow, natural-sounding start that pulls up late.
 */
export function fadeCurve(progress: number, shape: AudioFadeShape = "linear"): number {
  const p = clamp01(progress);
  switch (shape) {
    case "equalPower":
      return Math.sin(p * (Math.PI / 2));
    case "exponential":
      return p * p;
    default:
      return p;
  }
}

/** Shared preview/PCM envelope; independent fades multiply when they overlap. */
export function audioFadeGainAt(time: number, duration: number, fadeIn: number, fadeOut: number, shape: AudioFadeShape = "linear") {
  const length = Math.max(0, duration);
  const local = Math.max(0, Math.min(length, time));
  const head = Math.max(0, Math.min(length, fadeIn));
  const tail = Math.max(0, Math.min(length, fadeOut));
  return (head > 0 ? fadeCurve(local / head, shape) : 1) * (tail > 0 ? fadeCurve((length - local) / tail, shape) : 1);
}

/**
 * The constant-power gain pair across a crossfade. `progress` runs 0..1 from the
 * start of the overlap to its end: the outgoing clip fades cos, the incoming
 * fades sin, and `out² + in² === 1` at every point — no power dip at the seam.
 */
export function crossfadeGains(progress: number): { out: number; in: number } {
  const p = clamp01(progress);
  const angle = p * (Math.PI / 2);
  return { out: Math.cos(angle), in: Math.sin(angle) };
}

const MIN_CROSSFADE = 0.02;

/**
 * Apply a constant-power crossfade between two audio clips on the same track.
 * `left` must sit before `right`. If they are merely adjacent, `right` is pulled
 * back over `left`'s tail to create the overlap (using its head handle), so the
 * edit is local — nothing downstream moves. The overlap is bounded by the
 * clips' lengths and by how much head `right` actually has (its `sourceStart`).
 * Returns the retimed pair, or null if a valid overlap can't be formed.
 */
export function applyAudioCrossfade(
  left: AudioClip,
  right: AudioClip,
  requestedDuration: number,
): [AudioClip, AudioClip] | null {
  if (!Number.isFinite(requestedDuration) || requestedDuration <= 0) return null;
  if (left.trackId !== right.trackId) return null;
  const leftEnd = left.start + left.duration;
  // Order guard: left must actually precede right.
  if (right.start < left.start || right.start + right.duration < leftEnd) return null;

  const currentOverlap = leftEnd - right.start; // >0 already overlapping, <=0 adjacent/gapped
  const rate = audioPlaybackRate(right);
  const headRoom = Math.max(0, right.sourceStart / rate); // timeline seconds of source handle
  const ceiling = Math.min(left.duration, right.duration, left.duration); // never longer than either clip
  let duration = Math.min(requestedDuration, ceiling);

  let nextRight = right;
  if (currentOverlap < duration) {
    // Need to create (or grow) the overlap by pulling `right` earlier. Bounded by
    // its available head so we never seek before the start of the source.
    const needed = duration - Math.max(0, currentOverlap);
    const shift = Math.min(needed, headRoom);
    if (currentOverlap <= 0 && shift <= 0) return null; // adjacent with no head to borrow
    nextRight = {
      ...right,
      start: right.start - shift,
      sourceStart: right.sourceStart - shift * rate,
      duration: right.duration + shift,
      envelopes: right.envelopes?.map((item) => ({ ...item, offset: item.offset - shift })),
      automation: right.automation?.map((point) => ({ ...point, time: point.time + shift })),
    };
    duration = Math.min(duration, leftEnd - nextRight.start);
  }
  // Existing overlaps must fade across the *whole* overlap, otherwise there
  // is a full-volume plateau between a short fade-in and a short fade-out.
  duration = leftEnd - nextRight.start;
  if (duration < MIN_CROSSFADE) return null;

  return [
    { ...replaceAudioFade(left, "out", duration), fadeShape: "equalPower" },
    { ...replaceAudioFade(nextRight, "in", duration), fadeShape: "equalPower" },
  ];
}
