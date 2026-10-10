import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMusic, bestWindow, energyAt, labelSections, mixToMono, rescaleTempo, sectionAt } from "../lib/autocut-music.ts";
import { synthSong } from "./helpers/autocut-synth.mjs";

const song = synthSong({
  bpm: 120,
  sections: [
    { bars: 8, level: 0.25, busy: false }, // 0–16 s quiet intro
    { bars: 8, level: 0.5, busy: true }, // 16–32 verse
    { bars: 8, level: 1, busy: true }, // 32–48 chorus
    { bars: 6, level: 0.2, busy: false }, // 48–60 outro
  ],
});
const music = analyzeMusic(song.samples, song.sampleRate);

const nearestDistance = (values, time) => values.reduce((best, value) => Math.min(best, Math.abs(value - time)), Infinity);

test("finds the tempo and a beat grid on the real transients", () => {
  assert.ok(Math.abs(music.bpm - 120) <= 2, `bpm ${music.bpm}`);
  assert.ok(music.reliable, "rhythm is reliable");
  const interior = music.beats.filter((beat) => beat > 1 && beat < 58);
  const onTarget = interior.filter((beat) => nearestDistance(song.truth.beats, beat) < 0.05).length;
  assert.ok(onTarget / interior.length > 0.9, `${onTarget}/${interior.length} beats within 50 ms of a drum hit`);
  const gaps = interior.slice(1).map((beat, index) => beat - interior[index]).sort((a, b) => a - b);
  assert.ok(Math.abs(gaps[Math.floor(gaps.length / 2)] - 0.5) < 0.03, "median beat gap is 0.5 s");
});

test("bars: 4/4 with downbeats on the accented 1", () => {
  assert.equal(music.beatsPerBar, 4);
  const interior = music.downbeats.filter((time) => time > 1 && time < 58);
  const onOne = interior.filter((time) => nearestDistance(song.truth.downbeats, time) < 0.06).length;
  assert.ok(onOne / interior.length >= 0.7, `${onOne}/${interior.length} downbeats on bar starts`);
});

test("energy curve and sections follow the arrangement", () => {
  assert.ok(energyAt(music, 40) > energyAt(music, 8) + 0.3, "chorus louder than intro");
  assert.ok(music.sections.length >= 3, `${music.sections.length} sections`);
  assert.equal(music.sections[0].start, 0);
  assert.ok(Math.abs(music.sections.at(-1).end - music.duration) < 1e-6);
  const loud = sectionAt(music, 40);
  assert.ok(loud.label === "chorus" || loud.label === "drop", `section at 40 s is ${loud.label}`);
  assert.equal(sectionAt(music, 2).label, "intro");
  for (const section of music.sections.slice(1)) {
    assert.ok(nearestDistance(music.downbeats, section.start) < 0.01, `section at ${section.start} starts on a downbeat`);
  }
  assert.ok(music.dropTime > 26 && music.dropTime < 44, `drop at ${music.dropTime}`);
});

test("best window lands on the loud part and starts on a downbeat", () => {
  const window = bestWindow(music, 15);
  assert.ok(window.end - window.start > 12 && window.end - window.start < 18, `length ${window.end - window.start}`);
  assert.ok(window.start >= 20 && window.start <= 40, `starts at ${window.start}`);
  assert.ok(music.downbeats.some((time) => Math.abs(time - window.start) < 1e-6));
  assert.deepEqual(bestWindow(music, 999), { start: 0, end: music.duration });
});

test("half/double tempo fix", () => {
  const doubled = rescaleTempo(music, 2);
  assert.equal(doubled.bpm, music.bpm * 2);
  assert.ok(Math.abs(doubled.beats.length - music.beats.length * 2) <= 2);
  const halved = rescaleTempo(music, 0.5);
  assert.equal(halved.bpm, Math.round(music.bpm / 2));
  assert.ok(Math.abs(halved.beats.length - music.beats.length / 2) <= 1);
  assert.ok(halved.downbeats.every((time) => halved.beats.some((beat) => Math.abs(beat - time) < 1e-6)), "downbeats stay on the halved grid");
});

test("audio with no rhythm falls back to an honest, unreliable 120 BPM grid", () => {
  const sampleRate = 22050;
  const tone = new Float32Array(sampleRate * 12).map((_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / sampleRate));
  const flat = analyzeMusic(tone, sampleRate);
  assert.equal(flat.reliable, false);
  assert.equal(flat.bpm, 120);
  assert.ok(flat.beats.length >= 20);
  const silent = analyzeMusic(new Float32Array(sampleRate * 4), sampleRate);
  assert.equal(silent.reliable, false);
});

test("section labelling rules", () => {
  const spans = [
    { start: 0, end: 10, energy: 0.1 },
    { start: 10, end: 20, energy: 0.4 },
    { start: 20, end: 30, energy: 0.5 },
    { start: 30, end: 40, energy: 0.95 },
    { start: 40, end: 50, energy: 0.2 },
    { start: 50, end: 60, energy: 0.8 },
    { start: 60, end: 70, energy: 0.15 },
  ];
  const labels = labelSections(spans, { time: 31, strength: 0.6 }).map((section) => section.label);
  assert.equal(labels[0], "intro");
  assert.equal(labels[3], "drop");
  assert.equal(labels[2], "build");
  assert.equal(labels[4], "break");
  assert.equal(labels[5], "chorus");
  assert.equal(labels[6], "outro");
  // A flat track doesn't invent choruses.
  const flat = labelSections(spans.map((span) => ({ ...span, energy: 0.5 })), { time: 31, strength: 0.6 }).map((section) => section.label);
  assert.ok(!flat.includes("chorus") && !flat.includes("drop"));
});

test("mixToMono averages channels", () => {
  const mono = mixToMono([new Float32Array([1, 0, 0.5]), new Float32Array([0, 1, 0.5])]);
  assert.deepEqual([...mono], [0.5, 0.5, 0.5]);
});

test("other tempos: 95 and 140 BPM", () => {
  for (const bpm of [95, 140]) {
    const other = synthSong({ bpm, sampleRate: 22050, melody: true, sections: [{ bars: 6, level: 0.5, busy: true }, { bars: 6, level: 1, busy: true }] });
    const result = analyzeMusic(other.samples, other.sampleRate);
    assert.ok(Math.abs(result.bpm - bpm) <= 3, `${bpm} BPM read as ${result.bpm}`);
  }
});
