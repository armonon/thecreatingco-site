const videos=[...document.querySelectorAll('[data-launch-demo]')];
const toggle=document.querySelector('[data-demo-toggle]');
const preference=matchMedia('(prefers-reduced-motion: reduce)');
let paused=preference.matches;
const visible=new Set();
function sync(){
 if(toggle){toggle.textContent=paused?'Play demos':'Pause demos';toggle.setAttribute('aria-label',paused?'Play all product demos':'Pause all product demos');}
 for(const video of videos){
  if(paused||!visible.has(video)||document.hidden){video.pause();continue;}
  const source=video.querySelector('source');if(!source.src){source.src=source.dataset.src;video.load();}
  video.muted=true;video.play().catch(error=>{if(error.name!=='AbortError')video.controls=true;});
 }
}
toggle?.addEventListener('click',()=>{paused=!paused;sync();});
preference.addEventListener('change',()=>{paused=preference.matches;sync();});
document.addEventListener('visibilitychange',sync);
if('IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)visible.add(entry.target);else visible.delete(entry.target);}sync();},{threshold:.1});videos.forEach(v=>observer.observe(v));
}else{videos.forEach(v=>visible.add(v));}sync();
const form=document.querySelector('[data-launch-form]');
form?.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;
 const button=form.querySelector('button[type=submit]'),status=form.querySelector('[data-launch-status]');if(button.disabled)return;
 const values=new FormData(form);if(String(values.get('bot-field')||'').trim())return;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);button.disabled=true;button.textContent='Joining…';status.textContent='Sending your signup request…';
 try{
  const response=await fetch('/',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});
  if(!response.ok)throw Error('We couldn’t confirm your signup.');
  status.textContent='Your launch-list request has been received. Thank you for helping shape thecreateco. No payment or account was created.';form.reset();
 }catch(error){status.textContent=error.name==='AbortError'?'The request timed out. Your email is still here. Please retry; if you already joined, there is no need to submit again.':'We couldn’t confirm your signup. Your email is still here—please try again, or contact us through Testing & feedback.';}
 finally{clearTimeout(timeout);button.disabled=false;button.textContent='Join the launch list ↗';}
});
