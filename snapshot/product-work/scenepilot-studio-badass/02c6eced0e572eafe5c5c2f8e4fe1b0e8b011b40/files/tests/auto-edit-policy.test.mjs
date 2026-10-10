import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AUTO_POLICY as defaults,resolveAutoTiming,bestMoment } from "../lib/auto-edit-policy.ts";
import { refineBoundaryFrames } from "../lib/scene-boundaries.ts";
import { constrainAutoCuts,remapAutoAudio,remapAutoCues } from "../lib/auto-edit-transaction.ts";
import { analyzeCinematicFootage,buildCinematicAssembly } from "../lib/cinematic-analysis.ts";
import { buildBaseSequence } from "../lib/sequencer.ts";
const clip=(id,start=0,duration=2)=>({id,assetId:id,sectionId:"s",start,sourceStart:0,duration});
test("timing recommendations use soundtrack evidence, not the video extension",()=>{
  assert.equal(resolveAutoTiming("auto",false,true,false).mode,"music");
  assert.equal(resolveAutoTiming("auto",false,false,false).mode,"scenes");
  assert.equal(resolveAutoTiming("auto",false,true,true).mode,"hybrid");
  assert.equal(resolveAutoTiming("scenes",false,true,true).mode,"scenes");
});
test("constraints honor excluded sources, keep handles, no-repeat and target",()=>{
  const output=constrainAutoCuts([clip("a"),clip("a",2),clip("b",4)],[],{...defaults,targetDuration:4,noRepeat:true,sources:[{assetId:"b",exclude:true,priority:1,inPoint:0},{assetId:"a",exclude:false,priority:1,inPoint:.5,outPoint:1.5}]});
  assert.equal(output.length,1);assert.equal(output[0].sourceStart,.5);assert.equal(output[0].duration,1);
});
test("music and hybrid do not slide surviving cuts off the beat grid",()=>{
  for(const timing of ["music","hybrid"]) {const output=constrainAutoCuts([clip("a",1),clip("b",4)],[],{...defaults,timing});assert.deepEqual(output.map(c=>c.start),[1,4]);}
});

test("music trims only the final out point instead of discarding a usable final shot",()=>{
  for(const timing of ["music","hybrid"]) {
    const output=constrainAutoCuts([clip("a",0,3.02),clip("b",3.02,4)],[],{...defaults,timing,targetDuration:6});
    assert.deepEqual(output.map(c=>c.start),[0,3.02]);
    assert.equal(output[1].start+output[1].duration,6);
    assert.equal(output[1].sourceStart,clip("b",3.02,4).sourceStart);
    const phrase=constrainAutoCuts([clip("a",0,3.02),{...clip("b",3.02,4),preservePhrase:true}],[],{...defaults,timing,targetDuration:6,preserveDialogue:true});
    assert.equal(phrase.length,1);
  }
});
test("whole phrases are not shortened to fit an arbitrary cap",()=>{
  assert.throws(()=>constrainAutoCuts([{...clip("a",0,8),preservePhrase:true}],[],{...defaults,maxShot:3}),/No cuts/);
});
test("region rebuild preserves exterior handles and locked decisions",()=>{
  const out=constrainAutoCuts([clip("b",0,3)],[clip("a",0,10),{...clip("locked",4,1),locked:true}],{...defaults,range:{start:3,end:7}});
  assert.ok(out.some(c=>c.id==="a"&&c.duration===3));assert.ok(out.some(c=>c.start===7&&c.sourceStart===7&&c.duration===3));assert.ok(out.some(c=>c.id==="locked"&&c.start===4));
});
test("invalid constraints fail before mutation",()=>{
  assert.throws(()=>constrainAutoCuts([clip("a")],[],{...defaults,minShot:4,maxShot:1}));
  assert.throws(()=>constrainAutoCuts([clip("a")],[],{...defaults,range:{start:2,end:1}}));
});
test("moment choice favors an interior action window and protects spoken boundaries",()=>{
  const samples=Array.from({length:10},(_,time)=>({time,motion:time>=5&&time<=7?.9:0,sharpness:.7,brightness:.5}));
  assert.ok(bestMoment(0,10,2,samples).time>3);
  assert.equal(bestMoment(0,10,2,samples,[{start:0,end:10}]),null);
});
const frame=(time,value)=>({time,gray:new Uint8Array(16).fill(value),histogram:Float32Array.from({length:16},(_,i)=>i===Math.floor(value/16)?1:0),brightness:value/255});
test("dense boundaries use actual frame timestamps and reject returning flashes",()=>{
  const cut=refineBoundaryFrames(Array.from({length:12},(_,i)=>frame(i/30,i<6?20:180)));
  assert.equal(cut.filter(c=>c.transition==="cut").length,1);assert.equal(cut[0].time,6/30);
  const flash=refineBoundaryFrames(Array.from({length:12},(_,i)=>frame(i/30,i===6?250:20)));
  assert.equal(flash.filter(c=>c.transition==="cut").length,0);assert.ok(flash.some(c=>c.transition==="flash"));
});
test("silent person-free footage does not offer dialogue or performance fallback",()=>{
  const report=analyzeCinematicFootage(10,[{time:0,brightness:.5,motion:.01,cutScore:0,sharpness:.3},{time:9,brightness:.5,motion:.01,cutScore:0,sharpness:.3}],[]);
  assert.equal(buildCinematicAssembly(report,"dialogue","main").length,0);
  assert.equal(buildCinematicAssembly(report,"performance","main").length,0);
});
test("audio remapping retains unrelated overlay audio without duplicating linked dialogue",()=>{
  const audio={id:"audio",assetId:"a",trackId:"A1",linkedVideoId:"a",start:0,sourceStart:0,duration:4,gain:1,pan:0,fadeIn:0,fadeOut:0,muted:false};
  const out=remapAutoAudio([audio,{...audio,id:"overlay",linkedVideoId:"overlay"}],[clip("a",0,4)],[],[{...clip("a",2,2),sourceStart:1}]);
  assert.equal(out.length,2);assert.equal(out.find(c=>c.id==="audio").sourceStart,1);assert.equal(out.find(c=>c.id==="audio").start,2);
});
test("generated captions follow surviving cuts after constraints",()=>{
  const cues=remapAutoCues([{start:.2,end:.8,text:"hello"},{start:2.2,end:2.8,text:"removed"}],[clip("a"),clip("b",2)],[clip("a",5)]);
  assert.deepEqual(cues,[{start:5.2,end:5.8,text:"hello"}]);
});
test("music source keep ranges and minimum shot holds are respected on beats",()=>{
  const cuts=buildBaseSequence({beats:Array.from({length:17},(_,i)=>i*.5),duration:8,sections:[{id:"s",start:0,end:8,energy:.9}],assets:[{id:"a",kind:"video",sourceDuration:20,sourceIn:6,peakTime:9}],pace:"frenetic",minShot:1,maxShot:2});
  assert.ok(cuts.every(c=>c.duration>=1&&c.duration<=2&&c.sourceStart>=6));
});
