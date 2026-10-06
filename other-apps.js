/* Explicit card navigation; screenshot and lesson controls keep their own keys. */
(() => {
 const section=document.querySelector('#other-apps'),track=section?.querySelector('[data-mm-notable-track]');
 if(!track)return;
 const prev=section.querySelector('[data-mm-notable-prev]'),next=section.querySelector('[data-mm-notable-next]');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const cards=()=>[...track.querySelectorAll('[data-mm-product]')].filter(card=>!card.hidden);
 const offsets=()=>cards().map(card=>card.offsetLeft-track.offsetLeft);
 const end=()=>Math.max(0,track.scrollWidth-track.clientWidth);
 function update(){prev.disabled=track.scrollLeft<2;next.disabled=track.scrollLeft>=end()-2;}
 function go(direction){
  const positions=offsets();
  const left=direction>0?positions.find(x=>x>track.scrollLeft+2):positions.reverse().find(x=>x<track.scrollLeft-2);
  track.scrollTo({left:Math.max(0,Math.min(end(),left??(direction>0?end():0))),behavior:motion.matches?'auto':'smooth'});
 }
 prev.addEventListener('click',()=>go(-1));next.addEventListener('click',()=>go(1));
 track.addEventListener('scroll',update,{passive:true});
 track.addEventListener('keydown',event=>{
  if(event.target!==track)return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();go(event.key==='ArrowRight'?1:-1);}
  if(event.key==='Home'||event.key==='End'){event.preventDefault();track.scrollTo({left:event.key==='End'?end():0,behavior:'auto'});}
 });
 document.querySelectorAll('[data-mm-filter]').forEach(button=>button.addEventListener('click',()=>{
  track.scrollTo({left:0,behavior:'auto'});requestAnimationFrame(update);
 }));
 section.addEventListener('toggle',update,true);
 if('ResizeObserver' in window)new ResizeObserver(update).observe(track);
 window.addEventListener('resize',update);update();
})();
