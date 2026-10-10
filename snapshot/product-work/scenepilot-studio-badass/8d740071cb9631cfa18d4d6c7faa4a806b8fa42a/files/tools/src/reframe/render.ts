// Reframe export. Faster-than-real-time path first: WebCodecs via mediabunny
// (MPL-2.0, already the editor's media engine) decodes the source in order
// and re-encodes each frame cropped (or letterboxed) to the chosen aspect,
// MP4 (H.264/AAC) where the browser can encode it, otherwise WebM. When this
// browser has no WebCodecs video+audio encoder at all, falls back to a
// real-time capture: play the source, draw each frame to a canvas, and record
// canvas.captureStream() + the video's own audio with MediaRecorder.
import { cropBounds, letterboxRect, outputSize, type ReframeAspectId } from "../../../lib/reframe-crop.ts";
import { pathAt, type PathPoint } from "../../../lib/reframe-path.ts";
import { isLetterboxed, type LetterboxSegment } from "./player.ts";

export type RenderOptions = {
  file: File;
  path: PathPoint[];
  aspect: ReframeAspectId;
  letterboxSegments: LetterboxSegment[];
  longSide?: number;
  fps?: number;
  onProgress?: (fraction: number, message: string) => void;
  signal?: AbortSignal;
};

export type RenderResult = { blob: Blob; extension: "mp4" | "webm"; mime: string; method: "webcodecs" | "mediarecorder"; codec: string; seconds: number };

type Plan = { container: "mp4" | "webm"; video: "avc" | "vp9" | "vp8"; audio: "aac" | "opus" };

async function pickEncoding(width: number, height: number): Promise<Plan | null> {
  const { canEncodeAudio, canEncodeVideo } = await import("mediabunny");
  const plans: Plan[] = [
    { container: "mp4", video: "avc", audio: "aac" },
    { container: "webm", video: "vp9", audio: "opus" },
    { container: "webm", video: "vp8", audio: "opus" },
  ];
  for (const plan of plans) {
    try {
      if ((await canEncodeVideo(plan.video, { width, height })) && (await canEncodeAudio(plan.audio, { numberOfChannels: 2, sampleRate: 48000 }))) return plan;
    } catch { /* try the next */ }
  }
  return null;
}

function frameRect(sourceWidth: number, sourceHeight: number, aspect: ReframeAspectId, letterboxSegments: LetterboxSegment[], path: PathPoint[], outWidth: number, outHeight: number, time: number) {
  if (isLetterboxed(letterboxSegments, time)) return { rect: letterboxRect(sourceWidth, sourceHeight, outWidth, outHeight), letterboxed: true };
  const { x, y } = pathAt(path, time);
  return { rect: cropBounds(sourceWidth, sourceHeight, aspect, x, y), letterboxed: false };
}

export async function renderReframe(options: RenderOptions): Promise<RenderResult> {
  const started = performance.now();
  const { width, height } = outputSize(options.aspect, options.longSide ?? 1080);
  const plan = await pickEncoding(width, height);
  if (plan) return renderWithWebCodecs(options, plan, width, height, started);
  return renderWithMediaRecorder(options, width, height, started);
}

async function renderWithWebCodecs(options: RenderOptions, plan: Plan, width: number, height: number, started: number): Promise<RenderResult> {
  const { ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, CanvasSource, Input, Mp4OutputFormat, Output, VideoSampleSink, WebMOutputFormat } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(options.file) });
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("No video track to export.");
    const duration = (await input.getDurationFromMetadata([videoTrack])) ?? (await input.computeDuration([videoTrack]));
    const sourceWidth = await videoTrack.getDisplayWidth();
    const sourceHeight = await videoTrack.getDisplayHeight();
    const fps = options.fps ?? 30;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false })!;
    context.imageSmoothingQuality = "high";

    const target = new BufferTarget();
    const output = new Output({ format: plan.container === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target });
    const bitrate = Math.round(Math.min(12e6, Math.max(2e6, width * height * fps * 0.1)));
    const videoSource = new CanvasSource(canvas, { codec: plan.video, bitrate });
    output.addVideoTrack(videoSource, { frameRate: fps });

    const audioTrack = await input.getPrimaryAudioTrack();
    const audioSource = audioTrack ? new AudioBufferSource({ codec: plan.audio, bitrate: 192_000 }) : null;
    if (audioSource) output.addAudioTrack(audioSource);

    await output.start();
    if (audioSource && audioTrack) {
      options.onProgress?.(0.01, "Encoding the soundtrack");
      const audioContext = new AudioContext();
      try {
        const buffer = await audioContext.decodeAudioData(await options.file.arrayBuffer()).catch(() => null);
        if (buffer) await audioSource.add(buffer);
      } finally {
        void audioContext.close();
      }
      audioSource.close();
    }

    const sink = new VideoSampleSink(videoTrack);
    const frameCount = Math.max(1, Math.round(duration * fps));
    const timestamps = Array.from({ length: frameCount }, (_, index) => index / fps);
    let index = 0;
    for await (const sample of sink.samplesAtTimestamps(timestamps)) {
      options.signal?.throwIfAborted();
      const outTime = timestamps[index];
      if (sample) {
        const { rect, letterboxed } = frameRect(sourceWidth, sourceHeight, options.aspect, options.letterboxSegments, options.path, width, height, outTime);
        context.fillStyle = "#000";
        context.fillRect(0, 0, width, height);
        if (letterboxed) sample.draw(context, 0, 0, sourceWidth, sourceHeight, rect.x, rect.y, rect.width, rect.height);
        else sample.draw(context, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
        sample.close();
      }
      await videoSource.add(outTime, 1 / fps, { keyFrame: index === 0 || index % (fps * 2) === 0 });
      index++;
      if (index % 15 === 0) options.onProgress?.(0.03 + 0.95 * (index / frameCount), `Rendering frame ${index} of ${frameCount}`);
    }
    videoSource.close();
    options.onProgress?.(0.99, "Finalising the file");
    await output.finalize();
    if (!target.buffer) throw new Error("The encoder produced an empty file.");
    const mime = plan.container === "mp4" ? "video/mp4" : "video/webm";
    return { blob: new Blob([target.buffer], { type: mime }), extension: plan.container, mime, method: "webcodecs", codec: `${plan.video.toUpperCase()} + ${plan.audio.toUpperCase()}`, seconds: (performance.now() - started) / 1000 };
  } finally {
    input.dispose();
  }
}

/**
 * Real-time fallback for browsers with no WebCodecs encoder: play the source
 * video, draw each frame cropped/letterboxed to a canvas, capture the canvas
 * as a MediaStream, mix in the video's own audio via Web Audio, and record
 * with MediaRecorder. Takes as long as the clip itself (the tab must stay
 * visible/foregrounded), and always produces WebM — no MediaRecorder browser
 * reliably writes MP4 today.
 */
async function renderWithMediaRecorder(options: RenderOptions, width: number, height: number, started: number): Promise<RenderResult> {
  if (typeof MediaRecorder === "undefined") throw new Error("This browser supports neither WebCodecs nor MediaRecorder video export.");
  const video = document.createElement("video");
  video.src = URL.createObjectURL(options.file);
  video.muted = false;
  video.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("The browser couldn't decode this video.")), { once: true });
  });
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const duration = video.duration;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false })!;

  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaElementSource(video);
  const destination = audioContext.createMediaStreamDestination();
  sourceNode.connect(destination);
  // Keep audio out of the device speakers while recording (it still reaches the recorder via destination).

  const canvasStream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(options.fps ?? 30);
  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
  const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: Math.round(Math.min(12e6, Math.max(2e6, width * height * 0.3))) });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };

  const finished = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start(250);

  let raf = 0;
  const drawFrame = () => {
    const time = video.currentTime;
    const { rect, letterboxed } = frameRect(sourceWidth, sourceHeight, options.aspect, options.letterboxSegments, options.path, width, height, time);
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    if (letterboxed) context.drawImage(video, rect.x, rect.y, rect.width, rect.height);
    else context.drawImage(video, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
    options.onProgress?.(Math.min(0.99, time / Math.max(0.1, duration)), `Recording ${time.toFixed(1)}s of ${duration.toFixed(1)}s`);
    if (!video.ended && !video.paused) raf = requestAnimationFrame(drawFrame);
  };

  try {
    await video.play();
    drawFrame();
    await new Promise<void>((resolve) => video.addEventListener("ended", () => resolve(), { once: true }));
  } finally {
    cancelAnimationFrame(raf);
    recorder.stop();
    await finished;
    video.pause();
    URL.revokeObjectURL(video.src);
    void audioContext.close();
  }
  return { blob: new Blob(chunks, { type: mimeType }), extension: "webm", mime: mimeType, method: "mediarecorder", codec: mimeType, seconds: (performance.now() - started) / 1000 };
}

/** The crop/letterbox path as portable JSON, independent of any particular export. */
export function pathToJson(options: { fileName: string; width: number; height: number; duration: number; aspect: ReframeAspectId; path: PathPoint[]; cutTimes: number[]; letterboxSegments: LetterboxSegment[] }) {
  return {
    format: "scenepilot.reframe.v1",
    source: { name: options.fileName, width: options.width, height: options.height, duration: options.duration },
    aspect: options.aspect,
    cutTimes: options.cutTimes,
    letterboxSegments: options.letterboxSegments,
    keyframes: options.path.map((point) => ({ time: point.time, x: point.x, y: point.y, cut: point.cut })),
  };
}
