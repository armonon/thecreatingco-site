import assert from "node:assert/strict";
import test from "node:test";
import { CREATOR_PROFILES, creatorProfile, inferCreatorGoalFromMedia, restoreCreatorIntent } from "../lib/instant-create.ts";
import {readFile} from "node:fs/promises";

test("instant creator profiles cover the delivery outcomes incl. narrative story cut", () => {
  assert.deepEqual(Object.keys(CREATOR_PROFILES), ["music-video", "social", "lyrics", "cinematic", "story"]);
  assert.equal(creatorProfile("social").aspect, "9:16");
  assert.equal(creatorProfile("social").autoCaptions, true);
  assert.equal(creatorProfile("lyrics").pace, "cinematic");
  assert.equal(creatorProfile("music-video").styleId, "auto");
  // Story cut is the narrative goal — landscape talking video.
  assert.equal(creatorProfile("story").aspect, "16:9");
  assert.match(creatorProfile("story").promise, /rough cut/i);
});

test("master media selects a reversible starting mode", () => {
  assert.deepEqual(inferCreatorGoalFromMedia({ name: "track.wav", type: "audio/wav" }), {
    goal: "music-video",
    sourceKind: "audio",
    reason: "Audio source detected — beats, transients, sections and the drop become the primary creative map.",
  });
  assert.equal(inferCreatorGoalFromMedia({ name: "scene.mov", type: "video/quicktime" }).goal, "cinematic");
  assert.equal(inferCreatorGoalFromMedia({ name: "offline.MP3", type: "" }).sourceKind, "audio");
});

test("saved creator choices take precedence over media inference and timing", () => {
  for (const creatorGoal of Object.keys(CREATOR_PROFILES)) {
    const state = JSON.parse(JSON.stringify({creatorGoal, inferredCreatorGoal: null, autoPolicy: {timing: "music"}}));
    assert.deepEqual(restoreCreatorIntent(state, {name: "silent.mp4", type: "video/mp4"}), {creatorGoal, inferredCreatorGoal: null});
  }
  assert.deepEqual(restoreCreatorIntent({creatorGoal: "cinematic", inferredCreatorGoal: "cinematic"}), {creatorGoal: "cinematic", inferredCreatorGoal: "cinematic"});
});

test("legacy and invalid creator choices recover from timing or source", () => {
  assert.equal(restoreCreatorIntent({autoPolicy: {timing: "dialogue"}}).creatorGoal, "story");
  assert.equal(restoreCreatorIntent({autoPolicy: {timing: "scenes"}}).creatorGoal, "cinematic");
  assert.equal(restoreCreatorIntent({}, {name: "clip.mp4", type: "video/mp4"}).creatorGoal, "cinematic");
  assert.equal(restoreCreatorIntent({creatorGoal: "__proto__"}, {name: "song.wav", type: "audio/wav"}).creatorGoal, "music-video");
  assert.deepEqual(restoreCreatorIntent({}), {creatorGoal: "music-video", inferredCreatorGoal: null});
});

test("creator intent is wired through snapshot, library, document and recovery paths", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const document = await readFile(new URL("../app/project-document.ts", import.meta.url), "utf8");
  assert.match(page, /autoPolicy, autoVersions, creatorGoal, inferredCreatorGoal/);
  assert.match(page, /restoreCreatorIntent\(value, mainFile\)/);
  assert.match(page, /restoreCreatorIntent\(restoredProState, stored.mainFile\)/);
  assert.match(page, /restoreCreatorIntent\(importedProState,/);
  assert.match(document, /creatorGoal: s.creatorGoal, inferredCreatorGoal: s.inferredCreatorGoal/);
});
