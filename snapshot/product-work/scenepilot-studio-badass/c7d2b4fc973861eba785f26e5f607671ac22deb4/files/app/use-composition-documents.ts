import { useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { outputDimensions, ASPECT_LABELS, type CustomSize, type OutputAspect } from "../lib/aspect";
import { normalizeComposition } from "../lib/composition-tracks";
import { createStudioComposition, type CompositionSettings } from "../lib/composition-creation";
import type { StudioComposition } from "../lib/compositor";
import type { MediaAsset } from "./media-browser";
import type { ProjectPanelTab } from "./project-panel-tabs";

type Set<T> = Dispatch<SetStateAction<T>>;
type Context = {
  isPro: boolean; analyzing: boolean; rendering: boolean; compositions: StudioComposition[]; assets: MediaAsset[];
  duration: number; sourceDims: { w: number; h: number }; exportMaxDimension: number; aspect: OutputAspect; customSize: CustomSize; exportFrameRate: number;
  workspaceView: "sequence" | "composition"; activeCompositionId: string; compositionTime: number; selectedCompLayerId: string; selectedCompTrackId: string;
  setCompositions: Set<StudioComposition[]>; setActiveCompositionId: Set<string>; setSelectedCompLayerId: Set<string>; setSelectedCompTrackId: Set<string>;
  setSelectedKeyframeId: Set<string | null>; setCompositionTime: Set<number>; setProjectPanelTab: Set<ProjectPanelTab>;
  setWorkspaceView: Set<"sequence" | "composition">; setEditorMode: Set<"auto" | "pro">; setPlaying: Set<boolean>; setStatus: Set<string>;
  checkpoint(): void; addAssets(files: File[]): Promise<MediaAsset[] | undefined>;
};

/** Document navigation and composition setup share one command path across tabs, media and search. */
export function useCompositionDocuments(context: Context) {
  const { isPro, analyzing, rendering, compositions, assets, duration, sourceDims, exportMaxDimension, aspect, customSize, exportFrameRate,
    workspaceView, activeCompositionId, compositionTime, selectedCompLayerId, selectedCompTrackId, setCompositions, setActiveCompositionId,
    setSelectedCompLayerId, setSelectedCompTrackId, setSelectedKeyframeId, setCompositionTime, setProjectPanelTab, setWorkspaceView, setEditorMode,
    setPlaying, setStatus, checkpoint, addAssets } = context;
  const [newCompositionDraft, setNewCompositionDraft] = useState<{ settings: CompositionSettings; source?: MediaAsset } | null>(null);
  const compositionViewsRef = useRef(new Map<string, { time: number; layerId: string; trackId: string }>());
  const openComposition = (compositionId: string) => {
    const composition = compositions.find((item) => item.id === compositionId);
    if (!composition) return;
    const normalized = normalizeComposition(composition);
    if (workspaceView === "composition") compositionViewsRef.current.set(activeCompositionId, { time: compositionTime, layerId: selectedCompLayerId, trackId: selectedCompTrackId });
    const view = compositionViewsRef.current.get(compositionId);
    setActiveCompositionId(composition.id);
    setSelectedCompLayerId(normalized.layers.find((layer) => layer.id === view?.layerId)?.id ?? normalized.layers[0]?.id ?? "");
    setSelectedCompTrackId(normalized.tracks?.find((track) => track.id === view?.trackId)?.id ?? normalized.layers[0]?.trackId ?? normalized.tracks?.find((track) => track.kind === "video")?.id ?? normalized.tracks?.[0]?.id ?? "");
    setSelectedKeyframeId(null);
    setCompositionTime(Math.min(composition.duration, view?.time ?? 0));
    if (workspaceView !== "composition") setProjectPanelTab("project");
    setPlaying(false);
    setEditorMode("pro");
    setWorkspaceView("composition");
    setStatus(`Editing ${composition.name}. Changes update every instance in the master sequence.`);
  };

  const createComposition = () => {
    if (!isPro || analyzing || rendering) return;
    const matchedDimensions = outputDimensions(sourceDims.w, sourceDims.h, exportMaxDimension, aspect, customSize);
    setNewCompositionDraft({ settings: {
      name: `COMP ${String(compositions.length + 1).padStart(2, "0")} · ${ASPECT_LABELS[aspect]}`,
      duration: Math.max(1, duration),
      width: matchedDimensions.width,
      height: matchedDimensions.height,
      background: "#050706",
    } });
  };

  const finishCreateComposition = (settings: CompositionSettings) => {
    if (!newCompositionDraft || !isPro || analyzing || rendering) return;
    const id = `comp-${crypto.randomUUID()}`;
    const composition = createStudioComposition(id, settings, newCompositionDraft.source);
    checkpoint();
    if (workspaceView === "composition") compositionViewsRef.current.set(activeCompositionId, { time: compositionTime, layerId: selectedCompLayerId, trackId: selectedCompTrackId });
    setCompositions((items) => [...items, composition]);
    setActiveCompositionId(id);
    setSelectedCompLayerId(composition.layers[0]?.id ?? "");
    setSelectedCompTrackId(composition.layers[0]?.trackId ?? `${id}-video-track-1`);
    setSelectedKeyframeId(null);
    setCompositionTime(0);
    setWorkspaceView("composition");
    setEditorMode("pro"); setPlaying(false); setProjectPanelTab("project"); setNewCompositionDraft(null);
    setStatus(`${composition.name} created at ${settings.width} × ${settings.height}, ${exportFrameRate} fps, ${settings.duration.toFixed(2)}s.`);
  };

  const beginCompositionFromSource = (source: MediaAsset) => {
    if (!isPro || analyzing || rendering || !source.url || source.kind === "audio") return;
    const matched = outputDimensions(sourceDims.w, sourceDims.h, exportMaxDimension, aspect, customSize);
    setNewCompositionDraft({ source, settings: { name: source.name.replace(/\.[^.]+$/, ""), ...matched, duration: Number.isFinite(source.duration) ? Math.max(.05, source.duration!) : Math.max(1, duration), background: "#050706" } });
  };

  const dropCompositionSource = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (!isPro || analyzing || rendering) return;
    const payload = event.dataTransfer.getData("application/x-scenepilot");
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 1) { setStatus("Drop one source to create a composition. Add more layers after creating it."); return; }
    try {
      const source = payload.startsWith("asset:") ? assets.find((asset) => asset.id === payload.slice(6)) : files.length ? (await addAssets(files))?.[0] : undefined;
      if (!source?.url || source.kind === "audio") { setStatus("Drop an online image or movie to create a composition."); return; }
      beginCompositionFromSource(source);
    } catch (error) { setStatus(`Could not create composition: ${error instanceof Error ? error.message : "media import failed"}`); }
  };

  const openMainSequence = () => {
    if (workspaceView === "composition") compositionViewsRef.current.set(activeCompositionId, { time: compositionTime, layerId: selectedCompLayerId, trackId: selectedCompTrackId });
    setPlaying(false); setWorkspaceView("sequence"); setStatus("Main sequence active.");
  };
  return { openComposition, createComposition, finishCreateComposition, beginCompositionFromSource, dropCompositionSource, openMainSequence,
    newCompositionDraft, closeCompositionDialog: () => setNewCompositionDraft(null) };
}
