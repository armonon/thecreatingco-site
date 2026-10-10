/* Approved app identities. ScenePilot is intentionally excluded. */
(()=>{
 const ids=new Set('form luma stemdeck ghost librarian reclaim bounce locker sessions pocket-studio glyph-studio autocut captions board grade split key-bpm vox canvas pocket press mockups glyph cast'.split(' '));
 const aliases={'form studio':'form','luma studio':'luma','ghost studio':'ghost','key & bpm':'key-bpm',keybpm:'key-bpm',mockup:'mockups'};
 const key=name=>{const n=(name||'').trim().toLowerCase();return aliases[n]||n.replace(/\s+/g,'-')};
 function image(id,size=36){const i=document.createElement('img');i.src='/assets/app-logos/'+id+'.svg';i.alt='';i.width=i.height=size;i.className='cc-app-logo';i.dataset.appLogo=id;i.decoding='async';return i}
 function decorate(){
  document.querySelectorAll('.mm-launch-item').forEach(card=>{
   if(card.dataset.ccLogo)return;
   let id=key(card.querySelector('.launch-app-name,h3,strong')?.textContent);
   if(card.querySelector('a[href*="glyph-studio"]'))id='glyph-studio';
   if(!ids.has(id))return;
   const dot=card.querySelector('.mm-tool-dot');if(dot)dot.replaceWith(image(id));else card.prepend(image(id));card.dataset.ccLogo=id;
  });
  document.querySelectorAll('[data-mm-product],.ct-tool').forEach(card=>{
   if(card.dataset.ccLogo)return;
   const id=key(card.dataset.mmProduct||card.querySelector('h3')?.textContent);if(!ids.has(id))return;
   const icon=card.querySelector('.mm-notable-icon');
   if(icon)icon.replaceChildren(image(id,88));else{const h=card.querySelector('h3');if(h){h.classList.add('cc-logo-title');h.prepend(image(id,32))}}
   card.dataset.ccLogo=id;
  });
  document.querySelectorAll('img[src*="/assets/notable/"],img[src="/assets/bounce-app-icon.svg"],img[src="/locker/icon.svg"]').forEach(i=>{
   const fixed={'/assets/bounce-app-icon.svg':'bounce','/locker/icon.svg':'locker'}[i.getAttribute('src')]; if(fixed){i.src='/assets/app-logos/'+fixed+'.svg';i.classList.add('cc-existing-logo');return;}
   const match=i.getAttribute('src').match(/\/([^/]+)\.(png|webp)$/);if(!match||!ids.has(match[1]))return;
   i.src='/assets/app-logos/'+match[1]+'.svg';i.removeAttribute('srcset');i.classList.add('cc-existing-logo');
  });
  const product=key(location.pathname.match(/^\/products\/([^/]+)/)?.[1]);
  if(ids.has(product)&&!document.querySelector('[data-cc-hero-logo]')){
   const target=document.querySelector('.suite-eyebrow,.form-eyebrow,.tp-hero-copy .tp-eyebrow,.ph .eyebrow,.ph .overline');
   if(target){const mark=image(product,48);mark.dataset.ccHeroLogo='';target.prepend(mark);target.classList.add('cc-logo-eyebrow')}
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
 // Shared launchers may insert their tiles after the initial document parse.
 let queued=false;new MutationObserver(records=>{if(queued||!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.classList.contains('cc-app-logo'))))return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})}).observe(document.body,{childList:true,subtree:true});
})();
