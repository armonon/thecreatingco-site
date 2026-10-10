export type ContextAction = { id: string; label: string; run: () => void; disabled?: boolean; danger?: boolean };

export function contextAction(id: string, label: string, run: () => void, enabled = true, danger = false): ContextAction {
  return { id, label, disabled: !enabled, danger, run: () => { if (enabled) run(); } };
}

export function contextMenuPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  return { left: Math.max(8, Math.min(x, viewportWidth - width - 8)), top: Math.max(8, Math.min(y, viewportHeight - height - 8)) };
}

export function nextContextMenuIndex(key: string, current: number, count: number) {
  if (!count) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return (current + (key === "ArrowDown" ? 1 : -1) + count) % count;
}
