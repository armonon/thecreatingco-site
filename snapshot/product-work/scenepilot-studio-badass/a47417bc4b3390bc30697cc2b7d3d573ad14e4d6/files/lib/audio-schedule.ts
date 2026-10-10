import { audioPlaybackRate, audioSourceTime } from "./audio-timing.ts";
import type { AudioEnvelope, AudioFadeShape } from "./audio-crossfade.ts";
import { automationGainAt } from "./pro-editor.ts";

export type ScheduledAudio = {
  id: string; start: number; sourceStart: number; duration: number; playbackRate?: number;
  gain: number; pan: number; fadeIn: number; fadeOut: number; fadeShape?: AudioFadeShape;
  envelopes?: AudioEnvelope[]; automation?: Array<{ time: number; gain: number }>; muted?: boolean;
};

/** Crop without restarting fades or changing the source/automation clock. */
export function cropScheduledAudio<T extends ScheduledAudio>(clip: T, from: number, to: number): T | null {
  const start = Math.max(from, clip.start), end = Math.min(to, clip.start + clip.duration);
  if (clip.muted || end <= start) return null;
  const skipped = start - clip.start, duration = end - start;
  const envelopes = [...(clip.envelopes ?? []).map(e => ({ ...e, offset: e.offset + skipped })),
    ...(clip.fadeIn > 0 || clip.fadeOut > 0 ? [{ offset: skipped, duration: clip.duration, fadeIn: clip.fadeIn, fadeOut: clip.fadeOut, shape: clip.fadeShape }] : [])];
  return { ...clip, start: start - from, sourceStart: audioSourceTime(clip, skipped), playbackRate: audioPlaybackRate(clip), duration,
    fadeIn: 0, fadeOut: 0, envelopes,
    automation: clip.automation?.length ? [
      { time: 0, gain: automationGainAt(clip.automation, skipped) },
      ...clip.automation.filter(p => p.time > skipped && p.time < skipped + duration).map(p => ({ ...p, time: p.time - skipped })),
      { time: duration, gain: automationGainAt(clip.automation, skipped + duration) },
    ] : undefined,
  };
}
