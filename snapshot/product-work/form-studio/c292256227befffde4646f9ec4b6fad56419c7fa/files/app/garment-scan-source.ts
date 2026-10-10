import { addFormProjectAssets, FORM_PROJECT_LIMITS, type FormProject, type FormProjectAsset } from "./project-format.ts";

export type GarmentScanView = "front" | "back";
export type GarmentScanPhotoFile = Pick<File, "name" | "type" | "size" | "arrayBuffer">;

export const GARMENT_SCAN_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function hasDeclaredImageSignature(type: string, bytes: Uint8Array) {
  if (type === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  return false;
}

function safeOriginalName(name: string) {
  return name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 160) || "scan-image";
}

/** Embed original scan bytes with a checked MIME signature in a versioned asset.
 * The URI is a data URL of the exact uploaded bytes; derived traces can link to
 * its stable asset id and SHA-256 without replacing the source image.
 */
export async function addGarmentScanPhoto(
  project: FormProject<unknown>,
  view: GarmentScanView,
  file: GarmentScanPhotoFile,
  at = Date.now(),
) {
  if (view !== "front" && view !== "back") throw new Error("Choose a front or back scan view.");
  if (!Number.isInteger(file.size) || file.size < 12 || file.size > GARMENT_SCAN_PHOTO_MAX_BYTES) {
    throw new Error("Scan images must be between 12 bytes and 8 MiB.");
  }
  if (!Number.isFinite(at)) throw new Error("The scan import time is invalid.");
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength !== file.size) throw new Error("The scan image changed while it was being read.");
  const bytes = new Uint8Array(buffer);
  if (!hasDeclaredImageSignature(file.type, bytes)) throw new Error("Use an original PNG, JPEG, or WebP image with a matching file signature.");
  const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)));
  const encoded = toBase64(bytes);
  const uri = `data:${file.type};base64,${encoded}`;
  if (uri.length > FORM_PROJECT_LIMITS.stringLength) throw new Error("The embedded scan image exceeds the project string limit.");
  const asset: FormProjectAsset = {
    id: `garment-scan-${view}-${digest}`,
    name: safeOriginalName(file.name),
    mediaType: file.type,
    uri,
    checksum: digest,
    bytes: bytes.byteLength,
    metadata: {
      garmentScan: { version: 1, view, importedAt: new Date(at).toISOString(), sourceName: safeOriginalName(file.name), sourceBytesPreserved: true },
    },
  };
  return { project: addFormProjectAssets(project, [asset], at), asset };
}
