"use client";

import { Music2 } from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { audioTrackOutputGain, type AudioBus } from "../lib/audio-mixer";
import { compositionAudioPlan } from "../lib/composition-audio";
import { attachLiveAudioMeter, type LiveMeterReading } from "../lib/live-audio-meter";
import { clipGainAt, type AudioClip, type AudioTrack } from "../lib/pro-editor";
import type { BaseCut } from "../lib/sequencer";
import type { RenderPlacement, RenderTrack, StudioComposition } from "../lib/compositor";
import { hasRenderableSequence } from "../lib/sequence-readiness";
import { audioPlaybackRate, audioSourceTime } from "../lib/audio-timing";
import { CanvasPreview, type CanvasPreviewProps } from "./canvas-preview";
import type { MediaAsset } from "./media-browser";
import { ScheduledSongPreview } from "./scheduled-song-preview";

type PreviewRenderSettings = Pick<CanvasPreviewProps,
  "motion" | "transition" | "grade" | "strobe" | "stutter" | "speed" | "dropRamp" | "echo" | "titles" | "auditionEnabled"
>;

export type EditorPreviewStageProps = PreviewRenderSettings & {
  emptyState: ReactNode;
  mediaRef: RefObject<HTMLMediaElement | null>;
  mainUrl: string;
  mainIsAudio: boolean;
  mainName: string;
  assets: MediaAsset[];
  placements: RenderPlacement[];
  compositions: StudioComposition[];
  tracks: RenderTrack[];
  baseCuts: BaseCut[];
  montageEnabled: boolean;
  includeProAudio: boolean;
  includeCompositionAudio: boolean;
  audioClips: AudioClip[];
  audioTracks: AudioTrack[];
  audioBuses: AudioBus[];
  masterGain: number;
  currentTime: number;
  playing: boolean;
  width: number;
  height: number;
  quality: CanvasPreviewProps["quality"];
  onPerformance: NonNullable<CanvasPreviewProps["onPerformance"]>;
  onMeter: (clipId: string, reading: LiveMeterReading) => void;
  energyBars: number[];
  showScope: boolean;
  scopeCanvasRef: RefObject<HTMLCanvasElement | null>;
};

const COMPOSITION_AUDIO_TRACK: AudioTrack = { id: "composition-audio", name: "Composition", color: "#8e78ff", gain: 1, pan: 0, muted: false, solo: false, locked: false };
const ignoreMeter = () => undefined;

export function CompositionAudioPreview({ compositions, placements, tracks, assets, time, playing, masterGain = 1, onMeter, mainUrl = "" }: {
  compositions: StudioComposition[]; placements: RenderPlacement[]; tracks?: RenderTrack[]; assets: MediaAsset[];
  time: number; playing: boolean; masterGain?: number; onMeter?: (id: string, reading: LiveMeterReading) => void; mainUrl?: string;
}) {
  const plan = useMemo(() => compositionAudioPlan(compositions, placements, tracks), [compositions, placements, tracks]);
  const byId = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);
  return <>
    {plan.issues.length > 0 && <p role="alert">Composition audio needs attention: {plan.issues.join(" ")}</p>}
    {plan.clips.filter(clip => time >= clip.start - .25 && time < clip.start + clip.duration + .25).map(segment => {
      const asset = byId.get(segment.assetId);
      const fileUrl = segment.assetId === "__main__" ? mainUrl : asset?.url;
      if (!fileUrl || asset?.kind === "image") return null;
      const clip: AudioClip = { ...segment, trackId: COMPOSITION_AUDIO_TRACK.id, name: segment.id, automation: segment.automation?.map((p, i) => ({ ...p, id: String(i) })) };
      if (asset?.kind === "audio") return <ScheduledSongPreview key={clip.id} clip={clip} track={COMPOSITION_AUDIO_TRACK} fileUrl={fileUrl} sourceDuration={asset.duration} time={time} anySolo={false} outputGain={masterGain} onMeter={onMeter ? reading => onMeter(clip.id, reading) : ignoreMeter} />;
      return <AudioClipPreview key={clip.id} clip={clip} track={COMPOSITION_AUDIO_TRACK} fileUrl={fileUrl} mediaKind={asset?.kind ?? "audio"}
        time={time} playing={playing} anySolo={false} outputGain={masterGain} onMeter={onMeter ? reading => onMeter(clip.id, reading) : ignoreMeter} />;
    })}
  </>;
}

function AudioClipPreview({
  clip, track, fileUrl, mediaKind, time, playing, anySolo, outputGain, onMeter,
}: {
  clip: AudioClip;
  track: AudioTrack;
  fileUrl: string;
  mediaKind: "audio" | "video";
  time: number;
  playing: boolean;
  anySolo: boolean;
  outputGain: number;
  onMeter: (reading: LiveMeterReading) => void;
}) {
  const ref = useRef<HTMLMediaElement>(null);
  const meterCallbackRef = useRef(onMeter);
  const meterGainRef = useRef(0);
  const processingRef = useRef({ rack: track.processing, pan: Math.max(-1, Math.min(1, track.pan + clip.pan)) });
  const active = time >= clip.start && time < clip.start + clip.duration
    && outputGain > 0 && !track.muted && (!anySolo || track.solo);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const localTime = audioSourceTime(clip, time - clip.start);
    if (Math.abs(audio.currentTime - localTime) > 0.12) {
      try { audio.currentTime = localTime; } catch { /* metadata is not ready */ }
    }
    audio.volume = 1;
    audio.playbackRate = audioPlaybackRate(clip);
    audio.preservesPitch = false;
    if (active && playing) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [active, clip, playing, time, track.gain]);
  useEffect(() => { meterCallbackRef.current = onMeter; }, [onMeter]);
  useEffect(() => {
    meterGainRef.current = active && playing ? Math.min(4, clipGainAt(clip, time, outputGain)) : 0;
    processingRef.current = { rack: track.processing, pan: Math.max(-1, Math.min(1, track.pan + clip.pan)) };
  }, [active, clip, outputGain, playing, time, track.gain, track.pan, track.processing]);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    return attachLiveAudioMeter(audio, (reading) => meterCallbackRef.current(reading), () => meterGainRef.current, () => processingRef.current);
  }, [clip.id]);
  return mediaKind === "video"
    ? <video crossOrigin="anonymous" ref={ref as RefObject<HTMLVideoElement>} src={fileUrl} preload="metadata" playsInline className="audio-only-media" />
    : <audio crossOrigin="anonymous" ref={ref as RefObject<HTMLAudioElement>} src={fileUrl} preload="metadata" />;
}

export function EditorPreviewStage({
  emptyState, mediaRef, mainUrl, mainIsAudio, mainName, assets, placements, compositions, tracks, baseCuts,
  montageEnabled, includeProAudio, includeCompositionAudio, audioClips, audioTracks,
  audioBuses, masterGain, currentTime, playing, width, height, quality, onPerformance, onMeter, energyBars,
  showScope, scopeCanvasRef, motion, transition, grade, strobe, stutter, speed, dropRamp, echo, titles, auditionEnabled,
}: EditorPreviewStageProps) {
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const visualAssets = useMemo(() => assets
    .filter((asset) => asset.kind !== "audio")
    .map(({ id, url, proxyUrl, kind }) => ({ id, url: proxyUrl ?? url, kind: kind as "image" | "video" })), [assets]);

  const audioTrackById = useMemo(() => new Map(audioTracks.map((track) => [track.id, track])), [audioTracks]);
  const anyAudioSolo = audioTracks.some((track) => track.solo);

  const hasPicture = hasRenderableSequence({ hasMainMedia: Boolean(mainUrl), assetCount: assets.length, placementCount: placements.length, baseCutCount: baseCuts.length, montageEnabled });
  const hasAudioTimeline = includeProAudio && audioClips.length > 0;
  if (!mainUrl && !hasPicture && !hasAudioTimeline) return emptyState;
  const showCanvas = hasPicture || Boolean(mainUrl && !mainIsAudio);
  return <>
    {mainUrl && (mainIsAudio
      ? <audio crossOrigin="anonymous" ref={(node) => { mediaRef.current = node; }} src={mainUrl} preload="metadata" />
      : <video crossOrigin="anonymous" ref={(node) => { mediaRef.current = node; }} src={mainUrl} playsInline preload="metadata" className={showCanvas ? "preview-source" : undefined} />)}
    {includeProAudio && audioClips.map((clip) => {
      const asset = assetById.get(clip.assetId);
      const track = audioTrackById.get(clip.trackId);
      if (asset?.kind === "audio" && track) return <ScheduledSongPreview key={clip.id} clip={clip} track={track} fileUrl={asset.url} sourceDuration={asset.duration} time={currentTime} anySolo={anyAudioSolo} outputGain={audioTrackOutputGain(track, audioBuses, masterGain)} onMeter={reading => onMeter(clip.id, reading)} />;
      return asset && track && asset.kind !== "image" ? <AudioClipPreview key={clip.id} clip={clip} track={track} fileUrl={asset.url} mediaKind={asset.kind} time={currentTime} playing={playing} anySolo={anyAudioSolo} outputGain={audioTrackOutputGain(track, audioBuses, masterGain)} onMeter={(reading) => onMeter(clip.id, reading)} /> : null;
    })}
    {includeCompositionAudio && <CompositionAudioPreview compositions={compositions} placements={placements} tracks={tracks} assets={assets} mainUrl={mainUrl} time={currentTime} playing={playing} masterGain={masterGain} onMeter={onMeter} />}
    {showCanvas ? <CanvasPreview
      auditionEnabled={auditionEnabled}
      mediaRef={mediaRef}
      mainUrl={mainUrl}
      assets={visualAssets}
      placements={placements}
      compositions={compositions}
      tracks={tracks}
      baseCuts={montageEnabled ? baseCuts : []}
      motion={motion}
      transition={transition}
      grade={grade}
      strobe={strobe}
      stutter={stutter}
      speed={speed}
      dropRamp={dropRamp}
      echo={echo}
      titles={titles}
      currentTime={currentTime}
      width={width}
      height={height}
      quality={quality}
      onPerformance={onPerformance}
    /> : <div className="audio-source-canvas">
      <Music2 size={34} /><strong>{mainUrl ? mainName : "Sequence audio"}</strong>
      <div>{energyBars.slice(0, 54).map((barHeight, index) => <i key={index} style={{ height: `${Math.max(12, barHeight)}%` }} />)}</div>
    </div>}
    {showScope && <canvas ref={scopeCanvasRef} width={240} height={120} className="luma-scope" />}
  </>;
}
