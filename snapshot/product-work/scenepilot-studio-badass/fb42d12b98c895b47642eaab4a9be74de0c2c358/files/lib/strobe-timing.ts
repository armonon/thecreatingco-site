import { strobeTimes, type StrobePattern } from "./strobe.ts";

/** Independent light clock. Never edits the song grid; duration is end-exclusive. */
export function customStrobeTimes(duration: number, bpm: number, pattern: StrobePattern): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(bpm) || pattern === "off") return [];
  const step = 60 / Math.max(30, Math.min(240, bpm));
  // Include the next beat for subdivisions; bound malformed imported durations.
  const count = Math.min(200_000, Math.ceil(duration / step) + 1);
  const beats = Array.from({ length: count }, (_, index) => index * step);
  return strobeTimes(beats, beats.filter((_, index) => index % 4 === 0), pattern === "onset" ? "every-beat" : pattern)
    .filter(time => time >= 0 && time < duration);
}
