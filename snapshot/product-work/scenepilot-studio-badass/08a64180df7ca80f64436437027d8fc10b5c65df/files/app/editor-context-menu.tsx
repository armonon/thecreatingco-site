"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { contextMenuPosition, nextContextMenuIndex, type ContextAction } from "../lib/context-menu";
export type { ContextAction } from "../lib/context-menu";

export type ContextTarget = { kind: string; id: string };
export type ContextMenuModel = { title: string; actions: ContextAction[] };
type OpenMenu = ContextTarget & { x: number; y: number; anchor: HTMLElement };

/** One menu surface for the editor. Commands are supplied by the action owner,
 * never inferred from DOM labels or dispatched as synthetic keyboard shortcuts. */
export function EditorContextMenuBoundary({ children, select, build }: {
  children: ReactNode; select(target: ContextTarget): void; build(target: ContextTarget): ContextMenuModel | null;
}) {
  const [open, setOpen] = useState<OpenMenu | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const model = open ? build(open) : null;
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const menu = ref.current;
    open.anchor.setAttribute("data-context-open", "true");
    const bounds = menu.getBoundingClientRect();
    const position = contextMenuPosition(open.x, open.y, bounds.width, bounds.height, window.innerWidth, window.innerHeight);
    menu.style.left = `${position.left}px`;
    menu.style.top = `${position.top}px`;
    (menu.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? menu).focus();
    const outside = (event: PointerEvent) => { if (!menu.contains(event.target as Node)) setOpen(null); };
    const dismiss = () => setOpen(null);
    const scroll = (event: Event) => { if (!menu.contains(event.target as Node)) dismiss(); };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("blur", dismiss);
    window.addEventListener("resize", dismiss);
    document.addEventListener("scroll", scroll, true);
    return () => {
      open.anchor.removeAttribute("data-context-open");
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  const show = (element: EventTarget, x?: number, y?: number) => {
    if (!(element instanceof Element) || element.closest("input, textarea, select, [contenteditable=true], [role=menu]")) return false;
    const anchor = element.closest<HTMLElement>("[data-context-kind][data-context-id]");
    if (!anchor) return false;
    const target = { kind: anchor.dataset.contextKind!, id: anchor.dataset.contextId! };
    if (!build(target)) return false;
    select(target);
    const bounds = anchor.getBoundingClientRect();
    setOpen({ ...target, anchor, x: x || bounds.left + 12, y: y || bounds.top + 12 });
    return true;
  };
  return <div style={{ display: "contents" }} onPointerDownCapture={(event) => {
    // A secondary click must not start a trim, fade, hand-pan or zoom gesture.
    if (event.button === 2) event.stopPropagation();
  }} onContextMenu={(event) => {
    if (show(event.target, event.clientX, event.clientY)) { event.preventDefault(); event.stopPropagation(); }
  }} onKeyDown={(event) => {
    if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && show(event.target)) { event.preventDefault(); event.stopPropagation(); }
  }}>
    {children}
    {open && model && createPortal(<div ref={ref} className="editor-context-menu" role="menu" aria-label={`${model.title} actions`} tabIndex={-1} data-editor-shortcuts="local"
      style={{ left: open.x, top: open.y }} onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); setOpen(null); open.anchor.focus(); return; }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = nextContextMenuIndex(event.key, index, buttons.length);
        buttons[next]?.focus();
      }}>
      <div className="editor-context-title">{model.title}</div>
      {model.actions.map((action) => <button type="button" role="menuitem" key={action.id} disabled={action.disabled} className={action.danger ? "destructive" : ""}
        onClick={(event) => { event.stopPropagation(); if (action.disabled) return; setOpen(null); open.anchor.focus(); action.run(); }}>{action.label}</button>)}
    </div>, document.body)}
  </div>;
}
