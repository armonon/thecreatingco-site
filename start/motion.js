(() => {
  const system = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'createco-reduce-motion';
  let preference = false;
  try { preference = localStorage.getItem(key) === 'true'; } catch {}
  const reduced = () => system.matches || preference;
  const nodes = [...document.querySelectorAll('.panel,.mission')];
  const toggle = document.querySelector('[data-motion-toggle]');
  let observer;
  function applyMotion() {
    document.documentElement.classList.toggle('motion-reduced', reduced());
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(reduced()));
      toggle.disabled = system.matches;
      toggle.textContent = reduced() ? 'Reduced motion: on' : 'Reduce motion';
    }
    const status = document.querySelector('[data-motion-status]');
    if (status) status.textContent = system.matches ? 'Enabled by your device setting' : preference ? 'Saved for this browser' : 'Motion on · follows your device setting';
    if (reduced()) {
      observer?.disconnect();
      nodes.forEach(node => node.classList.add('is-visible'));
      document.body.classList.remove('suite-arriving', 'suite-leaving');
    }
  }
  applyMotion();
  system.addEventListener('change', applyMotion);
  toggle?.addEventListener('click', () => {
    preference = !preference;
    try { localStorage.setItem(key, String(preference)); } catch {}
    applyMotion();
  });
  // A short-lived marker limits top-reset and entrance motion to deliberate suite navigation.
  if (location.pathname === '/' || location.pathname === '/index.html') {
    let arrival = 0;
    try { arrival = Number(sessionStorage.getItem('createco-suite-arrival')); sessionStorage.removeItem('createco-suite-arrival'); } catch {}
    if (arrival && Date.now() - arrival < 15000 && !location.hash) {
      const top = () => window.scrollTo({top:0,left:0,behavior:'instant'});
      top(); window.addEventListener('pageshow', top, {once:true});
      if (!reduced()) document.body.classList.add('suite-arriving');
    }
  }
  if (!document.body.classList.contains('start-motion')) return;
  if ('IntersectionObserver' in window && !reduced()) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-visible'); observer.unobserve(entry.target);
      }
    }, {threshold:.06});
    for (const node of nodes) if (node.getBoundingClientRect().top > innerHeight) {
      node.classList.add('motion-ready'); observer.observe(node);
    }
  }
  const hero = document.querySelector('.hero');
  hero?.addEventListener('pointermove', event => {
    if (reduced() || event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--drift-x', `${((event.clientX-rect.left)/rect.width-.5)*35}px`);
    hero.style.setProperty('--drift-y', `${((event.clientY-rect.top)/rect.height-.5)*24}px`);
  }, {passive:true});
  hero?.addEventListener('pointerleave', () => {
    hero.style.setProperty('--drift-x','0px'); hero.style.setProperty('--drift-y','0px');
  });
  let leaving = false;
  function enterSuite(href = '/') {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem('createco-suite-arrival', String(Date.now())); } catch {}
    const navigate = () => location.assign(href);
    if (reduced()) { navigate(); return; }
    const curtain = document.createElement('div');
    curtain.className = 'suite-transition-curtain';
    curtain.setAttribute('aria-hidden','true');
    curtain.innerHTML = '<span>THECREATECO</span><strong>Momentium Suite</strong>';
    document.body.append(curtain);
    document.body.classList.add('suite-leaving');
    setTimeout(navigate, 560);
  }
  const exit = document.querySelector('.suite-scroll-exit');
  let bottomSince = 0, pressure = 0, touchY = 0;
  const atBottom = () => document.documentElement.scrollHeight - innerHeight - scrollY <= 4;
  function resetPressure() {
    bottomSince = 0; pressure = 0;
    exit?.style.setProperty('--suite-pressure','0');
    exit?.classList.remove('is-ready');
  }
  function push(delta) {
    if (leaving || document.querySelector('dialog[open]')) return;
    if (delta <= 0 || !atBottom()) { resetPressure(); return; }
    if (!bottomSince) { bottomSince = performance.now(); return; }
    // Let the first scroll settle, then require an additional deliberate push.
    if (performance.now() - bottomSince < 450) return;
    pressure = Math.min(240, pressure + Math.min(delta,80));
    exit?.style.setProperty('--suite-pressure', String(pressure / 240));
    exit?.classList.toggle('is-ready', pressure > 0);
    if (pressure >= 240) enterSuite();
  }
  addEventListener('wheel', event => {
    push(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1));
  }, {passive:true});
  addEventListener('touchstart', event => { touchY = event.touches[0]?.clientY || 0; }, {passive:true});
  addEventListener('touchmove', event => {
    const next = event.touches[0]?.clientY || 0;
    push((touchY-next)*1.8); touchY=next;
  }, {passive:true});
  addEventListener('keydown', event => {
    if (event.target.closest?.('input,textarea,select,button,a,[contenteditable="true"]')) return;
    if (['End','PageDown','ArrowDown',' '].includes(event.key)) push(80);
    if (['Home','PageUp','ArrowUp'].includes(event.key)) resetPressure();
  });
  addEventListener('scroll', () => {
    if (!atBottom()) resetPressure();
    else if (!bottomSince) bottomSince = performance.now();
  }, {passive:true});
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin || target.pathname !== '/' || target.hash || target.search) return;
    event.preventDefault(); enterSuite(target.href);
  });
  addEventListener('pageshow', event => {
    leaving = false; resetPressure(); document.body.classList.remove('suite-leaving');
    document.querySelector('.suite-transition-curtain')?.remove();
    if (event.persisted) nodes.forEach(node => node.classList.add('is-visible'));
  });
})();
