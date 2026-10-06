(() => {
  'use strict';
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let dialog=null,activeRoot=null,returnFocus=null;
  const states=[];
  function closeLesson(force=false) {
    const frame=dialog.querySelector('iframe');
    const guard=dialog.querySelector('.pc-close-guard');
    if(frame?.dataset.protect==='true'&&force!==true){frame.inert=true;guard.hidden=false;guard.querySelector('button').focus();return false;}
    guard.hidden=true;
    frame?.remove();dialog.close();returnFocus?.focus();activeRoot=null;states.forEach(s=>s.schedule());return true;
  }
  function openLesson(button,root) {
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='pc-dialog';
      const head=document.createElement('header'),title=document.createElement('strong');title.id='pc-lesson-title';
      dialog.setAttribute('aria-labelledby',title.id);
      const full=document.createElement('a');full.target='_blank';full.rel='noopener';full.textContent='Open full lesson';
      const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Close lesson');close.title='Close lesson';
      close.innerHTML=root.querySelector('[data-pc-close-icon]').innerHTML;
      head.append(title,full,close);dialog.append(head);document.body.append(dialog);
      const guard=document.createElement('section');guard.className='pc-close-guard';guard.hidden=true;
      guard.setAttribute('role','alertdialog');guard.setAttribute('aria-labelledby','pc-close-title');
      guard.setAttribute('aria-describedby','pc-close-description');
      guard.innerHTML='<strong id="pc-close-title">Close this lesson?</strong><p id="pc-close-description">Save or download any edits you want to keep before leaving.</p><div><button type="button">Keep editing</button><button type="button">Close lesson</button></div>';
      dialog.append(guard);
      function keepEditing(){guard.hidden=true;const frame=dialog.querySelector('iframe');if(frame)frame.inert=false;close.focus();}
      guard.querySelector('button').addEventListener('click',keepEditing);
      guard.querySelectorAll('button')[1].addEventListener('click',()=>closeLesson(true));
      close.addEventListener('click',()=>closeLesson());
      dialog.addEventListener('cancel',e=>{e.preventDefault();if(!guard.hidden)keepEditing();else closeLesson();});
    }
    returnFocus=button;activeRoot=root;
    const title=dialog.querySelector('strong');title.textContent=button.dataset.pcTitle;
    dialog.querySelector('a').href=button.dataset.pcLesson;
    const frame=document.createElement('iframe');frame.title=button.dataset.pcTitle+' interactive lesson';
    frame.src=button.dataset.pcLesson;frame.dataset.protect=button.dataset.pcProtect;frame.allow='fullscreen';
    dialog.append(frame);dialog.showModal();dialog.querySelector('button').focus();
    frame.addEventListener('load',()=>{
      try{frame.contentDocument.addEventListener('keydown',e=>{
        if(e.key==='Escape'&&!frame.contentDocument.querySelector('[role="dialog"],[role="alertdialog"],dialog[open]')){e.preventDefault();closeLesson();}
        if(e.key==='Tab'){
          const controls=[...frame.contentDocument.querySelectorAll('button:not(:disabled),summary,a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length&&!n.closest('[hidden],[inert]'));
          if(frame.contentDocument.activeElement===(e.shiftKey?controls[0]:controls.at(-1))){e.preventDefault();dialog.querySelector('button').focus();}
        }
      });}catch{}
    });
  }
  for(const root of document.querySelectorAll('[data-product-carousel]')){
    const slides=[...root.querySelectorAll('.pc-slide')],dots=[...root.querySelectorAll('[data-pc-go]')];
    const play=root.querySelector('[data-pc-play]');let index=0,timer=0,visible=false,hover=false,focused=false,playing=!motion.matches&&!root.hasAttribute('data-pc-static-cover'),start=null;
    function updatePlay(){
      play.setAttribute('aria-pressed',String(playing));play.setAttribute('aria-label',playing?'Pause slideshow':'Play slideshow');play.title=play.getAttribute('aria-label');
      root.querySelector('[data-pc-play-icon]').hidden=playing;root.querySelector('[data-pc-pause-icon]').hidden=!playing;
    }
    function schedule(){
      clearTimeout(timer);timer=0;
      if(playing&&visible&&!hover&&!focused&&!document.hidden&&!dialog?.open)timer=setTimeout(()=>{select(index+1,false);schedule();},7000);
    }
    function select(next,manual=true){
      index=(next+slides.length)%slides.length;
      slides.forEach((s,i)=>s.hidden=i!==index);dots.forEach((d,i)=>d.setAttribute('aria-pressed',String(i===index)));
      root.querySelector('[data-pc-caption]').textContent=slides[index].dataset.pcLabel;
      root.querySelector('.pc-caption [data-pc-kind]').textContent=slides[index].dataset.pcKind==='lesson'?'Interactive lesson':slides[index].dataset.pcKind==='artwork'?'Concept artwork':'Screenshot';
      root.querySelector('[data-pc-count]').textContent=(index+1)+' / '+slides.length;
      if(manual){playing=false;updatePlay();root.querySelector('[data-pc-announcement]').textContent=(index+1)+' of '+slides.length+': '+slides[index].dataset.pcLabel;}
      schedule();
    }
    root.querySelector('[data-pc-prev]').addEventListener('click',()=>select(index-1));
    root.querySelector('[data-pc-next]').addEventListener('click',()=>select(index+1));
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>select(i)));
    play.addEventListener('click',()=>{playing=!playing;if(playing){focused=false;hover=false;}updatePlay();schedule();});
    root.addEventListener('keydown',e=>{
      if(e.target.closest('[data-pc-lesson],a,input,select,textarea'))return;
      const next={ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:slides.length-1}[e.key];
      if(next!==undefined){e.preventDefault();select(next);}
    });
    root.addEventListener('pointerenter',()=>{hover=true;schedule();});
    root.addEventListener('pointerleave',()=>{hover=false;schedule();});
    root.addEventListener('focusin',()=>{focused=true;schedule();});
    root.addEventListener('focusout',()=>{queueMicrotask(()=>{focused=root.contains(document.activeElement);schedule();});});
    const stage=root.querySelector('.pc-stage');
    stage.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!e.target.closest('button,a'))start={x:e.clientX,y:e.clientY};});
    stage.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)select(index+(dx<0?1:-1));});
    stage.addEventListener('pointercancel',()=>start=null);
    root.querySelectorAll('[data-pc-lesson]').forEach(b=>b.addEventListener('click',()=>{playing=false;updatePlay();schedule();openLesson(b,root);}));
    root.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.alt='Preview unavailable. Open the product or lesson.';},true);
    const state={root,setVisible(v){visible=v;schedule();},pause(){playing=false;updatePlay();schedule();},schedule};states.push(state);updatePlay();
  }
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>states.find(s=>s.root===e.target)?.setVisible(e.isIntersecting)),{threshold:.15});states.forEach(s=>observer.observe(s.root));}
  else states.forEach(s=>s.setVisible(true));
  document.addEventListener('visibilitychange',()=>states.forEach(s=>s.schedule()));
  motion.addEventListener?.('change',()=>{if(motion.matches)states.forEach(s=>s.pause());});
  window.addEventListener('pagehide',()=>states.forEach(s=>s.pause()));
})();
