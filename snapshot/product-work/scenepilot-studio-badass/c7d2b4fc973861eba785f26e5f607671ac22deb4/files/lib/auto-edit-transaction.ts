import type { BaseCut } from "./sequencer.ts";
import type { AudioClip } from "./pro-editor.ts";
import { sliceEditorialAudio } from "./source-edit.ts";
import {placeBaseCut} from "./timeline-edit.ts";
import {validateAutoPolicy,type AutoEditPolicy,type ExplainedCut} from "./auto-edit-policy.ts";

/** Enforce source handles before assembly; never silently override impossible constraints. */
export function constrainAutoCuts(candidates: ExplainedCut[], existing: BaseCut[], policy: AutoEditPolicy): ExplainedCut[] {
  validateAutoPolicy(policy);
  const rules = new Map(policy.sources.map(rule => [rule.assetId, rule]));
  const seen = new Set<string>();
  let cursor = policy.range?.start ?? 0;
  const end = Math.min(policy.range?.end ?? Infinity, policy.targetDuration ? cursor + policy.targetDuration : Infinity);
  const generated: ExplainedCut[] = [];
  const musical = policy.timing === "music" || policy.timing === "hybrid";
  const ordered=policy.timing === "scenes" ? [...candidates].sort((a,b)=>(rules.get(b.assetId)?.priority ?? 1)-(rules.get(a.assetId)?.priority ?? 1)) : candidates;
  for (const original of ordered) {
    const rule = rules.get(original.assetId);
    if (rule?.exclude || (policy.noRepeat && seen.has(original.assetId))) continue;
    const rate = original.playbackRate ?? 1;
    const start = Math.max(original.sourceStart, rule?.inPoint ?? 0);
    const sourceEnd = Math.min(original.sourceStart + original.duration * rate, rule?.outPoint ?? Infinity);
    const available = (sourceEnd - start) / rate;
    const protectedPhrase = policy.preserveDialogue && original.preservePhrase;
    // Linked spoken phrases are indivisible; refuse rather than truncate a word.
    if (protectedPhrase && (start !== original.sourceStart || available < original.duration - 1e-6)) continue;
    if(musical) cursor = original.start;
    if(cursor < (policy.range?.start ?? 0)) continue;
    // Keep musical cut starts on their measured beats, but let the last shot
    // end at the requested out point. Dropping that whole shot can discard
    // several seconds of otherwise valid footage. Spoken phrases stay whole.
    const length = protectedPhrase ? original.duration : musical ? Math.min(original.duration, end - cursor) : Math.min(available, policy.maxShot, end - cursor);
    if(musical && (start !== original.sourceStart || available < original.duration - 1e-6)) continue;
    if (length < policy.minShot || length > policy.maxShot + 1e-6 || cursor + length > end + 1e-6) continue;
    if(protectedPhrase && existing.some(c=>c.locked && c.id!==original.id && cursor<c.start+c.duration && cursor+length>c.start)) continue;
    generated.push({ ...original, start: cursor, sourceStart: start, duration: length });
    seen.add(original.assetId); cursor += length;
  }
  if (!generated.length) throw new Error("No cuts satisfy these constraints. Relax the shot lengths, keep ranges, target duration or no-repeat rule.");
  const range = policy.range;
  let result: BaseCut[] = generated;
  // Preserve everything outside an explicitly requested replacement region.
  if (range) {
    if(existing.some(c=>c.start<range.end && c.start+c.duration>range.start && (c.reversed || c.timeRemap?.length))) throw new Error("Region replacement intersects a reversed/time-remapped clip. Protect it or use a whole-sequence draft; no edit was applied.");
    const outside = existing.flatMap(cut => {
      if (cut.start >= range.end || cut.start + cut.duration <= range.start) return [cut];
      const pieces: BaseCut[] = [];
      if (cut.start < range.start) pieces.push({ ...cut, duration: range.start - cut.start });
      if (cut.start + cut.duration > range.end) pieces.push({ ...cut, id: `${cut.id}-after-auto`, start: range.end, sourceStart: cut.sourceStart + (range.end - cut.start) * (cut.playbackRate ?? 1), duration: cut.start + cut.duration - range.end });
      return pieces;
    });
    result = [...outside, ...generated].sort((a,b) => a.start-b.start);
  }
  for (const cut of existing.filter(c => c.locked)) result = placeBaseCut(result, cut, "overwrite");
  return result;
}

/** Remap linked dialogue as a transaction; unrelated overlay audio survives. */
export function remapAutoAudio(audio: AudioClip[], before: BaseCut[], candidates: BaseCut[], after: BaseCut[]): AudioClip[] {
  const managed=new Set([...before,...candidates].map(c=>c.id));
  const result=audio.filter(a=>!a.linkedVideoId || !managed.has(a.linkedVideoId));
  const originals=[...candidates,...before];
  for(const cut of after) {
    const origin=originals.find(c=>c.id===cut.id) ?? originals.find(c=>cut.id.startsWith(c.id+"-") && c.assetId===cut.assetId);
    if(!origin) continue;
    for(const clip of audio.filter(a=>a.linkedVideoId===origin.id)) {
      const rate=clip.playbackRate ?? 1;
      const from=(cut.sourceStart-clip.sourceStart)/rate;
      const to=from+cut.duration;
      if(from<-.001 || to>clip.duration+.001) throw new Error("Generated picture exceeds its linked audio handles. Refine the source range; no edit was applied.");
      const id=cut.id===origin.id?clip.id:`${clip.id}-${cut.id}`;
      result.push({...sliceEditorialAudio(clip,Math.max(0,from),Math.min(clip.duration,to),id),start:cut.start,linkedVideoId:cut.id});
    }
  }
  return [...new Map(result.map(c=>[c.id,c])).values()].sort((a,b)=>a.start-b.start);
}

/** Retiming captions uses their original generated cut, never the new index. */
export function remapAutoCues<T extends {start:number;end:number}>(cues:T[], before:BaseCut[], after:BaseCut[]):T[] {
  return cues.flatMap(cue=>{
    const original=before.find(c=>cue.start>=c.start-.001 && cue.end<=c.start+c.duration+.001);
    if(!original) return [];
    return after.filter(c=>c.id===original.id || (c.id.startsWith(original.id+"-") && c.assetId===original.assetId)).flatMap(cut=>{
      const offset=cut.start-original.start-(cut.sourceStart-original.sourceStart)/(cut.playbackRate ?? 1);
      const start=cue.start+offset,end=cue.end+offset;
      if(start<cut.start-.001 || end>cut.start+cut.duration+.001) return [];
      return [{...cue,start,end}];
    });
  });
}
