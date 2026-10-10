import assert from "node:assert/strict";
import test from "node:test";
import { planSourceEdit, sliceEditorialAudio, retimeLinkedAudio, planLinkedRazor } from "../lib/source-edit.ts";
import { applyAudioCrossfade, audioFadeGainAt } from "../lib/audio-crossfade.ts";
import { clipGainAt } from "../lib/pro-editor.ts";
import { pcmFadeGainAt } from "../lib/pcm-audio.ts";
import { applySplitEdit } from "../lib/pro-workflows.ts";
import { exportOtioProject, importOtio } from "../lib/interchange.ts";
import { placeBaseCut } from "../lib/timeline-edit.ts";
import { audioPlaybackRate, audioSourceTime } from "../lib/audio-timing.ts";

const cut = { id: "picture", assetId: "source", sectionId: "manual", start: 0, duration: 10, sourceStart: 2 };
const audio = { id: "sound", assetId: "source", trackId: "a1", name: "Sound", start: 0, duration: 10, sourceStart: 2, gain: 1, pan: 0, fadeIn: 1, fadeOut: 1, muted: false, linkedVideoId: "picture", automation: [{ id: "low", time: 0, gain: 0 }, { id: "high", time: 10, gain: 1 }] };
const incoming = { ...cut, id: "incoming", assetId: "second", start: 3, duration: 2, sourceStart: 0 };
const incomingAudio = { ...audio, id: "new-sound", assetId: "second", start: 3, duration: 2, sourceStart: 0, linkedVideoId: "incoming" };
const input = { cuts: [cut], audioClips: [audio], audioTracks: [{ id: "a1", locked: false }, { id: "a2", locked: true }], incoming, incomingAudio };

test("Source Insert splits crossing picture/audio without lost footage or overlap", () => {
  const result = planSourceEdit({ ...input, mode: "insert" });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.cuts.map(c => [c.start, c.duration, c.sourceStart]), [[0, 3, 2], [3, 2, 0], [5, 7, 5]]);
  assert.deepEqual(result.audioClips.map(c => [c.start, c.duration, c.sourceStart]), [[0, 3, 2], [3, 2, 0], [5, 7, 5]]);
  assert.equal(result.audioClips[2].linkedVideoId, result.cuts[2].id);
  assert.equal(result.audioClips[0].fadeOut, 0);
  assert.equal(result.audioClips[2].fadeIn, 0);
  assert.equal(result.audioClips[2].fadeOut, 1);
  assert.equal(result.audioClips[2].automation[0].gain, .3);
  assert.equal(result.audioClips[2].automation.at(-1).time, 7);
  assert.equal(input.cuts[0].duration, 10, "planning must not mutate undo's source state");
});

test("Source Overwrite keeps audio head/tail and unrelated tracks", () => {
  const unrelated = { ...audio, id: "music", trackId: "a2", linkedVideoId: undefined };
  const result = planSourceEdit({ ...input, audioClips: [audio, unrelated], mode: "overwrite" });
  assert.equal(result.error, undefined);
  assert.equal(result.audioClips.find(c => c.id === "music"), unrelated);
  const pieces = result.audioClips.filter(c => c.trackId === "a1");
  assert.deepEqual(pieces.map(c => [c.start, c.duration, c.sourceStart]), [[0, 3, 2], [3, 2, 0], [5, 5, 7]]);
  assert.equal(pieces[2].linkedVideoId, result.cuts[2].id);
  assert.equal(pieces[2].automation[0].gain, .5);
});

test("locked linked audio blocks the complete transaction, unrelated locked audio stays put", () => {
  assert.match(planSourceEdit({ ...input, audioTracks: [{ id: "a1", locked: true }], mode: "insert" }).error, /Unlock the linked audio/);
  assert.match(planSourceEdit({ ...input, cuts: [{ ...cut, locked: true }], mode: "overwrite" }).error, /Unlock the affected picture/);
  const music = { ...audio, id: "music", trackId: "a2", linkedVideoId: undefined };
  const result = planSourceEdit({ ...input, audioClips: [audio, music], mode: "insert" });
  assert.equal(result.audioClips.find(c => c.id === "music"), music);
});

test("source insert respects sync-excluded unrelated audio but carries linked picture sound", () => {
  const music = { ...audio, id: "music", linkedVideoId: undefined };
  const result = planSourceEdit({ ...input, audioClips: [audio, music], audioTracks: [{ id: "a1", locked: false, syncLock: false }], mode: "insert" });
  assert.equal(result.audioClips.find(c => c.id === "music"), music);
  assert.equal(result.audioClips.filter(c => c.linkedVideoId && c.id !== incomingAudio.id).length, 2);
});

test("linked razor preserves reversed picture, linked audio fades, unique IDs and lock atomicity", () => {
  const picture = { ...cut, reversed: true, playbackRate: 2 };
  const sound = { ...audio, playbackRate: 2, fadeIn: 6 };
  const result = planLinkedRazor([picture], [sound], input.audioTracks, picture.id, 3);
  assert.deepEqual(result.cuts.map(c => [c.sourceStart, c.duration]), [[16, 3], [2, 7]]);
  assert.equal(result.audioClips[1].linkedVideoId, result.selectedId);
  assert.equal(result.audioClips[1].sourceStart, 8);
  for (let t = 0; t < 10; t += .1) {
    const piece = result.audioClips.find(c => t >= c.start && t < c.start + c.duration);
    assert.ok(Math.abs(clipGainAt(piece, t) - clipGainAt(sound, t)) < 1e-10);
  }
  assert.match(planLinkedRazor([picture], [sound], [{ id: "a1", locked: true }], picture.id, 3).error, /Unlock/);
  assert.equal(planLinkedRazor([picture], [sound], [{ id: "a1", locked: true }], picture.id, 3, false).audioClips[0], sound);
  assert.match(planLinkedRazor([{ ...picture, locked: true }], [], [], picture.id, 3).error, /Unlock/);
});

test("repeated insert generates unique piece IDs and retains reversed source continuity", () => {
  let cuts = [{ ...cut, reversed: true, playbackRate: 2 }];
  cuts = placeBaseCut(cuts, incoming, "insert");
  assert.equal(cuts[0].sourceStart, 16);
  assert.equal(cuts[2].sourceStart, 2);
  cuts = placeBaseCut(cuts, { ...incoming, id: "again", start: 1 }, "insert");
  assert.equal(new Set(cuts.map(c => c.id)).size, cuts.length);
  for (let i = 1; i < cuts.length; i++) assert.ok(cuts[i - 1].start + cuts[i - 1].duration <= cuts[i].start);
});

test("varispeed slices use source seconds while automation remains in timeline seconds", () => {
  const slice = sliceEditorialAudio({ ...audio, playbackRate: 2 }, 3, 8, "piece");
  assert.equal(slice.sourceStart, 8);
  assert.equal(slice.duration, 5);
  assert.equal(slice.playbackRate, 2);
  assert.equal(audioSourceTime(slice, 1.5), 11);
  assert.equal(slice.automation[0].gain, .3);
  assert.equal(slice.automation.at(-1).gain, .8);
  assert.equal(audioPlaybackRate({}), 1);
  assert.equal(audioPlaybackRate({ playbackRate: NaN }), 1);
});

test("linked retime preserves J/L source offsets and scales fades and automation", () => {
  const before = { ...cut, start: 5, duration: 10, sourceStart: 4 };
  const after = { ...before, start: 8, duration: 5, playbackRate: 2 };
  const result = retimeLinkedAudio({ ...audio, start: 4, duration: 12, sourceStart: 3 }, before, after);
  assert.deepEqual([result.start, result.duration, result.sourceStart, result.playbackRate], [7.5, 6, 3, 2]);
  assert.equal(result.fadeIn, .5);
  assert.equal(result.automation.at(-1).time, 5);
  assert.equal(audioSourceTime(result, after.start - result.start), after.sourceStart);
});

test("varispeed J cuts are idempotent and crossfades respect source handles", () => {
  const original = { ...audio, start: 3, duration: 4, sourceStart: 2, playbackRate: 2 };
  const j = applySplitEdit(original, 3, 4, "j-cut", .5);
  assert.deepEqual([j.start, j.sourceStart], [2.5, 1]);
  assert.deepEqual(applySplitEdit(j, 3, 4, "j-cut", .5), j);
  const pair = applyAudioCrossfade({ ...audio, duration: 3 }, original, 1);
  assert.deepEqual([pair[1].start, pair[1].sourceStart, pair[1].duration], [2, 0, 5]);
});

test("overlapping fades use the identical envelope in preview and PCM", () => {
  for (const fadeShape of ["linear", "equalPower", "exponential"]) for (const time of [0, .25, .5, .75, 1]) {
    const clip = { ...audio, start: 0, duration: 1, fadeIn: .8, fadeOut: .8, fadeShape, automation: [] };
    const expected = audioFadeGainAt(time, 1, .8, .8, fadeShape);
    assert.equal(clipGainAt(clip, time), expected);
    assert.equal(pcmFadeGainAt(time, 1, .8, .8, fadeShape), expected);
  }
});

test("standard OTIO audio timewarp retains timeline duration without ScenePilot metadata", () => {
  const document = JSON.parse(exportOtioProject({ project: "Speed", frameRate: 24, assets: [{ id: "source", name: "source.mov", kind: "video", sourcePath: "/media/source.mov" }], videoClips: [{ ...cut, trackId: "__base__" }], videoTracks: [{ id: "__base__", name: "Picture" }], audioTracks: [{ id: "a1", name: "Audio" }], audioClips: [{ ...audio, duration: 3, playbackRate: 2 }] }));
  const audioItem = document.tracks.children.find(track => track.kind === "Audio").children.find(item => item.OTIO_SCHEMA === "Clip.2");
  audioItem.metadata.scenepilot_audio.fadeShape = "exponential";
  assert.equal(importOtio(JSON.stringify(document)).audioClips[0].fadeShape, "exponential");
  const stripMetadata = value => { if (!value || typeof value !== "object") return; delete value.metadata; for (const child of Object.values(value)) stripMetadata(child); };
  stripMetadata(document);
  const imported = importOtio(JSON.stringify(document));
  assert.deepEqual(imported.audioClips.map(c => [c.duration, c.sourceStart, c.playbackRate]), [[3, 2, 2]]);
});
