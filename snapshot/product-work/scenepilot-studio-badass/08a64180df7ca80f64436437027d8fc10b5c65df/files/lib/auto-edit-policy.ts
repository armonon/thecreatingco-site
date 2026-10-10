import type { BaseCut } from "./sequencer.ts";

export type AutoTiming = "auto" | "music" | "scenes" | "dialogue" | "hybrid";
export type SourceRule = { assetId: string; priority: number; exclude: boolean; inPoint: number; outPoint?: number };
export type AutoEditPolicy = {
  timing: AutoTiming; targetDuration: number; minShot: number; maxShot: number;
  noRepeat: boolean; preserveDialogue: boolean; range?: { start: number; end: number };
  sources: SourceRule[];
  /** Explicit source-boundary review, persisted independently of re-analysis. */
  sceneBoundaries?: number[];
};
export const DEFAULT_AUTO_POLICY: AutoEditPolicy = {
  timing: "auto", targetDuration: 0, minShot: .25, maxShot: 12,
  noRepeat: false, preserveDialogue: true, sources: [],
};
export type CutEvidence = { reason: string; confidence: number; alternatives: string[] };
export type ExplainedCut = BaseCut & { editorial?: CutEvidence };

export function validateAutoPolicy(policy: AutoEditPolicy) {
  if (![policy.minShot, policy.maxShot, policy.targetDuration].every(Number.isFinite) || policy.minShot < .04 || policy.maxShot < policy.minShot || policy.targetDuration < 0) throw new Error("Use valid shot lengths (minimum ≥ 0.04 seconds, maximum ≥ minimum) and a nonnegative target duration.");
  if (policy.range && (!Number.isFinite(policy.range.start) || !Number.isFinite(policy.range.end) || policy.range.start < 0 || policy.range.end <= policy.range.start)) throw new Error("Rebuild range must end after its start.");
  for (const source of policy.sources) if (!Number.isFinite(source.inPoint) || source.inPoint < 0 || !Number.isFinite(source.priority) || (source.outPoint != null && (!Number.isFinite(source.outPoint) || source.outPoint <= source.inPoint))) throw new Error("Source keep ranges must have a valid in point and a later out point.");
  if(policy.sceneBoundaries?.some(t=>!Number.isFinite(t)||t<=0)) throw new Error("Scene boundaries must use positive source timestamps.");
  return policy;
}

export function resolveAutoTiming(policy: AutoTiming, audioOnly: boolean, reliableRhythm: boolean, hasTranscript: boolean): { mode: Exclude<AutoTiming, "auto">; reason: string } {
  if (policy !== "auto") return { mode: policy, reason: "Editor-selected timing; automatic classification will not override it." };
  if (hasTranscript && reliableRhythm) return { mode: "hybrid", reason: "Reviewed transcript and reliable rhythm: preserve phrases, use music in the gaps." };
  if (hasTranscript) return { mode: "dialogue", reason: "Transcript available: prioritize complete spoken phrases." };
  if (reliableRhythm) return { mode: "music", reason: "Reliable rhythmic evidence found in the source soundtrack." };
  return { mode: audioOnly ? "music" : "scenes", reason: audioOnly ? "Audio source; correct the low-confidence beat map before making a rhythm cut." : "No reliable rhythm or transcript: follow visual scenes and action." };
}


/** Pick a whole usable window, scoring all samples rather than just its first frame. */
export function bestMoment(start: number, end: number, length: number, samples: Array<{ time: number; motion: number; sharpness?: number; brightness: number }>, phrases: Array<{ start: number; end: number }> = []) {
  const width = Math.min(length, end-start);
  const options = [start, ...samples.filter(p => p.time >= start && p.time < end).map(p => Math.max(start, Math.min(end-width, p.time-width*.35)))];
  const safe = options.filter(t => !phrases.some(p => (t > p.start && t < p.end) || (t+width > p.start && t+width < p.end)));
  if (!safe.length) return null;
  return safe.map(time => {
    const inside = samples.filter(p => p.time >= time && p.time < time+width);
    const score = inside.reduce((sum,p) => sum + Math.min(1,p.motion*3)*.4 + (p.sharpness ?? .5)*.35 + (1-Math.abs(p.brightness-.5)*2)*.25,0) / Math.max(1,inside.length);
    return { time, score };
  }).sort((a,b) => b.score-a.score || a.time-b.time)[0];
}
