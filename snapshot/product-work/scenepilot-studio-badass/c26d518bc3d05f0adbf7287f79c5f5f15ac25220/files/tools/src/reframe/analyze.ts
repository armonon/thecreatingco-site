// Reframe analysis: decode the source clip, sample frames, run face
// detection (AutoCut's self-hosted BlazeFace) with a motion-saliency fallback
// when no face is found, detect scene cuts, and build the smooth virtual
// camera path. All the actual math (dead zone, speed cap, ease, cut reset,
// crop geometry, multi-subject pick, motion centroid) lives in lib/ and is
// unit tested there; this file is just the browser-side glue that samples
// frames and feeds it.
import { frameStats } from "../../../lib/analysis-engine.ts";
import { detectSceneCuts, type ClipSample } from "../../../lib/autocut-clips.ts";
import type { SubjectTarget } from "../../../lib/reframe-path.ts";
import { motionCentroid, pickSubjectTarget } from "../../../lib/reframe-subjects.ts";
import type { FaceFinder } from "../autocut/faces.ts";

const SAMPLE_RATE_HZ = 6; // subject-tracking samples per second; plenty for a smoothed path
const STAT_W = 64;
const STAT_H = 36;
const FACE_W = 320;

export type AnalysisProgress = { fraction: number; message: string };

export type AnalysisResult = {
  duration: number;
  width: number;
  height: number;
  cutTimes: number[];
  /** Raw per-sample subject targets (not yet smoothed) — the caller builds the camera path with its own dead-zone/speed/ease settings via lib/reframe-path's buildCameraPath, so changing those settings doesn't require re-analysing the video. */
  targets: SubjectTarget[];
  /** Fraction of sampled frames where a face (or a kept-together pair) drove the target, vs. motion-saliency fallback. */
  faceCoverage: number;
  usedFaces: boolean;
};

export async function analyzeVideo(
  file: File,
  options: { faces: FaceFinder | null; onProgress?: (progress: AnalysisProgress) => void; signal?: AbortSignal },
): Promise<AnalysisResult> {
  const { ALL_FORMATS, BlobSource, Input, VideoSampleSink } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`${file.name} has no video track.`);
    const duration = (await input.getDurationFromMetadata([track])) ?? (await input.computeDuration([track]));
    const width = await track.getDisplayWidth();
    const height = await track.getDisplayHeight();
    const sink = new VideoSampleSink(track);

    const interval = 1 / SAMPLE_RATE_HZ;
    const timestamps: number[] = [];
    for (let time = 0; time < duration - 0.02; time += interval) timestamps.push(time);
    if (!timestamps.length) timestamps.push(0);

    const stat = document.createElement("canvas");
    stat.width = STAT_W;
    stat.height = STAT_H;
    const statContext = stat.getContext("2d", { willReadFrequently: true })!;
    const face = document.createElement("canvas");
    face.width = FACE_W;
    face.height = Math.round(FACE_W * (height / Math.max(1, width))) || FACE_W;
    const faceContext = face.getContext("2d")!;

    const samples: ClipSample[] = [];
    const targets: SubjectTarget[] = [];
    let previousGray: Uint8Array | undefined;
    let previousHistogram: Float32Array | undefined;
    let previousSmallGray: Uint8Array | undefined;
    let faceHits = 0;
    let index = 0;

    for await (const sample of sink.samplesAtTimestamps(timestamps)) {
      options.signal?.throwIfAborted();
      const time = timestamps[index];
      if (sample) {
        sample.draw(statContext, 0, 0, STAT_W, STAT_H);
        const imageData = statContext.getImageData(0, 0, STAT_W, STAT_H);
        const stats = frameStats(imageData.data, previousGray, STAT_W);
        let histogramDistance = 0;
        if (previousHistogram) {
          for (let bin = 0; bin < 16; bin++) histogramDistance += Math.abs(stats.histogram[bin] - previousHistogram[bin]);
          histogramDistance /= 2;
        }
        samples.push({ time, brightness: stats.brightness, sharpness: stats.sharpness, contrast: stats.contrast, motion: previousGray ? stats.difference : 0, histogramDistance });

        // Subject target: a face (or kept-together pair) when available, else motion saliency against the small gray buffer.
        let target: SubjectTarget | null = null;
        if (options.faces) {
          sample.draw(faceContext, 0, 0, face.width, face.height);
          const found = await options.faces.detect(face).catch(() => null);
          if (found && found.count > 0) {
            // Multi-subject mode: keep two faces in frame when a 9:16 crop (~0.56 of
            // frame width) can fit their span; otherwise follow the larger/active one.
            const pick = pickSubjectTarget(found.all, 0.56, 0.1);
            if (pick) {
              target = { time, x: pick.x, y: pick.y, weight: 1 };
              faceHits++;
            }
          }
        }
        if (!target) {
          const smallGray = downsampleGray(stats.gray, STAT_W, STAT_H, 24, 14);
          if (previousSmallGray) {
            const motionTarget = motionCentroid(previousSmallGray, smallGray, 24, 14);
            if (motionTarget) target = { time, x: motionTarget.x, y: motionTarget.y, weight: motionTarget.weight * 0.6 };
          }
          previousSmallGray = smallGray;
        }
        targets.push(target ?? { time, x: 0.5, y: 0.5, weight: 0 });

        previousGray = stats.gray;
        previousHistogram = stats.histogram;
        sample.close();
      }
      index++;
      if (index % 6 === 0) options.onProgress?.({ fraction: index / timestamps.length, message: "Finding the subject" });
    }

    const cutTimes = detectSceneCuts(samples);
    options.onProgress?.({ fraction: 0.97, message: "Detecting scene cuts" });
    return { duration, width, height, cutTimes, targets, faceCoverage: targets.length ? faceHits / targets.length : 0, usedFaces: faceHits > 0 };
  } finally {
    input.dispose();
  }
}

/** Nearest-sample downscale of a tightly-packed grayscale buffer, for the cheap motion-saliency map. */
function downsampleGray(gray: Uint8Array, width: number, height: number, outWidth: number, outHeight: number): Uint8Array {
  const out = new Uint8Array(outWidth * outHeight);
  for (let y = 0; y < outHeight; y++) {
    const sourceY = Math.min(height - 1, Math.floor((y / outHeight) * height));
    for (let x = 0; x < outWidth; x++) {
      const sourceX = Math.min(width - 1, Math.floor((x / outWidth) * width));
      out[y * outWidth + x] = gray[sourceY * width + sourceX];
    }
  }
  return out;
}
