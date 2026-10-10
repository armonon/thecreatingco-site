import assert from "node:assert/strict";
import test from "node:test";
import { computeFramePlan, fitCover, fitInside, MAIN_SOURCE_ID, mattePixelAlpha, paintFramePlan, whiteBalancePixel } from "../lib/compositor.ts";
import { nestBaseCuts } from "../lib/nest.ts";
import { toUnifiedTimeline } from "../lib/video-timeline.ts";
import { TRANSITION_PRESETS } from "../lib/transitions.ts";
import { PUNCH_PRESETS } from "../lib/motion.ts";
import { GRADE_PRESETS } from "../lib/grade.ts";

const assets = [
  { id: "clipA", kind: "video", width: 1920, height: 1080, duration: 10 },
  { id: "clipB", kind: "video", width: 1080, height: 1920, duration: 10 },
  { id: "still", kind: "image", width: 800, height: 600, duration: Infinity },
];

const tracks = [
  { id: "t1", enabled: true, blend: "screen", opacity: 100, hue: 0, saturation: 100, brightness: 100, glow: 0, color: "#fff", fadeIn: 0, fadeOut: 0 },
  { id: "t2", enabled: false, blend: "overlay", opacity: 80, hue: 10, saturation: 120, brightness: 90, glow: 4, color: "#f00", fadeIn: 0, fadeOut: 0 },
];

const baseCuts = [
  { id: "c0", assetId: "clipA", sectionId: "s", start: 0, duration: 2, sourceStart: 1 },
  { id: "c1", assetId: "clipB", sectionId: "s", start: 2, duration: 2, sourceStart: 0 },
];

const base = { width: 1920, height: 1080, assets, placements: [], tracks };

test("pixel matte conversion uses alpha or Rec. 709 luminance with inversion", () => {
  assert.equal(mattePixelAlpha(255, 255, 255, 128, "alpha", false), 128);
  assert.equal(mattePixelAlpha(255, 255, 255, 128, "alpha", true), 127);
  assert.equal(mattePixelAlpha(255, 255, 255, 255, "luma", false), 255);
  assert.equal(mattePixelAlpha(0, 0, 0, 255, "luma", false), 0);
  assert.ok(mattePixelAlpha(0, 255, 0, 255, "luma", false) > mattePixelAlpha(255, 0, 0, 255, "luma", false));
});

test("per-clip white balance uses the sequence shader's two independent color axes", () => {
  assert.deepEqual(whiteBalancePixel(128, 128, 128, 1, 0), [148, 128, 108], "temperature warms red and cools blue");
  assert.deepEqual(whiteBalancePixel(128, 128, 128, 0, 1), [138, 108, 138], "positive tint adds magenta and removes green");
  assert.deepEqual(whiteBalancePixel(128, 128, 128, Number.NaN, 0), [128, 128, 128], "invalid values degrade to neutral");
});

test("frame plans carry serializable per-clip white balance into the shared painter", () => {
  const color = { exposure: 1, contrast: 1, saturation: 1, hue: 0, temperature: -.4, tint: .25 };
  const plan = computeFramePlan({ ...base, time: .5, baseCuts: [{ ...baseCuts[0], color }] });
  assert.deepEqual(plan.layers.find((layer) => layer.kind === "base").whiteBalance, { temperature: -.4, tint: .25 });
  assert.doesNotThrow(() => structuredClone(plan));
});

test("montage mode picks the active cut and maps the source playhead", () => {
  const plan = computeFramePlan({ ...base, time: 0.5, baseCuts });
  const layer = plan.layers.find((l) => l.kind === "base");
  assert.equal(layer.assetId, "clipA");
  // sourceStart 1 + 0.5 elapsed
  assert.ok(Math.abs(layer.sourceTime - 1.5) < 1e-9);

  const later = computeFramePlan({ ...base, time: 2.25, baseCuts });
  assert.equal(later.layers.find((l) => l.kind === "base").assetId, "clipB");
});

test("retimed montage clips use the same source clock in preview and export plans", () => {
  const cuts = [{ id: "fast", assetId: "clipA", sectionId: "s", start: 1, duration: 3, sourceStart: 2, playbackRate: 2 }];
  const plan = computeFramePlan({ ...base, time: 2.25, baseCuts: cuts });
  assert.equal(plan.layers.find((layer) => layer.kind === "base").sourceTime, 4.5);
});

test("source time never runs past the end of the clip", () => {
  const shortAsset = [{ id: "tiny", kind: "video", width: 100, height: 100, duration: 0.5 }];
  const cuts = [{ id: "c", assetId: "tiny", sectionId: "s", start: 0, duration: 5, sourceStart: 0.4 }];
  const plan = computeFramePlan({ ...base, assets: shortAsset, time: 3, baseCuts: cuts });
  const layer = plan.layers.find((l) => l.kind === "base");
  assert.ok(layer.sourceTime < 0.5, "clamped inside the source");
  assert.ok(layer.sourceTime >= 0);
});

test("falls back to the continuous main video when there is no montage", () => {
  const plan = computeFramePlan({ ...base, time: 1, mainVideo: { width: 1920, height: 1080 } });
  const layer = plan.layers.find((l) => l.kind === "base");
  assert.equal(layer.assetId, MAIN_SOURCE_ID);
  assert.equal(layer.sourceTime, 1);
});

test("the base fills the frame in montage mode and letterboxes in main-video mode", () => {
  const montage = computeFramePlan({ ...base, time: 0.5, baseCuts });
  const cover = montage.layers.find((l) => l.kind === "base").box;
  // 1920x1080 source into a 1920x1080 frame: exact fill.
  assert.ok(Math.abs(cover.width - 1920) < 1e-6 && Math.abs(cover.height - 1080) < 1e-6);

  const tall = [{ id: "clipB", kind: "video", width: 1080, height: 1920, duration: 10 }];
  const tallCut = [{ id: "c", assetId: "clipB", sectionId: "s", start: 0, duration: 2, sourceStart: 0 }];
  const plan = computeFramePlan({ ...base, assets: tall, time: 0.5, baseCuts: tallCut });
  const box = plan.layers.find((l) => l.kind === "base").box;
  assert.ok(box.height > 1080, "portrait source is cropped, never letterboxed");
});

test("a nested reversed clip renders its reversed source time (lossless nesting)", () => {
  // A single reversed clip nested into a composition, placed back on the timeline.
  const clip = { id: "a", assetId: "clipA", sectionId: "s", start: 0, duration: 2, sourceStart: 5, reversed: true };
  const { composition } = nestBaseCuts([clip], ["a"], { width: 1920, height: 1080, compositionId: "nest", name: "N" });
  const placements = [{ assetId: "composition:nest", compositionId: "nest", trackId: "t1", start: 0, duration: 2, scale: 100, opacity: 100 }];
  // At t=0 a reversed clip shows the LAST source frame: sourceStart + duration = 7.
  const atStart = computeFramePlan({ ...base, time: 0, placements, compositions: [composition] });
  const layerStart = atStart.layers.find((l) => l.assetId === "clipA");
  assert.ok(layerStart, "nested media layer present");
  assert.ok(Math.abs(layerStart.sourceTime - 7) < 1e-6, `reversed start frame (got ${layerStart.sourceTime})`);
  // Near the end it approaches the first source frame (5).
  const atEnd = computeFramePlan({ ...base, time: 1.9, placements, compositions: [composition] });
  const layerEnd = atEnd.layers.find((l) => l.assetId === "clipA");
  assert.ok(layerEnd.sourceTime < 5.2, `reversed toward first frame (got ${layerEnd.sourceTime})`);
});

test("a nested flipped clip carries its flip through the composition", () => {
  const clip = { id: "a", assetId: "clipA", sectionId: "s", start: 0, duration: 2, sourceStart: 0, flipH: true };
  const { composition } = nestBaseCuts([clip], ["a"], { width: 1920, height: 1080, compositionId: "nf", name: "N" });
  const placements = [{ assetId: "composition:nf", compositionId: "nf", trackId: "t1", start: 0, duration: 2, scale: 100, opacity: 100 }];
  const plan = computeFramePlan({ ...base, time: 0.5, placements, compositions: [composition] });
  const layer = plan.layers.find((l) => l.assetId === "clipA");
  assert.equal(layer.flipH, true, "flip survives nesting");
});

test("overlay clips carry base-cut attributes: reverse + flip render on any track", () => {
  const placements = [{
    assetId: "clipA", trackId: "t1", start: 0, duration: 2, scale: 100, opacity: 100,
    sourceStart: 5, reversed: true, flipH: true,
  }];
  // Reversed overlay at t=0 shows the last source frame: sourceStart + duration = 7.
  const plan = computeFramePlan({ ...base, time: 0, placements });
  const overlay = plan.layers.find((l) => l.kind === "overlay");
  assert.ok(overlay, "overlay present");
  assert.ok(Math.abs(overlay.sourceTime - 7) < 1e-6, `reversed overlay start frame (got ${overlay.sourceTime})`);
  assert.equal(overlay.flipH, true, "flip applies to overlays");
});

test("a plain overlay still plays forward (unchanged default)", () => {
  const placements = [{ assetId: "clipA", trackId: "t1", start: 0, duration: 2, scale: 100, opacity: 100, sourceStart: 1 }];
  const plan = computeFramePlan({ ...base, time: 0.5, placements });
  const overlay = plan.layers.find((l) => l.kind === "overlay");
  assert.ok(Math.abs(overlay.sourceTime - 1.5) < 1e-6, "forward: sourceStart + elapsed");
});

test("unified videoClips input renders identically to the two legacy arrays", () => {
  const cuts = [
    { id: "c0", assetId: "clipA", sectionId: "s", start: 0, duration: 2, sourceStart: 1, reversed: true },
    { id: "c1", assetId: "clipB", sectionId: "s", start: 2, duration: 2, sourceStart: 0 },
  ];
  const places = [
    { id: "o1", assetId: "still", sectionId: "manual", start: 0, duration: 3, sourceStart: 0, scale: 120, opacity: 70, trackId: "t1" },
    { id: "o2", assetId: "clipB", sectionId: "manual", start: 1, duration: 2, sourceStart: 0, scale: 100, opacity: 100, trackId: "t1", flipH: true },
  ];
  const unified = toUnifiedTimeline(cuts, places, "__base__");
  for (const t of [0.5, 1.5, 2.5]) {
    const legacy = computeFramePlan({ ...base, time: t, baseCuts: cuts, placements: places });
    const merged = computeFramePlan({ ...base, time: t, videoClips: unified });
    assert.deepEqual(merged, legacy, `frame plan identical at t=${t}`);
  }
});

test("disabled tracks are dropped and overlays honor track paint settings", () => {
  const placements = [
    { assetId: "still", start: 0, duration: 1, scale: 100, opacity: 50, trackId: "t1" },
    { assetId: "clipA", start: 0, duration: 1, scale: 100, opacity: 100, trackId: "t2" }, // disabled
  ];
  const plan = computeFramePlan({ ...base, time: 0.5, placements });
  const overlays = plan.layers.filter((l) => l.kind === "overlay");
  assert.equal(overlays.length, 1, "disabled track excluded");
  assert.equal(overlays[0].assetId, "still");
  assert.ok(Math.abs(overlays[0].alpha - 0.5) < 1e-9);
  assert.equal(overlays[0].blend, "screen");
});

test("overlays are ordered by their track order", () => {
  const orderedTracks = [
    { ...tracks[0], id: "t1" },
    { ...tracks[0], id: "t2", enabled: true },
  ];
  const placements = [
    { assetId: "clipA", start: 0, duration: 1, scale: 100, opacity: 100, trackId: "t2" },
    { assetId: "still", start: 0, duration: 1, scale: 100, opacity: 100, trackId: "t1" },
  ];
  const plan = computeFramePlan({ ...base, tracks: orderedTracks, time: 0.5, placements });
  const overlays = plan.layers.filter((l) => l.kind === "overlay").map((l) => l.assetId);
  assert.deepEqual(overlays, ["still", "clipA"], "t1 paints before t2");
});

test("a stacked video track displays one deterministic clip when edits overlap", () => {
  const placements = [
    { id: "early", assetId: "clipA", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" },
    { id: "late", assetId: "still", start: 0.5, duration: 2, scale: 100, opacity: 100, trackId: "t1" },
  ];
  const plan = computeFramePlan({ ...base, time: 1, placements });
  const overlays = plan.layers.filter((layer) => layer.kind === "overlay");
  assert.deepEqual(overlays.map((layer) => layer.assetId), ["still"], "the later overwrite wins on its lane");
});

test("stacked video clip speed affects the shared preview and export source clock", () => {
  const placements = [{ id: "fast", assetId: "clipA", start: 1, sourceStart: 2, duration: 2, playbackRate: 2, scale: 100, opacity: 100, trackId: "t1" }];
  const plan = computeFramePlan({ ...base, time: 1.5, placements });
  assert.equal(plan.layers.find((layer) => layer.kind === "overlay").sourceTime, 3);
});

test("beat punch scales the base without moving its center", () => {
  const motion = { beats: [0, 0.5, 1], punch: PUNCH_PRESETS.slam };
  const rest = computeFramePlan({ ...base, time: 0.49, baseCuts });
  const hit = computeFramePlan({ ...base, time: 0.5 + PUNCH_PRESETS.slam.attack, baseCuts, motion });
  const restBox = rest.layers[0].box;
  const hitBox = hit.layers[0].box;
  assert.ok(hitBox.width > restBox.width, "punch zooms in");
  const restCenter = restBox.x + restBox.width / 2;
  const hitCenter = hitBox.x + hitBox.width / 2;
  assert.ok(Math.abs(restCenter - hitCenter) < 1e-6, "stays centered");
});

test("a flash transition surfaces on the plan, not on a layer", () => {
  const plan = computeFramePlan({ ...base, time: 2.0, baseCuts, transition: TRANSITION_PRESETS.flash });
  assert.ok(plan.flash > 0);
  const settled = computeFramePlan({ ...base, time: 2.0 + TRANSITION_PRESETS.flash.duration + 0.01, baseCuts, transition: TRANSITION_PRESETS.flash });
  assert.equal(settled.flash, 0);
});

test("glitch transition adds its channel split on top of the grade's own", () => {
  const grade = { params: GRADE_PRESETS.cinematic, beatDriven: false };
  const atCut = computeFramePlan({ ...base, time: 2.0, baseCuts, transition: TRANSITION_PRESETS.glitch, grade });
  assert.ok(atCut.grade.aberration > GRADE_PRESETS.cinematic.aberration);

  const ungraded = computeFramePlan({ ...base, time: 2.0, baseCuts });
  assert.equal(ungraded.grade, null);
});

test("a cross-clip dissolve draws both clips: outgoing under, incoming fading over", () => {
  // Just after the cut at t=2, inside the dissolve window.
  const t = 2 + TRANSITION_PRESETS.dissolve.duration / 2;
  const plan = computeFramePlan({ ...base, time: t, baseCuts, transition: TRANSITION_PRESETS.dissolve });
  const bases = plan.layers.filter((l) => l.kind === "base");
  assert.equal(bases.length, 2, "outgoing + incoming both present");
  // Outgoing (previous clip) is drawn first so it sits underneath.
  assert.equal(bases[0].assetId, "clipA", "outgoing is the previous cut");
  assert.equal(bases[1].assetId, "clipB", "incoming is the active cut, on top");
  assert.ok(Math.abs(bases[0].alpha - 1) < 1e-9, "outgoing holds full opacity");
  assert.ok(bases[1].alpha > 0 && bases[1].alpha < 1, "incoming is mid-fade");
  // The outgoing clip keeps rolling past its own cut end, not frozen at the seam.
  assert.ok(bases[0].sourceTime > 3, "outgoing playhead continues past clipA's 2s cut");
});

test("a per-edit transition overrides the sequence style in the shared frame plan", () => {
  const editCuts = [baseCuts[0], { ...baseCuts[1], transitionType: "dissolve", transitionDuration: 0.4 }];
  const plan = computeFramePlan({ ...base, time: 2.2, baseCuts: editCuts, transition: TRANSITION_PRESETS.none });
  assert.equal(plan.layers.filter((layer) => layer.kind === "base").length, 2, "the edit override keeps both sources on screen");

  const hardCuts = [baseCuts[0], { ...baseCuts[1], transitionType: "none" }];
  const hard = computeFramePlan({ ...base, time: 2.05, baseCuts: hardCuts, transition: TRANSITION_PRESETS.dissolve });
  assert.equal(hard.layers.filter((layer) => layer.kind === "base").length, 1, "an explicit hard cut disables the sequence transition");
});

test("a hard cut and post-cut transitions stay single-clip", () => {
  const hard = computeFramePlan({ ...base, time: 2.15, baseCuts });
  assert.equal(hard.layers.filter((l) => l.kind === "base").length, 1, "no transition => one clip");
  const zoom = computeFramePlan({ ...base, time: 2.05, baseCuts, transition: TRANSITION_PRESETS.zoom });
  assert.equal(zoom.layers.filter((l) => l.kind === "base").length, 1, "zoom is post-cut, still one clip");
});

test("the dissolve settles back to a single clip after its window", () => {
  const after = 2 + TRANSITION_PRESETS.dissolve.duration + 0.02;
  const plan = computeFramePlan({ ...base, time: after, baseCuts, transition: TRANSITION_PRESETS.dissolve });
  const bases = plan.layers.filter((l) => l.kind === "base");
  assert.equal(bases.length, 1, "outgoing dropped once the blend finishes");
  assert.equal(bases[0].assetId, "clipB");
});

test("echo surfaces on the plan and adds an RGB fringe to the grade", () => {
  const off = computeFramePlan({ ...base, time: 1, baseCuts });
  assert.equal(off.echo, 0, "no echo by default");

  const on = computeFramePlan({ ...base, time: 1, baseCuts, echo: { amount: 0.7 } });
  assert.ok(Math.abs(on.echo - 0.7) < 1e-9, "echo amount surfaces");
  assert.ok(on.grade.aberration > 0, "echo adds chromatic fringe even with no film look");

  // Beat-driven echo swells near a beat vs between beats.
  const motion = { beats: [0, 0.5, 1, 1.5], punch: PUNCH_PRESETS.slam };
  const onBeat = computeFramePlan({ ...base, time: 1.0 + PUNCH_PRESETS.slam.attack, baseCuts, motion, echo: { amount: 0.5, beatDriven: true } });
  const offBeat = computeFramePlan({ ...base, time: 1.45, baseCuts, motion, echo: { amount: 0.5, beatDriven: true } });
  assert.ok(onBeat.echo > offBeat.echo, "trails swell on the beat");
});

test("echo never fully erases the frame (amount is capped below 1)", () => {
  const plan = computeFramePlan({ ...base, time: 1, baseCuts, echo: { amount: 5 } });
  assert.ok(plan.echo < 1, "capped so the frame never becomes a permanent smear");
});

test("spatial strobes surface as positioned lights while full strobes stay in the grade", () => {
  const times = [1];
  const spatial = computeFramePlan({
    ...base,
    time: 1,
    baseCuts,
    strobe: { times, config: { pattern: "every-beat", color: "#ff0000", intensity: 0.8, decay: 0.1, mode: "radial", blend: "add", x: 0.25, y: 0.7, size: 0.6, softness: 0.8 } },
  });
  assert.equal(spatial.strobeLight.mode, "radial");
  assert.equal(spatial.strobeLight.blend, "add");
  assert.equal(spatial.strobeLight.x, 0.25);
  assert.deepEqual(spatial.strobeLight.color, [1, 0, 0]);
  assert.equal(spatial.grade, null, "a spatial light does not accidentally add the full-frame grade flash");

  const full = computeFramePlan({
    ...base,
    time: 1,
    baseCuts,
    strobe: { times, config: { pattern: "every-beat", color: "#fff", intensity: 0.8, decay: 0.1, mode: "full" } },
  });
  assert.equal(full.strobeLight, null);
  assert.equal(full.grade.strobe, 0.8);
});

test("the plan is deterministic — the WYSIWYG guarantee", () => {
  const args = {
    ...base,
    time: 1.234,
    baseCuts,
    motion: { beats: [0, 0.5, 1, 1.5], accents: [0, 1], punch: PUNCH_PRESETS.dynamic },
    transition: TRANSITION_PRESETS.zoom,
    grade: { params: GRADE_PRESETS.neon, beatDriven: true },
    placements: [{ assetId: "still", start: 1, duration: 1, scale: 120, opacity: 90, trackId: "t1" }],
  };
  assert.deepEqual(computeFramePlan(args), computeFramePlan(args));
});

test("a stutter freezes the base layer's source playhead", () => {
  const stutter = {
    config: { pattern: "hold", division: 0.25, window: 4, every: 4 },
    beatSeconds: 0.5,
    origin: 0,
  };
  // Two times inside the same 16th-note division must show the same frame...
  const a = computeFramePlan({ ...base, time: 0.30, baseCuts, stutter });
  const b = computeFramePlan({ ...base, time: 0.36, baseCuts, stutter });
  assert.equal(a.layers[0].sourceTime, b.layers[0].sourceTime, "frozen within the division");

  // ...and the next division must advance.
  const c = computeFramePlan({ ...base, time: 0.40, baseCuts, stutter });
  assert.ok(c.layers[0].sourceTime > a.layers[0].sourceTime, "advances on the next step");

  // Without the stutter those same times differ.
  const plain1 = computeFramePlan({ ...base, time: 0.30, baseCuts });
  const plain2 = computeFramePlan({ ...base, time: 0.36, baseCuts });
  assert.notEqual(plain1.layers[0].sourceTime, plain2.layers[0].sourceTime);
});

test("a stutter does not shift which clip is on screen", () => {
  const stutter = {
    config: { pattern: "hold", division: 0.25, window: 4, every: 4 },
    beatSeconds: 0.5,
    origin: 0,
  };
  // Cut boundaries follow real time, so the montage stays locked to the beat
  // even while the footage inside a clip is frozen.
  for (const t of [0.4, 1.9, 2.1, 3.5]) {
    const withStutter = computeFramePlan({ ...base, time: t, baseCuts, stutter });
    const without = computeFramePlan({ ...base, time: t, baseCuts });
    assert.equal(withStutter.layers[0].assetId, without.layers[0].assetId, `clip changed at ${t}`);
  }
});

test("a title becomes a text layer above everything, punching with the beat", () => {
  const titles = [{ id: "t", text: "DROP", start: 1, duration: 1.5, y: 0.5, size: 0.16, color: "#fff", style: "slam" }];
  const motion = { beats: [0, 0.5, 1, 1.5], punch: PUNCH_PRESETS.slam };

  const before = computeFramePlan({ ...base, time: 0.5, baseCuts, titles });
  assert.equal(before.layers.filter((l) => l.kind === "title").length, 0, "not shown before its start");

  const during = computeFramePlan({ ...base, time: 1.4, baseCuts, titles, motion });
  const title = during.layers.find((l) => l.kind === "title");
  assert.ok(title, "title layer emitted while active");
  assert.equal(title.title.value, "DROP");
  assert.ok(title.title.fontPx > 0);
  // The title is last, so it paints above the base and overlays.
  assert.equal(during.layers[during.layers.length - 1].kind, "title");

  // It rides the beat punch: bigger just after a beat than between beats.
  const onBeat = computeFramePlan({ ...base, time: 1.0 + PUNCH_PRESETS.slam.attack, baseCuts, titles, motion });
  const offBeat = computeFramePlan({ ...base, time: 1.45, baseCuts, titles, motion });
  const on = onBeat.layers.find((l) => l.kind === "title").title.fontPx;
  const off = offBeat.layers.find((l) => l.kind === "title").title.fontPx;
  assert.ok(on > off, "title punches on the beat");
});

test("nested compositions become graphic layers on the master timeline", () => {
  const compositions = [{
    id: "hero",
    name: "Hero",
    duration: 4,
    width: 1920,
    height: 1080,
    background: "#000",
    layers: [{
      id: "word",
      name: "Word",
      kind: "text",
      text: "DROP",
      shape: "rectangle",
      color: "#fff",
      x: 50,
      y: 50,
      width: 80,
      height: 20,
      scale: 100,
      rotation: 0,
      opacity: 100,
      enabled: true,
      blend: "normal",
      effect: "glow",
      animation: "none",
      keyframes: [],
    }],
  }];
  const placements = [{ assetId: "composition:hero", compositionId: "hero", start: 1, duration: 4, scale: 100, opacity: 80, trackId: "t1" }];
  const plan = computeFramePlan({ ...base, time: 2, placements, compositions });
  const graphic = plan.layers.find((layer) => layer.kind === "graphic");
  assert.ok(graphic, "composition emitted a graphic layer");
  assert.equal(graphic.graphic.value, "DROP");
  assert.ok(Math.abs(graphic.alpha - 0.8) < 1e-9, "placement opacity reaches the nested layer");
});

test("composition track mattes preserve the actual source layer and luma mode in the shared plan", () => {
  const common = { shape: "rectangle", x: 50, y: 50, scale: 100, rotation: 0, opacity: 100, enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [] };
  const matte = { ...common, id: "matte", name: "Matte", kind: "shape", text: "", color: "#777", width: 30, height: 70 };
  const target = { ...common, id: "target", name: "Target", kind: "media", text: "", color: "#fff", width: 100, height: 100, assetId: "clipA", trackMatte: { layerId: "matte", mode: "luma", inverted: true } };
  const compositions = [{ id: "matted", name: "Matted", duration: 3, width: 1920, height: 1080, background: "transparent", layers: [matte, target] }];
  const placements = [{ assetId: "composition:matted", compositionId: "matted", start: 0, duration: 3, scale: 100, opacity: 100, trackId: "t1" }];
  const plan = computeFramePlan({ ...base, time: 1, placements, compositions });
  const layer = plan.layers.find((item) => item.assetId === "clipA" && item.matte);
  assert.ok(layer?.matte, "target carries a pixel matte instead of a bounding-box clip");
  assert.equal(layer.matte.mode, "luma");
  assert.equal(layer.matte.inverted, true);
  assert.equal(layer.matte.layer.graphic.kind, "shape");
  assert.ok(!layer.mask?.box, "legacy rectangular matte approximation is removed");
});

test("composition text position and width survive into the master render plan", () => {
  const layer = {
    id: "word", name: "Word", kind: "text", text: "LEFT", shape: "rectangle", color: "#fff",
    x: 20, y: 50, width: 40, height: 12, scale: 100, rotation: 0, opacity: 100,
    enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [],
  };
  const compositions = [{ id: "text-position", name: "Text", duration: 3, width: 1920, height: 1080, background: "#000", layers: [layer] }];
  const placements = [{ assetId: "composition:text-position", compositionId: "text-position", start: 0, duration: 3, scale: 100, opacity: 100, trackId: "t1" }];
  const plan = computeFramePlan({ ...base, time: 1, placements, compositions });
  const graphics = plan.layers.filter((item) => item.kind === "graphic");
  const graphic = graphics.at(-1);
  assert.ok(Math.abs(graphic.box.x + graphic.box.width / 2 - base.width * 0.2) < 1e-6);
  assert.ok(Math.abs(graphic.box.width - base.width * 0.4) < 1e-6);
});

test("nested composition media layers render imported video with their local playhead", () => {
  const compositions = [{
    id: "media-comp",
    name: "Media Comp",
    duration: 4,
    width: 1920,
    height: 1080,
    background: "#000",
    layers: [{
      id: "shot",
      name: "Shot",
      kind: "media",
      assetId: "clipB",
      text: "",
      shape: "rectangle",
      color: "#fff",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      scale: 100,
      rotation: 15,
      opacity: 60,
      enabled: true,
      blend: "normal",
      effect: "none",
      animation: "none",
      keyframes: [],
    }],
  }];
  const placements = [{
    assetId: "composition:media-comp",
    compositionId: "media-comp",
    start: 2,
    duration: 4,
    scale: 100,
    opacity: 50,
    trackId: "t1",
  }];
  const plan = computeFramePlan({ ...base, time: 3.25, placements, compositions });
  const media = plan.layers.find((layer) => layer.kind === "overlay" && layer.assetId === "clipB");
  assert.ok(media, "composition emitted the imported video as an overlay");
  assert.ok(Math.abs(media.sourceTime - 1.25) < 1e-9, "source time follows the composition-local playhead");
  assert.ok(Math.abs(media.alpha - 0.3) < 1e-9, "layer and placement opacity multiply");
  assert.equal(media.rotation, 15);
});

test("tracked subject contours interpolate into the shared preview/export plan", () => {
  const pointsA = [{ x: .2, y: .2 }, { x: .5, y: .2 }, { x: .5, y: .8 }, { x: .2, y: .8 }];
  const pointsB = pointsA.map((point) => ({ x: point.x + .2, y: point.y }));
  const layer = {
    id: "subject", name: "Subject", kind: "media", assetId: "clipA", text: "", shape: "rectangle", color: "#fff",
    x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100,
    enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [],
    roto: { enabled: true, inverted: false, feather: 4, expansion: 2, keyframes: [
      { id: "r0", time: 0, points: pointsA, confidence: 1, source: "manual" },
      { id: "r1", time: 2, points: pointsB, confidence: .8, source: "tracked" },
    ] },
  };
  const compositions = [{ id: "subject-comp", name: "Subject", duration: 2, width: 1920, height: 1080, background: "transparent", layers: [layer] }];
  const placements = [{ assetId: "composition:subject-comp", compositionId: "subject-comp", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" }];
  const plan = computeFramePlan({ ...base, time: 1, placements, compositions });
  const subject = plan.layers.find((item) => item.assetId === "clipA" && item.kind === "overlay");
  assert.ok(subject?.mask?.path, "the render plan carries the editable subject contour");
  assert.ok(Math.abs(subject.mask.path[0].x - .3) < 1e-9, "the contour interpolates at composition-local time");
  assert.equal(subject.mask.feather, 4);
  assert.equal(subject.mask.expansion, 2);
});

test("semantic pixel alpha mattes reach the shared preview/export frame plan", () => {
  const alphaMatte = { width: 2, height: 2, rle: [0, 1, 255, 2, 0, 1] };
  const composition = {
    id: "alpha-subject", name: "Alpha subject", duration: 2, width: 1920, height: 1080, background: "transparent",
    layers: [{
      id: "subject", name: "Subject", kind: "media", assetId: "hero", text: "", shape: "rectangle", color: "#fff",
      x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100, enabled: true,
      blend: "normal", effect: "none", animation: "none", keyframes: [],
      roto: { enabled: true, inverted: false, feather: 0, expansion: 0, edgeColorCleanup: .65, keyframes: [
        { id: "r1", time: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], confidence: 1, source: "manual", matte: alphaMatte },
      ] },
    }],
  };
  const plan = computeFramePlan({
    time: .5, width: 640, height: 360,
    assets: [{ id: "hero", kind: "video", width: 1920, height: 1080, duration: 2 }],
    placements: [{ id: "p", assetId: "hero", compositionId: composition.id, start: 0, duration: 2, scale: 100, opacity: 100 }],
    compositions: [composition],
  });
  const subject = plan.layers.find((layer) => layer.assetId === "hero");
  assert.deepEqual(subject?.mask?.alphaMatte, alphaMatte);
  assert.equal(subject?.mask?.edgeColorCleanup, .65, "shared preview/export plan carries soft-edge RGB cleanup strength");
  assert.deepEqual(structuredClone(plan).layers.find((layer) => layer.assetId === "hero")?.mask?.alphaMatte, alphaMatte, "worker payload remains serializable");
});

test("roto motion blur is carried as temporal matte samples in the shared frame plan", () => {
  const square = [{ x: .2, y: .2 }, { x: .5, y: .2 }, { x: .5, y: .7 }, { x: .2, y: .7 }];
  const moved = square.map((point) => ({ ...point, x: point.x + .2 }));
  const composition = {
    id: "blurred-subject", name: "Blurred subject", duration: 2, width: 1920, height: 1080, background: "transparent",
    layers: [{
      id: "subject", name: "Subject", kind: "media", assetId: "hero", text: "", shape: "rectangle", color: "#fff",
      x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100, enabled: true,
      blend: "normal", effect: "none", animation: "none", keyframes: [],
      roto: { enabled: true, inverted: false, feather: 0, expansion: 0, motionBlur: 1, motionBlurSamples: 5, keyframes: [
        { id: "r1", time: 0, points: square, confidence: 1, source: "manual" },
        { id: "r2", time: 1, points: moved, confidence: 1, source: "tracked" },
      ] },
    }],
  };
  const plan = computeFramePlan({
    time: .5, width: 640, height: 360,
    assets: [{ id: "hero", kind: "video", width: 1920, height: 1080, duration: 2 }],
    placements: [{ id: "p", assetId: "hero", compositionId: composition.id, start: 0, duration: 2, scale: 100, opacity: 100 }],
    compositions: [composition],
  });
  const subject = plan.layers.find((layer) => layer.assetId === "hero");
  assert.equal(subject?.mask?.pathSamples?.length, 5);
  assert.ok(subject.mask.pathSamples[0].points[0].x < subject.mask.pathSamples.at(-1).points[0].x);
});

test("glow is applied to media layers as a real compositing filter", () => {
  const layer = {
    id: "shot", name: "Shot", kind: "media", assetId: "clipB", text: "", shape: "rectangle", color: "#34d6c7",
    x: 50, y: 50, width: 50, height: 50, scale: 100, rotation: 0, opacity: 100,
    enabled: true, blend: "screen", effect: "glow", animation: "none", keyframes: [],
  };
  const compositions = [{ id: "glow-media", name: "Glow", duration: 2, width: 1920, height: 1080, background: "#000", layers: [layer] }];
  const placements = [{ assetId: "composition:glow-media", compositionId: "glow-media", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" }];
  const plan = computeFramePlan({ ...base, time: 1, placements, compositions });
  const media = plan.layers.find((item) => item.kind === "overlay" && item.assetId === "clipB");
  assert.match(media.filter, /drop-shadow/);
});

test("track glow adds a drop-shadow only when the glow is real", () => {
  const track = (glow) => ({ id: "t1", name: "V2", color: "#7c5cff", enabled: true, locked: false, blend: "normal", opacity: 100, hue: 0, saturation: 100, brightness: 100, glow, fadeIn: 0, fadeOut: 0 });
  const filterWith = (glow) => computeFramePlan({ ...base, time: 1, tracks: [track(glow)], placements: [{ id: "p", assetId: "clipB", trackId: "t1", start: 0, duration: 2, scale: 50, opacity: 60 }] })
    .layers.find((layer) => layer.kind === "overlay").filter;
  assert.doesNotMatch(filterWith(0), /drop-shadow/, "a zero glow must not tint a translucent overlay with the track colour");
  assert.match(filterWith(8), /drop-shadow\(0 0 8px #7c5cff\)/);
});

test("composition effect graphs emit ordered masked passes into the shared frame plan", () => {
  const source = { id: "source", kind: "source" };
  const blur = { id: "blur-node", kind: "effect", input: "source", effect: { id: "blur-fx", type: "blur", amount: .5, enabled: true, parameters: { radius: 20 }, mask: { enabled: true, shape: "ellipse", x: 50, y: 50, width: 40, height: 70, feather: 12, expansion: 2, rotation: 8, inverted: false } } };
  const grain = { id: "grain-node", kind: "effect", input: "blur-node", effect: { id: "grain-fx", type: "grain", amount: .3, enabled: true, parameters: { size: 2, color: 0 } } };
  const output = { id: "output", kind: "output", input: "grain-node" };
  const layer = {
    id: "shot", name: "Shot", kind: "media", assetId: "clipA", text: "", shape: "rectangle", color: "#fff",
    x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100,
    enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [],
    effectGraph: { version: 1, outputNodeId: "output", nodes: [source, blur, grain, output] },
  };
  const composition = { id: "graph", name: "Graph", duration: 2, width: 1920, height: 1080, background: "#000", layers: [layer] };
  const placement = { assetId: "composition:graph", compositionId: "graph", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" };
  const media = computeFramePlan({ ...base, time: 1, placements: [placement], compositions: [composition] }).layers.find((item) => item.assetId === "clipA");
  assert.deepEqual(media.effectPasses.map((pass) => pass.id), ["blur-fx", "grain-fx"]);
  assert.equal(media.effectPasses[0].mask.shape, "ellipse");
  assert.equal(media.effectPasses[1].pixelEffect.type, "grain");
  assert.doesNotThrow(() => structuredClone(media.effectPasses));
});

test("branching effect graphs cross the shared frame-plan boundary as resolved worker-safe nodes", () => {
  const graph = { version: 3, outputNodeId: "output", nodes: [
    { id: "source", kind: "source", sourceType: "self", layout: { x: 10, y: 15 } },
    { id: "texture", kind: "source", sourceType: "asset", assetId: "clipB" },
    { id: "grain", kind: "effect", input: "source", effect: { id: "grain-fx", type: "grain", amount: .4, enabled: true, parameters: { size: 2, color: 0 } } },
    { id: "move", kind: "transform", input: "source", x: 20, y: 0, scale: 105, rotation: 0, opacity: .7, keyframes: [{ id: "move-0", time: 0, property: "x", value: 0, easing: "linear" }, { id: "move-2", time: 2, property: "x", value: 40, easing: "linear" }] },
    { id: "merge", kind: "merge", background: "grain", foreground: "move", blend: "screen", opacity: .65 },
    { id: "displace", kind: "displacement", input: "merge", map: "texture", amountX: 12, amountY: 4 },
    { id: "output", kind: "output", input: "displace" },
  ] };
  const layer = {
    id: "shot", name: "Shot", kind: "media", assetId: "clipA", text: "", shape: "rectangle", color: "#fff",
    x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100,
    enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [], effectGraph: graph,
  };
  const composition = { id: "branch", name: "Branch", duration: 2, width: 1920, height: 1080, background: "#000", layers: [layer] };
  const placement = { assetId: "composition:branch", compositionId: "branch", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" };
  const media = computeFramePlan({ ...base, time: 1, placements: [placement], compositions: [composition] }).layers.find((item) => item.assetId === "clipA");
  assert.equal(media.effectGraph.version, 3);
  assert.equal(media.effectGraph.nodes.find((node) => node.id === "grain").pass.pixelEffect.type, "grain");
  assert.equal(media.effectGraph.nodes.find((node) => node.id === "move").x, 20);
  assert.equal(media.effectGraph.nodes.find((node) => node.id === "texture").assetId, "clipB");
  assert.deepEqual(media.effectGraph.nodes.find((node) => node.id === "source").layout, { x: 10, y: 15 });
  assert.deepEqual(media.effectGraph.orderedNodeIds, ["source", "grain", "move", "merge", "texture", "displace", "output"]);
  assert.equal(media.effectPasses.length, 0);
  assert.doesNotThrow(() => structuredClone(media.effectGraph));
});

test("adjustment layers are explicit ordered frame operations instead of leaking filters into upper layers", () => {
  const common = { text: "", shape: "rectangle", color: "#fff", x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100, enabled: true, blend: "normal", animation: "none", keyframes: [] };
  const below = { ...common, id: "below", name: "Below", kind: "media", assetId: "clipA", effect: "none" };
  const adjust = { ...common, id: "adjust", name: "Adjust", kind: "adjustment", effect: "none", effects: [{ id: "poster", type: "posterize", amount: 1, enabled: true, parameters: { levels: 4 } }] };
  const above = { ...common, id: "above", name: "Above", kind: "media", assetId: "clipB", effect: "none" };
  const composition = { id: "adjusted", name: "Adjusted", duration: 2, width: 1920, height: 1080, background: "#000", layers: [below, adjust, above] };
  const placement = { assetId: "composition:adjusted", compositionId: "adjusted", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" };
  const layers = computeFramePlan({ ...base, time: 1, placements: [placement], compositions: [composition] }).layers;
  assert.deepEqual(layers.filter((item) => ["clipA", "clipB"].includes(item.assetId) || item.kind === "adjustment").map((item) => item.kind), ["overlay", "adjustment", "overlay"]);
  assert.equal(layers.find((item) => item.kind === "adjustment").effectPasses[0].pixelEffect.type, "posterize");
  assert.equal(layers.find((item) => item.assetId === "clipB").effectPasses.length, 0, "the layer above does not inherit the adjustment");
});

test("composition keyframes interpolate transforms over local comp time", () => {
  const layer = {
    id: "shape",
    name: "Shape",
    kind: "shape",
    text: "",
    shape: "rectangle",
    color: "#f00",
    x: 0,
    y: 50,
    width: 10,
    height: 10,
    scale: 100,
    rotation: 0,
    opacity: 100,
    enabled: true,
    blend: "screen",
    effect: "none",
    animation: "none",
    keyframes: [
      { id: "a", time: 0, x: 10, y: 50, scale: 50, rotation: 0, opacity: 0 },
      { id: "b", time: 2, x: 90, y: 50, scale: 150, rotation: 180, opacity: 100 },
    ],
  };
  const compositions = [{ id: "move", name: "Move", duration: 2, width: 1920, height: 1080, background: "#000", layers: [layer] }];
  const placements = [{ assetId: "composition:move", compositionId: "move", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" }];
  const plan = computeFramePlan({ ...base, time: 1, placements, compositions });
  const graphic = plan.layers.find((item) => item.kind === "graphic");
  const centerX = graphic.box.x + graphic.box.width / 2;
  assert.ok(Math.abs(centerX - base.width / 2) < 1e-6, "x lands halfway between the keyframes");
  assert.equal(graphic.rotation, 90);
  assert.ok(Math.abs(graphic.alpha - 0.5) < 1e-9);
});

test("composition spatial Bezier paths reach the shared preview and export frame plan", () => {
  const layer = {
    id: "curve", name: "Curve", kind: "shape", text: "", shape: "rectangle", color: "#fff",
    x: 10, y: 20, width: 10, height: 10, scale: 100, rotation: 0, opacity: 100,
    enabled: true, blend: "normal", effect: "none", animation: "none",
    keyframes: [
      { id: "a", time: 0, x: 10, y: 20, scale: 100, rotation: 0, opacity: 100, spatialOut: { x: 0, y: 40 } },
      { id: "b", time: 2, x: 90, y: 20, scale: 100, rotation: 0, opacity: 100, spatialIn: { x: 0, y: 40 } },
    ],
  };
  const compositions = [{ id: "curve", name: "Curve", duration: 2, width: 1920, height: 1080, background: "#000", layers: [layer] }];
  const placements = [{ assetId: "composition:curve", compositionId: "curve", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" }];
  const graphic = computeFramePlan({ ...base, time: 1, placements, compositions }).layers.find((item) => item.kind === "graphic");
  const centerX = graphic.box.x + graphic.box.width / 2;
  const centerY = graphic.box.y + graphic.box.height / 2;
  assert.ok(Math.abs(centerX - base.width * .5) < 1e-6);
  assert.ok(Math.abs(centerY - base.height * .5) < 1e-6, "curved path reaches 50% Y instead of linear 20% Y");
});

test("clip fades affect the same frame plan used by preview and export", () => {
  const faded = [{ ...baseCuts[0], duration: 2, fadeIn: 1, fadeOut: 1 }];
  const start = computeFramePlan({ ...base, time: 0.25, baseCuts: faded }).layers[0];
  const middle = computeFramePlan({ ...base, time: 1, baseCuts: faded }).layers[0];
  const end = computeFramePlan({ ...base, time: 1.75, baseCuts: faded }).layers[0];
  assert.equal(start.alpha, 0.25);
  assert.equal(middle.alpha, 1);
  assert.equal(end.alpha, 0.25);
});

test("parented layers, masks and easy-ease reach the render plan", () => {
  const parent = {
    id: "null", name: "Null", kind: "null", text: "", shape: "rectangle", color: "#fff",
    x: 60, y: 50, width: 10, height: 10, scale: 200, rotation: 10, opacity: 100,
    enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [],
  };
  const child = {
    id: "child", name: "Child", kind: "shape", text: "", shape: "ellipse", color: "#f00",
    parentId: "null", x: 60, y: 50, width: 10, height: 10, scale: 100, rotation: 0, opacity: 100,
    enabled: true, blend: "screen", effect: "none", animation: "none", motionBlur: true,
    mask: { enabled: true, shape: "ellipse", feather: 8, expansion: 2, inverted: false, x: 35, y: 65, width: 72, height: 48, rotation: 24 },
    keyframes: [
      { id: "a", time: 0, x: 40, y: 50, scale: 100, rotation: 0, opacity: 100, easing: "ease-in" },
      { id: "b", time: 2, x: 80, y: 50, scale: 100, rotation: 0, opacity: 100 },
    ],
  };
  const compositions = [{ id: "parented", name: "Parented", duration: 2, width: 1920, height: 1080, background: "#000", layers: [parent, child] }];
  const placements = [{ assetId: "composition:parented", compositionId: "parented", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" }];
  const plan = computeFramePlan({ ...base, time: 1, placements, compositions });
  const graphics = plan.layers.filter((item) => item.kind === "graphic");
  const graphic = graphics.at(-1);
  assert.ok(Math.abs(graphic.box.x + graphic.box.width / 2 - base.width * 0.6) < 1e-6, "parent transform is inherited");
  assert.equal(graphic.rotation, 10);
  assert.equal(graphic.mask.shape, "ellipse");
  assert.deepEqual(
    [graphic.mask.x, graphic.mask.y, graphic.mask.width, graphic.mask.height, graphic.mask.rotation],
    [35, 65, 72, 48, 24],
    "editable mask geometry reaches the shared painter",
  );
  assert.equal(graphics.length, 3, "motion blur uses two temporal samples plus the current frame");
  assert.doesNotMatch(graphic.filter, /blur\(1\.5px\)/, "motion blur is not a static soft-focus filter");
});

test("precompositions flatten recursively and transparent plans omit the master base", () => {
  const child = {
    id: "child", name: "Child", duration: 2, width: 1920, height: 1080, background: "#000",
    layers: [{
      id: "word", name: "Word", kind: "text", text: "NESTED", shape: "rectangle", color: "#fff",
      x: 50, y: 50, width: 50, height: 10, scale: 100, rotation: 0, opacity: 100,
      enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [],
    }],
  };
  const parent = {
    id: "parent", name: "Parent", duration: 2, width: 1920, height: 1080, background: "#000",
    layers: [{
      id: "pre", name: "Precomp", kind: "composition", compositionId: "child", text: "", shape: "rectangle", color: "#fff",
      x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100,
      enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [],
    }],
  };
  const placements = [{ assetId: "composition:parent", compositionId: "parent", start: 0, duration: 2, scale: 100, opacity: 100, trackId: "t1" }];
  const plan = computeFramePlan({
    ...base,
    time: 1,
    mainVideo: { width: 1920, height: 1080 },
    placements,
    compositions: [parent, child],
    transparent: true,
  });
  assert.equal(plan.transparent, true);
  assert.equal(plan.layers.some((layer) => layer.kind === "base"), false);
  assert.equal(plan.layers.find((layer) => layer.kind === "graphic").graphic.value, "NESTED");
});

test("a base cut with transform keyframes animates position, scale, rotation, opacity", () => {
  const animated = [{
    id: "kc", assetId: "clipA", sectionId: "s", start: 0, duration: 4, sourceStart: 0,
    transformKeyframes: [
      { id: "a", time: 0, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      { id: "b", time: 4, x: 0.5, y: 0, scale: 2, rotation: 90, opacity: 0 },
    ],
  }];
  const start = computeFramePlan({ ...base, time: 0, baseCuts: animated });
  const mid = computeFramePlan({ ...base, time: 2, baseCuts: animated });
  const s = start.layers.find((l) => l.kind === "base");
  const m = mid.layers.find((l) => l.kind === "base");
  assert.ok((m.box.x + m.box.width / 2) > (s.box.x + s.box.width / 2), "moves right by the keyframed x");
  assert.ok(m.box.width > s.box.width, "scales up");
  assert.ok(Math.abs(m.rotation - 45) < 1, "rotates ~45deg at the midpoint");
  assert.ok(Math.abs(m.alpha - 0.5) < 0.02, "eases to half opacity at the midpoint");
  // No keyframes => identity (unchanged from a plain cut).
  const plain = computeFramePlan({ ...base, time: 2, baseCuts: [{ ...animated[0], transformKeyframes: undefined }] });
  const p = plain.layers.find((l) => l.kind === "base");
  assert.ok(Math.abs(p.rotation) < 1e-9 && Math.abs(p.alpha - 1) < 1e-9, "untouched without keyframes");
});

test("geometry helpers behave as contain and cover", () => {
  assert.deepEqual(fitCover(1920, 1080, 1080, 1080), { x: -420, y: 0, width: 1920, height: 1080 });
  const contained = fitInside(1920, 1080, 1000, 1000);
  assert.ok(contained.width <= 1000 + 1e-9 && contained.height <= 1000 + 1e-9, "never exceeds the target");
  assert.ok(Math.abs(contained.width - 1000) < 1e-6, "contain touches the wider edge");
  assert.ok(Math.abs(contained.height - 562.5) < 1e-6, "and letterboxes the other");
});

// ---- Section-aware + audio-reactive motion (serializable, worker-safe) -----
const beats = Array.from({ length: 9 }, (_, i) => i * 0.5);

test("section energy scales the beat punch — hot sections zoom harder", () => {
  const cut = [{ id: "c", assetId: "clipA", sectionId: "s", start: 0, duration: 8, sourceStart: 0 }];
  const motionAt = (energy) => ({
    beats, accents: beats, punch: PUNCH_PRESETS.slam,
    energySections: [{ start: 0, end: 8, energy }],
  });
  const scaleOnBeat = (energy) => {
    const plan = computeFramePlan({ ...base, time: 2, baseCuts: cut, motion: motionAt(energy) });
    const layer = plan.layers.find((l) => l.kind === "base");
    return layer.box.width; // wider box = more zoom
  };
  assert.ok(scaleOnBeat(1) > scaleOnBeat(0.1), "the chorus punches harder than the intro");
});

test("the audio-reactive bass envelope adds a continuous zoom", () => {
  const cut = [{ id: "c", assetId: "clipA", sectionId: "s", start: 0, duration: 4, sourceStart: 0 }];
  // A flat low envelope pinned at 1 vs pinned at 0, off the beat (no punch).
  const withPump = { beats, punch: PUNCH_PRESETS.off, reactive: { low: [1, 1, 1], high: [0, 0, 0], startTime: 0, step: 0.02 } };
  const noPump = { beats, punch: PUNCH_PRESETS.off, reactive: { low: [0, 0, 0], high: [0, 0, 0], startTime: 0, step: 0.02 } };
  const width = (motion) => computeFramePlan({ ...base, time: 0.3, baseCuts: cut, motion }).layers.find((l) => l.kind === "base").box.width;
  assert.ok(width(withPump) > width(noPump), "bass pushes the picture in even off the beat");
});

test("the hats shimmer forces a grade pass and adds streak (worker-safe data)", () => {
  const cut = [{ id: "c", assetId: "clipA", sectionId: "s", start: 0, duration: 4, sourceStart: 0 }];
  const motion = { beats, punch: PUNCH_PRESETS.off, reactive: { low: [0, 0, 0], high: [1, 1, 1], startTime: 0, step: 0.02 } };
  const plan = computeFramePlan({ ...base, time: 0.3, baseCuts: cut, motion });
  assert.ok(plan.grade, "a grade pass exists for the shimmer even with no film look");
  assert.ok(plan.grade.streak > 0, "hats add anamorphic streak");
});

test("motion stays structured-cloneable — it must cross to the render worker", () => {
  const motion = {
    beats, accents: beats, punch: PUNCH_PRESETS.slam,
    energySections: [{ start: 0, end: 8, energy: 0.9 }],
    reactive: { low: [0, 0.5, 1], high: [0, 0.2, 0.4], startTime: 0, step: 0.02 },
  };
  assert.doesNotThrow(() => structuredClone(motion), "no functions may leak into motion");
});

test("composition layers honor in/out timing and map source time", () => {
  const composition = {
    id: "timed", name: "Timed", duration: 8, width: 1920, height: 1080, background: "#000",
    layers: [{
      id: "media", name: "Media", kind: "media", assetId: "clipA", text: "", shape: "rectangle", color: "#fff",
      x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100,
      start: 2, duration: 3, sourceStart: 4, playbackRate: .5,
      enabled: true, blend: "normal", effect: "none", animation: "none", keyframes: [],
    }],
  };
  const placements = [{ assetId: "composition:timed", compositionId: "timed", start: 0, duration: 8, scale: 100, opacity: 100, trackId: "t1" }];
  const before = computeFramePlan({ ...base, time: 1, placements, compositions: [composition] });
  const active = computeFramePlan({ ...base, time: 3, placements, compositions: [composition] });
  const after = computeFramePlan({ ...base, time: 6, placements, compositions: [composition] });
  assert.equal(before.layers.some((layer) => layer.assetId === "clipA"), false);
  assert.equal(active.layers.find((layer) => layer.assetId === "clipA").sourceTime, 4.5);
  assert.equal(after.layers.some((layer) => layer.assetId === "clipA"), false);
});

test("clip flipH/flipV flow onto the base layer for the compositor draw", () => {
  const cut = [{ id: "c", assetId: "clipA", sectionId: "s", start: 0, duration: 4, sourceStart: 0, flipH: true, flipV: true }];
  const plan = computeFramePlan({ ...base, time: 1, baseCuts: cut });
  const layer = plan.layers.find((l) => l.kind === "base");
  assert.equal(layer.flipH, true, "horizontal mirror carried to the layer");
  assert.equal(layer.flipV, true, "vertical mirror carried to the layer");
  // Absent flip stays undefined (no mirror).
  const plain = computeFramePlan({ ...base, time: 1, baseCuts: [{ id: "c2", assetId: "clipA", sectionId: "s", start: 0, duration: 4, sourceStart: 0 }] });
  assert.ok(!plain.layers.find((l) => l.kind === "base").flipH);
});

test("the shared painter clips and softens a projected cast shadow before its caster", () => {
  const filters = [];
  const clips = [];
  const context = {
    canvas: { width: 100, height: 100 }, globalAlpha: 1, globalCompositeOperation: "source-over", filter: "none", fillStyle: "#000",
    save() {}, restore() {}, clearRect() {}, fillRect() {}, translate() {}, rotate() {}, scale() {}, transform() {}, drawImage() {},
    beginPath() { clips.push([]); }, moveTo(x, y) { clips.at(-1)?.push([x, y]); }, lineTo(x, y) { clips.at(-1)?.push([x, y]); }, closePath() {}, clip() {},
  };
  const quad = [{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }];
  const receiverQuad = [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }];
  const layer = {
    kind: "overlay", assetId: "clipA", box: { x: 40, y: 40, width: 20, height: 20 }, sourceTime: 0, alpha: 1, rotation: 0,
    quad, blend: "source-over", filter: "none",
    shadow: { quad: quad.map((point) => ({ x: point.x + 8, y: point.y + 4 })), receiverQuad, opacity: .6, softness: 7 },
  };
  paintFramePlan(context, { time: 0, layers: [layer], flash: 0, echo: 0, strobeLight: null, grade: null }, 100, 100, () => ({
    draw(drawContext) { filters.push({ filter: drawContext.filter, alpha: drawContext.globalAlpha }); },
  }));
  assert.ok(filters.some((entry) => entry.filter === "brightness(0) blur(7px)" && entry.alpha === .6));
  assert.ok(filters.some((entry) => entry.filter === "none" && entry.alpha === 1));
  assert.deepEqual(clips[0], receiverQuad.map((point) => [point.x, point.y]));
});
