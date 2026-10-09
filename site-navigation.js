(() => {
  // Native lessons understand historical aliases and preserve their checkpoints.
  // The old basics workspace remains directly accessible for recovering older work.
  const url = new URL(location.href);
  if (url.pathname === '/learn/luma/' && url.searchParams.get('campaign') === '1') {
    url.pathname = '/learn/luma/basics/';
    location.replace(url.href);
    return;
  }
  const mainNav = document.querySelector('header nav[aria-label="Main navigation"]');
  if (mainNav) {
    let toolsLink = mainNav.querySelector('a[href="/tools/"]');
    if (!toolsLink) {
      toolsLink = document.createElement('a');
      toolsLink.href = '/tools/';
      const appsLink = mainNav.querySelector('a[href="/#other-apps"]');
      if (appsLink) appsLink.after(toolsLink);
      else mainNav.append(toolsLink);
    }
    toolsLink.textContent = 'Tools';
    if (new URL(location.href).pathname.replace(/\/$/, '') === '/tools') toolsLink.setAttribute('aria-current', 'page');
    else toolsLink.removeAttribute('aria-current');
  }
  const menu = document.querySelector('[data-site-menu]');
  if (!menu) return;
  const menuNav = menu.querySelector('nav[aria-label="Site menu"]');
  if (menuNav) {
    let toolsLink = menuNav.querySelector('a[href="/tools/"]');
    if (!toolsLink) {
      toolsLink = document.createElement('a');
      toolsLink.href = '/tools/';
      menuNav.append(toolsLink);
    }
    toolsLink.textContent = 'Tools';
    if (new URL(location.href).pathname.replace(/\/$/, '') === '/tools') toolsLink.setAttribute('aria-current', 'page');
    else toolsLink.removeAttribute('aria-current');
  }
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
