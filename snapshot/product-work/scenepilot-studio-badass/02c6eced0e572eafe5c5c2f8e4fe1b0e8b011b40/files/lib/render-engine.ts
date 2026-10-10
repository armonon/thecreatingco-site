import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  StreamTarget,
  WavOutputFormat,
  WebMOutputFormat,
  type StreamTargetChunk,
  VideoSampleSink,
} from "mediabunny";
import type { BaseCut } from "./sequencer.ts";
import { createGradePass, type GradeParams } from "./grade.ts";
import { TRANSITION_PRESETS, type TransitionConfig } from "./transitions.ts";
import { yieldToBrowser } from "./scheduling.ts";
import { frameSourceResolver } from "./frame-source-map.ts";
import { createMp4TimingPatch } from "./mp4-audio-priming.ts";
import { audioPlaybackRate, audioSourceTime } from "./audio-timing.ts";
import { outputDimensions, type OutputAspect } from "./aspect.ts";
import type { StrobeConfig } from "./strobe.ts";
import type { StutterConfig } from "./stutter.ts";
import type { SpeedConfig } from "./speed.ts";
import type { TitleCue } from "./titles.ts";
import type { RenderFormat } from "./pro-editor.ts";
import type { AudioEffectRack } from "./pro-editor.ts";
import type { AudioFadeShape } from "./audio-crossfade.ts";
import { PCM_MIX_CHUNK_FRAMES, PCM_MIX_SAMPLE_RATE, PcmChannelStrip, clampPcmSample } from "./pcm-audio.ts";
import {
  computeFramePlan,
  prepareFramePlanContext,
  paintFramePlan,
  fitCover,
  MAIN_SOURCE_ID,
  type CompositorAsset,
  type FrameSource,
  type RenderMotion,
  type RenderPlacement,
  type RenderTrack,
  type StudioComposition,
} from "./compositor.ts";

// The frame model lives in ./compositor so the live preview paints exactly what
// this renders. Re-exported here so existing importers keep working.
export { fitCover };
export type { RenderMotion, RenderPlacement, RenderTrack, StudioComposition };

export type RenderAsset = {
  id: string;
  file: File;
  kind: "image" | "video";
};

export type RenderAudioClip = {
  /** Explicit worker-safe pitch-preserving preparation; old clips retain varispeed. */
  preservePitch?: boolean;
  /** Single-source preparation only: no channel strip baked into derived media. */
  rawSource?: boolean;
  warp?: import("./song-beat-map.ts").AudioWarpPoint[];
  id: string;
  file: File;
  start: number;
  sourceStart: number;
  playbackRate?: number;
  duration: number;
  gain: number;
  pan: number;
  fadeIn: number;
  fadeOut: number;
  fadeShape?: AudioFadeShape;
  envelopes?: import("./audio-crossfade.ts").AudioEnvelope[];
  automation?: Array<{ time: number; gain: number }>;
  muted?: boolean;
  optional?: boolean;
  processing?: AudioEffectRack;
};

export type RenderOptions = {
  /** Optional soundtrack/continuous source. Clip-first sequences and motion
   * graphics render directly from their assets without dummy media. */
  mainFile: File | null;
  assets: RenderAsset[];
  placements: RenderPlacement[];
  compositions?: StudioComposition[];
  tracks?: RenderTrack[];
  /**
   * Beat-cut base montage. When present and non-empty, the base layer is this
   * sequence of clips instead of the continuous main video. The main file still
   * provides the soundtrack.
   */
  baseCuts?: BaseCut[];
  /** Beat-synced camera motion. Omit for a static base. */
  motion?: RenderMotion;
  /**
   * WebGL film-look grade applied to every finished frame. When requested, a
   * missing grade pass is a render error: exports must match the preview.
   */
  grade?: {
    params: GradeParams;
    /** Pulse the grade with the beat envelope, like the zoom-punch. */
    beatDriven?: boolean;
  };
  /** Transition fired at every montage cut boundary. Montage mode only. */
  transition?: TransitionConfig;
  /** Synthetic strobe lights fired on the beat. See lib/strobe.ts. */
  strobe?: { config: StrobeConfig; times: number[] } | null;
  /** Stutter applied to the base layer's source playhead. See lib/stutter.ts. */
  stutter?: { config: StutterConfig; beatSeconds: number; origin?: number } | null;
  /** Speed ramp applied to the base layer's source playhead. See lib/speed.ts. */
  speed?: { config: SpeedConfig; beatSeconds: number; origin?: number } | null;
  /** One-shot slow-mo decelerating into a freeze on the drop. See lib/speed.ts. */
  dropRamp?: { dropTime: number; beatSeconds: number; config?: SpeedConfig } | null;
  /** Frame-trail feedback. See computeFramePlan echo. */
  echo?: { amount: number; beatDriven?: boolean } | null;
  /** Kinetic title cues. See lib/titles.ts. */
  titles?: TitleCue[];
  duration: number;
  frameRate?: 24 | 25 | 30 | 50 | 60;
  maxDimension?: 1280 | 1920 | 3840;
  /** Output frame shape. "source" keeps the footage's; the rest crop to fill. */
  aspect?: OutputAspect;
  /** Exact pixel size when `aspect` is "custom". */
  customSize?: { width: number; height: number };
  outputStream?: WritableStream<StreamTargetChunk>;
  format?: RenderFormat;
  audioClips?: RenderAudioClip[];
  /** False means the explicit mix is authoritative, even when it is silent. */
  useMainAudio?: boolean;
  transparent?: boolean;
  /** Timeline time corresponding to output frame zero (for in/out renders). */
  timeOffset?: number;
  hardwareAcceleration?: "no-preference" | "prefer-hardware" | "prefer-software";
  /** Override the source canvas shape (used for composition-only renders). */
  sourceSize?: { width: number; height: number };
  signal?: AbortSignal;
  onProgress?: (progress: number, message: string) => void;
};

export type RenderAudioOptions = {
  clips: RenderAudioClip[];
  duration: number;
  outputStream?: WritableStream<StreamTargetChunk>;
  signal?: AbortSignal;
  onProgress?: (progress: number, message: string) => void;
};

export function createRenderTrackMetadata(duration: number, frameRate: number, audioSampleRate?: number | null) {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const safeFrameRate = Number.isFinite(frameRate) ? Math.max(1, frameRate) : 30;
  const video = {
    frameRate: safeFrameRate,
    maximumPacketCount: Math.max(1, Math.ceil(safeDuration * safeFrameRate)),
  };

  if (!audioSampleRate || !Number.isFinite(audioSampleRate) || audioSampleRate <= 0) {
    return { video, audio: null };
  }

  const packetDuration = Math.min(0.01, 512 / audioSampleRate);
  const expectedPackets = safeDuration / packetDuration;
  return {
    video,
    audio: { maximumPacketCount: Math.max(1, Math.ceil(expectedPackets * 4 / 3) + 32) },
  };
}

function abortError(signal?: AbortSignal) {
  signal?.throwIfAborted();
}

class PcmClipReader {
  private readonly sink: AudioSampleSink;
  readonly firstTimestamp: number;
  readonly endTimestamp: number;
  readonly mono: boolean;
  private sample: AudioSample | null = null;
  private planes: Float32Array[] = [];
  private sampleEnd = Number.NEGATIVE_INFINITY;

  constructor(
    sink: AudioSampleSink,
    firstTimestamp: number,
    endTimestamp: number,
    mono: boolean,
  ) {
    this.sink = sink;
    this.firstTimestamp = firstTimestamp;
    this.endTimestamp = endTimestamp;
    this.mono = mono;
  }

  private closeSample() {
    this.sample?.close();
    this.sample = null;
    this.planes = [];
    this.sampleEnd = Number.NEGATIVE_INFINITY;
  }

  close() {
    this.closeSample();
  }

  private async load(time: number) {
    if (this.sample && time >= this.sample.timestamp - 1e-7 && time < this.sampleEnd - 1e-7) return true;
    this.closeSample();
    if (time < this.firstTimestamp || time >= this.endTimestamp) return false;
    const sample = await this.sink.getSample(time + 1e-7);
    if (!sample || time < sample.timestamp - 1e-5 || time >= sample.timestamp + sample.duration + 1e-5) {
      sample?.close();
      return false;
    }
    this.sample = sample;
    this.sampleEnd = sample.timestamp + sample.duration;
    this.planes = Array.from({ length: sample.numberOfChannels }, (_, planeIndex) => {
      const plane = new Float32Array(sample.numberOfFrames);
      sample.copyTo(plane, { planeIndex, format: "f32-planar" });
      return plane;
    });
    return true;
  }

  private value(channel: number, position: number) {
    const plane = this.planes[Math.min(channel, this.planes.length - 1)];
    if (!plane?.length) return 0;
    const leftIndex = Math.max(0, Math.min(plane.length - 1, Math.floor(position)));
    const rightIndex = Math.min(plane.length - 1, leftIndex + 1);
    const fraction = Math.max(0, Math.min(1, position - leftIndex));
    return (plane[leftIndex] ?? 0) + ((plane[rightIndex] ?? 0) - (plane[leftIndex] ?? 0)) * fraction;
  }

  private stereo(position: number) {
    if (this.planes.length <= 1) {
      const mono = this.value(0, position);
      return [mono, mono] as const;
    }
    let left = this.value(0, position);
    let right = this.value(1, position);
    if (this.planes.length === 3) {
      const center = this.value(2, position) * Math.SQRT1_2;
      left += center;
      right += center;
    } else if (this.planes.length === 4) {
      left += this.value(2, position) * Math.SQRT1_2;
      right += this.value(3, position) * Math.SQRT1_2;
    } else if (this.planes.length >= 5) {
      const center = this.value(2, position) * Math.SQRT1_2;
      left += center;
      right += center;
      const surroundStart = this.planes.length >= 6 ? 4 : 3;
      if (this.planes.length >= 6) {
        const lfe = this.value(3, position) * 0.5;
        left += lfe;
        right += lfe;
      }
      left += this.value(surroundStart, position) * Math.SQRT1_2;
      right += this.value(surroundStart + 1, position) * Math.SQRT1_2;
      for (let channel = surroundStart + 2; channel < this.planes.length; channel++) {
        const extra = this.value(channel, position) * 0.5;
        if ((channel - surroundStart) % 2 === 0) left += extra;
        else right += extra;
      }
    }
    return [left, right] as const;
  }

  async fill(sourceStart: number, frameCount: number, left: Float32Array, right: Float32Array, signal?: AbortSignal, playbackRate = 1) {
    left.fill(0, 0, frameCount);
    right.fill(0, 0, frameCount);
    let offset = 0;
    while (offset < frameCount) {
      abortError(signal);
      const sourceTime = sourceStart + offset * playbackRate / PCM_MIX_SAMPLE_RATE;
      if (sourceTime < this.firstTimestamp) {
        offset += Math.max(1, Math.min(frameCount - offset, Math.ceil((this.firstTimestamp - sourceTime) * PCM_MIX_SAMPLE_RATE / playbackRate)));
        continue;
      }
      if (sourceTime >= this.endTimestamp || !await this.load(sourceTime)) break;
      const sample = this.sample;
      if (!sample) break;
      const spanFrames = Math.max(1, Math.min(
        frameCount - offset,
        Math.ceil((this.sampleEnd - sourceTime) * PCM_MIX_SAMPLE_RATE / playbackRate - 1e-7),
      ));
      const sourcePosition = (sourceTime - sample.timestamp) * sample.sampleRate;
      const sourceStep = sample.sampleRate * playbackRate / PCM_MIX_SAMPLE_RATE;
      for (let index = 0; index < spanFrames; index++) {
        const [sampleLeft, sampleRight] = this.stereo(sourcePosition + index * sourceStep);
        left[offset + index] = sampleLeft;
        right[offset + index] = sampleRight;
      }
      offset += spanFrames;
    }
  }
}

type PcmMixClip = {
  stretch?: import("./pcm-stretch.ts").PcmStretchReader;
  clip: RenderAudioClip;
  duration: number;
  reader: PcmClipReader;
  strip: PcmChannelStrip;
  left: Float32Array;
  right: Float32Array;
  disabled: boolean;
};

class PcmAudioMix {
  readonly sampleRate = PCM_MIX_SAMPLE_RATE;
  readonly clips: PcmMixClip[];
  readonly duration: number;

  constructor(clips: PcmMixClip[], duration: number) {
    this.clips = clips;
    this.duration = duration;
  }

  close() {
    for (const clip of this.clips) clip.reader.close();
  }

  async *samples(signal?: AbortSignal, onProgress?: (progress: number) => void) {
    const totalFrames = Math.max(1, Math.ceil(this.duration * this.sampleRate));
    for (let chunkStart = 0; chunkStart < totalFrames; chunkStart += PCM_MIX_CHUNK_FRAMES) {
      abortError(signal);
      const frameCount = Math.min(PCM_MIX_CHUNK_FRAMES, totalFrames - chunkStart);
      const chunkTime = chunkStart / this.sampleRate;
      const interleaved = new Float32Array(frameCount * 2);
      for (const state of this.clips) {
        if (state.disabled) continue;
        const clipStartFrame = Math.max(0, Math.ceil((state.clip.start - chunkTime) * this.sampleRate));
        const clipEndFrame = Math.min(frameCount, Math.ceil((state.clip.start + state.duration - chunkTime) * this.sampleRate));
        if (clipEndFrame <= clipStartFrame) continue;
        const sourceStart = audioSourceTime(state.clip, chunkTime + clipStartFrame / this.sampleRate - state.clip.start);
        const activeFrames = clipEndFrame - clipStartFrame;
        try {
          if (state.stretch) await state.stretch.fill(activeFrames, state.left, state.right, signal);
          else await state.reader.fill(sourceStart, activeFrames, state.left, state.right, signal, audioPlaybackRate(state.clip));
        } catch (error) {
          if (!state.clip.optional) throw error;
          state.disabled = true;
          continue;
        }
        for (let index = 0; index < activeFrames; index++) {
          const clipTime = chunkTime + (clipStartFrame + index) / this.sampleRate - state.clip.start;
          const target = (clipStartFrame + index) * 2;
          if (state.clip.rawSource) {
            interleaved[target] += state.left[index];
            interleaved[target + 1] += state.right[index];
          } else {
            state.strip.process(state.left[index], state.right[index], state.reader.mono, clipTime);
            interleaved[target] += state.strip.left;
            interleaved[target + 1] += state.strip.right;
          }
        }
      }
      for (let index = 0; index < interleaved.length; index++) interleaved[index] = clampPcmSample(interleaved[index]);
      onProgress?.((chunkStart + frameCount) / totalFrames);
      const monoPreparation = this.clips.length === 1 && this.clips[0].clip.rawSource && this.clips[0].reader.mono;
      yield new AudioSample({
        data: monoPreparation ? Float32Array.from({ length: frameCount }, (_, i) => interleaved[i * 2]) : interleaved,
        format: "f32",
        numberOfChannels: monoPreparation ? 1 : 2,
        sampleRate: this.sampleRate,
        timestamp: chunkTime,
      });
      if ((chunkStart / PCM_MIX_CHUNK_FRAMES) % 24 === 23) await yieldToBrowser();
    }
  }
}

async function openPcmAudioMix(clips: RenderAudioClip[], duration: number, inputs: Input[], signal?: AbortSignal) {
  if (clips.some(c => c.rawSource) && clips.length !== 1) throw new Error("Raw source preparation requires exactly one clip.");
  if (clips.some(c => c.preservePitch && c.start < 0)) throw new Error("Pitch preparation must begin at or after zero; prepare the source before cropping it.");
  const states: PcmMixClip[] = [];
  for (const clip of clips) {
    abortError(signal);
    if (clip.muted) continue;
    try {
      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(clip.file) });
      inputs.push(input);
      const track = await input.getPrimaryAudioTrack();
      if (!track) {
        if (clip.optional) continue;
        throw new Error(`${clip.file.name || clip.id} has no decodable audio track.`);
      }
      const firstTimestamp = await track.getFirstTimestamp();
      const endTimestamp = (await track.getDurationFromMetadata()) ?? await track.computeDuration();
      const playableDuration = Math.min(clip.duration, duration - clip.start, clip.warp ? clip.duration : (endTimestamp - clip.sourceStart) / audioPlaybackRate(clip));
      if (playableDuration <= 0) continue;
      const mono = await track.getNumberOfChannels() === 1;
      const reader = new PcmClipReader(new AudioSampleSink(track), firstTimestamp, endTimestamp, mono);
      const stretch = clip.preservePitch ? new (await import("./pcm-stretch.ts")).PcmStretchReader(
        (time, frames, left, right, abort) => reader.fill(time, frames, left, right, abort), PCM_MIX_SAMPLE_RATE,
        clip.sourceStart, audioPlaybackRate(clip), clip.warp,
      ) : undefined;
      states.push({
        stretch,
        clip,
        duration: playableDuration,
        reader,
        // Source exhaustion must not move the clip's requested fade-out earlier.
        strip: new PcmChannelStrip(clip),
        left: new Float32Array(PCM_MIX_CHUNK_FRAMES),
        right: new Float32Array(PCM_MIX_CHUNK_FRAMES),
        disabled: false,
      });
    } catch (error) {
      if (!clip.optional) throw error;
    }
  }
  return states.length ? new PcmAudioMix(states, duration) : null;
}

/** Public streaming PCM boundary used by renderProject and release
 * certification. Samples are always stereo f32/48 kHz and bounded to
 * PCM_MIX_CHUNK_FRAMES. The caller owns and must close every yielded sample. */
export async function* mixAudioClipSamples(
  clips: RenderAudioClip[],
  duration: number,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  const inputs: Input[] = [];
  let mix: PcmAudioMix | null = null;
  try {
    mix = await openPcmAudioMix(clips, duration, inputs, signal);
    if (!mix) return;
    yield* mix.samples(signal, onProgress);
  } finally {
    mix?.close();
    for (const input of inputs) input.dispose();
  }
}

/** Materializes the worker-safe PCM stream only for the explicit offline
 * loudness-analysis command. Normal exports feed the same chunks straight to
 * the encoder and never allocate a program-length AudioBuffer. */
export async function mixAudioClips(clips: RenderAudioClip[], duration: number, signal?: AbortSignal) {
  if (typeof AudioBuffer === "undefined") throw new Error("Offline loudness analysis needs browser audio-buffer support.");
  const inputs: Input[] = [];
  let mix: PcmAudioMix | null = null;
  try {
    mix = await openPcmAudioMix(clips, duration, inputs, signal);
    const frameCount = Math.max(1, Math.ceil(Math.max(0.01, duration) * PCM_MIX_SAMPLE_RATE));
    const requiredBytes = frameCount * 2 * 4;
    if (requiredBytes > 1_500_000_000) {
      throw new Error("This loudness analysis is too large for a safe in-memory buffer. Analyze an in/out range instead.");
    }
    const buffer = new AudioBuffer({ length: frameCount, numberOfChannels: 2, sampleRate: PCM_MIX_SAMPLE_RATE });
    if (!mix) return buffer;
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    let frameOffset = 0;
    for await (const sample of mix.samples(signal)) {
      try {
        const sampleLeft = new Float32Array(sample.numberOfFrames);
        const sampleRight = new Float32Array(sample.numberOfFrames);
        sample.copyTo(sampleLeft, { planeIndex: 0, format: "f32-planar" });
        sample.copyTo(sampleRight, { planeIndex: 1, format: "f32-planar" });
        left.set(sampleLeft.subarray(0, Math.min(sampleLeft.length, left.length - frameOffset)), frameOffset);
        right.set(sampleRight.subarray(0, Math.min(sampleRight.length, right.length - frameOffset)), frameOffset);
        frameOffset += sample.numberOfFrames;
      } finally {
        sample.close();
      }
    }
    return buffer;
  } finally {
    mix?.close();
    for (const input of inputs) input.dispose();
  }
}

/** Render a professional 24-bit/48 kHz stereo WAV without creating a video
 * track. The same bounded PCM mixer used by video masters feeds the WAVE muxer
 * directly, so stems retain identical routing, automation and processing while
 * remaining worker-safe and streamable to disk. */
export async function renderAudioProject({ clips, duration, outputStream, signal, onProgress }: RenderAudioOptions) {
  const safeDuration = Math.max(0.01, Number.isFinite(duration) ? duration : 0.01);
  const inputs: Input[] = [];
  let mix: PcmAudioMix | null = null;
  let output: Output | null = null;
  try {
    abortError(signal);
    mix = await openPcmAudioMix(clips, safeDuration, inputs, signal);
    const target = outputStream ? new StreamTarget(outputStream, { chunked: true }) : new BufferTarget();
    output = new Output({ format: new WavOutputFormat({ large: Boolean(outputStream) }), target });
    const source = new AudioSampleSource({ codec: "pcm-s24" });
    output.addAudioTrack(source, { name: "ScenePilot 24-bit PCM stem" });
    await output.start();
    const totalFrames = Math.max(1, Math.ceil(safeDuration * PCM_MIX_SAMPLE_RATE));
    if (mix) {
      for await (const sample of mix.samples(signal, (progress) => {
        onProgress?.(progress * 0.97, `Mixing 24-bit PCM stem · ${Math.round(progress * 100)}%`);
      })) {
        try { await source.add(sample); }
        finally { sample.close(); }
      }
    } else {
      for (let chunkStart = 0; chunkStart < totalFrames; chunkStart += PCM_MIX_CHUNK_FRAMES) {
        abortError(signal);
        const frameCount = Math.min(PCM_MIX_CHUNK_FRAMES, totalFrames - chunkStart);
        const sample = new AudioSample({
          data: new Float32Array(frameCount * 2), format: "f32", numberOfChannels: 2,
          sampleRate: PCM_MIX_SAMPLE_RATE, timestamp: chunkStart / PCM_MIX_SAMPLE_RATE,
        });
        try { await source.add(sample); }
        finally { sample.close(); }
        onProgress?.(((chunkStart + frameCount) / totalFrames) * 0.97, "Writing silent PCM stem");
      }
    }
    onProgress?.(0.98, "Finalizing 24-bit WAV");
    await output.finalize();
    onProgress?.(1, "Audio stem complete");
    if (target instanceof BufferTarget) {
      if (!target.buffer) throw new Error("The stem renderer produced an empty file.");
      return new Blob([target.buffer], { type: "audio/wav" });
    }
    return null;
  } catch (error) {
    if (output && output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    mix?.close();
    for (const input of inputs) input.dispose();
  }
}

export async function renderProject({
  mainFile,
  assets,
  placements,
  compositions = [],
  tracks = [],
  baseCuts = [],
  motion,
  grade,
  transition = TRANSITION_PRESETS.none,
  strobe,
  stutter,
  speed,
  dropRamp,
  echo,
  titles,
  duration,
  frameRate = 30,
  maxDimension = 1920,
  aspect = "source",
  customSize,
  outputStream,
  format = "mp4-h264",
  audioClips = [],
  useMainAudio = true,
  transparent = false,
  timeOffset = 0,
  hardwareAcceleration = "no-preference",
  sourceSize,
  signal,
  onProgress,
}: RenderOptions) {
  // globalThis, not window: this runs in a Web Worker (OffscreenCanvas) as well
  // as on the main thread.
  if (!("VideoEncoder" in globalThis) || !("VideoDecoder" in globalThis)) {
    throw new Error("This browser cannot render video yet. Open ScenePilot in a current Chrome or Edge browser.");
  }
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("This browser cannot render video yet (no OffscreenCanvas). Open ScenePilot in a current Chrome or Edge browser.");
  }

  const inputs: Input[] = [];
  const bitmaps = new Map<string, ImageBitmap>();
  let output: Output | null = null;
  let gradePass: ReturnType<typeof createGradePass> | null = null;
  let pcmMix: PcmAudioMix | null = null;
  let aacOutput: Awaited<ReturnType<typeof import("./aac-output.ts").createAacOutput>> | null = null;
  const timingPatch = createMp4TimingPatch(duration, () => aacOutput?.delay);
  try {
    onProgress?.(0, "Opening source media");
    const mainInput = mainFile ? new Input({ formats: ALL_FORMATS, source: new BlobSource(mainFile) }) : null;
    if (mainInput) inputs.push(mainInput);
    const mainVideoTrack = await mainInput?.getPrimaryVideoTrack() ?? null;
    const audioTrack = await mainInput?.getPrimaryAudioTrack() ?? null;
    if (mainInput && !mainVideoTrack && !audioTrack) throw new Error("The main file has no decodable audio or video track.");
    pcmMix = audioClips.length ? await openPcmAudioMix(audioClips, duration, inputs, signal) : null;
    const audioSampleRate = pcmMix?.sampleRate ?? (useMainAudio && audioTrack ? await audioTrack.getSampleRate() : null);
    const sourceWidth = sourceSize?.width ?? (mainVideoTrack ? await mainVideoTrack.getDisplayWidth() : 1280);
    const sourceHeight = sourceSize?.height ?? (mainVideoTrack ? await mainVideoTrack.getDisplayHeight() : 720);
    const { width, height } = outputDimensions(sourceWidth, sourceHeight, maxDimension, aspect, customSize);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { alpha: transparent });
    if (!context) throw new Error("Canvas rendering is unavailable.");

    // Film-look pass. Frames are composited on the 2D canvas, then graded into
    // a WebGL canvas which is what actually gets encoded. Never silently drop
    // requested effects: an export that differs from preview is a failed export.
    let gradeCanvas: OffscreenCanvas | null = null;
    // Strobes and echo fringe are drawn by the grade pass too, so they need it
    // even with no film look.
    if (!transparent && (grade || (strobe && strobe.config.pattern !== "off") || (echo && echo.amount > 0))) {
      try {
        gradeCanvas = new OffscreenCanvas(width, height);
        // preserveDrawingBuffer keeps the frame readable when the encoder samples it.
        const gl = gradeCanvas.getContext("webgl", { alpha: false, preserveDrawingBuffer: true, antialias: false });
        if (!gl) throw new Error("no webgl");
        gl.viewport(0, 0, width, height);
        gradePass = createGradePass(gl);
      } catch {
        throw new Error("This device cannot reproduce the selected grade or time-based effects. Disable those effects or choose a compatible renderer before exporting.");
      }
    }
    const encodeCanvas = gradePass && gradeCanvas ? gradeCanvas : canvas;

    const assetReaders = new Map<string, { sink: VideoSampleSink; duration: number }>();
    // Intrinsic sizes/durations the frame model needs to lay out every layer.
    const compositorAssets: CompositorAsset[] = [];
    // Selecting/cutting the main source creates ordinary __main__ timeline
    // clips. Register it just like bin footage, including in nested comps.
    if (mainInput && mainVideoTrack) {
      const mainDuration = (await mainInput.getDurationFromMetadata([mainVideoTrack])) ?? await mainInput.computeDuration([mainVideoTrack]);
      assetReaders.set(MAIN_SOURCE_ID, { sink: new VideoSampleSink(mainVideoTrack), duration: mainDuration });
      compositorAssets.push({ id: MAIN_SOURCE_ID, kind: "video", width: sourceWidth, height: sourceHeight, duration: mainDuration });
    }
    for (const asset of assets) {
      abortError(signal);
      if (asset.kind === "image") {
        const bitmap = await createImageBitmap(asset.file);
        bitmaps.set(asset.id, bitmap);
        compositorAssets.push({ id: asset.id, kind: "image", width: bitmap.width, height: bitmap.height, duration: Infinity });
        continue;
      }
      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(asset.file) });
      inputs.push(input);
      const track = await input.getPrimaryVideoTrack();
      if (!track) continue;
      const assetDuration = (await input.getDurationFromMetadata([track])) ?? await input.computeDuration([track]);
      assetReaders.set(asset.id, { sink: new VideoSampleSink(track), duration: assetDuration });
      compositorAssets.push({
        id: asset.id,
        kind: "video",
        width: await track.getDisplayWidth(),
        height: await track.getDisplayHeight(),
        duration: assetDuration,
      });
    }

    const fps = frameRate;
    const frameDuration = 1 / fps;
    const frameCount = Math.max(1, Math.ceil(duration * fps));
    if (!outputStream && width * height * frameCount > 1920 * 1080 * 30 * 60 * 20) {
      throw new Error("This render is too large to buffer safely. Use Desktop Pro direct-to-disk export or render a shorter in/out range.");
    }
    const trackMetadata = createRenderTrackMetadata(duration, fps, audioSampleRate);
    const webm = format === "webm-vp9" || format === "webm-vp9-alpha";
    const hasAudio = trackMetadata.audio && (pcmMix || (useMainAudio && audioTrack));
    if (hasAudio && !webm) {
      onProgress?.(0, "Checking AAC audio timing");
      aacOutput = await (await import("./aac-output.ts")).createAacOutput(audioSampleRate!, pcmMix ? 2 : await audioTrack!.getNumberOfChannels(), signal);
    }
    const target = outputStream ? new StreamTarget(timingPatch.wrap(outputStream, signal), { chunked: true }) : new BufferTarget();
    const outputFormat = webm
      ? new WebMOutputFormat({ appendOnly: Boolean(outputStream) })
      : new Mp4OutputFormat({ fastStart: outputStream ? "reserve" : "in-memory", onMoov: timingPatch.onMoov });
    output = new Output({ format: outputFormat, target });
    const videoCodec = webm ? "vp9" : format === "mp4-hevc" ? "hevc" : "avc";
    const videoSource = new CanvasSource(encodeCanvas, {
      codec: videoCodec,
      bitrate: QUALITY_HIGH,
      alpha: format === "webm-vp9-alpha" ? "keep" : "discard",
      hardwareAcceleration,
    });
    output.addVideoTrack(videoSource, trackMetadata.video);
    // Only take on the audio track if we could derive real audio metadata from
    // it. Creating the source off `audioTrack` alone but registering it off
    // `trackMetadata.audio` (null when the sample rate is missing/0/NaN) left an
    // unregistered source that `add()` then threw on — aborting a render that
    // could have gone out video-only. Keep all three conditions in lock-step.
    const audioCodec = webm ? "opus" : "aac";
    const sampleSource = hasAudio && !aacOutput ? new AudioSampleSource({ codec: audioCodec, bitrate: QUALITY_HIGH }) : null;
    const audioSource = aacOutput?.source ?? sampleSource;
    const audioEncoder = aacOutput ?? sampleSource;
    if (audioSource && trackMetadata.audio) output.addAudioTrack(audioSource, trackMetadata.audio);
    await output.start();

    if (pcmMix && audioEncoder) {
      onProgress?.(0.01, "Mixing PCM audio tracks in the background");
      for await (const sample of pcmMix.samples(signal, (progress) => {
        onProgress?.(0.01 + progress * 0.04, `Mixing PCM audio · ${Math.round(progress * 100)}%`);
      })) {
        try {
          await audioEncoder.add(sample);
        } finally {
          sample.close();
        }
      }
    } else if (audioTrack && audioEncoder) {
      onProgress?.(0.03, "Copying soundtrack");
      const sink = new AudioSampleSink(audioTrack);
      for await (const sample of sink.samples(0, duration)) {
        abortError(signal);
        try { await audioEncoder.add(sample); } finally { sample.close(); }
      }
    }

    // Montage plans reference the registered main asset when a source clip was
    // cut or effected; continuous playback is only the no-montage fallback.
    const montage = !transparent && baseCuts.length > 0;
    const mainVideo = mainVideoTrack && !montage && !transparent ? { width: sourceWidth, height: sourceHeight } : null;
    const prepared = prepareFramePlanContext({ assets: compositorAssets, placements, compositions, baseCuts });

    let frameIndex = 0;
    while (frameIndex < frameCount) {
      abortError(signal);
      const outputTime = frameIndex * frameDuration;
      const time = outputTime + timeOffset;

      // What the frame looks like is decided once, by the shared frame model.
      const plan = computeFramePlan({
        time, width, height,
        assets: compositorAssets, prepared,
        placements, compositions, tracks, baseCuts, mainVideo, motion, transition,
        grade: grade ?? null,
        strobe: strobe ?? null,
        stutter: stutter ?? null,
        speed: speed ?? null,
        dropRamp: dropRamp ?? null,
        echo: echo ?? null,
        titles,
        transparent,
      });

      // Resolve each layer to a drawable. Decoding is the only part the renderer
      // does differently from the live preview.
      const openSamples: Array<{ close(): void }> = [];
      // A cross-clip transition can put two base layers on the same sink in one
      // frame (a dissolve where both clips are the same asset). getSample isn't
      // safe to call concurrently on one sink, so calls chain per asset while
      // different assets still decode in parallel.
      const sinkQueue = new Map<string, Promise<unknown>>();
      const sources = await Promise.all(plan.layers.map(async (layer): Promise<FrameSource | null> => {
        const bitmap = bitmaps.get(layer.assetId);
        if (bitmap) return { draw: (ctx, x, y, w, h) => ctx.drawImage(bitmap, x, y, w, h) };
        const reader = assetReaders.get(layer.assetId);
        if (!reader) return null;
        const prior = sinkQueue.get(layer.assetId) ?? Promise.resolve();
        const next = prior.then(() => reader.sink.getSample(layer.sourceTime));
        sinkQueue.set(layer.assetId, next.then(() => undefined, () => undefined));
        const sample = await next;
        if (!sample) return null;
        openSamples.push(sample);
        return { draw: (ctx, x, y, w, h) => sample.draw(ctx, x, y, w, h) };
      }));

      paintFramePlan(context, plan, width, height, frameSourceResolver(plan.layers, sources));
      for (const sample of openSamples) sample.close();

      if (gradePass && plan.grade) gradePass.render(canvas, plan.grade, time * 60);

      await videoSource.add(outputTime, frameDuration, { keyFrame: frameIndex % (fps * 2) === 0 });
      frameIndex++;
      if (frameIndex % 12 === 0 || frameIndex === frameCount) {
        onProgress?.(0.05 + (frameIndex / frameCount) * 0.92, `Rendering frame ${frameIndex.toLocaleString()} of ${frameCount.toLocaleString()}`);
        await yieldToBrowser();
      }
    }

    onProgress?.(0.98, `Finalizing ${webm ? "WebM" : "MP4"}`);
    abortError(signal);
    await aacOutput?.finish();
    abortError(signal);
    await output.finalize();
    onProgress?.(1, "Render complete");
    if (target instanceof BufferTarget) {
      if (!target.buffer) throw new Error("The renderer produced an empty file.");
      if (!webm) timingPatch.apply(target.buffer);
      return new Blob([target.buffer], { type: webm ? "video/webm" : "video/mp4" });
    }
    return null;
  } catch (error) {
    timingPatch.fail(error);
    if (output && output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => undefined);
    if (outputStream && !outputStream.locked) await outputStream.abort(error).catch(() => undefined);
    throw error;
  } finally {
    await aacOutput?.dispose();
    pcmMix?.close();
    gradePass?.dispose();
    for (const bitmap of bitmaps.values()) bitmap.close();
    for (const input of inputs) input.dispose();
  }
}
