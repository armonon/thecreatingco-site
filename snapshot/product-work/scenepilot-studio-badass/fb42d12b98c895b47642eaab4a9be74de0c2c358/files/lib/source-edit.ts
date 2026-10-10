import { automationGainAt, razorCut, type AudioClip, type AudioTrack } from "./pro-editor.ts";
import type { BaseCut } from "./sequencer.ts";
import { placeBaseCut } from "./timeline-edit.ts";
import { audioPlaybackRate, audioSourceTime } from "./audio-timing.ts";
import { replaceAudioFade, sliceAudioFades } from "./audio-crossfade.ts";

export function createEditorialAudio(asset: { id: string; name: string; kind: string; duration?: number; beatMap?: AudioClip["beatMap"] }, trackId: string, start: number, id: string): AudioClip {
  return { id, assetId: asset.id, beatMap: asset.beatMap, trackId, name: asset.kind === "video" ? `${asset.name} · embedded audio` : asset.name,
    start: Math.max(0, start), sourceStart: 0, duration: Math.max(.05, asset.duration ?? 5), gain: 1, pan: 0,
    fadeIn: .05, fadeOut: .12, muted: false, automation: [] };
}

/** One inspector/context-menu mutation boundary; source-in alone is a slip. */
export function patchEditorialAudio(clip: AudioClip, patch: Partial<AudioClip>, sourceDuration = Infinity): AudioClip {
  let edited = { ...clip, ...patch };
  if (patch.fadeIn !== undefined) edited = replaceAudioFade(edited, "in", patch.fadeIn);
  if (patch.fadeOut !== undefined) edited = replaceAudioFade(edited, "out", patch.fadeOut);
  const duration = Math.max(.05, Math.min((sourceDuration - edited.sourceStart) / audioPlaybackRate(edited), edited.duration));
  // An out trim keeps the existing sound; a source slip intentionally retains
  // timeline-relative automation. No silent time scaling on ordinary properties.
  if (duration < clip.duration && patch.fadeIn === undefined && patch.fadeOut === undefined) {
    edited = { ...sliceEditorialAudio({ ...edited, duration: clip.duration }, 0, duration, clip.id), ...patch, duration };
  }
  return { ...edited, start: Math.max(0, edited.start), duration };
}

export function splitEditorialAudio(clip: AudioClip, time: number, tailId: string): [AudioClip, AudioClip] | null {
  const at = time - clip.start;
  if (!Number.isFinite(at) || at < .02 || clip.duration - at < .02) return null;
  return [sliceEditorialAudio(clip, 0, at, clip.id), sliceEditorialAudio(clip, at, clip.duration, tailId)];
}

/** Plan the entire linked split before touching state or creating an undo step. */
export function planLinkedRazor(cuts: BaseCut[], audioClips: AudioClip[], audioTracks: AudioTrack[], cutId: string, time: number, linked = true) {
  const cut = cuts.find(item => item.id === cutId);
  if (!cut || !Number.isFinite(time)) return { error: "Select a clip under the cut point." };
  if (cut.locked || (linked && audioClips.some(item => item.linkedVideoId === cutId && audioTracks.find(track => track.id === item.trackId)?.locked))) return { error: "Unlock the picture and its linked audio tracks before splitting." };
  const pieces = razorCut(cut, time);
  if (!pieces) return { error: "Move the cut point farther from the clip edge." };
  while (cuts.some(item => item.id === pieces[1].id)) pieces[1].id += "-tail";
  const ids = new Set(audioClips.map(item => item.id));
  const audio = !linked ? audioClips : audioClips.flatMap(item => {
    if (item.linkedVideoId !== cutId) return [item];
    if (item.start >= time) return [{ ...item, linkedVideoId: pieces[1].id }];
    if (item.start + item.duration <= time) return [item];
    let id = `${item.id}-tail`; while (ids.has(id)) id += "-tail"; ids.add(id);
    return [sliceEditorialAudio(item, 0, time - item.start, item.id), { ...sliceEditorialAudio(item, time - item.start, item.duration, id), linkedVideoId: pieces[1].id }];
  });
  return { cuts: cuts.flatMap(item => item.id === cutId ? pieces : [item]), audioClips: audio, selectedId: pieces[1].id };
}

/** Keep J/L offsets in source seconds when changing a linked picture's speed. */
export function retimeLinkedAudio(clip: AudioClip, before: BaseCut, after: BaseCut): AudioClip {
  const scale = audioPlaybackRate(before) / audioPlaybackRate(after);
  const start = after.start + (clip.start - before.start) * scale;
  const duration = Math.max(.02, after.duration + (clip.duration - before.duration) * scale);
  const retimed = { ...clip, linkedVideoId: after.id, start, duration,
    sourceStart: Math.max(0, after.sourceStart + clip.sourceStart - before.sourceStart),
    playbackRate: audioPlaybackRate(after),
    fadeIn: Math.min(duration, clip.fadeIn * scale), fadeOut: Math.min(duration, clip.fadeOut * scale),
    automation: clip.automation?.map((point) => ({ ...point, time: point.time * scale })),
    envelopes: clip.envelopes?.map((item) => ({ ...item, offset: item.offset * scale, duration: item.duration * scale, fadeIn: item.fadeIn * scale, fadeOut: item.fadeOut * scale })),
  };
  return start < 0 ? sliceEditorialAudio(retimed, -start, duration, clip.id) : retimed;
}

/** Keep source offsets and automation local to each surviving audio piece. */
export function sliceEditorialAudio(clip: AudioClip, from: number, to: number, id: string): AudioClip {
  const duration = to - from;
  const automation = clip.automation?.length ? [
    { id: `${id}-in`, time: 0, gain: automationGainAt(clip.automation, from) },
    ...clip.automation.filter((point) => point.time > from && point.time < to).map((point) => ({ ...point, id: `${id}-${point.id}`, time: point.time - from })),
    { id: `${id}-out`, time: duration, gain: automationGainAt(clip.automation, to) },
  ] : clip.automation;
  return { ...clip, id, start: clip.start + from, duration,
    sourceStart: audioSourceTime(clip, from),
    ...sliceAudioFades(clip, from, to), automation };
}

/** Source-monitor edits are planned before checkpoint/mutation, so a locked
 * linked track cannot leave a half-applied picture edit. */
export function planSourceEdit(input: {
  cuts: BaseCut[]; audioClips: AudioClip[]; audioTracks: AudioTrack[];
  incoming: BaseCut; incomingAudio?: AudioClip; incomingAudioClips?: AudioClip[]; mode: "insert" | "overwrite";
}): { cuts: BaseCut[]; audioClips: AudioClip[]; error?: never } | { error: string; cuts?: never; audioClips?: never } {
  const { cuts, audioClips, audioTracks, incoming, incomingAudio, mode } = input;
  const incomingAudios = [...(incomingAudio ? [incomingAudio] : []), ...(input.incomingAudioClips ?? [])];
  const destinationTracks = new Set(incomingAudios.map((clip) => clip.trackId));
  const end = incoming.start + incoming.duration;
  const affected = (clip: { start: number; duration: number }) => mode === "insert"
    ? clip.start + clip.duration > incoming.start
    : clip.start < end && clip.start + clip.duration > incoming.start;
  if (cuts.some((cut) => cut.locked && affected(cut))) return { error: "Unlock the affected picture clips before this edit." };
  const tracks = new Map(audioTracks.map((track) => [track.id, track]));
  const affectedCutIds = new Set(cuts.filter(affected).map((cut) => cut.id));
  if (audioClips.some((clip) => tracks.get(clip.trackId)?.locked && clip.linkedVideoId && affectedCutIds.has(clip.linkedVideoId))) {
    return { error: "Unlock the linked audio track before editing its picture." };
  }
  if (incomingAudios.some((clip) => tracks.get(clip.trackId)?.locked)) return { error: "The destination audio track is locked." };
  const nextCuts = placeBaseCut(cuts, incoming, mode);
  const usedIds = new Set([...audioClips.map((clip) => clip.id), ...incomingAudios.map((clip) => clip.id)]);
  const tailId = (id: string) => { let next = `${id}-tail`; while (usedIds.has(next)) next += "-tail"; usedIds.add(next); return next; };
  const nextAudio = audioClips.flatMap((clip) => {
    if (tracks.get(clip.trackId)?.locked || !affected(clip)) return [clip];
    if (mode === "insert") {
      // Linked sound follows its edited picture. Unrelated sync-excluded lanes
      // stay put, as the track's SYNC control promises.
      if (tracks.get(clip.trackId)?.syncLock === false && (!clip.linkedVideoId || !affectedCutIds.has(clip.linkedVideoId))) return [clip];
      if (clip.start >= incoming.start) return [{ ...clip, start: clip.start + incoming.duration }];
      const at = incoming.start - clip.start;
      const tail = sliceEditorialAudio(clip, at, clip.duration, tailId(clip.id));
      return [sliceEditorialAudio(clip, 0, at, clip.id), { ...tail, start: tail.start + incoming.duration }];
    }
    // Replace the target audio lane and the audio linked to replaced picture;
    // unrelated dialogue/music on other lanes stays untouched.
    if (!destinationTracks.has(clip.trackId) && (!clip.linkedVideoId || !affectedCutIds.has(clip.linkedVideoId))) return [clip];
    const pieces: AudioClip[] = [];
    if (clip.start < incoming.start) pieces.push(sliceEditorialAudio(clip, 0, incoming.start - clip.start, clip.id));
    if (clip.start + clip.duration > end) pieces.push(sliceEditorialAudio(clip, end - clip.start, clip.duration, tailId(clip.id)));
    return pieces;
  }).map((clip) => {
    if (!clip.linkedVideoId || !affectedCutIds.has(clip.linkedVideoId)) return clip;
    const original = cuts.find((cut) => cut.id === clip.linkedVideoId);
    const piece = nextCuts.find((cut) => cut.id !== incoming.id && cut.assetId === original?.assetId
      && (cut.id === original?.id || cut.id.startsWith(`${original?.id}-tail`))
      && cut.start < clip.start + clip.duration && cut.start + cut.duration > clip.start);
    return { ...clip, linkedVideoId: piece?.id };
  });
  nextAudio.push(...incomingAudios);
  return { cuts: nextCuts, audioClips: nextAudio.sort((a, b) => a.start - b.start) };
}
