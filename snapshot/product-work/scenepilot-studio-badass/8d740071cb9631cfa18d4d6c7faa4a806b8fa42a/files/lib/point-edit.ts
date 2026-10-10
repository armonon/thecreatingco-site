// Three- and four-point editing — the Premiere source/timeline in-out workflow.
// You mark points on the source (in/out) and on the timeline (in/out); with any
// three, the fourth is derived. When all four are set and the two spans differ,
// the clip is retimed to fill the timeline exactly ("fit to fill"). Pure and
// deterministic; the caller drops the resulting cut in with placeBaseCut().

import type { BaseCut } from "./sequencer.ts";
import { sliceTransformKeyframes } from "./keyframes.ts";

export type EditPoints = {
  /** Source in-point, seconds into the asset. */
  sourceIn: number;
  /** Source out-point. Omit for a 3-point edit driven by the timeline duration. */
  sourceOut?: number;
  /** Where the clip lands on the timeline, seconds. */
  timelineIn: number;
  /** Timeline out-point. Omit for a 3-point edit driven by the source duration. */
  timelineOut?: number;
};

export type EditClipPlan = {
  start: number;
  sourceStart: number;
  /** Timeline length of the placed clip, seconds. */
  duration: number;
  playbackRate: number;
  /** True when a 4-point edit changed speed to make the source fill the range. */
  fitToFill: boolean;
};

const MIN_SPAN = 0.02;
const RATE_MIN = 0.1;
const RATE_MAX = 8;

/**
 * Resolve source/timeline in-out points into a placement plan, or null if the
 * points don't describe a valid edit (need a duration from one side, and every
 * span must be positive). A 4-point edit whose spans differ retimes to fit.
 */
export function planPointEdit(points: EditPoints): EditClipPlan | null {
  const { sourceIn, sourceOut, timelineIn, timelineOut } = points;
  if (!Number.isFinite(sourceIn) || sourceIn < 0) return null;
  if (!Number.isFinite(timelineIn) || timelineIn < 0) return null;

  const haveSource = Number.isFinite(sourceOut) && (sourceOut as number) - sourceIn >= MIN_SPAN;
  const haveTimeline = Number.isFinite(timelineOut) && (timelineOut as number) - timelineIn >= MIN_SPAN;

  // 3-point: source span drives the timeline duration.
  if (haveSource && !haveTimeline) {
    const duration = (sourceOut as number) - sourceIn;
    return { start: timelineIn, sourceStart: sourceIn, duration, playbackRate: 1, fitToFill: false };
  }
  // 3-point: timeline span drives it, playing from the source in-point at 1×.
  if (!haveSource && haveTimeline) {
    const duration = (timelineOut as number) - timelineIn;
    return { start: timelineIn, sourceStart: sourceIn, duration, playbackRate: 1, fitToFill: false };
  }
  // 4-point: both spans known. Match speed to fill the timeline range exactly.
  if (haveSource && haveTimeline) {
    const sourceSpan = (sourceOut as number) - sourceIn;
    const timelineSpan = (timelineOut as number) - timelineIn;
    const rawRate = sourceSpan / timelineSpan;
    if (rawRate < RATE_MIN || rawRate > RATE_MAX) return null;
    const rate = rawRate;
    const fitToFill = Math.abs(rawRate - 1) > 1e-3;
    return { start: timelineIn, sourceStart: sourceIn, duration: timelineSpan, playbackRate: rate, fitToFill };
  }
  return null;
}

/**
 * Build a placeable cut from a template clip (its look/effects are kept) and a
 * set of edit points. Transform keyframes are re-sliced to the new source span.
 */
export function buildPointEditCut(template: BaseCut, points: EditPoints, newId: string): BaseCut | null {
  const plan = planPointEdit(points);
  if (!plan) return null;
  return {
    ...template,
    id: newId,
    start: plan.start,
    sourceStart: plan.sourceStart,
    duration: plan.duration,
    playbackRate: plan.playbackRate,
    transformKeyframes: sliceTransformKeyframes(template.transformKeyframes, 0, plan.duration, newId),
    // A fit-to-fill retime invalidates the old cut-boundary transition timing.
    transitionType: plan.fitToFill ? undefined : template.transitionType,
    transitionDuration: plan.fitToFill ? undefined : template.transitionDuration,
  };
}
