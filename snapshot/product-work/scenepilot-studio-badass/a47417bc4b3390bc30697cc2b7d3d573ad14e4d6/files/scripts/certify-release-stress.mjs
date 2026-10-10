import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir, rename } from "node:fs/promises";
import { watch } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { writeAtomicFile } from "../electron/atomic-file.js";
import { createNativeSequenceRenderJob, createProxyJob, detectNativeMediaEngine, probeMedia, sanitizeNativeRenderPlan } from "../electron/media-engine.js";

const run = promisify(execFile);
const outputArg = process.argv.find((arg) => arg.startsWith("--report="));
const workspace = await mkdtemp(path.join(os.tmpdir(), "scenepilot-release-stress-"));
const checks = [];
const started = Date.now();
const check = (name, passed, details) => { checks.push({ name, passed: Boolean(passed), details }); if (!passed) throw new Error(`${name}: ${JSON.stringify(details)}`); };
let report;
try {
  const engine = await detectNativeMediaEngine();
  check("bundled engine available", engine.available, engine.message);
  const source = path.join(workspace, "motion-4k.mp4");
  await run(engine.ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=3840x2160:rate=30:duration=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=30", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "35", "-c:a", "aac", "-threads", "2", source], { timeout: 180000 });
  const plan = sanitizeNativeRenderPlan({ clips: [{ sourcePath: source, duration: 30, sourceStart: 0, playbackRate: 1 }], soundtrackPath: source, width: 3840, height: 2160, frameRate: 30, duration: 30, rangeStart: 0, masterGain: .8 });
  const target = path.join(workspace, "master.mp4");
  await writeFile(target, "previous customer master");
  let cancelled = false;
  try { await createNativeSequenceRenderJob({ engine, plan, outputPath: target, onSpawn: (child) => child.kill("SIGTERM") }); }
  catch { cancelled = true; }
  check("cancel preserves existing master", cancelled && await readFile(target, "utf8") === "previous customer master", { cancelled });
  check("cancel cleans partials", !(await readdir(workspace)).some((name) => name.includes(".partial")), "no partial output files");
  const timings = [];
  for (let index = 0; index < 3; index++) {
    const start = Date.now();
    let child;
    let peakRssKB = 0;
    const sampler = setInterval(() => {
      if (child?.pid) void run("ps", ["-o", "rss=", "-p", String(child.pid)]).then(({ stdout }) => { peakRssKB = Math.max(peakRssKB, Number(stdout.trim()) || 0); }).catch(() => {});
    }, 250);
    let timeout;
    try { await createNativeSequenceRenderJob({ engine, plan, outputPath: target, onSpawn: (process) => { child = process; timeout = setTimeout(() => child.kill("SIGKILL"), 180000); } }); }
    finally { clearInterval(sampler); clearTimeout(timeout); }
    const metadata = await probeMedia(engine, target);
    const { stdout } = await run(engine.ffmpeg, ["-v", "error", "-ss", "15", "-i", target, "-frames:v", "1", "-vf", "scale=2:2", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { encoding: "buffer", timeout: 30000 });
    check(`4K retry/repeated export ${index + 1}`, metadata.video?.width === 3840 && metadata.video?.height === 2160 && Math.abs(metadata.duration - 30) < .1 && Boolean(metadata.audio) && stdout.length === 12 && stdout.some((byte) => byte > 20), { seconds: metadata.duration, codec: metadata.video?.codec, audio: metadata.audio?.codec });
    timings.push({ elapsedMs: Date.now() - start, peakEncoderRssKB: peakRssKB });
  }
  const oldMaster = await readFile(target);
  await rename(source, `${source}.moved`);
  let missingFailed = false;
  try { await createNativeSequenceRenderJob({ engine, plan, outputPath: target }); } catch { missingFailed = true; }
  check("missing media preserves previous export", missingFailed && (await readFile(target)).equals(oldMaster), { missingFailed });
  await rename(`${source}.moved`, source);
  const cache = path.join(workspace, "proxies");
  const proxies = await Promise.all([0, 1].map(() => createProxyJob({ engine, sourcePath: source, cacheDirectory: cache, maxWidth: 640 })));
  const proxyProbe = await probeMedia(engine, proxies[0].outputPath);
  check("concurrent proxy jobs do not delete each other's work", proxies[0].outputPath === proxies[1].outputPath && proxyProbe.duration > 29.9 && !(await readdir(cache)).some((name) => name.includes(".partial")), { width: proxyProbe.video?.width });
  const document = path.join(workspace, "project.json");
  await writeAtomicFile(document, JSON.stringify({ revision: 0 }));
  const child = spawn(process.execPath, ["--input-type=module", "-e", `import {writeAtomicFile} from ${JSON.stringify(pathToFileURL(path.resolve("electron/atomic-file.js")).href)}; await writeAtomicFile(process.argv[1], JSON.stringify({revision:1,payload:'x'.repeat(64*1024*1024)}));`, document], { stdio: "ignore" });
  let interrupted = false;
  const watcher = watch(workspace, (_event, name) => { if (String(name).startsWith("project.json.") && String(name).endsWith(".partial")) { interrupted = child.kill("SIGKILL"); } });
  const killDeadline = setTimeout(() => child.kill("SIGKILL"), 15000);
  await once(child, "close"); clearTimeout(killDeadline); watcher.close();
  const recovered = JSON.parse(await readFile(document, "utf8"));
  check("process death during save leaves complete document", interrupted && [0, 1].includes(recovered.revision), { interrupted, recoveredRevision: recovered.revision });
  await writeAtomicFile(document, JSON.stringify({ revision: 2 }));
  check("save recovers after process death", JSON.parse(await readFile(document, "utf8")).revision === 2, "subsequent atomic save succeeded");
  const blocked = path.join(workspace, "unwritable.json"); await mkdir(blocked);
  let rejected = false;
  try { await writeAtomicFile(blocked, "test"); } catch { rejected = true; }
  check("unwritable destination rejects safely", rejected, "directory cannot be replaced by project file");
  report = { passed: true, scope: "Generated 30-second 4K native pipeline; not a multi-hour UI soak or real-footage perceptual acceptance", encoder: engine.encoder, timings, checks };
} catch (error) { report = { passed: false, error: String(error), checks, workspace }; process.exitCode = 1; }
finally {
  report = { schema: "scenepilot-release-stress/v1", createdAt: new Date().toISOString(), elapsedMs: Date.now() - started, ...report };
  if (outputArg) await writeFile(outputArg.slice(9), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.passed) await rm(workspace, { recursive: true, force: true });
}
