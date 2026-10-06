import {record} from './mini-checkpoints.js';
import {checkpoint,continuationUrl} from './first-move-session.js';
const root=document.querySelector('[data-first-moves]');
if(root){
 const tabs=[...root.querySelectorAll('[data-fm-key]')],panels=[...root.querySelectorAll('[data-fm-panel]')],session=root.querySelector('[data-fm-session]'),host=root.querySelector('[data-fm-editor]'),status=root.querySelector('[data-fm-status]'),continueLink=root.querySelector('[data-fm-continue]'),shuffle=document.querySelector('[data-mm-shuffle]');
 const versions=new Map();let active='luma',frame=null,busy=false;
 try{const stored=JSON.parse(sessionStorage.getItem('momentium-first-moves-v1')||'{}');for(const [key,value]of Object.entries(stored)){const url=new URL(value);if(url.origin===location.origin&&url.pathname===`/learn/${key}/workshops/`)versions.set(key,url.href);}}catch{}
 const panel=key=>panels.find(n=>n.dataset.fmPanel===key);
 const say=message=>{status.textContent=message;};
 function lock(value){busy=value;root.querySelectorAll('button').forEach(b=>b.disabled=value);shuffle.disabled=value;continueLink.setAttribute('aria-disabled',String(value));}
 function paint(key,focus=false){
  active=key;tabs.forEach(t=>{const selected=t.dataset.fmKey===key;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;if(selected&&focus)t.focus({preventScroll:true});});
  panels.forEach(p=>p.hidden=p.dataset.fmPanel!==key);const p=panel(key);
  root.querySelector('[data-fm-selection]').textContent=p.dataset.fmName+' · '+p.querySelector('h2').textContent;
  root.querySelector('[data-fm-session-name]').textContent=p.dataset.fmName+' / YOUR SESSION';
  root.querySelector('[data-fm-session-title]').textContent=p.querySelector('h2').textContent;
  root.querySelector('[data-fm-session-prompt]').textContent=p.querySelector('.fm-challenge').textContent;
  continueLink.href=versions.get(key)||p.dataset.fmSrc;
  p.querySelector('[data-fm-open]').firstChild.textContent=(versions.has(key)?'Resume in ':'Try it in ')+p.dataset.fmName+' ';
 }
 async function keep(){
  const p=panel(active);const result=await checkpoint(frame,{product:active,lesson:p.dataset.fmLesson,origin:location.origin});
  let saved=result.url;
  if(result.payload!==undefined){const url=new URL(versions.get(active)||p.dataset.fmSrc,location.origin),id=url.searchParams.get('miniResume')||crypto.randomUUID();await record('put',id,{product:active,lesson:p.dataset.fmLesson,payload:result.payload});url.searchParams.set('miniResume',id);saved=url.href;}
  versions.set(active,saved);try{sessionStorage.setItem('momentium-first-moves-v1',JSON.stringify(Object.fromEntries(versions)));}catch{}
  continueLink.href=saved;return saved;
 }
 function release(){frame.remove();frame=null;root.classList.remove('fm-editing');session.hidden=true;panels.forEach(p=>p.classList.remove('fm-in-session'));}
 async function choose(key,focus=false){
  if(busy||key===active)return;
  lock(true);
  try{if(frame){say('Keeping your edits before switching…');await keep();release();}root.querySelectorAll('audio,video').forEach(m=>m.pause());paint(key,focus);say('');}
  catch(error){say(error.message+' Your current session stays open.');}finally{lock(false);}
 }
 function mount(){
  if(frame||busy)return;const p=panel(active),url=new URL(versions.get(active)||p.dataset.fmSrc,location.origin);
  if(active==='luma'){url.searchParams.set('embed','box');url.searchParams.set('ui','mobile-session-1');}
  if(active==='scenepilot'){url.searchParams.delete('full');url.searchParams.set('embed','card');url.searchParams.set('auto','1');}
  if(active==='form')url.searchParams.set('embed','box');
  root.querySelectorAll('audio,video').forEach(m=>m.pause());
  frame=document.createElement('iframe');frame.title=p.dataset.fmName+' — '+p.querySelector('h2').textContent;frame.allow='fullscreen';frame.src=url.href;
  host.append(frame);session.hidden=false;p.classList.add('fm-in-session');root.classList.add('fm-editing');say('Opening your prepared project…');
  frame.addEventListener('load',()=>{say('Your session is open. '+p.querySelector('.fm-challenge').textContent);
   if(active==='stemdeck'){try{const doc=frame.contentDocument;doc.body.classList.add('fm-home-session');const style=doc.createElement('link');style.rel='stylesheet';style.href='/first-moves-native.css';doc.head.append(style);const start=()=>{const button=doc.querySelector('.sw-start');if(!button)return false;button.click();return true;};if(!start()){const observer=new MutationObserver(()=>{if(start())observer.disconnect();});observer.observe(doc.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);}}catch{}}
  });
  session.scrollIntoView({block:'start',behavior:'instant'});
 }
 tabs.forEach((t,i)=>{t.addEventListener('click',()=>void choose(t.dataset.fmKey));t.addEventListener('keydown',e=>{const keys={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1};if(e.key in keys){e.preventDefault();void choose(tabs[keys[e.key]].dataset.fmKey,true);}});});
 panels.forEach(p=>p.querySelectorAll('[data-fm-open]').forEach(b=>b.addEventListener('click',mount)));
 shuffle.addEventListener('click',()=>{const other=tabs.filter(t=>t.dataset.fmKey!==active);void choose(other[Math.floor(Math.random()*other.length)].dataset.fmKey,true);});
 root.querySelector('[data-fm-back]').addEventListener('click',async()=>{if(busy||!frame)return;lock(true);try{say('Keeping your version…');await keep();release();paint(active);panel(active).querySelector('[data-fm-open]').focus({preventScroll:true});}catch(error){say(error.message);}finally{lock(false);}});
 continueLink.addEventListener('click',async event=>{
  event.preventDefault();if(busy||!frame)return;lock(true);
  try{say('Keeping your version…');const saved=new URL(await keep());saved.searchParams.delete('embed');saved.searchParams.delete('ui');location.assign(saved.href);}catch(error){say(error.message);}finally{lock(false);}
 });
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  if(!event.data?.request&&!busy){const saved=continuationUrl(event.data,active,panel(active).dataset.fmLesson,location.origin);if(saved){location.assign(saved);return;}}
  if(['luma-box:error','mini:error','scenepilot-lesson-error'].includes(event.data?.type)&&!event.data.request)say(event.data.message||'The project could not open. Try its full product page.');
  if(event.data?.type==='stemdeck-workshop-height'){const h=Number(event.data.height);if(Number.isFinite(h))frame.style.height=Math.max(600,Math.min(1000,h))+'px';}
 });
 paint(active);
}
