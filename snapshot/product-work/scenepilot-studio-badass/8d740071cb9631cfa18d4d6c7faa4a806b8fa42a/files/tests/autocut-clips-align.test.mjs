import assert from "node:assert/strict";
import test from "node:test";
import { detectSceneCuts, frameIssue, profileClip, usableCoverage, windowQuality } from "../lib/autocut-clips.ts";
import { alignEnvelopes, alignTake, crossCorrelate, fft, isSynced, onsetEnvelope, overlapCorrelation } from "../lib/autocut-align.ts";
import { noiseSource, synthSong } from "./helpers/autocut-synth.mjs";

// ---- Clip analysis --------------------------------------------------------

/** 4 samples/s. `scene(t)` returns a [brightness, sharpness] look; changes between looks are hard cuts. */
function samplesFor(duration, scene, { motion = 0.03, rate = 4 } = {}) {
  const out = [];
  let previous = null;
  for (let t = 0; t < duration; t += 1 / rate) {
    const look = scene(t);
    const changed = previous && previous.id !== look.id;
    out.push({
      time: t, brightness: look.brightness, sharpness: look.sharpness, contrast: look.contrast ?? 0.3,
      motion: changed ? 0.45 : previous ? (look.motion ?? motion) : 0,
      histogramDistance: changed ? 0.7 : previous ? 0.02 : 0,
      faces: look.faces, faceX: look.faceX,
    });
    previous = look;
  }
  return out;
}

const day = { id: "day", brightness: 0.5, sharpness: 0.3 };
const night = { id: "night", brightness: 0.3, sharpness: 0.25 };
const black = { id: "black", brightness: 0.01, sharpness: 0, contrast: 0 };

test("frame issues: black, blown, blank, soft", () => {
  assert.equal(frameIssue({ brightness: 0.02, sharpness: 0.3, contrast: 0.3 }), "black");
  assert.equal(frameIssue({ brightness: 0.99, sharpness: 0.3, contrast: 0.3 }), "white");
  assert.equal(frameIssue({ brightness: 0.5, sharpness: 0.001, contrast: 0.01 }), "blank");
  assert.equal(frameIssue({ brightness: 0.5, sharpness: 0.05, contrast: 0.3 }, 0.1), "soft");
  assert.equal(frameIssue({ brightness: 0.5, sharpness: 0.3, contrast: 0.3 }, 0.1), null);
});

test("usable segments skip black frames and split at internal scene cuts", () => {
  // 0–2 s black (slate/fade-in), 2–6 s day, 6–10 s night (hard cut at 6).
  const samples = samplesFor(10, (t) => (t < 2 ? black : t < 6 ? day : night));
  const cuts = detectSceneCuts(samples);
  assert.ok(cuts.some((time) => Math.abs(time - 6) < 0.3), `cut near 6 s: ${cuts}`);
  const profile = profileClip("c1", "clip.mp4", 10, samples);
  assert.equal(profile.segments.length, 2, JSON.stringify(profile.segments));
  const [first, second] = profile.segments;
  assert.ok(first.start >= 1.8 && first.start <= 2.2, `first starts after the black: ${first.start}`);
  assert.ok(first.end <= 6.0 && first.end >= 5.6);
  assert.ok(second.start >= 5.8 && second.end <= 10);
  assert.ok(Math.abs(profile.usable - 8) < 0.6, `usable ${profile.usable}`);
  assert.ok(profile.hero > 0.4);
});

test("an all-black clip has nothing usable and says so", () => {
  const profile = profileClip("b", "black.mp4", 5, samplesFor(5, () => black));
  assert.equal(profile.segments.length, 0);
  assert.ok(profile.notes.includes("mostly black"));
  assert.ok(profile.notes.some((note) => note.includes("skipped")));
});

test("a focus miss inside an otherwise sharp clip is cut out; static clips are flagged and rank lower", () => {
  const soft = { id: "day", brightness: 0.5, sharpness: 0.05 };
  const samples = samplesFor(8, (t) => (t >= 3 && t < 5 ? soft : day));
  const profile = profileClip("f", "focus.mp4", 8, samples);
  assert.ok(profile.segments.every((segment) => segment.end <= 3.2 || segment.start >= 4.8), JSON.stringify(profile.segments));
  const still = profileClip("s", "still.mp4", 8, samplesFor(8, () => day, { motion: 0 }));
  const moving = profileClip("m", "moving.mp4", 8, samplesFor(8, () => day, { motion: 0.05 }));
  assert.ok(still.notes.includes("static"));
  assert.ok(still.segments[0].quality < moving.segments[0].quality);
  assert.ok(moving.energy > still.energy);
});

test("faces raise hero score and steer the crop focus", () => {
  const face = { ...day, faces: 1, faceX: 0.7 };
  const withFace = profileClip("w", "face.mp4", 6, samplesFor(6, () => face));
  const without = profileClip("n", "noface.mp4", 6, samplesFor(6, () => day));
  assert.ok(withFace.hero > without.hero);
  assert.ok(Math.abs(withFace.focusX - 0.7) < 1e-6);
  assert.equal(without.focusX, 0.5);
});

test("window coverage and quality", () => {
  const segments = [{ start: 0, end: 4, quality: 1 }, { start: 6, end: 10, quality: 0.5 }];
  assert.equal(usableCoverage(segments, 2, 8), 4 / 6);
  assert.ok(Math.abs(windowQuality(segments, 2, 8) - (2 * 1 + 2 * 0.5) / 6) < 1e-9);
});

// ---- Performance alignment -------------------------------------------------

test("FFT and cross-correlation match brute force", () => {
  const re = Float64Array.from([1, 2, 3, 4, 0, -1, 0.5, 2]);
  const im = new Float64Array(8);
  const copy = Float64Array.from(re);
  fft(re, im);
  fft(re, im, true);
  for (let i = 0; i < 8; i++) assert.ok(Math.abs(re[i] - copy[i]) < 1e-9);
  const a = [0, 1, 0, 0, 2, 0, 0, 1, 0];
  const b = [1, 0, 0, 2];
  const { values, minLag } = crossCorrelate(a, b);
  for (let lag = -(b.length - 1); lag < a.length; lag++) {
    let sum = 0;
    for (let n = 0; n < b.length; n++) if (n + lag >= 0 && n + lag < a.length) sum += a[n + lag] * b[n];
    assert.ok(Math.abs(values[lag - minLag] - sum) < 1e-9, `lag ${lag}`);
  }
  assert.ok(Math.abs(overlapCorrelation([1, 2, 3, 4], [2, 4, 6], 1).r - 1) < 1e-9);
});

const master = synthSong({
  bpm: 112,
  sampleRate: 16000,
  seed: 3,
  melody: true,
  sections: [{ bars: 4, level: 0.4, busy: false }, { bars: 6, level: 0.8, busy: true }, { bars: 4, level: 0.5, busy: true }, { bars: 4, level: 1, busy: true }],
});

/** A phone-mic "take": a slice of the master, quieter, with room echo, hiss and a different start. */
function recordTake(start, length, { lead = 0, seed = 11 } = {}) {
  const rate = master.sampleRate;
  const noise = noiseSource(seed);
  const total = Math.round((length + lead) * rate);
  const out = new Float32Array(total);
  const delay = Math.round(0.031 * rate);
  for (let i = 0; i < total; i++) {
    const songIndex = Math.round((start - lead) * rate) + i;
    const dry = songIndex >= 0 && songIndex < master.samples.length ? master.samples[songIndex] : 0;
    const wet = songIndex - delay >= 0 && songIndex - delay < master.samples.length ? master.samples[songIndex - delay] : 0;
    out[i] = 0.45 * dry + 0.2 * wet + 0.05 * noise();
  }
  return out;
}

test("aligns a noisy, echoey take to the master within 10 ms", () => {
  const take = recordTake(12.34, 14);
  const alignment = alignTake(master.samples, master.sampleRate, take, master.sampleRate);
  assert.ok(Math.abs(alignment.offset - 12.34) < 0.01, `offset ${alignment.offset}`);
  assert.ok(isSynced(alignment), JSON.stringify(alignment));
  assert.ok(alignment.overlap > 13);
});

test("a take that starts before the song gets a negative offset", () => {
  // Phone started recording 2.5 s before the song began (silence + hiss first).
  const take = recordTake(0, 12, { lead: 2.5, seed: 5 });
  const alignment = alignTake(master.samples, master.sampleRate, take, master.sampleRate);
  assert.ok(Math.abs(alignment.offset + 2.5) < 0.01, `offset ${alignment.offset}`);
  assert.ok(isSynced(alignment));
});

test("unrelated audio is not reported as synced", () => {
  const other = synthSong({ bpm: 87, sampleRate: 16000, seed: 99, sections: [{ bars: 6, level: 0.7, busy: true }] });
  const alignment = alignTake(master.samples, master.sampleRate, other.samples, other.sampleRate);
  assert.ok(!isSynced(alignment), JSON.stringify(alignment));
  const noise = noiseSource(4);
  const hiss = new Float32Array(16000 * 8).map(() => 0.1 * noise());
  assert.ok(!isSynced(alignTake(master.samples, master.sampleRate, hiss, 16000)));
});

test("envelope alignment ignores gain", () => {
  const env = onsetEnvelope(master.samples, master.sampleRate);
  const slice = env.slice(800, 1800).map((value) => value * 0.1);
  const alignment = alignEnvelopes(env, slice);
  assert.ok(Math.abs(alignment.offset - 8) < 0.011, `offset ${alignment.offset}`);
});

test("resampling keeps alignment: a 48 kHz take aligns to a 16 kHz master", async () => {
  const { resampleMono } = await import("../lib/autocut-align.ts");
  const take16 = recordTake(20.5, 10, { seed: 21 });
  // Upsample the take to 48 kHz (as a camera would record), then bring it back down.
  const take48 = resampleMono(take16, 16000, 48000);
  assert.equal(take48.length, take16.length * 3);
  const back = resampleMono(take48, 48000, 16000);
  const alignment = alignTake(master.samples, 16000, back, 16000);
  assert.ok(Math.abs(alignment.offset - 20.5) < 0.012, `offset ${alignment.offset}`);
});

test("a cut from a detailed scene to a plain one is not called out of focus", () => {
  const plain = { id: "plain", brightness: 0.4, sharpness: 0.08 };
  const profile = profileClip("p", "cut.mp4", 10, samplesFor(10, (t) => (t < 5 ? day : plain)));
  assert.ok(!profile.notes.includes("often out of focus"), profile.notes.join());
  assert.ok(profile.usable > 9, `usable ${profile.usable}`);
});

test("continuous change (a pan or colour sweep) is not a scene cut", () => {
  const samples = [];
  for (let t = 0; t < 8; t += 0.25) samples.push({ time: t, brightness: 0.5, sharpness: 0.3, contrast: 0.3, motion: t ? 0.2 + 0.05 * Math.sin(t * 3) : 0, histogramDistance: t ? 0.3 + 0.1 * Math.cos(t * 2) : 0 });
  assert.deepEqual(detectSceneCuts(samples), []);
});
