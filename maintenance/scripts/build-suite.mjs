#!/usr/bin/env node
// Inline suite/v1/apps.json into suite/v1/suite.js as the offline fallback
// registry, after validating it. Run after every apps.json edit:
//   node maintenance/scripts/build-suite.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const appsPath = join(root, 'suite/v1/apps.json');
const suitePath = join(root, 'suite/v1/suite.js');
const reg = JSON.parse(readFileSync(appsPath, 'utf8'));

const groups = new Set(reg.groups.map((g) => g.id).concat(['community']));
const ids = new Set();
const problems = [];
for (const a of reg.apps) {
  if (!/^[a-z0-9-]+$/.test(a.id)) problems.push(`bad id ${a.id}`);
  if (ids.has(a.id)) problems.push(`duplicate id ${a.id}`);
  ids.add(a.id);
  if (!a.name) problems.push(`${a.id}: missing name`);
  if (!groups.has(a.group)) problems.push(`${a.id}: unknown group ${a.group}`);
  for (const k of ['url', 'openUrl']) {
    try { if (new URL(a[k]).protocol !== 'https:') problems.push(`${a.id}: ${k} not https`); }
    catch { problems.push(`${a.id}: bad ${k}`); }
  }
  if (!Array.isArray(a.accepts)) problems.push(`${a.id}: accepts must be an array`);
}
for (const a of reg.apps) if (a.parent && !ids.has(a.parent)) problems.push(`${a.id}: unknown parent ${a.parent}`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const src = readFileSync(suitePath, 'utf8');
const re = /\/\*@REGISTRY\*\/[\s\S]*?\/\*@END\*\//;
if (!re.test(src)) { console.error('markers not found in suite.js'); process.exit(1); }
const out = src.replace(re, () => `/*@REGISTRY*/${JSON.stringify(reg)}/*@END*/`);
writeFileSync(suitePath, out);
console.log(`suite.js: inlined ${reg.apps.length} apps (${out.length} bytes)`);
