import type { CSSProperties } from "react";
import type { useTimelineScrub } from "./use-timeline-scrub";

type Props = {
  className: string; label: string; time: number; duration: number; frameRate: number; text: string;
  scrub: ReturnType<typeof useTimelineScrub>; onSeek(time: number): void; onStart(): void;
};
export function TimelinePlayhead({ className, label, time, duration, frameRate, text, scrub, onSeek, onStart }: Props) {
  const ratio = Math.max(0, Math.min(1, time / Math.max(.01, duration)));
  return <div className={className} style={{ "--playhead-position": ratio } as CSSProperties}>
    <div className="playhead-hit-area" role="slider" tabIndex={0} aria-label={label} aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={time} aria-valuetext={text}
      title="Drag to scrub · arrow keys move one frame · Shift moves ten frames" {...scrub}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); onStart();
        const next = event.key === "Home" ? 0 : event.key === "End" ? duration : time + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1) / frameRate;
        onSeek(Math.max(0, Math.min(duration, Math.round(next * frameRate) / frameRate)));
      }}><i /><span>{text}</span></div>
  </div>;
}
