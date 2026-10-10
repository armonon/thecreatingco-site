// The single source of truth for what a frame looks like.
//
// Preview and export used to each decide this independently — the DOM preview
// with CSS filters, the renderer with canvas ops — so they drifted and the
// preview lied. Now both call computeFramePlan() and paint the same declarative
// plan. Anything visible in the export is decided here, once.
//
// This module is pure: no DOM, no media decoding. Hosts resolve their own frame
// sources and hand them to paintFramePlan().

import { beatEnvelopeAt, beatPunchScale, beatShake, DEFAULT_PUNCH, NO_SHAKE, type PunchConfig, type ShakeConfig } from "./motion.ts";
import { clipWhiteBalance, type BaseCut, type ClipColorAdjust } from "./sequencer.ts";
import { clipVisualPipeline, type ClipVisualEffect, type ResolvedEffectPass, type ResolvedPixelEffect } from "./clip-effects.ts";
import { compileEffectGraph, resolveEffectGraph, validateEffectGraph, type EffectGraph, type ResolvedEffectGraph } from "./effect-graph.ts";
import { applyPixelEffectGpu } from "./pixel-kernel-gpu.ts";
import { applyCustomShaderGpu } from "./custom-shader-gpu.ts";
import { applyGraphPairGpu } from "./graph-kernel-gpu.ts";
import { recordGraphExecution } from "./graph-profiler.ts";
import type { TimeRemapKeyframe } from "./time-remap.ts";
import { splitUnifiedTimeline, type VideoClip } from "./video-timeline.ts";
import { transitionAtCut, transitionConfigForCut, crossClipAtCut, isCrossClip, NO_EFFECT, TRANSITION_PRESETS, type ClipDraw, type TransitionConfig } from "./transitions.ts";
import { evaluateTransformKeyframes, IDENTITY_TRANSFORM, type TransformKeyframe } from "./keyframes.ts";
import { gradeAtEnergy, type GradeParams } from "./grade.ts";
import { strobeColorAt, strobeLevelAt, type StrobeConfig } from "./strobe.ts";
import { stutterTime, type StutterConfig } from "./stutter.ts";
import { dropRampTime, speedRampTime, type SpeedConfig } from "./speed.ts";
import { titleAppearance, type TitleCue } from "./titles.ts";
import { charAppearance, type TextAnimator } from "./text-animate.ts";
import { sourceTimeForCut } from "./pro-editor.ts";
import { evaluateLayerMotion, type LayerMotionExpression } from "./layer-motion.ts";
import { planarTransformAt, type PlanarTrack } from "./planar-tracker.ts";
import { meshWarpPoint, type MeshWarp } from "./mesh-warp.ts";
import { contentAwareFill } from "./object-removal.ts";
import { particlesAt, type ParticleConfig } from "./particles.ts";
import { vectorShapeContours, type ShapeOptions, type VectorShape } from "./vector-shapes.ts";
import { decodeRotoAlphaMatte, rotoAlphaAt, rotoMotionPathsAt, rotoPathAt, type RotoAlphaMatte, type RotoMask, type RotoPathSample, type RotoPoint } from "./rotoscope.ts";
import { normalizeComposition, orderedCompositionLayers } from "./composition-tracks.ts";
import {
  activeCompositionCameraAt,
  applySpatialBasis,
  evaluate3DKeyframes,
  multiplySpatialBases,
  projectCompositionLayer,
  projectCompositionShadow,
  scaleCameraForRender,
  scaleLightsForRender,
  spatialBasis,
  type Composition3DKeyframe,
  type CompositionCamera,
  type CompositionLight,
  type CompositionMaterial,
  type Point2D,
  type ProjectedQuad,
  type Matrix3,
} from "./composition-3d.ts";

/** Sentinel asset id for the continuous main video (non-montage mode). */
export const MAIN_SOURCE_ID = "__main__";

/** Frame-trail presets. `amount` is how much of the previous frame survives. */
export const ECHO_PRESETS: Record<string, { amount: number; beatDriven?: boolean }> = {
  off: { amount: 0 },
  ghost: { amount: 0.5 },
  trails: { amount: 0.72 },
  pulse: { amount: 0.6, beatDriven: true },
  smear: { amount: 0.88 },
};

/** A grade that changes nothing — used when only a strobe needs the pass. */
const IDENTITY_GRADE: GradeParams = {
  exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0,
  bloom: 0, aberration: 0, vignette: 0, grain: 0,
  beat: 0, strobe: 0, strobeColor: [1, 1, 1], mirror: 0, streak: 0,
};

export type RenderPlacement = {
  id?: string;
  assetId: string;
  /** Nested composition id. When present, the placement is rendered as a comp
   * instead of resolving `assetId` to imported media. */
  compositionId?: string;
  start: number;
  sourceStart?: number;
  /** Source seconds played per timeline second. */
  playbackRate?: number;
  duration: number;
  scale: number;
  opacity: number;
  fadeIn?: number;
  fadeOut?: number;
  trackId?: string;
  /** Per-clip transform animation, times local to the placement start. */
  transformKeyframes?: TransformKeyframe[];
  /** Overlay clips now carry the same rich attribute set as base cuts, rendered
   *  through the same source-time + clip-filter path — so an overlay can be
   *  graded, effected, flipped, reversed, and time-remapped just like V1. All
   *  optional; absent leaves the original overlay behaviour untouched. */
  color?: ClipColorAdjust;
  effects?: ClipVisualEffect[];
  flipH?: boolean;
  flipV?: boolean;
  reversed?: boolean;
  timeRemap?: TimeRemapKeyframe[];
};

// Composition keyframes and timeline-clip keyframes are the same shape and use
// the same evaluator (lib/keyframes.ts) — kept as an alias so existing callers
// and saved projects are unaffected.
export type CompositionKeyframe = TransformKeyframe;

export type CompositionLayer = {
  id: string;
  name: string;
  kind: "text" | "shape" | "particle" | "media" | "null" | "adjustment" | "composition";
  /** Imported project asset used by a media layer. */
  assetId?: string;
  /** Nested composition used by a precomposition layer. */
  compositionId?: string;
  /** Ordered composition lane containing this item. Tracks are stored bottom to
   * top on StudioComposition; absent ids are migrated for older projects. */
  trackId?: string;
  /** Optional transform parent (including null objects). */
  parentId?: string;
  /** Layer timing in parent-composition seconds. Omitted values preserve the
   * legacy behavior of spanning the complete composition. */
  start?: number;
  duration?: number;
  /** Source/keyframe time at the layer in-point and rate through that source. */
  sourceStart?: number;
  playbackRate?: number;
  /** Audio-lane controls. Ignored by visual layers. */
  audioGain?: number;
  audioPan?: number;
  audioFadeIn?: number;
  audioFadeOut?: number;
  audioMuted?: boolean;
  /** Optional layer whose alpha bounds act as this layer's track matte. */
  matteLayerId?: string;
  /** Track matte: another layer whose alpha or luma masks this one. */
  trackMatte?: { layerId: string; mode: "alpha" | "luma"; inverted: boolean };
  text: string;
  /** Per-character text reveal. Uses the same deterministic animator as titles. */
  textAnimator?: TextAnimator;
  shape: VectorShape;
  shapeOptions?: ShapeOptions;
  particle?: ParticleConfig;
  meshWarp?: MeshWarp;
  /** Tracked removal matte. The painter uses the layer mask/roto pixels as the
   * bounded fill region when enabled. */
  removal?: { enabled: boolean; passes: number; mode?: "spatial" | "clean-plate" | "neural"; cleanPlateAssetId?: string; cacheKey?: string; model?: string };
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  opacity: number;
  /** Switches this layer from the legacy flat stack into the camera-projected
   * composition scene. All fields remain plain data so render workers can clone them. */
  threeD?: boolean;
  z?: number;
  rotationX?: number;
  rotationY?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  spatialKeyframes?: Composition3DKeyframe[];
  material?: CompositionMaterial;
  enabled: boolean;
  /** Prevents accidental viewer/timeline manipulation while preserving render output. */
  locked?: boolean;
  blend: "normal" | "screen" | "overlay" | "multiply" | "lighten" | "darken" | "difference" | "color-dodge";
  effect: "none" | "glow" | "blur";
  /** Ordered layer-level effects. `effect` remains as a legacy quick-look
   * field for backwards-compatible projects and presets. */
  effects?: ClipVisualEffect[];
  /** Optional node workbench. Only its validated Source→Output chain renders. */
  effectGraph?: EffectGraph;
  animation: "none" | "pulse" | "drift" | "spin";
  /** Serializable AE-style expression evaluated identically in preview/export. */
  expression?: LayerMotionExpression;
  /** Pixel-tracked planar surface. Plain keyframe data keeps worker cloning safe. */
  planarTrack?: PlanarTrack;
  motionBlur?: boolean;
  mask?: {
    enabled: boolean;
    shape: "rectangle" | "ellipse";
    feather: number;
    expansion: number;
    inverted: boolean;
    /** Mask bounds as percentages inside the layer. Missing values preserve legacy full-layer masks. */
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  };
  /** Temporally tracked, editable subject contour in normalized layer space. */
  roto?: RotoMask;
  presetId?: string;
  keyframes: CompositionKeyframe[];
  /** A media layer that is a nested base-timeline clip carries the clip's full
   *  attribute set so nesting is lossless (see nestBaseCuts in lib/nest.ts).
   *  These render through the same source-time + clip-filter path the base lane
   *  uses. All optional — absent leaves the legacy media-layer behaviour. */
  clipColor?: ClipColorAdjust;
  clipEffects?: ClipVisualEffect[];
  clipFlipH?: boolean;
  clipFlipV?: boolean;
  clipReversed?: boolean;
  clipTimeRemap?: TimeRemapKeyframe[];
};

export type CompositionTrack = {
  id: string;
  name: string;
  kind: "video" | "audio";
  enabled: boolean;
  locked: boolean;
  /** Audio tracks mute; video tracks hide. Kept separate from enabled so a
   * muted lane remains visible and editable in the timeline. */
  muted?: boolean;
  solo?: boolean;
};

export type StudioComposition = {
  id: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  background: string;
  cameras?: CompositionCamera[];
  activeCameraId?: string;
  lights?: CompositionLight[];
  /** Bottom-to-top render order. Optional for backwards-compatible project
   * loading; normalizeComposition() supplies deterministic legacy tracks. */
  tracks?: CompositionTrack[];
  layers: CompositionLayer[];
};

export type RenderTrack = {
  id: string;
  enabled: boolean;
  /** When any video track is soloed, only soloed tracks composite. */
  solo?: boolean;
  blend: "screen" | "normal" | "overlay" | "multiply";
  opacity: number;
  hue: number;
  saturation: number;
  brightness: number;
  glow: number;
  color: string;
  fadeIn: number;
  fadeOut: number;
};

/** Beat-synced camera motion applied to the base (and, optionally, overlays). */
export type RenderMotion = {
  beats: number[];
  /** Accented beats (downbeats/kicks) that punch harder. Subset of `beats`. */
  accents?: number[];
  punch?: PunchConfig;
  /** Beat-driven camera shake applied to the base layer. */
  shake?: ShakeConfig;
  /** Also pulse overlay clips, not just the base layer. Default false. */
  affectOverlays?: boolean;
  /** Section spans (sorted, covering the song). When present, punch/shake/grade
   *  scale with the local section energy so hot sections hit harder and the
   *  intro stays gentle. Serializable (functions can't cross to the worker). */
  energySections?: { start: number; end: number; energy: number }[];
  /** Precomputed audio-reactive band envelopes (see lib/reactive.ts): a bass-pump
   *  zoom rides `low`, a hats shimmer rides `high`. Sampled by index off the
   *  signal grid (`startTime` + `step`). Serializable for the same reason. */
  reactive?: { low: number[]; high: number[]; startTime: number; step: number };
};

/** Section energy at a time (sections sorted, covering the song). Clamps to the
 *  ends outside any span. */
function sectionEnergyAt(sections: { start: number; end: number; energy: number }[], time: number): number {
  if (!sections.length) return 1;
  if (time < sections[0].start) return sections[0].energy;
  for (const section of sections) if (time >= section.start && time < section.end) return section.energy;
  return sections[sections.length - 1].energy;
}

/** Sample a precomputed band envelope by direct index into the signal grid. */
function bandSampleAt(envelope: number[], startTime: number, step: number, time: number): number {
  if (!envelope.length) return 0;
  const index = Math.round((time - startTime) / Math.max(1e-6, step));
  return envelope[Math.max(0, Math.min(envelope.length - 1, index))] ?? 0;
}

/** Intrinsic facts a host must resolve once before planning frames. */
export type CompositorAsset = {
  id: string;
  kind: "image" | "video";
  width: number;
  height: number;
  /** Source length in seconds; Infinity for stills. */
  duration: number;
};

export type Box = { x: number; y: number; width: number; height: number };

export type TitleDraw = {
  value: string;
  color: string;
  /** Cap height in device pixels, already scaled by entrance + beat punch. */
  fontPx: number;
  /** Centre point in device pixels. */
  cx: number;
  cy: number;
  /** Per-character animator + its clock (see lib/text-animate.ts). */
  animator?: TextAnimator;
  elapsed?: number;
  duration?: number;
};

export type FrameLayer = {
  kind: "base" | "overlay" | "title" | "graphic" | "adjustment";
  assetId: string;
  box: Box;
  /** Playhead within the source asset, already clamped to its duration. */
  sourceTime: number;
  alpha: number;
  /** Roll about the layer's centre, in degrees. 0 for most layers. */
  rotation: number;
  /** Camera-projected corners in TL, TR, BR, BL order. The painter maps the
   * source through two affine triangles, so preview and export share perspective. */
  quad?: ProjectedQuad;
  /** Positive camera-space depth, retained for deterministic 3D ordering/debugging. */
  depth?: number;
  /** Per-channel material multipliers for non-neutral composition lights. */
  lighting?: [number, number, number];
  /** A light-ray projection of this layer onto an explicit 3D receiver. */
  shadow?: {
    quad: ProjectedQuad;
    receiverQuad: ProjectedQuad;
    opacity: number;
    softness: number;
  };
  /** Mirror the layer about its centre (see BaseCut flipH/flipV). */
  flipH?: boolean;
  flipV?: boolean;
  blend: "source-over" | "screen" | "overlay" | "multiply" | "lighten" | "darken" | "difference" | "color-dodge";
  /** CSS filter string — valid for both canvas2d `ctx.filter` and DOM. */
  filter: string;
  /** Ordered CPU pixel passes that cannot be represented by Canvas filters.
   * Plain data keeps the same operations available in preview and render workers. */
  pixelEffects?: ResolvedPixelEffect[];
  /** Ordered filter/pixel passes, including an optional mask per pass. */
  effectPasses?: ResolvedEffectPass[];
  /** A resolved branching compositor graph. Only plain data crosses into the
   * render worker; execution lives in the shared painter below. */
  effectGraph?: ResolvedEffectGraph;
  /** Per-layer channel offsets, applied by the shared painter after the CSS
   * filter stack. Plain data keeps render-worker structured cloning safe. */
  whiteBalance?: { temperature: number; tint: number };
  /** Replace the current mask/roto region with deterministic surrounding pixels. */
  removal?: { enabled: boolean; passes: number; mode?: "spatial" | "clean-plate" | "neural"; cleanPlateAssetId?: string; cacheKey?: string; model?: string };
  /** Optional deformable mesh for media layers. */
  meshWarp?: MeshWarp;
  mask?: {
    shape: "rectangle" | "ellipse";
    inverted: boolean;
    feather: number;
    expansion: number;
    box?: Box;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    path?: RotoPoint[];
    alphaMatte?: RotoAlphaMatte;
    /** Shared-painter foreground colour bleed into soft edge pixels, 0..1. */
    edgeColorCleanup?: number;
    /** Temporal alpha samples used for subject-only motion blur. */
    pathSamples?: RotoPathSample[];
  };
  /** Present only on `title` layers; the compositor draws the text itself. */
  title?: TitleDraw;
  /** Present only on nested-composition graphic layers. */
  graphic?: {
    kind: "text" | "shape" | "particle";
    value: string;
    textAnimator?: TextAnimator;
    duration?: number;
    shape: VectorShape;
    shapeOptions?: ShapeOptions;
    particle?: ParticleConfig;
    meshWarp?: MeshWarp;
    seed?: string;
    time?: number;
    color: string;
    fontPx: number;
    glow: number;
  };
  /** A separately rendered layer whose pixels drive this layer's visibility.
   * This is deliberately part of the shared frame plan so preview and export
   * execute the exact same alpha/luma matte pass. */
  matte?: {
    layer: FrameLayer;
    mode: "alpha" | "luma";
    inverted: boolean;
  };
};

export type FramePlan = {
  time: number;
  layers: FrameLayer[];
  transparent?: boolean;
  /** White flash overlay alpha, above every layer. */
  flash: number;
  /**
   * Frame-trail feedback, 0..1. The paint step fades the previous frame by
   * (1 - echo) instead of clearing it, so motion leaves ghost trails. Both the
   * renderer and the preview reuse their canvas frame-to-frame, so this is all
   * the state the effect needs.
   */
  echo: number;
  /** Positioned synthetic light drawn after picture layers and before transition flash. */
  strobeLight: {
    mode: "radial" | "split" | "bars" | "sweep";
    blend: "screen" | "add" | "overlay";
    level: number;
    color: [number, number, number];
    x: number;
    y: number;
    size: number;
    softness: number;
    angle: number;
  } | null;
  /** Grade params for the post pass, or null when ungraded. */
  grade: GradeParams | null;
};

export type FramePlanOptions = {
  time: number;
  width: number;
  height: number;
  assets: CompositorAsset[];
  placements?: RenderPlacement[];
  /** Unified track model: base lane + overlays as one array (lib/video-timeline).
   *  When present it supersedes `baseCuts`/`placements` (split from it losslessly). */
  videoClips?: VideoClip[];
  /** After Effects-style nested comps that can be placed on the master tracks. */
  compositions?: StudioComposition[];
  tracks?: RenderTrack[];
  /** Beat-cut montage. Non-empty switches the base layer to the sequence. */
  baseCuts?: BaseCut[];
  /** Intrinsic size of the continuous main video, used when not in montage mode. */
  mainVideo?: { width: number; height: number } | null;
  motion?: RenderMotion;
  transition?: TransitionConfig;
  grade?: { params: GradeParams; beatDriven?: boolean } | null;
  /**
   * Synthetic strobe lights. `times` comes from strobeTimes(), precomputed once
   * per edit rather than per frame.
   */
  strobe?: { config: StrobeConfig; times: number[] } | null;
  /**
   * Stutter applied to the base layer's source playhead. `beatSeconds` and
   * `origin` come from the beat grid — see beatSecondsFrom().
   */
  stutter?: { config: StutterConfig; beatSeconds: number; origin?: number; beats?: number[] } | null;
  /** Speed ramp applied to the base layer's source playhead. See lib/speed.ts. */
  speed?: { config: SpeedConfig; beatSeconds: number; origin?: number; beats?: number[] } | null;
  /** One-shot slow-mo decelerating into a freeze on the drop. See lib/speed.ts. */
  dropRamp?: { dropTime: number; beatSeconds: number; config?: SpeedConfig } | null;
  /** Frame-trail feedback. `amount` 0..1; `beatDriven` swells trails on the beat. */
  echo?: { amount: number; beatDriven?: boolean } | null;
  /** Kinetic title cues (see lib/titles.ts). Rendered above everything. */
  titles?: TitleCue[];
  /** Preserve canvas alpha and omit the master base layer for motion graphics. */
  transparent?: boolean;
  /** Runtime-only indexes compiled once per immutable timeline revision. Never
   * place this Map-backed object on render-worker messages; create it inside the
   * preview/export host with prepareFramePlanContext(). */
  prepared?: PreparedFramePlanContext;
};

type PreparedTimelineLane<T extends { start: number; duration: number }> = {
  items: T[];
  prefixMaxEnd: number[];
};

export type PreparedFramePlanContext = {
  baseCuts: BaseCut[];
  baseCutLane: PreparedTimelineLane<BaseCut>;
  placements: RenderPlacement[];
  assetById: Map<string, CompositorAsset>;
  compositionById: Map<string, StudioComposition>;
  placementLaneByTrack: Map<string, PreparedTimelineLane<RenderPlacement>>;
  allPlacementsLane: PreparedTimelineLane<RenderPlacement>;
};

function timelineLane<T extends { start: number; duration: number }>(source: T[]): PreparedTimelineLane<T> {
  const items = [...source].sort((left, right) => left.start - right.start);
  const prefixMaxEnd: number[] = [];
  let maximum = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    maximum = Math.max(maximum, item.start + item.duration);
    prefixMaxEnd.push(maximum);
  }
  return { items, prefixMaxEnd };
}

function lastStartedIndex<T extends { start: number }>(items: T[], time: number) {
  let low = 0;
  let high = items.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (items[middle].start <= time) { found = middle; low = middle + 1; }
    else high = middle - 1;
  }
  return found;
}

function activeLaneWinnerIndex<T extends { start: number; duration: number }>(lane: PreparedTimelineLane<T>, time: number): number {
  for (let index = lastStartedIndex(lane.items, time); index >= 0; index--) {
    const item = lane.items[index];
    if (time >= item.start && time < item.start + item.duration) return index;
    if (index === 0 || lane.prefixMaxEnd[index - 1] <= time) break;
  }
  return -1;
}

function activeLaneWinner<T extends { start: number; duration: number }>(lane: PreparedTimelineLane<T>, time: number): T | undefined {
  const index = activeLaneWinnerIndex(lane, time);
  return index >= 0 ? lane.items[index] : undefined;
}

function activeLaneItems<T extends { start: number; duration: number }>(lane: PreparedTimelineLane<T>, time: number): T[] {
  const active: T[] = [];
  for (let index = lastStartedIndex(lane.items, time); index >= 0; index--) {
    const item = lane.items[index];
    if (time >= item.start && time < item.start + item.duration) active.push(item);
    if (index === 0 || lane.prefixMaxEnd[index - 1] <= time) break;
  }
  return active.reverse();
}

/** Compile immutable timeline/media lookup data once, outside the per-frame hot
 * path. The result deliberately contains Maps and stays local to its host. */
export function prepareFramePlanContext(options: Pick<FramePlanOptions, "assets" | "videoClips" | "baseCuts" | "placements" | "compositions">): PreparedFramePlanContext {
  const split = options.videoClips ? splitUnifiedTimeline(options.videoClips) : null;
  const baseCuts = split ? split.baseCuts : (options.baseCuts ?? []);
  const placements = (split ? split.placements : (options.placements ?? [])) as RenderPlacement[];
  const placementLaneByTrack = new Map<string, PreparedTimelineLane<RenderPlacement>>();
  const grouped = new Map<string, RenderPlacement[]>();
  for (const placement of placements) {
    const trackId = placement.trackId ?? "";
    const lane = grouped.get(trackId) ?? [];
    lane.push(placement);
    grouped.set(trackId, lane);
  }
  for (const [trackId, lane] of grouped) placementLaneByTrack.set(trackId, timelineLane(lane));
  const baseCutLane = timelineLane(baseCuts);
  return {
    baseCuts: baseCutLane.items,
    baseCutLane,
    placements,
    assetById: new Map(options.assets.map((asset) => [asset.id, asset])),
    compositionById: new Map((options.compositions ?? []).map((composition) => [composition.id, composition])),
    placementLaneByTrack,
    allPlacementsLane: timelineLane(placements),
  };
}

/** Contain: fit entirely inside the target, letterboxed. */
export function fitInside(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): Box {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

/** Cover: fill the target completely, cropping the overflow. */
export function fitCover(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): Box {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

function trackFilter(track?: RenderTrack) {
  // Only a real glow gets a drop-shadow: a zero-radius shadow is invisible under an
  // opaque clip but paints the track colour through a translucent one.
  const glow = (track?.glow ?? 0) > 0 ? ` drop-shadow(0 0 ${track!.glow}px ${track!.color ?? "#ffffff"})` : "";
  return `hue-rotate(${track?.hue ?? 0}deg) saturate(${track?.saturation ?? 100}%) brightness(${track?.brightness ?? 100}%)${glow}`;
}

function neutralLightingFilter(color: [number, number, number] | undefined) {
  if (!color) return "";
  const spread = Math.max(...color) - Math.min(...color);
  return spread < .001 ? ` brightness(${Math.max(0, color[0]) * 100}%)` : "";
}

function coloredLighting(color: [number, number, number] | undefined) {
  if (!color || Math.max(...color) - Math.min(...color) < .001) return undefined;
  return color;
}

function clampSourceTime(time: number, duration: number) {
  if (!Number.isFinite(duration)) return Math.max(0, time);
  return Math.max(0, Math.min(duration - 0.001, time));
}

export type CompositionTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  z: number;
  rotationX: number;
  rotationY: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  basis: Matrix3;
};

export function compositionTransformAt(
  layer: CompositionLayer,
  time: number,
  layers: CompositionLayer[] = [],
  visiting = new Set<string>(),
  compositionWidth = 100,
  compositionHeight = 100,
): CompositionTransform {
  const own = evaluateLayerMotion(layer.keyframes, time, {
    x: layer.x, y: layer.y, scale: layer.scale, rotation: layer.rotation, opacity: layer.opacity,
  }, layer.animation, layer.expression, layer.id, layer.duration ?? 1);
  const planar = planarTransformAt(layer.planarTrack, time);
  own.x += planar.x;
  own.y += planar.y;
  own.scale *= planar.scale;
  own.rotation += planar.rotation;
  const spatial = evaluate3DKeyframes(layer.spatialKeyframes, time, {
    z: layer.z ?? 0,
    rotationX: layer.rotationX ?? 0,
    rotationY: layer.rotationY ?? 0,
    scaleX: layer.scaleX ?? 100,
    scaleY: layer.scaleY ?? 100,
    scaleZ: layer.scaleZ ?? 100,
  });
  const own3D: CompositionTransform = {
    ...own,
    ...spatial,
    basis: spatialBasis(spatial.rotationX, spatial.rotationY, own.rotation, spatial.scaleX, spatial.scaleY, spatial.scaleZ),
  };
  if (!layer.parentId || visiting.has(layer.id)) return own3D;
  const parent = layers.find((candidate) => candidate.id === layer.parentId);
  if (!parent) return own3D;
  const nextVisiting = new Set(visiting);
  nextVisiting.add(layer.id);
  const parentTransform: CompositionTransform = compositionTransformAt(parent, time, layers, nextVisiting, compositionWidth, compositionHeight);
  const useSpatialParenting = Boolean(layer.threeD || parent.threeD);
  if (useSpatialParenting) {
    const local = applySpatialBasis(parentTransform.basis, {
      x: (own.x - 50) * compositionWidth / 100 * parentTransform.scale / 100,
      y: (50 - own.y) * compositionHeight / 100 * parentTransform.scale / 100,
      z: spatial.z,
    });
    return {
      x: parentTransform.x + local.x / compositionWidth * 100,
      y: parentTransform.y - local.y / compositionHeight * 100,
      scale: own.scale * parentTransform.scale / 100,
      rotation: own.rotation + parentTransform.rotation,
      opacity: own.opacity * parentTransform.opacity / 100,
      z: parentTransform.z + local.z,
      rotationX: spatial.rotationX + parentTransform.rotationX,
      rotationY: spatial.rotationY + parentTransform.rotationY,
      scaleX: spatial.scaleX * parentTransform.scaleX / 100,
      scaleY: spatial.scaleY * parentTransform.scaleY / 100,
      scaleZ: spatial.scaleZ * parentTransform.scaleZ / 100,
      basis: multiplySpatialBases(parentTransform.basis, own3D.basis),
    };
  }
  return {
    x: parentTransform.x + (own.x - 50) * parentTransform.scale / 100,
    y: parentTransform.y + (own.y - 50) * parentTransform.scale / 100,
    scale: own.scale * parentTransform.scale / 100,
    rotation: own.rotation + parentTransform.rotation,
    opacity: own.opacity * parentTransform.opacity / 100,
    z: parentTransform.z + spatial.z * parentTransform.scaleZ / 100,
    rotationX: spatial.rotationX + parentTransform.rotationX,
    rotationY: spatial.rotationY + parentTransform.rotationY,
    scaleX: spatial.scaleX * parentTransform.scaleX / 100,
    scaleY: spatial.scaleY * parentTransform.scaleY / 100,
    scaleZ: spatial.scaleZ * parentTransform.scaleZ / 100,
    basis: multiplySpatialBases(parentTransform.basis, own3D.basis),
  };
}

function combineCompositionTransforms(
  parent: CompositionTransform,
  child: CompositionTransform,
): CompositionTransform {
  return {
    x: parent.x + (child.x - 50) * parent.scale / 100,
    y: parent.y + (child.y - 50) * parent.scale / 100,
    scale: child.scale * parent.scale / 100,
    rotation: child.rotation + parent.rotation,
    opacity: child.opacity * parent.opacity / 100,
    z: parent.z + child.z * parent.scaleZ / 100,
    rotationX: child.rotationX + parent.rotationX,
    rotationY: child.rotationY + parent.rotationY,
    scaleX: child.scaleX * parent.scaleX / 100,
    scaleY: child.scaleY * parent.scaleY / 100,
    scaleZ: child.scaleZ * parent.scaleZ / 100,
    basis: multiplySpatialBases(parent.basis, child.basis),
  };
}

function flattenCompositionLayers(
  composition: StudioComposition,
  time: number,
  compositions: Map<string, StudioComposition>,
  inherited: CompositionTransform = { x: 50, y: 50, scale: 100, rotation: 0, opacity: 100, z: 0, rotationX: 0, rotationY: 0, scaleX: 100, scaleY: 100, scaleZ: 100, basis: spatialBasis(0, 0, 0) },
  stack = new Set<string>(),
): Array<{ layer: CompositionLayer; transform: CompositionTransform; time: number }> {
  if (stack.has(composition.id)) return [];
  const nextStack = new Set(stack);
  nextStack.add(composition.id);
  const normalized = normalizeComposition(composition);
  const trackById = new Map((normalized.tracks ?? []).map((track) => [track.id, track]));
  const anyVideoSolo = (normalized.tracks ?? []).some((track) => track.kind === "video" && track.solo);
  return orderedCompositionLayers(normalized).flatMap((layer) => {
    const track = trackById.get(layer.trackId ?? "");
    if (!track || !track.enabled || (anyVideoSolo && !track.solo)) return [];
    const start = Math.max(0, layer.start ?? 0);
    const duration = Math.max(0, layer.duration ?? Math.max(0, composition.duration - start));
    if (time < start || time >= start + duration) return [];
    const layerTime = Math.max(0, layer.sourceStart ?? 0) + (time - start) * Math.max(.01, layer.playbackRate ?? 1);
    const transform = combineCompositionTransforms(
      inherited,
      compositionTransformAt(layer, layerTime, normalized.layers, new Set(), composition.width, composition.height),
    );
    if (layer.kind !== "composition" || !layer.compositionId) {
      return [{ layer, transform, time: layerTime }];
    }
    const child = compositions.get(layer.compositionId);
    if (!child) return [];
    const childTime = child.duration > 0 ? layerTime % child.duration : layerTime;
    return flattenCompositionLayers(child, childTime, compositions, transform, nextStack);
  });
}

/**
 * Decide everything about the frame at `time`. Pure — same inputs always give
 * the same plan, which is exactly what makes preview and export agree.
 */
export function computeFramePlan(options: FramePlanOptions): FramePlan {
  const {
    time, width, height, assets, compositions = [],
    tracks = [], mainVideo = null, motion, transition, grade = null, strobe = null,
    stutter = null, speed = null, dropRamp = null, echo = null, titles = [], transparent = false,
    videoClips, prepared,
  } = options;

  // Unified input: when the caller passes one `videoClips` array (the merged
  // track model, see lib/video-timeline.ts) split it back into the base lane and
  // overlays here. Lossless — proven by the round-trip in video-timeline tests —
  // so the render path below is unchanged whether the caller passes the unified
  // array or the two legacy arrays.
  const split = !prepared && videoClips ? splitUnifiedTimeline(videoClips) : null;
  const baseCuts: BaseCut[] = prepared?.baseCuts ?? (split ? split.baseCuts : (options.baseCuts ?? []));
  const placements: RenderPlacement[] = prepared?.placements ?? (split ? split.placements : (options.placements ?? []));

  // The playhead the footage should show. Outside a ramp/stutter window this is
  // real time, so each remap can be applied unconditionally. The drop ramp runs
  // on the real clock (a one-shot slow-mo into the drop); the cyclic speed ramp
  // and stutter then layer on top.
  const dropRamped = dropRamp
    ? dropRampTime(time, dropRamp.dropTime, dropRamp.beatSeconds, dropRamp.config)
    : time;
  const ramped = speed
    ? speedRampTime(dropRamped, speed.beatSeconds, speed.config, speed.origin ?? 0, speed.beats)
    : dropRamped;
  const sourceClock = stutter
    ? stutterTime(ramped, stutter.beatSeconds, stutter.config, stutter.origin ?? 0, stutter.beats)
    : ramped;

  const assetById = prepared?.assetById ?? new Map(assets.map((asset) => [asset.id, asset]));
  const compositionById = prepared?.compositionById ?? new Map(compositions.map((composition) => [composition.id, composition]));
  // Section-aware intensity: scale the punch/shake magnitude by the local
  // section energy (0.4x in the calmest passages up to 1.25x in the hottest),
  // so the same preset hits harder in the chorus than in the intro. The beat
  // envelope shape is untouched — only how far each hit zooms/shakes.
  // Local section energy 0..1 (null when the timeline has no sections yet), used
  // for both the punch/shake magnitude and the section-aware grade below.
  const sectionEnergy = motion?.energySections?.length
    ? Math.max(0, Math.min(1, sectionEnergyAt(motion.energySections, time)))
    : null;
  const energyScale = sectionEnergy != null ? 0.4 + 0.85 * sectionEnergy : 1;
  const punchConfig = motion?.punch ?? DEFAULT_PUNCH;
  const scaledPunch = energyScale === 1 ? punchConfig : { ...punchConfig, amount: punchConfig.amount * energyScale };
  const beatPunch = motion ? beatPunchScale(time, motion.beats, scaledPunch, motion.accents) : 1;
  // Audio-reactive bass pump: a continuous swell riding the low-band envelope, on
  // top of the quantised beat punch — so the picture breathes with the bassline.
  const bassPump = motion?.reactive
    ? Math.max(0, Math.min(1, bandSampleAt(motion.reactive.low, motion.reactive.startTime, motion.reactive.step, time)))
    : 0;
  const highSignal = motion?.reactive
    ? Math.max(0, Math.min(1, bandSampleAt(motion.reactive.high, motion.reactive.startTime, motion.reactive.step, time)))
    : 0;
  const beatSignal = motion ? beatEnvelopeAt(time, motion.beats, punchConfig, motion.accents) : 0;
  const punch = beatPunch * (1 + bassPump * 0.07);
  const shake = motion?.shake
    ? beatShake(time, motion.beats, scaledPunch, energyScale === 1 ? motion.shake : { ...motion.shake, amount: motion.shake.amount * energyScale }, motion.accents)
    : NO_SHAKE;
  const montage = baseCuts.length > 0;
  const activeIndex = montage
    ? prepared ? activeLaneWinnerIndex(prepared.baseCutLane, time) : baseCuts.findIndex((item) => time >= item.start && time < item.start + item.duration)
    : -1;
  const activeTransition = activeIndex >= 0
    ? transitionConfigForCut(baseCuts, activeIndex, transition)
    : TRANSITION_PRESETS.none;
  const effect = montage && activeIndex >= 0
    ? transitionAtCut(time, baseCuts[activeIndex].start, activeIndex, activeTransition)
    : NO_EFFECT;

  const layers: FrameLayer[] = [];

  // Build the base layer for one montage cut. `draw` carries the transition's
  // per-clip alpha/slide/zoom; the shared beat punch and shake are folded in
  // here so both clips of a cross-clip blend stay locked to the same camera.
  const buildBaseLayer = (cut: BaseCut, draw: ClipDraw): FrameLayer | null => {
    const asset = assetById.get(cut.assetId);
    if (!asset) return null;
    const localTime = Math.max(0, time - cut.start);
    // Per-clip transform animation (position/scale/rotation/opacity), on top of
    // the montage's fit-cover + beat punch. Identity when the clip has none.
    const clip = evaluateTransformKeyframes(cut.transformKeyframes, localTime, IDENTITY_TRANSFORM);
    const basePunch = punch * draw.scale * clip.scale;
    const drawWidth = width * basePunch;
    const drawHeight = height * basePunch;
    const originX = (width - drawWidth) / 2 + (draw.offsetX + shake.x + clip.x) * width;
    const originY = (height - drawHeight) / 2 + (shake.y + clip.y) * height;
    const box = fitCover(asset.width, asset.height, drawWidth, drawHeight);
    const remaining = Math.max(0, cut.duration - localTime);
    const fadeIn = cut.fadeIn ? Math.min(1, localTime / cut.fadeIn) : 1;
    const fadeOut = cut.fadeOut ? Math.min(1, remaining / cut.fadeOut) : 1;
    const visual = clipVisualPipeline(cut.color, cut.effects, localTime, {
      beat: beatSignal, bass: bassPump, high: highSignal, energy: sectionEnergy ?? .5,
    });
    return {
      kind: "base",
      assetId: asset.id,
      box: { x: originX + box.x, y: originY + box.y, width: box.width, height: box.height },
      sourceTime: asset.kind === "image" ? 0 : clampSourceTime(sourceTimeForCut(cut, sourceClock), asset.duration),
      alpha: draw.alpha * Math.min(fadeIn, fadeOut) * clip.opacity,
      rotation: shake.rotation + clip.rotation,
      flipH: cut.flipH,
      flipV: cut.flipV,
      blend: "source-over",
      filter: visual.baseFilter,
      effectPasses: visual.passes,
      whiteBalance: clipWhiteBalance(cut.color),
    };
  };

  // ---- Base layer -------------------------------------------------------
  if (!transparent && montage) {
    const cut = activeIndex >= 0 ? baseCuts[activeIndex] : undefined;
    if (cut) {
      // Cross-clip transitions keep the previous clip on screen through the
      // window: draw it first (underneath), then the incoming clip over it.
      const cross = isCrossClip(activeTransition.type)
        ? crossClipAtCut(time, cut.start, activeIndex, activeTransition)
        : null;
      if (cross && activeIndex > 0) {
        const outgoing = buildBaseLayer(baseCuts[activeIndex - 1], cross.outgoing);
        if (outgoing) layers.push(outgoing);
        const incoming = buildBaseLayer(cut, cross.incoming);
        if (incoming) layers.push(incoming);
      } else {
        // Post-cut (flash/zoom/whip/glitch) or no transition: one clip, at rest
        // apart from the post-cut zoom/slide the effect applies to it.
        const incoming = buildBaseLayer(cut, { alpha: 1, offsetX: effect.offsetX, scale: effect.scale });
        if (incoming) layers.push(incoming);
      }
    }
  } else if (!transparent && mainVideo) {
    const contained = fitInside(mainVideo.width, mainVideo.height, width, height);
    const drawWidth = contained.width * punch;
    const drawHeight = contained.height * punch;
    layers.push({
      kind: "base",
      assetId: MAIN_SOURCE_ID,
      box: {
        x: (width - drawWidth) / 2 + shake.x * width,
        y: (height - drawHeight) / 2 + shake.y * height,
        width: drawWidth,
        height: drawHeight,
      },
      sourceTime: sourceClock,
      alpha: 1,
      rotation: shake.rotation,
      blend: "source-over",
      filter: "none",
    });
  }

  // ---- Overlay layers ---------------------------------------------------
  const overlayPunch = motion?.affectOverlays ? punch : 1;
  const activeAtTime = prepared ? activeLaneItems(prepared.allPlacementsLane, time) : placements.filter((placement) => time >= placement.start && time < placement.start + placement.duration);
  // Solo: if any overlay video track is soloed, only soloed tracks composite.
  const anyVideoSolo = tracks.some((track) => track.solo);
  const trackSilenced = (track: RenderTrack | undefined) => track?.enabled === false || (anyVideoSolo && !track?.solo);
  // A professional video track exposes one clip at a given time. If an edit
  // temporarily overlaps clips on the same lane, the later-starting clip wins,
  // matching overwrite semantics instead of accidentally double-compositing.
  const active = tracks.length
    ? tracks.flatMap((track, trackIndex) => {
        const lane = prepared?.placementLaneByTrack.get(track.id);
        const winner = lane
          ? activeLaneWinner(lane, time)
          : activeAtTime
            .filter((placement) => (placement.trackId ?? tracks[0]?.id) === track.id)
            .sort((a, b) => a.start - b.start || (a.id ?? a.assetId).localeCompare(b.id ?? b.assetId)).at(-1);
        return winner ? [{ placement: winner, trackIndex }] : [];
      }).sort((a, b) => a.trackIndex - b.trackIndex).map((entry) => entry.placement)
    : activeAtTime.sort((a, b) => a.start - b.start || (a.id ?? a.assetId).localeCompare(b.id ?? b.assetId));

  for (const placement of active) {
    const compositionId = placement.compositionId
      ?? (placement.assetId.startsWith("composition:") ? placement.assetId.slice("composition:".length) : null);
    const composition = compositionId ? compositionById.get(compositionId) : null;
    if (composition) {
      const track = tracks.find((item) => item.id === placement.trackId);
      if (trackSilenced(track)) continue;
      const clipTime = time - placement.start;
      const remaining = placement.duration - clipTime;
      const fadeInDuration = Math.max(track?.fadeIn ?? 0, placement.fadeIn ?? 0);
      const fadeOutDuration = Math.max(track?.fadeOut ?? 0, placement.fadeOut ?? 0);
      const fadeIn = fadeInDuration ? Math.min(1, clipTime / fadeInDuration) : 1;
      const fadeOut = fadeOutDuration ? Math.min(1, remaining / fadeOutDuration) : 1;
      const placementRate = Number.isFinite(placement.playbackRate) ? Math.max(0.1, Math.min(8, placement.playbackRate ?? 1)) : 1;
      const compTime = composition.duration > 0
        ? ((placement.sourceStart ?? 0) + clipTime * placementRate) % composition.duration
        : clipTime;

      const flattenedLayers = flattenCompositionLayers(composition, compTime, compositionById);
      const sceneScale = width / Math.max(1, composition.width);
      const camera = scaleCameraForRender(
        activeCompositionCameraAt(composition.id, composition.cameras, composition.activeCameraId, compTime, composition.width),
        sceneScale,
      );
      const previousCompTime = Math.max(0, compTime - 1 / 30);
      const previousCamera = scaleCameraForRender(
        activeCompositionCameraAt(composition.id, composition.cameras, composition.activeCameraId, previousCompTime, composition.width),
        sceneScale,
      );
      const compositionLights = scaleLightsForRender(composition.lights, sceneScale);
      const projectedLayers = flattenedLayers.map((entry) => {
        if (!entry.layer.threeD) return { ...entry, projection: undefined };
        const layerScale = entry.transform.scale / 100 * placement.scale / 100;
        const projection = projectCompositionLayer({
          width,
          height,
          centerX: width * entry.transform.x / 100,
          centerY: height * entry.transform.y / 100,
          layerWidth: width * entry.layer.width / 100 * layerScale,
          layerHeight: height * entry.layer.height / 100 * layerScale,
          rotationZ: entry.transform.rotation,
          spatial: {
            z: entry.transform.z * sceneScale,
            rotationX: entry.transform.rotationX,
            rotationY: entry.transform.rotationY,
            scaleX: entry.transform.scaleX,
            scaleY: entry.transform.scaleY,
            scaleZ: entry.transform.scaleZ,
          },
          camera,
          lights: compositionLights,
          material: entry.layer.material,
          basis: entry.transform.basis,
        });
        return { ...entry, projection };
      });
      // AE-style 2D layers remain stacking barriers. Only contiguous runs of
      // camera layers depth-sort, preventing a 3D item from crossing a flat HUD
      // or adjustment layer that the editor explicitly placed above it.
      const renderLayers: typeof projectedLayers = [];
      let threeDRun: typeof projectedLayers = [];
      const flushThreeDRun = () => {
        renderLayers.push(...threeDRun.sort((a, b) => (b.projection?.depth ?? 0) - (a.projection?.depth ?? 0)));
        threeDRun = [];
      };
      for (const entry of projectedLayers) {
        if (entry.layer.threeD) threeDRun.push(entry);
        else {
          flushThreeDRun();
          renderLayers.push(entry);
        }
      }
      flushThreeDRun();
      for (const { layer: compLayer, transform, time: layerTime, projection } of renderLayers) {
        if (!compLayer.enabled) continue;
        if (projection && !projection.visible) continue;
        if (compLayer.kind === "null") continue;
        if (compLayer.kind === "adjustment") {
          const graphValidation = compLayer.effectGraph ? validateEffectGraph(compLayer.effectGraph) : undefined;
          const branchingGraph = graphValidation?.valid && !graphValidation.linear
            ? resolveEffectGraph(compLayer.effectGraph, layerTime, { beat: beatSignal, bass: bassPump, high: highSignal, energy: sectionEnergy ?? .5 })
            : undefined;
          const graphEffects = graphValidation?.valid ? graphValidation.orderedEffects : compileEffectGraph(undefined, compLayer.effects ?? []);
          const pipeline = clipVisualPipeline(undefined, graphEffects, layerTime, { beat: beatSignal, bass: bassPump, high: highSignal, energy: sectionEnergy ?? .5 });
          const legacyFilter = graphEffects.length ? "" : compLayer.effect === "blur"
            ? "blur(8px)"
            : compLayer.effect === "glow"
              ? `drop-shadow(0 0 ${Math.max(12, height * 0.035)}px ${compLayer.color})`
              : "";
          const adjustmentMask = compLayer.mask?.enabled ? { ...compLayer.mask, box: {
            x: width * transform.x / 100 - width * compLayer.width / 100 * transform.scale / 200,
            y: height * transform.y / 100 - height * compLayer.height / 100 * transform.scale / 200,
            width: width * compLayer.width / 100 * transform.scale / 100,
            height: height * compLayer.height / 100 * transform.scale / 100,
          } } : undefined;
          layers.push({
            kind: "adjustment",
            assetId: `composition:${composition.id}:${compLayer.id}:adjustment`,
            box: { x: 0, y: 0, width, height }, sourceTime: layerTime,
            alpha: placement.opacity / 100 * (track?.opacity ?? 100) / 100 * transform.opacity / 100 * Math.min(fadeIn, fadeOut),
            rotation: 0, blend: compLayer.blend === "normal" ? "source-over" : compLayer.blend,
            filter: "none", mask: adjustmentMask,
            effectPasses: [...(legacyFilter ? [{ id: `${compLayer.id}-legacy`, filter: legacyFilter }] : []), ...pipeline.passes],
            effectGraph: branchingGraph,
          });
          continue;
        }
        const layerScale = transform.scale / 100 * placement.scale / 100;
        const layerWidth = width * compLayer.width / 100 * layerScale;
        const layerHeight = height * compLayer.height / 100 * layerScale;
        const centerX = width * transform.x / 100;
        const centerY = height * transform.y / 100;
        const trackBlend = track?.blend === "normal" ? "source-over" : (track?.blend ?? "screen");
        const layerBlend = compLayer.blend === "normal" ? trackBlend : compLayer.blend;
        const lightingFilter = neutralLightingFilter(projection?.lightingColor);
        const graphValidation = compLayer.effectGraph ? validateEffectGraph(compLayer.effectGraph) : undefined;
        const branchingGraph = graphValidation?.valid && !graphValidation.linear
          ? resolveEffectGraph(compLayer.effectGraph, layerTime, { beat: beatSignal, bass: bassPump, high: highSignal, energy: sectionEnergy ?? .5 })
          : undefined;
        const layerEffects = graphValidation?.valid ? graphValidation.orderedEffects : compileEffectGraph(undefined, compLayer.effects ?? []);
        const legacyEffectFilter = layerEffects.length ? "" : (compLayer.effect === "blur"
          ? " blur(8px)"
          : compLayer.effect === "glow" && compLayer.kind === "media"
            ? ` drop-shadow(0 0 ${Math.max(12, height * 0.035)}px ${compLayer.color})`
              : "");
        const effectFilter = legacyEffectFilter + lightingFilter;
        const castShadowFor = (casterProjection: typeof projection) => {
          if (!casterProjection || !compLayer.material?.castsShadows) return undefined;
          const receivers = projectedLayers
            .filter((entry) => entry.layer.id !== compLayer.id
              && entry.layer.enabled
              && entry.layer.material?.receivesShadows
              && entry.projection?.visible
              && (entry.projection.depth - casterProjection.depth) > .001)
            .sort((left, right) => (left.projection!.depth - casterProjection.depth) - (right.projection!.depth - casterProjection.depth));
          const shadowLights = [...(compositionLights ?? [])]
            .filter((light) => light.enabled && light.intensity > 0 && light.type !== "ambient" && light.castsShadows !== false)
            .sort((left, right) => right.intensity - left.intensity || left.id.localeCompare(right.id));
          for (const receiver of receivers) {
            for (const light of shadowLights) {
              const shadow = projectCompositionShadow({
                width,
                height,
                caster: casterProjection.geometry,
                receiver: receiver.projection!.geometry,
                camera,
                light,
              });
              if (shadow?.visible) return {
                quad: shadow.quad,
                receiverQuad: receiver.projection!.quad,
                opacity: Math.max(0, Math.min(1, (compLayer.material?.shadowOpacity ?? 45) / 100)),
                softness: Math.max(0, (compLayer.material?.shadowSoftness ?? 12) * sceneScale),
              };
            }
          }
          return undefined;
        };
        // Approximate a 180-degree shutter with temporal transform samples.
        // Projected samples include camera and spatial movement, so a camera
        // pan, Z move or null rotation leaves the same deterministic trail in
        // preview and export instead of degrading into a static CSS blur.
        const previousTransform = compLayer.motionBlur
          ? compositionTransformAt(compLayer, Math.max(0, layerTime - 1 / 30), composition.layers, new Set(), composition.width, composition.height)
          : transform;
        const previousLayerScale = previousTransform.scale / 100 * placement.scale / 100;
        const previousLayerWidth = width * compLayer.width / 100 * previousLayerScale;
        const previousLayerHeight = height * compLayer.height / 100 * previousLayerScale;
        const previousCenterX = width * previousTransform.x / 100;
        const previousCenterY = height * previousTransform.y / 100;
        const previousProjectionFor = (projectedWidth: number, projectedHeight: number) => compLayer.threeD
          ? projectCompositionLayer({
            width,
            height,
            centerX: previousCenterX,
            centerY: previousCenterY,
            layerWidth: projectedWidth,
            layerHeight: projectedHeight,
            rotationZ: previousTransform.rotation,
            spatial: {
              z: previousTransform.z * sceneScale,
              rotationX: previousTransform.rotationX,
              rotationY: previousTransform.rotationY,
              scaleX: previousTransform.scaleX,
              scaleY: previousTransform.scaleY,
              scaleZ: previousTransform.scaleZ,
            },
            camera: previousCamera,
            lights: compositionLights,
            material: compLayer.material,
            basis: previousTransform.basis,
          })
          : undefined;
        type MotionGeometry = Pick<FrameLayer, "box" | "rotation"> & Partial<Pick<FrameLayer, "quad" | "depth">>;
        const interpolateBox = (from: Box, to: Box, amount: number): Box => ({
          x: from.x + (to.x - from.x) * amount,
          y: from.y + (to.y - from.y) * amount,
          width: from.width + (to.width - from.width) * amount,
          height: from.height + (to.height - from.height) * amount,
        });
        const interpolateQuad = (from: ProjectedQuad, to: ProjectedQuad, amount: number): ProjectedQuad => from.map((point, index) => ({
          x: point.x + (to[index].x - point.x) * amount,
          y: point.y + (to[index].y - point.y) * amount,
        })) as ProjectedQuad;
        const appendMotionSamples = (layer: FrameLayer, previous: MotionGeometry) => {
          const quadMotion = layer.quad && previous.quad
            ? layer.quad.reduce((sum, point, index) => sum + Math.abs(point.x - previous.quad![index].x) + Math.abs(point.y - previous.quad![index].y), 0)
            : 0;
          const boxMotion = Math.abs(layer.box.x - previous.box.x) + Math.abs(layer.box.y - previous.box.y)
            + Math.abs(layer.box.width - previous.box.width) + Math.abs(layer.box.height - previous.box.height)
            + Math.abs(layer.rotation - previous.rotation);
          if (compLayer.motionBlur && quadMotion + boxMotion > .01) {
            layers.push({ ...layer, ...previous, alpha: layer.alpha * .16 });
            layers.push({
              ...layer,
              box: interpolateBox(previous.box, layer.box, .5),
              rotation: previous.rotation + (layer.rotation - previous.rotation) * .5,
              quad: layer.quad && previous.quad ? interpolateQuad(previous.quad, layer.quad, .5) : layer.quad,
              depth: previous.depth != null && layer.depth != null ? previous.depth + (layer.depth - previous.depth) * .5 : layer.depth,
              alpha: layer.alpha * .22,
            });
          }
          layers.push(layer);
        };
        const matteLayerId = compLayer.trackMatte?.layerId ?? compLayer.matteLayerId;
        const matte = matteLayerId
          ? renderLayers.find((entry) => entry.layer.id === matteLayerId)
          : undefined;
        let pixelMatte: FrameLayer["matte"];
        if (matte && matte.layer.enabled && (matte.layer.kind === "media" || matte.layer.kind === "text" || matte.layer.kind === "shape" || matte.layer.kind === "particle")) {
          const matteScale = matte.transform.scale / 100 * placement.scale / 100;
          const matteWidth = width * matte.layer.width / 100 * matteScale;
          const matteHeight = height * matte.layer.height / 100 * matteScale;
          const matteCenterX = width * matte.transform.x / 100;
          const matteCenterY = height * matte.transform.y / 100;
          const matteRotoPath = rotoPathAt(matte.layer.roto, matte.time);
          const matteRotoSamples = rotoMotionPathsAt(matte.layer.roto, matte.time);
          const matteMask = matteRotoPath
            ? { shape: "rectangle" as const, inverted: matte.layer.roto?.inverted ?? false, feather: matte.layer.roto?.feather ?? 0, expansion: matte.layer.roto?.expansion ?? 0, path: matteRotoPath, pathSamples: matteRotoSamples, alphaMatte: rotoAlphaAt(matte.layer.roto, matte.time), edgeColorCleanup: matte.layer.roto?.edgeColorCleanup ?? 0 }
            : matte.layer.mask?.enabled ? matte.layer.mask : undefined;
          const matteEffectFilter = matte.layer.effect === "blur"
            ? "blur(8px)"
            : matte.layer.effect === "glow" && matte.layer.kind === "media"
              ? `drop-shadow(0 0 ${Math.max(12, height * .035)}px ${matte.layer.color})`
              : "";
          let matteFrameLayer: FrameLayer | undefined;
          if (matte.layer.kind === "media" && matte.layer.assetId) {
            const matteAsset = assetById.get(matte.layer.assetId);
            if (matteAsset) {
              const fitted = fitCover(matteAsset.width, matteAsset.height, matteWidth, matteHeight);
              matteFrameLayer = {
                kind: "overlay",
                assetId: matteAsset.id,
                box: { x: matteCenterX - matteWidth / 2 + fitted.x, y: matteCenterY - matteHeight / 2 + fitted.y, width: fitted.width, height: fitted.height },
                sourceTime: matteAsset.kind === "image" ? 0 : clampSourceTime(matte.time, matteAsset.duration),
                alpha: matte.transform.opacity / 100,
                rotation: matte.transform.rotation,
                blend: "source-over",
                filter: matteEffectFilter,
                mask: matteMask,
              };
            }
          } else if (matte.layer.kind === "text" || matte.layer.kind === "shape" || matte.layer.kind === "particle") {
            matteFrameLayer = {
              kind: "graphic",
              assetId: `composition:${composition.id}:${matte.layer.id}:matte`,
              box: { x: matteCenterX - matteWidth / 2, y: matteCenterY - matteHeight / 2, width: matteWidth, height: matteHeight },
              sourceTime: matte.time,
              alpha: matte.transform.opacity / 100,
              rotation: matte.transform.rotation,
              blend: "source-over",
              filter: matteEffectFilter,
              mask: matteMask,
              graphic: {
                kind: matte.layer.kind,
                value: matte.layer.text,
                textAnimator: matte.layer.textAnimator,
                duration: matte.layer.duration,
                shape: matte.layer.shape,
                shapeOptions: matte.layer.shapeOptions,
                particle: matte.layer.particle,
                meshWarp: matte.layer.meshWarp,
                seed: matte.layer.id,
                time: matte.time,
                color: matte.layer.color,
                fontPx: height * matte.layer.height / 100 * matteScale,
                glow: matte.layer.effect === "glow" ? Math.max(12, height * .035) : 0,
              },
            };
          }
          if (matteFrameLayer) pixelMatte = { layer: matteFrameLayer, mode: compLayer.trackMatte?.mode ?? "alpha", inverted: compLayer.trackMatte?.inverted ?? false };
        }
        const rotoPath = rotoPathAt(compLayer.roto, layerTime);
        const rotoSamples = rotoMotionPathsAt(compLayer.roto, layerTime);
        const mask = rotoPath
            ? { shape: "rectangle" as const, inverted: compLayer.roto?.inverted ?? false, feather: compLayer.roto?.feather ?? 0, expansion: compLayer.roto?.expansion ?? 0, path: rotoPath, pathSamples: rotoSamples, alphaMatte: rotoAlphaAt(compLayer.roto, layerTime), edgeColorCleanup: compLayer.roto?.edgeColorCleanup ?? 0 }
            : compLayer.mask?.enabled ? compLayer.mask : undefined;

        if (compLayer.kind === "media" && compLayer.assetId) {
          const mediaAsset = assetById.get(compLayer.assetId);
          if (!mediaAsset) continue;
          const fitted = fitCover(mediaAsset.width, mediaAsset.height, layerWidth, layerHeight);
          const previousFitted = fitCover(mediaAsset.width, mediaAsset.height, previousLayerWidth, previousLayerHeight);
          const mediaProjection = projection && compLayer.threeD
            ? projectCompositionLayer({
              width,
              height,
              centerX,
              centerY,
              layerWidth: fitted.width,
              layerHeight: fitted.height,
              rotationZ: transform.rotation,
              spatial: {
                z: transform.z * sceneScale,
                rotationX: transform.rotationX,
                rotationY: transform.rotationY,
                scaleX: transform.scaleX,
                scaleY: transform.scaleY,
                scaleZ: transform.scaleZ,
              },
              camera,
              lights: compositionLights,
              material: compLayer.material,
              basis: transform.basis,
            })
            : projection;
          const previousMediaProjection = previousProjectionFor(previousFitted.width, previousFitted.height);
          // A nested base-timeline clip (see lib/nest.ts) renders through the
          // same source-time + clip-filter path as the base lane, so reverse,
          // time-remap, colour, effects and flips survive nesting losslessly.
          const isNestedClip = Boolean(compLayer.clipColor || compLayer.clipEffects || compLayer.clipReversed || compLayer.clipTimeRemap || compLayer.clipFlipH || compLayer.clipFlipV);
          const localLayerTime = Math.max(0, time - (placement.start + (compLayer.start ?? 0)));
          const clipSourceTime = isNestedClip
            ? sourceTimeForCut({ start: 0, sourceStart: compLayer.sourceStart ?? 0, playbackRate: compLayer.playbackRate, duration: compLayer.duration ?? composition.duration, reversed: compLayer.clipReversed, timeRemap: compLayer.clipTimeRemap }, localLayerTime)
            : layerTime;
          const clipVisual = clipVisualPipeline(isNestedClip ? compLayer.clipColor : undefined, [...(isNestedClip ? compLayer.clipEffects ?? [] : []), ...layerEffects], layerTime, { beat: beatSignal, bass: bassPump, high: highSignal, energy: sectionEnergy ?? .5 });
          const clipFilter = `${clipVisual.baseFilter} `;
          appendMotionSamples({
            kind: "overlay",
            assetId: mediaAsset.id,
            box: {
              x: centerX - layerWidth / 2 + fitted.x,
              y: centerY - layerHeight / 2 + fitted.y,
              width: fitted.width,
              height: fitted.height,
            },
            sourceTime: mediaAsset.kind === "image" ? 0 : clampSourceTime(clipSourceTime, mediaAsset.duration),
            alpha: placement.opacity / 100
              * (track?.opacity ?? 100) / 100
              * transform.opacity / 100
              * Math.min(fadeIn, fadeOut),
            rotation: transform.rotation,
            quad: mediaProjection?.quad,
            depth: mediaProjection?.depth,
            lighting: coloredLighting(mediaProjection?.lightingColor),
            shadow: castShadowFor(mediaProjection),
            flipH: compLayer.clipFlipH,
            flipV: compLayer.clipFlipV,
            blend: layerBlend,
            filter: `${clipFilter}${trackFilter(track)}${effectFilter}`,
            effectPasses: clipVisual.passes,
            effectGraph: branchingGraph,
            whiteBalance: isNestedClip ? clipWhiteBalance(compLayer.clipColor) : undefined,
            mask,
            removal: compLayer.removal,
            meshWarp: compLayer.meshWarp,
            matte: pixelMatte,
          }, {
            box: {
              x: previousCenterX - previousLayerWidth / 2 + previousFitted.x,
              y: previousCenterY - previousLayerHeight / 2 + previousFitted.y,
              width: previousFitted.width,
              height: previousFitted.height,
            },
            rotation: previousTransform.rotation,
            quad: previousMediaProjection?.quad,
            depth: previousMediaProjection?.depth,
          });
          continue;
        }
        if (compLayer.kind === "media") continue;
        if (compLayer.kind !== "text" && compLayer.kind !== "shape" && compLayer.kind !== "particle") continue;

        const graphicFontPx = height * compLayer.height / 100 * layerScale;

        const previousGraphicProjection = previousProjectionFor(previousLayerWidth, previousLayerHeight);
        appendMotionSamples({
          kind: "graphic",
          assetId: `composition:${composition.id}:${compLayer.id}`,
          box: {
            x: centerX - layerWidth / 2,
            y: centerY - layerHeight / 2,
            width: layerWidth,
            height: layerHeight,
          },
          sourceTime: layerTime,
          alpha: placement.opacity / 100
            * (track?.opacity ?? 100) / 100
            * transform.opacity / 100
            * Math.min(fadeIn, fadeOut),
          rotation: transform.rotation,
          quad: projection?.quad,
          depth: projection?.depth,
          lighting: coloredLighting(projection?.lightingColor),
          shadow: castShadowFor(projection),
          blend: layerBlend,
          filter: `${trackFilter(track)}${effectFilter}`,
          effectPasses: clipVisualPipeline(undefined, layerEffects, layerTime, { beat: beatSignal, bass: bassPump, high: highSignal, energy: sectionEnergy ?? .5 }).passes,
          effectGraph: branchingGraph,
          mask,
          matte: pixelMatte,
          graphic: {
            kind: compLayer.kind,
            value: compLayer.text,
            textAnimator: compLayer.textAnimator,
            duration: compLayer.duration,
            shape: compLayer.shape,
            shapeOptions: compLayer.shapeOptions,
            particle: compLayer.particle,
            meshWarp: compLayer.meshWarp,
            seed: compLayer.id,
            time: layerTime,
            color: compLayer.color,
            fontPx: graphicFontPx,
            glow: compLayer.effect === "glow" ? Math.max(12, height * 0.035) : 0,
          },
        }, {
          box: {
            x: previousCenterX - previousLayerWidth / 2,
            y: previousCenterY - previousLayerHeight / 2,
            width: previousLayerWidth,
            height: previousLayerHeight,
          },
          rotation: previousTransform.rotation,
          quad: previousGraphicProjection?.quad,
          depth: previousGraphicProjection?.depth,
        });
      }
      continue;
    }

    const asset = assetById.get(placement.assetId);
    if (!asset) continue;
    const track = tracks.find((item) => item.id === placement.trackId);
    if (trackSilenced(track)) continue;

    const clipTime = time - placement.start;
    const placementRate = Number.isFinite(placement.playbackRate) ? Math.max(0.1, Math.min(8, placement.playbackRate ?? 1)) : 1;
    const remaining = placement.duration - clipTime;
    const fadeInDuration = Math.max(track?.fadeIn ?? 0, placement.fadeIn ?? 0);
    const fadeOutDuration = Math.max(track?.fadeOut ?? 0, placement.fadeOut ?? 0);
    const fadeIn = fadeInDuration ? Math.min(1, clipTime / fadeInDuration) : 1;
    const fadeOut = fadeOutDuration ? Math.min(1, remaining / fadeOutDuration) : 1;
    // Per-clip transform animation on the overlay, on top of its scale + punch.
    const clip = evaluateTransformKeyframes(placement.transformKeyframes, clipTime, IDENTITY_TRANSFORM);
    const zoom = placement.scale / 100 * overlayPunch * clip.scale;
    const drawWidth = width * zoom;
    const drawHeight = height * zoom;
    const targetX = (width - drawWidth) / 2 + clip.x * width;
    const targetY = (height - drawHeight) / 2 + clip.y * height;
    const box = fitCover(asset.width, asset.height, drawWidth, drawHeight);

    // Rich overlay clips resolve their source frame and look through the SAME
    // path the base lane uses, so reverse / time-remap / colour / effects behave
    // identically on any video track (unified capability).
    const overlaySource = sourceTimeForCut(
      { start: placement.start, sourceStart: placement.sourceStart ?? 0, playbackRate: placementRate, duration: placement.duration, reversed: placement.reversed, timeRemap: placement.timeRemap },
      time,
    );
    const clipVisual = (placement.color || placement.effects)
      ? clipVisualPipeline(placement.color, placement.effects, clipTime, { beat: beatSignal, bass: bassPump, high: highSignal, energy: sectionEnergy ?? .5 })
      : null;
    const clipFilter = clipVisual ? `${clipVisual.baseFilter} ` : "";
    layers.push({
      kind: "overlay",
      assetId: asset.id,
      box: { x: targetX + box.x, y: targetY + box.y, width: box.width, height: box.height },
      sourceTime: asset.kind === "image" ? 0 : clampSourceTime(overlaySource, asset.duration),
      alpha: placement.opacity / 100 * (track?.opacity ?? 100) / 100 * Math.min(fadeIn, fadeOut) * clip.opacity,
      rotation: clip.rotation,
      flipH: placement.flipH,
      flipV: placement.flipV,
      blend: track?.blend === "normal" ? "source-over" : (track?.blend ?? "screen"),
      filter: `${clipFilter}${trackFilter(track)}`,
      effectPasses: clipVisual?.passes,
      whiteBalance: clipWhiteBalance(placement.color),
    });
  }

  // ---- Kinetic titles ---------------------------------------------------
  // Titles ride the beat punch too, so a big word pumps on the hit.
  for (const cue of titles) {
    const look = titleAppearance(cue, time);
    if (!look.visible || !cue.text) continue;
    const fontPx = height * cue.size * look.scale * punch;
    layers.push({
      kind: "title",
      assetId: `title-${cue.id}`,
      box: { x: 0, y: 0, width, height },
      sourceTime: 0,
      alpha: look.alpha,
      rotation: shake.rotation,
      blend: "source-over",
      filter: "none",
      title: {
        value: cue.text,
        color: cue.color,
        fontPx,
        cx: width / 2 + shake.x * width,
        cy: height * (cue.y + look.offsetY) + shake.y * height,
        animator: cue.animator,
        elapsed: time - cue.start,
        duration: cue.duration,
      },
    });
  }

  // ---- Flash + grade ----------------------------------------------------
  const beat = grade?.beatDriven && motion
    ? beatEnvelopeAt(time, motion.beats, punchConfig, motion.accents)
    : 0;
  const strobeLevel = strobe ? strobeLevelAt(time, strobe.times, strobe.config) : 0;
  const strobeMode = strobe?.config.mode ?? "full";
  const spatialStrobe = strobe && strobeLevel > 0 && strobeMode !== "full"
    ? {
      mode: strobeMode,
      blend: strobe.config.blend ?? "screen",
      level: strobeLevel,
      color: strobeColorAt(time, strobe.times, strobe.config),
      x: Math.max(0, Math.min(1, strobe.config.x ?? 0.5)),
      y: Math.max(0, Math.min(1, strobe.config.y ?? 0.5)),
      size: Math.max(0.05, Math.min(1.5, strobe.config.size ?? 0.75)),
      softness: Math.max(0, Math.min(1, strobe.config.softness ?? 0.65)),
      angle: Math.max(-180, Math.min(180, strobe.config.angle ?? 0)),
    } as const
    : null;
  const gradeStrobeLevel = strobeMode === "full" ? strobeLevel : 0;

  // A strobe is a grade effect, so it needs the grade pass even when the user
  // picked no film look — fall back to the identity params in that case.
  // Trails swell on the beat when beat-driven, and add a little chromatic
  // fringe so the ghost reads as an RGB smear, not just a fade.
  const echoAmount = echo
    ? Math.min(0.96, echo.amount * (echo.beatDriven && motion ? 0.6 + beatEnvelopeAt(time, motion.beats, punchConfig, motion.accents) * 0.7 : 1))
    : 0;
  const echoAberration = echoAmount > 0 ? echoAmount * 0.004 : 0;
  // Audio-reactive hats shimmer: the high-band envelope adds a little anamorphic
  // streak and chromatic fringe, so cymbals and hats sparkle. It rides the grade
  // pass, so it needs one even when the user picked no film look.
  const highShimmer = highSignal;

  const rawGrade = grade?.params ?? (gradeStrobeLevel > 0 || (strobe && strobeMode === "full") || echoAberration > 0 || highShimmer > 0.02 ? IDENTITY_GRADE : null);
  // Section-aware look: scale the grade's strength by the local section energy,
  // so the intro stays restrained and the chorus turns hot. A neutral look is a
  // fixed point, so this only bites when something is actually graded.
  const gradeParams = rawGrade && sectionEnergy != null ? gradeAtEnergy(rawGrade, sectionEnergy) : rawGrade;

  return {
    time,
    layers,
    transparent,
    flash: effect.flash,
    echo: echoAmount,
    strobeLight: spatialStrobe,
    grade: gradeParams
      ? {
        ...gradeParams,
        beat,
        streak: gradeParams.streak + highShimmer * 0.35,
        aberration: gradeParams.aberration + effect.aberration + echoAberration + highShimmer * 0.005,
        strobe: gradeStrobeLevel,
        strobeColor: strobe ? strobeColorAt(time, strobe.times, strobe.config) : [1, 1, 1],
      }
      : null,
  };
}

/** A 2D context from either a DOM canvas (preview) or an OffscreenCanvas (the
 *  render worker). Their drawing surfaces are API-identical for our purposes. */
export type Compositor2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Something a host can paint into a 2D context at an arbitrary box. */
export type FrameSource = {
  draw(context: Compositor2DContext, x: number, y: number, width: number, height: number): void;
};

function traceLayerMask(context: Compositor2DContext, layer: FrameLayer) {
  const mask = layer.mask;
  if (!mask) return;
  const layerTarget = mask.box ?? layer.box;
  const maskWidth = layerTarget.width * Math.max(0, Math.min(2, (mask.width ?? 100) / 100));
  const maskHeight = layerTarget.height * Math.max(0, Math.min(2, (mask.height ?? 100) / 100));
  const target: Box = {
    x: layerTarget.x + layerTarget.width * Math.max(0, Math.min(1, (mask.x ?? 50) / 100)) - maskWidth / 2,
    y: layerTarget.y + layerTarget.height * Math.max(0, Math.min(1, (mask.y ?? 50) / 100)) - maskHeight / 2,
    width: maskWidth,
    height: maskHeight,
  };
  const expansion = Math.min(target.width, target.height) * mask.expansion / 100;
  const x = target.x - expansion;
  const y = target.y - expansion;
  const width = target.width + expansion * 2;
  const height = target.height + expansion * 2;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rotation = ((mask.rotation ?? 0) * Math.PI) / 180;
  context.beginPath();
  if (mask.inverted) context.rect(0, 0, context.canvas.width, context.canvas.height);
  if (mask.path?.length) {
    const centerX = layerTarget.x + layerTarget.width / 2;
    const centerY = layerTarget.y + layerTarget.height / 2;
    const expansionScale = 1 + mask.expansion / 100;
    mask.path.forEach((point, index) => {
      const pointX = centerX + (layerTarget.x + point.x * layerTarget.width - centerX) * expansionScale;
      const pointY = centerY + (layerTarget.y + point.y * layerTarget.height - centerY) * expansionScale;
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    });
    context.closePath();
  } else if (mask.shape === "ellipse") {
    context.ellipse(cx, cy, Math.max(0, width / 2), Math.max(0, height / 2), rotation, 0, Math.PI * 2);
  } else {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const point = (px: number, py: number) => ({ x: cx + px * cosine - py * sine, y: cy + px * sine + py * cosine });
    const corners = [point(-width / 2, -height / 2), point(width / 2, -height / 2), point(width / 2, height / 2), point(-width / 2, height / 2)];
    context.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((corner) => context.lineTo(corner.x, corner.y));
    context.closePath();
  }
}

function applyLayerMask(context: Compositor2DContext, layer: FrameLayer) {
  const mask = layer.mask;
  if (!mask) return;
  traceLayerMask(context, layer);
  context.clip(mask.inverted ? "evenodd" : "nonzero");
  if (mask.feather > 0) context.filter = `${context.filter} blur(${mask.feather}px)`;
}

/** Draw a kinetic title: heavy uppercase text with a dark outline for legibility. */
function drawTitle(context: Compositor2DContext, layer: FrameLayer) {
  const t = layer.title;
  if (!t) return;
  context.save();
  context.globalAlpha = layer.alpha;
  context.globalCompositeOperation = "source-over";
  context.translate(t.cx, t.cy);
  if (layer.rotation) context.rotate((layer.rotation * Math.PI) / 180);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 ${t.fontPx}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, t.fontPx * 0.12);
  context.strokeStyle = "rgba(0,0,0,0.6)";
  context.fillStyle = t.color;

  const animator = t.animator ?? "none";
  if (animator === "none") {
    context.strokeText(t.value, 0, 0);
    context.fillText(t.value, 0, 0);
    context.restore();
    return;
  }

  // Kinetic typography: lay the glyphs out left-to-right as one centred group,
  // then transform each character on its own (per lib/text-animate.ts).
  const chars = [...t.value];
  const widths = chars.map((ch) => context.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0);
  const elapsed = t.elapsed ?? 0;
  const duration = t.duration ?? 1;
  context.textAlign = "center";
  let cursor = -total / 2;
  for (let i = 0; i < chars.length; i++) {
    const w = widths[i];
    const centreX = cursor + w / 2;
    cursor += w;
    if (chars[i] === " ") continue;
    const state = charAppearance(animator, { elapsed, duration, index: i, count: chars.length });
    if (state.alpha <= 0) continue;
    context.save();
    context.globalAlpha = layer.alpha * state.alpha;
    context.translate(centreX + state.dx * t.fontPx, state.dy * t.fontPx);
    if (state.scale !== 1) context.scale(state.scale, state.scale);
    context.strokeText(chars[i], 0, 0);
    context.fillText(chars[i], 0, 0);
    context.restore();
  }
  context.restore();
}

function drawGraphic(context: Compositor2DContext, layer: FrameLayer) {
  const graphic = layer.graphic;
  if (!graphic) return;
  const { box } = layer;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  context.save();
  context.globalAlpha = layer.alpha;
  context.globalCompositeOperation = layer.blend;
  context.filter = layer.filter;
  applyLayerMask(context, layer);
  context.translate(cx, cy);
  if (layer.rotation) context.rotate((layer.rotation * Math.PI) / 180);
  context.shadowColor = graphic.color;
  context.shadowBlur = graphic.glow;
  context.fillStyle = graphic.color;
  if (graphic.kind === "text") {
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `900 ${Math.max(10, graphic.fontPx)}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
    context.lineJoin = "round";
    context.lineWidth = Math.max(2, graphic.fontPx * 0.09);
    context.strokeStyle = "rgba(0,0,0,0.48)";
    const animator = graphic.textAnimator ?? "none";
    if (animator === "none") {
      context.strokeText(graphic.value, 0, 0);
      context.fillText(graphic.value, 0, 0);
    } else {
      const chars = [...graphic.value];
      const widths = chars.map((character) => context.measureText(character).width);
      let cursor = -widths.reduce((sum, width) => sum + width, 0) / 2;
      for (let index = 0; index < chars.length; index += 1) {
        const width = widths[index];
        const characterX = cursor + width / 2;
        cursor += width;
        if (chars[index] === " ") continue;
        const state = charAppearance(animator, { elapsed: graphic.time ?? 0, duration: Math.max(.05, graphic.duration ?? 1), index, count: chars.length });
        if (state.alpha <= 0) continue;
        context.save();
        context.globalAlpha *= state.alpha;
        context.translate(characterX + state.dx * graphic.fontPx, state.dy * graphic.fontPx);
        context.scale(state.scale, state.scale);
        context.strokeText(chars[index], 0, 0);
        context.fillText(chars[index], 0, 0);
        context.restore();
      }
    }
  } else if (graphic.kind === "particle") {
    const particles = particlesAt(graphic.particle ?? { rate: 24, lifetime: 1.6, speed: 18, spread: 60, gravity: 18, size: 1.5, randomness: .5 }, graphic.time ?? 0, box.width, box.height, graphic.seed);
    for (const particle of particles) {
      context.save();
      context.globalAlpha *= particle.alpha;
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation * Math.PI / 180);
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      context.restore();
    }
  } else {
    const contours = vectorShapeContours(graphic.shape, box.width, box.height, graphic.shapeOptions);
    for (const contour of contours) {
      if (!contour.points.length) continue;
      context.save();
      context.globalAlpha *= contour.opacity;
      context.beginPath();
      contour.points.forEach((point, index) => {
        const normalized = { x: point.x / Math.max(1e-6, box.width) + .5, y: point.y / Math.max(1e-6, box.height) + .5 };
        const warped = meshWarpPoint(normalized, graphic.meshWarp);
        const x = (warped.x - .5) * box.width;
        const y = (warped.y - .5) * box.height;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      if (contour.closed) { context.closePath(); context.fill(); }
      else { context.lineWidth = Math.max(1, Math.min(box.width, box.height) * .04); context.strokeStyle = graphic.color; context.stroke(); }
      context.restore();
    }
  }
  context.restore();
}

type Triangle = readonly [Point2D, Point2D, Point2D];

/** Map an existing layer-space drawing through a projected quadrilateral. Canvas
 * 2D has no projective transform, so the quad is split into two affine triangles.
 * Both preview and render worker execute this exact routine. */
function drawProjectedBox(
  context: Compositor2DContext,
  box: Box,
  quad: ProjectedQuad,
  draw: () => void,
) {
  const sourceTriangles: [Triangle, Triangle] = [
    [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }],
    [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }],
  ];
  const targetTriangles: [Triangle, Triangle] = [
    [quad[0], quad[1], quad[2]],
    [quad[0], quad[2], quad[3]],
  ];
  for (let index = 0; index < 2; index += 1) {
    const [p0, p1, p2] = sourceTriangles[index];
    const [q0, q1, q2] = targetTriangles[index];
    const determinant = p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y);
    if (Math.abs(determinant) < 1e-6) continue;
    const solve = (v0: number, v1: number, v2: number) => ({
      a: (v0 * (p1.y - p2.y) + v1 * (p2.y - p0.y) + v2 * (p0.y - p1.y)) / determinant,
      c: (v0 * (p2.x - p1.x) + v1 * (p0.x - p2.x) + v2 * (p1.x - p0.x)) / determinant,
      e: (v0 * (p1.x * p2.y - p2.x * p1.y) + v1 * (p2.x * p0.y - p0.x * p2.y) + v2 * (p0.x * p1.y - p1.x * p0.y)) / determinant,
    });
    const horizontal = solve(q0.x, q1.x, q2.x);
    const vertical = solve(q0.y, q1.y, q2.y);
    context.save();
    context.beginPath();
    context.moveTo(q0.x, q0.y);
    context.lineTo(q1.x, q1.y);
    context.lineTo(q2.x, q2.y);
    context.closePath();
    context.clip();
    context.transform(horizontal.a, vertical.a, horizontal.c, vertical.c, horizontal.e, vertical.e);
    draw();
    context.restore();
  }
}

function drawProjectedGraphic(context: Compositor2DContext, layer: FrameLayer) {
  if (!layer.quad) return false;
  const rasterWidth = Math.max(1, Math.ceil(Math.abs(layer.box.width)));
  const rasterHeight = Math.max(1, Math.ceil(Math.abs(layer.box.height)));
  if (rasterWidth * rasterHeight > 40_000_000) return false;
  const raster = renderCanvas(rasterWidth, rasterHeight);
  const rasterContext = raster?.getContext("2d") as Compositor2DContext | null;
  if (!raster || !rasterContext) return false;
  rasterContext.clearRect(0, 0, rasterWidth, rasterHeight);
  const fittedFontPx = layer.graphic?.kind === "text"
    ? Math.min(layer.graphic.fontPx, rasterWidth / Math.max(1, [...layer.graphic.value].length) / .62)
    : layer.graphic?.fontPx;
  drawGraphic(rasterContext, {
    ...layer,
    box: { x: 0, y: 0, width: rasterWidth, height: rasterHeight },
    alpha: 1,
    blend: "source-over",
    filter: "none",
    mask: undefined,
    quad: undefined,
    rotation: 0,
    graphic: layer.graphic ? { ...layer.graphic, fontPx: fittedFontPx ?? layer.graphic.fontPx } : undefined,
  });
  const flatLayer = { ...layer, quad: undefined, rotation: 0 };
  drawProjectedBox(context, layer.box, layer.quad, () => {
    context.save();
    context.globalAlpha = layer.alpha;
    context.globalCompositeOperation = layer.blend;
    context.filter = layer.filter;
    applyLayerMask(context, flatLayer);
    context.drawImage(raster, layer.box.x, layer.box.y, layer.box.width, layer.box.height);
    context.restore();
  });
  return true;
}

function paintSpatialStrobe(context: Compositor2DContext, light: NonNullable<FramePlan["strobeLight"]>, width: number, height: number) {
  const [red, green, blue] = light.color.map((channel) => Math.round(channel * 255));
  const color = `${red},${green},${blue}`;
  const centerX = light.x * width;
  const centerY = light.y * height;
  const diagonal = Math.hypot(width, height);
  const radius = Math.max(8, diagonal * light.size * 0.55);
  const composite: GlobalCompositeOperation = light.blend === "add" ? "lighter" : light.blend;
  context.save();
  context.globalCompositeOperation = composite;
  context.globalAlpha = Math.max(0, Math.min(1, light.level));

  if (light.mode === "radial") {
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, `rgba(${color},1)`);
    gradient.addColorStop(Math.max(0.02, 1 - light.softness), `rgba(${color},.72)`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  } else {
    context.translate(centerX, centerY);
    context.rotate((light.angle * Math.PI) / 180);
    if (light.mode === "bars") {
      const bandWidth = Math.max(3, width * light.size * 0.08);
      const gap = bandWidth * 0.8;
      context.fillStyle = `rgb(${color})`;
      context.shadowColor = `rgba(${color},.9)`;
      context.shadowBlur = light.softness * 28;
      for (let index = -4; index <= 4; index++) {
        context.globalAlpha = Math.max(0, Math.min(1, light.level * (1 - Math.abs(index) * 0.08)));
        context.fillRect(index * (bandWidth + gap) - bandWidth / 2, -diagonal, bandWidth, diagonal * 2);
      }
    } else {
      const gradient = context.createLinearGradient(-radius, 0, radius, 0);
      if (light.mode === "split") {
        const edge = Math.max(0.01, light.softness * 0.35);
        gradient.addColorStop(0, `rgba(${color},1)`);
        gradient.addColorStop(Math.max(0, 0.5 - edge), `rgba(${color},.85)`);
        gradient.addColorStop(Math.min(1, 0.5 + edge), `rgba(${color},0)`);
        gradient.addColorStop(1, `rgba(${color},0)`);
      } else {
        const inner = Math.max(0.015, 0.22 * (1 - light.softness));
        gradient.addColorStop(0, `rgba(${color},0)`);
        gradient.addColorStop(Math.max(0, 0.5 - inner), `rgba(${color},0)`);
        gradient.addColorStop(0.5, `rgba(${color},1)`);
        gradient.addColorStop(Math.min(1, 0.5 + inner), `rgba(${color},0)`);
        gradient.addColorStop(1, `rgba(${color},0)`);
      }
      context.fillStyle = gradient;
      context.fillRect(-diagonal, -diagonal, diagonal * 2, diagonal * 2);
    }
  }
  context.restore();
}

function renderCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

let softRotoBuffers: { width: number; height: number; picture: HTMLCanvasElement | OffscreenCanvas; matte: HTMLCanvasElement | OffscreenCanvas; cleanup: HTMLCanvasElement | OffscreenCanvas } | null = null;
let trackMatteBuffers: { width: number; height: number; picture: HTMLCanvasElement | OffscreenCanvas; matte: HTMLCanvasElement | OffscreenCanvas } | null = null;
let coloredLightBuffers: { width: number; height: number; picture: HTMLCanvasElement | OffscreenCanvas; tint: HTMLCanvasElement | OffscreenCanvas } | null = null;
let whiteBalanceBuffer: { width: number; height: number; picture: HTMLCanvasElement | OffscreenCanvas } | null = null;
let pixelEffectBuffer: { width: number; height: number; picture: HTMLCanvasElement | OffscreenCanvas; effect: HTMLCanvasElement | OffscreenCanvas; mask: HTMLCanvasElement | OffscreenCanvas } | null = null;
let removalBuffers: { width: number; height: number; picture: HTMLCanvasElement | OffscreenCanvas; mask: HTMLCanvasElement | OffscreenCanvas; cleanPlate: HTMLCanvasElement | OffscreenCanvas } | null = null;

function objectRemovalBuffers(width: number, height: number) {
  if (removalBuffers?.width === width && removalBuffers.height === height) return removalBuffers;
  const picture = renderCanvas(width, height);
  const mask = renderCanvas(width, height);
  const cleanPlate = renderCanvas(width, height);
  removalBuffers = picture && mask && cleanPlate ? { width, height, picture, mask, cleanPlate } : null;
  return removalBuffers;
}

function rotoBuffers(width: number, height: number) {
  if (softRotoBuffers?.width === width && softRotoBuffers.height === height) return softRotoBuffers;
  const picture = renderCanvas(width, height);
  const matte = renderCanvas(width, height);
  const cleanup = renderCanvas(width, height);
  softRotoBuffers = picture && matte && cleanup ? { width, height, picture, matte, cleanup } : null;
  return softRotoBuffers;
}

function matteBuffers(width: number, height: number) {
  if (trackMatteBuffers?.width === width && trackMatteBuffers.height === height) return trackMatteBuffers;
  const picture = renderCanvas(width, height);
  const matte = renderCanvas(width, height);
  trackMatteBuffers = picture && matte ? { width, height, picture, matte } : null;
  return trackMatteBuffers;
}

function lightBuffers(width: number, height: number) {
  if (coloredLightBuffers?.width === width && coloredLightBuffers.height === height) return coloredLightBuffers;
  const picture = renderCanvas(width, height);
  const tint = renderCanvas(width, height);
  coloredLightBuffers = picture && tint ? { width, height, picture, tint } : null;
  return coloredLightBuffers;
}

function balancedBuffer(width: number, height: number) {
  if (whiteBalanceBuffer?.width === width && whiteBalanceBuffer.height === height) return whiteBalanceBuffer;
  const picture = renderCanvas(width, height);
  whiteBalanceBuffer = picture ? { width, height, picture } : null;
  return whiteBalanceBuffer;
}

function processedBuffer(width: number, height: number) {
  if (pixelEffectBuffer?.width === width && pixelEffectBuffer.height === height) return pixelEffectBuffer;
  const picture = renderCanvas(width, height);
  const effect = renderCanvas(width, height);
  const mask = renderCanvas(width, height);
  pixelEffectBuffer = picture && effect && mask ? { width, height, picture, effect, mask } : null;
  return pixelEffectBuffer;
}

const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const mixByte = (from: number, to: number, mix: number) => byte(from + (to - from) * mix);
const luminance = (red: number, green: number, blue: number) => .2126 * red + .7152 * green + .0722 * blue;
const pixelHash = (x: number, y: number, frame: number, channel = 0) => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + frame * 37.719 + channel * 19.19) * 43758.5453;
  return value - Math.floor(value);
};
function hueInk(hue: number, lightness: number): [number, number, number] {
  const h = ((hue % 360) + 360) % 360 / 60;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * .88;
  const x = chroma * (1 - Math.abs(h % 2 - 1));
  const [r, g, b] = h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = lightness - chroma / 2;
  return [byte((r + m) * 255), byte((g + m) * 255), byte((b + m) * 255)];
}

/** Deterministic pixel primitives shared by the live painter and render worker. */
export function applyResolvedPixelEffects(data: Uint8ClampedArray, width: number, height: number, effects: ResolvedPixelEffect[]) {
  if (!effects.length || width <= 0 || height <= 0) return data;
  // A UHD RGBA frame is ~32 MB. Reuse one snapshot for the ordered stack so
  // multiple pixel nodes do not create equivalent allocation/GC spikes.
  const source = new Uint8ClampedArray(width * height * 4);
  for (const effect of effects) {
    const mix = Math.max(0, Math.min(1, effect.amount));
    if (mix <= 0) continue;
    source.set(data.subarray(0, source.length));
    const p = effect.parameters;
    const frame = Math.round(effect.time * 30);
    const kernelRadius = effect.type === "sharpen" ? Math.max(1, Math.round(p.radius)) : 1;
    const sample = (x: number, y: number, channel: number) => source[(Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4 + channel];
    const convolve = (x: number, y: number, channel: number, kernel: number[], bias = 0) => {
      let value = bias, cursor = 0;
      for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) value += sample(x + kx * kernelRadius, y + ky * kernelRadius, channel) * kernel[cursor++];
      return byte(value);
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (!source[index + 3]) continue;
      const red = source[index], green = source[index + 1], blue = source[index + 2];
      let out: [number, number, number] = [red, green, blue];
      if (effect.type === "posterize") {
        const levels = Math.max(2, Math.round(p.levels));
        const step = 255 / (levels - 1);
        out = [byte(Math.round(red / step) * step), byte(Math.round(green / step) * step), byte(Math.round(blue / step) * step)];
      } else if (effect.type === "threshold") {
        const value = luminance(red, green, blue) / 255 >= p.level ? 255 : 0;
        out = [value, value, value];
      } else if (effect.type === "grain") {
        const size = Math.max(1, Math.round(p.size));
        const gx = Math.floor(x / size), gy = Math.floor(y / size);
        const mono = (pixelHash(gx, gy, frame) - .5) * 96;
        const color = Math.max(0, Math.min(1, p.color));
        out = [byte(red + mono * (1 - color) + (pixelHash(gx, gy, frame, 1) - .5) * 96 * color), byte(green + mono * (1 - color) + (pixelHash(gx, gy, frame, 2) - .5) * 96 * color), byte(blue + mono * (1 - color) + (pixelHash(gx, gy, frame, 3) - .5) * 96 * color)];
      } else if (effect.type === "vignette") {
        const nx = (x / Math.max(1, width - 1) - .5) * 2;
        const ny = (y / Math.max(1, height - 1) - .5) * 2 * p.roundness;
        const edge = Math.max(0, Math.min(1, (Math.hypot(nx, ny) - p.midpoint) / Math.max(.02, 1 - p.midpoint)));
        out = [byte(red * (1 - edge * .88)), byte(green * (1 - edge * .88)), byte(blue * (1 - edge * .88))];
      } else if (effect.type === "scanlines") {
        const line = y % Math.max(2, Math.round(p.spacing)) < Math.max(1, Math.round(p.width));
        if (line) out = [byte(red * .32), byte(green * .32), byte(blue * .32)];
      } else if (effect.type === "solarize") {
        const cutoff = p.cutoff * 255;
        out = [red > cutoff ? 255 - red : red, green > cutoff ? 255 - green : green, blue > cutoff ? 255 - blue : blue];
      } else if (effect.type === "duotone") {
        const tone = luminance(red, green, blue) / 255;
        const low = hueInk(p.shadowHue, .16), high = hueInk(p.highlightHue, .86);
        out = [byte(low[0] + (high[0] - low[0]) * tone), byte(low[1] + (high[1] - low[1]) * tone), byte(low[2] + (high[2] - low[2]) * tone)];
      } else if (effect.type === "channel-shift") {
        const radians = p.angle * Math.PI / 180;
        const dx = Math.round(Math.cos(radians) * p.distance), dy = Math.round(Math.sin(radians) * p.distance);
        out = [sample(x + dx, y + dy, 0), green, sample(x - dx, y - dy, 2)];
      } else if (effect.type === "pixelate") {
        const size = Math.max(2, Math.round(p.size));
        const sx = Math.min(width - 1, Math.floor(x / size) * size + Math.floor(size / 2));
        const sy = Math.min(height - 1, Math.floor(y / size) * size + Math.floor(size / 2));
        out = [sample(sx, sy, 0), sample(sx, sy, 1), sample(sx, sy, 2)];
      } else {
        const kernel = effect.type === "sharpen" ? [0, -1, 0, -1, 5, -1, 0, -1, 0]
          : effect.type === "edge-detect" ? [-1, -1, -1, -1, 8, -1, -1, -1, -1]
          : [-2, -1, 0, -1, 1, 1, 0, 1, 2];
        const bias = effect.type === "emboss" ? 128 : 0;
        out = [convolve(x, y, 0, kernel, bias), convolve(x, y, 1, kernel, bias), convolve(x, y, 2, kernel, bias)];
      }
      data[index] = mixByte(red, out[0], mix); data[index + 1] = mixByte(green, out[1], mix); data[index + 2] = mixByte(blue, out[2], mix);
    }
  }
  return data;
}

function drawPixelProcessedLayer(context: Compositor2DContext, layer: FrameLayer, resolve: (layer: FrameLayer) => FrameSource | null, alpha: number) {
  if (!layer.pixelEffects?.length) return false;
  const width = context.canvas.width, height = context.canvas.height;
  if (width <= 0 || height <= 0 || width * height > 16_000_000) return false;
  const picture = processedBuffer(width, height)?.picture;
  const pictureContext = picture?.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  if (!picture || !pictureContext) return false;
  pictureContext.clearRect(0, 0, width, height);
  const neutral = { ...layer, alpha: 1, blend: "source-over" as const, pixelEffects: undefined, whiteBalance: undefined, matte: undefined };
  if (!drawFrameLayerDirect(pictureContext, neutral, resolve, 1)) return false;
  const pixels = pictureContext.getImageData(0, 0, width, height);
  if (layer.whiteBalance) for (let index = 0; index < pixels.data.length; index += 4) {
    if (!pixels.data[index + 3]) continue;
    const corrected = whiteBalancePixel(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2], layer.whiteBalance.temperature, layer.whiteBalance.tint);
    pixels.data[index] = corrected[0]; pixels.data[index + 1] = corrected[1]; pixels.data[index + 2] = corrected[2];
  }
  applyResolvedPixelEffects(pixels.data, width, height, layer.pixelEffects);
  pictureContext.putImageData(pixels, 0, 0);
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  context.filter = "none";
  context.drawImage(picture, 0, 0);
  context.restore();
  return true;
}

function applyEffectPassesToBuffer(picture: HTMLCanvasElement | OffscreenCanvas, effectCanvas: HTMLCanvasElement | OffscreenCanvas, maskCanvas: HTMLCanvasElement | OffscreenCanvas, layer: FrameLayer, passes: ResolvedEffectPass[]) {
  const width = picture.width, height = picture.height;
  const pictureContext = picture.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  const effectContext = effectCanvas.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  const maskContext = maskCanvas.getContext("2d") as Compositor2DContext | null;
  if (!pictureContext || !effectContext || !maskContext) return false;
  for (const pass of passes) {
    effectContext.save();
    effectContext.clearRect(0, 0, width, height);
    effectContext.globalAlpha = 1;
    effectContext.globalCompositeOperation = "source-over";
    effectContext.filter = pass.filter ?? "none";
    effectContext.drawImage(picture, 0, 0);
    effectContext.restore();
    if (pass.pixelEffect && !applyPixelEffectGpu(picture, effectCanvas, pass.pixelEffect)) {
      const pixels = effectContext.getImageData(0, 0, width, height);
      applyResolvedPixelEffects(pixels.data, width, height, [pass.pixelEffect]);
      effectContext.putImageData(pixels, 0, 0);
    }
    if (pass.mask?.enabled) {
      const maskedLayer = { ...layer, mask: { ...pass.mask, box: layer.box, feather: 0 } };
      maskContext.save(); maskContext.clearRect(0, 0, width, height); maskContext.fillStyle = "#fff";
      traceLayerMask(maskContext, maskedLayer); maskContext.fill(pass.mask.inverted ? "evenodd" : "nonzero"); maskContext.restore();
      effectContext.save(); effectContext.globalCompositeOperation = "destination-in"; effectContext.filter = pass.mask.feather > 0 ? `blur(${pass.mask.feather}px)` : "none"; effectContext.drawImage(maskCanvas, 0, 0); effectContext.restore();
      pictureContext.save(); pictureContext.globalCompositeOperation = "destination-out"; pictureContext.filter = pass.mask.feather > 0 ? `blur(${pass.mask.feather}px)` : "none"; pictureContext.drawImage(maskCanvas, 0, 0); pictureContext.restore();
      pictureContext.drawImage(effectCanvas, 0, 0);
    } else {
      pictureContext.clearRect(0, 0, width, height);
      pictureContext.drawImage(effectCanvas, 0, 0);
    }
  }
  return true;
}

function drawEffectProcessedLayer(context: Compositor2DContext, layer: FrameLayer, resolve: (layer: FrameLayer) => FrameSource | null, alpha: number) {
  if (!layer.effectPasses?.length) return false;
  const width = context.canvas.width, height = context.canvas.height;
  if (width <= 0 || height <= 0 || width * height > 16_000_000) return false;
  const buffers = processedBuffer(width, height);
  const pictureContext = buffers?.picture.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  if (!buffers || !pictureContext) return false;
  pictureContext.clearRect(0, 0, width, height);
  const neutral = { ...layer, alpha: 1, blend: "source-over" as const, effectPasses: undefined, pixelEffects: undefined, matte: undefined };
  if (!drawFrameLayerDirect(pictureContext, neutral, resolve, 1)) return false;
  if (!applyEffectPassesToBuffer(buffers.picture, buffers.effect, buffers.mask, layer, layer.effectPasses)) return false;
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  context.filter = "none";
  context.drawImage(buffers.picture, 0, 0);
  context.restore();
  return true;
}

function drawAdjustmentLayer(context: Compositor2DContext, layer: FrameLayer, alpha: number) {
  if (layer.kind !== "adjustment" || !layer.effectPasses?.length) return false;
  const width = context.canvas.width, height = context.canvas.height;
  if (width <= 0 || height <= 0 || width * height > 16_000_000) return false;
  const buffers = processedBuffer(width, height);
  const pictureContext = buffers?.picture.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  if (!buffers || !pictureContext) return false;
  pictureContext.clearRect(0, 0, width, height);
  pictureContext.drawImage(context.canvas, 0, 0);
  if (!applyEffectPassesToBuffer(buffers.picture, buffers.effect, buffers.mask, layer, layer.effectPasses)) return false;
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  context.filter = "none";
  if (layer.mask) applyLayerMask(context, layer);
  context.drawImage(buffers.picture, 0, 0);
  context.restore();
  return true;
}

type GraphCanvas = HTMLCanvasElement | OffscreenCanvas;
const graphFeedback = new Map<string, { canvas: GraphCanvas; time: number }>();
const graphExecutionPlans = new Map<string, Map<string, number>>();

function canvasContext(canvas: GraphCanvas, read = false) {
  return canvas.getContext("2d", read ? { willReadFrequently: true } : undefined) as Compositor2DContext | null;
}

function graphCompositeMode(blend: import("./effect-graph.ts").GraphBlendMode): GlobalCompositeOperation {
  return blend === "normal" ? "source-over" : blend;
}

/** Execute a validated graph with a small reference-counted surface pool. Peak
 * memory follows branch width instead of total node count, which matters at 4K. */
function executeEffectGraph(source: GraphCanvas, composite: GraphCanvas, graph: ResolvedEffectGraph, layer: FrameLayer, resolve: (layer: FrameLayer) => FrameSource | null): GraphCanvas | null {
  const startedAt = performance.now();
  let gpuPasses = 0, cpuFallbacks = 0;
  const width = source.width, height = source.height;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const topologyKey = graph.orderedNodeIds.map((id) => { const node = byId.get(id)!; return `${id}:${node.kind}:${node.kind === "source" ? `${node.sourceType ?? "self"}:${node.assetId ?? ""}` : node.kind === "merge" ? `${node.background},${node.foreground}` : node.kind === "matte" ? `${node.input},${node.matte}` : node.kind === "displacement" ? `${node.input},${node.map}` : node.input}`; }).join("|");
  let cachedUses = graphExecutionPlans.get(topologyKey);
  const planCacheHit = Boolean(cachedUses);
  if (!cachedUses) {
    cachedUses = new Map<string, number>();
    for (const id of graph.orderedNodeIds) {
      const node = byId.get(id);
      if (!node || node.kind === "source") continue;
      const inputs = node.kind === "merge" ? [node.background, node.foreground] : node.kind === "matte" ? [node.input, node.matte] : node.kind === "displacement" ? [node.input, node.map] : [node.input];
      for (const input of inputs) cachedUses.set(input, (cachedUses.get(input) ?? 0) + 1);
    }
    if (graphExecutionPlans.size >= 32) graphExecutionPlans.delete(graphExecutionPlans.keys().next().value as string);
    graphExecutionPlans.set(topologyKey, cachedUses);
  }
  const uses = new Map(cachedUses);
  const results = new Map<string, GraphCanvas>(), pool: GraphCanvas[] = [];
  const acquire = () => {
    const canvas = pool.pop() ?? renderCanvas(width, height);
    const context = canvas && canvasContext(canvas, true);
    if (context) { context.save(); context.globalAlpha = 1; context.globalCompositeOperation = "source-over"; context.filter = "none"; context.clearRect(0, 0, width, height); context.restore(); }
    return canvas;
  };
  const releaseInputs = (inputs: string[], retained?: GraphCanvas) => {
    for (const input of inputs) {
      const remaining = (uses.get(input) ?? 1) - 1; uses.set(input, remaining);
      const canvas = results.get(input);
      if (remaining <= 0 && canvas && canvas !== source && canvas !== composite && canvas !== retained) { results.delete(input); pool.push(canvas); }
    }
  };
  let output: GraphCanvas | null = null;
  for (const id of graph.orderedNodeIds) {
    const node = byId.get(id);
    if (!node) return null;
    if (node.kind === "source") {
      if (node.sourceType === "composite") results.set(node.id, composite);
      else if (node.sourceType === "asset" && node.assetId) {
        const assetCanvas = acquire(), assetContext = assetCanvas && canvasContext(assetCanvas, true);
        const assetLayer: FrameLayer = { ...layer, kind: "overlay", assetId: node.assetId, alpha: 1, blend: "source-over", effectGraph: undefined, effectPasses: undefined, pixelEffects: undefined, matte: undefined, mask: undefined };
        if (assetCanvas && assetContext && drawFrameLayerDirect(assetContext, assetLayer, resolve, 1)) results.set(node.id, assetCanvas);
        else results.set(node.id, source);
      } else results.set(node.id, source);
      continue;
    }
    const inputIds = node.kind === "merge" ? [node.background, node.foreground]
      : node.kind === "matte" ? [node.input, node.matte]
      : node.kind === "displacement" ? [node.input, node.map]
      : [node.input];
    const inputs = inputIds.map((input) => results.get(input));
    if (inputs.some((input) => !input)) return null;
    if (node.kind === "output") { output = inputs[0]!; continue; }
    const target = acquire(), targetContext = target && canvasContext(target, true);
    if (!target || !targetContext) return null;
    const primary = inputs[0]!;

    if (node.kind === "effect") {
      targetContext.drawImage(primary, 0, 0);
      if (node.pass) {
        const effect = acquire(), mask = acquire();
        if (!effect || !mask || !applyEffectPassesToBuffer(target, effect, mask, layer, [node.pass])) return null;
        pool.push(effect, mask);
      }
    } else if (node.kind === "transform") {
      targetContext.save(); targetContext.globalAlpha = Math.max(0, Math.min(1, node.opacity));
      targetContext.translate(width / 2 + node.x, height / 2 + node.y); targetContext.rotate(node.rotation * Math.PI / 180);
      const scale = Math.max(.001, node.scale / 100); targetContext.scale(scale, scale); targetContext.drawImage(primary, -width / 2, -height / 2); targetContext.restore();
    } else if (node.kind === "merge") {
      targetContext.drawImage(inputs[0]!, 0, 0); targetContext.save();
      targetContext.globalAlpha = Math.max(0, Math.min(1, node.opacity)); targetContext.globalCompositeOperation = graphCompositeMode(node.blend);
      targetContext.drawImage(inputs[1]!, 0, 0); targetContext.restore();
    } else if (node.kind === "matte") {
      const gpu = applyGraphPairGpu(primary, inputs[1]!, target, { kind: node.mode, inverted: node.inverted });
      if (gpu) gpuPasses += 1;
      else {
        cpuFallbacks += 1;
        targetContext.drawImage(primary, 0, 0);
        const matteContext = canvasContext(inputs[1]!, true); if (!matteContext) return null;
        const pixels = targetContext.getImageData(0, 0, width, height), matte = matteContext.getImageData(0, 0, width, height).data;
        for (let index = 0; index < pixels.data.length; index += 4) { const value = node.mode === "alpha" ? matte[index + 3] : luminance(matte[index], matte[index + 1], matte[index + 2]); pixels.data[index + 3] = Math.round(pixels.data[index + 3] * (node.inverted ? 255 - value : value) / 255); }
        targetContext.putImageData(pixels, 0, 0);
      }
    } else if (node.kind === "displacement") {
      const gpu = applyGraphPairGpu(primary, inputs[1]!, target, { kind: "displacement", amountX: node.amountX, amountY: node.amountY });
      if (gpu) gpuPasses += 1;
      else {
        cpuFallbacks += 1;
        const inputContext = canvasContext(primary, true), mapContext = canvasContext(inputs[1]!, true); if (!inputContext || !mapContext) return null;
        const input = inputContext.getImageData(0, 0, width, height).data, map = mapContext.getImageData(0, 0, width, height).data, outputPixels = targetContext.createImageData(width, height);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const index = (y * width + x) * 4, sx = Math.max(0, Math.min(width - 1, Math.round(x + (map[index] / 255 - .5) * 2 * node.amountX))), sy = Math.max(0, Math.min(height - 1, Math.round(y + (map[index + 1] / 255 - .5) * 2 * node.amountY))), sample = (sy * width + sx) * 4; outputPixels.data[index] = input[sample]; outputPixels.data[index + 1] = input[sample + 1]; outputPixels.data[index + 2] = input[sample + 2]; outputPixels.data[index + 3] = input[sample + 3]; }
        targetContext.putImageData(outputPixels, 0, 0);
      }
    } else if (node.kind === "feedback") {
      const key = `${layer.assetId}:${node.id}`, previous = graphFeedback.get(key);
      const continuous = previous && layer.sourceTime > previous.time && layer.sourceTime - previous.time < .25;
      if (continuous) { targetContext.save(); targetContext.globalAlpha = Math.max(0, Math.min(.98, node.amount)); targetContext.drawImage(previous.canvas, 0, 0); targetContext.restore(); }
      targetContext.drawImage(primary, 0, 0);
      const cached = previous?.canvas ?? renderCanvas(width, height);
      const cachedContext = cached && canvasContext(cached);
      if (cached && cachedContext) { cachedContext.clearRect(0, 0, width, height); cachedContext.drawImage(target, 0, 0); graphFeedback.set(key, { canvas: cached, time: layer.sourceTime }); }
    } else if (node.kind === "shader") {
      if (applyCustomShaderGpu(primary, target, node.program, layer.sourceTime)) gpuPasses += 1;
      else { cpuFallbacks += 1; targetContext.drawImage(primary, 0, 0); }
    }
    results.set(node.id, target); releaseInputs(inputIds, target);
  }
  if (output) recordGraphExecution(graph.outputNodeId, { elapsedMs: performance.now() - startedAt, nodes: graph.orderedNodeIds.length, gpuPasses, cpuFallbacks, planCacheHit });
  return output;
}

function drawGraphProcessedLayer(context: Compositor2DContext, layer: FrameLayer, resolve: (layer: FrameLayer) => FrameSource | null, alpha: number) {
  if (!layer.effectGraph) return false;
  const width = context.canvas.width, height = context.canvas.height;
  if (width <= 0 || height <= 0 || width * height > 16_000_000) return false;
  const source = renderCanvas(width, height), composite = renderCanvas(width, height), sourceContext = source && canvasContext(source, true), compositeContext = composite && canvasContext(composite, true);
  if (!source || !composite || !sourceContext || !compositeContext) return false;
  compositeContext.drawImage(context.canvas, 0, 0);
  if (layer.kind === "adjustment") sourceContext.drawImage(context.canvas, 0, 0);
  else {
    const neutral = { ...layer, alpha: 1, blend: "source-over" as const, effectGraph: undefined, effectPasses: undefined, pixelEffects: undefined, matte: undefined };
    if (!drawFrameLayerDirect(sourceContext, neutral, resolve, 1)) return false;
  }
  if (layer.effectPasses?.length) {
    const effect = renderCanvas(width, height), mask = renderCanvas(width, height);
    if (!effect || !mask || !applyEffectPassesToBuffer(source, effect, mask, layer, layer.effectPasses)) return false;
  }
  const output = executeEffectGraph(source, composite, layer.effectGraph, layer, resolve);
  if (!output) return false;
  context.save(); context.globalAlpha = alpha; context.globalCompositeOperation = layer.blend; context.filter = "none";
  if (layer.mask) applyLayerMask(context, layer);
  context.drawImage(output, 0, 0); context.restore();
  return true;
}

/** Apply the same two-axis affine correction as the sequence-grade shader to
 * one un-premultiplied 8-bit RGB pixel. Exported for parity-critical tests. */
export function whiteBalancePixel(red: number, green: number, blue: number, temperature: number, tint: number): [number, number, number] {
  const safeTemperature = Math.max(-1, Math.min(1, Number.isFinite(temperature) ? temperature : 0));
  const safeTint = Math.max(-1, Math.min(1, Number.isFinite(tint) ? tint : 0));
  const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return [
    clampByte(red + (safeTemperature * .08 + safeTint * .04) * 255),
    clampByte(green - safeTint * .08 * 255),
    clampByte(blue + (-safeTemperature * .08 + safeTint * .04) * 255),
  ];
}

function drawWhiteBalancedLayer(
  context: Compositor2DContext,
  layer: FrameLayer,
  resolve: (layer: FrameLayer) => FrameSource | null,
  alpha: number,
) {
  const balance = layer.whiteBalance;
  if (!balance || (Math.abs(balance.temperature) <= 1e-6 && Math.abs(balance.tint) <= 1e-6)) return false;
  const width = context.canvas.width;
  const height = context.canvas.height;
  // One bounded, reusable RGBA surface protects long high-resolution renders
  // from per-frame allocation churn while still covering DCI/UHD frames.
  if (width <= 0 || height <= 0 || width * height > 40_000_000) return false;
  const picture = balancedBuffer(width, height)?.picture;
  const pictureContext = picture?.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  if (!picture || !pictureContext) return false;
  pictureContext.save();
  pictureContext.globalAlpha = 1;
  pictureContext.globalCompositeOperation = "source-over";
  pictureContext.filter = "none";
  pictureContext.clearRect(0, 0, width, height);
  pictureContext.restore();
  const neutralLayer = { ...layer, alpha: 1, blend: "source-over" as const, whiteBalance: undefined, matte: undefined };
  if (!drawFrameLayerDirect(pictureContext, neutralLayer, resolve, 1)) return false;
  const pixels = pictureContext.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index + 3] === 0) continue;
    const corrected = whiteBalancePixel(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2], balance.temperature, balance.tint);
    pixels.data[index] = corrected[0]; pixels.data[index + 1] = corrected[1]; pixels.data[index + 2] = corrected[2];
  }
  pictureContext.putImageData(pixels, 0, 0);
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  context.filter = "none";
  context.drawImage(picture, 0, 0);
  context.restore();
  return true;
}

/** Convert one un-premultiplied matte pixel to its output alpha. Exported so
 * the parity-critical math can be tested without a browser canvas. */
export function mattePixelAlpha(red: number, green: number, blue: number, alpha: number, mode: "alpha" | "luma", inverted: boolean) {
  const normalizedAlpha = Math.max(0, Math.min(255, alpha)) / 255;
  const coverage = mode === "luma"
    ? ((.2126 * red + .7152 * green + .0722 * blue) / 255) * normalizedAlpha
    : normalizedAlpha;
  return Math.round((inverted ? 1 - coverage : coverage) * 255);
}

/** Render a polygon subject through a blurred alpha surface for a genuine edge
 * feather. The bounded buffer prevents a pathological mask from exhausting
 * memory during long or high-resolution renders. */
function drawSoftRotoLayer(
  context: Compositor2DContext,
  layer: FrameLayer,
  source: FrameSource,
  alpha: number,
): boolean {
  const mask = layer.mask;
  if ((!mask?.path?.length && !mask?.alphaMatte) || (!mask.alphaMatte && mask.feather <= 0 && (mask.pathSamples?.length ?? 0) <= 1) || mask.inverted) return false;
  const padding = Math.max(2, Math.ceil(mask.feather * 2.5));
  const bufferWidth = Math.ceil(layer.box.width) + padding * 2;
  const bufferHeight = Math.ceil(layer.box.height) + padding * 2;
  if (bufferWidth <= 0 || bufferHeight <= 0 || bufferWidth * bufferHeight > 20_000_000) return false;
  const buffers = rotoBuffers(bufferWidth, bufferHeight);
  const picture = buffers?.picture;
  const matte = buffers?.matte;
  const cleanup = buffers?.cleanup;
  const pictureContext = picture?.getContext("2d") as Compositor2DContext | null;
  const matteContext = matte?.getContext("2d") as Compositor2DContext | null;
  const cleanupContext = cleanup?.getContext("2d") as Compositor2DContext | null;
  if (!picture || !matte || !cleanup || !pictureContext || !matteContext || !cleanupContext) return false;
  pictureContext.clearRect(0, 0, bufferWidth, bufferHeight);
  pictureContext.globalAlpha = 1;
  pictureContext.globalCompositeOperation = "source-over";
  pictureContext.filter = layer.filter;
  source.draw(pictureContext, padding, padding, layer.box.width, layer.box.height);
  matteContext.clearRect(0, 0, bufferWidth, bufferHeight);
  matteContext.fillStyle = "#fff";
  matteContext.filter = mask.feather > 0 ? `blur(${mask.feather}px)` : "none";
  const centerX = padding + layer.box.width / 2;
  const centerY = padding + layer.box.height / 2;
  const expansionScale = 1 + mask.expansion / 100;
  if (mask.alphaMatte) {
    const decoded = decodeRotoAlphaMatte(mask.alphaMatte);
    const alphaCanvas = renderCanvas(mask.alphaMatte.width, mask.alphaMatte.height);
    const alphaContext = alphaCanvas?.getContext("2d") as Compositor2DContext | null;
    if (decoded.length && alphaCanvas && alphaContext) {
      const pixels = alphaContext.createImageData(mask.alphaMatte.width, mask.alphaMatte.height);
      for (let index = 0; index < decoded.length; index++) { const offset = index * 4; pixels.data[offset] = 255; pixels.data[offset + 1] = 255; pixels.data[offset + 2] = 255; pixels.data[offset + 3] = decoded[index]; }
      alphaContext.putImageData(pixels, 0, 0);
      const expandedWidth = layer.box.width * expansionScale;
      const expandedHeight = layer.box.height * expansionScale;
      matteContext.drawImage(alphaCanvas, centerX - expandedWidth / 2, centerY - expandedHeight / 2, expandedWidth, expandedHeight);
    }
  } else {
    const samples = mask.pathSamples?.length ? mask.pathSamples : [{ points: mask.path ?? [], alpha: 1 }];
    matteContext.globalCompositeOperation = samples.length > 1 ? "lighter" : "source-over";
    for (const sample of samples) {
      matteContext.globalAlpha = Math.max(0, Math.min(1, sample.alpha));
      matteContext.beginPath();
      sample.points.forEach((point, index) => {
        const x = centerX + (padding + point.x * layer.box.width - centerX) * expansionScale;
        const y = centerY + (padding + point.y * layer.box.height - centerY) * expansionScale;
        if (index === 0) matteContext.moveTo(x, y); else matteContext.lineTo(x, y);
      });
      matteContext.closePath(); matteContext.fill();
    }
  }
  matteContext.globalAlpha = 1;
  matteContext.globalCompositeOperation = "source-over";
  pictureContext.filter = "none";
  pictureContext.globalCompositeOperation = "destination-in";
  pictureContext.drawImage(matte, 0, 0);
  const cleanupAmount = Math.max(0, Math.min(1, mask.edgeColorCleanup ?? 0));
  if (cleanupAmount > 0) {
    // Blur already-matted foreground colour slightly beyond the edge, then
    // source-atop it back into the original. source-atop preserves the exact
    // alpha surface while replacing background-contaminated RGB at soft hair,
    // fur and motion-blurred boundaries. The same Canvas pass runs in preview
    // and the render worker, so there is no export-only cleanup approximation.
    cleanupContext.clearRect(0, 0, bufferWidth, bufferHeight);
    cleanupContext.globalAlpha = 1;
    cleanupContext.globalCompositeOperation = "source-over";
    cleanupContext.filter = `blur(${.6 + cleanupAmount * 2.4}px)`;
    cleanupContext.drawImage(picture, 0, 0);
    cleanupContext.filter = "none";
    cleanupContext.globalCompositeOperation = "destination-out";
    cleanupContext.drawImage(matte, 0, 0);
    cleanupContext.globalCompositeOperation = "source-over";
    pictureContext.globalCompositeOperation = "source-atop";
    pictureContext.globalAlpha = cleanupAmount * .85;
    pictureContext.drawImage(cleanup, 0, 0);
    pictureContext.globalAlpha = 1;
  }
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  if (layer.rotation || layer.flipH || layer.flipV) {
    const cx = layer.box.x + layer.box.width / 2;
    const cy = layer.box.y + layer.box.height / 2;
    context.translate(cx, cy);
    if (layer.rotation) context.rotate((layer.rotation * Math.PI) / 180);
    if (layer.flipH || layer.flipV) context.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
    context.translate(-cx, -cy);
  }
  context.drawImage(picture, layer.box.x - padding, layer.box.y - padding);
  context.restore();
  return true;
}

/** Small-object cleanup behind a tracked mask. This bounded CPU fallback is
 * deliberately deterministic and shared by preview/export. It is intended for
 * wires, logos and props; large removals should use a generated clean plate. */
function drawObjectRemovedLayer(
  context: Compositor2DContext,
  layer: FrameLayer,
  source: FrameSource,
  alpha: number,
  resolve?: (layer: FrameLayer) => FrameSource | null,
): boolean {
  if (!layer.removal?.enabled || !layer.mask || layer.matte || layer.quad) return false;
  const width = Math.max(1, Math.ceil(Math.abs(layer.box.width)));
  const height = Math.max(1, Math.ceil(Math.abs(layer.box.height)));
  if (width * height > 12_000_000) return false;
  const buffers = objectRemovalBuffers(width, height);
  const picture = buffers?.picture;
  const maskCanvas = buffers?.mask;
  const cleanPlateCanvas = buffers?.cleanPlate;
  const pictureContext = picture?.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  const maskContext = maskCanvas?.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  if (!picture || !maskCanvas || !cleanPlateCanvas || !pictureContext || !maskContext) return false;
  pictureContext.save();
  pictureContext.globalAlpha = 1;
  pictureContext.globalCompositeOperation = "source-over";
  pictureContext.filter = layer.filter;
  pictureContext.clearRect(0, 0, width, height);
  source.draw(pictureContext, 0, 0, width, height);
  pictureContext.restore();
  maskContext.save();
  maskContext.globalAlpha = 1;
  maskContext.globalCompositeOperation = "source-over";
  maskContext.filter = "none";
  maskContext.clearRect(0, 0, width, height);
  const localLayer: FrameLayer = { ...layer, box: { x: 0, y: 0, width, height }, rotation: 0, quad: undefined };
  if (layer.mask.alphaMatte) {
    const matte = layer.mask.alphaMatte;
    const decoded = decodeRotoAlphaMatte(matte);
    const alphaCanvas = renderCanvas(matte.width, matte.height);
    const alphaContext = alphaCanvas?.getContext("2d") as Compositor2DContext | null;
    if (alphaCanvas && alphaContext && decoded.length) {
      const pixels = alphaContext.createImageData(matte.width, matte.height);
      for (let index = 0; index < decoded.length; index += 1) {
        const offset = index * 4;
        pixels.data[offset] = 255; pixels.data[offset + 1] = 255; pixels.data[offset + 2] = 255; pixels.data[offset + 3] = decoded[index];
      }
      alphaContext.putImageData(pixels, 0, 0);
      maskContext.drawImage(alphaCanvas, 0, 0, width, height);
    }
  } else {
    maskContext.fillStyle = "#fff";
    applyLayerMask(maskContext, localLayer);
    maskContext.fillRect(0, 0, width, height);
  }
  maskContext.restore();
  const cleanPlateSource = layer.removal.cleanPlateAssetId && resolve ? resolve({ ...layer, assetId: layer.removal.cleanPlateAssetId, sourceTime: 0, removal: undefined, mask: undefined }) : null;
  const cleanPlateContext = cleanPlateCanvas.getContext("2d") as Compositor2DContext | null;
  if (cleanPlateSource && cleanPlateContext) {
    cleanPlateContext.save();
    cleanPlateContext.clearRect(0, 0, width, height);
    cleanPlateContext.globalAlpha = 1;
    cleanPlateContext.globalCompositeOperation = "source-over";
    cleanPlateContext.filter = layer.filter;
    cleanPlateSource.draw(cleanPlateContext, 0, 0, width, height);
    cleanPlateContext.globalCompositeOperation = "destination-in";
    cleanPlateContext.filter = "none";
    cleanPlateContext.drawImage(maskCanvas, 0, 0);
    cleanPlateContext.restore();
    pictureContext.save();
    pictureContext.globalAlpha = 1;
    pictureContext.globalCompositeOperation = "source-over";
    pictureContext.filter = "none";
    pictureContext.drawImage(cleanPlateCanvas, 0, 0);
    pictureContext.restore();
  } else {
    const framePixels = pictureContext.getImageData(0, 0, width, height);
    const maskPixels = maskContext.getImageData(0, 0, width, height);
    const filled = contentAwareFill(
      { width, height, data: framePixels.data },
      { width, height, alpha: Uint8Array.from({ length: width * height }, (_, index) => maskPixels.data[index * 4 + 3]) },
      layer.removal.passes,
    );
    framePixels.data.set(filled.data);
    pictureContext.putImageData(framePixels, 0, 0);
  }
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  const cx = layer.box.x + layer.box.width / 2;
  const cy = layer.box.y + layer.box.height / 2;
  context.translate(cx, cy);
  if (layer.rotation) context.rotate(layer.rotation * Math.PI / 180);
  if (layer.flipH || layer.flipV) context.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
  context.drawImage(picture, -layer.box.width / 2, -layer.box.height / 2, layer.box.width, layer.box.height);
  context.restore();
  return true;
}

/** Deform media through a regular grid whose vertices are displaced by mesh
 * pins. Rasterizing once keeps every tile on the same decoded source frame. */
function drawMeshWarpedLayer(
  context: Compositor2DContext,
  layer: FrameLayer,
  source: FrameSource,
  alpha: number,
): boolean {
  if (!layer.meshWarp?.enabled || !layer.meshWarp.pins.length || layer.quad || layer.mask?.alphaMatte) return false;
  const width = Math.max(1, Math.ceil(Math.abs(layer.box.width)));
  const height = Math.max(1, Math.ceil(Math.abs(layer.box.height)));
  if (width * height > 16_000_000) return false;
  const raster = renderCanvas(width, height);
  const rasterContext = raster?.getContext("2d") as Compositor2DContext | null;
  if (!raster || !rasterContext) return false;
  rasterContext.clearRect(0, 0, width, height);
  rasterContext.save();
  rasterContext.globalAlpha = 1;
  rasterContext.globalCompositeOperation = "source-over";
  rasterContext.filter = layer.filter;
  if (layer.mask) applyLayerMask(rasterContext, { ...layer, box: { x: 0, y: 0, width, height }, rotation: 0 });
  source.draw(rasterContext, 0, 0, width, height);
  rasterContext.restore();
  const divisions = 10;
  const radians = layer.rotation * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  const centerX = layer.box.x + layer.box.width / 2;
  const centerY = layer.box.y + layer.box.height / 2;
  const targetPoint = (x: number, y: number) => {
    const warped = meshWarpPoint({ x, y }, layer.meshWarp);
    const localX = (warped.x - .5) * layer.box.width * (layer.flipH ? -1 : 1);
    const localY = (warped.y - .5) * layer.box.height * (layer.flipV ? -1 : 1);
    return { x: centerX + localX * cosine - localY * sine, y: centerY + localX * sine + localY * cosine };
  };
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  context.filter = "none";
  for (let row = 0; row < divisions; row += 1) for (let column = 0; column < divisions; column += 1) {
    const x0 = column / divisions, x1 = (column + 1) / divisions;
    const y0 = row / divisions, y1 = (row + 1) / divisions;
    const sourceBox = { x: x0 * width, y: y0 * height, width: (x1 - x0) * width, height: (y1 - y0) * height };
    const quad: ProjectedQuad = [targetPoint(x0, y0), targetPoint(x1, y0), targetPoint(x1, y1), targetPoint(x0, y1)];
    drawProjectedBox(context, sourceBox, quad, () => context.drawImage(raster, 0, 0));
  }
  context.restore();
  return true;
}

function drawFrameLayerDirect(
  context: Compositor2DContext,
  layer: FrameLayer,
  resolve: (layer: FrameLayer) => FrameSource | null,
  alpha: number,
) {
  const directLayer = { ...layer, alpha, matte: undefined };
  if (directLayer.whiteBalance && drawWhiteBalancedLayer(context, directLayer, resolve, alpha)) return true;
  if (directLayer.lighting && drawColoredLitLayer(context, directLayer, resolve, alpha)) return true;
  if (directLayer.kind === "title" && directLayer.title) {
    drawTitle(context, directLayer);
    return true;
  }
  if (directLayer.kind === "graphic" && directLayer.graphic) {
    if (!drawProjectedGraphic(context, directLayer)) drawGraphic(context, directLayer);
    return true;
  }
  const source = resolve(directLayer);
  if (!source) return false;
  if (drawObjectRemovedLayer(context, directLayer, source, alpha, resolve)) return true;
  if (drawMeshWarpedLayer(context, directLayer, source, alpha)) return true;
  const drawPass = () => {
    if (directLayer.quad) {
      drawProjectedBox(context, directLayer.box, directLayer.quad, () => {
        const flatLayer = { ...directLayer, quad: undefined, rotation: 0 };
        context.save();
        context.globalAlpha = alpha;
        context.globalCompositeOperation = flatLayer.blend;
        context.filter = flatLayer.filter;
        applyLayerMask(context, flatLayer);
        source.draw(context, flatLayer.box.x, flatLayer.box.y, flatLayer.box.width, flatLayer.box.height);
        context.restore();
      });
      return;
    }
    context.save();
    context.globalAlpha = alpha;
    context.globalCompositeOperation = directLayer.blend;
    context.filter = directLayer.filter;
    if (directLayer.rotation || directLayer.flipH || directLayer.flipV) {
      const cx = directLayer.box.x + directLayer.box.width / 2;
      const cy = directLayer.box.y + directLayer.box.height / 2;
      context.translate(cx, cy);
      if (directLayer.rotation) context.rotate((directLayer.rotation * Math.PI) / 180);
      if (directLayer.flipH || directLayer.flipV) context.scale(directLayer.flipH ? -1 : 1, directLayer.flipV ? -1 : 1);
      context.translate(-cx, -cy);
    }
    applyLayerMask(context, directLayer);
    source.draw(context, directLayer.box.x, directLayer.box.y, directLayer.box.width, directLayer.box.height);
    context.restore();
  };
  if (!drawSoftRotoLayer(context, directLayer, source, alpha)) drawPass();
  return true;
}

/** Apply colored lighting without reading pixels back to JavaScript. The layer
 * is rendered once to a transparent buffer, an alpha-matched tint is multiplied
 * into it, then the strongest channel is restored as brightness. This produces
 * exact per-channel linear multipliers while keeping transparent/roto pixels
 * transparent and lets the browser or Electron GPU handle the compositing. */
function drawColoredLitLayer(
  context: Compositor2DContext,
  layer: FrameLayer,
  resolve: (layer: FrameLayer) => FrameSource | null,
  alpha: number,
) {
  const width = context.canvas.width;
  const height = context.canvas.height;
  if (width <= 0 || height <= 0 || width * height > 40_000_000 || !layer.lighting) return false;
  const factors = layer.lighting.map((value) => Math.max(0, Math.min(4, value))) as [number, number, number];
  const peak = Math.max(...factors);
  if (peak <= .0001) return true;
  const buffers = lightBuffers(width, height);
  const picture = buffers?.picture;
  const tint = buffers?.tint;
  const pictureContext = picture?.getContext("2d") as Compositor2DContext | null;
  const tintContext = tint?.getContext("2d") as Compositor2DContext | null;
  if (!picture || !tint || !pictureContext || !tintContext) return false;

  for (const bufferContext of [pictureContext, tintContext]) {
    bufferContext.globalAlpha = 1;
    bufferContext.globalCompositeOperation = "source-over";
    bufferContext.filter = "none";
    bufferContext.clearRect(0, 0, width, height);
  }
  const unlit = { ...layer, lighting: undefined, alpha: 1, blend: "source-over" as const, matte: undefined };
  if (!drawFrameLayerDirect(pictureContext, unlit, resolve, 1)) return false;

  tintContext.fillStyle = `rgb(${factors.map((value) => Math.round(value / peak * 255)).join(",")})`;
  tintContext.fillRect(0, 0, width, height);
  tintContext.globalCompositeOperation = "destination-in";
  tintContext.drawImage(picture, 0, 0);
  pictureContext.globalCompositeOperation = "multiply";
  pictureContext.drawImage(tint, 0, 0);

  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  context.filter = `brightness(${peak * 100}%)`;
  context.drawImage(picture, 0, 0);
  context.restore();
  return true;
}

function drawCastShadow(
  context: Compositor2DContext,
  layer: FrameLayer,
  resolve: (layer: FrameLayer) => FrameSource | null,
) {
  const shadow = layer.shadow;
  if (!shadow || shadow.opacity <= 0) return false;
  context.save();
  context.beginPath();
  context.moveTo(shadow.receiverQuad[0].x, shadow.receiverQuad[0].y);
  for (let index = 1; index < shadow.receiverQuad.length; index += 1) context.lineTo(shadow.receiverQuad[index].x, shadow.receiverQuad[index].y);
  context.closePath();
  context.clip();
  const shadowLayer: FrameLayer = {
    ...layer,
    quad: shadow.quad,
    depth: undefined,
    lighting: undefined,
    shadow: undefined,
    matte: undefined,
    alpha: layer.alpha * shadow.opacity,
    blend: "source-over",
    filter: `brightness(0) blur(${shadow.softness}px)`,
  };
  const painted = drawFrameLayerDirect(context, shadowLayer, resolve, shadowLayer.alpha);
  context.restore();
  return painted;
}

function drawPixelMattedLayer(
  context: Compositor2DContext,
  layer: FrameLayer,
  width: number,
  height: number,
  resolve: (layer: FrameLayer) => FrameSource | null,
  alpha: number,
) {
  if (!layer.matte || width <= 0 || height <= 0 || width * height > 40_000_000) return false;
  const buffers = matteBuffers(width, height);
  const picture = buffers?.picture;
  const matteCanvas = buffers?.matte;
  const pictureContext = picture?.getContext("2d") as Compositor2DContext | null;
  const matteContext = matteCanvas?.getContext("2d", { willReadFrequently: true }) as Compositor2DContext | null;
  if (!picture || !matteCanvas || !pictureContext || !matteContext) return false;

  pictureContext.save();
  pictureContext.globalAlpha = 1;
  pictureContext.globalCompositeOperation = "source-over";
  pictureContext.filter = "none";
  pictureContext.clearRect(0, 0, width, height);
  pictureContext.restore();
  matteContext.save();
  matteContext.globalAlpha = 1;
  matteContext.globalCompositeOperation = "source-over";
  matteContext.filter = "none";
  matteContext.clearRect(0, 0, width, height);
  matteContext.restore();

  const target = { ...layer, alpha: 1, blend: "source-over" as const, matte: undefined };
  const targetPainted = target.pixelEffects?.length
    ? drawPixelProcessedLayer(pictureContext, target, resolve, 1)
    : drawFrameLayerDirect(pictureContext, target, resolve, 1);
  if (!targetPainted) return false;
  const matteLayer = { ...layer.matte.layer, blend: "source-over" as const, matte: undefined };
  if (!drawFrameLayerDirect(matteContext, matteLayer, resolve, matteLayer.alpha)) return false;

  if (layer.matte.mode === "luma" || layer.matte.inverted) {
    const pixels = matteContext.getImageData(0, 0, width, height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      pixels.data[index + 3] = mattePixelAlpha(
        pixels.data[index], pixels.data[index + 1], pixels.data[index + 2], pixels.data[index + 3],
        layer.matte.mode, layer.matte.inverted,
      );
    }
    matteContext.putImageData(pixels, 0, 0);
  }

  pictureContext.save();
  pictureContext.globalAlpha = 1;
  pictureContext.globalCompositeOperation = "destination-in";
  pictureContext.filter = "none";
  pictureContext.drawImage(matteCanvas, 0, 0);
  pictureContext.restore();
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = layer.blend;
  context.filter = "none";
  context.drawImage(picture, 0, 0);
  context.restore();
  return true;
}

/**
 * Paint a plan. `resolve` maps a layer to a drawable for this host — a decoded
 * VideoSample in the renderer, an <img>/<video> element in the preview — which
 * is the only thing the two hosts do differently.
 */
export function paintFramePlan(
  context: Compositor2DContext,
  plan: FramePlan,
  width: number,
  height: number,
  resolve: (layer: FrameLayer) => FrameSource | null,
) {
  // Echo: keep the previous frame instead of clearing, and draw the new base
  // over it at reduced alpha so it *blends into* the persistent frame — that's
  // what leaves trails. Just fading to black wouldn't work: the opaque base
  // would paint right over the fade. The old frame decays by `echo` each frame,
  // so trails stay bounded. The canvas is reused frame-to-frame by both hosts.
  const echoing = plan.echo > 0;
  if (!echoing) {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    if (plan.transparent) context.clearRect(0, 0, width, height);
    else {
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
    }
    context.restore();
  }

  for (const layer of plan.layers) {
    const layerAlpha = echoing && layer.kind === "base" ? layer.alpha * (1 - plan.echo) : layer.alpha;
    if (layer.kind === "adjustment") {
      if (layer.effectGraph) drawGraphProcessedLayer(context, layer, resolve, layerAlpha);
      else drawAdjustmentLayer(context, layer, layerAlpha);
      continue;
    }
    if (layer.shadow) drawCastShadow(context, layer, resolve);
    if (layer.matte && drawPixelMattedLayer(context, layer, width, height, resolve, layerAlpha)) continue;
    if (layer.effectGraph && drawGraphProcessedLayer(context, layer, resolve, layerAlpha)) continue;
    if (layer.effectPasses?.length && drawEffectProcessedLayer(context, layer, resolve, layerAlpha)) continue;
    if (layer.pixelEffects?.length && drawPixelProcessedLayer(context, layer, resolve, layerAlpha)) continue;
    if (layer.lighting && drawFrameLayerDirect(context, layer, resolve, layerAlpha)) continue;
    if (layer.whiteBalance && drawFrameLayerDirect(context, layer, resolve, layerAlpha)) continue;
    // Titles are drawn by the compositor itself — no external source to resolve.
    if (layer.kind === "title" && layer.title) {
      drawTitle(context, layer);
      continue;
    }
    if (layer.kind === "graphic" && layer.graphic) {
      if (!drawProjectedGraphic(context, layer)) drawGraphic(context, layer);
      continue;
    }
    const source = resolve(layer);
    if (!source) continue;
    if (drawObjectRemovedLayer(context, layer, source, layerAlpha, resolve)) continue;
    if (drawMeshWarpedLayer(context, layer, source, layerAlpha)) continue;
    // The base blends into the trail; overlays paint normally on top of it.
    const drawPass = (mask: FrameLayer["mask"], alpha: number) => {
      if (layer.quad) {
        drawProjectedBox(context, layer.box, layer.quad, () => {
          const flatLayer = { ...layer, quad: undefined, rotation: 0, mask };
          context.save();
          context.globalAlpha = alpha;
          context.globalCompositeOperation = flatLayer.blend;
          context.filter = flatLayer.filter;
          applyLayerMask(context, flatLayer);
          source.draw(context, flatLayer.box.x, flatLayer.box.y, flatLayer.box.width, flatLayer.box.height);
          context.restore();
        });
        return;
      }
      context.save();
      context.globalAlpha = alpha;
      context.globalCompositeOperation = layer.blend;
      context.filter = layer.filter;
      if (layer.rotation || layer.flipH || layer.flipV) {
        // Transform the source and its subject contour together.
        const cx = layer.box.x + layer.box.width / 2;
        const cy = layer.box.y + layer.box.height / 2;
        context.translate(cx, cy);
        if (layer.rotation) context.rotate((layer.rotation * Math.PI) / 180);
        if (layer.flipH || layer.flipV) context.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
        context.translate(-cx, -cy);
      }
      applyLayerMask(context, mask === layer.mask ? layer : { ...layer, mask });
      source.draw(context, layer.box.x, layer.box.y, layer.box.width, layer.box.height);
      context.restore();
    };
    if (!drawSoftRotoLayer(context, layer, source, layerAlpha)) drawPass(layer.mask, layerAlpha);
  }

  if (plan.strobeLight) paintSpatialStrobe(context, plan.strobeLight, width, height);

  if (plan.flash > 0) {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = plan.flash;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.restore();
  }
}
