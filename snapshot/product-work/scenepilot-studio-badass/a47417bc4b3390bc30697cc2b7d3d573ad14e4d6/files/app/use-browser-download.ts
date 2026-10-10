import { useEffect, useRef, useState } from "react";
import { createBrowserDownloadSlot, type BrowserDownload } from "../lib/browser-download.ts";

export function useBrowserDownload() {
  const slot = useRef<ReturnType<typeof createBrowserDownloadSlot> | null>(null);
  if (slot.current === null) { slot.current = createBrowserDownloadSlot(); }
  const [download, setDownload] = useState<BrowserDownload | null>(null);
  useEffect(() => {
    const owner = slot.current;
    return () => owner?.clear();
  }, []);
  return {
    download,
    ready(blob: Blob, name: string) { setDownload(slot.current!.replace(blob, name)); },
    dismiss() { slot.current!.clear(); setDownload(null); },
  };
}
