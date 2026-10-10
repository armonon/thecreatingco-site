import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { addGarmentScanPhoto, GARMENT_SCAN_PHOTO_MAX_BYTES } from "../app/garment-scan-source.ts";
import { createFormProject, parseProject, serializeProject } from "../app/project-format.ts";

const png = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0,
  73, 69, 78, 68, 174, 66, 96, 130,
]);

function file(bytes, { name = "front.png", type = "image/png", reportedSize = bytes.length } = {}) {
  return { name, type, size: reportedSize, arrayBuffer: async () => bytes.slice().buffer };
}

test("original scan bytes survive project save/reopen with SHA-256 provenance", async () => {
  const initial = createFormProject("Scan study", 100);
  const { project, asset } = await addGarmentScanPhoto(initial, "front", file(png), 200);
  const reopened = parseProject(serializeProject(project));
  const saved = reopened.assets.find((candidate) => candidate.id === asset.id);
  const payload = saved.uri.slice(saved.uri.indexOf(",") + 1);

  assert.deepEqual(new Uint8Array(Buffer.from(payload, "base64")), png);
  assert.equal(saved.checksum, createHash("sha256").update(png).digest("hex"));
  assert.equal(saved.bytes, png.byteLength);
  assert.equal(saved.metadata.garmentScan.view, "front");
  assert.equal(saved.metadata.garmentScan.sourceBytesPreserved, true);
  assert.notEqual(reopened.revisionId, initial.revisionId);
});

test("scan import rejects spoofed signatures, unsupported media, mismatched reads, and oversized files", async () => {
  const project = createFormProject("Scan study", 100);
  await assert.rejects(addGarmentScanPhoto(project, "front", file(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))), /matching file signature/);
  await assert.rejects(addGarmentScanPhoto(project, "front", file(png, { type: "image/gif" })), /PNG, JPEG, or WebP/);
  await assert.rejects(addGarmentScanPhoto(project, "front", file(png, { reportedSize: png.length + 1 })), /changed while it was being read/);
  await assert.rejects(addGarmentScanPhoto(project, "front", file(png, { reportedSize: GARMENT_SCAN_PHOTO_MAX_BYTES + 1 })), /between 12 bytes and 8 MiB/);
});

test("duplicate source bytes/view cannot silently replace an existing project asset", async () => {
  const initial = createFormProject("Scan study", 100);
  const { project } = await addGarmentScanPhoto(initial, "back", file(png), 200);
  await assert.rejects(addGarmentScanPhoto(project, "back", file(png), 300), /already exists/);
});

test("revision identity includes source metadata when deriving from the same prior revision", async () => {
  const initial = createFormProject("Scan study", 100);
  const first = await addGarmentScanPhoto(initial, "front", file(png, { name: "front-a.png" }), 200);
  const second = await addGarmentScanPhoto(initial, "front", file(png, { name: "front-b.png" }), 200);
  assert.notEqual(first.project.revisionId, second.project.revisionId);
});
