import test from "node:test";
import assert from "node:assert/strict";
import { adjustMeasuredBeats, editSongBeat, editSongTempo, planSongSync, beatPosition, beatTime, warpedSourceTime, simplifyGainCurve } from "../lib/song-beat-map.ts";
import { tempoFromTrackedBeats } from "../lib/tempo.ts";
import { PcmStretchReader } from "../lib/pcm-stretch.ts";
import { applyAudioCrossfade } from "../lib/audio-crossfade.ts";
import { clipGainAt } from "../lib/pro-editor.ts";
import { stutterTime } from "../lib/stutter.ts";
import { speedRampTime } from "../lib/speed.ts";

const map = (bpm, count = 256) => {
  const beats = Array.from({length:count}, (_, i) => i * 60 / bpm);
  return {version:1,bpm,confidence:.9,beats,downbeats:beats.filter((_,i)=>i%4===0),beatsPerBar:4};
};
const clip = (overrides = {}) => ({id:"a",assetId:"a",trackId:"music",name:"song",start:0,sourceStart:0,duration:64,gain:1,pan:0,fadeIn:0,fadeOut:0,muted:false,...overrides});

test("measured offset retains irregular spacing and fractional tempo", () => {
  const beats = [.1, .62, 1.11, 1.65];
  const moved = adjustMeasuredBeats(beats, 119.72, 119.72, .025);
  for (let i=1;i<beats.length;i++) assert.ok(Math.abs((moved[i]-moved[i-1])-(beats[i]-beats[i-1]))<1e-12);
  const changed = editSongTempo(map(119.72), 120.25, .01);
  assert.equal(changed.bpm,120.25); assert.ok(changed.downbeats.every(t=>changed.beats.includes(t)));
  assert.throws(()=>editSongBeat(map(120),2,.1,false),/increasing/);
  assert.throws(()=>editSongTempo(map(120),NaN),/Tempo/);
});

test("fractional tempo refines quantized onset frames and automation is compact",()=>{
  const beats=Array.from({length:100},(_,i)=>Math.round(i*60/128/(1024/48000))*(1024/48000));
  assert.ok(Math.abs(tempoFromTrackedBeats(beats,126)-128)<.15);
  const points=Array.from({length:10000},(_,i)=>({time:i*.01,gain:.5+i*.00005}));
  assert.equal(simplifyGainCurve(points).length,2);
});

test("aligns every incoming beat to a drifting master, not just average BPM",()=>{
  const master = map(120);
  master.beats = master.beats.map((t,i)=>t + i*i*.0001);
  master.downbeats = master.beats.filter((_,i)=>i%4===0);
  const plan = planSongSync({...clip(),beatMap:master}, {...clip(),duration:50,beatMap:map(128)},16,0);
  const origin = Math.round(beatPosition(master.beats,plan.start));
  plan.warp.slice(0,-1).forEach((point,i)=>{
    assert.ok(Math.abs(plan.start + point.time - beatTime(master.beats,origin+i))<1e-8);
    assert.ok(Math.abs(point.sourceTime-i*60/128)<1e-8);
    assert.ok(Math.abs(warpedSourceTime(plan.warp,point.time)-point.sourceTime)<1e-8);
  });
  assert.doesNotThrow(()=>structuredClone(plan));
});

test("4/8/16 bar handoffs land at selected downbeat, reject missing handles and meters",()=>{
  for (const bars of [4,8,16]) {
    const plan=planSongSync({...clip(),duration:100,beatMap:map(120)}, {...clip(),duration:100,beatMap:map(128)},40,bars);
    assert.equal(plan.transitionEnd,40); assert.equal(plan.transitionDuration,bars*2);
    assert.equal(plan.start,40-bars*2);
  }
  assert.throws(()=>planSongSync({...clip(),beatMap:map(120)}, {...clip(),beatMap:map(128)},2,16),/Not enough/);
  assert.throws(()=>planSongSync({...clip(),beatMap:map(120)}, {...clip(),beatMap:{...map(128),beatsPerBar:3}},16,4),/meters/);
});

test("full existing overlap has constant power, no full-volume plateau",()=>{
  const pair=applyAudioCrossfade(clip({duration:10}),clip({id:"b",start:8,duration:10}),.5);
  assert.ok(pair);assert.equal(pair[0].fadeOut,2);assert.equal(pair[1].fadeIn,2);
  for(let t=8;t<10;t+=.025) assert.ok(Math.abs(clipGainAt(pair[0],t)**2+clipGainAt(pair[1],t)**2-1)<1e-8);
  assert.equal(applyAudioCrossfade(clip(),clip({start:5,duration:3}),.5),null);
});

test("stutter and speed cycle boundaries follow variable beat timestamps",()=>{
  const beats=[0,.5,1.1,1.8,2.6,3.5,4.5,5.6,6.8];
  const speed={pattern:"ramp-in",every:4,strength:2};
  assert.equal(speedRampTime(2.6,.5,speed,0,beats),2.6);
  assert.equal(speedRampTime(6.8,.5,speed,0,beats),6.8);
  const stutter={pattern:"hold",division:1,window:4,every:4};
  assert.equal(stutterTime(3.8,.5,stutter,0,beats),3.5);
});

test("worker-safe stretch preserves 440 Hz and stereo phase at ½×, 1.067× and 2×",async()=>{
  const sampleRate=48000;
  const read=async(time,frames,l,r)=>{for(let i=0;i<frames;i++){const value=Math.sin(2*Math.PI*440*(time+i/sampleRate));l[i]=value;r[i]=value*.5;}};
  for(const rate of [.5,128/120,2]) {
    const stretch=new PcmStretchReader(read,sampleRate,0,rate);
    const l=new Float32Array(sampleRate*2),r=new Float32Array(l.length);
    for(let offset=0;offset<l.length;offset+=777) {const n=Math.min(777,l.length-offset);const a=new Float32Array(n),b=new Float32Array(n);await stretch.fill(n,a,b);l.set(a,offset);r.set(b,offset);}
    let crossings=0;
    for(let i=sampleRate;i<l.length-1;i++){if(l[i]<=0&&l[i+1]>0)crossings++;assert.ok(Math.abs(r[i]-l[i]*.5)<1e-6);}
    assert.ok(Math.abs(crossings-440)<=3,`${rate}× yielded ${crossings} Hz`);
  }
});

test("stretch cancellation is honored and invalid warps cannot hang",async()=>{
  const controller=new AbortController();controller.abort();
  const s=new PcmStretchReader(async()=>{},48000,0,1);
  await assert.rejects(s.fill(100,new Float32Array(100),new Float32Array(100),controller.signal),/abort/i);
  assert.throws(()=>new PcmStretchReader(async()=>{},48000,0,1,[{time:0,sourceTime:1},{time:0,sourceTime:2}]),/Invalid/);
});
