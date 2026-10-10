// Turning raw per-frame detections into one follow target, for Reframe's
// multiple-subject mode: keep two faces in frame together when a crop at the
// current fit width can actually contain both with a margin to spare;
// otherwise (too far apart, or 3+ faces) follow the largest/most prominent
// face. Also the motion-saliency fallback for frames with no detected face.
export type DetectedFace = { x: number; y: number; size: number };
export type SubjectPick = { x: number; y: number; multi: boolean };

/**
 * `fitWidth` is the normalized (0..1 of frame width) width of the crop window
 * at the aspect/zoom in use; `margin` is extra breathing room (both 0..1 of
 * frame width) required beyond the two faces' span before they're kept
 * together rather than switching to single-subject follow.
 */
export function pickSubjectTarget(faces: DetectedFace[], fitWidth: number, margin = 0.12): SubjectPick | null {
  if (!faces.length) return null;
  if (faces.length === 1) return { x: faces[0].x, y: faces[0].y, multi: false };
  const bySize = [...faces].sort((a, b) => b.size - a.size);
  const [a, b] = bySize;
  const span = Math.abs(a.x - b.x) + Math.max(a.size, b.size);
  if (span + margin <= fitWidth) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, multi: true };
  }
  return { x: a.x, y: a.y, multi: false };
}

/**
 * Weighted centroid (normalized 0..1) of the luma change between two
 * equal-sized grayscale frames — a cheap motion-saliency fallback for
 * segments with no detected face. Returns null when there isn't enough
 * motion to trust (a mostly static frame, or sensor/compression noise).
 */
export function motionCentroid(previous: Uint8Array | Uint8ClampedArray, current: Uint8Array | Uint8ClampedArray, width: number, height: number): { x: number; y: number; weight: number } | null {
  let sumX = 0;
  let sumY = 0;
  let sumWeight = 0;
  const noiseFloor = 8;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const index = row + x;
      const diff = Math.abs(current[index] - previous[index]);
      if (diff < noiseFloor) continue;
      sumX += x * diff;
      sumY += y * diff;
      sumWeight += diff;
    }
  }
  const area = Math.max(1, width * height);
  if (sumWeight < area * 2) return null;
  return { x: (sumX / sumWeight + 0.5) / width, y: (sumY / sumWeight + 0.5) / height, weight: Math.min(1, sumWeight / (area * 255)) };
}
