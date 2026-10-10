import assert from "node:assert/strict";
import test from "node:test";
import { assignClip, cutEnergy, generateCut, holdBeats, PRESETS, shotAt, slipShot, summarizeCut, swapShot } from "../lib/autocut-cut.ts";
import { fakeClip, fakeMusic } from "./helpers/autocut-synth.mjs";

const music = fakeMusic();
const pool = [
  fakeClip("calm-a", { energy: 0.1, hero: 0.3 }),
  fakeClip("calm-b", { energy: 0.2, hero: 0.4 }),
  fakeClip("mid-a", { energy: 0.5, hero: 0.5 }),
  fakeClip("mid-b", { energy: 0.55, hero: 0.5 }),
  fakeClip("hot-a", { energy: 0.9, hero: 0.6 }),
  fakeClip("hot-b", { energy: 0.95, hero: 0.95 }),
  fakeClip("dead", { energy: 0.5, segments: [] }), // nothing usable
];
const request = (overrides = {}) => ({ music, clips: pool, preset: "music-video", density: 0.5, seed: 1, ...overrides });
const onGrid = (time, range = [0, music.duration]) => music.beats.some((beat) => Math.abs(beat - time) < 1e-6) || range.some((edge) => Math.abs(edge - time) < 1e-6);
const meanLength = (shots, from, to) => {
  const inside = shots.filter((shot) => shot.start >= from && shot.start < to);
  return inside.reduce((sum, shot) => sum + shot.duration, 0) / inside.length;
};

function assertContiguous(shots, start, end) {
  assert.ok(Math.abs(shots[0].start - start) < 1e-6, `starts at ${shots[0].start}`);
  for (let index = 1; index < shots.length; index++) {
    const previousEnd = shots[index - 1].start + shots[index - 1].duration;
    assert.ok(Math.abs(previousEnd - shots[index].start) < 1e-6, `gap/overlap before shot ${index}: ${previousEnd} vs ${shots[index].start}`);
  }
  const last = shots.at(-1);
  assert.ok(Math.abs(last.start + last.duration - end) < 1e-6, `ends at ${last.start + last.duration}`);
}

test("covers the song with contiguous shots that cut on beats", () => {
  const shots = generateCut(request());
  assertContiguous(shots, 0, music.duration);
  for (const shot of shots) assert.ok(onGrid(shot.start), `cut at ${shot.start} is on a beat`);
  assert.ok(shots.length > 15);
});

test("cut density follows energy: long shots in the intro, fast on the chorus", () => {
  const shots = generateCut(request());
  const intro = meanLength(shots, 0, 16);
  const chorus = meanLength(shots, 32, 48);
  assert.ok(intro >= 2.5 * chorus, `intro ${intro.toFixed(2)} s vs chorus ${chorus.toFixed(2)} s`);
  assert.ok(chorus <= 1.25, `chorus shots ${chorus}`);
});

test("section starts and the drop get a fresh, hero-flagged cut", () => {
  const shots = generateCut(request());
  for (const time of [16, 32, 48]) {
    const shot = shots.find((item) => Math.abs(item.start - time) < 1e-6);
    assert.ok(shot, `cut at section start ${time}`);
    assert.ok(shot.hero, `hero at ${time}`);
  }
  // The best hero clip opens the chorus most of the time across seeds.
  let hotOpeners = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const opener = generateCut(request({ seed })).find((shot) => Math.abs(shot.start - 32) < 1e-6);
    if (opener.clipId === "hot-b" || opener.clipId === "hot-a") hotOpeners++;
  }
  assert.ok(hotOpeners >= 8, `${hotOpeners}/12 chorus openers are the high-energy hero clips`);
});

test("never the same clip back-to-back, never unusable footage, sources stay inside usable segments", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const shots = generateCut(request({ seed, preset: "hype", density: 0.9 }));
    assert.equal(summarizeCut(shots).backToBack, 0, `seed ${seed}`);
    for (const shot of shots) {
      assert.notEqual(shot.clipId, "dead");
      const clip = pool.find((item) => item.id === shot.clipId);
      assert.ok(clip.segments.some((segment) => shot.sourceStart >= segment.start - 1e-6 && shot.sourceStart + shot.duration <= segment.end + 1e-6), `shot ${shot.id} inside a segment`);
    }
  }
});

test("energy matching: calm clips in the intro, hot clips in the chorus", () => {
  let calmIntro = 0, hotChorus = 0, introCount = 0, chorusCount = 0;
  for (let seed = 1; seed <= 10; seed++) {
    for (const shot of generateCut(request({ seed }))) {
      if (shot.start < 16) { introCount++; if (shot.clipId.startsWith("calm")) calmIntro++; }
      if (shot.start >= 32 && shot.start < 48) { chorusCount++; if (shot.clipId.startsWith("hot") || shot.clipId.startsWith("mid")) hotChorus++; }
    }
  }
  assert.ok(calmIntro / introCount > 0.5, `calm in intro ${calmIntro}/${introCount}`);
  assert.ok(hotChorus / chorusCount > 0.6, `hot/mid in chorus ${hotChorus}/${chorusCount}`);
});

test("deterministic per seed; re-roll gives a different variation", () => {
  assert.deepEqual(generateCut(request({ seed: 42 })), generateCut(request({ seed: 42 })));
  const a = generateCut(request({ seed: 1 })).map((shot) => `${shot.clipId}@${shot.start}`).join();
  const b = generateCut(request({ seed: 2 })).map((shot) => `${shot.clipId}@${shot.start}`).join();
  assert.notEqual(a, b);
});

test("density slider and presets change the pace in the right order", () => {
  const count = (overrides) => generateCut(request(overrides)).length;
  assert.ok(count({ density: 1 }) > count({ density: 0.5 }) * 1.4);
  assert.ok(count({ density: 0 }) < count({ density: 0.5 }) * 0.75);
  const chill = count({ preset: "chill" });
  const video = count({ preset: "music-video" });
  const hype = count({ preset: "hype" });
  assert.ok(chill < video && video < hype, `chill ${chill} < music video ${video} < hype ${hype}`);
});

test("hype stutters on the chorus at high density with half-beat cuts", () => {
  const shots = generateCut(request({ preset: "hype", density: 1 }));
  const halves = shots.filter((shot) => Math.abs(shot.duration - 0.25) < 1e-6);
  assert.ok(halves.length > 4, `${halves.length} half-beat shots`);
  assert.ok(halves.every((shot) => shot.label === "chorus" || shot.label === "verse"));
});

test("trailer accelerates toward the end", () => {
  const flat = fakeMusic({ sections: [{ start: 0, end: 64, energy: 0.5, label: "verse" }] });
  const shots = generateCut({ music: { ...flat, dropStrength: 0 }, clips: pool, preset: "trailer", density: 0.5, seed: 3 });
  assert.ok(meanLength(shots, 0, 20) > 2.5 * meanLength(shots, 44, 64), "first third much slower than the last");
});

test("holds of a bar or more end on downbeats", () => {
  const shots = generateCut(request({ preset: "chill" }));
  const long = shots.filter((shot) => shot.duration >= 2 - 1e-6);
  const onOne = long.filter((shot) => music.downbeats.some((time) => Math.abs(time - (shot.start + shot.duration)) < 1e-6) || Math.abs(shot.start + shot.duration - music.duration) < 1e-6);
  assert.ok(onOne.length / long.length > 0.9, `${onOne.length}/${long.length}`);
});

test("locked shots survive a re-roll exactly", () => {
  const first = generateCut(request({ seed: 5 }));
  const keep = [first[3], first[10]].map((shot) => ({ ...shot, locked: true }));
  const reroll = generateCut(request({ seed: 6, locked: keep }));
  for (const shot of keep) {
    const found = reroll.find((item) => Math.abs(item.start - shot.start) < 1e-6);
    assert.ok(found, "locked shot present");
    assert.equal(found.clipId, shot.clipId);
    assert.equal(found.duration, shot.duration);
    assert.equal(found.sourceStart, shot.sourceStart);
    assert.ok(found.locked);
  }
  assertContiguous(reroll, 0, music.duration);
});

test("a range (best 30 s) cuts only inside it", () => {
  const shots = generateCut(request({ range: { start: 16, end: 46 } }));
  assertContiguous(shots, 16, 46);
  for (const shot of shots) assert.ok(onGrid(shot.start, [16, 46]));
});

test("clips too short for the slot end the shot early instead of freezing", () => {
  const shorts = ["s1", "s2", "s3"].map((id) => fakeClip(id, { duration: 0.8, energy: 0.2 }));
  const shots = generateCut({ music, clips: shorts, preset: "chill", density: 0, seed: 1 });
  assertContiguous(shots, 0, music.duration);
  for (const shot of shots) assert.ok(shot.duration <= 0.8 + 1e-6, `shot ${shot.duration}`);
});

// ---- Performance mode ---------------------------------------------------------

const takes = [
  fakeClip("take-1", { duration: 64, offset: 0, energy: 0.6, hero: 0.8 }),
  fakeClip("take-2", { duration: 58, offset: 4, energy: 0.6, hero: 0.7 }),
  fakeClip("take-3", { duration: 70, offset: -3, energy: 0.6, hero: 0.75 }),
];
const broll = [fakeClip("broll-1", { energy: 0.3 }), fakeClip("broll-2", { energy: 0.8 })];

test("performance: synced takes keep the song's time so lip sync holds", () => {
  const shots = generateCut({ music, clips: [...takes, ...broll], preset: "music-video", density: 0.5, seed: 9, performance: true, brollMix: 0 });
  assertContiguous(shots, 0, music.duration);
  const synced = shots.filter((shot) => shot.synced);
  assert.ok(synced.length / shots.length > 0.9, `${synced.length}/${shots.length} synced`);
  for (const shot of synced) {
    const take = takes.find((item) => item.id === shot.clipId);
    assert.ok(Math.abs(shot.sourceStart - (shot.start - take.offset)) < 1e-6, `${shot.id} in sync`);
  }
  assert.equal(summarizeCut(shots).backToBack, 0);
  // take-2 only starts at 4 s on the song: it never appears before that.
  assert.ok(shots.filter((shot) => shot.clipId === "take-2").every((shot) => shot.start >= 4));
  assert.ok(new Set(synced.map((shot) => shot.clipId)).size === 3, "cuts between all takes");
});

test("performance: B-roll mix brings in cutaways, more of them in quiet sections", () => {
  const shots = generateCut({ music, clips: [...takes, ...broll], preset: "music-video", density: 0.5, seed: 4, performance: true, brollMix: 0.5 });
  const brollShots = shots.filter((shot) => !shot.synced);
  assert.ok(brollShots.length > 2);
  assert.ok(brollShots.every((shot) => shot.clipId.startsWith("broll")));
  const all = generateCut({ music, clips: [...takes, ...broll], preset: "music-video", density: 0.5, seed: 4, performance: true, brollMix: 1 });
  assert.ok(all.filter((shot) => !shot.synced).length > brollShots.length);
});

// ---- Editing ------------------------------------------------------------------

test("swap replaces a shot with a different clip, same timing", () => {
  const shots = generateCut(request({ seed: 7 }));
  const index = 5;
  const swapped = swapShot(request({ seed: 7 }), shots, index, 99);
  assert.ok(swapped);
  assert.notEqual(swapped[index].clipId, shots[index].clipId);
  assert.notEqual(swapped[index].clipId, shots[index - 1].clipId);
  assert.notEqual(swapped[index].clipId, shots[index + 1].clipId);
  assert.equal(swapped[index].start, shots[index].start);
  assert.equal(swapped[index].duration, shots[index].duration);
  assert.deepEqual(swapped.filter((_, i) => i !== index), shots.filter((_, i) => i !== index));
});

test("assign a specific clip, slip a shot, find the shot at a time", () => {
  const shots = generateCut(request({ seed: 7 }));
  const assigned = assignClip(request(), shots, 2, "hot-b");
  assert.equal(assigned[2].clipId, "hot-b");
  assert.equal(assignClip(request(), shots, 2, "dead"), null);
  const slipped = slipShot(shots, 2, 12, 100);
  assert.equal(slipped[2].sourceStart, 12 - shots[2].duration);
  const middle = shots[4].start + shots[4].duration / 2;
  assert.equal(shotAt(shots, middle).id, shots[4].id);
  assert.equal(shotAt(shots, 999), undefined);
});

test("hold and energy helpers", () => {
  assert.equal(holdBeats(PRESETS["music-video"], 0, 0.5, 4), 8);
  assert.equal(holdBeats(PRESETS["music-video"], 1, 0.5, 4), 2);
  assert.equal(holdBeats(PRESETS.hype, 1, 1, 4, 0, 0.5), 0.5);
  assert.ok(cutEnergy(music, 40, "drop", 0.2) >= 0.9);
  assert.ok(cutEnergy(music, 40, "intro", 1) <= 0.35);
});

test("empty inputs give an empty cut", () => {
  assert.deepEqual(generateCut(request({ clips: [] })), []);
  assert.deepEqual(generateCut(request({ range: { start: 10, end: 10 } })), []);
});
