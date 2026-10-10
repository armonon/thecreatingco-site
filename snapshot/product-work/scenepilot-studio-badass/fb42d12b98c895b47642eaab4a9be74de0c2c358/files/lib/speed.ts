// Speed ramps — slow-motion drifting into a hit, then snapping back.
//
// Like the stutter, this is a remap of the source playhead, so it lands in the
// preview and the export identically. The warp is deliberately *bounded*: it
// resyncs to real time at the end of every cycle, so the footage can never
// drift arbitrarily far from the soundtrack or run off the end of a clip.

import { beatPosition, beatTime } from "./song-beat-map.ts";

export type SpeedPattern =
  | "off"
  /** Slow at the top of the cycle, accelerating into the next downbeat. */
  | "ramp-in"
  /** Fast at the top, easing out toward the next downbeat. */
  | "ramp-out"
  /** Slow, then a hard whip to catch up at the very end. */
  | "whip";

export type SpeedConfig = {
  pattern: SpeedPattern;
  /** Length of one ramp cycle, in beats. */
  every: number;
  /** How aggressive the warp is. 1 = none; higher bends harder. */
  strength: number;
};

export const SPEED_PRESETS: Record<string, SpeedConfig> = {
  off: { pattern: "off", every: 4, strength: 1 },
  // A gentle drift into every bar.
  drift: { pattern: "ramp-in", every: 4, strength: 1.8 },
  // Slow-mo across two bars, snapping back on the downbeat.
  slowmo: { pattern: "ramp-in", every: 8, strength: 3 },
  // Bursts out of the downbeat and settles.
  launch: { pattern: "ramp-out", every: 4, strength: 2.2 },
  // Crawl, then a hard catch-up whip.
  whip: { pattern: "whip", every: 4, strength: 4 },
};

/**
 * Warp a normalised position within the cycle, 0..1 in and 0..1 out. Must be
 * monotonic and pinned at both ends — that's what keeps the ramp in sync.
 */
export function warpProgress(progress: number, config: SpeedConfig) {
  const p = Math.min(1, Math.max(0, progress));
  const k = Math.max(1e-3, config.strength);
  switch (config.pattern) {
    case "ramp-in":
      // Slow start, accelerating finish.
      return Math.pow(p, k);
    case "ramp-out":
      // Fast start, easing finish.
      return 1 - Math.pow(1 - p, k);
    case "whip": {
      // Near-frozen for most of the cycle, then a hard catch-up at the end.
      const hold = 0.75;
      if (p < hold) return (p / hold) * 0.25;
      return 0.25 + ((p - hold) / (1 - hold)) * 0.75;
    }
    default:
      return p;
  }
}

// The default slow-mo the auto director drifts into a pronounced drop with: a
// two-bar deceleration that eases into a freeze landing exactly on the downbeat.
export const DROP_RAMP: SpeedConfig = { pattern: "ramp-out", every: 8, strength: 3.2 };

/**
 * One-shot slow-motion into the drop. In the `config.every` beats before
 * `dropTime` the source playhead decelerates — easing into a near-freeze that
 * lands precisely on the drop — then the montage's hard cut on the downbeat
 * slams a fresh clip in at full speed. Identity outside that window and with no
 * usable grid, so callers can apply it unconditionally. Pure and monotonic, so
 * preview and export freeze on the same frame.
 */
export function dropRampTime(time: number, dropTime: number, beatSeconds: number, config: SpeedConfig = DROP_RAMP) {
  if (config.pattern === "off" || !(beatSeconds > 0) || !Number.isFinite(dropTime) || config.every <= 0) return time;
  const window = config.every * beatSeconds;
  const start = dropTime - window;
  if (time <= start || time >= dropTime) return time;
  const progress = (time - start) / window;
  // ramp-out decelerates to a standstill at progress 1, so the source both syncs
  // to real time at the drop and freezes right before the cut hits.
  return start + warpProgress(progress, { ...config, pattern: "ramp-out" }) * window;
}

/**
 * Remap `time` to the playhead the footage should show. Outside a ramp (or with
 * no usable beat grid) this is the identity, so callers can apply it always.
 */
export function speedRampTime(time: number, beatSeconds: number, config: SpeedConfig, origin = 0, beats?: number[]): number {
  if (beats && beats.length > 1) {
    const position = beatPosition(beats, time);
    if (position < 0) return time;
    return beatTime(beats, speedRampTime(position, 1, config, 0));
  }
  if (config.pattern === "off" || beatSeconds <= 0 || config.every <= 0) return time;
  const cycle = config.every * beatSeconds;
  const since = time - origin;
  if (since < 0) return time;
  const cycleIndex = Math.floor(since / cycle);
  const cycleStart = origin + cycleIndex * cycle;
  const progress = (time - cycleStart) / cycle;
  return cycleStart + warpProgress(progress, config) * cycle;
}
