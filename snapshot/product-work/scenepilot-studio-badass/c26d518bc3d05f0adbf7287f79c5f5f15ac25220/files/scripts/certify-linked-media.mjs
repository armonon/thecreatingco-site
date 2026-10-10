import { app, BrowserWindow, protocol, session } from "electron";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { installLinkedMediaProtocol } from "../electron/desktop-io.js";

protocol.registerSchemesAsPrivileged([{ scheme: "scenepilot-media", privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
 let directory;
 try {
  directory = await mkdtemp(path.join(tmpdir(), "scenepilot-linked-media-"));
  const source = path.join(directory, "source.mp4");
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=red:s=160x90:r=30:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", source], { timeout: 30_000 });
  const entry = path.join(directory, "index.html");
  await writeFile(entry, '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; media-src scenepilot-media:; connect-src scenepilot-media:"><title>Linked media certification</title>');
  installLinkedMediaProtocol(session.fromPartition("linked-media-certification"), new Map([["test", source]]));
  const window = new BrowserWindow({ show: false, webPreferences: { partition: "linked-media-certification", sandbox: true, contextIsolation: true } });
  await window.loadFile(entry);
  const result = await window.webContents.executeJavaScript(`(async () => {
    const url = 'scenepilot-media://source/test';
    let fetched;
    try { const response = await fetch(url, { signal: AbortSignal.timeout(10000) }); fetched = { status: response.status, type: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength }; }
    catch (error) { fetched = { error: String(error) }; }
    const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.preload = 'auto'; video.muted = true;
    const playback = await new Promise(resolve => {
      const timer = setTimeout(() => resolve({ error: 'metadata timeout' }), 10000);
      video.onloadeddata = () => { video.currentTime = 0.5; };
      video.onseeked = () => { clearTimeout(timer); resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight }); };
      video.onerror = () => { clearTimeout(timer); resolve({ error: video.error?.message, code: video.error?.code }); };
      video.src = url;
    });
    let pixels;
    try { const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2; const ctx = canvas.getContext('2d'); ctx.drawImage(video,0,0,2,2); pixels = [...ctx.getImageData(0,0,1,1).data]; }
    catch (error) { pixels = { error: String(error) }; }
    return { fetched, playback, pixels, passed: fetched.bytes > 0 && playback.width === 160 && pixels[0] > 200 && pixels[1] < 30 };
  })()`);
  console.log(JSON.stringify(result, null, 2));
  await rm(directory, { recursive: true, force: true });
  process.exitCode = result.passed ? 0 : 1;
  app.exit(result.passed ? 0 : 1);
 } catch (error) {
  console.error(error);
  if (directory) await rm(directory, { recursive: true, force: true });
  app.exit(1);
 }
});
