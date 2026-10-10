import { useEffect, useRef, type RefObject, type Dispatch, type SetStateAction } from "react";
import { advanceSequenceClock } from "../lib/sequence-clock.ts";
import { anchorAudioClock, audioClockPosition, resumeAudioClock, sharedAudioContext } from "../lib/shared-audio-clock.ts";
import type { StudioComposition } from "../lib/compositor";
import type { TimelineRange } from "../lib/pro-editor";
import type { Placement } from "./editor-foundation";
type Context = {
  videoRef: RefObject<HTMLMediaElement | null>; playing: boolean; setPlaying: Dispatch<SetStateAction<boolean>>;
  shuttleRate: number; setShuttleRate: Dispatch<SetStateAction<number>>;
  currentTime: number; compositionTime: number; frameRate: number;
  setCompositionTime: Dispatch<SetStateAction<number>>; setCurrentTime: Dispatch<SetStateAction<number>>;
  editorMode: "auto" | "pro"; workspaceView: "composition" | "sequence"; activeComposition: StudioComposition | undefined;
  mainUrl: string; placements: Placement[]; isPro: boolean; timelineRange: TimelineRange; duration: number; loopPlayback: boolean;
  setStatus(message: string): void;
};

function pauseSource(media: HTMLMediaElement | null) {
  if (media) { media.pause(); media.playbackRate = 1; }
}

/** One document clock. Source media follows it, never truncates it. */
export function useProgramTransport(c: Context) {
  const latest = useRef(c);
  const time = useRef(c.workspaceView === "composition" ? c.compositionTime : c.currentTime);
  const pendingPlay = useRef(false);
  const request = useRef(0);
  const preparing = useRef(false);
  useEffect(() => { latest.current = c; });
  // A prepared start belongs to one monitor/document and one mounted hook.
  useEffect(() => () => { request.current++; preparing.current = false; }, [c.workspaceView, c.activeComposition?.id, c.editorMode]);
  useEffect(() => {
    const next = c.workspaceView === "composition" ? c.compositionTime : c.currentTime;
    if (Math.abs(next - time.current) > 1e-6) {
      time.current = next;
      anchorAudioClock(next, c.playing, c.shuttleRate || 1, .035);
    }
  }, [c.currentTime, c.compositionTime, c.workspaceView, c.playing, c.shuttleRate]);

  useEffect(() => {
    anchorAudioClock(time.current, c.playing, c.shuttleRate || 1, .035);
    if (!c.playing) { c.videoRef.current?.pause(); return; }
    let frame = 0, previous = performance.now(), accumulated = 0;
    const tick = (now: number) => {
      const state = latest.current;
      accumulated += Math.max(0, (now - previous) / 1000); previous = now;
      if (accumulated < 1 / state.frameRate) { frame = requestAnimationFrame(tick); return; }
      const composition = state.editorMode === "pro" && state.workspaceView === "composition";
      const duration = composition ? state.activeComposition?.duration ?? 0 : state.duration;
      const start = !composition && state.isPro ? state.timelineRange.inPoint ?? 0 : 0;
      const end = !composition && state.isPro ? Math.min(duration, state.timelineRange.outPoint ?? duration) : duration;
      const rate = state.shuttleRate || 1;
      if (sharedAudioContext()) accumulated = Math.max(0, (audioClockPosition() - time.current) / rate);
      const next = advanceSequenceClock(time.current, accumulated, rate, Math.min(start, end), end, state.loopPlayback);
      if (next.stopped || Math.abs(next.time - audioClockPosition()) > .1) anchorAudioClock(next.time, !next.stopped, rate, .035);
      accumulated = 0; time.current = next.time;
      if (composition) state.setCompositionTime(next.time); else state.setCurrentTime(next.time);
      const media = state.videoRef.current;
      if (media && state.mainUrl) {
        const audible = !composition && rate > 0 && !next.stopped && next.time < media.duration;
        if (!audible) media.pause();
        else {
          if (Math.abs(media.currentTime - next.time) > .12) media.currentTime = next.time;
          media.playbackRate = rate;
          if (media.paused && !pendingPlay.current) {
            pendingPlay.current = true;
            void media.play().catch((error) => {
              if (error?.name !== "AbortError") { state.setPlaying(false); state.setShuttleRate(0); state.setStatus(`Playback failed: ${error instanceof Error ? error.message : String(error)}`); }
            }).finally(() => { pendingPlay.current = false; });
          }
        }
      }
      if (next.stopped) { state.setPlaying(false); state.setShuttleRate(0); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [c.playing, c.shuttleRate, c.workspaceView, c.activeComposition?.id, c.videoRef]);

  const stopShuttle = () => {
    request.current++; preparing.current = false;
    c.setShuttleRate(0); c.setPlaying(false);
    pauseSource(c.videoRef.current);
  };
  // Resume the shared clock; a failed source is reported but never blocks playback.
  const resumeTransport = async () => {
    const id = ++request.current;
    preparing.current = true;
    try {
      const { failed } = await resumeAudioClock();
      if (id !== request.current) return false;
      if (failed.length) latest.current.setStatus(`${failed.length} audio source${failed.length === 1 ? "" : "s"} couldn't load and will play silent. Relink or re-import to restore ${failed.length === 1 ? "it" : "them"}.`);
      return true;
    } catch (error) {
      if (id === request.current) latest.current.setStatus(`Playback failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      if (id === request.current) preparing.current = false;
    }
  };
  const togglePlayback = async () => {
    if (latest.current.playing || preparing.current) { stopShuttle(); return; }
    if (!await resumeTransport()) return;
    const c = latest.current;
    const composition = c.editorMode === "pro" && c.workspaceView === "composition";
    const end = composition ? c.activeComposition?.duration ?? 0 : c.timelineRange.outPoint ?? c.duration;
    const start = composition ? 0 : c.timelineRange.inPoint ?? 0;
    if (time.current >= end) {
      time.current = start;
      if (composition) c.setCompositionTime(start); else c.setCurrentTime(start);
    }
    c.setShuttleRate(0); c.setPlaying(true);
  };
  const shuttle = async (direction: -1 | 1) => {
    if (!await resumeTransport()) return;
    const c = latest.current;
    const rate = Math.sign(c.shuttleRate) === direction ? direction * Math.min(4, Math.abs(c.shuttleRate) * 2 || 1) : direction;
    c.setShuttleRate(rate); c.setPlaying(true);
    if (direction < 0) c.videoRef.current?.pause();
    c.setStatus(`${direction < 0 ? "Reverse" : "Forward"} shuttle · ${Math.abs(rate)}×`);
  };
  return { togglePlayback, shuttle, stopShuttle };
}
