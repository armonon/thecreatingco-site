// Main-thread driver for the beta vocal transcription. Decodes the song to the
// 16 kHz mono Float32 Whisper wants, then hands it to the ASR worker and relays
// progress. Everything model-related lives in the worker (and its CDN import),
// so importing this file stays cheap until the user opts in.

export type TranscribeProgress = { stage: string; progress: number };
export type TranscribeChunk = { text: string; start: number; end: number };
export type TranscribeOptions = {
  /** Hugging Face model id of a transformers.js Whisper export. */
  model?: string;
  device?: "wasm" | "webgpu";
};

/** Decode any audio/video file to a single 16 kHz channel of PCM. */
export async function decodeToMono16k(file: File): Promise<Float32Array> {
  const data = await file.arrayBuffer();
  const AudioCtx = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
  const Ctor = AudioCtx.AudioContext ?? AudioCtx.webkitAudioContext;
  if (!Ctor) throw new Error("Audio decoding isn't supported in this browser.");

  // decodeAudioData decodes at the file's native rate; resample to 16 kHz mono
  // through an OfflineAudioContext.
  const decodeContext = new Ctor();
  const decoded = await decodeContext.decodeAudioData(data.slice(0));
  void decodeContext.close?.();

  const targetRate = 16000;
  const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const OfflineCtor = (globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!OfflineCtor) return decoded.getChannelData(0).slice();
  const offline = new OfflineCtor(1, frames, targetRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Transcribe the vocal in `file` to timed chunks. Spawns the ASR worker (which
 * lazy-loads Whisper from a CDN on first use), relays download/inference
 * progress, and resolves with the phrase timestamps. Rejects on failure or abort
 * so the caller can fall back to manual lyric timing.
 */
export async function transcribeVocals(
  file: File,
  onProgress?: (progress: TranscribeProgress) => void,
  signal?: AbortSignal,
  options: TranscribeOptions = {},
): Promise<TranscribeChunk[]> {
  onProgress?.({ stage: "Decoding audio", progress: 0 });
  const audio = await decodeToMono16k(file);
  return transcribePcm(audio, onProgress, signal, options);
}

/** Transcribe 16 kHz mono PCM (from decodeToMono16k) in the ASR worker. */
export function transcribePcm(
  pcm: Float32Array,
  onProgress?: (progress: TranscribeProgress) => void,
  signal?: AbortSignal,
  options: TranscribeOptions = {},
): Promise<TranscribeChunk[]> {
  // The worker takes ownership of the buffer; keep the caller's copy intact.
  const audio = pcm.slice();

  const worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
  return new Promise<TranscribeChunk[]>((resolve, reject) => {
    const done = (fn: () => void) => { worker.terminate(); fn(); };
    signal?.addEventListener("abort", () => done(() => reject(new Error("Cancelled"))));
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === "progress") onProgress?.({ stage: message.stage, progress: message.progress });
      else if (message?.type === "done") done(() => resolve(message.chunks as TranscribeChunk[]));
      else if (message?.type === "error") done(() => reject(new Error(message.message)));
    };
    worker.onerror = (event) => done(() => reject(new Error(event.message || "Transcription worker failed to start")));
    worker.postMessage({ type: "transcribe", audio, sampleRate: 16000, model: options.model, device: options.device }, [audio.buffer]);
  });
}
