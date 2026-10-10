// Beta ASR worker — transcribes a vocal to timed text with Whisper, loaded on
// demand from a CDN so it never enters the main bundle. The model download and
// inference both run here, off the UI thread. Best-effort: any failure is
// reported back so the caller can fall back to the paste-and-time flow.

type TranscribeRequest = {
  type: "transcribe";
  audio: Float32Array;
  sampleRate: number;
  model?: string;
  /** "wasm" (default, works everywhere) or "webgpu" (faster where available). */
  device?: "wasm" | "webgpu";
};

type TranscribeChunk = { text: string; start: number; end: number };

type TranscribeResponse =
  | { type: "progress"; stage: string; progress: number }
  | { type: "done"; chunks: TranscribeChunk[]; device: "wasm" | "webgpu" }
  | { type: "error"; message: string };

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<TranscribeRequest>) => void) | null;
  postMessage(message: TranscribeResponse, transfer?: Transferable[]): void;
};

// The maintained transformers.js build. A string const (not a literal import
// path) + @vite-ignore keeps the bundler from trying to resolve or inline it.
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";

// One pipeline per model + device, so switching either never reuses the wrong one.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transcribers = new Map<string, Promise<any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTranscriber(model: string, device: "wasm" | "webgpu", onDownload: (fraction: number) => void): Promise<any> {
  const key = `${model}|${device}`;
  let transcriber = transcribers.get(key);
  if (!transcriber) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
    transcriber = mod.pipeline("automatic-speech-recognition", model, {
      // WebGPU: full-precision encoder + 4-bit decoder (the transformers.js
      // Whisper WebGPU recipe). WASM keeps the library's default quantized
      // weights, which are the smallest download.
      ...(device === "webgpu" ? { device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (report: any) => {
        if (report?.status === "progress" && typeof report.progress === "number") {
          onDownload(Math.max(0, Math.min(1, report.progress / 100)));
        }
      },
    });
    transcribers.set(key, transcriber!);
    // A failed load (e.g. no WebGPU adapter) must not poison later attempts.
    transcriber!.catch(() => transcribers.delete(key));
  }
  return transcriber;
}

ctx.onmessage = async (event) => {
  if (event.data?.type !== "transcribe") return;
  const { audio, sampleRate, model = "Xenova/whisper-tiny.en", device = "wasm" } = event.data;
  try {
    const transcriber = await getTranscriber(model, device, (fraction) =>
      ctx.postMessage({ type: "progress", stage: "Downloading model", progress: fraction }));
    ctx.postMessage({ type: "progress", stage: "Listening to the vocal", progress: 0.5 });

    const output = await transcriber(audio, {
      sampling_rate: sampleRate,
      // Word timing powers precise text-based filler removal. Models without
      // word timestamps still fall back to their normal segment chunks.
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawChunks: any[] = Array.isArray(output?.chunks) ? output.chunks : [];
    const chunks: TranscribeChunk[] = rawChunks
      .map((chunk) => ({
        text: String(chunk?.text ?? "").trim(),
        start: Number(chunk?.timestamp?.[0] ?? 0),
        end: Number(chunk?.timestamp?.[1] ?? 0),
      }))
      .filter((chunk) => chunk.text);
    // No per-chunk timing (rare) — fall back to the whole transcript at t=0.
    if (!chunks.length && output?.text) {
      chunks.push({ text: String(output.text).trim(), start: 0, end: 0 });
    }
    ctx.postMessage({ type: "done", chunks, device });
  } catch (error) {
    ctx.postMessage({ type: "error", message: error instanceof Error ? error.message : "Transcription failed" });
  }
};
