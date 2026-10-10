/** Keep an end-of-playback viewer on the final exported frame, not the empty out point. */
export function previewFrameTime(time: number, duration: number, frameRate = 30): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const fps = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 30;
  const last = Math.max(0, (Math.ceil(duration * fps) - 1) / fps);
  return Math.max(0, Math.min(Number.isFinite(time) ? time : 0, last));
}
