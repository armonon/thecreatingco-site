(() => {
  const preview = document.querySelector('[data-tp-preview-dialog]');
  const opener = document.querySelector('[data-tp-preview]');
  if (preview && opener) {
    opener.addEventListener('click', () => preview.showModal());
    preview.addEventListener('close', () => opener.focus({ preventScroll: true }));
    preview.addEventListener('click', event => {
      if (event.target !== preview) return;
      const box = preview.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) preview.close();
    });
  }
  for (const player of document.querySelectorAll('[data-tp-player]')) {
    const lessons = [...player.querySelectorAll('[data-tp-lesson]')];
    const picker = player.querySelector('[data-tp-picker]');
    const count = player.querySelector('[data-tp-count]');
    if (!lessons.length || !picker || !count) continue;
    let selected = 0;
    const show = index => {
      selected = (index + lessons.length) % lessons.length;
      lessons.forEach((lesson, i) => { lesson.hidden = i !== selected; });
      picker.value = String(selected);
      count.textContent = `${selected + 1} / ${lessons.length}`;
    };
    picker.addEventListener('change', () => show(Number(picker.value)));
    player.querySelector('[data-tp-previous]').addEventListener('click', () => show(selected - 1));
    player.querySelector('[data-tp-next]').addEventListener('click', () => show(selected + 1));
    player.querySelector('[data-tp-controls]').hidden = false;
    show(0);
  }
})();
