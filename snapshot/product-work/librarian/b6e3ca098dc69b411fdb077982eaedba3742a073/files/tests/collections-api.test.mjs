import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/collections.mjs';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const headers = { 'content-type': 'application/json', authorization: `Bearer ${'a'.repeat(32)}` };
const settings = () => {
  process.env.SUPABASE_URL = 'https://accounts.example.test';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-test-key';
};
const restore = () => {
  for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
};

test('writes require verified identity and private lookup conceals unauthorized records', async () => {
  settings(); let storageCalls = 0;
  globalThis.fetch = async url => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'bob', email: 'bob@example.test', email_confirmed_at: 'now' });
    storageCalls++;
    return Response.json([{ id: 'c1', owner_id: 'alice', visibility: 'private', title: 'Private' }]);
  };
  try {
    const missingSession = await handler(new Request('https://library.example.test/.netlify/functions/collections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
    assert.equal(missingSession.status, 401);
    assert.equal(storageCalls, 0);
    const hidden = await handler(new Request('https://library.example.test/.netlify/functions/collections?slug=private', { headers: { ...headers } }));
    assert.equal(hidden.status, 404);
  } finally { restore(); }
});

test('an owner update is always scoped by the verified owner id', async () => {
  settings(); const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url); requests.push([address, options]);
    if (address.includes('/auth/v1/user')) return Response.json({ id: 'alice', email: 'alice@example.test', email_confirmed_at: 'now' });
    if (options.method === 'PATCH') return Response.json([{ id: 'c1', title: 'Visible', slug: 'visible', description: '', visibility: 'public', theme: 'linen' }]);
    return Response.json([{ id: 'c1', owner_id: 'alice' }]);
  };
  try {
    const response = await handler(new Request('https://library.example.test/.netlify/functions/collections?id=11111111-1111-4111-8111-111111111111', {
      method: 'PATCH', headers, body: JSON.stringify({ title: 'Visible', slug: 'visible', visibility: 'public', theme: 'linen' }),
    }));
    assert.equal(response.status, 200);
    const ownerLookup = requests.find(([url]) => url.includes('owner_id=eq.alice'))?.[0];
    assert.ok(ownerLookup, 'database lookup constrains writes to the verified owner');
    const update = requests.find(([, options]) => options.method === 'PATCH');
    assert.match(update[0], /owner_id=eq\.alice/);
  } finally { restore(); }
});
