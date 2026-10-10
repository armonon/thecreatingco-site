import { Download, Pause, Play } from "lucide-react";
import type { PointerEventHandler } from "react";
import type { RotoMode } from "./roto-subject-panel";

export function CompositionTransport({ playing, rendering, time, duration, frameRate, pro, onToggle, onSeek, onExport }: {
  playing: boolean; rendering: boolean; time: number; duration: number; frameRate: number; pro: boolean;
  onToggle(): void; onSeek(time: number): void; onExport(): void;
}) {
  return <div className="composition-transport">
    <button className={`play-button ${playing ? "is-playing" : ""}`} onClick={onToggle} aria-label={playing ? "Pause composition" : "Play composition"}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
    <strong>{time.toFixed(2)}s</strong>
    <input aria-label="Composition playhead" type="range" min="0" max={duration} step={1 / frameRate} value={time} onChange={(event) => onSeek(Number(event.target.value))} />
    <span>{duration.toFixed(2)}s · {frameRate} FPS</span>
    {pro && <button className="alpha-render-button" onClick={onExport} disabled={rendering}><Download size={13} /> Alpha WebM</button>}
  </div>;
}

export function RotoSelectionSurface({ mode, size, strength, points, onStart, onMove, onFinish, onCancel }: {
  mode: RotoMode; size: number; strength: number; points: { x: number; y: number }[];
  onStart: PointerEventHandler<HTMLButtonElement>; onMove: PointerEventHandler<HTMLButtonElement>;
  onFinish: PointerEventHandler<HTMLButtonElement>; onCancel: PointerEventHandler<HTMLButtonElement>;
}) {
  return <button className={`roto-selection-surface mode-${mode}`} onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onFinish} onPointerCancel={onCancel} aria-label={`${mode} subject mask brush`}>
    <span>{mode === "select" ? "CLICK OR PAINT THE SUBJECT" : mode === "add" ? "PAINT FOREGROUND TO KEEP" : mode === "subtract" ? "PAINT BACKGROUND TO REMOVE" : mode === "hair" ? "PAINT FINE HAIR + EDGE DETAIL" : "PAINT SOLID INTERIOR"}<small>{Math.round(size * 1000)} size · {Math.round(strength * 100)}% · Esc cancels</small></span>
    {points.length > 1 && <svg className="roto-brush-preview" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={points.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} /></svg>}
  </button>;
}
