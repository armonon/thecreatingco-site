import { createCollectionsGuard, CollectionError, readJson, validateCollection, mayReadCollection } from '../lib/collections-guard.mjs';

const guard = createCollectionsGuard();
const baseHeaders = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
async function db(url, key, path, options = {}) {
  const response = await fetch(new URL(path, url), {
    ...options,
    signal: AbortSignal.timeout(8000),
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new CollectionError(response.status === 409 ? 409 : 503, response.status === 409 ? 'That collection URL is already in use.' : 'Collection storage is unavailable.');
  if (response.status === 204) return null;
  return response.json();
}

async function authorized(req) { return guard(req); }

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders });
  try {
    const incoming = new URL(request.url);
    const slug = incoming.searchParams.get('slug');

    if (request.method === 'GET' && slug) {
      if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug)) throw new CollectionError(404, 'Collection not found.');
      const record = await db(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/collections?slug=eq.${encodeURIComponent(slug)}&select=id,owner_id,title,slug,description,visibility,theme,cover_url,created_at&limit=1`);
      const collection = record[0];
      let accountId = null;
      if (collection?.visibility === 'private' && request.headers.has('authorization')) {
        try { accountId = (await authorized(request)).user.id; } catch { /* private records remain indistinguishable from missing ones */ }
      }
      if (!mayReadCollection(collection, accountId)) throw new CollectionError(404, 'Collection not found.');
      const books = await db(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/collection_books?collection_id=eq.${encodeURIComponent(collection.id)}&upload_state=eq.ready&select=id,title,author,description,tags,sort_order,featured,page_count,thumbnail_data&order=sort_order.asc,created_at.asc`);
      return Response.json({ collection: { ...collection, owner_id: undefined }, books }, { headers: { ...baseHeaders, 'cache-control': collection.visibility === 'public' ? 'public, max-age=60' : 'no-store' } });
    }

    if (request.method === 'GET' && incoming.searchParams.get('mine') === '1') {
      const { user, supabaseUrl, serviceKey } = await authorized(request);
      const collections = await db(supabaseUrl, serviceKey, `/rest/v1/collections?owner_id=eq.${encodeURIComponent(user.id)}&select=id,title,slug,description,visibility,theme,cover_url,created_at,updated_at&order=created_at.desc`);
      return Response.json({ collections }, { headers: baseHeaders });
    }

    if (request.method === 'GET' && incoming.searchParams.get('directory') === '1') {
      const collections = await db(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, '/rest/v1/collections?visibility=eq.public&select=id,title,slug,description,theme,cover_url,created_at&order=created_at.desc&limit=60');
      return Response.json({ collections }, { headers: { ...baseHeaders, 'cache-control': 'public, max-age=60' } });
    }

    if (request.method === 'POST') {
      const { user, supabaseUrl, serviceKey } = await authorized(request);
      const body = validateCollection(await readJson(request));
      const rows = await db(supabaseUrl, serviceKey, '/rest/v1/rpc/create_librarian_collection', {
        method: 'POST', body: JSON.stringify({ p_owner_id: user.id, p_title: body.title, p_slug: body.slug, p_description: body.description, p_visibility: body.visibility, p_theme: body.theme, p_cover_url: body.cover_url }),
      });
      if (!rows?.length) throw new CollectionError(429, 'You can create up to 12 collections.');
      return Response.json({ collection: rows[0] }, { status: 201, headers: baseHeaders });
    }

    if (request.method === 'PATCH') {
      const { user, supabaseUrl, serviceKey } = await authorized(request);
      const id = incoming.searchParams.get('id');
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new CollectionError(400, 'Collection id is required.');
      const current = await db(supabaseUrl, serviceKey, `/rest/v1/collections?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(user.id)}&select=id,owner_id`);
      if (!current.length) throw new CollectionError(404, 'Collection not found.');
      const body = validateCollection(await readJson(request));
      const rows = await db(supabaseUrl, serviceKey, `/rest/v1/collections?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(user.id)}&select=id,title,slug,description,visibility,theme,cover_url,created_at`, {
        method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify(body),
      });
      return Response.json({ collection: rows[0] }, { headers: baseHeaders });
    }

    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { ...baseHeaders, allow: 'GET, POST, PATCH, OPTIONS' } });
  } catch (error) {
    const status = error instanceof CollectionError ? error.status : 503;
    return Response.json({ error: error instanceof CollectionError ? error.message : 'Collection storage is unavailable.' }, { status, headers: baseHeaders });
  }
}
