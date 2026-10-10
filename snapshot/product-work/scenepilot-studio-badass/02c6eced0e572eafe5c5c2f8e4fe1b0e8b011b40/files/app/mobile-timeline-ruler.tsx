import { useTimelineScrub } from "./use-timeline-scrub";
import { formatTime } from "../lib/format";

type Props = { duration: number; time: number; disabled: boolean; onSeek(time: number): void; onPause(): void };

/** Uses the same captured-pointer/frame-coalesced scrubbing as the desktop ruler. */
export function MobileTimelineRuler({ duration, time, disabled, onSeek, onPause }: Props) {
  const scrub = useTimelineScrub({ duration, frameRate: 30,
    bounds: target => disabled ? undefined : target.getBoundingClientRect(), onSeek, onStart: onPause });
  return <div className="ms-ruler" role="slider" aria-label="Timeline position" aria-disabled={disabled}
    aria-valuemin={0} aria-valuemax={duration} aria-valuenow={time} aria-valuetext={formatTime(time)}
    tabIndex={disabled ? -1 : 0} {...scrub} onKeyDown={event => {
      if (disabled) return;
      const offset = event.shiftKey ? 1 : 1 / 30;
      const next = event.key === "Home" ? 0 : event.key === "End" ? duration
        : event.key === "ArrowRight" || event.key === "ArrowUp" ? time + offset
        : event.key === "ArrowLeft" || event.key === "ArrowDown" ? time - offset : null;
      if (next === null) return;
      event.preventDefault(); event.stopPropagation(); onPause(); onSeek(Math.max(0, Math.min(duration, next)));
    }}>
    {[0, .25, .5, .75, 1].map(fraction => <span key={fraction}>{formatTime(duration * fraction)}</span>)}
    <i aria-hidden="true" style={{ left: `${Math.max(0, Math.min(100, time / Math.max(.01, duration) * 100))}%` }} />
  </div>;
}
