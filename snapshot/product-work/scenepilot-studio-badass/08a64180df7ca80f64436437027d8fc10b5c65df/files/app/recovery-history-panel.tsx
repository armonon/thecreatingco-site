import { Clock3, RotateCcw, X } from "lucide-react";
import type { RecoveryRevision } from "../lib/recovery-store";

type Props<T> = {
  revisions: RecoveryRevision<T>[];
  onRestore: (revision: RecoveryRevision<T>) => void;
  onClose: () => void;
  onOpenDisk?: () => void;
};

export function RecoveryHistoryPanel<T>({ revisions, onRestore, onClose, onOpenDisk }: Props<T>) {
  return (
    <aside className="floating-pro-panel recovery-panel" aria-label="Autosave history">
      <div className="floating-panel-head"><span><Clock3 size={14} /> RECOVERY HISTORY</span><button onClick={onClose} aria-label="Close recovery history"><X size={14} /></button></div>
      <p>ScenePilot keeps the last 20 recoverable edit states, including timelines, compositions, audio automation and media-bin organization. Source files relink from the last project save.</p>
      {onOpenDisk && <button onClick={onOpenDisk}>Recover disk autosave with media links…</button>}
      <div className="recovery-list">
        {revisions.map((revision) => <button key={revision.id} onClick={() => onRestore(revision)}><RotateCcw size={13} /><span><strong>{revision.label}</strong><small>{new Date(revision.savedAt).toLocaleString()}</small></span></button>)}
        {!revisions.length && <span className="recovery-empty">The first autosave appears after an edit is idle for 12 seconds.</span>}
      </div>
    </aside>
  );
}
