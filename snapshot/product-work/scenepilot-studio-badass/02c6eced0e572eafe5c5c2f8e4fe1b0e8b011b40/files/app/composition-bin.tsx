import { Box, Plus } from "lucide-react";
import type { StudioComposition } from "../lib/compositor";

/** One project-library representation in both sequence and composition workspaces. */
export function CompositionBin({ compositions, activeId, query, onAddExamples, onOpen, onAdd, onCreate }: {
  onAddExamples?(): void;
  compositions: StudioComposition[]; activeId: string; query: string; onOpen(id: string): void; onAdd(id: string): void; onCreate(): void;
}) {
  const visible = compositions.filter((comp) => comp.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="comp-bin-list">
    {!compositions.length && <button className="comp-empty" onClick={onCreate}><Box size={18} /><strong>No compositions yet</strong><span>Create a composition or drop a source onto New Composition.</span></button>}
    {!compositions.length && onAddExamples && <button className="comp-example-action" onClick={onAddExamples}>Explore sample compositions</button>}
    {compositions.length > 0 && !visible.length && <p className="composition-settings-note">No compositions match your search.</p>}
    {visible.map((comp) => <div className={`comp-bin-row ${comp.id === activeId ? "active" : ""}`} key={comp.id} draggable
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-scenepilot", `composition:${comp.id}`); }}>
      <button className="comp-bin-main" onClick={() => onOpen(comp.id)} aria-label={`Open ${comp.name}`}>
        <span className="comp-icon"><Box size={15} /></span><span><strong>{comp.name}</strong><small>{comp.width}×{comp.height} · {comp.duration.toFixed(1)}s · {comp.layers.length} layers</small></span>
      </button>
      <button className="comp-bin-add" onClick={() => onAdd(comp.id)} aria-label={`Add ${comp.name} to the sequence`} title="Add at main-sequence playhead"><Plus size={13} /></button>
    </div>)}
  </div>;
}
