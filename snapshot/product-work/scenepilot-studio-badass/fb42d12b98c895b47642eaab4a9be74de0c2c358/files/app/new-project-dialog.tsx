import { ArrowRight, Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { ASPECT_HINTS, ASPECT_LABELS, type CustomSize, type OutputAspect } from "../lib/aspect";
import type { EditionCapabilities } from "./edition";

const NEW_PROJECT_ASPECTS: OutputAspect[] = ["9:16", "1:1", "4:5", "16:9", "2.39", "21:9", "source", "custom"];
const ASPECT_PREVIEW: Record<OutputAspect, string> = {
  source: "16 / 10", "16:9": "16 / 9", "9:16": "9 / 16", "1:1": "1 / 1", "4:5": "4 / 5",
  "2.39": "2.39 / 1", "21:9": "21 / 9", custom: "16 / 10",
};

type FrameRate = 24 | 25 | 30 | 50 | 60;

type Props = {
  projectName: string;
  aspect: OutputAspect;
  customSize: CustomSize;
  capabilities: EditionCapabilities;
  frameRate: FrameRate;
  maxDimension: 1920 | 3840;
  dimensions: { width: number; height: number };
  hasMainFile: boolean;
  onClose: () => void;
  onStart: () => void;
  onProjectNameChange: (value: string) => void;
  onAspectChange: (value: OutputAspect) => void;
  onCustomSizeChange: (value: CustomSize) => void;
  onFrameRateChange: (value: FrameRate) => void;
  onMaxDimensionChange: (value: 1920 | 3840) => void;
};

export function NewProjectDialog(props: Props) {
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus();
  }, []);
  return (
    <div className="np-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
      <section ref={modalRef} className="np-modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); props.onClose(); return; }
        if (event.key !== "Tab") return;
        const focusable = [...(modalRef.current?.querySelectorAll<HTMLElement>('summary, button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])].filter((element) => element.getClientRects().length > 0);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <header className="np-head">
          <div>
            <span className="np-kicker"><Sparkles size={13} /> NEW PROJECT</span>
            <h2 id="new-project-title">Set up your video</h2>
            <p>Give your project a name and start creating. You can change the canvas and export settings later.</p>
          </div>
          <button className="np-close" onClick={props.onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <label className="np-name">
          <span>PROJECT NAME</span>
          <input value={props.projectName} onChange={(event) => props.onProjectNameChange(event.target.value)} placeholder="My project" onKeyDown={(event) => { if (event.key === "Enter") props.onStart(); }} autoFocus />
        </label>

        <details className="np-settings"><summary>Canvas & export settings <span>{ASPECT_LABELS[props.aspect]} · {props.capabilities.exportProfiles ? props.frameRate : 30} fps</span></summary>
        <div className="np-field">
          <div className="np-field-head"><span>ASPECT RATIO</span><small>{ASPECT_HINTS[props.aspect]}</small></div>
          <div className="np-aspect-grid">
            {NEW_PROJECT_ASPECTS.map((option) => (
              <button key={option} type="button" aria-pressed={props.aspect === option} className={`np-aspect ${props.aspect === option ? "active" : ""}`} onClick={() => props.onAspectChange(option)} title={ASPECT_HINTS[option]}>
                <span className="np-frame"><i style={{ aspectRatio: option === "custom" ? `${props.customSize.width} / ${props.customSize.height}` : ASPECT_PREVIEW[option] }} /></span>
                <strong>{ASPECT_LABELS[option]}</strong>
                <small>{ASPECT_HINTS[option]}</small>
              </button>
            ))}
          </div>
          {props.aspect === "custom" && (
            <div className="np-custom">
              <label><span>WIDTH</span><input type="number" min={16} max={7680} step={2} value={props.customSize.width} onChange={(event) => props.onCustomSizeChange({ ...props.customSize, width: Number(event.target.value) || 0 })} /></label>
              <span className="np-custom-x">×</span>
              <label><span>HEIGHT</span><input type="number" min={16} max={7680} step={2} value={props.customSize.height} onChange={(event) => props.onCustomSizeChange({ ...props.customSize, height: Number(event.target.value) || 0 })} /></label>
              <span className="np-custom-note">px · even, 16–7680</span>
            </div>
          )}
        </div>

        <div className="np-row">
          <div className="np-field">
            <div className="np-field-head"><span>FRAME RATE</span></div>
            {props.capabilities.exportProfiles ? (
              <select aria-label="Project frame rate" value={props.frameRate} onChange={(event) => props.onFrameRateChange(Number(event.target.value) as FrameRate)}>
                <option value="24">24 fps · film</option><option value="25">25 fps · PAL</option><option value="30">30 fps · standard</option><option value="50">50 fps · smooth</option><option value="60">60 fps · high motion</option>
              </select>
            ) : <div className="np-locked">30 fps <small>Pro adds film rates</small></div>}
          </div>
          <div className="np-field">
            <div className="np-field-head"><span>RESOLUTION</span></div>
            {props.capabilities.exportProfiles ? (
              <select aria-label="Project resolution" value={props.maxDimension} onChange={(event) => props.onMaxDimensionChange(Number(event.target.value) as 1920 | 3840)}>
                <option value="1920">1080p · Full HD</option><option value="3840">2160p · 4K UHD</option>
              </select>
            ) : <div className="np-locked">1080p <small>Pro adds 4K</small></div>}
          </div>
        </div>

        </details>
        <footer className="np-foot">
          <div className="np-output"><small>OUTPUT</small><strong>{props.dimensions.width} × {props.dimensions.height}</strong><span>{ASPECT_LABELS[props.aspect]} · {props.capabilities.exportProfiles ? props.frameRate : 30} fps</span></div>
          <button className="np-start" type="button" onClick={props.onStart}>{props.hasMainFile ? "Apply canvas" : "Start editing"} <ArrowRight size={16} /></button>
        </footer>
      </section>
    </div>
  );
}
