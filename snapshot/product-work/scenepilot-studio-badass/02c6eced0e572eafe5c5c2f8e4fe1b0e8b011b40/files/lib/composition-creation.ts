import type { CompositionLayer, StudioComposition } from "./compositor.ts";
import { defaultCompositionCamera } from "./composition-3d.ts";

export type CompositionSettings = { name: string; width: number; height: number; duration: number; background: string };
export type CompositionSource = { id: string; name: string; kind: "image" | "video" | "audio"; duration?: number };

export function validateCompositionSettings(settings: CompositionSettings): string | null {
  if (!settings.name.trim()) return "Enter a composition name.";
  if (![settings.width, settings.height].every((value) => Number.isInteger(value) && value >= 16 && value <= 7680 && value % 2 === 0)) return "Width and height must be even numbers between 16 and 7680.";
  if (!Number.isFinite(settings.duration) || settings.duration < .05 || settings.duration > 86400) return "Duration must be between 0.05 seconds and 24 hours.";
  if (!/^#[0-9a-f]{6}$/i.test(settings.background)) return "Choose a valid background color.";
  return null;
}

export function createStudioComposition(id: string, settings: CompositionSettings, source?: CompositionSource): StudioComposition {
  const error = validateCompositionSettings(settings);
  if (error) throw new Error(error);
  const videoTrackId = `${id}-video-track-1`, audioTrackId = `${id}-audio-track-1`;
  const layer: CompositionLayer | undefined = source ? {
    id: `${id}-source`, trackId: source.kind === "audio" ? audioTrackId : videoTrackId, name: source.name, kind: "media", assetId: source.id,
    start: 0, duration: Math.min(settings.duration, Number.isFinite(source.duration) && source.duration! > 0 ? source.duration! : settings.duration), sourceStart: 0, playbackRate: 1,
    text: "", shape: "rectangle", color: "#ffffff", x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100,
    enabled: true, locked: false, blend: "normal", effect: "none", animation: "none", motionBlur: false,
    mask: { enabled: false, shape: "rectangle", feather: 0, expansion: 0, inverted: false, x: 50, y: 50, width: 100, height: 100, rotation: 0 }, keyframes: [],
  } : undefined;
  return {
    ...settings, name: settings.name.trim(), id, cameras: [defaultCompositionCamera(id)], activeCameraId: `${id}-camera-1`, lights: [],
    tracks: [
      { id: audioTrackId, name: "A1 · AUDIO", kind: "audio", enabled: true, locked: false, muted: false, solo: false },
      { id: videoTrackId, name: "V1 · VIDEO", kind: "video", enabled: true, locked: false },
    ], layers: layer ? [layer] : [],
  };
}
