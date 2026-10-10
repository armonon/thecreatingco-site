import assert from "node:assert/strict";
import test from "node:test";
import { createSilentWavFile, materializePathBackedFile, mediaMime, probeMediaAudio } from "../app/media-file-utils.ts";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";

test("media MIME inference covers native project stubs", () => {
  assert.equal(mediaMime("video", "shot.MOV"), "video/quicktime");
  assert.equal(mediaMime("video", "proxy.webm"), "video/webm");
  assert.equal(mediaMime("audio", "mix.wav"), "audio/wav");
  assert.equal(mediaMime("image", "matte.png"), "image/png");
});

test("silent fallback media is a bounded valid PCM WAV", async () => {
  const file = createSilentWavFile(.25);
  const bytes = new Uint8Array(await file.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WAVE");
  assert.equal(new TextDecoder().decode(bytes.slice(36, 40)), "data");
  assert.equal(bytes.length, 44 + 2_000 * 2);
});

test("ordinary in-memory files bypass desktop materialization", async () => {
  const file = new File(["frame"], "frame.bin");
  assert.equal(await materializePathBackedFile(file, "blob:test"), file);
});

test("container probing distinguishes silent video from real embedded audio without decoding PCM", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "scenepilot-audio-presence-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const audio of [false, true]) {
    const filename = path.join(directory, audio ? "with-audio.mp4" : "silent.mp4");
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=blue:s=32x32:r=30:d=0.2",
      ...(audio ? ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=0.2", "-c:a", "aac"] : ["-an"]),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", filename]);
    const file = new File([await readFile(filename)], path.basename(filename), { type: "video/mp4" });
    assert.equal(await probeMediaAudio(file), audio);
  }
});

test("failed probes and path-backed placeholders remain unknown, not silent", async () => {
  assert.equal(await probeMediaAudio(new File(["not a valid container"], "broken.mp4")), undefined);
  assert.equal(await probeMediaAudio(new File([], "linked.mp4")), undefined);
});
