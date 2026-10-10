import test from 'node:test';
import assert from 'node:assert/strict';
import { CollectionError, createCollectionsGuard, isOwner, mayReadCollection, validateCollection } from '../netlify/lib/collections-guard.mjs';

test('collection metadata is bounded and accepts only known visibility/theme values', () => {
  assert.deepEqual(validateCollection({ title: '  My books ', slug: 'my-books', visibility: 'unlisted' }), {
    title: 'My books', slug: 'my-books', description: '', visibility: 'unlisted', theme: 'reading-room', cover_url: null,
  });
  for (const input of [
    { title: '', slug: 'x', visibility: 'private' },
    { title: 'ok', slug: '../other', visibility: 'public' },
    { title: 'ok', slug: 'ok', visibility: 'friends' },
    { title: 'ok', slug: 'ok', visibility: 'private', unexpected: true },
    { title: 'ok', slug: 'ok', visibility: 'private', description: 'x'.repeat(1201) },
  ]) assert.throws(() => validateCollection(input), CollectionError);
});

test('private visibility and ownership are enforced independently of client input', () => {
  const collection = { id: 'c1', owner_id: 'alice', visibility: 'private' };
  assert.equal(mayReadCollection(collection, null), false);
  assert.equal(mayReadCollection(collection, 'bob'), false);
  assert.equal(mayReadCollection(collection, 'alice'), true);
  assert.equal(mayReadCollection({ ...collection, visibility: 'unlisted' }, null), true);
  assert.equal(mayReadCollection({ ...collection, visibility: 'public' }, null), true);
  assert.equal(isOwner(collection, 'alice'), true);
  assert.equal(isOwner(collection, 'bob'), false);
});

test('missing, malformed, unverified, and anonymous sessions fail closed before storage', async () => {
  const env = { SUPABASE_URL: 'https://accounts.example.test', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'server-only' };
  let calls = 0;
  const guard = createCollectionsGuard({ env, fetcher: async () => { calls++; return Response.json({ id: 'alice', email: 'a@example.test', email_confirmed_at: 'now' }); } });
  for (const authorization of ['', 'Basic abc', `Bearer ${'x'.repeat(9000)}`]) {
    await assert.rejects(guard(new Request('https://library.example.test/collections', { headers: { authorization } })), { status: 401 });
  }
  assert.equal(calls, 0);
  for (const user of [
    { id: 'alice', email: 'a@example.test', is_anonymous: true },
    { id: 'alice', email: 'a@example.test' },
  ]) {
    const unverified = createCollectionsGuard({ env, fetcher: async () => Response.json(user) });
    await assert.rejects(unverified(new Request('https://library.example.test/collections', { headers: { authorization: `Bearer ${'x'.repeat(24)}` } })), { status: 403 });
  }
});
