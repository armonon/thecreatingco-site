import type { AnalysisResult } from "../lib/analysis-engine";
import { CURRENT_CUT_FILE_VERSION, type EffectSettings, type CutFile, type StoredProject } from "../lib/project-store";
import { serializeProjectSettings, type ProjectSettings } from "../lib/project-settings";
import type { MediaLinkDescriptor } from "../lib/media-link";
import type { EditSnapshot } from "./edit-snapshot";
import { COLORS } from "./editor-foundation";
import { desktopMediaBridge, type ScenePilotDesktopBridge } from "./desktop-media";
import { mediaMime, probeMediaAudio } from "./media-file-utils";
import type { MediaAsset } from "./media-browser";

export function downloadTextFile(contents: string, name: string, type = "text/plain") {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([contents], { type }));
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Let the browser start consuming the download before releasing its URL.
  setTimeout(() => URL.revokeObjectURL(anchor.href), 60_000);
}

type Context = { snapshot: EditSnapshot; analysis: AnalysisResult | null; mainFile: File | null; mainName: string; mainSourcePath: string; assets: MediaAsset[]; effects: EffectSettings; settings: ProjectSettings };
export function projectDocument({ snapshot: s, analysis, mainFile, mainName, mainSourcePath, assets, effects, settings }: Context) {
  return {
    format: "scenepilot-cut" as const, version: CURRENT_CUT_FILE_VERSION, project: mainName,
    duration: s.duration ?? 30, bpm: s.bpm, beatOffset: s.beatOffset, beats: s.beats, sections: s.sections,
    tracks: s.clipTracks, videoClips: s.videoClips, baseCuts: s.baseCuts, titles: s.titles,
    projectIntelligence: s.projectIntelligence, projectTranscripts: s.projectTranscripts, storyBrief: s.storyBrief,
    mainAsset: mainFile ? { name: mainFile.name, kind: mainFile.type.startsWith("audio/") ? "audio" as const : "video" as const, size: mainFile.size || undefined, lastModified: mainFile.lastModified, sourcePath: mainSourcePath || desktopMediaBridge()?.getPathForFile(mainFile) || undefined } : undefined,
    assets: assets.map(({ id, name, kind, file, sourcePath, folderId, favorite, sourceSize, sourceLastModified, beatMap }) => ({ id, name, kind, size: sourceSize ?? (file.size || undefined), lastModified: sourceLastModified ?? file.lastModified, sourcePath, folderId, favorite, beatMap })),
    placements: s.placements, compositions: s.compositions, effects, settings: serializeProjectSettings(settings),
    proState: { autoPolicy: s.autoPolicy, autoVersions: s.autoVersions, creatorGoal: s.creatorGoal, inferredCreatorGoal: s.inferredCreatorGoal, audioTracks: s.audioTracks, audioBuses: s.audioBuses, masterGain: s.masterGain, colorManagement: s.colorManagement, audioClips: s.audioClips, transcriptWords: s.transcriptWords, projectIntelligence: s.projectIntelligence, projectTranscripts: s.projectTranscripts, storyBrief: s.storyBrief, markers: s.markers, timelineRange: s.timelineRange, mediaBins: s.mediaBins, snapping: s.snapping, linkedSelection: s.linkedSelection, manualDropTime: s.manualDropTime },
    renderAnalysis: s.renderAnalysis ?? null,
    analysis: analysis ? { tempoConfidence: analysis.confidence, framesAnalyzed: analysis.framesAnalyzed, sceneCuts: analysis.sceneCuts, effectProfiles: analysis.effects } : null,
    savedAt: Date.now(),
  };
}

export function offlineMediaAssets(unresolved: MediaLinkDescriptor[], available: MediaAsset[]): MediaAsset[] {
  const ids = new Set(available.map((asset) => asset.id));
  return unresolved.flatMap((source, index) => {
    if (ids.has(source.id)) return [];
    ids.add(source.id);
    return [{ id: source.id, name: source.name, file: new File([], source.name, { type: mediaMime(source.kind, source.name), lastModified: source.lastModified }), url: "", kind: source.kind, color: COLORS[(available.length + index) % COLORS.length], folderId: source.kind === "audio" ? "bin-audio" : source.kind === "image" ? "bin-graphics" : "bin-footage", proxyState: "failed" as const, proxyProgress: 0, offline: true, sourceSize: source.size, sourceLastModified: source.lastModified }];
  });
}

export async function linkDocumentMedia(cut: CutFile, bridge: ScenePilotDesktopBridge) {
  const sources = [...(cut.mainAsset?.sourcePath ? [{ id: "__main__", path: cut.mainAsset.sourcePath }] : []), ...cut.assets.flatMap((asset) => asset.sourcePath ? [{ id: asset.id, path: asset.sourcePath }] : [])];
  const registered = sources.length ? await bridge.registerLocalMedia({ sources }) : [];
  const byId = new Map(registered.map((item) => [item.id, item]));
  const assets: MediaAsset[] = cut.assets.flatMap((asset, index) => {
    const linked = byId.get(asset.id);
    if (!linked) return [];
    return [{ id: asset.id, name: asset.name, file: new File([], asset.name, { type: mediaMime(asset.kind, asset.name), lastModified: linked.lastModified }), url: linked.url, kind: asset.kind, color: COLORS[index % COLORS.length], duration: asset.kind === "image" ? Infinity : linked.metadata?.duration, folderId: asset.folderId ?? (asset.kind === "audio" ? "bin-audio" : asset.kind === "image" ? "bin-graphics" : "bin-footage"), favorite: asset.favorite, proxyState: "original" as const, proxyProgress: 0, sourcePath: linked.path, sourceSize: linked.size, sourceLastModified: linked.lastModified, nativeCodec: linked.metadata?.video?.codec ?? linked.metadata?.audio?.codec, nativeDimensions: linked.metadata?.video ? `${linked.metadata.video.width}×${linked.metadata.video.height}` : undefined, nativeFrameRate: linked.metadata?.video?.averageFrameRate, nativeVfr: linked.metadata?.video?.variableFrameRate, nativeBitDepth: linked.metadata?.video?.bitDepth, nativeHdr: linked.metadata?.video?.hdr }];
  });
  for (const asset of assets) {
    asset.beatMap = cut.assets.find(a => a.id === asset.id)?.beatMap;
    const metadata = byId.get(asset.id)?.metadata;
    asset.hasAudio = asset.kind === "video" ? metadata ? Boolean(metadata.audio) : undefined : asset.kind === "audio";
  }
  return { assets, main: byId.get("__main__"), missing: sources.length - registered.length };
}

export async function hydrateStoredMedia(stored: StoredProject<unknown, unknown>, bridge = desktopMediaBridge()) {
  const sources = [...(stored.mainSourcePath && !stored.mainFile?.size ? [{ id: "__main__", path: stored.mainSourcePath }] : []), ...stored.assets.flatMap((a) => a.sourcePath && !a.file.size ? [{ id: a.id, path: a.sourcePath }] : [])];
  const registered = sources.length && bridge ? await bridge.registerLocalMedia({ sources }) : [];
  const byId = new Map(registered.map((item) => [item.id, item]));
  const assets: MediaAsset[] = await Promise.all(stored.assets.map(async (a) => {
    const linked = byId.get(a.id);
    const available = Boolean(a.file.size || linked);
    const hasAudio = a.kind === "video" ? linked?.metadata ? Boolean(linked.metadata.audio) : await probeMediaAudio(a.file) : a.kind === "audio";
    return { ...a, hasAudio, url: linked?.url ?? (a.file.size && !a.offline ? URL.createObjectURL(a.file) : ""), offline: !available || (Boolean(a.offline) && !linked), duration: a.duration ?? (a.kind === "image" ? Infinity : linked?.metadata?.duration), folderId: a.folderId ?? (a.kind === "audio" ? "bin-audio" : a.kind === "image" ? "bin-graphics" : "bin-footage"), proxyState: a.proxyFile ? "ready" : available ? "original" : "failed", proxyProgress: a.proxyFile ? 1 : 0, proxyUrl: a.proxyFile ? URL.createObjectURL(a.proxyFile) : undefined };
  }));
  const mainUrl = byId.get("__main__")?.url ?? (stored.mainFile?.size ? URL.createObjectURL(stored.mainFile) : "");
  if (stored.mainFile && !mainUrl) assets.push(...offlineMediaAssets([{ id: "__main__", name: stored.mainFile.name, kind: stored.mainFile.type.startsWith("audio/") ? "audio" : "video" }], assets));
  return { assets, mainUrl, mainSourcePath: stored.mainSourcePath ?? "" };
}
