import assert from "node:assert/strict";
import test from "node:test";
import {
  boardDuration, boardToCsv, boardToCutFile, boardToMarkers, createBoard, estimateDuration, guessShotType, makeIdFactory, moveShot, parseBoardJson, parseScript, shotNumber,
} from "../lib/storyboard.ts";
import { parseCutFile } from "../lib/project-store.ts";

const SCREENPLAY = `Title: Last Order

INT. DINER - NIGHT

Rain streaks the window. MAYA stirs a coffee she hasn't touched.

CLOSE ON her hand — a pale band where a ring used to be.

JONAH
(out of breath)
You kept the place.

MAYA
I kept the coffee.

CUT TO:

EXT. PARKING LOT - CONTINUOUS

A wide, empty lot. Neon hums. Maya walks to her car alone.

INSERT - her phone screen: 3 missed calls.`;

test("screenplay: scene headings, action, explicit shots, dialogue coverage, transitions dropped", () => {
  const scenes = parseScript(SCREENPLAY, makeIdFactory("t"));
  assert.deepEqual(scenes.map((scene) => scene.heading), ["INT. DINER - NIGHT", "EXT. PARKING LOT - CONTINUOUS"]);
  const [diner, lot] = scenes;
  assert.equal(diner.shots.length, 4);
  assert.equal(diner.shots[0].shotType, "WS");
  assert.equal(diner.shots[1].shotType, "CU");
  assert.match(diner.shots[1].description, /pale band/);
  assert.equal(diner.shots[2].character, "JONAH");
  assert.equal(diner.shots[2].dialogue, "You kept the place.");
  assert.match(diner.shots[2].description, /out of breath/);
  assert.equal(diner.shots[2].shotType, "MCU");
  assert.ok(!diner.shots.some((shot) => /CUT TO/.test(shot.description)));
  assert.equal(lot.shots[0].shotType, "EWS");
  assert.equal(lot.shots[1].shotType, "INSERT");
  assert.equal(lot.shots[1].lens, "100mm macro");
});

test("prose and bullet lists become scenes of sentence/bullet shots", () => {
  const scenes = parseScript("Opening\nA skater drops into an empty pool at dawn. Slow motion of the wheels. She lands and grins.\n\n- Crowd cheering\n- Close up on the trophy\n- Aerial of the city", makeIdFactory("p"));
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].heading, "OPENING");
  assert.equal(scenes[0].shots.length, 3);
  assert.equal(scenes[1].heading, "SCENE 2");
  assert.deepEqual(scenes[1].shots.map((shot) => shot.shotType), ["WS", "CU", "AERIAL"]);
  assert.deepEqual(parseScript("   \n\n "), []);
});

test("shot type, duration and numbering heuristics", () => {
  assert.equal(guessShotType("we see it from his POV", { firstInScene: false, hasDialogue: false }), "POV");
  assert.equal(guessShotType("tears in her eyes", { firstInScene: false, hasDialogue: false }), "CU");
  assert.equal(guessShotType("they argue", { firstInScene: false, hasDialogue: false }), "MS");
  assert.equal(estimateDuration("", "one two three four five six seven eight nine ten"), 4.6);
  assert.equal(estimateDuration("short"), 2);
  assert.equal(estimateDuration(Array(90).fill("w").join(" ")), 12);
  assert.equal(shotNumber(0, 0), "1A");
  assert.equal(shotNumber(2, 25), "3Z");
  assert.equal(shotNumber(0, 26), "1AA");
});

test("moveShot reorders within and across scenes without losing shots", () => {
  const scenes = parseScript(SCREENPLAY, makeIdFactory("m"));
  const [diner, lot] = scenes;
  const moved = moveShot(scenes, diner.shots[0].id, diner.id, 2);
  assert.equal(moved[0].shots[2].id, diner.shots[0].id);
  const across = moveShot(scenes, diner.shots[3].id, lot.id, 0);
  assert.equal(across[0].shots.length, 3);
  assert.equal(across[1].shots[0].id, diner.shots[3].id);
  assert.equal(moveShot(scenes, "missing", lot.id, 0), scenes);
});

test("markers lay shots end to end and the cut file imports through ScenePilot's parser", () => {
  const board = createBoard("Last Order", parseScript(SCREENPLAY, makeIdFactory("c")));
  const markers = boardToMarkers(board);
  const shots = markers.filter((marker) => marker.kind === "marker");
  assert.equal(markers.filter((marker) => marker.kind === "chapter").length, 2);
  assert.equal(shots.length, 6);
  for (let i = 1; i < shots.length; i++) assert.ok(Math.abs(shots[i].time - (shots[i - 1].time + shots[i - 1].duration)) < 1e-6);
  assert.match(shots[0].label, /^1A WS · Rain/);
  assert.ok(markers.every((marker) => marker.label.length <= 80));
  const cut = parseCutFile(JSON.stringify(boardToCutFile(board)));
  assert.equal(cut.project, "Last Order");
  assert.ok(Math.abs(cut.duration - boardDuration(board)) < 1e-6);
  assert.equal(cut.proState.markers.length, markers.length);
  assert.match(cut.storyBrief, /SCENE 1: INT\. DINER - NIGHT/);
  assert.match(cut.storyBrief, /1C {2}MCU/);
});

test("CSV quotes commas, quotes and newlines", () => {
  const board = createBoard("x", [{ id: "s", heading: "INT. A, B", shots: [{ id: "a", description: 'He says "hi"\nthen leaves', shotType: "MS", lens: "35mm", duration: 2, notes: "" }] }]);
  const csv = boardToCsv(board);
  assert.match(csv, /^Shot,Scene,Type/);
  assert.match(csv, /1A,"INT\. A, B",MS,35mm,2,"He says ""hi""\nthen leaves"/);
});

test("board JSON round-trips and repairs hostile input", () => {
  const board = createBoard("Saved", parseScript(SCREENPLAY, makeIdFactory("j")), "2.39:1");
  board.scenes[0].shots[0].frame = "data:image/jpeg;base64,AAAA";
  const loaded = parseBoardJson(JSON.stringify(board));
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)), JSON.parse(JSON.stringify(board)));
  const repaired = parseBoardJson(JSON.stringify({ format: "scenepilot-board", aspect: "weird", scenes: [{ shots: [{ shotType: "NOPE", duration: -4, frame: "javascript:alert(1)" }, null] }] }));
  assert.equal(repaired.aspect, "16:9");
  assert.equal(repaired.scenes[0].shots[0].shotType, "MS");
  assert.equal(repaired.scenes[0].shots[0].duration, 0.1);
  assert.equal(repaired.scenes[0].shots[0].frame, undefined);
  assert.equal(repaired.scenes[0].shots.length, 2);
  assert.throws(() => parseBoardJson("{"), /valid JSON/);
  assert.throws(() => parseBoardJson("{}"), /board file/);
});
