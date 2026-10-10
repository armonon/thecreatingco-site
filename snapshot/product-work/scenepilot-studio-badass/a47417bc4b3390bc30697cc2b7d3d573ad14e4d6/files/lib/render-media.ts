import { normalizeComposition } from "./composition-tracks.ts";
import type { StudioComposition } from "./compositor.ts";

export function visibleRenderPlacements<T extends { trackId?: string }>(placements: T[], tracks: Array<{ id: string; enabled: boolean; solo?: boolean }> = []): T[] {
  const solo = tracks.some(track => track.solo);
  return placements.filter(placement => {
    const track = tracks.find(track => track.id === placement.trackId);
    return track?.enabled !== false && (!solo || Boolean(track?.solo));
  });
}

/** Gather original sources reachable from the render roots, including effect
 * graphs, clean plates and recursively nested compositions. Unused/offline bin
 * items must not block an otherwise complete sequence. */
export function renderMediaIds(roots: unknown[], compositions: Array<{ id: string }>, options: { pictureOnly?: boolean } = {}): Set<string> {
  const ids = new Set<string>();
  const visited = new Set<object>();
  const byId = new Map(compositions.map((composition) => [composition.id, composition]));
  const visitedCompositions = new Set<string>();
  const visitComposition = (id: string) => {
    if (visitedCompositions.has(id)) return;
    visitedCompositions.add(id);
    const raw = byId.get(id) as StudioComposition | undefined;
    if (!raw?.layers) return;
    const composition = normalizeComposition(raw);
    const tracks = composition.tracks ?? [];
    for (const layer of composition.layers) {
      const track = tracks.find(track => track.id === layer.trackId);
      if (layer.enabled === false || !track?.enabled) continue;
      if (tracks.some(other => other.kind === track.kind && other.solo) && !track.solo) continue;
      if (track.kind === "audio" && (options.pictureOnly || track.muted || layer.audioMuted)) continue;
      visit(layer);
    }
  };
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object" || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) { value.forEach(visit); return; }
    for (const [key, child] of Object.entries(value)) {
      if ((key === "assetId" || key === "cleanPlateAssetId") && typeof child === "string") {
        if (child.startsWith("composition:")) visitComposition(child.slice(12));
        else ids.add(child);
      } else if (key === "compositionId" && typeof child === "string") visitComposition(child);
      else if (child && typeof child === "object") visit(child);
    }
  };
  roots.forEach(visit);
  return ids;
}
