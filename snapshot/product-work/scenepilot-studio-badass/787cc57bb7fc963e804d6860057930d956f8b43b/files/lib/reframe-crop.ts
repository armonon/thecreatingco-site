// Crop-window geometry for Reframe: given a source frame size and a target
// aspect, where does the (as-large-as-possible, no extra zoom) crop window
// sit when it's centred on a normalized (0..1) subject position? Clamped so
// it never leaves the source frame. Also letterbox math for the per-segment
// "letterbox instead" option. Pure, no DOM.
export const REFRAME_ASPECTS = {
  "9:16": 9 / 16,
  "4:5": 4 / 5,
  "1:1": 1,
} as const;
export type ReframeAspectId = keyof typeof REFRAME_ASPECTS;
export const REFRAME_ASPECT_IDS = Object.keys(REFRAME_ASPECTS) as ReframeAspectId[];

export type CropRect = { x: number; y: number; width: number; height: number };

/**
 * Crop rectangle in source pixels for `aspect`, centred on (`centerX`,
 * `centerY`) (each 0..1, fraction of source width/height), clamped so the
 * rectangle is always fully inside the source. Uses the largest crop that
 * fits the target aspect inside the source (no zoom beyond what the aspect
 * change requires).
 */
export function cropBounds(sourceWidth: number, sourceHeight: number, aspect: ReframeAspectId, centerX = 0.5, centerY = 0.5): CropRect {
  if (sourceWidth <= 0 || sourceHeight <= 0) return { x: 0, y: 0, width: Math.max(0, sourceWidth), height: Math.max(0, sourceHeight) };
  const targetAspect = REFRAME_ASPECTS[aspect];
  const sourceAspect = sourceWidth / sourceHeight;
  let width: number;
  let height: number;
  if (sourceAspect > targetAspect) {
    height = sourceHeight;
    width = height * targetAspect;
  } else {
    width = sourceWidth;
    height = width / targetAspect;
  }
  const x = Math.min(sourceWidth - width, Math.max(0, centerX * sourceWidth - width / 2));
  const y = Math.min(sourceHeight - height, Math.max(0, centerY * sourceHeight - height / 2));
  return { x, y, width, height };
}

/** Even output pixel size for an aspect; the longer side is `longSide` (default 1080, so 9:16 → 608x1080-ish rounded even). */
export function outputSize(aspect: ReframeAspectId, longSide = 1080) {
  const targetAspect = REFRAME_ASPECTS[aspect];
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  if (targetAspect <= 1) return { width: even(longSide * targetAspect), height: even(longSide) };
  return { width: even(longSide), height: even(longSide / targetAspect) };
}

/** Letterbox/pillarbox placement: the whole source fits inside the output canvas, centred, bars on the short axis. */
export function letterboxRect(sourceWidth: number, sourceHeight: number, outWidth: number, outHeight: number): CropRect {
  if (sourceWidth <= 0 || sourceHeight <= 0) return { x: 0, y: 0, width: outWidth, height: outHeight };
  const scale = Math.min(outWidth / sourceWidth, outHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (outWidth - width) / 2, y: (outHeight - height) / 2, width, height };
}
