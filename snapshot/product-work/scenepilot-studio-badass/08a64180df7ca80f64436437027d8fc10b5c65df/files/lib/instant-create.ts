import type { OutputAspect } from "./aspect.ts";
import type { SequencePace } from "./sequencer.ts";

export type CreatorGoal = "music-video" | "social" | "lyrics" | "cinematic" | "story";

export type CreatorProfile = {
  id: CreatorGoal;
  label: string;
  promise: string;
  aspect: OutputAspect;
  styleId: "auto" | "hyperpop" | "cinematic";
  energy: "smooth" | "dynamic" | "maximum";
  pace: SequencePace;
  autoCaptions: boolean;
};

export const CREATOR_PROFILES: Record<CreatorGoal, CreatorProfile> = {
  "music-video": {
    id: "music-video", label: "Music video", promise: "Full song · beat edit · editable effects",
    aspect: "source", styleId: "auto", energy: "dynamic", pace: "balanced", autoCaptions: false,
  },
  social: {
    id: "social", label: "Social cut", promise: "Vertical · fast hook · captions",
    aspect: "9:16", styleId: "hyperpop", energy: "maximum", pace: "frenetic", autoCaptions: true,
  },
  lyrics: {
    id: "lyrics", label: "Lyric video", promise: "Beat-timed words · cinematic motion",
    aspect: "16:9", styleId: "cinematic", energy: "smooth", pace: "cinematic", autoCaptions: true,
  },
  cinematic: {
    id: "cinematic", label: "Cinematic", promise: "Longer shots · restrained motion",
    aspect: "2.39", styleId: "cinematic", energy: "smooth", pace: "cinematic", autoCaptions: false,
  },
  story: {
    id: "story", label: "Story cut", promise: "Talking video · dead air removed · auto rough cut",
    aspect: "16:9", styleId: "cinematic", energy: "smooth", pace: "cinematic", autoCaptions: false,
  },
};

export function creatorProfile(goal: CreatorGoal) {
  return CREATOR_PROFILES[goal];
}

export type CreatorGoalInference = {
  goal: "music-video" | "cinematic";
  sourceKind: "audio" | "video";
  reason: string;
};

/** Infer the best starting workspace from the master source. The result only
 * selects a starting mode; the user can switch creator goals at any time. */
export function inferCreatorGoalFromMedia(file: Pick<File, "name" | "type">): CreatorGoalInference {
  const audio = file.type.startsWith("audio/") || /\.(?:wav|aif|aiff|flac|mp3|m4a|aac|ogg)$/i.test(file.name);
  if (audio) {
    return {
      goal: "music-video",
      sourceKind: "audio",
      reason: "Audio source detected — beats, transients, sections and the drop become the primary creative map.",
    };
  }
  return {
    goal: "cinematic",
    sourceKind: "video",
    reason: "Video source detected — shots, jump cuts, scene changes, motion and exposure become the primary creative map.",
  };
}

/** Old projects did not persist creative intent. Recover a sensible starting
 * mode from their explicit timing choice or source; never override a saved goal. */
export function restoreCreatorIntent(state: {creatorGoal?: unknown; inferredCreatorGoal?: unknown; autoPolicy?: {timing?: unknown}}, file?: Pick<File, "name" | "type"> | null): {creatorGoal: CreatorGoal; inferredCreatorGoal: CreatorGoal | null} {
  const valid = (value: unknown): value is CreatorGoal => typeof value === "string" && Object.prototype.hasOwnProperty.call(CREATOR_PROFILES, value);
  if (valid(state.creatorGoal)) return {creatorGoal: state.creatorGoal, inferredCreatorGoal: state.inferredCreatorGoal === state.creatorGoal ? state.creatorGoal : null};
  const timing = state.autoPolicy?.timing;
  if (timing === "dialogue" || timing === "hybrid") return {creatorGoal: "story", inferredCreatorGoal: null};
  if (timing === "music") return {creatorGoal: "music-video", inferredCreatorGoal: null};
  if (timing === "scenes") return {creatorGoal: "cinematic", inferredCreatorGoal: null};
  const inferred = file ? inferCreatorGoalFromMedia(file).goal : null;
  return {creatorGoal: inferred ?? "music-video", inferredCreatorGoal: inferred};
}
