import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, copyFile, cp, mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("Native migration packaging currently targets Apple Silicon macOS only.");
const developer = process.env.DEVELOPER_DIR || "/Applications/Xcode.app/Contents/Developer";
await access(developer);
const env = { ...process.env, DEVELOPER_DIR: developer };
const app = path.join(root, "release", "ScenePilot Native.app");
const contents = path.join(app, "Contents");
await run("swift", ["build", "--package-path", "native-macos", "-c", "release", "--arch", "arm64"], { cwd: root, env, maxBuffer: 10 * 1024 * 1024 });
const { stdout } = await run("swift", ["build", "--package-path", "native-macos", "-c", "release", "--arch", "arm64", "--show-bin-path"], { cwd: root, env });
await mkdir(path.join(contents, "MacOS"), { recursive: true });
await mkdir(path.join(contents, "Resources"), { recursive: true });
// Native Core ML helper + locally staged, licensed weights. No JS service is shipped.
await run(process.execPath, ["scripts/build-native-roto.mjs"], { cwd: root, env, maxBuffer: 10 * 1024 * 1024 });
await mkdir(path.join(contents, "Resources", "native-tools"), { recursive: true });
await copyFile(path.join(root, "electron/native-tools/scenepilot-vision-roto"), path.join(contents, "Resources/native-tools/scenepilot-vision-roto"));
await cp(path.join(root, "electron/native-models/sam2-tiny"), path.join(contents, "Resources/native-models/sam2-tiny"), { recursive: true });
await run("codesign", ["--force", "--sign", "-", path.join(contents, "Resources/native-tools/scenepilot-vision-roto")]);
// Replace the executable inode atomically. Overwriting a running Mach-O in place
// can invalidate its signed code pages and terminate the user's existing app.
const executable = path.join(contents, "MacOS", "ScenePilotNative");
const stagedExecutable = `${executable}.${randomUUID()}.staged`;
await copyFile(path.join(stdout.trim(), "ScenePilotNative"), stagedExecutable);
await rename(stagedExecutable, executable);
await writeFile(path.join(contents, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>ScenePilotNative</string>
<key>CFBundleIdentifier</key><string>com.armonon.scenepilot.native-preview</string>
<key>CFBundleName</key><string>ScenePilot Native</string>
<key>CFBundleDisplayName</key><string>ScenePilot Native</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.3.0</string>
<key>CFBundleVersion</key><string>3</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>\n`);
await run("codesign", ["--force", "--sign", "-", app]);
await run("codesign", ["--verify", "--deep", "--strict", app]);
const { stdout: linked } = await run("otool", ["-L", path.join(contents, "MacOS", "ScenePilotNative")]);
if (/Electron|WebKit|JavaScriptCore|libnode/i.test(linked)) throw new Error("Unexpected web runtime dependency in the native binary.");
console.log(JSON.stringify({ app, native: true, distribution: "Local ad-hoc-signed migration preview, not a notarized public release", linkedLibraries: linked }, null, 2));
