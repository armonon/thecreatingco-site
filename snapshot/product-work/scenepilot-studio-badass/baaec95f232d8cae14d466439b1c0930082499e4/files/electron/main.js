import { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session, shell } from "electron";
import { randomUUID } from "node:crypto";
import { access, appendFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectProjectPackage, createNativeSequenceRenderJob, createProxyJob, detectNativeMediaEngine, probeMedia, sanitizeNativeRenderPlan } from "./media-engine.js";
import { createNativeRotoService, detectNativeRotoEngine, segmentNativeRotoFrame } from "./native-roto.js";
import { clearRotoCache, readRotoCache, writeRotoCache } from "./roto-cache.js";
import { clearInpaintCache, readInpaintCache, writeInpaintCache } from "./inpaint-cache.js";
import { detectNeuralInpaintProvider, runNeuralInpaint } from "./neural-inpaint.js";
import { compareVersions, parseSha256, PUBLIC_RELEASES_API, selectInstallerAsset, verifyFileDigest } from "./update-utils.js";
import { appendDiagnostic } from "./diagnostics.js";
import { writeAtomicFile } from "./atomic-file.js";
import { EDITOR_SESSION_PARTITION, installLinkedMediaProtocol, isTrustedEditorUrl, mapConcurrent } from "./desktop-io.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ONLINE_URL = "https://scenepilot-studio.armonon.chatgpt.site/";
const DEVELOPMENT_URL = !app.isPackaged ? process.env.SCENEPILOT_URL || "" : "";
const DESKTOP_ENTRY = path.join(__dirname, "renderer", "desktop", "index.html");
const APP_ICON = path.join(__dirname, "app-icon-512.png");
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

let updateDownloadActive = false;
const nativeMediaJobs = new Map();
const nativeMediaUrls = new Map();
const projectDocumentPaths = new Map();
const pendingDocumentPaths = new Map();
const savingDocuments = new Set();
let nativeMediaEnginePromise;
let nativeRotoEnginePromise;
let nativeRotoServicePromise;
let neuralInpaintProviderPromise;
let lastRenderDirectory = "";

function diagnosticsDirectory() {
  return path.join(app.getPath("userData"), "logs");
}

function recordDiagnostic(event, error, details = {}) {
  const normalized = error instanceof Error ? error : new Error(String(error ?? event));
  try {
    appendDiagnostic(diagnosticsDirectory(), {
      event,
      message: normalized.message,
      stack: normalized.stack,
      details: { version: app.getVersion(), platform: process.platform, architecture: process.arch, ...details },
    });
  } catch { /* Diagnostics must never cause a second failure. */ }
}

process.on("uncaughtExceptionMonitor", (error, origin) => recordDiagnostic("main-uncaught-exception", error, { origin }));
process.on("unhandledRejection", (reason) => recordDiagnostic("main-unhandled-rejection", reason));

protocol.registerSchemesAsPrivileged([{
  scheme: "scenepilot-media",
  privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}]);

app.setName("ScenePilot");
app.setAppUserModelId("com.armonon.scenepilot");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function nativeMediaEngine() {
  nativeMediaEnginePromise ??= detectNativeMediaEngine({ resourcesPath: process.resourcesPath });
  return nativeMediaEnginePromise;
}

function nativeRotoEngine() {
  nativeRotoEnginePromise ??= detectNativeRotoEngine({ resourcesPath: process.resourcesPath, appDirectory: __dirname });
  return nativeRotoEnginePromise;
}

function nativeRotoService() {
  nativeRotoServicePromise ??= nativeRotoEngine().then((engine) => engine.available ? createNativeRotoService(engine) : null);
  return nativeRotoServicePromise;
}

function neuralInpaintProvider() {
  neuralInpaintProviderPromise ??= detectNeuralInpaintProvider({ resourcesPath: process.resourcesPath, appDirectory: __dirname });
  return neuralInpaintProviderPromise;
}

function rotoCacheRoot() {
  return path.join(app.getPath("userData"), "roto-cache", "v1");
}

function inpaintCacheRoot() {
  return path.join(app.getPath("userData"), "inpaint-cache", "v1");
}

function requireAbsolutePath(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) throw new Error("A valid local media path is required.");
  return value;
}

function requireJobId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(value)) throw new Error("A valid media job id is required.");
  return value;
}

function sanitizeRenderName(value) {
  const cleaned = String(value ?? "ScenePilot Master.mp4")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
    .slice(0, 180);
  return cleaned.toLowerCase().endsWith(".mp4") ? cleaned : `${cleaned}.mp4`;
}

async function uniqueRenderPath(directory, filename) {
  const parsed = path.parse(filename);
  const safeBase = parsed.name || "ScenePilot Master";
  const safeExt = parsed.ext || ".mp4";
  let attempt = path.join(directory, `${safeBase}${safeExt}`);
  let counter = 2;
  // Keep queued masters recoverable instead of silently overwriting a prior export.
  while (true) {
    try {
      await access(attempt);
      attempt = path.join(directory, `${safeBase} ${counter}${safeExt}`);
      counter += 1;
    } catch {
      return attempt;
    }
  }
}

async function preferredRenderDirectory() {
  if (lastRenderDirectory) {
    try { await access(lastRenderDirectory); return lastRenderDirectory; } catch { lastRenderDirectory = ""; }
  }
  try {
    const stored = JSON.parse(await readFile(path.join(app.getPath("userData"), "render-preferences.json"), "utf8"));
    const directory = requireAbsolutePath(stored?.lastRenderDirectory);
    await access(directory);
    lastRenderDirectory = directory;
  } catch { /* first launch or a moved destination falls back to Movies */ }
  return lastRenderDirectory;
}

async function rememberRenderDirectory(directory) {
  lastRenderDirectory = requireAbsolutePath(directory);
  const preferencesDirectory = app.getPath("userData");
  await mkdir(preferencesDirectory, { recursive: true });
  await writeFile(path.join(preferencesDirectory, "render-preferences.json"), JSON.stringify({ lastRenderDirectory }, null, 2), "utf8");
}

function installNativeMediaHandlers() {
  const handle = (channel, handler) => ipcMain.handle(channel, (event, ...args) => {
    if (event.senderFrame !== event.sender.mainFrame || !isTrustedEditorUrl(event.senderFrame?.url, DESKTOP_ENTRY, DEVELOPMENT_URL)) throw new Error("Native access is restricted to the ScenePilot editor.");
    return handler(event, ...args);
  });
  handle("scenepilot:close-window", (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  handle("scenepilot:confirm-project-replacement", async (event) => {
    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), { type: "warning", message: "Save changes before opening another project?", buttons: ["Save", "Discard Changes", "Cancel"], defaultId: 0, cancelId: 2, noLink: true });
    return ["save", "discard", "cancel"][result.response];
  });
  handle("scenepilot:commit-project-document", (event, request = {}) => {
    if (request.path === null) projectDocumentPaths.delete(event.sender.id);
    else {
      if (pendingDocumentPaths.get(event.sender.id) !== request.path) throw new Error("Open this project document before selecting its save destination.");
      projectDocumentPaths.set(event.sender.id, request.path);
    }
    pendingDocumentPaths.delete(event.sender.id);
  });
  // Protocol handlers are session-scoped. The default session cannot serve the
  // editor's persistent partition even when the scheme is globally privileged.
  installLinkedMediaProtocol(session.fromPartition(EDITOR_SESSION_PARTITION), nativeMediaUrls, DEVELOPMENT_URL);
  handle("scenepilot:media-capabilities", async () => {
    const engine = await nativeMediaEngine();
    const rotoEngine = await nativeRotoEngine();
    const inpaintProvider = await neuralInpaintProvider();
    const gpu = app.getGPUFeatureStatus();
    const gpuReady = gpu.webgl === "enabled" || gpu.webgl2 === "enabled" || gpu.gpu_compositing === "enabled";
    const provider = !gpuReady ? "cpu" : process.platform === "darwin" ? "metal" : process.platform === "win32" ? "direct3d" : process.platform === "linux" ? "vulkan" : "opengl";
    const mlAcceleration = rotoEngine.available
      ? { runtime: "apple-vision-coreml", provider: "apple-vision", gpuReady: true, native: true, model: rotoEngine.mattingAvailable ? "SAM2 Tiny + ViTMatte + Apple Vision" : rotoEngine.sam2Available ? "SAM2 Tiny Core ML + Apple Vision" : "Apple Vision person alpha", promptableObjects: rotoEngine.sam2Available, temporalMemory: true, persistentService: rotoEngine.persistentService, neuralMemory: rotoEngine.neuralMemory, alphaMatting: rotoEngine.mattingAvailable }
      : { runtime: "mediapipe-tflite", provider, gpuReady, native: false };
    return { available: engine.available, encoder: engine.encoder, hardware: engine.hardware, encoders: engine.encoders ?? {}, nativeSequenceRender: !!engine.ffmpeg, transparentVideo: !!engine.transparentVideo, imageSequences: !!engine.imageSequences, mlAcceleration, neuralInpaint: { available: inpaintProvider.available, message: inpaintProvider.message, provenance: inpaintProvider.provenance }, message: `${engine.message} · ${rotoEngine.mattingAvailable ? "Persistent SAM2 neural tracking + ViTMatte alpha ready" : rotoEngine.sam2Available ? "SAM2 object + Apple Vision person roto ready" : rotoEngine.available ? "Apple Vision person roto ready" : gpuReady ? `${provider.toUpperCase()} ML path ready` : "CPU ML fallback"}` };
  });
  handle("scenepilot:native-roto-segment", async (_event, request = {}) => {
    const engine = await nativeRotoEngine();
    const service = await nativeRotoService();
    return segmentNativeRotoFrame(engine, request, service);
  });
  handle("scenepilot:roto-cache-write", async (_event, request = {}) => writeRotoCache(rotoCacheRoot(), request));
  handle("scenepilot:roto-cache-read", async (_event, request = {}) => readRotoCache(rotoCacheRoot(), request));
  handle("scenepilot:roto-cache-clear", async (_event, { cacheKey } = {}) => clearRotoCache(rotoCacheRoot(), cacheKey));
  handle("scenepilot:inpaint-cache-write", async (_event, request = {}) => {
    const result = await writeInpaintCache(inpaintCacheRoot(), request);
    const token = randomUUID();
    nativeMediaUrls.set(token, result.outputPath);
    return { ...result, url: `scenepilot-media://inpaint/${token}` };
  });
  handle("scenepilot:inpaint-cache-read", async (_event, { cacheKey } = {}) => readInpaintCache(inpaintCacheRoot(), cacheKey));
  handle("scenepilot:inpaint-cache-clear", async (_event, { cacheKey } = {}) => clearInpaintCache(inpaintCacheRoot(), cacheKey));
  handle("scenepilot:neural-inpaint", async (_event, request = {}) => {
    const safeJobId = requireJobId(request.jobId);
    if (nativeMediaJobs.has(safeJobId)) throw new Error("That neural inpaint job is already running.");
    const provider = await neuralInpaintProvider();
    try {
      return await runNeuralInpaint(provider, request, { onSpawn: (child) => nativeMediaJobs.set(safeJobId, child) });
    } finally {
      nativeMediaJobs.delete(safeJobId);
    }
  });
  handle("scenepilot:probe-media", async (_event, { sourcePath } = {}) => {
    const engine = await nativeMediaEngine();
    return probeMedia(engine, requireAbsolutePath(sourcePath));
  });
  handle("scenepilot:register-local-media", async (_event, { sources = [] } = {}) => {
    const engine = await nativeMediaEngine();
    const registered = await mapConcurrent((Array.isArray(sources) ? sources : []).slice(0, 20_000), async (source) => {
      try {
        const id = String(source?.id ?? "").slice(0, 240);
        const sourcePath = requireAbsolutePath(source?.path);
        const sourceStat = await stat(sourcePath);
        if (!sourceStat.isFile()) return null;
        const token = randomUUID();
        nativeMediaUrls.set(token, sourcePath);
        const metadata = engine.available ? await probeMedia(engine, sourcePath).catch(() => null) : null;
        return { id, url: `scenepilot-media://source/${token}`, path: sourcePath, size: sourceStat.size, lastModified: sourceStat.mtimeMs, metadata };
      } catch { return null; }
    });
    return registered.filter(Boolean);
  });
  handle("scenepilot:create-proxy", async (event, { jobId, sourcePath, maxWidth = 1280 } = {}) => {
    const safeJobId = requireJobId(jobId);
    const safeSourcePath = requireAbsolutePath(sourcePath);
    if (nativeMediaJobs.has(safeJobId)) throw new Error("That media job is already running.");
    const engine = await nativeMediaEngine();
    const cacheDirectory = path.join(app.getPath("userData"), "media-cache", "proxies");
    try {
      const result = await createProxyJob({
        engine,
        sourcePath: safeSourcePath,
        cacheDirectory,
        maxWidth: Math.max(320, Math.min(1920, Number(maxWidth) || 1280)),
        onSpawn: (child) => nativeMediaJobs.set(safeJobId, child),
        onProgress: (progress, message) => event.sender.send("scenepilot:media-progress", { jobId: safeJobId, progress, message }),
      });
      const token = randomUUID();
      nativeMediaUrls.set(token, result.outputPath);
      return { url: `scenepilot-media://cache/${token}`, cached: result.cached, metadata: result.metadata ?? null };
    } finally {
      nativeMediaJobs.delete(safeJobId);
    }
  });
  handle("scenepilot:native-render", async (event, request = {}) => {
    const safeJobId = requireJobId(request.jobId);
    if (nativeMediaJobs.has(safeJobId)) throw new Error("That native render job is already running.");
    const engine = await nativeMediaEngine();
    if (!engine.available || !engine.ffmpeg) throw new Error("The native Desktop render service is unavailable.");
    const format = request.plan?.format === "mp4-hevc" ? "mp4-hevc" : "mp4-h264";
    if (format === "mp4-hevc" && !engine.encoders?.hevc) throw new Error("This computer does not have an available HEVC encoder.");
    const plan = sanitizeNativeRenderPlan(request.plan, format);
    const suggestedName = sanitizeRenderName(request.suggestedName ?? "ScenePilot Master.mp4");
    const owner = BrowserWindow.fromWebContents(event.sender);
    let outputPath = "";
    const rememberedDirectory = await preferredRenderDirectory();
    if (request.outputPath) {
      outputPath = requireAbsolutePath(request.outputPath);
    } else if (request.useLastRenderDirectory && rememberedDirectory) {
      outputPath = await uniqueRenderPath(rememberedDirectory, suggestedName);
    } else {
      const defaultDirectory = rememberedDirectory || app.getPath("movies");
      const choice = await dialog.showSaveDialog(owner, {
        title: "Render with ScenePilot Native Engine",
        defaultPath: path.join(defaultDirectory, suggestedName),
        filters: [{ name: format === "mp4-hevc" ? "HEVC Master" : "H.264 Master", extensions: ["mp4"] }],
      });
      if (choice.canceled || !choice.filePath) return { canceled: true };
      outputPath = choice.filePath;
    }
    await rememberRenderDirectory(path.dirname(outputPath));
    try {
      return await createNativeSequenceRenderJob({
        engine,
        plan,
        outputPath,
        onSpawn: (child) => nativeMediaJobs.set(safeJobId, child),
        onProgress: (progress, message) => event.sender.send("scenepilot:media-progress", { jobId: safeJobId, progress, message }),
      });
    } finally {
      nativeMediaJobs.delete(safeJobId);
    }
  });
  handle("scenepilot:cancel-media-job", (_event, { jobId } = {}) => {
    const child = nativeMediaJobs.get(requireJobId(jobId));
    if (!child) return false;
    child.kill("SIGTERM");
    return true;
  });
  handle("scenepilot:reveal-output", async (_event, { sourcePath } = {}) => {
    const safePath = requireAbsolutePath(sourcePath);
    await access(safePath);
    shell.showItemInFolder(safePath);
    return true;
  });
  handle("scenepilot:render-log", async (_event, entry = {}) => {
    const logsDirectory = path.join(app.getPath("userData"), "logs");
    await mkdir(logsDirectory, { recursive: true });
    const safe = {
      at: new Date().toISOString(),
      event: String(entry.event ?? "render-event").slice(0, 80),
      jobId: String(entry.jobId ?? "").slice(0, 120),
      message: String(entry.message ?? "").slice(0, 2_000),
      progress: Math.max(0, Math.min(1, Number(entry.progress) || 0)),
    };
    await appendFile(path.join(logsDirectory, "render-queue.jsonl"), `${JSON.stringify(safe)}\n`, "utf8");
    return true;
  });
  handle("scenepilot:load-render-queue", async () => {
    const queuePath = path.join(app.getPath("userData"), "render-queue.json");
    try {
      const parsed = JSON.parse(await readFile(queuePath, "utf8"));
      return Array.isArray(parsed) ? parsed.slice(-100) : [];
    } catch { return []; }
  });
  handle("scenepilot:save-render-queue", async (_event, { jobs = [] } = {}) => {
    const queuePath = path.join(app.getPath("userData"), "render-queue.json");
    const safeJobs = Array.isArray(jobs) ? jobs.slice(-100) : [];
    await writeAtomicFile(queuePath, JSON.stringify(safeJobs, null, 2));
    return true;
  });
  handle("scenepilot:collect-project", async (event, request = {}) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const choice = await dialog.showOpenDialog(owner, { title: "Choose a folder for the collected project", properties: ["openDirectory", "createDirectory"] });
    if (choice.canceled || !choice.filePaths[0]) return null;
    const projectJson = String(request.projectJson ?? "");
    if (!projectJson || projectJson.length > 50_000_000) throw new Error("The project manifest is missing or too large.");
    const sources = Array.isArray(request.sources) ? request.sources.slice(0, 20_000).map((source) => ({ id: String(source?.id ?? ""), path: requireAbsolutePath(source?.path) })) : [];
    return collectProjectPackage({ destinationDirectory: choice.filePaths[0], projectName: request.projectName, projectJson, sources });
  });
  handle("scenepilot:save-project-document", async (event, request = {}) => {
    if (savingDocuments.has(event.sender.id)) throw new Error("A project save is already in progress. Finish or cancel that save before saving again.");
    savingDocuments.add(event.sender.id);
    try {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const projectJson = String(request.projectJson ?? "");
    if (!projectJson || projectJson.length > 50_000_000) throw new Error("The project document is missing or too large.");
    JSON.parse(projectJson);
    const suggestedName = String(request.suggestedName ?? "ScenePilot Project.scenepilot.json")
      .replace(/[\\/:*?\"<>|\x00-\x1f]/g, "-")
      .slice(0, 160);
    let filePath = request.saveAs === true ? null : projectDocumentPaths.get(event.sender.id);
    if (!filePath) {
      const choice = await dialog.showSaveDialog(owner, {
        title: request.saveAs === true ? "Save ScenePilot Project As" : "Save ScenePilot Project",
        defaultPath: suggestedName.endsWith(".scenepilot.json") ? suggestedName : `${suggestedName}.scenepilot.json`,
        filters: [{ name: "ScenePilot Project", extensions: ["json"] }],
      });
      if (choice.canceled || !choice.filePath) return null;
      filePath = choice.filePath;
    }
    await writeAtomicFile(filePath, projectJson);
    projectDocumentPaths.set(event.sender.id, filePath);
    return { path: filePath };
    } finally { savingDocuments.delete(event.sender.id); }
  });
  handle("scenepilot:open-project-document", async (event, options = {}) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const recovered = options.recovery === true;
    const journalDirectory = path.join(app.getPath("userData"), "project-journals");
    if (recovered) await mkdir(journalDirectory, { recursive: true });
    const choice = await dialog.showOpenDialog(owner, {
      title: recovered ? "Recover ScenePilot Autosave — choose the newest journal in your project folder" : "Open ScenePilot Project",
      ...(recovered ? { defaultPath: journalDirectory } : {}),
      properties: ["openFile"],
      filters: [{ name: "ScenePilot Project", extensions: ["json"] }],
    });
    if (choice.canceled || !choice.filePaths[0]) return null;
    const filePath = choice.filePaths[0];
    if ((await stat(filePath)).size > 50_000_000) throw new Error("That project document is too large to open safely.");
    const text = await readFile(filePath, "utf8");
    if (text.length > 50_000_000) throw new Error("That project document is too large to open safely.");
    const parsed = JSON.parse(text);
    if (parsed?.format !== "scenepilot-cut") throw new Error("That file is not a ScenePilot project document.");
    pendingDocumentPaths.set(event.sender.id, filePath);
    return { path: filePath, text, recovered };
  });
  handle("scenepilot:journal-project", async (_event, request = {}) => {
    const projectJson = String(request.projectJson ?? "");
    if (!projectJson || projectJson.length > 50_000_000) throw new Error("The project journal entry is missing or too large.");
    const parsed = JSON.parse(projectJson);
    if (parsed?.format !== "scenepilot-cut") throw new Error("Only ScenePilot project documents can be journaled.");
    const projectId = String(request.projectId ?? "current").replace(/[^a-z0-9_-]/gi, "-").slice(0, 100) || "current";
    const directory = path.join(app.getPath("userData"), "project-journals", projectId);
    await mkdir(directory, { recursive: true });
    const savedAt = Date.now();
    const filePath = path.join(directory, `${savedAt}-${randomUUID()}.scenepilot.json`);
    await writeAtomicFile(filePath, projectJson);
    const entries = (await readdir(directory)).filter((name) => name.endsWith(".scenepilot.json")).sort().reverse();
    await Promise.all(entries.slice(20).map((name) => unlink(path.join(directory, name)).catch(() => undefined)));
    return { path: filePath, savedAt };
  });
}

async function getLatestRelease() {
  const response = await fetch(PUBLIC_RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `ScenePilot/${app.getVersion()}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  const release = await response.json();
  const asset = selectInstallerAsset(release, process.arch);
  if (!asset?.browser_download_url) throw new Error(`The latest release has no ${process.arch} macOS installer`);
  let expectedDigest = parseSha256(asset.digest);
  if (!expectedDigest) {
    const checksum = release.assets?.find(({ name }) => name === `${asset.name}.sha256`);
    if (checksum?.browser_download_url) {
      const checksumResponse = await fetch(checksum.browser_download_url, { headers: { "User-Agent": `ScenePilot/${app.getVersion()}` } });
      if (checksumResponse.ok) expectedDigest = parseSha256(await checksumResponse.text());
    }
  }
  if (!expectedDigest) throw new Error("The latest installer does not include a verifiable SHA-256 checksum");
  return { version: String(release.tag_name || "").replace(/^v/, ""), asset, expectedDigest };
}

function downloadUpdate(window, release) {
  if (updateDownloadActive) return;
  updateDownloadActive = true;
  const destination = path.join(app.getPath("downloads"), path.basename(release.asset.name));
  const downloadSession = window.webContents.session;
  const handleDownload = (_event, item) => {
    if (item.getURL() !== release.asset.browser_download_url) return;
    downloadSession.removeListener("will-download", handleDownload);
    item.setSavePath(destination);
    item.once("done", async (_downloadEvent, state) => {
      updateDownloadActive = false;
      if (state !== "completed") {
        await dialog.showMessageBox(window, { type: "error", title: "Update failed", message: "ScenePilot could not download the update.", detail: "Check your connection and try again from the Help menu." });
        return;
      }
      if (!await verifyFileDigest(destination, release.expectedDigest)) {
        await unlink(destination).catch(() => undefined);
        await dialog.showMessageBox(window, { type: "error", title: "Update blocked", message: "The downloaded installer failed its security check.", detail: "ScenePilot deleted the file because its SHA-256 checksum did not match the GitHub release." });
        return;
      }
      const choice = await dialog.showMessageBox(window, {
        type: "info",
        title: "Update ready",
        message: `ScenePilot ${release.version} is ready to install.`,
        detail: "Open the installer, then drag ScenePilot into Applications to replace this version.",
        buttons: ["Open Installer", "Later"],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice.response === 0) await shell.openPath(destination);
    });
  };
  downloadSession.on("will-download", handleDownload);
  window.webContents.downloadURL(release.asset.browser_download_url);
}

async function checkForUpdates({ manual = false } = {}) {
  const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!window) return;
  try {
    const release = await getLatestRelease();
    if (compareVersions(release.version, app.getVersion()) <= 0) {
      if (manual) await dialog.showMessageBox(window, { type: "info", title: "ScenePilot is up to date", message: `You have the latest version (${app.getVersion()}).` });
      return;
    }
    const choice = await dialog.showMessageBox(window, {
      type: "info",
      title: "ScenePilot update available",
      message: `Version ${release.version} is ready.`,
      detail: `You are running ${app.getVersion()}. Download the new installer now?`,
      buttons: ["Download Update", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice.response === 0) downloadUpdate(window, release);
  } catch (error) {
    if (manual) await dialog.showMessageBox(window, { type: "error", title: "Update check failed", message: "ScenePilot could not check for updates.", detail: error instanceof Error ? error.message : String(error) });
  }
}

function createMenu() {
  const sendEditorAction = (action) => {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!window) return;
    window.webContents.send("scenepilot:action", action);
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "ScenePilot",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        { label: "New Project…", accelerator: "CmdOrCtrl+N", click: () => sendEditorAction("new-project") },
        { label: "Import Media…", accelerator: "CmdOrCtrl+I", click: () => sendEditorAction("import") },
        { label: "Open Project Document…", accelerator: "CmdOrCtrl+O", click: () => sendEditorAction("open-project-document") },
        { type: "separator" },
        { label: "Save Project", accelerator: "CmdOrCtrl+S", click: () => sendEditorAction("save") },
        { label: "Save Project Document As…", accelerator: "CmdOrCtrl+Shift+S", click: () => sendEditorAction("save-project-document") },
        { label: "Add Sequence to Render Queue", accelerator: "CmdOrCtrl+E", click: () => sendEditorAction("export") },
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", click: () => sendEditorAction("undo") },
        { label: "Redo", accelerator: "CmdOrCtrl+Shift+Z", click: () => sendEditorAction("redo") },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Timeline",
      submenu: [
        { label: "Selection Tool", accelerator: "V", registerAccelerator: false, click: () => sendEditorAction("tool-select") },
        { label: "Razor Tool", accelerator: "C", registerAccelerator: false, click: () => sendEditorAction("tool-razor") },
        { label: "Rate Stretch Tool", accelerator: "R", registerAccelerator: false, click: () => sendEditorAction("tool-rate") },
        { label: "Slip Tool", accelerator: "Y", registerAccelerator: false, click: () => sendEditorAction("tool-slip") },
        { label: "Slide Tool", accelerator: "U", registerAccelerator: false, click: () => sendEditorAction("tool-slide") },
        { label: "Rolling Edit Tool", accelerator: "N", registerAccelerator: false, click: () => sendEditorAction("tool-roll") },
        { label: "Fade Tool", accelerator: "F", registerAccelerator: false, click: () => sendEditorAction("tool-fade") },
        { type: "separator" },
        { label: "Add Marker", accelerator: "M", registerAccelerator: false, click: () => sendEditorAction("marker") },
        { label: "Mark In", accelerator: "I", registerAccelerator: false, click: () => sendEditorAction("mark-in") },
        { label: "Mark Out", accelerator: "O", registerAccelerator: false, click: () => sendEditorAction("mark-out") },
      ],
    },
    {
      label: "Workspace",
      submenu: [
        { label: "Auto Edit", accelerator: "CmdOrCtrl+1", click: () => sendEditorAction("auto") },
        { label: "Edit", accelerator: "CmdOrCtrl+2", click: () => sendEditorAction("edit") },
        { label: "Composition", accelerator: "CmdOrCtrl+3", click: () => sendEditorAction("composition") },
        { type: "separator" },
        { label: "Color", accelerator: "CmdOrCtrl+4", click: () => sendEditorAction("color") },
        { label: "Audio", accelerator: "CmdOrCtrl+5", click: () => sendEditorAction("audio") },
        { label: "Deliver", accelerator: "CmdOrCtrl+6", click: () => sendEditorAction("deliver") },
      ],
    },
    { label: "View", submenu: [{ role: "reload" }, { role: "forceReload" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] },
    { label: "Help", submenu: [
      { label: "Check for Updates...", click: () => void checkForUpdates({ manual: true }) },
      { label: "Reveal Diagnostic Logs", click: async () => { await mkdir(diagnosticsDirectory(), { recursive: true }); await shell.openPath(diagnosticsDirectory()); } },
      { type: "separator" },
      { label: "ScenePilot Online", click: () => shell.openExternal(ONLINE_URL) },
    ] },
  ]));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 680,
    title: "ScenePilot Studio",
    backgroundColor: "#090d0c",
    icon: APP_ICON,
    show: false,
    webPreferences: {
      partition: EDITOR_SESSION_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  const userAgent = `${window.webContents.getUserAgent()} ScenePilotDesktop/${app.getVersion()}`;
  window.webContents.setUserAgent(userAgent);
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    if (DEVELOPMENT_URL && target.origin === new URL(DEVELOPMENT_URL).origin) return;
    if (target.protocol === "file:" && fileURLToPath(target) === DESKTOP_ENTRY) return;
    event.preventDefault();
  });
  window.webContents.on("will-prevent-unload", (event) => {
    const answer = dialog.showMessageBoxSync(window, { type: "warning", message: "Save your project before closing?", detail: "Unsaved changes will be lost. Finish or cancel any active processing before saving and closing.", buttons: ["Save", "Discard and Close", "Cancel"], defaultId: 0, cancelId: 2, noLink: true });
    if (answer === 1) event.preventDefault();
    else if (answer === 0) window.webContents.send("scenepilot:action", "save-and-close");
  });
  const webContentsId = window.webContents.id;
  window.webContents.once("destroyed", () => { projectDocumentPaths.delete(webContentsId); pendingDocumentPaths.delete(webContentsId); for (const child of nativeMediaJobs.values()) child.kill("SIGTERM"); });
  window.on("unresponsive", () => recordDiagnostic("renderer-unresponsive", "The editor window stopped responding.", { webContentsId }));
  window.webContents.on("render-process-gone", (_event, details) => recordDiagnostic("renderer-process-gone", details.reason, { webContentsId, reason: details.reason, exitCode: details.exitCode }));
  window.once("ready-to-show", () => window.show());
  if (DEVELOPMENT_URL) void window.loadURL(DEVELOPMENT_URL);
  else void window.loadFile(DESKTOP_ENTRY);
  return window;
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.whenReady().then(() => {
    app.setAboutPanelOptions({ applicationName: "ScenePilot", applicationVersion: app.getVersion(), copyright: "Copyright © 2026 ScenePilot Studio" });
    createMenu();
    installNativeMediaHandlers();
    app.on("child-process-gone", (_event, details) => recordDiagnostic("child-process-gone", details.reason, { type: details.type, reason: details.reason, exitCode: details.exitCode, serviceName: details.serviceName ?? "" }));
    recordDiagnostic("app-start", "ScenePilot desktop started.");
    createWindow();
    const firstUpdateCheck = setTimeout(() => void checkForUpdates(), 5000);
    const recurringUpdateCheck = setInterval(() => void checkForUpdates(), UPDATE_INTERVAL_MS);
    firstUpdateCheck.unref();
    recurringUpdateCheck.unref();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void nativeRotoServicePromise?.then((service) => service?.close()).catch(() => {});
});
