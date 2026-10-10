// Browser side of AutoCut analysis: decoding audio, sampling clip frames and
// (optionally) finding faces. The scoring itself is pure and lives in lib/.
import { frameStats } from "../../../lib/analysis-engine";
import { resampleMono } from "../../../lib/autocut-align";
import { profileClip, type ClipProfile, type ClipSample } from "../../../lib/autocut-clips";
import { mixToMono } from "../../../lib/autocut-music";
import type { FaceFinder } from "./faces";

export const ALIGN_RATE = 16000;

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|3gp)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|oga|opus|aif|aiff|weba)$/i;

export function mediaKind(file: File): "video" | "audio" | null {
  if (file.type.startsWith("video/") || VIDEO_EXT.test(file.name)) return "video";
  if (file.type.startsWith("audio/") || AUDIO_EXT.test(file.name)) return "audio";
  return null;
}

/** Every file in a drop, recursing into dropped folders. */
export async function filesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = [...dataTransfer.items]
    .map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (!entries.length) return [...dataTransfer.files];
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries returns batches; keep reading until it returns nothing.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walk(child);
    }
  };
  for (const entry of entries) await walk(entry);
  return out;
}

/** Decode a song (audio file, or the soundtrack of a video) for playback, analysis and export. */
export async function decodeSong(file: File): Promise<AudioBuffer> {
  const context = new AudioContext();
  try {
    try {
      return await context.decodeAudioData(await file.arrayBuffer());
    } catch {
      // Containers the browser's audio decoder rejects: demux with mediabunny.
      const mono = await decodeTrackMono(file, 0);
      if (!mono) throw new Error(`No audio could be decoded from ${file.name}.`);
      const buffer = new AudioBuffer({ length: mono.samples.length, numberOfChannels: 1, sampleRate: mono.sampleRate });
      buffer.copyToChannel(mono.samples as Float32Array<ArrayBuffer>, 0);
      return buffer;
    }
  } finally {
    void context.close();
  }
}

export function bufferToMono(buffer: AudioBuffer): Float32Array {
  return mixToMono(Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index)), buffer.length);
}

/**
 * Decode a file's primary audio track to mono with mediabunny, resampled to
 * `targetRate` (0 keeps the native rate). Streams, so a long take never needs
 * its whole file in an ArrayBuffer. Null when the file has no audio.
 */
export async function decodeTrackMono(file: File, targetRate = ALIGN_RATE, signal?: AbortSignal): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  const { ALL_FORMATS, AudioBufferSink, BlobSource, Input } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    // Place every decoded buffer at its own timestamp (the codec's priming
    // buffer sits before t=0 and is dropped), then resample the whole take in
    // one pass — per-chunk resampling drifts and smears the alignment.
    const chunks: Array<{ at: number; data: Float32Array }> = [];
    let sampleRate = 0;
    let total = 0;
    for await (const wrapped of new AudioBufferSink(track).buffers()) {
      signal?.throwIfAborted();
      sampleRate = wrapped.buffer.sampleRate;
      const mono = bufferToMono(wrapped.buffer);
      const at = Math.round(wrapped.timestamp * sampleRate);
      const skip = Math.max(0, -at);
      if (skip >= mono.length) continue;
      chunks.push({ at: Math.max(0, at), data: skip ? mono.subarray(skip) : mono });
      total = Math.max(total, Math.max(0, at) + mono.length - skip);
    }
    if (!total) return null;
    const native = new Float32Array(total);
    for (const chunk of chunks) native.set(chunk.data.subarray(0, Math.max(0, total - chunk.at)), chunk.at);
    const samples = targetRate ? resampleMono(native, sampleRate, targetRate) : native;
    return { samples, sampleRate: targetRate || sampleRate };
  } finally {
    input.dispose();
  }
}

export type ClipMeta = {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  /** Measured video frame rate (packets per second), when it could be read. */
  frameRate?: number;
  thumbnail: string;
};

const STAT_W = 64;
const STAT_H = 36;
const FACE_W = 320;
const FACE_H = 180;

/**
 * Sample a clip's frames (≈4 per second, at most ~480 samples), measure each
 * with the editor's frameStats, optionally run face detection on a sparse
 * subset, profile the clip and grab a thumbnail of its best moment.
 */
export async function analyzeClip(
  id: string,
  file: File,
  options: { faces?: FaceFinder | null; signal?: AbortSignal; onProgress?: (fraction: number) => void } = {},
): Promise<{ profile: ClipProfile; meta: ClipMeta }> {
  const { ALL_FORMATS, BlobSource, Input, VideoSampleSink } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`${file.name} has no video track.`);
    const duration = (await input.getDurationFromMetadata([track])) ?? await input.computeDuration([track]);
    const width = await track.getDisplayWidth();
    const height = await track.getDisplayHeight();
    const hasAudio = Boolean(await input.getPrimaryAudioTrack());
    const frameRate = await track.computePacketStats(120).then((stats) => stats.averagePacketRate || undefined).catch(() => undefined);
    const sink = new VideoSampleSink(track);
    const interval = Math.max(0.25, duration / 480);
    const timestamps: number[] = [];
    for (let time = 0; time < duration - 0.02; time += interval) timestamps.push(time);
    if (!timestamps.length) timestamps.push(0);

    const stat = document.createElement("canvas");
    stat.width = STAT_W; stat.height = STAT_H;
    const statContext = stat.getContext("2d", { willReadFrequently: true })!;
    const face = document.createElement("canvas");
    face.width = FACE_W; face.height = Math.round(FACE_W * (height / Math.max(1, width))) || FACE_H;
    const faceContext = face.getContext("2d")!;
    const faceStride = Math.max(1, Math.floor(timestamps.length / 24));

    const samples: ClipSample[] = [];
    let previousGray: Uint8Array | undefined;
    let previousHistogram: Float32Array | undefined;
    let index = 0;
    for await (const sample of sink.samplesAtTimestamps(timestamps)) {
      options.signal?.throwIfAborted();
      const time = timestamps[index];
      if (sample) {
        sample.draw(statContext, 0, 0, STAT_W, STAT_H);
        let faces: number | undefined;
        let faceX: number | undefined;
        if (options.faces && index % faceStride === 0) {
          sample.draw(faceContext, 0, 0, face.width, face.height);
          const found = await options.faces.detect(face).catch(() => null);
          if (found) { faces = found.count; faceX = found.centerX ?? undefined; }
        }
        sample.close();
        const stats = frameStats(statContext.getImageData(0, 0, STAT_W, STAT_H).data, previousGray, STAT_W);
        let histogramDistance = 0;
        if (previousHistogram) {
          for (let bin = 0; bin < 16; bin++) histogramDistance += Math.abs(stats.histogram[bin] - previousHistogram[bin]);
          histogramDistance /= 2;
        }
        samples.push({
          time, brightness: stats.brightness, sharpness: stats.sharpness, contrast: stats.contrast,
          motion: previousGray ? stats.difference : 0, histogramDistance, faces, faceX,
        });
        previousGray = stats.gray;
        previousHistogram = stats.histogram;
      }
      index++;
      if (index % 16 === 0) options.onProgress?.(index / timestamps.length);
    }
    const profile = profileClip(id, file.name, duration, samples);

    // Thumbnail: the middle of the best segment (or the clip's middle).
    const best = [...profile.segments].sort((a, b) => b.quality - a.quality)[0];
    const thumbTime = best ? (best.start + best.end) / 2 : duration / 2;
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 160;
    thumbCanvas.height = Math.max(1, Math.round(160 * (height / Math.max(1, width))));
    const thumbSample = await sink.getSample(thumbTime);
    if (thumbSample) {
      thumbSample.draw(thumbCanvas.getContext("2d")!, 0, 0, thumbCanvas.width, thumbCanvas.height);
      thumbSample.close();
    }
    return { profile, meta: { duration, width, height, hasAudio, frameRate, thumbnail: thumbCanvas.toDataURL("image/jpeg", 0.7) } };
  } finally {
    input.dispose();
  }
}
