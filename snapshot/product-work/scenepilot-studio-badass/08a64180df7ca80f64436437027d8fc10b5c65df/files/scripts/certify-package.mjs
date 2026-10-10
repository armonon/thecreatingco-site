import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import asar from "@electron/asar";
import { detectNativeMediaEngine } from "../electron/media-engine.js";
import { detectNativeRotoEngine } from "../electron/native-roto.js";
import { releaseSourceDigest } from "./release-evidence.mjs";

const run = promisify(execFile);
const root = path.resolve(new URL("..", import.meta.url).pathname);
const appPath = path.resolve(process.argv[2] || "release/mac-arm64/ScenePilot.app");
const resources = path.join(appPath, "Contents", "Resources");
const archive = path.join(resources, "app.asar");
const checks = [];
const check = (name, condition, details) => { checks.push({ name, passed: Boolean(condition), details }); if (!condition) throw new Error(`${name}: ${details}`); };
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = { schema: "scenepilot-package-certificate/v1", scope: "Local archive/resource checks; NOT a clean-machine installation or oldest-macOS certification", createdAt: new Date().toISOString() };
try {
  const bundled = JSON.parse(asar.extractFile(archive, "package.json"));
  const expected = JSON.parse(await readFile(path.join(root, "electron/package.json"), "utf8"));
  check("package version", bundled.version === expected.version, bundled.version);
  const { stdout: minimum } = await run("/usr/libexec/PlistBuddy", ["-c", "Print :LSMinimumSystemVersion", path.join(appPath, "Contents/Info.plist")]);
  check("declared macOS floor", minimum.trim() === "13.0", minimum.trim());
  for (const file of expected.build.files.filter((name) => /\.(?:js|cjs|mjs)$/.test(name) && !name.includes("*"))) {
    const matches = asar.extractFile(archive, file).equals(await readFile(path.join(root, "electron", file)));
    check(`bundled ${file} matches source`, matches, matches ? "byte-identical" : "stale or different packaged source; rebuild this candidate");
  }
  for (const file of ["renderer/desktop/index.html", "renderer/models/interactive_segmentation.task", "renderer/mediapipe/wasm/vision_wasm_internal.wasm"]) check(`resource ${file}`, asar.statFile(archive, file).size > 0, "present");
  const rendererRoot = path.join(root, "electron/renderer");
  const rendererFiles = (await readdir(rendererRoot, { recursive: true })).filter(file => /\.(?:html|js|css)$/.test(file));
  for (const file of rendererFiles) {
    if (!asar.extractFile(archive, `renderer/${file}`).equals(await readFile(path.join(rendererRoot, file)))) throw new Error(`Packaged renderer is stale: ${file}`);
  }
  check("renderer matches current build", rendererFiles.length > 0, `${rendererFiles.length} HTML/JS/CSS files byte-identical`);
  // Certification must test the delivered binaries, not developer overrides.
  const media = await detectNativeMediaEngine({ resourcesPath: resources, env: {} });
  check("media engine uses bundled executables", media.available && media.ffmpeg?.startsWith(resources + path.sep) && media.ffprobe?.startsWith(resources + path.sep), media.encoder);
  const roto = await detectNativeRotoEngine({ resourcesPath: resources });
  check("native roto service launches from bundle", roto.available && roto.sam2Available && roto.mattingAvailable && roto.executable?.startsWith(resources + path.sep), roto.version);
  const { stdout: target } = await run("xcrun", ["vtool", "-show-build", roto.executable]);
  check("native roto deployment target", /minos 13\.0/.test(target), target.trim());
  const modelRoot = path.join(resources, "native-models/sam2-tiny");
  const manifest = JSON.parse(await readFile(path.join(modelRoot, "scenepilot-model.json"), "utf8"));
  for (const file of manifest.files) {
    const bytes = await readFile(path.join(modelRoot, file.relative));
    check(`model integrity ${file.relative}`, bytes.length === file.bytes && sha(bytes) === file.sha256, `${bytes.length} bytes`);
  }
  for (const file of ["native-models/sam2-tiny/Apache-2.0.txt", "native-models/sam2-tiny/ViTMatte-MIT.txt", "media-tools/FFMPEG-LICENSE.txt", "inpaint-provider/GMCNN-LICENSE.txt"]) check(`notice ${file}`, (await stat(path.join(resources, file))).size > 0, "bundled; legal sufficiency requires owner review");
  await run("codesign", ["--verify", "--deep", "--strict", appPath]);
  check("code signature integrity", true, "valid on disk; this does not imply Developer ID or notarization");
  const { stderr: signature } = await run("codesign", ["-dv", "--verbose=2", appPath]);
  const developerId = signature.includes("Authority=Developer ID Application:");
  let gatekeeper = false;
  try { await run("spctl", ["--assess", "--type", "execute", appPath], { timeout: 30000 }); gatekeeper = true; } catch { /* expected for an ad-hoc preview */ }
  Object.assign(report, { passed: true, sourceSha256: await releaseSourceDigest(root), version: bundled.version, archiveSha256: sha(await readFile(archive)), distribution: { developerId, gatekeeperAccepted: gatekeeper, publicReleaseReady: developerId && gatekeeper }, checks });
} catch (error) { Object.assign(report, { passed: false, error: String(error), checks }); process.exitCode = 1; }
console.log(JSON.stringify(report, null, 2));
