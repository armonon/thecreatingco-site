"use client";

// Shared suite + PWA UI for the editor (/app/) and the film tools (/tools/):
// the <tcc-suite-menu> slot, "Save to Locker" buttons, the install button and
// the offline-ready / update-available toast. Every piece degrades to nothing
// when the suite kit or service workers are unavailable.

import { Archive, Check, Download, Loader2, RefreshCw, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type DetailedHTMLProps, type HTMLAttributes } from "react";
import { applyUpdate, dismissOfflineReady, registerPwa, subscribePwa, type PwaState } from "../lib/pwa-client";
import { currentLocker, onLockerOpen, saveToLocker, whenLocker, type Locker, type LockerFile } from "../lib/tcc-suite";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "tcc-suite-menu": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

/** Where the shared thecreateco menu renders (the kit fills it; empty otherwise). */
export function SuiteMenu() {
  // Box reserved up front (K's guidance) so the deferred kit causes no layout shift.
  return <tcc-suite-menu style={{ display: "inline-block", width: 36, height: 36, flex: "none", color: "inherit" }} />;
}

export function useLocker(): Locker | null {
  const [locker, setLocker] = useState<Locker | null>(() => currentLocker());
  useEffect(() => whenLocker(setLocker), []);
  return locker;
}

/** Runs `handler` with files other apps sent here via the Locker (?tcc-open=). */
export function useLockerOpen(handler: (file: LockerFile) => void) {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => onLockerOpen((file) => latest.current(file)), []);
}

type SaveItem = { name: string; type: string; blob: Blob; meta?: Record<string, unknown> };

export function LockerSaveButton({ item, label = "Save to Locker", className = "btn small", disabled, onSaved }: {
  item: () => SaveItem | Promise<SaveItem | null> | null;
  label?: string;
  className?: string;
  disabled?: boolean;
  onSaved?(message: string): void;
}) {
  const locker = useLocker();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [problem, setProblem] = useState("");
  if (!locker) return null;
  const save = async () => {
    setState("saving");
    try {
      const value = await item();
      if (!value) { setState("idle"); return; }
      await saveToLocker({ ...value, meta: { source: "scenepilot", ...value.meta } });
      setState("saved");
      onSaved?.(`Saved ${value.name} to your Locker (this browser, this device).`);
      window.setTimeout(() => setState("idle"), 2500);
    } catch (error) {
      setState("error");
      // The kit's error messages are written for end users (quota, popup blocked, offline…).
      const message = error instanceof Error ? error.message : "Couldn't save to the Locker.";
      setProblem(message);
      onSaved?.(`Locker: ${message}`);
    }
  };
  return (
    <button type="button" className={className} onClick={() => void save()} disabled={disabled || state === "saving"} title={state === "error" && problem ? problem : "Keep a copy in your thecreateco Locker — stored in this browser on this device, no upload"}>
      {state === "saving" ? <Loader2 size={13} className="spin" /> : state === "saved" ? <Check size={13} /> : <Archive size={13} />}
      {state === "saved" ? "Saved" : state === "error" ? "Locker failed" : label}
    </button>
  );
}

type InstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** "Install app" — only where the browser offers it (Chrome/Edge); nothing on Safari/Firefox. */
export function InstallAppButton({ className = "btn small ghost" }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", installed); };
  }, []);
  if (!prompt) return null;
  return (
    <button type="button" className={className} onClick={async () => { await prompt.prompt(); if ((await prompt.userChoice).outcome === "accepted") setPrompt(null); }} title="Install ScenePilot as an app — works offline after the first visit">
      <Download size={13} /> Install app
    </button>
  );
}

const toastStyle: CSSProperties = {
  position: "fixed", right: 16, bottom: 16, zIndex: 2147483000, display: "flex", alignItems: "center", gap: 10,
  maxWidth: "min(420px, calc(100vw - 32px))", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(13,18,17,.96)", color: "#e8efec", font: "600 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif", boxShadow: "0 12px 32px rgba(0,0,0,.45)",
};
const toastButton: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 6, border: 0, background: "#34d6c7", color: "#071311", font: "700 12px system-ui, sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const closeButton: CSSProperties = { display: "grid", placeItems: "center", width: 26, height: 26, border: 0, borderRadius: 6, background: "transparent", color: "#9aa7a3", cursor: "pointer" };

/** Registers the service worker and shows "ready offline" / "update available". */
export function PwaStatus() {
  const [state, setState] = useState<PwaState>({ offlineReady: false, updateAvailable: false });
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const unsubscribe = subscribePwa(setState);
    void registerPwa();
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!state.offlineReady || state.updateAvailable) return;
    const timer = window.setTimeout(dismissOfflineReady, 6000);
    return () => window.clearTimeout(timer);
  }, [state.offlineReady, state.updateAvailable]);
  if (state.updateAvailable && !hidden) {
    return (
      <div role="status" style={toastStyle} data-pwa="update">
        <RefreshCw size={16} />
        <span style={{ flex: 1 }}>A new version of ScenePilot is ready. Save your work, then reload.</span>
        <button type="button" style={toastButton} onClick={applyUpdate}>Update available — reload</button>
        <button type="button" style={closeButton} aria-label="Later" onClick={() => setHidden(true)}><X size={14} /></button>
      </div>
    );
  }
  if (state.offlineReady) {
    return (
      <div role="status" style={toastStyle} data-pwa="offline-ready">
        <WifiOff size={16} />
        <span style={{ flex: 1 }}>ScenePilot is ready to work offline on this device.</span>
        <button type="button" style={closeButton} aria-label="Dismiss" onClick={dismissOfflineReady}><X size={14} /></button>
      </div>
    );
  }
  return null;
}
