"use client";
import { useEffect, useRef, useState } from "react";
import { acquireSongBuffer, audioClockPosition, audioClockSnapshot, sharedAudioContext, subscribeAudioClock } from "../lib/shared-audio-clock";
import { attachAudioNodeMeter, type LiveMeterReading } from "../lib/live-audio-meter";
import { createClipGainSampler, type AudioClip, type AudioTrack } from "../lib/pro-editor";
import { audioPlaybackRate, audioSourceTime } from "../lib/audio-timing";

export function ScheduledSongPreview({ clip, track, fileUrl, sourceDuration, time, outputGain, anySolo, onMeter }: {
  clip: AudioClip; track: AudioTrack; fileUrl: string; sourceDuration?: number; time: number; outputGain: number; anySolo: boolean; onMeter(reading: LiveMeterReading): void;
}) {
  const [problem, setProblem] = useState("");
  const live = useRef({ track, outputGain, anySolo, onMeter });
  useEffect(() => { live.current = { track, outputGain, anySolo, onMeter }; });
  const wanted = time >= clip.start - 8 && time < clip.start + clip.duration;
  useEffect(() => {
    if (!wanted) return;
    let disposed = false, stop: (() => void) | undefined;
    let release: (() => void) | undefined;
    let unsubscribe: (() => void) | undefined;
    const context = sharedAudioContext();
    if (!context) return;
    const prepare = async () => {
      setProblem(`Preparing ${clip.name} for shared-clock playback…`);
      const acquired = acquireSongBuffer(fileUrl, sourceDuration); release = acquired.release;
      const buffer = await acquired.buffer;
      if (disposed) return;
      setProblem("");
      const schedule = () => {
        stop?.(); stop = undefined;
        const clock = audioClockSnapshot(), position = audioClockPosition();
        if (!clock.playing || clock.rate <= 0 || position >= clip.start + clip.duration) return;
        // Every source derives both start and offset from the same anchor.
        // Scheduling callbacks can run in different JS turns without phase drift.
        const when = Math.max(context.currentTime + .01, clock.contextTime, clock.contextTime + (clip.start - clock.position) / clock.rate);
        const local = Math.max(0, clock.position + (when - clock.contextTime) * clock.rate - clip.start);
        const offset = audioSourceTime(clip, local);
        if (offset >= buffer.duration) return;
        const length = Math.min(clip.duration - local, (buffer.duration - offset) / audioPlaybackRate(clip)) / clock.rate;
        if (length <= 0) return;
        const source = context.createBufferSource(); source.buffer = buffer;
        source.playbackRate.value = audioPlaybackRate(clip) * clock.rate;
        const envelope = context.createGain(); source.connect(envelope);
        const gainAt = createClipGainSampler(clip);
        const count = Math.max(2, Math.ceil(length * 100) + 1);
        const values = Float32Array.from({ length: count }, (_, i) => gainAt(clip.start + local + length * i / (count - 1) * clock.rate));
        envelope.gain.setValueCurveAtTime(values, when, length);
        const detach = attachAudioNodeMeter(envelope, reading => live.current.onMeter(reading),
          () => live.current.track.muted || (live.current.anySolo && !live.current.track.solo) ? 0 : live.current.outputGain,
          () => ({ rack: live.current.track.processing, pan: Math.max(-1, Math.min(1, live.current.track.pan + clip.pan)) }), () => audioClockSnapshot().playing);
        source.start(when, offset); source.stop(when + length);
        stop = () => { try { source.stop(); } catch { /* already ended */ } source.disconnect(); envelope.disconnect(); detach(); };
      };
      unsubscribe = subscribeAudioClock(schedule); schedule();
    };
    void prepare().catch(error => { if (!disposed) setProblem(`Audio preview: ${error instanceof Error ? error.message : String(error)}`); });
    return () => { disposed = true; unsubscribe?.(); stop?.(); release?.(); };
  }, [wanted, fileUrl, sourceDuration, clip]);
  return wanted && problem ? <small role="status">{problem}</small> : null;
}
