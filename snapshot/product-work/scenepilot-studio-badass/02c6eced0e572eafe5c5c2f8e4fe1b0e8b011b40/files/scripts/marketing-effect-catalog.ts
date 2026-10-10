import { CLIP_EFFECT_DEFINITIONS, CLIP_EFFECT_RECIPES, clipEffectTypes, createClipEffect, effectsFromRecipe, type ClipEffectRecipe, type ClipVisualEffect } from "../lib/clip-effects.ts";
import { ECHO_PRESETS, type FramePlanOptions } from "../lib/compositor.ts";
import { GRADE_PRESETS } from "../lib/grade.ts";
import { PUNCH_PRESETS, SHAKE_PRESETS } from "../lib/motion.ts";
import { TRANSITION_PRESETS } from "../lib/transitions.ts";
import { STROBE_PRESETS, strobeTimes } from "../lib/strobe.ts";
import { STUTTER_PRESETS } from "../lib/stutter.ts";
import { SPEED_PRESETS } from "../lib/speed.ts";
import { TEXT_ANIMATORS } from "../lib/text-animate.ts";

/** Generated from product registries: additions must acquire a gallery render. */
export type GalleryExample = {
  id: string; label: string; category: string; description: string; keywords: string[];
  effects?: ClipVisualEffect[]; options?: Partial<FramePlanOptions>;
  temporal?: boolean; isolated?: boolean; transition?: boolean;
};
const title = (key: string) => key.replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const beats = Array.from({ length: 17 }, (_, index) => index * .5);
const accents = beats.filter((_, index) => index % 4 === 0);
export function marketingEffectCatalog(): GalleryExample[] {
  const entries: GalleryExample[] = clipEffectTypes().map(type => ({
    id: `fx-${type}`, label: CLIP_EFFECT_DEFINITIONS[type].label,
    category: CLIP_EFFECT_DEFINITIONS[type].category,
    description: CLIP_EFFECT_DEFINITIONS[type].hint,
    keywords: CLIP_EFFECT_DEFINITIONS[type].keywords,
    effects: [{ ...createClipEffect(type, `gallery-${type}`), amount: 1 }],
    isolated: ["glow", "drop-shadow", "neon", "opacity"].includes(type),
  }));
  for (const key of Object.keys(CLIP_EFFECT_RECIPES) as ClipEffectRecipe[]) {
    if (key === "clean") continue;
    entries.push({ id: key, label: CLIP_EFFECT_RECIPES[key].label, category: "looks", description: "An editable stack of ScenePilot effects. Explore the individual ingredients below.", keywords: [key, "recipe", "stack"], effects: effectsFromRecipe(key, () => key) });
  }
  const add = (family: string, key: string, description: string, options: Partial<FramePlanOptions>, temporal = true) => entries.push({ id: `${family}-${key}`, label: title(key), category: family, description, keywords: [family, key], options, temporal, transition: family === "transitions" });
  for (const [key, params] of Object.entries(GRADE_PRESETS)) if (key !== "none") add("grades", key, "Film-grade preset rendered through ScenePilot’s actual WebGL grade pass.", { grade: { params } }, false);
  for (const [key, transition] of Object.entries(TRANSITION_PRESETS)) if (key !== "none") add("transitions", key, "Scrub across a real cut between two differently framed views of the source photograph.", { transition });
  for (const [key, config] of Object.entries(STROBE_PRESETS)) if (key !== "off") add("lights", key, `Synthetic ${config.mode} light · ${config.pattern}. Manually stepped frames; no flashing playback. Drum mode uses a supplied demonstration onset grid, not audio analysis.`, { strobe: { config, times: config.pattern === "onset" ? [0, .23, .5, .82, 1, 1.5] : strobeTimes(beats, accents, config.pattern) } });
  for (const [key, punch] of Object.entries(PUNCH_PRESETS)) if (key !== "off") add("punch", key, "Beat-synced camera punch on a demonstration 120 BPM grid.", { motion: { beats, accents, punch } });
  for (const [key, shake] of Object.entries(SHAKE_PRESETS)) if (key !== "off") add("shake", key, "Beat-driven camera shake on a demonstration 120 BPM grid.", { motion: { beats, accents, punch: PUNCH_PRESETS.off, shake } });
  for (const [key, config] of Object.entries(STUTTER_PRESETS)) if (key !== "off") add("stutter", key, "Source-time remapping applied to a generated moving test card. Scrub to compare its position against the original.", { stutter: { config, beatSeconds: .5 } });
  for (const [key, config] of Object.entries(SPEED_PRESETS)) if (key !== "off") add("speed", key, "Speed ramp applied to a generated moving test card on a 120 BPM grid.", { speed: { config, beatSeconds: .5 } });
  for (const [key, echo] of Object.entries(ECHO_PRESETS)) if (key !== "off") add("echo", key, "Real accumulated frame feedback, rendered sequentially at 30 fps before sampling.", { echo, motion: { beats, accents, punch: PUNCH_PRESETS.off } });
  for (const animator of TEXT_ANIMATORS) if (animator !== "none") add("type", animator, "Per-character typography rendered by the shared compositor. Scrub through the entrance and hold.", { titles: [{ id: "gallery-title", text: "MAKE A SCENE", start: 0, duration: 2.5, y: .5, size: .12, color: "#ffffff", style: "pop", animator }] });
  return entries;
}
