// Captions (alpha) — the pure half of word-level animated captions. Takes timed
// words from on-device speech recognition, cleans their timing, groups them
// into short readable caption lines, keeps timing sane when the user edits
// text, lays lines out for a canvas, and exports SRT / WebVTT (with per-word
// karaoke timestamps) and a ScenePilot starter cut. No DOM, no network.

import { CUT_FILE_FORMAT, CURRENT_CUT_FILE_VERSION, DEFAULT_EFFECTS } from "./project-store.ts";
import type { TitleCue } from "./titles.ts";
import { captionsToSrt, type CaptionCue } from "./captions.ts";

export type CaptionWord = { id: string; text: string; start: number; end: number };
export type CaptionLine = { id: string; words: CaptionWord[]; start: number; end: number };

export type GroupOptions = {
  /** Soft limit on characters per caption (one or two rows on screen). */
  maxChars?: number;
  maxWords?: number;
  /** A silence longer than this always starts a new caption, seconds. */
  maxGap?: number;
  /** Longest a single caption may stay up, seconds. */
  maxDuration?: number;
};

const MIN_WORD = 0.08;

/**
 * Normalise raw ASR chunks into monotonic, non-overlapping words. Whisper's
 * word timestamps occasionally go backwards, collapse to zero length or run
 * past the next word; this repairs those cases without inventing new words.
 * Multi-word chunks (segment-level fallback) are split and spread evenly.
 */
export function normalizeWords(chunks: Array<{ text: string; start: number; end: number }>, duration = Infinity): CaptionWord[] {
  const expanded: Array<{ text: string; start: number; end: number }> = [];
  for (const chunk of chunks) {
    const text = String(chunk.text ?? "").trim();
    if (!text) continue;
    const start = Number.isFinite(chunk.start) ? Math.max(0, chunk.start) : NaN;
    if (!Number.isFinite(start)) continue;
    const end = Number.isFinite(chunk.end) && chunk.end > start ? chunk.end : NaN;
    const parts = text.split(/\s+/);
    if (parts.length === 1) { expanded.push({ text, start, end }); continue; }
    // Segment-level chunk: spread its words across its span by character count.
    const span = Number.isFinite(end) ? end - start : parts.length * 0.35;
    const totalChars = parts.reduce((sum, part) => sum + part.length + 1, 0);
    let cursor = start;
    for (const part of parts) {
      const length = (span * (part.length + 1)) / totalChars;
      expanded.push({ text: part, start: cursor, end: cursor + length });
      cursor += length;
    }
  }
  expanded.sort((a, b) => a.start - b.start);
  const words: CaptionWord[] = [];
  for (let i = 0; i < expanded.length; i++) {
    const word = expanded[i];
    const previous = words.at(-1);
    // Whisper splits "on-device" into "on" + "-device" and sometimes emits
    // trailing punctuation or contractions as their own tokens: glue them back.
    if (previous && /^(?:[-–'’,.!?;:%)\]}…]|n't\b)/i.test(word.text) && word.start - previous.end < 0.3) {
      previous.text += word.text;
      if (Number.isFinite(word.end) && word.end > previous.end) previous.end = round3(Math.min(word.end, expanded[i + 1]?.start ?? Infinity, Math.max(duration, previous.start + MIN_WORD)));
      continue;
    }
    let start = Math.min(word.start, duration);
    if (previous && start < previous.end) start = previous.end;
    const nextStart = expanded[i + 1]?.start ?? Infinity;
    let end = Number.isFinite(word.end) ? word.end : Math.min(start + 0.4, nextStart);
    if (end > nextStart && nextStart > start) end = nextStart;
    if (end - start < MIN_WORD) end = start + MIN_WORD;
    end = Math.min(end, Math.max(duration, start + MIN_WORD));
    words.push({ id: `w${words.length}`, text: word.text, start: round3(start), end: round3(end) });
  }
  return words;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const endsSentence = (text: string) => /[.!?…]["”')\]]*$/.test(text);
const endsClause = (text: string) => /[,;:—–-]["”')\]]*$/.test(text);

/** Group words into short captions: break on sentence ends, long pauses, and length limits. */
export function groupCaptionLines(words: CaptionWord[], options: GroupOptions = {}): CaptionLine[] {
  const maxChars = options.maxChars ?? 32;
  const maxWords = options.maxWords ?? 7;
  const maxGap = options.maxGap ?? 0.6;
  const maxDuration = options.maxDuration ?? 3.5;
  const lines: CaptionLine[] = [];
  let current: CaptionWord[] = [];
  const flush = () => {
    if (!current.length) return;
    lines.push({ id: `line-${lines.length}-${Math.round(current[0].start * 1000)}`, words: current, start: current[0].start, end: current.at(-1)!.end });
    current = [];
  };
  for (const word of words) {
    if (current.length) {
      const last = current.at(-1)!;
      const chars = current.reduce((sum, item) => sum + item.text.length + 1, 0) + word.text.length;
      const gap = word.start - last.end;
      const tooLong = chars > maxChars || current.length >= maxWords || word.end - current[0].start > maxDuration;
      // Prefer breaking after a clause when the caption is already half full.
      const clauseBreak = endsClause(last.text) && chars > maxChars * 0.55;
      if (endsSentence(last.text) || gap > maxGap || tooLong || clauseBreak) flush();
    }
    current.push(word);
  }
  flush();
  return lines;
}

/**
 * Apply a user's text edit to a caption line. Same word count: keep each
 * word's timing and swap the text (fixing a misheard word). Different count:
 * spread the line's original span over the new words by character length.
 */
export function retimeLine(line: CaptionLine, newText: string): CaptionLine {
  const tokens = newText.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { ...line, words: [] };
  if (tokens.length === line.words.length) {
    return { ...line, words: line.words.map((word, index) => ({ ...word, text: tokens[index] })) };
  }
  const span = Math.max(MIN_WORD * tokens.length, line.end - line.start);
  const totalChars = tokens.reduce((sum, token) => sum + token.length + 1, 0);
  let cursor = line.start;
  const words = tokens.map((text, index) => {
    const length = (span * (text.length + 1)) / totalChars;
    const word = { id: `${line.id}-e${index}`, text, start: round3(cursor), end: round3(cursor + length) };
    cursor += length;
    return word;
  });
  return { ...line, words, end: words.at(-1)!.end };
}

/** Drop empty lines and re-derive each line's span from its words. */
export function tidyLines(lines: CaptionLine[]): CaptionLine[] {
  return lines
    .filter((line) => line.words.length)
    .map((line) => ({ ...line, start: line.words[0].start, end: line.words.at(-1)!.end }))
    .sort((a, b) => a.start - b.start);
}

export const lineText = (line: CaptionLine) => line.words.map((word) => word.text).join(" ");

/** The caption on screen at `time` (held briefly past its last word so it can be read). */
export function activeLine(lines: CaptionLine[], time: number, hold = 0.35): CaptionLine | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextStart = lines[i + 1]?.start ?? Infinity;
    if (time >= line.start && time < Math.min(line.end + hold, nextStart)) return line;
  }
  return null;
}

/** Index of the word being spoken at `time` (-1 before the first, last index after the end). */
export function activeWordIndex(line: CaptionLine, time: number): number {
  if (time < line.start) return -1;
  for (let i = 0; i < line.words.length; i++) {
    if (time < line.words[i].end) return time >= line.words[i].start ? i : i - 1;
  }
  return line.words.length - 1;
}

// ---------------------------------------------------------------- styles

export type HighlightMode = "color" | "box" | "pop" | "reveal" | "none";

export type CaptionPreset = {
  id: string;
  label: string;
  font: string;
  weight: number;
  uppercase: boolean;
  fill: string;
  highlight: string;
  /** Text colour on top of a highlight box. */
  highlightText: string;
  mode: HighlightMode;
  stroke: string;
  /** Stroke width as a fraction of font size. */
  strokeWidth: number;
  shadow: boolean;
  /** Caption backing plate behind the whole line. */
  plate: string | null;
  /** Font size as a fraction of the frame's shorter side. */
  size: number;
  /** Vertical centre, 0 top .. 1 bottom. */
  y: number;
};

export const CAPTION_PRESETS: CaptionPreset[] = [
  { id: "bold-pop", label: "Bold pop", font: "Arial Black, Arial, sans-serif", weight: 900, uppercase: true, fill: "#ffffff", highlight: "#c8ef4b", highlightText: "#c8ef4b", mode: "pop", stroke: "#000000", strokeWidth: 0.16, shadow: true, plate: null, size: 0.075, y: 0.72 },
  { id: "highlight-box", label: "Highlight box", font: "Arial, sans-serif", weight: 800, uppercase: false, fill: "#ffffff", highlight: "#7c5cff", highlightText: "#ffffff", mode: "box", stroke: "#000000", strokeWidth: 0.1, shadow: true, plate: null, size: 0.065, y: 0.74 },
  { id: "karaoke", label: "Karaoke", font: "Arial, sans-serif", weight: 800, uppercase: false, fill: "#9aa3a0", highlight: "#34d6c7", highlightText: "#34d6c7", mode: "color", stroke: "#000000", strokeWidth: 0.08, shadow: true, plate: "#000000a6", size: 0.058, y: 0.82 },
  { id: "word-reveal", label: "Word reveal", font: "Georgia, serif", weight: 700, uppercase: false, fill: "#fff6e0", highlight: "#f7c84b", highlightText: "#fff6e0", mode: "reveal", stroke: "#000000", strokeWidth: 0.06, shadow: true, plate: null, size: 0.062, y: 0.78 },
  { id: "clean-subtitle", label: "Clean subtitle", font: "Arial, sans-serif", weight: 600, uppercase: false, fill: "#ffffff", highlight: "#ffffff", highlightText: "#ffffff", mode: "none", stroke: "#000000", strokeWidth: 0.0, shadow: false, plate: "#000000b3", size: 0.045, y: 0.88 },
];

export const presetById = (id: string) => CAPTION_PRESETS.find((preset) => preset.id === id) ?? CAPTION_PRESETS[0];

export type WordVisual = {
  /** 0 hidden .. 1 fully visible. */
  alpha: number;
  scale: number;
  highlighted: boolean;
};

/** How word `index` of `line` looks at `time` under `mode`. Pure — shared by preview and export. */
export function wordVisual(line: CaptionLine, index: number, time: number, mode: HighlightMode): WordVisual {
  const word = line.words[index];
  const current = activeWordIndex(line, time);
  const spoken = time >= word.start;
  const isCurrent = index === current && time < word.end + 0.05;
  switch (mode) {
    case "reveal": {
      const t = Math.max(0, Math.min(1, (time - word.start) / 0.12));
      return { alpha: spoken ? t : 0, scale: 1, highlighted: false };
    }
    case "pop": {
      const t = Math.max(0, Math.min(1, (time - word.start) / 0.14));
      // Lands slightly oversized with a quick bounce, then holds a little larger.
      return { alpha: 1, scale: isCurrent ? 1.1 + 0.12 * Math.sin(t * Math.PI) : 1, highlighted: isCurrent };
    }
    case "color":
      return { alpha: 1, scale: 1, highlighted: spoken };
    case "box":
      return { alpha: 1, scale: 1, highlighted: isCurrent };
    default:
      return { alpha: 1, scale: 1, highlighted: false };
  }
}

// ---------------------------------------------------------------- layout

export type LaidOutWord = { index: number; text: string; x: number; y: number; width: number };

/**
 * Wrap a line's words into centred rows that fit `maxWidth`. `measure` returns
 * a word's rendered width (canvas measureText in the browser). Returns word
 * positions with x as the left edge and y as the row's baseline centre.
 */
export function layoutCaption(
  texts: string[],
  measure: (text: string) => number,
  options: { maxWidth: number; centerX: number; centerY: number; lineHeight: number; spaceWidth: number },
): LaidOutWord[] {
  const rows: Array<{ items: Array<{ index: number; text: string; width: number }>; width: number }> = [];
  let row: (typeof rows)[number] = { items: [], width: 0 };
  texts.forEach((text, index) => {
    const width = measure(text);
    const added = row.items.length ? options.spaceWidth + width : width;
    if (row.items.length && row.width + added > options.maxWidth) {
      rows.push(row);
      row = { items: [], width: 0 };
    }
    row.width += row.items.length ? options.spaceWidth + width : width;
    row.items.push({ index, text, width });
  });
  if (row.items.length) rows.push(row);
  const top = options.centerY - ((rows.length - 1) * options.lineHeight) / 2;
  const out: LaidOutWord[] = [];
  rows.forEach((item, rowIndex) => {
    let x = options.centerX - item.width / 2;
    for (const word of item.items) {
      out.push({ index: word.index, text: word.text, x, y: top + rowIndex * options.lineHeight, width: word.width });
      x += word.width + options.spaceWidth;
    }
  });
  return out;
}

// ---------------------------------------------------------------- export

export function linesToCues(lines: CaptionLine[]): CaptionCue[] {
  return tidyLines(lines).map((line, index, all) => {
    const nextStart = all[index + 1]?.start ?? Infinity;
    return { start: line.start, end: Math.min(line.end + 0.35, nextStart), text: lineText(line) };
  });
}

export function linesToSrt(lines: CaptionLine[]) {
  return `${captionsToSrt(linesToCues(lines))}\n`;
}

const vttClock = (seconds: number) => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};

const escapeVtt = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * WebVTT with inline per-word timestamps (`<00:00:01.250>word`), which players
 * that support karaoke-style cues use to highlight each word as it is spoken.
 */
export function linesToVtt(lines: CaptionLine[], wordTimestamps = true) {
  const cues = tidyLines(lines);
  const blocks = cues.map((line, index) => {
    const nextStart = cues[index + 1]?.start ?? Infinity;
    const end = Math.min(line.end + 0.35, nextStart);
    const body = wordTimestamps
      ? line.words.map((word, i) => (i === 0 ? escapeVtt(word.text) : `<${vttClock(word.start)}>${escapeVtt(word.text)}`)).join(" ")
      : escapeVtt(lineText(line));
    return `${index + 1}\n${vttClock(line.start)} --> ${vttClock(end)}\n${body}`;
  });
  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}

/** Caption lines as ScenePilot title cues (one per line — the editor animates whole lines). */
export function linesToTitleCues(lines: CaptionLine[], preset: CaptionPreset): TitleCue[] {
  return linesToCues(lines).map((cue, index) => ({
    id: `caption-${index}-${Math.round(cue.start * 1000)}`,
    text: preset.uppercase ? cue.text.toUpperCase() : cue.text,
    start: cue.start,
    duration: Math.max(0.2, cue.end - cue.start),
    y: preset.y,
    size: Math.min(0.12, Math.max(0.04, preset.size)),
    color: preset.mode === "none" ? preset.fill : preset.highlight,
    style: preset.mode === "pop" ? "pop" : "rise",
    animator: preset.mode === "reveal" ? "typewriter" : "none",
  }));
}

/**
 * A `.scenepilot.json` starter cut carrying the captions as title cues. For an
 * existing project, importing the SRT keeps the edit and only adds captions;
 * this file is for starting a fresh project from the captioned clip.
 */
export function linesToCutFile(lines: CaptionLine[], preset: CaptionPreset, options: { project: string; duration: number; mainAsset?: { name: string; kind: "video" | "audio"; size?: number; lastModified?: number } }) {
  return {
    format: CUT_FILE_FORMAT,
    version: CURRENT_CUT_FILE_VERSION,
    project: options.project,
    duration: Math.max(0.1, options.duration),
    bpm: 120,
    beatOffset: 0,
    beats: [] as number[],
    sections: [] as unknown[],
    videoClips: [] as unknown[],
    placements: [] as unknown[],
    compositions: [] as unknown[],
    tracks: [] as unknown[],
    baseCuts: [] as unknown[],
    titles: linesToTitleCues(lines, preset),
    mainAsset: options.mainAsset,
    assets: [] as unknown[],
    effects: DEFAULT_EFFECTS,
    savedAt: 0,
  };
}
