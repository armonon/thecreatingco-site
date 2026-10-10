import type { RenderJob } from "./pro-editor.ts";

export function isPendingRender(status: RenderJob["status"]): boolean {
  return ["queued", "preparing", "awaiting-destination", "rendering", "finalizing"].includes(status);
}
export function renderStageLabel(status: RenderJob["status"]): string {
  return status === "awaiting-destination" ? "CHOOSE DESTINATION" : status.toUpperCase();
}
/** Progress is meaningless until frames/PCM are actually being produced. */
export function renderShowsProgress(status: RenderJob["status"]): boolean {
  return status === "rendering" || status === "finalizing" || status === "completed";
}
