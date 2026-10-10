import type { BaseCut } from "./sequencer.ts";
import { clipPlaybackRate, type AudioClip, type TimelineMarker } from "./pro-editor.ts";
import type { StudioComposition } from "./compositor.ts";
import { videoClipToBaseCut, type VideoClip } from "./video-timeline.ts";
import { audioPlaybackRate } from "./audio-timing.ts";
import type { AudioEnvelope } from "./audio-crossfade.ts";

/** ScenePilot metadata is untrusted on import; malformed curves must not poison DSP. */
function importAudioEnvelopes(value: unknown): AudioEnvelope[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 1024) throw new Error("Invalid OTIO audio envelopes.");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid OTIO audio envelope.");
    const item = entry as Record<string, unknown>;
    for (const key of ["offset", "duration", "fadeIn", "fadeOut"]) {
      if (typeof item[key] !== "number" || !Number.isFinite(item[key]) || (key !== "offset" && item[key] < 0)) throw new Error(`Invalid OTIO audio envelope ${key}.`);
    }
    if (item.shape !== undefined && !["linear", "equalPower", "exponential"].includes(String(item.shape))) throw new Error("Invalid OTIO audio envelope shape.");
    if (item.origin !== undefined && item.origin !== "clip-in" && item.origin !== "clip-out") throw new Error("Invalid OTIO audio envelope origin.");
    return { offset: item.offset as number, duration: item.duration as number, fadeIn: item.fadeIn as number, fadeOut: item.fadeOut as number,
      ...(item.shape ? { shape: item.shape as AudioEnvelope["shape"] } : {}), ...(item.origin ? { origin: item.origin as AudioEnvelope["origin"] } : {}) };
  });
}

export type InterchangeAsset = { id: string; name: string; sourcePath?: string; kind?: "video" | "audio" | "image" };
export type InterchangeTrack = { id: string; name: string; enabled?: boolean; muted?: boolean; solo?: boolean };

export type OtioProject = {
  project: string;
  frameRate?: number;
  assets: InterchangeAsset[];
  videoClips: VideoClip[];
  videoTracks: InterchangeTrack[];
  audioClips?: AudioClip[];
  audioTracks?: InterchangeTrack[];
  markers?: TimelineMarker[];
  compositions?: StudioComposition[];
};

function frames(time: number, frameRate: number) {
  return Math.max(0, Math.round(time * frameRate));
}

function edlTimecode(time: number, frameRate: number) {
  const total = frames(time, frameRate);
  const fps = Math.max(1, Math.round(frameRate));
  const ff = total % fps;
  const seconds = Math.floor(total / fps);
  const ss = seconds % 60;
  const mm = Math.floor(seconds / 60) % 60;
  const hh = Math.floor(seconds / 3600);
  return [hh, mm, ss, ff].map((part) => String(part).padStart(2, "0")).join(":");
}

const reelName = (name: string, index: number) => (name.replace(/\.[^.]+$/, "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8) || `REEL${index + 1}`);

export function exportCmx3600(project: string, cuts: BaseCut[], assets: InterchangeAsset[], frameRate = 30) {
  const assetById = new Map(assets.map((asset, index) => [asset.id, { ...asset, reel: reelName(asset.name, index) }]));
  const lines = [`TITLE: ${project.toUpperCase()}`, "FCM: NON-DROP FRAME", ""];
  [...cuts].sort((a, b) => a.start - b.start).forEach((cut, index) => {
    const asset = assetById.get(cut.assetId);
    const sourceIn = cut.sourceStart;
    const sourceOut = sourceIn + cut.duration * clipPlaybackRate(cut);
    lines.push(`${String(index + 1).padStart(3, "0")}  ${(asset?.reel ?? "OFFLINE").padEnd(8, " ")} V     C        ${edlTimecode(sourceIn, frameRate)} ${edlTimecode(sourceOut, frameRate)} ${edlTimecode(cut.start, frameRate)} ${edlTimecode(cut.start + cut.duration, frameRate)}`);
    lines.push(`* FROM CLIP NAME: ${asset?.name ?? cut.assetId}`);
    if (Math.abs(clipPlaybackRate(cut) - 1) > 0.001) lines.push(`M2  ${asset?.reel ?? "OFFLINE"} ${Math.round(clipPlaybackRate(cut) * 100)}.0 ${edlTimecode(sourceIn, frameRate)}`);
    lines.push("");
  });
  return lines.join("\n");
}

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function exportFcpxml(project: string, cuts: BaseCut[], assets: InterchangeAsset[], frameRate = 30) {
  const fps = Math.max(1, Math.round(frameRate));
  const frameDuration = `1/${fps}s`;
  const referenced = assets.filter((asset) => cuts.some((cut) => cut.assetId === asset.id));
  const resourceIds = new Map(referenced.map((asset, index) => [asset.id, `r${index + 2}`]));
  const resources = referenced.map((asset, index) => `    <asset id="r${index + 2}" name="${xml(asset.name)}" src="${xml(fileUrl(asset, asset.name))}" start="0s" hasVideo="1"/>`).join("\n");
  const spine = [...cuts].sort((a, b) => a.start - b.start).map((cut) => {
    const asset = assets.find((item) => item.id === cut.assetId);
    return `          <asset-clip name="${xml(asset?.name ?? cut.assetId)}" ref="${resourceIds.get(cut.assetId) ?? "r1"}" offset="${frames(cut.start, fps)}/${fps}s" start="${frames(cut.sourceStart, fps)}/${fps}s" duration="${frames(cut.duration, fps)}/${fps}s"/>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.11">\n  <resources>\n    <format id="r1" name="ScenePilot ${fps}p" frameDuration="${frameDuration}"/>\n${resources}\n  </resources>\n  <library><event name="ScenePilot"><project name="${xml(project)}"><sequence format="r1" duration="${frames(Math.max(0, ...cuts.map((cut) => cut.start + cut.duration)), fps)}/${fps}s"><spine>\n${spine}\n        </spine></sequence></project></event></library>\n</fcpxml>`;
}

const rationalTime = (time: number, rate: number) => ({ OTIO_SCHEMA: "RationalTime.1", value: frames(time, rate), rate });
const timeRange = (start: number, duration: number, rate: number) => ({
  OTIO_SCHEMA: "TimeRange.1",
  start_time: rationalTime(start, rate),
  duration: rationalTime(duration, rate),
});

const fileUrl = (asset: InterchangeAsset | undefined, fallback: string) => {
  if (asset?.sourcePath?.startsWith("file:")) return asset.sourcePath;
  const path = (asset?.sourcePath ?? `/${asset?.name ?? fallback}`).replaceAll("\\", "/");
  return `file://${path.startsWith("/") ? "" : "/"}${path.split("/").map(segment => encodeURIComponent(segment).replace(/%3A/gi, ":")).join("/")}`;
};

const markerColor = (color: string) => {
  const normalized = color.toLowerCase();
  if (normalized.includes("ff") && !normalized.includes("34d6")) return "RED";
  if (normalized.includes("34d6") || normalized.includes("00ff")) return "GREEN";
  if (normalized.includes("5eb8") || normalized.includes("0000ff")) return "BLUE";
  if (normalized.includes("f7c8") || normalized.includes("ffff")) return "YELLOW";
  return "PURPLE";
};

function otioMarker(marker: TimelineMarker, rate: number) {
  return {
    OTIO_SCHEMA: "Marker.2",
    name: marker.label,
    marked_range: timeRange(marker.time, Math.max(0, marker.duration ?? 0), rate),
    color: markerColor(marker.color),
    metadata: { scenepilot_marker_id: marker.id, scenepilot_kind: marker.kind, scenepilot_color: marker.color },
  };
}

type OtioTrackItem = { start: number; duration: number; value: Record<string, unknown> };

/** OTIO tracks are serial. ScenePilot permits overlapping items on one visual
 * lane, so an overlapping lane is emitted as an additional OTIO track while
 * metadata retains the original ScenePilot track id for an exact round-trip. */
function partitionTrackLanes(items: OtioTrackItem[]) {
  const lanes: OtioTrackItem[][] = [];
  const laneEnds: number[] = [];
  for (const item of [...items].sort((a, b) => a.start - b.start || a.duration - b.duration)) {
    let lane = laneEnds.findIndex((end) => end <= item.start + 1e-8);
    if (lane < 0) { lane = lanes.length; lanes.push([]); laneEnds.push(0); }
    lanes[lane].push(item);
    laneEnds[lane] = Math.max(laneEnds[lane], item.start + item.duration);
  }
  return lanes;
}

function serialTrackChildren(items: OtioTrackItem[], rate: number) {
  const children: Array<Record<string, unknown>> = [];
  let cursor = 0;
  for (const item of items) {
    if (item.start > cursor + 1e-8) children.push({ OTIO_SCHEMA: "Gap.1", name: "Gap", source_range: timeRange(0, item.start - cursor, rate), effects: [], markers: [], metadata: {} });
    children.push(item.value);
    cursor = Math.max(cursor, item.start + item.duration);
  }
  return children;
}

function mediaReference(assetId: string, asset: InterchangeAsset | undefined, compositionId?: string) {
  return {
    OTIO_SCHEMA: "ExternalReference.1",
    name: asset?.name ?? (compositionId ? `Composition · ${compositionId}` : assetId),
    target_url: compositionId ? `scenepilot://composition/${encodeURIComponent(compositionId)}` : fileUrl(asset, assetId),
    available_range: null,
    metadata: { scenepilot_asset_id: assetId, ...(compositionId ? { scenepilot_composition_id: compositionId } : {}) },
  };
}

function videoOtioItem(clip: VideoClip, asset: InterchangeAsset | undefined, rate: number): OtioTrackItem {
  const playbackRate = clipPlaybackRate(clip);
  const compositionId = clip.overlay?.compositionId;
  return {
    start: clip.start,
    duration: clip.duration,
    value: {
      OTIO_SCHEMA: "Clip.2",
      name: asset?.name ?? (compositionId ? `Composition · ${compositionId}` : clip.assetId),
      source_range: timeRange(clip.sourceStart, clip.duration * playbackRate, rate),
      media_reference: mediaReference(clip.assetId, asset, compositionId),
      effects: Math.abs(playbackRate - 1) > 0.001 ? [{ OTIO_SCHEMA: "LinearTimeWarp.1", name: "ScenePilot speed", time_scalar: playbackRate, metadata: {} }] : [],
      markers: [],
      metadata: {
        scenepilot_cut_id: clip.id,
        scenepilot_track_id: clip.trackId,
        scenepilot_record_start: clip.start,
        ...(clip.groupId ? { scenepilot_group_id: clip.groupId } : {}),
        ...(clip.overlay ? { scenepilot_overlay: clip.overlay } : {}),
        ...(clip.transitionType ? { scenepilot_transition: { type: clip.transitionType, duration: clip.transitionDuration ?? 0 } } : {}),
        ...(clip.fadeIn || clip.fadeOut ? { scenepilot_fades: { in: clip.fadeIn ?? 0, out: clip.fadeOut ?? 0 } } : {}),
        ...(clip.reversed ? { scenepilot_reversed: true } : {}),
        ...(clip.timeRemap?.length ? { scenepilot_time_remap: clip.timeRemap } : {}),
        ...(clip.transformKeyframes?.length ? { scenepilot_transform_keyframes: clip.transformKeyframes } : {}),
        ...(clip.color ? { scenepilot_color: clip.color } : {}),
        ...(clip.effects?.length ? { scenepilot_effects: clip.effects } : {}),
      },
    },
  };
}

function audioOtioItem(clip: AudioClip, asset: InterchangeAsset | undefined, rate: number): OtioTrackItem {
  const playbackRate = audioPlaybackRate(clip);
  return {
    start: clip.start,
    duration: clip.duration,
    value: {
      OTIO_SCHEMA: "Clip.2",
      name: clip.name || asset?.name || clip.assetId,
      source_range: timeRange(clip.sourceStart, clip.duration * playbackRate, rate),
      media_reference: mediaReference(clip.assetId, asset),
      effects: Math.abs(playbackRate - 1) > 1e-9 ? [{ OTIO_SCHEMA: "LinearTimeWarp.1", name: "ScenePilot audio varispeed", time_scalar: playbackRate, metadata: {} }] : [],
      markers: [],
      metadata: {
        scenepilot_audio_clip_id: clip.id,
        scenepilot_track_id: clip.trackId,
        scenepilot_record_start: clip.start,
        scenepilot_audio: {
          gain: clip.gain, pan: clip.pan, fadeIn: clip.fadeIn, fadeOut: clip.fadeOut,
          fadeShape: clip.fadeShape, envelopes: clip.envelopes, muted: clip.muted, automation: clip.automation, linkedVideoId: clip.linkedVideoId,
        },
      },
    },
  };
}

function otioTracksFor(
  kind: "Video" | "Audio",
  tracks: InterchangeTrack[],
  items: Array<VideoClip | AudioClip>,
  assets: Map<string, InterchangeAsset>,
  rate: number,
) {
  const known = new Set(tracks.map((track) => track.id));
  const inferred: InterchangeTrack[] = [...new Set(items.map((item) => item.trackId).filter((id) => !known.has(id)))].map((id) => ({ id, name: id }));
  return [...tracks, ...inferred].flatMap((track) => {
    const trackItems = items.filter((item) => item.trackId === track.id).map((item) => kind === "Video"
      ? videoOtioItem(item as VideoClip, assets.get(item.assetId), rate)
      : audioOtioItem(item as AudioClip, assets.get(item.assetId), rate));
    const lanes = partitionTrackLanes(trackItems);
    if (!lanes.length) lanes.push([]);
    return lanes.map((lane, laneIndex) => ({
      OTIO_SCHEMA: "Track.1",
      name: laneIndex ? `${track.name} · overlap ${laneIndex + 1}` : track.name,
      kind,
      source_range: null,
      effects: [],
      markers: [],
      enabled: track.enabled !== false,
      metadata: {
        scenepilot_track_id: track.id,
        scenepilot_lane: laneIndex,
        scenepilot_muted: Boolean(track.muted),
        scenepilot_solo: Boolean(track.solo),
      },
      children: serialTrackChildren(lane, rate),
    }));
  });
}

/** Full professional handoff: every video/audio track, marker and embedded
 * composition reference is represented in standard OTIO structures, with
 * ScenePilot-only properties stored as namespaced metadata for lossless return. */
export function exportOtioProject(input: OtioProject) {
  const rate = Math.max(1, Math.round(input.frameRate ?? 30));
  const assets = new Map(input.assets.map((asset) => [asset.id, asset]));
  const children = [
    ...otioTracksFor("Video", input.videoTracks, input.videoClips, assets, rate),
    ...otioTracksFor("Audio", input.audioTracks ?? [], input.audioClips ?? [], assets, rate),
  ];
  return JSON.stringify({
    OTIO_SCHEMA: "Timeline.1",
    name: input.project,
    global_start_time: rationalTime(0, rate),
    tracks: {
      OTIO_SCHEMA: "Stack.1",
      name: "ScenePilot Sequence",
      source_range: null,
      effects: [],
      markers: (input.markers ?? []).map((marker) => otioMarker(marker, rate)),
      metadata: { frame_rate: rate, source: "ScenePilot Studio" },
      children,
    },
    metadata: { scenepilot_format_version: 2, scenepilot_compositions: input.compositions ?? [] },
  }, null, 2);
}

/** OpenTimelineIO JSON preserves gaps, source ranges, speed effects and media
 * URLs for round-tripping into professional finishing and VFX tools. */
export function exportOtio(project: string, cuts: BaseCut[], assets: InterchangeAsset[], frameRate = 30) {
  return exportOtioProject({
    project, assets, frameRate,
    videoTracks: [{ id: "__base__", name: "V1 · MASTER EDIT" }],
    videoClips: cuts.map((cut) => ({ ...cut, trackId: "__base__" })),
  });
}

export type ImportedOtio = {
  project: string;
  frameRate: number;
  duration: number;
  cuts: BaseCut[];
  videoClips: VideoClip[];
  videoTracks: InterchangeTrack[];
  audioClips: AudioClip[];
  audioTracks: InterchangeTrack[];
  markers: TimelineMarker[];
  compositions: StudioComposition[];
  assets: Array<InterchangeAsset & { kind: "video" | "audio" }>;
};

function otioSeconds(value: unknown, fallbackRate = 30) {
  const time = value as { value?: unknown; rate?: unknown } | null;
  const rate = Number(time?.rate ?? fallbackRate);
  const framesValue = Number(time?.value ?? 0);
  return Number.isFinite(framesValue) && Number.isFinite(rate) && rate > 0 ? framesValue / rate : 0;
}

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function importMarker(raw: unknown, rate: number, index: number): TimelineMarker | null {
  const marker = raw as { OTIO_SCHEMA?: string; name?: unknown; marked_range?: { start_time?: unknown; duration?: unknown }; color?: unknown; metadata?: Record<string, unknown> };
  if (marker.OTIO_SCHEMA !== "Marker.2" && marker.OTIO_SCHEMA !== "Marker.1") return null;
  const metadata = marker.metadata ?? {};
  const kind = ["marker", "chapter", "sync", "comment"].includes(String(metadata.scenepilot_kind))
    ? String(metadata.scenepilot_kind) as TimelineMarker["kind"] : "marker";
  const duration = Math.max(0, otioSeconds(marker.marked_range?.duration, rate));
  return {
    id: String(metadata.scenepilot_marker_id ?? `otio-marker-${index + 1}`),
    time: Math.max(0, otioSeconds(marker.marked_range?.start_time, rate)),
    label: String(marker.name ?? `Marker ${index + 1}`),
    color: String(metadata.scenepilot_color ?? marker.color ?? "#c8ef4b"),
    kind,
    ...(duration > 0 ? { duration } : {}),
  };
}

function decodeSourcePath(targetUrl: string) {
  let sourcePath = targetUrl;
  try { if (targetUrl.startsWith("file:")) sourcePath = decodeURIComponent(new URL(targetUrl).pathname); }
  catch { /* retain the original URL as relink metadata */ }
  return sourcePath;
}

/** Import all standard OTIO video/audio tracks. ScenePilot namespaced metadata
 * restores overlays, audio automation, markers, effects and compositions; files
 * from other editors still import through their standard OTIO structures. */
export function importOtio(source: string): ImportedOtio {
  let timeline: Record<string, unknown>;
  try { timeline = JSON.parse(source) as Record<string, unknown>; }
  catch { throw new Error("OpenTimelineIO file is not valid JSON."); }
  if (!timeline || timeline.OTIO_SCHEMA !== "Timeline.1") throw new Error("This JSON file is not an OpenTimelineIO Timeline.1 document.");
  const tracks = timeline.tracks as { metadata?: { frame_rate?: unknown }; children?: unknown[]; markers?: unknown[] } | undefined;
  const frameRate = Math.max(1, Math.min(120, Number(tracks?.metadata?.frame_rate) || Number((timeline.global_start_time as { rate?: unknown })?.rate) || 30));
  const rawTracks = (tracks?.children ?? []).filter((track) => ["Video", "Audio"].includes(String((track as { kind?: unknown }).kind))) as Array<{
    name?: unknown; kind?: "Video" | "Audio"; enabled?: unknown; children?: unknown[]; metadata?: Record<string, unknown>;
  }>;
  const rawVideoTracks = rawTracks.filter((track) => track.kind === "Video");
  if (!rawVideoTracks.length) throw new Error("OpenTimelineIO document has no video track.");
  const assetsByUrl = new Map<string, InterchangeAsset & { kind: "video" | "audio" }>();
  const videoTracksById = new Map<string, InterchangeTrack>();
  const audioTracksById = new Map<string, InterchangeTrack>();
  const videoClips: VideoClip[] = [];
  const audioClips: AudioClip[] = [];
  const cuts: BaseCut[] = [];
  let duration = 0;
  let clipIndex = 0;
  for (const [trackIndex, track] of rawTracks.entries()) {
    const trackMetadata = track.metadata ?? {};
    const fallbackTrackId = track.kind === "Video" && trackIndex === rawTracks.indexOf(rawVideoTracks[0]) ? "__base__" : `otio-${track.kind?.toLowerCase()}-${trackIndex + 1}`;
    const trackId = String(trackMetadata.scenepilot_track_id ?? fallbackTrackId);
    const targetTracks = track.kind === "Audio" ? audioTracksById : videoTracksById;
    if (!targetTracks.has(trackId)) targetTracks.set(trackId, {
      id: trackId,
      name: String(track.name ?? trackId).replace(/ · overlap \d+$/, ""),
      enabled: track.enabled !== false,
      muted: Boolean(trackMetadata.scenepilot_muted),
      solo: Boolean(trackMetadata.scenepilot_solo),
    });
    let cursor = 0;
    for (const raw of track.children ?? []) {
      const item = raw as {
        OTIO_SCHEMA?: string; name?: string; source_range?: { start_time?: unknown; duration?: unknown };
        media_reference?: { target_url?: string; metadata?: Record<string, unknown> };
        effects?: Array<{ OTIO_SCHEMA?: string; time_scalar?: unknown }>;
        metadata?: Record<string, unknown>;
      };
      const sourceDuration = Math.max(0, otioSeconds(item.source_range?.duration, frameRate));
      if (item.OTIO_SCHEMA === "Gap.1") { cursor += sourceDuration; continue; }
      if (item.OTIO_SCHEMA !== "Clip.2") throw new Error(`Unsupported OTIO item ${item.OTIO_SCHEMA ?? "unknown"} in ${String(track.name ?? "track")}. Flatten nested tracks/transitions in the source editor before importing; no timeline was changed.`);
      if (sourceDuration <= 0) throw new Error("OTIO clip has no valid positive duration. Repair it in the source editor before importing.");
      for (const effect of item.effects ?? []) {
        const rate = Number(effect.time_scalar);
        if (effect.OTIO_SCHEMA !== "LinearTimeWarp.1" || !Number.isFinite(rate) || rate < .1 || rate > 8) throw new Error(`Unsupported OTIO effect ${effect.OTIO_SCHEMA ?? "unknown"}. Bake this effect/retime in the source editor before importing.`);
      }
      const metadata = item.metadata ?? {};
      const mediaMetadata = item.media_reference?.metadata ?? {};
      const compositionId = String(mediaMetadata.scenepilot_composition_id ?? "");
      const targetUrl = String(item.media_reference?.target_url ?? `file:///${item.name ?? `offline-${clipIndex + 1}`}`);
      const kind = track.kind === "Audio" ? "audio" : "video";
      const assetKey = `${kind}:${targetUrl}`;
      let asset = assetsByUrl.get(assetKey);
      if (!asset) {
        const sourcePath = decodeSourcePath(targetUrl);
        asset = {
          id: String(mediaMetadata.scenepilot_asset_id ?? (compositionId ? `composition:${compositionId}` : `otio-media-${assetsByUrl.size + 1}`)),
          name: String(item.name ?? sourcePath.split(/[\\/]/).at(-1) ?? `Offline ${assetsByUrl.size + 1}`),
          sourcePath,
          kind,
        };
        assetsByUrl.set(assetKey, asset);
      }
      const playbackRate = Math.max(.1, Math.min(8, Number(item.effects?.find((effect) => effect.OTIO_SCHEMA === "LinearTimeWarp.1")?.time_scalar) || 1));
      const itemDuration = sourceDuration / playbackRate;
      const start = Math.max(0, finiteNumber(metadata.scenepilot_record_start, cursor));
      const sourceStart = Math.max(0, otioSeconds(item.source_range?.start_time, frameRate));
      if (track.kind === "Audio") {
        const audio = (metadata.scenepilot_audio ?? {}) as Record<string, unknown>;
        audioClips.push({
          id: String(metadata.scenepilot_audio_clip_id ?? `otio-audio-${clipIndex + 1}`), assetId: asset.id, trackId,
          name: String(item.name ?? asset.name), start, sourceStart, duration: itemDuration,
          ...(playbackRate !== 1 ? { playbackRate } : {}),
          gain: Math.max(0, finiteNumber(audio.gain, 1)), pan: Math.max(-1, Math.min(1, finiteNumber(audio.pan, 0))),
          fadeIn: Math.max(0, finiteNumber(audio.fadeIn, 0)), fadeOut: Math.max(0, finiteNumber(audio.fadeOut, 0)),
          ...(audio.fadeShape === "equalPower" || audio.fadeShape === "linear" || audio.fadeShape === "exponential" ? { fadeShape: audio.fadeShape } : {}),
          muted: Boolean(audio.muted),
          ...(audio.envelopes !== undefined ? { envelopes: importAudioEnvelopes(audio.envelopes) } : {}),
          ...(Array.isArray(audio.automation) ? { automation: audio.automation as AudioClip["automation"] } : {}),
          ...(audio.linkedVideoId ? { linkedVideoId: String(audio.linkedVideoId) } : {}),
        });
      } else {
        const overlay = metadata.scenepilot_overlay as VideoClip["overlay"] | undefined;
        const transition = metadata.scenepilot_transition as { type?: BaseCut["transitionType"]; duration?: unknown } | undefined;
        const fades = metadata.scenepilot_fades as { in?: unknown; out?: unknown } | undefined;
        const clip: VideoClip = {
          id: String(metadata.scenepilot_cut_id ?? `otio-cut-${clipIndex + 1}`), assetId: asset.id, sectionId: "otio-import",
          trackId, start, duration: itemDuration, sourceStart, playbackRate,
          ...(metadata.scenepilot_group_id ? { groupId: String(metadata.scenepilot_group_id) } : {}),
          ...(overlay ? { overlay } : trackId !== "__base__" ? { overlay: { scale: 100, opacity: 100, ...(compositionId ? { compositionId } : {}) } } : {}),
          ...(transition?.type ? { transitionType: transition.type, transitionDuration: Math.max(0, finiteNumber(transition.duration, 0)) } : {}),
          ...(fades ? { fadeIn: Math.max(0, finiteNumber(fades.in, 0)), fadeOut: Math.max(0, finiteNumber(fades.out, 0)) } : {}),
          ...(metadata.scenepilot_reversed ? { reversed: true } : {}),
          ...(Array.isArray(metadata.scenepilot_time_remap) ? { timeRemap: metadata.scenepilot_time_remap as VideoClip["timeRemap"] } : {}),
          ...(Array.isArray(metadata.scenepilot_transform_keyframes) ? { transformKeyframes: metadata.scenepilot_transform_keyframes as VideoClip["transformKeyframes"] } : {}),
          ...(metadata.scenepilot_color ? { color: metadata.scenepilot_color as VideoClip["color"] } : {}),
          ...(Array.isArray(metadata.scenepilot_effects) ? { effects: metadata.scenepilot_effects as VideoClip["effects"] } : {}),
        };
        videoClips.push(clip);
        if (trackId === "__base__") cuts.push(videoClipToBaseCut(clip));
      }
      cursor += itemDuration;
      duration = Math.max(duration, start + itemDuration);
      clipIndex++;
    }
  }
  if (!videoClips.length) throw new Error("OpenTimelineIO video tracks contain no usable clips.");
  if (!cuts.length) {
    const baseTrackId = videoTracksById.keys().next().value as string;
    for (const clip of videoClips.filter((item) => item.trackId === baseTrackId)) {
      clip.trackId = "__base__";
      delete clip.overlay;
      cuts.push(videoClipToBaseCut(clip));
    }
    const baseTrack = videoTracksById.get(baseTrackId);
    videoTracksById.delete(baseTrackId);
    videoTracksById.set("__base__", { ...(baseTrack ?? { name: "V1 · MASTER EDIT" }), id: "__base__" });
  }
  const markers = (tracks?.markers ?? []).map((marker, index) => importMarker(marker, frameRate, index)).filter((marker): marker is TimelineMarker => Boolean(marker));
  const metadata = (timeline.metadata ?? {}) as { scenepilot_compositions?: unknown };
  const compositions = Array.isArray(metadata.scenepilot_compositions) ? metadata.scenepilot_compositions as StudioComposition[] : [];
  return {
    project: String(timeline.name ?? "Imported OTIO"), frameRate, duration, cuts, videoClips,
    videoTracks: [...videoTracksById.values()], audioClips, audioTracks: [...audioTracksById.values()], markers, compositions,
    assets: [...assetsByUrl.values()].filter((asset) => !asset.sourcePath?.startsWith("scenepilot://composition/")),
  };
}
