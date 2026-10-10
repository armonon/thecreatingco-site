"use client";

import { AudioWaveform, Gauge, Lock, Plus, SlidersHorizontal, X } from "lucide-react";
import { memo, type InputHTMLAttributes, type ReactNode } from "react";
import { audioBusForTrack, type AudioBus } from "../lib/audio-mixer";
import { formatMeterDb, meterPercent, SILENT_READING, type LiveMeterReading } from "../lib/live-audio-meter";
import type { AudioClip, AudioTrack } from "../lib/pro-editor";

type Props = {
  songSync?: ReactNode;
  tracks: AudioTrack[]; buses: AudioBus[]; clips: AudioClip[]; selectedTrackId: string | null; selectedClip: AudioClip | null;
  masterGain: number; masterMeter: LiveMeterReading; integratedLufs: number; playing: boolean; inputHandlers: InputHTMLAttributes<HTMLInputElement>;
  meterForTrack(id: string): LiveMeterReading; onAddTrack(): void; onRemoveTrack(id: string): void; onSelectTrack(id: string): void;
  onMasterGain(value: number): void; onBusesChange(update: (items: AudioBus[]) => AudioBus[]): void; onTrackChange(id: string, patch: Partial<AudioTrack>): void;
  onUnity(): void; onFades(): void; onDuck(): void;
};

export const AudioMixerSidebar = memo(function AudioMixerSidebar(props: Props) {
  return <div className="workspace-side-dashboard audio-room-sidebar">
    <div className="panel-head"><div><AudioWaveform size={16} /><strong>Audio mixer</strong><span>{props.tracks.length} tracks · live mix</span></div><button className="add-button" onClick={props.onAddTrack}><Plus size={13} /> Track</button></div>
    {props.songSync && <details className="song-sync-disclosure"><summary>Song sync · beats & transitions</summary>{props.songSync}</details>}
    <div className="mixer-master-meter">
      <div><Gauge size={14} /><span><strong>MASTER</strong><small>{props.masterMeter.clipped ? "CLIPPED — LOWER THE MIX" : props.playing ? "LIVE PEAK / RMS" : "READY"}</small></span></div>
      <div className={`master-level ${props.masterMeter.clipped ? "clipped" : ""}`}><i style={{ width: `${meterPercent(props.masterMeter)}%` }} /></div>
      <span>{formatMeterDb(props.masterMeter.db)} · {Number.isFinite(props.integratedLufs) ? `${props.integratedLufs.toFixed(1)} LUFS est.` : "LUFS ready"}</span>
      <label className="master-gain"><span>MASTER</span><input type="range" min="0" max="2" step="0.01" value={props.masterGain} onChange={(event) => props.onMasterGain(Number(event.target.value))} /><strong>{Math.round(props.masterGain * 100)}%</strong></label>
    </div>
    <div className="mixer-bus-list">{props.buses.map((bus) => <section key={bus.id} style={{ borderColor: bus.color }}><header><i style={{ background: bus.color }} /><strong>{bus.name} BUS</strong></header><label><span>LEVEL</span><input type="range" min="0" max="2" step="0.01" value={bus.gain} onChange={(event) => props.onBusesChange((items) => items.map((item) => item.id === bus.id ? { ...item, gain: Number(event.target.value) } : item))} /><b>{Math.round(bus.gain * 100)}%</b></label><footer><button className={bus.solo ? "active" : ""} onClick={() => props.onBusesChange((items) => items.map((item) => item.id === bus.id ? { ...item, solo: !item.solo } : item))}>S</button><button className={bus.muted ? "active danger" : ""} onClick={() => props.onBusesChange((items) => items.map((item) => item.id === bus.id ? { ...item, muted: !item.muted } : item))}>M</button></footer></section>)}</div>
    <div className="mixer-track-list">{props.tracks.map((track) => {
      const clipCount = props.clips.filter((clip) => clip.trackId === track.id).length;
      const trackMeter = track.muted ? SILENT_READING : props.meterForTrack(track.id);
      return <section key={track.id} className={`mixer-strip ${props.selectedTrackId === track.id ? "selected" : ""}`} onClick={() => props.onSelectTrack(track.id)}>
        <header><i style={{ background: track.color }} /><span><strong>{track.name}</strong><small>{clipCount} clip{clipCount === 1 ? "" : "s"}</small></span><button onClick={(event) => { event.stopPropagation(); props.onRemoveTrack(track.id); }} disabled={props.tracks.length <= 1 || track.locked} aria-label={`Remove ${track.name}`}><X size={12} /></button></header>
        <div className={`mixer-meter ${trackMeter.clipped ? "clipped" : ""}`} title={formatMeterDb(trackMeter.db)}><i style={{ width: `${meterPercent(trackMeter)}%` }} /></div>
        <label><span>LEVEL</span><input type="range" {...props.inputHandlers} min="0" max="2" step="0.01" value={track.gain} onChange={(event) => props.onTrackChange(track.id, { gain: Number(event.target.value) })} /><strong>{Math.round(track.gain * 100)}%</strong></label>
        <label><span>PAN</span><input type="range" {...props.inputHandlers} min="-1" max="1" step="0.01" value={track.pan} onChange={(event) => props.onTrackChange(track.id, { pan: Number(event.target.value) })} /><strong>{track.pan === 0 ? "C" : track.pan < 0 ? `L${Math.round(Math.abs(track.pan) * 100)}` : `R${Math.round(track.pan * 100)}`}</strong></label>
        <label><span>BUS</span><select value={audioBusForTrack(track, props.buses)?.id ?? ""} onChange={(event) => props.onTrackChange(track.id, { busId: event.target.value })}>{props.buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.name}</option>)}</select><strong>{audioBusForTrack(track, props.buses)?.name ?? "—"}</strong></label>
        <footer><button className={track.solo ? "active" : ""} onClick={(event) => { event.stopPropagation(); props.onTrackChange(track.id, { solo: !track.solo }); }}>S</button><button className={track.muted ? "active danger" : ""} onClick={(event) => { event.stopPropagation(); props.onTrackChange(track.id, { muted: !track.muted }); }}>M</button><button className={track.locked ? "active" : ""} onClick={(event) => { event.stopPropagation(); props.onTrackChange(track.id, { locked: !track.locked }); }}><Lock size={11} /></button></footer>
      </section>;
    })}</div>
    <div className="workspace-side-section audio-quick-actions">
      <div className="side-section-title"><span>CLIP ASSIST</span><small>{props.selectedClip ? props.selectedClip.name : "select a clip"}</small></div>
      <button disabled={!props.selectedClip} onClick={props.onUnity}><Gauge size={13} /> Set unity</button><button disabled={!props.selectedClip} onClick={props.onFades}><AudioWaveform size={13} /> Smooth fades</button><button disabled={!props.selectedClip} onClick={props.onDuck}><SlidersHorizontal size={13} /> Auto duck others</button>
    </div>
  </div>;
});
