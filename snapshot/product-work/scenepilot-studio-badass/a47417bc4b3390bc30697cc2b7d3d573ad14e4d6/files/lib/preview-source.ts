/** A frame plan computed before metadata arrives may contain no video layers.
 * Invalidate it when the decoder becomes ready, including at a paused playhead. */
export function observePreviewSource(source: Pick<EventTarget, "addEventListener" | "removeEventListener">, invalidate: () => void) {
  const events = ["loadedmetadata", "loadeddata", "resize"];
  for (const event of events) source.addEventListener(event, invalidate);
  return () => { for (const event of events) source.removeEventListener(event, invalidate); };
}

export function canCacheVideoFrame(source: { readyState: number; seeking: boolean; currentTime: number }, time: number, tolerance: number): boolean {
  // currentTime updates immediately when seeking starts; it alone is not proof
  // that the decoder has delivered the requested frame yet.
  return source.readyState >= 2 && !source.seeking && Math.abs(source.currentTime - time) <= tolerance;
}

/** Do not continuously restart an in-flight decode while the playhead moves. */
export function shouldSeekPreviewSource(source: { seeking: boolean; currentTime: number }, time: number, tolerance: number): boolean {
  return !source.seeking && Math.abs(source.currentTime - time) > tolerance;
}
