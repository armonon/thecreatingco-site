import { exportCmx3600, exportFcpxml, exportOtioProject, type OtioProject } from "./interchange.ts";
import { splitUnifiedTimeline } from "./video-timeline.ts";
import { buildCmx3600, buildPremiereXml, nearestRate, type PremiereClip, type PremiereMarker, type PremiereMedia, type PremiereRateId, type PremiereTimeline } from "./premiere-xml.ts";
export type InterchangeFormat = "edl" | "fcpxml" | "otio";

/** A handoff is not a render: explicitly disclose what the recipient loses. */
export function prepareInterchange(type: InterchangeFormat, project: OtioProject) {
  const { baseCuts, placements } = splitUnifiedTimeline(project.videoClips);
  if (type === "otio" ? !project.videoClips.length : !baseCuts.length) throw new Error(type === "otio" ? "Add video clips or compositions before exporting OTIO." : "EDL and FCPXML require a V1 sequence.");
  const warnings: string[] = ["Media is referenced, not embedded. Collect/relink source files on the receiving system."];
  if (type !== "otio") {
    if (placements.length) warnings.push(`${placements.length} overlay/composition clips will be omitted; this handoff carries V1 only.`);
    if (project.audioClips?.length) warnings.push(`${project.audioClips.length} separate audio clips and their mixer routing will be omitted. Deliver WAV stems separately.`);
    warnings.push("Color, effects, masks, titles, fades and transitions are not baked into this edit list. Deliver a reference movie for appearance.");
    if (baseCuts.some(clip => clip.reversed || clip.timeRemap?.length || (type === "fcpxml" && Math.abs((clip.playbackRate ?? 1) - 1) > .0001))) throw new Error("This handoff cannot preserve the selection's retiming. Use OTIO plus a reference render, or render those clips before exporting.");
  } else {
    warnings.push("ScenePilot effects, compositions and audio processing use ScenePilot metadata. Other editors may ignore it; this is not Adobe project/plugin compatibility.");
    if (project.audioClips?.some((clip) => Math.abs((clip.playbackRate ?? 1) - 1) > 1e-9)) warnings.push("Retimed audio uses varispeed (pitch changes with speed). Receiving editors may interpret audio time-warps differently; deliver WAV stems and check sync against a reference movie.");
  }
  if (project.assets.some(asset => !asset.sourcePath)) warnings.push("Some sources have no local file path and will need manual relinking.");
  const text = type === "edl" ? exportCmx3600(project.project, baseCuts, project.assets, project.frameRate)
    : type === "fcpxml" ? exportFcpxml(project.project, baseCuts, project.assets, project.frameRate) : exportOtioProject(project);
  const baseName = project.project.replace(/\.[^/.]+$/, "") || "scenepilot";
  return { text, filename: `${baseName}.${type}`, mime: type === "fcpxml" ? "application/xml" : type === "otio" ? "application/json" : "text/plain", warnings };
}

// ---- Premiere Pro (FCP7 xmeml v4 + CMX3600) ----------------------------------

export type PremiereEditorMedia = { id: string; name: string; kind?: "video" | "audio" | "image"; duration?: number; width?: number; height?: number; frameRate?: number; sourcePath?: string };

export type PremiereEditorProject = {
  project: string;
  /** Export frame rate (24/25/30/50/60) or an explicit Premiere rate id. */
  frameRate: number | PremiereRateId;
  width: number;
  height: number;
  /** Timeline duration, seconds. */
  duration: number;
  videoClips: OtioProject["videoClips"];
  /** Imported clips (MediaAsset-like). */
  assets: PremiereEditorMedia[];
  /** The main source (the song, or the main video) — always plays from 0 on A1. */
  main?: PremiereEditorMedia & { isAudio: boolean };
  audioClipCount?: number;
  beats?: number[];
  sections?: Array<{ name: string; start: number; end: number }>;
  markers?: Array<{ time: number; label: string; duration?: number }>;
};

/** Editor timeline → Premiere hand-off (XML or EDL) with disclosed limits. */
export function preparePremiere(type: "xml" | "edl", project: PremiereEditorProject, mediaFolder?: string) {
  const { baseCuts, placements } = splitUnifiedTimeline(project.videoClips);
  if (!baseCuts.length) throw new Error("Make a cut first: Premiere export needs clips on the main (V1) sequence.");
  if (baseCuts.some((clip) => clip.reversed || clip.timeRemap?.length || Math.abs((clip.playbackRate ?? 1) - 1) > 0.0001)) {
    throw new Error("Premiere export can't carry speed changes or reversed clips yet. Render those clips first, or export OTIO plus a reference render.");
  }
  const rate: PremiereRateId = typeof project.frameRate === "string" ? project.frameRate : nearestRate(project.frameRate);
  const media: PremiereMedia[] = [];
  const seen = new Set<string>();
  const addMedia = (item: PremiereEditorMedia, kind: PremiereMedia["kind"]) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    media.push({ id: item.id, name: item.name, kind: item.kind ?? kind, duration: item.duration ?? project.duration, width: item.width, height: item.height, frameRate: item.frameRate, hasAudio: kind !== "image", path: item.sourcePath });
  };
  const assetById = new Map(project.assets.map((asset) => [asset.id, asset]));
  if (project.main) assetById.set(project.main.id, project.main);
  for (const cut of baseCuts) {
    const asset = assetById.get(cut.assetId);
    if (asset) addMedia(asset, asset.kind ?? "video");
  }
  if (project.main) addMedia(project.main, project.main.isAudio ? "audio" : "video");
  const video: PremiereClip[] = baseCuts.filter((cut) => seen.has(cut.assetId)).map((cut) => ({ mediaId: cut.assetId, start: cut.start, duration: cut.duration, sourceStart: cut.sourceStart }));
  const audio: PremiereClip[] = project.main ? [{ mediaId: project.main.id, start: 0, duration: Math.min(project.duration, project.main.duration ?? project.duration), sourceStart: 0 }] : [];
  const markers: PremiereMarker[] = [
    ...(project.sections ?? []).filter((section) => section.end > section.start).map((section) => ({ time: section.start, duration: section.end - section.start, name: section.name, comment: "ScenePilot section" })),
    ...(project.markers ?? []).map((marker) => ({ time: marker.time, duration: marker.duration, name: marker.label || "Marker", comment: "ScenePilot marker" })),
  ];
  const taken = new Set(markers.map((marker) => Math.round(marker.time * 100)));
  (project.beats ?? []).forEach((time, index) => {
    if (index % 4 !== 0 || taken.has(Math.round(time * 100))) return;
    markers.push({ time, name: `Bar ${index / 4 + 1}`, comment: "ScenePilot beat grid (4/4)" });
  });
  const timeline: PremiereTimeline = { name: project.project, rate, width: project.width, height: project.height, media, video, audio, markers, mediaFolder };
  const warnings = [
    "Media is referenced by file name, not embedded. Premiere: File → Import the .xml, then relink if asked (Locate the first file, keep “Relink others automatically” on).",
    ...(placements.length ? [`${placements.length} overlay/composition clips are not included; this hand-off carries the V1 edit only.`] : []),
    ...(project.audioClipCount ? [`${project.audioClipCount} separate audio clips are not included; A1 is the main source (the song) from its start. Deliver stems separately.`] : []),
    "Looks, effects, titles, transitions and fades are not included. Export a reference video for those.",
    ...(media.some((item) => !item.path) && !mediaFolder ? ["No file paths are known in the browser, so Premiere will ask you to relink the media once."] : []),
  ];
  const baseName = project.project.replace(/\.[^/.]+$/, "") || "scenepilot";
  return type === "xml"
    ? { text: buildPremiereXml(timeline), filename: `${baseName}-premiere.xml`, mime: "application/xml", warnings }
    : { text: buildCmx3600(timeline), filename: `${baseName}-premiere.edl`, mime: "text/plain", warnings };
}
