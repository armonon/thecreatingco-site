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
