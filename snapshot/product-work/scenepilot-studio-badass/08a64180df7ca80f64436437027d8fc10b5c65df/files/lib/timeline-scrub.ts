/** Map the rendered time area, not the moving playhead or fixed track header. */
export function timelineScrubTime(clientX: number, left: number, width: number, duration: number, frameRate: number): number | null {
  if (![clientX, left, width, duration, frameRate].every(Number.isFinite) || width <= 0 || duration < 0 || frameRate <= 0) return null;
  const raw = Math.max(0, Math.min(duration, (clientX - left) / width * duration));
  return Math.max(0, Math.min(duration, Math.round(raw * frameRate) / frameRate));
}
