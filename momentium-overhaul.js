/* Product previews change locally; editing continues in the real applications. */
(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  all('[data-mx-showcase]').forEach(showcase => {
    const tabs = all('[role="tab"]', showcase);
    const panels = all('[role="tabpanel"]', showcase);
    const status = showcase.querySelector('[data-mx-tab-status]');
    let selected = Math.max(0, tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true'));
    function select(index, focus = false) {
      selected = (index + tabs.length) % tabs.length;
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === selected));
        tab.tabIndex = i === selected ? 0 : -1;
        panels[i].hidden = i !== selected;
      });
      status.textContent = tabs[selected].textContent.trim() + ' selected.';
      if (focus) tabs[selected].focus({preventScroll: true});
      const rail = tabs[selected].parentElement;
      if (tabs[selected].offsetLeft < rail.scrollLeft || tabs[selected].offsetLeft + tabs[selected].offsetWidth > rail.scrollLeft + rail.clientWidth) {
        rail.scrollTo({left: tabs[selected].offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + tabs[selected].offsetWidth / 2, behavior: 'auto'});
      }
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', event => {
        const next = {ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: tabs.length - 1};
        if (event.key in next) {
          event.preventDefault();
          select(next[event.key], true);
        }
      });
    });
  });

  const dialog = document.querySelector('.mx-image-dialog');
  if (dialog) {
    let returnFocus;
    const image = dialog.querySelector('[data-mx-image-view]');
    all('[data-mx-image]').forEach(button => button.addEventListener('click', () => {
      returnFocus = button;
      image.src = button.dataset.mxImage;
      image.alt = button.dataset.mxCaption;
      dialog.querySelector('[data-mx-image-caption]').textContent = button.dataset.mxCaption;
      dialog.showModal();
    }));
    dialog.querySelector('[data-mx-image-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => returnFocus?.focus({preventScroll: true}));
  }
})();
