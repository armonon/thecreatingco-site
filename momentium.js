/* Real product navigation and project exploration. No autoplay or remote state. */
(() => {
  const all = (s, root = document) => [...root.querySelectorAll(s)];
  const shuffleIndex = (length, current) => length < 2 ? 0 : (current + 1 + Math.floor(Math.random() * (length - 1))) % length;
  const feature = document.querySelector('[data-mm-feature]');
  if (feature) {
    const tabs = all('[role=tab]', feature), panels = all('[role=tabpanel]', feature);
    let selected = Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'));
    function select(index, focus = false) {
      selected = (index + tabs.length) % tabs.length;
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === selected)); tab.tabIndex = i === selected ? 0 : -1;
        panels[i].hidden = i !== selected;
      });
      feature.querySelector('[data-mm-feature-status]').textContent = tabs[selected].textContent.trim() + ' selected.';
      if (focus) tabs[selected].focus({preventScroll:true});
      const list=feature.querySelector('[role=tablist]'), tab=tabs[selected];
      if(tab.offsetLeft < list.scrollLeft || tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollTo({left:tab.offsetLeft-list.offsetLeft-list.clientWidth/2+tab.offsetWidth/2,behavior:'auto'});
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', e => {
        const keys={ArrowRight:selected+1,ArrowLeft:selected-1,Home:0,End:tabs.length-1};
        if(e.key in keys){e.preventDefault();select(keys[e.key],true);}
      });
    });
    document.querySelector('[data-mm-shuffle]').addEventListener('click',()=>select(shuffleIndex(tabs.length,selected)));
    select(selected);
  }
  const filters = all('[data-mm-filter]'), cards=all('[data-mm-category]');
  filters.forEach(button=>button.addEventListener('click',()=>{
    const value=button.dataset.mmFilter;
    filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    let count=0; cards.forEach(card=>{card.hidden=value!=='All tools' && card.dataset.mmCategory!==value;if(!card.hidden)count++;});
    all('[data-mm-tool-group]').forEach(group=>{
      let empty=group.querySelector('.mm-group-empty');
      if(!empty){empty=document.createElement('p');empty.className='mm-group-empty';empty.textContent='No products in this collection match this filter.';group.append(empty);}
      empty.hidden=all('[data-mm-category]',group).some(card=>!card.hidden);
    });
    document.querySelector('.mm-filter-count').textContent=value==='All tools'?`${document.querySelectorAll('#creative-suite [data-mm-category]').length || 4} suite products + ${document.querySelectorAll('#other-apps [data-mm-category]').length} other apps`:`${count} ${count===1?'product':'products'} across both collections`;
  }));
  const communityApps = [{"id": "sessions", "html": "<article class=\"mm-launch-item\" data-mm-search=\"sessions sound community other apps\" data-community-app=\"sessions\"><span class=\"mm-tool-dot\" style=\"background:#d8ff3e\" aria-hidden=\"true\"></span><div><strong class=\"launch-app-name\">Sessions</strong><p>Shared listening & room chat</p></div><a href=\"/community/network?view=Sessions\">Open app<span class=\"visually-hidden\">: Sessions</span></a></article>"}, {"id": "pocket-studio", "html": "<article class=\"mm-launch-item\" data-mm-search=\"pocket studio sound community other apps\" data-community-app=\"pocket-studio\"><span class=\"mm-tool-dot\" style=\"background:#c6b7ff\" aria-hidden=\"true\"></span><div><strong class=\"launch-app-name\">Pocket Studio</strong><p>Voice memos, trimming & sharing</p></div><a href=\"/community/network?view=Pocket%20Studio\">Open app<span class=\"visually-hidden\">: Pocket Studio</span></a></article>"}];
  const otherLaunch = document.querySelector('[data-mm-launch-group="other-apps"]');
  if (otherLaunch) communityApps.forEach(app => {
    if (!otherLaunch.querySelector('[data-community-app="' + app.id + '"]')) otherLaunch.insertAdjacentHTML('beforeend', app.html);
  });
  const launch=document.querySelector('.mm-launch-dialog');
  if(launch){
    const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/quick-launch.css?v=1';document.head.append(sheet);
    launch.classList.add('ql-clean');launch.querySelector('h2').textContent='Quick launch';
    const label=launch.querySelector('label');label.textContent='Find an app';
    const search=launch.querySelector('input');search.placeholder='Search apps or what you want to make…';
    const descriptions={'Form Studio':'3D modeling & CAD','Luma Studio':'Images, layers & color','StemDeck':'Stems, arrangement & mixing','ScenePilot':'Video editing & motion','Ghost Studio':'Garment exploration','Librarian':'Reading & your library','Reclaim':'File review & organization','Bounce':'Music playback & queues'};
    all('.mm-launch-item',launch).forEach(item=>{
      item.querySelector('.hero-launch-lesson')?.remove();
      const name=item.querySelector('.launch-app-name, h3').textContent.trim(),copy=item.querySelector('div'),links=all('a',item);
      item.querySelector('p').textContent=descriptions[name]||item.querySelector('p').textContent;
      item.dataset.mmSearch+=' '+(descriptions[name]||'').toLowerCase();
      if(links[0]){links[0].classList.add('ql-open');links[0].textContent='Open ↗';links[0].setAttribute('aria-label','Open '+name);}
      if(links[1]){links[1].classList.add('ql-details');links[1].textContent='Details';links[1].setAttribute('aria-label','About '+name);copy.append(links[1]);}
    });
    let returnFocus=null;
    const input=launch.querySelector('input'), items=all('.mm-launch-item',launch);
    const normalizeSearch=value=>value.toLocaleLowerCase().replace(/&/g,' ').replace(/\s+/g,' ').trim();
    function filter(){const query=normalizeSearch(input.value);let count=0;items.forEach(item=>{item.hidden=!normalizeSearch(item.dataset.mmSearch).includes(query);if(!item.hidden)count++;});all('[data-mm-launch-group]',launch).forEach(group=>{const visible=all('.mm-launch-item',group).filter(item=>!item.hidden).length;group.hidden=!visible;group.querySelector('.mm-launch-group-title span').textContent=`${visible} ${visible===1?'product':'products'}`;});launch.querySelector('.mm-launch-empty').hidden=!!count;launch.querySelector('.mm-launch-count').textContent=query?`${count} ${count===1?'product':'products'} ready to explore.`:`${items.length} apps and tools · Public web editions`;}
    all('[data-mm-launch]').forEach(b=>b.addEventListener('click',()=>{returnFocus=b;input.value='';filter();launch.showModal();input.focus();}));
    input.addEventListener('input',filter);
    launch.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();launch.close();}});
    all('a',launch).forEach(link=>link.addEventListener('click',()=>launch.close()));
    launch.querySelector('[data-mm-close]').addEventListener('click',()=>launch.close());
    launch.addEventListener('click',e=>{if(e.target===launch){const r=launch.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)launch.close();}});
    launch.addEventListener('close',()=>returnFocus?.focus());
  }
  if(document.body.classList.contains('momentium-gallery')){
    const stories=all('[data-after-hours]'), rail=all('.mm-project-rail [data-mm-project]'), toggle=document.querySelector('[data-mm-show-all]');
    let current=0, showAll=false;
    const currentFromHash=()=>stories.findIndex(s=>location.hash==='#'+s.id);
    function select(index,{scroll=false,focus=false,history=false}={}){
      current=(index+stories.length)%stories.length;
      stories.forEach((s,i)=>{s.hidden=!showAll && i!==current;if(s.hidden)all('audio,video',s).forEach(m=>m.pause());});
      rail.forEach((a,i)=>i===current?a.setAttribute('aria-current','true'):a.removeAttribute('aria-current'));
      document.querySelector('[data-mm-project-status]').textContent=showAll?'All eight projects · take your time':`Project ${String(current+1).padStart(2,'0')} / 08 · ${rail[current].textContent.trim().slice(2)}`;
      toggle.textContent=showAll?'Focus on one project':'Show all projects';toggle.setAttribute('aria-pressed',String(showAll));
      if(history)window.history.pushState(null,'','#'+stories[current].id);
      if(scroll)stories[current].scrollIntoView({block:'start',behavior:'auto'});
      if(focus)stories[current].querySelector('h2').focus({preventScroll:true});
      const list=document.querySelector('.mm-project-rail'), link=rail[current];
      if(link.offsetLeft<list.scrollLeft || link.offsetLeft+link.offsetWidth>list.scrollLeft+list.clientWidth)list.scrollTo({left:link.offsetLeft-list.offsetLeft-list.clientWidth/2+link.offsetWidth/2,behavior:'auto'});
    }
    all('[data-mm-project]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();select(stories.findIndex(s=>s.dataset.afterHours===a.dataset.mmProject),{scroll:true,focus:true,history:true});}));
    toggle.addEventListener('click',()=>{showAll=!showAll;select(current);});
    document.querySelector('[data-mm-random-project]').addEventListener('click',()=>{showAll=false;select(shuffleIndex(stories.length,current),{scroll:true,focus:true,history:true});});
    window.addEventListener('hashchange',()=>{const index=currentFromHash();if(index!==-1)select(index,{scroll:true});});
    window.addEventListener('popstate',()=>{const index=currentFromHash();select(index===-1?0:index,{scroll:true});});
    const initial=currentFromHash(); select(initial===-1?0:initial);
    if(initial!==-1)requestAnimationFrame(()=>stories[current].scrollIntoView({block:'start',behavior:'auto'}));
  }
  // Explicitly started audio is exclusive across every thecreateco player.
  all('audio,video:not([data-launch-demo])').forEach(media=>media.addEventListener('play',()=>all('audio,video:not([data-launch-demo])').forEach(other=>{if(other!==media)other.pause();})));
})();
