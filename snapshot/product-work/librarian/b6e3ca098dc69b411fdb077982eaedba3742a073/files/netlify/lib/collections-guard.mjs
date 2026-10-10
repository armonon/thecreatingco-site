const MAX_BODY = 16_384;

export class CollectionError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function readJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new CollectionError(415, 'JSON required.');
  const reader = request.body?.getReader();
  if (!reader) throw new CollectionError(400, 'Request body required.');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new CollectionError(413, 'Request too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof CollectionError) throw error;
    throw new CollectionError(400, 'Invalid JSON.');
  } finally { reader.releaseLock(); }
}

export function validateCollection(value) {
  const fields = ['title', 'slug', 'description', 'visibility', 'theme', 'coverUrl'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw new CollectionError(400, 'Invalid collection.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 120) throw new CollectionError(400, 'Title must be 1–120 characters.');
  if (typeof value.slug !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(value.slug)) throw new CollectionError(400, 'Use a URL slug with lowercase letters, numbers, and hyphens.');
  if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length > 1200)) throw new CollectionError(400, 'Description must be 1,200 characters or fewer.');
  if (!['private', 'unlisted', 'public'].includes(value.visibility)) throw new CollectionError(400, 'Choose public, unlisted, or private visibility.');
  const themes = ['reading-room', 'linen', 'midnight'];
  if (value.theme !== undefined && !themes.includes(value.theme)) throw new CollectionError(400, 'Unsupported collection theme.');
  let cover_url = null;
  if (value.coverUrl) {
    try { const cover = new URL(value.coverUrl); if (cover.protocol !== 'https:' || cover.username || cover.password) throw new Error(); cover_url = cover.href; }
    catch { throw new CollectionError(400, 'Cover image must be an HTTPS URL.'); }
  }
  return { title: value.title.trim(), slug: value.slug, description: value.description?.trim() || '', visibility: value.visibility, theme: value.theme || 'reading-room', cover_url };
}

export function mayReadCollection(collection, accountId = null) {
  if (!collection) return false;
  if (collection.visibility === 'private') return Boolean(accountId && collection.owner_id === accountId);
  if (collection.visibility === 'unlisted' || collection.visibility === 'public') return true;
  return false;
}

export function isOwner(collection, accountId) {
  return Boolean(collection && accountId && collection.owner_id === accountId);
}

export function createCollectionsGuard({ env = process.env, fetcher = (...args) => fetch(...args) } = {}) {
  return async request => {
    const origin = request.headers.get('origin');
    const allowed = new Set([new URL(request.url).origin, ...(env.LIBRARIAN_ALLOWED_ORIGINS || '').split(',').filter(Boolean)]);
    if (origin && !allowed.has(origin)) throw new CollectionError(403, 'Origin not allowed.');
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
    if (!token) throw new CollectionError(401, 'Sign in to manage your collections.');
    const base = env.SUPABASE_URL;
    if (!base || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) throw new CollectionError(503, 'Collections are unavailable while secure account storage is configured.');
    let url;
    try { url = new URL(base); } catch { throw new CollectionError(503, 'Account service is not configured.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') throw new CollectionError(503, 'Account service is not configured.');
    let response;
    try {
      response = await fetcher(new URL('/auth/v1/user', url), {
        headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch { throw new CollectionError(503, 'Account verification unavailable.'); }
    if (!response.ok) throw new CollectionError(response.status === 401 || response.status === 403 ? 401 : 503, 'Account verification unavailable.');
    let user;
    try { user = await response.json(); } catch { throw new CollectionError(503, 'Account verification unavailable.'); }
    if (!user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous) throw new CollectionError(403, 'Verify your email before creating a collection.');
    return { user, token, supabaseUrl: url, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY };
  };
}
