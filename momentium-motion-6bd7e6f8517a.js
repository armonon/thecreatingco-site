/* Bounded scroll response, with readable content even if this script never runs. */
(() => {
  const body = document.body;
  if (!body.classList.contains('mm-polished')) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 761px) and (pointer: fine)');
  const selectAll = selector => [...document.querySelectorAll(selector)];
  const scenes = selectAll('.mm-feature-image, .ph-picture, .mm-ribbon');
  const visible = new Set();
  let frame = 0;
  const topButton = document.querySelector('[data-mm-scroll-top]');

  function render() {
    frame = 0;
    const y = window.scrollY;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    body.style.setProperty('--mm-reading-progress', String(max ? Math.min(1, y / max) : 0));
    body.classList.toggle('mm-has-scrolled', y > 16);
    body.classList.toggle('mm-deep-scroll', y > innerHeight * 1.5);
    if (reduced.matches || !desktop.matches) return;
    visible.forEach(scene => {
      if (!scene.getClientRects().length) return;
      const rect = scene.getBoundingClientRect();
      const position = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top - rect.height / 2) / innerHeight));
      scene.style.setProperty(scene.classList.contains('mm-ribbon') ? '--mm-ribbon-drift' : '--mm-drift', `${(position * (scene.classList.contains('mm-ribbon') ? 40 : 12)).toFixed(2)}px`);
    });
  }
  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  if ('IntersectionObserver' in window) {
    const scenesObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
      schedule();
    }, {rootMargin: '80px'});
    scenes.forEach(scene => scenesObserver.observe(scene));
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('mm-in-view');
        reveal.unobserve(entry.target);
      }
    }), {threshold: .05});
    selectAll('.mm-section-heading, .mm-family-heading, .mm-tool, .mm-after-title, .mm-poster, .mm-invitation, .ph-native, main > .section, main > .pf, main > .px').forEach(element => {
      if (element.getBoundingClientRect().top > innerHeight && !reduced.matches) {
        element.classList.add('mm-reveal');
        reveal.observe(element);
      }
    });
  }
  function preferenceChanged() {
    scenes.forEach(scene => {
      scene.style.removeProperty('--mm-drift');
      scene.style.removeProperty('--mm-ribbon-drift');
    });
    if (reduced.matches) selectAll('.mm-reveal').forEach(element => element.classList.add('mm-in-view'));
    schedule();
  }
  reduced.addEventListener('change', preferenceChanged);
  desktop.addEventListener('change', preferenceChanged);
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  window.addEventListener('load', schedule);
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('toggle', schedule, true);
  document.addEventListener('click', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
  topButton?.addEventListener('click', () => {
    window.scrollTo({top: 0, behavior: reduced.matches ? 'auto' : 'smooth'});
    const heading = document.querySelector('main h1');
    if (heading) {
      const hadTabindex = heading.hasAttribute('tabindex');
      if (!hadTabindex) heading.setAttribute('tabindex', '-1');
      heading.focus({preventScroll: true});
      if (!hadTabindex) heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), {once: true});
    }
  });
  schedule();
})();
