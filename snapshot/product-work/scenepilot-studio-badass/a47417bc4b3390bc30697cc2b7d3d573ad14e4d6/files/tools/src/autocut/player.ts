// Preview playback: the song plays through Web Audio (the master clock); one
// muted <video> per clip follows it. The upcoming shot's clip is pre-seeked a
// moment before its cut so switches land on the beat. Each animation frame
// draws the active clip, cover-cropped to the chosen aspect, onto the canvas.
import { coverCrop } from "../../../lib/autocut-export";
import { shotAt, type Shot } from "../../../lib/autocut-cut";

export type PreviewClip = { url: string; focusX: number };

export class PreviewPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private offset = 0;
  private videos = new Map<string, HTMLVideoElement>();
  private frame = 0;
  private activeId = "";
  playing = false;
  shots: Shot[] = [];
  clips = new Map<string, PreviewClip>();
  range = { start: 0, end: 0 };
  onTime: (time: number) => void = () => {};
  onEnded: () => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private song: AudioBuffer) {}

  get time() {
    return this.playing && this.context ? this.offset + (this.context.currentTime - this.startedAt) : this.offset;
  }

  private video(clipId: string) {
    let video = this.videos.get(clipId);
    const clip = this.clips.get(clipId);
    if (!video && clip) {
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = clip.url;
      this.videos.set(clipId, video);
    }
    return video;
  }

  private sourceTime(shot: Shot, time: number) {
    return Math.max(0, shot.sourceStart + (time - shot.start));
  }

  async play() {
    if (this.playing) return;
    if (this.offset >= this.range.end - 0.05) this.offset = this.range.start;
    this.context ??= new AudioContext();
    await this.context.resume();
    const node = this.context.createBufferSource();
    node.buffer = this.song;
    node.connect(this.context.destination);
    this.startedAt = this.context.currentTime + 0.05;
    node.start(this.startedAt, this.offset, Math.max(0.01, this.range.end - this.offset));
    this.source = node;
    this.playing = true;
    this.activeId = "";
    this.tick();
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.time;
    this.playing = false;
    try { this.source?.stop(); } catch { /* already stopped */ }
    this.source = null;
    cancelAnimationFrame(this.frame);
    for (const video of this.videos.values()) video.pause();
  }

  async seek(time: number) {
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.offset = Math.min(this.range.end, Math.max(this.range.start, time));
    this.onTime(this.offset);
    if (wasPlaying) await this.play();
    else await this.drawStill();
  }

  /** Draw the frame at the playhead while paused (seek, then paint on `seeked`). */
  async drawStill() {
    const shot = shotAt(this.shots, this.offset);
    if (!shot) { this.clear(); return; }
    const video = this.video(shot.clipId);
    if (!video) return;
    const target = this.sourceTime(shot, this.offset);
    if (video.readyState < 1) await new Promise((resolve) => video.addEventListener("loadedmetadata", resolve, { once: true }));
    if (Math.abs(video.currentTime - target) > 0.02) {
      await new Promise<void>((resolve) => {
        const done = () => { video.removeEventListener("seeked", done); resolve(); };
        video.addEventListener("seeked", done);
        video.currentTime = target;
        window.setTimeout(done, 1500);
      });
    }
    this.paint(video, shot.clipId);
  }

  private clear() {
    const context = this.canvas.getContext("2d")!;
    context.fillStyle = "#000";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private paint(video: HTMLVideoElement, clipId: string) {
    const context = this.canvas.getContext("2d")!;
    if (!video.videoWidth) { this.clear(); return; }
    const crop = coverCrop(video.videoWidth, video.videoHeight, this.canvas.width, this.canvas.height, this.clips.get(clipId)?.focusX ?? 0.5);
    context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, this.canvas.width, this.canvas.height);
  }

  private tick = () => {
    if (!this.playing) return;
    const time = this.time;
    if (time >= this.range.end) {
      this.pause();
      this.offset = this.range.end;
      this.onTime(this.offset);
      this.onEnded();
      return;
    }
    const shot = shotAt(this.shots, time);
    if (shot) {
      const video = this.video(shot.clipId);
      if (video) {
        const target = this.sourceTime(shot, time);
        if (this.activeId !== shot.id) {
          for (const [id, other] of this.videos) if (id !== shot.clipId) other.pause();
          if (Math.abs(video.currentTime - target) > 0.06) video.currentTime = target;
          void video.play().catch(() => undefined);
          this.activeId = shot.id;
        } else if (Math.abs(video.currentTime - target) > 0.25) {
          video.currentTime = target; // drifted (slow decode): resync to the music
        }
        this.paint(video, shot.clipId);
      }
      // Pre-seek the next shot's clip so its first frame is ready on the cut.
      const index = this.shots.indexOf(shot);
      const next = this.shots[index + 1];
      if (next && next.clipId !== shot.clipId && next.start - time < 0.6) {
        const nextVideo = this.video(next.clipId);
        if (nextVideo && nextVideo.paused && Math.abs(nextVideo.currentTime - next.sourceStart) > 0.05 && !nextVideo.seeking) nextVideo.currentTime = next.sourceStart;
      }
    } else {
      this.clear();
    }
    this.onTime(time);
    this.frame = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.pause();
    for (const video of this.videos.values()) { video.removeAttribute("src"); video.load(); }
    this.videos.clear();
    void this.context?.close();
  }
}
