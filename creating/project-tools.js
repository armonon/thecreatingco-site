import { getProject, updateProject } from './workspace-core.js';
const host = document.querySelector('#cw-toolkit');
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
const safe = value => { if (typeof value !== 'string' || !value) return null; try { const u = new URL(value, location.origin); return u.protocol === 'https:' || (u.origin === location.origin && u.protocol === 'http:') ? u.href : null; } catch { return null; } };
const anchor = (text, url) => { const a = node('a', text); a.href = safe(url); a.target = '_blank'; a.rel = 'noopener'; return a; };
async function start() {
  const response = await fetch('/creating/project-catalog.json'); if (!response.ok) throw Error('Catalog unavailable. Your files are still accessible.');
  const { apps, journeys } = await response.json();
  const select = document.querySelector('#cw-new select[name=template]');
  for (const journey of journeys) { const option = node('option', journey.name); option.value = 'workflow:' + journey.id; select.append(option); }
  const params = new URLSearchParams(location.search), journey = journeys.find(j => j.id === params.get('workflow'));
  if (journey) { select.value = 'workflow:' + journey.id; const input = document.querySelector('#cw-new input[name=name]'); if (!input.value) input.value = journey.name; }
  const id = params.get('project'); if (!id) return;
  let project = await getProject(id); if (!project) return;
  const preset = journeys.find(j => 'workflow:' + j.id === project.template);
  let chosen = new Set(Array.isArray(project.tools) ? project.tools : preset?.suggested || []);
  if (!Array.isArray(project.tools) && preset) project = await updateProject(id, { tools: [...chosen] });
  host.hidden = false;
  const heading = node('div', '', 'co-toolkit-heading'); heading.append(node('div', 'YOUR PROJECT TOOLKIT', 'co-kicker'), node('h2', preset?.name || 'Bring your tools together'));
  host.append(heading, node('p', preset?.handoff || 'Choose the apps for this project. Keep exports and source files below, then import them into the next app.'));
  const selected = node('div', '', 'co-selected'), status = node('p', '', 'co-tool-status'); status.setAttribute('role', 'status');
  const details = node('details', '', 'co-picker'), summary = node('summary', 'Choose apps'); details.append(summary);
  const label = node('label', 'Find an app'), search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Name or creative task'; label.append(search);
  const results = node('div', '', 'co-app-options'), empty = node('p', 'No matches. Try another name or task.'); empty.hidden = true;
  details.append(label, results, empty); host.append(selected, details, status);
  const known = apps.filter(a => safe(a.openUrl));
  function renderSelected() {
    selected.replaceChildren();
    const items = [...chosen].map(id => known.find(a => a.id === id)).filter(Boolean);
    if (!items.length) selected.append(node('p', 'Choose a few apps to make a toolkit for this project.'));
    for (const app of items) {
      const card = node('article', '', 'co-tool'); card.append(node('span', app.groupLabel, 'co-kicker'), node('h3', app.name), node('p', app.blurb));
      const actions = node('div', '', 'co-tool-actions'); actions.append(anchor('Open ' + app.name, app.openUrl));
      if (safe(app.guide)) actions.append(anchor('Guide', app.guide));
      card.append(actions); selected.append(card);
    }
    summary.textContent = 'Choose apps · ' + items.length + ' selected';
  }
  for (const app of known) {
    const option = node('label', '', 'co-app-option'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = chosen.has(app.id); input.value = app.id;
    const text = node('span'); text.append(node('strong', app.name), node('small', app.groupLabel)); option.append(input, text); option.dataset.search = (app.name + ' ' + app.blurb + ' ' + app.groupLabel).toLowerCase(); results.append(option);
    input.addEventListener('change', async () => {
      const next = new Set(chosen); input.checked ? next.add(app.id) : next.delete(app.id);
      const inputs = [...results.querySelectorAll('input')]; inputs.forEach(i => i.disabled = true);
      try { await updateProject(id, { tools: [...next] }); chosen = next; renderSelected(); status.textContent = 'Toolkit saved on this device. It is included in your project archive.'; }
      catch { input.checked = chosen.has(app.id); status.textContent = 'Could not save the toolkit. Your previous selection is unchanged.'; }
      finally { inputs.forEach(i => i.disabled = false); }
    });
  }
  search.addEventListener('input', () => { const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean); let count = 0; for (const el of results.children) { el.hidden = !words.every(w => el.dataset.search.includes(w)); if (!el.hidden) count++; } empty.hidden = count > 0; });
  renderSelected();
}
if (host) start().catch(error => { host.hidden = false; host.replaceChildren(node('p', error.message || 'App catalog unavailable. Your saved files remain accessible.')); });
