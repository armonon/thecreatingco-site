import { useEffect, useRef, useState } from "react";
import { createDocumentRevision, documentChanged } from "../lib/document-revision";
import { desktopMediaBridge } from "./desktop-media";

export function useProjectSafety(model: Record<string, unknown>, busy: boolean, save: () => Promise<boolean>) {
  const revision = useRef(createDocumentRevision());
  const previous = useRef(model);
  const accepting = useRef(false);
  const [loadEpoch, setLoadEpoch] = useState(0);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (documentChanged(previous.current, model)) {
      revision.current.changed();
      setDirty(true);
    }
    previous.current = model;
    if (accepting.current) { accepting.current = false; revision.current.saved(revision.current.capture()); setDirty(false); }
  }, [model, loadEpoch]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!revision.current.dirty() && !busy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [busy]);
  useEffect(() => desktopMediaBridge()?.onAction((action) => {
    if (action === "save-and-close" && !busy) void save().then((saved) => {
      if (saved && !revision.current.dirty()) void desktopMediaBridge()?.closeWindow?.();
    });
  }), [busy, save]);
  return {
    dirty,
    capture: () => revision.current.capture(),
    markLoaded: () => { accepting.current = true; setLoadEpoch((value) => value + 1); },
    markSaved: (token: number) => { revision.current.saved(token); setDirty(revision.current.dirty()); },
    async confirmReplace() {
      if (busy) return false;
      if (!revision.current.dirty()) return true;
      const bridge = desktopMediaBridge();
      const choice = bridge?.confirmProjectReplacement
        ? await bridge.confirmProjectReplacement()
        : window.confirm("Discard unsaved changes and open another project? Cancel to save your current project first.") ? "discard" : "cancel";
      if (choice === "save") return await save() && !revision.current.dirty();
      return choice === "discard";
    },
  };
}
