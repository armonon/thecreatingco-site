import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp,writeFile,mkdir,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {detectNativeMediaEngine,sanitizeNativeRenderPlan,createNativeSequenceRenderJob,probeMedia} from "../electron/media-engine.js";

// Generated sources only. This certifies an export workload, not perceptual
// playback, real-camera decoder coverage, or cross-machine readiness.
const run=promisify(execFile);
const reportPath=path.resolve(process.argv.find(arg=>arg.startsWith("--report="))?.slice("--report=".length) || "outputs/long-project/report.json");
const root=await mkdtemp(path.join(os.tmpdir(),"scenepilot-long-project-"));
const report={schema:"scenepilot-long-project/v1",createdAt:new Date().toISOString(),host:{platform:process.platform,arch:process.arch,os:os.release()},scope:"10-minute mixed-format native export, generated media; not playback or clean-machine certification",checks:[]};
const check=(name,passed,details)=>{report.checks.push({name,passed:Boolean(passed),details});if(!passed)throw new Error(name);};
try{
  const engine=await detectNativeMediaEngine();
  check("native engine",engine.available,engine.encoder);
  const formats=[{name:"h264-23976.mp4",size:"640x360",rate:"24000/1001",codec:"libx264"},{name:"h264-25.mp4",size:"360x640",rate:"25",codec:"libx264"},{name:"prores-30.mov",size:"480x270",rate:"30",codec:"prores_ks"}];
  for(const format of formats){
    await run(engine.ffmpeg,["-v","error","-f","lavfi","-i",`testsrc2=size=${format.size}:rate=${format.rate}:duration=12`,"-an","-c:v",format.codec,...(format.codec==="libx264"?["-preset","ultrafast","-pix_fmt","yuv420p"]:["-profile:v","0","-pix_fmt","yuv422p10le"]),"-threads","2",path.join(root,format.name)],{timeout:60000});
  }
  const audio=path.join(root,"clock.wav");
  await run(engine.ffmpeg,["-v","error","-f","lavfi","-i","sine=frequency=440:sample_rate=48000:duration=600","-c:a","pcm_s16le",audio],{timeout:30000});
  const clips=Array.from({length:60},(_,i)=>({sourcePath:path.join(root,formats[i%formats.length].name),sourceStart:1,duration:10,playbackRate:1}));
  const plan=sanitizeNativeRenderPlan({clips,soundtrackPath:audio,duration:600,frameRate:30,width:320,height:180,masterGain:.5});
  const output=path.join(root,"ten-minute-master.mp4");
  const start=performance.now();
  await createNativeSequenceRenderJob({engine,plan,outputPath:output});
  const probe=await probeMedia(engine,output);
  report.elapsedMs=Math.round(performance.now()-start);report.clipCount=clips.length;
  check("full ten-minute output",Math.abs(probe.duration-600)<1/30,probe.duration);
  const {stdout}=await run(engine.ffprobe,["-v","error","-show_streams","-of","json",output],{timeout:30000});
  const streams=JSON.parse(stdout).streams,video=streams.find(s=>s.codec_type==="video"),sound=streams.find(s=>s.codec_type==="audio");
  check("audio/video endpoints within one frame",video&&sound&&Math.abs(Number(video.duration)-Number(sound.duration))<=1/30,{video:video?.duration,audio:sound?.duration});
  for(const second of [.5,10.5,20.5,299.5,599.5]){
    const {stdout:pixel}=await run(engine.ffmpeg,["-v","error","-ss",String(second),"-i",output,"-frames:v","1","-vf","scale=2:2","-pix_fmt","rgb24","-f","rawvideo","pipe:1"],{encoding:"buffer",timeout:30000});
    check(`decoded picture at ${second}s`,pixel.length===12&&pixel.some(value=>value>20),[...pixel]);
  }
  report.passed=true;
}catch(error){report.passed=false;report.error=String(error);process.exitCode=1;}
finally{await rm(root,{recursive:true,force:true});}
await mkdir(path.dirname(reportPath),{recursive:true});
await writeFile(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
