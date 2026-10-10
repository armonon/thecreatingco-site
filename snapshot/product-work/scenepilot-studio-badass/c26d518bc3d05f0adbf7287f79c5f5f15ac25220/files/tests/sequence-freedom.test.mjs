import test from "node:test";
import assert from "node:assert/strict";
import { advanceSequenceClock } from "../lib/sequence-clock.ts";
import { sequenceTimelineReducer as reduce } from "../app/use-sequence-timeline.ts";

test("sequence edits grow duration atomically, preserve lanes and restore with undo", () => {
  const clip = {id:"a",assetId:"video",trackId:"__base__",start:0,duration:6,sourceStart:0};
  const before = {duration:6,videoClips:[clip],audioClips:[]};
  let state = reduce(before,{kind:"base",value:items=>[...items,{...clip,id:"b",start:6}]});
  assert.equal(state.duration,12); assert.equal(state.videoClips.length,2);
  state = reduce(state,{kind:"audio",value:[{id:"audio",start:11,duration:4}]});
  assert.equal(state.duration,15);
  state = reduce(state,{kind:"base",value:[]});
  assert.equal(state.duration,15,"deletion must not shorten the document unexpectedly");
  state = reduce(state,{kind:"duration",value:before.duration});
  state = reduce(state,{kind:"video",value:before.videoClips});
  state = reduce(state,{kind:"audio",value:before.audioClips});
  assert.deepEqual(state,before);
});
test("document clock crosses source end, stops at sequence end and loops with overshoot",()=>{
  assert.deepEqual(advanceSequenceClock(5.9,.2,1,0,12,false),{time:6.1000000000000005,stopped:false});
  assert.deepEqual(advanceSequenceClock(11.9,.2,1,0,12,false),{time:12,stopped:true});
  assert.deepEqual(advanceSequenceClock(11,2,1,2,12,true),{time:3,stopped:false});
  assert.deepEqual(advanceSequenceClock(3,2,-1,2,12,true),{time:11,stopped:false});
  assert.deepEqual(advanceSequenceClock(3,2,-1,2,12,false),{time:2,stopped:true});
  assert.deepEqual(advanceSequenceClock(0,1,1,0,0,true),{time:0,stopped:true});
});
