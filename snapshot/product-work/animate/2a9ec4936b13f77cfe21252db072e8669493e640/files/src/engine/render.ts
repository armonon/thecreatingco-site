/**
 * Composites a project at a given frame onto a 2D canvas context: background,
 * then each visible layer (reference media or drawn cel) with its tweened
 * transform/opacity applied. Shared by the live canvas, playback, and every
 * exporter so "what you see" and "what you export" are the same code path.
 *
 * Each layer is first rendered into its own offscreen canvas (cached per
 * layer id) so the eraser's `destination-out` compositing only clears that
 * layer's own pixels, never the layers underneath — then the layer canvas is
 * drawn onto the shared context with its tweened transform/opacity.
 */
import { celAtFrame, type Layer } from "./layers";
import { renderStroke, type Stroke } from "./stroke";
import { transformAtFrame } from "./tween";
import type { Project } from "./project";

const imageCache = new Map<string, HTMLImageElement>();

function getImage(src: string): HTMLImageElement | null {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img.complete ? img : null;
}

/** Reference <video> elements, registered by the Studio page so playback position can drive export too. */
export const videoElements = new Map<string, HTMLVideoElement>();
const videoSources = new Map<string, string>();

function releaseReferenceVideo(id: string): void {
  const video = videoElements.get(id);
  const src = videoSources.get(id);
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    videoElements.delete(id);
  }
  videoSources.delete(id);
  if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
}

/** Keep renderer video resources aligned with project state, including every load path. */
export function syncReferenceVideos(layers: Layer[]): void {
  const wanted = new Map(
    layers
      .filter((layer) => layer.kind === "reference" && layer.referenceKind === "video" && layer.referenceSrc)
      .map((layer) => [layer.id, layer.referenceSrc!] as const),
  );
  for (const [id, src] of videoSources) {
    if (wanted.get(id) !== src) releaseReferenceVideo(id);
  }
  for (const [id, src] of wanted) {
    if (videoSources.get(id) === src && videoElements.has(id)) continue;
    const video = document.createElement("video");
    video.src = src;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => {});
    videoSources.set(id, src);
    videoElements.set(id, video);
  }
}

/** Release every registered media element when Studio unmounts. */
export function clearReferenceVideos(): void {
  for (const id of [...videoSources.keys()]) releaseReferenceVideo(id);
}

const layerCanvases = new Map<string, HTMLCanvasElement>();
function getLayerCanvas(id: string, width: number, height: number): HTMLCanvasElement {
  let c = layerCanvases.get(id);
  if (!c || c.width !== width || c.height !== height) {
    c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    layerCanvases.set(id, c);
  }
  return c;
}

export function dropLayerCanvas(id: string): void {
  layerCanvases.delete(id);
}

function renderLayerContent(ctx: CanvasRenderingContext2D, layer: Layer, project: Project, frame: number): void {
  if (layer.kind === "reference" && layer.referenceSrc) {
    if (layer.referenceKind === "image") {
      const img = getImage(layer.referenceSrc);
      if (img) ctx.drawImage(img, 0, 0, project.width, project.height);
    } else if (layer.referenceKind === "video") {
      const el = videoElements.get(layer.id);
      if (el && el.readyState >= 2) ctx.drawImage(el, 0, 0, project.width, project.height);
    }
    return;
  }
  const cel = celAtFrame(layer, frame);
  if (!cel) return;
  if (cel.fillDataUrl) {
    const img = getImage(cel.fillDataUrl);
    if (img) ctx.drawImage(img, 0, 0, project.width, project.height);
  }
  for (const stroke of cel.strokes) renderStroke(ctx, stroke);
}

export interface ActiveStrokePreview {
  layerId: string;
  stroke: Stroke;
}

export interface RenderOptions {
  onionSkin?: Array<{ frame: number; opacity: number }>;
  /** An in-progress stroke (not yet committed to state) to preview on its layer. */
  activeStroke?: ActiveStrokePreview;
}

export function renderFrame(ctx: CanvasRenderingContext2D, project: Project, frame: number, opts: RenderOptions = {}): void {
  const { width, height } = project;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = project.background;
  ctx.fillRect(0, 0, width, height);

  for (const ghost of opts.onionSkin ?? []) {
    ctx.save();
    ctx.globalAlpha = ghost.opacity;
    for (const layer of project.layers) {
      if (!layer.visible || layer.kind === "reference") continue;
      drawLayer(ctx, layer, project, ghost.frame);
    }
    ctx.restore();
  }

  for (const layer of project.layers) {
    if (!layer.visible) continue;
    drawLayer(ctx, layer, project, frame, opts.activeStroke?.layerId === layer.id ? opts.activeStroke.stroke : undefined);
  }
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, project: Project, frame: number, preview?: Stroke): void {
  const canvas = getLayerCanvas(layer.id, project.width, project.height);
  const lctx = canvas.getContext("2d")!;
  lctx.clearRect(0, 0, project.width, project.height);
  renderLayerContent(lctx, layer, project, frame);
  if (preview) renderStroke(lctx, preview);

  const t = transformAtFrame(layer.tweens, layer.transform, frame);
  ctx.save();
  ctx.globalAlpha *= t.opacity;
  ctx.translate(project.width / 2 + t.x, project.height / 2 + t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scaleX, t.scaleY);
  ctx.translate(-project.width / 2, -project.height / 2);
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
}

/** Renders one frame to a brand-new canvas (used by exporters so output isn't tied to the live view size). */
export function renderFrameToCanvas(project: Project, frame: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext("2d")!;
  renderFrame(ctx, project, frame);
  return canvas;
}
