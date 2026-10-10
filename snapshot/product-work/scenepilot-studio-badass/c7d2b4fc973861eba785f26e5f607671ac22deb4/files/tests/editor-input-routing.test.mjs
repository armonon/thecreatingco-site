import test from "node:test";
import assert from "node:assert/strict";
import { commandForKey, NATIVE_COMMAND_ALIASES } from "../app/editor-input-routing.ts";
import { createEditorEditActions } from "../app/use-editor-edit-actions.ts";
import { recoverRenderQueue } from "../app/use-render-queue.ts";
import { isPendingRender, renderShowsProgress, renderStageLabel } from "../lib/render-job-state.ts";

test("keyboard editing and transport resolve stable command ids, without modifier collisions", () => {
  for (const [key,id] of Object.entries({ c:"copy",x:"cut",v:"paste",d:"duplicate",z:"undo",k:"split",a:"select-all" })) {
    assert.equal(commandForKey({key,metaKey:true}),id); assert.equal(commandForKey({key,ctrlKey:true}),id);
  }
  for (const [key,id] of Object.entries({j:"shuttle-reverse",k:"stop",l:"shuttle-forward",i:"mark-in",o:"mark-out",ArrowLeft:"step-back",ArrowRight:"step-forward"})) assert.equal(commandForKey({key}),id);
  assert.equal(commandForKey({key:"Backspace",shiftKey:true}),"ripple-delete");
  assert.equal(commandForKey({key:"v",altKey:true}),undefined);
  assert.equal(commandForKey({key:"z",metaKey:true,shiftKey:true}),"redo");
  assert.equal(NATIVE_COMMAND_ALIASES.save, commandForKey({key:"s",metaKey:true}));
});

function fixture(patch={}) {
  const state={base:[],placements:[],audio:[],checkpoints:0,deleted:0,status:[]};
  const c={activePanel:"base",workspaceView:"sequence",baseCuts:[],selectedBaseCutIds:[],audioClips:[],audioTracks:[],clipTracks:[],currentTime:5,compositionTime:1,duration:30,exportFrameRate:30,linkedSelection:true,busy:false,
    checkpoint:()=>state.checkpoints++,setStatus:v=>state.status.push(v),setBaseCuts:f=>state.base=f(state.base),setPlacements:f=>state.placements=f(state.placements),setAudioClips:f=>state.audio=f(state.audio),
    setSelectedBaseCutIds(){},setSelectedBaseCutId(){},setSelectedPlacementId(){},setSelectedAudioClipId(){},setActivePanel(){},deleteTimelineSelection:()=>state.deleted++,
    ...patch};
  state.base=c.baseCuts; state.audio=c.audioClips;
  return {c,state,clipboard:{current:null}};
}
test("shared clipboard copies multiple cuts and remaps linked audio in one undo step",()=>{
  const a={id:"a",assetId:"video",start:1,duration:1,sourceStart:0},b={...a,id:"b",start:3};
  const f=fixture({baseCuts:[a,b],selectedBaseCutIds:["a","b"],audioClips:[{id:"audio",linkedVideoId:"a",trackId:"a1",start:1,duration:1}],audioTracks:[{id:"a1",locked:false}]});
  const {actions}=createEditorEditActions(f.c,f.clipboard); actions.copy(); a.sourceStart=99; actions.paste();
  const pasted=f.state.base.filter(c=>!["a","b"].includes(c.id));
  assert.deepEqual(pasted.map(c=>c.start),[5,7]); assert.equal(pasted[0].sourceStart,0);
  assert.equal(f.state.audio.at(-1).linkedVideoId,pasted[0].id);assert.equal(f.state.checkpoints,1);
});
test("locked cuts cannot cut, duplicate, delete or be overwritten by paste",()=>{
  const cut={id:"a",start:5,duration:2,sourceStart:0,locked:true}; const f=fixture({baseCuts:[cut],selectedBaseCutId:"a"});
  const {actions}=createEditorEditActions(f.c,f.clipboard);actions.cut();actions.duplicate();actions.delete();actions.copy();actions.paste();
  assert.equal(f.state.checkpoints,0);assert.equal(f.state.deleted,0);assert.equal(f.state.base.length,1);
});
test("audio clipboard never pastes stale video and composition mismatch does not mutate sequence",()=>{
  const audio={id:"a",trackId:"audio",start:0,duration:1};const f=fixture({activePanel:"audio",audioTracks:[{id:"audio",locked:false}],audioClips:[audio],selectedAudioClipId:"a"});
  const {actions}=createEditorEditActions(f.c,f.clipboard); actions.copy();actions.paste();assert.equal(f.state.audio.at(-1).start,5);assert.equal(f.state.base.length,0);
  f.clipboard.current={kind:"layer",layer:{}}; actions.paste();assert.equal(f.state.checkpoints,1);assert.match(f.state.status.at(-1),/same document type/);
});
test("composition clipboard clones keyframes and refuses recursive nests", () => {
  const layer = { id: "layer", name: "Subject", trackId: "video", start: 0, duration: 2, keyframes: [{ id: "key", time: 0 }] };
  const composition = { id: "comp", tracks: [{ id: "video", kind: "video", locked: false }], layers: [layer] };
  let patch;
  const f = fixture({ workspaceView: "composition", activeComposition: composition, compositions: [composition], selectedCompLayer: layer, selectedCompTrackId: "video", updateComposition: value => { patch = value; }, setSelectedCompLayerId() {} });
  const { actions } = createEditorEditActions(f.c, f.clipboard);
  actions.duplicate();
  const copy = patch.layers.at(-1);
  assert.equal(copy.name, "Subject COPY"); assert.notEqual(copy.id, layer.id); assert.notEqual(copy.keyframes[0].id, layer.keyframes[0].id);
  assert.equal(f.clipboard.current, null, "duplicate must preserve the user's prior clipboard");
  patch = undefined;
  f.clipboard.current = { kind: "layer", layer: { ...layer, compositionId: "comp" }, compositionId: "elsewhere", trackKind: "video" };
  actions.paste();
  assert.equal(patch, undefined); assert.match(f.state.status.at(-1), /circular composition/);
});
test("clipboard allows an append beyond the former sequence boundary in one checkpoint", () => {
  const cut = { id: "a", assetId: "video", start: 0, duration: 6, sourceStart: 0 };
  const f = fixture({ baseCuts: [cut], selectedBaseCutId: "a", duration: 6 });
  const { actions } = createEditorEditActions(f.c, f.clipboard);
  actions.duplicate();
  assert.equal(f.state.checkpoints, 1); assert.equal(f.state.base.length, 2);
  assert.equal(f.state.base.at(-1).start, 6);
  assert.equal(f.state.base.at(-1).duration, 6);
});
test("all interrupted export stages recover as retryable failures and preparation never claims percent",()=>{
  for(const status of ["queued","preparing","awaiting-destination","rendering","finalizing"]){assert.equal(isPendingRender(status),true);assert.equal(recoverRenderQueue([{id:status,status}])[0].status,"failed");}
  for(const status of ["queued","preparing","awaiting-destination"])assert.equal(renderShowsProgress(status),false);
  assert.equal(renderStageLabel("awaiting-destination"),"CHOOSE DESTINATION");
  assert.equal(isPendingRender("completed"),false);
});

test("shared audio split command is atomic, frame-snapped and blocked by track locks", () => {
  const audio = { id: "sound", trackId: "a1", start: 0, duration: 10, sourceStart: 0, fadeIn: 8, fadeOut: 0, automation: [] };
  const f = fixture({ activePanel: "audio", selectedAudioClipId: audio.id, audioClips: [audio], audioTracks: [{ id: "a1", locked: false }], currentTime: 3.01 });
  createEditorEditActions(f.c, f.clipboard).actions.split();
  assert.equal(f.state.checkpoints, 1);
  assert.deepEqual(f.state.audio.map(c => [c.start, c.duration]), [[0, 3], [3, 7]]);
  assert.equal(f.state.audio[1].envelopes[0].origin, "clip-in");
  for (const patch of [{ audioTracks: [{ id: "a1", locked: true }] }, { currentTime: 0 }, { busy: true }]) {
    const blocked = fixture({ activePanel: "audio", selectedAudioClipId: audio.id, audioClips: [audio], audioTracks: [{ id: "a1", locked: false }], currentTime: 3, ...patch });
    createEditorEditActions(blocked.c, blocked.clipboard).actions.split();
    assert.equal(blocked.state.checkpoints, 0);
  }
});
