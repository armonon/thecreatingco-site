// Registers the ScenePilot service worker (/sw.js, scope /) for the editor and
// the film tools, and reports two events to the UI:
//   "offline-ready"    first install finished: the app now works offline.
//   "update-available" a new version is installed and waiting. It only takes
//                      over when the user accepts (applyUpdate) — never mid-edit.
// Older builds registered the same script with scope /app/; that registration
// is removed so one worker serves both /app/ and /tools/.

export type PwaState = { offlineReady: boolean; updateAvailable: boolean };
type Listener = (state: PwaState) => void;

let state: PwaState = { offlineReady: false, updateAvailable: false };
let registration: ServiceWorkerRegistration | null = null;
let started = false;
const listeners = new Set<Listener>();

const emit = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
};

export function subscribePwa(listener: Listener) {
  listeners.add(listener);
  listener(state);
  return () => { listeners.delete(listener); };
}

export function pwaSupported() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (window.location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return !navigator.userAgent.includes("ScenePilotDesktop/");
}

/** Call once per page. `allowLocalhost` lets tests exercise the worker locally. */
export async function registerPwa(options: { allowLocalhost?: boolean } = {}) {
  if (started || !pwaSupported()) return;
  const local = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  // Local dev servers skip the worker unless a test opts in (?pwa once per origin).
  if (local && new URLSearchParams(window.location.search).has("pwa")) { try { localStorage.setItem("scenepilot:pwa", "1"); } catch { /* private mode */ } }
  const optedIn = (() => { try { return localStorage.getItem("scenepilot:pwa") === "1"; } catch { return false; } })();
  if (local && !options.allowLocalhost && !optedIn) return;
  started = true;
  const container = navigator.serviceWorker;
  const hadController = Boolean(container.controller);
  try {
    let legacy = false;
    for (const existing of await container.getRegistrations()) {
      if (new URL(existing.scope).pathname === "/app/") { legacy = true; await existing.unregister(); }
    }
    // The old worker keeps filling its cache while it still controls this page;
    // drop that cache on the first load it no longer controls.
    if (!legacy && "caches" in window) void caches.delete("scenepilot-standalone-v3").catch(() => undefined);
    registration = await container.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    return;
  }
  if (!registration) return; // blocked by policy / automation: run as a plain web page
  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    const check = () => {
      if (worker.state !== "installed") return;
      // Waiting behind an active worker of this registration = an update.
      if (registration?.active && registration.active !== worker) emit({ updateAvailable: true });
      else emit({ offlineReady: true });
    };
    worker.addEventListener("statechange", check);
    check();
  };
  if (registration.waiting && registration.active) emit({ updateAvailable: true });
  watch(registration.installing);
  registration.addEventListener("updatefound", () => watch(registration?.installing ?? null));
  if (!hadController) {
    container.ready.then(() => { if (!state.updateAvailable) emit({ offlineReady: true }); }).catch(() => undefined);
  }
  // Re-check for a new deploy when the tab comes back to the foreground.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
  });
}

/** Activate the waiting worker and reload once it controls the page. */
export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) { window.location.reload(); return; }
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  waiting.postMessage({ type: "SKIP_WAITING" });
}

export function dismissOfflineReady() {
  emit({ offlineReady: false });
}
