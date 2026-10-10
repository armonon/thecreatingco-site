#!/usr/bin/env node
import { spawn } from "node:child_process";
import { chmod, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.platform !== "darwin") {
  process.stdout.write(`Native Vision roto is not built for ${process.platform}; the renderer ML fallback remains active.\n`);
  process.exit(0);
}
const source = path.join(root, "electron", "native", "ScenePilotVisionRoto.swift");
const destinationDirectory = path.join(root, "electron", "native-tools");
const destination = path.join(destinationDirectory, "scenepilot-vision-roto");
await mkdir(destinationDirectory, { recursive: true });
await new Promise((resolve, reject) => {
  const child = spawn("xcrun", ["swiftc", source, "-O", "-target", "arm64-apple-macos13.0", "-o", destination, "-framework", "Vision", "-framework", "CoreML", "-framework", "CoreGraphics", "-framework", "CoreVideo"], { stdio: "inherit" });
  child.once("error", reject);
  child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`swiftc exited ${code}`)));
});
await chmod(destination, 0o755);
process.stdout.write(`Built Apple Vision/CoreML roto service at ${destination}.\n`);
