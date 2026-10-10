import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { writeAtomicFile } from "./atomic-file.js";

/** Durable derived media, not a disposable render staging file. Content-addressed
 * names prevent path traversal and keep project links stable across sessions. */
export async function storeGeneratedAudio(root, bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44 || bytes.byteLength > 256 * 1024 * 1024) throw new Error("Generated audio must be a WAV under 256 MB.");
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") throw new Error("Generated audio is not a WAV file.");
  const digest = createHash("sha256").update(buffer).digest("hex");
  await mkdir(root, { recursive: true });
  const outputPath = path.join(root, `${digest}.wav`);
  await writeAtomicFile(outputPath, buffer);
  return { outputPath, bytes: bytes.byteLength };
}
