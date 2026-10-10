import { ArrowDown, ArrowUp, Circle, Diamond, Eye, EyeOff, Film, Lock, Music2, Plus, Trash2, Type, Unlock, Volume2, VolumeX } from "lucide-react";
import { useState, type DragEvent } from "react";
import { compositionLayerLocked, compositionLayerRate, compositionRulerTicks, layerToCompositionTime } from "../lib/composition-editing";
import type { CompositionLayer, CompositionTrack, StudioComposition } from "../lib/compositor";
import type { TransformKeyframe } from "../lib/keyframes";
import type { TransformGraphProperty } from "../lib/value-graph";
import { normalizeComposition } from "../lib/composition-tracks";
import { CompositionGraphEditor } from "./composition-graph-editor";
import { TimelinePlayhead } from "./timeline-playhead";
import { useTimelineScrub } from "./use-timeline-scrub";

type Props = {
  composition: StudioComposition | undefined;
  selectedLayer: CompositionLayer | undefined;
  selectedTrackId: string;
  selectedKeyframeId: string | null;
  time: number;
  frameRate: number;
  onScrubStart: () => void;
  onAddTrack: (kind: CompositionTrack["kind"]) => void;
  onRemoveTrack: (trackId: string) => void;
  onMoveTrack: (trackId: string, direction: "up" | "down") => void;
  onMoveTrackTo: (trackId: string, targetTrackId: string) => void;
  onSetTrack: (trackId: string, patch: Partial<CompositionTrack>) => void;
  onSelectTrack: (trackId: string) => void;
  onDropAsset: (event: DragEvent<HTMLDivElement>, trackId: string) => void;
  onAddKeyframe: () => void;
  onSelectLayer: (layerId: string) => void;
  onSetLayerFlags: (layerId: string, patch: Pick<CompositionLayer, "enabled"> | Pick<CompositionLayer, "locked">) => void;
  onSeek: (time: number) => void;
  onSelectKeyframe: (layerId: string, keyframeId: string, time: number) => void;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  onCheckpoint: () => void;
  onUpdateKeyframeValue: (keyframeId: string, patch: Partial<Pick<TransformKeyframe, TransformGraphProperty | "time">>) => void;
};

const layerIcon = (layer: CompositionLayer) => layer.kind === "text" ? <Type size={12} /> : layer.kind === "media" || layer.kind === "composition" ? <Film size={12} /> : <Circle size={12} />;

export function CompositionTimeline(props: Props) {
  const [showGraph, setShowGraph] = useState(false);
  const [zoom, setZoom] = useState(1);
  const composition = props.composition ? normalizeComposition(props.composition) : undefined;
  const duration = composition?.duration ?? 1;
  const scrub = useTimelineScrub({ duration, frameRate: props.frameRate, onSeek: props.onSeek, onStart: props.onScrubStart,
    bounds: (target) => target.closest(".comp-timeline-body")?.querySelector(".comp-ruler-scrub")?.getBoundingClientRect(),
  });
  const tracks = [...(composition?.tracks ?? [])].reverse(); // UI: top track first.
  const videoSolo = tracks.some((track) => track.kind === "video" && track.solo);
  const audioSolo = tracks.some((track) => track.kind === "audio" && track.solo);
  return <section className="composition-timeline">
    <div className="timeline-toolbar comp-track-toolbar">
      <div><Diamond size={15} /><strong>{composition?.name}</strong><span>top track composites over tracks below</span></div>
      <div className="timeline-legend">
        <button className="track-add-button" onClick={() => props.onAddTrack("video")}><Plus size={12} /> Video track</button>
        <button className="track-add-button audio" onClick={() => props.onAddTrack("audio")}><Plus size={12} /> Audio track</button>
        <button className="track-add-button" disabled={!props.selectedLayer || compositionLayerLocked(composition, props.selectedLayer)} onClick={props.onAddKeyframe}><Diamond size={12} /> Keyframe</button>
        <button className="track-add-button" aria-pressed={showGraph} onClick={() => setShowGraph(value => !value)}>Graph editor</button>
        <label className="comp-timeline-zoom">Zoom<select aria-label="Composition timeline zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[1, 2, 4, 8, 16].map(value => <option key={value} value={value}>{value === 1 ? "Fit" : `${value}×`}</option>)}</select></label>
      </div>
    </div>
    <div className="comp-timeline-scroll"><div className="comp-timeline-body" style={{ width: `${zoom * 100}%` }}>
      <div className="comp-time-ruler"><div>TRACK STACK · TOP FIRST</div><div className="comp-ruler-scrub" title="Click or drag to scrub" {...scrub}>{compositionRulerTicks(duration, 10 * zoom).map(time => <span key={time} style={{ left: `${time / duration * 100}%` }}>{time}s</span>)}</div></div>
      {tracks.map((track, displayIndex) => {
        const layers = (composition?.layers ?? []).filter((layer) => layer.trackId === track.id);
        const silenced = !track.enabled || (track.kind === "video" ? videoSolo && !track.solo : track.muted || audioSolo && !track.solo);
        return <div tabIndex={0} data-context-kind="comp-track" data-context-id={track.id} className={`comp-layer-row comp-track-row ${props.selectedTrackId === track.id ? "selected" : ""} ${silenced ? "silenced" : ""}`} key={track.id}>
          <div className={`comp-layer-meta ${track.locked ? "locked" : ""}`} draggable={!track.locked}
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-scenepilot", `composition-track:${track.id}`); }}
            onDragOver={(event) => { if (event.dataTransfer.types.includes("application/x-scenepilot")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
            onDrop={(event) => { const payload = event.dataTransfer.getData("application/x-scenepilot") || event.dataTransfer.getData("text/plain"); if (!payload.startsWith("composition-track:")) return; event.preventDefault(); event.stopPropagation(); props.onMoveTrackTo(payload.slice("composition-track:".length), track.id); }}>
            <button className="comp-layer-select comp-track-select" onClick={() => props.onSelectTrack(track.id)}>
              <span>{track.kind === "audio" ? <Music2 size={13} /> : <Film size={13} />}</span><strong>{track.name}</strong><small>{track.kind} · {layers.length} clip{layers.length === 1 ? "" : "s"}</small>
            </button>
            <div className="layer-switches comp-track-switches">
              <button className={track.enabled && !track.muted ? "active" : ""} title={track.kind === "audio" ? "Mute track" : "Hide track"} onClick={() => props.onSetTrack(track.id, track.kind === "audio" ? { muted: !track.muted } : { enabled: !track.enabled })}>{track.kind === "audio" ? track.muted ? <VolumeX size={10} /> : <Volume2 size={10} /> : track.enabled ? <Eye size={10} /> : <EyeOff size={10} />}</button>
              <button className={track.solo ? "active solo" : ""} title="Solo track" onClick={() => props.onSetTrack(track.id, { solo: !track.solo })}>S</button>
              <button className={track.locked ? "active" : ""} title="Lock track" onClick={() => props.onSetTrack(track.id, { locked: !track.locked })}>{track.locked ? <Lock size={10} /> : <Unlock size={10} />}</button>
            </div>
          </div>
          <div className={`comp-layer-track comp-track-content ${track.kind}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => props.onDropAsset(event, track.id)} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); props.onSeek(((event.clientX - bounds.left) / bounds.width) * duration); props.onSelectTrack(track.id); }}>
            {layers.map((layer, index) => <button data-context-kind="layer" data-context-id={layer.id} key={layer.id} draggable={!layer.locked && !track.locked} className={`comp-track-clip ${props.selectedLayer?.id === layer.id ? "selected" : ""} ${layer.enabled ? "" : "disabled"}`} style={{ left: `${(layer.start ?? 0) / Math.max(.01, duration) * 100}%`, width: `${Math.max(.3, (layer.duration ?? duration) / Math.max(.01, duration) * 100)}%`, top: `${5 + index % 2 * 17}px` }} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-scenepilot", `composition-layer:${layer.id}`); }} onClick={(event) => { event.stopPropagation(); props.onSelectTrack(track.id); props.onSelectLayer(layer.id); }} title={`${layer.name} · ${layer.start ?? 0}s`}>
              {layerIcon(layer)}<span>{layer.name}</span>
              {layer.keyframes.filter(keyframe => { const time = layerToCompositionTime(layer, keyframe.time); return time >= (layer.start ?? 0) && time <= (layer.start ?? 0) + (layer.duration ?? duration); }).map((keyframe) => <Diamond key={keyframe.id} className={`timeline-keyframe ${keyframe.id === props.selectedKeyframeId ? "selected" : ""}`} size={10} fill="currentColor" style={{ left: `${((keyframe.time - (layer.sourceStart ?? 0)) / compositionLayerRate(layer) / Math.max(.01, layer.duration ?? duration)) * 100}%` }} onClick={(event) => { event.stopPropagation(); props.onSelectKeyframe(layer.id, keyframe.id, keyframe.time); }} />)}
            </button>)}
            {!layers.length && <span className="comp-track-drop-hint">Drop {track.kind === "audio" ? "audio or video" : "video or image"} here</span>}
          </div>
          <div className="comp-track-order" aria-label={`${track.name} order controls`}>
            <button type="button" disabled={displayIndex === 0} onClick={(event) => { event.stopPropagation(); props.onMoveTrack(track.id, "up"); }} title="Move track up" aria-label={`Move ${track.name} up`}><ArrowUp size={11} /></button>
            <button type="button" disabled={displayIndex === tracks.length - 1} onClick={(event) => { event.stopPropagation(); props.onMoveTrack(track.id, "down"); }} title="Move track down" aria-label={`Move ${track.name} down`}><ArrowDown size={11} /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); props.onRemoveTrack(track.id); }} title="Remove track and its clips" aria-label={`Remove ${track.name} track and clips`}><Trash2 size={11} /></button>
          </div>
        </div>;
      })}
      {!tracks.length && <div className="empty-layer-inspector">Create a video or audio track to begin.</div>}
      {showGraph && (props.selectedLayer ? <CompositionGraphEditor layer={props.selectedLayer} locked={compositionLayerLocked(composition, props.selectedLayer)} frameRate={props.frameRate} duration={duration} selectedKeyframeId={props.selectedKeyframeId} onBeginEdit={props.onBeginEdit} onEndEdit={props.onEndEdit} onCheckpoint={props.onCheckpoint} onSelect={(keyframeId, time) => props.onSelectKeyframe(props.selectedLayer!.id, keyframeId, time)} onValue={props.onUpdateKeyframeValue} /> : <p>Select a layer to view its animation graph.</p>)}
      <TimelinePlayhead className="comp-playhead" label="Composition playhead" time={props.time} duration={duration} frameRate={props.frameRate} text={`${props.time.toFixed(2)}s`} scrub={scrub} onSeek={props.onSeek} onStart={props.onScrubStart} />
    </div></div>
  </section>;
}
