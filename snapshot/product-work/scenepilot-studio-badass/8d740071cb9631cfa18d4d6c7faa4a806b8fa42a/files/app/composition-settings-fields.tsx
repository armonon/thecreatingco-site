import { useState } from "react";
import { validateCompositionSettings } from "../lib/composition-creation";
import type { StudioComposition } from "../lib/compositor";

/** Commit valid complete numbers; partial typing must never shrink a document. */
export function CompositionSettingsFields({ composition, dimensions, onUpdate }: { composition: StudioComposition; dimensions: boolean; onUpdate(patch: Partial<StudioComposition>): void }) {
  const [draft, setDraft] = useState({ duration: String(composition.duration), width: String(composition.width), height: String(composition.height) });
  const [error, setError] = useState("");
  const commit = (key: keyof typeof draft) => {
    const value = Number(draft[key]);
    const patch = { [key]: value };
    const message = validateCompositionSettings({ ...composition, ...patch });
    if (message) { setError(message); return; }
    setError("");
    if (value !== composition[key]) onUpdate(patch);
  };
  return <div className="comp-settings-fields">
    {(["duration", ...(dimensions ? ["width", "height"] : [])] as Array<keyof typeof draft>).map(key => <label key={key}><span>{key === "duration" ? "Composition duration (seconds)" : key === "width" ? "Composition width" : "Composition height"}</span><input type="number" min={key === "duration" ? .05 : 16} max={key === "duration" ? 86400 : 7680} step={key === "duration" ? .01 : 2} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} onBlur={() => commit(key)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(key); } if (event.key === "Escape") { event.stopPropagation(); setDraft({ ...draft, [key]: String(composition[key]) }); setError(""); } }} /></label>)}
    {error && <p role="alert">{error}</p>}
  </div>;
}
