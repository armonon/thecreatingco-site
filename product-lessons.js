/* Canonical lesson entry points use the native editor already on the page. */
(() => {
  const page = document.querySelector('[data-product-lessons]');
  if (!page) return;
  const key = page.dataset.productLessons;
  const aliases = {
    luma: {layers:'compose',mask:'campaign',mood:'grade',type:'weave',outputs:'identity'},
    stemdeck: {balance:'stems',solo:'stems',cue:'cues',crossfade:'stems',keep:'arrange'},
    scenepilot: {story:'trim',rhythm:'autocut',draft:'autocut'},
    form: {tshirt:'tee'}
  };
  function open(id) {
    id = aliases[key]?.[id] || id;
    if(!/^[a-z0-9-]+$/.test(id))return;
    const player=document.querySelector('[data-mini-product]');
    if(player){player.dataset.miniRequested=id;document.dispatchEvent(new CustomEvent('mini:open',{detail:{product:key,lesson:id}}));return;}
    if (key === 'stemdeck') {
      document.querySelector(`[data-native-lesson="${id}"]`)?.click();
      return;
    }
    const target = document.getElementById(key === 'luma' ? 'workshop-'+id : (key==='form'&&id==='architecture'?'form-architecture':'lesson-'+id));
    if (!target) return;
    if (key === 'luma') {
      // The session owner waits for a safe checkpoint before selecting and scrolling.
      target.setAttribute('data-lg-requested','');
      document.dispatchEvent(new CustomEvent('luma-box:open',{detail:{lesson:id}}));
      return;
    }
    target.classList.add('pr-lesson-target');
    for (let parent=target.parentElement;parent;parent=parent.parentElement) if(parent.tagName==='DETAILS')parent.open=true;
    if (target.hidden) {
      const grid=target.closest('.sw-grid');
      grid?.nextElementSibling?.matches('.pr-expand') && grid.nextElementSibling.click();
      target.hidden=false;
    }
    target.scrollIntoView({block:'start',behavior:'instant'});
    if(key==='form'&&id==='architecture')return;
    if (key === 'scenepilot') {
      target.querySelector('[data-sw-open]')?.click();
      return;
    }
    // Form mounts its native thumbnail lazily. Observe its rendered control.
    let observer;
    const load=()=>{
      if(key==='luma'&&!target.classList.contains('is-selected'))return false;
      const button=target.querySelector(key==='form'?'.form-box-start':'[data-lg-load]');
      if(!button)return false;
      observer?.disconnect();button.click();return true;
    };
    if(!load()){
      observer=new MutationObserver(()=>load());
      observer.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
  }
  document.querySelectorAll('[data-pr-lesson]').forEach(link=>link.addEventListener('click',event=>{
    event.preventDefault();
    const id=link.dataset.prLesson;
    const url=new URL(location.href);
    url.searchParams.set('lesson',id);
    url.hash=link.getAttribute('href');
    history.replaceState(null,'',url);
    open(id);
  }));
  const requested=new URLSearchParams(location.search).get('lesson') || location.hash.match(/^#(?:lesson|workshop)-([a-z0-9-]+)$/)?.[1];
  if(requested)open(requested);
})();
