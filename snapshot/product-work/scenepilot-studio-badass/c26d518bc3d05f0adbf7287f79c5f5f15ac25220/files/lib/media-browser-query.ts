import type { EffectProfile } from "./analysis-engine.ts";
import { profileMatchesFilter, type SmartMediaFilter } from "./workflow.ts";

type MediaItem = { id: string; name: string; folderId: string; kind: "audio" | "video" | "image"; url: string; favorite?: boolean; duration?: number; file: { lastModified: number } };
type MediaReference = { assetId?: string };

export function mediaUsageCounts(base: MediaReference[], overlays: MediaReference[], audio: MediaReference[], compositions: { layers: MediaReference[] }[]) {
  const counts = new Map<string, number>();
  const add = ({ assetId }: MediaReference) => { if (assetId) counts.set(assetId, (counts.get(assetId) ?? 0) + 1); };
  base.forEach(add); overlays.forEach(add); audio.forEach(add);
  compositions.forEach(comp => comp.layers.forEach(add));
  return counts;
}

/** Index profiles once, rather than repeatedly scanning them inside filter/sort. */
export function queryMediaAssets<T extends MediaItem>(assets: T[], options: {
  activeBinId: string; mediaSearch: string; mediaKindFilter: "all" | "missing" | "favorites" | MediaItem["kind"];
  smartFilter: SmartMediaFilter; mediaSort: "name" | "recent" | "duration" | "usage";
  profiles?: EffectProfile[]; mediaUsage: ReadonlyMap<string, number>;
}): T[] {
  const { activeBinId, mediaKindFilter, smartFilter, mediaSort, profiles, mediaUsage } = options;
  const query = options.mediaSearch.trim().toLowerCase();
  const byId = new Map<string, EffectProfile>();
  // Retain first-match semantics for duplicate legacy profile IDs.
  for (const profile of profiles ?? []) if (!byId.has(profile.assetId)) byId.set(profile.assetId, profile);
  return assets.filter(asset =>
    (activeBinId === "bin-root" || asset.folderId === activeBinId)
    && (!query || asset.name.toLowerCase().includes(query))
    && (mediaKindFilter === "all" || mediaKindFilter === asset.kind
      || (mediaKindFilter === "missing" && !asset.url)
      || (mediaKindFilter === "favorites" && asset.favorite))
    && (asset.kind === "audio" || profileMatchesFilter(byId.get(asset.id), smartFilter))
  ).sort((a, b) => {
    if (smartFilter === "best" && profiles) {
      const score = (byId.get(b.id)?.flashiness ?? 0) - (byId.get(a.id)?.flashiness ?? 0);
      if (score) return score;
    }
    if (mediaSort === "recent") return b.file.lastModified - a.file.lastModified;
    if (mediaSort === "duration") return (b.duration ?? 0) - (a.duration ?? 0);
    if (mediaSort === "usage") return (mediaUsage.get(b.id) ?? 0) - (mediaUsage.get(a.id) ?? 0);
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}
