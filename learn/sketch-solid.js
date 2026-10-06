import * as THREE from './vendor/three.module.min.js';
import {contours} from './sketch-contours.js';
export {contours};
export const LIMITS={strokes:100,points:800,totalPoints:20000};
export function validateSketch(value){
 if(value?.format!=='form-live-sketch'||value.version!==1||!Array.isArray(value.strokes)||value.strokes.length>LIMITS.strokes)throw Error('Choose a saved sketch from this workspace.');
 const state=structuredClone(value);
 for(const [key,min,max] of [['depth',.5,10],['width',.5,5]])if(!Number.isFinite(state[key])||state[key]<min||state[key]>max)throw Error('Sketch dimensions are outside the supported range.');
 if(!['gold','silver','rose'].includes(state.finish))throw Error('Unknown finish.');
 let total=0;
 for(const stroke of state.strokes){
  if(!['stroke','fill','cut'].includes(stroke.kind)||!Array.isArray(stroke.points)||stroke.points.length<2||stroke.points.length>LIMITS.points)throw Error('A saved stroke is invalid.');
  if(!Number.isFinite(stroke.width)||stroke.width<.5||stroke.width>5)throw Error('A saved stroke width is invalid.');
  total+=stroke.points.length;
  for(const p of stroke.points)if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>30.001||Math.abs(p.y)>30.001)throw Error('A saved point is outside the sketch canvas.');
 }
 if(total>LIMITS.totalPoints)throw Error('This sketch has too many points.');
 return {format:'form-live-sketch',version:1,depth:state.depth,width:state.width,finish:state.finish,strokes:state.strokes.map(s=>({kind:s.kind,width:s.width,points:s.points.map(p=>({x:p.x,y:p.y}))}))};
}
function pathFrom(points,Type){const p=new Type();p.moveTo(points[0].x,points[0].y);for(const point of points.slice(1))p.lineTo(point.x,point.y);p.closePath();return p;}
export function solidGeometry(profiles,depth){
 if(!profiles.length)return null;
 const shapes=profiles.map(profile=>{const s=pathFrom(profile.outline,THREE.Shape);s.holes=profile.holes.map(h=>pathFrom(h,THREE.Path));return s;});
 const geometry=new THREE.ExtrudeGeometry(shapes,{depth,steps:1,bevelEnabled:false,curveSegments:24});
 geometry.computeBoundingBox();return geometry;
}
export function sketchSVG(profiles){
 const segment=points=>'M'+points.map(p=>`${(p.x+30).toFixed(3)},${(30-p.y).toFixed(3)}`).join(' L')+' Z';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="60mm" viewBox="0 0 60 60"><path fill="#17171a" fill-rule="evenodd" d="${profiles.map(p=>[p.outline,...p.holes].map(segment).join(' ')).join(' ')}"/></svg>`;
}
export function starter(name='leaf'){
 const circle=(radius,cx=0,cy=0)=>Array.from({length:97},(_,i)=>({x:cx+Math.cos(i/96*Math.PI*2)*radius,y:cy+Math.sin(i/96*Math.PI*2)*radius}));
 const s={format:'form-live-sketch',version:1,depth:2.4,width:1.6,finish:'gold',strokes:[]};
 const add=(kind,points,width=1.6)=>s.strokes.push({kind,points,width});
 if(name==='loop'){add('fill',circle(16));add('fill',circle(4,0,16));add('cut',circle(10,2,0));add('cut',circle(1.8,0,16));}
 if(name==='leaf'){
  add('fill',Array.from({length:97},(_,i)=>{const t=i/96*Math.PI*2;return{x:Math.sin(t)*Math.abs(Math.sin(t))**.5*10,y:Math.cos(t)*19};}));
  add('cut',[{x:0,y:-12},{x:1,y:0},{x:0,y:13}],.8);
 }
 if(name==='heart'){add('fill',Array.from({length:129},(_,i)=>{const t=i/128*Math.PI*2;return{x:16*Math.sin(t)**3,y:13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)};}));add('cut',circle(1.6,0,8));}
 return s;
}
