"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Columns3, Maximize2, RotateCcw } from "lucide-react";
import { useDismissibleDisclosure } from "./shell-disclosure";
import { contextualWorkspaceLayout, fitWorkspaceLayout, LAYOUT_PRESETS, normalizeWorkspaceLayout, readWorkspaceLayouts, WORKSPACE_LAYOUT_KEY, type LayoutPreset, type WorkspaceLayout } from "../lib/workspace-layout";

type LayoutContext = { layout: WorkspaceLayout; preference: WorkspaceLayout; change(patch: Partial<WorkspaceLayout>): void; reset(): void; message: string };
const WorkspaceContext = createContext<LayoutContext | null>(null);
export function useFullWorkspaceControls() { return useContext(WorkspaceContext)?.layout.detail === "full"; }
export function useTimelineVisibility() {
  const context = useContext(WorkspaceContext);
  return { showEmpty: Boolean(context?.layout.emptyTracks), reveal: () => context?.change({ emptyTracks: true }), toggle: () => context?.change({ emptyTracks: !context.layout.emptyTracks }) };
}

export function StudioShell({ className, children, workspace = "edit", hasInspectorTarget = false }: { className: string; children: ReactNode; workspace?: string; hasInspectorTarget?: boolean }) {
  const [layouts, setLayouts] = useState<Record<string, WorkspaceLayout>>({});
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [message, setMessage] = useState("");
  const loaded = useRef(false);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const id = window.setTimeout(() => {
      try { setLayouts(readWorkspaceLayouts(localStorage.getItem(WORKSPACE_LAYOUT_KEY))); } catch { setMessage("Workspace preferences are unavailable in this session."); }
      loaded.current = true; resize();
    }, 0);
    window.addEventListener("resize", resize);
    return () => { window.clearTimeout(id); window.removeEventListener("resize", resize); };
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const save = () => {
      try { localStorage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify({ version: 1, layouts })); }
      catch { setMessage("Layout changed, but this browser could not save your preferences."); }
    };
    const id = window.setTimeout(save, 200);
    window.addEventListener("pagehide", save);
    return () => { window.clearTimeout(id); window.removeEventListener("pagehide", save); };
  }, [layouts]);
  const defaultLayout = workspace === "composition" ? LAYOUT_PRESETS.compositing : LAYOUT_PRESETS.balanced;
  const stored = layouts[workspace] ?? defaultLayout;
  const layout = fitWorkspaceLayout(contextualWorkspaceLayout(stored, workspace, hasInspectorTarget), viewport.width, viewport.height);
  const change = (patch: Partial<WorkspaceLayout>) => setLayouts((current) => ({ ...current, [workspace]: normalizeWorkspaceLayout({ ...(current[workspace] ?? defaultLayout), ...patch }) }));
  const reset = () => change(defaultLayout);
  return <WorkspaceContext.Provider value={{ layout, preference: stored, change, reset, message }}><main className={`${className} studio-adaptive-shell`} data-workspace-detail={layout.detail} data-empty-tracks={Boolean(layout.emptyTracks)} data-project-panel={layout.project} data-inspector-panel={layout.inspector} data-workspace-focus={layout.focus} style={{ "--dock-left": `${layout.project ? layout.left : 0}px`, "--dock-right": `${layout.inspector ? layout.right : 0}px`, "--dock-bottom": `${layout.bottom}px` } as CSSProperties}>{children}</main></WorkspaceContext.Provider>;
}

export function WorkspaceLayoutControls({ editing = true }: { editing?: boolean }) {
  const context = useContext(WorkspaceContext);
  const disclosure = useDismissibleDisclosure();
  if (!context) return null;
  const { layout, preference, change, reset, message } = context;
  return <div className="workspace-layout-controls">
    <div className="workspace-detail-choice" role="group" aria-label="Interface detail"><button aria-pressed={layout.detail === "essential"} onClick={() => change({ detail: "essential" })}>Simple</button><button aria-pressed={layout.detail === "full"} onClick={() => change({ detail: "full" })}>Advanced</button></div>
    {editing && <><button aria-label={layout.focus === "viewer" ? "Restore editing layout" : "Focus viewer"} title="Focus viewer" aria-pressed={layout.focus === "viewer"} onClick={() => change({ focus: layout.focus === "viewer" ? "none" : "viewer" })}><Maximize2 size={14} /></button>
    <details {...disclosure} className="workspace-layout-menu"><summary><Columns3 size={14} /> Layout</summary><div role="group" aria-label="Workspace layout settings">
      <strong>YOUR WORKSPACE</strong><span>Saved separately for each workspace</span>
      <label>Preset<select aria-label="Workspace layout preset" value="" onChange={(event) => { if (event.target.value) change(LAYOUT_PRESETS[event.target.value as LayoutPreset]); }}><option value="">Choose a layout…</option><option value="balanced">Balanced</option><option value="editing">Timeline editing</option><option value="compositing">Motion & compositing</option><option value="finishing">Color & finishing</option></select></label>
      <label><input type="checkbox" checked={layout.project} onChange={(event) => change({ project: event.target.checked, focus: "none" })} /> Project media</label>
      <label><input type="checkbox" checked={preference.inspector} onChange={(event) => change({ inspector: event.target.checked, focus: "none" })} /> Inspector {layout.detail === "essential" ? "on selection" : "always visible"}</label>
      <button onClick={() => change({ focus: layout.focus === "timeline" ? "none" : "timeline" })}>{layout.focus === "timeline" ? "Restore editing layout" : "Focus timeline"}</button>
      <button onClick={reset}><RotateCcw size={12} /> Reset workspace</button>
      {message && <p role="status">{message}</p>}
    </div></details></>}
  </div>;
}

export function WorkspaceResizers() {
  const context = useContext(WorkspaceContext);
  const drag = useRef<{ side: "left" | "right" | "bottom"; x: number; y: number; value: number } | null>(null);
  if (!context) return null;
  const { layout, change } = context;
  return <>{(["left", "right", "bottom"] as const).filter((side) => side === "bottom" || (side === "left" ? layout.project : layout.inspector)).map((side) => <div key={side} role="separator" tabIndex={0} aria-label={`Resize ${side === "left" ? "project media" : side === "right" ? "effect controls" : "timeline"}`} aria-orientation={side === "bottom" ? "horizontal" : "vertical"} aria-valuemin={side === "left" ? 190 : side === "right" ? 250 : 160} aria-valuemax={side === "left" ? 460 : side === "right" ? 640 : 600} aria-valuenow={Math.round(layout[side])} className={`workspace-resizer resize-${side}`} title="Drag to resize · arrow keys for precision · double-click to reset" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { side, x: event.clientX, y: event.clientY, value: layout[side] }; }} onPointerMove={(event) => { const start = drag.current; if (!start || start.side !== side) return; const delta = side === "left" ? event.clientX - start.x : side === "right" ? start.x - event.clientX : start.y - event.clientY; change({ [side]: start.value + delta }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={() => change({ [side]: LAYOUT_PRESETS.balanced[side] })} onKeyDown={(event) => { const delta = event.shiftKey ? 40 : 10; if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); const grows = side === "left" ? event.key === "ArrowRight" : side === "right" ? event.key === "ArrowLeft" : event.key === "ArrowUp"; change({ [side]: layout[side] + (grows ? delta : -delta) }); } if (event.key === "Home") { event.preventDefault(); change({ [side]: LAYOUT_PRESETS.balanced[side] }); } }} />)}</>;
}
