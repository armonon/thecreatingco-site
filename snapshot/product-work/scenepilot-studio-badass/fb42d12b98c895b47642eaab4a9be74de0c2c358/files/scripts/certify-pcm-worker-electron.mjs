import { app, BrowserWindow, ipcMain } from "electron";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPcmStagingStore } from "../electron/pcm-staging.js";
import { detectNativeMediaEngine, createNativeSequenceRenderJob, sanitizeNativeRenderPlan } from "../electron/media-engine.js";

let certificateDirectory;

app.whenReady().then(async () => {
  const [url, workerUrl] = process.argv.slice(-2);
  certificateDirectory = await mkdtemp(path.join(os.tmpdir(), "scenepilot-pcm-certificate-"));
  const stagingDirectory = path.join(certificateDirectory, "staging");
  const store = createPcmStagingStore(stagingDirectory);
  ipcMain.handle("qa:pcm-begin", e => store.begin(e.sender.id));
  ipcMain.handle("qa:pcm-write", (e, r) => store.write(e.sender.id, r.token, r.position, r.data));
  ipcMain.handle("qa:pcm-finish", (e, token) => store.finish(e.sender.id, token));
  ipcMain.handle("qa:pcm-release", (e, token) => store.release(e.sender.id, token));
  const window = new BrowserWindow({ show: false, webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, preload: new URL("./certify-pcm-preload.cjs", import.meta.url).pathname } });
  window.webContents.on("console-message", (_event, details) => {
    if (details.level === "error") process.stderr.write(`${details.message}\n`);
  });
  await window.loadURL(url);
  const report = await window.webContents.executeJavaScript(`(async () => {
    function toneWav(name, frequency, sampleRate) {
      const frames = sampleRate * 2;
      const buffer = new ArrayBuffer(44 + frames * 2);
      const view = new DataView(buffer);
      const text = (offset, value) => { for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index)); };
      text(0, "RIFF"); view.setUint32(4, 36 + frames * 2, true); text(8, "WAVE"); text(12, "fmt ");
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, "data"); view.setUint32(40, frames * 2, true);
      for (let frame = 0; frame < frames; frame++) {
        const envelope = Math.min(1, frame / (sampleRate * 0.01), (frames - frame) / (sampleRate * 0.01));
        view.setInt16(44 + frame * 2, Math.round(Math.sin(frame * 2 * Math.PI * frequency / sampleRate) * envelope * 24_000), true);
      }
      return new File([buffer], name, { type: "audio/wav", lastModified: 1 });
    }
    const worker = new Worker(${JSON.stringify(workerUrl)}, { type: "module" });
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("PCM worker certificate timed out")), 30_000);
        worker.onmessage = ({ data }) => { clearTimeout(timer); resolve(data); };
        worker.onerror = ({ message, filename, lineno }) => { clearTimeout(timer); reject(new Error(message || ("PCM module worker failed to load: " + (filename || ${JSON.stringify(workerUrl)}) + ":" + (lineno || 0)))); };
        worker.postMessage({ files: [toneWav("tone-44100.wav", 440, 44_100), toneWav("tone-32000.wav", 220, 32_000)] });
      });
      const { prepareNativeAudio } = await import(new URL(${JSON.stringify('/@fs' + new URL('../app/native-audio-preparation.ts', import.meta.url).pathname)}, location.href).href);
      const { renderAudioProject } = await import(new URL(${JSON.stringify('/@fs' + new URL('../lib/render-engine.ts', import.meta.url).pathname)}, location.href).href);
      const { compositionAudioPlan } = await import(new URL(${JSON.stringify('/@fs' + new URL('../lib/composition-audio.ts', import.meta.url).pathname)}, location.href).href);
      const composition = { id: 'comp', name: 'Comp', duration: .5, tracks: [{ id: 'a', kind: 'audio', enabled: true }], layers: [{ id: 'sound', name: 'Sound', kind: 'media', assetId: 'tone', trackId: 'a', enabled: true, duration: .5, sourceStart: .1, playbackRate: 2, audioGain: .4, audioPan: -.3, audioFadeIn: .1, audioFadeOut: .2 }] };
      const schedule = compositionAudioPlan([composition], [{ id: 'nested', assetId: 'composition:comp', start: 0, sourceStart: .1, duration: 1, playbackRate: 1 }]);
      if (schedule.issues.length) throw new Error(schedule.issues.join(' '));
      const mixed = schedule.clips.map(clip => ({ ...clip, file: toneWav('nested.wav', 440, 44100) }));
      const reference = await renderAudioProject({ clips: mixed, duration: 1 });
      const referenceBytes = Array.from(new Uint8Array(await reference.arrayBuffer()));
      const nativeToken = await prepareNativeAudio(window.pcmCertificateBridge, mixed, 1, new AbortController().signal, () => {});
      const cancel = new AbortController();
      let nativeCancellationPassed = false;
      try { await prepareNativeAudio(window.pcmCertificateBridge, mixed, 1, cancel.signal, value => { if (value > 0) cancel.abort(); }); }
      catch (error) { nativeCancellationPassed = error.name === 'AbortError'; }
      return { ...result, nativeToken, referenceBytes, nativeCancellationPassed, nestedSegmentCount: schedule.clips.length, worker: typeof Worker, offscreenCanvas: typeof OffscreenCanvas, audioEncoder: typeof AudioEncoder };
    } finally {
      worker.terminate();
    }
  })()`);
  const stagedPath = store.resolve(window.webContents.id, report.nativeToken);
  const referencePath = path.join(certificateDirectory, "reference.wav");
  await writeFile(referencePath, Buffer.from(report.referenceBytes));
  delete report.referenceBytes;
  const engine = await detectNativeMediaEngine();
  const run = promisify(execFile);
  const source = path.join(certificateDirectory, "picture.mp4"), output = path.join(certificateDirectory, "master.mp4");
  await run(engine.ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=blue:s=160x90:r=24:d=1", "-an", "-c:v", "libx264", source]);
  const plan = sanitizeNativeRenderPlan({ clips: [{ sourcePath: source, sourceStart: 0, duration: 1 }], soundtrackPath: stagedPath, rangeStart: 0, masterGain: 1, duration: 1, width: 160, height: 90, frameRate: 24 });
  await createNativeSequenceRenderJob({ engine, plan, outputPath: output });
  const decode = async file => {
    const { stdout } = await run(engine.ffmpeg, ["-v", "error", "-i", file, "-map", "0:a", "-ac", "2", "-ar", "48000", "-f", "f32le", "pipe:1"], { encoding: "buffer", maxBuffer: 1000000 });
    return new Float32Array(stdout.buffer, stdout.byteOffset, stdout.length / 4);
  };
  const before = await decode(stagedPath), after = await decode(output);
  let squareError = 0;
  for (let i = 0; i < before.length; i++) squareError += (before[i] - (after[i] ?? 0)) ** 2;
  const nativeAacRmse = Math.sqrt(squareError / before.length);
  await store.releaseOwner(window.webContents.id);
  const nativeCleanupPassed = (await readdir(stagingDirectory)).length === 0;
  const hashPcm = samples => createHash("sha256").update(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)).digest("hex");
  const nativePcmParity = hashPcm(before) === hashPcm(await decode(referencePath));
  report.passed &&= nativePcmParity && report.nativeCancellationPassed && nativeCleanupPassed && before.length === 96000 && after.length >= before.length && nativeAacRmse < .03;
  delete report.nativeToken;
  process.stdout.write(`${JSON.stringify({ ...report, nativePcmParity, nativeAacRmse, nativeCleanupPassed })}\n`);
  window.destroy();
  await rm(certificateDirectory, { recursive: true, force: true });
  await app.quit();
  if (!report.passed) process.exitCode = 1;
}).catch(async (error) => {
  if (certificateDirectory) await rm(certificateDirectory, { recursive: true, force: true });
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  app.exit(1);
});
