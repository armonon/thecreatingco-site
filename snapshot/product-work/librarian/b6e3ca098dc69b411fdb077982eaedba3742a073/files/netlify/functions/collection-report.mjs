import { CollectionError, readJson } from '../lib/collections-guard.mjs';

export const config = { rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
const headers = { 'content-type':'application/json', 'cache-control':'no-store', 'x-content-type-options':'nosniff' };
export default async function handler(request) {
  if (request.method !== 'POST') return Response.json({error:'POST required.'},{status:405,headers:{...headers,allow:'POST'}});
  try {
    const body = await readJson(request);
    if (typeof body.slug !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(body.slug)) throw new CollectionError(400,'Collection slug is invalid.');
    if (!['copyright','abuse','misleading','privacy','other'].includes(body.reason)) throw new CollectionError(400,'Choose a report reason.');
    if (body.details !== undefined && (typeof body.details !== 'string' || body.details.length > 1200)) throw new CollectionError(400,'Report details must be 1,200 characters or fewer.');
    const base = new URL(process.env.SUPABASE_URL);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (base.protocol !== 'https:' || !key) throw new CollectionError(503,'Reporting is unavailable.');
    const common = { apikey:key, authorization:`Bearer ${key}` };
    const lookup = await fetch(new URL(`/rest/v1/collections?slug=eq.${encodeURIComponent(body.slug)}&visibility=in.(public,unlisted)&select=id&limit=1`,base),{headers:common,signal:AbortSignal.timeout(8000)});
    if (!lookup.ok) throw new CollectionError(503,'Reporting is unavailable.');
    const collection=(await lookup.json())[0];
    if (!collection) throw new CollectionError(404,'Collection not found.');
    const saved=await fetch(new URL('/rest/v1/collection_reports',base),{method:'POST',headers:{...common,'content-type':'application/json',prefer:'return=minimal'},body:JSON.stringify({collection_id:collection.id,reason:body.reason,details:body.details?.trim()||''}),signal:AbortSignal.timeout(8000)});
    if (!saved.ok) throw new CollectionError(503,'Could not save this report.');
    return Response.json({received:true},{status:201,headers});
  } catch (error) { return Response.json({error:error instanceof CollectionError?error.message:'Reporting is unavailable.'},{status:error instanceof CollectionError?error.status:503,headers}); }
}
