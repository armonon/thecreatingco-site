import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPTION_PRESETS, activeLine, activeWordIndex, groupCaptionLines, layoutCaption, lineText, linesToCutFile, linesToSrt, linesToTitleCues, linesToVtt,
  normalizeWords, presetById, retimeLine, tidyLines, wordVisual,
} from "../lib/caption-words.ts";
import { parseCaptions } from "../lib/captions.ts";
import { parseCutFile } from "../lib/project-store.ts";

const ASR = [
  { text: " Hello", start: 0.1, end: 0.4 },
  { text: "world.", start: 0.35, end: 0.35 },
  { text: "", start: 0.9, end: 1 },
  { text: "This is", start: 1.5, end: 2.1 },
  { text: "a", start: 2.1, end: 2.2 },
  { text: "test,", start: 2.2, end: 2.6 },
  { text: "okay?", start: 2.7, end: 3 },
  { text: "bad", start: Number.NaN, end: 4 },
];

test("normalizeWords repairs overlaps, zero lengths, blanks and segment-level chunks", () => {
  const words = normalizeWords(ASR);
  assert.deepEqual(words.map((word) => word.text), ["Hello", "world.", "This", "is", "a", "test,", "okay?"]);
  for (let i = 1; i < words.length; i++) assert.ok(words[i].start >= words[i - 1].end - 1e-9, `word ${i} overlaps`);
  assert.ok(words.every((word) => word.end - word.start >= 0.08 - 1e-9));
  assert.equal(words[0].end, 0.35, "trimmed at the next word's start");
  assert.equal(words[2].start, 1.5);
  assert.ok(words[3].end <= 2.1 + 1e-9, "segment words stay inside their segment");
  assert.ok(normalizeWords([{ text: "late", start: 9, end: 12 }], 10)[0].end <= 10);
  const glued = normalizeWords([{ text: "on", start: 1, end: 1.2 }, { text: "-device", start: 1.2, end: 1.6 }, { text: "don", start: 2, end: 2.2 }, { text: "'t", start: 2.2, end: 2.3 }, { text: "-", start: 5, end: 5.1 }]);
  assert.deepEqual(glued.map((word) => [word.text, word.start, word.end]), [["on-device", 1, 1.6], ["don't", 2, 2.3], ["-", 5, 5.1]]);
});

test("grouping breaks on sentence ends, pauses and length", () => {
  const lines = groupCaptionLines(normalizeWords(ASR));
  assert.deepEqual(lines.map(lineText), ["Hello world.", "This is a test,", "okay?"]);
  const long = normalizeWords(Array.from({ length: 20 }, (_, i) => ({ text: `word${i}`, start: i * 0.3, end: i * 0.3 + 0.25 })));
  const grouped = groupCaptionLines(long, { maxChars: 20 });
  assert.ok(grouped.every((line) => lineText(line).length <= 20 + 7));
  assert.equal(grouped.flatMap((line) => line.words).length, 20);
  assert.ok(groupCaptionLines(long, { maxWords: 3 }).every((line) => line.words.length <= 3));
});

test("editing text keeps word timing when counts match, otherwise respreads the line", () => {
  const [line] = groupCaptionLines(normalizeWords(ASR));
  const fixed = retimeLine(line, "Hullo world!");
  assert.deepEqual(fixed.words.map((w) => [w.text, w.start, w.end]), [["Hullo", line.words[0].start, line.words[0].end], ["world!", line.words[1].start, line.words[1].end]]);
  const longer = retimeLine(line, "Hello there big world.");
  assert.equal(longer.words.length, 4);
  assert.equal(longer.words[0].start, line.start);
  assert.ok(Math.abs(longer.words.at(-1).end - line.end) < 0.01);
  assert.equal(tidyLines([retimeLine(line, "   ")]).length, 0);
});

test("active line and word follow the playhead, with a short read-out hold", () => {
  const lines = groupCaptionLines(normalizeWords(ASR));
  assert.equal(activeLine(lines, 0.05), null);
  assert.equal(lineText(activeLine(lines, 0.2)), "Hello world.");
  assert.equal(lineText(activeLine(lines, 0.9)), "Hello world.", "held after the last word");
  assert.equal(activeLine(lines, 1.3), null);
  const line = lines[1];
  assert.equal(activeWordIndex(line, 1.4), -1);
  assert.equal(activeWordIndex(line, 1.6), 0);
  assert.equal(activeWordIndex(line, 2.3), 3);
  assert.equal(activeWordIndex(line, 9), 3);
});

test("highlight modes: karaoke fills spoken words, reveal hides unspoken, box marks only the current", () => {
  const line = groupCaptionLines(normalizeWords(ASR))[1];
  assert.equal(wordVisual(line, 0, 2.3, "color").highlighted, true);
  assert.equal(wordVisual(line, 3, 1.6, "color").highlighted, false);
  assert.equal(wordVisual(line, 3, 1.6, "reveal").alpha, 0);
  assert.equal(wordVisual(line, 0, 2.3, "reveal").alpha, 1);
  assert.equal(wordVisual(line, 0, 2.3, "box").highlighted, false);
  assert.equal(wordVisual(line, 3, 2.3, "box").highlighted, true);
  assert.ok(wordVisual(line, 3, 2.3, "pop").scale > 1);
  assert.equal(wordVisual(line, 0, 2.3, "none").highlighted, false);
});

test("layout wraps to the width and centres each row", () => {
  const laid = layoutCaption(["aaaa", "bbbb", "cccc"], (text) => text.length * 10, { maxWidth: 95, centerX: 100, centerY: 50, lineHeight: 20, spaceWidth: 5 });
  assert.deepEqual(laid.map((word) => [word.x, word.y]), [[57.5, 40], [102.5, 40], [80, 60]]);
});

test("SRT, word-timed VTT and title cues round-trip through ScenePilot's parsers", () => {
  const lines = groupCaptionLines(normalizeWords(ASR));
  const srt = linesToSrt(lines);
  const cues = parseCaptions(srt);
  assert.deepEqual(cues.map((cue) => cue.text), ["Hello world.", "This is a test,", "okay?"]);
  assert.ok(cues[0].end <= cues[1].start);
  const vtt = linesToVtt(lines);
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /This <00:00:01\.875>is/);
  assert.deepEqual(parseCaptions(vtt).map((cue) => cue.text), ["Hello world.", "This is a test,", "okay?"]);
  assert.match(linesToVtt([retimeLine(lines[0], "a<b & c")], false), /a&lt;b &amp; c/);
  const preset = presetById("bold-pop");
  const titles = linesToTitleCues(lines, preset);
  assert.equal(titles[0].text, "HELLO WORLD.");
  assert.equal(titles[0].style, "pop");
  assert.match(titles[0].id, /^caption-/);
  const cut = parseCutFile(JSON.stringify(linesToCutFile(lines, preset, { project: "clip captions", duration: 4, mainAsset: { name: "clip.mp4", kind: "video" } })));
  assert.equal(cut.titles.length, 3);
  assert.equal(cut.mainAsset.name, "clip.mp4");
  assert.equal(presetById("missing").id, CAPTION_PRESETS[0].id);
});
