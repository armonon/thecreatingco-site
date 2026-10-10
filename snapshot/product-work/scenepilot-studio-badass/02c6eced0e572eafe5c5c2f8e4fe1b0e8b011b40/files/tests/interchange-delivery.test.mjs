import test from "node:test";
import assert from "node:assert/strict";
import {prepareInterchange} from "../lib/interchange-delivery.ts";
import {exportOtioProject,importOtio} from "../lib/interchange.ts";
const clip={id:"a",assetId:"asset",trackId:"__base__",sectionId:"manual",start:0,duration:1,sourceStart:0};
const project={project:"Handoff",frameRate:30,assets:[{id:"asset",name:"A #1.mov",sourcePath:"/Media/A #1.mov"}],videoTracks:[{id:"__base__",name:"V1"}],videoClips:[clip]};

test("handoff discloses unbaked features and omitted lanes, and refuses lossy retiming",()=>{
  const richer={...project,audioClips:[{id:"audio"}],videoClips:[clip,{...clip,id:"b",trackId:"v2",overlay:{opacity:100,scale:100}}]};
  const result=prepareInterchange("fcpxml",richer);
  assert.match(result.warnings.join(" "),/overlay\/composition clips will be omitted/);
  assert.match(result.warnings.join(" "),/WAV stems/);
  assert.match(result.warnings.join(" "),/not baked/);
  assert.match(result.text,/file:\/\/\/Media\/A%20%231.mov/);
  assert.throws(()=>prepareInterchange("fcpxml",{...project,videoClips:[{...clip,playbackRate:2}]}),/retiming/);
  assert.throws(()=>prepareInterchange("edl",{...project,videoClips:[{...clip,reversed:true}]}),/retiming/);
  assert.match(prepareInterchange("otio",project).warnings.join(" "),/not Adobe/);
});
test("standard OTIO retains single-frame gaps without proprietary metadata",()=>{
  const raw=JSON.parse(exportOtioProject({...project,videoClips:[clip,{...clip,id:"b",start:31/30}]}));
  const children=raw.tracks.children[0].children;
  assert.equal(children[1].OTIO_SCHEMA,"Gap.1");assert.equal(children[1].source_range.duration.value,1);
  for(const item of children) item.metadata={};
  const imported=importOtio(JSON.stringify(raw));
  assert.equal(imported.videoClips[1].start,31/30);
  assert.equal(imported.assets[0].sourcePath,"/Media/A #1.mov");
});
test("one-frame overlap exports separate serial tracks instead of changing clip timing",()=>{
  const raw=JSON.parse(exportOtioProject({...project,videoClips:[clip,{...clip,id:"b",start:29/30}]}));
  assert.equal(raw.tracks.children.length,2);
  for(const track of raw.tracks.children)for(const item of track.children)item.metadata={};
  const imported=importOtio(JSON.stringify(raw));
  assert.equal(imported.videoClips[1].start,29/30);
});
test("foreign unsupported nested items and effects fail before timeline mutation",()=>{
  const raw=JSON.parse(exportOtioProject(project));
  raw.tracks.children[0].children[0].effects=[{OTIO_SCHEMA:"FreezeFrame.1"}];
  assert.throws(()=>importOtio(JSON.stringify(raw)),/Unsupported OTIO effect/);
  raw.tracks.children[0].children[0]={OTIO_SCHEMA:"Stack.1"};
  assert.throws(()=>importOtio(JSON.stringify(raw)),/Flatten nested/);
  assert.throws(()=>importOtio("null"),/Timeline.1/);
});
