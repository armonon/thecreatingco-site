/** Shared varispeed contract. Timeline seconds and source seconds are distinct. */
export function audioPlaybackRate(clip: { playbackRate?: number }) {
  return Number.isFinite(clip.playbackRate) ? Math.max(0.1, Math.min(8, clip.playbackRate!)) : 1;
}

export function audioSourceTime(clip: { sourceStart: number; playbackRate?: number }, localTime: number) {
  return clip.sourceStart + Math.max(0, localTime) * audioPlaybackRate(clip);
}
