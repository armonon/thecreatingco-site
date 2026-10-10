import type { CompositionLayer, StudioComposition } from "./compositor.ts";
import { compositionTrackForLayer } from "./composition-tracks.ts";
import { createStudioComposition, type CompositionSource } from "./composition-creation.ts";

type Timing = Pick<CompositionLayer, "start" | "sourceStart" | "playbackRate" | "duration">;
export const compositionLayerRate = (layer: Timing) => Math.max(.01, layer.playbackRate ?? 1);
/** Animation keys use source-local seconds, exactly like the shared renderer. */
export const compositionToLayerTime = (layer: Timing, time: number) => (layer.sourceStart ?? 0) + (time - (layer.start ?? 0)) * compositionLayerRate(layer);
export const layerToCompositionTime = (layer: Timing, time: number) => (layer.start ?? 0) + (time - (layer.sourceStart ?? 0)) / compositionLayerRate(layer);
export const compositionLayerLocked = (composition: StudioComposition | undefined, layer: CompositionLayer | undefined) => Boolean(layer?.locked || (composition && layer && compositionTrackForLayer(composition, layer)?.locked));
export function layerTimeBounds(layer: Timing, duration: number) {
  const start = Math.max(0, layer.start ?? 0);
  const end = Math.min(duration, start + (layer.duration ?? duration));
  return { minimum: layer.sourceStart ?? 0, maximum: compositionToLayerTime(layer, Math.max(start, end)) };
}

/** Bound DOM work independently of sequence length (including 24-hour comps). */
export function compositionRulerTicks(duration: number, maxTicks = 12): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const raw = duration / Math.max(2, maxTicks);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= raw)!;
  return Array.from({ length: Math.floor(duration / step) + 1 }, (_, index) => Number((index * step).toPrecision(12)));
}

/** Resolve against the latest document after asynchronous import; never unlock or replace tracks. */
export function placeImportedCompositionMedia(composition: StudioComposition, sources: Array<CompositionSource & { layerId: string }>, time: number, trackId?: string): StudioComposition {
  const layers = sources.flatMap(source => {
    const kind = source.kind === "audio" ? "audio" : "video";
    const track = trackId ? composition.tracks?.find(item => item.id === trackId) : composition.tracks?.find(item => item.kind === kind && !item.locked);
    if (!track || track.locked || (track.kind === "video" && source.kind === "audio") || (track.kind === "audio" && source.kind === "image")) return [];
    const start = Math.max(0, Math.min(Math.max(0, composition.duration - .05), time));
    const layer = createStudioComposition(source.layerId, composition, source).layers[0];
    return [{ ...layer, id: source.layerId, trackId: track.id, start, duration: Math.min(layer.duration ?? composition.duration, composition.duration - start) }];
  });
  return layers.length ? { ...composition, layers: [...composition.layers, ...layers] } : composition;
}
