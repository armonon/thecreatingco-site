(() => {
  const tours = document.querySelectorAll('[data-product-story]');
  for (const tour of tours) {
    const frames = [...tour.querySelectorAll('[data-story-frame]')];
    const steps = [...tour.querySelectorAll('[data-story-step]')];
    const controls = tour.querySelector('[data-story-controls]');
    const status = tour.querySelector('[data-story-status]');
    if (frames.length < 2 || frames.length !== steps.length || !controls) continue;
    const name = tour.dataset.productStory.replaceAll('-', ' ');
    let active = 0;
    const buttons = frames.map((frame, i) => {
      const title = steps[i].querySelector('h3')?.textContent.trim() || `View ${i + 1}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tcc-story-tab';
      button.id = `story-tab-${tour.dataset.productStory}-${i + 1}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', frame.id);
      button.setAttribute('aria-selected', 'false');
      button.tabIndex = -1;
      button.innerHTML = `<span class="tcc-story-tab-number">${String(i + 1).padStart(2, '0')}</span><span>${title}</span>`;
      button.addEventListener('click', () => select(i));
      button.addEventListener('keydown', event => {
        let next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (i + 1) % buttons.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (i + buttons.length - 1) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next !== null) { event.preventDefault(); select(next, true); }
      });
      controls.append(button);
      return button;
    });
    function select(index, focus = false) {
      active = index;
      frames.forEach((node, i) => { node.hidden = i !== index; });
      steps.forEach((node, i) => { node.hidden = i !== index; });
      buttons.forEach((button, i) => {
        const current = i === index;
        button.setAttribute('aria-selected', String(current));
        button.tabIndex = current ? 0 : -1;
      });
      if (status) status.textContent = `${name}: view ${index + 1} of ${frames.length}`;
      if (focus) buttons[index].focus();
    }
    controls.hidden = false;
    if (status) status.hidden = false;
    tour.dataset.enhanced = 'true';
    select(0);
  }
})();
