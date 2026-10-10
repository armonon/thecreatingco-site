import type { MutableRefObject } from "react";
import { abortableWait } from "../lib/abortable-wait.ts";
import { programAudioSchedule } from "../lib/program-audio";
import type { CompositionAudioSegment } from "../lib/composition-audio";
import type { StreamTargetChunk } from "mediabunny";
import { type AudioClip, type AudioTrack, type RenderJob } from "../lib/pro-editor";
import { type AudioBus } from "../lib/audio-mixer";
import { audioStemFileName, type AudioStem } from "../lib/audio-stems";
import type { RenderAudioOptions } from "../lib/render-engine";
import { renderAudioInWorker, workerDirectDiskSupported, workerRenderSupported, type WorkerAudioRenderOptions } from "./render-client";

type StemAsset = { id: string; file: File; url: string };
type NestedAudioClip = CompositionAudioSegment;

export type AudioStemDeliveryContext = {
  queuedJob: RenderJob;
  rendering: boolean;
  renderLaunchRef: MutableRefObject<boolean>;
  renderAbortRef: MutableRefObject<AbortController | null>;
  mainFile: File | null;
  mainUrl: string;
  mainName: string;
  duration: number;
  assets: StemAsset[];
  audioClips: AudioClip[];
  audioTracks: AudioTrack[];
  audioBuses: AudioBus[];
  nestedCompositionAudio: NestedAudioClip[];
  compositionAudioIssues?: string[];
  masterGain: number;
  materializeFile(file: File, url: string, signal?: AbortSignal): Promise<File>;
  setRendering(value: boolean): void;
  setRenderProgress(value: number): void;
  setStatus(value: string): void;
  updateQueue(update: (items: RenderJob[]) => RenderJob[]): void;
};

async function renderAudioProject(options: RenderAudioOptions) {
  const renderer = await import("../lib/render-engine");
  return renderer.renderAudioProject(options);
}

/** Execute one professional WAV deliverable. Kept outside the editor shell so
 * queue state, PCM routing and disk streaming can evolve independently. */
export async function deliverAudioStem(context: AudioStemDeliveryContext) {
  const { queuedJob } = context;
  if (context.rendering || context.renderLaunchRef.current) return;
  const stem = (queuedJob.audioStem ?? "master") as AudioStem;
  if (!context.mainFile && !context.audioClips.length && !context.nestedCompositionAudio.length) {
    context.updateQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status: "failed", message: "No audio to render", error: "Add a soundtrack or placed audio before exporting stems." } : job));
    return;
  }
  context.renderLaunchRef.current = true;
  const rawIn = queuedJob.range?.inPoint ?? 0;
  const rawOut = queuedJob.range?.outPoint ?? context.duration;
  const renderStart = Math.min(rawIn, rawOut);
  const renderEnd = Math.max(rawIn, rawOut);
  const renderDuration = Math.max(.05, renderEnd - renderStart);
  const outputName = audioStemFileName(context.mainName, stem);
  const controller = new AbortController();
  context.renderAbortRef.current = controller;
  context.setRendering(true);
  context.setRenderProgress(0);
  const stage = (status: RenderJob["status"], message: string) => {
    context.setStatus(message);
    context.updateQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status, message, error: undefined } : job));
  };
  stage("preparing", `Preparing ${stem} PCM stem`);
  try {
    const schedule = programAudioSchedule({
      main: Boolean(context.mainFile), duration: context.duration, from: renderStart, to: renderEnd,
      masterGain: context.masterGain, audioClips: context.audioClips, audioTracks: context.audioTracks,
      audioBuses: context.audioBuses, composition: { clips: context.nestedCompositionAudio, issues: context.compositionAudioIssues ?? [] }, stem,
    });
    const usedIds = new Set(schedule.map(clip => clip.assetId));
    const materializedMain = context.mainFile && usedIds.has(null) ? await context.materializeFile(context.mainFile, context.mainUrl, controller.signal) : null;
    const materializedById = new Map<string, File>();
    for (const asset of context.assets.filter(asset => usedIds.has(asset.id))) {
      controller.signal.throwIfAborted();
      materializedById.set(asset.id, await context.materializeFile(asset.file, asset.url, controller.signal));
    }
    const clips = schedule.map(clip => {
      const file = clip.assetId === null ? materializedMain : materializedById.get(clip.assetId);
      if (!file) throw new Error("Stem media is offline. Relink it before delivery.");
      return { ...clip, file };
    });
    const options: WorkerAudioRenderOptions = { clips, duration: renderDuration };
    let fileHandle: FileSystemFileHandle | undefined;
    const savePicker = (window as Window & { showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
    controller.signal.throwIfAborted();
    if (savePicker) {
      stage("awaiting-destination", "Choose where to save the WAV stem, or cancel the Save dialog.");
      fileHandle = await abortableWait(savePicker.call(window, { suggestedName: outputName, types: [{ description: "24-bit PCM WAVE", accept: { "audio/wav": [".wav"] } }] }), controller.signal);
    }
    controller.signal.throwIfAborted();
    stage("rendering", `Mixing and encoding ${stem} PCM stem…`);
    const onProgress = (progress: number, message: string) => {
      context.setRenderProgress(progress); context.setStatus(message);
      context.updateQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, progress, message, checkpoint: { progress, frame: Math.floor(progress * renderDuration * 48_000), updatedAt: Date.now() } } : job));
    };
    let blob: Blob | null = null;
    let streamedToDisk = false;
    if (workerRenderSupported) {
      let workerOutputStream: RenderAudioOptions["outputStream"];
      let diskWrite: Promise<void> | undefined;
      let diskError: unknown;
      const diskAbort = new AbortController();
      if (fileHandle && workerDirectDiskSupported) {
        const writable = await fileHandle.createWritable();
        const bridge = new TransformStream<StreamTargetChunk, StreamTargetChunk>();
        workerOutputStream = bridge.writable;
        diskWrite = bridge.readable.pipeTo(writable as unknown as WritableStream<StreamTargetChunk>, { signal: diskAbort.signal }).catch((error) => { diskError = error; });
      }
      const handle = renderAudioInWorker(options, onProgress, workerOutputStream);
      const abort = () => { handle.cancel(); if (diskWrite) diskAbort.abort(); };
      controller.signal.addEventListener("abort", abort, { once: true });
      if (controller.signal.aborted) abort();
      try { blob = await handle.result; if (diskWrite) { await diskWrite; if (diskError) throw diskError; streamedToDisk = true; } }
      finally { controller.signal.removeEventListener("abort", abort); }
    } else {
      const outputStream = fileHandle ? await fileHandle.createWritable() as RenderAudioOptions["outputStream"] : undefined;
      blob = await renderAudioProject({ ...options, outputStream, signal: controller.signal, onProgress });
      streamedToDisk = !blob && Boolean(outputStream);
    }
    controller.signal.throwIfAborted();
    stage("finalizing", "Finishing WAV output…");
    if (blob && fileHandle) { const writable = await fileHandle.createWritable(); try { controller.signal.throwIfAborted(); await writable.write(blob); controller.signal.throwIfAborted(); await writable.close(); } catch (error) { await writable.abort().catch(() => undefined); throw error; } }
    else if (blob) { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = outputName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); }
    context.setStatus(`${stem.toUpperCase()} stem complete · 24-bit / 48 kHz${streamedToDisk ? " · written directly to disk" : ""}.`);
    context.updateQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status: "completed", progress: 1, message: "PCM stem complete" } : job));
  } catch (error) {
    const canceled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
    context.setStatus(canceled ? "Audio stem render canceled." : error instanceof Error ? `Audio stem failed: ${error.message}` : "Audio stem failed.");
    context.updateQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status: canceled ? "canceled" : "failed", message: canceled ? "Canceled" : "Stem render failed", error: error instanceof Error ? error.message : undefined } : job));
  } finally {
    context.renderAbortRef.current = null;
    context.setRendering(false);
    context.setRenderProgress(0);
    context.renderLaunchRef.current = false;
  }
}
