/**
 * Glyph Studio — font compilers.
 *
 * Origin: ported and extended from `app/engine/glyph-font.ts` in
 * armonon/luma-studio (PR #1, commit 96a564b). Two compilers share the
 * geometry in geometry.ts and curve-fit.ts:
 *   - OTF (CFF outlines) through opentype.js (MIT), which accepts quadratic
 *     ("Q") path commands and converts them to cubic Beziers for CFF itself.
 *   - TTF (glyf outlines) through the small writer below, now extended to
 *     emit native on/off-curve quadratic points instead of only straight
 *     segments, and (new) an optional legacy 'kern' table.
 *
 * Kerning note (honest limit): opentype.js can *parse* GPOS and the legacy
 * 'kern' table but does not expose a writer for either when building a CFF
 * (OTF) font — only this file's own TTF writer is under our control. So
 * kerning pairs are exported into the TTF's legacy 'kern' table (format 0);
 * OTF export does not yet carry kerning. That matches the brief's fallback
 * ("legacy kern table" when GPOS isn't available) and is called out in the
 * UI rather than silently dropped.
 */
import { Font, Glyph, Path } from "opentype.js/dist/opentype.mjs";
import { fitQuadraticContour, type CurvedContour, type QuadSegment } from "./curve-fit";
import { contourBounds, drawnGlyphs, glyphContours, type Contour } from "./geometry";
import { postScriptName, type GlyphProject, type GlyphMetrics, type KerningPair } from "./glyph-model";

/** PostScript-style glyph name ("A", "zero", "uni0026") — shared by the font compilers and the SVG sheet. */
export const glyphName = (char: string) => /^[A-Za-z0-9]$/.test(char) ? (/[0-9]/.test(char) ? ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][Number(char)] : char) : `uni${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

function notdefContours(metrics: GlyphMetrics): Contour[] {
  const w = Math.round(metrics.defaultAdvance * 0.8), l = 50, t = metrics.capHeight, s = 40;
  return [[[l, 0], [w, 0], [w, t], [l, t]], [[l + s, s], [l + s, t - s], [w - s, t - s], [w - s, s]]];
}

function spaceAdvance(project: GlyphProject) {
  return project.glyphs[" "]?.advanceWidth ?? Math.round(project.metrics.defaultAdvance * 0.45);
}

/** Drops the final closing segment back to `start` that fitQuadraticContour always produces: callers close the loop themselves. */
export function openSegments(curve: CurvedContour): QuadSegment[] {
  const segs = curve.segments;
  if (!segs.length) return segs;
  const last = segs[segs.length - 1];
  return last.to[0] === curve.start[0] && last.to[1] === curve.start[1] ? segs.slice(0, -1) : segs;
}

export function curvedContours(contours: Contour[], smoothing: number): CurvedContour[] {
  return contours.map(c => fitQuadraticContour(c, smoothing));
}

// ---------------------------------------------------------------------------
// OTF (CFF) via opentype.js
// ---------------------------------------------------------------------------

function toPath(curves: CurvedContour[]): InstanceType<typeof Path> {
  const path = new Path();
  for (const curve of curves) {
    path.moveTo(curve.start[0], curve.start[1]);
    for (const seg of openSegments(curve)) {
      if (seg.type === "line") path.lineTo(seg.to[0], seg.to[1]);
      else path.quadraticCurveTo(seg.control[0], seg.control[1], seg.to[0], seg.to[1]);
    }
    path.close();
  }
  return path;
}

export function buildOtf(project: GlyphProject): ArrayBuffer {
  const chars = drawnGlyphs(project);
  if (!chars.length) throw new Error("Draw at least one glyph before exporting");
  const glyphPath = (contours: Contour[]) => toPath(curvedContours(contours, project.curveSmoothing));
  const glyphs = [
    new Glyph({ name: ".notdef", advanceWidth: project.metrics.defaultAdvance, path: toPath(curvedContours(notdefContours(project.metrics), 0)) }),
    new Glyph({ name: "space", unicode: 32, advanceWidth: spaceAdvance(project), path: new Path() }),
    ...chars.map(char => new Glyph({ name: glyphName(char), unicode: char.codePointAt(0)!, advanceWidth: project.glyphs[char].advanceWidth, path: glyphPath(glyphContours(project.glyphs[char])) })),
  ];
  const font = new Font({
    familyName: project.familyName,
    styleName: project.styleName,
    unitsPerEm: project.metrics.unitsPerEm,
    ascender: project.metrics.ascender,
    descender: project.metrics.descender,
    designer: "Made with Glyph Studio",
    manufacturer: "thecreateco",
    glyphs,
    tables: { os2: { sxHeight: project.metrics.xHeight, sCapHeight: project.metrics.capHeight, fsType: 0 } },
  } as ConstructorParameters<typeof Font>[0]);
  return font.toArrayBuffer();
}

// ---------------------------------------------------------------------------
// TTF (glyf) writer
// ---------------------------------------------------------------------------

class Writer {
  private bytes: number[] = [];
  get length() { return this.bytes.length; }
  u8(v: number) { this.bytes.push(v & 255); return this; }
  u16(v: number) { this.bytes.push((v >> 8) & 255, v & 255); return this; }
  i16(v: number) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v: number) { this.bytes.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; }
  tag(s: string) { for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i)); return this; }
  raw(b: ArrayLike<number>) { for (let i = 0; i < b.length; i++) this.bytes.push(b[i]); return this; }
  pad4() { while (this.bytes.length % 4) this.bytes.push(0); return this; }
  done() { return Uint8Array.from(this.bytes); }
}

function checksum(data: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum = (sum + ((data[i] << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0))) >>> 0;
  return sum;
}

type CurvePoint = { pt: [number, number]; on: boolean };
type TtfGlyph = { name: string; code?: number; advance: number; curves: CurvedContour[] };

/**
 * Flattens a curved contour to TrueType's alternating on/off-curve point list, winding reversed to TrueType's clockwise convention.
 * Points are rounded to whole font units: `glyf` stores integer deltas, and curve fitting produces fractional
 * midpoints — writing those unrounded truncated every delta and the error accumulated around the contour,
 * visibly distorting TTF outlines (found by the SVG-sheet rasterization check, scripts/svg-sheet-check.mjs).
 */
function ttfContourPoints(curve: CurvedContour): CurvePoint[] {
  const r = (p: readonly [number, number]): [number, number] => [Math.round(p[0]), Math.round(p[1])];
  const points: CurvePoint[] = [{ pt: r(curve.start), on: true }];
  for (const seg of openSegments(curve)) {
    if (seg.type === "line") points.push({ pt: r(seg.to), on: true });
    else { points.push({ pt: r(seg.control), on: false }); points.push({ pt: r(seg.to), on: true }); }
  }
  return points.reverse();
}

function encodeGlyf(curves: CurvedContour[]): Uint8Array {
  if (!curves.length) return new Uint8Array(0);
  const contours = curves.map(ttfContourPoints);
  const w = new Writer();
  const bounds = contourBounds(contours.map(c => c.map(p => p.pt)));
  w.i16(contours.length).i16(bounds.xMin).i16(bounds.yMin).i16(bounds.xMax).i16(bounds.yMax);
  let end = -1;
  for (const c of contours) { end += c.length; w.u16(end); }
  w.u16(0); // no instructions
  const points = contours.flat();
  for (const p of points) w.u8(p.on ? 0x01 : 0x00); // on/off-curve flag, 16-bit signed deltas for both axes
  let px = 0; for (const { pt: [x] } of points) { w.i16(x - px); px = x; }
  let py = 0; for (const { pt: [, y] } of points) { w.i16(y - py); py = y; }
  return w.pad4().done();
}

function nameTable(project: GlyphProject) {
  const ps = postScriptName(project), full = `${project.familyName} ${project.styleName}`;
  // Family/style names are validated ASCII; keep the maker credit ASCII too so
  // the Macintosh Roman record cannot turn punctuation into a control byte.
  const records: [number, string][] = [[0, "Made with Glyph Studio - thecreateco"], [1, project.familyName], [2, project.styleName], [3, `${ps};GlyphStudio;1.000`], [4, full], [5, "Version 1.000"], [6, ps]];
  const encoded: { platform: number; encoding: number; language: number; id: number; bytes: number[] }[] = [];
  for (const [id, text] of records) encoded.push({ platform: 1, encoding: 0, language: 0, id, bytes: [...text].map(c => c.charCodeAt(0) & 127) });
  for (const [id, text] of records) {
    const bytes: number[] = [];
    for (const c of text) { const code = c.charCodeAt(0); bytes.push(code >> 8, code & 255); }
    encoded.push({ platform: 3, encoding: 1, language: 0x409, id, bytes });
  }
  const w = new Writer();
  w.u16(0).u16(encoded.length).u16(6 + encoded.length * 12);
  let offset = 0;
  for (const r of encoded) { w.u16(r.platform).u16(r.encoding).u16(r.language).u16(r.id).u16(r.bytes.length).u16(offset); offset += r.bytes.length; }
  for (const r of encoded) w.raw(r.bytes);
  return w.done();
}

function cmapTable(glyphs: TtfGlyph[]) {
  const mapped = glyphs.map((g, id) => ({ code: g.code, id })).filter((g): g is { code: number; id: number } => g.code !== undefined).sort((a, b) => a.code - b.code);
  const segments: { start: number; end: number; delta: number }[] = [];
  for (const { code, id } of mapped) {
    const last = segments[segments.length - 1];
    if (last && code === last.end + 1 && (id - code) === last.delta) last.end = code;
    else segments.push({ start: code, end: code, delta: id - code });
  }
  segments.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const segCount = segments.length, entrySelector = Math.floor(Math.log2(segCount)), searchRange = 2 * 2 ** entrySelector;
  const sub = new Writer();
  sub.u16(4).u16(16 + segCount * 8).u16(0).u16(segCount * 2).u16(searchRange).u16(entrySelector).u16(segCount * 2 - searchRange);
  for (const s of segments) sub.u16(s.end);
  sub.u16(0);
  for (const s of segments) sub.u16(s.start);
  for (const s of segments) sub.u16((s.delta + 65536) % 65536);
  for (let i = 0; i < segCount; i++) sub.u16(0);
  const subtable = sub.done();
  const w = new Writer();
  w.u16(0).u16(2);
  w.u16(0).u16(3).u32(4 + 2 * 8);
  w.u16(3).u16(1).u32(4 + 2 * 8);
  w.raw(subtable);
  return w.done();
}

/** Legacy 'kern' table, format 0: a flat, sorted list of (left glyph, right glyph, value) pairs. */
function kernTable(glyphs: TtfGlyph[], pairs: readonly KerningPair[]): Uint8Array | null {
  const idByCode = new Map<number, number>();
  glyphs.forEach((g, id) => { if (g.code !== undefined) idByCode.set(g.code, id); });
  const resolved = pairs
    .map(p => ({ left: idByCode.get(p.left.codePointAt(0)!), right: idByCode.get(p.right.codePointAt(0)!), value: p.value }))
    .filter((p): p is { left: number; right: number; value: number } => p.left !== undefined && p.right !== undefined && p.value !== 0)
    .sort((a, b) => (a.left - b.left) || (a.right - b.right));
  if (!resolved.length) return null;
  const nPairs = resolved.length, entrySelector = Math.floor(Math.log2(nPairs)), searchRange = 2 ** entrySelector * 6;
  const sub = new Writer();
  sub.u16(0).u16(0 /* length placeholder */).u16(0x0001).u16(nPairs).u16(searchRange).u16(entrySelector).u16(nPairs * 6 - searchRange);
  for (const p of resolved) sub.u16(p.left).u16(p.right).i16(p.value);
  const subBytes = sub.done();
  new DataView(subBytes.buffer).setUint16(2, subBytes.length);
  const w = new Writer();
  w.u16(0).u16(1).raw(subBytes);
  return w.done();
}

export function buildTtf(project: GlyphProject, created = new Date()): ArrayBuffer {
  const chars = drawnGlyphs(project);
  if (!chars.length) throw new Error("Draw at least one glyph before exporting");
  const m = project.metrics;
  const glyphs: TtfGlyph[] = [
    { name: ".notdef", advance: m.defaultAdvance, curves: curvedContours(notdefContours(m), 0) },
    { name: "space", code: 32, advance: spaceAdvance(project), curves: [] },
    ...chars.map(char => ({ name: glyphName(char), code: char.codePointAt(0)!, advance: project.glyphs[char].advanceWidth, curves: curvedContours(glyphContours(project.glyphs[char]), project.curveSmoothing) })),
  ];
  const glyfParts = glyphs.map(g => encodeGlyf(g.curves));
  const loca = new Writer(); let offset = 0;
  for (const part of glyfParts) { loca.u32(offset); offset += part.length; }
  loca.u32(offset);
  const glyf = new Writer(); for (const part of glyfParts) glyf.raw(part);

  const flatBounds = glyphs.map(g => contourBounds(g.curves.map(c => ttfContourPoints(c).map(p => p.pt))));
  const drawn = flatBounds.filter((_, i) => glyphs[i].curves.length);
  const xMin = Math.min(...drawn.map(b => b.xMin)), yMin = Math.min(...drawn.map(b => b.yMin));
  const xMax = Math.max(...drawn.map(b => b.xMax)), yMax = Math.max(...drawn.map(b => b.yMax));
  const advanceMax = Math.max(...glyphs.map(g => g.advance));
  const lsbs = glyphs.map((g, i) => g.curves.length ? flatBounds[i].xMin : 0);
  const rsbs = glyphs.map((g, i) => g.curves.length ? g.advance - flatBounds[i].xMax : 0).filter((_, i) => glyphs[i].curves.length);
  const maxPoints = Math.max(...glyphs.map(g => g.curves.reduce((n, c) => n + ttfContourPoints(c).length, 0)));
  const maxContours = Math.max(...glyphs.map(g => g.curves.length));

  const longDate = (date: Date) => { const s = Math.floor(date.getTime() / 1000) + 2082844800; return [Math.floor(s / 2 ** 32), s >>> 0] as const; };
  const [hi, lo] = longDate(created);
  const head = new Writer().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(m.unitsPerEm)
    .u32(hi).u32(lo).u32(hi).u32(lo).i16(xMin).i16(yMin).i16(xMax).i16(yMax).u16(0).u16(8).i16(2).i16(1).i16(0).done();
  const hhea = new Writer().u32(0x00010000).i16(m.ascender).i16(m.descender).i16(0).u16(advanceMax).i16(Math.min(...lsbs.filter((_, i) => glyphs[i].curves.length)))
    .i16(Math.min(...rsbs)).i16(Math.max(...flatBounds.map((b, i) => glyphs[i].curves.length ? lsbs[i] + (b.xMax - b.xMin) : 0))).i16(1).i16(0).i16(0)
    .i16(0).i16(0).i16(0).i16(0).i16(0).u16(glyphs.length).done();
  const maxp = new Writer().u32(0x00010000).u16(glyphs.length).u16(maxPoints).u16(maxContours).u16(0).u16(0).u16(2)
    .u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).done();
  const hmtx = new Writer(); glyphs.forEach((g, i) => hmtx.u16(g.advance).i16(lsbs[i]));
  const codes = glyphs.map(g => g.code).filter((c): c is number => c !== undefined);
  const avg = Math.round(glyphs.slice(1).reduce((n, g) => n + g.advance, 0) / Math.max(1, glyphs.length - 1));
  const os2 = new Writer().u16(4).i16(avg).u16(400).u16(5).u16(0)
    .i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350).i16(50).i16(250)
    .i16(0).raw([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).u32(1).u32(0).u32(0).u32(0).tag("GLYS").u16(0x00c0)
    .u16(Math.min(...codes)).u16(Math.max(...codes)).i16(m.ascender).i16(m.descender).i16(0)
    .u16(Math.max(m.ascender, yMax)).u16(Math.max(-m.descender, -yMin)).u32(1).u32(0)
    .i16(m.xHeight).i16(m.capHeight).u16(0).u16(32).u16(0).done();
  const post = new Writer().u32(0x00030000).u32(0).i16(-100).i16(50).u32(0).u32(0).u32(0).u32(0).u32(0).done();

  const tables: [string, Uint8Array][] = ([
    ["OS/2", os2], ["cmap", cmapTable(glyphs)], ["glyf", glyf.done()], ["head", head], ["hhea", hhea],
    ["hmtx", hmtx.done()], ["loca", loca.done()], ["maxp", maxp], ["name", nameTable(project)], ["post", post],
  ] as [string, Uint8Array][]);
  const kern = kernTable(glyphs, project.kerning);
  if (kern) tables.push(["kern", kern]);
  tables.sort(([a], [b]) => (a < b ? -1 : 1));
  const numTables = tables.length, entrySelector = Math.floor(Math.log2(numTables)), searchRange = 16 * 2 ** entrySelector;
  const out = new Writer();
  out.u32(0x00010000).u16(numTables).u16(searchRange).u16(entrySelector).u16(numTables * 16 - searchRange);
  let at = 12 + numTables * 16;
  const placed = tables.map(([tag, data]) => { const record = { tag, data, offset: at }; at += Math.ceil(data.length / 4) * 4; return record; });
  for (const { tag, data, offset: o } of placed) out.tag(tag).u32(checksum(data)).u32(o).u32(data.length);
  for (const { data } of placed) out.raw(data).pad4();
  const bytes = out.done();
  const headOffset = placed.find(t => t.tag === "head")!.offset;
  const adjust = (0xb1b0afba - checksum(bytes)) >>> 0;
  new DataView(bytes.buffer).setUint32(headOffset + 8, adjust);
  return bytes.buffer;
}

export function fontFileName(project: GlyphProject, format: "otf" | "ttf") {
  return `${postScriptName(project)}.${format}`;
}
