import assert from "node:assert/strict";
import test from "node:test";

test("intrinsic main-source audio uses the main file resolver and zero master gain stays silent", () => {
  const clip = { id: "main-ref", assetId: "__main__", start: 0, sourceStart: 1, duration: 2, gain: 1, pan: 0, fadeIn: 0, fadeOut: 0 };
  const input = { main: false, duration: 2, masterGain: 1, audioClips: [], audioTracks: [], audioBuses: [], composition: { clips: [clip], issues: [] } };
  const [scheduled] = programAudioSchedule(input);
  assert.equal(scheduled.assetId, null);
  assert.equal(scheduled.sourceStart, 1);
  assert.deepEqual(programAudioSchedule({ ...input, main: true, masterGain: 0 }), []);
});
import { compositionAudioPlan, requireCompositionAudio } from "../lib/composition-audio.ts";
import { audioEnvelopesGainAt } from "../lib/audio-crossfade.ts";
import { cropScheduledAudio } from "../lib/audio-schedule.ts";
import { programAudioSchedule } from "../lib/program-audio.ts";

const audio = (id, patch = {}) => ({ id, name: id, kind: "media", trackId: "a", assetId: "song", enabled: true, start: 0, duration: 4, sourceStart: 0, audioFadeIn: 0, audioFadeOut: 0, ...patch });
const comp = (id, layers, duration = 4) => ({ id, name: id, duration, tracks: [{ id: "a", kind: "audio", enabled: true }, { id: "v", kind: "video", enabled: true }], layers });
const placement = (id, patch = {}) => ({ id: "p", assetId: `composition:${id}`, compositionId: id, start: 10, duration: 4, ...patch });

test("composition audio multiplies nested rates and follows source offsets", () => {
  const child = comp("child", [audio("sound", { sourceStart: 1, playbackRate: .5 })]);
  const parent = comp("parent", [audio("nest", { kind: "composition", trackId: "v", compositionId: "child", sourceStart: 1, playbackRate: 2 })]);
  const plan = compositionAudioPlan([parent, child], [placement("parent", { sourceStart: .5, playbackRate: 2, duration: .5 })]);
  assert.deepEqual(plan.issues, []);
  assert.deepEqual(plan.clips.map(c => [c.start, c.sourceStart, c.duration, c.playbackRate]), [[10, 2, .5, 2]]);
  assert.deepEqual(structuredClone(plan), plan, "worker payload contains only data");
});

test("trimmed and repeated composition clocks loop audio alongside picture", () => {
  const plan = compositionAudioPlan([comp("c", [audio("sound")])], [placement("c", { sourceStart: 3, duration: 7 })]);
  assert.deepEqual(plan.clips.map(c => [c.start, c.sourceStart, c.duration]), [[10, 3, 1], [11, 0, 4], [15, 0, 2]]);
  assert.equal(new Set(plan.clips.map(c => c.id)).size, 3);
});

test("nested group gain/fades and layer fades keep original clocks after cropping", () => {
  const child = comp("child", [audio("sound", { audioGain: .5, audioFadeIn: 2, audioFadeOut: 2 })]);
  const parent = comp("parent", [audio("nest", { kind: "composition", trackId: "v", compositionId: "child", audioGain: .5, audioFadeIn: 4, audioFadeOut: 0 })]);
  const [segment] = compositionAudioPlan([child, parent], [placement("parent", { sourceStart: 1, duration: 2 })]).clips;
  assert.equal(segment.gain, .25);
  assert.equal(audioEnvelopesGainAt(segment.envelopes, 0), .5 * .25);
  const cropped = cropScheduledAudio(segment, 10.5, 11.5);
  assert.equal(cropped.sourceStart, 1.5);
  assert.equal(cropped.playbackRate, 1);
  assert.equal(audioEnvelopesGainAt(cropped.envelopes, 0), .75 * .375);
  assert.equal(audioEnvelopesGainAt(cropped.envelopes, .5), audioEnvelopesGainAt(segment.envelopes, 1));
});

test("composition audio respects hidden/muted/solo parent and master tracks", () => {
  const c = comp("c", [audio("sound")]);
  assert.equal(compositionAudioPlan([{ ...c, tracks: c.tracks.map(t => ({ ...t, muted: true })) }], [placement("c")]).clips.length, 0);
  assert.equal(compositionAudioPlan([c], [placement("c", { trackId: "hidden" })], [{ id: "hidden", enabled: false }]).clips.length, 0);
  const solo = { ...c, tracks: [...c.tracks, { id: "other", kind: "audio", enabled: true, solo: true }] };
  assert.equal(compositionAudioPlan([solo], [placement("c")]).clips.length, 0);
});

test("invalid timing and circular nests report actionable delivery blockers", () => {
  const cyclic = comp("c", [audio("loop", { kind: "composition", compositionId: "c" })]);
  assert.throws(() => requireCompositionAudio(compositionAudioPlan([cyclic], [placement("c")])), /cycle/);
  const fast = comp("c", [audio("fast", { playbackRate: 8 })]);
  assert.throws(() => requireCompositionAudio(compositionAudioPlan([fast], [placement("c", { playbackRate: 2 })])), /combined rate/);
  const reverse = comp("c", [audio("reverse", { clipReversed: true })]);
  assert.throws(() => requireCompositionAudio(compositionAudioPlan([reverse], [placement("c")])), /reverse/);
});

test("unbounded loops cannot hang or allocate an unbounded audio schedule", () => {
  const plan = compositionAudioPlan([comp("c", [audio("sound", { duration: .001 })], .001)], [placement("c", { duration: 1e9 })]);
  assert.ok(plan.clips.length <= 10000);
  assert.match(plan.issues.join(" "), /limit|10,000/);
});

test("program ranges retain fade values, automation boundaries, rates and bus isolation", () => {
  const clip = { ...audio("sound"), name: "sound", trackId: "music", start: 0, sourceStart: 1, duration: 4, gain: 1, pan: 0, fadeIn: 4, fadeOut: 0, playbackRate: 2, automation: [{ id: "a", time: 0, gain: 0 }, { id: "b", time: 4, gain: 1 }] };
  const input = { main: false, duration: 4, from: 1, to: 3, masterGain: .5, audioClips: [clip], audioTracks: [{ id: "music", gain: 1, pan: 0, busId: "bus-music" }], audioBuses: [{ id: "bus-music", gain: .5 }], composition: { clips: [], issues: [] } };
  const [segment] = programAudioSchedule(input);
  assert.deepEqual([segment.start, segment.duration, segment.sourceStart, segment.playbackRate, segment.gain], [0, 2, 3, 2, .25]);
  assert.equal(audioEnvelopesGainAt(segment.envelopes, 0), .25);
  assert.deepEqual(segment.automation.map(p => [p.time, p.gain]), [[0, .25], [2, .75]]);
  assert.equal(programAudioSchedule({ ...input, stem: "dialogue" }).length, 0);
  assert.deepEqual(programAudioSchedule({ ...input, stem: "music" }), programAudioSchedule(input));
});
