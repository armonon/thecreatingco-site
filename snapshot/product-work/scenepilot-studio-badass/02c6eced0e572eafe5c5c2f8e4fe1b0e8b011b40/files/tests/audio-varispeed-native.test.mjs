import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import { buildNativeAudioClipFilters, buildNativeSequenceRenderArgs, sanitizeNativeRenderPlan } from "../electron/media-engine.js";
import { audioFadeGainAt } from "../lib/audio-crossfade.ts";
const run = promisify(execFile);

test("native stereo and mono panning preserve the preview's channel coefficients", async () => {
  for (const channels of [1, 2]) for (const pan of [-1, -.5, 0, .5, 1]) {
    const clip = { duration: .1, gain: 1, pan, channels, processing: { compressorRatio: 1, limiter: false } };
    const signal = channels === 1 ? "aevalsrc=0.1:s=48000:d=0.1" : "aevalsrc=0.1|0.2:s=48000:d=0.1";
    const { stdout } = await run(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", signal, "-filter_complex", buildNativeAudioClipFilters(clip, 0, "out"), "-map", "[out]", "-f", "f32le", "pipe:1"], { encoding: "buffer", timeout: 15000 });
    const samples = new Float32Array(stdout.buffer, stdout.byteOffset, stdout.length / 4);
    const angle = (pan <= 0 ? pan + 1 : pan) * Math.PI / 2;
    const expected = channels === 1 ? [.1 * Math.cos((pan + 1) * Math.PI / 4), .1 * Math.sin((pan + 1) * Math.PI / 4)] : pan <= 0 ? [.1 + .2 * Math.cos(angle), .2 * Math.sin(angle)] : [.1 * Math.cos(angle), .2 + .1 * Math.sin(angle)];
    assert.ok(Math.abs(samples[2000] - expected[0]) < 1e-6, `left: channels=${channels}, pan=${pan}`);
    assert.ok(Math.abs(samples[2001] - expected[1]) < 1e-6, `right: channels=${channels}, pan=${pan}`);
  }
});

test("native fade shapes match the shared overlapping envelope", async () => {
  for (const fadeShape of ["linear", "equalPower", "exponential"]) {
    const clip = { duration: 1, gain: 1, pan: 0, channels: 2, fadeIn: .8, fadeOut: .8, fadeShape, processing: { compressorRatio: 1, limiter: false } };
    const { stdout } = await run(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "aevalsrc=0.1|0.1:s=48000:d=1", "-filter_complex", buildNativeAudioClipFilters(clip, 0, "out"), "-map", "[out]", "-f", "f32le", "pipe:1"], { encoding: "buffer", timeout: 15000, maxBuffer: 500000 });
    const samples = new Float32Array(stdout.buffer, stdout.byteOffset, stdout.length / 4);
    for (const t of [.25, .5, .75]) assert.ok(Math.abs(samples[Math.round(t * 48000) * 2] - .1 * audioFadeGainAt(t, 1, .8, .8, fadeShape)) < 1e-5, `${fadeShape} at ${t}`);
  }
});

test("native audio varispeed changes duration and pitch together", async () => {
  for (const rate of [.5, 2]) {
    const clip = { duration: 1, playbackRate: rate, gain: 1, pan: 0, fadeIn: 0, fadeOut: 0 };
    const filter = buildNativeAudioClipFilters(clip, 0, "out");
    const { stdout } = await run(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${rate}`, "-filter_complex", filter, "-map", "[out]", "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"], { encoding: "buffer", maxBuffer: 500000, timeout: 15000 });
    const samples = new Float32Array(stdout.buffer, stdout.byteOffset, stdout.length / 4);
    assert.ok(Math.abs(samples.length - 48000) < 100, `rate ${rate}: ${samples.length} frames`);
    let crossings = 0;
    for (let i = 4801; i < 28800; i++) if (samples[i - 1] <= 0 && samples[i] > 0) crossings++;
    assert.ok(Math.abs(crossings / .5 - 440 * rate) < 5, `rate ${rate}: ${crossings / .5} Hz`);
  }
});

test("native sequence reads the full retimed audio source span", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "scenepilot-varispeed-"));
  try {
    const source = path.join(dir, "source.mp4"), output = path.join(dir, "render.mp4");
    await run(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=blue:s=160x90:r=24:d=2", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", "-c:v", "libx264", "-c:a", "aac", "-shortest", source], { timeout: 15000 });
    const plan = sanitizeNativeRenderPlan({ clips: [{ sourcePath: source, sourceStart: 0, duration: 1 }], audioClips: [{ sourcePath: source, start: 0, sourceStart: 0, duration: 1, playbackRate: 2, gain: 1, pan: 0 }], duration: 1, width: 160, height: 90, frameRate: 24 });
    assert.equal(plan.audioClips[0].playbackRate, 2);
    await run(ffmpeg, buildNativeSequenceRenderArgs({ ...plan, outputPath: output, encoder: "libx264" }), { timeout: 15000 });
    const { stdout } = await run(ffmpeg, ["-v", "error", "-i", output, "-map", "0:a", "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"], { encoding: "buffer", maxBuffer: 500000, timeout: 15000 });
    const samples = new Float32Array(stdout.buffer, stdout.byteOffset, stdout.length / 4);
    let crossings = 0, energy = 0;
    for (let i = 28801; i < 43200; i++) { if (samples[i - 1] <= 0 && samples[i] > 0) crossings++; energy += samples[i] ** 2; }
    assert.ok(energy > 1, "the second half must not truncate from a 1x source read");
    assert.ok(Math.abs(crossings / .3 - 880) < 8);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
