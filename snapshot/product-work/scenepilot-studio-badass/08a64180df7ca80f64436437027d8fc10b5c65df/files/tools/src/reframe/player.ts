// Reframe preview: a single <video> (it has its own audio, so no separate Web
// Audio clock is needed, unlike AutoCut's multi-clip player) drives two
// canvases every animation frame — the source with the live crop window drawn
// on it, and the actual cropped (or letterboxed) result at the output aspect.
import { cropBounds, letterboxRect, type ReframeAspectId } from "../../../lib/reframe-crop.ts";
import { pathAt, type PathPoint } from "../../../lib/reframe-path.ts";

export type LetterboxSegment = { start: number; end: number };

export function isLetterboxed(segments: LetterboxSegment[], time: number): boolean {
  return segments.some((segment) => time >= segment.start && time < segment.end);
}

export class ReframePlayer {
  readonly video: HTMLVideoElement;
  path: PathPoint[] = [];
  aspect: ReframeAspectId = "9:16";
  letterboxSegments: LetterboxSegment[] = [];
  playing = false;
  onTime: (time: number) => void = () => {};
  onEnded: () => void = () => {};
  private frame = 0;
  private loadGeneration = 0;
  private objectUrl: string | null = null;
  private pendingLoad: { cleanup: () => void; reject: (error: Error) => void } | null = null;
  private sourceCanvas: HTMLCanvasElement;
  private outputCanvas: HTMLCanvasElement;

  constructor(sourceCanvas: HTMLCanvasElement, outputCanvas: HTMLCanvasElement) {
    this.sourceCanvas = sourceCanvas;
    this.outputCanvas = outputCanvas;
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.addEventListener("ended", () => { this.playing = false; this.onEnded(); });
  }

  async load(file: File): Promise<void> {
    const generation = ++this.loadGeneration;
    this.pause();
    this.cancelPendingLoad();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.video.src = this.objectUrl;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        this.video.removeEventListener("loadedmetadata", loaded);
        this.video.removeEventListener("error", failed);
        if (this.pendingLoad?.cleanup === cleanup) this.pendingLoad = null;
      };
      const loaded = () => { if (settled) return; settled = true; cleanup(); resolve(); };
      const failed = () => { if (settled) return; settled = true; cleanup(); reject(new Error("The browser couldn't decode this video for preview.")); };
      const cancel = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      this.pendingLoad = { cleanup, reject: cancel };
      this.video.addEventListener("loadedmetadata", loaded, { once: true });
      this.video.addEventListener("error", failed, { once: true });
    });
    if (generation !== this.loadGeneration) return;
    await this.drawStill();
  }

  async play() {
    if (this.playing) return;
    await this.video.play();
    this.playing = true;
    this.tick();
  }

  pause() {
    this.playing = false;
    this.video.pause();
    cancelAnimationFrame(this.frame);
  }

  async seek(time: number) {
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    await new Promise<void>((resolve) => {
      const done = () => { this.video.removeEventListener("seeked", done); resolve(); };
      this.video.addEventListener("seeked", done);
      this.video.currentTime = Math.min(this.video.duration || time, Math.max(0, time));
      window.setTimeout(done, 1000);
    });
    this.onTime(this.video.currentTime);
    await this.drawStill();
    if (wasPlaying) await this.play();
  }

  async drawStill() {
    this.draw();
  }

  private tick = () => {
    if (!this.playing) return;
    this.draw();
    this.onTime(this.video.currentTime);
    this.frame = requestAnimationFrame(this.tick);
  };

  private draw() {
    const video = this.video;
    if (!video.videoWidth) return;
    const time = video.currentTime;
    const letterboxed = isLetterboxed(this.letterboxSegments, time);
    const { x: centerX, y: centerY } = pathAt(this.path, time);

    // Source canvas: the full frame, scaled to fit, with the crop window drawn on it.
    const source = this.sourceCanvas.getContext("2d")!;
    const scale = Math.min(this.sourceCanvas.width / video.videoWidth, this.sourceCanvas.height / video.videoHeight);
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    const offsetX = (this.sourceCanvas.width - drawWidth) / 2;
    const offsetY = (this.sourceCanvas.height - drawHeight) / 2;
    source.fillStyle = "#000";
    source.fillRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    source.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    if (!letterboxed) {
      const crop = cropBounds(video.videoWidth, video.videoHeight, this.aspect, centerX, centerY);
      source.strokeStyle = "#5ce3a8";
      source.lineWidth = 2;
      source.strokeRect(offsetX + crop.x * scale, offsetY + crop.y * scale, crop.width * scale, crop.height * scale);
    } else {
      source.strokeStyle = "#f4c96b";
      source.lineWidth = 2;
      source.strokeRect(offsetX + 1, offsetY + 1, drawWidth - 2, drawHeight - 2);
    }

    // Output canvas: the actual export framing at the chosen aspect.
    const output = this.outputCanvas.getContext("2d")!;
    output.fillStyle = "#000";
    output.fillRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    if (letterboxed) {
      const rect = letterboxRect(video.videoWidth, video.videoHeight, this.outputCanvas.width, this.outputCanvas.height);
      output.drawImage(video, rect.x, rect.y, rect.width, rect.height);
    } else {
      const crop = cropBounds(video.videoWidth, video.videoHeight, this.aspect, centerX, centerY);
      output.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, this.outputCanvas.width, this.outputCanvas.height);
    }
  }

  dispose() {
    this.loadGeneration++;
    this.cancelPendingLoad();
    this.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.video.removeAttribute("src");
    this.video.load();
  }

  private cancelPendingLoad() {
    this.pendingLoad?.reject(new Error("Preview load was superseded."));
  }
}
