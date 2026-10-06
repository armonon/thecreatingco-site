const valid=new Set(['stems','cues','arrange','effects']);
for(const root of document.querySelectorAll('.sn-section')){
 const session=root.querySelector('[data-native-session]'),frame=session?.querySelector('iframe');if(!frame)continue;
 let active=null;
 const open=id=>{
  if(!valid.has(id)||active===id)return;
  if(active&&!confirm('Switch exercises? Save project in the studio first to keep your edits.'))return;
  active=id;const url='/learn/stemdeck/workshops/?lesson='+id;
  frame.src=url;root.querySelector('[data-native-full]').href=url;session.hidden=false;
  root.querySelectorAll('[data-native-lesson]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.nativeLesson===id)));
  session.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 };
 root.querySelectorAll('[data-native-lesson]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.nativeLesson)));
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='stemdeck-workshop-height')return;const height=Number(event.data.height);if(Number.isFinite(height))frame.style.height=Math.max(480,Math.min(2400,height))+'px'});
 const requested=new URLSearchParams(location.search).get('lesson');if(valid.has(requested))open(requested);
}
