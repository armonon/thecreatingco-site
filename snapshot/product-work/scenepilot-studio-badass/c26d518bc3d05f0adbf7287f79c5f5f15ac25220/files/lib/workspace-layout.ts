/** Workspace preferences stay separate from project edits and undo history. */
export type WorkspaceLayout = { left: number; right: number; bottom: number; project: boolean; inspector: boolean; emptyTracks?: boolean; detail: "essential" | "full"; focus: "none" | "viewer" | "timeline" };
export type LayoutPreset = "balanced" | "editing" | "compositing" | "finishing";
export const WORKSPACE_LAYOUT_KEY = "scenepilot-workspaces-v1";
export const LAYOUT_PRESETS: Record<LayoutPreset, WorkspaceLayout> = {
  balanced: { left: 300, right: 320, bottom: 280, project: true, inspector: true, detail: "essential", focus: "none" },
  editing: { left: 260, right: 290, bottom: 370, project: true, inspector: true, detail: "essential", focus: "none" },
  compositing: { left: 230, right: 300, bottom: 220, project: true, inspector: true, detail: "essential", focus: "none" },
  finishing: { left: 220, right: 360, bottom: 190, project: false, inspector: true, detail: "full", focus: "none" },
};
const finite = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function normalizeWorkspaceLayout(value: unknown): WorkspaceLayout {
  const v = value && typeof value === "object" ? value as Partial<WorkspaceLayout> : {};
  const base = LAYOUT_PRESETS.balanced;
  return { left: finite(v.left, base.left, 190, 460), right: finite(v.right, base.right, 250, 640), bottom: finite(v.bottom, base.bottom, 160, 600), project: typeof v.project === "boolean" ? v.project : true, inspector: typeof v.inspector === "boolean" ? v.inspector : true, ...(typeof v.emptyTracks === "boolean" ? { emptyTracks: v.emptyTracks } : {}), detail: v.detail === "full" ? "full" : "essential", focus: v.focus === "viewer" || v.focus === "timeline" ? v.focus : "none" };
}
/** Auto visibility is derived, never persisted over the user's panel preference. */
export function contextualWorkspaceLayout(layout: WorkspaceLayout, workspace: string, hasInspectorTarget: boolean): WorkspaceLayout {
  return { ...layout, inspector: layout.inspector && (layout.detail === "full" || workspace !== "edit" || hasInspectorTarget) };
}
export function fitWorkspaceLayout(layout: WorkspaceLayout, width: number, height: number): WorkspaceLayout {
  const next = normalizeWorkspaceLayout(layout);
  // Reserve panel gaps and padding as well as usable viewer space.
  let spare = Math.max(0, width - 464 - (next.project ? 190 : 0) - (next.inspector ? 250 : 0));
  if (next.inspector) { const extra = Math.floor(Math.min(next.right - 250, spare * .65)); next.right = 250 + extra; spare -= extra; }
  if (next.project) next.left = 190 + Math.floor(Math.min(next.left - 190, spare));
  next.bottom = Math.min(next.bottom, Math.max(160, height - 410));
  return next;
}
export function readWorkspaceLayouts(raw: string | null): Record<string, WorkspaceLayout> {
  try {
    const parsed = JSON.parse(raw ?? "null");
    if (parsed?.version !== 1 || !parsed.layouts || typeof parsed.layouts !== "object") return {};
    return Object.fromEntries(Object.entries(parsed.layouts).filter(([id]) => ["edit", "composition", "color", "audio", "auto", "deliver"].includes(id)).map(([id, value]) => [id, normalizeWorkspaceLayout(value)]));
  } catch { return {}; }
}
