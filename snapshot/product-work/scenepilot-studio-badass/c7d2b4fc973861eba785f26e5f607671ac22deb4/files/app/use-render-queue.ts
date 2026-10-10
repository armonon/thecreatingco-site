import { useEffect, useState } from "react";
import type { RenderJob } from "../lib/pro-editor";
import { isPendingRender } from "../lib/render-job-state.ts";
import { desktopMediaBridge } from "./desktop-media.ts";

const STORAGE_KEY = "scenepilot-render-queue";

export function recoverRenderQueue(value: unknown): RenderJob[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((job): job is RenderJob => Boolean(job) && typeof job === "object" && typeof (job as RenderJob).id === "string")
    .map((job) => isPendingRender(job.status)
      ? { ...job, status: "failed" as const, message: "Restore the correct project before retrying", error: "ScenePilot closed before this render completed. Pending work is never automatically rendered from a different project." }
      : job)
    .slice(-30);
}

/** Persistent render-queue boundary for the editor shell. Native storage wins;
 * localStorage is the resilient fallback for browser development and upgrades. */
export function useRenderQueue(isPro: boolean) {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isPro) return;
    let active = true;
    const hydrate = async () => {
      try {
        const bridge = desktopMediaBridge();
        const nativeJobs = bridge?.loadRenderQueue ? await bridge.loadRenderQueue() as RenderJob[] : [];
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        const recovered = recoverRenderQueue(nativeJobs.length ? nativeJobs : parsed);
        if (active && recovered.length) setJobs(recovered);
      } catch {
        try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be denied. Native queue remains available. */ }
      } finally {
        if (active) setHydrated(true);
      }
    };
    void hydrate();
    return () => { active = false; };
  }, [isPro]);

  useEffect(() => {
    if (!isPro || !hydrated) return;
    const bounded = jobs.slice(-30);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded)); } catch { /* A full browser quota must not crash the editor or prevent native persistence. */ }
    void desktopMediaBridge()?.saveRenderQueue?.({ jobs: bounded }).catch(() => undefined);
  }, [isPro, jobs, hydrated]);

  return [jobs, setJobs] as const;
}
