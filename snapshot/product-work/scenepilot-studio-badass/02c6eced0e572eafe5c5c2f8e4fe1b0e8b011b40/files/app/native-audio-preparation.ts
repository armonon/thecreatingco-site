import type { ScenePilotDesktopBridge } from "./desktop-media";
import type { RenderAudioClip } from "../lib/render-engine";
import type { StreamTargetChunk } from "mediabunny";
import { renderAudioInWorker } from "./render-client";

/** Transferable backpressured output: the UI never stores the full PCM master. */
export async function prepareNativeAudio(bridge: ScenePilotDesktopBridge, clips: RenderAudioClip[], duration: number, signal: AbortSignal, onProgress: (value: number, message: string) => void) {
  signal.throwIfAborted();
  if (!Number.isFinite(duration) || duration <= 0 || Math.ceil(duration * 48000) * 6 + 65536 > 4_000_000_000) throw new Error("Native PCM staging supports masters up to approximately 3 hours 51 minutes. Split this delivery range into shorter masters.");
  const { token } = await bridge.beginPcmMix();
  let handle: ReturnType<typeof renderAudioInWorker> | undefined;
  const abort = () => handle?.cancel();
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const output = new WritableStream<StreamTargetChunk>({
      async write(chunk) {
        signal.throwIfAborted();
        if (chunk.type !== "write") throw new Error("Unsupported PCM stream operation.");
        for (let offset = 0; offset < chunk.data.byteLength; offset += 1024 * 1024) {
          signal.throwIfAborted();
          await bridge.writePcmMix({ token, position: chunk.position + offset, data: chunk.data.slice(offset, offset + 1024 * 1024) });
        }
      },
    }, { highWaterMark: 1 });
    handle = renderAudioInWorker({ clips, duration }, onProgress, output);
    if (signal.aborted) handle.cancel();
    await handle.result;
    signal.throwIfAborted();
    await bridge.finishPcmMix(token);
    signal.throwIfAborted();
    return token;
  } catch (error) {
    handle?.cancel();
    await bridge.releasePcmMix(token).catch(() => undefined);
    throw error;
  } finally { signal.removeEventListener("abort", abort); }
}
