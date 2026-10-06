/* Page organization only; native lesson state remains with each editor. */
(() => {
  const page = document.querySelector('.pr-page');
  if (!page) return;
  const reveal = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    if (target.tagName === 'DETAILS') target.open = true;
  };
  const revealHash = () => { try { reveal(decodeURIComponent(location.hash.slice(1))); } catch {} };
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
    const hash = link.getAttribute('href').slice(1);
    reveal(hash);
  }));
  window.addEventListener('hashchange', revealHash);
  revealHash();

  document.querySelectorAll('[data-pr-search]').forEach(input => {
    const section = input.closest('.pf');
    const groups = [...section.querySelectorAll('.pf-group')];
    const features = [...section.querySelectorAll('.pf-feature')];
    const status = section.querySelector('[data-pr-search-status]');
    const initial = groups.map(group => group.open);
    const counts = groups.map(group => group.querySelector('.pf-group-count')?.textContent);
    const update = () => {
      const query = input.value.trim().toLocaleLowerCase();
      let count = 0;
      features.forEach(feature => {
        feature.hidden = !!query && !query.split(/\s+/).every(word=>(feature.textContent+' '+(feature.dataset.featureAliases||'')).toLocaleLowerCase().includes(word));
        if (!feature.hidden) count++;
      });
      groups.forEach((group, index) => {
        const matching = [...group.querySelectorAll('.pf-feature')].filter(feature => !feature.hidden).length;
        group.hidden = !!query && matching === 0;
        group.open = query ? !group.hidden : initial[index];
        const countLabel = group.querySelector('.pf-group-count');
        if (countLabel) countLabel.textContent = query ? `${matching} matched` : counts[index];
        section.querySelector(`.pf-jump a[href="#${group.id}"]`)?.toggleAttribute('hidden',group.hidden);
      });
      status.textContent = query ? (count ? `${count} matching ${count === 1 ? 'feature' : 'features'}` : 'No matching features. Try another word.') : `${features.length} features · browse by category`;
    };
    input.addEventListener('input', update);
    update();
  });

  document.querySelectorAll('.sw-grid,.sn-cards').forEach(grid => {
    const cards = [...grid.children].filter(card => card.matches('article'));
    if (cards.length <= 3) return;
    const more = cards.slice(3);
    more.forEach(card => card.hidden = true);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pr-expand';
    button.textContent = `Show all ${cards.length} sessions`;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', grid.id);
    grid.after(button);
    button.addEventListener('click', () => {
      more.forEach(card => card.hidden = false);
      button.setAttribute('aria-expanded', 'true');
      button.hidden = true;
      more[0].querySelector('button,a')?.focus({preventScroll:true});
    });
  });

  const links = [...document.querySelectorAll('.pr-nav a[href^="#"]')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const visible = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target,entry.isIntersecting));
      const active = sections.find(section => visible.get(section));
      links.forEach(link => {
        if (active && link.getAttribute('href') === '#' + active.id) link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    }, {rootMargin:'-125px 0px -55% 0px',threshold:0});
    sections.forEach(section => observer.observe(section));
  }
})();
