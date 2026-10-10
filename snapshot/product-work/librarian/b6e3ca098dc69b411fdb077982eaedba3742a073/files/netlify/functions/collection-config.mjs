export default async function handler(request) {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (request.method !== 'GET') return Response.json({ error: 'GET required.' }, { status: 405, headers: { ...headers, allow: 'GET' } });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || !key) throw new Error('not configured');
    return Response.json({ supabaseUrl: parsed.origin, publishableKey: key }, { headers });
  } catch {
    return Response.json({ error: 'Secure accounts are not configured for Librarian Collections.' }, { status: 503, headers });
  }
}
