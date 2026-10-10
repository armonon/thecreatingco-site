import { useEffect, useRef, type RefObject } from "react";

/** Source shuttle never borrows the sequence clock. Reverse is frame-clocked
 * because HTML media does not support negative playbackRate consistently. */
export function useSourceTransport(mediaRef: RefObject<HTMLMediaElement | null>, identity: string, active: boolean, status: (message: string) => void) {
  const rate = useRef(0);
  const frame = useRef<number | null>(null);
  const generation = useRef(0);
  const stop = () => {
    generation.current++;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; rate.current = 0;
    const media = mediaRef.current;
    if (media) { media.pause(); media.playbackRate = 1; }
  };
  useEffect(() => {
    const media = mediaRef.current;
    const ended = () => { rate.current = 0; };
    media?.addEventListener("ended", ended);
    // Capture the old element too: React can detach its ref before cleanup.
    return () => {
      // This is a cancellation token, not a DOM ref: invalidate the latest run.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null; rate.current = 0;
      if (media) { media.removeEventListener("ended", ended); media.pause(); media.playbackRate = 1; }
    };
  }, [identity, active, mediaRef]);
  const shuttle = async (direction: -1 | 1) => {
    const media = mediaRef.current;
    if (!media || !active) return;
    const next = Math.sign(rate.current) === direction ? direction * Math.min(4, Math.abs(rate.current) * 2 || 1) : direction;
    stop(); rate.current = next;
    const token = generation.current;
    if (next > 0) {
      media.playbackRate = next;
      try { await media.play(); } catch (error) { if (generation.current === token) { stop(); status(`Source playback failed: ${error instanceof Error ? error.message : String(error)}`); } return; }
      if (generation.current !== token) return;
    } else {
      let previous = performance.now();
      const tick = (now: number) => {
        if (generation.current !== token) return;
        media.currentTime = Math.max(0, media.currentTime + (now - previous) / 1000 * next);
        previous = now;
        if (media.currentTime <= 0) { stop(); return; }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    }
    status(`Source ${next < 0 ? "reverse" : "forward"} shuttle · ${Math.abs(next)}×`);
  };
  const toggle = async () => {
    const media = mediaRef.current;
    if (!media || !active) return;
    const wasPlaying = !media.paused || rate.current !== 0;
    stop();
    if (!wasPlaying) {
      try { await media.play(); } catch (error) { status(`Source playback failed: ${error instanceof Error ? error.message : String(error)}`); }
    }
  };
  return { stop, shuttle, toggle };
}
