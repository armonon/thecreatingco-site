export type BrowserDownload = { url: string; name: string; size: number };

/** Own one completed render until it is replaced, dismissed, or the editor closes. */
export function createBrowserDownloadSlot(urls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL) {
  let current: BrowserDownload | null = null;
  const clear = () => {
    if (current) urls.revokeObjectURL(current.url);
    current = null;
  };
  return {
    replace(blob: Blob, name: string): BrowserDownload {
      if (!blob.size) throw new Error("The renderer returned an empty video. Please retry the export.");
      // Allocate first: if allocation fails, the previous successful render survives.
      const next = { url: urls.createObjectURL(blob), name, size: blob.size };
      clear();
      current = next;
      return next;
    },
    clear,
  };
}
