import type { Dispatch,RefObject,SetStateAction } from "react";
import { createClipEffect } from "../lib/clip-effects.ts";
import type { CompositionLayer,CompositionTrack,StudioComposition } from "../lib/compositor";
import { contextAction,type ContextAction } from "../lib/context-menu.ts";
import { effectiveCutSelection,rippleDeleteSelectedCuts } from "../lib/edit-selection.ts";
import type { AudioClip,AudioTrack,TimelineMarker } from "../lib/pro-editor";
import type { BaseCut } from "../lib/sequencer";
import type { ContextMenuModel,ContextTarget } from "./editor-context-menu";
import type { ClipTrack,Placement } from "./editor-foundation";
import type { MediaAsset } from "./media-browser";
import type { ProjectPanelTab } from "./project-panel-tabs";
import { createEditorialAudio } from "../lib/source-edit.ts";

export type EditorContextState = {
  runCommand: (id: import("./editor-command-registry").EditorCommandId) => void;
  analyzing: boolean;
  rendering: boolean;
  rotoTracking: { active: boolean; current: number; total: number; direction: string; };
  selectedAudioClip: AudioClip | null;
  audioTracks: AudioTrack[];
  checkpoint: () => void;
  setAudioClips: Dispatch<SetStateAction<AudioClip[]>>;
  setSelectedAudioClipId: Dispatch<SetStateAction<string | null>>;
  setSelectedAutomationPointId: Dispatch<SetStateAction<string | null>>;
  selectedPlacement: Placement | null;
  clipTracks: ClipTrack[];
  setPlacements: Dispatch<SetStateAction<Placement[]>>;
  setSelectedPlacementId: Dispatch<SetStateAction<string | null>>;
  selectedBaseCut: BaseCut | null;
  baseCuts: BaseCut[];
  selectedBaseCutIds: string[];
  linkedSelection: boolean;
  audioClips: AudioClip[];
  setStatus: Dispatch<SetStateAction<string>>;
  setBaseCuts: Dispatch<SetStateAction<BaseCut[]>>;
  setSelectedBaseCutId: Dispatch<SetStateAction<string | null>>;
  setSelectedBaseCutIds: Dispatch<SetStateAction<string[]>>;
  setActivePanel: Dispatch<SetStateAction<"section" | "base" | "clip" | "track" | "audio">>;
  placements: Placement[];
  setSelectedTrackId: Dispatch<SetStateAction<string>>;
  setSelectedAudioTrackId: Dispatch<SetStateAction<string>>;
  activeComposition: StudioComposition;
  setSelectedCompLayerId: Dispatch<SetStateAction<string>>;
  setSelectedCompTrackId: Dispatch<SetStateAction<string>>;
  setSelectedKeyframeId: Dispatch<SetStateAction<string | null>>;
  selectedBaseCutId: string | null;
  selectedPlacementId: string | null;
  updateBaseCut: (patch: Partial<BaseCut>) => void;
  updatePlacement: (patch: Partial<Placement>) => void;
  mediaName: (assetId: string) => string | undefined;
  razorAt: (time: number, preferredCutId?: string) => void;
  currentTime: number;
  splitPlacementAt: (placement: Placement, time: number) => void;
  setProjectPanelTab: Dispatch<SetStateAction<ProjectPanelTab>>;
  isPro: boolean;
  nestSelection: () => void;
  setClipTracks: Dispatch<SetStateAction<ClipTrack[]>>;
  addClipTrack: () => void;
  moveClipTrackTo: (trackId: string, targetTrackId: string) => void;
  removeClipTrack: (trackId: string) => void;
  addAudioTrack: () => void;
  updateAudioTrackById: (trackId: string, patch: Partial<AudioTrack>) => void;
  moveAudioTrackTo: (trackId: string, targetTrackId: string) => void;
  removeAudioTrack: (trackId: string) => void;
  updateAudioClip: (patch: Partial<AudioClip>) => void;
  crossfadeSelectedAudio: () => void;
  assets: MediaAsset[];
  openSourceAsset: (asset: MediaAsset) => void;
  setAssets: Dispatch<SetStateAction<MediaAsset[]>>;
  cancelProxy: (assetId: string) => Promise<void>;
  buildProxy: (assetId: string) => Promise<void>;
  nativeProxyJobByAssetRef: RefObject<Map<string, string>>;
  removeAsset: (id: string) => void;
  activeCompTrackById: Map<string, CompositionTrack>;
  addCompositionKeyframe: () => void;
  setCompositionLayerFlags: (layerId: string, patch: Pick<CompositionLayer, "enabled"> | Pick<CompositionLayer, "locked">) => void;
  removeCompositionLayer: (layerId: string) => void;
  addCompositionTrack: (kind: CompositionTrack["kind"]) => void;
  updateCompositionTrack: (trackId: string, patch: Partial<CompositionTrack>) => void;
  moveCompositionTrack: (trackId: string, direction: "up" | "down") => void;
  removeCompositionTrack: (trackId: string) => void;
  mainName: string;
  editableBaseCuts: () => BaseCut[];
  setMontageEnabled: Dispatch<SetStateAction<boolean>>;
  mainFile: File | null;
  duration: number;
  createComposition: () => void;
  addMarker: (kind?: TimelineMarker["kind"]) => void;
  undo: () => void;
  canUndo: boolean;
  redo: () => void;
  canRedo: boolean;
};

/** Context actions share the existing state owner and undo/lock-aware edit commands. */
export function createEditorContextActions(state: EditorContextState) {
  const { analyzing, rendering, rotoTracking, selectedAudioClip, audioTracks, checkpoint, setAudioClips, setSelectedAudioClipId, setSelectedAutomationPointId, selectedPlacement, clipTracks, setPlacements, setSelectedPlacementId, selectedBaseCut, baseCuts, selectedBaseCutIds, linkedSelection, audioClips, setStatus, setBaseCuts, setSelectedBaseCutId, setSelectedBaseCutIds, setActivePanel, placements, setSelectedTrackId, setSelectedAudioTrackId, activeComposition, setSelectedCompLayerId, setSelectedCompTrackId, setSelectedKeyframeId, selectedBaseCutId, selectedPlacementId, updateBaseCut, updatePlacement, mediaName, razorAt, currentTime, setProjectPanelTab, isPro, nestSelection, setClipTracks, addClipTrack, moveClipTrackTo, removeClipTrack, addAudioTrack, updateAudioTrackById, moveAudioTrackTo, removeAudioTrack, updateAudioClip, crossfadeSelectedAudio, assets, openSourceAsset, setAssets, cancelProxy, buildProxy, nativeProxyJobByAssetRef, removeAsset, activeCompTrackById, addCompositionKeyframe, setCompositionLayerFlags, addCompositionTrack, updateCompositionTrack, moveCompositionTrack, removeCompositionTrack, mainName, editableBaseCuts, setMontageEnabled, mainFile, duration, createComposition, addMarker, canUndo, canRedo } = state;
  function deleteTimelineSelection(ripple = false, target?: "base" | "overlay" | "audio") {
    if (analyzing || rendering || rotoTracking.active) return;
    if (selectedAudioClip && (!target || target === "audio")) {
      if (audioTracks.find((track) => track.id === selectedAudioClip.trackId)?.locked) return;
      checkpoint(); setAudioClips((items) => items.filter((clip) => clip.id !== selectedAudioClip.id)); setSelectedAudioClipId(null); setSelectedAutomationPointId(null);
    } else if (selectedPlacement && (!target || target === "overlay")) {
      if (clipTracks.find((track) => track.id === (selectedPlacement.trackId ?? clipTracks[0]?.id))?.locked) return;
      checkpoint(); setPlacements((items) => items.filter((clip) => clip.id !== selectedPlacement.id)); setSelectedPlacementId(null);
    } else if (selectedBaseCut && (!target || target === "base")) {
      const ids = effectiveCutSelection(baseCuts, selectedBaseCutIds, selectedBaseCut.id);
      if (baseCuts.some((clip) => clip.locked && (ids.has(clip.id) || ripple)) || (linkedSelection && audioClips.some((clip) => clip.linkedVideoId && ids.has(clip.linkedVideoId) && audioTracks.find((track) => track.id === clip.trackId)?.locked))) { setStatus("Unlock the affected clips and linked audio tracks before deleting."); return; }
      checkpoint(); setBaseCuts((items) => ripple ? rippleDeleteSelectedCuts(items, ids) : items.filter((clip) => !ids.has(clip.id)));
      if (linkedSelection) setAudioClips((items) => items.filter((clip) => !clip.linkedVideoId || !ids.has(clip.linkedVideoId)));
      setSelectedBaseCutId(null); setSelectedBaseCutIds([]);
    } else return;
    setStatus(ripple ? "Ripple-deleted selection. Undo restores the edit." : "Deleted selection. Undo restores the edit.");
  }
  const selectContextTarget = ({ kind, id }: ContextTarget) => {
    if (kind === "base") { setSelectedBaseCutId(id); setSelectedBaseCutIds([id]); setSelectedPlacementId(null); setSelectedAudioClipId(null); setActivePanel("base"); }
    if (kind === "overlay") { const clip = placements.find((item) => item.id === id); setSelectedPlacementId(id); setSelectedBaseCutId(null); setSelectedAudioClipId(null); setSelectedTrackId(clip?.trackId ?? clipTracks[0]?.id ?? ""); setActivePanel("clip"); }
    if (kind === "video-track") { setSelectedTrackId(id); setSelectedPlacementId(null); setSelectedBaseCutId(null); setSelectedAudioClipId(null); setActivePanel("track"); }
    if (kind === "audio" || kind === "audio-track") { const clip = audioClips.find((item) => item.id === id); setSelectedAudioClipId(kind === "audio" ? id : null); setSelectedAudioTrackId(kind === "audio" ? clip?.trackId ?? "" : id); setSelectedBaseCutId(null); setSelectedPlacementId(null); setActivePanel("audio"); }
    if (kind === "layer") { const layer = activeComposition?.layers.find((item) => item.id === id); setSelectedCompLayerId(id); setSelectedCompTrackId(layer?.trackId ?? ""); setSelectedKeyframeId(null); }
    if (kind === "comp-track") { setSelectedCompTrackId(id); setSelectedCompLayerId(""); setSelectedKeyframeId(null); }
  };
  const buildContextMenu = ({ kind, id }: ContextTarget): ContextMenuModel | null => {
    const busy = analyzing || rendering || rotoTracking.active;
    const action = (id: string, label: string, run: () => void, enabled = true, danger = false): ContextAction => contextAction(id, label, run, !busy && enabled, danger);
    if (kind === "base" || kind === "overlay") {
      const clip = kind === "base" ? baseCuts.find((item) => item.id === id) : placements.find((item) => item.id === id);
      if (!clip) return null;
      const unlocked = kind === "base" ? !baseCuts.find((item) => item.id === id)?.locked : !clipTracks.find((track) => track.id === (placements.find((item) => item.id === id)?.trackId ?? clipTracks[0]?.id))?.locked;
      const selected = kind === "base" ? selectedBaseCutId === id : selectedPlacementId === id;
      const update = (patch: Partial<BaseCut> & Partial<Placement>) => { if (selected && unlocked) { if (kind === "base") updateBaseCut(patch); else updatePlacement(patch); } };
      return { title: mediaName(clip.assetId) ?? "Timeline clip", actions: [
        action("inspect", "Clip properties", () => setActivePanel(kind === "base" ? "base" : "clip")),
        action("split", "Split at playhead", () => state.runCommand("split"), selected && unlocked && currentTime > clip.start + .04 && currentTime < clip.start + clip.duration - .04),
        action("effects", "Browse effects…", () => setProjectPanelTab("effects"), unlocked),
        action("glow", "Add Glow", () => update({ effects: [...(clip.effects ?? []), createClipEffect("glow")] }), unlocked),
        action("fade", "Add short fade in / out", () => update({ fadeIn: Math.min(.25, clip.duration / 2), fadeOut: Math.min(.25, clip.duration / 2) }), unlocked),
        action("clear-fade", "Remove fades", () => update({ fadeIn: 0, fadeOut: 0 }), unlocked),
        action("copy", "Copy clip", () => state.runCommand("copy")),
        action("cut", "Cut clip", () => state.runCommand("cut"), unlocked),
        action("duplicate", "Duplicate clip", () => state.runCommand("duplicate"), unlocked),
        ...(kind === "base" && isPro ? [action("nest", "Nest in composition", nestSelection, unlocked)] : []),
        action("delete", "Delete clip", () => state.runCommand("delete"), unlocked, true),
      ] };
    }
    if (kind === "video-track") {
      const track = clipTracks.find((item) => item.id === id); if (!track) return null;
      const index = clipTracks.indexOf(track);
      const patch = (value: Partial<ClipTrack>) => { checkpoint(); setClipTracks((items) => items.map((item) => item.id === id ? { ...item, ...value } : item)); };
      return { title: track.name, actions: [
        action("add", "Add video track", addClipTrack), action("lock", track.locked ? "Unlock track" : "Lock track", () => patch({ locked: !track.locked })),
        action("visibility", track.enabled ? "Hide track" : "Show track", () => patch({ enabled: !track.enabled }), !track.locked),
        action("up", "Move track up", () => moveClipTrackTo(id, clipTracks[index + 1].id), !track.locked && index < clipTracks.length - 1 && !clipTracks[index + 1]?.locked),
        action("down", "Move track down", () => moveClipTrackTo(id, clipTracks[index - 1].id), !track.locked && index > 0 && !clipTracks[index - 1]?.locked),
        action("remove", "Remove empty track", () => removeClipTrack(id), !track.locked && clipTracks.length > 1 && !placements.some((item) => (item.trackId ?? clipTracks[0]?.id) === id), true),
      ] };
    }
    if (kind === "audio-track") {
      const track = audioTracks.find((item) => item.id === id); if (!track) return null;
      const index = audioTracks.indexOf(track);
      return { title: track.name, actions: [
        action("add", "Add audio track", addAudioTrack), action("lock", track.locked ? "Unlock track" : "Lock track", () => updateAudioTrackById(id, { locked: !track.locked })),
        action("mute", track.muted ? "Unmute track" : "Mute track", () => updateAudioTrackById(id, { muted: !track.muted }), !track.locked),
        action("solo", track.solo ? "Unsolo track" : "Solo track", () => updateAudioTrackById(id, { solo: !track.solo }), !track.locked),
        action("up", "Move track up", () => moveAudioTrackTo(id, audioTracks[index - 1].id), !track.locked && index > 0 && !audioTracks[index - 1]?.locked),
        action("down", "Move track down", () => moveAudioTrackTo(id, audioTracks[index + 1].id), !track.locked && index < audioTracks.length - 1 && !audioTracks[index + 1]?.locked),
        action("remove", "Remove empty track", () => removeAudioTrack(id), !track.locked && audioTracks.length > 1 && !audioClips.some((item) => item.trackId === id), true),
      ] };
    }
    if (kind === "audio") {
      const clip = audioClips.find((item) => item.id === id); if (!clip) return null;
      const unlocked = !audioTracks.find((track) => track.id === clip.trackId)?.locked;
      return { title: clip.name, actions: [action("inspect", "Audio properties", () => setActivePanel("audio")),
        action("split", "Split audio at playhead", () => state.runCommand("split"), unlocked && currentTime > clip.start + .02 && currentTime < clip.start + clip.duration - .02),
        action("fade", "Add short fade in / out", () => updateAudioClip({ fadeIn: Math.min(.25, clip.duration / 2), fadeOut: Math.min(.25, clip.duration / 2) }), unlocked),
        action("clear-fade", "Remove fades", () => updateAudioClip({ fadeIn: 0, fadeOut: 0 }), unlocked),
        action("crossfade", "Crossfade with adjacent clip", crossfadeSelectedAudio, unlocked && audioClips.some((item) => item.id !== id && item.trackId === clip.trackId)),
        action("copy", "Copy audio clip", () => state.runCommand("copy")),
        action("cut", "Cut audio clip", () => state.runCommand("cut"), unlocked),
        action("duplicate", "Duplicate audio clip", () => state.runCommand("duplicate"), unlocked),
        action("delete", "Delete audio clip", () => state.runCommand("delete"), unlocked, true),
      ] };
    }
    if (kind === "media") {
      const asset = assets.find((item) => item.id === id); if (!asset) return null;
      const audioTrack = audioTracks?.find((track) => !track.locked);
      return { title: asset.name, actions: [action("open", "Open in Source monitor", () => openSourceAsset(asset), Boolean(asset.url)),
        ...(isPro && asset.kind !== "image" && asset.hasAudio !== false ? [action("place-audio", `Add audio at playhead${audioTrack ? ` · ${audioTrack.name}` : ""}`, () => {
          if (!audioTrack) return;
          const clip = createEditorialAudio(asset, audioTrack.id, currentTime, `audio-clip-${crypto.randomUUID()}`);
          checkpoint(); setAudioClips((items) => [...items, clip]); setSelectedAudioClipId(clip.id); setSelectedAudioTrackId(audioTrack.id); setActivePanel("audio");
          setStatus(`${asset.name} placed on ${audioTrack.name}.`);
        }, Boolean(asset.url && audioTrack))] : []),
        action("favorite", asset.favorite ? "Remove from favorites" : "Add to favorites", () => setAssets((items) => items.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item))),
        ...(asset.kind === "video" ? [action("proxy", asset.proxyState === "building" ? "Cancel proxy" : "Build proxy", () => { if (asset.proxyState === "building") void cancelProxy(id); else void buildProxy(id); }, Boolean(asset.url) && (asset.proxyState !== "building" || nativeProxyJobByAssetRef.current.has(id)))] : []),
        action("remove", "Remove from project…", () => removeAsset(id), true, true),
      ] };
    }
    if (kind === "layer") {
      const layer = activeComposition?.layers.find((item) => item.id === id); if (!layer) return null;
      const track = activeCompTrackById.get(layer.trackId ?? ""); const unlocked = !layer.locked && !track?.locked;
      return { title: layer.name, actions: [action("effects", "Browse layer effects…", () => setProjectPanelTab("effects"), unlocked && track?.kind !== "audio"),
        action("keyframe", "Add keyframe at playhead", addCompositionKeyframe, unlocked),
        action("copy", "Copy layer", () => state.runCommand("copy")),
        action("duplicate", "Duplicate layer", () => state.runCommand("duplicate"), unlocked),
        action("visibility", layer.enabled ? "Disable layer" : "Enable layer", () => setCompositionLayerFlags(id, { enabled: !layer.enabled }), unlocked),
        action("lock", layer.locked ? "Unlock layer" : "Lock layer", () => setCompositionLayerFlags(id, { locked: !layer.locked }), !track?.locked),
        action("cut", "Cut layer", () => state.runCommand("cut"), unlocked),
        action("remove", "Delete layer", () => state.runCommand("delete"), unlocked, true),
      ] };
    }
    if (kind === "comp-track") {
      const track = activeComposition?.tracks?.find((item) => item.id === id); if (!track) return null;
      const tracks = [...(activeComposition?.tracks ?? [])].reverse(); const index = tracks.findIndex((item) => item.id === id);
      return { title: track.name, actions: [action("add-video", "Add video track", () => addCompositionTrack("video")), action("add-audio", "Add audio track", () => addCompositionTrack("audio")),
        action("lock", track.locked ? "Unlock track" : "Lock track", () => updateCompositionTrack(id, { locked: !track.locked })),
        action("enabled", track.enabled ? "Disable track" : "Enable track", () => updateCompositionTrack(id, { enabled: !track.enabled }), !track.locked),
        action("up", "Move track up", () => moveCompositionTrack(id, "up"), !track.locked && index > 0 && !tracks[index - 1]?.locked),
        action("down", "Move track down", () => moveCompositionTrack(id, "down"), !track.locked && index < tracks.length - 1 && !tracks[index + 1]?.locked),
        action("remove", "Remove empty track", () => removeCompositionTrack(id), !track.locked && !activeComposition?.layers.some((item) => item.trackId === id), true),
      ] };
    }
    if (kind === "main-source") return { title: mainName, actions: [action("edit", "Edit this clip", () => { const seed = editableBaseCuts(); if (!seed.length) return; checkpoint(); setBaseCuts(seed); setMontageEnabled(true); setSelectedBaseCutId(seed[0].id); setActivePanel("base"); }, Boolean(mainFile)), action("split", "Split at playhead", () => razorAt(currentTime), Boolean(mainFile) && currentTime > .04 && currentTime < duration - .04)] };
    if (kind === "timeline") return { title: "Sequence", actions: [action("video", "Add video track", addClipTrack), ...(isPro ? [action("audio", "Add audio track", addAudioTrack), action("comp", "New composition", createComposition)] : []), action("marker", "Add marker at playhead", () => addMarker()), action("undo", "Undo", () => state.runCommand("undo"), canUndo), action("redo", "Redo", () => state.runCommand("redo"), canRedo)] };
    return null;
  };
  return { deleteTimelineSelection, selectContextTarget, buildContextMenu };
}
