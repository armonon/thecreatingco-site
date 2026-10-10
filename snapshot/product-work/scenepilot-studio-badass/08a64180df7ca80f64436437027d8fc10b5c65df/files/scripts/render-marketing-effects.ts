import { computeFramePlan, paintFramePlan, type FrameLayer, type FramePlan } from "../lib/compositor.ts";
import { effectPreviewPlan } from "../lib/effect-preview.ts";
import { CLIP_EFFECT_DEFINITIONS } from "../lib/clip-effects.ts";
import { createGradePass, GRADE_PRESETS, type GradeParams } from "../lib/grade.ts";
import { marketingEffectCatalog, type GalleryExample } from "./marketing-effect-catalog.ts";

/** Real editor frame plans, pixel kernels, and grade shader. Never CSS approximations. */
export async function renderGallery(sourceURL: string) {
  const source = new Image(); source.src = sourceURL; await source.decode();
  const width = 960, height = 640;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d")!;
  const graded = document.createElement("canvas"); graded.width = width; graded.height = height;
  const gl = graded.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, alpha: false });
  if (!gl) throw new Error("Real grade previews require WebGL; refusing an approximate render.");
  gl.viewport(0, 0, width, height);
  const gradePass = createGradePass(gl);
  const output = document.createElement("canvas"); output.width = width; output.height = height;
  const out = output.getContext("2d")!;
  const files: Record<string, string> = {};
  const save = (name: string, surface: HTMLCanvasElement, thumb = false) => {
    const small = document.createElement("canvas"); small.width = thumb ? 240 : 640; small.height = thumb ? 160 : 426;
    small.getContext("2d")!.drawImage(surface, 0, 0, small.width, small.height);
    files[name] = (thumb || name.includes("-frame-") ? small : surface).toDataURL("image/jpeg", thumb ? .8 : .86);
    return `assets/effects-gallery/${name}`;
  };
  const sourceFor = (entry: GalleryExample, layer: FrameLayer) => ({ draw: (ctx: Parameters<typeof paintFramePlan>[0], x: number, y: number, w: number, h: number) => {
    if (entry.isolated) ctx.drawImage(source, x + w * .15, y + h * .15, w * .7, h * .7);
    else if (layer.assetId === "detail") ctx.drawImage(source, source.width * .3, source.height * .25, source.width * .55, source.height * .55, x, y, w, h);
    else ctx.drawImage(source, x, y, w, h);
    if (["stutter", "speed", "echo"].includes(entry.category)) {
      // Explicit synthetic motion provides a visible source-time reference.
      ctx.fillStyle = "#d8ff68"; ctx.fillRect(x + w * (.08 + (layer.sourceTime % 4) / 4 * .76), y + h * .72, w * .12, h * .12);
      ctx.font = `bold ${h * .04}px sans-serif`; ctx.fillStyle = "#fff";
      ctx.fillText(`SOURCE ${layer.sourceTime.toFixed(2)} s`, x + w * .06, y + h * .92);
    }
  } });
  const planFor = (entry: GalleryExample, time: number, strength = 100, original = false): FramePlan => {
    if (entry.effects) return { ...effectPreviewPlan(original ? [] : entry.effects.map(effect => ({ ...effect, amount: effect.amount * strength / 100 })), time, width, height), transparent: entry.isolated };
    const options = original ? {} : { ...entry.options };
    if (options.grade) {
      const params = { ...options.grade.params };
      for (const key of Object.keys(params) as (keyof GradeParams)[]) {
        const neutral = GRADE_PRESETS.none[key], value = params[key];
        if (typeof value === "number" && typeof neutral === "number") Object.assign(params, { [key]: neutral + (value - neutral) * strength / 100 });
      }
      options.grade = { params };
    }
    return computeFramePlan({ time, width, height, assets: [{ id: "wide", kind: "image", width, height, duration: 10 }, { id: "detail", kind: "image", width, height, duration: 10 }],
      ...(entry.transition ? { baseCuts: [{ id: "a", assetId: "wide", sectionId: "demo", start: 0, sourceStart: 0, duration: 1 }, { id: "b", assetId: "detail", sectionId: "demo", start: 1, sourceStart: 0, duration: 3 }] } : { mainVideo: { width, height } }), ...options });
  };
  const paint = (entry: GalleryExample, plan: FramePlan) => {
    paintFramePlan(context, plan, width, height, layer => sourceFor(entry, layer));
    if (plan.grade) gradePass.render(canvas, plan.grade, plan.time * 60);
    out.fillStyle = "#211d2b"; out.fillRect(0, 0, width, height);
    if (entry.isolated) for (let y = 0; y < height; y += 32) for (let x = 0; x < width; x += 32) {
      out.fillStyle = ((x + y) / 32) % 2 ? "#292431" : "#211d2b"; out.fillRect(x, y, 32, 32);
    }
    out.drawImage(plan.grade ? graded : canvas, 0, 0);
    return output;
  };
  const plain: GalleryExample = { id: "original", label: "Original", category: "source", description: "", keywords: [], effects: [] };
  save("original.jpg", paint(plain, planFor(plain, 1)));
  const entries = [];
  for (const entry of marketingEffectCatalog()) {
    console.log(`Gallery: ${entry.id}`);
    await new Promise(resolve => setTimeout(resolve, 0));
    const variants: Record<string, string> = {};
    const frames: { time: number; src: string; original: string }[] = [];
    let original = "assets/effects-gallery/original.jpg";
    if (entry.isolated) original = save(`${entry.id}-original.jpg`, paint(entry, planFor(entry, 1, 100, true)));
    if (entry.temporal) {
      // Uniform time spacing: pointer distance now corresponds to elapsed time.
      const start = entry.transition ? .98 : 0;
      const duration = entry.transition ? .36 : entry.category === "lights" ? 1.5
        : ["punch", "shake"].includes(entry.category) ? 1 : 2;
      const times = Array.from({ length: 61 }, (_, index) => start + duration * index / 60);
      // Render originals separately so echo history is never contaminated.
      for (let index = 0; index < times.length; index++) {
        const time = times[index];
        frames.push({ time, original: save(`${entry.id}-original-frame-${index}.jpg`, paint(entry, planFor(entry, time, 100, true))), src: "" });
      }
      context.clearRect(0, 0, width, height);
      if (entry.category === "echo") paint(entry, planFor(entry, 0, 100, true));
      let lastTime = 0;
      for (let index = 0; index < times.length; index++) {
        const time = times[index];
        if (entry.category === "echo") for (let t = lastTime + 1 / 30; t < time - .001; t += 1 / 30) paint(entry, planFor(entry, t));
        frames[index].src = save(`${entry.id}-frame-${index}.jpg`, paint(entry, planFor(entry, time)));
        if (index === 2) save(`${entry.id}-thumb.jpg`, output, true);
        lastTime = time;
      }
      variants[100] = frames[2].src;
    } else for (const strength of [25, 60, 100]) {
      variants[strength] = save(`${entry.id}-${strength}.jpg`, paint(entry, planFor(entry, 1, strength)));
      if (strength === 100) save(`${entry.id}-thumb.jpg`, output, true);
    }
    entries.push({ id: entry.id, label: entry.label, category: entry.category, description: entry.description + (entry.isolated ? " Shown on an isolated photo tile over a checkerboard to reveal the alpha edges." : ""), keywords: entry.keywords, variants, frames, original, thumbnail: `assets/effects-gallery/${entry.id}-thumb.jpg`, effects: (entry.effects ?? []).map(effect => ({ type: effect.type, label: CLIP_EFFECT_DEFINITIONS[effect.type].label, amount: effect.amount, parameters: effect.parameters })) });
  }
  gradePass.dispose();
  return { files, gallery: { width, height, time: 1, original: "assets/effects-gallery/original.jpg", strengths: [25, 60, 100], entries, recipes: entries.filter(entry => entry.category === "looks") } };
}
