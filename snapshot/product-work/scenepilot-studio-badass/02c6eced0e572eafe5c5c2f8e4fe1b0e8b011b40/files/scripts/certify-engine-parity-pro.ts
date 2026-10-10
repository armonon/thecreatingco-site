/* eslint-disable @typescript-eslint/no-explicit-any -- a saved document is untyped JSON; each read below mirrors the app's own coercion. */
// Pro side of the engine-parity harness: render a saved `scenepilot-cut` document
// through Pro's real export path (`renderProject`), mapping document → options
// exactly as the app's loader and delivery do. Each mapping names its source so a
// change in the app can be mirrored here.
import { renderProject, type RenderOptions } from "../lib/render-engine";
import { coerceEffectSettings } from "../lib/project-store";
import { readProjectSettings } from "../lib/project-settings";
import { splitUnifiedTimeline, toUnifiedTimeline } from "../lib/video-timeline";
import { PUNCH_PRESETS, SHAKE_PRESETS } from "../lib/motion";
import { GRADE_PRESETS, applyGradeAdjust, isNeutralGrade } from "../lib/grade";
import { applyDisplayTransform, DEFAULT_COLOR_MANAGEMENT, type ColorManagementSettings } from "../lib/color-management";
import { TRANSITION_PRESETS } from "../lib/transitions";
import { DROP_RAMP } from "../lib/speed";
import { beatSecondsFrom } from "../lib/stutter";
import type { BaseCut } from "../lib/sequencer";
import { coerceRenderAnalysis } from "../lib/render-analysis";

type Doc = Record<string, any>;
type Media = Record<string, { name: string; kind: "video" | "audio" | "image"; base64: string }>;

const file = (m: Media[string]) => new File([Uint8Array.from(atob(m.base64), (c) => c.charCodeAt(0))], m.name, { type: m.kind === "audio" ? "audio/wav" : "video/mp4" });

export function renderOptions(doc: Doc, media: Media): RenderOptions {
  const effects = coerceEffectSettings(doc.effects); // page.tsx applyEffects
  const settings = readProjectSettings(doc.settings); // page.tsx applyProjectSettings
  // page.tsx importPlan: canonical videoClips, else the legacy pair.
  const unified = doc.videoClips?.length ? doc.videoClips : toUnifiedTimeline(doc.baseCuts ?? [], doc.placements ?? [], "__base__");
  const { baseCuts, placements } = splitUnifiedTimeline(unified);
  const beats: number[] = doc.beats ?? [];
  const saved = coerceRenderAnalysis(doc.renderAnalysis); // parseCutFile; page.tsx savedRenderAnalysis
  // page.tsx energySections
  const active = (doc.sections ?? []).filter((s: any) => s.enabled !== false).sort((a: any, b: any) => a.start - b.start)
    .map((s: any) => ({ start: s.start, end: s.end, energy: s.energy }));
  const colorManagement: ColorManagementSettings = { ...DEFAULT_COLOR_MANAGEMENT, ...(doc.proState?.colorManagement ?? {}) };
  // page.tsx gradeParams / hasShaderEffect (curves and LUTs are outside this harness)
  const gradeParams = { ...applyDisplayTransform({ ...applyGradeAdjust(GRADE_PRESETS[effects.lookPreset as keyof typeof GRADE_PRESETS], effects.manualGrade), mirror: effects.mirrorMode, streak: effects.streak }, colorManagement), curveLut: undefined, lut3d: undefined };
  const hasShaderEffect = effects.lookPreset !== "none" || effects.mirrorMode > 0 || effects.streak > 0 || !isNeutralGrade(effects.manualGrade);
  // page.tsx dropRampSetting: with no live analysis, the resolved drop saved in the document.
  const dropRamp = effects.dropRampEnabled && saved?.dropRamp && beats.length > 1
    ? { dropTime: doc.proState?.manualDropTime ?? saved.dropRamp.dropTime, beatSeconds: beatSecondsFrom(beats), config: DROP_RAMP } : null;
  const assets = (doc.assets ?? []).filter((a: any) => media[a.id]).map((a: any) => ({ id: a.id, file: file(media[a.id]), kind: a.kind }));
  return {
    mainFile: media.__main__ ? file(media.__main__) : null,
    assets,
    placements,
    tracks: doc.tracks ?? [],
    baseCuts: effects.montageEnabled ? (baseCuts as BaseCut[]) : [],
    // page.tsx renderMotion
    motion: { beats, accents: saved?.accents ?? [], punch: PUNCH_PRESETS[effects.punchPreset], shake: SHAKE_PRESETS[effects.shakePreset], affectOverlays: false, energySections: active.length ? active : undefined },
    grade: hasShaderEffect ? { params: gradeParams, beatDriven: true } : undefined,
    transition: TRANSITION_PRESETS[effects.transitionType as keyof typeof TRANSITION_PRESETS],
    dropRamp,
    titles: doc.titles ?? [],
    duration: doc.duration,
    frameRate: settings.exportFrameRate,
    maxDimension: settings.exportMaxDimension,
    aspect: settings.aspect,
    customSize: settings.customSize,
    hardwareAcceleration: "no-preference", // app/video-delivery.ts
  };
}

export async function render(cases: Array<{ name: string; document: Doc }>, media: Media) {
  const results = [];
  for (const item of cases) {
    console.info(`Pro render: ${item.name}`);
    const blob = await renderProject({ ...renderOptions(item.document, media), onProgress: () => {} });
    if (!blob) throw new Error(`${item.name} returned no output`);
    results.push({ name: item.name, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
  }
  return results;
}
