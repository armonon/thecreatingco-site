/**
 * Origin: ported from armonon/luma-studio's tests/glyph-font.test.ts (PR #1),
 * adapted to vitest and to this repo's module split (glyph-model / geometry
 * / font-export instead of one glyph-font.ts).
 */
import { describe, expect, test } from "vitest";
import { parse } from "opentype.js/dist/opentype.mjs";
import { autoAdvance, drawnGlyphs, glyphContours, layoutText, signedArea } from "../src/engine/geometry";
import { buildOtf, buildTtf } from "../src/engine/font-export";
import { createGlyphProject, validateFamilyName, validateGlyphProject, GLYPH_CHARSET, type GlyphProject } from "../src/engine/glyph-model";

type TtPoint = { x: number; y: number; onCurve: boolean; lastPointOfContour?: boolean };
const pointsOf = (glyph: unknown) => (glyph as { points: TtPoint[] }).points;

/** A small project: "I" as one brush stroke, "O" as a ring stroke, "D" as a pen shape with a cut-out counter. All straight (curveSmoothing 0) so the compiled geometry matches Luma's original polygon behaviour exactly. */
function sampleProject(): GlyphProject {
  const project = createGlyphProject("Test Hand");
  project.curveSmoothing = 0;
  project.glyphs.I = { advanceWidth: 300, strokes: [{ kind: "brush", points: [[150, 0], [150, 700]], width: 80 }] };
  const ring: [number, number][] = [];
  for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI * 2; ring.push([350 + Math.cos(t) * 250, 350 + Math.sin(t) * 330]); }
  project.glyphs.O = { advanceWidth: 700, strokes: [{ kind: "brush", points: ring, width: 90 }] };
  project.glyphs.D = { advanceWidth: 650, strokes: [
    { kind: "shape", points: [[60, 0], [360, 0], [580, 200], [580, 500], [360, 700], [60, 700]], smooth: false, cut: false },
    { kind: "shape", points: [[160, 100], [330, 100], [480, 260], [480, 440], [330, 600], [160, 600]], smooth: false, cut: true },
  ] };
  return project;
}

describe("glyph geometry (ported from Luma)", () => {
  test("a brush stroke compiles to one outline that covers the stroke with round caps", () => {
    const [contour, ...rest] = glyphContours(sampleProject().glyphs.I);
    expect(rest.length).toBe(0);
    const xs = contour.map(p => p[0]), ys = contour.map(p => p[1]);
    expect(Math.abs(Math.min(...xs) - 110) <= 1 && Math.abs(Math.max(...xs) - 190) <= 1).toBe(true);
    expect(Math.abs(Math.min(...ys) + 40) <= 1 && Math.abs(Math.max(...ys) - 740) <= 1).toBe(true);
    expect(signedArea(contour) > 0).toBe(true);
  });

  test("a closed ring stroke yields an outer contour and an opposite-wound counter", () => {
    const contours = glyphContours(sampleProject().glyphs.O);
    expect(contours.length).toBe(2);
    const areas = contours.map(signedArea).sort((a, b) => b - a);
    expect(areas[0] > 0 && areas[1] < 0).toBe(true);
  });

  test("a stroke that ends exactly where it started stays a loop (simplification regression)", () => {
    const loop: [number, number][] = [[284, 585], [470, 511], [532, 312], [470, 114], [284, 40], [98, 114], [36, 312], [98, 511], [284, 585]];
    const dense = loop.flatMap((p, i) => i ? Array.from({ length: 8 }, (_, k) => [loop[i - 1][0] + (p[0] - loop[i - 1][0]) * (k + 1) / 8, loop[i - 1][1] + (p[1] - loop[i - 1][1]) * (k + 1) / 8] as [number, number]) : [p]);
    const contours = glyphContours({ advanceWidth: 600, strokes: [{ kind: "brush", points: dense, width: 60 }] });
    expect(contours.length).toBe(2);
    const { xMin, xMax } = contours.flat().reduce((b, [x]) => ({ xMin: Math.min(b.xMin, x), xMax: Math.max(b.xMax, x) }), { xMin: Infinity, xMax: -Infinity });
    expect(xMax - xMin > 450).toBe(true);
  });

  test("cut shapes subtract from additive strokes", () => {
    const project = sampleProject();
    const withCut = glyphContours(project.glyphs.D);
    expect(withCut.length).toBe(2);
    const solid = glyphContours({ ...project.glyphs.D, strokes: [project.glyphs.D.strokes[0]] });
    expect(solid.length).toBe(1);
    const total = (cs: typeof solid) => cs.reduce((sum, c) => sum + signedArea(c), 0);
    expect(total(withCut) < total(solid) * 0.6).toBe(true);
  });

  test("pressure strokes (per-point widths) taper rather than using a single width", () => {
    const draft = { advanceWidth: 500, strokes: [{ kind: "brush" as const, points: [[100, 100], [400, 100]] as [number, number][], width: 60, widths: [20, 120] }] };
    const [contour] = glyphContours(draft);
    const near = (x: number) => contour.filter(p => Math.abs(p[0] - x) < 15).map(p => p[1]);
    const span = (ys: number[]) => Math.max(...ys) - Math.min(...ys);
    expect(span(near(120)) < span(near(380))).toBe(true);
  });

  test("OTF export round-trips through opentype.js with the right names, cmap and metrics", () => {
    const project = sampleProject();
    const font = parse(buildOtf(project));
    expect(font.getEnglishName("fontFamily")).toBe("Test Hand");
    expect(font.outlinesFormat).toBe("cff");
    expect(font.unitsPerEm).toBe(1000);
    expect(font.ascender).toBe(800);
    expect(font.descender).toBe(-200);
    const glyph = font.charToGlyph("O");
    expect(glyph.advanceWidth).toBe(700);
    const box = glyph.getBoundingBox();
    expect(Math.abs(box.x1 - 55) <= 2 && Math.abs(box.x2 - 645) <= 2).toBe(true);
    expect(font.charToGlyph("Z").index).toBe(0);
    expect(font.charToGlyph(" ").advanceWidth).toBe(270);
  });

  test("TTF export is a valid glyf font that opentype.js reads back identically", () => {
    const project = sampleProject();
    const bytes = buildTtf(project, new Date("2026-10-05T00:00:00Z"));
    const font = parse(bytes);
    expect(font.outlinesFormat).toBe("truetype");
    expect(font.getEnglishName("fontFamily")).toBe("Test Hand");
    expect(font.getEnglishName("postScriptName")).toBe("TestHand-Regular");
    expect(font.tables.os2.sxHeight).toBe(500);
    expect(font.tables.os2.sCapHeight).toBe(700);
    for (const char of ["I", "O", "D"]) {
      const glyph = font.charToGlyph(char);
      expect(glyph.index).not.toBe(0);
      expect(glyph.advanceWidth).toBe(project.glyphs[char].advanceWidth);
      const contours = glyphContours(project.glyphs[char]);
      const expected = contours.reduce((n, c) => n + c.length, 0);
      expect(pointsOf(glyph).length).toBe(expected);
      expect(pointsOf(glyph).every(p => p.onCurve)).toBe(true);
    }
    const o = font.charToGlyph("O");
    const firstEnd = pointsOf(o).findIndex(p => p.lastPointOfContour);
    const outer = pointsOf(o).slice(0, firstEnd + 1).map(p => [p.x, p.y] as [number, number]);
    expect(Math.abs(signedArea(outer)) > 1000).toBe(true);
    const cff = glyphContours(project.glyphs.O);
    expect(Math.sign(signedArea(outer))).toBe(-Math.sign(signedArea(cff.find(c => c.length === outer.length) ?? cff[0])));
  });

  test("TTF checksums are self-consistent (head checkSumAdjustment makes the file sum to B1B0AFBA)", () => {
    const bytes = new Uint8Array(buildTtf(sampleProject()));
    let sum = 0;
    for (let i = 0; i < bytes.length; i += 4) sum = (sum + ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3])) >>> 0;
    expect(sum).toBe(0xb1b0afba);
    const view = new DataView(bytes.buffer), tables = view.getUint16(4);
    for (let t = 0; t < tables; t++) {
      const at = 12 + t * 16, offset = view.getUint32(at + 8), length = view.getUint32(at + 12);
      expect(offset % 4).toBe(0);
      expect(offset + length <= bytes.length).toBe(true);
    }
  });

  test("TTF metadata round-trips without control characters on Mac and Windows", () => {
    const font = parse(buildTtf(sampleProject()));
    const names = font.names as unknown as Record<string, Record<string, Record<string, string>>>;
    for (const platform of ["macintosh", "windows"]) {
      expect(names[platform].copyright.en).toBe("Made with Glyph Studio - thecreateco");
      for (const translations of Object.values(names[platform])) {
        for (const text of Object.values(translations)) {
          expect([...text].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)).toBe(true);
        }
      }
    }
    expect(names.macintosh).toEqual(names.windows);
  });

  test("TTF shapes in HarfBuzz with the drawn advances", async () => {
    const hb = await import("harfbuzzjs");
    const face = new hb.Face(new hb.Blob(buildTtf(sampleProject())), 0);
    const font = new hb.Font(face);
    const buffer = new hb.Buffer();
    buffer.addText("DIO");
    buffer.guessSegmentProperties();
    hb.shape(font, buffer);
    const glyphs = buffer.getGlyphInfosAndPositions();
    expect(glyphs.map(g => g.xAdvance)).toEqual([650, 300, 700]);
    expect(glyphs.every(g => g.codepoint > 1)).toBe(true);
  });

  test("export refuses an empty project instead of writing a font of blanks", () => {
    expect(() => buildOtf(createGlyphProject("Empty"))).toThrow(/Draw at least one glyph/);
    expect(() => buildTtf(createGlyphProject("Empty"))).toThrow(/Draw at least one glyph/);
  });

  test("project validation rejects hostile or malformed input and drops unknown glyphs", () => {
    expect(() => validateGlyphProject({ schema: "other" })).toThrow(/schema/);
    expect(() => validateGlyphProject({ ...sampleProject(), familyName: "<script>" })).toThrow(/letters/);
    const tooFar = sampleProject(); tooFar.glyphs.I.strokes[0].points[0] = [1e9, 0];
    expect(() => validateGlyphProject(JSON.parse(JSON.stringify(tooFar)))).toThrow(/Invalid glyph point/);
    const extra = JSON.parse(JSON.stringify(sampleProject())); extra.glyphs["\u0000"] = extra.glyphs.I;
    const valid = validateGlyphProject(extra);
    expect(Object.keys(valid.glyphs).sort()).toEqual(["D", "I", "O"]);
    expect(drawnGlyphs(valid)).toEqual(["D", "I", "O"].sort((a, b) => GLYPH_CHARSET.indexOf(a) - GLYPH_CHARSET.indexOf(b)));
  });

  test("family names must be CSS/PostScript safe and must not shadow existing fonts", () => {
    expect(validateFamilyName("  My   Font 2 ")).toBe("My Font 2");
    expect(() => validateFamilyName("serif")).toThrow(/reserved/);
    expect(() => validateFamilyName("Lato", ["Lato"])).toThrow(/already/);
    expect(() => validateFamilyName("x".repeat(40))).toThrow(/31/);
  });

  test("auto advance and preview layout use the drawn outlines", () => {
    const project = sampleProject();
    expect(autoAdvance(project.glyphs.I, 60)).toBe(300);
    const layout = layoutText(project, "IO Z");
    expect(layout.glyphs.map(g => [g.char, g.x, g.missing])).toEqual([["I", 0, false], ["O", 300, false], ["Z", 1270, true]]);
  });
});
