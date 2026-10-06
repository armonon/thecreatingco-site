import {record} from '../mini-checkpoints.js';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function checkedURL(value,lesson,origin){
 const url=new URL(value,origin),base=new URL(lesson.url,origin);
 if(url.origin!==origin||url.pathname!==base.pathname)throw Error('The saved project returned an unexpected address.');
 const parameter=['luma','scenepilot'].includes(lesson.product)?'workshop':'lesson';
 if(url.searchParams.get(parameter)!==lesson.id)throw Error('The saved project belongs to another lesson.');
 const key=url.searchParams.get(['luma','scenepilot'].includes(lesson.product)?'continue':'miniResume')||'';
 if(!(['scenepilot'].includes(lesson.product)?/^scene-lesson-[a-f0-9-]{36}$/.test(key):UUID.test(key)))throw Error('The editor did not return a valid saved project.');
 url.searchParams.delete('embed');url.searchParams.delete('auto');url.searchParams.delete('ui');
 return url;
}

export async function createLearnHub(root,{catalog,storage=record,navigate=url=>location.assign(url)}={}){
 const doc=root.ownerDocument,win=doc.defaultView,origin=win.location.origin;
 const lessons=catalog.lessons,products=catalog.products,picker=root.querySelector('[data-hub-picker]'),stage=root.querySelector('[data-hub-stage]');
 const find=key=>lessons.find(l=>l.key===key),start=product=>find(product+':'+products[product].start);
 const query=new URLSearchParams(win.location.search);
 const aliases={layers:'compose',tshirt:'tee',garment:'drape',balance:'stems',solo:'stems',rhythm:'autocut',story:'trim'};
 if(aliases[query.get('lesson')])query.set('lesson',aliases[query.get('lesson')]);
 const defaultProduct=query.get('product')||root.dataset.defaultProduct||'luma';
 let active=find(defaultProduct+':'+query.get('lesson'))||start(products[defaultProduct]?defaultProduct:'luma');
 let frame=null,busy=false,pending=null,sequencePending=null,ready=false,expanded=false,returnFocus=null,background=[];
 const versions=new Map(),directory='learn-hub-directory-v1';
 const say=message=>{root.querySelector('[data-hub-status]').textContent=message;};
 const lock=value=>{busy=value;root.querySelectorAll('[data-hub-product],[data-hub-open],[data-hub-cycle], [data-hub-picker],[data-hub-save],[data-hub-own]').forEach(n=>n.disabled=value);root.querySelector('[data-hub-continue]').setAttribute('aria-disabled',String(value));};
 try{
  const saved=await storage('get',directory);
  for(const [key,value] of Object.entries(saved?.versions||{})){
   const lesson=find(key);if(!lesson||!value||!Number.isFinite(value.savedAt)||Date.now()-value.savedAt>7*24*60*60*1000)continue;
   try{versions.set(key,{url:checkedURL(value.url,lesson,origin).href,savedAt:value.savedAt});}catch{}
  }
 }catch{say('Local recovery is unavailable. Use the editor’s project download to keep your work.');}

 function badges(){
  root.querySelectorAll('[data-hub-saved]').forEach(n=>{n.hidden=!versions.has(n.dataset.hubSaved);});
 }
 function paint(){
  root.querySelector('.hub-first-move').hidden=true;
  root.querySelector('[data-hub-expand]').textContent=expanded?'×':'⤢';
  root.dataset.activeProduct=active.product;
  root.querySelectorAll('.challenge-steps [data-hub-open]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.hubOpen===active.key&&!n.dataset.challengeMove)));
  root.querySelectorAll('[data-hub-product]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.hubProduct===active.product)));
  const choices=lessons.filter(l=>l.product===active.product);picker.replaceChildren();
  for(const lesson of choices){const option=doc.createElement('option');option.value=lesson.key;option.textContent=lesson.title;picker.append(option);}
  picker.value=active.key;
  root.querySelector('[data-hub-title]').textContent=active.title;
  root.querySelector('[data-hub-product-name]').textContent=products[active.product].name+' / REAL EDITOR';
  root.querySelector('[data-hub-move]').textContent=active.firstMove;
  root.querySelector('[data-hub-count]').textContent=`Lesson ${choices.indexOf(active)+1} of ${choices.length}`;
  const poster=root.querySelector('[data-hub-poster]');poster.src=active.poster;poster.alt=active.title+' — prepared project';
  root.querySelector('[data-hub-continue]').href=versions.get(active.key)?.url||active.url;
  root.querySelector('[data-hub-product-link]').href='/products/'+active.product+'/';
  root.querySelector('[data-hub-product-link]').textContent='About '+products[active.product].name+' ↗';
  badges();
 }
 async function checkpoint(){
  if(!frame)return null;
  if(pending)throw Error('A project is already being saved.');
  if(active.product==='luma'&&!ready)throw Error('Your Luma project is still opening. Wait for the canvas before switching.');
  return new Promise((resolve,reject)=>{
   const request=win.crypto.randomUUID(),timer=win.setTimeout(()=>{pending=null;reject(Error('Saving took too long. Your current editor stays open. Retry or download its project.'));},30000);
   pending={request,timer,resolve,reject,lesson:active};
   const type=active.product==='luma'?'luma-box:continue':active.product==='scenepilot'?'scenepilot-lesson-continue':'mini:checkpoint';
   frame.contentWindow.postMessage({type,request},origin);
  });
 }
 async function keep(){
  const payload=await checkpoint();if(payload===null)return;
  let url;
  if(['luma','scenepilot'].includes(active.product))url=checkedURL(payload,active,origin);
  else{
   if(payload==null)throw Error('The editor did not return your project. Your session stays open.');
   const id=win.crypto.randomUUID();await storage('put',id,{product:active.product,lesson:active.id,payload});
   url=new URL(active.url,origin);url.searchParams.set('miniResume',id);url=checkedURL(url.href,active,origin);
  }
  const latest=await storage('get',directory);
  const entry={url:url.href,savedAt:Date.now()},next=new Map([...Object.entries(latest?.versions||{}),...versions]);next.set(active.key,entry);
  await storage('put',directory,{versions:Object.fromEntries(next)});
  versions.set(active.key,entry);badges();root.querySelector('[data-hub-continue]').href=url.href;
  return {payload,url};
 }
 function mount(){
  if(frame)return;ready=false;stage.setAttribute('aria-busy','true');say('Opening '+products[active.product].name+'…');
  frame=doc.createElement('iframe');frame.title=products[active.product].name+' — '+active.title;frame.allow='fullscreen';
  const url=new URL(versions.get(active.key)?.url||active.url,origin);
  if(active.product==='luma'){url.searchParams.set('embed','box');url.searchParams.set('ui','mobile-session-1');}
  if(active.product==='form')url.searchParams.set('embed','box');
  if(['stemdeck','scenepilot'].includes(active.product))url.searchParams.set('auto','1');
  if(active.product==='scenepilot'){url.searchParams.delete('full');url.searchParams.set('embed','card');}
  const mounted=frame;
  frame.addEventListener('load',()=>{
   if(frame!==mounted)return;stage.setAttribute('aria-busy','false');root.querySelector('[data-hub-poster]').hidden=true;root.querySelector('[data-hub-mount]').hidden=true;
   if(active.product!=='luma'){ready=true;say('');}
   try{mounted.contentDocument.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented&&!mounted.contentDocument.querySelector('[role="dialog"],[role="alertdialog"]'))collapse();});}catch{}
  });
  frame.src=url.href;stage.append(frame);
 }
 async function choose(key,scroll=true){
  const next=find(key);if(!next||busy)return false;
  if(next.key===active.key){mount();if(scroll)root.querySelector('#learn-studio').scrollIntoView({block:'start',behavior:'instant'});return true;}
  lock(true);
  try{
   if(frame){
    say('Keeping your '+products[active.product].name+' project before switching…');const kept=await keep();
    // A first visit to another StemDeck exercise carries the exact current audio session.
    if(active.product==='stemdeck'&&next.product==='stemdeck'&&!versions.has(next.key)&&kept?.payload){
     const id=win.crypto.randomUUID();await storage('put',id,{product:'stemdeck',lesson:next.id,payload:kept.payload});
     const nextURL=new URL(next.url,origin);nextURL.searchParams.set('miniResume',id);
     const entry={url:nextURL.href,savedAt:Date.now()},latest=await storage('get',directory);
     await storage('put',directory,{versions:{...latest?.versions,[next.key]:entry}});versions.set(next.key,entry);
    }
    if(active.key==='luma:compose'&&next.key==='luma:effects'){
     const button=frame.contentDocument?.querySelector('.lw-chain button');
     if(button){
      await new Promise((resolve,reject)=>{const timer=win.setTimeout(()=>{sequencePending=null;reject(Error('The effects step did not open. Your composition stays here.'));},30000);sequencePending={resolve,timer};button.click();});
      if(scroll)root.querySelector('#learn-studio').scrollIntoView({block:'start',behavior:'instant'});return true;
     }
    }
    frame.remove();frame=null;
   }
   active=next;paint();mount();
   const url=new URL(win.location.href);url.searchParams.set('product',active.product);url.searchParams.set('lesson',active.id);url.hash='studio';win.history.replaceState(null,'',url.href);
   if(scroll)root.querySelector('#learn-studio').scrollIntoView({block:'start',behavior:'instant'});
   return true;
  }catch(error){picker.value=active.key;say(error.message||'Could not save. Your current session stays open.');return false;}finally{lock(false);}
 }
 function collapse(){
  if(!expanded)return;const pane=root.querySelector('#learn-studio');pane.classList.remove('hub-expanded');pane.removeAttribute('role');pane.removeAttribute('aria-modal');
  doc.body.classList.remove('hub-expanded-body');background.forEach(([n,was])=>n.inert=was);background=[];expanded=false;
  root.querySelector('[data-hub-expand]').textContent='⤢';root.querySelector('[data-hub-expand]').setAttribute('aria-label','Expand studio');returnFocus?.focus();
 }
 root.querySelector('[data-hub-expand]').addEventListener('click',()=>{
  if(expanded){collapse();return;}mount();const pane=root.querySelector('#learn-studio');returnFocus=doc.activeElement;expanded=true;
  pane.classList.add('hub-expanded');pane.setAttribute('role','dialog');pane.setAttribute('aria-modal','true');doc.body.classList.add('hub-expanded-body');
  for(let branch=pane;branch.parentElement;branch=branch.parentElement){for(const sibling of branch.parentElement.children)if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}if(branch.parentElement===doc.body)break;}
  root.querySelector('[data-hub-expand]').textContent='×';root.querySelector('[data-hub-expand]').setAttribute('aria-label','Close expanded studio');root.querySelector('[data-hub-expand]').focus();
 });
 doc.addEventListener('keydown',e=>{
  if(!expanded)return;if(e.key==='Escape')collapse();
  if(e.key==='Tab'){const nodes=[...root.querySelector('#learn-studio').querySelectorAll('button:not(:disabled),a[href],select:not(:disabled),summary,iframe')].filter(n=>n.getClientRects().length);if(e.shiftKey&&doc.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&doc.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}
 });
 root.querySelectorAll('[data-hub-product]').forEach(n=>n.addEventListener('click',()=>void choose(start(n.dataset.hubProduct).key)));
 // Capability links and older product CTAs share the same save-before-switch path.
 doc.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  let target;try{target=new URL(link.href,origin);}catch{return;}
  if(target.origin!==origin||target.pathname!==win.location.pathname||!target.searchParams.has('lesson'))return;
  const id=aliases[target.searchParams.get('lesson')]||target.searchParams.get('lesson'),lesson=find(active.product+':'+id);
  if(!lesson)return;event.preventDefault();event.stopImmediatePropagation();void choose(lesson.key);
 },true);
 root.querySelectorAll('[data-hub-open]').forEach(n=>n.addEventListener('click',async e=>{e.preventDefault();if(await choose(n.dataset.hubOpen)){if(n.dataset.challengeMove){root.querySelectorAll('.challenge-steps [data-hub-open]').forEach(b=>b.setAttribute('aria-pressed',String(b===n)));root.querySelector('[data-hub-move]').textContent=n.dataset.challengeMove;root.querySelector('.hub-first-move').hidden=false;root.querySelector('.hub-first-move').open=true;}}}));
 const workMenu=root.querySelector('.hub-work-menu');
 workMenu?.addEventListener('click',e=>{if(e.target.closest('button,a'))workMenu.open=false;});
 doc.addEventListener('click',e=>{if(workMenu&&!workMenu.contains(e.target))workMenu.open=false;});
 workMenu?.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();workMenu.open=false;workMenu.querySelector('summary').focus();}});
 picker.addEventListener('change',()=>void choose(picker.value,false));
 root.querySelectorAll('[data-hub-cycle]').forEach(n=>n.addEventListener('click',()=>{const choices=lessons.filter(l=>l.product===active.product),index=choices.indexOf(active),delta=n.dataset.hubCycle==='next'?1:-1;void choose(choices[(index+delta+choices.length)%choices.length].key,false);}));
 root.querySelector('[data-hub-mount]').addEventListener('click',mount);
 root.querySelector('[data-hub-save]')?.addEventListener('click',async()=>{
  if(busy)return;lock(true);try{mount();say('Saving your project…');await keep();say('Saved in Your work on this browser. Download a portable copy to keep it.');}catch(error){say(error.message);}finally{lock(false);}
 });
 root.querySelector('[data-hub-own]')?.addEventListener('click',async()=>{
  if(busy)return;lock(true);try{mount();say('Keeping your starter before opening the full tools…');await keep();const next=new URL(versions.get(active.key).url);next.searchParams.set('own','1');navigate(next.href);}catch(error){say(error.message);}finally{lock(false);}
 });
 root.querySelector('[data-hub-continue]').addEventListener('click',async e=>{
  if(!frame)return;e.preventDefault();if(busy)return;lock(true);
  try{say('Keeping your exact version…');await keep();navigate(versions.get(active.key).url);}catch(error){say(error.message);}finally{lock(false);}
 });
 win.addEventListener('message',e=>{
  if(e.origin!==origin||e.source!==frame?.contentWindow)return;const data=e.data;
  // Luma's native sequence carries the same eight-layer document into effects.
  if((!busy||sequencePending)&&active.key==='luma:compose'&&data?.type==='luma-box:ready'&&data.lesson==='effects'){active=find('luma:effects');frame.title=products.luma.name+' — '+active.title;paint();const url=new URL(win.location.href);url.searchParams.set('product','luma');url.searchParams.set('lesson','effects');win.history.replaceState(null,'',url.href);if(sequencePending){win.clearTimeout(sequencePending.timer);const saved=sequencePending;sequencePending=null;saved.resolve();}}
  if(data?.type==='luma-box:ready'&&data.lesson===active.id){ready=true;stage.setAttribute('aria-busy','false');root.querySelector('[data-hub-poster]').hidden=true;root.querySelector('[data-hub-mount]').hidden=true;say('');return;}
  if(data?.type==='luma-box:error'){say(data.message||'Luma could not open this project. Your session stays here.');return;}
  const continued=active.product==='luma'&&data?.type==='luma-box:continued'||active.product==='scenepilot'&&data?.type==='scenepilot-lesson-continued';
  if(continued){
   if(data.request&&data.request!==pending?.request)return;
   try{const url=checkedURL(data.url,active,origin);if(pending&&data.request===pending.request){win.clearTimeout(pending.timer);const p=pending;pending=null;p.resolve(url.href);}else if(!data.request)navigate(url.href);}catch{}
   return;
  }
  if(!pending||data?.request!==pending.request)return;
  if(data.type==='mini:checkpointed'&&data.lesson===active.id&&['form','stemdeck'].includes(active.product)){
   win.clearTimeout(pending.timer);const p=pending;pending=null;if(data.payload==null)p.reject(Error('No project was returned. Your session stays open.'));else p.resolve(data.payload);return;
  }
  if(['mini:error','luma-box:continue-error','scenepilot-lesson-error'].includes(data.type)){win.clearTimeout(pending.timer);const p=pending;pending=null;p.reject(Error(data.message||'Could not save. Your current session stays open.'));}
 });

 // Discovery changes never replace the project someone is editing.
 if(root.querySelector('[data-hub-search]')){
 let productFilter=root.dataset.libraryProduct||'all',limit=8;
 const search=root.querySelector('[data-hub-search]'),level=root.querySelector('[data-hub-level]'),cards=[...root.querySelectorAll('[data-hub-card]')];
 function filter(){
  const words=search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches=cards.filter(n=>{const l=find(n.dataset.hubCard);return(productFilter==='all'||l.product===productFilter)&&(level.value==='all'||l.level===level.value)&&words.every(w=>(products[l.product].name+' '+l.title+' '+l.description+' '+l.skills).toLocaleLowerCase().includes(w));});
  cards.forEach(n=>n.hidden=!matches.slice(0,limit).includes(n));
  root.querySelector('[data-hub-results]').textContent=matches.length?`${matches.length} ${matches.length===1?'lesson':'lessons'} · showing ${Math.min(limit,matches.length)}`:'No lessons match. Try another feature or choose All products.';
  root.querySelector('[data-hub-more]').hidden=limit>=matches.length;root.querySelector('[data-hub-empty]').hidden=matches.length>0;
  root.querySelectorAll('[data-hub-filter]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.hubFilter===productFilter)));
 }
 search.addEventListener('input',()=>{limit=8;filter();});level.addEventListener('change',()=>{limit=8;filter();});
 root.querySelectorAll('[data-hub-filter]').forEach(n=>n.addEventListener('click',()=>{productFilter=n.dataset.hubFilter;limit=8;filter();}));
 root.querySelector('[data-hub-more]').addEventListener('click',()=>{limit+=8;filter();});
 root.querySelector('[data-hub-clear]').addEventListener('click',()=>{search.value='';level.value='all';productFilter='all';limit=8;filter();search.focus();});
 filter();
 }
 paint();
 if('IntersectionObserver'in win){const observer=new win.IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){mount();observer.disconnect();}},{rootMargin:'150px'});observer.observe(stage);}else mount();
 return {choose,keep,mount,get active(){return active;},get frame(){return frame;}};
}

const root=document.querySelector('[data-learn-hub]');
if(root){try{const catalog=JSON.parse(document.getElementById('learn-catalog').textContent);void createLearnHub(root,{catalog}).catch(()=>{root.querySelector('[data-hub-status]').textContent='The mini studio could not start. Open a lesson directly from its project link below.';});}catch(error){root.querySelector('[data-hub-status]').textContent='The mini studio could not start. Open a lesson directly from its project link below.';}}
