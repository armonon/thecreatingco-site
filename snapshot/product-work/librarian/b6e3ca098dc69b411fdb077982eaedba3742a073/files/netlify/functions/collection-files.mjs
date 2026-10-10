import { createCollectionsGuard, CollectionError, readJson, mayReadCollection } from '../lib/collections-guard.mjs';

const guard = createCollectionsGuard();
const bucket = 'librarian-collections';
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const LIMIT = 50 * 1024 * 1024;
const UUID = /^[0-9a-f-]{36}$/i;

async function request(url, key, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000), headers: { apikey: key, authorization: `Bearer ${key}`, ...(options.headers || {}) } });
  return response;
}
async function rows(context, path, options = {}) {
  const response = await request(new URL(path, context.supabaseUrl), context.serviceKey, {
    ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new CollectionError(response.status === 409 ? 409 : 503, response.status === 409 ? 'That item already exists.' : 'Collection storage is unavailable.');
  return response.status === 204 ? null : response.json();
}
async function storage(context, path, options = {}) {
  return request(new URL(`/storage/v1${path}`, context.supabaseUrl), context.serviceKey, options);
}
export function validateMetadata(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CollectionError(400, 'Invalid PDF metadata.');
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 240) throw new CollectionError(400, 'Title must be 1–240 characters.');
  if (!Number.isSafeInteger(body.pageCount) || body.pageCount < 1 || body.pageCount > 100000) throw new CollectionError(400, 'PDF page count is invalid.');
  if (typeof body.thumbnailData !== 'string' || body.thumbnailData.length > 40000 || (body.thumbnailData && !/^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.thumbnailData))) throw new CollectionError(400, 'PDF thumbnail is invalid.');
  if (body.author !== undefined && (typeof body.author !== 'string' || body.author.length > 240)) throw new CollectionError(400, 'Author must be 240 characters or fewer.');
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 2000)) throw new CollectionError(400, 'Description must be 2,000 characters or fewer.');
  const tags = body.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 20 || tags.some(tag => typeof tag !== 'string' || tag.trim().length < 1 || tag.length > 40)) throw new CollectionError(400, 'Use up to 20 tags, each 40 characters or fewer.');
  return { title: body.title.trim(), author: body.author?.trim() || '', description: body.description?.trim() || '', tags: [...new Set(tags.map(tag => tag.trim()))] };
}
export function validateUploadRequest(body) {
  if (!body || !UUID.test(body.collectionId) || !Number.isSafeInteger(body.bytes) || body.bytes < 1 || body.bytes > LIMIT || body.mime !== 'application/pdf') throw new CollectionError(400, 'Choose a PDF file up to 50 MB.');
  if (body.shareRights !== true) throw new CollectionError(400, 'Confirm you have the rights or permission to share this PDF.');
  return validateMetadata(body);
}
async function getBook(context, id) {
  const rowsFound = await rows(context, `/rest/v1/collection_books?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(context.user.id)}&select=id,collection_id,storage_path,byte_size,upload_state,title,author,description,tags,sort_order,featured`);
  if (!rowsFound.length) throw new CollectionError(404, 'PDF not found.');
  return rowsFound[0];
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (req.method === 'POST' && action === 'read') {
      const body = await readJson(req);
      if (typeof body.slug !== 'string' || !UUID.test(body.bookId)) throw new CollectionError(404, 'PDF not found.');
      const collectionRows = await rows({ supabaseUrl: new URL(process.env.SUPABASE_URL), serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }, `/rest/v1/collections?slug=eq.${encodeURIComponent(body.slug)}&select=id,owner_id,visibility&limit=1`);
      const collection = collectionRows[0];
      let accountId = null;
      if (collection?.visibility === 'private' && req.headers.has('authorization')) {
        try { accountId = (await guard(req)).user.id; } catch { /* not owner */ }
      }
      if (!mayReadCollection(collection, accountId)) throw new CollectionError(404, 'PDF not found.');
      const bookRows = await rows({ supabaseUrl: new URL(process.env.SUPABASE_URL), serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }, `/rest/v1/collection_books?id=eq.${encodeURIComponent(body.bookId)}&collection_id=eq.${encodeURIComponent(collection.id)}&upload_state=eq.ready&select=id,storage_path,title,author,description,tags,page_count`);
      if (!bookRows.length) throw new CollectionError(404, 'PDF not found.');
      const signed = await storage({ supabaseUrl: new URL(process.env.SUPABASE_URL), serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }, `/object/sign/${bucket}/${bookRows[0].storage_path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) });
      if (!signed.ok) throw new CollectionError(503, 'PDF reader is unavailable.');
      const { signedURL } = await signed.json();
      return Response.json({ book: bookRows[0], url: new URL(`/storage/v1${signedURL}`, process.env.SUPABASE_URL).href }, { headers });
    }

    const context = await guard(req);
    if (req.method !== 'POST') throw new CollectionError(405, 'POST required.');
    const body = await readJson(req);
    if (action === 'start') {
      const metadata = validateUploadRequest(body);
      const bookId = crypto.randomUUID();
      const path = `${context.user.id}/${body.collectionId}/${bookId}.pdf`;
      const admitted = await rows(context, '/rest/v1/rpc/reserve_librarian_collection_upload', { method: 'POST', body: JSON.stringify({ p_account_id: context.user.id, p_collection_id: body.collectionId, p_book_id: bookId, p_storage_path: path, p_bytes: body.bytes, p_title: metadata.title, p_author: metadata.author, p_description: metadata.description, p_tags: metadata.tags, p_page_count: body.pageCount, p_thumbnail_data: body.thumbnailData, p_share_rights: body.shareRights }) });
      if (admitted !== true) throw new CollectionError(429, 'Collection not found or upload quota reached.');
      const signed = await storage(context, `/object/upload/sign/${bucket}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!signed.ok) {
        await rows(context, `/rest/v1/collection_books?id=eq.${bookId}&owner_id=eq.${context.user.id}`, { method: 'DELETE' });
        throw new CollectionError(503, 'Could not prepare a secure upload.');
      }
      const result = await signed.json();
      return Response.json({ bookId, path, uploadUrl: new URL(`/storage/v1${result.url}`, context.supabaseUrl).href }, { status: 201, headers });
    }
    if (action === 'finish') {
      if (!UUID.test(body.bookId)) throw new CollectionError(400, 'PDF upload id is invalid.');
      const book = await getBook(context, body.bookId);
      const info = await storage(context, `/object/${bucket}/${book.storage_path}`, { method: 'HEAD' });
      if (!info.ok || Number(info.headers.get('content-length')) !== book.byte_size || Number(info.headers.get('content-length')) > LIMIT) throw new CollectionError(400, 'Uploaded PDF size did not match its reservation.');
      const sample = await storage(context, `/object/${bucket}/${book.storage_path}`, { headers: { range: 'bytes=0-4' } });
      const signature = sample.ok && sample.status === 206 ? new Uint8Array(await sample.arrayBuffer()) : new Uint8Array();
      if (!sample.ok || sample.status !== 206 || signature.byteLength > 1024 || new TextDecoder().decode(signature.slice(0, 5)) !== '%PDF-') {
        await storage(context, `/object/${bucket}/${book.storage_path}`, { method: 'DELETE' });
        await rows(context, `/rest/v1/collection_books?id=eq.${book.id}&owner_id=eq.${context.user.id}`, { method: 'DELETE' });
        throw new CollectionError(415, 'File contents are not a valid PDF.');
      }
      await rows(context, `/rest/v1/collection_books?id=eq.${book.id}&owner_id=eq.${context.user.id}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ upload_state: 'ready', updated_at: new Date().toISOString() }) });
      return Response.json({ ready: true }, { headers });
    }
    if (action === 'update') {
      if (!UUID.test(body.bookId) || !body.update || typeof body.update !== 'object' || Array.isArray(body.update)) throw new CollectionError(400, 'Invalid PDF update.');
      const book = await getBook(context, body.bookId);
      const patch = {};
      const update = body.update;
      if (Object.keys(update).some(key => !['title','author','description','tags','sort_order','featured'].includes(key))) throw new CollectionError(400, 'Unsupported PDF field.');
      if (update.title !== undefined) {
        if (typeof update.title !== 'string' || !update.title.trim() || update.title.trim().length > 240) throw new CollectionError(400, 'Title must be 1–240 characters.');
        patch.title = update.title.trim();
      }
      if (update.author !== undefined) {
        if (typeof update.author !== 'string' || update.author.length > 240) throw new CollectionError(400, 'Author must be 240 characters or fewer.');
        patch.author = update.author.trim();
      }
      if (update.description !== undefined) {
        if (typeof update.description !== 'string' || update.description.length > 2000) throw new CollectionError(400, 'Description must be 2,000 characters or fewer.');
        patch.description = update.description.trim();
      }
      if (update.tags !== undefined) {
        if (!Array.isArray(update.tags) || update.tags.length > 20 || update.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 40)) throw new CollectionError(400, 'Use up to 20 tags, each 40 characters or fewer.');
        patch.tags = [...new Set(update.tags.map(tag => tag.trim()))];
      }
      if (update.sort_order !== undefined) {
        if (!Number.isSafeInteger(update.sort_order) || update.sort_order < 0 || update.sort_order > 99) throw new CollectionError(400, 'Invalid shelf position.');
        patch.sort_order = update.sort_order;
      }
      if (update.featured !== undefined) {
        if (typeof update.featured !== 'boolean') throw new CollectionError(400, 'Featured must be true or false.');
        patch.featured = update.featured;
      }
      if (!Object.keys(patch).length) throw new CollectionError(400, 'No PDF changes supplied.');
      const changed = await rows(context, `/rest/v1/collection_books?id=eq.${book.id}&owner_id=eq.${context.user.id}&select=id,title,author,description,tags,sort_order,featured`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify(patch) });
      return Response.json({ book: changed[0] }, { headers });
    }
    if (action === 'delete') {
      if (!UUID.test(body.bookId)) throw new CollectionError(400, 'PDF id is invalid.');
      const book = await getBook(context, body.bookId);
      const removed = await storage(context, `/object/${bucket}/${book.storage_path}`, { method: 'DELETE' });
      if (!removed.ok && removed.status !== 404) throw new CollectionError(503, 'Could not remove the stored PDF.');
      await rows(context, `/rest/v1/collection_books?id=eq.${book.id}&owner_id=eq.${context.user.id}`, { method: 'DELETE' });
      return Response.json({ deleted: true }, { headers });
    }
    throw new CollectionError(400, 'Unknown collection file action.');
  } catch (error) {
    const status = error instanceof CollectionError ? error.status : 503;
    return Response.json({ error: error instanceof CollectionError ? error.message : 'Collection file service is unavailable.' }, { status, headers });
  }
}
