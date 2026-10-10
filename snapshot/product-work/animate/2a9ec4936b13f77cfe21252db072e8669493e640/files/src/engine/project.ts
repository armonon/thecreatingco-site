/**
 * Project model + .animate save/load. A project is plain JSON (strokes,
 * cels, tween keyframes, timeline settings); reference image/video sources
 * are embedded as data URLs so a .animate file is fully self-contained and
 * portable (no external asset references to go stale).
 */
import { newLayer, type Layer } from "./layers";
import { defaultTimeline, type TimelineState } from "./timeline";
import { easingIds } from "./easing";

export const ANIMATE_FILE_VERSION = 1;

export interface Project {
  version: number;
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  layers: Layer[];
  timeline: TimelineState;
  createdAt: number;
  updatedAt: number;
}

export function newProject(name = "Untitled"): Project {
  const now = Date.now();
  return {
    version: ANIMATE_FILE_VERSION,
    id: `p${now.toString(36)}`,
    name,
    width: 960,
    height: 540,
    background: "#ffffff",
    layers: [newLayer("Layer 1")],
    timeline: defaultTimeline(3),
    createdAt: now,
    updatedAt: now,
  };
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Serializes a project to a JSON string, inlining any blob: reference sources as data URLs. */
export async function serializeProject(project: Project): Promise<string> {
  const layers = await Promise.all(
    project.layers.map(async (layer) => {
      if (layer.referenceSrc?.startsWith("blob:")) {
        return { ...layer, referenceSrc: await blobUrlToDataUrl(layer.referenceSrc) };
      }
      return layer;
    }),
  );
  return JSON.stringify({ ...project, layers, updatedAt: Date.now() });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;
const tweenProps = ["x", "y", "scaleX", "scaleY", "rotation", "opacity"] as const;
function isValidProject(value: unknown): value is Project {
  if (!isRecord(value) || value.version !== ANIMATE_FILE_VERSION) return false;
  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.background !== "string") return false;
  if (!isFiniteNumber(value.createdAt) || !isFiniteNumber(value.updatedAt)) return false;
  if (!isFiniteNumber(value.width) || value.width <= 0 || !Number.isInteger(value.width)) return false;
  if (!isFiniteNumber(value.height) || value.height <= 0 || !Number.isInteger(value.height)) return false;
  if (!Array.isArray(value.layers) || value.layers.length === 0 || !isRecord(value.timeline)) return false;

  const t = value.timeline;
  if (!isNonNegativeInteger(t.frameCount) || t.frameCount < 1 || !isNonNegativeInteger(t.currentFrame) || t.currentFrame >= t.frameCount) return false;
  if (t.fps !== 12 && t.fps !== 24 && t.fps !== 30) return false;
  if (typeof t.loop !== "boolean" || !isRecord(t.onionSkin)) return false;
  const onion = t.onionSkin;
  if (typeof onion.enabled !== "boolean" || !isNonNegativeInteger(onion.prev) || !isNonNegativeInteger(onion.next)) return false;
  if (!isFiniteNumber(onion.opacity) || onion.opacity < 0 || onion.opacity > 1) return false;

  return value.layers.every((layer) => {
    if (!isRecord(layer) || typeof layer.id !== "string" || typeof layer.name !== "string") return false;
    if (layer.kind !== "draw" && layer.kind !== "reference") return false;
    if (typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean") return false;
    if (!isRecord(layer.transform) || !isRecord(layer.tweens) || !isRecord(layer.cels)) return false;
    for (const key of ["x", "y", "scaleX", "scaleY", "rotation", "opacity"] as const) {
      if (!isFiniteNumber(layer.transform[key])) return false;
    }
    for (const [prop, track] of Object.entries(layer.tweens)) {
      if (!(tweenProps as readonly string[]).includes(prop) || !Array.isArray(track)) return false;
      if (!track.every((kf) => isRecord(kf) && isNonNegativeInteger(kf.frame) && isFiniteNumber(kf.value) && typeof kf.easing === "string" && easingIds.includes(kf.easing as (typeof easingIds)[number]))) return false;
    }
    for (const [frame, cel] of Object.entries(layer.cels)) {
      if (!/^\d+$/.test(frame) || !isRecord(cel) || !Array.isArray(cel.strokes)) return false;
      if (cel.fillDataUrl !== undefined && typeof cel.fillDataUrl !== "string") return false;
      if (!cel.strokes.every((stroke) => {
        if (!isRecord(stroke) || typeof stroke.id !== "string" || typeof stroke.color !== "string") return false;
        if (!isFiniteNumber(stroke.baseWidth) || !Array.isArray(stroke.points)) return false;
        if (stroke.erase !== undefined && typeof stroke.erase !== "boolean") return false;
        return stroke.points.every((point) => isRecord(point) && isFiniteNumber(point.x) && isFiniteNumber(point.y) && isFiniteNumber(point.pressure));
      })) return false;
    }
    if (layer.kind === "reference") {
      if (typeof layer.referenceSrc !== "string" || (layer.referenceKind !== "image" && layer.referenceKind !== "video")) return false;
    }
    return true;
  });
}

export function deserializeProject(json: string): Project {
  const parsed: unknown = JSON.parse(json);
  if (!isValidProject(parsed)) {
    throw new Error("That file doesn't look like an Animate project.");
  }
  return parsed;
}

export function projectFileName(project: Project): string {
  const safe = project.name.trim().replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-") || "untitled";
  return `${safe}.animate`;
}
