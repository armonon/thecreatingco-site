import { useRef } from "react";
import { placeBaseCut } from "../lib/timeline-edit.ts";
import { snapToFrame } from "../lib/format.ts";
import type { BaseCut } from "../lib/sequencer.ts";
import type { AudioClip } from "../lib/pro-editor.ts";
import { hasCompositionCycle } from "../lib/pro-editor.ts";
import type { CompositionLayer, StudioComposition } from "../lib/compositor.ts";
import type { Placement } from "./editor-foundation.ts";
import type { EditorKeyboardShortcutContext } from "./use-editor-keyboard-shortcuts.ts";
import { splitEditorialAudio } from "../lib/source-edit.ts";

type Clipboard = { kind: "base"; clips: BaseCut[]; audio: AudioClip[] } | { kind: "overlay"; clip: Placement } | { kind: "audio"; clip: AudioClip } | { kind: "layer"; layer: CompositionLayer; compositionId: string; trackKind: "video" | "audio" };
type Context = EditorKeyboardShortcutContext & {
  activePanel: "audio" | "section" | "base" | "clip" | "track";
  busy: boolean; activeComposition: StudioComposition; compositions: StudioComposition[]; selectedCompTrackId: string;
  setSelectedCompLayerId(id: string): void;
  updateComposition(patch: Partial<StudioComposition>): void;
};

/** One editing action layer for keyboard, native menus, palette and context menus.
 * Clipboard payloads are detached data; never retain mutable document objects. */
export function useEditorEditActions(c: Context) {
  const clipboard = useRef<Clipboard | null>(null);
  // The factory only captures this ref. Reads/writes occur in user commands,
  // never while deriving selection or availability during render.
  // eslint-disable-next-line react-hooks/refs
  return createEditorEditActions(c, clipboard);
}

export function createEditorEditActions(c: Context, clipboard: { current: Clipboard | null }) {
  const inComp = c.workspaceView === "composition";
  const audio = c.activePanel === "audio" ? c.audioClips.find((clip) => clip.id === c.selectedAudioClipId) : undefined;
  const placement = c.activePanel === "clip" ? c.selectedPlacement : null;
  const selectedCuts = c.activePanel === "base" ? c.baseCuts.filter((clip) => c.selectedBaseCutIds.includes(clip.id) || clip.id === c.selectedBaseCutId) : [];
  const locked = inComp ? Boolean(c.selectedCompLayer?.locked || c.activeComposition?.tracks?.find((track) => track.id === c.selectedCompLayer?.trackId)?.locked)
    : audio ? Boolean(c.audioTracks.find((track) => track.id === audio.trackId)?.locked)
    : placement ? Boolean(c.clipTracks.find((track) => track.id === placement.trackId)?.locked)
    : selectedCuts.some((clip) => clip.locked) || (c.linkedSelection && c.audioClips.some((clip) => selectedCuts.some((cut) => cut.id === clip.linkedVideoId) && c.audioTracks.find((track) => track.id === clip.trackId)?.locked));
  const hasSelection = inComp ? Boolean(c.selectedCompLayer) : Boolean(audio || placement || selectedCuts.length);
  const copy = () => {
    if (!hasSelection) return c.setStatus("Select a clip or composition layer to copy.");
    if (inComp && c.selectedCompLayer) clipboard.current = { kind: "layer", layer: structuredClone(c.selectedCompLayer), compositionId: c.activeComposition.id, trackKind: c.activeComposition.tracks?.find((track) => track.id === c.selectedCompLayer?.trackId)?.kind ?? "video" };
    else if (audio) clipboard.current = { kind: "audio", clip: structuredClone(audio) };
    else if (placement) clipboard.current = { kind: "overlay", clip: structuredClone(placement) };
    else clipboard.current = { kind: "base", clips: structuredClone(selectedCuts), audio: structuredClone(c.linkedSelection ? c.audioClips.filter((clip) => selectedCuts.some((cut) => cut.id === clip.linkedVideoId)) : []) };
    c.setStatus("Selection copied. Paste places it at the active document's playhead.");
  };
  const remove = (ripple = false) => {
    if (c.busy || locked || !hasSelection) return c.setStatus(locked ? "Unlock the selection and its linked tracks before editing." : "Select an editable clip or layer first.");
    if (inComp && c.selectedCompLayer) {
      if (c.selectedKeyframeId) c.deleteCompositionKeyframe();
      else c.removeCompositionLayer(c.selectedCompLayer.id);
    } else c.deleteTimelineSelection(ripple, audio ? "audio" : placement ? "overlay" : "base");
  };
  const paste = (duplicate = false) => {
    const payload = clipboard.current;
    if (c.busy || !payload) return c.setStatus("Copy a clip or layer before pasting.");
    if (inComp !== (payload.kind === "layer")) return c.setStatus("Paste into the same document type as the copied selection. Nest a composition to move it into the sequence.");
    const at = snapToFrame(inComp ? c.compositionTime : c.currentTime, c.exportFrameRate);
    if (payload.kind === "layer") {
      if (payload.layer.compositionId && hasCompositionCycle(c.compositions, c.activeComposition.id, payload.layer.compositionId)) return c.setStatus("Paste blocked: this layer would create a circular composition dependency.");
      const tracks = c.activeComposition.tracks ?? [];
      const original = tracks.find((track) => track.id === payload.layer.trackId);
      const track = tracks.find((track) => track.id === c.selectedCompTrackId) ?? original ?? tracks.find((track) => track.kind === "video");
      if (!track || track.locked) return c.setStatus("Select an unlocked composition track before pasting.");
      if (track.kind !== payload.trackKind) return c.setStatus(`This layer needs a ${payload.trackKind} track.`);
      const layer = { ...structuredClone(payload.layer), id: `layer-${crypto.randomUUID()}`, name: duplicate ? `${payload.layer.name} COPY` : payload.layer.name, trackId: track.id, parentId: payload.compositionId === c.activeComposition.id ? payload.layer.parentId : undefined, start: duplicate ? payload.layer.start : at,
        keyframes: payload.layer.keyframes.map((key) => ({ ...key, id: `keyframe-${crypto.randomUUID()}` })),
        roto: payload.layer.roto ? { ...structuredClone(payload.layer.roto), keyframes: payload.layer.roto.keyframes.map((key) => ({ ...key, id: `roto-${crypto.randomUUID()}` })) } : undefined };
      c.updateComposition({ layers: [...c.activeComposition.layers, layer] });
      c.setSelectedCompLayerId(layer.id);
    } else if (payload.kind === "audio") {
      const track = c.audioTracks.find((track) => track.id === payload.clip.trackId);
      if (!track || track.locked) return c.setStatus("The copied audio track is missing or locked.");
      const clip = { ...structuredClone(payload.clip), id: `audio-${crypto.randomUUID()}`, linkedVideoId: undefined, start: duplicate ? payload.clip.start + payload.clip.duration : at };
      c.checkpoint(); c.setAudioClips((items) => [...items, clip]); c.setSelectedAudioClipId(clip.id); c.setSelectedBaseCutId(null); c.setSelectedPlacementId(null); c.setActivePanel("audio");
    } else if (payload.kind === "overlay") {
      const track = c.clipTracks.find((track) => track.id === c.selectedTrackId) ?? c.clipTracks.find((track) => track.id === payload.clip.trackId);
      if (!track || track.locked) return c.setStatus("Select an unlocked video track before pasting.");
      const clip = { ...structuredClone(payload.clip), id: `placement-${crypto.randomUUID()}`, trackId: track.id, start: duplicate ? payload.clip.start + payload.clip.duration : at };
      c.checkpoint(); c.setPlacements((items) => [...items, clip].sort((a, b) => a.start - b.start));
      c.setSelectedPlacementId(clip.id); c.setSelectedBaseCutId(null); c.setSelectedBaseCutIds([]); c.setSelectedAudioClipId(null); c.setActivePanel("clip");
    } else {
      if (!payload.clips.length) return;
      const start = Math.min(...payload.clips.map((clip) => clip.start));
      const end = Math.max(...payload.clips.map((clip) => clip.start + clip.duration));
      const offset = (duplicate ? end : at) - start;
      const ids = new Map(payload.clips.map((clip) => [clip.id, `base-cut-${crypto.randomUUID()}`]));
      const groups = new Map(payload.clips.filter((clip) => clip.groupId).map((clip) => [clip.groupId, `group-${crypto.randomUUID()}`]));
      const clips = payload.clips.map((clip) => ({ ...structuredClone(clip), id: ids.get(clip.id)!, groupId: clip.groupId ? groups.get(clip.groupId) : undefined, start: clip.start + offset }));
      if (c.baseCuts.some((existing) => existing.locked && clips.some((clip) => clip.start < existing.start + existing.duration && clip.start + clip.duration > existing.start))) return c.setStatus("Paste would overwrite a protected clip.");
      if (payload.audio.some((clip) => !c.audioTracks.some((track) => track.id === clip.trackId && !track.locked))) return c.setStatus("Restore or unlock the copied selection's linked audio tracks before pasting.");
      c.checkpoint(); c.setBaseCuts((items) => clips.reduce((result, clip) => placeBaseCut(result, clip, "overwrite"), items));
      c.setAudioClips((items) => [...items, ...payload.audio.map((clip) => ({ ...structuredClone(clip), id: `audio-${crypto.randomUUID()}`, start: clip.start + offset, linkedVideoId: ids.get(clip.linkedVideoId ?? "") }))]);
      c.setSelectedBaseCutIds(clips.map((clip) => clip.id)); c.setSelectedBaseCutId(clips[0].id); c.setSelectedPlacementId(null); c.setSelectedAudioClipId(null); c.setActivePanel("base");
    }
    c.setStatus(duplicate ? "Duplicated selection. Undo restores the edit." : "Pasted into the active document. Undo restores the edit.");
  };
  return { hasSelection, locked, actions: {
    copy,
    cut: () => { if (!c.busy && !locked && hasSelection) { copy(); if (inComp && c.selectedCompLayer) c.removeCompositionLayer(c.selectedCompLayer.id); else remove(); } },
    paste: () => paste(),
    duplicate: () => { if (!c.busy && !locked && hasSelection) { const previous = clipboard.current; copy(); paste(true); clipboard.current = previous; } },
    delete: () => remove(), "ripple-delete": () => remove(true),
    split: () => {
      if (c.busy || locked) return;
      if (inComp) return c.setStatus("Layer splitting is not supported here. Trim the layer edges in the composition timeline.");
      if (audio) {
        const pieces = splitEditorialAudio(audio, snapToFrame(c.currentTime, c.exportFrameRate), `audio-${crypto.randomUUID()}`);
        if (!pieces) return c.setStatus("Move the playhead inside the audio clip, away from its edges.");
        c.checkpoint(); c.setAudioClips((items) => items.flatMap((item) => item.id === audio.id ? pieces : [item]));
        c.setSelectedAudioClipId(pieces[1].id); c.setStatus("Audio split. Source, fades and automation preserved.");
      } else if (placement) c.splitPlacementAt(placement, c.currentTime);
      else if (c.activePanel === "base" && c.selectedBaseCut) c.splitSelectedBaseCut();
      else c.setStatus("Select a clip under the playhead before splitting.");
    },
  } };
}
