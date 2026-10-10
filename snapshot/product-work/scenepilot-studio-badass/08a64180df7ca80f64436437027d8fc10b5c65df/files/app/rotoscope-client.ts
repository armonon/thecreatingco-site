import type { RotoPoint } from "../lib/rotoscope";

type RotoMediaSource = { url: string; kind: "image" | "video"; duration?: number };

function waitFor(target: EventTarget, event: string, error = "error"): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("The source frame could not be decoded.")); };
    const cleanup = () => { target.removeEventListener(event, done); target.removeEventListener(error, failed); };
    target.addEventListener(event, done, { once: true });
    target.addEventListener(error, failed, { once: true });
  });
}

export async function captureRotoFrames(
  source: RotoMediaSource,
  times: number[],
  width: number,
  onFrame: (frame: ImageData, time: number, index: number) => Promise<void> | void,
  signal?: AbortSignal,
): Promise<void> {
  const media = source.kind === "video" ? document.createElement("video") : document.createElement("img");
  media.crossOrigin = "anonymous";
  if (media instanceof HTMLVideoElement) {
    media.muted = true;
    media.playsInline = true;
    media.preload = "auto";
  }
  media.src = source.url;
  if (media instanceof HTMLVideoElement) {
    if (media.readyState < 1) await waitFor(media, "loadedmetadata");
    if (media.readyState < 2) await waitFor(media, "loadeddata");
  } else if (!media.complete) await waitFor(media, "load");
  const sourceWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const sourceHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(96, Math.round(width));
  canvas.height = Math.max(54, Math.round(canvas.width * sourceHeight / Math.max(1, sourceWidth)));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas frame analysis is unavailable.");
  for (let index = 0; index < times.length; index += 1) {
    if (signal?.aborted) throw new DOMException("Roto tracking cancelled.", "AbortError");
    const time = Math.max(0, Math.min(source.duration ?? Number.POSITIVE_INFINITY, times[index]));
    if (media instanceof HTMLVideoElement && Math.abs(media.currentTime - time) > .001) {
      media.currentTime = time;
      await waitFor(media, "seeked");
    }
    context.drawImage(media, 0, 0, canvas.width, canvas.height);
    await onFrame(context.getImageData(0, 0, canvas.width, canvas.height), times[index], index);
  }
  media.removeAttribute("src");
  if (media instanceof HTMLVideoElement) media.load();
}

export function layerPointFromStage(
  stage: DOMRect,
  clientX: number,
  clientY: number,
  layer: { x: number; y: number; width: number; height: number; scale: number; rotation: number },
): RotoPoint {
  const stageX = (clientX - stage.left) / Math.max(1, stage.width);
  const stageY = (clientY - stage.top) / Math.max(1, stage.height);
  const centerX = layer.x / 100;
  const centerY = layer.y / 100;
  const radians = -layer.rotation * Math.PI / 180;
  const dx = stageX - centerX;
  const dy = stageY - centerY;
  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
  const scale = Math.max(.001, layer.scale / 100);
  return {
    x: Math.max(0, Math.min(1, rotatedX / (layer.width / 100 * scale) + .5)),
    y: Math.max(0, Math.min(1, rotatedY / (layer.height / 100 * scale) + .5)),
  };
}
