import assert from "node:assert/strict";
import test from "node:test";
import { draftSkirtPatternFromScan } from "../app/garment-scan-pattern.ts";
import { parseGarment, serializeGarment } from "../app/fabric-engine.ts";
import { exportGarmentDxf, exportTiledPatternPdf } from "../app/garment-export.ts";

const outline = (sourceId, hash, shift = 0) => ({
  sourceId, sha256: hash,
  points: [
    { x: 0.35 + shift, y: 0.1 }, { x: 0.65 + shift, y: 0.1 },
    { x: 0.7 + shift, y: 0.42 }, { x: 0.8 + shift, y: 0.9 },
    { x: 0.2 + shift, y: 0.9 }, { x: 0.3 + shift, y: 0.42 },
  ],
});
const scan = () => ({
  kind: "skirt", measuredLengthMm: 600,
  front: outline("front-original", "a".repeat(64)),
  back: outline("back-original", "b".repeat(64), 0.01),
});

test("an accepted skirt scan yields editable source-linked pattern pieces that round-trip and export", () => {
  const project = draftSkirtPatternFromScan(scan());
  assert.equal(project.kind, "skirt");
  assert.equal(project.scanEvidence.status, "inferred-draft");
  assert.equal(project.pieces.length, 2);
  assert.ok(project.seams.length >= 2);
  assert.ok(project.pieces.every((piece) => piece.points.length === 6 && piece.edgeNames.length === 6));
  const reopened = parseGarment(serializeGarment(project));
  assert.deepEqual(reopened.scanEvidence, project.scanEvidence);
  assert.deepEqual(reopened.pieces, project.pieces);
  assert.match(exportGarmentDxf(reopened), /LWPOLYLINE/);
  assert.match(exportGarmentDxf(reopened), /INFERRED SCAN DRAFT/);
  assert.match(new TextDecoder().decode(exportTiledPatternPdf(reopened)), /SCAN DRAFT - NOT VALIDATED FOR CUTTING/);
});

test("unsupported, unmeasured, inconsistent and untraceable scans are not accepted", () => {
  assert.throws(() => draftSkirtPatternFromScan({ ...scan(), kind: "jacket" }), /no proved pattern construction/);
  assert.throws(() => draftSkirtPatternFromScan({ ...scan(), measuredLengthMm: undefined }), /provide measured garment length/);
  assert.throws(() => draftSkirtPatternFromScan({ ...scan(), front: { ...scan().front, sha256: "missing" } }), /original scan/);
  assert.throws(() => draftSkirtPatternFromScan({ ...scan(), back: { ...scan().back, points: scan().back.points.map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) * 1.4 })) } }), /inconsistent proportions/);
  assert.throws(() => draftSkirtPatternFromScan({ ...scan(), front: { ...scan().front, points: [{ x: 0.2, y: 0.2 }] } }), /bounded, closed/);
  assert.throws(() => draftSkirtPatternFromScan({ ...scan(), front: { ...scan().front, points: [
    { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.9 }, { x: 0.3, y: 0.9 }, { x: 0.7, y: 0.1 },
  ] } }), /crosses itself/);
});

test("scan evidence cannot silently promote an inferred draft to measured or lose a source", () => {
  const project = draftSkirtPatternFromScan(scan());
  assert.throws(() => parseGarment(JSON.stringify({ ...project, scanEvidence: { ...project.scanEvidence, status: "validated" } })), /invalid scan evidence/);
  assert.throws(() => parseGarment(JSON.stringify({ ...project, scanEvidence: { ...project.scanEvidence, pieceSources: [] } })), /invalid scan piece evidence/);
});

test("separate collinear outline edges are not mistaken for self-intersection", () => {
  const points = [
    { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.1 }, { x: 0.8, y: 0.5 }, { x: 0.7, y: 0.5 },
    { x: 0.8, y: 0.9 }, { x: 0.2, y: 0.9 }, { x: 0.3, y: 0.5 }, { x: 0.2, y: 0.5 },
  ];
  assert.equal(draftSkirtPatternFromScan({ ...scan(), front: { ...scan().front, points }, back: { ...scan().back, points } }).pieces.length, 2);
});
