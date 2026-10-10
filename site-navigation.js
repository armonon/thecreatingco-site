
/* NOW Messenger: direct Connect entry throughout the shared site shell. */
(()=>{document.querySelectorAll('[data-site-menu] nav,.cc-footer').forEach(scope=>{if(scope.querySelector('[data-nav-key="messenger"]'))return;const circle=scope.querySelector('[data-nav-key="circle"]');if(!circle)return;const a=document.createElement('a');a.dataset.navKey='messenger';a.href='https://now-messenger.armonon.chatgpt.site/';a.textContent='NOW Messenger';circle.after(a)});})();
(() => {
  const url = new URL(location.href);
  if (url.pathname === '/learn/luma/' && url.searchParams.get('campaign') === '1') {
    url.pathname = '/learn/luma/basics/';
    location.replace(url.href);
    return;
  }
  function currentSection() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    if (path === '/' && location.hash === '#creative-suite') return 'suite';
    if (path === '/tools' || path.startsWith('/products/')) return 'apps';
    if (path === '/learn' || path.startsWith('/learn/')) return 'learn';
    if (path.startsWith('/community')) return 'circle';
    if (path.startsWith('/testing')) return 'support';
    return ({'/about':'about','/downloads':'downloads','/release-notes':'releases',
      '/privacy':'privacy','/work':'work','/locker':'locker','/start':'start','/kickstarter':'launch'})[path];
  }
  function markCurrent() {
    document.querySelectorAll('[data-nav-key]').forEach(link => {
      if (link.dataset.navKey === currentSection()) {
        const target = new URL(link.href, location.href);
        const exact = target.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '') && target.hash === location.hash;
        link.setAttribute('aria-current', exact ? 'page' : 'location');
      } else link.removeAttribute('aria-current');
    });
  }
  markCurrent();
  window.addEventListener('hashchange', markCurrent);
  const menu = document.querySelector('[data-site-menu]');
  if (!menu) return;
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault(); menu.open = false; menu.querySelector('summary').focus();
    }
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
  document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
  document.querySelector('[data-mm-launch]')?.addEventListener('click', () => { menu.open = false; });
})();

(() => {
  const drawer = document.querySelector('.cc-header [data-mm-launch]');
  if (!drawer || document.querySelector('.cc-circle-shortcut')) return;
  const link = document.createElement('a');
  link.className = 'cc-circle-shortcut';
  link.href = '/community/network';
  link.setAttribute('aria-label', 'Open The Circle');
  link.title = 'The Circle';
  link.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2"/></svg>';
  drawer.insertAdjacentElement('afterend', link);
})();
/* App launcher redesign: scoped UI, no app state or destination changes. */
(() => {
 function setup(){
  const d=document.querySelector('.mm-launch-dialog');
  if(!d||d.dataset.launcherRedesign)return;
  d.dataset.launcherRedesign='1';
  const heading=d.querySelector('.mm-dialog-heading'),input=d.querySelector('input'),label=d.querySelector('label'),list=d.querySelector('.mm-launch-list');
  if(!heading||!input||!list)return;
  heading.querySelector('h2').textContent='Your apps';
  input.placeholder='Find an app or something to make';
  const head=document.createElement('div');head.className='launcher-head';d.prepend(head);head.append(heading);
  const sub=document.createElement('p');sub.className='launcher-intro';sub.textContent='A little space for your next big idea.';head.append(sub);if(label)head.append(label);head.append(input);
  const groups=[...list.querySelectorAll('[data-mm-launch-group]')],items=[...list.querySelectorAll('.mm-launch-item')];
  const nav=document.createElement('div');nav.className='launcher-categories';nav.setAttribute('aria-label','Filter apps by category');head.append(nav);
  let selected='all';
  const choices=[['all','All apps'],...groups.map(g=>[g.dataset.mmLaunchGroup,g.getAttribute('aria-label')||g.dataset.mmLaunchGroup])];
  const status=d.querySelector('.mm-launch-count'),empty=d.querySelector('.mm-launch-empty');
  if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');}
  function filter(){
   const q=input.value.trim().toLocaleLowerCase();let n=0;
   groups.forEach(g=>{let visible=0;g.querySelectorAll('.mm-launch-item').forEach(item=>{item.hidden=(selected!=='all'&&selected!==g.dataset.mmLaunchGroup)||!(item.dataset.mmSearch||item.textContent).toLocaleLowerCase().includes(q);if(!item.hidden){n++;visible++;}});g.hidden=!visible;});
   nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===selected)));
   if(empty){empty.hidden=n>0;empty.textContent='No apps found. Try another name or category.';}
   if(status)status.textContent=n+' '+(n===1?'app':'apps')+' · Select a tile to open';
  }
  choices.forEach(([id,name])=>{const b=document.createElement('button');b.type='button';b.dataset.category=id;b.textContent=name;b.addEventListener('click',()=>{selected=id;filter();list.scrollTop=0;});nav.append(b);});
  items.forEach(item=>{const p=item.querySelector('p'),name=item.querySelector('.launch-app-name,h3');if(p&&name)item.title=name.textContent+' — '+p.textContent;});
  input.addEventListener('input',filter);
  document.querySelectorAll('[data-mm-launch]').forEach(b=>b.addEventListener('click',()=>{selected='all';filter();list.scrollTop=0;}));
  filter();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
/* Compact grouped site drawer. Preserve original link nodes and destinations. */
(() => {
 const menu=document.querySelector('.cc-header [data-site-menu]'),nav=menu?.querySelector('nav');
 if(!nav||nav.dataset.organized)return;
 nav.dataset.organized='1';
 const top=document.createElement('div');top.className='site-drawer-top';
 const title=document.createElement('strong');title.textContent='Explore thecreateco';
 const close=document.createElement('button');close.type='button';close.className='site-drawer-close';close.setAttribute('aria-label','Close site menu');close.textContent='×';close.addEventListener('click',()=>{menu.open=false;menu.querySelector('summary').focus();});top.append(title,close);nav.prepend(top);
 const defs=[['Create',['suite','apps','learn','locker','work']],['Connect',['start','about','circle','messenger','hole','store','launch']],['Help',['downloads','support','releases','privacy']]];
 defs.forEach(([name,keys])=>{const section=document.createElement('section');section.className='site-drawer-group';const h=document.createElement('h2');h.textContent=name;section.append(h);keys.forEach(key=>{const a=nav.querySelector('a[data-nav-key="'+key+'"]');if(a)section.append(a);});nav.append(section);});
})();


/* HOLE rabbit shortcut immediately after the app drawer. */
(() => {
 const drawer=document.querySelector('.cc-header [data-mm-launch]');
 if(!drawer||document.querySelector('.cc-hole-shortcut'))return;
 const link=document.createElement('a');
 link.className='cc-hole-shortcut';link.href='/community/hole';
 link.setAttribute('aria-label','Open HOLE');link.title='HOLE';
 link.innerHTML='<svg width="25" height="25" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M12 15C8 10 7 3 10 3c3 0 5 7 5 11M18 14c0-6 2-11 5-10 3 1 0 8-2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 22c0 5-4 7-9 7s-9-2-9-7 4-9 9-9 9 4 9 9Z" fill="currentColor"/><circle cx="12.5" cy="21" r="1.2" fill="var(--rabbit-face)"/><circle cx="19.5" cy="21" r="1.2" fill="var(--rabbit-face)"/><path d="m14.5 24 1.5 1 1.5-1" stroke="var(--rabbit-face)" stroke-width="1.4" stroke-linecap="round"/></svg>';
 drawer.insertAdjacentElement('afterend',link);
 document.querySelectorAll('.cc-header [data-nav-key="hole"]').forEach(a=>{if(!a.closest('[data-site-menu]'))a.hidden=true;});
})();


/* Header order: HOLE, Circle, app drawer, site menu. */
(() => {
 const header=document.querySelector('.cc-header');
 const drawer=header?.querySelector('[data-mm-launch]');
 const circle=header?.querySelector('.cc-circle-shortcut');
 if(drawer&&circle)circle.insertAdjacentElement('afterend',drawer);
})();

/* Momentous store shortcut: reuse the store's existing double-circle identity. */
(() => {
  const header = document.querySelector('.cc-header');
  const drawer = header?.querySelector('[data-mm-launch]');
  if (!drawer || header.querySelector('.cc-store-shortcut')) return;
  const destination = 'https://momentous-store.netlify.app/';
  const logo = '<svg width="30" height="20" viewBox="0 0 40 26" fill="none" aria-hidden="true" focusable="false"><circle cx="15" cy="13" r="11" stroke="#6c5ce7" stroke-width="2.4"/><circle cx="25" cy="13" r="11" stroke="#ff8a3c" stroke-width="2.4"/><path d="M20 3.202 A11 11 0 0 1 20 22.798 A11 11 0 0 1 20 3.202 Z" fill="#6c5ce7" opacity="0.55"/></svg>';
  const link = document.createElement('a');
  link.className = 'cc-store-shortcut';
  link.href = destination;
  link.setAttribute('aria-label', 'Open Momentous store');
  link.title = 'Momentous store';
  link.innerHTML = '<svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false"><path d="M6.5 10h19l1.6 17.2a1.5 1.5 0 0 1-1.5 1.6H6.4a1.5 1.5 0 0 1-1.5-1.6L6.5 10Z" fill="#f3efff" stroke="#514375" stroke-width="1.6" stroke-linejoin="round"/><path d="M11.5 11V7.5a4.5 4.5 0 0 1 9 0V11" stroke="#514375" stroke-width="1.8" stroke-linecap="round"/><circle cx="13" cy="19.5" r="4.5" stroke="#6c5ce7" stroke-width="1.8"/><circle cx="19" cy="19.5" r="4.5" stroke="#ef843c" stroke-width="1.8"/></svg>';
  drawer.insertAdjacentElement('afterend', link);
  header.classList.add('cc-has-store');
  document.querySelectorAll('.cc-header [data-nav-key="store"], .cc-footer a').forEach(item => {
    if (item.href !== destination || item.querySelector('.cc-store-mark')) return;
    const mark = document.createElement('span');
    mark.className = 'cc-store-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = logo;
    item.prepend(mark);
  });
})();

/* Explore menu refinement: preserve links, state and existing dismissal behavior. */
(() => {
  const nav = document.querySelector('.cc-header [data-site-menu] > nav');
  if (!nav || nav.dataset.exploreRefined) return;
  nav.dataset.exploreRefined = '1';
  const title = nav.querySelector('.site-drawer-top strong');
  if (title) {
    const eyebrow = document.createElement('span');
    eyebrow.className = 'site-drawer-eyebrow';
    eyebrow.textContent = 'Explore';
    const brand = document.createElement('span');
    brand.textContent = 'thecreatingco';
    title.replaceChildren(eyebrow, brand);
  }
  const suite = nav.querySelector('[data-nav-key="suite"]');
  if (suite) {
    suite.classList.add('site-drawer-featured');
    nav.querySelector('.site-drawer-top')?.after(suite);
  }
  const groups = [...nav.querySelectorAll('.site-drawer-group')];
  groups.forEach((group, index) => { group.dataset.exploreGroup = String(index); });
  // Future destinations remain accessible even when they have no known group.
  const loose = [...nav.children].filter(node => node.tagName === 'A' && node !== suite);
  if (loose.length) {
    const section = document.createElement('section');
    section.className = 'site-drawer-group';
    const heading = document.createElement('h2');
    heading.textContent = 'Discover';
    section.append(heading, ...loose);
    nav.append(section);
  }
})();

/* Explore descriptions: retain the original links and accessible names. */
(() => {
  const nav = document.querySelector('.cc-header [data-site-menu] > nav');
  if (!nav) return;
  const descriptions = {
    suite: '3D, images, music & film',
    apps: 'Find your next tool',
    learn: 'Make something new',
    locker: 'Files in this browser',
    work: 'Pick up where you left off',
    start: 'A first look at our world',
    about: 'Our story & direction',
    circle: 'People, projects & ideas',
    messenger: 'Private DMs, guests & chatrooms',
    hole: 'Search the web & Circle',
    store: 'Explore the storefront',
    launch: 'Our proposed next chapter',
    downloads: 'Available builds & platforms',
    support: 'Get help. Share feedback.',
    releases: 'What changed & improved',
    privacy: 'Your data & your choices',
  };
  nav.querySelectorAll('a[data-nav-key]').forEach((link, index) => {
    const description = descriptions[link.dataset.navKey];
    if (!description || link.querySelector('.site-drawer-description')) return;
    const label = document.createElement('span');
    label.className = 'site-drawer-link-label';
    label.append(...link.childNodes);
    const note = document.createElement('span');
    note.className = 'site-drawer-description';
    note.textContent = description;
    let id = `explore-destination-${index}`;
    while (document.getElementById(id) || document.getElementById(id + '-description')) id += '-next';
    label.id = id;
    note.id = id + '-description';
    if (!link.hasAttribute('aria-label') && !link.hasAttribute('aria-labelledby')) link.setAttribute('aria-labelledby', label.id);
    const prior = link.getAttribute('aria-describedby');
    link.setAttribute('aria-describedby', [prior, note.id].filter(Boolean).join(' '));
    link.append(label, note);
    link.classList.add('site-drawer-described');
  });
  nav.dataset.exploreDescriptions = '1';
})();

/* Decorative marketing videos: faster motion, without changing lessons or media players. */
(()=>{const selector='video.tool-background-video,video[autoplay][muted][loop]:not([controls])';function speed(v){if(v.closest('.lp,.mp-player,[data-form-native]'))return;v.defaultPlaybackRate=1.5;v.playbackRate=1.5}document.querySelectorAll(selector).forEach(speed);document.addEventListener('play',e=>{if(e.target.matches?.(selector))speed(e.target)},true);})();

/* Explore tools: intent search, device-local favorites and saved projects. */
(() => {
  const nav = document.querySelector('.cc-header [data-site-menu] > nav');
  if (!nav || nav.dataset.toolSearch) return;
  nav.dataset.toolSearch = '1';
  const menu = nav.closest('details');
  const node = (tag, text, className) => { const e = document.createElement(tag); if (text) e.textContent = text; if (className) e.className = className; return e; };
  const panel = node('section', '', 'explore-tools');
  const label = node('label', 'Find a tool or destination');
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Remove a background, make a beat...'; search.autocomplete = 'off'; label.append(search);
  const status = node('p', '', 'explore-search-status'); status.setAttribute('role', 'status');
  const results = node('div', '', 'explore-results');
  const favorites = node('section', '', 'explore-favorites');
  const recent = node('section', '', 'explore-recents');
  panel.append(label, status, results, favorites, recent);
  nav.querySelector('.site-drawer-top').after(panel);
  const original = [...nav.children].filter(e => e !== panel && !e.classList.contains('site-drawer-top'));
  let catalog = [], loaded = false, loading, catalogError = false;
  const storageKey = 'tcc-explore-pins-v1';
  let pins = [];
  try { const data = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(data)) pins = data.filter(v => typeof v === 'string').slice(0, 12); } catch {}
  const aliases = { 'now-messenger': 'private messaging private messenger direct messages dm chatrooms guest accounts username disappearing messages no email chat', cutout: 'remove background transparent isolate subject erase background', pocket: 'make beat drum machine rhythm', split: 'separate stems remove vocals instrumental karaoke', autocut: 'auto edit cut video beat music', luma: 'edit photo poster image paint', form: '3d model cad jewelry design', captions: 'subtitle transcribe speech', loop: 'loop video repeat', 'key-bpm': 'tempo key detect music', reclaim: 'files storage review', glyph: 'font letters typography' };
  const destinations = [...nav.querySelectorAll('a[data-nav-key]')].map(a => ({ id: 'site:' + a.dataset.navKey, name: a.querySelector('.site-drawer-link-label')?.textContent || a.textContent, blurb: a.querySelector('.site-drawer-description')?.textContent || '', url: a.getAttribute('href') }));
  destinations.push({ id: 'site:workspace', name: 'My projects', blurb: 'Versions & source files on this device', url: '/workspace/' }, { id: 'site:projects', name: 'Remix a project', blurb: 'Editable starters across the suite', url: '/projects/#project-starters' });
  const safeURL = value => { try { const u = new URL(value, location.origin); return u.protocol === 'https:' || u.origin === location.origin ? u.href : null; } catch { return null; } };
  async function load() {
    if (loaded) return;
    if (loading) return loading;
    loading = fetch('/suite/v1/apps.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      catalog = data.apps.filter(a => a.menu !== false && safeURL(a.openUrl || a.url)).map(a => ({ id: a.id, name: a.name, blurb: a.blurb || '', url: a.openUrl || a.url, terms: aliases[a.id] || '', logo: a.icon })); loaded = true; catalogError = false;
    }).catch(() => { catalogError = true; }).finally(() => { loading = null; render(); });
    return loading;
  }
  function row(item, pinnable = true) {
    const row = node('div', '', 'explore-result');
    const a = node('a'); a.href = safeURL(item.url); a.append(node('strong', item.name), node('span', item.blurb));
    row.append(a);
    if (pinnable) {
      const label = node('label', '', 'explore-pin'); label.title = 'Pin ' + item.name;
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = pins.includes(item.id); input.setAttribute('aria-label', 'Pin ' + item.name);
      label.append(input, node('span', 'Pin')); row.append(label);
      input.addEventListener('change', () => {
        const next = input.checked ? [...new Set([...pins, item.id])] : pins.filter(id => id !== item.id);
        if (next.length > 12) { input.checked = false; status.textContent = 'You can pin up to 12 destinations.'; return; }
        try { localStorage.setItem(storageKey, JSON.stringify(next)); pins = next; renderFavorites(); }
        catch { input.checked = pins.includes(item.id); status.textContent = 'Favorites could not be saved in this browser.'; }
        nav.querySelectorAll('.explore-pin input').forEach(el => { if (el.getAttribute('aria-label') === input.getAttribute('aria-label')) el.checked = input.checked; });
      });
    }
    return row;
  }
  function renderFavorites() {
    favorites.replaceChildren(); const all = [...destinations, ...catalog];
    const items = pins.map(id => all.find(a => a.id === id)).filter(Boolean);
    favorites.hidden = !items.length || !!search.value.trim();
    if (items.length) favorites.append(node('h2', 'Pinned'), ...items.map(item => row(item)));
  }
  function render() {
    const query = search.value.toLowerCase().trim(), words = query.split(/\s+/).filter(Boolean);
    const matches = [...destinations, ...catalog].filter(a => words.every(w => (a.name + ' ' + a.blurb + ' ' + (a.terms || '')).toLowerCase().includes(w)));
    original.forEach(e => { e.hidden = !!query; });
    recent.hidden = !!query;
    results.replaceChildren(); results.hidden = !query;
    if (query) {
      status.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : 'No matches. Try background, beat, video or projects.';
      results.append(...matches.map(item => row(item)));
    } else status.textContent = '';
    if (catalogError) status.textContent += ' Tool catalog unavailable. Site destinations remain searchable.';
    renderFavorites();
  }
  async function renderRecent() {
    recent.replaceChildren(node('h2', 'Your workspace'));
    recent.append(row({ name: 'My projects', blurb: 'Saved on this device', url: '/workspace/' }, false));
    try {
      const { listProjects } = await import('/creating/workspace-core.js');
      const list = (await listProjects()).slice(0, 3);
      for (const project of list) recent.append(row({ name: project.name, blurb: `${project.count} files · ${new Date(project.updated).toLocaleDateString()}`, url: '/workspace/?project=' + encodeURIComponent(project.id) }, false));
    } catch { recent.append(node('p', 'Project storage is unavailable in this browser.')); }
  }
  search.addEventListener('input', () => { render(); load(); });
  search.addEventListener('keydown', e => { if (e.key === 'Escape' && search.value) { e.preventDefault(); e.stopPropagation(); search.value = ''; render(); } });
  menu.addEventListener('toggle', () => { if (menu.open) { load(); renderRecent(); } });
  window.addEventListener('storage', e => { if (e.key === storageKey) { try { const v = JSON.parse(e.newValue || '[]'); if (Array.isArray(v)) pins = v.filter(x => typeof x === 'string').slice(0, 12); } catch {} render(); } });
  render();
})();

/* Compact bubble drawer: keep native launch links, add hover previews and gentle repulsion. */
(()=>{function setup(){const d=document.querySelector('.mm-launch-dialog'),list=d?.querySelector('.mm-launch-list');if(!list)return;d.classList.add('bubble-drawer');const items=[...list.querySelectorAll('.mm-launch-item')];const preview=document.createElement('div');preview.className='bubble-drawer-preview';preview.innerHTML='<span>Explore an app</span><p>Hover or focus a bubble to preview. Select to open.</p>';list.before(preview);const shots={"Form": "/assets/workflows/form-technical.png", "Luma": "/assets/after-hours/luma-04-finished.png", "StemDeck": "/assets/orbit-story/orbit-sound-studio.jpg", "ScenePilot": "/assets/workflows/scenepilot-timeline.png", "Cutout": "/assets/catalog-screenshots-20261009/cutout.png", "Mockups": "/assets/workspace-captures-20261009/mockup.png", "Glyph Studio": "/assets/workspace-captures-20261009/glyph-studio.png", "Glyph (in Luma)": "/assets/tool-products/glyph.webp", "Ghost": "/assets/after-hours/ghost-02-relaxed.png", "Cast": "/assets/creative-tools/cast.webp", "Animate": "/assets/ecosystem/animate.png", "Moodboard": "/assets/ecosystem/moodboard.png", "AutoCut": "/assets/tool-products/autocut.webp", "Captions": "/assets/tool-products/captions.webp", "Board": "/assets/tool-products/board.webp", "Grade": "/assets/tool-products/grade.webp", "Reframe": "/assets/catalog-screenshots-20261009/reframe.png", "Loop": "/assets/catalog-screenshots-20261009/loop.png", "Split": "/assets/tool-products/split.webp", "Key & BPM": "/assets/tool-products/keybpm.webp", "Vox": "/assets/tool-products/vox.webp", "Canvas": "/assets/tool-products/canvas.webp", "Pocket": "/assets/tool-products/pocket.webp", "Bounce": "/assets/workspace-captures-20261009/bounce.png", "WebLab": "/assets/integration/weblab-workspace.png", "Portfolio Studio": "/assets/ecosystem/portfolio.png", "Press": "/assets/tool-products/press.webp", "Librarian": "/assets/workflows/librarian-library.png", "Reclaim": "/assets/workspace-captures-20261009/reclaim.png", "Locker": "/assets/catalog-screenshots-20261009/locker.png", "The Circle": "/assets/catalog-screenshots-20261009/circle.png", "Sessions": "/assets/catalog-screenshots-20261009/sessions.png", "Pocket Studio": "/assets/catalog-screenshots-20261009/pocket-studio.png"},icons={"Form": "/assets/app-logos/form.svg", "Luma": "/assets/app-logos/luma.svg", "StemDeck": "/assets/app-logos/stemdeck.svg", "Mockups": "/assets/app-logos/mockups.svg", "Glyph Studio": "/assets/app-logos/glyph-studio.svg", "Ghost": "/assets/app-logos/ghost.svg", "Cast": "/assets/app-logos/cast.svg", "AutoCut": "/assets/app-logos/autocut.svg", "Captions": "/assets/app-logos/captions.svg", "Board": "/assets/app-logos/board.svg", "Grade": "/assets/app-logos/grade.svg", "Split": "/assets/app-logos/split.svg", "Key & BPM": "/assets/app-logos/key-bpm.svg", "Vox": "/assets/app-logos/vox.svg", "Canvas": "/assets/app-logos/canvas.svg", "Pocket": "/assets/app-logos/pocket.svg", "Bounce": "/assets/app-logos/bounce.svg", "Press": "/assets/app-logos/press.svg", "Librarian": "/assets/app-logos/librarian.svg", "Reclaim": "/assets/app-logos/reclaim.svg", "Locker": "/assets/app-logos/locker.svg"};const colors=['#ddd2fa','#ddebce','#f5dbc2','#d3e6f3','#f0d6e4','#d7e8df'];items.forEach((item,index)=>{const name=item.querySelector('.launch-app-name,h3')?.textContent.trim();const old=item.firstElementChild;const well=document.createElement('span');well.className='drawer-bubble-icon';well.style.background=colors[index%colors.length];if(icons[name]){const img=document.createElement('img');img.src=icons[name];img.alt='';well.append(img)}else if(name==='ScenePilot'){well.textContent='✂'}else{well.textContent=name?.split(/\s+/).map(n=>n[0]).slice(0,2).join('')||'•'}old.replaceWith(well)});function show(item){const name=item.querySelector('.launch-app-name,h3')?.textContent.trim()||item.title;preview.replaceChildren();if(shots[name]){const img=document.createElement('img');img.src=shots[name];img.alt=name+' workspace';preview.append(img)}const copy=document.createElement('div');const title=document.createElement('strong');title.textContent=name;const desc=document.createElement('p');desc.textContent=item.querySelector('p')?.textContent||'Select to open this app';copy.append(title,desc);preview.append(copy)}items.forEach(item=>{item.addEventListener('pointerenter',()=>show(item));item.addEventListener('focusin',()=>show(item))});const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('motion-reduced');let frame=0,pos;function reset(){cancelAnimationFrame(frame);frame=0;items.forEach(i=>i.style.removeProperty('translate'))}list.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||reduced())return;pos={x:e.clientX,y:e.clientY};if(frame)return;frame=requestAnimationFrame(()=>{frame=0;items.filter(i=>!i.hidden).forEach(i=>{const r=i.getBoundingClientRect(),dx=pos.x-r.left-r.width/2,dy=pos.y-r.top-r.height/2,f=Math.max(0,1-Math.hypot(dx,dy)/115);i.style.translate=`${-dx*f*.12}px ${-dy*f*.12}px`})})});list.addEventListener('pointerleave',reset);d.addEventListener('close',reset);d.querySelector('input')?.addEventListener('input',reset)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup()})();

(()=>{function setup(){const d=document.querySelector('.bubble-drawer');if(!d)return;const shots={"Form": "/assets/workflows/form-technical.png", "Luma": "/assets/after-hours/luma-04-finished.png", "StemDeck": "/assets/orbit-story/orbit-sound-studio.jpg", "ScenePilot": "/assets/workflows/scenepilot-timeline.png", "Cutout": "/assets/catalog-screenshots-20261009/cutout.png", "Mockups": "/assets/workspace-captures-20261009/mockup.png", "Glyph Studio": "/assets/workspace-captures-20261009/glyph-studio.png", "Glyph (in Luma)": "/assets/tool-products/glyph.webp", "Ghost": "/assets/after-hours/ghost-02-relaxed.png", "Cast": "/assets/creative-tools/cast.webp", "Animate": "/assets/ecosystem/animate.png", "Moodboard": "/assets/ecosystem/moodboard.png", "AutoCut": "/assets/tool-products/autocut.webp", "Captions": "/assets/tool-products/captions.webp", "Board": "/assets/tool-products/board.webp", "Grade": "/assets/tool-products/grade.webp", "Reframe": "/assets/catalog-screenshots-20261009/reframe.png", "Loop": "/assets/catalog-screenshots-20261009/loop.png", "Split": "/assets/tool-products/split.webp", "Key & BPM": "/assets/tool-products/keybpm.webp", "Vox": "/assets/tool-products/vox.webp", "Canvas": "/assets/tool-products/canvas.webp", "Pocket": "/assets/tool-products/pocket.webp", "Bounce": "/assets/workspace-captures-20261009/bounce.png", "WebLab": "/assets/integration/weblab-workspace.png", "Portfolio Studio": "/assets/ecosystem/portfolio.png", "Press": "/assets/tool-products/press.webp", "Librarian": "/assets/workflows/librarian-library.png", "Reclaim": "/assets/workspace-captures-20261009/reclaim.png", "Locker": "/assets/catalog-screenshots-20261009/locker.png", "The Circle": "/assets/catalog-screenshots-20261009/circle.png", "Sessions": "/assets/catalog-screenshots-20261009/sessions.png", "Pocket Studio": "/assets/catalog-screenshots-20261009/pocket-studio.png"};d.querySelectorAll('.mm-launch-item').forEach(item=>{const name=item.querySelector('.launch-app-name')?.textContent.trim();if(shots[name]){const image=document.createElement('img');image.className='drawer-list-shot';image.src=shots[name];image.alt=name+' workspace';image.loading='lazy';item.append(image)}});const buttons=[...d.querySelectorAll('.launcher-categories button')];buttons.forEach((b,index)=>b.addEventListener('click',()=>{d.classList.toggle('drawer-category-list',index!==0);d.querySelectorAll('.mm-launch-item').forEach(i=>i.style.removeProperty('translate'))}))}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup()})();

