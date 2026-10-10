// Board (alpha) — script → shot list → storyboard. Rule-based and offline: no
// language model, no network. Parses screenplay-style text (Fountain-ish scene
// headings, character cues, parentheticals, transitions, explicit shot lines)
// or plain prose/bullets into scenes and shots, guesses a shot type, lens and
// duration for each, and turns the finished board into ScenePilot timeline
// markers inside a `.scenepilot.json` starter cut. Pure and deterministic.

import type { TimelineMarker } from "./pro-editor.ts";
import { CUT_FILE_FORMAT, CURRENT_CUT_FILE_VERSION, DEFAULT_EFFECTS } from "./project-store.ts";

export const SHOT_TYPES = ["EWS", "WS", "MS", "MCU", "CU", "ECU", "OTS", "POV", "INSERT", "TWO", "AERIAL"] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  EWS: "Extreme wide",
  WS: "Wide",
  MS: "Medium",
  MCU: "Medium close-up",
  CU: "Close-up",
  ECU: "Extreme close-up",
  OTS: "Over the shoulder",
  POV: "Point of view",
  INSERT: "Insert",
  TWO: "Two shot",
  AERIAL: "Aerial",
};

/** Starting-point focal lengths (full-frame equivalent). Editable per shot. */
export const DEFAULT_LENS: Record<ShotType, string> = {
  EWS: "18mm",
  WS: "24mm",
  MS: "35mm",
  MCU: "50mm",
  CU: "85mm",
  ECU: "100mm macro",
  OTS: "50mm",
  POV: "28mm",
  INSERT: "100mm macro",
  TWO: "35mm",
  AERIAL: "24mm",
};

export type BoardShot = {
  id: string;
  description: string;
  character?: string;
  dialogue?: string;
  shotType: ShotType;
  lens: string;
  /** Seconds. */
  duration: number;
  notes: string;
  /** Frame image as a data URL (uploaded or sketched). */
  frame?: string;
};

export type BoardScene = { id: string; heading: string; shots: BoardShot[] };

export type BoardAspect = "16:9" | "2.39:1" | "9:16" | "1:1";

export type Board = {
  format: "scenepilot-board";
  version: 1;
  title: string;
  aspect: BoardAspect;
  scenes: BoardScene[];
  updatedAt: number;
};

const SCENE_HEADING = /^(?:\.(?!\.)|(?:INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s])/i;
const TRANSITION = /^(?:[A-Z ]+ TO:|FADE (?:IN|OUT)[.:]?|CUT TO BLACK\.?|SMASH CUT\.?|>.*)$/;
const SHOT_LINE = /^(?:(EXTREME |X)?CLOSE[- ]?UP|ECU|CU|CLOSE ON|ANGLE ON|WIDE(?: SHOT)?|WIDE ON|ESTABLISHING(?: SHOT)?|MEDIUM(?: SHOT)?|MS|MCU|INSERT|POV|OVER THE SHOULDER|OTS|TWO SHOT|AERIAL|DRONE SHOT|TRACKING SHOT|BACK TO SCENE)\b/;
const CHARACTER_CUE = /^(?=.*[A-Z])[A-Z0-9 .'\-#@&]{2,40}(?:\s*\((?:V\.O\.|O\.S\.|O\.C\.|CONT'D|CONT’D|[A-Z .']+)\))?\s*\^?$/;

/** Short, stable-ish ids. Deterministic when `seed` is provided (tests). */
export function makeIdFactory(seed?: string) {
  let counter = 0;
  return (prefix: string) => {
    counter += 1;
    if (seed !== undefined) return `${prefix}-${seed}${counter}`;
    const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return `${prefix}-${random}`;
  };
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Rough on-screen time: dialogue at ~150 wpm, action at ~3 words/second. */
export function estimateDuration(description: string, dialogue?: string): number {
  if (dialogue && dialogue.trim()) return round1(Math.min(20, Math.max(1.5, words(dialogue) / 2.5 + 0.6)));
  return round1(Math.min(12, Math.max(2, words(description) / 3)));
}

/** Guess a shot type from the words in a beat of action or dialogue. */
export function guessShotType(text: string, context: { firstInScene: boolean; hasDialogue: boolean; explicit?: string }): ShotType {
  const source = `${context.explicit ?? ""} ${text}`.toLowerCase();
  if (/\b(extreme close|ecu|xcu)\b/.test(source)) return "ECU";
  if (/\binsert\b/.test(source)) return "INSERT";
  if (/\bpov\b|point of view|through (?:his|her|their) eyes/.test(source)) return "POV";
  if (/\b(aerial|drone|bird'?s[- ]eye|from above)\b/.test(source)) return "AERIAL";
  if (/\bover the shoulder\b|\bots\b/.test(source)) return "OTS";
  if (/\btwo shot\b/.test(source)) return "TWO";
  if (/\b(close[- ]?up|close on|cu)\b/.test(source)) return "CU";
  if (/\b(mcu|medium close)\b/.test(source)) return "MCU";
  if (/\b(medium shot|ms)\b/.test(source)) return "MS";
  if (/\b(establishing|wide|skyline|landscape|vast|horizon)\b/.test(source)) return context.firstInScene ? "EWS" : "WS";
  if (context.hasDialogue) return "MCU";
  if (/\b(eyes|tear|lips|fingers|hand|hands|ring|phone screen|button|note|letter|keys?)\b/.test(source)) return "CU";
  if (context.firstInScene) return "WS";
  return "MS";
}

function makeShot(id: string, description: string, opts: { firstInScene: boolean; character?: string; dialogue?: string; explicit?: string }): BoardShot {
  const shotType = guessShotType(`${description} ${opts.dialogue ?? ""}`, { firstInScene: opts.firstInScene, hasDialogue: Boolean(opts.dialogue), explicit: opts.explicit });
  return {
    id,
    description: description.trim(),
    character: opts.character,
    dialogue: opts.dialogue?.trim() || undefined,
    shotType,
    lens: DEFAULT_LENS[shotType],
    duration: estimateDuration(description, opts.dialogue),
    notes: "",
  };
}

function isScreenplay(lines: string[]) {
  return lines.some((line) => SCENE_HEADING.test(line.trim()))
    || lines.filter((line, i) => CHARACTER_CUE.test(line.trim()) && lines[i + 1]?.trim() && !CHARACTER_CUE.test(lines[i + 1].trim())).length >= 2;
}

/**
 * Split a script into scenes and shots.
 *
 * Screenplay mode (scene headings or character cues present): each scene
 * heading starts a scene; each action paragraph becomes a shot; each
 * character + dialogue block becomes a coverage shot on that character; an
 * explicit shot line ("CLOSE ON", "INSERT", "POV") starts a shot of that type;
 * transitions are dropped.
 *
 * Prose mode: blank-line separated paragraphs (or "Scene"/"#" headings) become
 * scenes, and each sentence or bullet becomes a shot.
 */
export function parseScript(text: string, idFor: (prefix: string) => string = makeIdFactory()): BoardScene[] {
  const lines = text.replace(/\r/g, "").replace(/\t/g, "    ").split("\n");
  return isScreenplay(lines) ? parseScreenplay(lines, idFor) : parseProse(text, idFor);
}

function parseScreenplay(lines: string[], idFor: (prefix: string) => string): BoardScene[] {
  const scenes: BoardScene[] = [];
  let scene: BoardScene | null = null;
  let pendingExplicit: string | undefined;
  const ensureScene = () => {
    if (!scene) { scene = { id: idFor("scene"), heading: "OPENING", shots: [] }; scenes.push(scene); }
    return scene;
  };
  const addShot = (description: string, extra: { character?: string; dialogue?: string } = {}) => {
    const target = ensureScene();
    target.shots.push(makeShot(idFor("shot"), description, { firstInScene: target.shots.length === 0, ...extra, explicit: pendingExplicit }));
    pendingExplicit = undefined;
  };

  // Group into paragraphs separated by blank lines.
  const paragraphs: string[][] = [];
  let current: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (current.length) paragraphs.push(current); current = []; continue; }
    current.push(line);
  }
  if (current.length) paragraphs.push(current);

  for (const paragraph of paragraphs) {
    const first = paragraph[0];
    if (/^(?:title|credit|author|draft date|contact):/i.test(first)) continue;
    if (/^\/\*|^\[\[|^=/.test(first)) continue; // Fountain notes/boneyard/page breaks
    if (SCENE_HEADING.test(first)) {
      scene = { id: idFor("scene"), heading: first.replace(/^\./, "").replace(/\s+#[^#]*#$/, "").toUpperCase(), shots: [] };
      scenes.push(scene);
      const rest = paragraph.slice(1).join(" ");
      if (rest) addShot(rest);
      continue;
    }
    if (paragraph.length === 1 && TRANSITION.test(first) && !SHOT_LINE.test(first)) continue;
    if (SHOT_LINE.test(first.toUpperCase()) && first === first.toUpperCase()) {
      const explicit = first.replace(/[:.\s-]+$/, "");
      if (/^BACK TO SCENE/.test(explicit)) { pendingExplicit = undefined; continue; }
      pendingExplicit = explicit;
      const rest = paragraph.slice(1).join(" ");
      // A bare shot line ("CLOSE ON THE RING") describes the shot itself.
      addShot(rest || explicit.replace(/^(?:CLOSE ON|ANGLE ON|INSERT|WIDE ON|POV)\s*[-:–]?\s*/i, "") || explicit);
      continue;
    }
    if (paragraph.length > 1 && CHARACTER_CUE.test(first) && !SCENE_HEADING.test(first)) {
      const character = first.replace(/\s*\^$/, "").replace(/\s*\((?:CONT'D|CONT’D)\)/, "").trim();
      const dialogue = paragraph.slice(1).filter((line) => !/^\(.*\)$/.test(line)).join(" ");
      const parenthetical = paragraph.slice(1).filter((line) => /^\(.*\)$/.test(line)).map((line) => line.slice(1, -1)).join("; ");
      const name = character.replace(/\s*\(.*\)$/, "");
      addShot(`${name} speaks${parenthetical ? ` (${parenthetical})` : ""}.`, { character: name, dialogue });
      continue;
    }
    addShot(paragraph.join(" ").replace(/^!/, ""));
  }
  return scenes.filter((item) => item.shots.length || scenes.length === 1);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 1);
}

function parseProse(text: string, idFor: (prefix: string) => string): BoardScene[] {
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const scenes: BoardScene[] = [];
  for (const [index, block] of blocks.entries()) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    let heading = `SCENE ${index + 1}`;
    const isBullet = (line: string) => /^(?:[-*•]|\d+[.)])\s+/.test(line);
    if (/^(?:#+\s*|scene\s+\d+[:.\-–]?\s*)/i.test(lines[0]) || (lines.length > 1 && !isBullet(lines[0]) && lines[0].length <= 60 && !/[.!?]$/.test(lines[0]))) {
      heading = lines.shift()!.replace(/^#+\s*/, "").toUpperCase() || heading;
    }
    const bullets = lines.length > 0 && lines.every(isBullet);
    const beats = bullets
      ? lines.map((line) => line.replace(/^(?:[-*•]|\d+[.)])\s+/, ""))
      : splitSentences(lines.join(" "));
    const scene: BoardScene = { id: idFor("scene"), heading, shots: [] };
    for (const beat of beats) scene.shots.push(makeShot(idFor("shot"), beat, { firstInScene: scene.shots.length === 0 }));
    if (scene.shots.length) scenes.push(scene);
  }
  return scenes;
}

export function createBoard(title: string, scenes: BoardScene[], aspect: BoardAspect = "16:9"): Board {
  return { format: "scenepilot-board", version: 1, title: title.trim() || "Untitled board", aspect, scenes, updatedAt: Date.now() };
}

/** Production-style shot numbers: scene 1 → 1A, 1B…; past Z → 1AA, 1AB… */
export function shotNumber(sceneIndex: number, shotIndex: number): string {
  const letter = (n: number): string => (n < 26 ? String.fromCharCode(65 + n) : letter(Math.floor(n / 26) - 1) + String.fromCharCode(65 + (n % 26)));
  return `${sceneIndex + 1}${letter(shotIndex)}`;
}

export function boardDuration(board: Pick<Board, "scenes">): number {
  return round1(board.scenes.reduce((total, scene) => total + scene.shots.reduce((sum, shot) => sum + Math.max(0, shot.duration), 0), 0));
}

/** Move a shot to `toIndex` within scene `toSceneId` (which may be its own scene). Returns a new scene list. */
export function moveShot(scenes: BoardScene[], shotId: string, toSceneId: string, toIndex: number): BoardScene[] {
  let moving: BoardShot | undefined;
  const without = scenes.map((scene) => {
    const index = scene.shots.findIndex((shot) => shot.id === shotId);
    if (index < 0) return scene;
    moving = scene.shots[index];
    return { ...scene, shots: scene.shots.filter((shot) => shot.id !== shotId) };
  });
  if (!moving) return scenes;
  const shot = moving;
  return without.map((scene) => {
    if (scene.id !== toSceneId) return scene;
    const shots = [...scene.shots];
    shots.splice(Math.max(0, Math.min(shots.length, toIndex)), 0, shot);
    return { ...scene, shots };
  });
}

const MARKER_COLORS = ["#34d6c7", "#c8ef4b", "#f7c84b", "#ff695d", "#b79cff"];

/**
 * One chapter marker per scene plus one range marker per shot, laid end to end
 * using each shot's duration. Labels carry the shot number, type and the first
 * words of the description, so the timeline reads like the shot list.
 */
export function boardToMarkers(board: Pick<Board, "scenes">): TimelineMarker[] {
  const markers: TimelineMarker[] = [];
  let time = 0;
  board.scenes.forEach((scene, sceneIndex) => {
    const color = MARKER_COLORS[sceneIndex % MARKER_COLORS.length];
    markers.push({ id: `board-${scene.id}`, time: round3(time), label: `SC ${sceneIndex + 1} · ${scene.heading}`.slice(0, 80), color, kind: "chapter" });
    scene.shots.forEach((shot, shotIndex) => {
      const duration = Math.max(0.1, shot.duration);
      const summary = (shot.dialogue ? `${shot.character ?? ""}: ${shot.dialogue}` : shot.description).replace(/\s+/g, " ").trim();
      markers.push({
        id: `board-${shot.id}`,
        time: round3(time),
        label: `${shotNumber(sceneIndex, shotIndex)} ${shot.shotType} · ${summary}`.slice(0, 80),
        color,
        kind: "marker",
        duration: round3(duration),
      });
      time += duration;
    });
  });
  return markers;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** A plain-text shot list, used as the project's story brief in ScenePilot. */
export function boardToShotListText(board: Pick<Board, "scenes" | "title">): string {
  const lines: string[] = [board.title ? `${board.title.toUpperCase()} — SHOT LIST` : "SHOT LIST"];
  board.scenes.forEach((scene, sceneIndex) => {
    lines.push("", `SCENE ${sceneIndex + 1}: ${scene.heading}`);
    scene.shots.forEach((shot, shotIndex) => {
      const body = shot.dialogue ? `${shot.description} “${shot.dialogue}”` : shot.description;
      lines.push(`${shotNumber(sceneIndex, shotIndex)}  ${shot.shotType}  ${shot.lens}  ${shot.duration}s  ${body}${shot.notes ? `  [${shot.notes}]` : ""}`);
    });
  });
  return lines.join("\n");
}

/** The shot list as CSV (RFC 4180 quoting) for spreadsheets and call sheets. */
export function boardToCsv(board: Pick<Board, "scenes">): string {
  const quote = (value: string | number) => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows: Array<Array<string | number>> = [["Shot", "Scene", "Type", "Lens", "Seconds", "Action", "Character", "Dialogue", "Notes"]];
  board.scenes.forEach((scene, sceneIndex) => scene.shots.forEach((shot, shotIndex) => {
    rows.push([shotNumber(sceneIndex, shotIndex), scene.heading, shot.shotType, shot.lens, shot.duration, shot.description, shot.character ?? "", shot.dialogue ?? "", shot.notes]);
  }));
  return `${rows.map((row) => row.map(quote).join(",")).join("\r\n")}\r\n`;
}

/**
 * A `.scenepilot.json` starter cut for ScenePilot's "Import cut": no media, a
 * sequence as long as the board, and the shot list as timeline markers (in the
 * project's pro state, where ScenePilot keeps markers) plus a story brief.
 * Frames are not embedded — they would bloat the cut file.
 */
export function boardToCutFile(board: Board) {
  const duration = Math.max(1, boardDuration(board));
  return {
    format: CUT_FILE_FORMAT,
    version: CURRENT_CUT_FILE_VERSION,
    project: board.title || "Storyboard",
    duration,
    bpm: 120,
    beatOffset: 0,
    beats: [] as number[],
    sections: [] as unknown[],
    videoClips: [] as unknown[],
    placements: [] as unknown[],
    compositions: [] as unknown[],
    tracks: [] as unknown[],
    baseCuts: [] as unknown[],
    titles: [] as unknown[],
    storyBrief: boardToShotListText(board),
    assets: [] as unknown[],
    effects: DEFAULT_EFFECTS,
    proState: { markers: boardToMarkers(board), storyBrief: boardToShotListText(board) },
    savedAt: board.updatedAt,
  };
}

const ASPECTS: BoardAspect[] = ["16:9", "2.39:1", "9:16", "1:1"];

/** Load a saved board JSON, repairing anything missing or malformed. */
export function parseBoardJson(text: string): Board {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(text) as Record<string, unknown>; } catch { throw new Error("That file isn't valid JSON."); }
  if (raw.format !== "scenepilot-board") throw new Error("That doesn't look like a ScenePilot board file.");
  const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
  const scenes = (Array.isArray(raw.scenes) ? raw.scenes : []).map((rawScene, sceneIndex) => {
    const scene = (rawScene ?? {}) as Record<string, unknown>;
    const shots = (Array.isArray(scene.shots) ? scene.shots : []).map((rawShot, shotIndex) => {
      const shot = (rawShot ?? {}) as Record<string, unknown>;
      const shotType = (SHOT_TYPES as readonly string[]).includes(String(shot.shotType)) ? (shot.shotType as ShotType) : "MS";
      const duration = typeof shot.duration === "number" && Number.isFinite(shot.duration) ? Math.max(0.1, Math.min(600, shot.duration)) : 3;
      const frame = typeof shot.frame === "string" && /^data:image\/(?:png|jpeg|webp);base64,/.test(shot.frame) ? shot.frame : undefined;
      return {
        id: str(shot.id) || `shot-${sceneIndex}-${shotIndex}`,
        description: str(shot.description),
        character: str(shot.character) || undefined,
        dialogue: str(shot.dialogue) || undefined,
        shotType,
        lens: str(shot.lens, DEFAULT_LENS[shotType]),
        duration,
        notes: str(shot.notes),
        frame,
      } satisfies BoardShot;
    });
    return { id: str(scene.id) || `scene-${sceneIndex}`, heading: str(scene.heading, `SCENE ${sceneIndex + 1}`), shots } satisfies BoardScene;
  });
  return {
    format: "scenepilot-board",
    version: 1,
    title: str(raw.title, "Untitled board"),
    aspect: ASPECTS.includes(raw.aspect as BoardAspect) ? (raw.aspect as BoardAspect) : "16:9",
    scenes,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}
