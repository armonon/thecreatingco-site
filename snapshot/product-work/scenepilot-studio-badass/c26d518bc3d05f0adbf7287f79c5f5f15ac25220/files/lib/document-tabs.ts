export type DocumentTabs = { open: string[]; pinned: string[] };
export function normalizeDocumentTabs(value: unknown, ids: string[]): DocumentTabs {
  const v = value && typeof value === "object" ? value as Partial<DocumentTabs> : {};
  const valid = new Set(ids);
  const list = (items: unknown) => Array.isArray(items) ? [...new Set(items.filter((id): id is string => typeof id === "string" && valid.has(id)))] : [];
  const pinned = list(v.pinned);
  return { open: [...new Set([...pinned, ...list(v.open)])], pinned };
}
export function changeDocumentTab(state: DocumentTabs, id: string, action: "open" | "close" | "pin"): DocumentTabs {
  if (action === "close") return state.pinned.includes(id) ? state : { ...state, open: state.open.filter(key => key !== id) };
  const open = state.open.includes(id) ? state.open : [...state.open, id];
  return { open, pinned: action === "pin" ? state.pinned.includes(id) ? state.pinned.filter(key => key !== id) : [...state.pinned, id] : state.pinned };
}
