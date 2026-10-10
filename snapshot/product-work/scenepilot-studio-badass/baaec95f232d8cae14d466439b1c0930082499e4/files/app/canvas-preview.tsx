"use client";

// Live preview painted from the exact frame model the renderer uses. Replaces
// the old DOM/CSS preview, which re-implemented compositing by hand and so
// showed neither the montage, the beat punch, the transitions, nor the grade.
//
// Only source resolution differs from the renderer: here a layer resolves to a
// <video>/<img> element instead of a decoded VideoSample.

import { useEffect, useMemo, useRef } from "react";
import { toUnifiedTimeline } from "../lib/video-timeline";
import { projectEffectAudition } from "../lib/effect-audition";
import { useEffectAudition } from "./effect-audition-store";
import { canCacheVideoFrame, observePreviewSource } from "../lib/preview-source";
import {
  computeFramePlan,
  prepareFramePlanContext,
  paintFramePlan,
  MAIN_SOURCE_ID,
  type CompositorAsset,
  type FramePlan,
  type PreparedFramePlanContext,
  type FrameSource,
  type RenderMotion,
  type RenderPlacement,
  type RenderTrack,
  type StudioComposition,
} from "../lib/compositor";
import { createGradePass, GRADE_PRESETS, type GradeParams } from "../lib/grade";
import type { BaseCut } from "../lib/sequencer";
import type { TransitionConfig } from "../lib/transitions";
import type { StrobeConfig } from "../lib/strobe";
import type { StutterConfig } from "../lib/stutter";
import type { SpeedConfig } from "../lib/speed";
import type { TitleCue } from "../lib/titles";
import { previewRenderDimensions, resolvePreviewQuality, type PreviewPerformanceSample, type PreviewQuality, type ResolvedPreviewQuality } from "../lib/preview-performance";

export type PreviewAsset = {
  id: string;
  url: string;
  kind: "image" | "video";
};

export type CanvasPreviewProps = {
  /** The main media element — drives the clock and, off montage, the base frame. */
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  mainUrl: string;
  /** Main footage remains addressable in nested comps without driving their clock. */
  mainSourceUrl?: string;
  assets: PreviewAsset[];
  placements: RenderPlacement[];
  compositions?: StudioComposition[];
  tracks: RenderTrack[];
  baseCuts: BaseCut[];
  motion?: RenderMotion;
  transition?: TransitionConfig;
  grade?: { params: GradeParams; beatDriven?: boolean } | null;
  strobe?: { config: StrobeConfig; times: number[] } | null;
  stutter?: { config: StutterConfig; beatSeconds: number; origin?: number } | null;
  speed?: { config: SpeedConfig; beatSeconds: number; origin?: number } | null;
  dropRamp?: { dropTime: number; beatSeconds: number; config?: SpeedConfig } | null;
  echo?: { amount: number; beatDriven?: boolean } | null;
  titles?: TitleCue[];
  /** Fallback playhead when the media element isn't the clock (no source yet). */
  currentTime: number;
  width?: number;
  height?: number;
  quality?: PreviewQuality;
  onPerformance?: (sample: PreviewPerformanceSample) => void;
};

/** Seek tolerance before we nudge a source element to the frame's playhead. */
const SEEK_EPSILON = 0.08;
/** Keep a bounded set of decoded video elements. Metadata for the whole bin is
 * retained separately, while only recently painted sources hold decoders. */
const MAX_ACTIVE_VIDEO_DECODERS = 8;

export function CanvasPreview({
  mediaRef, mainUrl, mainSourceUrl = mainUrl, assets, placements: projectPlacements, compositions: projectCompositions = [], tracks, baseCuts: projectBaseCuts,
  motion, transition, grade, strobe, stutter, speed, dropRamp, echo, titles, currentTime, width = 960, height = 540,
  quality = "auto", onPerformance,
}: CanvasPreviewProps) {
  const audition = useEffectAudition();
  const { baseCuts, placements, compositions } = useMemo(() => projectEffectAudition({
    baseCuts: projectBaseCuts, placements: projectPlacements, compositions: projectCompositions,
  }, audition && !audition.original ? audition.audition : null), [projectBaseCuts, projectPlacements, projectCompositions, audition]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaPool = useRef(new Map<string, HTMLVideoElement | HTMLImageElement>());
  const mediaMetadata = useRef(new Map<string, { width: number; height: number; duration: number }>());
  const videoUseOrder = useRef(new Map<string, number>());
  const mainVisualRef = useRef<HTMLVideoElement | null>(null);
  const previewRevision = useRef(0);
  const videoClips = useMemo(() => toUnifiedTimeline(baseCuts, placements, "__base__"), [baseCuts, placements]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  // Latest props for the animation loop, so the loop never restarts mid-playback.
  const latest = useRef({ assets, assetById, videoClips, compositions, tracks, motion, transition, grade, strobe, stutter, speed, dropRamp, echo, titles, currentTime, mainUrl });
  useEffect(() => {
    latest.current = { assets, assetById, videoClips, compositions, tracks, motion, transition, grade, strobe, stutter, speed, dropRamp, echo, titles, currentTime, mainUrl };
  });
  useEffect(() => {
    previewRevision.current += 1;
  }, [assets, placements, compositions, tracks, baseCuts, motion, transition, grade, strobe, stutter, speed, dropRamp, echo, titles, mainUrl, mainSourceUrl, width, height]);

  // Images stay warm; videos are metadata-probed here and decoded lazily in the
  // paint loop. This prevents a large bin from opening hundreds of decoders.
  useEffect(() => {
    const pool = mediaPool.current;
    const live = new Set(assets.map((asset) => asset.id));
    for (const [id, element] of pool) {
      if (live.has(id)) continue;
      if (element instanceof HTMLVideoElement) {
        element.removeAttribute("src");
        element.load();
      }
      pool.delete(id);
      videoUseOrder.current.delete(id);
      mediaMetadata.current.delete(id);
    }
    for (const id of mediaMetadata.current.keys()) if (!live.has(id)) mediaMetadata.current.delete(id);
    const probes: HTMLVideoElement[] = [];
    for (const asset of assets) {
      const existing = pool.get(asset.id);
      if (existing && existing.getAttribute("data-url") === asset.url) continue;
      if (asset.kind === "image") {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = asset.url;
        image.setAttribute("data-url", asset.url);
        image.onload = () => {
          mediaMetadata.current.set(asset.id, { width: image.naturalWidth, height: image.naturalHeight, duration: Infinity });
          previewRevision.current += 1;
        };
        pool.set(asset.id, image);
      } else {
        if (existing instanceof HTMLVideoElement) {
          existing.removeAttribute("src");
          existing.load();
          pool.delete(asset.id);
          videoUseOrder.current.delete(asset.id);
        }
        const probe = document.createElement("video");
        probe.crossOrigin = "anonymous";
        probes.push(probe);
        probe.preload = "metadata";
        probe.src = asset.url;
        probe.onloadedmetadata = () => {
          mediaMetadata.current.set(asset.id, {
            width: probe.videoWidth,
            height: probe.videoHeight,
            duration: Number.isFinite(probe.duration) ? probe.duration : Infinity,
          });
          previewRevision.current += 1;
          probe.removeAttribute("src");
          probe.load();
        };
      }
    }
    return () => probes.forEach((probe) => { probe.removeAttribute("src"); probe.load(); });
  }, [assets]);

  // Keep picture decoding separate from the audible main media clock. This lets
  // speed ramps and stutters seek the picture without disturbing the soundtrack.
  useEffect(() => {
    const previous = mainVisualRef.current;
    if (previous) {
      previous.removeAttribute("src");
      previous.load();
      mainVisualRef.current = null;
    }
    if (!mainSourceUrl) return;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = mainSourceUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const stopObserving = observePreviewSource(video, () => { previewRevision.current += 1; });
    mainVisualRef.current = video;
    return () => {
      stopObserving();
      video.removeAttribute("src");
      video.load();
      if (mainVisualRef.current === video) mainVisualRef.current = null;
    };
  }, [mainSourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Compositing happens on a 2D canvas; the visible canvas is WebGL so the
    // grade runs the same shader the export uses. Without WebGL we present the
    // 2D canvas directly and simply skip the grade.
    const scene = document.createElement("canvas");
    scene.width = width;
    scene.height = height;
    const context = scene.getContext("2d", { alpha: false });
    if (!context) return;

    let gradePass: ReturnType<typeof createGradePass> | null = null;
    let presentContext: CanvasRenderingContext2D | null = null;
    const gl = canvas.getContext("webgl", { alpha: false, preserveDrawingBuffer: true, antialias: false });
    if (gl) {
      gl.viewport(0, 0, width, height);
      try {
        gradePass = createGradePass(gl);
      } catch {
        gradePass = null;
      }
    }
    if (!gradePass) presentContext = canvas.getContext("2d", { alpha: false });

    let frame = 0;
    let useCounter = 0;
    let resolvedQuality: ResolvedPreviewQuality = quality === "auto" ? "full" : quality;
    let sampleStarted = performance.now();
    let sampledFrames = 0;
    let sampledFrameMs = 0;
    let droppedFrames = 0;
    let lastFrameAt = sampleStarted;
    const planCache = new Map<string, FramePlan>();
    // Bounded RAM preview: revisiting a rendered frame avoids re-running pixel
    // effects, masks and nested composition paint. Plans remain a separate,
    // cheaper cache. A 64 MB ceiling prevents long sessions from ballooning.
    const frameCache = new Map<string, ImageData>();
    let frameCacheBytes = 0;
    let previousRequestedCacheKey = "";
    const MAX_FRAME_CACHE_BYTES = 64 * 1024 * 1024;
    let compiledRevision = -1;
    let compiledAssets: CompositorAsset[] = [];
    let compiledAssetSignature = "";
    let prepared: PreparedFramePlanContext | null = null;
    const ensureVideo = (asset: PreviewAsset) => {
      const pool = mediaPool.current;
      const existing = pool.get(asset.id);
      if (existing instanceof HTMLVideoElement && existing.getAttribute("data-url") === asset.url) {
        videoUseOrder.current.set(asset.id, ++useCounter);
        return existing;
      }
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = asset.url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("data-url", asset.url);
      video.onloadedmetadata = () => mediaMetadata.current.set(asset.id, {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Number.isFinite(video.duration) ? video.duration : Infinity,
      });
      pool.set(asset.id, video);
      videoUseOrder.current.set(asset.id, ++useCounter);
      const activeVideos = [...pool.entries()].filter((entry): entry is [string, HTMLVideoElement] => entry[1] instanceof HTMLVideoElement);
      if (activeVideos.length > MAX_ACTIVE_VIDEO_DECODERS) {
        const [evictId, evictVideo] = activeVideos
          .filter(([id]) => id !== asset.id)
          .sort(([left], [right]) => (videoUseOrder.current.get(left) ?? 0) - (videoUseOrder.current.get(right) ?? 0))[0] ?? [];
        if (evictId && evictVideo) {
          evictVideo.removeAttribute("src");
          evictVideo.load();
          pool.delete(evictId);
          videoUseOrder.current.delete(evictId);
        }
      }
      return video;
    };
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const frameStarted = performance.now();
      const frameInterval = frameStarted - lastFrameAt;
      lastFrameAt = frameStarted;
      if (frameInterval > 25) droppedFrames += 1;
      const state = latest.current;
      const media = mediaRef.current;
      const time = media && state.mainUrl ? media.currentTime : state.currentTime;

      // Compile immutable bin/timeline lookup data only when project media or
      // edit state changes. Large projects previously rebuilt and split every
      // clip plus every asset on every animation frame.
      if (compiledRevision !== previewRevision.current) {
        planCache.clear();
        frameCache.clear();
        frameCacheBytes = 0;
        previousRequestedCacheKey = "";
        compiledAssets = [];
        for (const asset of state.assets) {
          const element = mediaPool.current.get(asset.id);
          const metadata = mediaMetadata.current.get(asset.id);
          const isVideo = asset.kind === "video";
          const sourceWidth = metadata?.width ?? (element instanceof HTMLVideoElement ? element.videoWidth : element?.naturalWidth ?? 0);
          const sourceHeight = metadata?.height ?? (element instanceof HTMLVideoElement ? element.videoHeight : element?.naturalHeight ?? 0);
          if (!sourceWidth || !sourceHeight) continue;
          compiledAssets.push({
            id: asset.id,
            kind: asset.kind,
            width: sourceWidth,
            height: sourceHeight,
            duration: isVideo ? metadata?.duration ?? (element instanceof HTMLVideoElement && Number.isFinite(element.duration) ? element.duration : Infinity) : Infinity,
          });
        }
        const main = mainVisualRef.current;
        if (main?.videoWidth && main.videoHeight) compiledAssets.push({
          id: MAIN_SOURCE_ID, kind: "video", width: main.videoWidth, height: main.videoHeight,
          duration: Number.isFinite(main.duration) ? main.duration : Infinity,
        });
        compiledAssetSignature = compiledAssets.map((asset) => `${asset.id}:${asset.width}x${asset.height}`).join("|");
        prepared = prepareFramePlanContext({ assets: compiledAssets, videoClips: state.videoClips, compositions: state.compositions });
        compiledRevision = previewRevision.current;
      }

      const mainElement = mainVisualRef.current?.videoWidth ? mainVisualRef.current : null;
      const dimensions = previewRenderDimensions(width, height, resolvedQuality);
      const renderWidth = dimensions.width;
      const renderHeight = dimensions.height;
      if (scene.width !== renderWidth || scene.height !== renderHeight) {
        scene.width = renderWidth;
        scene.height = renderHeight;
        planCache.clear();
        frameCache.clear();
        frameCacheBytes = 0;
        previousRequestedCacheKey = "";
      }
      const frameNumber = Math.round(time * 60);
      const cacheKey = `${previewRevision.current}:${resolvedQuality}:${frameNumber}:${compiledAssetSignature}`;
      let plan = planCache.get(cacheKey);
      if (!plan) plan = computeFramePlan({
        time,
        width: renderWidth,
        height: renderHeight,
        assets: compiledAssets,
        // Render from the unified track model (base lane + overlays as one array).
        // Byte-identical to passing the two arrays — see the compositor parity test.
        videoClips: state.videoClips,
        prepared: prepared ?? undefined,
        compositions: state.compositions,
        tracks: state.tracks,
        mainVideo: state.mainUrl && mainElement ? { width: mainElement.videoWidth, height: mainElement.videoHeight } : null,
        motion: state.motion,
        transition: state.transition,
        grade: state.grade ?? null,
        strobe: state.strobe ?? null,
        stutter: state.stutter ?? null,
        speed: state.speed ?? null,
        dropRamp: state.dropRamp ?? null,
        echo: state.echo ?? null,
        titles: state.titles ?? [],
      });
      if (!planCache.has(cacheKey)) {
        planCache.set(cacheKey, plan);
        if (planCache.size > 120) planCache.delete(planCache.keys().next().value!);
      }

      const cachedFrame = plan.echo <= 0 ? frameCache.get(cacheKey) : undefined;
      const repeatedFrame = previousRequestedCacheKey === cacheKey;
      previousRequestedCacheKey = cacheKey;
      let frameComplete = true;
      if (cachedFrame) context.putImageData(cachedFrame, 0, 0);
      else paintFramePlan(context, plan, renderWidth, renderHeight, (layer): FrameSource | null => {
        if (layer.assetId === MAIN_SOURCE_ID) {
          if (!mainElement) { frameComplete = false; return null; }
          if (Math.abs(mainElement.currentTime - layer.sourceTime) > SEEK_EPSILON) {
            try { mainElement.currentTime = layer.sourceTime; } catch { /* source is not seekable yet */ }
          }
          if (mainElement.readyState < 2) { frameComplete = false; return null; }
          // Seeking is asynchronous. It is safe to display the decoder's latest
          // frame, but never freeze that stale frame into the RAM preview cache.
          if (!canCacheVideoFrame(mainElement, layer.sourceTime, SEEK_EPSILON)) frameComplete = false;
          return { draw: (ctx, x, y, w, h) => ctx.drawImage(mainElement, x, y, w, h) };
        }
        const asset = state.assetById.get(layer.assetId);
        const element = asset?.kind === "video" ? ensureVideo(asset) : mediaPool.current.get(layer.assetId);
        if (!element) { frameComplete = false; return null; }
        if (element instanceof HTMLVideoElement) {
          // Nudge the clip to this frame's playhead; the montage jumps around,
          // so a small tolerance keeps seeking from thrashing.
          if (Math.abs(element.currentTime - layer.sourceTime) > SEEK_EPSILON) {
            try { element.currentTime = layer.sourceTime; } catch { /* not seekable yet */ }
          }
          if (element.readyState < 2) { frameComplete = false; return null; }
          if (!canCacheVideoFrame(element, layer.sourceTime, SEEK_EPSILON)) frameComplete = false;
        } else if (!element.complete) {
          frameComplete = false;
          return null;
        }
        return { draw: (ctx, x, y, w, h) => ctx.drawImage(element, x, y, w, h) };
      });
      // Readback stalls the GPU, so cache only a frame requested on consecutive
      // animation ticks (a paused playhead), never every frame during playback.
      if (!cachedFrame && repeatedFrame && frameComplete && plan.echo <= 0 && renderWidth * renderHeight <= 2_100_000) {
        const image = context.getImageData(0, 0, renderWidth, renderHeight);
        frameCache.set(cacheKey, image);
        frameCacheBytes += image.data.byteLength;
        while (frameCacheBytes > MAX_FRAME_CACHE_BYTES && frameCache.size > 1) {
          const oldestKey = frameCache.keys().next().value!;
          const oldest = frameCache.get(oldestKey);
          if (oldest) frameCacheBytes -= oldest.data.byteLength;
          frameCache.delete(oldestKey);
        }
      }

      if (gradePass) {
        gradePass.render(scene, plan.grade ?? GRADE_PRESETS.none, time * 60);
      } else if (presentContext) {
        presentContext.drawImage(scene, 0, 0, width, height);
      }
      sampledFrames += 1;
      sampledFrameMs += performance.now() - frameStarted;
      if (sampledFrames >= 30 || performance.now() - sampleStarted >= 1000) {
        const averageFrameMs = sampledFrameMs / Math.max(1, sampledFrames);
        const droppedFrameRatio = droppedFrames / Math.max(1, sampledFrames);
        resolvedQuality = resolvePreviewQuality(quality, resolvedQuality, averageFrameMs, droppedFrameRatio, width * height);
        onPerformance?.({ averageFrameMs, droppedFrameRatio, cacheEntries: planCache.size + frameCache.size, activeDecoders: videoUseOrder.current.size, quality: resolvedQuality });
        sampleStarted = performance.now();
        sampledFrames = 0;
        sampledFrameMs = 0;
        droppedFrames = 0;
      }
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      gradePass?.dispose();
    };
  }, [mediaRef, width, height, quality, onPerformance]);

  return <canvas ref={canvasRef} width={width} height={height} className="preview-canvas" />;
}
