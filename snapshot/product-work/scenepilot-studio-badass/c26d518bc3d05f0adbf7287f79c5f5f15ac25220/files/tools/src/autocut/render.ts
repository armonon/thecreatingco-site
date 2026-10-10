// AutoCut export. Faster-than-real-time where the browser has WebCodecs
// encoders (via mediabunny, MPL-2.0, already the editor's media engine):
// each shot's source frames are decoded in order, cover-cropped to the output
// aspect (centred on a detected face when there is one), and encoded with the
// song as the soundtrack. MP4 (H.264 + AAC) first, WebM (VP9/VP8 + Opus) when
// the browser can't encode MP4.
import { coverCrop, outputSize, type AspectId } from "../../../lib/autocut-export";
import type { Shot } from "../../../lib/autocut-cut";

export type RenderClip = { file: File; focusX: number };

export type RenderOptions = {
  shots: Shot[];
  clips: Map<string, RenderClip>;
  song: AudioBuffer;
  range: { start: number; end: number };
  aspect: AspectId;
  /** 1 = full HD long side, 0.5 = draft. */
  scale: number;
  fps?: number;
  onProgress?: (fraction: number, message: string) => void;
  signal?: AbortSignal;
};

export type RenderResult = { blob: Blob; extension: "mp4" | "webm"; mime: string; codec: string; seconds: number };

type Plan = { container: "mp4" | "webm"; video: "avc" | "vp9" | "vp8"; audio: "aac" | "opus" };

export async function pickEncoding(width: number, height: number): Promise<Plan | null> {
  const { canEncodeAudio, canEncodeVideo } = await import("mediabunny");
  const plans: Plan[] = [
    { container: "mp4", video: "avc", audio: "aac" },
    { container: "webm", video: "vp9", audio: "opus" },
    { container: "webm", video: "vp8", audio: "opus" },
  ];
  for (const plan of plans) {
    try {
      if (await canEncodeVideo(plan.video, { width, height }) && await canEncodeAudio(plan.audio, { numberOfChannels: 2, sampleRate: 48000 })) return plan;
    } catch { /* try the next */ }
  }
  return null;
}

/** The song between `start` and `end`, with 15 ms edge fades when it's an excerpt. */
export function sliceSong(song: AudioBuffer, start: number, end: number): AudioBuffer {
  const from = Math.max(0, Math.floor(start * song.sampleRate));
  const to = Math.min(song.length, Math.ceil(end * song.sampleRate));
  const length = Math.max(1, to - from);
  const channels = Math.min(2, song.numberOfChannels);
  const out = new AudioBuffer({ length, numberOfChannels: channels, sampleRate: song.sampleRate });
  const fade = Math.round(0.015 * song.sampleRate);
  for (let channel = 0; channel < channels; channel++) {
    const data = song.getChannelData(channel).slice(from, to);
    if (from > 0) for (let i = 0; i < Math.min(fade, data.length); i++) data[i] *= i / fade;
    if (to < song.length) for (let i = 0; i < Math.min(fade, data.length); i++) data[data.length - 1 - i] *= i / fade;
    out.copyToChannel(data, channel);
  }
  return out;
}

export async function renderCut(options: RenderOptions): Promise<RenderResult> {
  const started = performance.now();
  const fps = options.fps ?? 30;
  const { width, height } = outputSize(options.aspect, options.scale);
  const plan = await pickEncoding(width, height);
  if (!plan) throw new Error("This browser can't encode video with WebCodecs. Use a current Chrome, Edge or Safari, or export the ScenePilot project and render in the editor.");
  const { ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, CanvasSource, Input, Mp4OutputFormat, Output, VideoSampleSink, WebMOutputFormat } = await import("mediabunny");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false })!;
  context.imageSmoothingQuality = "high";

  const target = new BufferTarget();
  const output = new Output({ format: plan.container === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target });
  const bitrate = Math.round(Math.min(12e6, Math.max(2e6, width * height * fps * 0.1)));
  const videoSource = new CanvasSource(canvas, { codec: plan.video, bitrate });
  const audioSource = new AudioBufferSource({ codec: plan.audio, bitrate: 192_000 });
  output.addVideoTrack(videoSource, { frameRate: fps });
  output.addAudioTrack(audioSource);

  const inputs = new Map<string, { input: InstanceType<typeof Input>; sink: InstanceType<typeof VideoSampleSink>; width: number; height: number }>();
  const reader = async (clipId: string) => {
    const existing = inputs.get(clipId);
    if (existing) return existing;
    const clip = options.clips.get(clipId);
    if (!clip) return null;
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(clip.file) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) { input.dispose(); return null; }
    const entry = { input, sink: new VideoSampleSink(track), width: await track.getDisplayWidth(), height: await track.getDisplayHeight() };
    inputs.set(clipId, entry);
    return entry;
  };

  try {
    await output.start();
    options.onProgress?.(0.01, "Encoding the soundtrack");
    await audioSource.add(sliceSong(options.song, options.range.start, options.range.end));
    audioSource.close();

    const total = options.range.end - options.range.start;
    const frameCount = Math.max(1, Math.round(total * fps));
    const shots = options.shots.filter((shot) => shot.start + shot.duration > options.range.start + 1e-6 && shot.start < options.range.end - 1e-6);
    let frame = 0;
    for (const shot of shots) {
      options.signal?.throwIfAborted();
      const shotEnd = Math.min(options.range.end, shot.start + shot.duration);
      const times: number[] = [];
      const outTimes: number[] = [];
      while (frame < frameCount) {
        const outTime = frame / fps;
        const songTime = options.range.start + outTime;
        if (songTime >= shotEnd - 1e-6 && shot !== shots[shots.length - 1]) break;
        outTimes.push(outTime);
        times.push(Math.max(0, shot.sourceStart + (songTime - shot.start)));
        frame++;
      }
      if (!times.length) continue;
      const source = await reader(shot.clipId);
      const focusX = options.clips.get(shot.clipId)?.focusX ?? 0.5;
      const crop = source ? coverCrop(source.width, source.height, width, height, focusX) : null;
      let index = 0;
      let last: { close(): void } | null = null;
      const draw = async (sample: Awaited<ReturnType<InstanceType<typeof VideoSampleSink>["getSample"]>> | null) => {
        if (sample && crop) {
          context.fillStyle = "#000";
          context.fillRect(0, 0, width, height);
          sample.draw(context, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
          // A repeated frame can come back as the same sample; only close real replacements.
          if (last && last !== sample) last.close();
          last = sample;
        } else if (!last) {
          context.fillStyle = "#000";
          context.fillRect(0, 0, width, height);
        }
        await videoSource.add(outTimes[index], 1 / fps, { keyFrame: index === 0 || Math.round(outTimes[index] * fps) % (fps * 2) === 0 });
        index++;
        if ((frame - times.length + index) % 15 === 0) {
          options.onProgress?.(0.03 + 0.95 * ((frame - times.length + index) / frameCount), `Rendering frame ${frame - times.length + index} of ${frameCount}`);
        }
      };
      if (source) {
        for await (const sample of source.sink.samplesAtTimestamps(times)) {
          options.signal?.throwIfAborted();
          await draw(sample);
        }
      }
      while (index < times.length) await draw(null);
      (last as { close(): void } | null)?.close();
    }
    videoSource.close();
    options.onProgress?.(0.99, "Finalising the file");
    await output.finalize();
    if (!target.buffer) throw new Error("The encoder produced an empty file.");
    const mime = plan.container === "mp4" ? "video/mp4" : "video/webm";
    return { blob: new Blob([target.buffer], { type: mime }), extension: plan.container, mime, codec: `${plan.video.toUpperCase()} + ${plan.audio.toUpperCase()}`, seconds: (performance.now() - started) / 1000 };
  } catch (error) {
    if (output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    for (const entry of inputs.values()) entry.input.dispose();
  }
}
