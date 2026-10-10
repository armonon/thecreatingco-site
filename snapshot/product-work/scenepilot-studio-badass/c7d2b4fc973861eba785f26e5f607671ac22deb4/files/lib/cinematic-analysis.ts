// Cinematic source analysis — turns low-cost visual/audio samples into an
// editorially useful, serializable story map. Pure and deterministic so the UI,
// auto-assembly and saved projects all agree about the source.

import type { SemanticPersonFrameStats } from "./semantic-segmenter.ts";
import { bestMoment, type CutEvidence } from "./auto-edit-policy.ts";

export type CinematicVisualPoint = {
  time: number; brightness: number; motion: number; cutScore: number;
  histogramDistance?: number; lumaDifference?: number; sharpness?: number; contrast?: number;
  cameraX?: number; cameraY?: number; cameraConfidence?: number; residualMotion?: number;
  subject?: SemanticPersonFrameStats;
};
export type CinematicSignalPoint = { time: number; energy: number; onset: number };
export type CinematicSceneCut = { time: number; confidence: number };
export type CinematicCutKind = "jump-cut" | "scene-change";
export type CinematicCut = CinematicSceneCut & { kind: CinematicCutKind };
export type CinematicPace = "rapid" | "brisk" | "measured" | "long-take";
export type CinematicMotion = "locked" | "mixed" | "active";
export type CinematicExposure = "low-key" | "balanced" | "high-key" | "variable";
export type CinematicShotSize = "close-up" | "medium" | "wide" | "establishing" | "insert" | "unknown";
export type CinematicCameraMove = "locked" | "pan-left" | "pan-right" | "tilt-up" | "tilt-down" | "handheld" | "active";
export type CinematicShotRole = "establishing" | "dialogue" | "action" | "performance" | "insert" | "coverage";
export type CinematicAudioMomentKind = "silence" | "dialogue-like" | "impact" | "vocal-peak" | "applause-like";
export type CinematicAssemblyKind = "selects" | "trailer" | "dialogue" | "montage" | "performance" | "social";

export type CinematicShot = {
  bestTime?: number;
  id: string; start: number; end: number; duration: number; shotSize: CinematicShotSize;
  cameraMove: CinematicCameraMove; role: CinematicShotRole; brightness: number; motion: number;
  sharpness: number; contrast: number; subjectPresent: boolean; subjectCoverage: number;
  subjectCount: number; technicalScore: number; editorialScore: number; issues: string[];
};
export type CinematicAudioMoment = { id: string; kind: CinematicAudioMomentKind; start: number; end: number; confidence: number };
export type CinematicContinuityIssue = {
  id: string; time: number; kind: "possible-jump-cut" | "exposure-jump" | "focus-shift" | "camera-direction";
  severity: "review" | "warning"; message: string;
};
export type CinematicCoverageGap = { id: string; severity: "idea" | "important"; label: string; message: string };
export type CinematicStoryBeat = {
  id: string; label: "Setup" | "Development" | "Turn" | "Climax" | "Resolution";
  start: number; end: number; intensity: number; bestShotId?: string;
};
export type CinematicAssembly = {
  kind: CinematicAssemblyKind; label: string; summary: string; shotIds: string[]; estimatedDuration: number;
};
export type CinematicSimilarTake = { firstShotId: string; secondShotId: string; similarity: number };

export type CinematicAnalysis = {
  shotCount: number; averageShotLength: number; medianShotLength: number; shortestShot: number; longestShot: number;
  cutsPerMinute: number; pace: CinematicPace; motion: CinematicMotion; exposure: CinematicExposure; exposureRange: number;
  sceneChanges: CinematicCut[]; jumpCuts: CinematicCut[]; shots: CinematicShot[]; audioMoments: CinematicAudioMoment[];
  continuityIssues: CinematicContinuityIssue[]; coverageGaps: CinematicCoverageGap[]; storyBeats: CinematicStoryBeat[];
  assemblies: CinematicAssembly[]; similarTakes: CinematicSimilarTake[]; subjectFramesAnalyzed: number;
  subjectPresence: number; technicalPassRate: number;
};
export type CinematicAssemblyCut = {
  editorial?: CutEvidence;
  id: string; assetId: string; sectionId: string; start: number; duration: number; sourceStart: number; linked?: boolean;
};

function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function quantile(values: number[], amount: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = clamp(amount) * (sorted.length - 1), low = Math.floor(position), high = Math.ceil(position), mix = position - low;
  return sorted[low] + (sorted[high] - sorted[low]) * mix;
}
function nearestPoint(points: CinematicVisualPoint[], time: number) {
  return points.reduce((best, point) => Math.abs(point.time - time) < Math.abs(best.time - time) ? point : best, points[0]);
}
function previousPoint(points: CinematicVisualPoint[], time: number) {
  let previous = points[0];
  for (const point of points) { if (point.time >= time) break; previous = point; }
  return previous;
}

function classifyCut(points: CinematicVisualPoint[], cut: CinematicSceneCut): CinematicCut {
  const point = nearestPoint(points, cut.time), previous = previousPoint(points, point.time);
  const lumaDifference = point.lumaDifference ?? point.motion;
  const histogramDistance = point.histogramDistance ?? clamp((point.cutScore - lumaDifference * .38) / .62);
  const brightnessDelta = Math.abs(point.brightness - previous.brightness);
  const sameSetting = histogramDistance < .24 && brightnessDelta < .14;
  const kind: CinematicCutKind = sameSetting && (lumaDifference > .035 || point.cutScore > .08) ? "jump-cut" : "scene-change";
  const continuity = (1 - clamp(histogramDistance / .32)) * .55 + (1 - clamp(brightnessDelta / .2)) * .45;
  const confidence = kind === "jump-cut" ? clamp(cut.confidence * .62 + continuity * .38) : clamp(cut.confidence * .75 + clamp(histogramDistance / .5) * .25);
  return { time: cut.time, confidence, kind };
}

function signalRuns(
  signals: Array<CinematicSignalPoint & { energyN: number; onsetN: number }>,
  predicate: (signal: CinematicSignalPoint & { energyN: number; onsetN: number }) => boolean,
  kind: CinematicAudioMomentKind, minimumDuration: number, duration: number,
) {
  const step = signals.length > 1 ? quantile(signals.slice(1).map((point, index) => point.time - signals[index].time).filter((value) => value > 0), .5) : .05;
  const moments: CinematicAudioMoment[] = [];
  let run: typeof signals = [];
  const flush = () => {
    if (!run.length) return;
    const start = run[0].time, end = Math.min(duration, run.at(-1)!.time + step);
    if (end - start >= minimumDuration) {
      const confidence = kind === "silence" ? 1 - mean(run.map((point) => point.energyN))
        : mean(run.map((point) => kind === "impact" || kind === "applause-like" ? point.onsetN : point.energyN));
      moments.push({ id: `${kind}-${Math.round(start * 1000)}`, kind, start, end, confidence: clamp(confidence) });
    }
    run = [];
  };
  for (const signal of signals) { if (predicate(signal)) run.push(signal); else flush(); }
  flush();
  return moments;
}

export function analyzeCinematicAudio(signals: CinematicSignalPoint[], duration: number): CinematicAudioMoment[] {
  const ordered = signals.filter((point) => Number.isFinite(point.time)).sort((a, b) => a.time - b.time);
  if (!ordered.length) return [];
  const lowEnergy = quantile(ordered.map((point) => point.energy), .1), highEnergy = quantile(ordered.map((point) => point.energy), .9);
  const lowOnset = quantile(ordered.map((point) => point.onset), .1), highOnset = quantile(ordered.map((point) => point.onset), .9);
  const normalized = ordered.map((point) => ({
    ...point, energyN: clamp((point.energy - lowEnergy) / Math.max(1e-6, highEnergy - lowEnergy)),
    onsetN: clamp((point.onset - lowOnset) / Math.max(1e-6, highOnset - lowOnset)),
  }));
  const flatSilence = highEnergy < .0005;
  return [
    ...signalRuns(normalized, (point) => flatSilence || point.energyN < .08, "silence", .45, duration),
    ...signalRuns(normalized, (point) => point.energyN >= .18 && point.energyN <= .82 && point.onsetN < .42, "dialogue-like", .65, duration),
    ...signalRuns(normalized, (point) => point.onsetN > .86, "impact", 0, duration),
    ...signalRuns(normalized, (point) => point.energyN > .82 && point.onsetN < .65, "vocal-peak", .18, duration),
    ...signalRuns(normalized, (point) => point.energyN > .45 && point.onsetN > .48, "applause-like", .35, duration),
  ].sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));
}

function overlaps(start: number, end: number, moment: { start: number; end: number }) { return moment.start < end && moment.end > start; }
function cameraMove(points: CinematicVisualPoint[]): CinematicCameraMove {
  const reliable = points.filter((point) => (point.cameraConfidence ?? 0) >= .08);
  if (!reliable.length) return mean(points.map((point) => point.motion)) > .13 ? "active" : "locked";
  const x = mean(reliable.map((point) => point.cameraX ?? 0)), y = mean(reliable.map((point) => point.cameraY ?? 0));
  const magnitude = mean(reliable.map((point) => Math.hypot(point.cameraX ?? 0, point.cameraY ?? 0)));
  const signs = reliable.flatMap((point) => [Math.abs(point.cameraX ?? 0) > .25 ? Math.sign(point.cameraX ?? 0) : 0, Math.abs(point.cameraY ?? 0) > .25 ? Math.sign(point.cameraY ?? 0) : 0]).filter(Boolean);
  const flips = signs.slice(1).filter((sign, index) => sign !== signs[index]).length;
  if (magnitude > .42 && flips >= Math.max(2, Math.round(reliable.length * .25))) return "handheld";
  if (magnitude < .18) return "locked";
  if (Math.abs(x) >= Math.abs(y) * 1.2 && Math.abs(x) > .18) return x > 0 ? "pan-right" : "pan-left";
  if (Math.abs(y) > Math.abs(x) * 1.2 && Math.abs(y) > .18) return y > 0 ? "tilt-down" : "tilt-up";
  return "active";
}
function shotFraming(subject: SemanticPersonFrameStats[]): CinematicShotSize {
  if (!subject.length) return "unknown";
  const present = subject.filter((frame) => frame.present);
  if (!present.length) return "insert";
  const coverage = mean(present.map((frame) => frame.coverage));
  return coverage >= .42 ? "close-up" : coverage >= .16 ? "medium" : coverage >= .045 ? "wide" : "establishing";
}

function buildShots(duration: number, points: CinematicVisualPoint[], cuts: CinematicCut[], audioMoments: CinematicAudioMoment[]): CinematicShot[] {
  const boundaries = [0, ...cuts.map((cut) => cut.time), duration];
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const samples = points.filter((point) => point.time >= start && (index === boundaries.length - 2 ? point.time <= end : point.time < end));
    const effective = samples.length ? samples : [nearestPoint(points, (start + end) / 2)];
    const subjects = effective.map((point) => point.subject).filter((subject): subject is SemanticPersonFrameStats => Boolean(subject));
    const present = subjects.filter((subject) => subject.present);
    const brightness = mean(effective.map((point) => point.brightness));
    const motion = mean(effective.map((point) => point.residualMotion ?? point.motion));
    const sharpness = mean(effective.map((point) => point.sharpness ?? .5));
    const contrast = mean(effective.map((point) => point.contrast ?? .5));
    const shotSize = shotFraming(subjects), move = cameraMove(effective);
    const dialogue = audioMoments.some((moment) => moment.kind === "dialogue-like" && overlaps(start, end, moment));
    const vocalPeak = audioMoments.some((moment) => moment.kind === "vocal-peak" && overlaps(start, end, moment));
    const subjectPresent = present.length > 0, subjectCoverage = mean(subjects.map((subject) => subject.present ? subject.coverage : 0));
    const role: CinematicShotRole = dialogue && subjectPresent ? "dialogue" : vocalPeak && subjectPresent ? "performance"
      : motion > .13 ? "action" : !subjectPresent && (shotSize === "establishing" || end - start >= 3.5) ? "establishing"
        : shotSize === "insert" ? "insert" : "coverage";
    const issues: string[] = [];
    if (brightness < .13) issues.push("underexposed");
    if (brightness > .88) issues.push("overexposed");
    if (sharpness < .08) issues.push("soft focus");
    if (move === "handheld" && motion > .11) issues.push("possible camera shake");
    if (end - start < .28) issues.push("flash frame / accidental cut");
    const exposureScore = clamp(1 - Math.abs(brightness - .5) * 1.65), focusScore = clamp((sharpness - .035) / .2);
    const stabilityScore = move === "handheld" ? .48 : move === "active" ? .72 : 1;
    const technicalScore = clamp(exposureScore * .34 + focusScore * .4 + stabilityScore * .18 + clamp(contrast / .28) * .08);
    const engagement = clamp(motion * 3.2) * .58 + (subjectPresent ? .42 : .2);
    const editorialScore = clamp(technicalScore * .68 + engagement * .24 + Math.min(1, (end - start) / 1.2) * .08);
    return {
      id: `shot-${index + 1}`, start, end, duration: end - start, bestTime: bestMoment(start,end,Math.min(2.4,end-start),effective)?.time ?? start, shotSize, cameraMove: move, role,
      brightness, motion, sharpness, contrast, subjectPresent, subjectCoverage,
      subjectCount: present.reduce((maximum, subject) => Math.max(maximum, subject.count), 0), technicalScore, editorialScore, issues,
    };
  });
}

function continuityReport(shots: CinematicShot[], jumpCuts: CinematicCut[]): CinematicContinuityIssue[] {
  const issues: CinematicContinuityIssue[] = jumpCuts.map((cut) => ({
    id: `continuity-jump-${Math.round(cut.time * 1000)}`, time: cut.time, kind: "possible-jump-cut", severity: "review",
    message: "Similar setting and exposure across a discontinuity — review as an intentional jump cut or cover with B-roll.",
  }));
  for (let index = 1; index < shots.length; index++) {
    const before = shots[index - 1], after = shots[index], time = after.start;
    if (Math.abs(before.brightness - after.brightness) > .3) issues.push({ id: `continuity-exposure-${index}`, time, kind: "exposure-jump", severity: "warning", message: "Large exposure change between adjacent shots; shot-match or motivate it as a lighting change." });
    if (Math.abs(before.sharpness - after.sharpness) > .28 && Math.min(before.sharpness, after.sharpness) < .1) issues.push({ id: `continuity-focus-${index}`, time, kind: "focus-shift", severity: "review", message: "Focus quality changes sharply across this edit." });
    const opposedPan = (before.cameraMove === "pan-left" && after.cameraMove === "pan-right") || (before.cameraMove === "pan-right" && after.cameraMove === "pan-left");
    if (opposedPan) issues.push({ id: `continuity-direction-${index}`, time, kind: "camera-direction", severity: "review", message: "Camera direction reverses across the cut; check screen direction and eyeline continuity." });
  }
  return issues.sort((a, b) => a.time - b.time);
}
function findSimilarTakes(shots: CinematicShot[]): CinematicSimilarTake[] {
  const candidates: CinematicSimilarTake[] = [];
  for (let left = 0; left < shots.length; left++) for (let right = left + 2; right < shots.length; right++) {
    const first = shots[left], second = shots[right];
    if (Math.abs(first.start - second.start) < 3 || first.duration < .5 || second.duration < .5) continue;
    const distance = Math.abs(first.brightness - second.brightness) * .28 + Math.abs(first.motion - second.motion) * 1.8 * .2
      + Math.abs(first.sharpness - second.sharpness) * .16 + Math.abs(first.subjectCoverage - second.subjectCoverage) * .24 + (first.shotSize === second.shotSize ? 0 : .12);
    const similarity = clamp(1 - distance);
    if (similarity >= .9) candidates.push({ firstShotId: first.id, secondShotId: second.id, similarity });
  }
  return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 12);
}
function coverageReport(shots: CinematicShot[]): CinematicCoverageGap[] {
  const gaps: CinematicCoverageGap[] = [], hasPeople = shots.some((shot) => shot.subjectPresent);
  const has = (sizes: CinematicShotSize[]) => shots.some((shot) => sizes.includes(shot.shotSize));
  if (!has(["wide", "establishing"])) gaps.push({ id: "coverage-wide", severity: "important", label: "Missing establishing coverage", message: "Add a wide shot that tells the viewer where the scene is happening." });
  if (hasPeople && !has(["close-up"])) gaps.push({ id: "coverage-close", severity: "idea", label: "No close-up", message: "Capture a close reaction or detail for emotional emphasis and edit flexibility." });
  if (!shots.some((shot) => shot.role === "insert")) gaps.push({ id: "coverage-insert", severity: "idea", label: "No insert or cutaway", message: "Add hands, props, environment or reaction shots to cover trims and jump cuts." });
  if (new Set(shots.map((shot) => shot.shotSize)).size <= 1 && shots.length > 2) gaps.push({ id: "coverage-variety", severity: "important", label: "Framing is repetitive", message: "Mix wide, medium and close coverage to create visual grammar instead of one repeated angle." });
  const weak = shots.filter((shot) => shot.technicalScore < .52).length / Math.max(1, shots.length);
  if (weak >= .3) gaps.push({ id: "coverage-technical", severity: "important", label: "Limited clean coverage", message: `${Math.round(weak * 100)}% of shots carry focus, exposure or stability warnings; prioritize clean alternates.` });
  return gaps;
}
function storyMap(duration: number, shots: CinematicShot[], audioMoments: CinematicAudioMoment[]): CinematicStoryBeat[] {
  const ranges: Array<[CinematicStoryBeat["label"], number, number]> = [["Setup", 0, .2], ["Development", .2, .48], ["Turn", .48, .68], ["Climax", .68, .9], ["Resolution", .9, 1]];
  return ranges.map(([label, from, to], index) => {
    const start = duration * from, end = duration * to, inside = shots.filter((shot) => shot.start < end && shot.end > start);
    const audio = audioMoments.filter((moment) => overlaps(start, end, moment));
    const visualIntensity = mean(inside.map((shot) => clamp(shot.motion * 3.5) * .55 + shot.editorialScore * .45));
    const audioIntensity = mean(audio.map((moment) => moment.kind === "silence" ? 0 : moment.confidence));
    const best = [...inside].sort((a, b) => b.editorialScore - a.editorialScore)[0];
    return { id: `story-beat-${index}`, label, start, end, intensity: clamp(visualIntensity * .72 + audioIntensity * .28), bestShotId: best?.id };
  });
}
function chooseWithin(shots: CinematicShot[], predicate: (shot: CinematicShot) => boolean, target: number, cap: number) {
  const pool = shots.filter(predicate);
  const threshold = quantile(pool.map((shot) => shot.editorialScore), .55);
  const ranked = pool.filter((shot) => shot.editorialScore >= threshold).sort((a, b) => b.editorialScore - a.editorialScore || a.start - b.start);
  const selected: CinematicShot[] = []; let total = 0;
  for (const shot of ranked) {
    const contribution = Math.min(cap, shot.duration);
    if (selected.length && total + contribution > target) continue;
    selected.push(shot); total += contribution;
    if (total >= target * .82) break;
  }
  return selected.sort((a, b) => a.start - b.start);
}
function assemblyRecommendations(shots: CinematicShot[], options: {targetDuration?:number;maxShot?:number} = {}): CinematicAssembly[] {
  const definitions: Array<{ kind: CinematicAssemblyKind; label: string; summary: string; target: number; cap: number; predicate: (shot: CinematicShot) => boolean }> = [
    { kind: "selects", label: "Clean selects", summary: "Best technically sound shots, kept in source order.", target: 120, cap: 12, predicate: (shot) => shot.technicalScore >= .62 },
    { kind: "trailer", label: "Trailer arc", summary: "Strong setup, escalation and payoff coverage in a compact cut.", target: 45, cap: 4.5, predicate: (shot) => shot.editorialScore >= .65 },
    { kind: "dialogue", label: "Dialogue spine", summary: "Person-led dialogue-like moments with clean framing.", target: 90, cap: 9, predicate: (shot) => shot.role === "dialogue" },
    { kind: "montage", label: "Visual montage", summary: "High-motion, high-quality shots paced for visual momentum.", target: 60, cap: 2.4, predicate: (shot) => shot.motion >= .08 || shot.role === "action" },
    { kind: "performance", label: "Performance cut", summary: "Person-led performance and active coverage.", target: 60, cap: 3.2, predicate: (shot) => shot.role === "performance" || (shot.subjectPresent && shot.motion >= .055) },
    { kind: "social", label: "Social highlight", summary: "The most immediate, engaging shots in a short vertical-ready sequence.", target: 30, cap: 2.5, predicate: (shot) => shot.editorialScore >= .68 },
  ];
  return definitions.map((definition) => {
    const chosen = chooseWithin(shots, definition.predicate, options.targetDuration || definition.target, options.maxShot ?? definition.cap);
    return { kind: definition.kind, label: definition.label, summary: definition.summary, shotIds: chosen.map((shot) => shot.id), estimatedDuration: chosen.reduce((sum, shot) => sum + Math.min(definition.cap, shot.duration), 0) };
  });
}

const EMPTY_ANALYSIS: CinematicAnalysis = {
  shotCount: 0, averageShotLength: 0, medianShotLength: 0, shortestShot: 0, longestShot: 0,
  cutsPerMinute: 0, pace: "measured", motion: "mixed", exposure: "balanced", exposureRange: 0,
  sceneChanges: [], jumpCuts: [], shots: [], audioMoments: [], continuityIssues: [], coverageGaps: [], storyBeats: [], assemblies: [], similarTakes: [],
  subjectFramesAnalyzed: 0, subjectPresence: 0, technicalPassRate: 0,
};

export function analyzeCinematicFootage(duration: number, visuals: CinematicVisualPoint[], sceneCuts: CinematicSceneCut[], signals: CinematicSignalPoint[] = []): CinematicAnalysis {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const points = visuals.filter((point) => Number.isFinite(point.time)).sort((left, right) => left.time - right.time);
  if (!safeDuration || !points.length) return structuredClone(EMPTY_ANALYSIS);
  const cuts = sceneCuts.filter((cut) => Number.isFinite(cut.time) && cut.time > 0 && cut.time < safeDuration).sort((a, b) => a.time - b.time).map((cut) => classifyCut(points, cut));
  const boundaries = [0, ...cuts.map((cut) => cut.time), safeDuration];
  const shotLengths = boundaries.slice(1).map((end, index) => Math.max(0, end - boundaries[index]));
  const averageShotLength = mean(shotLengths), medianShotLength = quantile(shotLengths, .5);
  const pace: CinematicPace = medianShotLength < 1.5 ? "rapid" : medianShotLength < 3.5 ? "brisk" : medianShotLength < 7 ? "measured" : "long-take";
  const cutTimes = cuts.map((cut) => cut.time);
  const cleanMotion = points.filter((point) => cutTimes.every((time) => Math.abs(point.time - time) > .28)).map((point) => clamp(point.residualMotion ?? point.motion));
  const motionLevel = quantile(cleanMotion.length ? cleanMotion : points.map((point) => clamp(point.motion)), .65);
  const motion: CinematicMotion = motionLevel < .035 ? "locked" : motionLevel > .11 ? "active" : "mixed";
  const brightness = points.map((point) => clamp(point.brightness)), brightnessMedian = quantile(brightness, .5);
  const exposureRange = quantile(brightness, .9) - quantile(brightness, .1);
  const exposure: CinematicExposure = exposureRange > .42 ? "variable" : brightnessMedian < .32 ? "low-key" : brightnessMedian > .68 ? "high-key" : "balanced";
  const audioMoments = analyzeCinematicAudio(signals, safeDuration), shots = buildShots(safeDuration, points, cuts, audioMoments);
  const sceneChanges = cuts.filter((cut) => cut.kind === "scene-change"), jumpCuts = cuts.filter((cut) => cut.kind === "jump-cut");
  const subjectSamples = points.map((point) => point.subject).filter((subject): subject is SemanticPersonFrameStats => Boolean(subject));
  return {
    shotCount: shotLengths.length, averageShotLength, medianShotLength, shortestShot: Math.min(...shotLengths), longestShot: Math.max(...shotLengths),
    cutsPerMinute: cuts.length / safeDuration * 60, pace, motion, exposure, exposureRange, sceneChanges, jumpCuts, shots, audioMoments,
    continuityIssues: continuityReport(shots, jumpCuts), coverageGaps: coverageReport(shots), storyBeats: storyMap(safeDuration, shots, audioMoments),
    assemblies: assemblyRecommendations(shots), similarTakes: findSimilarTakes(shots), subjectFramesAnalyzed: subjectSamples.length,
    subjectPresence: subjectSamples.filter((subject) => subject.present).length / Math.max(1, subjectSamples.length),
    technicalPassRate: shots.filter((shot) => shot.technicalScore >= .62).length / Math.max(1, shots.length),
  };
}

export function buildCinematicAssembly(report: CinematicAnalysis, kind: CinematicAssemblyKind, assetId: string, options: {selection?: "all-scenes";targetDuration?:number;maxShot?:number;minShot?:number;visuals?:CinematicVisualPoint[];phrases?:Array<{start:number;end:number}>} = {}): CinematicAssemblyCut[] {
  // Following scenes is not a quality gate. Flat graphics, dark shots and abstract
  // footage still have valid edit boundaries; keep quality-ranked selects opt-in.
  const recommendation = options.selection === "all-scenes"
    ? { shotIds: [...report.shots].sort((a,b)=>a.start-b.start).map(shot=>shot.id) }
    : (options.targetDuration || options.maxShot ? assemblyRecommendations(report.shots,options) : report.assemblies).find((assembly) => assembly.kind === kind);
  if (!recommendation) return [];
  const cap: Record<CinematicAssemblyKind, number> = { selects: 12, trailer: 4.5, dialogue: 9, montage: 2.4, performance: 3.2, social: 2.5 };
  const target: Record<CinematicAssemblyKind, number> = { selects: 120, trailer: 45, dialogue: 90, montage: 60, performance: 60, social: 30 };
  let timeline = 0; const cuts: CinematicAssemblyCut[] = [];
  for (const id of recommendation.shotIds) {
    const shot = report.shots.find((candidate) => candidate.id === id);
    const limit=options.targetDuration || target[kind];
    if (!shot || timeline >= limit) continue;
    const duration = Math.min(shot.duration, options.maxShot ?? cap[kind], limit - timeline);
    if (duration < (options.minShot ?? .12)) continue;
    const moment=options.visuals?bestMoment(shot.start,shot.end,duration,options.visuals,options.phrases):undefined;
    if(moment===null) continue;
    cuts.push({ id: `cinematic-auto-${kind}-${shot.id}`, assetId, sectionId: `cinematic-${kind}`, start: timeline, sourceStart: moment?.time ?? (kind === "dialogue" ? shot.start : Math.max(shot.start, Math.min(shot.end-duration,shot.bestTime ?? shot.start))), duration, linked: true, editorial: {reason: kind === "dialogue" ? "Dialogue-like texture; verify against transcript" : `Scene boundary · ${shot.role} · strongest sampled moment`, confidence: shot.editorialScore, alternatives: report.shots.filter(s=>s.id!==shot.id).sort((a,b)=>b.editorialScore-a.editorialScore).slice(0,3).map(s=>s.id)} });
    timeline += duration;
  }
  return cuts;
}
