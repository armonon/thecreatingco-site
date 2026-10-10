// The analysis facts that change pixels: accented beats (bigger punches) and the
// resolved drop the auto drop ramp slows into. Live analysis is heavy and is
// cleared by many edits; these few numbers are kept and saved with the project,
// so reopening a document — in Pro or through the native translator — renders
// the same accents and drop ramp as the session that saved it.
import type { AnalysisResult } from "./analysis-engine.ts";
import { deriveEnergyArc } from "./arc.ts";
import { deriveBarGrid } from "./sequencer.ts";

export type RenderAnalysis = {
  /** Accented beats (downbeats), sorted ascending; a subset of the beat grid. */
  accents: number[];
  /** The drop the auto drop ramp lands on, or null when the song has no pronounced drop. */
  dropRamp: { dropTime: number } | null;
};

/** How pronounced a drop must be before the auto ramp slows into it. */
export const DROP_RAMP_MIN_STRENGTH = 0.15;

export function renderAnalysisFrom(accents: number[], arc: { dropTime: number; dropStrength: number }): RenderAnalysis {
  return { accents, dropRamp: arc.dropStrength > DROP_RAMP_MIN_STRENGTH ? { dropTime: arc.dropTime } : null };
}

export function deriveRenderAnalysis(analysis: AnalysisResult, beats: number[]): RenderAnalysis {
  return renderAnalysisFrom(deriveBarGrid(beats, analysis.signals).downbeats, deriveEnergyArc(analysis.signals, analysis.duration));
}

/** Read an untrusted saved value; anything malformed is dropped, never guessed. */
export function coerceRenderAnalysis(raw: unknown): RenderAnalysis | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (!Array.isArray(source.accents) || source.accents.length > 100_000) return null;
  const accents = source.accents.filter((time): time is number => typeof time === "number" && Number.isFinite(time) && time >= 0);
  if (accents.length !== source.accents.length) return null;
  accents.sort((a, b) => a - b);
  const drop = source.dropRamp as Record<string, unknown> | null | undefined;
  const dropTime = drop && typeof drop === "object" ? drop.dropTime : undefined;
  if (drop != null && !(typeof dropTime === "number" && Number.isFinite(dropTime) && dropTime >= 0)) return null;
  return { accents, dropRamp: typeof dropTime === "number" ? { dropTime } : null };
}

/** Carry the facts through a timeline edit that moves or removes time. */
export function remapRenderAnalysis(value: RenderAnalysis, map: (time: number) => number | null): RenderAnalysis {
  const accents = value.accents.flatMap((time) => { const next = map(time); return next === null ? [] : [next]; });
  const dropTime = value.dropRamp ? map(value.dropRamp.dropTime) : null;
  return { accents, dropRamp: dropTime === null ? null : { dropTime } };
}
