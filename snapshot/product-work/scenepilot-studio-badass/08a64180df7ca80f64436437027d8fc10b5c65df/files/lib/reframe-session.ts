import { REFRAME_ASPECT_IDS, type ReframeAspectId } from "./reframe-crop.ts";
import type { SubjectTarget } from "./reframe-path.ts";
type LetterboxSegment = { start: number; end: number };

export const REFRAME_SESSION_FORMAT = "scenepilot.reframe-session";
export const REFRAME_SESSION_VERSION = 1;

export type ReframeSession = {
  format: typeof REFRAME_SESSION_FORMAT;
  version: typeof REFRAME_SESSION_VERSION;
  source: { name: string; size: number; sha256: string; width: number; height: number; duration: number };
  settings: { aspect: ReframeAspectId; useFaces: boolean; deadZone: number; maxPanSpeed: number; ease: number };
  targets: SubjectTarget[];
  cutTimes: number[];
  overrides: SubjectTarget[];
  letterboxSegments: LetterboxSegment[];
};

function finite(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid Reframe session ${label}.`);
  return value;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid Reframe session ${label}.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], label: string) {
  if (Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) throw new Error(`Unsupported Reframe session ${label} fields.`);
}

function targets(value: unknown, label: string): SubjectTarget[] {
  if (!Array.isArray(value) || value.length > 100_000) throw new Error(`Invalid Reframe session ${label}.`);
  return value.map((item, index) => {
    const target = object(item, `${label}[${index}]`);
    if (Object.keys(target).sort().join(",") !== "time,x,y" && Object.keys(target).sort().join(",") !== "time,weight,x,y") throw new Error(`Unsupported Reframe session ${label}[${index}] fields.`);
    return {
      time: finite(target.time, 0, 86_400, `${label} time`),
      x: finite(target.x, 0, 1, `${label} x`),
      y: finite(target.y, 0, 1, `${label} y`),
      weight: target.weight === undefined ? 1 : finite(target.weight, 0, 1, `${label} weight`),
    };
  });
}

export function createReframeSession(input: Omit<ReframeSession, "format" | "version">): ReframeSession {
  return parseReframeSession(JSON.stringify({ format: REFRAME_SESSION_FORMAT, version: REFRAME_SESSION_VERSION, ...input }));
}

export function parseReframeSession(serialized: string): ReframeSession {
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { throw new Error("Invalid Reframe session JSON."); }
  const root = object(parsed, "document");
  exactKeys(root, ["format", "version", "source", "settings", "targets", "cutTimes", "overrides", "letterboxSegments"], "document");
  if (root.format !== REFRAME_SESSION_FORMAT || root.version !== REFRAME_SESSION_VERSION) throw new Error("Unsupported Reframe session format or version.");
  const source = object(root.source, "source");
  exactKeys(source, ["name", "size", "sha256", "width", "height", "duration"], "source");
  if (typeof source.name !== "string" || source.name.length > 1024) throw new Error("Invalid Reframe session source name.");
  if (typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error("Invalid Reframe session media fingerprint.");
  const settings = object(root.settings, "settings");
  exactKeys(settings, ["aspect", "useFaces", "deadZone", "maxPanSpeed", "ease"], "settings");
  if (!REFRAME_ASPECT_IDS.includes(settings.aspect as ReframeAspectId) || typeof settings.useFaces !== "boolean") throw new Error("Invalid Reframe session settings.");
  if (!Array.isArray(root.cutTimes) || root.cutTimes.length > 100_000) throw new Error("Invalid Reframe session cuts.");
  const cuts = root.cutTimes.map((time) => finite(time, 0, 86_400, "cut time"));
  if (!Array.isArray(root.letterboxSegments) || root.letterboxSegments.length > 10_000) throw new Error("Invalid Reframe session letterbox ranges.");
  const segments = root.letterboxSegments.map((item, index) => {
    const segment = object(item, `letterbox range ${index}`);
    exactKeys(segment, ["start", "end"], `letterbox range ${index}`);
    const start = finite(segment.start, 0, 86_400, "letterbox start");
    const end = finite(segment.end, 0, 86_400, "letterbox end");
    if (end <= start) throw new Error("Invalid Reframe session letterbox range.");
    return { start, end };
  });
  const duration = finite(source.duration, 0, 86_400, "duration");
  const session: ReframeSession = {
    format: REFRAME_SESSION_FORMAT,
    version: REFRAME_SESSION_VERSION,
    source: { name: source.name, size: finite(source.size, 0, Number.MAX_SAFE_INTEGER, "source size"), sha256: source.sha256, width: finite(source.width, 1, 100_000, "source width"), height: finite(source.height, 1, 100_000, "source height"), duration },
    settings: {
      aspect: settings.aspect as ReframeAspectId,
      useFaces: settings.useFaces,
      deadZone: finite(settings.deadZone, 0, 0.3, "dead zone"),
      maxPanSpeed: finite(settings.maxPanSpeed, 0.1, 1.5, "pan speed"),
      ease: finite(settings.ease, 0.05, 1, "ease"),
    },
    targets: targets(root.targets, "targets"),
    cutTimes: cuts,
    overrides: targets(root.overrides, "overrides"),
    letterboxSegments: segments,
  };
  if (session.targets.some((item) => item.time > duration) || session.overrides.some((item) => item.time > duration) || cuts.some((time) => time > duration) || segments.some((item) => item.end > duration)) throw new Error("Reframe session edit exceeds source duration.");
  return session;
}

/** Relink by portable media metadata only; paths are never persisted or trusted. */
export function reframeSessionMatchesMedia(session: ReframeSession, media: { size: number; sha256: string; width: number; height: number; duration: number }): boolean {
  return session.source.size === media.size && session.source.sha256 === media.sha256 && session.source.width === media.width && session.source.height === media.height && Math.abs(session.source.duration - media.duration) <= 0.25;
}
