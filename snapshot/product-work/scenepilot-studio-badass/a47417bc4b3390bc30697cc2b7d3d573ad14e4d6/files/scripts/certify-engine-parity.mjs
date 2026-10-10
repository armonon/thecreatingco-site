// Engine-parity certificate: render the SAME saved Pro documents through Pro's real
// export (Electron/Chromium, renderProject) and through the native engine (exact
// translation + AVFoundation/Core Image export), decode both MP4s with one ffmpeg,
// and measure per-frame error. A baseline case compares each export with its source
// footage, separating encoder noise from engine differences.
//
//   node scripts/certify-engine-parity.mjs            # measure and enforce tolerances
//   node scripts/certify-engine-parity.mjs --measure  # measure only
import { build } from "esbuild";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import electron from "electron";
import { parityCases, PARITY_SIZE, TOLERANCES } from "./engine-parity-cases.mjs";

const run = promisify(execFile);
const root = path.resolve(new URL("..", import.meta.url).pathname);
const out = path.join(root, "outputs", "engine-parity");
const measureOnly = process.argv.includes("--measure");
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const { width: W, height: H, fps, seconds } = PARITY_SIZE;

// ---- Fixtures: solid colors and a detailed test pattern, each with a tone ----
// Tagged BT.709 like real camera footage. (Untagged SD video is ambiguous: Chromium
// decodes it as BT.709 and AVFoundation as BT.601, a ~10-level difference that says
// nothing about the engines; see docs/engine-parity.md.)
const media = {};
const geometry = `s=${W}x${H}:r=${fps}:d=${seconds}`;
for (const [id, source] of [["red", `color=c=red:${geometry}`], ["blue", `color=c=blue:${geometry}`], ["pattern", `testsrc2=${geometry}`]]) {
  const file = path.join(out, `${id}.mp4`);
  await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", source, "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${seconds}`,
    "-vf", "scale=out_color_matrix=bt709:out_range=tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file]);
  media[id] = file;
}
const cases = parityCases(media);
for (const item of cases) await writeFile(path.join(out, `${item.name}.scenepilot.json`), JSON.stringify(item.document, null, 2));

// ---- Pro: the real export path in Chromium ----
const bundle = path.join(out, "pro-bundle.js"), html = path.join(out, "index.html"), input = path.join(out, "pro-input.json"), result = path.join(out, "pro-result.json");
await build({ entryPoints: [path.join(root, "scripts/certify-engine-parity-pro.ts")], bundle: true, format: "iife", globalName: "ScenePilotParity", outfile: bundle, platform: "browser", logLevel: "error" });
await writeFile(html, '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; media-src blob:"><title>Engine parity</title>');
const encoded = {};
for (const [id, file] of Object.entries(media)) encoded[id] = { name: path.basename(file), kind: "video", base64: (await readFile(file)).toString("base64") };
await writeFile(input, JSON.stringify({ cases: cases.map(({ name, document }) => ({ name, document })), media: encoded }));
const payload = path.join(out, "pro-payload.json");
await writeFile(payload, JSON.stringify({ bundle, html, input, result }));
await run(electron, [path.join(root, "scripts/certify-engine-parity-electron.mjs"), payload], { timeout: 900_000, maxBuffer: 20_000_000 });
for (const item of JSON.parse(await readFile(result, "utf8"))) await writeFile(path.join(out, `${item.name}.pro.mp4`), Buffer.from(item.bytes));

// ---- Native: exact translation + AVFoundation export ----
await writeFile(path.join(out, "cases.json"), JSON.stringify({ cases: cases.map(({ name }) => ({ name, document: path.join(out, `${name}.scenepilot.json`) })), media }));
await run("swift", ["test", "--package-path", "native-macos", "--filter", "testEngineParityExportsTranslatedDocuments"], {
  cwd: root, timeout: 900_000, maxBuffer: 50_000_000,
  env: { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || "/Applications/Xcode.app/Contents/Developer", SCENEPILOT_PARITY_DIR: out },
});
const native = Object.fromEntries(JSON.parse(await readFile(path.join(out, "native-results.json"), "utf8")).map((r) => [r.name, r]));

// ---- Measure with one decoder ----
async function frames(file) {
  const { stdout } = await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file, "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { encoding: "buffer", maxBuffer: 1_000_000_000 });
  const size = W * H * 3, list = [];
  for (let offset = 0; offset + size <= stdout.length; offset += size) list.push(stdout.subarray(offset, offset + size));
  return list;
}
// ffmpeg-static ships no ffprobe; read the video stream's color description from ffmpeg.
async function tags(file) {
  const { stderr } = await run(ffmpeg, ["-hide_banner", "-i", file]).catch((error) => error);
  return /Video: [^,]+, (\w+\([^)]*\))/.exec(String(stderr))?.[1] ?? "unknown";
}
function compare(a, b) {
  const n = Math.min(a.length, b.length), perFrame = [];
  for (let f = 0; f < n; f++) {
    const x = a[f], y = b[f], histogram = new Uint32Array(256);
    let sum = 0, sq = 0;
    for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - y[i]); sum += d; sq += d * d; histogram[d]++; }
    let seen = 0, p99 = 0, max = 0;
    for (let d = 0; d < 256; d++) { if (histogram[d]) max = d; seen += histogram[d]; if (!p99 && seen >= x.length * 0.99) p99 = d; }
    const mse = sq / x.length;
    perFrame.push({ mae: sum / x.length, p99, max, psnr: mse === 0 ? 99 : 10 * Math.log10(255 * 255 / mse) });
  }
  const worst = (key, pick = Math.max) => perFrame.reduce((m, f) => pick(m, f[key]), key === "psnr" ? 99 : 0);
  return { frames: n, frameCounts: [a.length, b.length], meanMAE: perFrame.reduce((s, f) => s + f.mae, 0) / Math.max(1, n), worstMAE: worst("mae"), worstP99: worst("p99"), minPSNR: worst("psnr", Math.min) };
}
const report = { schema: "scenepilot-engine-parity/v1", date: new Date().toISOString(), host: `${os.type()} ${os.release()} ${os.arch()}`, electron: (await import("electron/package.json", { with: { type: "json" } })).default.version,
  size: PARITY_SIZE, proRenderer: `renderProject, ${process.env.PARITY_PRO_SOFTWARE === "1" ? "software GL" : "GPU"}, no-preference encode (as app/video-delivery.ts)`, nativeRenderer: "LegacySceneTranslation + NativeMedia.build + NativeExporter", tolerances: TOLERANCES, cases: [] };
let failed = false;
const within = (m, limit) => m.frameCounts[0] === m.frameCounts[1] && m.meanMAE <= limit.meanMAE && m.worstMAE <= limit.worstMAE && m.worstP99 <= limit.worstP99 && m.minPSNR >= limit.minPSNR;
for (const item of cases) {
  const pro = path.join(out, `${item.name}.pro.mp4`), nat = path.join(out, `${item.name}.native.mp4`);
  const entry = { name: item.name, purpose: item.purpose, translation: native[item.name] };
  if (!native[item.name]?.exact) { entry.error = "Native translation was not exact."; failed = true; report.cases.push(entry); continue; }
  const [proFrames, nativeFrames] = [await frames(pro), await frames(nat)];
  entry.tags = { pro: await tags(pro), native: await tags(nat) };
  entry.proVsNative = compare(proFrames, nativeFrames);
  if (item.source) {
    const truth = await frames(media[item.source]);
    entry.proVsSource = compare(proFrames, truth); entry.nativeVsSource = compare(nativeFrames, truth);
  }
  entry.tolerance = item.tolerance ?? "engine";
  entry.withinTolerance = within(entry.proVsNative, TOLERANCES[entry.tolerance]);
  if (!entry.withinTolerance) failed = true;
  // Sensitivity: the same comparison slipped by one source frame must fail, or the
  // tolerance is too loose to certify frame-exact timing.
  if (item.source) {
    entry.oneFrameSlip = compare(proFrames.slice(1), nativeFrames.slice(0, -1));
    report.sensitivity = { case: item.name, oneFrameSlipWorstMAE: entry.oneFrameSlip.worstMAE, detected: !within(entry.oneFrameSlip, TOLERANCES.engine) };
    if (!report.sensitivity.detected) failed = true;
  }
  report.cases.push(entry);
}
report.passed = !failed;
await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(["case".padEnd(24) + "frames  meanMAE  worstMAE  worstP99  minPSNR  within",
  ...report.cases.map((c) => c.proVsNative ? `${c.name.padEnd(24)}${String(c.proVsNative.frames).padEnd(8)}${c.proVsNative.meanMAE.toFixed(2).padEnd(9)}${c.proVsNative.worstMAE.toFixed(2).padEnd(10)}${String(c.proVsNative.worstP99).padEnd(10)}${c.proVsNative.minPSNR.toFixed(1).padEnd(9)}${c.withinTolerance}` : `${c.name.padEnd(24)}${c.error}`)].join("\n"));
if (report.sensitivity) console.log(`sensitivity: a one-frame slip measures ${report.sensitivity.oneFrameSlipWorstMAE.toFixed(2)} worst MAE → ${report.sensitivity.detected ? "detected" : "NOT DETECTED (tolerance too loose)"}`);
console.log(`report: ${path.relative(root, path.join(out, "report.json"))}`);
if (failed && !measureOnly) process.exitCode = 1;
