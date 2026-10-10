// AutoCut — the cut generator. Given the music map (lib/autocut-music.ts) and
// clip profiles (lib/autocut-clips.ts) it lays shots on the beat grid:
//
// - shot length follows energy: long holds where the song is quiet, a cut every
//   beat or two on choruses and drops (preset table × density slider);
// - every cut lands on a beat, holds of a bar or more prefer to end on the "1",
//   every section start and the drop get a fresh cut;
// - section starts get a *hero* shot (best-looking, face-bearing footage);
// - never the same clip twice in a row, unused footage preferred, used ranges
//   of a clip avoided so reused clips show different moments;
// - performance mode cuts between synced takes at their aligned source time so
//   the lip sync stays locked, mixing in B-roll by a ratio;
// - locked shots survive re-rolls; the seed makes every variation reproducible.
//
// Pure and deterministic. The shot list maps 1:1 onto ScenePilot base cuts.

import type { ClipSegment } from "./autocut-clips.ts";
import { usableCoverage, windowQuality } from "./autocut-clips.ts";
import type { MusicAnalysis, SectionLabel } from "./autocut-music.ts";
import { energyAt, sectionAt } from "./autocut-music.ts";

export type PresetId = "music-video" | "hype" | "chill" | "trailer";

export type Preset = {
  id: PresetId;
  name: string;
  blurb: string;
  /** Beats per shot at zero energy and at full energy; interpolated geometrically. */
  cold: number;
  hot: number;
  /** Allow half-beat stutter cuts at full energy and high density. */
  halfBeats: boolean;
  /** Trailer ramp: shots start long and accelerate toward the end regardless of the music. */
  ramp: boolean;
  /** 0..1 — how strongly clip visual energy is matched to music energy. */
  energyMatch: number;
  /** ±jitter on hold lengths and picks; more = looser, more varied. */
  variety: number;
};

export const PRESETS: Record<PresetId, Preset> = {
  "music-video": { id: "music-video", name: "Music video", blurb: "Two-bar shots in the verses, a cut every beat or two on the chorus.", cold: 8, hot: 2, halfBeats: false, ramp: false, energyMatch: 0.8, variety: 0.25 },
  hype: { id: "hype", name: "Hype edit", blurb: "Fast and punchy: one-beat cuts, half-beat stutters on the drop.", cold: 4, hot: 1, halfBeats: true, ramp: false, energyMatch: 1, variety: 0.3 },
  chill: { id: "chill", name: "Chill / lyric", blurb: "Long, calm holds that breathe. Room for lyrics on screen.", cold: 16, hot: 4, halfBeats: false, ramp: false, energyMatch: 0.6, variety: 0.15 },
  trailer: { id: "trailer", name: "Trailer", blurb: "Starts slow, accelerates into the end; hard cut on the drop.", cold: 16, hot: 1, halfBeats: true, ramp: true, energyMatch: 0.7, variety: 0.2 },
};

export const PRESET_ORDER: PresetId[] = ["music-video", "hype", "chill", "trailer"];

export type CutClip = {
  id: string;
  duration: number;
  segments: ClipSegment[];
  /** Visual energy 0..1. */
  energy: number;
  /** Hero potential 0..1. */
  hero: number;
  /** Synced performance take: song time where the take's t=0 plays. Undefined = free B-roll. */
  offset?: number;
};

export type Shot = {
  id: string;
  clipId: string;
  /** Song time (s). */
  start: number;
  duration: number;
  /** Clip time (s) the shot starts from. */
  sourceStart: number;
  label: SectionLabel;
  sectionIndex: number;
  hero: boolean;
  /** Lip-synced take placement (sourceStart = start - offset). */
  synced: boolean;
  locked?: boolean;
};

export type CutMusic = Pick<MusicAnalysis, "beats" | "downbeats" | "beatsPerBar" | "sections" | "energy" | "energyStep" | "dropTime" | "dropStrength" | "duration">;

export type CutRequest = {
  music: CutMusic;
  clips: CutClip[];
  preset: PresetId;
  /** 0..1, 0.5 neutral. 0 halves the cut rate, 1 doubles it. */
  density: number;
  seed: number;
  /** Song-time window to cut; defaults to the whole song. */
  range?: { start: number; end: number };
  /** Shots to keep exactly as they are. */
  locked?: Shot[];
  /** Cut between synced takes (clips with `offset`) to keep lip sync. */
  performance?: boolean;
  /** Performance mode: 0..1 share of B-roll vs takes. */
  brollMix?: number;
};

/** mulberry32 — small, fast, seedable. Same as the editor's montage reroll. */
export function seededRandom(seed: number) {
  let a = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const key = (time: number) => Math.round(time * 1000);

/** How hot a moment is for cutting: section energy blended with the local curve, nudged by the section label. */
export function cutEnergy(music: CutMusic, time: number, label: SectionLabel, sectionEnergy: number) {
  let e = 0.5 * sectionEnergy + 0.5 * energyAt(music, time);
  if (label === "drop") e = Math.max(e, 0.9);
  else if (label === "chorus") e = Math.max(e, 0.72);
  else if (label === "build") e = Math.max(e, 0.5);
  else if (label === "intro" || label === "outro" || label === "break") e = Math.min(e, 0.35);
  return clamp(e);
}

/** Beats to hold a shot. Continuous in energy, scaled by density, then quantised musically. */
export function holdBeats(preset: Preset, energy: number, density: number, beatsPerBar: number, progress = 0, jitter = 0.5): number {
  let beats = preset.cold * (preset.hot / preset.cold) ** clamp(energy);
  beats *= 2 ** (1 - 2 * clamp(density));
  if (preset.ramp) beats *= 1.6 - 1.25 * clamp(progress);
  beats *= 1 + (jitter - 0.5) * 2 * preset.variety;
  if (preset.halfBeats && beats < 0.75) return 0.5;
  let hold = Math.max(1, Math.round(beats));
  if (hold >= beatsPerBar * 1.5) hold = Math.max(beatsPerBar, Math.round(hold / beatsPerBar) * beatsPerBar);
  else if (hold >= 3) hold = Math.round(hold / 2) * 2;
  return hold;
}

type Interval = [number, number];

type Placement = {
  clip: CutClip;
  sourceStart: number;
  /** Song time the placement can run to (≤ slot end; shorter when the clip runs out). */
  end: number;
  synced: boolean;
  score: number;
};

type ChooserState = {
  previous: string;
  recent: string[];
  uses: Map<string, number>;
  heroUses: Map<string, number>;
  used: Map<string, Interval[]>;
};

function overlapFraction(intervals: Interval[] | undefined, start: number, end: number) {
  if (!intervals?.length || end <= start) return 0;
  let overlap = 0;
  for (const [a, b] of intervals) overlap += Math.max(0, Math.min(end, b) - Math.max(start, a));
  return clamp(overlap / (end - start));
}

function energyRanks(clips: CutClip[]) {
  const sorted = [...clips].sort((a, b) => a.energy - b.energy || a.id.localeCompare(b.id));
  const ranks = new Map<string, number>();
  sorted.forEach((clip, index) => ranks.set(clip.id, sorted.length > 1 ? index / (sorted.length - 1) : 0.5));
  return ranks;
}

function emptyState(): ChooserState {
  return { previous: "", recent: [], uses: new Map(), heroUses: new Map(), used: new Map() };
}

function record(state: ChooserState, shot: Pick<Shot, "clipId" | "sourceStart" | "duration" | "hero">) {
  state.previous = shot.clipId;
  state.recent = [shot.clipId, ...state.recent].slice(0, 3);
  state.uses.set(shot.clipId, (state.uses.get(shot.clipId) ?? 0) + 1);
  if (shot.hero) state.heroUses.set(shot.clipId, (state.heroUses.get(shot.clipId) ?? 0) + 1);
  const list = state.used.get(shot.clipId) ?? [];
  list.push([shot.sourceStart, shot.sourceStart + shot.duration]);
  state.used.set(shot.clipId, list);
}

/** Best in-point for a free (non-synced) clip in a slot of `need` seconds. */
function placeFree(clip: CutClip, start: number, need: number, state: ChooserState, random: () => number, allowShort: boolean) {
  const segments = clip.segments.length ? clip.segments : [];
  let best: { sourceStart: number; length: number; score: number } | null = null;
  for (const segment of segments) {
    const length = segment.end - segment.start;
    if (length >= need - 1e-6) {
      const room = length - need;
      const offsets = [0, 0.25, 0.5, 0.75, 1, random()].map((u) => segment.start + room * u);
      for (const sourceStart of offsets) {
        const reuse = overlapFraction(state.used.get(clip.id), sourceStart, sourceStart + need);
        const score = segment.quality - reuse * 0.6 + random() * 0.02;
        if (!best || score > best.score) best = { sourceStart, length: need, score };
      }
    } else if (allowShort && length >= Math.min(need, 0.4)) {
      const reuse = overlapFraction(state.used.get(clip.id), segment.start, segment.end);
      const score = segment.quality - reuse * 0.6 - (1 - length / need) * 0.6;
      if (!best || score > best.score) best = { sourceStart: segment.start, length, score };
    }
  }
  if (!best) return null;
  return { sourceStart: best.sourceStart, end: start + best.length, score: best.score };
}

/** A synced take at its locked source time, or null if it doesn't cover the slot. */
function placeSynced(clip: CutClip, start: number, end: number) {
  if (clip.offset == null) return null;
  const sourceStart = start - clip.offset;
  const sourceEnd = end - clip.offset;
  if (sourceStart < -1e-6 || sourceEnd > clip.duration + 1e-6) return null;
  const coverage = usableCoverage(clip.segments, sourceStart, sourceEnd);
  if (coverage < 0.8) return null;
  return { sourceStart: Math.max(0, sourceStart), end, score: windowQuality(clip.segments, sourceStart, sourceEnd) };
}

type Slot = { start: number; end: number; label: SectionLabel; energy: number; hero: boolean };

function makeChooser(request: CutRequest, random: () => number) {
  const preset = PRESETS[request.preset] ?? PRESETS["music-video"];
  const ranks = energyRanks(request.clips);
  const takes = request.performance ? request.clips.filter((clip) => clip.offset != null) : [];
  const broll = request.performance ? request.clips.filter((clip) => clip.offset == null) : request.clips;
  const brollMix = clamp(request.brollMix ?? 0.25);
  const brollBias: Record<SectionLabel, number> = { intro: 1.6, break: 1.5, outro: 1.3, build: 1, verse: 0.9, chorus: 0.55, drop: 0.45 };

  const score = (clip: CutClip, placement: { score: number; end: number }, slot: Slot, state: ChooserState) => {
    let value = placement.score * 0.4;
    value += (1 - Math.abs((ranks.get(clip.id) ?? 0.5) - slot.energy)) * 0.5 * preset.energyMatch;
    value -= (state.uses.get(clip.id) ?? 0) * 0.08;
    if (state.recent.slice(0, 2).includes(clip.id)) value -= 0.25;
    // Hero shots matter most where the song hits; a quiet intro still opens on
    // something good-looking, but calm.
    if (slot.hero) value += clip.hero * (0.2 + 0.5 * slot.energy) - (state.heroUses.get(clip.id) ?? 0) * 0.25;
    value -= (1 - (placement.end - slot.start) / Math.max(1e-6, slot.end - slot.start)) * 0.5;
    value += (random() - 0.5) * (0.2 + preset.variety);
    return value;
  };

  const rank = (pool: CutClip[], slot: Slot, state: ChooserState, options: { exclude?: Set<string>; allowShort: boolean; synced: boolean }): Placement[] => {
    const need = slot.end - slot.start;
    const results: Placement[] = [];
    for (const clip of pool) {
      if (options.exclude?.has(clip.id)) continue;
      const placement = options.synced ? placeSynced(clip, slot.start, slot.end) : placeFree(clip, slot.start, need, state, random, options.allowShort);
      if (!placement) continue;
      results.push({ clip, sourceStart: placement.sourceStart, end: placement.end, synced: options.synced, score: score(clip, placement, slot, state) });
    }
    return results.sort((a, b) => b.score - a.score);
  };

  /** Ranked placements for a slot; the first is the pick. Never the previous clip when there's any alternative. */
  const candidates = (slot: Slot, state: ChooserState, exclude = new Set<string>(), allowShort = true): Placement[] => {
    const avoid = new Set([...exclude, state.previous]);
    const trySets: Array<{ pool: CutClip[]; synced: boolean }> = [];
    if (takes.length) {
      const wantBroll = broll.length > 0 && !(slot.hero && (slot.label === "chorus" || slot.label === "drop"))
        && random() < brollMix * brollBias[slot.label];
      const order = wantBroll ? [{ pool: broll, synced: false }, { pool: takes, synced: true }] : [{ pool: takes, synced: true }, { pool: broll, synced: false }];
      trySets.push(...order);
    } else {
      trySets.push({ pool: broll, synced: false });
    }
    for (const set of trySets) {
      const ranked = rank(set.pool, slot, state, { exclude: avoid, allowShort, synced: set.synced });
      if (ranked.length) return ranked;
    }
    // Nothing fresh fits: allow the previous clip (one-clip pools), then raw time.
    for (const set of trySets) {
      const ranked = rank(set.pool, slot, state, { exclude, allowShort, synced: set.synced });
      if (ranked.length) return ranked;
    }
    return [];
  };

  return { candidates };
}

/** Generate a cut. Deterministic for a given request (including seed). */
export function generateCut(request: CutRequest): Shot[] {
  const { music } = request;
  const preset = PRESETS[request.preset] ?? PRESETS["music-video"];
  const random = seededRandom(request.seed);
  const rangeStart = clamp(request.range?.start ?? 0, 0, music.duration);
  const rangeEnd = clamp(request.range?.end ?? music.duration, rangeStart, music.duration);
  if (rangeEnd - rangeStart < 0.1 || !request.clips.length) return [];
  const span = rangeEnd - rangeStart;
  const beatsPerBar = music.beatsPerBar || 4;

  const inside = (time: number) => time > rangeStart + 0.05 && time < rangeEnd - 0.05;
  const points = [rangeStart, ...music.beats.filter(inside), rangeEnd];
  const nearestPoint = (time: number) => points.reduce((best, point) => Math.abs(point - time) < Math.abs(best - time) ? point : best, points[0]);

  const forced = new Set<number>();
  const sectionStarts = new Set<number>([key(rangeStart)]);
  for (const section of music.sections) {
    if (!inside(section.start)) continue;
    const point = nearestPoint(section.start);
    forced.add(key(point));
    sectionStarts.add(key(point));
  }
  if (music.dropStrength > 0.15 && inside(music.dropTime)) {
    const downbeats = music.downbeats.filter(inside);
    const target = downbeats.length ? downbeats.reduce((best, time) => Math.abs(time - music.dropTime) < Math.abs(best - music.dropTime) ? time : best, downbeats[0]) : nearestPoint(music.dropTime);
    forced.add(key(nearestPoint(target)));
    sectionStarts.add(key(nearestPoint(target)));
  }
  const locked = (request.locked ?? [])
    .filter((shot) => shot.start >= rangeStart - 1e-6 && shot.start + shot.duration <= rangeEnd + 1e-6 && request.clips.some((clip) => clip.id === shot.clipId))
    .sort((a, b) => a.start - b.start)
    .filter((shot, index, list) => index === 0 || shot.start >= list[index - 1].start + list[index - 1].duration - 1e-6);
  for (const shot of locked) {
    for (const time of [shot.start, shot.start + shot.duration]) {
      if (!points.some((point) => Math.abs(point - time) < 1e-3)) points.push(time);
      forced.add(key(points.find((point) => Math.abs(point - time) < 1e-3) ?? time));
    }
  }
  points.sort((a, b) => a - b);
  const downbeatKeys = new Set(music.downbeats.map(key));
  const isForced = (time: number) => forced.has(key(time));

  // Each slot draws from its own stream keyed by (seed, slot start), so locking
  // or editing one shot doesn't reshuffle the randomness of every later shot.
  let slotRandom = random;
  const chooser = makeChooser(request, () => slotRandom());
  const state = emptyState();
  const shots: Shot[] = [];
  let index = 0;
  let guard = 0;
  while (index < points.length - 1 && guard++ < 100000) {
    const start = points[index];
    const lock = locked.find((shot) => Math.abs(shot.start - start) < 1e-3);
    if (lock) {
      const shot = { ...lock, locked: true };
      shots.push(shot);
      record(state, shot);
      const end = lock.start + lock.duration;
      const next = points.findIndex((point) => Math.abs(point - end) < 1e-3);
      index = next > index ? next : index + 1;
      continue;
    }
    slotRandom = seededRandom((Math.imul(request.seed | 0, 7919) + key(start)) | 0);
    const section = sectionAt(music, start + 1e-3) ?? { label: "verse" as SectionLabel, energy: 0.5, index: 0 };
    const energy = cutEnergy(music, start, section.label, section.energy);
    const hold = holdBeats(preset, energy, request.density, beatsPerBar, (start - rangeStart) / span, slotRandom());

    let end: number;
    let next: number;
    if (hold === 0.5 && points[index + 1] - start > 0.2) {
      // Half-beat stutter: split this beat.
      end = (start + points[index + 1]) / 2;
      points.splice(index + 1, 0, end);
      next = index + 1;
    } else {
      next = Math.min(points.length - 1, index + Math.max(1, Math.round(hold)));
      // Holds of two beats or more prefer to end on a downbeat: the nearest "1"
      // within half the hold either way (so off-phase shots re-align to the bar).
      if (hold >= 2 && !downbeatKeys.has(key(points[next]))) {
        const reach = Math.max(1, Math.floor(hold / 2));
        for (let distance = 1; distance <= reach; distance++) {
          const probe = [next + distance, next - distance].find((candidate) => candidate > index && candidate < points.length && downbeatKeys.has(key(points[candidate])));
          if (probe != null) { next = probe; break; }
        }
      }
      // Never run through a section start, the drop, or a locked shot.
      for (let probe = index + 1; probe < next; probe++) if (isForced(points[probe])) { next = probe; break; }
      // Don't leave a sliver before the next forced point / the end.
      const following = points.findIndex((point, probe) => probe > next && isForced(point));
      const boundary = following >= 0 ? following : points.length - 1;
      if (boundary > next && points[boundary] - points[next] < 0.35) next = boundary;
      end = points[next];
    }

    const slot: Slot = { start, end, label: section.label, energy, hero: sectionStarts.has(key(start)) };
    const ranked = chooser.candidates(slot, state);
    if (!ranked.length) { index = next; continue; }
    const pick = ranked[0];
    if (pick.end < end - 1e-3) {
      // The clip runs out early: end the shot on the last grid point it covers,
      // or exactly where it runs out when that's inside the first beat.
      let shortened = -1;
      for (let probe = next - 1; probe > index; probe--) if (points[probe] <= pick.end + 1e-6) { shortened = probe; break; }
      if (shortened > index) next = shortened;
      else { points.splice(index + 1, 0, pick.end); next = index + 1; }
      end = points[next];
    }
    const previous = shots[shots.length - 1];
    if (previous && pick.synced && previous.synced && previous.clipId === pick.clip.id && !previous.locked
      && Math.abs(previous.start + previous.duration - start) < 1e-3 && !slot.hero) {
      // Same take continuing: one longer shot, still in sync.
      previous.duration = end - previous.start;
      record(state, { clipId: pick.clip.id, sourceStart: pick.sourceStart, duration: end - start, hero: false });
    } else {
      const shot: Shot = {
        id: "",
        clipId: pick.clip.id,
        start,
        duration: end - start,
        sourceStart: pick.sourceStart,
        label: section.label,
        sectionIndex: section.index,
        hero: slot.hero,
        synced: pick.synced,
      };
      shots.push(shot);
      record(state, shot);
    }
    index = next;
  }
  return shots.map((shot, order) => ({ ...shot, id: `shot-${order + 1}-${key(shot.start)}` }));
}

function stateFrom(shots: Shot[], upTo: number) {
  const state = emptyState();
  shots.forEach((shot, index) => { if (index !== upTo) record(state, shot); });
  state.previous = shots[upTo - 1]?.clipId ?? "";
  state.recent = [shots[upTo - 1]?.clipId, shots[upTo - 2]?.clipId].filter(Boolean) as string[];
  return state;
}

/**
 * Swap one shot for a different clip that fills the same slot exactly (same
 * start and length), avoiding its neighbours' clips. Returns null when nothing
 * else fits.
 */
export function swapShot(request: CutRequest, shots: Shot[], index: number, seed: number): Shot[] | null {
  const shot = shots[index];
  if (!shot) return null;
  const random = seededRandom(seed);
  const chooser = makeChooser(request, random);
  const exclude = new Set([shot.clipId, shots[index + 1]?.clipId].filter(Boolean) as string[]);
  const state = stateFrom(shots, index);
  const slot: Slot = { start: shot.start, end: shot.start + shot.duration, label: shot.label, energy: cutEnergy(request.music, shot.start, shot.label, 0.5), hero: shot.hero };
  const pick = chooser.candidates(slot, state, exclude, false).find((placement) => placement.end >= slot.end - 1e-3 && !exclude.has(placement.clip.id));
  if (!pick) return null;
  const next = shots.slice();
  next[index] = { ...shot, clipId: pick.clip.id, sourceStart: pick.sourceStart, synced: pick.synced, locked: false };
  return next;
}

/**
 * Put a specific clip into a shot's slot (best unused in-point, or its synced
 * position for a take in performance mode). Null if the clip can't fill it.
 */
export function assignClip(request: CutRequest, shots: Shot[], index: number, clipId: string): Shot[] | null {
  const shot = shots[index];
  const clip = request.clips.find((item) => item.id === clipId);
  if (!shot || !clip) return null;
  const end = shot.start + shot.duration;
  const synced = request.performance && clip.offset != null ? placeSynced(clip, shot.start, end) : null;
  const placement = synced ?? placeFree(clip, shot.start, shot.duration, stateFrom(shots, index), seededRandom(index + 1), false);
  if (!placement || placement.end < end - 1e-3) return null;
  const next = shots.slice();
  next[index] = { ...shot, clipId, sourceStart: placement.sourceStart, synced: Boolean(synced) };
  return next;
}

/** Nudge a shot's in-point within its clip (free shots only), clamped to the clip. */
export function slipShot(shots: Shot[], index: number, clipDuration: number, delta: number): Shot[] {
  const shot = shots[index];
  if (!shot || shot.synced) return shots;
  const next = shots.slice();
  next[index] = { ...shot, sourceStart: clamp(shot.sourceStart + delta, 0, Math.max(0, clipDuration - shot.duration)) };
  return next;
}

export function shotAt(shots: Shot[], time: number): Shot | undefined {
  let low = 0, high = shots.length - 1, found: Shot | undefined;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (shots[mid].start <= time + 1e-6) { found = shots[mid]; low = mid + 1; } else high = mid - 1;
  }
  return found && time < found.start + found.duration + 1e-6 ? found : undefined;
}

export type CutSummary = { shots: number; averageLength: number; shortest: number; longest: number; clipsUsed: number; backToBack: number; synced: number };

export function summarizeCut(shots: Shot[]): CutSummary {
  const lengths = shots.map((shot) => shot.duration);
  let backToBack = 0;
  for (let index = 1; index < shots.length; index++) if (shots[index].clipId === shots[index - 1].clipId && !(shots[index].synced && shots[index - 1].synced)) backToBack++;
  return {
    shots: shots.length,
    averageLength: lengths.length ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0,
    shortest: lengths.length ? Math.min(...lengths) : 0,
    longest: lengths.length ? Math.max(...lengths) : 0,
    clipsUsed: new Set(shots.map((shot) => shot.clipId)).size,
    backToBack,
    synced: shots.filter((shot) => shot.synced).length,
  };
}
