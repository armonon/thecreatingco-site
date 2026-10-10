/** Fullscreen is a shell action, never part of a serializable render plan. */
export function toggleEditorFullscreen(target: HTMLElement | null, setStatus: (message: string) => void) {
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    return;
  }
  const element = target as (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
  const request = element?.requestFullscreen?.bind(element) ?? element?.webkitRequestFullscreen?.bind(element);
  if (!request) { setStatus("Fullscreen isn't available in this browser or view."); return; }
  Promise.resolve(request()).catch(() => setStatus("Fullscreen was blocked for this page. If it's embedded, open it in its own tab."));
}
