import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/librarian.mjs';
import { createAiGuard } from '../netlify/lib/ai-guard.mjs';
const env = { LIBRARIAN_AI_ENABLED: 'true', SUPABASE_URL: 'https://accounts.invalid', SUPABASE_PUBLISHABLE_KEY: 'public-key', SUPABASE_SERVICE_ROLE_KEY: 'server-key' };
const make = (body = { books: [{ title: 'Book' }] }, headers = {}) => new Request('https://library.invalid/api', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer abcdefghijklmnopqrstuvwxyz', ...headers }, body: JSON.stringify(body) });

test('public unauthenticated diagnostic invokes no providers', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Must not fetch'); };
  try {
    const response = await handler(make({ test: true }, { authorization: '' }));
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally { globalThis.fetch = original; }
});

test('unconfigured accounts and foreign origins fail closed before fetching', async () => {
  const guard = createAiGuard({ env: {}, fetcher: () => { throw new Error('Unexpected fetch'); } });
  await assert.rejects(guard(make()), { status: 503 });
  await assert.rejects(guard(make({}, { origin: 'https://foreign.invalid' })), { status: 403 });
});

test('confirmed identity and durable quota precede provider admission', async () => {
  const calls = [];
  const guard = createAiGuard({ env, fetcher: async (url, options) => {
    calls.push([String(url), options]);
    return Response.json(calls.length === 1 ? { id: 'user-id', email: 'tester@example.test', email_confirmed_at: 'now' } : true);
  } });
  assert.equal((await guard(make())).books[0].title, 'Book');
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1][1].body), { account_id: 'user-id' });
  assert.ok(calls.every(([, options]) => options.signal instanceof AbortSignal));
});

test('unverified accounts, malformed payloads, public diagnostics and quota failures are refused', async () => {
  for (const [user, body, quota, expected] of [
    [{ id: 'one' }, { books: [] }, true, 403],
    [{ id: 'one', email: 'e', email_confirmed_at: 'now', is_anonymous: true }, { books: [] }, true, 403],
    [null, { test: true }, true, 400],
    [null, { books: [{ title: 'x'.repeat(501) }] }, true, 400],
    [null, { books: [{ title: 'Book' }], question: 'x'.repeat(40000) }, true, 413],
    [null, { books: [{ title: 'Book' }] }, false, 429],
    [null, { books: [{ title: 'Book' }] }, 'unavailable', 503],
  ]) {
    let calls = 0;
    const guard = createAiGuard({ env, fetcher: async () => {
      if (++calls === 1) return Response.json(user || { id: 'one', email: 'e', email_confirmed_at: 'now' });
      if (quota === 'unavailable') throw new Error('Database offline');
      return Response.json(quota);
    } });
    await assert.rejects(guard(make(body)), { status: expected });
  }
});

test('expired sessions and account-service failures stop before quota', async () => {
  for (const [status, expected] of [[401, 401], [403, 401], [429, 503], [500, 503]]) {
    let calls = 0;
    const guard = createAiGuard({ env, fetcher: async () => { calls++; return new Response(null, { status }); } });
    await assert.rejects(guard(make()), { status: expected });
    assert.equal(calls, 1, 'a failed account check must never consume quota');
  }
  const unavailable = createAiGuard({ env, fetcher: async () => { throw new Error('offline'); } });
  await assert.rejects(unavailable(make()), { status: 503 });
});

test('missing or malformed bearer cannot reach the account or quota service', async () => {
  let calls = 0;
  const guard = createAiGuard({ env, fetcher: async () => { calls++; throw new Error('not permitted'); } });
  for (const authorization of ['', 'Basic abcdefghijklmnopqrstuvwxyz', 'Bearer short', 'Bearer ' + 'x'.repeat(8193)]) {
    await assert.rejects(guard(make(undefined, { authorization })), { status: 401 });
  }
  assert.equal(calls, 0);
});
