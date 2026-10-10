import assert from "node:assert/strict";
import test from "node:test";
import { hexToRgb, limitStrobeRate, strobeColorAt, strobeLevelAt, strobeSafetyReport, strobeTimes, onsetHitTimes, withDropBurst, STROBE_PRESETS } from "../lib/strobe.ts";
import { customStrobeTimes } from "../lib/strobe-timing.ts";
import { coerceEffectSettings } from "../lib/project-store.ts";

test("custom strobe clock supports fractional tempo and pattern divisions without a song", () => {
  assert.deepEqual(customStrobeTimes(2, 120, "every-beat"), [0, .5, 1, 1.5]);
  assert.deepEqual(customStrobeTimes(5, 120, "downbeat"), [0, 2, 4]);
  assert.deepEqual(customStrobeTimes(1, 120, "double"), [0, .25, .5, .75]);
  const times = customStrobeTimes(60, 123.4, "every-beat");
  assert.ok(Math.abs(times[100] - 100 * 60 / 123.4) < 1e-10);
  assert.ok(times.every(t => t >= 0 && t < 60));
  assert.deepEqual(customStrobeTimes(4, 120, "off"), []);
  assert.deepEqual(customStrobeTimes(NaN, 120, "every-beat"), []);
  assert.deepEqual(customStrobeTimes(2, Infinity, "every-beat"), []);
  assert.ok(limitStrobeRate(customStrobeTimes(10, 240, "double"), 3).length < customStrobeTimes(10, 240, "double").length);
});

test("strobe timing persists, validates and defaults old projects to song sync", () => {
  const old = coerceEffectSettings({});
  assert.equal(old.strobeTiming, "song"); assert.equal(old.strobeBpm, 120);
  const saved = coerceEffectSettings(JSON.parse(JSON.stringify({...old, strobeTiming:"custom", strobeBpm:123.4})));
  assert.equal(saved.strobeTiming, "custom"); assert.equal(saved.strobeBpm, 123.4);
  assert.equal(coerceEffectSettings({strobeBpm:999}).strobeBpm, 240);
  assert.equal(coerceEffectSettings({strobeBpm:-1}).strobeBpm, 30);
  assert.equal(coerceEffectSettings({strobeBpm:NaN,strobeTiming:"junk"}).strobeBpm, 120);
});

test("withDropBurst packs a flash cluster onto the drop", () => {
  const base = [0, 0.5, 1.0, 1.5, 10, 10.5];
  const out = withDropBurst(base, 10, 0.5, 6);
  // Every original time survives...
  for (const t of base) assert.ok(out.some((x) => Math.abs(x - t) < 1e-9), `${t} kept`);
  // ...plus extra flashes packed into [10, 10.375].
  const inBurst = out.filter((t) => t > 10 + 1e-9 && t <= 10 + 0.5 * 0.75 + 1e-9);
  assert.ok(inBurst.length >= 3, "several extra flashes on the drop");
  // Sorted and free of near-duplicates.
  for (let i = 1; i < out.length; i++) assert.ok(out[i] - out[i - 1] > 0.015 - 1e-9, "no dupes");
});

test("withDropBurst is a no-op on junk input", () => {
  const base = [0, 1, 2];
  assert.deepEqual(withDropBurst(base, NaN, 0.5), base);
  assert.deepEqual(withDropBurst(base, 1, 0), base);
  assert.deepEqual(withDropBurst(base, -1, 0.5), base);
});

// 120 BPM: a beat every 0.5s, downbeat every 4th (every 2s).
const beats = Array.from({ length: 17 }, (_, i) => i * 0.5);
const downbeats = beats.filter((_, i) => i % 4 === 0);

test("patterns select the beats they claim to", () => {
  assert.deepEqual(strobeTimes(beats, downbeats, "off"), []);
  assert.equal(strobeTimes(beats, downbeats, "every-beat").length, beats.length);
  assert.deepEqual(strobeTimes(beats, downbeats, "downbeat"), downbeats);

  const off = strobeTimes(beats, downbeats, "offbeat");
  assert.equal(off.length, beats.length - downbeats.length);
  assert.ok(off.every((t) => !downbeats.includes(t)), "offbeat excludes the 1");

  // Double time adds a flash between each pair of beats.
  const double = strobeTimes(beats, downbeats, "double");
  assert.equal(double.length, beats.length * 2 - 1);
  assert.ok(double.includes(0.25), "fires on the half-beat");
});

test("burst fires a rapid cluster at the top of each bar", () => {
  const burst = strobeTimes(beats, downbeats, "burst");
  assert.equal(burst.length, downbeats.length * 4);
  const first = burst.slice(0, 4);
  assert.equal(first[0], 0);
  // All four land inside the first half-beat.
  assert.ok(first.every((t) => t < 0.25), "cluster is tight");
  assert.ok(first[1] > first[0] && first[2] > first[1], "ascending");
});

test("a flash peaks on the hit and decays away", () => {
  const cfg = { ...STROBE_PRESETS.rave, decay: 0.1 };
  const times = strobeTimes(beats, downbeats, cfg.pattern);
  const onHit = strobeLevelAt(0.5, times, cfg);
  const soonAfter = strobeLevelAt(0.55, times, cfg);
  const wellAfter = strobeLevelAt(0.95, times, cfg);
  assert.ok(Math.abs(onHit - cfg.intensity) < 1e-9, "peaks at intensity");
  assert.ok(soonAfter < onHit && soonAfter > 0, "decaying");
  assert.ok(wellAfter < 0.02, "dark before the next flash");
});

test("nothing fires before the first flash, or when off", () => {
  const cfg = STROBE_PRESETS.rave;
  const times = strobeTimes(beats, downbeats, cfg.pattern);
  assert.equal(strobeLevelAt(-1, times, cfg), 0);
  assert.equal(strobeLevelAt(1, [], cfg), 0);
  assert.equal(strobeLevelAt(1, times, STROBE_PRESETS.off), 0);
});

test("intensity scales the flash linearly", () => {
  const times = strobeTimes(beats, downbeats, "every-beat");
  const half = strobeLevelAt(1, times, { pattern: "every-beat", color: "#fff", intensity: 0.4, decay: 0.1 });
  const full = strobeLevelAt(1, times, { pattern: "every-beat", color: "#fff", intensity: 0.8, decay: 0.1 });
  assert.ok(Math.abs(full - half * 2) < 1e-9);
});

test("advanced envelopes provide attack, hold and selectable release curves", () => {
  const times = [1];
  const config = { pattern: "every-beat", color: "#fff", intensity: 0.8, attack: 0.1, hold: 0.05, decay: 0.2, shape: "linear" };
  assert.equal(strobeLevelAt(1, times, config), 0, "attack starts dark");
  assert.ok(strobeLevelAt(1.05, times, config) > 0 && strobeLevelAt(1.05, times, config) < 0.8);
  assert.equal(strobeLevelAt(1.12, times, config), 0.8, "hold stays at full output");
  assert.ok(strobeLevelAt(1.25, times, config) < 0.8, "linear release falls away");
  assert.equal(strobeLevelAt(1.36, times, config), 0, "linear release reaches black");
});

test("alternating gels switch colour on successive flashes", () => {
  const config = { ...STROBE_PRESETS.police, color: "#0000ff", secondaryColor: "#ff0000", alternate: true };
  assert.deepEqual(strobeColorAt(0, [0, 1], config), [0, 0, 1]);
  assert.deepEqual(strobeColorAt(1, [0, 1], config), [1, 0, 0]);
});

test("safe mode limiter permits no more than three flashes in a rolling second", () => {
  const limited = limitStrobeRate([0, 0.1, 0.2, 0.3, 0.9, 1.01, 1.11, 1.21], 3);
  for (let start = 0; start < limited.length; start++) {
    assert.ok(limited.filter((time) => time >= limited[start] && time < limited[start] + 1).length <= 3);
  }
  assert.ok(limited.length < 8, "unsafe flashes are suppressed");
});

test("strobe safety preflight reports rate and saturated red risks", () => {
  const warning = strobeSafetyReport([0, 0.1, 0.2, 0.3], ["#ff0000"]);
  assert.equal(warning.safe, false);
  assert.equal(warning.overThreePerSecond, true);
  assert.equal(warning.saturatedRed, true);
  assert.match(warning.message, /review/);
  assert.equal(strobeSafetyReport([0, 0.5, 1], ["#ffffff"]).safe, true);
});

test("hex colours parse, including shorthand, with a safe fallback", () => {
  assert.deepEqual(hexToRgb("#ffffff"), [1, 1, 1]);
  assert.deepEqual(hexToRgb("#000000"), [0, 0, 0]);
  assert.deepEqual(hexToRgb("#f00"), [1, 0, 0]);
  assert.deepEqual(hexToRgb("nonsense"), [1, 1, 1], "falls back to white");
  const [r, g, b] = hexToRgb("#4488ff");
  assert.ok(b > g && g > r, "channel order preserved");
});

test("every preset is coherent", () => {
  for (const [name, cfg] of Object.entries(STROBE_PRESETS)) {
    assert.ok(cfg.intensity >= 0 && cfg.intensity <= 1, `${name} intensity in range`);
    assert.ok(cfg.decay > 0, `${name} needs a decay`);
    assert.deepEqual(hexToRgb(cfg.color).length, 3, `${name} colour parses`);
  }
  assert.equal(STROBE_PRESETS.off.intensity, 0);
});

// ---- Drum-hit (onset) strobing --------------------------------------------
test("the onset pattern doesn't ride the beat grid", () => {
  assert.deepEqual(strobeTimes(beats, downbeats, "onset"), []);
});

test("the drums preset uses the onset pattern", () => {
  assert.equal(STROBE_PRESETS.drums.pattern, "onset");
});

// Sharp transients at 0.5, 1.0, 1.5, 2.0s over a quiet floor.
function drumSignal(hitTimes = [0.5, 1.0, 1.5, 2.0]) {
  const step = 0.02, n = Math.round(3 / step);
  const hits = new Set(hitTimes.map((t) => Math.round(t / step)));
  return Array.from({ length: n }, (_, i) => ({ time: i * step, energy: 0.5, onset: hits.has(i) ? 1 : 0.05 }));
}

test("onsetHitTimes lands on the actual transients", () => {
  const hits = onsetHitTimes(drumSignal(), 0.5);
  assert.equal(hits.length, 4, "one flash per drum hit");
  [0.5, 1.0, 1.5, 2.0].forEach((expected, i) => {
    assert.ok(Math.abs(hits[i] - expected) < 0.03, `hit ${i} near ${expected}s`);
  });
});

test("higher sensitivity catches quieter hits", () => {
  const step = 0.02, n = Math.round(3 / step);
  const strong = new Set([0.5, 1.0, 1.5, 2.0].map((t) => Math.round(t / step)));
  const weak = new Set([0.75, 1.25, 1.75].map((t) => Math.round(t / step)));
  const sig = Array.from({ length: n }, (_, i) => ({
    time: i * step, energy: 0.5, onset: strong.has(i) ? 1 : weak.has(i) ? 0.4 : 0.05,
  }));
  assert.ok(onsetHitTimes(sig, 0.95).length > onsetHitTimes(sig, 0.2).length);
});

test("a sustained transient fires once, not a burst", () => {
  const step = 0.005, n = Math.round(1 / step);
  const sig = Array.from({ length: n }, (_, i) => {
    const t = i * step;
    return { time: t, energy: 0.5, onset: Math.abs(t - 0.5) < 0.02 ? 1 - Math.abs(t - 0.5) * 10 : 0.05 };
  });
  assert.equal(onsetHitTimes(sig, 0.5, 0.06).length, 1);
});

test("silent or empty audio makes no flashes", () => {
  assert.deepEqual(onsetHitTimes([], 0.5), []);
  const silent = Array.from({ length: 50 }, (_, i) => ({ time: i * 0.02, energy: 0, onset: 0 }));
  assert.deepEqual(onsetHitTimes(silent, 1), []);
});

// Kicks (lowOnset) at 0.5 & 1.5; snares (highOnset) at 1.0 & 2.0. The combined
// onset carries all four.
function bandSignal() {
  const step = 0.02, n = Math.round(2.5 / step);
  const kick = new Set([0.5, 1.5].map((t) => Math.round(t / step)));
  const snare = new Set([1.0, 2.0].map((t) => Math.round(t / step)));
  return Array.from({ length: n }, (_, i) => {
    const isKick = kick.has(i), isSnare = snare.has(i);
    return {
      time: i * step, energy: 0.5,
      lowOnset: isKick ? 1 : 0.05,
      highOnset: isSnare ? 1 : 0.05,
      onset: isKick || isSnare ? 1 : 0.05,
    };
  });
}

test("the kick band flashes only on the kicks", () => {
  const hits = onsetHitTimes(bandSignal(), 0.5, "low");
  assert.equal(hits.length, 2);
  assert.ok(Math.abs(hits[0] - 0.5) < 0.03 && Math.abs(hits[1] - 1.5) < 0.03);
});

test("the snare band flashes only on the snares", () => {
  const hits = onsetHitTimes(bandSignal(), 0.5, "high");
  assert.equal(hits.length, 2);
  assert.ok(Math.abs(hits[0] - 1.0) < 0.03 && Math.abs(hits[1] - 2.0) < 0.03);
});

test("the 'all' band flashes on every drum hit", () => {
  assert.equal(onsetHitTimes(bandSignal(), 0.5, "all").length, 4);
});

test("band selection falls back to the combined onset for old projects", () => {
  // Signals without lowOnset/highOnset (pre-band saves) still work.
  const step = 0.02, n = Math.round(1.5 / step);
  const hits = new Set([0.5, 1.0].map((t) => Math.round(t / step)));
  const legacy = Array.from({ length: n }, (_, i) => ({ time: i * step, energy: 0.5, onset: hits.has(i) ? 1 : 0.05 }));
  assert.equal(onsetHitTimes(legacy, 0.5, "low").length, 2, "no lowOnset => uses onset");
});
