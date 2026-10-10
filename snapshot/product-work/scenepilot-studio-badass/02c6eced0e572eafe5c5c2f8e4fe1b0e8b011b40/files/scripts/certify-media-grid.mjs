// Run after desktop:renderer. Arguments: directory containing the five generated
// sp-golden fixtures, output directory. Uses a real isolated Electron renderer,
// normal pointer actions, native IPC, FFmpeg and disk writes. Only OS dialog
// choices are supplied by the harness; native dialog interaction is NOT covered.
import assert from "node:assert/strict";
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import ffmpeg from "ffmpeg-static";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtures = path.resolve(process.argv[2] || "");
const output = process.argv[3] && path.resolve(process.argv[3]);
assert.ok(process.argv[2] && output, "Pass fixture and output directories");
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), "scenepilot-grid-"));
for (const name of ["temp", "documents", "videos"]) await mkdir(path.join(profile, name));
const wrapper = path.join(root, `.grid-qa-${process.pid}.mjs`);
await writeFile(wrapper, `import {app} from 'electron';
${["userData", "temp", "documents", "videos"].map(name => `app.setPath(${JSON.stringify(name)},${JSON.stringify(name === "userData" ? profile : path.join(profile, name))});`).join("\n")}
await import('./electron/main.js');`);
const result = { startedAt: new Date().toISOString(), source: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), dirty: execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }), nativeDialogInteraction: "UNVERIFIED: dialog choices supplied by harness", checks: [] };
let app;
try {
  app = await _electron.launch({ executablePath: electron, args: [wrapper], cwd: root });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15_000);
  await page.getByPlaceholder("My project").fill("Media grid regression");
  await page.locator(".np-settings summary").click();
  await page.locator(".np-aspect").filter({ hasText: "16:9" }).click();
  await page.getByRole("button", { name: "Start editing", exact: true }).click();
  await page.locator(".panel-head input[type=file][multiple]").setInputFiles([
    "sp-golden-main-30fps.mp4", "sp-golden-broll-24fps.mp4", "sp-golden-overlay.png", "sp-golden-music-48k.wav", "sp-golden-sfx-44k.wav",
  ].map(name => path.join(fixtures, name)));
  await page.waitForFunction(() => document.querySelectorAll(".asset-row").length === 5);
  const boxes = await page.locator(".asset-row").evaluateAll(rows => rows.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height, name: element.querySelector("strong").textContent };
  }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]; const b = boxes[j];
    assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1, `Overlapping cards: ${a.name}, ${b.name}`);
  }
  await page.screenshot({ path: path.join(output, "media-grid.png") });
  await page.locator(".asset-row").filter({ hasText: "sp-golden-main-30fps.mp4" }).dblclick();
  await page.getByRole("button", { name: ", Insert", exact: true }).click();
  assert.ok((await page.locator("body").innerText()).includes("12.0s"));
  result.checks.push({ name: "five media cards do not overlap; normal double-click and source insertion", status: "PASS", boxes });
  await app.evaluate(({ dialog }, directory) => {
    globalThis.gridQaDialogs = [];
    dialog.showSaveDialog = async (...args) => {
      const options = args.at(-1);
      const filePath = directory + (options.title.includes("Native") ? "/native.mp4" : "/project.scenepilot.json");
      globalThis.gridQaDialogs.push({ title: options.title, defaultPath: options.defaultPath, filePath });
      return { canceled: false, filePath };
    };
  }, path.join(profile, "documents"));
  const rendered = await page.evaluate(sourcePath => window.scenePilotDesktop.nativeRender({ jobId: "grid-qa-native-001", suggestedName: "native.mp4", plan: { clips: [{ sourcePath, sourceStart: 0, duration: 1 }], width: 320, height: 180, frameRate: 30, duration: 1, format: "mp4-h264" } }), path.join(fixtures, "sp-golden-main-30fps.mp4"));
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", rendered.outputPath], { encoding: "utf8" }));
  assert.equal(probe.streams[0].codec_name, "h264");
  assert.equal(probe.streams[0].width, 320);
  assert.equal(probe.streams[0].height, 180);
  assert.equal(Number(probe.streams[0].nb_frames), 30);
  assert.ok(Math.abs(Number(probe.format.duration) - 1) < 0.05);
  const dialogs = await app.evaluate(() => globalThis.gridQaDialogs);
  assert.equal(dialogs[0].defaultPath, path.join(profile, "videos", "native.mp4"));
  result.checks.push({ name: "native IPC default Videos directory and real 1s/30-frame H264 output", status: "PASS", rendered, probe, dialogs });
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Project document saved atomically"));
  const document = JSON.parse(await readFile(path.join(profile, "documents", "project.scenepilot.json"), "utf8"));
  assert.ok(JSON.stringify(document).includes("sp-golden-main-30fps.mp4"));
  assert.equal(document.assets.length, 5);
  assert.equal(document.videoClips.length, 1);
  assert.equal(document.baseCuts.length, 1);
  assert.equal(document.proState.audioClips.length, 0, "Silent source must not create phantom embedded audio");
  result.checks.push({ name: "UI Save writes actual project JSON with imported media", status: "PASS" });
  await app.close();
  // A fresh OS process AND profile prevent in-memory or browser-library state
  // from masquerading as reopening the saved disk document.
  const reopenedProfile = await mkdtemp(path.join(tmpdir(), "scenepilot-reopen-"));
  for (const name of ["temp", "documents", "videos"]) await mkdir(path.join(reopenedProfile, name));
  await writeFile(wrapper, (await readFile(wrapper, "utf8")).replaceAll(profile, reopenedProfile));
  app = await _electron.launch({ executablePath: electron, args: [wrapper], cwd: root });
  const reopened = await app.firstWindow();
  reopened.setDefaultTimeout(15_000);
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    // Only discard the empty new scratch project in this isolated profile.
    dialog.showMessageBox = async () => ({ response: 1 });
  }, path.join(profile, "documents", "project.scenepilot.json"));
  await reopened.getByPlaceholder("My project").fill("Empty reopen scratch");
  await reopened.getByRole("button", { name: "Start editing", exact: true }).click();
  await reopened.locator(".project-file-menu summary").click();
  await reopened.getByRole("button", { name: "Restore saved project", exact: true }).click();
  await reopened.waitForFunction(() => document.querySelectorAll(".asset-row").length === 5);
  assert.ok((await reopened.locator(".project-title").innerText()).includes(document.project));
  await reopened.getByRole("button", { name: "Save project", exact: true }).click();
  await reopened.waitForFunction(() => document.body.innerText.includes("Project document saved atomically"));
  const restored = JSON.parse(await readFile(path.join(profile, "documents", "project.scenepilot.json"), "utf8"));
  for (const key of ["project", "duration", "tracks", "videoClips", "baseCuts", "placements", "titles", "compositions", "settings"]) assert.deepEqual(restored[key], document[key], `Reopened ${key} differs`);
  const mediaIdentity = assets => assets.map(({ id, name, kind, sourcePath }) => ({ id, name, kind, sourcePath })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(mediaIdentity(restored.assets), mediaIdentity(document.assets));
  await reopened.screenshot({ path: path.join(output, "cold-reopened.png") });
  result.checks.push({ name: "File menu opens disk project in fresh process/profile; re-saved clip/settings/media identity match", status: "PASS" });
  const avPath = path.join(profile, "documents", "positive-av.mp4");
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", path.join(fixtures, "sp-golden-main-30fps.mp4"), "-i", path.join(fixtures, "sp-golden-music-48k.wav"), "-t", "1", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", avPath]);
  await reopened.locator(".panel-head input[type=file][multiple]").setInputFiles(avPath);
  await reopened.waitForFunction(() => document.querySelectorAll(".asset-row").length === 6);
  await reopened.locator(".asset-row").filter({ hasText: "positive-av.mp4" }).dblclick();
  await reopened.getByRole("button", { name: ", Insert", exact: true }).click();
  await reopened.getByRole("button", { name: "Save project", exact: true }).click();
  await reopened.waitForFunction(() => document.body.innerText.includes("Project document saved atomically"));
  const withAudio = JSON.parse(await readFile(path.join(profile, "documents", "project.scenepilot.json"), "utf8"));
  assert.equal(withAudio.proState.audioClips.length, 1, "Real embedded audio must still be retained");
  assert.equal(withAudio.proState.audioClips[0].assetId, withAudio.assets.find(asset => asset.name === "positive-av.mp4").id);
  result.checks.push({ name: "Silent insert creates no phantom audio; actual audio-bearing video retains linked clip", status: "PASS" });
  // Exercise the real UI export too. Native Save chooses an owned path; the
  // parity renderer receives a REAL OPFS FileSystemFileHandle, not a mocked
  // writable/encoder. This still does not certify the host OS chooser.
  const uiMaster = path.join(output, "ui-master.mp4");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, uiMaster);
  await reopened.evaluate(async () => {
    const directory = await navigator.storage.getDirectory();
    const handle = await directory.getFileHandle("owned-ui-master.mp4", { create: true });
    window.showSaveFilePicker = async () => handle;
  });
  await reopened.getByLabel("Master playhead", { exact: true }).fill("13");
  await reopened.locator("summary").filter({ hasText: /^Timeline settings$/ }).click();
  await reopened.getByRole("button", { name: "O · Out", exact: true }).click();
  await reopened.getByRole("button", { name: "Export", exact: true }).click();
  await reopened.getByLabel("Export file name").fill("owned-ui-master");
  await reopened.getByRole("button", { name: /^Export video/ }).click();
  await reopened.locator(".render-job.completed, .render-job.failed, .render-job.canceled").waitFor({ timeout: 120_000 });
  const queueText = await reopened.locator(".render-job").innerText();
  await reopened.screenshot({ path: path.join(output, "ui-export.png") });
  assert.equal(await reopened.locator(".render-job.completed").count(), 1, queueText);
  let destination = "native disk";
  try { await readFile(uiMaster); }
  catch {
    destination = "real OPFS disk handle";
    const bytes = await reopened.evaluate(async () => {
      const directory = await navigator.storage.getDirectory();
      const file = await (await directory.getFileHandle("owned-ui-master.mp4")).getFile();
      return Array.from(new Uint8Array(await file.arrayBuffer()));
    });
    await writeFile(uiMaster, Uint8Array.from(bytes));
  }
  const uiProbe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", uiMaster], { encoding: "utf8" }));
  const picture = uiProbe.streams.find(stream => stream.codec_type === "video");
  assert.equal(picture.codec_name, "h264"); assert.equal(picture.width, 1920); assert.equal(picture.height, 1080);
  assert.equal(picture.avg_frame_rate, "30/1"); assert.ok(Math.abs(Number(uiProbe.format.duration) - 13) < .1);
  assert.ok(uiProbe.streams.some(stream => stream.codec_type === "audio"), "Missing real program audio");
  const pcm = execFileSync(ffmpeg, ["-v", "error", "-ss", "0.2", "-t", "0.2", "-i", uiMaster, "-vn", "-f", "f32le", "-ac", "1", "pipe:1"]);
  let energy = 0;
  for (let i = 0; i < pcm.length; i += 4) energy += pcm.readFloatLE(i) ** 2;
  const rms = Math.sqrt(energy / (pcm.length / 4));
  assert.ok(Number.isFinite(rms) && rms > .001, "Expected audio signal is absent");
  result.checks.push({ name: "Actual mixed silent/AV timeline UI export retains picture and nonzero audio", status: "PASS", destination, queueText, rms, probe: uiProbe });
  result.status = "PASS";
} catch (error) {
  result.status = "FAIL"; result.error = String(error.stack || error); process.exitCode = 1;
} finally {
  result.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (app) await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 50); }).catch(() => {});
  await unlink(wrapper);
}
