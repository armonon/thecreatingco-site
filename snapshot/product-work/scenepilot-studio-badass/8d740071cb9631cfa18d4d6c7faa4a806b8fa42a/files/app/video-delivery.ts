import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { StreamTargetChunk } from "mediabunny";
import type { RenderMotion, RenderOptions } from "../lib/render-engine";
import { renderInWorker, workerDirectDiskSupported, workerRenderSupported, type WorkerRenderOptions } from "./render-client";
import { NEUTRAL_CLIP_COLOR, type BaseCut } from "../lib/sequencer";
import { outputDimensions, type OutputAspect } from "../lib/aspect";
import { checkExportProfile } from "../lib/capabilities";
import { PUNCH_PRESETS, SHAKE_PRESETS } from "../lib/motion";
import { TRANSITION_PRESETS, type TransitionType } from "../lib/transitions";
import type { StudioComposition } from "../lib/compositor";
import { compositionAudioPlan } from "../lib/composition-audio";
import { programAudioSchedule } from "../lib/program-audio";
import { type AudioClip, type AudioTrack, type RenderFormat, type RenderJob, type TimelineRange } from "../lib/pro-editor";
import { assessRenderRisk } from "../lib/workflow";
import { nativeSequenceEligibility } from "../lib/native-render-eligibility";
import { nativeSourceWindow } from "../lib/native-render-contract";
import { type AudioBus } from "../lib/audio-mixer";
import type { EditionCapabilities } from "./edition";
import { desktopMediaBridge, type NativeMediaCapabilities } from "./desktop-media";
import type { MediaAsset } from "./media-browser";
import type { Placement, ClipTrack } from "./editor-foundation";
import type { TitleCue } from "../lib/titles";
import type { StrobeConfig } from "../lib/strobe";
import { materializePathBackedFile } from "./media-file-utils";
import { renderMediaIds, visibleRenderPlacements } from "../lib/render-media";
import { abortableWait } from "../lib/abortable-wait.ts";
import { hasRenderableSequence } from "../lib/sequence-readiness";

async function renderProject(options: RenderOptions) {
  const renderer = await import("../lib/render-engine");
  return renderer.renderProject(options);
}

export type VideoDeliveryContext = {
  /** Phone UI retains the completed file for an explicit, user-initiated download. */
  onBrowserDownloadReady?(blob: Blob, name: string): void;
  /** Called with every finished in-memory render (e.g. for "Save to Locker"). */
  onRendered?(blob: Blob, name: string): void;
  activeProjectId?: string;
  exportAudioStem(job: RenderJob): Promise<void>;
  placements: Placement[];
  mainFile: File | null;
  montageEnabled: boolean;
  baseCuts: BaseCut[];
  rendering: boolean;
  renderLaunchRef: MutableRefObject<boolean>;
  duration: number;
  exportFormat: RenderFormat;
  mainName: string;
  timelineRange: TimelineRange;
  exportFrameRate: 24 | 25 | 30 | 50 | 60;
  exportMaxDimension: 1920 | 3840;
  aspect: OutputAspect;
  customSize: { width: number; height: number };
  compositions: StudioComposition[];
  sourceDims: { w: number; h: number };
  isPro: boolean;
  assets: MediaAsset[];
  audioTracks: AudioTrack[];
  audioClips: AudioClip[];
  audioBuses: AudioBus[];
  masterGain: number;
  nativeCapabilities: NativeMediaCapabilities | null;
  titles: TitleCue[];
  transitionType: TransitionType;
  punchPreset: keyof typeof PUNCH_PRESETS;
  shakePreset: keyof typeof SHAKE_PRESETS;
  strobeConfig: StrobeConfig;
  stutterPreset: string;
  speedPreset: string;
  dropRampEnabled: boolean;
  audioReactive: boolean;
  echoPreset: string;
  hasShaderEffect: boolean;
  setStatus(value: string): void;
  setRenderQueue: Dispatch<SetStateAction<RenderJob[]>>;
  nativeRenderJobRef: MutableRefObject<string | null>;
  renderAbortRef: MutableRefObject<AbortController | null>;
  setRendering(value: boolean): void;
  setRenderProgress(value: number): void;
  setRenderQueueOpen(value: boolean): void;
  capabilities: EditionCapabilities;
  mainUrl: string;
  visualAssets: MediaAsset[];
  clipTracks: ClipTrack[];
  renderMotion(): RenderMotion;
  gradeParams: NonNullable<WorkerRenderOptions["grade"]>["params"];
  strobeSetting: WorkerRenderOptions["strobe"];
  stutterSetting: WorkerRenderOptions["stutter"];
  speedSetting: WorkerRenderOptions["speed"];
  dropRampSetting: WorkerRenderOptions["dropRamp"];
  echoSetting: WorkerRenderOptions["echo"];
  mainSourcePath: string;
};

export async function deliverVideo(context: VideoDeliveryContext, queuedJob?: RenderJob) {
  // Media resolution and file pickers run before the encoder's own try/finally.
  // A missing linked file must not leave the launch lock permanently claimed.
  try {
    if (queuedJob?.compositionId) {
      const composition = context.compositions.find(({ id }) => id === queuedJob.compositionId);
      if (!composition) throw new Error("The queued composition no longer exists. Restore it before retrying.");
      await deliverActiveComposition(context, composition, queuedJob);
    } else await runVideoDelivery(context, queuedJob);
  }
  catch (error) {
    const canceled = context.renderAbortRef.current?.signal.aborted || (error instanceof Error && error.name === "AbortError");
    const message = error instanceof Error ? error.message : "The render could not be prepared.";
    context.setStatus(canceled ? "Render canceled while preparing media." : `Render failed: ${message}`);
    context.renderLaunchRef.current = false;
    context.renderAbortRef.current = null;
    context.setRendering(false);
    context.setRenderProgress(0);
    if (queuedJob) context.setRenderQueue((jobs) => jobs.map((job) => job.id === queuedJob.id ? { ...job, status: canceled ? "canceled" : "failed", message: canceled ? "Preparation canceled" : "Render preparation failed", error: canceled ? undefined : message } : job));
  }
}

async function runVideoDelivery(context: VideoDeliveryContext, queuedJob?: RenderJob) {
  const { exportAudioStem, placements, mainFile, montageEnabled, baseCuts, rendering, renderLaunchRef, duration, exportFormat, mainName, timelineRange, exportFrameRate, exportMaxDimension, aspect, customSize, compositions, sourceDims, isPro, assets, audioTracks, audioClips, audioBuses, masterGain, nativeCapabilities, titles, transitionType, punchPreset, shakePreset, strobeConfig, stutterPreset, speedPreset, dropRampEnabled, audioReactive, echoPreset, hasShaderEffect, setStatus, setRenderQueue, nativeRenderJobRef, renderAbortRef, setRendering, setRenderProgress, capabilities, mainUrl, visualAssets, clipTracks, renderMotion, gradeParams, strobeSetting, stutterSetting, speedSetting, dropRampSetting, echoSetting, mainSourcePath } = context;
    if (queuedJob?.kind === "audio-stem" || queuedJob?.format === "wav-pcm") {
      await exportAudioStem(queuedJob);
      return;
    }
    if (rendering || renderLaunchRef.current) {
      setStatus("A render is already being prepared. Finish or cancel the current export or its save dialog first.");
      return;
    }
    if (!hasRenderableSequence({ hasMainMedia: Boolean(mainFile), assetCount: assets.length, placementCount: placements.length, baseCutCount: baseCuts.length, montageEnabled })) {
      setStatus("Build a media edit or place a composition on the master before rendering.");
      if (queuedJob) setRenderQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status: "failed", message: "Nothing to export", error: "Restore or build this sequence before retrying." } : job));
      return;
    }
    // Claim the launch synchronously — before the first await — so the queue
    // auto-runner (which re-fires whenever renderQueue changes) can't start the
    // same job twice during the preflight gap. Released on every exit path.
    renderLaunchRef.current = true;
    const controller = new AbortController();
    renderAbortRef.current = controller;
    setRendering(true);
    setRenderProgress(0);
    const stage = (status: RenderJob["status"], message: string) => {
      setStatus(message);
      if (queuedJob) setRenderQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status, message, error: undefined } : job));
    };
    stage("preparing", "Checking export capabilities…");
    setStatus("Checking export capabilities…");
    const format: RenderFormat = queuedJob?.format ?? exportFormat;
    const webm = format === "webm-vp9" || format === "webm-vp9-alpha";
    const extension = webm ? "webm" : "mp4";
    const outputName = `${(queuedJob?.name ?? `${mainName.replace(/\.[^/.]+$/, "") || "scenepilot"}-scenepilot`).replace(/[^a-z0-9._ -]/gi, "-")}.${extension}`;
    const renderRange = queuedJob?.range ?? timelineRange;
    const queuedFrameRate = queuedJob?.frameRate ?? exportFrameRate;
    const queuedMaxDimension = queuedJob?.maxDimension ?? exportMaxDimension;
    const queuedAspect = queuedJob?.aspect ?? aspect;
    const queuedCustomSize = queuedJob?.customSize ?? customSize;
    const generatedComposition = !mainFile
      ? compositions.find((composition) => composition.id === placements.find((placement) => placement.compositionId)?.compositionId)
      : undefined;
    const renderSourceSize = generatedComposition ? { width: generatedComposition.width, height: generatedComposition.height } : { width: sourceDims.w, height: sourceDims.h };
    const checkedSize = outputDimensions(renderSourceSize.width, renderSourceSize.height, isPro ? queuedMaxDimension : 1920, queuedAspect, queuedCustomSize);
    const rawIn = isPro ? renderRange.inPoint ?? 0 : 0;
    const rawOut = isPro ? renderRange.outPoint ?? duration : duration;
    const renderStart = Math.min(rawIn, rawOut);
    const renderEnd = Math.max(rawIn, rawOut);
    const renderDuration = Math.max(0.05, renderEnd - renderStart);
    const nativeBridge = desktopMediaBridge();
    const nativeCuts = (montageEnabled ? baseCuts : [])
      .filter((cut) => cut.start < renderEnd && cut.start + cut.duration > renderStart)
      .sort((a, b) => a.start - b.start)
      .map((cut) => {
        const visibleStart = Math.max(renderStart, cut.start);
        const visibleEnd = Math.min(renderEnd, cut.start + cut.duration);
        const rate = cut.playbackRate ?? 1;
        const sourceWindow = nativeSourceWindow({
          sourceStart: cut.sourceStart,
          cutDuration: cut.duration,
          visibleOffset: visibleStart - cut.start,
          visibleDuration: visibleEnd - visibleStart,
          playbackRate: rate,
          reversed: cut.reversed,
        });
        const asset = assets.find((item) => item.id === cut.assetId);
        return {
          cut,
          start: visibleStart,
          sourcePath: asset?.sourcePath ?? (asset && nativeBridge?.getPathForFile(asset.file)) ?? "",
          sourceStart: sourceWindow.sourceStart,
          duration: Math.max(0, visibleEnd - visibleStart),
          playbackRate: rate,
          fadeIn: cut.fadeIn ?? 0,
          fadeOut: cut.fadeOut ?? 0,
          color: cut.color ?? NEUTRAL_CLIP_COLOR,
          effects: cut.effects ?? [],
          flipH: cut.flipH ?? false,
          flipV: cut.flipV ?? false,
          reversed: cut.reversed ?? false,
        };
      });
    const compositionAudio = isPro ? compositionAudioPlan(compositions, placements, clipTracks) : { clips: [], issues: [] };
    const programSchedule = isPro ? programAudioSchedule({ main: Boolean(mainFile), duration, from: renderStart, to: renderEnd, masterGain, audioClips, audioTracks, audioBuses, composition: compositionAudio }) : [];
    const nativeAudioClips = programSchedule.filter((clip) => clip.assetId !== null).map((clip) => {
      const asset = assets.find((item) => item.id === clip.assetId);
      return { ...clip, sourcePath: asset?.sourcePath ?? (asset && nativeBridge?.getPathForFile(asset.file)) ?? "" };
    });
    const nativeTimelineContinuous = nativeCuts.length > 0
      && Math.abs(nativeCuts[0].start - renderStart) < 0.04
      && nativeCuts.every((entry, index) => index === 0 || Math.abs(entry.start - (nativeCuts[index - 1].start + nativeCuts[index - 1].duration)) < 0.04)
      && Math.abs(nativeCuts.reduce((sum, entry) => sum + entry.duration, 0) - renderDuration) < 0.08;
    const nativeFormatSupported = format === "mp4-h264"
      ? Boolean(nativeCapabilities?.encoders?.h264 ?? nativeCapabilities?.encoder)
      : format === "mp4-hevc" && Boolean(nativeCapabilities?.encoders?.hevc);
    const canPrepareNativeAudio = workerDirectDiskSupported && [nativeBridge?.beginPcmMix, nativeBridge?.writePcmMix, nativeBridge?.finishPcmMix, nativeBridge?.releasePcmMix].every(method => typeof method === "function");
    const nativeEligibility = nativeSequenceEligibility({
      isPro,
      engineAvailable: Boolean(nativeBridge?.nativeRender && nativeCapabilities?.nativeSequenceRender),
      formatSupported: nativeFormatSupported,
      timelineContinuous: nativeTimelineContinuous,
      clips: nativeCuts.map(({ cut, sourcePath }) => ({
        sourcePath,
        transitionType: cut.transitionType,
        transformKeyframeCount: cut.transformKeyframes?.length ?? 0,
        reversed: Boolean(cut.reversed),
        timeRemapCount: cut.timeRemap?.length ?? 0,
        color: cut.color,
        effects: (cut.effects ?? []).map((effect) => ({
          type: effect.type,
          enabled: effect.enabled,
          amount: effect.amount,
          keyframeCount: effect.keyframes?.length ?? 0,
          expressionSource: effect.expression?.source,
        })),
      })),
      placementCount: placements.length,
      titleCount: titles.length,
      audioClipCount: nativeAudioClips.length,
      audioClipsNativeReady: canPrepareNativeAudio || nativeAudioClips.every((clip) => Boolean(clip.sourcePath)),
      audioRequiresPcm: programSchedule.length > 0 && !canPrepareNativeAudio,
      globalTransition: transitionType,
      punchPreset,
      shakePreset,
      strobePreset: strobeConfig.pattern,
      stutterPreset,
      speedPreset,
      dropRampEnabled,
      audioReactive,
      echoPreset,
      hasShaderEffect,
    });
    const nativeEligible = nativeEligibility.eligible;
    if (!nativeEligible) {
      // A rejecting preflight must not leave the launch claimed (that would wedge
      // the whole queue) — treat any failure as a blocked, retryable job.
      let checkedProfile;
      try {
        checkedProfile = await checkExportProfile({
          format,
          width: checkedSize.width,
          height: checkedSize.height,
          frameRate: isPro ? queuedFrameRate : 30,
          requiresWebGL: hasShaderEffect || strobeConfig.pattern !== "off" || echoPreset !== "off",
        });
      } catch (error) {
        checkedProfile = { supported: false, message: error instanceof Error ? error.message : "Export preflight could not run." };
      }
      controller.signal.throwIfAborted();
      if (!checkedProfile.supported) {
        setStatus(`Render blocked by preflight: ${checkedProfile.message}`);
        if (queuedJob) setRenderQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status: "failed", message: "Preflight failed", error: checkedProfile.message } : job));
        renderLaunchRef.current = false;
        renderAbortRef.current = null;
        setRendering(false);
        return;
      }
    }
    if (queuedJob) void desktopMediaBridge()?.logRenderEvent?.({ event: "render-start", jobId: queuedJob.id, message: `${format} · ${queuedFrameRate}fps · ${queuedMaxDimension}px` }).catch(() => undefined);
    const renderRisk = assessRenderRisk(renderDuration, isPro ? queuedMaxDimension : 1920, isPro ? queuedFrameRate : 30);
    controller.signal.throwIfAborted();
    stage("preparing", nativeEligible ? "Preparing native export; a destination dialog may open." : `Preparing parity render · ${nativeEligibility.reasons[0] ?? "shared frame engine"}`);

    if (nativeEligible && nativeBridge) {
      let preparedAudioToken: string | undefined;
      const nativeJobId = queuedJob?.id ?? `native-render-${crypto.randomUUID()}`;
      nativeRenderJobRef.current = nativeJobId;
      setRendering(true);
      setRenderProgress(0);
      setStatus(`Launching native ${format === "mp4-hevc" ? "HEVC" : "H.264"} engine…`);
      const cancelNative = () => { void nativeBridge.cancelMediaJob(nativeJobId); };
      controller.signal.addEventListener("abort", cancelNative, { once: true });
      try {
        if (programSchedule.length) {
          stage("preparing", "Preparing canonical PCM mix for native video export…");
          const files = new Map<string, File>();
          const usedIds = new Set(programSchedule.map(clip => clip.assetId));
          for (const asset of assets.filter(asset => usedIds.has(asset.id))) {
            controller.signal.throwIfAborted();
            files.set(asset.id, await materializePathBackedFile(asset.file, asset.url, controller.signal));
          }
          const main = mainFile && usedIds.has(null) ? await materializePathBackedFile(mainFile, mainUrl, controller.signal) : null;
          const clips = programSchedule.map(clip => {
            const file = clip.assetId === null ? main : files.get(clip.assetId);
            if (!file) throw new Error("Native program audio is offline. Relink it before delivery.");
            return { ...clip, file };
          });
          const { prepareNativeAudio } = await import("./native-audio-preparation");
          preparedAudioToken = await prepareNativeAudio(nativeBridge, clips, renderDuration, controller.signal, (progress, message) => {
            setRenderProgress(progress * .2); setStatus(`Preparing native audio · ${message}`);
          });
        }
        controller.signal.throwIfAborted();
        const result = await nativeBridge.nativeRender({
          jobId: nativeJobId,
          preparedAudioToken,
          suggestedName: outputName,
          outputPath: queuedJob?.outputPath,
          useLastRenderDirectory: true,
          plan: {
            clips: nativeCuts.map(({ sourcePath, sourceStart, duration: clipDuration, playbackRate, fadeIn, fadeOut, color, effects, flipH, flipV, reversed }) => ({
              sourcePath, sourceStart, duration: clipDuration, playbackRate, fadeIn, fadeOut, color, flipH, flipV, reversed,
              effects: effects.filter((effect): effect is typeof effect & { type: "blur" | "contrast" | "saturate" | "hue" | "monochrome" | "sepia" | "invert" } => (["blur", "contrast", "saturate", "hue", "monochrome", "sepia", "invert"] as string[]).includes(effect.type)).map(({ type, amount, enabled }) => ({ type, amount, enabled })),
            })),
            audioClips: nativeAudioClips,
            soundtrackPath: mainFile && programSchedule.some(clip => clip.assetId === null) ? mainSourcePath || nativeBridge.getPathForFile(mainFile) : "",
            width: checkedSize.width,
            height: checkedSize.height,
            frameRate: queuedFrameRate,
            duration: renderDuration,
            rangeStart: renderStart,
            masterGain,
            format: format as "mp4-h264" | "mp4-hevc",
          },
        });
        if (result.canceled || controller.signal.aborted) {
          setStatus("Native render canceled before writing. Your project is unchanged.");
          if (queuedJob) setRenderQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status: "canceled", message: "Canceled before render" } : job));
        } else {
          setStatus(`Native master complete · ${result.hardware ? "hardware accelerated" : "CPU encoded"} · ${result.outputPath ?? outputName}`);
          if (queuedJob) setRenderQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status: "completed", progress: 1, message: "Native master complete", outputPath: result.outputPath ?? job.outputPath } : job));
          if (queuedJob) void nativeBridge.logRenderEvent({ event: "render-complete", jobId: queuedJob.id, message: outputName, progress: 1 }).catch(() => undefined);
        }
      } catch (error) {
        const canceled = controller.signal.aborted;
        setStatus(canceled ? "Native render canceled. Your project is still intact." : error instanceof Error ? `Native render failed: ${error.message}` : "Native render failed.");
        if (queuedJob) setRenderQueue((items) => items.map((job) => job.id === queuedJob.id ? { ...job, status: canceled ? "canceled" : "failed", message: canceled ? "Canceled" : "Native render failed", error: error instanceof Error ? error.message : undefined } : job));
        if (queuedJob) void nativeBridge.logRenderEvent({ event: canceled ? "render-canceled" : "render-failed", jobId: queuedJob.id, message: error instanceof Error ? error.message : String(error) }).catch(() => undefined);
      } finally {
        if (preparedAudioToken) await nativeBridge.releasePcmMix(preparedAudioToken).catch(() => undefined);
        controller.signal.removeEventListener("abort", cancelNative);
        nativeRenderJobRef.current = null;
        renderAbortRef.current = null;
        setRendering(false);
        setRenderProgress(0);
        renderLaunchRef.current = false;
      }
      return;
    }

    // Optional "Save As" target. We only grab the handle here; the writable is
    // opened after the render (a Web Worker can't be handed a file stream).
    let fileHandle: FileSystemFileHandle | undefined;
    const savePicker = (window as Window & {
      showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker;
    if (savePicker && !context.onBrowserDownloadReady) {
      try {
        stage("awaiting-destination", "Choose where to save the rendered video in the file dialog, or cancel to return to editing.");
        fileHandle = await abortableWait(savePicker.call(window, {
          suggestedName: outputName,
          types: [{
            description: webm ? "WebM video" : "MP4 video",
            accept: webm ? { "video/webm": [".webm"] } : { "video/mp4": [".mp4"] },
          }],
        }), controller.signal);
      } catch (error) {
        // Do not silently change a failed Save operation into a download.
        throw error;
      }
    }

    controller.signal.throwIfAborted();
    stage("preparing", "Resolving linked media for the render engine...");
    setRendering(true);
    setRenderProgress(0);
    const requiredMedia = renderMediaIds([visibleRenderPlacements(placements, clipTracks), montageEnabled ? baseCuts : [], programSchedule], compositions, { pictureOnly: true });
    const materializedMainFile = mainFile ? await materializePathBackedFile(mainFile, mainUrl, controller.signal) : null;
    const materializedAssets: Array<{ id: string; file: File }> = [];
    for (const asset of assets.filter((asset) => requiredMedia.has(asset.id))) {
      // Proxies are preview-only. Masters always resolve the original media.
      materializedAssets.push({ id: asset.id, file: await materializePathBackedFile(asset.file, asset.url, controller.signal) });
    }
    const materializedById = new Map(materializedAssets.map((asset) => [asset.id, asset.file]));
    const mixedAudio = isPro ? programSchedule.map((clip) => {
      const file = clip.assetId === null ? materializedMainFile : materializedById.get(clip.assetId);
      if (!file) throw new Error("Program audio media is offline. Relink it before delivery.");
      return { ...clip, file };
    }) : [];
    const options: WorkerRenderOptions = {
      mainFile: materializedMainFile,
      assets: visualAssets.filter(({ id }) => requiredMedia.has(id)).map(({ id, file, kind }) => ({ id, file: materializedById.get(id) ?? file, kind: kind as "image" | "video" })),
      placements,
      compositions,
      tracks: clipTracks,
      baseCuts: montageEnabled ? baseCuts : [],
      motion: renderMotion(),
      grade: hasShaderEffect ? { params: gradeParams, beatDriven: true } : undefined,
      transition: TRANSITION_PRESETS[transitionType],
      strobe: strobeSetting,
      stutter: stutterSetting,
      speed: speedSetting,
      dropRamp: dropRampSetting,
      echo: echoSetting,
      titles,
      duration: renderDuration,
      sourceSize: renderSourceSize,
      frameRate: isPro ? queuedFrameRate : 30,
      maxDimension: isPro ? queuedMaxDimension : 1920,
      aspect: queuedAspect,
      customSize: queuedCustomSize,
      format,
      transparent: format === "webm-vp9-alpha",
      hardwareAcceleration: "no-preference",
      audioClips: mixedAudio,
      useMainAudio: !isPro,
      timeOffset: renderStart,
    };

    if (renderRisk !== "normal") setStatus(`${renderRisk === "extreme" ? "Large" : "Heavy"} render detected — memory safeguards and direct-to-disk delivery are active where supported.`);
    const onProgress = (progress: number, message: string) => {
      setRenderProgress(progress);
      setStatus(message);
      if (queuedJob) setRenderQueue((items) => items.map((job) =>
        job.id === queuedJob.id ? { ...job, progress, message, checkpoint: { progress, frame: Math.floor(progress * renderDuration * queuedFrameRate), updatedAt: Date.now() } } : job));
    };
    const triggerDownload = (data: Blob, name: string) => {
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(data);
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 60_000);
    };
    try {
      // Render off the main thread when the browser allows it, so the UI stays
      // responsive the whole way through; otherwise render here.
      controller.signal.throwIfAborted();
      stage("rendering", "Rendering frames and mixed audio…");
      let blob: Blob | null = null;
      let streamedToDisk = false;
      const proDirectWrite = capabilities.directDiskRendering && !!fileHandle;
      const backgroundDirectWrite = proDirectWrite && workerDirectDiskSupported;
      if (workerRenderSupported && (!proDirectWrite || backgroundDirectWrite)) {
        let workerOutputStream: RenderOptions["outputStream"];
        let diskWrite: Promise<void> | undefined;
        let diskWriteError: unknown;
        const diskAbort = new AbortController();
        if (backgroundDirectWrite && fileHandle) {
          const fileWritable = await fileHandle.createWritable();
          const bridge = new TransformStream<StreamTargetChunk, StreamTargetChunk>();
          workerOutputStream = bridge.writable;
          diskWrite = bridge.readable
            .pipeTo(fileWritable as unknown as WritableStream<StreamTargetChunk>, { signal: diskAbort.signal })
            .catch((error) => { diskWriteError = error; });
          setStatus("Background parity render — streaming exact compositor frames directly to disk.");
        }
        const job = renderInWorker(options, onProgress, workerOutputStream);
        const abort = () => {
          job.cancel();
          if (diskWrite) diskAbort.abort();
        };
        controller.signal.addEventListener("abort", abort, { once: true });
        if (controller.signal.aborted) abort();
        try {
          blob = await job.result;
          if (diskWrite) {
            stage("finalizing", "Finishing output file…");
            await diskWrite;
            if (diskWriteError) throw diskWriteError;
            streamedToDisk = true;
          }
        } catch (error) {
          if (diskWrite && !diskAbort.signal.aborted) diskAbort.abort();
          if (diskWrite) await diskWrite;
          throw error;
        } finally {
          controller.signal.removeEventListener("abort", abort);
        }
      } else {
        // The main-thread fallback can still stream straight to the picked file.
        const outputStream = fileHandle ? await fileHandle.createWritable() as RenderOptions["outputStream"] : undefined;
        try {
          blob = await renderProject({ ...options, outputStream, signal: controller.signal, onProgress });
        } catch (error) {
          // Also covers capability/preflight failures before the renderer owns
          // the stream. Aborting leaves an existing destination untouched.
          if (outputStream && !outputStream.locked) await outputStream.abort(error).catch(() => undefined);
          throw error;
        }
        streamedToDisk = !blob && !!outputStream;
      }

      controller.signal.throwIfAborted();
      stage("finalizing", "Finishing output file…");
      if (blob && fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          try {
            controller.signal.throwIfAborted();
            await writable.write(blob);
            controller.signal.throwIfAborted();
            await writable.close();
          } catch (error) { await writable.abort().catch(() => undefined); throw error; }
          setStatus(`Rendered ${(blob.size / 1024 / 1024).toFixed(1)} MB ${webm ? "WebM" : "MP4"} to ${outputName}.`);
          context.onRendered?.(blob, outputName);
        } catch (error) {
          throw new Error(`The rendered file could not be saved: ${error instanceof Error ? error.message : String(error)}. Choose a writable destination and retry.`);
        }
      } else if (blob) {
        context.onRendered?.(blob, outputName);
        if (context.onBrowserDownloadReady) {
          context.onBrowserDownloadReady(blob, outputName);
          setStatus(`Render ready — ${(blob.size / 1024 / 1024).toFixed(1)} MB. Tap Save video in Export to download the completed file.`);
        } else {
          triggerDownload(blob, outputName);
          setStatus(`Rendered ${(blob.size / 1024 / 1024).toFixed(1)} MB ${webm ? "WebM" : "MP4"} with the mixed soundtrack.`);
        }
      } else if (streamedToDisk) {
        setStatus(`Rendered a ${queuedMaxDimension === 3840 ? "4K" : "1080p"}, ${queuedFrameRate} fps ${webm ? "WebM" : "MP4"} directly to disk.`);
      }
      if (queuedJob) setRenderQueue((items) => items.map((job) =>
        job.id === queuedJob.id ? { ...job, status: "completed", progress: 1, message: "Render complete" } : job));
      if (queuedJob) void desktopMediaBridge()?.logRenderEvent?.({ event: "render-complete", jobId: queuedJob.id, message: outputName, progress: 1 }).catch(() => undefined);
    } catch (error) {
      const canceled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      if (canceled) setStatus("Render canceled. Your project is still intact.");
      else setStatus(error instanceof Error ? `Render failed: ${error.message}` : "The browser could not render this project.");
      if (queuedJob) setRenderQueue((items) => items.map((job) =>
        job.id === queuedJob.id
          ? { ...job, status: canceled ? "canceled" : "failed", message: canceled ? "Canceled" : "Render failed", error: error instanceof Error ? error.message : undefined }
          : job));
      if (queuedJob) void desktopMediaBridge()?.logRenderEvent?.({ event: canceled ? "render-canceled" : "render-failed", jobId: queuedJob.id, message: error instanceof Error ? error.message : String(error) }).catch(() => undefined);
    } finally {
      setRendering(false);
      setRenderProgress(0);
      renderAbortRef.current = null;
      renderLaunchRef.current = false;
    }
}

export async function deliverActiveComposition(context: VideoDeliveryContext, activeComposition: StudioComposition | undefined, queuedJob?: RenderJob) {
  const { rendering, setRenderQueue, setRenderQueueOpen, renderAbortRef, setRendering, mainFile, visualAssets, compositions, exportFrameRate, exportMaxDimension, setRenderProgress, setStatus } = context;
    if (!activeComposition || rendering || context.renderLaunchRef.current) return;
    context.renderLaunchRef.current = true;
    const job: RenderJob = {
      ...queuedJob,
      id: queuedJob?.id ?? `render-${crypto.randomUUID()}`,
      projectId: context.activeProjectId,
      compositionId: activeComposition.id,
      name: `${activeComposition.name} · VP9 alpha`,
      format: "webm-vp9-alpha",
      status: "preparing",
      progress: 0,
      message: "Preparing transparent composition",
      createdAt: Date.now(),
      frameRate: queuedJob?.frameRate ?? exportFrameRate,
      maxDimension: queuedJob?.maxDimension ?? exportMaxDimension,
    };
    setRenderQueue((items) => queuedJob ? items.map((item) => item.id === job.id ? job : item) : [...items, job]);
    setRenderQueueOpen(true);
    const controller = new AbortController();
    renderAbortRef.current = controller;
    setRendering(true);
    try {
      const size = outputDimensions(activeComposition.width, activeComposition.height, job.maxDimension!);
      const profile = await checkExportProfile({ format: "webm-vp9-alpha", width: size.width, height: size.height, frameRate: job.frameRate! });
      if (!profile.supported) throw new Error(`Transparent composition export is unavailable: ${profile.message} Export an opaque master on this device instead.`);
      controller.signal.throwIfAborted();
      const requiredMedia = renderMediaIds([{ compositionId: activeComposition.id }], compositions, { pictureOnly: true });
      const placements = [{ assetId: `composition:${activeComposition.id}`, compositionId: activeComposition.id, start: 0, sourceStart: 0, duration: activeComposition.duration, scale: 100, opacity: 100, trackId: "composition-export" }];
      const schedule = programAudioSchedule({ main: false, duration: activeComposition.duration, masterGain: 1, audioClips: [], audioTracks: [], audioBuses: [], composition: compositionAudioPlan(compositions, placements) });
      const source = mainFile && (requiredMedia.has("__main__") || schedule.some(clip => clip.assetId === null || clip.assetId === "__main__")) ? await materializePathBackedFile(mainFile, context.mainUrl, controller.signal) : null;
      const audioFiles = new Map<string, File>();
      if (source) audioFiles.set("__main__", source);
      for (const asset of context.assets.filter(asset => schedule.some(clip => clip.assetId === asset.id))) audioFiles.set(asset.id, await materializePathBackedFile(asset.file, asset.url, controller.signal));
      const audioClips = schedule.map(clip => {
        const file = clip.assetId === null ? source : audioFiles.get(clip.assetId);
        if (!file) throw new Error("Composition audio is offline. Relink it before delivery.");
        return { ...clip, file };
      });
      const resolvedAssets: WorkerRenderOptions["assets"] = [];
      for (const asset of visualAssets.filter(({ id }) => requiredMedia.has(id))) resolvedAssets.push({ id: asset.id, file: await materializePathBackedFile(asset.file, asset.url, controller.signal), kind: asset.kind as "image" | "video" });
      const options: WorkerRenderOptions = {
        mainFile: source,
        assets: resolvedAssets,
        placements,
        audioClips,
        useMainAudio: false,
        compositions,
        tracks: [{ id: "composition-export", enabled: true, blend: "normal", opacity: 100, hue: 0, saturation: 100, brightness: 100, glow: 0, color: "#fff", fadeIn: 0, fadeOut: 0 }],
        duration: activeComposition.duration,
        frameRate: job.frameRate!,
        maxDimension: job.maxDimension!,
        sourceSize: { width: activeComposition.width, height: activeComposition.height },
        aspect: "source",
        format: "webm-vp9-alpha",
        transparent: true,
        hardwareAcceleration: "no-preference",
      };
      const onProgress = (progress: number, message: string) => {
        setRenderProgress(progress);
        setStatus(message);
        setRenderQueue((items) => items.map((item) => item.id === job.id ? { ...item, status: "rendering", progress, message } : item));
      };
      let blob: Blob | null;
      controller.signal.throwIfAborted();
      if (workerRenderSupported) {
        const handle = renderInWorker(options, onProgress);
        const abort = () => handle.cancel();
        controller.signal.addEventListener("abort", abort, { once: true });
        try { blob = await handle.result; } finally { controller.signal.removeEventListener("abort", abort); }
      } else {
        blob = await renderProject({ ...options, signal: controller.signal, onProgress });
      }
      if (!blob) throw new Error("The composition renderer returned no file.");
      controller.signal.throwIfAborted();
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `${activeComposition.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.webm`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      setRenderQueue((items) => items.map((item) => item.id === job.id ? { ...item, status: "completed", progress: 1, message: "Alpha render complete" } : item));
      setStatus(`Transparent ${activeComposition.name} WebM rendered with alpha.`);
    } catch (error) {
      const canceled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      setRenderQueue((items) => items.map((item) => item.id === job.id ? { ...item, status: canceled ? "canceled" : "failed", message: canceled ? "Canceled" : "Render failed", error: error instanceof Error ? error.message : undefined } : item));
      setStatus(canceled ? "Composition render canceled." : error instanceof Error ? `Composition render failed: ${error.message}` : "Composition render failed.");
    } finally {
      setRendering(false);
      setRenderProgress(0);
      renderAbortRef.current = null;
      context.renderLaunchRef.current = false;
    }
}
