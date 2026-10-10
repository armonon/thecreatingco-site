import { zipSync, unzipSync, strToU8, strFromU8 } from './fflate.js';

export const LIMIT = 100 * 1024 * 1024;
const STAGES = ['form', 'luma', 'stemdeck', 'scenepilot', 'other'];
let connection;
const clean = (value, max) => String(value || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max);
function cleanTools(value) { return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id)))].slice(0, 100) : []; }
export function validStage(stage) { return STAGES.includes(stage) ? stage : 'other'; }
const formats = {
  form: ['.form', '.stl', '.obj', '.glb', '.gltf', '.step', '.stp', '.ply', '.svg', '.dxf', '.usd', '.usdz'],
  luma: ['.luma', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp', '.svg', '.gif', '.tif', '.tiff', '.psd'],
  stemdeck: ['.sattari', '.wav', '.mp3', '.flac', '.ogg', '.aif', '.aiff', '.m4a', '.mid', '.midi'],
  scenepilot: ['.animate', '.srt', '.vtt', '.scenepilot.json', '.mp4', '.mov', '.webm', '.m4v', '.wav', '.mp3', '.png', '.jpg', '.jpeg', '.webp'],
};
export function fitsStage(name, stage) { return !formats[stage] || formats[stage].some(ext => String(name).toLowerCase().endsWith(ext)); }
function db() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('tcc-creating-projects', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('projects', { keyPath: 'id' });
      request.result.createObjectStore('files', { keyPath: 'id' }).createIndex('project', 'project');
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = null; }; resolve(request.result); };
    request.onerror = () => { connection = null; reject(new Error('Project storage is unavailable. Your files have not been saved.')); };
    request.onblocked = () => { connection = null; reject(new Error('Close other project tabs, then reload.')); };
  });
  return connection;
}
async function transaction(mode, action) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['projects', 'files'], mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage is full. Nothing from this operation was saved.' : 'Could not save this change. Your previous project is intact.'));
    try { action(tx.objectStore('projects'), tx.objectStore('files'), value => { result = value; }); }
    catch (error) { tx.abort(); reject(error); }
  });
}
export async function listProjects({ archived = false } = {}) {
  const list = await transaction('readonly', (p, f, done) => { p.getAll().onsuccess = e => done(e.target.result); });
  return list.filter(p => Boolean(p.archived) === archived).sort((a, b) => b.updated - a.updated);
}
export function getProject(id) { return transaction('readonly', (p, f, done) => { p.get(id).onsuccess = e => done(e.target.result); }); }
export function getFiles(id) { return transaction('readonly', (p, f, done) => { f.index('project').getAll(id).onsuccess = e => done(e.target.result); }); }
export async function createProject({ name, template = 'blank' }) {
  const project = { id: crypto.randomUUID(), name: clean(name, 100).trim() || 'Untitled project', template: clean(template, 80), notes: '', created: Date.now(), updated: Date.now(), bytes: 0, count: 0 };
  await transaction('readwrite', (p) => p.add(project));
  return project;
}
export function updateProject(id, patch) {
  return transaction('readwrite', (p, f, done) => {
    p.get(id).onsuccess = e => {
      const project = e.target.result;
      if (!project) return;
      if (typeof patch.name === 'string') project.name = clean(patch.name, 100).trim() || project.name;
      if (typeof patch.notes === 'string') project.notes = clean(patch.notes, 20000);
      if (Array.isArray(patch.tools)) project.tools = cleanTools(patch.tools);
      if (typeof patch.archived === 'boolean') project.archived = patch.archived;
      project.updated = Date.now(); p.put(project); done(project);
    };
  });
}
export async function addFiles(id, inputs, stage) {
  const files = Array.from(inputs);
  if (!files.length || files.length > 30 || files.some(f => f.size > 50 * 1024 * 1024)) throw new Error('Add 1-30 files at a time, up to 50 MB each.');
  for (const file of files) {
    const target = validStage(typeof stage === 'object' ? stage[file.name] : stage);
    if (!fitsStage(file.name, target)) throw new Error(`${clean(file.name, 100)} does not match this stage's file types. Choose another stage or References & other files.`);
  }
  const bytes = files.reduce((n, file) => n + file.size, 0);
  return transaction('readwrite', (p, f, done) => {
    p.get(id).onsuccess = e => {
      const project = e.target.result;
      if (!project || project.bytes + bytes > LIMIT) { e.target.transaction?.abort(); return; }
      for (const file of files) f.add({ id: crypto.randomUUID(), project: id, name: clean(file.name, 200), type: clean(file.type, 100), size: file.size, stage: validStage(typeof stage === 'object' ? stage[file.name] : stage), added: Date.now(), blob: file });
      project.bytes += bytes; project.count += files.length; project.updated = Date.now(); p.put(project); done(project);
    };
  }).then(result => { if (!result) throw new Error('Project limit is 100 MB, or the project no longer exists.'); return result; });
}
export async function exportProject(id) {
  const project = await getProject(id);
  if (!project) throw new Error('Project not found.');
  const files = await getFiles(id), entries = {}, inventory = [];
  for (const file of files) {
    const path = 'files/' + file.id;
    entries[path] = new Uint8Array(await file.blob.arrayBuffer());
    inventory.push({ path, name: file.name, type: file.type, stage: file.stage, size: file.size });
  }
  entries['project.json'] = strToU8(JSON.stringify({ format: 'thecreatingco-project', version: 1, project: { name: project.name, notes: project.notes, template: project.template, tools: cleanTools(project.tools) }, files: inventory }, null, 2));
  return new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' });
}
export async function importProject(blob) {
  if (blob.size > LIMIT + 1024 * 1024) throw new Error('This project archive is too large.');
  let total = 0, count = 0;
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()), { filter: entry => {
    total += entry.originalSize; count++;
    if (total > LIMIT + 1024 * 1024 || count > 1000 || entry.originalSize > 50 * 1024 * 1024) throw new Error('Archive exceeds project limits.');
    return entry.name === 'project.json' || /^files\/[a-zA-Z0-9-]+$/.test(entry.name);
  } });
  if (!entries['project.json'] || entries['project.json'].length > 1024 * 1024) throw new Error('Not a thecreatingco project archive.');
  const manifest = JSON.parse(strFromU8(entries['project.json']));
  if (manifest.format !== 'thecreatingco-project' || manifest.version !== 1 || !manifest.project || !Array.isArray(manifest.files) || manifest.files.length > 999) throw new Error('Unsupported project format.');
  const seen = new Set(), id = crypto.randomUUID();
  const files = manifest.files.map(file => {
    if (!/^files\/[a-zA-Z0-9-]+$/.test(file.path) || seen.has(file.path) || !entries[file.path]) throw new Error('Archive contains missing or duplicate files.');
    seen.add(file.path);
    const bytes = entries[file.path];
    return { id: crypto.randomUUID(), project: id, name: clean(file.name, 200) || 'Untitled', type: clean(file.type, 100), size: bytes.length, stage: validStage(file.stage), added: Date.now(), blob: new Blob([bytes], { type: clean(file.type, 100) }) };
  });
  const project = { id, name: clean(manifest.project.name, 100) || 'Imported project', notes: clean(manifest.project.notes, 20000), template: clean(manifest.project.template, 80), tools: cleanTools(manifest.project.tools), bytes: files.reduce((n, f) => n + f.size, 0), count: files.length, created: Date.now(), updated: Date.now() };
  if (project.bytes > LIMIT) throw new Error('Project exceeds 100 MB.');
  await transaction('readwrite', (p, f) => { p.add(project); files.forEach(file => f.add(file)); });
  return project;
}
