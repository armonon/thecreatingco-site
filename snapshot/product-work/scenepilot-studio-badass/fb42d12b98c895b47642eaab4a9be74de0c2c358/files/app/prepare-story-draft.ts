import {pickBestTakes,type Take} from "../lib/take-select.ts";
import {assembleStoryCut,captionCuesFromCut,storyCutSummary} from "../lib/story-edit.ts";
import {captionsToTitles} from "../lib/captions.ts";
import type {AudioClip} from "../lib/pro-editor.ts";
type Cue={text:string;start:number;end:number};

/** Pure story preparation; model inference and timeline commits stay outside. */
export function prepareStoryDraft(input:{transcribed:Take[];takes:Array<{id:string;name:string}>;chunksByTake:Map<string,Cue[]>;wordsByTake:Map<string,Cue[]>;hybridBeats?:number[];rangeStart?:number;audioTrackId?:string}) {
 const {transcribed,takes,chunksByTake,wordsByTake,hybridBeats,audioTrackId}=input;
 const {kept,dropped}=pickBestTakes(transcribed);
 let cuts=assembleStoryCut(kept,{handle:0,minGap:.1,minKeep:.16});
 if(hybridBeats?.length) {
   let cursor=input.rangeStart??0;
   cuts=cuts.map(c=>{const start=hybridBeats.find(b=>b>=cursor-.001)??cursor;cursor=start+c.duration;return {...c,start};});
 }
 const captionCues=kept.flatMap(take=>captionCuesFromCut(chunksByTake.get(take.id)??[],cuts.filter(c=>c.assetId===take.id)));
 const timelineWords=kept.flatMap(take=>captionCuesFromCut(wordsByTake.get(take.id)??[],cuts.filter(c=>c.assetId===take.id)).map((word,index)=>({id:`word-${take.id}-${index}-${Math.round(word.start*1000)}`,text:word.text,start:word.start,end:word.end,sourceLabel:takes.find(a=>a.id===take.id)?.name??"Dialogue"})));
 const captionTitles=captionsToTitles(captionCues);
 const total=cuts.reduce((max,c)=>Math.max(max,c.start+c.duration),0);
 const dialogue:AudioClip[]=audioTrackId?cuts.map(c=>({id:`story-audio-${c.id}`,assetId:c.assetId,trackId:audioTrackId,name:"Dialogue",start:c.start,sourceStart:c.sourceStart,duration:c.duration,gain:1,pan:0,fadeIn:0,fadeOut:0,muted:false,automation:[],linkedVideoId:c.id})):[];
 return {cuts,captionTitles,timelineWords,total,dialogue,summary:storyCutSummary(kept,cuts),retakes:dropped.length?` ${dropped.length} retake${dropped.length===1?"":"s"} dropped ·`:"",captioned:captionTitles.length?` ${captionTitles.length} captions ·`:""};
}
