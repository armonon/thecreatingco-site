(() => {
  // Native lessons understand historical aliases and preserve their checkpoints.
  // The old basics workspace remains directly accessible for recovering older work.
  const url = new URL(location.href);
  if (url.pathname === '/learn/luma/' && url.searchParams.get('campaign') === '1') {
    url.pathname = '/learn/luma/basics/';
    location.replace(url.href);
    return;
  }
  const menu = document.querySelector('[data-site-menu]');
  if (!menu) return;
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
  document.addEventListener('click', event => {
    if (!menu.contains(event.target)) menu.open = false;
  });
})();
