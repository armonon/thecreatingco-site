import type {EditSnapshot} from "./edit-snapshot";
import type {AutoEditVersion} from "./auto-edit-types";
import type {AutoTiming,ExplainedCut} from "../lib/auto-edit-policy";
import {constrainAutoCuts,remapAutoAudio,remapAutoCues} from "../lib/auto-edit-transaction.ts";
import {toUnifiedTimeline} from "../lib/video-timeline.ts";
import {STROBE_PRESETS} from "../lib/strobe.ts";
const UNIFIED_BASE_TRACK = "__base__";
export function prepareAutoDraft(input:{snapshot:EditSnapshot;name:string;candidates:ExplainedCut[];patch:Partial<EditSnapshot>;mode:AutoTiming;expectedTimeline:string;visualAssets:Array<{id:string}>;confidence?:number}):AutoEditVersion {
 const {name,candidates,mode,visualAssets}=input;
 const patch={...input.patch};
 if(patch.strobePreset) {
   const c=STROBE_PRESETS[patch.strobePreset];
   Object.assign(patch,{strobeColor:c.color,strobeSecondaryColor:c.secondaryColor??c.color,strobeAlternate:c.alternate??false,strobeIntensity:c.intensity,strobeAttack:c.attack??0,strobeHold:c.hold??0,strobeDecay:c.decay,strobeShape:c.shape??"exponential",strobeMode:c.mode??"full",strobeBlend:c.blend??"screen",strobeX:c.x??.5,strobeY:c.y??.5,strobeSize:c.size??.75,strobeSoftness:c.softness??.65,strobeAngle:c.angle??0,strobeBand:"all"});
 }
 const {autoPolicy,baseCuts,sections,audioClips,audioTracks,titles,transcriptWords,placements,clipTracks}=input.snapshot;
 if(!autoPolicy) throw new Error("Auto Cut constraints unavailable.");
      const policy = {...autoPolicy,timing:mode};
      const protectedCuts = baseCuts.map(c => ({...c,locked:c.locked || sections.some(s=>s.locked && c.start<s.end && c.start+c.duration>s.start) || audioClips.some(a=>a.linkedVideoId===c.id && audioTracks.find(t=>t.id===a.trackId)?.locked)}));
      const cuts = constrainAutoCuts(candidates,protectedCuts,policy).map(c=>{
        const existing=baseCuts.find(old=>old.id===c.id);
        return existing && protectedCuts.find(old=>old.id===c.id)?.locked ? {...c,locked:existing.locked} : c;
      });
      const replacementAudio = patch.audioClips ?? audioClips;
      const retainedCaptions=remapAutoCues(titles.filter(t=>t.id.startsWith("caption-")).map(t=>({...t,end:t.start+t.duration})),baseCuts,cuts).map(t=>({...t,duration:t.end-t.start}));
      const nextTitles=patch.titles ? [...patch.titles.filter(t=>!t.id.startsWith("caption-")),...retainedCaptions,...remapAutoCues(patch.titles.filter(t=>t.id.startsWith("caption-")).map(t=>({...t,end:t.start+t.duration})),candidates,cuts).map(t=>({...t,duration:t.end-t.start}))] : titles;
      const nextWords=patch.transcriptWords?[...remapAutoCues(transcriptWords,baseCuts,cuts),...remapAutoCues(patch.transcriptWords,candidates,cuts)]:transcriptWords;
      const {autoVersions: _versions,...before}=input.snapshot;
      void _versions;
      const seenSources=new Set(cuts.map(c=>c.assetId));
      const generatedPlacements = patch.placements ? [...patch.placements.filter(p=>{
        if(clipTracks.find(t=>t.id===p.trackId)?.locked) return false;
        const rule=policy.sources.find(r=>r.assetId===p.assetId);
        if(rule?.exclude || (p.sourceStart??0)<(rule?.inPoint??0) || (p.sourceStart??0)+p.duration*(p.playbackRate??1)>(rule?.outPoint??Infinity) || (policy.noRepeat && seenSources.has(p.assetId))) return false;
        seenSources.add(p.assetId);return true;
      }),...placements.filter(p=>clipTracks.find(t=>t.id===p.trackId)?.locked)] : placements;
      const nextPlacements = policy.range ? placements : generatedPlacements;
      const nextAudio = remapAutoAudio(replacementAudio,toUnifiedTimeline(baseCuts,placements,UNIFIED_BASE_TRACK),toUnifiedTimeline(candidates,patch.placements??[],UNIFIED_BASE_TRACK),toUnifiedTimeline(cuts,nextPlacements,UNIFIED_BASE_TRACK));
      const length=Math.max(.05,...cuts.map(c=>c.start+c.duration),...nextAudio.map(c=>c.start+c.duration),...nextPlacements.map(c=>c.start+c.duration),...nextTitles.map(t=>t.start+t.duration));
      const warnings:string[]=[];
      if(policy.targetDuration && Math.abs(length-((policy.range?.start ?? 0)+policy.targetDuration))>.1) warnings.push("Available footage / protected material cannot exactly meet the target. Review the actual draft duration before applying.");
      if(mode === "music" && cuts.some((c,i)=>c.start>(i?cuts[i-1].start+cuts[i-1].duration:0)+.05)) warnings.push("Source/length constraints leave gaps on the musical grid. Relax constraints or fill those gaps manually; beats were not shifted.");
      const next: AutoEditVersion={fields:[...Object.keys(patch) as Array<keyof EditSnapshot>,"videoClips","baseCuts","placements","audioClips","titles","transcriptWords","duration","montageEnabled"],id:crypto.randomUUID(),name,createdAt:new Date().toISOString(),expectedTimeline:input.expectedTimeline,snapshot:{...before,...patch,titles:nextTitles,transcriptWords:nextWords,baseCuts:cuts,placements:nextPlacements,videoClips:toUnifiedTimeline(cuts,nextPlacements,UNIFIED_BASE_TRACK),audioClips:nextAudio,duration:length,montageEnabled:true},warnings,
        evidence:cuts.map(c=>({id:c.id,assetId:c.assetId,start:c.start,duration:c.duration,editorial:(c as ExplainedCut).editorial ?? {reason:c.locked?"Protected editorial decision":mode === "music" ? "Measured beat / section energy; source peak favored" : "Source order / technical quality",confidence:c.locked?1:input.confidence ?? .5,alternatives:visualAssets.filter(a=>a.id!==c.assetId).slice(0,3).map(a=>a.id)}}))};
 return next;
}
