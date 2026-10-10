/** Only report absence after a successful container probe; failures stay unknown. */
export async function probeMediaAudio(file: File): Promise<boolean | undefined> {
  if (!file.size) return undefined; // Desktop path-backed placeholder, not empty media.
  let input: import("mediabunny").Input | undefined;
  try {
    const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file, { maxCacheSize: 2 * 1024 * 1024 }) });
    return Boolean(await input.getPrimaryAudioTrack());
  }
  catch { return undefined; }
  finally { input?.dispose(); }
}

export async function probeVideoDuration(url: string) {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  return await new Promise<number | undefined>((resolve) => {
    const finish = (value?: number) => {
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(), 3000);
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish();
    };
  });
}

export function mediaMime(kind: "image" | "video" | "audio", name: string) {
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (kind === "audio") return extension === "wav" ? "audio/wav" : extension === "mp3" ? "audio/mpeg" : "audio/mp4";
  if (kind === "image") return extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return extension === "webm" ? "video/webm" : extension === "mov" ? "video/quicktime" : "video/mp4";
}

export async function materializePathBackedFile(file: File, url: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (file.size > 0 || !url.startsWith("scenepilot-media:")) return file;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not read linked media ${file.name}.`);
  const blob = await response.blob();
  return new File([blob], file.name, { type: blob.type || file.type, lastModified: file.lastModified });
}

export function createSilentWavFile(duration: number) {
  const sampleRate = 8_000;
  const samples = Math.max(1, Math.ceil(duration * sampleRate));
  const bytes = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(bytes);
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  return new File([bytes], "composition-silence.wav", { type: "audio/wav" });
}
