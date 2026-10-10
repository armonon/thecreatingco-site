import type { FabricPoint, GarmentProject, PatternPiece } from "./fabric-engine.ts";
import { patternOutline, patternNotchLine, type PatternNotch } from "./fabric-pattern-geometry.ts";

const MM_TO_PT = 72 / 25.4;

function rotate(point: FabricPoint, degrees: number) {
  const radians = degrees * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
}

function placedPoints(piece: PatternPiece) {
  return patternOutline(piece).points.map((point) => {
    const rotated = rotate(point, piece.rotation);
    return { x: rotated.x + piece.position.x, y: rotated.y + piece.position.y };
  });
}

function signedArea(points: FabricPoint[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function lineIntersection(a: FabricPoint, directionA: FabricPoint, b: FabricPoint, directionB: FabricPoint) {
  const cross = directionA.x * directionB.y - directionA.y * directionB.x;
  if (Math.abs(cross) < 1e-8) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const t = ((b.x - a.x) * directionB.y - (b.y - a.y) * directionB.x) / cross;
  return { x: a.x + directionA.x * t, y: a.y + directionA.y * t };
}

/** Mitered closed-polygon offset used for production seam-allowance lines. */
export function offsetPatternPolygon(points: FabricPoint[], distance: number) {
  if (points.length < 3 || distance === 0) return points.map((point) => ({ ...point }));
  const winding = signedArea(points) >= 0 ? 1 : -1;
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]; const next = points[(index + 1) % points.length];
    const before = { x: point.x - previous.x, y: point.y - previous.y }; const after = { x: next.x - point.x, y: next.y - point.y };
    const beforeLength = Math.hypot(before.x, before.y) || 1; const afterLength = Math.hypot(after.x, after.y) || 1;
    const beforeNormal = { x: winding * before.y / beforeLength, y: -winding * before.x / beforeLength };
    const afterNormal = { x: winding * after.y / afterLength, y: -winding * after.x / afterLength };
    const beforeOrigin = { x: point.x + beforeNormal.x * distance, y: point.y + beforeNormal.y * distance };
    const afterOrigin = { x: point.x + afterNormal.x * distance, y: point.y + afterNormal.y * distance };
    const intersection = lineIntersection(beforeOrigin, before, afterOrigin, after);
    const miter = Math.hypot(intersection.x - point.x, intersection.y - point.y);
    if (miter > Math.abs(distance) * 6) {
      const normal = { x: beforeNormal.x + afterNormal.x, y: beforeNormal.y + afterNormal.y }; const length = Math.hypot(normal.x, normal.y) || 1;
      return { x: point.x + normal.x / length * distance, y: point.y + normal.y / length * distance };
    }
    return intersection;
  });
}

function dxfPolyline(points: FabricPoint[], layer: string) {
  return `0\nLWPOLYLINE\n8\n${layer}\n90\n${points.length}\n70\n1\n${points.map((point) => `10\n${point.x.toFixed(4)}\n20\n${point.y.toFixed(4)}`).join("\n")}\n`;
}

function dxfLine(a: FabricPoint, b: FabricPoint, layer: string) {
  return `0\nLINE\n8\n${layer}\n10\n${a.x.toFixed(4)}\n20\n${a.y.toFixed(4)}\n11\n${b.x.toFixed(4)}\n21\n${b.y.toFixed(4)}\n`;
}

function dxfText(point: FabricPoint, value: string) {
  const safe = value.replace(/[^\x20-\x7e]/g, " ").slice(0, 120);
  return `0\nTEXT\n8\nLABEL\n10\n${point.x.toFixed(4)}\n20\n${point.y.toFixed(4)}\n40\n8\n1\n${safe}\n`;
}

/** Layered millimeter DXF with cut, seam allowance, grain, notches and labels. */
export function exportGarmentDxf(project: GarmentProject) {
  let entities = "";
  if (project.scanEvidence?.status === "inferred-draft") entities += dxfText({ x: 0, y: 0 }, "INFERRED SCAN DRAFT - REVIEW CONSTRUCTION AND WIDTHS BEFORE CUTTING");
  project.pieces.forEach((piece) => {
    const cut = placedPoints(piece); const allowance = offsetPatternPolygon(cut, piece.seamAllowance);
    entities += dxfPolyline(cut, "CUT");
    entities += dxfPolyline(allowance, "SEAM_ALLOWANCE");
    const center = cut.reduce((sum, point) => ({ x: sum.x + point.x / cut.length, y: sum.y + point.y / cut.length }), { x: 0, y: 0 });
    const grain = rotate({ x: 0, y: 65 }, piece.grainAngle + piece.rotation);
    entities += dxfLine({ x: center.x - grain.x, y: center.y - grain.y }, { x: center.x + grain.x, y: center.y + grain.y }, "GRAIN");
    entities += dxfText(center, `${piece.name} | CUT ${piece.cutQuantity}${piece.mirror ? " MIRROR" : ""}`);
    const notches: PatternNotch[] = [...(piece.notches ?? [])];
    project.seams.filter((seam) => seam.enabled).forEach((seam) => {
      for (const reference of [seam.a, seam.b]) {
        if (reference.pieceId !== piece.id) continue;
        if (!notches.some((n) => n.edgeIndex === reference.edgeIndex)) notches.push({ id: `${seam.id}-${reference.edgeIndex}`, edgeIndex: reference.edgeIndex, fraction: 0.5, depth: 6, label: seam.name });
      }
    });
    notches.forEach((notch) => {
      const [a, b] = patternNotchLine(piece, notch).map((p) => { const r = rotate(p, piece.rotation); return { x: r.x + piece.position.x, y: r.y + piece.position.y }; });
      entities += dxfLine(a, b, "NOTCH");
    });
  });
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

function pdfEscape(value: string) {
  return value.replace(/[^\x20-\x7e]/g, " ").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function pathCommands(points: FabricPoint[], offsetX: number, offsetY: number) {
  return points.map((point, index) => `${((point.x - offsetX) * MM_TO_PT).toFixed(3)} ${((point.y - offsetY) * MM_TO_PT).toFixed(3)} ${index ? "l" : "m"}`).join(" ") + " h";
}

type PdfPage = { content: string };

function buildPdf(pages: PdfPage[]) {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((page, index) => {
    const pageId = pageIds[index]; const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${new TextEncoder().encode(page.content).byteLength} >>\nstream\n${page.content}\nendstream`;
  });
  let pdf = "%PDF-1.4\n% FORM garment pattern\n"; const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) { offsets[id] = new TextEncoder().encode(pdf).byteLength; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = new TextEncoder().encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

/** Full-scale, tiled A4 pattern PDF with a 10 mm printable margin and registration marks. */
export function exportTiledPatternPdf(project: GarmentProject) {
  const printableWidth = 190; const printableHeight = 277; const margin = 10; const pages: PdfPage[] = [];
  project.pieces.forEach((piece) => {
    const cut = patternOutline(piece).points; const allowance = offsetPatternPolygon(cut, piece.seamAllowance);
    const all = [...cut, ...allowance]; const minX = Math.min(...all.map((point) => point.x)); const maxX = Math.max(...all.map((point) => point.x)); const minY = Math.min(...all.map((point) => point.y)); const maxY = Math.max(...all.map((point) => point.y));
    const columns = Math.max(1, Math.ceil((maxX - minX) / printableWidth)); const rows = Math.max(1, Math.ceil((maxY - minY) / printableHeight));
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
      const tileX = minX + column * printableWidth; const tileY = minY + row * printableHeight;
      const tx = margin * MM_TO_PT; const ty = margin * MM_TO_PT;
      const cutPath = pathCommands(cut, tileX, tileY); const allowancePath = pathCommands(allowance, tileX, tileY);
      const notchPaths = (piece.notches ?? []).map((notch) => {
        const [a, b] = patternNotchLine(piece, notch);
        return `${((a.x - tileX) * MM_TO_PT).toFixed(3)} ${((a.y - tileY) * MM_TO_PT).toFixed(3)} m ${((b.x - tileX) * MM_TO_PT).toFixed(3)} ${((b.y - tileY) * MM_TO_PT).toFixed(3)} l S`;
      }).join(" ");
      const title = pdfEscape(`${project.name} | ${piece.name} | tile ${column + 1}/${columns}, ${row + 1}/${rows} | 100% scale`);
      const label = pdfEscape(`CUT ${piece.cutQuantity}${piece.mirror ? " MIRRORED PAIR" : ""} | allowance ${piece.seamAllowance} mm`);
      const draftWarning = project.scanEvidence?.status === "inferred-draft" ? " | SCAN DRAFT - NOT VALIDATED FOR CUTTING" : "";
      const registration = `0 0 m 12 0 l -6 0 m 6 -6 l S ${(printableWidth * MM_TO_PT).toFixed(3)} 0 m -12 0 l 6 0 m -6 -6 l S 0 ${(printableHeight * MM_TO_PT).toFixed(3)} m 12 0 l -6 -6 m 0 12 l S`;
      pages.push({ content: `q ${tx.toFixed(3)} ${ty.toFixed(3)} ${(printableWidth * MM_TO_PT).toFixed(3)} ${(printableHeight * MM_TO_PT).toFixed(3)} re W n 0.8 w 0.12 0.12 0.12 RG 1 0 0 1 ${tx.toFixed(3)} ${ty.toFixed(3)} cm ${cutPath} S ${notchPaths} 0.35 w [4 3] 0 d 0.35 0.45 0.4 RG ${allowancePath} S [] 0 d 0.4 w 0.55 0.55 0.55 RG ${registration} Q BT /F1 8 Tf 28 18 Td (${title}) Tj 0 -10 Td (${label}${draftWarning}) Tj ET` });
    }
  });
  return buildPdf(pages.length ? pages : [{ content: "BT /F1 12 Tf 40 780 Td (No pattern pieces to export) Tj ET" }]);
}
