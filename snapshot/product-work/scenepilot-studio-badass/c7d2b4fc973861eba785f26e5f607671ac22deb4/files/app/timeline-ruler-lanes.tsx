"use client";

import { Activity, Flag, Split } from "lucide-react";
import { Fragment, memo, type PointerEventHandler } from "react";
import type { RhythmRate } from "../lib/analysis-engine";
import type { TimelineMarker, TimelineRange } from "../lib/pro-editor";

type Section = { id: string; name: string; start: number; end: number; color: string; pattern: string; rhythm: RhythmRate };
type Props = {
  duration: number; sections: Section[]; selectedSectionId: string; beats: number[]; allBeats: number[]; markers: TimelineMarker[];
  range: TimelineRange; viewport: { start: number; end: number }; sceneCuts: Array<{ time: number; confidence: number }>;
  onSelectSection(id: string): void; onSeek(time: number): void;
  onPointerDown: PointerEventHandler<HTMLDivElement>; onPointerMove: PointerEventHandler<HTMLDivElement>; onPointerUp: PointerEventHandler<HTMLDivElement>; onPointerCancel: PointerEventHandler<HTMLDivElement>; onLostPointerCapture: PointerEventHandler<HTMLDivElement>;
};
const timeLabel = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export const TimelineRulerLanes = memo(function TimelineRulerLanes(props: Props) {
  return <>
    <div className="section-lane" data-empty={props.sections.length === 0}><div className="track-label"><Split size={15} /><span>SECTIONS</span></div><div className="track-content">{props.sections.map((section) => <button key={section.id} className={`section-block ${section.id === props.selectedSectionId ? "selected" : ""}`} style={{ left: `${section.start / props.duration * 100}%`, width: `${(section.end - section.start) / props.duration * 100}%`, borderColor: section.color, color: section.color }} onClick={() => props.onSelectSection(section.id)}><span>{section.name}</span><small>{section.pattern} · {section.rhythm === "half" ? "½×" : section.rhythm === "double" ? "2×" : "1×"}</small></button>)}</div></div>
    <div className="ruler-lane"><div className="track-label"><Activity size={15} /><span>BEATS</span></div><div className="track-content ruler-scrub" title="Click or drag to scrub" onPointerDown={props.onPointerDown} onPointerMove={props.onPointerMove} onPointerUp={props.onPointerUp} onPointerCancel={props.onPointerCancel} onLostPointerCapture={props.onLostPointerCapture}>
      {props.beats.map((beat) => <i key={beat} className={props.allBeats.indexOf(beat) % 4 === 0 ? "major-beat" : "beat"} style={{ left: `${beat / props.duration * 100}%` }} />)}
      {props.markers.filter((marker) => (marker.duration ? marker.time + marker.duration : marker.time) >= props.viewport.start && marker.time <= props.viewport.end).map((marker) => <Fragment key={marker.id}>{marker.duration ? <span className="timeline-marker-range" style={{ left: `${marker.time / props.duration * 100}%`, width: `${marker.duration / props.duration * 100}%`, background: marker.color }} title={`${marker.label} · ${timeLabel(marker.time)}–${timeLabel(marker.time + marker.duration)}`} /> : null}<button className="timeline-marker" style={{ left: `${marker.time / props.duration * 100}%`, color: marker.color }} title={`${marker.label} · ${timeLabel(marker.time)}${marker.duration ? `–${timeLabel(marker.time + marker.duration)}` : ""}`} onClick={() => props.onSeek(marker.time)}><Flag size={10} fill="currentColor" /></button></Fragment>)}
      {props.range.inPoint !== null && <i className="range-edge in" style={{ left: `${props.range.inPoint / props.duration * 100}%` }} />}{props.range.outPoint !== null && <i className="range-edge out" style={{ left: `${props.range.outPoint / props.duration * 100}%` }} />}
      {props.sceneCuts.filter((cut) => cut.time >= props.viewport.start && cut.time <= props.viewport.end).map((cut, index) => <i key={`scene-${cut.time}-${index}`} className="scene-marker" style={{ left: `${cut.time / props.duration * 100}%`, opacity: .45 + cut.confidence * .55 }} title={`Detected scene cut at ${timeLabel(cut.time)}`} />)}
      {Array.from({ length: Math.floor(props.duration / 15) + 1 }, (_, index) => index * 15).filter((time) => time >= props.viewport.start && time <= props.viewport.end).map((time) => <span className="ruler-time" key={time} style={{ left: `${time / props.duration * 100}%` }}>{timeLabel(time)}</span>)}
    </div></div>
  </>;
});
