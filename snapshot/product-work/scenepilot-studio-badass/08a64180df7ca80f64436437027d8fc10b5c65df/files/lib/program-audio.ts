import { cropScheduledAudio, type ScheduledAudio } from "./audio-schedule.ts";
import { requireCompositionAudio, type CompositionAudioPlan } from "./composition-audio.ts";
import { audioTrackOutputGain, audioBusForTrack, type AudioBus } from "./audio-mixer.ts";
import { stemIncludesMainSoundtrack, trackIncludedInStem, type AudioStem } from "./audio-stems.ts";
import type { AudioClip, AudioTrack, AudioEffectRack } from "./pro-editor.ts";

export type ProgramAudioSegment = ScheduledAudio & { assetId: string | null; optional?: boolean; processing?: AudioEffectRack };

/** One source/range/bus/envelope decision for masters, WAV stems and analysis.
 * Hosts only resolve the resulting asset IDs to files or native paths. */
export function programAudioSchedule(input: {
  main: boolean; duration: number; from?: number; to?: number; masterGain: number;
  audioClips: AudioClip[]; audioTracks: AudioTrack[]; audioBuses: AudioBus[];
  composition: CompositionAudioPlan; stem?: AudioStem;
}): ProgramAudioSegment[] {
  const stem = input.stem ?? "master", from = input.from ?? 0, to = input.to ?? input.duration;
  const clips: ProgramAudioSegment[] = [];
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw new Error("Audio delivery needs a finite positive timeline range.");
  if (input.main && stemIncludesMainSoundtrack(stem)) clips.push({ id: "main-audio", assetId: null, start: 0, sourceStart: 0, duration: input.duration, gain: input.masterGain, pan: 0, fadeIn: 0, fadeOut: 0, optional: true });
  const tracks = new Map(input.audioTracks.map(t => [t.id, t]));
  for (const clip of input.audioClips) {
    const track = tracks.get(clip.trackId);
    if (!track || clip.muted || !trackIncludedInStem({ ...track, busId: audioBusForTrack(track, input.audioBuses)?.id }, input.audioBuses, stem, input.audioTracks)) continue;
    clips.push({ ...clip, gain: clip.gain * audioTrackOutputGain(track, input.audioBuses, input.masterGain), pan: Math.max(-1, Math.min(1, clip.pan + track.pan)), processing: track.processing });
  }
  if (stemIncludesMainSoundtrack(stem)) for (const clip of requireCompositionAudio(input.composition)) {
    clips.push({ ...clip, gain: clip.gain * input.masterGain });
  }
  return clips.flatMap(clip => {
    const cropped = cropScheduledAudio(clip, from, to);
    // Nested clips can reference the same intrinsic source as main picture.
    // Use the main-file resolver instead of looking for a nonexistent bin item.
    return cropped && cropped.gain > 0 ? [{ ...cropped, assetId: cropped.assetId === "__main__" ? null : cropped.assetId }] : [];
  });
}
