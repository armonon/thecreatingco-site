// Beat-cut base track — the montage. Turns a pool of clips into a sequence of
// hard cuts locked to the musical grid, cut denser where the song has energy.
// Pure + deterministic (seeded) so "reroll" gives a new-but-reproducible edit.

import type { SignalPoint } from "./analysis-engine.ts";
import { detectDownbeats } from "./downbeat-model.ts";
import type { TransformKeyframe } from "./keyframes.ts";
import type { TimeRemapKeyframe } from "./time-remap.ts";
import type { ClipVisualEffect } from "./clip-effects.ts";
import { TRANSITION_PRESETS, type TransitionType } from "./transitions.ts";

export type SequenceAsset = {
  sourceIn?: number;
  priority?: number;
  id: string;
  kind: "image" | "video";
  /** Source media length in seconds. Images can pass Infinity. */
  sourceDuration: number;
  /** The clip's most dynamic moment (s), from analysis. Cuts favour it. */
  peakTime?: number;
  /** Visual energy 0..1 (motion/flash), from the clip's effect profile.
   *  Hot sections favour high-energy clips; the intro favours calm ones. */
  energy?: number;
};

export type SequenceSection = {
  id: string;
  start: number;
  end: number;
  /** Normalized 0..1 loudness/energy; drives cut density. */
  energy: number;
  enabled?: boolean;
};

export type BaseCut = {
  preservePhrase?: boolean;
  editorial?: import("./auto-edit-policy.ts").CutEvidence;
  id: string;
  assetId: string;
  sectionId: string;
  start: number;
  duration: number;
  sourceStart: number;
  /** Source seconds played per timeline second. 1 is normal speed. */
  playbackRate?: number;
  /** Optional transition entering this cut. Undefined follows the sequence default. */
  transitionType?: TransitionType;
  /** Per-edit transition duration in seconds. */
  transitionDuration?: number;
  /** Optional clip-level picture fades used by the Pro timeline. */
  fadeIn?: number;
  fadeOut?: number;
  /** Keeps related picture/audio clips selected and moved together. */
  linked?: boolean;
  /** Prevents automated rebuilds from replacing this editorial decision. */
  locked?: boolean;
  /** Clips sharing a group id select and move as one editorial unit. */
  groupId?: string;
  /** Non-destructive, clip-local color correction shared by preview and export. */
  color?: ClipColorAdjust;
  /** Mirror the clip horizontally / vertically. Also the fix for footage that
   *  imports upside-down or mirrored. */
  flipH?: boolean;
  flipV?: boolean;
  /** Play the clip's source span backwards. WYSIWYG via sourceTimeForCut; the
   *  native fast-path falls back to the web renderer for reversed clips. */
  reversed?: boolean;
  /** Keyframed time remap (AE Time Remap): local time → source time. Two or more
   *  keys override the linear rate/reverse mapping. See lib/time-remap.ts. */
  timeRemap?: TimeRemapKeyframe[];
  /** Ordered, non-destructive visual effects shared by preview and export. */
  effects?: ClipVisualEffect[];
  /** Per-clip transform animation (position/scale/rotation/opacity), times
   *  local to the clip start. Empty/absent = no animation. */
  transformKeyframes?: TransformKeyframe[];
};

export type ClipColorAdjust = {
  exposure: number;
  contrast: number;
  saturation: number;
  hue: number;
  /** Blue/orange white-balance axis in [-1, 1]. Positive warms the image. */
  temperature: number;
  /** Green/magenta white-balance axis in [-1, 1]. Positive adds magenta. */
  tint: number;
};

export const NEUTRAL_CLIP_COLOR: ClipColorAdjust = {
  exposure: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  temperature: 0,
  tint: 0,
};

export function clipColorFilter(color?: Partial<ClipColorAdjust>) {
  const value = { ...NEUTRAL_CLIP_COLOR, ...color };
  const exposure = Math.max(0.1, Math.min(3, value.exposure));
  const contrast = Math.max(0.1, Math.min(3, value.contrast));
  const saturation = Math.max(0, Math.min(3, value.saturation));
  const hue = Math.max(-180, Math.min(180, value.hue));
  return `brightness(${exposure}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg)`;
}

/** The affine white-balance correction is kept outside the CSS filter string
 * because Canvas has no channel-offset filter. The shared compositor applies
 * it to each layer's pixels in both Program preview and final export. */
export function clipWhiteBalance(color?: Partial<ClipColorAdjust>) {
  const temperature = Math.max(-1, Math.min(1, Number.isFinite(color?.temperature) ? color!.temperature! : 0));
  const tint = Math.max(-1, Math.min(1, Number.isFinite(color?.tint) ? color!.tint! : 0));
  return Math.abs(temperature) > 1e-6 || Math.abs(tint) > 1e-6 ? { temperature, tint } : undefined;
}

export type BarGrid = {
  /** Times of bar downbeats ("the 1"), ascending. */
  downbeats: number[];
  /** Beats per bar (assumed 4/4). */
  beatsPerBar: number;
};

// Small, fast, seedable PRNG (mulberry32) so reroll is deterministic.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive the bar grid from a flat beat list — which beats are downbeats ("the
 * 1") and how many beats per bar. Delegates to detectDownbeats (lib/downbeat-
 * model.ts): the neural model when it can run, else the heuristic. So cuts fall
 * on real bar boundaries instead of arbitrary beats.
 */
export function deriveBarGrid(beats: number[], signals: SignalPoint[]): BarGrid {
  const meter = detectDownbeats(beats, signals);
  return { downbeats: meter.downbeats, beatsPerBar: meter.beatsPerBar };
}

/** Beats to hold a single base clip, by section energy. Hotter = faster cuts. */
function cutLengthInBeats(energy: number, pace: SequencePace) {
  const table = PACE_TABLE[pace];
  if (energy >= 0.7) return table.hot;
  if (energy >= 0.4) return table.mid;
  return table.cold;
}

export type SequencePace = "cinematic" | "balanced" | "frenetic";

const PACE_TABLE: Record<SequencePace, { hot: number; mid: number; cold: number }> = {
  cinematic: { hot: 2, mid: 4, cold: 8 },
  balanced: { hot: 1, mid: 2, cold: 4 },
  frenetic: { hot: 1, mid: 1, cold: 2 },
};

export type BuildBaseSequenceOptions = {
  minShot?: number;
  maxShot?: number;
  beats: number[];
  sections: SequenceSection[];
  assets: SequenceAsset[];
  signals?: SignalPoint[];
  pace?: SequencePace;
  /** Reroll seed — same seed + inputs => identical sequence. */
  seed?: number;
  /** Total song length; caps the final clip. */
  duration: number;
  /**
   * Optional 0..1 intensity curve (see lib/arc.ts). When present, cuts get
   * denser as intensity rises, so the montage accelerates into the drop even
   * within a single section.
   */
  intensityAt?: (time: number) => number;
  /**
   * The drop time (see lib/arc.ts). When set, the montage guarantees a hard cut
   * lands on the downbeat at the drop — a fresh clip on the song's biggest
   * moment — instead of holding a clip straight through it.
   */
  dropTime?: number;
};

const SOFT_TRANSITIONS = new Set<TransitionType>(["dissolve", "dip", "slide"]);

/**
 * Section-aware transition for an incoming cut: the montage's default
 * transition, modulated by the section's energy (0..1). Hot sections snap —
 * shorter, and a soft/absent default sharpens to a flash cut; calm sections
 * breathe — longer, and a hard/absent default melts into a dissolve; the
 * mid-range keeps the chosen look and just ramps its duration with energy.
 * Pure, so preview and export stay identical.
 */
export function sectionTransition(
  energy: number,
  base: { type: TransitionType; duration: number },
): { transitionType: TransitionType; transitionDuration: number } {
  const e = Math.max(0, Math.min(1, energy));
  const isSoft = base.type === "none" || SOFT_TRANSITIONS.has(base.type);
  if (e >= 0.7) {
    const type: TransitionType = isSoft ? "flash" : base.type;
    const from = type === base.type ? base.duration : TRANSITION_PRESETS[type].duration;
    return { transitionType: type, transitionDuration: from * 0.7 };
  }
  if (e <= 0.3) {
    const type: TransitionType = isSoft && base.type !== "none" ? base.type : "dissolve";
    const from = type === base.type ? base.duration : TRANSITION_PRESETS[type].duration;
    return { transitionType: type, transitionDuration: from * 1.5 };
  }
  // Mid-range: keep the look, ramp duration continuously from 1.5x (at e=0.3)
  // down to 0.7x (at e=0.7) so intensity tracks energy without a visible jump.
  return { transitionType: base.type, transitionDuration: base.duration * (1.5 - 2 * (e - 0.3)) };
}

/**
 * Build the beat-cut base montage. Walks each enabled section, holds each clip
 * for an energy-scaled number of beats, snaps every cut to a beat, avoids
 * repeating the same asset back-to-back, and varies each video clip's in-point
 * so the same source doesn't always show its opening frame.
 */
export function buildBaseSequence(options: BuildBaseSequenceOptions): BaseCut[] {
  const { beats, sections, assets, signals = [], duration, intensityAt } = options;
  const pace = options.pace ?? "balanced";
  // Hotter moments cut faster: intensity 1 halves the hold, intensity 0 stretches
  // it by 50%. Rounded, floored at one beat.
  const holdFor = (energy: number, time: number) => {
    const base = cutLengthInBeats(energy, pace);
    if (!intensityAt) return base;
    const scaled = base * (1.5 - intensityAt(time));
    return Math.max(1, Math.round(scaled));
  };
  if (!assets.length || beats.length < 2) return [];
  const random = mulberry32((options.seed ?? 1) * 2654435761);
  const { downbeats } = deriveBarGrid(beats, signals);
  const isDownbeat = new Set(downbeats.map((time) => Math.round(time * 1000)));
  // The beat the drop should cut on: the downbeat nearest the drop time. A cut
  // is forced to end here so a fresh clip starts on the song's biggest moment.
  const dropCutTime = options.dropTime != null && downbeats.length
    ? downbeats.reduce((best, time) => Math.abs(time - options.dropTime!) < Math.abs(best - options.dropTime!) ? time : best, downbeats[0])
    : null;
  const cuts: BaseCut[] = [];
  let lastAssetId = "";
  // Whether any clip carries a visual-energy score. Without one we can't match,
  // so the montage stays purely random (its long-standing behaviour).
  const graded = assets.some((asset) => asset.energy != null || (asset.priority ?? 1)>1);
  // Choose the clip for a cut in a section of the given energy. Graded pools
  // bias toward clips whose visual energy matches the section — flashy footage
  // in hot sections, calm footage in the intro — with jitter for variety and
  // never the immediately previous clip. Ungraded pools stay random.
  const pickAsset = (sectionEnergy: number): SequenceAsset => {
    if (!graded) {
      let choice = assets[Math.floor(random() * assets.length)];
      if (assets.length > 1 && choice.id === lastAssetId) {
        choice = assets[(assets.indexOf(choice) + 1) % assets.length];
      }
      return choice;
    }
    const pool = assets.length > 1 ? assets.filter((asset) => asset.id !== lastAssetId) : assets;
    let best = pool[0];
    let bestScore = -Infinity;
    for (const asset of pool) {
      // Closeness in energy, 0..1, plus ±0.25 jitter: a clear energy match
      // wins, but near-ties shuffle so reruns and adjacent cuts stay fresh.
      const score = 1 - Math.abs((asset.energy ?? 0.5) - sectionEnergy) + (random() - 0.5) * 0.5 + Math.max(0,(asset.priority ?? 1)-1)*.4;
      if (score > bestScore) { bestScore = score; best = asset; }
    }
    return best;
  };

  for (const section of sections) {
    if (section.enabled === false) continue;
    const sectionBeats = beats.filter((beat) => beat >= section.start && beat < section.end);
    if (sectionBeats.length < 1) continue;
    let cursor = 0;
    while (cursor < sectionBeats.length) {
      const start = sectionBeats[cursor];
      const hold = holdFor(section.energy, start);
      // Prefer to land the next cut on a downbeat when the hold spans a bar.
      // Take the downbeat CLOSEST to the target (cursor + hold), not the first
      // one — downbeats are a bar apart, so breaking on the earliest capped
      // every long "cinematic" hold at a single bar.
      let nextCursor = cursor + hold;
      if (hold >= 4) {
        let bestProbe = -1;
        for (let probe = cursor + 1; probe <= cursor + hold && probe < sectionBeats.length; probe++) {
          if (isDownbeat.has(Math.round(sectionBeats[probe] * 1000))) bestProbe = probe;
        }
        if (bestProbe > cursor) nextCursor = bestProbe;
      }
      // The drop wins: if its cut point is just ahead, land the boundary exactly
      // on it (reaching up to two beats past the hold so the clip can hold into
      // the drop), so a new clip snaps in on the biggest moment.
      if (dropCutTime != null) {
        for (let probe = cursor + 1; probe <= cursor + hold + 2 && probe < sectionBeats.length; probe++) {
          if (Math.abs(sectionBeats[probe] - dropCutTime) < 1e-3) { nextCursor = probe; break; }
        }
      }
      while(nextCursor<sectionBeats.length && sectionBeats[nextCursor]-start<(options.minShot ?? 0)) nextCursor++;
      while(nextCursor>cursor+1 && (sectionBeats[nextCursor] ?? section.end)-start>(options.maxShot ?? Infinity)) nextCursor--;
      const end = nextCursor < sectionBeats.length ? sectionBeats[nextCursor] : section.end;
      const clipDuration = Math.max(0.05, Math.min(end, duration) - start);

      // Pick an asset matched to this section's energy (see pickAsset), never
      // repeating the immediately previous one.
      let choice = pickAsset(section.energy);
      if(choice.kind === "video" && choice.sourceDuration-(choice.sourceIn ?? 0)<clipDuration) {
        const usable=assets.find(a=>a.kind === "image" || a.sourceDuration-(a.sourceIn ?? 0)>=clipDuration);
        if(!usable) {cursor=Math.max(cursor+1,nextCursor);continue;}
        choice=usable;
      }
      lastAssetId = choice.id;

      // Pick the in-point for video. Favour the clip's most dynamic moment when
      // analysis found one — placing its peak ~a third into the shown segment —
      // with a little jitter so a reused clip still shows fresh frames. Without
      // a peak, fall back to a random in-point.
      let sourceStart = 0;
      if (choice.kind === "video" && Number.isFinite(choice.sourceDuration)) {
        const origin=choice.sourceIn ?? 0;
        const room = Math.max(0, choice.sourceDuration-origin - clipDuration);
        sourceStart=origin;
        if (room > 0) {
          if (choice.peakTime != null && choice.peakTime > 0) {
            const jitter = (random() - 0.5) * clipDuration * 0.6;
            sourceStart = origin+Math.max(0, Math.min(room, choice.peakTime-origin - clipDuration * 0.35 + jitter));
          } else {
            sourceStart = origin+random() * room;
          }
        }
      }

      cuts.push({
        id: `base-${section.id}-${cursor}-${choice.id}`,
        assetId: choice.id,
        sectionId: section.id,
        start,
        duration: clipDuration,
        sourceStart,
      });
      cursor = Math.max(cursor + 1, nextCursor);
    }
  }
  return cuts.sort((a, b) => a.start - b.start);
}
