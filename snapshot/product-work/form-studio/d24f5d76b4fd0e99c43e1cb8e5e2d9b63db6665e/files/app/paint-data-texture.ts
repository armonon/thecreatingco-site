import type { DataTexture } from "three";

/** Imperative GPU resource boundary: retain the material/map, swap only paint
 * bytes and invalidate the upload. Pixels belong to the document and must not
 * be mutated here (Undo/cancel may reuse an earlier immutable snapshot).
 */
export function updatePaintDataTexture(map: DataTexture, pixels: Uint8ClampedArray): void {
  map.image.data = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  map.needsUpdate = true;
}
