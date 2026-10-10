import { renderProject, type RenderOptions } from "../lib/render-engine";
import { MAIN_SOURCE_ID } from "../lib/compositor";
import { nestBaseCuts } from "../lib/nest";
import { TRANSITION_PRESETS } from "../lib/transitions";

export async function certify(source: string) {
  const file = new File([Uint8Array.from(atob(source), (char) => char.charCodeAt(0))], "main.mp4", { type: "video/mp4" });
  const cut = { id: "main-cut", assetId: MAIN_SOURCE_ID, sectionId: "shot", start: 0, duration: 1, sourceStart: 0 };
  const common: RenderOptions = { mainFile: file, assets: [], placements: [], duration: 1, frameRate: 30, aspect: "custom", customSize: { width: 160, height: 90 }, hardwareAcceleration: "prefer-software" };
  const cases: Array<{ name: string; options: Partial<RenderOptions> }> = [
    { name: "continuous", options: {} },
    { name: "main-cut", options: { baseCuts: [cut] } },
    { name: "main-effect", options: { baseCuts: [{ ...cut, effects: [{ id: "mono", type: "monochrome", amount: 1, enabled: true }] }] } },
    { name: "main-crossfade", options: { baseCuts: [{ ...cut, duration: .5 }, { ...cut, id: "second", start: .5, duration: .5, flipH: true }], transition: TRANSITION_PRESETS.dissolve } },
    { name: "clip-first-cut", options: { mainFile: null, assets: [{ id: "bin-video", file, kind: "video" }], baseCuts: [{ ...cut, assetId: "bin-video" }] } },
    { name: "clip-first-overlay", options: {
      mainFile: null, assets: [{ id: "bin-video", file, kind: "video" }],
      placements: [{ assetId: "bin-video", trackId: "overlay", start: 0, duration: 1, scale: 100, opacity: 100 }],
      tracks: [{ id: "overlay", enabled: true, blend: "normal", opacity: 100, hue: 0, saturation: 100, brightness: 100, glow: 0, color: "#fff", fadeIn: 0, fadeOut: 0 }],
    } },
  ];
  // Nesting exercises the same __main__ source through a composition layer.
  const nested = nestBaseCuts([cut], [cut.id], { compositionId: "nested", name: "Nested main", width: 160, height: 90 });
  if (nested) cases.push({ name: "nested-main", options: {
    compositions: [nested.composition],
    placements: [{ assetId: "composition:nested", compositionId: "nested", trackId: "comp", start: 0, duration: 1, scale: 100, opacity: 100 }],
    tracks: [{ id: "comp", enabled: true, blend: "normal", opacity: 100, hue: 0, saturation: 100, brightness: 100, glow: 0, color: "#fff", fadeIn: 0, fadeOut: 0 }],
  } });
  const results = [];
  for (const item of cases) {
    console.info(`Rendering certificate: ${item.name}`);
    const blob = await renderProject({ ...common, ...item.options, onProgress: (_progress, message) => console.info(message) });
    if (!blob) throw new Error(`${item.name} returned no output`);
    results.push({ name: item.name, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
  }
  return results;
}
