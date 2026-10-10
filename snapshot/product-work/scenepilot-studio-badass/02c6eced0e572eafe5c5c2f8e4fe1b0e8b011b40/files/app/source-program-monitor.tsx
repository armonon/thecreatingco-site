"use client";

/* eslint-disable @next/next/no-img-element -- Source media is backed by local blob URLs. */

import { Circle, Film, Grid2X2, Music2, Pause, Play, WandSparkles } from "lucide-react";
import { memo, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { PreviewQuality } from "../lib/preview-performance";
import { ShellDisclosure } from "./shell-disclosure";

type SourceAsset = {
  name: string;
  url: string;
  proxyUrl?: string;
  kind: "image" | "video" | "audio";
};

export type MulticamMonitorAngle = {
  id: string;
  name: string;
  url: string;
  proxyUrl?: string;
  duration: number;
};

const EMPTY_MULTICAM_ANGLES: MulticamMonitorAngle[] = [];

type Props = {
  mode: "source" | "program" | "multicam";
  sourceAsset: SourceAsset | null;
  sourceVideoRef: RefObject<HTMLMediaElement | null>;
  sourceTime: number;
  sourceDuration: number;
  sourceIn: number;
  sourceOut: number;
  previewQuality: PreviewQuality;
  previewPerformance: { quality: string; averageFrameMs: number; activeDecoders: number };
  program: ReactNode;
  matchHistory?: Array<{ id: string; label: string; time: number }>;
  multicamAngles?: MulticamMonitorAngle[];
  programTime?: number;
  programDuration?: number;
  programPlaying?: boolean;
  activeAngleId?: string;
  onModeChange(mode: "source" | "program" | "multicam"): void;
  onSourceTimeChange(time: number): void;
  onSeekSource(time: number): void;
  onMarkIn(): void;
  onMarkOut(): void;
  onPreviewQualityChange(quality: PreviewQuality): void;
  onEdit(mode: "insert" | "overwrite"): void;
  onRestoreMatch?(id: string): void;
  onMulticamSwitch?(assetId: string): void;
  onBuildMulticam?(): void;
  onProgramSeek?(time: number): void;
  onToggleProgramPlayback?(): void;
  onToggleSourcePlayback(): void;
};

const formatClock = (seconds: number) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const remaining = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remaining.toFixed(2).padStart(5, "0")}`;
};

export const SourceProgramMonitor = memo(function SourceProgramMonitor(props: Props) {
  const [sourcePlaying, setSourcePlaying] = useState(false);
  const angleVideos = useRef(new Map<string, HTMLVideoElement>());
  const source = props.sourceAsset;
  const angles = props.multicamAngles ?? EMPTY_MULTICAM_ANGLES;
  const monitorTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    const available = (["source", "program", "multicam"] as const).filter((mode) => mode === "program" || (mode === "source" ? Boolean(source) : angles.length >= 2));
    const index = available.indexOf(props.mode);
    const next = event.key === "Home" ? available[0] : event.key === "End" ? available[available.length - 1] : available[(index + (event.key === "ArrowRight" ? 1 : -1) + available.length) % available.length];
    event.preventDefault();
    props.onModeChange(next);
    requestAnimationFrame(() => document.getElementById(`monitor-tab-${next}`)?.focus());
  };

  useEffect(() => {
    if (props.mode !== "multicam") return;
    for (const [id, video] of angleVideos.current) {
      const angle = angles.find((item) => item.id === id);
      const target = Math.min(angle?.duration ?? props.programDuration ?? 0, props.programTime ?? 0);
      if (Number.isFinite(target) && Math.abs(video.currentTime - target) > 0.12) {
        try { video.currentTime = target; } catch { /* metadata is not ready */ }
      }
      if (props.programPlaying) void video.play().catch(() => undefined);
      else video.pause();
    }
  }, [angles, props.mode, props.programDuration, props.programPlaying, props.programTime]);

  return <>
    <div className="monitor-tabs-row">
      <div className="monitor-tabs" role="tablist" aria-label="Editing monitors">
        <button id="monitor-tab-source" role="tab" tabIndex={props.mode === "source" ? 0 : -1} aria-selected={props.mode === "source"} className={props.mode === "source" ? "active" : ""} onKeyDown={monitorTabKey} onClick={() => props.onModeChange("source")} disabled={!source}>SOURCE {source ? `· ${source.name}` : ""}</button>
        <button id="monitor-tab-program" role="tab" tabIndex={props.mode === "program" ? 0 : -1} aria-selected={props.mode === "program"} className={props.mode === "program" ? "active" : ""} onKeyDown={monitorTabKey} onClick={() => props.onModeChange("program")}>PROGRAM</button>
        <button id="monitor-tab-multicam" role="tab" tabIndex={props.mode === "multicam" ? 0 : -1} aria-selected={props.mode === "multicam"} className={props.mode === "multicam" ? "active" : ""} onKeyDown={monitorTabKey} onClick={() => props.onModeChange("multicam")} disabled={angles.length < 2}><Grid2X2 size={11} /> MULTICAM · {angles.length}</button>
      </div>
      {props.mode === "program" && <ShellDisclosure className="preview-settings" label="Preview quality"><div className="preview-performance"><span>{props.previewPerformance.quality.toUpperCase()} · {props.previewPerformance.averageFrameMs.toFixed(1)}MS · {props.previewPerformance.activeDecoders} DEC</span><select aria-label="Preview quality" value={props.previewQuality} onChange={(event) => props.onPreviewQualityChange(event.target.value as PreviewQuality)}><option value="auto">Automatic</option><option value="full">Full quality</option><option value="half">Half resolution</option><option value="quarter">Quarter resolution</option></select></div></ShellDisclosure>}
    </div>
    {props.mode === "source" && source ? <>
      <div className="monitor source-monitor">
        {source.kind === "image"
          ? <img src={source.url} alt={source.name} />
          : source.kind === "video"
            ? <video ref={(node) => { props.sourceVideoRef.current = node; }} src={source.proxyUrl ?? source.url} muted onLoadedMetadata={() => setSourcePlaying(false)} onPlay={() => setSourcePlaying(true)} onPause={() => setSourcePlaying(false)} onEnded={() => setSourcePlaying(false)} onTimeUpdate={(event) => props.onSourceTimeChange(event.currentTarget.currentTime)} />
            : <div className="audio-source-canvas"><audio ref={(node) => { props.sourceVideoRef.current = node; }} src={source.url} onLoadedMetadata={() => setSourcePlaying(false)} onPlay={() => setSourcePlaying(true)} onPause={() => setSourcePlaying(false)} onEnded={() => setSourcePlaying(false)} onTimeUpdate={(event) => props.onSourceTimeChange(event.currentTarget.currentTime)} /><Music2 size={34} /><strong>{source.name}</strong></div>}
        <div className="monitor-badge"><Film size={13} /> SOURCE · {formatClock(props.sourceIn)}—{formatClock(props.sourceOut)}</div>
      </div>
      <div className="source-transport">
        <button onClick={props.onMarkIn}>I · Mark In</button>
        <button className="source-play" aria-label={sourcePlaying ? "Pause source" : "Play source"} onClick={props.onToggleSourcePlayback} disabled={source.kind === "image"}>{sourcePlaying ? <Pause size={15} /> : <Play size={15} />}</button>
        <strong>{formatClock(props.sourceTime)}</strong>
        <input aria-label="Source playhead" type="range" min="0" max={props.sourceDuration} step="0.01" value={props.sourceTime} onChange={(event) => props.onSeekSource(Number(event.target.value))} />
        <button onClick={props.onMarkOut}>O · Mark Out</button>
        <button className="edit-insert" title={source.kind === "audio" ? "Drag audio from Project Media onto an audio track" : "Insert marked source range"} disabled={source.kind === "audio"} onClick={() => props.onEdit("insert")}>, Insert</button>
        <button className="edit-overwrite" disabled={source.kind === "audio"} onClick={() => props.onEdit("overwrite")}>. Overwrite</button>
      </div>
      {props.matchHistory?.length ? <div className="match-frame-history"><span>MATCH FRAME HISTORY</span>{props.matchHistory.map((match) => <button key={match.id} onClick={() => props.onRestoreMatch?.(match.id)}><strong>{match.label}</strong><small>{formatClock(match.time)}</small></button>)}</div> : null}
    </> : props.mode === "multicam" ? <>
      <div className={`multicam-monitor angles-${Math.min(angles.length, 9)}`}>
        {angles.slice(0, 9).map((angle, index) => <button key={angle.id} className={`multicam-angle ${props.activeAngleId === angle.id ? "on-air" : ""}`} onClick={() => props.onMulticamSwitch?.(angle.id)} aria-label={`Switch to angle ${index + 1}: ${angle.name}`}>
          <video ref={(node) => { if (node) angleVideos.current.set(angle.id, node); else angleVideos.current.delete(angle.id); }} src={angle.proxyUrl ?? angle.url} muted playsInline preload="metadata" />
          <span><b>{index + 1}</b><strong>{angle.name}</strong></span>
          {props.activeAngleId === angle.id && <em><Circle size={8} fill="currentColor" /> ON AIR</em>}
        </button>)}
      </div>
      <div className="multicam-transport">
        <button className="source-play" aria-label={props.programPlaying ? "Pause multicam" : "Play multicam"} onClick={props.onToggleProgramPlayback}>{props.programPlaying ? <Pause size={15} /> : <Play size={15} />}</button>
        <strong>{formatClock(props.programTime ?? 0)}</strong>
        <input aria-label="Multicam playhead" type="range" min="0" max={props.programDuration ?? 0} step="0.01" value={props.programTime ?? 0} onChange={(event) => props.onProgramSeek?.(Number(event.target.value))} />
        <span className="multicam-live"><Circle size={8} fill="currentColor" /> LIVE SWITCH · KEYS 1–9</span>
        <button className="multicam-build" onClick={props.onBuildMulticam}><WandSparkles size={13} /> AUTO BUILD</button>
      </div>
    </> : props.program}
  </>;
});
