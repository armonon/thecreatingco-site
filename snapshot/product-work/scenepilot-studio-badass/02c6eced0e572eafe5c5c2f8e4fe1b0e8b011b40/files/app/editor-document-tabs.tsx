"use client";

import { Box, Clapperboard, Pin, Plus, X } from "lucide-react";
import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { StudioComposition } from "../lib/compositor";
import { changeDocumentTab, normalizeDocumentTabs, type DocumentTabs } from "../lib/document-tabs";

type Props = {
  projectName: string; projectId?: string; compositions: StudioComposition[];
  activeView: "sequence" | "composition"; activeCompositionId?: string;
  onOpenMaster(): void; onOpenComposition(id: string): void; onCreateComposition(): void;
  onRenameComposition?(id: string, name: string): void;
};

export const EditorDocumentTabs = memo(function EditorDocumentTabs(props: Props) {
  const [state, setState] = useState<DocumentTabs>({ open: [], pinned: [] });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const renameFinished = useRef(false);
  const loaded = useRef("");
  const storageKey = `scenepilot:document-tabs:${props.projectId ?? "current"}`;
  const ids = props.compositions.map(c => c.id);
  const idsKey = JSON.stringify(ids);
  const active = props.activeView === "composition" ? props.activeCompositionId : undefined;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let restored: DocumentTabs | undefined;
      if (loaded.current !== storageKey) {
        try { restored = normalizeDocumentTabs(JSON.parse(localStorage.getItem(storageKey) ?? "null"), JSON.parse(idsKey)); } catch { restored = { open: [], pinned: [] }; }
        loaded.current = storageKey;
      }
      setState(previous => {
        const next = normalizeDocumentTabs(restored ?? previous, JSON.parse(idsKey));
        return active ? changeDocumentTab(next, active, "open") : next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey, idsKey, active]);
  useEffect(() => {
    if (loaded.current !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Tab preferences never block editing. */ }
  }, [state, storageKey]);
  const visible = normalizeDocumentTabs(active ? changeDocumentTab(state, active, "open") : state, ids);
  const keys = ["main", ...visible.open];
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (event.key === "F2" && key !== "main" && props.onRenameComposition) {
      event.preventDefault(); event.stopPropagation(); renameFinished.current = false;
      setName(props.compositions.find(c => c.id === key)?.name ?? ""); setRenaming(key); return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = keys.indexOf(key);
    const next = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
    if (next === 0) props.onOpenMaster(); else props.onOpenComposition(keys[next]);
    requestAnimationFrame(() => document.getElementById(`document-tab-${keys[next]}`)?.focus());
  };
  const commitName = (id: string) => { if (renameFinished.current) return; renameFinished.current = true; if (name.trim()) props.onRenameComposition?.(id, name.trim()); setRenaming(null); };
  return <nav className="editor-document-tabs" aria-label="Open sequences and compositions">
    <div role="tablist" aria-label="Sequence and composition tabs">
      <button id="document-tab-main" role="tab" aria-selected={props.activeView === "sequence"} tabIndex={props.activeView === "sequence" ? 0 : -1} onKeyDown={event => keyDown(event, "main")} className={props.activeView === "sequence" ? "active master" : "master"} onClick={props.onOpenMaster}>
        <Clapperboard size={14} /><span><strong>Main sequence</strong><small>{props.projectName}</small></span>
      </button>
      {visible.open.map(id => {
        const comp = props.compositions.find(c => c.id === id)!;
        const pinned = visible.pinned.includes(id);
        return <div className="document-tab-group" key={id}>
          {renaming === id ? <input aria-label="Composition name" value={name} autoFocus onChange={e => setName(e.target.value)} onBlur={() => commitName(id)} onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); commitName(id); } if (e.key === "Escape") { e.preventDefault(); renameFinished.current = true; setRenaming(null); } }} /> :
          <button id={`document-tab-${id}`} role="tab" aria-selected={active === id} tabIndex={active === id ? 0 : -1} className={active === id ? "active composition" : "composition"} onKeyDown={e => keyDown(e, id)} onClick={() => props.onOpenComposition(id)} onDoubleClick={() => { if (props.onRenameComposition) { renameFinished.current = false; setName(comp.name); setRenaming(id); } }} title="Double-click to rename">
            <Box size={14} /><strong>{comp.name}</strong>
          </button>}
          <button className="document-tab-action" aria-label={`${pinned ? "Unpin" : "Pin"} ${comp.name}`} aria-pressed={pinned} onClick={() => setState(s => changeDocumentTab(s, id, "pin"))}><Pin size={12} /></button>
          <button className="document-tab-action" aria-label={`Close ${comp.name} tab`} title={pinned ? "Unpin before closing" : "Close tab — composition stays in Project Media"} disabled={pinned} onClick={() => { setState(s => changeDocumentTab(s, id, "close")); if (active === id) props.onOpenMaster(); }}><X size={13} /></button>
        </div>;
      })}
    </div>
    <button onClick={props.onCreateComposition} aria-label="New composition" title="New composition with custom settings"><Plus size={15} /></button>
  </nav>;
});
