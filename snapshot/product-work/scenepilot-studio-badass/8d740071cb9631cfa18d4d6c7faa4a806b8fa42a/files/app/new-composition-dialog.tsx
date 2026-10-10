"use client";
import { useEffect, useRef, useState } from "react";
import { Box, X } from "lucide-react";
import { validateCompositionSettings, type CompositionSettings } from "../lib/composition-creation";

export function NewCompositionDialog({ initial, frameRate, sourceName, onClose, onCreate }: {
  initial: CompositionSettings; frameRate: number; sourceName?: string; onClose(): void; onCreate(settings: CompositionSettings): void;
}) {
  const [settings, setSettings] = useState(initial);
  const ref = useRef<HTMLFormElement>(null);
  const error = validateCompositionSettings(settings);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; return () => previous?.focus(); }, []);
  return <div className="np-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form ref={ref} className="np-modal new-composition-dialog" role="dialog" aria-modal="true" aria-labelledby="new-composition-title" data-editor-shortcuts="local"
      onSubmit={(event) => { event.preventDefault(); if (!error) onCreate(settings); }} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key !== "Tab") return;
        const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? [])];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <header className="np-head"><div><span className="np-kicker"><Box size={14} /> NEW COMPOSITION</span><h2 id="new-composition-title">Composition settings</h2><p>{sourceName ? `${sourceName} will become the first layer.` : "Start with project settings, or make a custom canvas."}</p></div><button type="button" className="np-close" aria-label="Close composition settings" onClick={onClose}><X size={16} /></button></header>
      <label className="np-name"><span>NAME</span><input autoFocus value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} /></label>
      <div className="composition-settings-grid">
        <label>Width (px)<input type="number" min="16" max="7680" step="2" value={settings.width} onChange={(e) => setSettings({ ...settings, width: Number(e.target.value) })} /></label>
        <label>Height (px)<input type="number" min="16" max="7680" step="2" value={settings.height} onChange={(e) => setSettings({ ...settings, height: Number(e.target.value) })} /></label>
        <label>Duration (seconds)<input type="number" min="0.05" max="86400" step="any" value={settings.duration} onChange={(e) => setSettings({ ...settings, duration: Number(e.target.value) })} /></label>
        <label>Viewer background<input type="color" value={settings.background} onChange={(e) => setSettings({ ...settings, background: e.target.value })} /></label>
      </div>
      <p className="composition-settings-note">{frameRate} fps · follows the project frame rate. Background is a viewer guide; add a solid layer for an opaque background.</p>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={() => setSettings({ ...initial, name: settings.name })}>Reset to project settings</button><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={Boolean(error)}>Create composition</button></footer>
    </form>
  </div>;
}
