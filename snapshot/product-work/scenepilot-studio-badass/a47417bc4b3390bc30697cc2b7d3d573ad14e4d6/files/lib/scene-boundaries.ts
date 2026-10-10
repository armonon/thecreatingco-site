export type BoundaryFrame = { time: number; gray: Uint8Array; histogram: Float32Array; brightness: number };
export type RefinedBoundary = { time: number; confidence: number; transition: "cut" | "flash" | "dissolve"; precision: "frame" | "coarse" };
function distance(a: BoundaryFrame, b: BoundaryFrame) {
  let pixels = 0, histogram = 0;
  for (let i=0;i<a.gray.length;i++) pixels += Math.abs(a.gray[i]-b.gray[i])/255;
  for (let i=0;i<a.histogram.length;i++) histogram += Math.abs(a.histogram[i]-b.histogram[i]);
  return pixels/Math.max(1,a.gray.length)*.45 + histogram*.275;
}
/** Dense decoded timestamps, not requested seek times. Reject movement and
 * returning exposure flashes; gradual transitions remain review candidates. */
export function refineBoundaryFrames(frames: BoundaryFrame[]): RefinedBoundary[] {
  const deltas = frames.slice(1).map((f,i)=>distance(frames[i],f));
  const sorted = [...deltas].sort((a,b)=>a-b);
  const baseline = sorted[Math.floor(sorted.length*.5)] ?? 0;
  const threshold = Math.max(.065, baseline*4);
  const result: RefinedBoundary[] = [];
  for (let i=1;i<frames.length-2;i++) {
    const delta=deltas[i-1]; if(delta < threshold) continue;
    const before=frames[Math.max(0,i-2)], after=frames[Math.min(frames.length-1,i+3)];
    const returning=distance(before,after) < delta*.28;
    const transition = returning ? "flash" : "cut";
    if (result.length && frames[i].time-result.at(-1)!.time < .1) continue;
    result.push({time:frames[i].time,confidence:Math.min(.99,delta/Math.max(.12,threshold*2)),transition,precision:"frame"});
  }
  if(!result.length && frames.length>5 && distance(frames[0],frames.at(-1)!)>.22 && deltas.filter(d=>d>.008).length>frames.length*.55) {
    result.push({time:frames[Math.floor(frames.length/2)].time,confidence:.45,transition:"dissolve",precision:"frame"});
  }
  return result;
}
