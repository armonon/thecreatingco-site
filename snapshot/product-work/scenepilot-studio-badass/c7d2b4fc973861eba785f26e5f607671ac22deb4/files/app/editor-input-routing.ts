import type { EditorCommandId } from "./editor-command-registry.ts";

export type KeyInput = { key: string; code?: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean };
/** Pure routing table, shared by browser shortcuts and the desktop menu adapter. */
export function commandForKey(event: KeyInput): EditorCommandId | undefined {
  const key = event.key.toLowerCase();
  const command = event.metaKey || event.ctrlKey;
  if (command) {
    if (event.altKey) return;
    if (/^[1-6]$/.test(key)) return (["open-auto", "open-edit", "open-composition", "open-color", "open-audio", "open-deliver"] as const)[Number(key) - 1];
    if (event.shiftKey) return ({ z: "redo", s: "save-disk-project-as", g: "ungroup-selection" } as const)[key as "z"];
    return ({ z: "undo", s: "save-project", o: "open-disk-project", n: "new-project", i: "import-media", e: "queue-master", c: "copy", x: "cut", v: "paste", d: "duplicate", a: "select-all", k: "split", g: "group-selection" } as const)[key as "z"];
  }
  if (event.altKey) return /^[1-6]$/.test(key) ? (["open-auto", "open-edit", "open-composition", "open-color", "open-audio", "open-deliver"] as const)[Number(key) - 1] : undefined;
  if (key === "delete" || key === "backspace") return event.shiftKey ? "ripple-delete" : "delete";
  if (key === "arrowleft") return event.shiftKey ? "step-back-second" : "step-back";
  if (key === "arrowright") return event.shiftKey ? "step-forward-second" : "step-forward";
  if (event.shiftKey) return key === "f" ? "match-frame" : undefined;
  if (event.code === "Space" || key === " ") return "play-pause";
  return ({ j: "shuttle-reverse", k: "stop", l: "shuttle-forward", i: "mark-in", o: "mark-out", m: "add-marker", ",": "source-insert", ".": "source-overwrite", "'": "extract-range", v: "tool-select", c: "tool-razor", r: "tool-rate", y: "tool-slip", u: "tool-slide", n: "tool-roll", f: "tool-fade", h: "tool-hand", z: "tool-zoom" } as const)[key as "j"];
}

export const NATIVE_COMMAND_ALIASES: Record<string, EditorCommandId> = {
  import: "import-media", "open-project-document": "open-disk-project", "save-project-document": "save-disk-project-as",
  save: "save-project", export: "queue-master", auto: "open-auto", sequence: "open-edit", edit: "open-edit",
  composition: "open-composition", color: "open-color", audio: "open-audio", deliver: "open-deliver", marker: "add-marker",
};

export function editorOwnsInput(target: EventTarget | null): boolean {
  return !(target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [data-editor-shortcuts='local'], [role='dialog'], [role='menu']"));
}
