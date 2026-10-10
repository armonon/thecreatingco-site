import type { AnalysisResult } from "../lib/analysis-engine";
import { MAIN_SOURCE_ID } from "../lib/compositor";
import type {
  ProjectAssemblyKind,
  ProjectIntelligence,
  ProjectIntelligenceAsset,
  ProjectTranscriptChunk,
  ProjectVisualSignature,
} from "../lib/project-intelligence";
import { buildProjectAssembly } from "../lib/project-intelligence";
import type { AudioClip } from "../lib/pro-editor";
import { groupTimedTranscript } from "../lib/filler";

type EvidenceMedia = {
  id: string;
  name: string;
  kind: "video" | "image" | "audio";
  duration?: number;
  file?: File;
};

type ProjectEvidenceOptions = {
  result: AnalysisResult | null;
  transcripts: Record<string, ProjectTranscriptChunk[]>;
  visualAssets: EvidenceMedia[];
  hasMainVideo: boolean;
  mainName: string;
};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function mainVisualSignature(result: AnalysisResult): ProjectVisualSignature {
  const points = result.visuals;
  const subject = points.map((point) => point.subject).filter((value): value is NonNullable<typeof value> => Boolean(value));
  const histogram = Array.from({ length: 16 }, (_, index) => mean(points.map((point) => {
    const center = Math.max(0, Math.min(15, Math.round(point.brightness * 15)));
    return index === center ? 1 : 0;
  })));
  return {
    sampleCount: points.length,
    brightness: mean(points.map((point) => point.brightness)),
    sharpness: mean(points.map((point) => point.sharpness ?? .5)),
    contrast: mean(points.map((point) => point.contrast ?? .5)),
    motion: mean(points.map((point) => point.residualMotion ?? point.motion)),
    color: { r: .5, g: .5, b: .5 },
    histogram,
    subject: {
      frames: subject.length,
      presence: subject.filter((frame) => frame.present).length / Math.max(1, subject.length),
      coverage: mean(subject.map((frame) => frame.present ? frame.coverage : 0)),
      centerX: mean(subject.map((frame) => frame.centerX)),
      centerY: mean(subject.map((frame) => frame.centerY)),
      count: Math.round(mean(subject.map((frame) => frame.count))),
      confidence: mean(subject.map((frame) => frame.confidence)),
    },
  };
}

/** Converts app media into the serializable, project-wide evidence model. */
export function buildProjectIntelligenceAssets(options: ProjectEvidenceOptions): ProjectIntelligenceAsset[] {
  const { result, transcripts, visualAssets, hasMainVideo, mainName } = options;
  const profiles = new Map((result?.effects ?? []).map((profile) => [profile.assetId, profile]));
  const library: ProjectIntelligenceAsset[] = visualAssets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    kind: asset.kind as "video" | "image",
    duration: asset.kind === "image" ? 5 : (asset.duration && Number.isFinite(asset.duration) ? asset.duration : profiles.get(asset.id)?.sourceDuration ?? 0),
    visual: profiles.get(asset.id)?.visualSignature,
    peakTime: profiles.get(asset.id)?.peakTime,
    transcript: transcripts[asset.id],
  }));
  if (hasMainVideo && result) {
    library.unshift({
      id: MAIN_SOURCE_ID,
      name: mainName,
      kind: "video",
      duration: result.duration,
      visual: mainVisualSignature(result),
      transcript: transcripts[MAIN_SOURCE_ID],
    });
  }
  return library;
}

/** Materializes an AI suggestion as normal linked video/audio timeline media. */
export function buildProjectAssemblyTimeline(
  report: ProjectIntelligence,
  evidence: ProjectIntelligenceAsset[],
  kind: ProjectAssemblyKind,
  audioTrackId?: string,
  options: {preserveDialogue?:boolean;maxShot?:number} = {},
) {
  const cuts = buildProjectAssembly(report, evidence, kind, options);
  const total = cuts.reduce((maximum, cut) => Math.max(maximum, cut.start + cut.duration), 0);
  const label = report.assemblies.find((candidate) => candidate.kind === kind)?.label ?? "Project assembly";
  const linkedAudio: AudioClip[] = audioTrackId ? cuts.map((cut) => ({
    id: `project-auto-audio-${kind}-${cut.id}`,
    assetId: cut.assetId,
    trackId: audioTrackId,
    name: `${label} · ${evidence.find((asset) => asset.id === cut.assetId)?.name ?? "source audio"}`,
    start: cut.start,
    sourceStart: cut.sourceStart,
    duration: cut.duration,
    gain: 1,
    pan: 0,
    fadeIn: 0,
    fadeOut: 0,
    muted: false,
    automation: [],
    linkedVideoId: cut.id,
  })) : [];
  return { cuts, total, label, linkedAudio };
}

export function projectTranscriptSources(main: { file: File | null; isAudio: boolean; name: string }, assets: EvidenceMedia[]) {
  return [
    ...(main.file && !main.isAudio ? [{ id: MAIN_SOURCE_ID, name: main.name, file: main.file }] : []),
    ...assets.filter((asset) => asset.kind === "video" && asset.file).map((asset) => ({ id: asset.id, name: asset.name, file: asset.file! })),
  ];
}

export async function transcribeProjectSources(
  sources: ReturnType<typeof projectTranscriptSources>,
  existing: Record<string, ProjectTranscriptChunk[]>,
  onProgress: (index: number, total: number, name: string, stage: string, progress: number) => void,
) {
  const { transcribeVocals } = await import("./transcribe-client");
  const transcripts = { ...existing };
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    if (Object.prototype.hasOwnProperty.call(transcripts, source.id)) continue;
    onProgress(index, sources.length, source.name, "starting", 0);
    try {
      const raw = await transcribeVocals(source.file, (progress) => onProgress(index, sources.length, source.name, progress.stage, progress.progress));
      transcripts[source.id] = groupTimedTranscript(raw).map((chunk) => ({ text: chunk.text, start: chunk.start, end: chunk.end }));
    } catch {
      // Silent B-roll is valid media; cache the empty result to avoid retries.
      transcripts[source.id] = [];
    }
  }
  return transcripts;
}
