import { execFile } from "node:child_process";
import { mkdtemp, mkdir, open, readFile, unlink, rm } from "node:fs/promises";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { writeAtomicFile } from "../electron/atomic-file.js";

// Fill only a dedicated 32 MB disk image, never the user's system volume.
const run = promisify(execFile);
if (process.platform !== "darwin") throw new Error("This isolated disk-pressure certificate requires macOS hdiutil.");
const workspace = await mkdtemp(path.join(os.tmpdir(), "scenepilot-disk-pressure-"));
const mount = path.join(workspace, "volume");
let mounted = false;
let passed = false;
try {
  await mkdir(mount);
  await run("hdiutil", ["create", "-size", "32m", "-fs", "HFS+", "-volname", "ScenePilot QA", path.join(workspace, "disk.dmg")], { timeout: 30000 });
  await run("hdiutil", ["attach", path.join(workspace, "disk.dmg"), "-mountpoint", mount, "-nobrowse"], { timeout: 30000 }); mounted = true;
  const document = path.join(mount, "project.json");
  await writeAtomicFile(document, '{"revision":1}');
  const filler = path.join(mount, "filler");
  const handle = await open(filler, "wx");
  let full = false;
  try {
    const bytes = Buffer.alloc(1024 * 1024, 1);
    // Hard upper bound protects against a mount failure or unexpected volume.
    for (let i = 0; i < 40; i++) await handle.write(bytes);
  } catch (error) { if (error.code !== "ENOSPC") throw error; full = true; }
  finally { await handle.close(); }
  if (!full) throw new Error("Dedicated fixture did not reach ENOSPC within the 40 MB limit.");
  let code;
  try { await writeAtomicFile(document, JSON.stringify({ revision: 2, payload: "x".repeat(4 * 1024 * 1024) })); }
  catch (error) { code = error.code; }
  if (code !== "ENOSPC" || await readFile(document, "utf8") !== '{"revision":1}') throw new Error("Disk-full save did not safely preserve the previous document.");
  await unlink(filler);
  await writeAtomicFile(document, '{"revision":3}');
  if (await readFile(document, "utf8") !== '{"revision":3}') throw new Error("Save did not recover after space was freed.");
  passed = true;
  console.log(JSON.stringify({ schema: "scenepilot-disk-pressure/v1", passed, volumeMegabytes: 32, observedError: code, previousDocumentPreserved: true, retrySucceeded: true }, null, 2));
} finally {
  if (mounted) { await run("hdiutil", ["detach", mount], { timeout: 30000 }); mounted = false; }
  if (!mounted && passed) await rm(workspace, { recursive: true, force: true });
}
