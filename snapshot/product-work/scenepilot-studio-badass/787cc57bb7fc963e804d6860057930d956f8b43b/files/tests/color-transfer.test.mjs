import assert from "node:assert/strict";
import test from "node:test";
import {
  bakeLut3d, buildColorTransfer, dominantPalette, labToRgb, lutToRgba8, measureLabStats, mergeLabStats, neutralLabStats, rgbToLab, serializeCubeLut,
} from "../lib/color-transfer.ts";
import { parseCubeLut, sampleCubeLut } from "../lib/lut.ts";

/** RGBA pixels from a function of (x, y) over a small grid. */
function image(width, height, fn) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [r, g, b] = fn(x / (width - 1), y / (height - 1));
    const i = (y * width + x) * 4;
    data[i] = r * 255; data[i + 1] = g * 255; data[i + 2] = b * 255; data[i + 3] = 255;
  }
  return data;
}

const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

test("sRGB ↔ CIELAB round-trips and hits the D65 anchors", () => {
  const white = rgbToLab(1, 1, 1);
  assert.ok(near(white[0], 100, 1e-3) && near(white[1], 0, 1e-3) && near(white[2], 0, 1e-3));
  assert.deepEqual(rgbToLab(0, 0, 0).map((v) => Math.round(v * 1000) / 1000), [0, 0, 0]);
  for (const rgb of [[0.2, 0.5, 0.8], [0.9, 0.1, 0.3], [0.5, 0.5, 0.5]]) {
    const back = labToRgb(...rgbToLab(...rgb));
    rgb.forEach((value, c) => assert.ok(near(back[c], value, 1e-6), `channel ${c}`));
  }
});

test("statistics ignore transparent pixels and merge by pixel count", () => {
  const warm = image(8, 8, () => [0.8, 0.5, 0.3]);
  const stats = measureLabStats(warm);
  assert.equal(stats.count, 64);
  assert.ok(stats.mean[2] > 20, "warm image has positive b*");
  assert.ok(stats.std[0] < 1e-6, "flat image has no lightness spread");
  const holed = warm.slice();
  holed[3] = 0;
  assert.equal(measureLabStats(holed).count, 63);
  const cool = measureLabStats(image(8, 8, () => [0.3, 0.5, 0.8]));
  const merged = mergeLabStats([stats, cool]);
  assert.equal(merged.count, 128);
  assert.ok(near(merged.mean[2], (stats.mean[2] + cool.mean[2]) / 2, 1e-9));
  assert.ok(merged.std[2] > 20, "merged spread covers both casts");
  assert.ok(near(merged.cdf[0][255], 1, 1e-9));
  assert.throws(() => measureLabStats(new Uint8ClampedArray(4)), /No visible pixels/);
});

test("a transfer from an image onto itself is (near) identity for every method", () => {
  const stats = measureLabStats(image(24, 24, (x, y) => [x, y * 0.8 + 0.1, 1 - x * 0.7]));
  for (const method of ["reinhard", "histogram", "balanced"]) {
    const transfer = buildColorTransfer(stats, stats, { method });
    const [r, g, b] = transfer(0.4, 0.5, 0.6);
    assert.ok(near(r, 0.4, 0.03) && near(g, 0.5, 0.03) && near(b, 0.6, 0.03), `${method}: ${r} ${g} ${b}`);
  }
});

test("Reinhard transfer moves a neutral source toward the reference cast; intensity 0 is untouched", () => {
  const source = measureLabStats(image(16, 16, (x, y) => [x * 0.8 + 0.1, x * 0.8 + 0.1, y * 0.8 + 0.1]));
  const reference = measureLabStats(image(16, 16, (x) => [0.3 + x * 0.6, 0.35 + x * 0.3, 0.2 + x * 0.1])); // warm/orange
  const full = buildColorTransfer(source, reference, { method: "reinhard" });
  const [r, , b] = full(0.5, 0.5, 0.5);
  assert.ok(r > b + 0.1, `grey should turn warm, got r=${r} b=${b}`);
  const none = buildColorTransfer(source, reference, { method: "reinhard", intensity: 0 });
  const kept = none(0.5, 0.5, 0.5);
  kept.forEach((value) => assert.ok(near(value, 0.5, 1e-6)));
  const half = buildColorTransfer(source, reference, { method: "reinhard", intensity: 0.5 })(0.5, 0.5, 0.5);
  assert.ok(half[0] > 0.5 && half[0] < r, "half intensity lands between");
});

test("histogram matching reproduces the reference lightness distribution", () => {
  const dark = measureLabStats(image(32, 32, (x) => [x * 0.4, x * 0.4, x * 0.4]));
  const bright = measureLabStats(image(32, 32, (x) => [0.5 + x * 0.5, 0.5 + x * 0.5, 0.5 + x * 0.5]));
  const transfer = buildColorTransfer(dark, bright, { method: "histogram" });
  const mid = rgbToLab(...transfer(0.2, 0.2, 0.2))[0];
  assert.ok(mid > rgbToLab(0.6, 0.6, 0.6)[0] && mid < rgbToLab(0.9, 0.9, 0.9)[0], `mid-tone L=${mid}`);
});

test("a baked LUT serialises to a .cube that ScenePilot's parser reads back exactly", () => {
  const identity = (r, g, b) => [r, g, b];
  const table = bakeLut3d(identity, 5);
  assert.equal(table.length, 5 * 5 * 5 * 3);
  const text = serializeCubeLut(table, 5, 'Test "Look"\nInjected');
  assert.match(text, /^TITLE "Test LookInjected"/);
  const parsed = parseCubeLut(text);
  assert.equal(parsed.size, 5);
  assert.equal(parsed.dimensions, 3);
  const sample = sampleCubeLut(parsed, 0.3, 0.6, 0.9);
  assert.ok(near(sample[0], 0.3, 1e-6) && near(sample[1], 0.6, 1e-6) && near(sample[2], 0.9, 1e-6));
  // r fastest: entry 1 is (r=0.25, g=0, b=0).
  assert.deepEqual([...table.slice(3, 6)], [0.25, 0, 0]);
  assert.throws(() => bakeLut3d(identity, 1), /between 2 and 65/);
  assert.throws(() => serializeCubeLut(table, 4), /does not match/);
  const rgba = lutToRgba8(table);
  assert.equal(rgba.length, 125 * 4);
  assert.deepEqual([...rgba.slice(4, 8)], [64, 0, 0, 255]);
});

test("the neutral fallback is broad and roughly grey", () => {
  const stats = neutralLabStats();
  assert.ok(Math.abs(stats.mean[1]) < 2 && Math.abs(stats.mean[2]) < 2);
  assert.ok(stats.std[0] > 15);
});

test("dominant palette finds the main colours by share", () => {
  const pixels = image(20, 20, (x) => (x < 0.7 ? [1, 0, 0] : [0, 0, 1]));
  const palette = dominantPalette(pixels, 3, 1);
  assert.equal(palette[0].hex, "#ff0000");
  assert.equal(palette[1].hex, "#0000ff");
  assert.ok(palette[0].share > palette[1].share);
});
