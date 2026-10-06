(()=>{
 const loaded=new Map();
 for(const card of document.querySelectorAll('[data-sw-lesson]')){
  const id=card.dataset.swLesson;const stage=card.querySelector('.sw-session');const button=card.querySelector('[data-sw-open]');const full=card.querySelector('[data-sw-full]');
  button?.addEventListener('click',()=>{
   if(loaded.has(id))return;
   const iframe=document.createElement('iframe');iframe.title=`Real ScenePilot ${id} lesson`;iframe.src=`/learn/scenepilot/workshops/?workshop=${encodeURIComponent(id)}&embed=card&auto=1`;iframe.loading='eager';iframe.allow='fullscreen';
   stage.replaceChildren(iframe);stage.classList.add('is-live');loaded.set(id,iframe);full.textContent='Continue this exact version ↗';
  });
  full?.addEventListener('click',e=>{const iframe=loaded.get(id);if(!iframe)return;e.preventDefault();iframe.contentWindow?.postMessage({type:'scenepilot-lesson-continue'},location.origin);full.textContent='Saving exact version…';setTimeout(()=>{if(full.textContent==='Saving exact version…')full.textContent='Continue this exact version ↗';},10000);});
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||![...loaded.values()].some(frame=>frame.contentWindow===e.source))return;
  if(e.data?.type==='scenepilot-lesson-continued'){
   try{const url=new URL(e.data.url);if(url.origin!==location.origin||url.pathname!=='/learn/scenepilot/workshops/'||url.searchParams.get('full')!=='1'||!/^scene-lesson-[a-f0-9-]{36}$/.test(url.searchParams.get('continue')||''))return;location.assign(url.href);}catch{}
  }
  if(e.data?.type==='scenepilot-lesson-error'){
   const frame=[...loaded.values()].find(f=>f.contentWindow===e.source);const card=frame?.closest('[data-sw-lesson]');let note=card?.querySelector('[data-sw-status]');if(!note&&card){note=document.createElement('p');note.dataset.swStatus='';note.setAttribute('role','status');card.append(note);}if(note)note.textContent=String(e.data.message||'Could not save. Download your cut and sources to keep editing.');
  }
 });
})();
