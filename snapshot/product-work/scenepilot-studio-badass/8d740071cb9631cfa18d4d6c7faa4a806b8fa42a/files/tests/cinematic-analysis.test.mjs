import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCinematicAudio, analyzeCinematicFootage, buildCinematicAssembly } from "../lib/cinematic-analysis.ts";

test("cinematic analysis separates likely jump cuts from full scene changes", () => {
  const visuals = [
    { time: 0, brightness: .5, motion: .02, cutScore: .01, histogramDistance: 0, lumaDifference: 0 },
    { time: 2, brightness: .51, motion: .025, cutScore: .02, histogramDistance: .01, lumaDifference: .025 },
    { time: 4, brightness: .52, motion: .22, cutScore: .13, histogramDistance: .07, lumaDifference: .22 },
    { time: 6, brightness: .5, motion: .02, cutScore: .02, histogramDistance: .01, lumaDifference: .02 },
    { time: 8, brightness: .22, motion: .5, cutScore: .65, histogramDistance: .74, lumaDifference: .5 },
    { time: 10, brightness: .24, motion: .03, cutScore: .02, histogramDistance: .02, lumaDifference: .03 },
  ];
  const report = analyzeCinematicFootage(12, visuals, [
    { time: 4, confidence: .8 },
    { time: 8, confidence: .9 },
  ]);

  assert.equal(report.shotCount, 3);
  assert.equal(report.averageShotLength, 4);
  assert.equal(report.medianShotLength, 4);
  assert.equal(report.pace, "measured");
  assert.equal(report.motion, "locked");
  assert.deepEqual(report.jumpCuts.map((cut) => cut.time), [4]);
  assert.deepEqual(report.sceneChanges.map((cut) => cut.time), [8]);
});

test("cinematic analysis handles a source with no visual frames", () => {
  const report = analyzeCinematicFootage(180, [], []);
  assert.equal(report.shotCount, 0);
  assert.equal(report.cutsPerMinute, 0);
  assert.deepEqual(report.jumpCuts, []);
  assert.deepEqual(report.shots, []);
  assert.deepEqual(report.assemblies, []);
});

test("cinematic intelligence describes framing, camera, technical quality and coverage", () => {
  const subject = (coverage, present = true) => ({ present, coverage: present ? coverage : 0, centerX: .5, centerY: .5, width: .4, height: .8, count: present ? 1 : 0, confidence: .92 });
  const visuals = [
    { time: 0, brightness: .5, motion: .02, residualMotion: .01, cutScore: 0, sharpness: .2, contrast: .3, cameraX: 0, cameraY: 0, cameraConfidence: .8, subject: subject(.03) },
    { time: 2, brightness: .52, motion: .03, residualMotion: .02, cutScore: .01, sharpness: .22, contrast: .31, cameraX: 0, cameraY: 0, cameraConfidence: .8, subject: subject(.03) },
    { time: 4, brightness: .5, motion: .2, residualMotion: .05, cutScore: .2, histogramDistance: .08, lumaDifference: .2, sharpness: .18, contrast: .28, cameraX: .8, cameraY: 0, cameraConfidence: .8, subject: subject(.24) },
    { time: 6, brightness: .53, motion: .05, residualMotion: .03, cutScore: .02, sharpness: .19, contrast: .3, cameraX: .8, cameraY: 0, cameraConfidence: .8, subject: subject(.24) },
    { time: 8, brightness: .2, motion: .6, residualMotion: .04, cutScore: .7, histogramDistance: .8, lumaDifference: .55, sharpness: .04, contrast: .12, cameraX: -.8, cameraY: 0, cameraConfidence: .9, subject: subject(.55) },
    { time: 10, brightness: .22, motion: .04, residualMotion: .02, cutScore: .01, sharpness: .04, contrast: .12, cameraX: -.8, cameraY: 0, cameraConfidence: .9, subject: subject(.55) },
  ];
  const signals = Array.from({ length: 60 }, (_, index) => ({
    time: index * .2,
    energy: index < 10 ? 0 : index < 35 ? .45 : index < 50 ? .75 : .15,
    onset: index >= 35 && index < 50 ? .9 : .03,
  }));
  const report = analyzeCinematicFootage(12, visuals, [{ time: 4, confidence: .8 }, { time: 8, confidence: .9 }], signals);
  assert.deepEqual(report.shots.map((shot) => shot.shotSize), ["establishing", "medium", "close-up"]);
  assert.equal(report.shots[1].cameraMove, "pan-right");
  assert.ok(report.shots[2].issues.includes("soft focus"));
  assert.equal(report.subjectFramesAnalyzed, 6);
  assert.equal(report.subjectPresence, 1);
  assert.equal(report.storyBeats.length, 5);
  assert.equal(report.assemblies.length, 6);
  assert.ok(report.continuityIssues.some((issue) => issue.kind === "camera-direction"));
  assert.ok(report.coverageGaps.some((gap) => gap.id === "coverage-insert"));
});

test("cinematic audio labels silence, dialogue-like texture and impacts without claiming transcription", () => {
  const signals = Array.from({ length: 50 }, (_, index) => ({
    time: index * .1,
    energy: index < 10 ? 0 : index < 35 ? .45 : .95,
    onset: index < 35 ? .02 : .9,
  }));
  const moments = analyzeCinematicAudio(signals, 5);
  assert.ok(moments.some((moment) => moment.kind === "silence"));
  assert.ok(moments.some((moment) => moment.kind === "dialogue-like"));
  assert.ok(moments.some((moment) => moment.kind === "impact"));
});

test("assembly recommendations become ordinary linked source cuts", () => {
  const visuals = Array.from({ length: 8 }, (_, index) => ({ time: index * 2, brightness: .5, motion: .08 + index * .01, cutScore: index ? .3 : 0, histogramDistance: index ? .5 : 0, lumaDifference: index ? .3 : 0, sharpness: .2, contrast: .3 }));
  const report = analyzeCinematicFootage(16, visuals, [{ time: 4, confidence: .8 }, { time: 8, confidence: .8 }, { time: 12, confidence: .8 }]);
  const cuts = buildCinematicAssembly(report, "trailer", "main-source");
  assert.ok(cuts.length > 0);
  assert.equal(cuts[0].assetId, "main-source");
  assert.equal(cuts[0].start, 0);
  assert.ok(cuts.every((cut) => cut.linked && cut.duration <= 4.5));
});

test("scene-following keeps low-detail silent footage without weakening quality selects", () => {
  const visuals = Array.from({length:30},(_,i)=>({time:i/5,brightness:.08,motion:0,cutScore:0,sharpness:0,contrast:0}));
  const report = analyzeCinematicFootage(6,visuals,[{time:2,confidence:1},{time:4,confidence:1}]);
  assert.equal(buildCinematicAssembly(report,"selects","main-source").length,0);
  const cuts = buildCinematicAssembly(report,"selects","main-source",{selection:"all-scenes",targetDuration:6,minShot:.25,maxShot:12,visuals});
  assert.equal(cuts.length,3);
  assert.deepEqual(cuts.map(c=>[c.start,c.sourceStart,c.duration]),[[0,0,2],[2,2,2],[4,4,2]]);
  assert.ok(cuts.every(c=>c.editorial.confidence<.62));
});
