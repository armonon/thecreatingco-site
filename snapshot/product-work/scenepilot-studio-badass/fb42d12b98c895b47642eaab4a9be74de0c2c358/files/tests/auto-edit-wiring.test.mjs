import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("Auto Cut launch respects explicit controls and story reruns stage audio",async()=>{
  const source=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  const launch=source.split("const runAutoCut = async")[1].split("const applyCinematicAssembly")[0];
  assert.doesNotMatch(launch,/setAspect\(|setMontagePace\(|setAutoEnergy\(/);
  assert.match(launch,/validateAutoPolicy/);
  const analysis=source.split("const runAnalysis = async")[1].split("const runStoryRoughCut")[0];
  assert.match(analysis,/selection:"all-scenes"/);
  assert.match(analysis,/stageAutoEdit\("Scene first cut"/);
  const story=source.split("const runStoryRoughCut = async")[1].split("const runAutoCut")[0];
  assert.match(story,/await stageAutoEdit/);assert.doesNotMatch(story,/setBaseCuts\(|setAudioClips\(/);
  assert.match(story,/controller.signal/);assert.match(story,/No footage was silently classified as B-roll/);
  const commands=source.split("const runEditCommand =")[1].split("const matchShotColors")[0];
  assert.match(commands,/changeMontagePace\(step/);
});
test("draft versions are persisted without recursively capturing version history",async()=>{
  const source=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  const planner=await readFile(new URL("../app/prepare-auto-draft.ts",import.meta.url),"utf8");
  assert.match(planner,/autoVersions: _versions/);assert.match(source,/version.expectedTimeline!==autoTimelineKey/);
  assert.match(source,/setAutoVersions\(restoredProState.autoVersions/);
  const doc=await readFile(new URL("../app/project-document.ts",import.meta.url),"utf8");
  assert.match(doc,/autoVersions: s.autoVersions/);
});
