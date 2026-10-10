// On-device face detection for AutoCut, on by default: MediaPipe Tasks Vision
// (Apache-2.0, already an editor dependency) running Google's BlazeFace
// short-range model (Apache-2.0 per the MediaPipe model card, ~230 KB). The
// model is self-hosted with the tools (/tools/models/, see NOTICE.txt there);
// Google's public model bucket is only a fallback. Frames never leave the device.
// The WASM runtime is the one the site already serves for the editor
// (/app/mediapipe/wasm), with the matching jsDelivr build as a dev fallback.
// If nothing loads, createFaceFinder rejects and AutoCut cuts without faces.

export type FaceResult = {
  count: number;
  centerX: number | null;
  /** Every detected face, normalized to the canvas (0..1): center x/y and `size` = max(width, height) / canvas width. Reframe's multi-subject mode uses this; AutoCut only reads `count`/`centerX`. */
  all: Array<{ x: number; y: number; size: number }>;
};
export type FaceFinder = { detect(canvas: HTMLCanvasElement): Promise<FaceResult>; close(): void };

/** Self-hosted copy (tools/public/models → site/tools/models), resolved against the page. */
export const FACE_MODEL_PATH = "models/blaze_face_short_range.tflite";
/** Upstream copy, used only if the self-hosted file can't be fetched. */
export const FACE_MODEL_FALLBACK_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

function modelUrls(): string[] {
  // Tool pages live at /tools/<tool>/, so the tools root is one level up.
  return [new URL(`../${FACE_MODEL_PATH}`, document.baseURI).toString(), FACE_MODEL_FALLBACK_URL];
}
const TASKS_VERSION = "1.0.1"; // keep in step with package.json

async function wasmBase(): Promise<string> {
  const local = new URL("../../app/mediapipe/wasm", document.baseURI).toString();
  try {
    const response = await fetch(`${local}/vision_wasm_internal.js`, { method: "HEAD" });
    if (response.ok && /javascript/.test(response.headers.get("content-type") ?? "")) return local;
  } catch { /* fall through */ }
  return `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
}

export async function createFaceFinder(): Promise<FaceFinder> {
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(await wasmBase());
  const create = (modelAssetPath: string, delegate: "GPU" | "CPU") => FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath, delegate },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.55,
  });
  let detector: Awaited<ReturnType<typeof create>> | null = null;
  let lastError: unknown = null;
  for (const url of modelUrls()) {
    detector = await create(url, "GPU").catch(() => create(url, "CPU")).catch((error) => { lastError = error; return null; });
    if (detector) break;
  }
  if (!detector) throw lastError instanceof Error ? lastError : new Error("Face model unavailable.");
  const ready = detector;
  return {
    async detect(canvas) {
      const result = ready.detect(canvas);
      const boxes = result.detections.map((detection) => detection.boundingBox).filter((box): box is NonNullable<typeof box> => Boolean(box));
      if (!boxes.length) return { count: 0, centerX: null, all: [] };
      const largest = boxes.reduce((best, box) => (box.width * box.height > best.width * best.height ? box : best), boxes[0]);
      const all = boxes.map((box) => ({
        x: (box.originX + box.width / 2) / canvas.width,
        y: (box.originY + box.height / 2) / canvas.height,
        size: Math.max(box.width, box.height) / canvas.width,
      }));
      return { count: boxes.length, centerX: (largest.originX + largest.width / 2) / canvas.width, all };
    },
    close() { ready.close(); },
  };
}
