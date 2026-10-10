import { ASPECT_LABELS, type OutputAspect } from "./aspect.ts";
import { CURVE_PRESETS } from "./curves.ts";
import type { CubeLut } from "./lut.ts";
import type { RenderFormat } from "./pro-editor.ts";

/** Serializable picture/output settings: JSON must not turn LUT typed arrays
 * into numeric-keyed objects or drop the project's canvas on reopen. */
export type ProjectSettings = {
  aspect: OutputAspect;
  customSize: { width: number; height: number };
  sourceDims: { w: number; h: number };
  exportFrameRate: 24 | 25 | 30 | 50 | 60;
  exportMaxDimension: 1920 | 3840;
  exportFormat: RenderFormat;
  colorCurve: keyof typeof CURVE_PRESETS;
  lut3dSource: { name: string; lut: CubeLut } | null;
  lut3dMix: number;
};
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const dimension = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) && value >= 2 && value <= 16384 ? value : fallback;
export function readProjectSettings(value: unknown): ProjectSettings {
  const v = record(value), custom = record(v.customSize), source = record(v.sourceDims);
  const candidate = record(v.lut3dSource), lut = record(candidate.lut);
  let lut3dSource: ProjectSettings["lut3dSource"] = null;
  if (candidate.name && (lut.dimensions === 1 || lut.dimensions === 3) && Number.isInteger(lut.size) && Number(lut.size) >= 2 && Number(lut.size) <= 256) {
    const table = Array.isArray(lut.table) || lut.table instanceof Float64Array ? Array.from(lut.table as number[]) : [];
    const expected = (lut.dimensions === 3 ? Number(lut.size) ** 3 : Number(lut.size)) * 3;
    const domain = (x: unknown): x is [number, number, number] => Array.isArray(x) && x.length === 3 && x.every((n) => typeof n === "number" && Number.isFinite(n));
    if (table.length === expected && table.every((n) => typeof n === "number" && Number.isFinite(n)) && domain(lut.domainMin) && domain(lut.domainMax)) {
      lut3dSource = { name: String(candidate.name), lut: { title: String(lut.title ?? candidate.name), dimensions: lut.dimensions, size: Number(lut.size), table: Float64Array.from(table), domainMin: lut.domainMin, domainMax: lut.domainMax } };
    }
  }
  return {
    aspect: typeof v.aspect === "string" && Object.hasOwn(ASPECT_LABELS, v.aspect) ? v.aspect as OutputAspect : "source",
    customSize: { width: dimension(custom.width, 1920), height: dimension(custom.height, 1080) },
    sourceDims: { w: dimension(source.w, 1280), h: dimension(source.h, 720) },
    exportFrameRate: [24, 25, 30, 50, 60].includes(Number(v.exportFrameRate)) ? Number(v.exportFrameRate) as ProjectSettings["exportFrameRate"] : 30,
    exportMaxDimension: v.exportMaxDimension === 3840 ? 3840 : 1920,
    exportFormat: ["mp4-h264", "mp4-hevc", "webm-vp9", "webm-vp9-alpha"].includes(String(v.exportFormat)) ? v.exportFormat as RenderFormat : "mp4-h264",
    colorCurve: typeof v.colorCurve === "string" && Object.hasOwn(CURVE_PRESETS, v.colorCurve) ? v.colorCurve as ProjectSettings["colorCurve"] : "none",
    lut3dSource,
    lut3dMix: typeof v.lut3dMix === "number" && Number.isFinite(v.lut3dMix) ? Math.max(0, Math.min(1, v.lut3dMix)) : 1,
  };
}
export function serializeProjectSettings(settings: ProjectSettings) {
  return { ...settings, lut3dSource: settings.lut3dSource ? { ...settings.lut3dSource, lut: { ...settings.lut3dSource.lut, table: Array.from(settings.lut3dSource.lut.table) } } : null };
}
