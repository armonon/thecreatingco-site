/* eslint-disable react-hooks/rules-of-hooks -- Isolated hook lifecycle harness, not a React component. */
import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: [new URL("../app/use-program-transport.ts", import.meta.url).pathname],
  bundle:true,platform:"node",format:"esm",write:false,logLevel:"silent",
  plugins:[{name:"transport-harness",setup(builder){
    builder.onResolve({filter:/^react$/},()=>({path:"react",namespace:"harness"}));
    builder.onLoad({filter:/.*/,namespace:"harness"},()=>({contents:"export const useRef = value => ({current:value}); export const useEffect = effect => globalThis.__transportEffects.push(effect);"}));
  }}],
});
const {useProgramTransport} = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`);

test("program clock outlives source, stops at document end, and reports decoder failures",async()=>{
  const originalRaf=globalThis.requestAnimationFrame, originalCancel=globalThis.cancelAnimationFrame;
  let tick;
  globalThis.requestAnimationFrame=fn=>{tick=fn;return 1;};
  globalThis.cancelAnimationFrame=()=>{};
  const cleanups=[];
  try {
    let playing=true,rate=0,status="",head=5.9,playCalls=0;
    const media={paused:true,currentTime:5.9,duration:6,playbackRate:1,pause(){this.paused=true;},async play(){playCalls++;this.paused=false;}};
    const context={videoRef:{current:media},playing,shuttleRate:rate,mainUrl:"fixture.mp4",editorMode:"pro",workspaceView:"sequence",isPro:true,timelineRange:{},duration:12,frameRate:30,currentTime:head,compositionTime:0,loopPlayback:false,
      setPlaying:v=>playing=v,setShuttleRate:v=>rate=v,setStatus:v=>status=v,setCurrentTime:v=>head=v,setCompositionTime(){} };
    const mount=c=>{globalThis.__transportEffects=[];const actions=useProgramTransport(c);for(const effect of globalThis.__transportEffects){const cleanup=effect();if(cleanup)cleanups.push(cleanup);}return actions;};
    mount(context);
    tick(performance.now()+200);
    assert.ok(head>6&&head<7);assert.equal(playing,true);assert.equal(media.paused,true);
    tick(performance.now()+13000);assert.equal(head,12);assert.equal(playing,false);
    playing=true;rate=-2;
    await mount({...context,playing,shuttleRate:rate}).togglePlayback();
    assert.equal(playCalls,0,"pausing reverse must not start forward playback");
    assert.equal(playing,false);assert.equal(rate,0);
    media.play=async()=>{playCalls++;throw new Error("decoder unavailable");};
    mount({...context,playing:true,currentTime:0});
    tick(performance.now()+100);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(playCalls,1);assert.equal(playing,false);assert.equal(rate,0);
    assert.match(status,/Playback failed: decoder unavailable/);
  } finally {
    cleanups.forEach(cleanup=>cleanup());
    globalThis.requestAnimationFrame=originalRaf;globalThis.cancelAnimationFrame=originalCancel;
    delete globalThis.__transportEffects;
  }
});
