"use client";

import { Search, Sparkles, WandSparkles } from "lucide-react";
import { memo, useEffect, useId, useMemo, useState } from "react";
import { CLIP_EFFECT_DEFINITIONS, CLIP_EFFECT_RECIPES, searchClipEffects, type ClipEffectRecipe, type ClipEffectSearchCategory, type ClipEffectType } from "../lib/clip-effects";
import { EffectSamplePreview } from "./effect-sample-preview";
import { createEffectAudition, type EffectAuditionAction, type EffectAuditionTarget } from "../lib/effect-audition";
import { auditionEffect, cancelAudition, compareAudition, useEffectAudition } from "./effect-audition-store";
import type { BaseCut } from "../lib/sequencer";
import type { RenderPlacement } from "../lib/compositor";

type Props = {
  selectedName?: string;
  auditionTarget?: EffectAuditionTarget;
  onApply(type: ClipEffectType): void;
  onApplyRecipe(recipe: ClipEffectRecipe): void;
};

const categories: ClipEffectSearchCategory[] = ["all", "blur", "color", "distort", "generate", "key", "stylize", "utility"];

export function TimelineEffectsBrowser({ base, overlay, overlayName, locked, mediaName, ...callbacks }: {
  base?: BaseCut | null; overlay?: RenderPlacement | null; overlayName?: string; locked: boolean;
  mediaName(id: string): string | undefined;
} & Pick<Props, "onApply" | "onApplyRecipe">) {
  const clip = locked ? undefined : base ?? overlay;
  return <EffectsBrowser {...callbacks} selectedName={clip ? (!base && overlayName) || mediaName(clip.assetId) : undefined}
    auditionTarget={clip?.id ? { kind: base ? "base" : "overlay", id: clip.id, effects: clip.effects } : undefined} />;
}

export const EffectsBrowser = memo(function EffectsBrowser(props: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ClipEffectSearchCategory>("all");
  const [preview, setPreview] = useState<ClipEffectType>("glow");
  const [notice, setNotice] = useState({ target: "", text: "" });
  const owner = useId();
  const snapshot = useEffectAudition();
  const active = snapshot?.owner === owner ? snapshot : null;
  const target = props.auditionTarget;
  const targetKey = `${target?.kind ?? ""}:${target?.compositionId ?? ""}:${target?.id ?? props.selectedName ?? ""}`;
  const setMessage = (text: string) => setNotice({ target: targetKey, text });
  const message = notice.target === targetKey ? notice.text : "";
  useEffect(() => () => cancelAudition(owner), [owner, target?.kind, target?.id, target?.compositionId, target?.effects, target?.effectGraph, props.selectedName]);
  const commit = (action: EffectAuditionAction) => {
    cancelAudition(owner);
    if ("type" in action) props.onApply(action.type); else props.onApplyRecipe(action.recipe);
    setMessage(`Applied to ${props.selectedName ?? "the selected clip"}. Use Undo to restore the previous stack.`);
  };
  const tryEffect = (action: EffectAuditionAction) => {
    if (!target) { commit(action); return; }
    const audition = createEffectAudition(target, action);
    if (!audition) { cancelAudition(owner); setMessage("This graph cannot accept more effects. Remove unused nodes or repair its output first."); return; }
    auditionEffect(owner, audition);
    setMessage("");
  };
  const effects = useMemo(() => searchClipEffects(query, category).map((type) => [type, CLIP_EFFECT_DEFINITIONS[type]] as const), [category, query]);
  return <section className="effects-browser" aria-label="Effects browser">
    <header><div><Sparkles size={15} /><span><strong>Effects</strong><small>{Object.keys(CLIP_EFFECT_DEFINITIONS).length} editable primitives</small></span></div><small>{props.selectedName ? `TARGET · ${props.selectedName}` : "SELECT OR DRAG TO A CLIP"}</small></header>
    <div className="effects-target-state"><strong>{active ? "Preview · not applied" : message.startsWith("Applied") ? "Applied" : target ? "Ready to preview" : "Choose a clip"}</strong><span>{props.selectedName ?? "Select an unlocked video clip or composition layer to try effects."}</span></div>
    <details className="effects-sample-disclosure" open><summary>Sample library · not your footage</summary><EffectSamplePreview type={preview} /></details>
    {active && <div className="effects-audition" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); cancelAudition(owner); } }}>
      <p role="status">{active.original ? "Original · compare" : "Preview · not applied"} · {"type" in active.audition.action ? CLIP_EFFECT_DEFINITIONS[active.audition.action.type].label : CLIP_EFFECT_RECIPES[active.audition.action.recipe].label} on {props.selectedName}. Scrub to a frame where this clip is visible.</p>
      <div><button aria-pressed={active.original} onClick={() => compareAudition(owner)}>Compare original</button><button onClick={() => commit(active.audition.action)}>Apply effect</button><button onClick={() => cancelAudition(owner)}>Cancel preview</button></div>
      <small>Preview only. Save and export use the applied effects.</small>
    </div>}
    {target && !active && <p className="effects-audition-hint">Click an effect to audition it on your footage. Apply to keep it.</p>}
    {message && <p role="status">{message}</p>}
    <label className="effects-search"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search effects" aria-label="Search effects" /></label>
    <div className="effects-categories" role="group" aria-label="Effect categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="effects-recipes"><span><WandSparkles size={12} /> STACKS</span>{(Object.keys(CLIP_EFFECT_RECIPES) as ClipEffectRecipe[]).filter((recipe) => recipe !== "clean").map((recipe) => <button key={recipe} disabled={!props.selectedName} onClick={() => tryEffect({ recipe })}>{CLIP_EFFECT_RECIPES[recipe].label}</button>)}</div>
    <div className="effects-browser-grid">
      {effects.map(([type, effect]) => <article key={type} tabIndex={0} aria-label={`Preview ${effect.label}`} onFocus={() => setPreview(type)} onMouseEnter={() => setPreview(type)} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-scenepilot", `effect:${type}`); }}>
        <button disabled={!props.selectedName} onClick={() => tryEffect({ type })} title={props.selectedName ? `${target ? "Preview" : "Apply"} ${effect.label} on ${props.selectedName}` : `Drag ${effect.label} onto a timeline clip`}>
          <i className={`effect-preview effect-${effect.category}`}><b /><b /><b /></i>
          <span><strong>{effect.label}</strong><small>{effect.hint}</small></span>
          <em>{effect.processing === "pixel" ? "PIXEL" : "LIVE"}</em>
        </button>
      </article>)}
      {!effects.length && <div className="effects-no-results"><Search size={18} /><strong>No matching effects</strong><span>Try another name or category.</span></div>}
    </div>
    <footer>Focus or hover for a sample. Click to {target ? "audition on the selected footage, then Apply or Cancel" : "apply to the selected clip"}. Dragging onto a video clip applies immediately. Preview and export share the same frame model.</footer>
  </section>;
});
