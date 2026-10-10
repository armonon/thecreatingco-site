import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
const require=createRequire(import.meta.url);
async function component(file,name) {
  const result=await build({entryPoints:[`app/${file}.tsx`],bundle:true,write:false,platform:"node",format:"cjs",jsx:"automatic",external:["react","react/*"],logLevel:"silent"});
  const m={exports:{}}; new Function("require","module","exports",result.outputFiles[0].text)(require,m,m.exports);
  return m.exports[name];
}
const Tabs=await component("editor-document-tabs","EditorDocumentTabs");
const Delivery=await component("delivery-workspace","DeliveryWorkspace");
const Review=await component("auto-edit-review-panel","AutoEditReviewPanel");
const Bin=await component("composition-bin","CompositionBin");
const EffectTarget=await component("effects-browser","TimelineEffectsBrowser");
const render=(C,p)=>renderToStaticMarkup(createElement(C,p));
const compositions=[{id:"a",name:"Title",width:1920,height:1080,duration:5,layers:[]}];
test("locked base clips cannot advertise an effect audition target",()=>{
  const props={base:{id:"a",assetId:"media"},locked:true,mediaName:()=>"Footage"};
  assert.equal(EffectTarget(props).props.auditionTarget,undefined);
  assert.deepEqual(EffectTarget({...props,locked:false}).props.auditionTarget,{kind:"base",id:"a",effects:undefined});
});
test("main is the only initial document tab; an active composition opens without exposing the whole bin",()=>{
  const base={projectName:"Project",compositions,activeView:"sequence"};
  assert.match(render(Tabs,base),/Main sequence/);
  assert.doesNotMatch(render(Tabs,base),/Close Title tab/);
  const opened=render(Tabs,{...base,activeView:"composition",activeCompositionId:"a"});
  assert.match(opened,/Close Title tab/); assert.match(opened,/Pin Title/);
});
test("empty project offers creation and optional samples, with existing compositions still in the bin",()=>{
  assert.match(render(Bin,{compositions:[],query:"",onAddExamples(){}}),/Explore sample compositions/);
  const existing=render(Bin,{compositions,query:""});
  assert.match(existing,/Open Title/); assert.doesNotMatch(existing,/Explore sample compositions/);
});
test("delivery mounts the actual preview and exposes a disabled export plus actionable empty state",()=>{
  const html=render(Delivery,{preview:createElement("canvas",{"aria-label":"Actual sequence"}),exportFormat:"mp4-h264",frameRate:30,maxDimension:1920,aspect:"16:9",timelineRange:{inPoint:null,outPoint:null},currentTime:0,duration:5,deliveryStart:0,deliveryEnd:5,deliveryDuration:5,deliveryRisk:"normal",previewDimensions:{width:960,height:540},mainName:"test.mp4",renderEngineChecks:[],jobs:[],exportProfileSupport:{},selectedProfileMessage:"Ready",selectedProfileSupported:true,integratedLufs:-14,peakDb:-1,audioSampleCount:0});
  assert.match(html,/Actual sequence/); assert.doesNotMatch(html,/delivery-preview-art/);
  assert.match(html,/Export file name/); assert.match(html,/Add media or a composition/);
  assert.match(html,/class="delivery-queue-cta" disabled/);
  assert.match(html,/<summary>Custom video settings/);
  const css=readFileSync("app/studio-workspace.css","utf8");
  assert.match(css,/\.studio-adaptive-shell\.pro-shell\.mode-pro\.mode-deliver\s*\{\s*grid-template-rows:48px 42px minmax\(0,1fr\)/, "Delivery must not inherit the editor's document-tab and timeline rows");
});
test("Auto Cut settings and review are separate, leaving the generate action between them",()=>{
  const props={policy:{timing:"auto",targetDuration:0,minShot:1,maxShot:5,sources:[]},sources:[],versions:[],boundaries:[],transitionCandidates:[],timingReason:"Choose media"};
  const settings=render(Review,{...props,part:"settings"});
  const review=render(Review,{...props,part:"review"});
  assert.match(settings,/Timing approach/); assert.doesNotMatch(settings,/Draft versions/);
  assert.match(review,/Draft versions/); assert.doesNotMatch(review,/Timing approach/);
  const source=readFileSync("app/auto-director-workspace.tsx","utf8");
  assert.ok(source.indexOf('id="auto-media"') < source.indexOf('id="auto-intent"'));
  assert.ok(source.indexOf('id="auto-intent"') < source.indexOf('id="auto-generate"'));
  assert.ok(source.indexOf('id="auto-generate"') < source.indexOf('id="auto-review"'));
});
