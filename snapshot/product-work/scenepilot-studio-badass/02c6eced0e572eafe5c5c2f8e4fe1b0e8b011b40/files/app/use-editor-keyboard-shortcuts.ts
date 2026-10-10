import { commandForKey, editorOwnsInput, NATIVE_COMMAND_ALIASES } from "./editor-input-routing";
import type { EditorCommandItem } from "./editor-command-registry";
import { desktopMediaBridge } from "./desktop-media";
import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import type { BaseCut } from "../lib/sequencer";
import type { AudioClip, AudioTrack, TimelineMarker, TimelineRange, TimelineTool } from "../lib/pro-editor";
import type { DynamicTrimSelection } from "../lib/dynamic-trim";
import type { CompositionLayer } from "../lib/compositor";
import type { RotoPoint } from "../lib/rotoscope";
import type { ProductWorkspace } from "../lib/product-journey";
import type { MediaAsset } from "./media-browser";
import type { ClipTrack, Placement } from "./editor-foundation";

type SetValue<T> = Dispatch<SetStateAction<T>>;
type ActivePanel = "section" | "clip" | "audio" | "base" | "track";
type EditorMode = "auto" | "pro";
type WorkspaceView = "sequence" | "composition";
type RotoMode = "off" | "select" | "add" | "subtract" | "hair" | "solid";

export type EditorKeyboardShortcutContext = {
  markMonitorBoundary(boundary: "in" | "out"): void;
  stepMonitorFrame(direction: -1 | 1, large?: boolean): void;
  deleteTimelineSelection(ripple?: boolean, target?: "base" | "overlay" | "audio"): void;
  addMarker(kind?: TimelineMarker["kind"]): void; audioClips: AudioClip[]; audioTracks: AudioTrack[]; baseCuts: BaseCut[]; checkpoint(): void;
  commandPaletteOpen: boolean; compositionTime: number; currentTime: number; deleteCompositionKeyframe(): void;
  duration: number; dynamicTrimSelection: DynamicTrimSelection | null; editSourceToTimeline(mode: "insert" | "overwrite"): void; editorMode: EditorMode; exportFrameRate: number;
  extractInOut(): void; groupCurrentSelection(): void; isPro: boolean; linkedSelection: boolean; matchFrameAtPlayhead(): void; monitorMode: "source" | "program" | "multicam";
  multicamAssets: MediaAsset[]; nudgeProfessionalEdit(direction: -1 | 1, large?: boolean): void; openDesktopProjectDocument(): Promise<unknown>; openWorkspace(workspace: ProductWorkspace): void;
  placements: Placement[]; recordLiveMulticamSwitch(assetId: string): void; redo(): void; removeCompositionLayer(layerId: string): void; rotoMode: RotoMode;
  rotoStrokeRef: MutableRefObject<{ pointerId: number; layer: RotoPoint[]; stage: RotoPoint[] } | null>; saveCurrentProject(): Promise<unknown>; saveDesktopProjectDocument(saveAs?: boolean): Promise<unknown>;
  seek(time: number): void; seekComposition(time: number): void; selectedAudioClipId: string | null; selectedBaseCut: BaseCut | null; selectedBaseCutId: string | null;
  selectedBaseCutIds: string[]; selectedCompLayer: CompositionLayer | undefined; selectedKeyframeId: string | null; selectedPlacement: Placement | null;
  selectedPlacementId: string | null; selectedTrackId: string; setActivePanel: SetValue<ActivePanel>; setAudioClips: SetValue<AudioClip[]>; setBaseCuts: SetValue<BaseCut[]>;
  setCommandPaletteOpen: SetValue<boolean>; setCommandSearch: SetValue<string>;
  setDynamicTrimSelection: SetValue<DynamicTrimSelection | null>; setPlacements: SetValue<Placement[]>; setRotoMode: SetValue<RotoMode>; setRotoStrokePreview: SetValue<RotoPoint[]>;
  setSelectedAudioClipId: SetValue<string | null>; setSelectedAutomationPointId: SetValue<string | null>; setSelectedBaseCutId: SetValue<string | null>; setSelectedBaseCutIds: SetValue<string[]>;
  setSelectedPlacementId: SetValue<string | null>; setStatus: SetValue<string>; setTimelineRange: SetValue<TimelineRange>; setTimelineTool: SetValue<TimelineTool>;
  shuttle(direction: -1 | 1): Promise<void>; sourceVideoRef: RefObject<HTMLMediaElement | null>; splitPlacementAt(placement: Placement, time: number): void; splitSelectedBaseCut(): void;
  stepDynamicTrim(rate: number): void; stopShuttle(): void; togglePlayback(): Promise<void>; undo(): void; ungroupCurrentSelection(): void; workspaceView: WorkspaceView; clipTracks: ClipTrack[];
};

export function useEditorKeyboardShortcuts(c: EditorKeyboardShortcutContext, commands: EditorCommandItem[]) {
  useEffect(() => {
    const run = (id: string) => commands.find((item) => item.id === id)?.run();
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase(), command = event.metaKey || event.ctrlKey;
      if (event.defaultPrevented) return;
      if (key === "escape" && c.commandPaletteOpen) { event.preventDefault(); c.setCommandPaletteOpen(false); c.setCommandSearch(""); return; }
      if (!editorOwnsInput(event.target)) return;
      if (key === "escape") {
        if (c.rotoMode !== "off") { c.rotoStrokeRef.current = null; c.setRotoStrokePreview([]); c.setRotoMode("off"); c.setStatus("Roto selection cancelled."); } else run("deselect");
        event.preventDefault(); return;
      }
      if ((command && event.shiftKey && key === "p") || (!command && key === "?")) { event.preventDefault(); c.setCommandPaletteOpen(true); c.setCommandSearch(""); return; }
      if (!command && !event.altKey && c.monitorMode === "multicam" && /^[1-9]$/.test(key)) { const angle = c.multicamAssets[Number(key) - 1]; if (angle) { event.preventDefault(); c.recordLiveMulticamSwitch(angle.id); } return; }
      if (!command && c.selectedBaseCut && (key === "[" || key === "]")) { event.preventDefault(); c.nudgeProfessionalEdit(key === "]" ? 1 : -1, event.shiftKey); return; }
      if (!command && !event.altKey && c.dynamicTrimSelection && c.monitorMode !== "source" && ["j", "k", "l"].includes(key)) {
        event.preventDefault(); if (key === "k") { c.setDynamicTrimSelection(null); c.setStatus("Dynamic Trim complete."); } else c.stepDynamicTrim((key === "j" ? -1 : 1) * (event.shiftKey ? 5 : 1)); return;
      }
      if (event.code === "Space" && event.target instanceof Element && event.target.closest("button, [role='button']")) return;
      const id = commandForKey(event);
      if (id) { event.preventDefault(); run(id); }
    };
    const onNativeAction = (action: string) => {
      const id = NATIVE_COMMAND_ALIASES[action] ?? action;
      if (!editorOwnsInput(document.activeElement)) {
        if (["undo", "redo", "select-all"].includes(id) && document.activeElement?.matches("input, textarea, [contenteditable='true']")) document.execCommand(id === "select-all" ? "selectAll" : id);
        if (["undo", "redo", "select-all", "cut", "copy", "paste", "duplicate", "delete", "ripple-delete", "split", "play-pause", "stop", "shuttle-forward", "shuttle-reverse", "mark-in", "mark-out"].includes(id)) return;
      }
      run(id);
    };
    const onNativeEvent = (event: Event) => onNativeAction((event as CustomEvent<string>).detail);
    const onClipboard = (event: ClipboardEvent) => {
      if (event.defaultPrevented || !editorOwnsInput(event.target)) return;
      event.preventDefault(); run(event.type);
    };
    const unsubscribe = desktopMediaBridge()?.onAction(onNativeAction);
    window.addEventListener("keydown", onKeyDown); window.addEventListener("scenepilot:native-action", onNativeEvent);
    document.addEventListener("copy", onClipboard); document.addEventListener("cut", onClipboard); document.addEventListener("paste", onClipboard);
    return () => {
      unsubscribe?.(); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("scenepilot:native-action", onNativeEvent);
      document.removeEventListener("copy", onClipboard); document.removeEventListener("cut", onClipboard); document.removeEventListener("paste", onClipboard);
    };
  });
}
