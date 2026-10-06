// Keep at most one native editor; only release a committed local snapshot.
const boxes=[...document.querySelectorAll('[data-lg-editor]')],sessions=new WeakMap(),requests=new Map(),guides=new WeakSet(),focus=new WeakMap();
let resident=null,expanded=null,background=[],switching=false,idleTimer;
const article=b=>b.closest('article');
const picker=document.querySelector('[data-lg-select]'),cycleButtons=[...document.querySelectorAll('[data-lg-cycle]')];
function switchState(value){switching=value;if(picker)picker.disabled=value;cycleButtons.forEach(button=>button.disabled=value);}
function showLesson(box){
 boxes.forEach(b=>{article(b).hidden=b!==box;article(b).classList.toggle('is-selected',b===box);});
 if(picker)picker.value=box.dataset.lgEditor;
 const count=document.querySelector('[data-lg-count]');if(count)count.textContent='Lesson '+(boxes.indexOf(box)+1)+' of '+boxes.length;
}
const feedback=(b,message)=>{const n=b.querySelector('[data-lg-feedback]');n.textContent=message;n.hidden=!message;};
const sendGuide=b=>b.querySelector('iframe')?.contentWindow?.postMessage({type:'luma-box:guide'},location.origin);
function snapshot(box){
 if(!box.classList.contains('is-ready'))return Promise.reject(Error('This project is still opening. Try again when the canvas appears.'));
 if([...requests.values()].some(p=>p.box===box))return Promise.reject(Error('A checkpoint is already being saved. Please wait.'));
 return new Promise((resolve,reject)=>{
  const request=crypto.randomUUID(),timer=setTimeout(()=>{requests.delete(request);reject(Error('Saving took too long. Your editor is still open. Retry or download your .luma file.'));},30000);
  requests.set(request,{box,resolve,reject,timer});
  box.querySelector('iframe').contentWindow.postMessage({type:'luma-box:continue',request},location.origin);
 });
}
function release(box,url){
 sessions.set(box,url);box.querySelector('iframe')?.remove();box.classList.remove('is-ready');
 box.querySelector('.lg-editor-poster').hidden=false;box.querySelector('[data-lg-load]').hidden=false;
 box.querySelector('[data-lg-load]').textContent='Resume my version';box.querySelector('[data-lg-status]').textContent='Your version is saved in this browser.';
 article(box).querySelectorAll('[data-lg-continue]').forEach(link=>{link.href=url;link.textContent='Open my saved version';});
 resident=null;
}
async function load(box){
 if(box.querySelector('iframe'))return true;
 if(switching){feedback(box,'Finishing the previous checkpoint. Please try again in a moment.');return false;}
 switchState(true);
 try{
  if(resident){feedback(resident,'Keeping your edits before switching workshops...');const old=resident;release(old,await snapshot(old));feedback(old,'');}
  const frame=document.createElement('iframe'),url=new URL(sessions.get(box)||'/learn/luma/workshops/?workshop='+encodeURIComponent(box.dataset.lgEditor),location.origin);
  url.searchParams.set('embed','box');url.searchParams.set('ui','mobile-session-1');
  frame.src=url.href;frame.title='Luma Studio - '+article(box).querySelector('h3').textContent;frame.allow='fullscreen';
  box.querySelector('[data-lg-status]').textContent='Opening your Luma project...';box.querySelector('[data-lg-load]').hidden=true;
  feedback(box,'');resident=box;box.querySelector('.lg-editor-stage').append(frame);return true;
 }catch(error){feedback(resident||box,error.message);feedback(box,error.message);return false;}finally{switchState(false);}
}
function collapse(){
 if(!expanded)return;const box=expanded;
 box.classList.remove('is-expanded');box.removeAttribute('role');box.removeAttribute('aria-modal');
 box.querySelector('[data-lg-expand]').textContent='Expand editor';box.querySelector('[data-lg-expand]').setAttribute('aria-expanded','false');
 document.body.classList.remove('lg-editor-expanded');background.forEach(([n,was])=>{n.inert=was;});background=[];expanded=null;focus.get(box)?.focus();
}
async function expand(box){
 if(expanded===box){collapse();return;}if(!await load(box))return;
 collapse();focus.set(box,document.activeElement);expanded=box;box.classList.add('is-expanded');
 box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Expanded Luma editor');
 box.querySelector('[data-lg-expand]').textContent='Close expanded view';box.querySelector('[data-lg-expand]').setAttribute('aria-expanded','true');
 document.body.classList.add('lg-editor-expanded');
 for(let branch=box;branch.parentElement;branch=branch.parentElement){
  for(const sibling of branch.parentElement.children)if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}
  if(branch.parentElement===document.body)break;
 }
 box.querySelector('[data-lg-expand]').focus();
}
async function select(box){
 if(!box)return false;const selected=boxes.find(b=>article(b).classList.contains('is-selected'));if(selected===box)return true;
 if(resident&&resident!==box&&!await load(box)){document.querySelector('[data-lg-select]').value=selected.dataset.lgEditor;return false;}
 collapse();showLesson(box);
 return true;
}
async function openLesson(box){
 if(!box)return;article(box).removeAttribute('data-lg-requested');
 if(!await select(box))return;
 box.scrollIntoView({block:'start',behavior:'instant'});
 await load(box);
}
document.addEventListener('luma-box:open',event=>void openLesson(boxes.find(b=>b.dataset.lgEditor===event.detail?.lesson)));
document.querySelectorAll('.lg').forEach(s=>s.classList.add('lg-managed'));
const initial=boxes.find(b=>article(b).id===location.hash.slice(1))||boxes[0];
if(initial)showLesson(initial);
cycleButtons.forEach(button=>button.addEventListener('click',()=>{
 if(switching)return;const index=boxes.findIndex(b=>!article(b).hidden),delta=button.dataset.lgCycle==='next'?1:-1;
 void select(boxes[(index+delta+boxes.length)%boxes.length]);
}));
// Hero lessons use this player too, rather than mounting a second modal editor.
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-pc-lesson]');if(!button)return;
 let url;try{url=new URL(button.dataset.pcLesson,location.origin);}catch{return;}
 if(url.origin!==location.origin||url.pathname!=='/learn/luma/workshops/')return;
 const box=boxes.find(b=>b.dataset.lgEditor===url.searchParams.get('workshop'));if(!box)return;
 event.preventDefault();event.stopImmediatePropagation();void openLesson(box);
},true);
document.querySelector('[data-lg-select]')?.addEventListener('change',e=>void select(boxes.find(b=>b.dataset.lgEditor===e.target.value)));
document.querySelectorAll('[data-lg-choice]').forEach(link=>link.addEventListener('click',async e=>{
 e.preventDefault();const box=boxes.find(b=>b.dataset.lgEditor===link.dataset.lgChoice);await select(box);
 if(article(box).classList.contains('is-selected'))box.scrollIntoView({block:'start',behavior:'instant'});
}));
boxes.forEach(box=>{
 box.querySelector('[data-lg-load]').addEventListener('click',()=>void load(box));
 box.querySelector('[data-lg-expand]').addEventListener('click',()=>void expand(box));
 article(box).querySelector('[data-lg-guide]')?.addEventListener('click',async()=>{guides.add(box);if(await load(box))sendGuide(box);});
 article(box).querySelectorAll('[data-lg-continue]').forEach(link=>link.addEventListener('click',async event=>{
  if(link.getAttribute('aria-disabled')==='true'){event.preventDefault();return;}
  if(!box.querySelector('iframe'))return;event.preventDefault();const label=link.textContent;
  link.textContent='Keeping your edits...';link.setAttribute('aria-disabled','true');
  try{const url=await snapshot(box);sessions.set(box,url);link.href=url;link.textContent='Open my saved version';link.removeAttribute('aria-disabled');
   feedback(box,'Your editable version is saved. ');
   const fallback=document.createElement('a');fallback.href=url;fallback.textContent='Open the saved session';box.querySelector('[data-lg-feedback]').append(fallback);
   location.assign(url);
  }catch(error){link.textContent=label;feedback(box,error.message);}finally{link.removeAttribute('aria-disabled');}
 }));
});
window.addEventListener('message',event=>{
 if(event.origin!==location.origin)return;
 const box=boxes.find(b=>b.querySelector('iframe')?.contentWindow===event.source);if(!box)return;
 if(event.data?.type==='luma-box:ready'){
  box.classList.add('is-ready');box.querySelector('.lg-editor-poster').hidden=true;
  article(box).querySelectorAll('[data-lg-continue]').forEach(link=>{link.textContent='Continue this exact version';});
  if(guides.has(box)){sendGuide(box);guides.delete(box);}
  const frame=box.querySelector('iframe');
  try{if(!frame.dataset.keysBound){frame.dataset.keysBound='true';frame.contentDocument.addEventListener('keydown',e=>{
   if(expanded!==box)return;if(e.key==='Escape'&&!frame.contentDocument.querySelector('[role="dialog"],[role="alertdialog"]'))collapse();
   if(e.key==='Tab'){const nodes=[...frame.contentDocument.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length&&!n.closest('[hidden],[inert]'));
    if(frame.contentDocument.activeElement===(e.shiftKey?nodes[0]:nodes.at(-1))){e.preventDefault();box.querySelector('[data-lg-expand]').focus();}
   }
  });}}catch{}
 }
 if(event.data?.type==='luma-box:continued'){
  const pending=requests.get(event.data.request);if(event.data.request&&pending?.box!==box)return;
  try{const url=new URL(event.data.url),lesson=url.searchParams.get('workshop');
   if(url.origin!==location.origin||url.pathname!=='/learn/luma/workshops/'||!boxes.some(b=>b.dataset.lgEditor===lesson)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(url.searchParams.get('continue')||''))return;
   if(pending){clearTimeout(pending.timer);requests.delete(event.data.request);pending.resolve(url.href);}else if(!event.data.request)location.assign(url.href);
  }catch{}
 }
 if(event.data?.type==='luma-box:continue-error'){
  const pending=requests.get(event.data.request);if(pending?.box!==box)return;
  clearTimeout(pending.timer);requests.delete(event.data.request);pending.reject(Error(event.data.message||'Could not save this version. Download your .luma file before switching.'));
 }
 if(event.data?.type==='luma-box:error'){
  feedback(box,event.data.message||'The editor could not open. Try the full lesson.');box.querySelector('.lg-editor-poster').hidden=false;
  if(!box.classList.contains('is-ready')){box.querySelector('iframe')?.remove();resident=null;box.querySelector('[data-lg-load]').hidden=false;}
 }
});
// Crossing the viewport never loads a project. Inactive projects can be suspended safely.
const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{
 for(const entry of entries){
  if(entry.target!==resident)continue;clearTimeout(idleTimer);
  if(!entry.isIntersecting)idleTimer=setTimeout(async()=>{
   const box=entry.target;if(resident!==box||expanded===box||switching||!box.classList.contains('is-ready'))return;
   switchState(true);try{release(box,await snapshot(box));}catch(error){feedback(box,error.message);}finally{switchState(false);}
  },15000);
 }
},{rootMargin:'300px'}):null;
boxes.forEach(box=>observer?.observe(box));
const requested=boxes.find(box=>article(box).hasAttribute('data-lg-requested'));
if(requested)void openLesson(requested);
document.addEventListener('keydown',event=>{
 if(!expanded)return;if(event.key==='Escape'){event.preventDefault();collapse();}
 if(event.key==='Tab'){
  const first=expanded.querySelector('[data-lg-expand]'),frame=expanded.querySelector('iframe');
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();frame?.focus();}
  else if(!event.shiftKey&&document.activeElement===frame){event.preventDefault();first.focus();}
 }
});
