(() => {
  const search = document.querySelector('[data-ct-search]');
  const family = document.querySelector('[data-ct-family]:not([data-ct-tool])');
  if (!search || !family) return;
  const tools = [...document.querySelectorAll('[data-ct-tool]')];
  const params = new URLSearchParams(location.search);
  const families = [...family.options].map(option => option.value);
  family.value = families.includes(params.get('family')) ? params.get('family') : 'all';
  search.value = (params.get('q') || '').slice(0, 120);
  function filter(updateURL = true) {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const tool of tools) {
      const visible = (family.value === 'all' || tool.dataset.ctFamily === family.value)
        && tool.textContent.toLocaleLowerCase().includes(query);
      tool.hidden = !visible;
      count += Number(visible);
    }
    const counter = document.querySelector('[data-ct-count]');
    const unit = counter.dataset.ctCountUnit === 'entry' ? (count === 1 ? 'entry' : 'entries') : (count === 1 ? 'tool' : 'tools');
    counter.textContent = `${count} ${unit}`;
    document.querySelector('[data-ct-empty]').hidden = count !== 0;
    if (updateURL) {
      const url = new URL(location.href);
      if (family.value === 'all') url.searchParams.delete('family');
      else url.searchParams.set('family', family.value);
      if (search.value.trim()) url.searchParams.set('q', search.value.trim());
      else url.searchParams.delete('q');
      history.replaceState(null, '', url);
    }
  }
  search.addEventListener('input', () => filter());
  family.addEventListener('change', () => filter());
  search.closest('form').addEventListener('submit', event => event.preventDefault());
  filter(false);
})();
