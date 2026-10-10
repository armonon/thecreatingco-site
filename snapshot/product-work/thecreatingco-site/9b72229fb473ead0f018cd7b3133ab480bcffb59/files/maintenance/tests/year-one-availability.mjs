import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = async route => fs.readFile(path.join(root, route, 'index.html'), 'utf8');

test('public availability copy distinguishes Reclaim Mac alpha from Creative Suite native releases', async () => {
  const [about, testing, kickstarter, downloads] = await Promise.all([
    read('about'), read('testing'), read('kickstarter'), read('downloads'),
  ]);
  for (const page of [about, testing, kickstarter]) {
    assert.match(page, /Reclaim for Mac is available as a free alpha/);
    assert.match(page, /href="\/downloads\/"/);
    assert.doesNotMatch(page, /no public native downloads (?:are )?available yet/i);
  }
  assert.match(about, /four Creative Suite apps for Windows and Mac/);
  assert.match(testing, /public web apps and tools/);
  assert.doesNotMatch(testing, /all nine apps/);
  assert.match(downloads, /Download the free Reclaim Mac alpha/);
  assert.match(downloads, /Other native editions remain in development/);
});
