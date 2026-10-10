import assert from "node:assert/strict";
import test from "node:test";
import { generateCut } from "../lib/autocut-cut.ts";
import { autocutToCutFile, coverCrop, outputSize, shotsToCsv } from "../lib/autocut-export.ts";
import { diagnoseCutFile, parseCutFile } from "../lib/project-store.ts";
import { fakeClip, fakeMusic } from "./helpers/autocut-synth.mjs";

const music = fakeMusic();
const clips = ["a", "b", "c"].map((id, index) => fakeClip(id, { energy: index / 2 }));
const shots = generateCut({ music, clips, preset: "music-video", density: 0.5, seed: 3 });
const refs = clips.map((clip) => ({ id: clip.id, name: `${clip.id}.mp4`, size: 1000 + clip.id.charCodeAt(0), lastModified: 1 }));
const settings = { preset: "music-video", density: 0.5, seed: 3, performance: false, brollMix: 0.25, aspect: "9:16" };

test("the cut file opens in ScenePilot's importer with every clip linked", () => {
  const file = autocutToCutFile({ project: "My video", music, shots, song: { name: "song.mp3", kind: "audio", size: 5 }, clips: refs, settings });
  const parsed = parseCutFile(JSON.stringify(file));
  assert.equal(parsed.format, "scenepilot-cut");
  assert.equal(parsed.version, 2);
  assert.equal(parsed.baseCuts.length, shots.length);
  assert.equal(parsed.beats.length, music.beats.length);
  assert.equal(parsed.mainAsset.name, "song.mp3");
  assert.equal(parsed.mainAsset.kind, "audio");
  assert.equal(parsed.effects.transitionType, "none");
  assert.equal(parsed.effects.lookPreset, "none");
  const errors = diagnoseCutFile(parsed).filter((item) => item.severity === "error");
  assert.deepEqual(errors, []);
  const sectionIds = new Set(parsed.sections.map((section) => section.id));
  for (const cut of parsed.baseCuts) {
    assert.ok(sectionIds.has(cut.sectionId), `section ${cut.sectionId} exists`);
    assert.ok(refs.some((ref) => ref.id === cut.assetId));
  }
  assert.ok(parsed.proState.markers.length >= music.sections.length);
  assert.equal(parsed.proState.timelineRange, undefined, "full-song cut has no in/out range");
  assert.equal(file.autocut.shots.length, shots.length);
});

test("a partial cut keeps song time and sets the timeline in/out range", () => {
  const partialShots = generateCut({ music, clips, preset: "hype", density: 0.5, seed: 3, range: { start: 16, end: 46 } });
  const file = autocutToCutFile({ project: "Teaser", music, shots: partialShots, song: { name: "song.mp3", kind: "audio" }, clips: refs, settings, range: { start: 16, end: 46 } });
  const parsed = parseCutFile(JSON.stringify(file));
  assert.deepEqual(parsed.proState.timelineRange, { inPoint: 16, outPoint: 46 });
  assert.equal(parsed.baseCuts[0].start, 16);
  assert.match(parsed.storyBrief, /16\.00–46\.00/);
});

test("only used clips are listed as project media", () => {
  const onlyA = shots.map((shot) => ({ ...shot, clipId: "a" }));
  const file = autocutToCutFile({ project: "x", music, shots: onlyA, song: { name: "s.wav", kind: "audio" }, clips: refs, settings });
  assert.deepEqual(file.assets.map((asset) => asset.id), ["a"]);
});

test("CSV shot list", () => {
  const csv = shotsToCsv(shots.slice(0, 3), (id) => `${id}, "quoted".mp4`);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^#,Start,End,Length,Section,Clip/);
  assert.match(lines[1], /"a|b|c, ""quoted""\.mp4"/);
});

test("output sizes and cover crop", () => {
  assert.deepEqual(outputSize("9:16"), { width: 1080, height: 1920 });
  assert.deepEqual(outputSize("16:9", 0.5), { width: 960, height: 540 });
  const vertical = coverCrop(1920, 1080, 1080, 1920);
  assert.ok(Math.abs(vertical.width - 607.5) < 1e-9 && vertical.height === 1080);
  assert.ok(Math.abs(vertical.x - (1920 - 607.5) / 2) < 1e-9);
  const leftFace = coverCrop(1920, 1080, 1080, 1920, 0.1);
  assert.equal(leftFace.x, 0);
  const rightFace = coverCrop(1920, 1080, 1080, 1920, 0.95);
  assert.ok(Math.abs(rightFace.x + rightFace.width - 1920) < 1e-9);
  const wide = coverCrop(1080, 1920, 1920, 1080);
  assert.equal(wide.width, 1080);
  assert.ok(Math.abs(wide.y - (1920 - 607.5) / 2) < 1e-9);
});
