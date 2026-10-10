import { Activity, Flag, Layers3, Link2, Magnet, MousePointer2, Move, Plus, Repeat, Scissors, Search, Settings2, Upload, Video, Volume2, X } from "lucide-react";
import type { TimelineEditMode } from "../lib/timeline-edit";
import type { TimelineRange, TimelineTool } from "../lib/pro-editor";
import type { EditionCapabilities } from "./edition";
import { ShellDisclosure } from "./shell-disclosure";
import { useFullWorkspaceControls, useTimelineVisibility } from "./studio-shell";

type ScopeMode = "luma" | "rgb" | "vectorscope";
type Props = {
  clipTrackCount: number; audioTrackCount: number; snapping: boolean; capabilities: EditionCapabilities; isPro: boolean;
  editMode: TimelineEditMode; tool: TimelineTool; linkedSelection: boolean; canGroup: boolean; canUngroup: boolean; canNest: boolean; hasSelectedClip: boolean;
  range: TimelineRange; currentTime: number; hasRange: boolean; canFitRange: boolean; canCloseGaps: boolean; loopPlayback: boolean;
  showScope: boolean; scopeMode: ScopeMode; zoom: number;
  onEditModeChange: (value: TimelineEditMode) => void; onAddVideoTrack: () => void; onAddAudioTrack: () => void; onBuildMulticam: () => void;
  onToolChange: (value: TimelineTool) => void; onToggleSnapping: () => void; onToggleLinked: () => void; onGroup: () => void; onUngroup: () => void;
  onNest: () => void; onSendToOverlay: () => void; onAddMarker: () => void; onRangeChange: (value: TimelineRange) => void; onExtract: () => void;
  onFitToFill: () => void; onCloseGaps: () => void; onMatchFrame: () => void; onToggleLoop: () => void; onToggleScope: () => void;
  onScopeModeChange: (value: ScopeMode) => void; onZoomChange: (value: number) => void;
};

export function TimelineToolbar(props: Props) {
  const fullControls = useFullWorkspaceControls();
  const visibility = useTimelineVisibility();
  const tools: Array<[TimelineTool, string, string]> = [["select", "V", "Selection"], ["razor", "C", "Razor"], ["rate", "R", "Rate Stretch"], ["slip", "Y", "Slip"], ["slide", "U", "Slide"], ["roll", "N", "Rolling edit"], ["fade", "F", "Fade"], ["hand", "H", "Hand"], ["zoom", "Z", "Zoom"]];
  const primaryTools = new Set<TimelineTool>(["select", "razor", "fade"]);
  const toolButton = ([tool, key, label]: typeof tools[number]) => <button key={tool} className={props.tool === tool ? "active" : ""} aria-label={`${label} tool, shortcut ${key}`} aria-keyshortcuts={key} aria-pressed={props.tool === tool} onClick={() => props.onToolChange(tool)} title={`${label} (${key})`}>{tool === "select" ? <MousePointer2 size={13} /> : tool === "razor" ? <Scissors size={13} /> : tool === "fade" ? <Volume2 size={13} /> : tool === "zoom" ? <Search size={13} /> : <Move size={13} />}<span>{label}</span><small>{key}</small></button>;
  return <div className="timeline-control-deck">
    <div className="timeline-toolbar">
      <div><Settings2 size={15} /><strong>Timeline</strong><span>{props.clipTrackCount} video · {props.audioTrackCount} audio</span></div>
      <div className="timeline-legend">
        <ShellDisclosure label={<><Plus size={14} /> Add track</>} closeOnAction>
          <button onClick={() => { visibility.reveal(); props.onAddVideoTrack(); }}><Plus size={14} /> Video track</button>{props.isPro && <><button onClick={() => { visibility.reveal(); props.onAddAudioTrack(); }}><Volume2 size={14} /> Audio track</button><button onClick={props.onBuildMulticam}><Video size={14} /> Build multicam</button></>}
          <button aria-pressed={visibility.showEmpty} onClick={visibility.toggle}>{visibility.showEmpty ? "Hide unused tracks" : "Show unused tracks"}</button>
        </ShellDisclosure>
        <label className="timeline-zoom-control">Zoom<input aria-label="Timeline zoom" type="range" min="1" max="30" step="0.5" value={props.zoom} onChange={(event) => props.onZoomChange(Number(event.target.value))} /></label>
      </div>
    </div>
    {props.isPro && <div className="pro-tool-row">
      <div className="tool-palette" role="toolbar" aria-label="Professional timeline tools">{tools.filter(([tool]) => primaryTools.has(tool)).map(toolButton)}
        <ShellDisclosure expanded={fullControls} className="advanced-tools" label={primaryTools.has(props.tool) ? "More tools" : tools.find(([tool]) => tool === props.tool)?.[2]} closeOnAction>{tools.filter(([tool]) => !primaryTools.has(tool)).map(toolButton)}</ShellDisclosure>
      </div>
      <div className="timeline-options">
        <ShellDisclosure expanded={fullControls} className="timeline-settings" label="Timeline settings">
        {props.capabilities.timelineEditModes && <label className="timeline-edit-select">Edit mode<select aria-label="Timeline edit mode" value={props.editMode} onChange={(event) => props.onEditModeChange(event.target.value as TimelineEditMode)}><option value="overwrite">Overwrite</option><option value="insert">Insert</option><option value="ripple">Ripple</option></select></label>}
        <button className={props.snapping ? "active" : ""} aria-pressed={props.snapping} onClick={props.onToggleSnapping}><Magnet size={13} /> Snap</button>
        <button className={props.linkedSelection ? "active" : ""} aria-pressed={props.linkedSelection} onClick={props.onToggleLinked}><Link2 size={13} /> Linked</button>
        <ShellDisclosure expanded={!fullControls} className="timeline-range" label={props.hasRange ? "Range set" : "Range & markers"}>
        <button onClick={props.onAddMarker}><Flag size={13} /> Marker</button><button className={props.range.inPoint !== null ? "active" : ""} onClick={() => props.onRangeChange({ ...props.range, inPoint: props.currentTime })}>I · In</button><button className={props.range.outPoint !== null ? "active" : ""} onClick={() => props.onRangeChange({ ...props.range, outPoint: props.currentTime })}>O · Out</button>
        <button onClick={() => props.onRangeChange({ inPoint: null, outPoint: null })}>Clear range</button><button disabled={!props.hasRange} onClick={props.onExtract}>Extract</button><button disabled={!props.canFitRange} onClick={props.onFitToFill} title="Retime the selected clip to fill the marked In/Out range (4-point fit-to-fill)">Fit to fill</button>
        <button className={props.loopPlayback ? "active" : ""} aria-pressed={props.loopPlayback} onClick={props.onToggleLoop} title="Loop playback over the in/out range"><Repeat size={13} /> Loop</button>
        </ShellDisclosure>
        <ShellDisclosure expanded={!fullControls} className="timeline-scopes" label={props.showScope ? "Scopes on" : "Scopes"}>
        <button className={props.showScope ? "active" : ""} onClick={props.onToggleScope} title="Production video scopes"><Activity size={13} /> Scope</button>{props.showScope && <select className="scope-mode" aria-label="Video scope type" value={props.scopeMode} onChange={(event) => props.onScopeModeChange(event.target.value as ScopeMode)}><option value="luma">Luma waveform</option><option value="rgb">RGB parade</option><option value="vectorscope">Vectorscope</option></select>}
        </ShellDisclosure>
        </ShellDisclosure>
        <ShellDisclosure expanded={fullControls} className="timeline-actions" label="Clip actions" closeOnAction>
        <button disabled={!props.canGroup} onClick={props.onGroup}><Link2 size={13} /> Group</button><button disabled={!props.canUngroup} onClick={props.onUngroup}><X size={13} /> Ungroup</button>
        <button disabled={!props.canNest} onClick={props.onNest} title="Nest the selected clips into a reusable composition (lossless)"><Layers3 size={13} /> Nest</button>
        <button disabled={!props.hasSelectedClip} onClick={props.onSendToOverlay} title="Move this clip up to an overlay track, keeping its look"><Upload size={13} /> To overlay</button>
        <button disabled={!props.canCloseGaps} onClick={props.onCloseGaps}>Close gaps</button><button onClick={props.onMatchFrame}>Match frame</button>
        </ShellDisclosure>
      </div>
    </div>}
  </div>;
}
