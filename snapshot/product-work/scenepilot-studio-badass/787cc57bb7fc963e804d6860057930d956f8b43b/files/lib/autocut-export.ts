// AutoCut — hand-off. Turns an AutoCut shot list into a `.scenepilot.json` cut
// file that the ScenePilot editor's "Import cut" opens as an editable montage:
// shots become base cuts (V1), the song is the main source, sections become
// director sections + range markers, the beat grid comes along, and a cut
// shorter than the song is expressed as the timeline in/out range so the audio
// stays aligned. Media is referenced by name/size and relinked by the editor.
//
// It also carries an `autocut` block (preset, seed, offsets...) so the same
// file is a complete cut map. Pure; no DOM.

import type { Shot } from "./autocut-cut.ts";
import type { MusicAnalysis, SectionLabel } from "./autocut-music.ts";
import { SECTION_LABELS } from "./autocut-music.ts";
import { CURRENT_CUT_FILE_VERSION, CUT_FILE_FORMAT, DEFAULT_EFFECTS } from "./project-store.ts";

export type MediaRef = { name: string; size?: number; lastModified?: number };

export type ExportClip = MediaRef & { id: string; offset?: number; synced?: boolean };

export type AutoCutSettings = {
  preset: string;
  density: number;
  seed: number;
  performance: boolean;
  brollMix: number;
  aspect: string;
};

const SECTION_COLORS: Record<SectionLabel, string> = {
  intro: "#5eb8ff",
  verse: "#34d6c7",
  build: "#f7c84b",
  chorus: "#ff695d",
  drop: "#ff334f",
  break: "#b79cff",
  outro: "#5eb8ff",
};

const SECTION_PATTERN: Record<SectionLabel, "restrained" | "pulse" | "build" | "burst" | "release"> = {
  intro: "restrained",
  verse: "pulse",
  build: "build",
  chorus: "burst",
  drop: "burst",
  break: "release",
  outro: "release",
};

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

export function autocutToCutFile(options: {
  project: string;
  music: Pick<MusicAnalysis, "duration" | "bpm" | "beats" | "downbeats" | "sections" | "dropTime" | "dropStrength">;
  shots: Shot[];
  song: MediaRef & { kind: "audio" | "video" };
  clips: ExportClip[];
  range?: { start: number; end: number };
  settings: AutoCutSettings;
  savedAt?: number;
}) {
  const { music, shots, song, clips, settings } = options;
  const used = new Set(shots.map((shot) => shot.clipId));
  const range = options.range ?? { start: 0, end: music.duration };
  const partial = range.start > 0.01 || range.end < music.duration - 0.01;
  const sections = music.sections.map((section) => ({
    id: `autocut-${section.id}`,
    name: SECTION_LABELS[section.label].toUpperCase(),
    start: round(section.start),
    end: round(section.end),
    every: section.label === "chorus" || section.label === "drop" ? 4 : 8,
    duration: 0.5,
    scale: 100,
    enabled: true,
    color: SECTION_COLORS[section.label],
    energy: round(section.energy, 3),
    rhythm: "normal" as const,
    pattern: SECTION_PATTERN[section.label],
  }));
  const baseCuts = shots.map((shot) => ({
    id: `autocut-${shot.id}`,
    assetId: shot.clipId,
    sectionId: `autocut-section-${shot.sectionIndex}`,
    start: round(shot.start),
    duration: round(shot.duration),
    sourceStart: round(shot.sourceStart),
    transitionType: "none" as const,
    transitionDuration: 0,
    ...(shot.locked ? { locked: true } : {}),
  }));
  const markers = [
    ...music.sections.map((section) => ({
      id: `autocut-marker-${section.id}`,
      time: round(section.start),
      label: `${SECTION_LABELS[section.label]} (guess)`,
      color: SECTION_COLORS[section.label],
      kind: "chapter" as const,
      duration: round(section.end - section.start),
    })),
    ...(music.dropStrength > 0.15 ? [{ id: "autocut-marker-drop", time: round(music.dropTime), label: "Drop", color: "#ff334f", kind: "marker" as const }] : []),
  ];
  const lines = [
    `AutoCut ${settings.preset} · seed ${settings.seed} · density ${Math.round(settings.density * 100)}%${settings.performance ? ` · performance mode (B-roll ${Math.round(settings.brollMix * 100)}%)` : ""}`,
    `${shots.length} shots from ${used.size} clips · ${music.bpm} BPM`,
    ...(partial ? [`Cut covers ${range.start.toFixed(2)}–${range.end.toFixed(2)} s of the song (set as the timeline in/out range).`] : []),
  ];
  return {
    format: CUT_FILE_FORMAT,
    version: CURRENT_CUT_FILE_VERSION,
    project: options.project,
    duration: round(music.duration),
    bpm: music.bpm,
    beatOffset: 0,
    beats: music.beats.map((beat) => round(beat)),
    sections,
    placements: [] as unknown[],
    compositions: [] as unknown[],
    tracks: [] as unknown[],
    baseCuts,
    titles: [] as unknown[],
    storyBrief: lines.join("\n"),
    mainAsset: { name: song.name, kind: song.kind, size: song.size, lastModified: song.lastModified },
    assets: clips.filter((clip) => used.has(clip.id)).map((clip) => ({
      id: clip.id,
      name: clip.name,
      kind: "video" as const,
      size: clip.size,
      lastModified: clip.lastModified,
      folderId: "bin-footage",
    })),
    // Hard cuts, no zoom punches or looks: the editor opens the cut exactly as
    // AutoCut previewed it. Everything stays one click away in the editor.
    effects: { ...DEFAULT_EFFECTS, montageEnabled: true, transitionType: "none", punchPreset: "off", lookPreset: "none", dropRampEnabled: false },
    proState: {
      markers,
      storyBrief: lines.join("\n"),
      ...(partial ? { timelineRange: { inPoint: round(range.start), outPoint: round(range.end) } } : {}),
    },
    autocut: {
      version: 1,
      ...settings,
      range: { start: round(range.start), end: round(range.end) },
      downbeats: music.downbeats.map((time) => round(time)),
      shots: shots.map((shot) => ({ id: shot.id, clipId: shot.clipId, start: round(shot.start), duration: round(shot.duration), sourceStart: round(shot.sourceStart), label: shot.label, hero: shot.hero, synced: shot.synced, locked: Boolean(shot.locked) })),
      clips: clips.map((clip) => ({ id: clip.id, name: clip.name, ...(clip.offset != null ? { offset: round(clip.offset), synced: Boolean(clip.synced) } : {}) })),
    },
    savedAt: options.savedAt ?? 0,
  };
}

const csvQuote = (value: string | number | boolean) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
};

/** Shot list as CSV (one row per shot). */
export function shotsToCsv(shots: Shot[], clipName: (id: string) => string): string {
  const rows: Array<Array<string | number | boolean>> = [["#", "Start", "End", "Length", "Section", "Clip", "Source in", "Hero", "Synced", "Locked"]];
  shots.forEach((shot, index) => rows.push([
    index + 1, shot.start.toFixed(3), (shot.start + shot.duration).toFixed(3), shot.duration.toFixed(3),
    SECTION_LABELS[shot.label], clipName(shot.clipId), shot.sourceStart.toFixed(3), shot.hero, shot.synced, Boolean(shot.locked),
  ]));
  return `${rows.map((row) => row.map(csvQuote).join(",")).join("\r\n")}\r\n`;
}

/** Output frame sizes per aspect. `draft` halves the long side for fast previews. */
export const ASPECTS = {
  "9:16": { width: 1080, height: 1920, label: "9:16 vertical" },
  "1:1": { width: 1080, height: 1080, label: "1:1 square" },
  "16:9": { width: 1920, height: 1080, label: "16:9 wide" },
} as const;

export type AspectId = keyof typeof ASPECTS;

/** Even output size for an aspect at a quality level (1 = full, 0.5 = draft). */
export function outputSize(aspect: AspectId, scale = 1) {
  const base = ASPECTS[aspect];
  const even = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
  return { width: even(base.width), height: even(base.height) };
}

/**
 * Cover-crop rectangle in source pixels: fill the output, centring the crop on
 * `focusX` (e.g. a face) when the source is wider than the output.
 */
export function coverCrop(sourceWidth: number, sourceHeight: number, outWidth: number, outHeight: number, focusX = 0.5) {
  const sourceAspect = sourceWidth / sourceHeight;
  const outAspect = outWidth / outHeight;
  if (sourceAspect > outAspect) {
    const width = sourceHeight * outAspect;
    const x = Math.min(sourceWidth - width, Math.max(0, focusX * sourceWidth - width / 2));
    return { x, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / outAspect;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}
