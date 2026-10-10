import { audioPlaybackRate } from "./audio-timing.ts";
import { replaceAudioFade, type AudioEnvelope } from "./audio-crossfade.ts";
export type SplitEditKind = "j-cut" | "l-cut" | "reset";

export type LinkedAudioEdit = {
  start: number;
  duration: number;
  sourceStart: number;
  playbackRate?: number;
  fadeIn?: number;
  fadeOut?: number;
  envelopes?: AudioEnvelope[];
  automation?: Array<{ id: string; time: number; gain: number }>;
};

function moveAudioHead<T extends LinkedAudioEdit>(clip: T, start: number): T {
  const shift = clip.start - start;
  return { ...clip, start,
    ...(clip.automation ? { automation: clip.automation.map(point => ({ ...point, time: point.time + shift })) } : {}),
    ...(clip.envelopes ? { envelopes: clip.envelopes.map(item => ({ ...item, offset: item.offset - shift })) } : {}) };
}

/** Apply a Premiere-style split edit while preserving source sync at the
 * picture cut. A J-cut reveals audio before picture; an L-cut carries it after. */
export function applySplitEdit<T extends LinkedAudioEdit>(clip: T, pictureStart: number, pictureDuration: number, kind: SplitEditKind, handle = .5): T {
  const safeHandle = Math.max(0, Math.min(5, handle));
  const rate = audioPlaybackRate(clip);
  const sourceAtPicture = Math.max(0, clip.sourceStart + (pictureStart - clip.start) * rate);
  if (kind === "reset") return { ...replaceAudioFade(replaceAudioFade(moveAudioHead(clip, pictureStart), "in", 0), "out", 0), duration: pictureDuration, sourceStart: sourceAtPicture };
  if (kind === "j-cut") {
    const available = Math.min(safeHandle, sourceAtPicture / rate, pictureStart);
    return { ...replaceAudioFade(moveAudioHead(clip, pictureStart - available), "in", Math.min(.08, available)), duration: pictureDuration + available, sourceStart: sourceAtPicture - available * rate };
  }
  return { ...replaceAudioFade(moveAudioHead(clip, pictureStart), "out", Math.min(.08, safeHandle)), sourceStart: sourceAtPicture, duration: pictureDuration + safeHandle };
}

/** Independent head/tail audio handles for asymmetric J/L edits. */
export function applyAsymmetricSplitEdit<T extends LinkedAudioEdit>(clip: T, pictureStart: number, pictureDuration: number, lead: number, trail: number): T {
  const rate = audioPlaybackRate(clip);
  const sourceAtPicture = Math.max(0, clip.sourceStart + (pictureStart - clip.start) * rate);
  const safeLead = Math.max(0, Math.min(5, lead, sourceAtPicture / rate, pictureStart));
  const safeTrail = Math.max(0, Math.min(5, trail));
  return {
    ...replaceAudioFade(replaceAudioFade(moveAudioHead(clip, pictureStart - safeLead), "in", Math.min(.08, safeLead)), "out", Math.min(.08, safeTrail)),
    start: pictureStart - safeLead,
    sourceStart: sourceAtPicture - safeLead * rate,
    duration: pictureDuration + safeLead + safeTrail,
    fadeIn: Math.min(.08, safeLead),
    fadeOut: Math.min(.08, safeTrail),
  };
}
