"use client";
import { InspectorSection } from "./inspector-section";
import {
Activity,
AudioWaveform,
Clapperboard,
Diamond,
Eye,
EyeOff,
Film,
Gauge,
Lock,
Music2,
Palette,
Plus,
Scissors,
Settings2,
SlidersHorizontal,
Sparkles,
Split,
Trash2,
Unlock,
Volume2,
VolumeX,
X
} from "lucide-react";
import { lazy,Suspense,type Dispatch,type SetStateAction } from "react";
import type { DirectorPattern } from "../lib/analysis-engine";
import { audioBusForTrack,type AudioBus } from "../lib/audio-mixer";
import { audioPlaybackRate } from "../lib/audio-timing";
import { type ClipEffectRecipe,type ClipEffectType } from "../lib/clip-effects";
import { colorPipelineLabel,type ColorManagementSettings } from "../lib/color-management";
import type { StudioComposition } from "../lib/compositor";
import { MAIN_SOURCE_ID } from "../lib/compositor";
import { type DynamicTrimSelection } from "../lib/dynamic-trim";
import { type PortableEffectRecipe } from "../lib/extension-pack";
import { formatTime,formatTimecode } from "../lib/format";
import { NEUTRAL_GRADE_ADJUST,type GradeAdjust } from "../lib/grade";
import { type Easing,type TransformKeyframe } from "../lib/keyframes";
import {
DEFAULT_AUDIO_EFFECT_RACK,
snapTime,
type AudioClip,
type AudioTrack,
type TimelineTool
} from "../lib/pro-editor";
import { type SplitEditKind } from "../lib/pro-workflows";
import { NEUTRAL_CLIP_COLOR,type BaseCut } from "../lib/sequencer";
import { hasTimeRemap,timeRemapSpeedAt } from "../lib/time-remap";
import { TRANSITION_PRESETS,type TransitionType } from "../lib/transitions";
import { type ClipTrack,type Placement,type SectionRule } from "./editor-foundation";
import type { MediaAsset } from "./media-browser";
const ClipEffectStack = lazy(() => import("./clip-effect-stack").then((module) => ({ default: module.ClipEffectStack })));
export type SequenceInspectorProps = {
  hasTimelineContent: boolean;
  onImportMedia(): void;
  proWorkspace: "color" | "audio" | "edit";
  activePanel: "audio" | "section" | "base" | "clip" | "track";
  setActivePanel: Dispatch<SetStateAction<"audio" | "section" | "base" | "clip" | "track">>;
  selectedBaseCut: BaseCut | null;
  selectedPlacement: Placement | null;
  selectedTrack: ClipTrack;
  isPro: boolean;
  selectedAudioTrack: AudioTrack;
  colorManagement: ColorManagementSettings;
  setColorManagement: Dispatch<SetStateAction<ColorManagementSettings>>;
  lookPreset: string;
  checkpoint: () => void;
  setLookPreset: Dispatch<SetStateAction<string>>;
  setManualGrade: Dispatch<SetStateAction<GradeAdjust>>;
  continuousEditHandlers: { onPointerDown: () => void; onPointerUp: () => void; onPointerCancel: () => void; onKeyDown: () => void; onKeyUp: () => void; onBlur: () => void; };
  manualGrade: GradeAdjust;
  scopeMode: "luma" | "rgb" | "vectorscope";
  setScopeMode: Dispatch<SetStateAction<"luma" | "rgb" | "vectorscope">>;
  setShowScope: Dispatch<SetStateAction<boolean>>;
  selectedSection: SectionRule;
  updateSection: (patch: Partial<SectionRule>) => void;
  splitAtPlayhead: () => void;
  rebuildPlacements: () => void;
  mediaColor: (assetId: string) => string | undefined;
  mediaName: (assetId: string) => string | undefined;
  updateBaseCut: (patch: Partial<BaseCut>) => void;
  mainFile: File | null;
  mainName: string;
  assets: MediaAsset[];
  duration: number;
  selectedBaseAssetDuration: number;
  selectedBaseRate: number;
  selectedBaseMaxRate: number;
  applySelectedSplitEdit: (kind: SplitEditKind) => void;
  splitEditHandles: { lead: number; trail: number; };
  setSplitEditHandles: Dispatch<SetStateAction<{ lead: number; trail: number; }>>;
  applySelectedAsymmetricSplitEdit: () => void;
  dynamicTrimSelection: DynamicTrimSelection | null;
  startDynamicTrim: (edge: "in" | "out", mode: "ripple" | "roll") => void;
  setClipTransform: (patch: Partial<{ x: number; y: number; scale: number; rotation: number; opacity: number; }>) => void;
  clipTransform: { id?: string | undefined; time?: number | undefined; x: number; y: number; scale: number; rotation: number; opacity: number; easing?: Easing; bezier?: import("../lib/keyframes").CubicBezier; spatialOut?: import("../lib/keyframes").SpatialTangent; spatialIn?: import("../lib/keyframes").SpatialTangent; };
  currentTime: number;
  toggleTimeRemap: () => void;
  addTimeRemapPoint: () => void;
  seek: (time: number) => void;
  updateTimeRemapPoint: (id: string, sourceTime: number) => void;
  removeTimeRemapPoint: (id: string) => void;
  autoBalanceSelectedClip: (target: "base" | "overlay") => void;
  sourceAsset: MediaAsset | null;
  replaceSelectedFromSource: () => void;
  customEffectRecipes: PortableEffectRecipe[];
  autoGenerateClipEffects: () => void;
  applyClipEffectRecipe: (recipe: ClipEffectRecipe) => void;
  applyCustomEffectRecipe: (recipe: PortableEffectRecipe) => void;
  saveSelectedClipEffectRecipe: () => void;
  addClipEffect: (type: ClipEffectType) => void;
  updateClipEffect: (id: string, patch: Partial<NonNullable<BaseCut["effects"]>[number]>) => void;
  moveClipEffect: (id: string, direction: -1 | 1) => void;
  addClipEffectKeyframe: (effectId: string) => void;
  updateClipEffectKeyframe: (effectId: string, keyframeId: string, patch: { time?: number; value?: number; easing?: Easing; }) => void;
  removeClipEffectKeyframe: (effectId: string, keyframeId: string) => void;
  selectedBaseCutIndex: number;
  transitionType: TransitionType;
  baseCuts: BaseCut[];
  exportFrameRate: 30 | 24 | 25 | 50 | 60;
  selectedCutTransition: import("../lib/transitions").TransitionConfig;
  applySelectedTransitionToAllCuts: () => void;
  motionDraft: { x: number; y: number; scale: number; rotation: number; opacity: number; };
  setMotionDraft: Dispatch<SetStateAction<{ x: number; y: number; scale: number; rotation: number; opacity: number; }>>;
  addTransformKeyframe: () => void;
  copyTransformKeyframes: () => void;
  hasTransformClipboard: boolean;
  pasteTransformKeyframes: () => void;
  loadTransformKeyframe: (keyframe: { time: number; x: number; y: number; scale: number; rotation: number; opacity: number; }) => void;
  updateTransformKeyframe: (id: string, patch: Partial<Pick<TransformKeyframe, "time" | "easing" | "bezier">>) => void;
  removeTransformKeyframe: (id: string) => void;
  timelineTool: TimelineTool;
  nudgeProfessionalEdit: (direction: -1 | 1, large?: boolean) => void;
  splitSelectedBaseCut: () => void;
  deleteTimelineSelection: (ripple?: boolean, target?: "base" | "overlay" | "audio") => void;
  selectedBaseCutSet: Set<string>;
  selectedPlacementComposition: StudioComposition | null | undefined;
  selectedPlacementAsset: MediaAsset | undefined;
  openComposition: (compositionId: string) => void;
  setClipTracks: Dispatch<SetStateAction<ClipTrack[]>>;
  clipTracks: ClipTrack[];
  setSelectedTrackId: Dispatch<SetStateAction<string>>;
  updatePlacement: (patch: Partial<Placement>) => void;
  selectedPlacementSourceDuration: number;
  selectedPlacementRate: number;
  selectedPlacementMaxRate: number;
  splitSelectedPlacement: (time?: number) => void;
  placements: Placement[];
  updateClipTrack: (patch: Partial<ClipTrack>) => void;
  beginContinuousEdit: () => void;
  endContinuousEdit: () => void;
  moveClipTrack: (direction: "up" | "down") => void;
  removeClipTrack: (trackId: string) => void;
  audioClips: AudioClip[];
  updateAudioTrack: (patch: Partial<AudioTrack>) => void;
  audioBuses: AudioBus[];
  selectedAudioClip: AudioClip | null;
  updateAudioClip: (patch: Partial<AudioClip>) => void;
  snapCandidates: number[];
  snapping: boolean;
  setSelectedAudioClipUnity: () => void;
  applySelectedAudioFade: () => void;
  crossfadeSelectedAudio: () => void;
  duckOtherAudioUnderSelection: () => void;
  addAudioAutomationPoint: () => void;
  selectedAutomationPoint: import("../lib/pro-editor").VolumeKeyframe | null;
  updateAudioAutomationPoint: (patch: Partial<{ time: number; gain: number; }>) => void;
  removeAudioAutomationPoint: () => void;
};

export function SequenceInspector(props: SequenceInspectorProps) {
  const { proWorkspace, activePanel, setActivePanel, selectedBaseCut, selectedPlacement, selectedTrack, isPro, selectedAudioTrack, colorManagement, setColorManagement, lookPreset, checkpoint, setLookPreset, setManualGrade, continuousEditHandlers, manualGrade, scopeMode, setScopeMode, setShowScope, selectedSection, updateSection, splitAtPlayhead, rebuildPlacements, mediaColor, mediaName, updateBaseCut, mainFile, mainName, assets, duration, selectedBaseAssetDuration, selectedBaseRate, selectedBaseMaxRate, applySelectedSplitEdit, splitEditHandles, setSplitEditHandles, applySelectedAsymmetricSplitEdit, dynamicTrimSelection, startDynamicTrim, setClipTransform, clipTransform, currentTime, toggleTimeRemap, addTimeRemapPoint, seek, updateTimeRemapPoint, removeTimeRemapPoint, autoBalanceSelectedClip, sourceAsset, replaceSelectedFromSource, customEffectRecipes, autoGenerateClipEffects, applyClipEffectRecipe, applyCustomEffectRecipe, saveSelectedClipEffectRecipe, addClipEffect, updateClipEffect, moveClipEffect, addClipEffectKeyframe, updateClipEffectKeyframe, removeClipEffectKeyframe, selectedBaseCutIndex, transitionType, baseCuts, exportFrameRate, selectedCutTransition, applySelectedTransitionToAllCuts, motionDraft, setMotionDraft, addTransformKeyframe, copyTransformKeyframes, hasTransformClipboard, pasteTransformKeyframes, loadTransformKeyframe, updateTransformKeyframe, removeTransformKeyframe, timelineTool, nudgeProfessionalEdit, splitSelectedBaseCut, deleteTimelineSelection, selectedBaseCutSet, selectedPlacementComposition, selectedPlacementAsset, openComposition, setClipTracks, clipTracks, setSelectedTrackId, updatePlacement, selectedPlacementSourceDuration, selectedPlacementRate, selectedPlacementMaxRate, splitSelectedPlacement, placements, updateClipTrack, beginContinuousEdit, endContinuousEdit, moveClipTrack, removeClipTrack, audioClips, updateAudioTrack, audioBuses, selectedAudioClip, updateAudioClip, snapCandidates, snapping, setSelectedAudioClipUnity, applySelectedAudioFade, crossfadeSelectedAudio, duckOtherAudioUnderSelection, addAudioAutomationPoint, selectedAutomationPoint, updateAudioAutomationPoint, removeAudioAutomationPoint } = props;
  return (
        <aside className="control-column">
          <div className="panel-head">
            <div><Settings2 size={16} /><strong>{proWorkspace === "color" ? "Color Controls" : proWorkspace === "audio" ? "Audio Controls" : "Effect Controls"}</strong><span>{activePanel === "section" ? "sequence section" : activePanel === "base" ? "V1 source clip" : activePanel === "clip" ? "overlay properties" : activePanel === "audio" ? "clip mixer" : "track effects"}</span></div>
          </div>

          <div className="inspector-context" role="status">
            {activePanel === "base" ? selectedBaseCut ? mediaName(selectedBaseCut.assetId) ?? "Offline clip" : "No clip selected" : activePanel === "clip" ? selectedPlacement ? selectedPlacementComposition?.name ?? selectedPlacementAsset?.name ?? "Offline clip" : "No clip selected" : activePanel === "audio" ? selectedAudioClip?.name ?? selectedAudioTrack?.name ?? "No audio selection" : activePanel === "track" ? selectedTrack?.name ?? "No track selected" : selectedSection && props.hasTimelineContent ? selectedSection.name : "No clip selected"}
          </div>
          <details className="inspector-target-picker"><summary>Inspect a different target</summary><div className="panel-tabs" aria-label="Inspector target">
            <button className={activePanel === "section" ? "active" : ""} onClick={() => setActivePanel("section")}><Split size={13} /> Section</button>
            <button className={activePanel === "base" ? "active" : ""} onClick={() => setActivePanel("base")} disabled={!selectedBaseCut}><Film size={13} /> V1 clip</button>
            <button className={activePanel === "clip" ? "active" : ""} onClick={() => setActivePanel("clip")} disabled={!selectedPlacement}><Clapperboard size={13} /> Overlay</button>
            <button className={activePanel === "track" ? "active" : ""} onClick={() => setActivePanel("track")} disabled={!selectedTrack}><Palette size={13} /> Track FX</button>
            {isPro && <button className={activePanel === "audio" ? "active" : ""} onClick={() => setActivePanel("audio")} disabled={!selectedAudioTrack}><Music2 size={13} /> Audio</button>}
          </div></details>

          {proWorkspace === "color" && (
            <div className="inspector color-workspace-panel">
              <div className="color-panel-head"><span><Activity size={14} /> COLOR WORKSPACE</span><small>Sequence output · GPU preview</small></div>
              <div className="color-management-grid">
                <label><span>Working space</span><select value={colorManagement.workingSpace} onChange={(event) => setColorManagement((value) => ({ ...value, workingSpace: event.target.value as ColorManagementSettings["workingSpace"] }))}><option value="rec709">Rec.709 Gamma 2.4</option><option value="display-p3">Display P3 D65</option><option value="rec2020-pq">Rec.2020 PQ</option></select></label>
                <label><span>Display</span><select value={colorManagement.displayTransform} onChange={(event) => setColorManagement((value) => ({ ...value, displayTransform: event.target.value as ColorManagementSettings["displayTransform"] }))}><option value="rec709-100">Rec.709 · 100 nit</option><option value="p3-d65">P3 D65</option><option value="hdr-1000">HDR · 1000 nit</option></select></label>
                <label><span>Tone mapping</span><select value={colorManagement.toneMap} onChange={(event) => setColorManagement((value) => ({ ...value, toneMap: event.target.value as ColorManagementSettings["toneMap"] }))}><option value="bt2390">BT.2390</option><option value="reinhard">Reinhard</option><option value="none">None</option></select></label>
                <small>{colorPipelineLabel(colorManagement)} · preview/export matched</small>
              </div>
              <div className="look-options color-looks">{(["none", "cinematic", "neon", "vhs", "noir"] as const).map((look) => <button key={look} className={lookPreset === look ? "active" : ""} onClick={() => { checkpoint(); setLookPreset(look); }}>{look === "none" ? "RAW" : look.toUpperCase()}</button>)}</div>
              <div className="color-section-title"><strong>Basic Correction</strong><button onClick={() => { checkpoint(); setManualGrade(NEUTRAL_GRADE_ADJUST); }}>Reset</button></div>
              <div className="manual-grade pro-color-controls">
                {([
                  ["exposure", "Exposure", 0.5, 2, 0.01],
                  ["contrast", "Contrast", 0.5, 2, 0.01],
                  ["saturation", "Saturation", 0, 2, 0.01],
                  ["temperature", "Temperature", -1, 1, 0.01],
                  ["tint", "Tint", -1, 1, 0.01],
                  ["bloom", "Highlights", 0, 2, 0.01],
                  ["vignette", "Vignette", 0, 1, 0.01],
                  ["grain", "Film Grain", 0, 1, 0.01],
                  ["aberration", "Chromatic", 0, 0.02, 0.001],
                ] as const).map(([key, label, min, max, step]) => <div key={key} className="value-line"><small>{label}</small><input type="range" {...continuousEditHandlers} min={min} max={max} step={step} value={manualGrade[key]} onChange={(event) => setManualGrade((grade) => ({ ...grade, [key]: Number(event.target.value) }))} /><strong>{manualGrade[key].toFixed(2)}</strong></div>)}
              </div>
              <div className="color-section-title"><strong>Scopes</strong><small>{scopeMode === "rgb" ? "RGB Parade" : scopeMode === "vectorscope" ? "Vectorscope YUV" : "Luma Waveform"}</small></div>
              <div className="scope-selector">{(["luma", "rgb", "vectorscope"] as const).map((mode) => <button key={mode} className={scopeMode === mode ? "active" : ""} onClick={() => { setScopeMode(mode); setShowScope(true); }}>{mode === "rgb" ? "RGB Parade" : mode === "vectorscope" ? "Vectorscope" : "Luma"}</button>)}</div>
              <small className="color-help">The selected scope measures the same graded frame shown in Program.</small>
            </div>
          )}

          {proWorkspace !== "color" && ((activePanel === "section" && (!selectedSection || !props.hasTimelineContent)) || (activePanel === "base" && !selectedBaseCut) || (activePanel === "clip" && !selectedPlacement)) && <div className="inspector-empty"><Film size={24} /><strong>{props.hasTimelineContent ? "Select a clip to edit" : "Start with your media"}</strong><p>{props.hasTimelineContent ? "Click a timeline clip for its timing, transform and effects. Select a track header for track controls." : "Import video, audio or images, then drag them into the sequence. Auto Cut is available when you want an assisted edit."}</p>{!props.hasTimelineContent && <button onClick={props.onImportMedia}>Import media</button>}</div>}
          {proWorkspace !== "color" && activePanel === "section" && selectedSection && props.hasTimelineContent && (
            <div className="inspector">
              <div className="inspector-title"><span style={{ background: selectedSection.color }} /><div><strong>{selectedSection.name}</strong><small>{formatTime(selectedSection.start)} — {formatTime(selectedSection.end)}</small></div><label className="switch"><input type="checkbox" checked={selectedSection.enabled} onChange={(event) => updateSection({ enabled: event.target.checked })} /><i /></label></div>
              <label className="field"><span>Name</span><input className="section-name-input" value={selectedSection.name} onChange={(event) => updateSection({ name: event.target.value })} placeholder="Section name" /></label>
              <label className="field"><span>Energy</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="1" step="0.05" value={selectedSection.energy} onChange={(event) => updateSection({ energy: Number(event.target.value) })} /><strong>{Math.round(selectedSection.energy * 100)}%</strong></div></label>
              <button className={`automation-lock ${selectedSection.locked ? "active" : ""}`} onClick={() => updateSection({ locked: !selectedSection.locked })}>{selectedSection.locked ? <Lock size={13} /> : <Unlock size={13} />}{selectedSection.locked ? "Protected from Auto Director" : "Protect section from automation"}</button>
              <label className="field"><span>Director pattern</span><select className="director-select" value={selectedSection.pattern} onChange={(event) => updateSection({ pattern: event.target.value as DirectorPattern })}><option value="restrained">Restrained</option><option value="pulse">Pulse</option><option value="build">Build</option><option value="burst">Burst</option><option value="release">Release</option></select></label>
              <div className="field"><span>Rhythm rate</span><div className="rhythm-segments">{(["half", "normal", "double"] as const).map((rate) => <button key={rate} className={selectedSection.rhythm === rate ? "active" : ""} onClick={() => updateSection({ rhythm: rate })}>{rate === "half" ? "½" : rate === "double" ? "2×" : "1×"}</button>)}</div></div>
              <label className="field"><span>Effect duration</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0.1" max="4" step="0.05" value={selectedSection.duration} onChange={(event) => updateSection({ duration: Number(event.target.value) })} /><strong>{selectedSection.duration.toFixed(2)}s</strong></div></label>
              <label className="field"><span>Scale</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="50" max="180" value={selectedSection.scale} onChange={(event) => updateSection({ scale: Number(event.target.value) })} /><strong>{selectedSection.scale}%</strong></div></label>
              <div className="inspector-actions"><button onClick={splitAtPlayhead}><Scissors size={15} /> Split at playhead</button><button className="primary" onClick={rebuildPlacements}><Sparkles size={15} /> Fill timeline</button></div>
            </div>
          )}

          {proWorkspace !== "color" && activePanel === "base" && selectedBaseCut && (
            <div className="inspector">
              <div className="inspector-title"><span style={{ background: mediaColor(selectedBaseCut.assetId) ?? "#34d6c7" }} /><div><strong>V1 source clip</strong><small>{mediaName(selectedBaseCut.assetId) ?? "Offline media"}</small></div></div>
              <InspectorSection title="Timing & source">
              <button className={`automation-lock ${selectedBaseCut.locked ? "active" : ""}`} onClick={() => updateBaseCut({ locked: !selectedBaseCut.locked })}>{selectedBaseCut.locked ? <Lock size={13} /> : <Unlock size={13} />}{selectedBaseCut.locked ? "Protected from montage rebuilds" : "Protect clip from automation"}</button>
              <label className="field"><span>Source media</span><select className="director-select" value={selectedBaseCut.assetId} onChange={(event) => updateBaseCut({ assetId: event.target.value, sourceStart: 0 })}>{mainFile && <option value={MAIN_SOURCE_ID}>{mainName || mainFile.name} · master</option>}{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
              <label className="field"><span>Timeline start</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={duration} step="0.01" value={selectedBaseCut.start} onChange={(event) => updateBaseCut({ start: Number(event.target.value) })} /><strong>{formatTime(selectedBaseCut.start)}</strong></div></label>
              <label className="field"><span>Clip duration</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0.05" max={Math.max(0.05, Math.min(duration - selectedBaseCut.start, (selectedBaseAssetDuration - selectedBaseCut.sourceStart) / selectedBaseRate))} step="0.05" value={selectedBaseCut.duration} onChange={(event) => updateBaseCut({ duration: Number(event.target.value) })} /><strong>{selectedBaseCut.duration.toFixed(2)}s</strong></div></label>
              <label className="field"><span>Source in</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.max(0, selectedBaseAssetDuration - selectedBaseCut.duration * selectedBaseRate)} step="0.05" value={selectedBaseCut.sourceStart} onChange={(event) => updateBaseCut({ sourceStart: Number(event.target.value) })} /><strong>{selectedBaseCut.sourceStart.toFixed(2)}s</strong></div></label>
              <div className="clip-speed-control">
                <label className="field"><span>Playback speed</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0.1" max={selectedBaseMaxRate} step="0.01" value={selectedBaseRate} onChange={(event) => updateBaseCut({ playbackRate: Number(event.target.value) })} /><strong>{Math.round(selectedBaseRate * 100)}%</strong></div></label>
                <button disabled={Math.abs(selectedBaseRate - 1) < 0.005 || selectedBaseMaxRate < 1} onClick={() => updateBaseCut({ playbackRate: 1 })}>Reset 100%</button>
                <small>{(selectedBaseCut.duration * selectedBaseRate).toFixed(2)}s of source · choose Rate Stretch (R) to preserve those frames while changing duration.</small>
              </div>
              <div className="fade-fields"><label className="field"><span>Picture fade in</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.min(3, selectedBaseCut.duration / 2)} step="0.01" value={selectedBaseCut.fadeIn ?? 0} onChange={(event) => updateBaseCut({ fadeIn: Number(event.target.value) })} /><strong>{(selectedBaseCut.fadeIn ?? 0).toFixed(2)}s</strong></div></label><label className="field"><span>Picture fade out</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.min(3, selectedBaseCut.duration / 2)} step="0.01" value={selectedBaseCut.fadeOut ?? 0} onChange={(event) => updateBaseCut({ fadeOut: Number(event.target.value) })} /><strong>{(selectedBaseCut.fadeOut ?? 0).toFixed(2)}s</strong></div></label></div>
              </InspectorSection>
              <InspectorSection title="Advanced trimming">
              <div className="split-edit-controls"><span>SPLIT EDIT · LINKED AUDIO</span><button onClick={() => applySelectedSplitEdit("j-cut")}>J-CUT · AUDIO LEADS</button><button onClick={() => applySelectedSplitEdit("l-cut")}>L-CUT · AUDIO TRAILS</button><button onClick={() => applySelectedSplitEdit("reset")}>RESET SYNC</button></div>
              <div className="asymmetric-split-edit"><label><span>Audio lead</span><input type="number" min="0" max="5" step="0.05" value={splitEditHandles.lead} onChange={(event) => setSplitEditHandles((value) => ({ ...value, lead: Math.max(0, Math.min(5, Number(event.target.value))) }))} /><b>s</b></label><label><span>Audio trail</span><input type="number" min="0" max="5" step="0.05" value={splitEditHandles.trail} onChange={(event) => setSplitEditHandles((value) => ({ ...value, trail: Math.max(0, Math.min(5, Number(event.target.value))) }))} /><b>s</b></label><button onClick={applySelectedAsymmetricSplitEdit}>APPLY CUSTOM J/L</button></div>
              <div className="dynamic-trim-launcher"><span>DYNAMIC TRIM · J / K / L</span><button className={dynamicTrimSelection?.cutId === selectedBaseCut.id && dynamicTrimSelection.edge === "in" && dynamicTrimSelection.mode === "ripple" ? "active" : ""} onClick={() => startDynamicTrim("in", "ripple")}>Ripple In</button><button className={dynamicTrimSelection?.cutId === selectedBaseCut.id && dynamicTrimSelection.edge === "out" && dynamicTrimSelection.mode === "ripple" ? "active" : ""} onClick={() => startDynamicTrim("out", "ripple")}>Ripple Out</button><button className={dynamicTrimSelection?.cutId === selectedBaseCut.id && dynamicTrimSelection.edge === "in" && dynamicTrimSelection.mode === "roll" ? "active" : ""} onClick={() => startDynamicTrim("in", "roll")}>Roll In</button><button className={dynamicTrimSelection?.cutId === selectedBaseCut.id && dynamicTrimSelection.edge === "out" && dynamicTrimSelection.mode === "roll" ? "active" : ""} onClick={() => startDynamicTrim("out", "roll")}>Roll Out</button></div>
              </InspectorSection>
              <InspectorSection title="Transform" defaultOpen>
              <div className="transform-flip">
                <button className={selectedBaseCut.flipH ? "active" : ""} onClick={() => updateBaseCut({ flipH: !selectedBaseCut.flipH })}>Flip H</button>
                <button className={selectedBaseCut.flipV ? "active" : ""} onClick={() => updateBaseCut({ flipV: !selectedBaseCut.flipV })}>Flip V</button>
                <button className={selectedBaseCut.reversed ? "active" : ""} onClick={() => updateBaseCut({ reversed: !selectedBaseCut.reversed })} title="Play this clip's footage backwards">Reverse</button>
                {[90, 180, 270].map((deg) => <button key={deg} onClick={() => setClipTransform({ rotation: (((clipTransform.rotation + deg) % 360) + 360) % 360 })}>{deg}°</button>)}
              </div>
              <label className="field"><span>Rotation</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="-180" max="180" step="1" value={clipTransform.rotation} onChange={(event) => setClipTransform({ rotation: Number(event.target.value) })} /><strong>{Math.round(clipTransform.rotation)}°</strong></div></label>
              <label className="field"><span>Scale</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0.1" max="3" step="0.01" value={clipTransform.scale} onChange={(event) => setClipTransform({ scale: Number(event.target.value) })} /><strong>{Math.round(clipTransform.scale * 100)}%</strong></div></label>
              <label className="field"><span>Opacity</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="1" step="0.01" value={clipTransform.opacity} onChange={(event) => setClipTransform({ opacity: Number(event.target.value) })} /><strong>{Math.round(clipTransform.opacity * 100)}%</strong></div></label>
              <div className="fade-fields">
                <label className="field"><span>Position X</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="-1" max="1" step="0.01" value={clipTransform.x} onChange={(event) => setClipTransform({ x: Number(event.target.value) })} /><strong>{clipTransform.x.toFixed(2)}</strong></div></label>
                <label className="field"><span>Position Y</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="-1" max="1" step="0.01" value={clipTransform.y} onChange={(event) => setClipTransform({ y: Number(event.target.value) })} /><strong>{clipTransform.y.toFixed(2)}</strong></div></label>
              </div>
              <div className="transition-actions"><button onClick={() => updateBaseCut({ flipH: false, flipV: false, reversed: false, transformKeyframes: [] })}>Reset transform</button></div>
              </InspectorSection>
              <InspectorSection title={`Time remap${hasTimeRemap(selectedBaseCut.timeRemap) ? ` · ${selectedBaseCut.timeRemap.length} points · ${timeRemapSpeedAt(selectedBaseCut.timeRemap, Math.max(0, currentTime - selectedBaseCut.start)).toFixed(2)}×` : ""}`}>
              <div className="transition-actions">
                <button className={hasTimeRemap(selectedBaseCut.timeRemap) ? "active" : ""} onClick={toggleTimeRemap} title="Keyframe the clip's source playhead — speed, freeze, or reverse across the clip">{hasTimeRemap(selectedBaseCut.timeRemap) ? "Time remap on" : "Enable time remap"}</button>
                {hasTimeRemap(selectedBaseCut.timeRemap) && <button className="add-keyframe-button" onClick={addTimeRemapPoint}><Diamond size={13} fill="currentColor" /> Point at playhead</button>}
              </div>
              {hasTimeRemap(selectedBaseCut.timeRemap) && (
                <div className="time-remap-points">
                  {selectedBaseCut.timeRemap.map((point) => (
                    <div key={point.id} className="title-row">
                      <button className="title-seek" onClick={() => seek(selectedBaseCut.start + point.time)} title="Jump to this point"><span>{point.time.toFixed(2)}s</span><strong>src {point.sourceTime.toFixed(2)}s</strong></button>
                      <label className="field time-remap-source"><input type="range" {...continuousEditHandlers} min="0" max={Math.max(0.1, (assets.find((asset) => asset.id === selectedBaseCut.assetId)?.duration ?? selectedBaseCut.sourceStart + selectedBaseCut.duration))} step="0.01" value={point.sourceTime} onChange={(event) => updateTimeRemapPoint(point.id, Number(event.target.value))} /></label>
                      <button className="title-del" onClick={() => removeTimeRemapPoint(point.id)} aria-label="Remove time-remap point"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              </InspectorSection>
              <InspectorSection title="Clip color">
              {([
                ["exposure", "Exposure", 0.1, 3, 0.01],
                ["contrast", "Contrast", 0.1, 3, 0.01],
                ["saturation", "Saturation", 0, 3, 0.01],
                ["hue", "Hue", -180, 180, 1],
                ["temperature", "Temperature", -1, 1, 0.01],
                ["tint", "Tint · green / magenta", -1, 1, 0.01],
              ] as const).map(([key, label, min, max, step]) => { const clipColor = { ...NEUTRAL_CLIP_COLOR, ...selectedBaseCut.color }; return <label className="field" key={key}><span>{label}</span><div className="value-line"><input aria-label={`${label} for selected clip`} type="range" {...continuousEditHandlers} min={min} max={max} step={step} value={clipColor[key]} onChange={(event) => updateBaseCut({ color: { ...clipColor, [key]: Number(event.target.value) } })} /><strong>{clipColor[key].toFixed(key === "hue" ? 0 : 2)}{key === "hue" ? "°" : ""}</strong></div></label>; })}
              <div className="transition-actions"><button disabled={!selectedBaseCut.color} onClick={() => updateBaseCut({ color: undefined })}>Reset clip color</button><button onClick={() => autoBalanceSelectedClip("base")}>Auto white balance</button><button disabled={!sourceAsset || sourceAsset.kind === "audio"} onClick={replaceSelectedFromSource}>Replace from Source</button></div>
              </InspectorSection>
              <InspectorSection title={`Effects · ${selectedBaseCut.effects?.length ?? 0}`}>
              <Suspense fallback={<p role="status">Loading clip effects…</p>}><ClipEffectStack effects={selectedBaseCut.effects ?? []} customRecipes={customEffectRecipes} inputHandlers={continuousEditHandlers} onAuto={autoGenerateClipEffects} onApplyRecipe={applyClipEffectRecipe} onApplyCustom={applyCustomEffectRecipe} onSave={saveSelectedClipEffectRecipe} onAdd={addClipEffect} onUpdate={updateClipEffect} onMove={moveClipEffect} onRemove={(id) => updateBaseCut({ effects: (selectedBaseCut.effects ?? []).filter((effect) => effect.id !== id) })} onAddKeyframe={addClipEffectKeyframe} onSeekKeyframe={(time) => seek(selectedBaseCut.start + time)} onUpdateKeyframe={updateClipEffectKeyframe} onRemoveKeyframe={removeClipEffectKeyframe} /></Suspense>
              </InspectorSection>
              {selectedBaseCutIndex > 0 && (
                <div className="clip-transition-control">
                  <div className="transition-control-head"><span>Incoming transition</span><small>Preview + export matched</small></div>
                  <label className="field"><span>Style at this edit</span><select className="director-select" value={selectedBaseCut.transitionType ?? "default"} onChange={(event) => {
                    const value = event.target.value;
                    if (value === "default") {
                      updateBaseCut({ transitionType: undefined, transitionDuration: undefined });
                    } else {
                      const type = value as TransitionType;
                      updateBaseCut({ transitionType: type, transitionDuration: TRANSITION_PRESETS[type].duration });
                    }
                  }}><option value="default">Sequence default · {transitionType}</option><option value="none">None · hard cut</option><option value="dissolve">Dissolve</option><option value="dip">Dip to black</option><option value="slide">Slide</option><option value="flash">Flash</option><option value="zoom">Zoom</option><option value="whip">Whip</option><option value="glitch">Glitch</option></select></label>
                  <label className="field"><span>Duration</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0.04" max={Math.max(0.04, Math.min(2, selectedBaseCut.duration, baseCuts[selectedBaseCutIndex - 1]?.duration ?? selectedBaseCut.duration))} step={1 / exportFrameRate} value={Math.max(0.04, selectedCutTransition.duration)} disabled={selectedCutTransition.type === "none"} onChange={(event) => updateBaseCut({ transitionDuration: Number(event.target.value) })} /><strong>{selectedCutTransition.type === "none" ? "CUT" : `${selectedCutTransition.duration.toFixed(2)}s`}</strong></div></label>
                  <div className="transition-actions"><button onClick={applySelectedTransitionToAllCuts}>Apply to all edits</button><button disabled={selectedBaseCut.transitionType === undefined} onClick={() => updateBaseCut({ transitionType: undefined, transitionDuration: undefined })}>Follow sequence default</button></div>
                  <small className="transition-hint">Drag the violet edge directly on the selected timeline clip for a frame-snapped duration.</small>
                </div>
              )}
              <InspectorSection title={`Animation · ${selectedBaseCut.transformKeyframes?.length ?? 0} keyframes`}>
              <div className="motion-keyframes">
                <span className="field-label">Motion — animate this clip</span>
                <div className="value-line"><small>X</small><input type="range" min="-1" max="1" step="0.01" value={motionDraft.x} onChange={(event) => setMotionDraft((draft) => ({ ...draft, x: Number(event.target.value) }))} /><strong>{motionDraft.x.toFixed(2)}</strong></div>
                <div className="value-line"><small>Y</small><input type="range" min="-1" max="1" step="0.01" value={motionDraft.y} onChange={(event) => setMotionDraft((draft) => ({ ...draft, y: Number(event.target.value) }))} /><strong>{motionDraft.y.toFixed(2)}</strong></div>
                <div className="value-line"><small>Scale</small><input type="range" min="0.1" max="4" step="0.01" value={motionDraft.scale} onChange={(event) => setMotionDraft((draft) => ({ ...draft, scale: Number(event.target.value) }))} /><strong>{motionDraft.scale.toFixed(2)}×</strong></div>
                <div className="value-line"><small>Rotate</small><input type="range" min="-180" max="180" step="1" value={motionDraft.rotation} onChange={(event) => setMotionDraft((draft) => ({ ...draft, rotation: Number(event.target.value) }))} /><strong>{motionDraft.rotation}°</strong></div>
                <div className="value-line"><small>Opacity</small><input type="range" min="0" max="1" step="0.01" value={motionDraft.opacity} onChange={(event) => setMotionDraft((draft) => ({ ...draft, opacity: Number(event.target.value) }))} /><strong>{Math.round(motionDraft.opacity * 100)}%</strong></div>
                <div className="keyframe-actions"><button className="montage-reroll" onClick={addTransformKeyframe}><Plus size={13} /> Add at playhead</button><button disabled={!selectedBaseCut.transformKeyframes?.length} onClick={copyTransformKeyframes}>Copy motion</button><button disabled={!hasTransformClipboard} onClick={pasteTransformKeyframes}>Paste + fit</button></div>
                {(selectedBaseCut.transformKeyframes ?? []).length > 0 && (
                  <div className="keyframe-list">
                    {(selectedBaseCut.transformKeyframes ?? []).map((keyframe) => (
                      <div key={keyframe.id} className="keyframe-stack"><div className="keyframe-row">
                        <button onClick={() => loadTransformKeyframe(keyframe)} title="Load this keyframe's values and jump to it">◆ {formatTimecode(selectedBaseCut.start + keyframe.time, exportFrameRate)}</button>
                        <select aria-label={`Easing for keyframe at ${formatTimecode(selectedBaseCut.start + keyframe.time, exportFrameRate)}`} value={keyframe.easing ?? "linear"} onChange={(event) => { const easing = event.target.value as Easing; updateTransformKeyframe(keyframe.id, { easing, ...(easing === "custom" && !keyframe.bezier ? { bezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } } : {}) }); }}>
                          <option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Easy ease</option><option value="custom">Custom Bezier</option><option value="hold">Hold</option>
                        </select>
                        <button onClick={() => removeTransformKeyframe(keyframe.id)} aria-label="Delete keyframe"><X size={11} /></button>
                      </div><label className="keyframe-time-editor"><span>TIME</span><input type="range" min="0" max={selectedBaseCut.duration} step={1 / exportFrameRate} value={keyframe.time} onChange={(event) => updateTransformKeyframe(keyframe.id, { time: Number(event.target.value) })} /><b>{keyframe.time.toFixed(2)}s</b></label>{keyframe.easing === "custom" && <div className="clip-bezier-grid">{(["x1", "y1", "x2", "y2"] as const).map((handle) => { const bezier = keyframe.bezier ?? { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }; const isX = handle.startsWith("x"); return <label key={handle}><span>{handle.toUpperCase()}</span><input type="range" min={isX ? 0 : -2} max={isX ? 1 : 3} step="0.01" value={bezier[handle]} onChange={(event) => updateTransformKeyframe(keyframe.id, { bezier: { ...bezier, [handle]: Number(event.target.value) } })} /><b>{bezier[handle].toFixed(2)}</b></label>; })}</div>}</div>
                    ))}
                  </div>
                )}
                <small className="montage-note">Two or more keyframes animate; a single one holds a static transform.</small>
              </div>
              </InspectorSection>
              <div className="professional-edit-nudge">
                <span>{timelineTool.toUpperCase()} TOOL</span>
                <button onClick={() => nudgeProfessionalEdit(-1)}>−1f</button>
                <button onClick={() => nudgeProfessionalEdit(1)}>+1f</button>
                <button onClick={() => nudgeProfessionalEdit(-1, true)}>−0.5s</button>
                <button onClick={() => nudgeProfessionalEdit(1, true)}>+0.5s</button>
              </div>
              <div className="inspector-actions"><button onClick={splitSelectedBaseCut}><Scissors size={14} /> Split clip</button><button className="primary" onClick={() => deleteTimelineSelection(false, "base")}><Trash2 size={14} /> Delete {selectedBaseCutSet.size > 1 ? `${selectedBaseCutSet.size} clips` : "clip"}</button></div>
            </div>
          )}

          {proWorkspace !== "color" && activePanel === "clip" && selectedPlacement && (
            <div className="inspector">
              <div className="inspector-title"><span className="clip-swatch" /><div><strong>{selectedPlacementComposition ? "Nested composition clip" : "Stacked video clip"}</strong><small>{selectedPlacementComposition?.name ?? selectedPlacementAsset?.name ?? "Offline media"}</small></div>{selectedPlacementComposition && <button className="open-comp-chip" onClick={() => openComposition(selectedPlacementComposition.id)}>OPEN COMP</button>}</div>
              <InspectorSection title="Timing & source">
              <button className={`automation-lock ${selectedTrack?.locked ? "active" : ""}`} onClick={() => { if (!selectedTrack) return; checkpoint(); setClipTracks((items) => items.map((track) => track.id === selectedTrack.id ? { ...track, locked: !track.locked } : track)); }}>{selectedTrack?.locked ? <Lock size={13} /> : <Unlock size={13} />}{selectedTrack?.locked ? `${selectedTrack.name} locked` : `Lock ${selectedTrack?.name ?? "video track"}`}</button>
              <label className="field"><span>Clip track</span><select className="director-select" value={selectedPlacement.trackId ?? clipTracks[0]?.id} onChange={(event) => { setSelectedTrackId(event.target.value); updatePlacement({ trackId: event.target.value }); }}>{clipTracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
              <label className="field"><span>Timeline start</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.max(0, duration - selectedPlacement.duration)} step={1 / exportFrameRate} value={selectedPlacement.start} disabled={selectedTrack?.locked} onChange={(event) => updatePlacement({ start: Number(event.target.value) })} /><strong>{formatTimecode(selectedPlacement.start, exportFrameRate)}</strong></div></label>
              <label className="field"><span>Source in</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.max(0, selectedPlacementSourceDuration - selectedPlacement.duration * selectedPlacementRate)} step={1 / exportFrameRate} value={selectedPlacement.sourceStart} disabled={selectedTrack?.locked || selectedPlacementComposition !== null || selectedPlacementAsset?.kind === "image"} onChange={(event) => updatePlacement({ sourceStart: Number(event.target.value) })} /><strong>{selectedPlacement.sourceStart.toFixed(2)}s</strong></div></label>
              <label className="field"><span>Clip duration</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0.04" max={Math.max(0.04, Math.min(duration - selectedPlacement.start, (selectedPlacementSourceDuration - selectedPlacement.sourceStart) / selectedPlacementRate))} step={1 / exportFrameRate} value={selectedPlacement.duration} disabled={selectedTrack?.locked} onChange={(event) => updatePlacement({ duration: Number(event.target.value) })} /><strong>{selectedPlacement.duration.toFixed(2)}s</strong></div></label>
              <div className="clip-speed-control"><label className="field"><span>Playback speed</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0.1" max={selectedPlacementMaxRate} step="0.01" value={selectedPlacementRate} disabled={selectedTrack?.locked} onChange={(event) => updatePlacement({ playbackRate: Number(event.target.value) })} /><strong>{Math.round(selectedPlacementRate * 100)}%</strong></div></label><button disabled={selectedTrack?.locked || Math.abs(selectedPlacementRate - 1) < 0.005} onClick={() => updatePlacement({ playbackRate: 1 })}>Reset 100%</button><small>{(selectedPlacement.duration * selectedPlacementRate).toFixed(2)}s of source · preview and export share this clock.</small></div>
              </InspectorSection>
              <InspectorSection title="Size & fades" defaultOpen>
              <label className="field"><span>Scale</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="50" max="200" value={selectedPlacement.scale} onChange={(event) => updatePlacement({ scale: Number(event.target.value) })} /><strong>{selectedPlacement.scale}%</strong></div></label>
              <label className="field"><span>Opacity</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="10" max="100" value={selectedPlacement.opacity} onChange={(event) => updatePlacement({ opacity: Number(event.target.value) })} /><strong>{selectedPlacement.opacity}%</strong></div></label>
              <div className="fade-fields"><label className="field"><span>Fade in</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.min(2, selectedPlacement.duration / 2)} step="0.01" value={selectedPlacement.fadeIn ?? 0} onChange={(event) => updatePlacement({ fadeIn: Number(event.target.value) })} /><strong>{(selectedPlacement.fadeIn ?? 0).toFixed(2)}s</strong></div></label><label className="field"><span>Fade out</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.min(2, selectedPlacement.duration / 2)} step="0.01" value={selectedPlacement.fadeOut ?? 0} onChange={(event) => updatePlacement({ fadeOut: Number(event.target.value) })} /><strong>{(selectedPlacement.fadeOut ?? 0).toFixed(2)}s</strong></div></label></div>
              <div className="transform-flip">
                <button className={selectedPlacement.flipH ? "active" : ""} onClick={() => updatePlacement({ flipH: !selectedPlacement.flipH })}>Flip H</button>
                <button className={selectedPlacement.flipV ? "active" : ""} onClick={() => updatePlacement({ flipV: !selectedPlacement.flipV })}>Flip V</button>
                <button className={selectedPlacement.reversed ? "active" : ""} onClick={() => updatePlacement({ reversed: !selectedPlacement.reversed })} title="Play this overlay clip's footage backwards">Reverse</button>
              </div>
              </InspectorSection>
              <InspectorSection title="Color & effects">
              {!selectedPlacementComposition && <><div className="inspector-divider">CLIP COLOR · NON-DESTRUCTIVE</div>{([
                ["exposure", "Exposure", 0.1, 3, 0.01], ["contrast", "Contrast", 0.1, 3, 0.01], ["saturation", "Saturation", 0, 3, 0.01],
                ["hue", "Hue", -180, 180, 1], ["temperature", "Temperature", -1, 1, 0.01], ["tint", "Tint · green / magenta", -1, 1, 0.01],
              ] as const).map(([key, label, min, max, step]) => { const clipColor = { ...NEUTRAL_CLIP_COLOR, ...selectedPlacement.color }; return <label className="field" key={key}><span>{label}</span><div className="value-line"><input aria-label={`${label} for selected stacked clip`} type="range" {...continuousEditHandlers} min={min} max={max} step={step} value={clipColor[key]} onChange={(event) => updatePlacement({ color: { ...clipColor, [key]: Number(event.target.value) } })} /><strong>{clipColor[key].toFixed(key === "hue" ? 0 : 2)}{key === "hue" ? "°" : ""}</strong></div></label>; })}<div className="transition-actions"><button disabled={!selectedPlacement.color} onClick={() => updatePlacement({ color: undefined })}>Reset clip color</button><button onClick={() => autoBalanceSelectedClip("overlay")}>Auto white balance</button></div></>}
              <div className="inspector-divider">CLIP EFFECTS · ORDERED STACK</div>
              <Suspense fallback={<p role="status">Loading clip effects…</p>}><ClipEffectStack effects={selectedPlacement.effects ?? []} customRecipes={customEffectRecipes} inputHandlers={continuousEditHandlers} onAuto={autoGenerateClipEffects} onApplyRecipe={applyClipEffectRecipe} onApplyCustom={applyCustomEffectRecipe} onSave={saveSelectedClipEffectRecipe} onAdd={addClipEffect} onUpdate={updateClipEffect} onMove={moveClipEffect} onRemove={(id) => updatePlacement({ effects: (selectedPlacement.effects ?? []).filter((effect) => effect.id !== id) })} onAddKeyframe={addClipEffectKeyframe} onSeekKeyframe={(time) => seek(selectedPlacement.start + time)} onUpdateKeyframe={updateClipEffectKeyframe} onRemoveKeyframe={removeClipEffectKeyframe} /></Suspense>
              </InspectorSection>
              <div className="inspector-actions"><button disabled={selectedTrack?.locked} onClick={() => splitSelectedPlacement()}><Scissors size={14} /> Split at playhead</button><button className="primary" disabled={selectedTrack?.locked} onClick={() => deleteTimelineSelection(false, "overlay")}><Trash2 size={14} /> Delete clip</button></div>
            </div>
          )}

          {proWorkspace !== "color" && activePanel === "track" && selectedTrack && (
            <div className="inspector track-inspector">
              <div className="inspector-title"><span style={{ background: selectedTrack.color }} /><div><strong>{selectedTrack.name}</strong><small>{placements.filter((placement) => (placement.trackId ?? clipTracks[0]?.id) === selectedTrack.id).length} clips share this stack</small></div><label className="switch"><input type="checkbox" checked={selectedTrack.enabled} onChange={(event) => updateClipTrack({ enabled: event.target.checked })} /><i /></label></div>
              <label className="field"><span>Track name</span><input className="track-name-input" value={selectedTrack.name} maxLength={28} onFocus={beginContinuousEdit} onBlur={endContinuousEdit} onChange={(event) => updateClipTrack({ name: event.target.value.toUpperCase() })} /></label>
              <label className="field"><span>Blend mode</span><select className="director-select" value={selectedTrack.blend} onChange={(event) => updateClipTrack({ blend: event.target.value as ClipTrack["blend"] })}><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="normal">Normal</option><option value="multiply">Multiply</option></select></label>
              <label className="field"><span>Track opacity</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="100" value={selectedTrack.opacity} onChange={(event) => updateClipTrack({ opacity: Number(event.target.value) })} /><strong>{selectedTrack.opacity}%</strong></div></label>
              <label className="field"><span>Hue shift</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="-180" max="180" value={selectedTrack.hue} onChange={(event) => updateClipTrack({ hue: Number(event.target.value) })} /><strong>{selectedTrack.hue}°</strong></div></label>
              <label className="field"><span>Color intensity</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="220" value={selectedTrack.saturation} onChange={(event) => updateClipTrack({ saturation: Number(event.target.value) })} /><strong>{selectedTrack.saturation}%</strong></div></label>
              <label className="field"><span>Brightness</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="20" max="200" value={selectedTrack.brightness} onChange={(event) => updateClipTrack({ brightness: Number(event.target.value) })} /><strong>{selectedTrack.brightness}%</strong></div></label>
              <label className="field"><span>Glow</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="60" value={selectedTrack.glow} onChange={(event) => updateClipTrack({ glow: Number(event.target.value) })} /><strong>{selectedTrack.glow}px</strong></div></label>
              <div className="fade-fields"><label className="field"><span>Fade in</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="2" step="0.01" value={selectedTrack.fadeIn} onChange={(event) => updateClipTrack({ fadeIn: Number(event.target.value) })} /><strong>{selectedTrack.fadeIn.toFixed(2)}s</strong></div></label><label className="field"><span>Fade out</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="2" step="0.01" value={selectedTrack.fadeOut} onChange={(event) => updateClipTrack({ fadeOut: Number(event.target.value) })} /><strong>{selectedTrack.fadeOut.toFixed(2)}s</strong></div></label></div>
              <div className="video-track-switches"><button className={!selectedTrack.enabled ? "active" : ""} onClick={() => updateClipTrack({ enabled: !selectedTrack.enabled })}>{selectedTrack.enabled ? <Eye size={12} /> : <EyeOff size={12} />}{selectedTrack.enabled ? "VISIBLE" : "HIDDEN"}</button><button className={selectedTrack.solo ? "active" : ""} onClick={() => updateClipTrack({ solo: !selectedTrack.solo })} title="Solo — show only soloed video tracks">SOLO</button><button className={selectedTrack.locked ? "active" : ""} onClick={() => updateClipTrack({ locked: !selectedTrack.locked })}>{selectedTrack.locked ? <Lock size={12} /> : <Unlock size={12} />}LOCK</button><button className={selectedTrack.target ? "active" : ""} onClick={() => updateClipTrack({ target: !selectedTrack.target })}>TARGET</button><button className={selectedTrack.sourcePatch ? "active" : ""} onClick={() => updateClipTrack({ sourcePatch: !selectedTrack.sourcePatch })}>PATCH</button><button className={selectedTrack.syncLock !== false ? "active" : ""} onClick={() => updateClipTrack({ syncLock: selectedTrack.syncLock === false })}>SYNC</button><button disabled={clipTracks.indexOf(selectedTrack) === clipTracks.length - 1} onClick={() => moveClipTrack("up")}>RAISE</button><button disabled={clipTracks.indexOf(selectedTrack) === 0} onClick={() => moveClipTrack("down")}>LOWER</button></div>
              <button className="delete-placement" disabled={clipTracks.length <= 1 || selectedTrack.locked} onClick={() => removeClipTrack(selectedTrack.id)}><Trash2 size={15} /> Remove video track</button>
            </div>
          )}

          {proWorkspace !== "color" && activePanel === "audio" && selectedAudioTrack && (
            <div className="inspector track-inspector">
              <div className="inspector-title"><span style={{ background: selectedAudioTrack.color }} /><div><strong>{selectedAudioTrack.name}</strong><small>{audioClips.filter((clip) => clip.trackId === selectedAudioTrack.id).length} audio clips</small></div><button className="audio-mute-button" onClick={() => updateAudioTrack({ muted: !selectedAudioTrack.muted })}>{selectedAudioTrack.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button></div>
              <label className="field"><span>Track name</span><input className="track-name-input" value={selectedAudioTrack.name} onChange={(event) => updateAudioTrack({ name: event.target.value.toUpperCase() })} /></label>
              <label className="field"><span>Track volume</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="2" step="0.01" value={selectedAudioTrack.gain} onChange={(event) => updateAudioTrack({ gain: Number(event.target.value) })} /><strong>{Math.round(selectedAudioTrack.gain * 100)}%</strong></div></label>
              <label className="field"><span>Track pan</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="-1" max="1" step="0.01" value={selectedAudioTrack.pan} onChange={(event) => updateAudioTrack({ pan: Number(event.target.value) })} /><strong>{selectedAudioTrack.pan > 0 ? `R${Math.round(selectedAudioTrack.pan * 100)}` : selectedAudioTrack.pan < 0 ? `L${Math.round(Math.abs(selectedAudioTrack.pan) * 100)}` : "CENTER"}</strong></div></label>
              <label className="field"><span>Submix bus</span><select className="director-select" value={audioBusForTrack(selectedAudioTrack, audioBuses)?.id ?? ""} onChange={(event) => updateAudioTrack({ busId: event.target.value })}>{audioBuses.map((bus) => <option key={bus.id} value={bus.id}>{bus.name}</option>)}</select></label>
              <div className="inspector-divider">CHANNEL STRIP · EQ / DYNAMICS</div>
              {([
                ["highPassHz", "High-pass", 20, 400, 1, " Hz"],
                ["lowDb", "Low shelf", -18, 18, 0.5, " dB"],
                ["midDb", "Presence", -18, 18, 0.5, " dB"],
                ["highDb", "High shelf", -18, 18, 0.5, " dB"],
                ["compressorThreshold", "Comp threshold", -60, 0, 1, " dB"],
                ["compressorRatio", "Comp ratio", 1, 20, 0.5, ":1"],
                ["makeupGain", "Makeup", 0.25, 4, 0.05, "×"],
              ] as const).map(([key, label, min, max, step, suffix]) => <label className="field" key={key}><span>{label}</span><div className="value-line"><input type="range" {...continuousEditHandlers} min={min} max={max} step={step} value={(selectedAudioTrack.processing ?? DEFAULT_AUDIO_EFFECT_RACK)[key]} onChange={(event) => updateAudioTrack({ processing: { ...(selectedAudioTrack.processing ?? DEFAULT_AUDIO_EFFECT_RACK), [key]: Number(event.target.value) } })} /><strong>{(selectedAudioTrack.processing ?? DEFAULT_AUDIO_EFFECT_RACK)[key]}{suffix}</strong></div></label>)}
              <div className="audio-track-switches"><button className={(selectedAudioTrack.processing ?? DEFAULT_AUDIO_EFFECT_RACK).limiter ? "active" : ""} onClick={() => updateAudioTrack({ processing: { ...(selectedAudioTrack.processing ?? DEFAULT_AUDIO_EFFECT_RACK), limiter: !(selectedAudioTrack.processing ?? DEFAULT_AUDIO_EFFECT_RACK).limiter } })}>BRICKWALL LIMIT</button><button onClick={() => updateAudioTrack({ processing: { ...DEFAULT_AUDIO_EFFECT_RACK } })}>RESET STRIP</button></div>
              <div className="audio-track-switches">
                <button className={selectedAudioTrack.solo ? "active" : ""} onClick={() => updateAudioTrack({ solo: !selectedAudioTrack.solo })}>SOLO</button>
                <button className={selectedAudioTrack.muted ? "active" : ""} onClick={() => updateAudioTrack({ muted: !selectedAudioTrack.muted })}>MUTE</button>
                <button className={selectedAudioTrack.locked ? "active" : ""} onClick={() => updateAudioTrack({ locked: !selectedAudioTrack.locked })}>LOCK</button>
                <button className={selectedAudioTrack.target ? "active" : ""} onClick={() => updateAudioTrack({ target: !selectedAudioTrack.target })}>TARGET</button>
                <button className={selectedAudioTrack.syncLock !== false ? "active" : ""} onClick={() => updateAudioTrack({ syncLock: selectedAudioTrack.syncLock === false })}>SYNC</button>
              </div>
              {selectedAudioClip ? (
                <>
                  <div className="inspector-divider">SELECTED CLIP · {selectedAudioClip.name}</div>
                  <label className="field"><span>Start</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={duration} step="0.01" value={selectedAudioClip.start} onChange={(event) => updateAudioClip({ start: snapTime(Number(event.target.value), snapCandidates, 0.08, snapping) })} /><strong>{formatTime(selectedAudioClip.start)}</strong></div></label>
                  <label className="field"><span>Source in</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.max(0, (assets.find((asset) => asset.id === selectedAudioClip.assetId)?.duration ?? selectedAudioClip.duration) - selectedAudioClip.duration * audioPlaybackRate(selectedAudioClip))} step="0.01" value={selectedAudioClip.sourceStart} onChange={(event) => updateAudioClip({ sourceStart: Number(event.target.value) })} /><strong>{selectedAudioClip.sourceStart.toFixed(2)}s</strong></div></label>
                  {audioPlaybackRate(selectedAudioClip) !== 1 && <small>Varispeed {Math.round(audioPlaybackRate(selectedAudioClip) * 100)}% · pitch follows speed.</small>}
                  {selectedAudioClip.envelopes?.some((envelope) => envelope.origin) && <div role="note"><small>Original fade curves preserved across this edit. Changing a fade replaces that edge’s retained curve.</small><button onClick={() => updateAudioClip({ envelopes: selectedAudioClip.envelopes?.filter((envelope) => !envelope.origin) })}>Clear preserved clip fades</button></div>}
                  <label className="field"><span>Clip volume</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="2" step="0.01" value={selectedAudioClip.gain} onChange={(event) => updateAudioClip({ gain: Number(event.target.value) })} /><strong>{Math.round(selectedAudioClip.gain * 100)}%</strong></div></label>
                  <label className="field"><span>Clip pan</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="-1" max="1" step="0.01" value={selectedAudioClip.pan} onChange={(event) => updateAudioClip({ pan: Number(event.target.value) })} /><strong>{selectedAudioClip.pan === 0 ? "CENTER" : selectedAudioClip.pan < 0 ? `L${Math.round(Math.abs(selectedAudioClip.pan) * 100)}` : `R${Math.round(selectedAudioClip.pan * 100)}`}</strong></div></label>
                  <div className="fade-fields"><label className="field"><span>Fade in</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.min(5, selectedAudioClip.duration / 2)} step="0.01" value={selectedAudioClip.fadeIn} onChange={(event) => updateAudioClip({ fadeIn: Number(event.target.value) })} /><strong>{selectedAudioClip.fadeIn.toFixed(2)}s</strong></div></label><label className="field"><span>Fade out</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={Math.min(5, selectedAudioClip.duration / 2)} step="0.01" value={selectedAudioClip.fadeOut} onChange={(event) => updateAudioClip({ fadeOut: Number(event.target.value) })} /><strong>{selectedAudioClip.fadeOut.toFixed(2)}s</strong></div></label></div>
                  <div className="audio-assist-row"><button onClick={setSelectedAudioClipUnity}><Gauge size={12} /> Unity</button><button onClick={applySelectedAudioFade}><AudioWaveform size={12} /> Smooth fades</button><button onClick={crossfadeSelectedAudio} title="Constant-power crossfade with the adjacent clip"><AudioWaveform size={12} /> Crossfade</button><button onClick={duckOtherAudioUnderSelection}><SlidersHorizontal size={12} /> Auto duck</button><button className={selectedAudioClip.muted ? "active danger" : ""} onClick={() => updateAudioClip({ muted: !selectedAudioClip.muted })}>{selectedAudioClip.muted ? <VolumeX size={12} /> : <Volume2 size={12} />} {selectedAudioClip.muted ? "Muted" : "Mute"}</button></div>
                  <div className="inspector-divider">VOLUME AUTOMATION · {selectedAudioClip.automation?.length ?? 0} POINTS</div>
                  <button className="add-keyframe-button" onClick={addAudioAutomationPoint}><Diamond size={13} fill="currentColor" /> Add point at playhead</button>
                  {selectedAutomationPoint && (
                    <div className="audio-automation-editor">
                      <label className="field"><span>Point time</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max={selectedAudioClip.duration} step="0.01" value={selectedAutomationPoint.time} onChange={(event) => updateAudioAutomationPoint({ time: Number(event.target.value) })} /><strong>{selectedAutomationPoint.time.toFixed(2)}s</strong></div></label>
                      <label className="field"><span>Point volume</span><div className="value-line"><input type="range" {...continuousEditHandlers} min="0" max="2" step="0.01" value={selectedAutomationPoint.gain} onChange={(event) => updateAudioAutomationPoint({ gain: Number(event.target.value) })} /><strong>{Math.round(selectedAutomationPoint.gain * 100)}%</strong></div></label>
                      <button onClick={removeAudioAutomationPoint}><Trash2 size={12} /> Remove point</button>
                    </div>
                  )}
                  <button className="delete-placement" disabled={selectedAudioTrack.locked} onClick={() => deleteTimelineSelection(false, "audio")}><Trash2 size={14} /> Remove audio clip</button>
                </>
              ) : <div className="empty-layer-inspector">Drag audio from the Project panel to an A-track, then select the clip for fades and automation.</div>}
            </div>
          )}
        </aside>
  );
}
