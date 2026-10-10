import type { AnalysisResult } from "./analysis-engine";
import type { BaseCut } from "./sequencer";
import type { TitleCue } from "./titles";
import { GRADE_PRESETS, NEUTRAL_GRADE_ADJUST, type GradeAdjust } from "./grade.ts";
import { PUNCH_PRESETS, SHAKE_PRESETS } from "./motion.ts";
import { STROBE_PRESETS } from "./strobe.ts";
import { STUTTER_PRESETS } from "./stutter.ts";
import { SPEED_PRESETS } from "./speed.ts";
import { TRANSITION_PRESETS } from "./transitions.ts";
import type { VideoClip } from "./video-timeline.ts";
import type { ProjectIntelligence, ProjectTranscriptChunk } from "./project-intelligence.ts";

/**
 * Every effect knob, in one serializable bundle. Kept flat and primitive so it
 * survives both IndexedDB (structured clone) and JSON (shareable cut files).
 */
export type EffectSettings = {
  styleId: string;
  autoEnergy: "smooth" | "dynamic" | "maximum";
  montageEnabled: boolean;
  montagePace: string;
  punchPreset: string;
  transitionType: string;
  strobePreset: string;
  strobeColor: string;
  strobeSecondaryColor: string;
  strobeAlternate: boolean;
  strobeIntensity: number;
  strobeAttack: number;
  strobeHold: number;
  strobeDecay: number;
  strobeShape: string;
  strobeMode: string;
  strobeBlend: string;
  strobeX: number;
  strobeY: number;
  strobeSize: number;
  strobeSoftness: number;
  strobeAngle: number;
  strobeSafeMode: boolean;
  strobeSensitivity: number;
  strobeBand: string;
  stutterPreset: string;
  speedPreset: string;
  dropRampEnabled: boolean;
  audioReactive: boolean;
  shakePreset: string;
  lookPreset: string;
  /** Manual colour adjustments layered on the look preset. */
  manualGrade: GradeAdjust;
  mirrorMode: number;
  streak: number;
  echoPreset: string;
};

export type StoredProject<TSection, TPlacement, TTrack = unknown> = {
  schemaVersion?: 2;
  projectId?: string;
  name?: string;
  mainFile: File | null;
  mainSourcePath?: string;
  settings?: unknown;
  assets: Array<{
    id: string;
    name: string;
    file: File;
    kind: "image" | "video" | "audio";
    color: string;
    duration?: number;
    folderId?: string;
    favorite?: boolean;
    proxyState?: string;
    proxyFile?: File;
    waveform?: number[];
    nativeCodec?: string;
    nativeDimensions?: string;
    nativeFrameRate?: number;
    nativeVfr?: boolean;
    nativeBitDepth?: number;
    nativeHdr?: boolean;
    offline?: boolean;
    sourceSize?: number;
    sourceLastModified?: number;
    /** Desktop Pro keeps path references so large projects do not need to copy
     * every source blob and missing media can be relinked deterministically. */
    sourcePath?: string;
    proxyPath?: string;
  }>;
  duration: number;
  bpm: number;
  beatOffset?: number;
  beats: number[];
  sections: TSection[];
  /** Canonical unified video timeline. Older projects fall back to the two
   * serialized lane views below during migration. */
  videoClips?: VideoClip[];
  placements: TPlacement[];
  compositions?: unknown[];
  tracks?: TTrack[];
  baseCuts?: BaseCut[];
  titles?: TitleCue[];
  analysis: AnalysisResult | null;
  /** Versioned professional-editor state. Optional for older projects. */
  proState?: unknown;
  autoEnergy: "smooth" | "dynamic" | "maximum";
  /** All effect settings. Optional for backward-compat with older saves. */
  effects?: EffectSettings;
  savedAt: number;
};

export const DEFAULT_EFFECTS: EffectSettings = {
  styleId: "cinematic",
  autoEnergy: "dynamic",
  montageEnabled: true,
  montagePace: "balanced",
  punchPreset: "dynamic",
  transitionType: "zoom",
  strobePreset: "off",
  strobeColor: "#ffffff",
  strobeSecondaryColor: "#ff334f",
  strobeAlternate: false,
  strobeIntensity: 0.7,
  strobeAttack: 0,
  strobeHold: 0.008,
  strobeDecay: 0.08,
  strobeShape: "exponential",
  strobeMode: "full",
  strobeBlend: "screen",
  strobeX: 0.5,
  strobeY: 0.5,
  strobeSize: 0.75,
  strobeSoftness: 0.65,
  strobeAngle: 0,
  strobeSafeMode: true,
  strobeSensitivity: 0.5,
  strobeBand: "all",
  stutterPreset: "off",
  speedPreset: "off",
  dropRampEnabled: true,
  audioReactive: false,
  shakePreset: "off",
  lookPreset: "cinematic",
  manualGrade: NEUTRAL_GRADE_ADJUST,
  mirrorMode: 0,
  streak: 0,
  echoPreset: "off",
};

/** Fill any missing/invalid field from an untrusted object with its default. */
function coerceGradeAdjust(raw: unknown): GradeAdjust {
  const source = (raw ?? {}) as Record<string, unknown>;
  const num = (key: keyof GradeAdjust) =>
    typeof source[key] === "number" && Number.isFinite(source[key]) ? (source[key] as number) : NEUTRAL_GRADE_ADJUST[key];
  return {
    exposure: Math.max(0.1, Math.min(3, num("exposure"))),
    contrast: Math.max(0.1, Math.min(3, num("contrast"))),
    saturation: Math.max(0, Math.min(3, num("saturation"))),
    temperature: Math.max(-1, Math.min(1, num("temperature"))),
    tint: Math.max(-1, Math.min(1, num("tint"))),
    bloom: Math.max(0, Math.min(3, num("bloom"))),
    vignette: Math.max(0, Math.min(1, num("vignette"))),
    grain: Math.max(0, Math.min(1, num("grain"))),
    aberration: Math.max(0, Math.min(0.05, num("aberration"))),
  };
}

export function coerceEffectSettings(raw: unknown): EffectSettings {
  const source = (raw ?? {}) as Record<string, unknown>;
  const allowed: Partial<Record<keyof EffectSettings, string[]>> = {
    lookPreset: Object.keys(GRADE_PRESETS), punchPreset: Object.keys(PUNCH_PRESETS),
    shakePreset: Object.keys(SHAKE_PRESETS), strobePreset: Object.keys(STROBE_PRESETS),
    stutterPreset: Object.keys(STUTTER_PRESETS), speedPreset: Object.keys(SPEED_PRESETS),
    transitionType: Object.keys(TRANSITION_PRESETS), montagePace: ["cinematic", "balanced", "frenetic"],
    echoPreset: ["off", "ghost", "trails", "pulse", "smear"],
  };
  const str = (key: keyof EffectSettings) => typeof source[key] === "string" && (!allowed[key] || allowed[key]!.includes(source[key] as string)) ? source[key] as string : DEFAULT_EFFECTS[key] as string;
  const num = (key: keyof EffectSettings) =>
    typeof source[key] === "number" && Number.isFinite(source[key]) ? (source[key] as number) : (DEFAULT_EFFECTS[key] as number);
  const energy = source.autoEnergy;
  return {
    styleId: str("styleId"),
    autoEnergy: energy === "smooth" || energy === "maximum" ? energy : "dynamic",
    montageEnabled: typeof source.montageEnabled === "boolean" ? source.montageEnabled : DEFAULT_EFFECTS.montageEnabled,
    montagePace: str("montagePace"),
    punchPreset: str("punchPreset"),
    transitionType: str("transitionType"),
    strobePreset: str("strobePreset"),
    strobeColor: /^#[0-9a-fA-F]{3,8}$/.test(String(source.strobeColor)) ? String(source.strobeColor) : DEFAULT_EFFECTS.strobeColor,
    strobeSecondaryColor: /^#[0-9a-fA-F]{3,8}$/.test(String(source.strobeSecondaryColor)) ? String(source.strobeSecondaryColor) : DEFAULT_EFFECTS.strobeSecondaryColor,
    strobeAlternate: typeof source.strobeAlternate === "boolean" ? source.strobeAlternate : DEFAULT_EFFECTS.strobeAlternate,
    strobeIntensity: Math.max(0, Math.min(1, num("strobeIntensity"))),
    strobeAttack: Math.max(0, Math.min(0.5, num("strobeAttack"))),
    strobeHold: Math.max(0, Math.min(0.5, num("strobeHold"))),
    strobeDecay: Math.max(0.01, Math.min(2, num("strobeDecay"))),
    strobeShape: ["exponential", "linear", "smooth", "square"].includes(String(source.strobeShape)) ? String(source.strobeShape) : DEFAULT_EFFECTS.strobeShape,
    strobeMode: ["full", "radial", "split", "bars", "sweep"].includes(String(source.strobeMode)) ? String(source.strobeMode) : DEFAULT_EFFECTS.strobeMode,
    strobeBlend: ["screen", "add", "overlay"].includes(String(source.strobeBlend)) ? String(source.strobeBlend) : DEFAULT_EFFECTS.strobeBlend,
    strobeX: Math.max(0, Math.min(1, num("strobeX"))),
    strobeY: Math.max(0, Math.min(1, num("strobeY"))),
    strobeSize: Math.max(0.05, Math.min(1.5, num("strobeSize"))),
    strobeSoftness: Math.max(0, Math.min(1, num("strobeSoftness"))),
    strobeAngle: Math.max(-180, Math.min(180, num("strobeAngle"))),
    strobeSafeMode: typeof source.strobeSafeMode === "boolean" ? source.strobeSafeMode : DEFAULT_EFFECTS.strobeSafeMode,
    strobeSensitivity: Math.max(0.1, Math.min(1, num("strobeSensitivity"))),
    strobeBand: source.strobeBand === "low" || source.strobeBand === "high" ? source.strobeBand : "all",
    stutterPreset: str("stutterPreset"),
    speedPreset: str("speedPreset"),
    dropRampEnabled: typeof source.dropRampEnabled === "boolean" ? source.dropRampEnabled : DEFAULT_EFFECTS.dropRampEnabled,
    audioReactive: typeof source.audioReactive === "boolean" ? source.audioReactive : DEFAULT_EFFECTS.audioReactive,
    shakePreset: str("shakePreset"),
    lookPreset: str("lookPreset"),
    manualGrade: coerceGradeAdjust(source.manualGrade),
    mirrorMode: Math.max(0, Math.min(3, Math.round(num("mirrorMode")))),
    streak: Math.max(0, Math.min(1, num("streak"))),
    echoPreset: str("echoPreset"),
  };
}

export const CUT_FILE_FORMAT = "scenepilot-cut";
export const CURRENT_CUT_FILE_VERSION = 2 as const;

export type CutFile<TSection = unknown, TPlacement = unknown, TTrack = unknown> = {
  format: typeof CUT_FILE_FORMAT;
  version: 1 | 2;
  project: string;
  duration: number;
  bpm: number;
  beatOffset: number;
  beats: number[];
  sections: TSection[];
  videoClips?: VideoClip[];
  placements: TPlacement[];
  compositions: unknown[];
  tracks: TTrack[];
  baseCuts: BaseCut[];
  titles: TitleCue[];
  projectIntelligence?: ProjectIntelligence | null;
  projectTranscripts?: Record<string, ProjectTranscriptChunk[]>;
  storyBrief?: string;
  mainAsset?: { name: string; kind: "video" | "audio"; size?: number; lastModified?: number; sourcePath?: string };
  assets: Array<{ id: string; name: string; kind: "image" | "video" | "audio"; size?: number; lastModified?: number; sourcePath?: string; folderId?: string; favorite?: boolean }>;
  effects: EffectSettings;
  proState?: unknown;
  settings?: unknown;
  savedAt: number;
};

/**
 * Parse a shareable `.scenepilot.json` cut file. Throws a readable error rather
 * than returning a half-valid object, so the caller can surface it to the user.
 */
export function parseCutFile(text: string): CutFile {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.format !== CUT_FILE_FORMAT) {
    throw new Error("That doesn't look like a ScenePilot cut file.");
  }
  if (raw.version !== undefined && raw.version !== 1 && raw.version !== 2) throw new Error("This project version is not supported. Open it in the ScenePilot version that created it.");
  const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  for (const key of ["assets", "sections", "videoClips", "placements", "compositions", "tracks", "baseCuts", "titles"]) {
    if (raw[key] !== undefined && (!Array.isArray(raw[key]) || !(raw[key] as unknown[]).every(isRecord))) throw new Error(`Invalid project ${key}: expected a list of objects.`);
  }
  for (const asset of (raw.assets ?? []) as Record<string, unknown>[]) {
    if (typeof asset.id !== "string" || typeof asset.name !== "string" || !["video", "audio", "image"].includes(String(asset.kind))) throw new Error("Invalid project media descriptor.");
  }
  for (const comp of (raw.compositions ?? []) as Record<string, unknown>[]) {
    if (typeof comp.id !== "string" || !Array.isArray(comp.layers) || !comp.layers.every(isRecord)) throw new Error("Invalid composition: layers are missing or malformed.");
    if (comp.tracks !== undefined && (!Array.isArray(comp.tracks) || !comp.tracks.every((track) => isRecord(track) && typeof track.id === "string"))) throw new Error("Invalid composition tracks.");
    for (const layer of comp.layers) {
      if (typeof layer.id !== "string" || typeof layer.kind !== "string") throw new Error("Invalid composition layer.");
      for (const field of ["keyframes", "effects", "masks"]) if (layer[field] !== undefined && (!Array.isArray(layer[field]) || !layer[field].every(isRecord))) throw new Error(`Invalid composition layer ${field}.`);
      for (const field of ["transform", "roto", "material"]) if (layer[field] !== undefined && !isRecord(layer[field])) throw new Error(`Invalid composition layer ${field}.`);
    }
  }
  if (raw.mainAsset !== undefined && (!isRecord(raw.mainAsset) || typeof raw.mainAsset.name !== "string" || !["audio", "video"].includes(String(raw.mainAsset.kind)))) throw new Error("Invalid project main media descriptor.");
  if (raw.proState !== undefined && !isRecord(raw.proState)) throw new Error("Invalid professional project settings.");
  if (isRecord(raw.proState)) for (const key of ["audioTracks", "audioBuses", "audioClips", "transcriptWords", "markers", "mediaBins"]) {
    const items = raw.proState[key];
    if (items !== undefined && (!Array.isArray(items) || !items.every(isRecord))) throw new Error(`Invalid project ${key}.`);
  }
  const array = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    format: CUT_FILE_FORMAT,
    version: raw.version === 2 ? 2 : 1,
    project: typeof raw.project === "string" ? raw.project : "Imported cut",
    duration: typeof raw.duration === "number" && raw.duration > 0 ? raw.duration : 0,
    bpm: typeof raw.bpm === "number" ? raw.bpm : 120,
    beatOffset: typeof raw.beatOffset === "number" ? raw.beatOffset : 0,
    beats: array<number>(raw.beats),
    sections: array(raw.sections),
    videoClips: array<VideoClip>(raw.videoClips),
    placements: array(raw.placements),
    compositions: array(raw.compositions),
    tracks: array(raw.tracks),
    baseCuts: array(raw.baseCuts),
    titles: array(raw.titles),
    projectIntelligence: raw.projectIntelligence && typeof raw.projectIntelligence === "object" ? raw.projectIntelligence as ProjectIntelligence : null,
    projectTranscripts: raw.projectTranscripts && typeof raw.projectTranscripts === "object" ? raw.projectTranscripts as Record<string, ProjectTranscriptChunk[]> : {},
    storyBrief: typeof raw.storyBrief === "string" ? raw.storyBrief : "",
    mainAsset: raw.mainAsset && typeof raw.mainAsset === "object" ? raw.mainAsset as CutFile["mainAsset"] : undefined,
    assets: array(raw.assets),
    effects: coerceEffectSettings(raw.effects),
    proState: raw.proState,
    settings: raw.settings,
    savedAt: typeof raw.savedAt === "number" ? raw.savedAt : 0,
  };
}

export type ProjectDiagnostic = { severity: "error" | "warning" | "info"; code: string; message: string };

export function diagnoseCutFile(cut: CutFile): ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = [];
  const assetIds = new Set(cut.assets.map((asset) => asset.id));
  const missing = new Set<string>();
  const timelineItems = cut.videoClips?.length ? cut.videoClips : [...cut.baseCuts, ...(cut.placements as Array<BaseCut & { compositionId?: string }>)];
  for (const item of timelineItems) {
    const normalized = item as BaseCut & { overlay?: { compositionId?: string }; compositionId?: string };
    const compositionId = normalized.overlay?.compositionId ?? normalized.compositionId;
    if (normalized.assetId && !compositionId && !assetIds.has(normalized.assetId)) missing.add(normalized.assetId);
  }
  if (missing.size) diagnostics.push({ severity: "error", code: "missing-media", message: `${missing.size} referenced media item${missing.size === 1 ? " is" : "s are"} absent from the project manifest.` });
  if (cut.version < CURRENT_CUT_FILE_VERSION) diagnostics.push({ severity: "info", code: "migration", message: `Legacy project v${cut.version} will be upgraded to v${CURRENT_CUT_FILE_VERSION} when saved.` });
  if (!timelineItems.length) diagnostics.push({ severity: "warning", code: "empty-sequence", message: "The sequence contains no video edits." });
  return diagnostics;
}

const DB_NAME = "scenepilot-studio";
const STORE_NAME = "projects";
const CURRENT_PROJECT = "current";

export type ProjectSummary = {
  id: string;
  name: string;
  savedAt: number;
  duration: number;
  mediaCount: number;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Project storage isn't available in this browser."));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch (error) {
      // Private mode / sandboxed contexts can throw synchronously on open.
      reject(error instanceof Error ? error : new Error("Project storage could not be opened."));
      return;
    }
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Project storage could not be opened."));
    request.onblocked = () => reject(new Error("Project storage is busy in another ScenePilot window."));
  });
}

export async function saveProject<TSection, TPlacement, TTrack = unknown>(
  project: StoredProject<TSection, TPlacement, TTrack>,
  projectId = CURRENT_PROJECT,
) {
  const mediaBytes = (project.mainFile?.size ?? 0) + project.assets.reduce((sum, asset) => sum + asset.file.size, 0);
  if (navigator.storage) {
    await navigator.storage.persist?.().catch(() => false);
    const estimate = await navigator.storage.estimate().catch((): StorageEstimate => ({}));
    const available = (estimate.quota ?? Infinity) - (estimate.usage ?? 0);
    if (available < mediaBytes * 1.1) {
      throw new Error(`This project needs about ${Math.ceil(mediaBytes / 1024 / 1024)} MB, but browser storage does not have enough room.`);
    }
  }
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      for (const { key, value } of plannedWrites(project, projectId)) store.put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Project could not be saved."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project storage ran out of space before the media finished saving."));
    });
  } finally {
    database.close();
  }
}

/** A "current session" slot that just points at a named project's record, so we
 *  don't copy its (possibly multi-GB) media a second time. */
export type ProjectPointer = { pointerTo: string };

export function isProjectPointer(record: unknown): record is ProjectPointer {
  return !!record && typeof record === "object" && "pointerTo" in record && !("assets" in record);
}

/**
 * The writes a save performs. A named save stores its full record AND updates
 * the "current session" slot to point at it — a tiny pointer, not another copy
 * of the media (which structured-clones the Blobs into IndexedDB a second time
 * and made the quota estimate under-count by ~2x). Pure, so it's testable
 * without IndexedDB.
 */
export function plannedWrites<TSection, TPlacement, TTrack>(
  project: StoredProject<TSection, TPlacement, TTrack>,
  projectId: string,
): Array<{ key: string; value: unknown }> {
  const writes: Array<{ key: string; value: unknown }> = [{ key: projectId, value: { ...project, projectId } }];
  if (projectId !== CURRENT_PROJECT) writes.push({ key: CURRENT_PROJECT, value: { pointerTo: projectId } satisfies ProjectPointer });
  return writes;
}

export async function loadProject<TSection, TPlacement, TTrack = unknown>(projectId = CURRENT_PROJECT) {
  const database = await openDatabase();
  const get = (key: string) => new Promise<unknown>((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("Project could not be restored."));
  });
  try {
    const record = await get(projectId);
    // The "current session" slot may point at a named project rather than hold a
    // full copy. Follow it one level. (Older saves stored a full copy here — the
    // `isProjectPointer` check leaves those untouched, so this stays compatible.)
    const resolved = isProjectPointer(record) ? await get(record.pointerTo) : record;
    return (resolved ?? null) as StoredProject<TSection, TPlacement, TTrack> | null;
  } finally {
    database.close();
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const database = await openDatabase();
  try {
    return await new Promise<ProjectSummary[]>((resolve, reject) => {
      const store = database.transaction(STORE_NAME).objectStore(STORE_NAME);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      let keys: IDBValidKey[] | null = null;
      let values: Array<StoredProject<unknown, unknown>> | null = null;
      const finish = () => {
        const readyKeys = keys;
        const readyValues = values;
        if (!readyKeys || !readyValues) return;
        resolve(readyKeys.flatMap((key, index) => {
          if (key === CURRENT_PROJECT) return [];
          const project = readyValues[index];
          if (!project) return [];
          return [{
            id: String(key),
            name: project.name ?? project.mainFile?.name ?? "Untitled project",
            savedAt: project.savedAt,
            duration: project.duration,
            mediaCount: project.assets.length + (project.mainFile ? 1 : 0),
          }];
        }).sort((a, b) => b.savedAt - a.savedAt));
      };
      keysRequest.onsuccess = () => { keys = keysRequest.result; finish(); };
      valuesRequest.onsuccess = () => { values = valuesRequest.result; finish(); };
      keysRequest.onerror = () => reject(keysRequest.error ?? new Error("Project library could not be read."));
      valuesRequest.onerror = () => reject(valuesRequest.error ?? new Error("Project library could not be read."));
    });
  } finally {
    database.close();
  }
}
