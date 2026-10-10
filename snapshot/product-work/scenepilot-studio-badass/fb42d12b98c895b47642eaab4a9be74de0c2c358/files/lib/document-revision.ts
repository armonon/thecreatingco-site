const transient = new Set(["workspaceView", "activeCompositionId", "selectedCompLayerId", "selectedKeyframeId", "selectedSectionId", "selectedPlacementId", "selectedBaseCutId", "selectedTrackId", "placements", "baseCuts"]);
/** Compare stable model references, not a JSON encoding of all pixels/mattes
 * on every transport tick. Canonical videoClips already covers lane views. */
export function documentChanged(previous: Record<string, unknown>, next: Record<string, unknown>) {
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])].some((key) => !transient.has(key) && !Object.is(previous[key], next[key]));
}
export function createDocumentRevision() {
  let revision = 0, saved = 0;
  return { changed: () => ++revision, capture: () => revision, saved: (token: number) => { if (token === revision) saved = token; }, dirty: () => revision !== saved };
}
