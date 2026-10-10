// AutoCut — music analysis. A thin, pure layer over ScenePilot's existing beat
// engine (onset DSP, octave-robust tempo, DP beat tracker, neural downbeats,
// novelty-based structure, director energy arc) that turns decoded mono PCM
// into the map the AutoCut generator cuts against: beats, downbeats, bars, an
// energy curve, the drop, and labelled section *guesses*.
//
// Nothing here touches the DOM, so the same code runs in the browser and in the
// synthetic-signal tests.

import type { SignalPoint } from "./analysis-engine.ts";
import { deriveEnergyArc } from "./arc.ts";
import { beatsToTimeline, trackBeats } from "./beat-tracker.ts";
import { detectDownbeats } from "./downbeat-model.ts";
import { createOnsetAccumulator, FRAME_SIZE, HOP_SIZE, rawToSignals } from "./onset-dsp.ts";
import { computeStructureBoundaries } from "./structure.ts";
import { estimateTempo } from "./tempo.ts";

export type SectionLabel = "intro" | "verse" | "build" | "chorus" | "drop" | "break" | "outro";

export const SECTION_LABELS: Record<SectionLabel, string> = {
  intro: "Intro",
  verse: "Verse",
  build: "Build",
  chorus: "Chorus",
  drop: "Drop",
  break: "Break",
  outro: "Outro",
};

export type MusicSection = {
  id: string;
  index: number;
  start: number;
  end: number;
  /** Mean of the normalised energy curve over the section, 0..1. */
  energy: number;
  label: SectionLabel;
};

export type MusicAnalysis = {
  duration: number;
  bpm: number;
  /** 0..1 — how clearly the tempo stood out. Below ~0.08 the grid is a guess. */
  tempoConfidence: number;
  beats: number[];
  downbeats: number[];
  beatsPerBar: number;
  meterConfidence: number;
  /** Normalised 0..1 intensity curve sampled every `energyStep` seconds. */
  energy: number[];
  energyStep: number;
  dropTime: number;
  dropStrength: number;
  sections: MusicSection[];
  /** False when the audio had no usable rhythm and the grid is a plain 120 BPM tiling. */
  reliable: boolean;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
}

/** Down-mix any number of channels to one. */
export function mixToMono(channels: ArrayLike<number>[], length = channels[0]?.length ?? 0): Float32Array {
  const mono = new Float32Array(length);
  if (!channels.length) return mono;
  const gain = 1 / channels.length;
  for (const channel of channels) for (let index = 0; index < length; index++) mono[index] += (channel[index] || 0) * gain;
  return mono;
}

/** Linear-interpolated value of a regularly sampled curve. */
export function sampleCurve(values: number[], step: number, time: number): number {
  if (!values.length || !Number.isFinite(time)) return 0.5;
  const position = time / step;
  const index = Math.floor(position);
  if (index < 0) return values[0];
  if (index >= values.length - 1) return values[values.length - 1];
  const frac = position - index;
  return values[index] * (1 - frac) + values[index + 1] * frac;
}

export function energyAt(music: Pick<MusicAnalysis, "energy" | "energyStep">, time: number) {
  return sampleCurve(music.energy, music.energyStep, time);
}

export function sectionAt(music: Pick<MusicAnalysis, "sections">, time: number): MusicSection | undefined {
  const { sections } = music;
  for (let index = sections.length - 1; index >= 0; index--) if (time >= sections[index].start - 1e-6) return sections[index];
  return sections[0];
}

function nearest(values: number[], time: number) {
  let best = values[0];
  for (const value of values) if (Math.abs(value - time) < Math.abs(best - time)) best = value;
  return best;
}

/**
 * Name the sections. These are guesses from energy shape and position — there
 * is no lyric or harmony analysis — so the UI labels them as such:
 * - the loudest section that arrives after a rise and holds the arc's drop is the DROP,
 * - other high-energy sections are CHORUS,
 * - a quiet opener is the INTRO, a quiet closer the OUTRO, quiet middles are BREAKs,
 * - a mid section that rises into a chorus/drop is a BUILD, the rest are VERSEs.
 */
export function labelSections(
  spans: Array<{ start: number; end: number; energy: number }>,
  drop: { time: number; strength: number },
): MusicSection[] {
  const energies = spans.map((span) => span.energy);
  const lowest = Math.min(...energies);
  const spread = Math.max(...energies) - lowest;
  // Rank thresholds, but never call a section "high" unless it's in the top
  // half of the actual range (and "low" only in the bottom third), so three
  // sections of [quiet, LOUD, quiet] don't promote a quiet one to chorus.
  const high = Math.max(quantile(energies, 0.66), lowest + spread * 0.65);
  const low = Math.min(quantile(energies, 0.34), lowest + spread * 0.3);
  const flat = spans.length < 2 || spread < 0.12;
  const labels: SectionLabel[] = spans.map((span, index) => {
    const last = index === spans.length - 1;
    if (flat) return index === 0 && spans.length > 2 ? "intro" : last && spans.length > 2 ? "outro" : "verse";
    if (index === 0 && span.energy < high) return "intro";
    if (last && span.energy < high && spans.length > 2) return "outro";
    if (span.energy >= high) return "chorus";
    if (span.energy <= low) return "break";
    return "verse";
  });
  if (!flat && drop.strength > 0.2) {
    const dropIndex = spans.findIndex((span) => drop.time >= span.start - 0.5 && drop.time < span.end);
    if (dropIndex >= 0 && labels[dropIndex] === "chorus") labels[dropIndex] = "drop";
  }
  for (let index = 1; index < labels.length - 1; index++) {
    const next = labels[index + 1];
    if ((labels[index] === "verse" || labels[index] === "break") && (next === "chorus" || next === "drop")
      && spans[index].energy >= spans[index - 1].energy - 0.02) labels[index] = "build";
  }
  return spans.map((span, index) => ({ id: `section-${index}`, index, start: span.start, end: span.end, energy: span.energy, label: labels[index] }));
}

function evenGrid(duration: number, bpm = 120) {
  const period = 60 / bpm;
  return Array.from({ length: Math.floor(duration / period) + 1 }, (_, index) => index * period);
}

export type AnalyzeMusicOptions = {
  minBpm?: number;
  maxBpm?: number;
  /** Whether the audio has real transients. When omitted it's judged from the normalised onsets. */
  rhythmic?: boolean;
};

/**
 * Loudness-change boundaries: where the mean energy over the next `window`
 * seconds differs from the previous `window` by more than `jump`. The texture
 * novelty in lib/structure.ts is deliberately loudness-blind (cosine of band
 * features), so a verse → chorus that's "the same, but louder" needs this.
 */
export function energyBoundaries(energy: number[], step: number, window = 4, jump = 0.22): Array<{ time: number; score: number }> {
  const lag = Math.max(1, Math.round(window / step));
  const scores: number[] = energy.map((_, index) => {
    if (index < lag || index + lag > energy.length) return 0;
    let before = 0, after = 0;
    for (let k = 1; k <= lag; k++) { before += energy[index - k]; after += energy[index + k - 1]; }
    return Math.abs(after - before) / lag;
  });
  const peaks: Array<{ time: number; score: number }> = [];
  for (let index = 1; index < scores.length - 1; index++) {
    if (scores[index] >= jump && scores[index] >= scores[index - 1] && scores[index] > scores[index + 1]) peaks.push({ time: index * step, score: scores[index] });
  }
  return peaks.sort((a, b) => b.score - a.score);
}

/** Build the beat/bar/section map from signals already computed elsewhere. */
export function analyzeSignals(signals: SignalPoint[], frameRate: number, duration: number, options: AnalyzeMusicOptions = {}): MusicAnalysis {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const onset = signals.map((point) => point.onset);
  const energyValues = signals.map((point) => point.energy);
  const rhythmic = (options.rhythmic ?? true) && onset.length > Math.ceil((60 / 72) * frameRate) * 2
    && quantile(onset, 0.95) - quantile(onset, 0.5) > 0.05 && quantile(energyValues, 0.9) > 0.01;

  let bpm = 120;
  let tempoConfidence = 0;
  let beats: number[];
  if (rhythmic) {
    const tempo = estimateTempo(onset, frameRate, options.minBpm, options.maxBpm);
    bpm = tempo.bpm;
    tempoConfidence = tempo.confidence;
    const beatFrames = trackBeats(onset, (60 / bpm) * frameRate);
    const tracked = beatsToTimeline(beatFrames, frameRate, safeDuration);
    beats = tracked.length >= 2 ? tracked : evenGrid(safeDuration, bpm);
  } else {
    beats = evenGrid(safeDuration);
  }
  beats = beats.filter((beat) => beat >= 0 && beat < safeDuration);
  const meter = detectDownbeats(beats, signals);

  const arc = deriveEnergyArc(signals, safeDuration, 0.25);
  const energy = arc.samples.length ? arc.samples : [0.5, 0.5];

  // Structure: novelty boundaries, gap scaled to the song length so a 30 s
  // social clip still gets sections and a 4 min song doesn't get 20.
  const minGap = clamp(safeDuration / 8, 5, 12);
  const maxSections = Math.round(clamp(safeDuration / 8, 2, 12));
  const boundaries = computeStructureBoundaries(signals, safeDuration, { minGap, maxSections });
  for (const peak of energyBoundaries(energy, arc.step)) {
    if (boundaries.length >= maxSections + 1) break;
    if (peak.time > minGap * 0.5 && peak.time < safeDuration - minGap * 0.5
      && boundaries.every((boundary) => Math.abs(boundary - peak.time) >= minGap * 0.75)) boundaries.push(peak.time);
  }
  boundaries.sort((a, b) => a - b);
  // A texture-uniform track still needs a few sections to vary the edit across.
  const minSections = Math.round(clamp(safeDuration / 40, 1, 4));
  while (boundaries.length - 1 < minSections) {
    let index = 1, widest = 0;
    for (let i = 1; i < boundaries.length; i++) {
      const width = boundaries[i] - boundaries[i - 1];
      if (width > widest) { widest = width; index = i; }
    }
    if (widest < minGap * 1.5) break;
    boundaries.splice(index, 0, boundaries[index - 1] + widest / 2);
  }
  // Sections start on the "1": snap interior boundaries to the nearest downbeat.
  const bar = (60 / bpm) * meter.beatsPerBar;
  const snapped = [0];
  for (const boundary of boundaries.slice(1, -1)) {
    const target = meter.downbeats.length ? nearest(meter.downbeats, boundary) : boundary;
    const time = Math.abs(target - boundary) <= bar * 0.75 ? target : boundary;
    if (time - snapped[snapped.length - 1] >= Math.max(2, bar) && safeDuration - time >= Math.max(2, bar)) snapped.push(time);
  }
  snapped.push(safeDuration);
  const spans = snapped.slice(0, -1).map((start, index) => {
    const end = snapped[index + 1];
    const from = Math.floor(start / arc.step);
    const to = Math.max(from + 1, Math.ceil(end / arc.step));
    const slice = energy.slice(from, Math.min(energy.length, to));
    return { start, end, energy: slice.length ? slice.reduce((sum, value) => sum + value, 0) / slice.length : 0.5 };
  });
  const sections = labelSections(spans, { time: arc.dropTime, strength: arc.dropStrength });

  return {
    duration: safeDuration,
    bpm,
    tempoConfidence,
    beats,
    downbeats: meter.downbeats,
    beatsPerBar: meter.beatsPerBar,
    meterConfidence: meter.confidence,
    energy,
    energyStep: arc.step,
    dropTime: arc.dropTime,
    dropStrength: arc.dropStrength,
    sections,
    reliable: rhythmic && tempoConfidence >= 0.08,
  };
}

/** Full path: decoded mono PCM in, AutoCut music map out. */
export function analyzeMusic(mono: Float32Array, sampleRate: number, options: AnalyzeMusicOptions = {}): MusicAnalysis {
  const duration = mono.length / sampleRate;
  // Same DSP as the editor's analyser (lib/onset-dsp.ts), kept raw a moment so
  // a steady tone or silence — whose *normalised* onsets are just amplified
  // noise — isn't mistaken for rhythm.
  const accumulator = createOnsetAccumulator();
  for (let start = 0; start + FRAME_SIZE <= mono.length; start += HOP_SIZE) accumulator.push(mono, start, start + FRAME_SIZE);
  const frameRate = sampleRate / HOP_SIZE;
  const { raw } = accumulator;
  const settled = Math.min(raw.onset.length, Math.ceil(frameRate));
  const energyPeak = quantile(raw.energy, 0.9);
  const rhythmic = energyPeak > 0.0005 && quantile(raw.onset.slice(settled), 0.98) > energyPeak * 0.02;
  return analyzeSignals(rawToSignals(raw, frameRate), frameRate, duration, { rhythmic, ...options });
}

/**
 * Fix a half-/double-time reading. `factor` 2 doubles the grid (inserts the
 * off-beats), 0.5 halves it (keeps every other beat, on the downbeat phase).
 * Downbeats are kept; sections are untouched.
 */
export function rescaleTempo(music: MusicAnalysis, factor: 0.5 | 2): MusicAnalysis {
  const { beats } = music;
  if (beats.length < 2) return music;
  let next: number[];
  if (factor === 2) {
    next = [];
    for (let index = 0; index < beats.length; index++) {
      next.push(beats[index]);
      const after = beats[index + 1] ?? (index > 0 ? beats[index] + (beats[index] - beats[index - 1]) : undefined);
      if (after != null && (after + beats[index]) / 2 < music.duration) next.push((beats[index] + after) / 2);
    }
  } else {
    const firstDownbeat = music.downbeats.length ? beats.findIndex((beat) => Math.abs(beat - music.downbeats[0]) < 1e-6) : 0;
    const phase = Math.max(0, firstDownbeat) % 2;
    next = beats.filter((_, index) => index % 2 === phase);
  }
  const keep = new Set(next.map((time) => Math.round(time * 1000)));
  const downbeats = music.downbeats.filter((time) => keep.has(Math.round(time * 1000)));
  return { ...music, bpm: Math.round(music.bpm * factor), beats: next, downbeats: downbeats.length ? downbeats : music.downbeats };
}

/**
 * The best `seconds`-long excerpt for a social cut: starts on a downbeat, ends
 * on the downbeat nearest the target length, and maximises mean energy with a
 * bonus for containing the drop in its first half (so the edit lands it).
 */
export function bestWindow(music: MusicAnalysis, seconds: number): { start: number; end: number } {
  if (!(seconds > 0) || seconds >= music.duration - 0.5) return { start: 0, end: music.duration };
  const starts = (music.downbeats.length ? music.downbeats : music.beats).filter((time) => time + seconds <= music.duration + 0.01);
  if (!starts.length) return { start: 0, end: Math.min(music.duration, seconds) };
  let best = { start: starts[0], score: -Infinity };
  for (const start of starts) {
    let sum = 0, count = 0;
    for (let time = start; time < start + seconds; time += music.energyStep) { sum += energyAt(music, time); count++; }
    const mean = sum / Math.max(1, count);
    const dropPosition = (music.dropTime - start) / seconds;
    const dropBonus = dropPosition >= 0.15 && dropPosition <= 0.6 ? 0.25 * music.dropStrength + 0.05 : 0;
    const score = mean + dropBonus;
    if (score > best.score + 1e-9) best = { start, score };
  }
  const candidates = (music.downbeats.length ? music.downbeats : music.beats).filter((time) => time > best.start + seconds * 0.8 && time <= music.duration);
  const end = candidates.length ? nearest(candidates, best.start + seconds) : Math.min(music.duration, best.start + seconds);
  return { start: best.start, end };
}
