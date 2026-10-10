import { useCallback, useMemo, useReducer, type SetStateAction } from "react";
import { splitUnifiedTimeline, toUnifiedTimeline, type VideoClip } from "../lib/video-timeline.ts";
import type { BaseCut } from "../lib/sequencer.ts";
import type { AudioClip } from "../lib/pro-editor.ts";
import type { Placement } from "./editor-foundation.ts";

export type SequenceState = { duration: number; videoClips: VideoClip[]; audioClips: AudioClip[] };
const UNIFIED_BASE_TRACK = "__base__";
type Action = { kind: "duration"; value: SetStateAction<number> } | { kind: "video"; value: SetStateAction<VideoClip[]> } | { kind: "audio"; value: SetStateAction<AudioClip[]> } | { kind: "base"; value: SetStateAction<BaseCut[]> } | { kind: "overlay"; value: SetStateAction<Placement[]> };
const resolve = <T,>(value: SetStateAction<T>, previous: T): T => typeof value === "function" ? (value as (previous: T) => T)(previous) : value;
const endOf = (clips: Array<{ start: number; duration: number }>) => clips.reduce((end, clip) => Number.isFinite(clip.start + clip.duration) ? Math.max(end, clip.start + clip.duration) : end, 0);

/** Duration growth and the edit are one reducer transaction, including undo. */
export function sequenceTimelineReducer(state: SequenceState, action: Action): SequenceState {
  if (action.kind === "duration") return { ...state, duration: resolve(action.value, state.duration) };
  if (action.kind === "audio") {
    const audioClips = resolve(action.value, state.audioClips);
    return { ...state, audioClips, duration: Math.max(state.duration, endOf(audioClips)) };
  }
  let videoClips: VideoClip[];
  if (action.kind === "video") videoClips = resolve(action.value, state.videoClips);
  else {
    const { baseCuts, placements } = splitUnifiedTimeline(state.videoClips);
    videoClips = action.kind === "base"
      ? toUnifiedTimeline(resolve(action.value, baseCuts), placements, UNIFIED_BASE_TRACK)
      : toUnifiedTimeline(baseCuts, resolve(action.value, placements as Placement[]), UNIFIED_BASE_TRACK);
  }
  return { ...state, videoClips, duration: Math.max(state.duration, endOf(videoClips)) };
}

export function useSequenceTimeline() {
  const [state, dispatch] = useReducer(sequenceTimelineReducer, { duration: 30, videoClips: [], audioClips: [] });
  const views = useMemo(() => splitUnifiedTimeline(state.videoClips), [state.videoClips]);
  const setDuration = useCallback((value: SetStateAction<number>) => dispatch({ kind: "duration", value }), []);
  const setVideoClips = useCallback((value: SetStateAction<VideoClip[]>) => dispatch({ kind: "video", value }), []);
  const setAudioClips = useCallback((value: SetStateAction<AudioClip[]>) => dispatch({ kind: "audio", value }), []);
  const setBaseCuts = useCallback((value: SetStateAction<BaseCut[]>) => dispatch({ kind: "base", value }), []);
  const setPlacements = useCallback((value: SetStateAction<Placement[]>) => dispatch({ kind: "overlay", value }), []);
  return { ...state, baseCuts: views.baseCuts, placements: views.placements as Placement[], setDuration, setVideoClips, setAudioClips, setBaseCuts, setPlacements };
}
