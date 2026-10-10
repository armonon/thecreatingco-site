// Stutter — quantising the source playhead to a musical grid so motion moves in
// steps instead of smoothly. The classic staccato / frame-hold / DJ-roll move.
//
// A stutter is purely a remap of time: given the real playhead, return the time
// the footage should actually show. Because the base layer's source position
// runs through here, the effect lands identically in the preview and the export.

import { beatPosition, beatTime } from "./song-beat-map.ts";

export type StutterPattern =
  | "off"
  /** Freeze on a frame for each division — motion advances in steps. */
  | "hold"
  /** Loop the first division of the window — a DJ roll. */
  | "repeat"
  /** Play each division backwards — a rewind judder. */
  | "reverse";

export type StutterConfig = {
  pattern: StutterPattern;
  /** Grid the stutter snaps to, in beats. 0.25 = sixteenths. */
  division: number;
  /** Stutter runs for the first `window` beats of every `every` beats. */
  window: number;
  every: number;
};

export const STUTTER_PRESETS: Record<string, StutterConfig> = {
  off: { pattern: "off", division: 0.25, window: 0, every: 4 },
  // One beat of sixteenth-note freeze at the top of each bar.
  step: { pattern: "hold", division: 0.25, window: 1, every: 4 },
  // Eighth-note freeze across half a bar — heavier, more deliberate.
  chop: { pattern: "hold", division: 0.5, window: 2, every: 4 },
  // A sixteenth roll on the last beat of every other bar.
  roll: { pattern: "repeat", division: 0.25, window: 1, every: 8 },
  // Rewind judder, sparingly.
  rewind: { pattern: "reverse", division: 0.5, window: 1, every: 8 },
  // Always on — robotic, exhausting on purpose.
  robot: { pattern: "hold", division: 0.25, window: 4, every: 4 },
};

/** Median gap between beats, in seconds. 0 when there's no usable grid. */
export function beatSecondsFrom(beats: number[]) {
  if (beats.length < 2) return 0;
  const gaps: number[] = [];
  for (let i = 1; i < beats.length; i++) gaps.push(beats[i] - beats[i - 1]);
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] || 0;
}

/**
 * Is the stutter firing at `time`? The window repeats every `every` beats,
 * measured from `origin` (the first beat), so it stays locked to the bar.
 */
export function isStuttering(time: number, beatSeconds: number, config: StutterConfig, origin = 0) {
  if (config.pattern === "off" || beatSeconds <= 0 || config.window <= 0) return false;
  const beatsElapsed = (time - origin) / beatSeconds;
  if (beatsElapsed < 0) return false;
  const cycle = Math.max(1e-6, config.every);
  return beatsElapsed % cycle < config.window;
}

/**
 * Remap `time` to the time the footage should show. Outside a stutter window
 * this is the identity, so callers can apply it unconditionally.
 */
export function stutterTime(time: number, beatSeconds: number, config: StutterConfig, origin = 0, beats?: number[]): number {
  if (beats && beats.length > 1) {
    const position = beatPosition(beats, time);
    if (position < 0) return time;
    return beatTime(beats, stutterTime(position, 1, config, 0));
  }
  if (!isStuttering(time, beatSeconds, config, origin)) return time;
  const step = config.division * beatSeconds;
  if (step <= 0) return time;

  const since = time - origin;
  const stepIndex = Math.floor(since / step);
  const stepStart = origin + stepIndex * step;
  const intoStep = time - stepStart;

  switch (config.pattern) {
    case "hold":
      // Freeze on the frame that opened this division.
      return stepStart;
    case "reverse":
      // Walk the division backwards.
      return stepStart + (step - intoStep);
    case "repeat": {
      // Loop the first division of the current window.
      const cycle = Math.max(1e-6, config.every) * beatSeconds;
      const windowStart = origin + Math.floor(since / cycle) * cycle;
      return windowStart + ((time - windowStart) % step);
    }
    default:
      return time;
  }
}
