import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";

// FFmpeg generates test fixtures only. The app and exports use Apple frameworks.
const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.platform !== "darwin") throw new Error("Native qualification needs macOS and Xcode.");
const output = path.join(root, "outputs", "native-macos");
await mkdir(output, { recursive: true });
for (const [name, color, frequency] of [["red", "red", 440], ["blue", "blue", 880]]) {
  await run(ffmpeg, ["-y", "-f", "lavfi", "-i", `color=c=${color}:s=640x360:r=30:d=3`, "-f", "lavfi", "-i", `sine=frequency=${frequency}:sample_rate=48000:duration=3`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(output, `${name}.mp4`)]);
}
await run(ffmpeg, ["-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=3", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(output, "pattern.mp4")]);
const env = { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || "/Applications/Xcode.app/Contents/Developer", SCENEPILOT_NATIVE_QA_MEDIA: path.join(output, "red.mp4"), SCENEPILOT_NATIVE_QA_SECOND: path.join(output, "blue.mp4"), SCENEPILOT_NATIVE_QA_PATTERN: path.join(output, "pattern.mp4"), SCENEPILOT_NATIVE_QA_OUTPUT: path.join(output, "native-master.mp4") };
try {
  const result = await run("swift", ["test", "--package-path", "native-macos"], { cwd: root, env, maxBuffer: 20 * 1024 * 1024 });
  await writeFile(path.join(output, "tests.log"), result.stdout + result.stderr);
  console.log(result.stdout);
  const { stdout } = await run(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", env.SCENEPILOT_NATIVE_QA_OUTPUT]);
  const probe = JSON.parse(stdout);
  if (!probe.streams.some(stream => stream.codec_type === "video") || !probe.streams.some(stream => stream.codec_type === "audio")) throw new Error("Native master is missing audio or video.");
  const report = { passed: true, generatedAt: new Date().toISOString(), scope: "Native migration slice only; not legacy parity or full Pro qualification", probe };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(`Native qualification passed: ${output}`);
} catch (error) {
  await writeFile(path.join(output, "tests.log"), (error.stdout || "") + (error.stderr || "") + String(error));
  await writeFile(path.join(output, "report.json"), JSON.stringify({ passed: false, error: String(error) }, null, 2));
  throw error;
}
