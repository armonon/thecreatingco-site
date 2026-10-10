import test from "node:test";
import assert from "node:assert/strict";
import {measureAudioDelay} from "../lib/audio-delay.ts";
const ref=Float32Array.from({length:128},(_,i)=>Math.sin(i*i*1.123));
test("audio delay is measured rather than assumed, including already-correct timestamps",()=>{
  for(const lag of [0,21,77,-12]) {
    const samples=new Float32Array(500);samples.set(ref,100+lag);
    assert.equal(measureAudioDelay(ref,samples,100,100).delay,lag);
  }
});
test("an uncorrelated or silent timing probe fails closed",()=>{
  assert.throws(()=>measureAudioDelay(new Float32Array(128),new Float32Array(500),100,100),/silent/);
  assert.throws(()=>measureAudioDelay(ref,new Float32Array(500),100,100),/inconclusive/);
});
