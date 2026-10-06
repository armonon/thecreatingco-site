// Only shown after the learner explicitly chooses “Use my own media.”
if(new URLSearchParams(location.search).get('own')==='1'){
 const product=location.pathname.split('/')[2],guides={
  form:'Your saved model is open. Use the studio’s project or import controls to bring in your own SVG or geometry. Save a native project before replacing the current document.',
  luma:'Your saved layers are open. Use the studio’s File / image import controls to add your own image, then keep the artwork on separate editable layers. The captured-brush lesson shows how to turn a motif into a brush.',
  stemdeck:'Your saved session is open. Use the Library import control to add your audio. Existing separated stems can be mixed immediately; a mixed song does not become separated stems just by muting a lane.',
  scenepilot:'Your saved edit is open. Use the source-media import controls to add your own footage or audio. Keep your media with the editable cut when you download it.'
 };
 const show=()=>{if(!document.body)return;const box=document.createElement('aside');box.setAttribute('aria-label','Use your own media');box.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;max-width:620px;margin:auto;z-index:99999;padding:16px;background:#f6f7ef;color:#22271f;border:1px solid #7d8975;border-radius:10px;box-shadow:0 8px 28px #0003;font:14px/1.5 system-ui';const p=document.createElement('p');p.textContent=guides[product]||'Use the native import controls to add your own media.';p.style.margin='0 0 12px';const close=document.createElement('button');close.textContent='Got it — keep editing';close.style.cssText='min-height:44px;padding:10px 16px;border:1px solid #22271f;border-radius:6px;background:#22271f;color:white;font:inherit';close.onclick=()=>box.remove();box.append(p,close);document.body.append(box);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
}
