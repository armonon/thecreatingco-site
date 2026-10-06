import {record} from './mini-checkpoints.js';
for(const root of document.querySelectorAll('[data-mini-product]')){
 const product=root.dataset.miniProduct,picker=root.querySelector('[data-mini-select]'),options=[...picker.options],stage=root.querySelector('[data-mini-stage]'),status=root.querySelector('[data-mini-status]');
 const directions=[...root.querySelectorAll('[data-mini-direction]')];
 const controls=[...root.querySelectorAll('[data-mini-cycle]')],versions=new Map();let frame=null,active=picker.value,busy=false,pending=null,expanded=false,background=[],returnFocus,resizeObserver;
 const say=text=>{status.textContent=text;};
 const lock=value=>{busy=value;picker.disabled=value;controls.forEach(b=>b.disabled=value);directions.forEach(b=>b.disabled=value);root.querySelector('[data-mini-full]').setAttribute('aria-disabled',String(value));};
 const spec=id=>options.find(o=>o.value===id);
 function paint(id){
  active=id;picker.value=id;const option=spec(id);
  root.querySelector('[data-mini-title]').textContent=option.textContent;
  root.querySelector('[data-mini-description]').textContent=option.dataset.description;
  directions.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.miniLessons.split(' ').includes(id))));
  for(const [selector,key] of [['[data-mini-first-move]','firstMove'],['[data-mini-challenge]','challenge'],['[data-mini-hint]','hint']]){const node=root.querySelector(selector);if(node)node.textContent=option.dataset[key]||'';}
  const hint=root.querySelector('[data-mini-hint-box]');if(hint)hint.open=false;
  root.querySelector('[data-mini-count]').textContent='Lesson '+(options.indexOf(option)+1)+' of '+options.length;
  root.querySelector('[data-mini-full]').href=versions.get(id)||option.dataset.src;
  const poster=root.querySelector('[data-mini-poster]');poster.src=option.dataset.poster;poster.alt=option.textContent+' product example';
 }
 function checkpoint(){
  if(!frame)return Promise.resolve(null);
  if(pending)return Promise.reject(Error('A checkpoint is already being saved.'));
  return new Promise((resolve,reject)=>{
   const request=crypto.randomUUID(),timer=setTimeout(()=>{pending=null;reject(Error('Saving took too long. Your editor is still open. Retry or download your project.'));},30000);
   pending={request,timer,resolve,reject,lesson:active};
   frame.contentWindow.postMessage({type:product==='scenepilot'?'scenepilot-lesson-continue':'mini:checkpoint',request},location.origin);
  });
 }
 async function keep(){
  const payload=await checkpoint();if(payload===null)return;
  if(product==='scenepilot'){versions.set(active,payload);return;}
  const url=new URL(versions.get(active)||spec(active).dataset.src,location.origin),id=url.searchParams.get('miniResume')||crypto.randomUUID();
  await record('put',id,{product,lesson:active,payload});url.searchParams.set('miniResume',id);versions.set(active,url.href);
 }
 function mount(){
  if(frame)return;stage.setAttribute('aria-busy','true');frame=document.createElement('iframe');frame.title=spec(active).textContent+' interactive lesson';frame.allow='fullscreen';
  const url=new URL(versions.get(active)||spec(active).dataset.src,location.origin);
  if(product==='scenepilot'){url.searchParams.delete('full');url.searchParams.set('embed','card');url.searchParams.set('auto','1');}
  frame.src=url.href;stage.append(frame);root.querySelector('[data-mini-open]').hidden=true;root.querySelector('[data-mini-poster]').hidden=true;say('Opening your lesson…');
  const mounted=frame;
  frame.addEventListener('load',()=>{
   if(frame!==mounted)return;stage.setAttribute('aria-busy','false');root.querySelector('[data-mini-loading]')?.setAttribute('hidden','');say('Your lesson is open.');
   try{
    frame.contentDocument.addEventListener('keydown',event=>{if(event.key==='Escape')collapse();});
    if(root.hasAttribute('data-mini-autostart')&&'ResizeObserver' in window){
     const fit=()=>{if(frame!==mounted||expanded)return;const height=Math.max(640,Math.min(1800,mounted.contentDocument.documentElement.scrollHeight));if(Math.abs(mounted.clientHeight-height)>8)mounted.style.height=height+'px';};
     resizeObserver?.disconnect();resizeObserver=new ResizeObserver(fit);resizeObserver.observe(mounted.contentDocument.body);fit();
    }
   }catch{}
  });
 }
 async function choose(id,open=false){
  if(busy||!spec(id)){picker.value=active;return false;}
  if(id===active){if(open)mount();return true;}
  lock(true);const wasOpen=!!frame;
  try{if(frame){say('Keeping your edits…');await keep();resizeObserver?.disconnect();frame.remove();frame=null;}
   paint(id);say('');if(wasOpen||open)mount();return true;
  }catch(error){picker.value=active;say(error.message||'Could not save. Keep this editor open and download your project.');return false;}finally{lock(false);}
 }
 directions.forEach(button=>button.addEventListener('click',async()=>{if(await choose(button.dataset.miniDirection,true))root.querySelector('#scene-mini-studio')?.scrollIntoView({block:'start',behavior:'instant'});}));
 picker.addEventListener('change',()=>void choose(picker.value));
 controls.forEach(button=>button.addEventListener('click',()=>{const index=options.indexOf(spec(active)),delta=button.dataset.miniCycle==='next'?1:-1;void choose(options[(index+delta+options.length)%options.length].value);}));
 root.querySelector('[data-mini-open]').addEventListener('click',mount);
 root.querySelector('[data-mini-full]').addEventListener('click',async event=>{
  if(!frame)return;event.preventDefault();if(busy)return;lock(true);
  try{await keep();const url=versions.get(active);frame.remove();frame=null;paint(active);root.querySelector('[data-mini-open]').hidden=false;root.querySelector('[data-mini-poster]').hidden=false;say('Your saved version is ready.');location.assign(url);}catch(error){say(error.message);}finally{lock(false);}
 });
 function collapse(){if(!expanded)return;root.classList.remove('mini-expanded');root.removeAttribute('role');root.removeAttribute('aria-modal');background.forEach(([node,was])=>node.inert=was);background=[];expanded=false;document.body.classList.remove('mini-expanded-body');root.querySelector('[data-mini-expand]').setAttribute('aria-label','Expand lesson');returnFocus?.focus();}
 root.querySelector('[data-mini-expand]').addEventListener('click',()=>{
  if(expanded){collapse();return;}mount();returnFocus=document.activeElement;expanded=true;root.classList.add('mini-expanded');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');document.body.classList.add('mini-expanded-body');
  for(let branch=root;branch.parentElement;branch=branch.parentElement){for(const sibling of branch.parentElement.children)if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}if(branch.parentElement===document.body)break;}
  root.querySelector('[data-mini-expand]').setAttribute('aria-label','Close expanded lesson');
 });
 document.addEventListener('keydown',event=>{if(!expanded)return;if(event.key==='Escape')collapse();if(event.key==='Tab'){const nodes=[...root.querySelectorAll('button:not(:disabled),a[href],select:not(:disabled),iframe')].filter(n=>!n.hidden&&n.getClientRects().length);if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0].focus();}}});
 window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  const data=event.data;
  if(data?.type==='stemdeck-workshop-height'){const h=Number(data.height);if(Number.isFinite(h))frame.style.height=Math.max(600,Math.min(1000,h))+'px';return;}
  if(data?.type==='mini:ready'){say('Ready. Your turn.');return;}
  if(data?.type==='scenepilot-lesson-continued'){
   if(data.request&&data.request!==pending?.request)return;
   if(pending&&data.request!==pending.request)return;
   try{const url=new URL(data.url);if(url.origin!==location.origin||url.pathname!=='/learn/scenepilot/workshops/'||url.searchParams.get('workshop')!==active||url.searchParams.get('full')!=='1'||!/^scene-lesson-[a-f0-9-]{36}$/.test(url.searchParams.get('continue')||''))return;
    if(pending){clearTimeout(pending.timer);const p=pending;pending=null;p.resolve(url.href);}else location.assign(url.href);
   }catch{}return;
  }
  if(!pending)return;
  if(data?.type==='mini:checkpointed'&&data.request===pending.request&&data.lesson===active){
   clearTimeout(pending.timer);const p=pending;pending=null;
   if(data.payload==null)p.reject(Error('The editor did not return a saved project. Your editor is still open.'));else p.resolve(data.payload);
  }
  if(data?.type==='mini:error'&&data.request===pending.request||product==='scenepilot'&&data?.type==='scenepilot-lesson-error'&&data.request===pending.request){
   clearTimeout(pending.timer);const p=pending;pending=null;p.reject(Error(data.message||'The checkpoint could not be saved.'));
  }
 });
 const aliases={form:{tshirt:'tee',garment:'drape'},stemdeck:{balance:'stems',solo:'stems',cue:'cues',crossfade:'stems',keep:'arrange'},scenepilot:{story:'trim',rhythm:'autocut',draft:'autocut'}};
 async function entry(id){id=aliases[product]?.[id]||id;if(await choose(id,true))root.scrollIntoView({block:'start',behavior:'instant'});}
 document.addEventListener('mini:open',e=>{if(e.detail?.product===product)void entry(e.detail.lesson);});
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-pc-lesson]');if(!button)return;let url;try{url=new URL(button.dataset.pcLesson,location.origin);}catch{return;}
  if(url.origin!==location.origin)return;let id;
  if(url.pathname===`/learn/${product}/workshops/`)id=url.searchParams.get(product==='scenepilot'?'workshop':'lesson');
  else if(url.pathname===`/learn/product-try/${product}/`)id=options[0].value;
  if(!id)return;event.preventDefault();event.stopImmediatePropagation();void entry(id);
 },true);
 const requested=root.dataset.miniRequested||new URLSearchParams(location.search).get('lesson')||location.hash.match(/^#lesson-([a-z0-9-]+)$/)?.[1];paint(spec(root.dataset.miniDefault)?root.dataset.miniDefault:options[0].value);if(requested)void entry(requested);
 else if(root.hasAttribute('data-mini-autostart')){
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){mount();observer.disconnect();}},{rootMargin:'240px 0px'});observer.observe(root);}
  else mount();
 }
}
