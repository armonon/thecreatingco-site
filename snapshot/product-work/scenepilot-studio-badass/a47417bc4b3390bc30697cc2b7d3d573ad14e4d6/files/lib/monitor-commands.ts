import { snapToFrame } from "./format.ts";

type SourceRange = { inPoint: number; outPoint: number | null };
type TimelineRange = { inPoint: number | null; outPoint: number | null };
type Context = {
  target: "source" | "composition" | "program";
  sourceTime: number; sourceDuration: number; compositionTime: number; compositionDuration: number;
  currentTime: number; duration: number; fps: number;
  setSourceRange(update: (range: SourceRange) => SourceRange): void;
  setTimelineRange(update: (range: TimelineRange) => TimelineRange): void;
  seekSource(time: number): void; seekComposition(time: number): void; seek(time: number): void;
  onUnsupported(): void;
};

/** The monitor owns transport and marks, regardless of menu/shortcut origin. */
export function createMonitorCommands(context: Context) {
  return {
    markMonitorBoundary(boundary: "in" | "out") {
      if (context.target === "composition") { context.onUnsupported(); return; }
      if (context.target === "source") {
        context.setSourceRange((range) => {
          const end = Math.max(0, context.sourceDuration);
          const gap = Math.min(.05, end);
          const time = Math.max(0, Math.min(end, context.sourceTime));
          const out = Math.max(gap, Math.min(end, range.outPoint ?? end));
          const start = Math.max(0, Math.min(end - gap, range.inPoint));
          return boundary === "in"
            ? { ...range, inPoint: Math.max(0, Math.min(time, out - gap)) }
            : { ...range, outPoint: Math.min(end, Math.max(time, start + gap)) };
        });
      } else context.setTimelineRange((range) => ({ ...range, [boundary === "in" ? "inPoint" : "outPoint"]: context.currentTime }));
    },
    stepMonitorFrame(direction: -1 | 1, large = false) {
      const fps = Number.isFinite(context.fps) && context.fps > 0 ? context.fps : 30;
      const delta = direction * (large ? 1 : 1 / fps);
      const step = (time: number, duration: number) => Math.max(0, Math.min(duration, snapToFrame(time + delta, fps)));
      if (context.target === "source") context.seekSource(step(context.sourceTime, context.sourceDuration));
      else if (context.target === "composition") context.seekComposition(step(context.compositionTime, context.compositionDuration));
      else context.seek(step(context.currentTime, context.duration));
    },
  };
}
