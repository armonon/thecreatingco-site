// Project-wide editorial intelligence. Unlike the single-source cinematic scan,
// this engine reasons across the entire media bin: repeated setups, likely
// retakes, dialogue intent, script coverage and editable multi-source assemblies.
// It is pure, deterministic and fully serializable so browser Lite, Desktop Pro,
// saved projects and tests all make the same decisions.

import { transcriptSimilarity } from "./take-select.ts";

export type ProjectTranscriptChunk = {
  text: string;
  start: number;
  end: number;
  confidence?: number;
};

export type ProjectVisualSignature = {
  sampleCount: number;
  brightness: number;
  sharpness: number;
  contrast: number;
  motion: number;
  color: { r: number; g: number; b: number };
  histogram: number[];
  subject: {
    frames: number;
    presence: number;
    coverage: number;
    centerX: number;
    centerY: number;
    count: number;
    confidence: number;
  };
};

export type ProjectIntelligenceAsset = {
  peakTime?: number;
  priority?: number;
  id: string;
  name: string;
  kind: "video" | "image";
  duration: number;
  visual?: ProjectVisualSignature;
  transcript?: ProjectTranscriptChunk[];
};

export type ProjectCluster = {
  id: string;
  label: string;
  assetIds: string[];
  confidence: number;
};

export type ProjectTakeGroup = ProjectCluster & {
  bestAssetId: string;
  transcriptMatch: number;
  reason: string;
};

export type DialogueIntent = "hook" | "question" | "explanation" | "emotion" | "action" | "call-to-action" | "statement";
export type ProjectDialogueMoment = {
  id: string;
  assetId: string;
  start: number;
  end: number;
  text: string;
  intent: DialogueIntent;
  score: number;
  speakerCandidateId?: string;
};

export type ProjectStoryBeat = {
  id: string;
  label: "Hook" | "Context" | "Development" | "Turn" | "Payoff";
  briefText: string;
  assetIds: string[];
  dialogueMomentIds: string[];
  coverage: number;
};

export type ProjectAssemblyKind = "story" | "dialogue" | "coverage" | "trailer" | "selects";
export type ProjectAssembly = {
  kind: ProjectAssemblyKind;
  label: string;
  summary: string;
  assetIds: string[];
  estimatedDuration: number;
};
export type ProjectAssemblyCut = {
  preservePhrase?: boolean;
  id: string;
  assetId: string;
  sectionId: string;
  start: number;
  sourceStart: number;
  duration: number;
  linked: true;
};

export type ProjectIntelligence = {
  schema: "scenepilot-project-intelligence/v1";
  brief: string;
  assetsAnalyzed: number;
  transcriptAssets: number;
  transcriptMinutes: number;
  subjectCandidates: ProjectCluster[];
  objectCandidates: ProjectCluster[];
  locationCandidates: ProjectCluster[];
  takeGroups: ProjectTakeGroup[];
  dialogueMoments: ProjectDialogueMoment[];
  storyBeats: ProjectStoryBeat[];
  assemblies: ProjectAssembly[];
  warnings: string[];
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const finiteDuration = (asset: ProjectIntelligenceAsset) => Number.isFinite(asset.duration) ? Math.max(0, asset.duration) : 0;
const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
const transcriptText = (asset: ProjectIntelligenceAsset) => (asset.transcript ?? []).map((chunk) => chunk.text).join(" ").trim();
const normalizedStem = (name: string) => name.toLowerCase().replace(/\.[^.]+$/, "").replace(/\b(?:take|tk|shot|clip|cam|camera|angle|version|ver|v|copy)[-_ ]*\d+\b/g, " ").replace(/[-_ ]*\d+$/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function quality(asset: ProjectIntelligenceAsset) {
  const visual = asset.visual;
  if (!visual) return asset.kind === "image" ? .45 : .35;
  const exposure = 1 - Math.min(1, Math.abs(visual.brightness - .5) * 1.7);
  const focus = clamp((visual.sharpness - .025) / .22);
  const tonal = clamp(visual.contrast / .3);
  const transcript = transcriptText(asset);
  const dialogue = transcript ? clamp(words(transcript).length / 28) : .35;
  return clamp(exposure * .3 + focus * .34 + tonal * .14 + dialogue * .14 + Math.min(1, finiteDuration(asset) / 2) * .08);
}

function histogramDistance(first: number[] = [], second: number[] = []) {
  const count = Math.max(first.length, second.length, 1);
  let distance = 0;
  for (let index = 0; index < count; index++) distance += Math.abs((first[index] ?? 0) - (second[index] ?? 0));
  return clamp(distance / 2);
}

function locationSimilarity(first: ProjectIntelligenceAsset, second: ProjectIntelligenceAsset) {
  const a = first.visual, b = second.visual;
  if (!a || !b) return normalizedStem(first.name) === normalizedStem(second.name) ? .72 : 0;
  const color = (Math.abs(a.color.r - b.color.r) + Math.abs(a.color.g - b.color.g) + Math.abs(a.color.b - b.color.b)) / 3;
  const tone = Math.abs(a.brightness - b.brightness) * .55 + Math.abs(a.contrast - b.contrast) * .45;
  return clamp(1 - color * 1.25 - tone * .75 - histogramDistance(a.histogram, b.histogram) * .7);
}

function subjectSimilarity(first: ProjectIntelligenceAsset, second: ProjectIntelligenceAsset) {
  const a = first.visual?.subject, b = second.visual?.subject;
  if (!a?.frames || !b?.frames || a.presence < .3 || b.presence < .3) return 0;
  const appearance = locationSimilarity(first, second);
  const framing = Math.abs(a.coverage - b.coverage) * 1.2 + Math.abs(a.centerX - b.centerX) * .35 + Math.abs(a.centerY - b.centerY) * .25;
  const countPenalty = Math.abs(a.count - b.count) * .16;
  return clamp(appearance * .48 + (1 - clamp(framing + countPenalty)) * .52);
}

function takeSimilarity(first: ProjectIntelligenceAsset, second: ProjectIntelligenceAsset) {
  const aText = transcriptText(first), bText = transcriptText(second);
  const transcript = aText && bText ? transcriptSimilarity(aText, bText) : 0;
  const stemA = normalizedStem(first.name), stemB = normalizedStem(second.name);
  const filename = stemA && stemB ? transcriptSimilarity(stemA, stemB) : 0;
  const visual = locationSimilarity(first, second);
  return clamp(transcript * .6 + filename * .22 + visual * .18);
}

function connectedClusters(assets: ProjectIntelligenceAsset[], similarity: (a: ProjectIntelligenceAsset, b: ProjectIntelligenceAsset) => number, threshold: number, prefix: string, label: string): ProjectCluster[] {
  const parent = assets.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const join = (left: number, right: number) => { const a = find(left), b = find(right); if (a !== b) parent[b] = a; };
  const scores = new Map<string, number>();
  for (let left = 0; left < assets.length; left++) for (let right = left + 1; right < assets.length; right++) {
    const score = similarity(assets[left], assets[right]);
    scores.set(`${left}:${right}`, score);
    if (score >= threshold) join(left, right);
  }
  const groups = new Map<number, number[]>();
  assets.forEach((_, index) => { const root = find(index); groups.set(root, [...(groups.get(root) ?? []), index]); });
  return [...groups.values()].filter((indices) => indices.length >= 2).map((indices, groupIndex) => {
    const internal: number[] = [];
    for (let left = 0; left < indices.length; left++) for (let right = left + 1; right < indices.length; right++) internal.push(scores.get(`${Math.min(indices[left], indices[right])}:${Math.max(indices[left], indices[right])}`) ?? 0);
    return { id: `${prefix}-${groupIndex + 1}`, label: `${label} ${groupIndex + 1}`, assetIds: indices.map((index) => assets[index].id), confidence: mean(internal) };
  }).sort((a, b) => b.confidence - a.confidence || b.assetIds.length - a.assetIds.length);
}

function takeGroups(assets: ProjectIntelligenceAsset[]): ProjectTakeGroup[] {
  return connectedClusters(assets.filter((asset) => asset.kind === "video"), takeSimilarity, .58, "take-group", "Take group").map((group) => {
    const members = group.assetIds.map((id) => assets.find((asset) => asset.id === id)!).filter(Boolean);
    const best = [...members].sort((a, b) => quality(b) - quality(a) || a.name.localeCompare(b.name))[0];
    const similarities: number[] = [];
    for (let left = 0; left < members.length; left++) for (let right = left + 1; right < members.length; right++) similarities.push(transcriptSimilarity(transcriptText(members[left]), transcriptText(members[right])));
    return { ...group, bestAssetId: best.id, transcriptMatch: mean(similarities), reason: `Best technical/dialogue score ${Math.round(quality(best) * 100)}; ${members.length - 1} alternate${members.length === 2 ? "" : "s"} retained for review.` };
  });
}

function dialogueIntent(text: string): DialogueIntent {
  const normalized = text.toLowerCase().trim();
  if (/\b(?:subscribe|follow|buy|visit|join|call|download|watch|listen|share|click|sign up)\b/.test(normalized)) return "call-to-action";
  if (/\?$|^(?:why|how|what|when|where|who|do you|did you|can you|could you)\b/.test(normalized)) return "question";
  if (/\b(?:because|means|first|second|therefore|for example|the reason|in other words)\b/.test(normalized)) return "explanation";
  if (/\b(?:suddenly|but then|until|changed|turn|however|instead|realized)\b/.test(normalized)) return "action";
  if (/\b(?:feel|felt|love|hate|afraid|scared|happy|sad|angry|hope|dream|heart)\b/.test(normalized)) return "emotion";
  if (words(normalized).length <= 10 || /\b(?:imagine|listen|look|here's|this is|never|always)\b/.test(normalized)) return "hook";
  return "statement";
}

function dialogueMoments(assets: ProjectIntelligenceAsset[], subjects: ProjectCluster[]): ProjectDialogueMoment[] {
  const subjectByAsset = new Map(subjects.flatMap((cluster) => cluster.assetIds.map((assetId) => [assetId, cluster.id] as const)));
  return assets.flatMap((asset) => (asset.transcript ?? []).flatMap((chunk, index) => {
    const text = chunk.text.trim();
    if (!text || chunk.end <= chunk.start) return [];
    const intent = dialogueIntent(text);
    const length = words(text).length;
    const intentBoost = intent === "hook" || intent === "emotion" || intent === "action" ? .15 : intent === "question" ? .1 : 0;
    const confidence = chunk.confidence == null ? .78 : clamp(chunk.confidence);
    const score = clamp(confidence * .55 + clamp(length / 18) * .22 + quality(asset) * .23 + intentBoost);
    return [{ id: `dialogue-${asset.id}-${index}`, assetId: asset.id, start: Math.max(0, chunk.start), end: Math.min(finiteDuration(asset) || chunk.end, chunk.end), text, intent, score, speakerCandidateId: subjectByAsset.get(asset.id) }];
  })).sort((a, b) => b.score - a.score || a.assetId.localeCompare(b.assetId) || a.start - b.start);
}

const STORY_LABELS: ProjectStoryBeat["label"][] = ["Hook", "Context", "Development", "Turn", "Payoff"];
const STORY_INTENTS: DialogueIntent[][] = [["hook", "question"], ["statement", "explanation"], ["explanation", "emotion"], ["action", "emotion"], ["call-to-action", "emotion", "statement"]];

function briefParts(brief: string) {
  const parts = brief.split(/\n+|(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return STORY_LABELS.map(() => "");
  return STORY_LABELS.map((_, index) => parts[Math.min(parts.length - 1, Math.floor(index / STORY_LABELS.length * parts.length))] ?? "");
}

function storyBeats(assets: ProjectIntelligenceAsset[], dialogue: ProjectDialogueMoment[], brief: string): ProjectStoryBeat[] {
  const parts = briefParts(brief);
  const used = new Set<string>();
  return STORY_LABELS.map((label, index) => {
    const briefText = parts[index];
    const candidates = dialogue.map((moment) => {
      const semantic = briefText ? transcriptSimilarity(briefText, moment.text) : 0;
      const intent = STORY_INTENTS[index].includes(moment.intent) ? 1 : 0;
      return { moment, score: moment.score * .52 + semantic * .31 + intent * .17 - (used.has(moment.id) ? .45 : 0) };
    }).sort((a, b) => b.score - a.score || a.moment.start - b.moment.start);
    const chosen = candidates.filter((candidate) => candidate.score >= .32).slice(0, index === 2 ? 3 : 2).map((candidate) => candidate.moment);
    chosen.forEach((moment) => used.add(moment.id));
    const fallbackAssets = [...assets].filter((asset) => asset.kind === "video").sort((a, b) => quality(b) - quality(a)).slice(index, index + 2).map((asset) => asset.id);
    const assetIds = [...new Set(chosen.map((moment) => moment.assetId).concat(fallbackAssets))].slice(0, 3);
    const semanticCoverage = briefText && chosen.length ? Math.max(...chosen.map((moment) => transcriptSimilarity(briefText, moment.text))) : chosen.length ? .55 : 0;
    return { id: `project-story-${index + 1}`, label, briefText, assetIds, dialogueMomentIds: chosen.map((moment) => moment.id), coverage: clamp(semanticCoverage * .7 + Math.min(1, chosen.length / 2) * .3) };
  });
}

function assemblies(assets: ProjectIntelligenceAsset[], takes: ProjectTakeGroup[], dialogue: ProjectDialogueMoment[], story: ProjectStoryBeat[]): ProjectAssembly[] {
  const dropped = new Set(takes.flatMap((group) => group.assetIds.filter((id) => id !== group.bestAssetId)));
  const clean = assets.filter((asset) => asset.kind === "video" && !dropped.has(asset.id)).sort((a, b) => quality(b) - quality(a));
  const storyAssets = [...new Set(story.flatMap((beat) => beat.assetIds))];
  const dialogueAssets = [...new Set(dialogue.filter((moment) => moment.score >= .58).map((moment) => moment.assetId))];
  const coverageAssets = [...assets].filter((asset) => asset.kind === "video" && (asset.visual?.subject.presence ?? 0) < .35).sort((a, b) => quality(b) - quality(a)).map((asset) => asset.id);
  const trailerAssets = [...assets].filter((asset) => asset.kind === "video").sort((a, b) => (quality(b) + (b.visual?.motion ?? 0) * .35) - (quality(a) + (a.visual?.motion ?? 0) * .35)).map((asset) => asset.id);
  const duration = (ids: string[], cap: number) => ids.reduce((sum, id) => sum + Math.min(cap, finiteDuration(assets.find((asset) => asset.id === id)!)), 0);
  const defs: Array<[ProjectAssemblyKind, string, string, string[], number]> = [
    ["story", "Script-guided story", "Hook-to-payoff structure using the strongest matching dialogue and visual coverage.", storyAssets, 8],
    ["dialogue", "Dialogue radio cut", "Highest-confidence spoken moments, stripped to a clean editorial spine.", dialogueAssets, 10],
    ["coverage", "B-roll coverage reel", "Non-dialogue and wider coverage for hiding trims, jump cuts and narration edits.", coverageAssets, 5],
    ["trailer", "Project trailer", "The strongest and most active material shaped into a compact escalation.", trailerAssets.slice(0, 16), 3.5],
    ["selects", "Project selects", "Best technical takes with likely duplicates removed but never deleted.", clean.slice(0, 30).map((asset) => asset.id), 12],
  ];
  return defs.map(([kind, label, summary, assetIds, cap]) => ({ kind, label, summary, assetIds, estimatedDuration: duration(assetIds, cap) }));
}

export function analyzeProjectIntelligence(assets: ProjectIntelligenceAsset[], brief = ""): ProjectIntelligence {
  const usable = assets.filter((asset) => asset.id && (asset.kind === "image" || finiteDuration(asset) > 0));
  const subjectCandidates = connectedClusters(usable.filter((asset) => (asset.visual?.subject.presence ?? 0) >= .3), subjectSimilarity, .72, "subject", "Subject candidate");
  const objectCandidates = connectedClusters(usable.filter((asset) => (asset.visual?.subject.presence ?? 0) < .3), locationSimilarity, .84, "object", "Object / insert candidate");
  const locationCandidates = connectedClusters(usable, locationSimilarity, .76, "location", "Visual setup");
  const takes = takeGroups(usable);
  const dialogue = dialogueMoments(usable, subjectCandidates);
  const story = storyBeats(usable, dialogue, brief.trim());
  const transcriptAssets = usable.filter((asset) => (asset.transcript ?? []).some((chunk) => chunk.text.trim()));
  const transcriptSeconds = transcriptAssets.reduce((sum, asset) => sum + (asset.transcript ?? []).reduce((total, chunk) => total + Math.max(0, chunk.end - chunk.start), 0), 0);
  const warnings: string[] = [];
  if (!transcriptAssets.length) warnings.push("Transcribe the library to unlock dialogue intent, script matching and stronger retake detection.");
  if (!usable.some((asset) => (asset.visual?.subject.frames ?? 0) > 0)) warnings.push("No semantic subject samples were available; recurring-subject candidates are deferred.");
  if (!brief.trim()) warnings.push("Add a creative brief or script to score story coverage against your intent.");
  return {
    schema: "scenepilot-project-intelligence/v1", brief: brief.trim(), assetsAnalyzed: usable.length,
    transcriptAssets: transcriptAssets.length, transcriptMinutes: transcriptSeconds / 60, subjectCandidates, objectCandidates, locationCandidates,
    takeGroups: takes, dialogueMoments: dialogue, storyBeats: story, assemblies: assemblies(usable, takes, dialogue, story), warnings,
  };
}

export function buildProjectAssembly(report: ProjectIntelligence, assets: ProjectIntelligenceAsset[], kind: ProjectAssemblyKind, options: {preserveDialogue?:boolean;maxShot?:number} = {}): ProjectAssemblyCut[] {
  const assembly = report.assemblies.find((candidate) => candidate.kind === kind);
  if (!assembly) return [];
  const momentById = new Map(report.dialogueMoments.map((moment) => [moment.id, moment]));
  const dialogueByAsset = new Map<string, ProjectDialogueMoment[]>();
  report.dialogueMoments.forEach((moment) => dialogueByAsset.set(moment.assetId, [...(dialogueByAsset.get(moment.assetId) ?? []), moment]));
  const orderedStoryMoments = kind === "story" ? report.storyBeats.flatMap((beat) => beat.dialogueMomentIds.map((id) => momentById.get(id)).filter((moment): moment is ProjectDialogueMoment => Boolean(moment))) : [];
  const entries = orderedStoryMoments.length
    ? orderedStoryMoments.map((moment) => ({ assetId: moment.assetId, sourceStart: moment.start, duration: options.preserveDialogue ? moment.end-moment.start : Math.min(options.maxShot ?? 10, moment.end - moment.start), preservePhrase:true }))
    : [...assembly.assetIds].sort((a,b)=>(assets.find(s=>s.id===b)?.priority ?? 1)-(assets.find(s=>s.id===a)?.priority ?? 1)).flatMap((assetId) => {
      const asset = assets.find((candidate) => candidate.id === assetId);
      if (!asset) return [];
      const cap: Record<ProjectAssemblyKind, number> = { story: 8, dialogue: 10, coverage: 5, trailer: 3.5, selects: 12 };
      const dialogueMoment = (kind === "dialogue" ? dialogueByAsset.get(assetId)?.sort((a, b) => b.score - a.score)[0] : undefined);
      const duration=dialogueMoment && options.preserveDialogue ? dialogueMoment.end-dialogueMoment.start : Math.min(options.maxShot ?? cap[kind],dialogueMoment ? dialogueMoment.end-dialogueMoment.start : finiteDuration(asset));
      return [{assetId,sourceStart:dialogueMoment?.start ?? Math.max(0,Math.min(finiteDuration(asset)-duration,(asset.peakTime ?? duration*.35)-duration*.35)),duration,preservePhrase:Boolean(dialogueMoment)}];
    });
  let timeline = 0;
  return entries.flatMap((entry, index) => {
    const duration = Math.max(0, entry.duration);
    if (duration < .12) return [];
    const cut: ProjectAssemblyCut = { id: `project-auto-${kind}-${index + 1}-${entry.assetId}`, assetId: entry.assetId, sectionId: `project-${kind}`, start: timeline, sourceStart: Math.max(0, entry.sourceStart), duration, linked: true, preservePhrase:entry.preservePhrase };
    timeline += duration;
    return [cut];
  });
}

export type ProjectIntelligenceBenchmarkCase = {
  id: string;
  assets: ProjectIntelligenceAsset[];
  brief?: string;
  expected: {
    takePairs?: Array<[string, string]>;
    locationPairs?: Array<[string, string]>;
    subjectPairs?: Array<[string, string]>;
    storyAssets?: string[];
  };
};

const pairs = (clusters: ProjectCluster[]) => new Set(clusters.flatMap((cluster) => cluster.assetIds.flatMap((left, index) => cluster.assetIds.slice(index + 1).map((right) => [left, right].sort().join("|")))));
function pairScore(predicted: Set<string>, expected: Array<[string, string]> = []) {
  const truth = new Set(expected.map((pair) => [...pair].sort().join("|")));
  if (!truth.size && !predicted.size) return { precision: 1, recall: 1, f1: 1 };
  const truePositive = [...predicted].filter((pair) => truth.has(pair)).length;
  const precision = truePositive / Math.max(1, predicted.size), recall = truePositive / Math.max(1, truth.size);
  return { precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : truth.size || predicted.size ? 0 : 1 };
}

export function evaluateProjectIntelligence(cases: ProjectIntelligenceBenchmarkCase[]) {
  const results = cases.map((fixture) => {
    const report = analyzeProjectIntelligence(fixture.assets, fixture.brief);
    const takes = pairScore(pairs(report.takeGroups), fixture.expected.takePairs);
    const locations = pairScore(pairs(report.locationCandidates), fixture.expected.locationPairs);
    const subjects = pairScore(pairs(report.subjectCandidates), fixture.expected.subjectPairs);
    const predictedStory = new Set(report.storyBeats.flatMap((beat) => beat.assetIds));
    const expectedStory = new Set(fixture.expected.storyAssets ?? []);
    const storyRecall = [...expectedStory].filter((id) => predictedStory.has(id)).length / Math.max(1, expectedStory.size);
    return { id: fixture.id, takes, locations, subjects, storyRecall };
  });
  const score = mean(results.flatMap((result) => [result.takes.f1, result.locations.f1, result.subjects.f1, result.storyRecall]));
  return { schema: "scenepilot-project-intelligence-eval/v1" as const, cases: results.length, score, passed: results.length > 0 && score >= .72, results };
}
