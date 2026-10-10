// Best-take selection — the "you shot it five times, I kept the good one" magic.
// When consecutive takes say nearly the same thing (a reshoot of the same line),
// keep the highest-quality one and drop the rest. Pure + deterministic, so the
// story auto-cut (lib/story-edit.ts) can thin retakes before it assembles.

export type SpeechRegion = { start: number; end: number };

export type Take = {
  priority?: number;
  id: string;
  duration: number;
  /** Spoken regions (from the transcript). */
  speech?: SpeechRegion[];
  /** The take's transcript text, used to spot reshoots of the same line. */
  transcript?: string;
};

/**
 * A 0..1 quality score for a take: rewards substance (enough actual speech),
 * fluency (not chopped into many gaps), and coverage (little dead air). A silent
 * take (B-roll) scores low-but-nonzero so it survives when nothing better exists.
 */
export function takeQuality(take: Take): number {
  const duration = Math.max(0, take.duration);
  if (duration <= 0) return 0;
  const speech = (take.speech ?? []).filter((region) => region.end > region.start);
  if (!speech.length) return 0.1;
  const spoken = speech.reduce((sum, region) => sum + (region.end - region.start), 0);
  const coverage = Math.min(1, spoken / duration);
  const gaps = Math.max(0, speech.length - 1);
  const fluency = 1 / (1 + gaps * 0.15);
  // Substance gates the whole score: a blip of speech (a false start) can't ride
  // a trivially-"fluent" single region to a good rank — it needs real talking.
  const substance = Math.min(1, spoken / 1.5);
  const base = coverage * 0.5 + fluency * 0.5;
  return Math.max(0, Math.min(1, base * (0.4 + 0.6 * substance)));
}

const tokenize = (text: string | undefined) =>
  new Set(String(text ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));

/** Jaccard similarity of two transcripts, 0..1. Two empty strings match; one
 *  empty vs non-empty does not. */
export function transcriptSimilarity(a: string | undefined, b: string | undefined): number {
  const first = tokenize(a);
  const second = tokenize(b);
  if (!first.size && !second.size) return 1;
  if (!first.size || !second.size) return 0;
  let intersection = 0;
  for (const token of first) if (second.has(token)) intersection++;
  return intersection / (first.size + second.size - intersection);
}

export type TakeSelectionOptions = {
  /** Transcript similarity (0..1) above which consecutive takes are the same line. */
  similarity?: number;
};

export type TakeSelection = {
  kept: Take[];
  dropped: Array<{ take: Take; keptId: string }>;
};

/**
 * Keep the best of each run of consecutive same-line takes. Two takes count as
 * the same line when BOTH have transcripts that are similar enough — so B-roll
 * and distinct lines are never merged. Within a run, the highest takeQuality wins
 * (ties keep the earlier take). Order is preserved. Pure + deterministic.
 */
export function pickBestTakes(takes: Take[], options: TakeSelectionOptions = {}): TakeSelection {
  const threshold = options.similarity ?? 0.6;
  const kept: Take[] = [];
  const dropped: Array<{ take: Take; keptId: string }> = [];
  let group: Take[] = [];

  const sameLine = (a: Take, b: Take) =>
    Boolean(a.transcript?.trim()) && Boolean(b.transcript?.trim())
    && transcriptSimilarity(a.transcript, b.transcript) >= threshold;

  const flush = () => {
    if (!group.length) return;
    let best = group[0];
    for (const take of group) if (takeQuality(take)+(take.priority ?? 1)*.3 > takeQuality(best)+(best.priority ?? 1)*.3) best = take;
    kept.push(best);
    for (const take of group) if (take.id !== best.id) dropped.push({ take, keptId: best.id });
    group = [];
  };

  for (const take of takes) {
    if (group.length && !sameLine(group[group.length - 1], take)) flush();
    group.push(take);
  }
  flush();
  return { kept, dropped };
}
