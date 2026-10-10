import {renderAudioProject,renderProject,type RenderAudioClip} from "../lib/render-engine";
import type {StreamTargetChunk} from "mediabunny";

const output=document.querySelector<HTMLPreElement>("#result")!;
const run=document.querySelector<HTMLButtonElement>("#run")!;
const files=document.querySelector<HTMLDivElement>("#downloads")!;
const urls:string[]=[];
const rate=48000, duration=2;
function fixture() {
  const bytes=new ArrayBuffer(44+rate*duration*2),view=new DataView(bytes);
  const text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  text(0,"RIFF");view.setUint32(4,bytes.byteLength-8,true);text(8,"WAVEfmt ");view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,"data");view.setUint32(40,bytes.byteLength-44,true);
  let seed=71;
  for(let i=0;i<rate*duration;i++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const t=i/rate,active=[.2,.75,1.3].some(start=>t>=start&&t<start+.04);
    view.setInt16(44+i*2,active?Math.round(((seed/4294967296)*2-1)*12000):0,true);
  }
  return new File([bytes],"timing-bursts.wav",{type:"audio/wav"});
}
function download(blob:Blob,name:string) {
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);urls.push(link.href);link.download=name;link.textContent=`Download ${name}`;files.appendChild(link);files.appendChild(document.createElement("br"));
}
run.onclick=async()=>{
  run.disabled=true; urls.splice(0).forEach(url=>URL.revokeObjectURL(url));files.replaceChildren();
  const context=new AudioContext({sampleRate:rate});
  const results:Record<string,unknown>={};
  const measure=async(blob:Blob)=>{
    const decoded=await context.decodeAudioData(await blob.arrayBuffer()),x=decoded.getChannelData(0),onsets:number[]=[];
    let last=-Infinity;
    for(let i=0;i<x.length;i+=48){let power=0;for(let j=i;j<Math.min(x.length,i+48);j++)power+=x[j]**2;
      if(Math.sqrt(power/48)>.03&&i/decoded.sampleRate-last>.15){last=i/decoded.sampleRate;onsets.push(Math.round(last*1000));}}
    return {duration:decoded.duration,onsetMs:onsets};
  };
  try {
    const file=fixture();download(file,file.name);results.source=await measure(file);
    const clips:RenderAudioClip[]=[{id:"bursts",file,start:0,sourceStart:0,duration,gain:1,pan:0,fadeIn:0,fadeOut:0}];
    output.textContent="Mixing PCM…";
    const wav=await renderAudioProject({clips,duration});if(!wav)throw Error("No PCM result");download(wav,"timing-mix.wav");results.pcm=await measure(wav);
    for(const format of ["mp4-h264","webm-vp9"] as const) {
      output.textContent=JSON.stringify(results,null,2)+`\nEncoding ${format}…`;
      const movie=await renderProject({mainFile:null,assets:[],placements:[],audioClips:clips,useMainAudio:false,duration,frameRate:24,sourceSize:{width:160,height:90},format});
      if(!movie)throw Error("No movie result");download(movie,`timing-${format}.${format==="mp4-h264"?"mp4":"webm"}`);results[format]=await measure(movie);
    }
    output.textContent=JSON.stringify(results,null,2)+"\nChecking seekable-stream MP4…";
    const chunks:StreamTargetChunk[]=[];
    let closed=false;
    await renderProject({mainFile:null,assets:[],placements:[],audioClips:clips,useMainAudio:false,duration,frameRate:24,sourceSize:{width:160,height:90},format:"mp4-h264",outputStream:new WritableStream({
      write(chunk:StreamTargetChunk){chunks.push({...chunk,data:new Uint8Array(chunk.data)});},close(){closed=true;},
    })});
    const bytes=new Uint8Array(Math.max(...chunks.map(chunk=>chunk.position+chunk.data.length)));
    for(const chunk of chunks)bytes.set(chunk.data,chunk.position);
    const streamed=new Blob([bytes],{type:"video/mp4"});download(streamed,"timing-streamed.mp4");results.streamed={...await measure(streamed),closed};
    for(const phase of ["before-start","mixing","video","finalizing"]){
      const controller=new AbortController();let completed=false;
      if(phase==="before-start")controller.abort();
      try {
        await renderProject({mainFile:null,assets:[],placements:[],audioClips:clips,useMainAudio:false,duration,frameRate:24,sourceSize:{width:160,height:90},format:"mp4-h264",signal:controller.signal,onProgress(progress,label){
          if((phase==="mixing"&&label.startsWith("Mixing"))||(phase==="video"&&label.startsWith("Rendering frame"))||(phase==="finalizing"&&progress===.98))controller.abort();
        }});completed=true;
      }catch(error){results[`cancel-${phase}`]=error instanceof Error?error.name:String(error);}
      if(completed)throw Error(`Cancellation did not stop ${phase}`);
    }
    output.textContent=JSON.stringify(results,null,2);
  } catch(error){output.textContent=JSON.stringify(results,null,2)+`\nERROR: ${String(error)}`;}
  finally {await context.close();run.disabled=false;}
};
