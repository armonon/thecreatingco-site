import { listProjects, createProject, getProject, updateProject, getFiles, addFiles, exportProject, importProject } from './workspace-core.js';
const $ = s => document.querySelector(s);
const element = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
const message = (text, error = false) => { $('#cw-status').textContent = text; $('#cw-status').dataset.error = String(error); };
let project, templates;
const stages = [
  ['form', 'Form / Object', 'https://form.thecreatingco.com/studio', 'Native .form or geometry files; export an image for Luma.'],
  ['luma', 'Luma / Image', 'https://luma.thecreatingco.com/studio', 'Native .luma projects; PNG or JPEG for the film stage.'],
  ['stemdeck', 'StemDeck / Sound', 'https://sattarimusic.com/studio', 'Native .sattari sessions; WAV or audio exports for the film stage.'],
  ['scenepilot', 'ScenePilot / Film', 'https://scenepilot.thecreatingco.com/app/', 'Keep the cut map and source media together; reattach media when needed.'],
  ['other', 'References & credits', '/locker/', 'Source credits and supporting files.'],
];
function link(text, url, external = false) { const a = element('a', text); a.href = url; if (external) { a.target = '_blank'; a.rel = 'noopener'; } return a; }
function download(blob, name) { const url = URL.createObjectURL(blob), a = link('', url); a.download = name.replace(/[\x00-\x1f/\\]/g, '_'); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
async function run(button, action) { if (button.disabled) return; button.disabled = true; try { await action(); } catch (error) { message(error.message || 'This operation could not finish.', true); } finally { button.disabled = false; } }
function go(id) { location.assign('/workspace/?project=' + encodeURIComponent(id)); }
async function renderFiles() {
  const files = await getFiles(project.id); project = await getProject(project.id);
  $('#cw-usage').textContent = `${files.length} files / ${(project.bytes / 1048576).toFixed(1)} MB`;
  $('#cw-stages').replaceChildren();
  for (const [id, title, url, detail] of stages) {
    const section = element('section', '', 'cw-stage'), header = element('header');
    header.append(element('h3', title), link(id === 'other' ? 'Open Locker' : 'Open app', url, true)); section.append(header, element('p', detail));
    const list = element('ul');
    for (const file of files.filter(f => f.stage === id).sort((a, b) => b.added - a.added)) {
      const li = element('li'), info = element('div'), button = element('button', 'Download'); button.type = 'button'; button.setAttribute('aria-label', 'Download ' + file.name);
      info.append(element('strong', file.name), element('small', `${(file.size / 1024).toFixed(1)} KB / ${new Date(file.added).toLocaleString()}`));
      button.addEventListener('click', () => download(file.blob, file.name)); li.append(info, button); list.append(li);
    }
    section.append(list.children.length ? list : element('p', 'No files in this stage yet.')); $('#cw-stages').append(section);
  }
}
async function source() {
  const template = templates.find(t => t.id === project.template);
  if (!template) { $('#cw-source').hidden = true; return; }
  const image = element('img'); image.src = template.image; image.alt = template.name + ' original project';
  const copy = element('div'), actions = element('div', '', 'cw-links');
  copy.append(element('h2', 'Based on ' + template.name), element('p', template.credit));
  actions.append(link('View original', template.view, true), link(template.id === 'orbit' ? 'Open project guide' : 'Try in the editor', template.try, true));
  if (template.files?.length) {
    const button = element('button', 'Keep starter files'); button.type = 'button';
    const existing = await getFiles(project.id);
    if (template.files.every(f => existing.some(e => e.name === f.name))) { button.disabled = true; button.textContent = 'Starter files kept'; }
    button.addEventListener('click', () => run(button, async () => {
      message('Downloading and checking the starter files...');
      const files = [], stageMap = {};
      for (const asset of template.files) {
        const response = await fetch(asset.url); if (!response.ok) throw new Error('Starter download failed. No files were added.');
        const bytes = await response.arrayBuffer();
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
        if (digest !== asset.sha256) throw new Error('A starter file changed. No files were added; reload and try again.');
        files.push(new File([bytes], asset.name, { type: asset.type })); stageMap[asset.name] = asset.stage;
      }
      await addFiles(project.id, files, stageMap); await renderFiles(); button.textContent = 'Starter files kept'; message('Original starter files and credits saved in this project.');
    }).then(() => { if (button.textContent === 'Starter files kept') button.disabled = true; })); actions.append(button);
  }
  copy.append(actions); $('#cw-source').append(image, copy);
}
async function init() {
  try { const response = await fetch('/creating/starters.json'); if (!response.ok) throw new Error(); templates = await response.json(); }
  catch { templates = []; message('Starting points are unavailable. Your saved files are still accessible.', true); }
  const id = new URLSearchParams(location.search).get('project');
  if (id) {
    project = await getProject(id); if (!project) throw new Error('This project is not on this device. Import its archive or return to My projects.');
    $('#cw-library').hidden = true; $('#cw-detail').hidden = false;
    $('#cw-name').value = project.name; $('#cw-notes').value = project.notes;
    document.title = project.name + ' | My projects'; await source(); await renderFiles();
  } else {
    await renderLibrary();
  }
}
async function renderLibrary() {
  for (const archived of [false, true]) {
    const target = $(archived ? '#cw-archive-list' : '#cw-projects'), projects = await listProjects({ archived });
    target.replaceChildren();
    if (!projects.length) target.append(element('p', archived ? 'No archived projects.' : 'No saved projects on this device yet.'));
    for (const p of projects) {
      const card = element('article', '', 'cw-project-card'), button = element('button', archived ? 'Restore' : 'Archive'); button.type = 'button';
      button.setAttribute('aria-label', (archived ? 'Restore ' : 'Archive ') + p.name);
      button.addEventListener('click', () => run(button, async () => { await updateProject(p.id, { archived: !archived }); await renderLibrary(); message(archived ? 'Project restored.' : 'Project archived. Its files are kept; you can restore it below.'); }));
      card.append(link(p.name, '/workspace/?project=' + encodeURIComponent(p.id)), element('p', `${p.count} files / Updated ${new Date(p.updated).toLocaleDateString()}`), button); target.append(card);
    }
  }
}
$('#cw-new').addEventListener('submit', e => { e.preventDefault(); run(e.submitter, async () => { const data = new FormData(e.target); const p = await createProject({ name: data.get('name'), template: data.get('template') }); go(p.id); }); });
$('#cw-details').addEventListener('submit', e => { e.preventDefault(); run(e.submitter, async () => { project = await updateProject(project.id, { name: $('#cw-name').value, notes: $('#cw-notes').value }); message('Project details saved on this device.'); dirty = false; }); });
$('#cw-add').addEventListener('submit', e => { e.preventDefault(); run(e.submitter, async () => { await addFiles(project.id, $('#cw-files').files, $('#cw-stage').value); $('#cw-files').value = ''; await renderFiles(); message('New versions saved. Previous files are unchanged.'); }); });
$('#cw-export').addEventListener('click', e => run(e.currentTarget, async () => { if (dirty) throw new Error('Save your project details before exporting.'); message('Preparing archive...'); download(await exportProject(project.id), project.name + '.creatingco.zip'); message('Archive downloaded with your files, notes and source reference.'); }));
$('#cw-import').addEventListener('change', async e => { const file = e.target.files[0]; if (!file) return; e.target.disabled = true; try { message('Checking project archive...'); const p = await importProject(file); go(p.id); } catch (error) { message(error.message || 'Could not import this archive.', true); } finally { e.target.disabled = false; e.target.value = ''; } });
let dirty = false;
$('#cw-details').addEventListener('input', () => { dirty = true; });
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
init().catch(error => message(error.message, true));
