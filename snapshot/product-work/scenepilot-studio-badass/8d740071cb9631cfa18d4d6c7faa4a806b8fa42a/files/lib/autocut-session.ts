import { sha256Blob } from "./sha256-file.ts";
import type { MusicAnalysis } from "./autocut-music.ts";
import type { Shot } from "./autocut-cut.ts";
import type { Alignment } from "./autocut-align.ts";
import type { ClipProfile } from "./autocut-clips.ts";
import type { ClipMeta } from "../tools/src/autocut/media.ts";
import type { AspectId, BeatMarkerMode } from "./autocut-export.ts";
import type { PresetId } from "./autocut-cut.ts";
import type { PremiereRateId } from "./premiere-xml.ts";

export type AutoCutSessionMedia = { id: string; name: string; kind: "audio" | "video"; size: number; lastModified: number; sha256: string };
export type AutoCutSessionClip = {
  id: string; mediaId: string; include: boolean; role: "auto" | "take" | "broll";
  manualOffset?: number; alignment?: Alignment; profile: ClipProfile; meta: Omit<ClipMeta, "thumbnail"> & { thumbnail: string };
};
export type AutoCutSession = {
  format: "scenepilot-autocut-session"; version: 1; savedAt: number;
  media: AutoCutSessionMedia[];
  song: { mediaId: string; kind: "file" | "clip"; clipId?: string };
  music: MusicAnalysis;
  settings: { tempoFactor: 0.5 | 1 | 2; preset: PresetId; density: number; seed: number; length: "full" | "15" | "30" | "60"; aspect: AspectId; performance: boolean; performanceTouched: boolean; brollMix: number; faces: boolean; quality: 1 | 0.5; premiereRate: PremiereRateId | "auto"; dropFrame: boolean; beatMarkers: BeatMarkerMode };
  clips: AutoCutSessionClip[];
  locks: Shot[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each persisted field is validated before the session is returned.
const isRecord = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const inRange = (value: unknown, min: number, max: number): value is number => finite(value) && value >= min && value <= max;
const boundedText = (value: unknown, max = 4096): value is string => typeof value === "string" && value.length > 0 && value.length <= max;

function validMusic(value: unknown): value is MusicAnalysis {
  if (!isRecord(value) || !inRange(value.bpm, 1, 1000) || !Number.isInteger(value.beatsPerBar) || !inRange(value.beatsPerBar, 1, 32) || !inRange(value.duration, 0.001, 60 * 60 * 24)) return false;
  const duration = value.duration;
  if (!inRange(value.tempoConfidence, 0, 1) || !inRange(value.meterConfidence, 0, 1)) return false;
  const times = (list: unknown, max: number) => Array.isArray(list) && list.length <= max && list.every((time, index) => inRange(time, 0, duration) && (index === 0 || time > list[index - 1]));
  if (!times(value.beats, 500_000) || !times(value.downbeats, 200_000)) return false;
  if (!Array.isArray(value.energy) || value.energy.length > 500_000 || !value.energy.every((sample) => inRange(sample, 0, 1)) || !inRange(value.energyStep, 0.000001, 60 * 60 * 24)) return false;
  const labels = new Set(["intro", "verse", "build", "chorus", "drop", "break", "outro"]);
  if (!Array.isArray(value.sections) || value.sections.length > 20_000 || !value.sections.every((item, index) => isRecord(item)
    && inRange(item.start, 0, duration) && inRange(item.end, 0, duration) && item.start < item.end
    && (index === 0 || item.start >= value.sections[index - 1].end) && inRange(item.energy, 0, 1) && labels.has(item.label))) return false;
  return inRange(value.dropTime, 0, duration) && inRange(value.dropStrength, 0, 1) && typeof value.reliable === "boolean";
}

function validProfile(value: unknown): value is ClipProfile {
  return isRecord(value) && boundedText(value.id, 200) && boundedText(value.name, 4096)
    && inRange(value.duration, 0, 24 * 60 * 60) && inRange(value.usable, 0, 24 * 60 * 60) && value.usable <= value.duration
    && inRange(value.energy, 0, 1) && inRange(value.hero, 0, 1) && inRange(value.focusX, 0, 1)
    && Array.isArray(value.segments) && value.segments.length <= 100_000
    && value.segments.every((segment) => isRecord(segment) && inRange(segment.start, 0, value.duration) && inRange(segment.end, 0, value.duration) && segment.start < segment.end && inRange(segment.quality, 0, 1) && inRange(segment.motion, 0, 1) && inRange(segment.brightness, 0, 1) && typeof segment.faces === "boolean")
    && Array.isArray(value.sceneCuts) && value.sceneCuts.length <= 100_000 && value.sceneCuts.every((time) => inRange(time, 0, value.duration))
    && Array.isArray(value.notes) && value.notes.length <= 100 && value.notes.every((note) => boundedText(note, 500))
    && typeof value.faces === "boolean";
}

function validShot(value: unknown): value is Shot {
  return isRecord(value) && boundedText(value.id, 200) && boundedText(value.clipId, 200)
    && inRange(value.start, 0, 24 * 60 * 60) && inRange(value.duration, 0.000001, 24 * 60 * 60)
    && inRange(value.sourceStart, 0, 24 * 60 * 60) && ["intro", "verse", "build", "chorus", "drop", "break", "outro"].includes(value.label)
    && Number.isInteger(value.sectionIndex) && value.sectionIndex >= 0 && typeof value.hero === "boolean" && typeof value.synced === "boolean"
    && (value.locked === undefined || value.locked === true);
}

/** Strict versioned decoder: rejects unknown top-level versions and malformed state before UI mutation. */
export function parseAutoCutSession(raw: string): AutoCutSession {
  if (raw.length > 80 * 1024 * 1024) throw new Error("AutoCut session is larger than the 80 MB safety limit.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("This is not valid AutoCut session JSON."); }
  if (!isRecord(value) || value.format !== "scenepilot-autocut-session" || value.version !== 1) throw new Error("Unsupported or malformed AutoCut session version.");
  if (!inRange(value.savedAt, 0, Number.MAX_SAFE_INTEGER) || !Array.isArray(value.media) || value.media.length < 1 || value.media.length > 1000) throw new Error("AutoCut session has an invalid media list.");
  const mediaIds = new Set<string>();
  for (const item of value.media) {
    if (!isRecord(item) || !boundedText(item.id, 200) || !boundedText(item.name, 4096) || !["audio", "video"].includes(item.kind)
      || !inRange(item.size, 0, Number.MAX_SAFE_INTEGER) || !inRange(item.lastModified, 0, Number.MAX_SAFE_INTEGER)
      || typeof item.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(item.sha256) || mediaIds.has(item.id)) throw new Error("AutoCut session contains an invalid or duplicate media identity.");
    mediaIds.add(item.id);
  }
  if (!isRecord(value.song) || !mediaIds.has(value.song.mediaId) || !["file", "clip"].includes(value.song.kind)
    || (value.song.kind === "clip" && (!boundedText(value.song.clipId, 200) || !Array.isArray(value.clips) || !value.clips.some((clip: unknown) => isRecord(clip) && clip.id === value.song.clipId && clip.mediaId === value.song.mediaId)))) throw new Error("AutoCut session has an invalid song reference.");
  const songMedia = value.media.find((item: AutoCutSessionMedia) => item.id === value.song.mediaId);
  if (value.song.kind === "file" ? songMedia.kind !== "audio" : songMedia.kind !== "video") throw new Error("AutoCut session song media has an incompatible type.");
  if (!validMusic(value.music)) throw new Error("AutoCut session contains invalid music analysis.");
  if (!isRecord(value.settings) || ![0.5, 1, 2].includes(value.settings.tempoFactor) || !["music-video", "hype", "chill", "trailer"].includes(value.settings.preset)
    || !inRange(value.settings.density, 0, 1) || !Number.isInteger(value.settings.seed) || !inRange(value.settings.seed, 1, Number.MAX_SAFE_INTEGER)
    || !["full", "15", "30", "60"].includes(value.settings.length) || !["9:16", "16:9", "1:1"].includes(value.settings.aspect)
    || typeof value.settings.performance !== "boolean" || typeof value.settings.performanceTouched !== "boolean"
    || !inRange(value.settings.brollMix, 0, 1) || typeof value.settings.faces !== "boolean" || ![0.5, 1].includes(value.settings.quality)
    || !["auto", "23.976", "24", "25", "29.97", "30", "50", "59.94", "60"].includes(value.settings.premiereRate)
    || typeof value.settings.dropFrame !== "boolean" || !["bars", "beats", "none"].includes(value.settings.beatMarkers)) throw new Error("AutoCut session contains invalid settings.");
  if (!Array.isArray(value.clips) || value.clips.length > 999 || !value.clips.every((clip: unknown) => isRecord(clip)
    && boundedText(clip.id, 200) && mediaIds.has(clip.mediaId) && typeof clip.include === "boolean"
    && ["auto", "take", "broll"].includes(clip.role) && (clip.manualOffset === undefined || inRange(clip.manualOffset, -24 * 60 * 60, 24 * 60 * 60))
    && (clip.alignment === undefined || (isRecord(clip.alignment) && ["offset", "confidence", "margin", "overlap", "coverage"].every((key) => finite(clip.alignment[key])) && typeof clip.alignment.refined === "boolean"))
    && validProfile(clip.profile) && isRecord(clip.meta) && inRange(clip.meta.duration, 0.001, 24 * 60 * 60)
    && inRange(clip.meta.width, 1, 100_000) && inRange(clip.meta.height, 1, 100_000) && typeof clip.meta.hasAudio === "boolean"
    && (clip.meta.frameRate === undefined || inRange(clip.meta.frameRate, 0.001, 1000))
    && boundedText(clip.meta.thumbnail, 8 * 1024 * 1024) && clip.meta.thumbnail.startsWith("data:image/"))) throw new Error("AutoCut session contains invalid clip analysis or edits.");
  const clipIds = new Set(value.clips.map((clip: AutoCutSessionClip) => clip.id));
  if (clipIds.size !== value.clips.length || value.clips.some((clip: AutoCutSessionClip) => value.media.find((item: AutoCutSessionMedia) => item.id === clip.mediaId)?.kind !== "video")) throw new Error("AutoCut session contains duplicate clip IDs or non-video clip media.");
  if (!Array.isArray(value.locks) || value.locks.length > 100_000 || !value.locks.every(validShot)) throw new Error("AutoCut session contains invalid locked edits.");
  const orderedLocks = [...value.locks].sort((a: Shot, b: Shot) => a.start - b.start);
  for (let index = 0; index < orderedLocks.length; index += 1) {
    const shot = orderedLocks[index];
    const clip = value.clips.find((item: AutoCutSessionClip) => item.id === shot.clipId);
    if (!clip || shot.start + shot.duration > value.music.duration + 1e-6 || shot.sourceStart + shot.duration > clip.profile.duration + 1e-6
      || (index && orderedLocks[index - 1].start + orderedLocks[index - 1].duration > shot.start + 1e-6)) throw new Error("AutoCut session locks overlap or refer outside the saved timeline/media.");
  }
  return value as AutoCutSession;
}

/** Require exact full-byte SHA-256 identity. Nothing is returned until all links resolve. */
export async function verifyAutoCutSessionMedia(session: AutoCutSession, files: File[]) {
  const candidates: Array<{ file: File; sha256: string }> = [];
  for (const file of files) candidates.push({ file, sha256: await sha256Blob(file) });
  const resolved = new Map<string, File>();
  for (const media of session.media) {
    const match = candidates.filter(({ file, sha256 }) => sha256 === media.sha256 && file.size === media.size);
    if (match.length !== 1) throw new Error(match.length ? `More than one selected file matches “${media.name}”.` : `Missing or changed media: “${media.name}”. Select the original file; saved edits have not been applied.`);
    resolved.set(media.id, match[0].file);
  }
  return resolved;
}
