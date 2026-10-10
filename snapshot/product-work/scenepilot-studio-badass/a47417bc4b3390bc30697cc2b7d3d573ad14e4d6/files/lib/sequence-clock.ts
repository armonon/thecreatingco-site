/** Timeline seconds are independent of any source file's duration. */
export function advanceSequenceClock(time: number, elapsed: number, rate: number, start: number, end: number, loop: boolean) {
  const low = Math.max(0, Number.isFinite(start) ? start : 0);
  const high = Math.max(low, Number.isFinite(end) ? end : low);
  const next = time + Math.max(0, elapsed) * rate;
  const crossed = rate < 0 ? next <= low : next >= high;
  if (!crossed) return { time: Math.max(low, Math.min(high, next)), stopped: false };
  const span = high - low;
  if (loop && span > 0) return { time: low + ((next - low) % span + span) % span, stopped: false };
  return { time: rate < 0 ? low : high, stopped: true };
}

/** Grow to a whole frame, without rounding an existing duration down. */
export function extendedSequenceDuration(duration: number, end: number, frameRate: number) {
  const fps = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 30;
  return Number.isFinite(end) ? Math.max(duration, Math.ceil((Math.max(0, end) - 1e-8) * fps) / fps) : duration;
}
