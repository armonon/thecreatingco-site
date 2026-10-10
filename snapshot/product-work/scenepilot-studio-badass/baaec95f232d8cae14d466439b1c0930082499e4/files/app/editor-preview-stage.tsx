"use client";

import { Music2 } from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { audioTrackOutputGain, type AudioBus } from "../lib/audio-mixer";
import { compositionAudioSegments } from "../lib/composition-tracks";
import { attachLiveAudioMeter, type LiveMeterReading } from "../lib/live-audio-meter";
import { clipGainAt, type AudioClip, type AudioTrack } from "../lib/pro-editor";
import type { BaseCut } from "../lib/sequencer";
import type { RenderPlacement, RenderTrack, StudioComposition } from "../lib/compositor";
import { CanvasPreview, type CanvasPreviewProps } from "./canvas-preview";
import type { MediaAsset } from "./media-browser";

type PreviewRenderSettings = Pick<CanvasPreviewProps,
  "motion" | "transition" | "grade" | "strobe" | "stutter" | "speed" | "dropRamp" | "echo" | "titles"
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
  hasCompositionTimelineContent: boolean;
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

export function CompositionAudioLayerPreview({ asset, time, playing, audible, gain }: { asset: MediaAsset; time: number; playing: boolean; audible: boolean; gain: number }) {
  const ref = useRef<HTMLMediaElement>(null);
  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    media.volume = audible ? Math.max(0, Math.min(1, gain)) : 0;
    if (Math.abs(media.currentTime - time) > .1) {
      try { media.currentTime = Math.max(0, time); } catch { /* metadata is not ready */ }
    }
    if (playing && audible) void media.play().catch(() => undefined);
    else media.pause();
  }, [time, playing, audible, gain]);
  return asset.kind === "video"
    ? <video crossOrigin="anonymous" ref={ref as RefObject<HTMLVideoElement>} src={asset.proxyUrl ?? asset.url} playsInline preload="metadata" className="composition-audio-source" />
    : <audio crossOrigin="anonymous" ref={ref as RefObject<HTMLAudioElement>} src={asset.url} preload="metadata" className="composition-audio-source" />;
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
    const localTime = clip.sourceStart + Math.max(0, time - clip.start);
    if (Math.abs(audio.currentTime - localTime) > 0.12) {
      try { audio.currentTime = localTime; } catch { /* metadata is not ready */ }
    }
    audio.volume = 1;
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
  montageEnabled, hasCompositionTimelineContent, includeProAudio, includeCompositionAudio, audioClips, audioTracks,
  audioBuses, masterGain, currentTime, playing, width, height, quality, onPerformance, onMeter, energyBars,
  showScope, scopeCanvasRef, motion, transition, grade, strobe, stutter, speed, dropRamp, echo, titles,
}: EditorPreviewStageProps) {
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const visualAssets = useMemo(() => assets
    .filter((asset) => asset.kind !== "audio")
    .map(({ id, url, proxyUrl, kind }) => ({ id, url: proxyUrl ?? url, kind: kind as "image" | "video" })), [assets]);
  const compositionSegments = useMemo(
    () => includeCompositionAudio ? compositionAudioSegments(compositions, placements) : [],
    [compositions, includeCompositionAudio, placements],
  );
  const audioTrackById = useMemo(() => new Map(audioTracks.map((track) => [track.id, track])), [audioTracks]);
  const anyAudioSolo = audioTracks.some((track) => track.solo);

  if (!mainUrl && !hasCompositionTimelineContent) return emptyState;
  const showCanvas = !mainIsAudio || baseCuts.length > 0 || placements.length > 0;
  return <>
    {mainUrl && (mainIsAudio
      ? <audio crossOrigin="anonymous" ref={(node) => { mediaRef.current = node; }} src={mainUrl} preload="metadata" />
      : <video crossOrigin="anonymous" ref={(node) => { mediaRef.current = node; }} src={mainUrl} playsInline preload="metadata" className={showCanvas ? "preview-source" : undefined} />)}
    {includeProAudio && audioClips.map((clip) => {
      const asset = assetById.get(clip.assetId);
      const track = audioTrackById.get(clip.trackId);
      return asset && track && asset.kind !== "image" ? <AudioClipPreview key={clip.id} clip={clip} track={track} fileUrl={asset.url} mediaKind={asset.kind} time={currentTime} playing={playing} anySolo={anyAudioSolo} outputGain={audioTrackOutputGain(track, audioBuses, masterGain)} onMeter={(reading) => onMeter(clip.id, reading)} /> : null;
    })}
    {compositionSegments.map((clip) => {
      const asset = assetById.get(clip.assetId);
      if (!asset || asset.kind === "image") return null;
      const active = currentTime >= clip.start && currentTime < clip.start + clip.duration;
      return <CompositionAudioLayerPreview key={`master-${clip.id}`} asset={asset} time={clip.sourceStart + Math.max(0, currentTime - clip.start)} playing={playing} audible={active && !clip.muted} gain={clip.gain * masterGain} />;
    })}
    {showCanvas ? <CanvasPreview
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
      <Music2 size={34} /><strong>{mainName}</strong>
      <div>{energyBars.slice(0, 54).map((barHeight, index) => <i key={index} style={{ height: `${Math.max(12, barHeight)}%` }} />)}</div>
    </div>}
    {showScope && <canvas ref={scopeCanvasRef} width={240} height={120} className="luma-scope" />}
  </>;
}
