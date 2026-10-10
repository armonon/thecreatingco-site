/** Gather original sources reachable from the render roots, including effect
 * graphs, clean plates and recursively nested compositions. Unused/offline bin
 * items must not block an otherwise complete sequence. */
export function renderMediaIds(roots: unknown[], compositions: Array<{ id: string }>): Set<string> {
  const ids = new Set<string>();
  const visited = new Set<object>();
  const byId = new Map(compositions.map((composition) => [composition.id, composition]));
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object" || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) { value.forEach(visit); return; }
    for (const [key, child] of Object.entries(value)) {
      if ((key === "assetId" || key === "cleanPlateAssetId") && typeof child === "string") {
        if (child.startsWith("composition:")) visit(byId.get(child.slice(12)));
        else ids.add(child);
      } else if (key === "compositionId" && typeof child === "string") visit(byId.get(child));
      else if (child && typeof child === "object") visit(child);
    }
  };
  roots.forEach(visit);
  return ids;
}
