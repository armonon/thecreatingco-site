import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createEditorContextActions } from "../app/editor-context-actions.ts";
import { contextAction, contextMenuPosition, nextContextMenuIndex } from "../lib/context-menu.ts";

test("disabled context commands cannot execute even if invoked programmatically", () => {
  let edits = 0;
  const disabled = contextAction("delete", "Delete clip", () => edits++, false, true);
  disabled.run(); assert.equal(edits, 0); assert.equal(disabled.disabled, true);
  contextAction("delete", "Delete clip", () => edits++).run(); assert.equal(edits, 1);
});
test("menus stay inside each supported desktop viewport and small screens", () => {
  for (const [w, h] of [[1920,1080], [1440,900], [1280,800], [320,480]]) {
    const pos = contextMenuPosition(w - 1, h - 1, 258, 350, w, h);
    assert.ok(pos.left >= 8 && pos.left + 258 <= w - 8);
    assert.ok(pos.top >= 8 && pos.top + 350 <= h - 8);
  }
  assert.deepEqual(contextMenuPosition(-50, -50, 250, 300, 1280, 800), { left: 8, top: 8 });
});
test("keyboard menu navigation wraps and handles no enabled items", () => {
  assert.equal(nextContextMenuIndex("ArrowDown", 2, 3), 0);
  assert.equal(nextContextMenuIndex("ArrowUp", 0, 3), 2);
  assert.equal(nextContextMenuIndex("Home", 2, 3), 0);
  assert.equal(nextContextMenuIndex("End", 0, 3), 2);
  assert.equal(nextContextMenuIndex("ArrowDown", -1, 0), -1);
});
test("all editor item surfaces declare explicit context identities", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const kind of ["base", "overlay", "video-track", "audio-track", "audio", "main-source", "timeline"]) assert.ok(page.includes(`data-context-kind="${kind}"`), kind);
  const media = await readFile(new URL("../app/media-browser.tsx", import.meta.url), "utf8");
  assert.match(media, /data-context-kind="media" data-context-id=\{asset.id\}/);
  const comp = await readFile(new URL("../app/composition-timeline.tsx", import.meta.url), "utf8");
  for (const kind of ["layer", "comp-track"]) assert.ok(comp.includes(`data-context-kind="${kind}"`));
  const keyboard = await readFile(new URL("../app/use-editor-keyboard-shortcuts.ts", import.meta.url), "utf8");
  assert.match(keyboard, /commandForKey\(event\)/);
  const routing = await readFile(new URL("../app/editor-input-routing.ts", import.meta.url), "utf8");
  assert.match(routing, /event.shiftKey \? "ripple-delete" : "delete"/);
  const menu = await readFile(new URL("../app/editor-context-menu.tsx", import.meta.url), "utf8");
  assert.match(menu, /data-editor-shortcuts="local"/);
  assert.match(menu, /event.key === "ContextMenu"/);
  assert.match(menu, /event.key === "Escape"/);
  assert.match(menu, /input, textarea, select/);
});
test("native menus select the clicked row and share validated commands", async () => {
  const menu = await readFile(new URL("../native-macos/Sources/ScenePilotNative/ContextMenus.swift", import.meta.url), "utf8");
  assert.match(menu, /selectRowIndexes\(IndexSet\(integer: clicked\)/);
  assert.match(menu, /#selector\(invoke\(_:\)\)/);
  assert.match(menu, /enabled\(command\)/);
  const timeline = await readFile(new URL("../native-macos/Sources/ScenePilotNative/TimelineView.swift", import.meta.url), "utf8");
  assert.match(timeline, /onSelect\?\(clip\?\.id, track.id\)/);
});

async function menuFactory(overrides = {}) {
  const calls = [];
  const capture = name => (...args) => calls.push([name, ...args]);
  const env = {
    analyzing: false, rendering: false, rotoTracking: { active: false },
    baseCuts: [], placements: [], clipTracks: [], audioTracks: [], audioClips: [], assets: [],
    selectedBaseCutId: null, selectedPlacementId: null, currentTime: 2, isPro: false,
    mediaName: () => "Test footage", updateBaseCut: capture("base-update"), updatePlacement: capture("overlay-update"),
    setActivePanel: capture("panel"), razorAt: capture("razor"), splitPlacementAt: capture("split-overlay"),
    setProjectPanelTab: capture("panel-tab"),
    addClipTrack: capture("add-track"), addAudioTrack: capture("add-audio"),
    selectedAudioClip: null, selectedPlacement: null, selectedBaseCut: null, selectedBaseCutIds: [], linkedSelection: false,
    checkpoint: capture("checkpoint"), setBaseCuts: update => calls.push(["base-clips", update(env.baseCuts).map(c => c.id)]),
    setSelectedBaseCutId: () => {}, setSelectedBaseCutIds: () => {}, setStatus: () => {},
    ...overrides,
  };
  env.selectedBaseCut = env.baseCuts.find(c => c.id === env.selectedBaseCutId) ?? null;
  const actions = createEditorContextActions(env);
  env.runCommand = (id) => { if (id === "delete") actions.deleteTimelineSelection(false, env.selectedBaseCut ? "base" : "overlay"); else calls.push(["command", id]); };
  return { build: actions.buildContextMenu, calls };
}

test("media audio placement has a named unlocked destination and one undo step", async () => {
  let checkpoints = 0, clips = [];
  const asset = { id: "media", name: "Tone.wav", kind: "audio", duration: 6, url: "blob:qa" };
  const env = { isPro: true, assets: [asset], audioTracks: [{ id: "locked", name: "Locked", locked: true }, { id: "a1", name: "Music", locked: false }],
    checkpoint: () => checkpoints++, setAudioClips: update => { clips = update(clips); }, setSelectedAudioClipId() {}, setSelectedAudioTrackId() {} };
  const { build } = await menuFactory(env);
  const action = build({ kind: "media", id: asset.id }).actions.find(a => a.id === "place-audio");
  assert.match(action.label, /Music/); action.run();
  assert.equal(checkpoints, 1); assert.equal(clips[0].trackId, "a1"); assert.equal(clips[0].start, 2); assert.equal(clips[0].linkedVideoId, undefined);
  const locked = await menuFactory({ ...env, audioTracks: [{ id: "a1", locked: true }] });
  locked.build({ kind: "media", id: asset.id }).actions.find(a => a.id === "place-audio").run();
  assert.equal(checkpoints, 1);
});

test("right-clicking a video track clears prior audio and picture clip selections", async () => {
  const state = { track: null, overlay: "old-overlay", base: "old-base", audio: "old-audio", panel: null };
  const env = {
    setSelectedTrackId: value => { state.track = value; },
    setSelectedPlacementId: value => { state.overlay = value; },
    setSelectedBaseCutId: value => { state.base = value; },
    setSelectedAudioClipId: value => { state.audio = value; },
    setActivePanel: value => { state.panel = value; },
  };
  const select = createEditorContextActions(env).selectContextTarget;
  select({ kind: "video-track", id: "v2" });
  assert.deepEqual(state, { track: "v2", overlay: null, base: null, audio: null, panel: "track" });
});

test("clip menu edits only its selected target and splits at the unchanged playhead", async () => {
  const clip = { id: "b", assetId: "video", start: 1, duration: 3 };
  const { build, calls } = await menuFactory({ baseCuts: [{ ...clip, id: "a" }, clip], selectedBaseCutId: "b" });
  const menu = build({ kind: "base", id: "b" });
  menu.actions.find(a => a.id === "glow").run();
  menu.actions.find(a => a.id === "split").run();
  menu.actions.find(a => a.id === "delete").run();
  assert.equal(calls[0][0], "base-update");
  assert.equal(calls[0][1].effects[0].type, "glow");
  assert.deepEqual(calls.slice(1), [["command", "split"], ["checkpoint"], ["base-clips", ["a"]]]);
});

test("locked clip and track menus refuse mutations and empty-space clicks never target stale clips", async () => {
  const { build, calls } = await menuFactory({ placements: [{ id: "p", trackId: "t", start: 1, duration: 3 }], clipTracks: [{ id: "t", name: "Locked", locked: true }], selectedPlacementId: "p" });
  const menu = build({ kind: "overlay", id: "p" });
  for (const id of ["glow", "split", "fade", "delete"]) { const action = menu.actions.find(a => a.id === id); assert.equal(action.disabled, true); action.run(); }
  const trackMenu = build({ kind: "video-track", id: "t" });
  for (const id of ["up", "down", "remove"]) assert.equal(trackMenu.actions.find(a => a.id === id).disabled, true);
  assert.equal(build({ kind: "overlay", id: "missing" }), null);
  assert.deepEqual(calls, []);
});

test("busy jobs disable context actions and nonempty tracks cannot be removed", async () => {
  const { build } = await menuFactory({ rendering: true, baseCuts: [{ id: "a", start: 0, duration: 4 }], selectedBaseCutId: "a" });
  assert.ok(build({ kind: "base", id: "a" }).actions.every(action => action.disabled));
  const track = await menuFactory({ clipTracks: [{ id: "t", name: "Used" }, { id: "other" }], placements: [{ id: "p", trackId: "t" }] });
  assert.equal(track.build({ kind: "video-track", id: "t" }).actions.find(a => a.id === "remove").disabled, true);
});

async function deletionFixture(overrides = {}) {
  const state = { checkpoints: 0, video: [{ id: "b", start: 0, duration: 3 }, { id: "other", start: 3, duration: 2 }], audio: [{ id: "linked", linkedVideoId: "b", trackId: "a" }, { id: "unrelated", trackId: "a" }] };
  const noop = () => {};
  const env = {
    analyzing: false, rendering: false, rotoTracking: { active: false }, selectedAudioClip: null, selectedPlacement: null,
    selectedBaseCut: state.video[0], selectedBaseCutIds: ["b"], baseCuts: state.video, audioClips: state.audio,
    audioTracks: [{ id: "a", locked: false }], clipTracks: [], linkedSelection: true,
    checkpoint: () => state.checkpoints++, setBaseCuts: fn => { state.video = fn(state.video); }, setAudioClips: fn => { state.audio = fn(state.audio); },
    setSelectedAudioClipId: noop, setSelectedAutomationPointId: noop, setSelectedPlacementId: noop, setSelectedBaseCutId: noop, setSelectedBaseCutIds: noop, setStatus: noop,
    ...overrides,
  };
  return { state, remove: createEditorContextActions(env).deleteTimelineSelection };
}

test("shared deletion makes one undo checkpoint and preserves unrelated clips/audio", async () => {
  const { state, remove } = await deletionFixture();
  remove(false, "base");
  assert.equal(state.checkpoints, 1);
  assert.deepEqual(state.video.map(c => c.id), ["other"]);
  assert.deepEqual(state.audio.map(c => c.id), ["unrelated"]);
});

test("locked linked audio blocks deleting its video without a checkpoint", async () => {
  const { state, remove } = await deletionFixture({ audioTracks: [{ id: "a", locked: true }] });
  remove(false, "base");
  assert.equal(state.checkpoints, 0);
  assert.equal(state.video.length, 2);
  assert.equal(state.audio.length, 2);
});

test("explicit inspector/menu target cannot delete a stale audio selection instead", async () => {
  const { state, remove } = await deletionFixture({ selectedAudioClip: { id: "unrelated", trackId: "a" } });
  remove(false, "base");
  assert.deepEqual(state.video.map(c => c.id), ["other"]);
  assert.deepEqual(state.audio.map(c => c.id), ["unrelated"]);
});
