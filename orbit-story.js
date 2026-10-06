(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 960px)');
  document.querySelectorAll('[data-orbit-story]').forEach(story => {
    const chapters = [...story.querySelectorAll('[data-orbit-chapter]')];
    const links = [...story.querySelectorAll('.orbit-nav a')];
    const panels = [...story.querySelectorAll('[data-orbit-panel]')];
    const caption = story.querySelector('[data-orbit-caption]');
    const media = [...story.querySelectorAll('audio,video')];
    let frame = 0, active = -1, visible = true;
    function update() {
      frame = 0;
      if (!visible || document.hidden) return;
      const target = innerHeight * .48;
      const positions = chapters.map(chapter => chapter.getBoundingClientRect());
      let next = 0;
      positions.forEach((rect, index) => { if (rect.top <= target) next = index; });
      if (next !== active) {
        media.forEach(element => { if (!chapters[next].contains(element)) element.pause(); });
        active = next;
        links.forEach((link, index) => { if (index === next) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current'); });
        panels.forEach((panel, index) => { panel.classList.toggle('is-active', index === next); panel.setAttribute('aria-hidden', String(index !== next)); });
        caption.textContent = panels[next].dataset.caption;
        story.dataset.active = String(next);
      }
      const first = positions[0], last = positions.at(-1);
      const progress = Math.min(1, Math.max(0, (target - first.top) / Math.max(1, last.bottom - first.top)));
      story.style.setProperty('--orbit-progress', progress.toFixed(4));
      const drift = !reduce.matches && desktop.matches ? Math.max(-12, Math.min(12, (positions[next].top - target) * .025)) : 0;
      story.style.setProperty('--orbit-drift', drift.toFixed(2) + 'px');
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    story.classList.add('is-enhanced');
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule, {passive: true});
    reduce.addEventListener('change', schedule);
    desktop.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', () => { if (document.hidden) media.forEach(element => element.pause()); else schedule(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) media.forEach(element => element.pause()); else schedule();
    }).observe(story);
    media.forEach(element => element.addEventListener('play', () => media.forEach(other => { if (other !== element) other.pause(); })));
    schedule();
  });
})();
