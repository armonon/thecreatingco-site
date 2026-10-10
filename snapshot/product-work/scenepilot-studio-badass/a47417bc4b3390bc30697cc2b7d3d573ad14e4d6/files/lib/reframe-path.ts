// Reframe's virtual camera path: turns a sparse sequence of detected subject
// centers (one face track, a kept-together pair, or a motion-saliency
// fallback) into a smooth crop path a human operator would plausibly pull —
// a dead zone so small jitter doesn't move the camera at all, a capped pan
// speed so it never whips, exponential-style easing for the motion that does
// happen, and a hard reset on a scene cut so a new shot starts framed on its
// own subject instead of swinging across the old one. Pure and DOM-free so it
// can run identically in analysis, preview and export.
export { detectSceneCuts } from "./autocut-clips.ts";

export type SubjectTarget = { time: number; x: number; y: number; weight?: number };
export type PathPoint = { time: number; x: number; y: number; cut: boolean };

export type PathOptions = {
  /** Fraction of frame width/height the subject can drift before the camera follows at all, 0..0.5. */
  deadZone?: number;
  /** Max camera movement per second, as a fraction of frame width/height, 0..2. */
  maxPanSpeed?: number;
  /** 0..1: how much of the remaining distance (beyond the dead zone) closes per update. Lower = lazier/smoother. */
  ease?: number;
  /** Scene cut times (seconds). A target at or after a cut snaps the camera straight there instead of panning. */
  cutTimes?: number[];
};

export const DEFAULT_PATH_OPTIONS: Required<Pick<PathOptions, "deadZone" | "maxPanSpeed" | "ease">> = {
  deadZone: 0.08,
  maxPanSpeed: 0.6,
  ease: 0.35,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** One axis of dead-zone + eased + speed-capped pursuit over `dt` seconds. */
function pursue(current: number, target: number, dt: number, deadZone: number, maxPanSpeed: number, ease: number): number {
  const raw = target - current;
  const sign = Math.sign(raw);
  const beyondDeadZone = sign * Math.max(0, Math.abs(raw) - deadZone);
  if (beyondDeadZone === 0) return current;
  const eased = beyondDeadZone * clamp01(ease);
  const maxStep = Math.max(0, maxPanSpeed) * Math.max(0, dt);
  const capped = Math.sign(eased) * Math.min(Math.abs(eased), maxStep);
  return current + capped;
}

/**
 * Build a smooth camera path from sparse subject targets (sorted by time).
 * Between two targets that straddle a scene cut, the path jumps directly to
 * the new target — no pan, no dead zone, no speed cap — because panning
 * across a hard cut reads as a whip-pan rather than a deliberate move.
 */
export function buildCameraPath(targets: SubjectTarget[], options: PathOptions = {}): PathPoint[] {
  if (!targets.length) return [];
  const { deadZone, maxPanSpeed, ease } = { ...DEFAULT_PATH_OPTIONS, ...options };
  const cuts = [...(options.cutTimes ?? [])].sort((a, b) => a - b);
  const sorted = [...targets].sort((a, b) => a.time - b.time);

  const path: PathPoint[] = [];
  let x = sorted[0].x;
  let y = sorted[0].y;
  let lastTime = sorted[0].time;
  let cutCursor = 0;

  sorted.forEach((target, index) => {
    const dt = Math.max(0, target.time - lastTime);
    let crossedCut = false;
    while (cutCursor < cuts.length && cuts[cutCursor] <= target.time + 1e-9) {
      if (cuts[cutCursor] > lastTime - 1e-9) crossedCut = true;
      cutCursor++;
    }
    const isFirst = index === 0;
    if (crossedCut && !isFirst) {
      x = target.x;
      y = target.y;
    } else if (!isFirst) {
      x = pursue(x, target.x, dt, deadZone, maxPanSpeed, ease);
      y = pursue(y, target.y, dt, deadZone, maxPanSpeed, ease);
    }
    path.push({ time: target.time, x: clamp01(x), y: clamp01(y), cut: crossedCut && !isFirst });
    lastTime = target.time;
  });
  return path;
}

/** The path's position at an arbitrary time, holding at the ends and never interpolating across a cut's hard edge. */
export function pathAt(path: PathPoint[], time: number): { x: number; y: number } {
  if (!path.length) return { x: 0.5, y: 0.5 };
  if (time <= path[0].time) return { x: path[0].x, y: path[0].y };
  const last = path[path.length - 1];
  if (time >= last.time) return { x: last.x, y: last.y };
  for (let i = 1; i < path.length; i++) {
    if (path[i].time < time) continue;
    const a = path[i - 1];
    const b = path[i];
    if (b.cut) return time < b.time ? { x: a.x, y: a.y } : { x: b.x, y: b.y };
    const f = (time - a.time) / Math.max(1e-6, b.time - a.time);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  return { x: last.x, y: last.y };
}

/**
 * Apply manual keyframe overrides (from a user dragging the timeline) on top
 * of the automatic path: each override pins the path exactly at that time,
 * and automatic points within `snapWindow` seconds of an override are dropped
 * so the pin doesn't get immediately re-smoothed away.
 */
export function applyManualOverrides(path: PathPoint[], overrides: SubjectTarget[], snapWindow = 0.15): PathPoint[] {
  if (!overrides.length) return path;
  const pins = [...overrides].sort((a, b) => a.time - b.time);
  const kept = path.filter((point) => !pins.some((pin) => Math.abs(pin.time - point.time) <= snapWindow));
  const pinned: PathPoint[] = pins.map((pin) => ({ time: pin.time, x: clamp01(pin.x), y: clamp01(pin.y), cut: true }));
  return [...kept, ...pinned].sort((a, b) => a.time - b.time);
}
