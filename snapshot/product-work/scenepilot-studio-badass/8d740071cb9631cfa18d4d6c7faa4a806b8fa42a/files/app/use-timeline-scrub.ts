import { useEffect, useRef, type PointerEvent } from "react";
import { timelineScrubTime } from "../lib/timeline-scrub.ts";

type Options = {
  duration: number; frameRate: number;
  bounds(target: HTMLElement): { left: number; width: number } | undefined;
  onSeek(time: number): void; onStart(): void;
};

/** One pending preview per animation frame, with an exact final release position. */
export function useTimelineScrub(options: Options) {
  const drag = useRef<{ id: number; target: HTMLElement } | null>(null);
  const pending = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });
  const flush = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const time = pending.current; pending.current = null;
    if (time !== null) latest.current.onSeek(time);
  };
  const position = (event: PointerEvent<HTMLElement>) => {
    const bounds = options.bounds(event.currentTarget);
    return bounds ? timelineScrubTime(event.clientX, bounds.left, bounds.width, options.duration, options.frameRate) : null;
  };
  const finish = (event: PointerEvent<HTMLElement>, finalPosition: boolean) => {
    if (drag.current?.id !== event.pointerId) return;
    event.stopPropagation();
    if (finalPosition) pending.current = position(event) ?? pending.current;
    flush(); drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const active = drag.current;
    frame.current = null; pending.current = null; drag.current = null;
    if (active?.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
  }, []);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || event.isPrimary === false || drag.current) return;
      const time = position(event); if (time === null) return;
      event.preventDefault(); event.stopPropagation();
      options.onStart();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, target: event.currentTarget };
      latest.current = options;
      pending.current = time; flush();
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (drag.current?.id !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      pending.current = position(event) ?? pending.current;
      if (frame.current === null) frame.current = requestAnimationFrame(flush);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, true),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, false),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, false),
  };
}
