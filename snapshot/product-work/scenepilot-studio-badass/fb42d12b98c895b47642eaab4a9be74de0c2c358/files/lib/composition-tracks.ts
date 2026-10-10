import type { CompositionLayer, CompositionTrack, RenderPlacement, StudioComposition } from "./compositor.ts";

export const compositionTrackId = (compositionId: string, kind: CompositionTrack["kind"], index: number) =>
  `${compositionId}-${kind}-track-${index + 1}`;

/** Upgrade legacy layer-only compositions without changing their visual order. */
export function normalizeComposition(composition: StudioComposition): StudioComposition {
  if (composition.tracks?.length) {
    const valid = new Set(composition.tracks.map((track) => track.id));
    const firstVideo = composition.tracks.find((track) => track.kind === "video")?.id;
    return {
      ...composition,
      tracks: composition.tracks.map((track) => ({ ...track, enabled: track.enabled !== false, locked: Boolean(track.locked) })),
      layers: composition.layers.map((layer) => valid.has(layer.trackId ?? "") || !firstVideo ? layer : { ...layer, trackId: firstVideo }),
    };
  }

  // One video track per legacy layer preserves the exact historical z-order.
  // Empty comps start useful with one picture and one sound lane.
  const videoTracks: CompositionTrack[] = composition.layers.map((layer, index) => ({
    id: compositionTrackId(composition.id, "video", index),
    name: `V${index + 1} · ${layer.name}`,
    kind: "video",
    enabled: true,
    locked: false,
  }));
  if (!videoTracks.length) videoTracks.push({ id: compositionTrackId(composition.id, "video", 0), name: "V1 · VIDEO", kind: "video", enabled: true, locked: false });
  const audioTrack: CompositionTrack = { id: compositionTrackId(composition.id, "audio", 0), name: "A1 · AUDIO", kind: "audio", enabled: true, locked: false, muted: false, solo: false };
  return {
    ...composition,
    tracks: [audioTrack, ...videoTracks],
    layers: composition.layers.map((layer, index) => ({ ...layer, trackId: videoTracks[index]?.id ?? videoTracks[0].id })),
  };
}

export const normalizeCompositions = (compositions: StudioComposition[]) => compositions.map(normalizeComposition);

/** Layers in actual paint order: bottom track first, top track last. */
export function orderedCompositionLayers(composition: StudioComposition, kind: CompositionTrack["kind"] = "video"): CompositionLayer[] {
  const normalized = normalizeComposition(composition);
  const tracks = (normalized.tracks ?? []).filter((track) => track.kind === kind);
  const order = new Map(tracks.map((track, index) => [track.id, index]));
  return normalized.layers
    .filter((layer) => order.has(layer.trackId ?? ""))
    .map((layer, sourceIndex) => ({ layer, sourceIndex }))
    .sort((a, b) => (order.get(a.layer.trackId ?? "") ?? -1) - (order.get(b.layer.trackId ?? "") ?? -1) || a.sourceIndex - b.sourceIndex)
    .map(({ layer }) => layer);
}

export function compositionTrackForLayer(composition: StudioComposition, layer: CompositionLayer | undefined) {
  return composition.tracks?.find((track) => track.id === layer?.trackId);
}

export function moveCompositionTrack(tracks: CompositionTrack[], trackId: string, direction: "up" | "down") {
  const index = tracks.findIndex((track) => track.id === trackId);
  const target = direction === "up" ? index + 1 : index - 1;
  if (index < 0 || target < 0 || target >= tracks.length) return tracks;
  const next = tracks.map((track) => ({ ...track }));
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Move a track directly to another track's stack position. Track arrays are
 * stored bottom-first, so this helper intentionally works in storage order and
 * leaves the UI free to render them top-first. */
export function moveCompositionTrackTo(tracks: CompositionTrack[], trackId: string, targetTrackId: string) {
  const sourceIndex = tracks.findIndex((track) => track.id === trackId);
  const targetIndex = tracks.findIndex((track) => track.id === targetTrackId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return tracks;
  const next = tracks.map((track) => ({ ...track }));
  const [moving] = next.splice(sourceIndex, 1);
  next.splice(Math.min(targetIndex, next.length), 0, moving);
  return next;
}

/** Re-time and re-lane an existing composition layer. The caller owns media
 * compatibility and lock policy; this pure operation guarantees bounded,
 * frame-agnostic placement and stable ordering for undo/render parity. */
export function repositionCompositionLayer(
  composition: StudioComposition,
  layerId: string,
  targetTrackId: string,
  start: number,
) {
  const normalized = normalizeComposition(composition);
  if (!(normalized.tracks ?? []).some((track) => track.id === targetTrackId)) return normalized;
  const layer = normalized.layers.find((item) => item.id === layerId);
  if (!layer) return normalized;
  const layerDuration = Math.max(.05, Math.min(layer.duration ?? normalized.duration, normalized.duration));
  const boundedStart = Math.max(0, Math.min(Math.max(0, normalized.duration - layerDuration), start));
  return {
    ...normalized,
    layers: normalized.layers.map((item) => item.id === layerId
      ? { ...item, trackId: targetTrackId, start: boundedStart }
      : item),
  };
}

export { type CompositionAudioSegment } from "./composition-audio.ts";
import { compositionAudioPlan } from "./composition-audio.ts";
/** Compatibility view. Delivery must also inspect the plan's issues. */
export function compositionAudioSegments(compositions: StudioComposition[], placements: RenderPlacement[]) {
  return compositionAudioPlan(compositions, placements).clips;
}
