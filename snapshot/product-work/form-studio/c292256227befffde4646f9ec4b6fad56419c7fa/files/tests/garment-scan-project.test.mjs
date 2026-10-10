import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { addGarmentScanPhoto } from "../app/garment-scan-source.ts";
import { attachTracedSkirtPattern, scanPatternFromProject } from "../app/garment-scan-project.ts";
import { createFormProject, parseProject, serializeProject } from "../app/project-format.ts";
import { exportGarmentDxf } from "../app/garment-export.ts";

const image = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
const backImage = Uint8Array.from([...image.slice(0, -1), 131]);
const file = (name) => {
  const bytes = name.startsWith("back") ? backImage : image;
  return { name, type: "image/png", size: bytes.length, arrayBuffer: async () => bytes.slice().buffer };
};
const points = [
  { x: 0.35, y: 0.1 }, { x: 0.65, y: 0.1 }, { x: 0.7, y: 0.42 },
  { x: 0.8, y: 0.9 }, { x: 0.2, y: 0.9 }, { x: 0.3, y: 0.42 },
];

async function storedPair() {
  const front = await addGarmentScanPhoto(createFormProject("Skirt scan", 100), "front", file("front.png"), 200);
  const back = await addGarmentScanPhoto(front.project, "back", file("back.png"), 300);
  return { project: back.project, front: front.asset, back: back.asset };
}

test("one Form project reopens with untouched front/back scans and linked editable pattern", async () => {
  const pair = await storedPair();
  const { project, garment } = attachTracedSkirtPattern(pair.project, {
    kind: "skirt", measuredLengthMm: 600,
    front: { assetId: pair.front.id, points }, back: { assetId: pair.back.id, points },
  }, 400);
  const reopened = parseProject(serializeProject(project));
  const pattern = await scanPatternFromProject(reopened);
  assert.equal(pattern.scanEvidence.status, "inferred-draft");
  assert.equal(pattern.pieces.length, 2);
  assert.deepEqual(pattern.pieces, garment.pieces);
  assert.deepEqual(pattern.scanEvidence.views, {
    front: { sourceId: pair.front.id, sha256: pair.front.checksum },
    back: { sourceId: pair.back.id, sha256: pair.back.checksum },
  });
  for (const asset of reopened.assets) {
    const expected = asset.id === pair.front.id ? image : backImage;
    assert.deepEqual(new Uint8Array(Buffer.from(asset.uri.split(",")[1], "base64")), expected);
    assert.equal(asset.checksum, createHash("sha256").update(expected).digest("hex"));
  }
  assert.match(exportGarmentDxf(pattern), /INFERRED SCAN DRAFT/);
});

test("missing, mismatched and detached scan assets cannot produce or reopen a pattern", async () => {
  const pair = await storedPair();
  const input = { kind: "skirt", measuredLengthMm: 600,
    front: { assetId: pair.front.id, points }, back: { assetId: pair.back.id, points } };
  assert.throws(() => attachTracedSkirtPattern(pair.project, { ...input, back: { ...input.back, assetId: pair.front.id } }), /distinct original scans/);
  assert.throws(() => attachTracedSkirtPattern(pair.project, { ...input, front: { ...input.front, assetId: pair.back.id }, back: { ...input.back, assetId: pair.front.id } }), /original front scan/);
  const sameFront = await addGarmentScanPhoto(createFormProject("Repeated view", 100), "front", file("front.png"), 200);
  const repeated = await addGarmentScanPhoto(sameFront.project, "back", file("front-copy.png"), 350);
  assert.throws(() => attachTracedSkirtPattern(repeated.project, { ...input, front: { ...input.front, assetId: sameFront.asset.id }, back: { ...input.back, assetId: repeated.asset.id } }), /distinct front and back scan images/);
  const { project } = attachTracedSkirtPattern(pair.project, input, 400);
  await assert.rejects(scanPatternFromProject({ ...project, assets: [pair.front] }), /original back scan/);
  await assert.rejects(scanPatternFromProject({ ...project, assets: project.assets.map((asset) => asset.id === pair.front.id ? { ...asset, checksum: "c".repeat(64) } : asset) }), /does not match/);
  await assert.rejects(scanPatternFromProject({ ...project, assets: project.assets.map((asset) => asset.id === pair.front.id ? { ...asset, uri: asset.uri.replace(/.$/, "A") } : asset) }), /original front scan bytes/);
});
