import test from "node:test";
import assert from "node:assert/strict";
import {prepareAutoDraft} from "../app/prepare-auto-draft.ts";
import {DEFAULT_AUTO_POLICY} from "../lib/auto-edit-policy.ts";
import {prepareStoryDraft} from "../app/prepare-story-draft.ts";
const cut=(id,start=0,duration=2)=>({id,assetId:id,sectionId:"s",start,sourceStart:0,duration});
const snapshot=()=>({autoPolicy:{...DEFAULT_AUTO_POLICY},baseCuts:[],sections:[],audioClips:[],audioTracks:[],titles:[],transcriptWords:[],placements:[],clipTracks:[],autoVersions:[{id:"older"}],lookPreset:"neutral",duration:10});
const prepare=(state,candidates,patch={})=>prepareAutoDraft({snapshot:state,name:"Test",candidates,patch,mode:"scenes",expectedTimeline:"original",visualAssets:[]});
test("draft is immutable, nonrecursive, serializable and limited to edited fields",()=>{
 const state=snapshot(), before=structuredClone(state);
 const draft=prepare(state,[cut("new")]);
 assert.deepEqual(state,before);
 assert.equal(draft.snapshot.autoVersions,undefined);
 assert.deepEqual(structuredClone(draft),draft);
 assert.equal(draft.fields.includes("lookPreset"),false);
 assert.equal(draft.snapshot.videoClips[0].id,"new");
 assert.equal(draft.snapshot.videoClips[0].trackId,"__base__");
 assert.equal(draft.expectedTimeline,"original");
});
test("locked sections protect geometry without permanently locking individual clips",()=>{
 const state=snapshot(); state.baseCuts=[cut("old")];state.sections=[{id:"s",start:0,end:2,locked:true}];
 const draft=prepare(state,[cut("new",0,4)]);
 const old=draft.snapshot.baseCuts.find(c=>c.id==="old");
 assert.equal(old.duration,2);assert.equal(old.locked,undefined);
});
test("source audio and captions move together after source exclusion",()=>{
 const state=snapshot();state.autoPolicy.sources=[{assetId:"a",exclude:true,priority:1,inPoint:0}];
 const candidates=[cut("a"),cut("b",2)];
 const draft=prepare(state,candidates,{audioClips:candidates.map(c=>({id:`audio-${c.id}`,assetId:c.assetId,linkedVideoId:c.id,trackId:"A1",start:c.start,sourceStart:0,duration:2,gain:1,pan:0,fadeIn:0,fadeOut:0,muted:false})),titles:[{id:"caption-b",text:"Hello",start:2.2,duration:.5}],transcriptWords:[{id:"word",text:"Hello",start:2.2,end:2.7}]});
 assert.equal(draft.snapshot.audioClips.length,1);assert.equal(draft.snapshot.audioClips[0].start,0);
 assert.ok(Math.abs(draft.snapshot.titles[0].start-.2)<1e-6);
 assert.ok(Math.abs(draft.snapshot.transcriptWords[0].start-.2)<1e-6);
});
test("impossible constraints fail without producing a partial draft",()=>{
 const state=snapshot();state.autoPolicy.minShot=5;state.autoPolicy.maxShot=6;
 assert.throws(()=>prepare(state,[cut("a")]),/No cuts/);
 assert.equal(state.baseCuts.length,0);
});
test("region rebuild preserves captions and dialogue after a split exterior clip",()=>{
 const state=snapshot();state.baseCuts=[cut("old",0,10)];state.autoPolicy.range={start:3,end:7};
 state.titles=[{id:"caption-outside",start:8,duration:1,text:"Keep me"}];state.transcriptWords=[{id:"outside",start:8,end:9,text:"Keep"}];
 const draft=prepare(state,[cut("new",0,3)],{titles:[],transcriptWords:[]});
 assert.equal(draft.snapshot.titles[0].start,8);assert.equal(draft.snapshot.transcriptWords[0].start,8);
});
test("source exclusions also apply to generated overlays, while locked tracks survive",()=>{
 const state=snapshot();state.autoPolicy.sources=[{assetId:"excluded",exclude:true,inPoint:0,priority:1}];state.clipTracks=[{id:"protected",locked:true}];
 const overlay={id:"hit",assetId:"excluded",start:0,duration:1,scale:100,opacity:100,trackId:"normal"};
 state.placements=[{...overlay,id:"protected-hit",trackId:"protected"}];
 const draft=prepare(state,[cut("a")],{placements:[overlay]});
 assert.deepEqual(draft.snapshot.placements,state.placements);
});
test("explicit style strobe stays draft-local without mutating caller configuration",()=>{
 const patch={strobePreset:"off"}, before={...patch};
 const draft=prepare(snapshot(),[cut("a")],patch);
 assert.deepEqual(patch,before);assert.equal(draft.snapshot.strobePreset,"off");
 assert.ok(draft.fields.includes("strobeIntensity"));
});
test("hybrid story preparation keeps phrases whole and retimes audio and words to entrances",()=>{
 const words=[{text:"Hello",start:1,end:1.5},{text:"there",start:1.5,end:2}];
 const take={id:"take",name:"Take",duration:4,speech:[{start:1,end:2}],transcript:"Hello there"};
 const result=prepareStoryDraft({transcribed:[take],takes:[take],chunksByTake:new Map([["take",words]]),wordsByTake:new Map([["take",words]]),hybridBeats:[.5,1,1.5,2],audioTrackId:"A1"});
 assert.equal(result.cuts[0].start,.5);assert.equal(result.cuts[0].duration,1);
 assert.equal(result.dialogue[0].sourceStart,1);assert.equal(result.dialogue[0].start,.5);
 assert.equal(result.timelineWords[0].start,.5);assert.equal(result.timelineWords.at(-1).end,1.5);
});
test("replaced overlays do not leave orphan linked audio",()=>{
 const state=snapshot();state.placements=[{id:"overlay",assetId:"b",start:0,duration:1,scale:100,opacity:100}];
 state.audioClips=[{id:"audio",assetId:"b",linkedVideoId:"overlay",trackId:"A1",start:0,sourceStart:0,duration:1,gain:1,pan:0,fadeIn:0,fadeOut:0,muted:false}];
 assert.equal(prepare(state,[cut("new")],{placements:[]}).snapshot.audioClips.length,0);
 assert.equal(prepare(state,[cut("new")]).snapshot.audioClips.length,1);
});
