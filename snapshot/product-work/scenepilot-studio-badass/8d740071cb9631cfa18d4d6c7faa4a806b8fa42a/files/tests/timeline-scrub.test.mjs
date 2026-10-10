/* eslint-disable react-hooks/rules-of-hooks -- Isolated hook lifecycle harness. */
import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { timelineScrubTime } from "../lib/timeline-scrub.ts";

test("scrubbing maps the actual scrolled/zoomed ruler and clamps after frame snapping", () => {
  assert.equal(timelineScrubTime(668, 168, 1000, 30, 30), 15);
  assert.equal(timelineScrubTime(100, -400, 2000, 30, 30), 7.5);
  assert.equal(timelineScrubTime(-200, 168, 1000, 30, 30), 0);
  assert.equal(timelineScrubTime(2000, 168, 1000, 30.017, 30), 30.017);
  assert.equal(timelineScrubTime(333, 0, 1000, 10, 24), 80 / 24);
  for (const width of [0, -1, NaN, Infinity]) assert.equal(timelineScrubTime(0, 0, width, 30, 30), null);
  assert.equal(timelineScrubTime(0, 0, 100, 30, 0), null);
});

const compiled = await build({ entryPoints:[new URL("../app/use-timeline-scrub.ts", import.meta.url).pathname], bundle:true, platform:"node", format:"esm", write:false, logLevel:"silent",
  plugins:[{name:"scrub-lifecycle",setup(builder){
    builder.onResolve({filter:/^react$/},()=>({path:"react",namespace:"harness"}));
    builder.onLoad({filter:/.*/,namespace:"harness"},()=>({contents:"export const useRef = value => ({ current:value }); export const useEffect = effect => globalThis.__scrubEffects.push(effect);"}));
  }}],
});
const { useTimelineScrub } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);

function harness(run) {
  const original = { request:globalThis.requestAnimationFrame, cancel:globalThis.cancelAnimationFrame };
  let id = 0, started = 0;
  const frames = new Map(), seeks = [], captures = new Set(), cleanups = [];
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  globalThis.__scrubEffects = [];
  const target = { setPointerCapture:key=>captures.add(key), hasPointerCapture:key=>captures.has(key), releasePointerCapture:key=>captures.delete(key) };
  const event = (x, extra = {}) => ({clientX:x,pointerId:1,button:0,isPrimary:true,currentTarget:target,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra});
  const scrub = useTimelineScrub({duration:10,frameRate:30,bounds:()=>({left:100,width:1000}),onSeek:time=>seeks.push(time),onStart:()=>started++});
  for(const effect of globalThis.__scrubEffects) { const cleanup=effect(); if(cleanup) cleanups.push(cleanup); }
  try { run({scrub,event,seeks,frames,captures,started:()=>started,cleanup:()=>cleanups.forEach(fn=>fn()),tick:()=>{ const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn()); }}); }
  finally { cleanups.forEach(fn=>fn());globalThis.requestAnimationFrame=original.request;globalThis.cancelAnimationFrame=original.cancel;delete globalThis.__scrubEffects; }
}

test("playhead drag pauses once, captures input and coalesces moves without dropping release", () => harness(({scrub,event,seeks,frames,captures,started,tick})=>{
  const down=event(100);scrub.onPointerDown(down);
  assert.equal(down.prevented,true);assert.equal(down.stopped,true);assert.equal(started(),1);assert.ok(captures.has(1));
  scrub.onPointerMove(event(200));scrub.onPointerMove(event(400));
  assert.equal(frames.size,1);assert.deepEqual(seeks,[0]);tick();assert.deepEqual(seeks,[0,3]);
  scrub.onPointerMove(event(500));scrub.onPointerUp(event(600));
  assert.equal(frames.size,0);assert.equal(captures.size,0);assert.deepEqual(seeks,[0,3,5]);
  scrub.onLostPointerCapture(event(0));scrub.onPointerMove(event(900));assert.deepEqual(seeks,[0,3,5]);
}));

test("secondary buttons and unrelated pointers cannot move or end the drag", () => harness(({scrub,event,seeks,captures,started})=>{
  scrub.onPointerDown(event(400,{button:2}));scrub.onPointerDown(event(400,{isPrimary:false}));
  assert.equal(started(),0);assert.deepEqual(seeks,[]);
  scrub.onPointerDown(event(300));scrub.onPointerMove(event(800,{pointerId:2}));scrub.onPointerUp(event(800,{pointerId:2}));
  assert.deepEqual(seeks,[2]);assert.ok(captures.has(1));
}));

test("cancellation flushes the last real position, not the cancellation coordinate", () => harness(({scrub,event,seeks,frames})=>{
  scrub.onPointerDown(event(300));scrub.onPointerMove(event(500));scrub.onPointerCancel(event(0));
  assert.deepEqual(seeks,[2,4]);assert.equal(frames.size,0);
}));

test("capture loss ends scrubbing and unmount cancels pending previews", () => harness(({scrub,event,seeks,frames,captures,cleanup})=>{
  scrub.onPointerDown(event(300));scrub.onPointerMove(event(700));scrub.onLostPointerCapture(event(0));
  assert.deepEqual(seeks,[2,6]);assert.equal(captures.size,0);
  scrub.onPointerDown(event(400));scrub.onPointerMove(event(800));cleanup();
  assert.equal(frames.size,0);assert.equal(captures.size,0);assert.deepEqual(seeks,[2,6,3]);
}));
