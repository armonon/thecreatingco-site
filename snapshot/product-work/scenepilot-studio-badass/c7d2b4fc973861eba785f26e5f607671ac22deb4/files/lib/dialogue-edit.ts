import type { CaptionCue } from "./captions.ts";

export type SilenceRange = { start: number; end: number; duration: number };

export function timeAfterRemovingRanges(time: number, ranges: SilenceRange[]) {
  let removed = 0;
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (time >= range.end) removed += range.duration;
    else if (time > range.start) return Math.max(0, range.start - removed);
  }
  return Math.max(0, time - removed);
}

export function compactTimelineTimes(times: number[], ranges: SilenceRange[]) {
  return times
    .filter((time) => !ranges.some((range) => time > range.start && time < range.end))
    .map((time) => timeAfterRemovingRanges(time, ranges));
}

/** Find removable dialogue gaps while preserving configurable handles around
 * every spoken phrase. */
export function dialogueSilences(cues: CaptionCue[], duration: number, minimumSilence = 0.65, handle = 0.12): SilenceRange[] {
  const ordered = [...cues].filter((cue) => cue.end > cue.start).sort((a, b) => a.start - b.start);
  if (!ordered.length) return [];
  const gaps: SilenceRange[] = [];
  let cursor = 0;
  for (const cue of ordered) {
    const end = Math.max(cursor, cue.start - handle);
    if (end - cursor >= minimumSilence) gaps.push({ start: cursor, end, duration: end - cursor });
    cursor = Math.max(cursor, Math.min(duration, cue.end + handle));
  }
  if (duration - cursor >= minimumSilence) gaps.push({ start: cursor, end: duration, duration: duration - cursor });
  return gaps;
}

export type SocialDelivery = { id: string; label: string; aspect: "16:9" | "9:16" | "1:1" | "4:5"; start: number; end: number };

export function bestHighlightWindow(duration: number, highlightTimes: number[] = [], windowDuration = 30) {
  const length = Math.max(.05, Math.min(windowDuration, duration));
  if (!highlightTimes.length) return { start: Math.max(0, (duration - length) / 2), end: Math.min(duration, (duration + length) / 2), score: 0 };
  const candidates = highlightTimes.map((time) => Math.max(0, Math.min(duration - length, time - length / 2)));
  return candidates.map((start) => {
    const end = start + length;
    const hits = highlightTimes.filter((time) => time >= start && time <= end);
    const density = hits.length / Math.max(1, highlightTimes.length);
    const center = start + length / 2;
    const cohesion = hits.length ? hits.reduce((sum, time) => sum + (1 - Math.min(1, Math.abs(time - center) / (length / 2))) / hits.length, 0) : 0;
    return { start, end, score: density * .7 + cohesion * .3 };
  }).sort((a, b) => b.score - a.score || a.start - b.start)[0];
}

export function socialDeliveryPlan(duration: number, highlightTimes: number[] = []): SocialDelivery[] {
  const highlight = bestHighlightWindow(duration, highlightTimes, 30);
  const start = highlight.start;
  const shortDuration = highlight.end - highlight.start;
  return [
    { id: "master", label: "Master landscape", aspect: "16:9", start: 0, end: duration },
    { id: "reel", label: "Vertical highlight", aspect: "9:16", start, end: start + shortDuration },
    { id: "square", label: "Square social", aspect: "1:1", start, end: start + shortDuration },
    { id: "feed", label: "Portrait feed", aspect: "4:5", start, end: start + shortDuration },
  ];
}

export function extractTimedRanges<T extends { id: string; start: number; duration: number; sourceStart?: number; playbackRate?: number }>(items: T[], ranges: SilenceRange[], slice?: (item: T, from: number, to: number, id: string) => T): T[] {
  let result = [...items];
  for (const range of [...ranges].sort((a, b) => b.start - a.start)) {
    const removed = range.end - range.start;
    result = result.flatMap((item) => {
      const itemEnd = item.start + item.duration;
      if (itemEnd <= range.start) return [item];
      if (item.start >= range.end) return [{ ...item, start: item.start - removed }];
      const pieces: T[] = [];
      if (item.start < range.start) pieces.push(slice ? slice(item, 0, range.start - item.start, item.id) : { ...item, duration: range.start - item.start });
      if (itemEnd > range.end) {
        const skipped = range.end - item.start;
        pieces.push({
          ...(slice ? slice(item, skipped, item.duration, `${item.id}-dialogue-tail-${Math.round(range.end * 1000)}`) : item),
          id: `${item.id}-dialogue-tail-${Math.round(range.end * 1000)}`,
          start: range.start,
          duration: itemEnd - range.end,
          sourceStart: (item.sourceStart ?? 0) + skipped * Math.max(0.1, item.playbackRate ?? 1),
        });
      }
      return pieces;
    });
  }
  return result.sort((a, b) => a.start - b.start);
}
