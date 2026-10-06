import * as THREE from './vendor/three.module.min.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {STLExporter} from './vendor/STLExporter.js';
import {download,canvasBlob} from './shared.js';
import {contours,solidGeometry,sketchSVG,starter,validateSketch,LIMITS} from './sketch-solid.js';

const root=document.querySelector('[data-live-sketch]');
if(root){
 const $=name=>root.querySelector(`[data-s3-${name}]`),all=name=>root.querySelectorAll(`[data-s3-${name}]`);
 const canvas=$('sketch'),model=$('model'),ctx=canvas.getContext('2d'),status=$('status');
 const KEY='momentium-form-live-sketch-v1';
 let state=starter(),undo=[],redo=[],active=null,tool='stroke',grid=true,profiles=[],mesh=null,renderer=null;
 let frame=0,lastBuild=0,enabledStorage=false,webglError='',restoreWarning='',yaw=.55,pitch=.4,zoom=1;
 let drawingRect={width:1,height:1,scale:1},orbit=null;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,1000);
 scene.background=new THREE.Color('#edf0f1');
 const material=new THREE.MeshStandardMaterial({color:'#d9ae52',metalness:.85,roughness:.28});
 const light=new THREE.HemisphereLight(0xffffff,0x6d747b,2.4);scene.add(light);
 const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-30,50,70);scene.add(key);
 const fill=new THREE.DirectionalLight(0xffffff,2);fill.position.set(40,-25,10);scene.add(fill);
 function tell(message,error=false){status.textContent=message;status.classList.toggle('is-error',error);}
 try{
  const stored=JSON.parse(localStorage.getItem(KEY)||'null');
  if(stored?.enabled){state=validateSketch(stored.sketch);enabledStorage=true;$('starter').value='custom';}
 }catch{restoreWarning='The saved sketch could not be restored. You can still open a downloaded sketch.';}
 try{
  renderer=new THREE.WebGLRenderer({canvas:model,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 }catch{webglError='3D rendering is unavailable in this browser. Sketch, SVG and STL exports still work.';}
 function persist(){
  if(!enabledStorage)return;
  try{localStorage.setItem(KEY,JSON.stringify({enabled:true,sketch:state}));}
  catch{enabledStorage=false;$('storage').checked=false;tell('Device storage is full or unavailable. Download your editable sketch to keep it.',true);}
 }
 function checkpoint(){undo.push(structuredClone(state));if(undo.length>50)undo.shift();redo=[];}
 function controls(){
  $('depth').value=state.depth;$('width').value=state.width;
  $('depth-label').textContent=state.depth.toFixed(1)+' mm';$('width-label').textContent=state.width.toFixed(1)+' mm';
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('clear').disabled=!state.strokes.length&&!active;
  for(const button of all('finish'))button.setAttribute('aria-pressed',String(button.dataset.s3Finish===state.finish));
  $('storage').checked=enabledStorage;
  material.color.set({gold:'#d9ae52',silver:'#c4ccd5',rose:'#d69b89'}[state.finish]);
 }
 function draw(){
  const {width:w,height:h,scale}=drawingRect;ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w/2,h/2);ctx.scale(scale,-scale);
  ctx.fillStyle='#fafbf8';ctx.fillRect(-30,-30,60,60);
  if(grid){ctx.strokeStyle='#e2e5df';ctx.lineWidth=.7/scale;ctx.beginPath();for(let i=-30;i<=30;i+=5){ctx.moveTo(i,-30);ctx.lineTo(i,30);ctx.moveTo(-30,i);ctx.lineTo(30,i);}ctx.stroke();}
  ctx.strokeStyle='#c5cbc0';ctx.lineWidth=1/scale;ctx.strokeRect(-30,-30,60,60);
  const trace=points=>{ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();};
  ctx.fillStyle='#b7c6ab';ctx.strokeStyle='#42533a';ctx.lineWidth=1/scale;ctx.beginPath();
  for(const profile of profiles){trace(profile.outline);for(const hole of profile.holes)trace(hole);}ctx.fill('evenodd');ctx.stroke();
  if(active?.points.length){ctx.beginPath();ctx.moveTo(active.points[0].x,active.points[0].y);for(const p of active.points.slice(1))ctx.lineTo(p.x,p.y);ctx.strokeStyle=active.kind==='cut'?'#c6333b':'#293dff';ctx.lineWidth=active.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  ctx.restore();
 }
 function view(){
  if(!renderer||webglError)return;
  const box=mesh?.geometry.boundingBox,size=box?box.getSize(new THREE.Vector3()):new THREE.Vector3(30,30,3);
  const center=box?box.getCenter(new THREE.Vector3()):new THREE.Vector3();
  const radius=Math.max(8,size.length()/2),distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))/Math.min(1,camera.aspect)*1.1*zoom;
  camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance).add(center);
  camera.lookAt(center);camera.near=Math.max(.1,distance-radius*2);camera.far=distance+radius*5+100;camera.updateProjectionMatrix();renderer.render(scene,camera);
 }
 function rebuild(){
  lastBuild=performance.now();
  try{
   profiles=contours(active?.points.length>=2?[...state.strokes,active]:state.strokes);
   const geometry=solidGeometry(profiles,state.depth);
   if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh=null;}
   if(geometry){geometry.translate(0,0,-state.depth/2);geometry.computeBoundingBox();mesh=new THREE.Mesh(geometry,material);scene.add(mesh);}
   const triangles=geometry?geometry.getAttribute('position').count/3:0;
   $('metrics').textContent=profiles.length?`${profiles.length} ${profiles.length===1?'body':'bodies'} · ${Math.round(triangles)} faces`:'';
   $('empty').hidden=!!geometry||!!webglError;
   $('stl').disabled=!geometry;$('svg').disabled=!profiles.length;$('png').disabled=!renderer||!!webglError||!geometry;
   draw();view();
  }catch{tell('That stroke could not form a solid. Undo it or try a simpler outline.',true);}
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(t=>{frame=0;if(t-lastBuild>=70)rebuild();else schedule();});draw();}
 function refresh(message){if(frame){cancelAnimationFrame(frame);frame=0;}rebuild();controls();persist();if(message)tell(webglError||message,!!webglError);}
 function resize(){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  drawingRect={width:rect.width,height:rect.height,scale:Math.min(rect.width,rect.height)/60};
  const r=model.getBoundingClientRect();if(renderer&&r.width&&r.height){renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;}
  draw();view();
 }
 function point(event){const r=canvas.getBoundingClientRect();return {x:Math.max(-30,Math.min(30,(event.clientX-r.left-r.width/2)/drawingRect.scale)),y:Math.max(-30,Math.min(30,(r.height/2-event.clientY+r.top)/drawingRect.scale))};}
 canvas.addEventListener('pointerdown',event=>{
  if(active||event.button!==0)return;
  const total=state.strokes.reduce((n,s)=>n+s.points.length,0);
  if(state.strokes.length>=LIMITS.strokes||total>=LIMITS.totalPoints-2){tell('Sketch limit reached. Save this piece, then start another.',true);return;}
  checkpoint();active={kind:tool,width:state.width,points:[point(event)],pointer:event.pointerId,max:Math.min(LIMITS.points,LIMITS.totalPoints-total)};
  canvas.setPointerCapture(event.pointerId);event.preventDefault();draw();
 });
 canvas.addEventListener('pointermove',event=>{
  if(active?.pointer!==event.pointerId)return;
  for(const sample of event.getCoalescedEvents?.().length?event.getCoalescedEvents():[event]){
   const p=point(sample),last=active.points.at(-1);
   if(active.points.length<active.max&&Math.hypot(p.x-last.x,p.y-last.y)>.15)active.points.push(p);
  }
  schedule();
 });
 function finishStroke(event){
  if(active?.pointer!==event.pointerId)return;
  const {kind,width,points,max}=active,p=point(event);if(points.length<max&&Math.hypot(p.x-points.at(-1).x,p.y-points.at(-1).y)>.05)points.push(p);
  active=null;
  if(points.length>=2){state.strokes.push({kind,width,points});$('starter').value='custom';refresh('Sketch updated.');}
  else{state=undo.pop();refresh('A stroke needs two points.');}
 }
 canvas.addEventListener('pointerup',finishStroke);
 canvas.addEventListener('pointercancel',event=>{if(active?.pointer===event.pointerId){active=null;state=undo.pop();refresh('Stroke cancelled.');}});
 for(const button of all('tool'))button.addEventListener('click',()=>{tool=button.dataset.s3Tool;for(const b of all('tool'))b.setAttribute('aria-pressed',String(b===button));});
 $('undo').addEventListener('click',()=>{if(!undo.length||active)return;redo.push(structuredClone(state));state=undo.pop();refresh('Undone.');});
 $('redo').addEventListener('click',()=>{if(!redo.length||active)return;undo.push(structuredClone(state));state=redo.pop();refresh('Restored.');});
 $('clear').addEventListener('click',()=>{if(active)return;checkpoint();state.strokes=[];$('starter').value='blank';refresh('Canvas cleared. Undo restores your sketch.');});
 $('starter').addEventListener('change',event=>{if(active)return;checkpoint();state=starter(event.target.value);refresh('Starter loaded. Undo restores your previous sketch.');});
 for(const name of ['depth','width']){
  $(name).addEventListener('pointerdown',()=>{if(!active)checkpoint();});
  $(name).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))checkpoint();});
  $(name).addEventListener('input',()=>{state[name]=Number($(name).value);controls();schedule();});
  $(name).addEventListener('change',()=>refresh('Dimensions updated.'));
 }
 for(const button of all('finish'))button.addEventListener('click',()=>{checkpoint();state.finish=button.dataset.s3Finish;controls();view();persist();tell('Finish updated.');});
 $('grid').addEventListener('click',()=>{grid=!grid;$('grid').setAttribute('aria-pressed',String(grid));draw();});
 $('storage').addEventListener('change',()=>{enabledStorage=$('storage').checked;if(enabledStorage){persist();if(enabledStorage)tell('Sketch saved on this device.');}else{try{localStorage.removeItem(KEY);tell('Device saving turned off. Your current sketch stays open.');}catch{tell('Could not remove the saved copy from this browser.',true);}}});
 $('open').addEventListener('click',()=>$('file').click());
 $('file').addEventListener('change',async()=>{
  const file=$('file').files[0];if(!file)return;
  try{if(file.size>2_000_000)throw Error('Choose a sketch file smaller than 2 MB.');const opened=validateSketch(JSON.parse(await file.text()));checkpoint();state=opened;$('starter').value='custom';refresh('Saved sketch opened.');}
  catch(error){tell(error instanceof SyntaxError?'The file is not valid sketch JSON.':error.message,true);}
  finally{$('file').value='';}
 });
 function exporter(name,action){$(name).addEventListener('click',async()=>{try{if(active)return;rebuild();await action();root.querySelector('.s3-export').open=false;tell('Download prepared.');}catch{tell('Download failed. Your sketch is still open; please try again.',true);}});}
 exporter('save',()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'form-sketch.json'));
 exporter('svg',()=>download(new Blob([sketchSVG(profiles)],{type:'image/svg+xml'}),'form-sketch.svg'));
 exporter('stl',()=>{if(!mesh)throw Error();mesh.updateMatrixWorld(true);const data=new STLExporter().parse(mesh,{binary:true});download(new Blob([data],{type:'model/stl'}),'form-sketch.stl');});
 exporter('png',async()=>{if(!renderer||!mesh)throw Error();view();download(await canvasBlob(model),'form-sketch.png');});
 model.addEventListener('pointerdown',event=>{if(event.button!==0||orbit)return;orbit={id:event.pointerId,x:event.clientX,y:event.clientY};model.setPointerCapture(event.pointerId);});
 model.addEventListener('pointermove',event=>{if(orbit?.id!==event.pointerId)return;yaw+=(event.clientX-orbit.x)*.009;pitch=Math.max(-1.3,Math.min(1.3,pitch+(event.clientY-orbit.y)*.009));orbit.x=event.clientX;orbit.y=event.clientY;view();});
 const endOrbit=event=>{if(orbit?.id===event.pointerId)orbit=null;};model.addEventListener('pointerup',endOrbit);model.addEventListener('pointercancel',endOrbit);
 model.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(.7,Math.min(2,zoom*Math.exp(event.deltaY*.001)));view();},{passive:false});
 model.addEventListener('keydown',event=>{if(!event.key.startsWith('Arrow'))return;event.preventDefault();if(event.key==='ArrowLeft')yaw-=.1;if(event.key==='ArrowRight')yaw+=.1;if(event.key==='ArrowUp')pitch=Math.min(1.3,pitch+.1);if(event.key==='ArrowDown')pitch=Math.max(-1.3,pitch-.1);view();});
 $('front').addEventListener('click',()=>{yaw=0;pitch=0;zoom=1;view();});
 $('orbit').addEventListener('click',()=>{yaw=.55;pitch=.4;zoom=1;view();});
 $('full').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(model.parentElement.requestFullscreen)await model.parentElement.requestFullscreen();else tell('Fullscreen is unavailable here. The model remains interactive.',true);}catch{tell('This browser could not enter fullscreen.',true);}});
 model.addEventListener('webglcontextlost',event=>{event.preventDefault();webglError='3D rendering was interrupted. Save your sketch, then reload to restore the preview.';$('png').disabled=true;tell(webglError,true);});
 const observer=new ResizeObserver(resize);observer.observe(canvas);observer.observe(model);document.addEventListener('fullscreenchange',resize);
 controls();resize();refresh('Ready for your sketch.');if(restoreWarning)tell(restoreWarning,true);
}
