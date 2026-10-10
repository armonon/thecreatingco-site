import {AudioSample, AudioSampleSink, AudioSampleSource, ALL_FORMATS, BlobSource, BufferTarget, EncodedAudioPacketSource, Input, Mp4OutputFormat, NullTarget, Output, QUALITY_HIGH} from "mediabunny";
import {measureAudioDelay} from "./audio-delay.ts";

const calibratedDelays = new Map<string,number>();

/** WebCodecs AAC encoders do not consistently report priming in packet timestamps.
 * Measure the active encoder/decoder pair at the actual rate/channel count, then
 * express compensation through an MP4 edit list, not a PCM
 * trim or a timeline offset. This works in a worker and never touches preview. */
async function aacDelay(sampleRate:number,channels:number,signal?:AbortSignal) {
  const key=`${sampleRate}/${channels}`;
  if(calibratedDelays.has(key)) return calibratedDelays.get(key)!;
  signal?.throwIfAborted();
  const origin=2048, length=1024, frames=12288;
  const reference=new Float32Array(length), data=new Float32Array(frames*channels);
  let seed=417;
  for(let i=0;i<length;i++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    reference[i]=((seed/4294967296)*2-1)*.4;
    for(let c=0;c<channels;c++) data[(origin+i)*channels+c]=reference[i];
  }
  const target=new BufferTarget(), output=new Output({format:new Mp4OutputFormat(),target});
  const source=new AudioSampleSource({codec:"aac",bitrate:QUALITY_HIGH});
  output.addAudioTrack(source);
  let input:Input|null=null;
  try {
    await output.start();
    const sample=new AudioSample({data,format:"f32",numberOfChannels:channels,sampleRate,timestamp:0});
    try {await source.add(sample);}finally{sample.close();}
    await output.finalize();signal?.throwIfAborted();
    if(!target.buffer) throw new Error("AAC timing probe produced no audio.");
    input=new Input({formats:ALL_FORMATS,source:new BlobSource(new Blob([target.buffer]))});
    const track=await input.getPrimaryAudioTrack();if(!track)throw new Error("AAC timing probe could not be decoded.");
    const decoded=new Float32Array(frames+8192);
    for await(const sample of new AudioSampleSink(track).samples()) {
      try {
        signal?.throwIfAborted();
        const values=new Float32Array(sample.numberOfFrames);sample.copyTo(values,{planeIndex:0,format:"f32-planar"});
        const offset=Math.round(sample.timestamp*sampleRate);
        for(let i=0;i<values.length;i++)if(offset+i>=0&&offset+i<decoded.length)decoded[offset+i]=values[i];
      }finally{sample.close();}
    }
    const {delay}=measureAudioDelay(reference,decoded,origin,8192);
    signal?.throwIfAborted();calibratedDelays.set(key,delay/sampleRate);return delay/sampleRate;
  } finally {
    input?.dispose();
    if(output.state!=="finalized"&&output.state!=="canceled")await output.cancel().catch(()=>undefined);
  }
}

export async function createAacOutput(sampleRate:number,channels:number,signal?:AbortSignal) {
  const delay=await aacDelay(sampleRate,channels,signal);
  const source=new EncodedAudioPacketSource("aac");
  // Use the library's supported encoder and backpressure, forwarding corrected
  // packets to the real output. NullTarget discards the auxiliary container bytes.
  const encoding=new Output({format:new Mp4OutputFormat(),target:new NullTarget()});
  let pending=Promise.resolve(),failure:unknown;
  const encoder=new AudioSampleSource({codec:"aac",bitrate:QUALITY_HIGH,onEncodedPacket(packet,meta){
    // Reserve an edit list using a positive offset. The output metadata adapter
    // converts that empty edit to a media-time skip after muxing.
    pending=pending.then(async()=>{signal?.throwIfAborted();await source.add(packet.clone({timestamp:packet.timestamp+Math.max(delay,1/sampleRate)}),meta);}).catch(error=>{failure=error;});
  }});
  encoding.addAudioTrack(encoder);await encoding.start();
  const check=()=>{signal?.throwIfAborted();if(failure)throw failure;};
  return {
    source,
    delay,
    async add(sample:AudioSample){check();await encoder.add(sample);await pending;check();},
    async finish(){check();await encoding.finalize();await pending;check();},
    async dispose(){if(encoding.state!=="finalized"&&encoding.state!=="canceled")await encoding.cancel().catch(()=>undefined);await pending;},
  };
}
