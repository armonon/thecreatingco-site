import { build } from "esbuild";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import electron from "electron";

const run = promisify(execFile);
const workspace = await mkdtemp(path.join(os.tmpdir(), "scenepilot-main-render-"));
const source = path.join(workspace, "main.mp4");
const bundle = path.join(workspace, "certificate.js");
const result = path.join(workspace, "result.json");
const payload = path.join(workspace, "payload.json");
const html = path.join(workspace, "index.html");
await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=red:s=160x90:r=30:d=1", "-vf", "drawbox=x=80:y=0:w=80:h=90:color=green:t=fill", "-c:v", "libx264", "-pix_fmt", "yuv420p", source], { timeout: 30_000 });
await build({ entryPoints: [new URL("./certify-main-source-render.ts", import.meta.url).pathname], bundle: true, format: "iife", globalName: "ScenePilotCertificate", outfile: bundle, platform: "browser" });
await writeFile(html, '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; media-src blob:"><title>Main-source render certificate</title>');
await writeFile(payload, JSON.stringify({ source, bundle, result, html }));
await run(electron, [new URL("./certify-main-source-electron.mjs", import.meta.url).pathname, payload], { timeout: 100_000, maxBuffer: 2_000_000 });
const outputs = JSON.parse(await readFile(result, "utf8"));
const checks = [];
for (const item of outputs) {
  const file = path.join(workspace, `${item.name}.mp4`);
  await writeFile(file, Buffer.from(item.bytes));
  const { stdout } = await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-ss", "0.25", "-i", file, "-vf", "format=rgb24,scale=2:1:flags=neighbor", "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], { encoding: "buffer", timeout: 30_000 });
  const pixels = [...stdout];
  const mono = item.name === "main-effect";
  const passed = pixels.length === 6 && (mono
    ? pixels[0] > 25 && Math.max(...pixels.slice(0, 3)) - Math.min(...pixels.slice(0, 3)) <= 5
    : pixels[0] > 180 && pixels[1] < 45 && pixels[4] > 75 && pixels[3] < 45);
  checks.push({ name: item.name, passed, pixels, bytes: item.bytes.length });
  if (item.name === "main-crossfade") {
    for (const time of [.65, .95]) {
      const { stdout: frame } = await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-ss", String(time), "-i", file, "-vf", "format=rgb24,scale=2:1:flags=neighbor", "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], { encoding: "buffer", timeout: 30_000 });
      const rgb = [...frame];
      checks.push({ name: `main-crossfade-${time}`, pixels: rgb, passed: rgb.length === 6 && (time < .8
        ? rgb[0] > 35 && rgb[1] > 25 && rgb[3] > 35 && rgb[4] > 25
        : rgb[0] < 45 && rgb[1] > 75 && rgb[3] > 180 && rgb[4] < 45) });
    }
  }
}
const passed = checks.length === 9 && checks.every((check) => check.passed);
console.log(JSON.stringify({ schema: "scenepilot-main-source-render/v1", passed, workspace, checks }, null, 2));
if (!passed) process.exitCode = 1;
