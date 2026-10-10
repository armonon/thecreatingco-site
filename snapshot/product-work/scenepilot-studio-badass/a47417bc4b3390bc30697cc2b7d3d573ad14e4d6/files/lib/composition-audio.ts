import type { RenderPlacement, RenderTrack, StudioComposition } from "./compositor.ts";
import { normalizeComposition } from "./composition-tracks.ts";
import type { ScheduledAudio } from "./audio-schedule.ts";
import type { AudioEnvelope } from "./audio-crossfade.ts";

export type CompositionAudioSegment = ScheduledAudio & { assetId: string; muted: boolean };
export type CompositionAudioPlan = { clips: CompositionAudioSegment[]; issues: string[] };
type Window = { id: string; start: number; sourceStart: number; duration: number; rate: number; gain: number; pan: number; envelopes: AudioEnvelope[] };
const positive = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Math.max(0, value!) : fallback;

/** Bounded, serializable expansion of the same constant-rate looping comp clock
 * used by the picture planner. Issues are data in preview and fatal at delivery. */
export function compositionAudioPlan(compositions: StudioComposition[], placements: RenderPlacement[], videoTracks?: RenderTrack[]): CompositionAudioPlan {
  const byId = new Map(compositions.map(c => [c.id, normalizeComposition(c)]));
  const clips: CompositionAudioSegment[] = [], issues = new Set<string>();
  let windows = 0;
  const expand = (id: string, window: Window, parents: Set<string>) => {
    if (parents.has(id)) { issues.add(`Composition audio cycle at ${id}. Remove the circular nest before delivery.`); return; }
    if (parents.size >= 64) { issues.add("Composition audio exceeds 64 nested levels. Bounce deeply nested audio before delivery."); return; }
    const comp = byId.get(id);
    if (!comp || !Number.isFinite(comp.duration) || comp.duration <= 0) { issues.add(`Composition ${id} has no valid audio duration.`); return; }
    const stack = new Set(parents).add(id), tracks = new Map(comp.tracks?.map(t => [t.id, t]));
    let elapsed = 0;
    while (elapsed < window.duration - 1e-8) {
      if (++windows > 10000) { issues.add("Composition audio exceeds the 10,000-window scheduling limit. Bounce or shorten nested loops before delivery."); return; }
      const remainder = ((window.sourceStart + elapsed * window.rate) % comp.duration + comp.duration) % comp.duration;
      // Floating-point modulo can land infinitesimally before the loop boundary.
      // Snap that boundary rather than silently abandoning the remaining loops.
      const compIn = comp.duration - remainder < 1e-8 ? 0 : remainder;
      const span = Math.min(window.duration - elapsed, (comp.duration - compIn) / window.rate);
      if (span <= 1e-8) break;
      for (const layer of comp.layers) {
        const track = tracks.get(layer.trackId ?? "");
        if (!layer.enabled || !track?.enabled || track.muted || layer.audioMuted || (comp.tracks?.some(t => t.kind === track.kind && t.solo) && !track.solo)) continue;
        if (layer.kind !== "composition" && (track.kind !== "audio" || !layer.assetId)) continue;
        const layerStart = positive(layer.start, 0), layerDuration = positive(layer.duration, Math.max(0, comp.duration - layerStart));
        const from = Math.max(compIn, layerStart), to = Math.min(compIn + span * window.rate, layerStart + layerDuration);
        if (to <= from) continue;
        if (layer.clipReversed || (layer.clipTimeRemap?.length ?? 0) > 0) { issues.add(`Audio in ${layer.name} needs a baked reverse/time-remap before delivery.`); continue; }
        const layerRate = Math.max(.01, positive(layer.playbackRate, 1)), rate = window.rate * layerRate;
        const skipped = elapsed + (from - compIn) / window.rate;
        const duration = (to - from) / window.rate;
        const envelopes = window.envelopes.map(e => ({ ...e, offset: e.offset + skipped }));
        const fadeIn = positive(layer.audioFadeIn, layer.kind === "composition" ? 0 : .03) / window.rate;
        const fadeOut = positive(layer.audioFadeOut, layer.kind === "composition" ? 0 : .08) / window.rate;
        if (fadeIn || fadeOut) envelopes.push({ offset: (from - layerStart) / window.rate, duration: layerDuration / window.rate, fadeIn, fadeOut });
        const child: Window = { id: `${window.id}/${layer.id}@${elapsed}`, start: window.start + skipped,
          sourceStart: positive(layer.sourceStart, 0) + (from - layerStart) * layerRate, duration, rate,
          gain: window.gain * positive(layer.audioGain, 1), pan: Math.max(-1, Math.min(1, window.pan + (layer.audioPan ?? 0))), envelopes };
        if (layer.kind === "composition" && layer.compositionId) expand(layer.compositionId, child, stack);
        else if (layer.assetId) {
          if (rate < .1 || rate > 8 || !Number.isFinite(rate)) { issues.add(`Audio in ${layer.name} has an unsupported combined rate (${rate.toFixed(3)}×). Use 0.1–8× or bake the retime.`); continue; }
          if (clips.length >= 10000) { issues.add("Composition audio exceeds 10,000 segments. Bounce nested audio before delivery."); return; }
          clips.push({ id: child.id, assetId: layer.assetId, start: child.start, sourceStart: child.sourceStart, duration, playbackRate: rate,
            gain: child.gain, pan: child.pan, fadeIn: 0, fadeOut: 0, envelopes, muted: false });
        }
      }
      elapsed += span;
    }
  };
  const anySolo = videoTracks?.some(t => t.solo);
  for (const [index, p] of placements.entries()) {
    const id = p.compositionId ?? (p.assetId.startsWith("composition:") ? p.assetId.slice(12) : "");
    if (!id) continue;
    const track = videoTracks?.find(t => t.id === (p.trackId ?? videoTracks[0]?.id));
    if (videoTracks && (!track?.enabled || (anySolo && !track.solo))) continue;
    const rate = Math.max(.1, Math.min(8, positive(p.playbackRate, 1)));
    expand(id, { id: p.id ?? `${p.assetId}:${index}`, start: p.start, sourceStart: positive(p.sourceStart, 0), duration: positive(p.duration, 0), rate, gain: 1, pan: 0, envelopes: [] }, new Set());
  }
  return { clips: clips.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)), issues: [...issues] };
}

export function requireCompositionAudio(plan: CompositionAudioPlan) {
  if (plan.issues.length) throw new Error(plan.issues.join(" "));
  return plan.clips;
}
