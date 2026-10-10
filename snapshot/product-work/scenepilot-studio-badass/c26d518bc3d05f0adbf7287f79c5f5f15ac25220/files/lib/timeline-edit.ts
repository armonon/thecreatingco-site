import type { BaseCut } from "./sequencer";
import { sliceTransformKeyframes } from "./keyframes.ts";
import { clipPlaybackRate } from "./pro-editor.ts";
import { sliceTimeRemap } from "./time-remap.ts";

export type TimelineEditMode = "overwrite" | "insert" | "ripple";

const endOf = (cut: BaseCut) => cut.start + cut.duration;
const sortCuts = (cuts: BaseCut[]) => [...cuts].sort((a, b) => a.start - b.start);

/**
 * The source-in for a piece [localStart, localEnd] of `cut` — the analogue of
 * how razorCut anchors reversed/remapped splits. Forward footage advances into
 * the source; a reversed clip anchors from the source-out (so the piece nearer
 * the clip end keeps the original source-in); a time-remapped clip carries a
 * sliced remap and its `sourceStart` is irrelevant.
 */
const pieceSourceStart = (cut: BaseCut, localStart: number, localEnd: number) => {
  const rate = clipPlaybackRate(cut);
  if (cut.reversed) return cut.sourceStart + (cut.duration - localEnd) * rate;
  return cut.sourceStart + localStart * rate;
};

function overwriteExisting(cuts: BaseCut[], incoming: BaseCut) {
  const incomingEnd = endOf(incoming);
  const usedIds = new Set([...cuts.map((cut) => cut.id), incoming.id]);
  return cuts.flatMap((cut) => {
    const cutEnd = endOf(cut);
    if (cutEnd <= incoming.start || cut.start >= incomingEnd) return [cut];
    const remnants: BaseCut[] = [];
    if (cut.start < incoming.start) {
      const remnantDuration = incoming.start - cut.start;
      remnants.push({
        ...cut,
        sourceStart: pieceSourceStart(cut, 0, remnantDuration),
        duration: remnantDuration,
        fadeOut: 0,
        transformKeyframes: sliceTransformKeyframes(cut.transformKeyframes, 0, remnantDuration, `${cut.id}-head`),
        timeRemap: sliceTimeRemap(cut.timeRemap, 0, remnantDuration, `${cut.id}-head`),
      });
    }
    if (cutEnd > incomingEnd) {
      const removedFromHead = incomingEnd - cut.start;
      let tailId = `${cut.id}-tail`;
      while (usedIds.has(tailId)) tailId += "-tail";
      usedIds.add(tailId);
      remnants.push({
        ...cut,
        id: tailId,
        start: incomingEnd,
        sourceStart: pieceSourceStart(cut, removedFromHead, cut.duration),
        duration: cutEnd - incomingEnd,
        fadeIn: 0,
        transitionType: undefined,
        transitionDuration: undefined,
        transformKeyframes: sliceTransformKeyframes(cut.transformKeyframes, removedFromHead, cut.duration, tailId),
        timeRemap: sliceTimeRemap(cut.timeRemap, removedFromHead, cut.duration, tailId),
      });
    }
    return remnants;
  });
}

/**
 * Apply a professional timeline placement without silently deleting complete
 * overlapping clips. Overwrite preserves visible remnants, insert makes room,
 * and ripple closes the moved clip's old gap before inserting it.
 */
export function placeBaseCut(
  cuts: BaseCut[],
  incoming: BaseCut,
  mode: TimelineEditMode,
  movingId?: string,
) {
  const moving = movingId ? cuts.find((cut) => cut.id === movingId) : undefined;
  let remaining = cuts.filter((cut) => cut.id !== movingId);
  const placed = { ...incoming };

  if (mode === "ripple" && moving) {
    const oldEnd = endOf(moving);
    remaining = remaining.map((cut) => cut.start >= oldEnd
      ? { ...cut, start: cut.start - moving.duration }
      : cut);
    if (placed.start > moving.start) placed.start = Math.max(0, placed.start - moving.duration);
  }

  if (mode === "insert" || mode === "ripple") {
    // A zero-width overwrite splits a crossing clip without removing footage.
    // Move the right piece with the later clips, making a genuine insert gap.
    remaining = overwriteExisting(remaining, { ...placed, duration: 0 }).map((cut) => cut.start >= placed.start
      ? { ...cut, start: cut.start + placed.duration }
      : cut);
  } else {
    remaining = overwriteExisting(remaining, placed);
  }

  return sortCuts([...remaining, placed]);
}

/**
 * Remove a clip and close the gap it left — everything to its right slides left
 * by its duration (the standard "ripple delete"). A plain filter would leave a
 * hole; this keeps the edit tight.
 */
export function rippleDelete(cuts: BaseCut[], id: string): BaseCut[] {
  const target = cuts.find((cut) => cut.id === id);
  if (!target) return cuts;
  return sortCuts(
    cuts
      .filter((cut) => cut.id !== id)
      .map((cut) => (cut.start >= endOf(target) - 1e-6 ? { ...cut, start: Math.max(0, cut.start - target.duration) } : cut)),
  );
}

/**
 * Duplicate a clip, dropping the copy right after the original and pushing the
 * rest of the timeline over to make room (ripple-insert).
 */
export function duplicateCut(cuts: BaseCut[], id: string, newId: string): BaseCut[] {
  const target = cuts.find((cut) => cut.id === id);
  if (!target) return cuts;
  return placeBaseCut(cuts, {
    ...target,
    id: newId,
    start: endOf(target),
    transformKeyframes: target.transformKeyframes?.map((keyframe) => ({ ...keyframe, id: `${newId}-${keyframe.id}` })),
  }, "insert");
}

export type TimelineGap = { start: number; end: number; duration: number };

export function detectTimelineGaps(cuts: BaseCut[], startAt = 0): TimelineGap[] {
  const ordered = sortCuts(cuts);
  const gaps: TimelineGap[] = [];
  let cursor = Math.max(0, startAt);
  for (const cut of ordered) {
    if (cut.start > cursor + 1e-6) gaps.push({ start: cursor, end: cut.start, duration: cut.start - cursor });
    cursor = Math.max(cursor, endOf(cut));
  }
  return gaps;
}

/** Close every empty interval while preserving clip order and duration. */
export function removeTimelineGaps(cuts: BaseCut[], startAt = 0): BaseCut[] {
  let cursor = Math.max(0, startAt);
  return sortCuts(cuts).map((cut) => {
    const next = { ...cut, start: cursor };
    cursor += cut.duration;
    return next;
  });
}

/** Lift leaves time behind; extract removes an in/out range and closes it. */
export function extractRange(cuts: BaseCut[], rangeStart: number, rangeEnd: number): BaseCut[] {
  const start = Math.max(0, Math.min(rangeStart, rangeEnd));
  const end = Math.max(start, Math.max(rangeStart, rangeEnd));
  const removedDuration = end - start;
  if (removedDuration <= 1e-6) return sortCuts(cuts);
  const sliced = cuts.flatMap((cut) => {
    const cutEnd = endOf(cut);
    if (cutEnd <= start) return [cut];
    if (cut.start >= end) return [{ ...cut, start: cut.start - removedDuration }];
    const pieces: BaseCut[] = [];
    if (cut.start < start) {
      const duration = start - cut.start;
      pieces.push({
        ...cut,
        sourceStart: pieceSourceStart(cut, 0, duration),
        duration,
        fadeOut: 0,
        transformKeyframes: sliceTransformKeyframes(cut.transformKeyframes, 0, duration, `${cut.id}-extract-head`),
        timeRemap: sliceTimeRemap(cut.timeRemap, 0, duration, `${cut.id}-extract-head`),
      });
    }
    if (cutEnd > end) {
      const skipped = end - cut.start;
      const id = `${cut.id}-extract-tail`;
      pieces.push({
        ...cut,
        id,
        start,
        sourceStart: pieceSourceStart(cut, skipped, cut.duration),
        duration: cutEnd - end,
        fadeIn: 0,
        transitionType: undefined,
        transitionDuration: undefined,
        transformKeyframes: sliceTransformKeyframes(cut.transformKeyframes, skipped, cut.duration, id),
        timeRemap: sliceTimeRemap(cut.timeRemap, skipped, cut.duration, id),
      });
    }
    return pieces;
  });
  return sortCuts(sliced);
}

export function matchFrame(cuts: BaseCut[], timelineTime: number) {
  const cut = cuts.find((item) => timelineTime >= item.start && timelineTime < endOf(item));
  return cut ? { cutId: cut.id, assetId: cut.assetId, sourceTime: cut.sourceStart + (timelineTime - cut.start) * clipPlaybackRate(cut) } : null;
}

/** Replace a selected timeline clip while preserving the edit points. */
export function replaceEdit(target: BaseCut, assetId: string, sourceStart = 0, sourceDuration = Number.POSITIVE_INFINITY): BaseCut {
  const rate = clipPlaybackRate(target);
  const maximumSourceStart = Math.max(0, sourceDuration - target.duration * rate);
  return { ...target, assetId, sourceStart: Math.max(0, Math.min(maximumSourceStart, sourceStart)) };
}
