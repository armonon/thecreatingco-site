import { createGarmentTemplate, recalculateSeamEase, type FabricPoint, type GarmentProject } from "./fabric-engine.ts";

/** Prepared scan observations, in original image coordinates normalized to [0, 1]. */
export type ScanOutline = { sourceId: string; sha256: string; points: FabricPoint[] };
export type SkirtScan = {
  kind: "skirt";
  front: ScanOutline;
  back: ScanOutline;
  /** An actual garment-length measurement, not a value inferred from pixels. */
  measuredLengthMm: number;
};

type Widths = { waist: number; hip: number; hem: number; aspect: number };

function signedTurn(a: FabricPoint, b: FabricPoint, c: FabricPoint) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function hasCrossingEdges(points: FabricPoint[]) {
  for (let i = 0; i < points.length; i += 1) for (let j = i + 2; j < points.length; j += 1) {
    if (i === 0 && j === points.length - 1) continue;
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    if (Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) ||
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))) continue;
    const ab = signedTurn(a, b, c) * signedTurn(a, b, d);
    const cd = signedTurn(c, d, a) * signedTurn(c, d, b);
    if (ab <= 0 && cd <= 0) return true;
  }
  return false;
}

function widthAt(points: FabricPoint[], row: number) {
  const xs: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]; const b = points[(index + 1) % points.length];
    if ((a.y <= row && row < b.y) || (b.y <= row && row < a.y)) xs.push(a.x + (row - a.y) * (b.x - a.x) / (b.y - a.y));
  }
  xs.sort((a, b) => a - b);
  if (xs.length !== 2 || xs[1] - xs[0] < 0.03) throw new Error("needs-input: scan outline must show a single clear skirt panel at waist, hip and hem");
  return xs[1] - xs[0];
}

function observe(view: ScanOutline, lengthMm: number): Widths {
  if (!view || !view.sourceId?.trim() || !/^[a-f0-9]{64}$/i.test(view.sha256 ?? "")) throw new Error("needs-input: retain an identifiable original scan and SHA-256 hash");
  const points = view.points;
  if (!Array.isArray(points) || points.length < 4 || points.length > 512 || points.some((p) => !Number.isFinite(p?.x) || !Number.isFinite(p?.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw new Error("needs-input: trace a bounded, closed garment outline");
  if (hasCrossingEdges(points)) throw new Error("needs-input: scan outline crosses itself; correct the traced boundary");
  const ys = points.map((p) => p.y), top = Math.min(...ys), bottom = Math.max(...ys), height = bottom - top;
  if (height < 0.2) throw new Error("needs-input: the scan is too small for a pattern draft");
  const factor = lengthMm / height;
  const waist = widthAt(points, top + height * 0.08) * factor;
  const hip = widthAt(points, top + height * 0.4) * factor;
  const hem = widthAt(points, top + height * 0.92) * factor;
  if ([waist, hip, hem].some((width) => width < 150 || width > 1000) || waist > hip * 1.3 || hem < hip * 0.7) throw new Error("needs-input: scan proportions do not support the simple skirt construction");
  return { waist, hip, hem, aspect: hip / lengthMm };
}

/** First supported scan construction: a symmetric, two-panel A-line skirt draft.
 * This is editable inferred geometry, not a recovered manufacturing pattern. */
export function draftSkirtPatternFromScan(input: SkirtScan): GarmentProject {
  if (input?.kind !== "skirt") throw new Error("needs-input: this scan category has no proved pattern construction yet");
  const length = input.measuredLengthMm;
  if (!Number.isFinite(length) || length < 200 || length > 1200) throw new Error("needs-input: provide measured garment length in millimetres (200–1200)");
  const front = observe(input.front, length), back = observe(input.back, length);
  if (Math.max(front.aspect, back.aspect) / Math.min(front.aspect, back.aspect) > 1.15) throw new Error("needs-input: front and back scans have inconsistent proportions");
  const waist = (front.waist + back.waist) / 2;
  const hip = (front.hip + back.hip) / 2;
  const hem = (front.hem + back.hem) / 2;
  const topY = length / 2, hipY = topY - length * 0.4, hemY = -length / 2;
  const project = createGarmentTemplate("skirt");
  const pieces = project.pieces.map((piece, index) => ({
    ...piece,
    points: [
      { x: -waist / 2, y: topY }, { x: -hip / 2, y: hipY }, { x: -hem / 2, y: hemY },
      { x: hem / 2, y: hemY }, { x: hip / 2, y: hipY }, { x: waist / 2, y: topY },
    ],
    position: { x: (index ? 1 : -1) * (hem / 2 + 60), y: 0 },
  }));
  const draft: GarmentProject = {
    ...project, name: "Scan-derived skirt · inferred draft", size: "Draft", pieces,
    scanEvidence: {
      version: 1, status: "inferred-draft", measuredLengthMm: length,
      views: { front: { sourceId: input.front.sourceId, sha256: input.front.sha256 }, back: { sourceId: input.back.sourceId, sha256: input.back.sha256 } },
      pieceSources: pieces.map((piece) => ({ pieceId: piece.id, view: piece.role === "front" ? "front" : "back", status: "inferred" })),
      assumptions: ["Symmetric two-panel A-line construction", "Front and back widths averaged to keep side seams matched", "Hidden darts, closure, fabric and seam finishes require human review"],
    },
  };
  return { ...draft, seams: recalculateSeamEase(draft) };
}
