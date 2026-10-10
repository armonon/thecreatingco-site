# Librarian Collections — implementation and rollout

This is an additive web feature. It does not replace the existing local IndexedDB
PDF library, personal shelf, or reader.

## Architecture

- `src/collections.js` owns the responsive curator, public directory, library
  viewer, upload flow, and PDF.js reader. The normal app still loads `main.js`.
- Netlify functions verify Supabase access tokens server-side. Only verified,
  non-anonymous accounts may write. Collection writes always include the verified
  owner ID in server-side database filters.
- The schema is in
  `supabase/migrations/20261009160000_librarian_collections.sql`. Direct
  `anon`/`authenticated` table access is revoked; RLS is enabled; service-role
  credentials never enter the browser. PDF bytes are in a private bucket.
- Uploads use a short-lived, path-scoped signed upload URL; a database reservation
  enforces 50 MB per PDF, 100 PDFs per account, 2 GB total bytes per account, and
  12 libraries per account. Finalization verifies the reserved byte count and
  `%PDF-` header before publishing metadata.
- Public or unlisted book access first checks collection visibility and then
  issues a five-minute signed read URL. Private collections are concealed as 404
  unless the caller has a verified owner session.
- Upload forms require an explicit rights/permission acknowledgement. PDF.js
  extracts title, author, page count, and a small first-page thumbnail. Curators
  can add tags, feature a book, change shelf order, search, and remove PDFs.
- Public links, copied iframe snippets, QR images (generated locally in the
  browser), and an abuse-report form are available. Reports are rate limited and
  store no reporter IP/email.

## Configuration

Apply the SQL migration to the Librarian Supabase project before exposing these
functions. Configure Netlify function environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never set as a client/build variable)
- optionally `LIBRARIAN_ALLOWED_ORIGINS` for additional exact trusted origins

Enable email verification in Supabase Auth. The feature uses Supabase email /
password signup and login; no real credentials or deployment configuration were
changed in this code task. The migration creates a private, PDF-only Storage
bucket and guarded RPCs. Review the exact target project before applying it.

## Local checks

```sh
npm test
npm run build
npm run test:browser -- tests/browser/collections.spec.js --project=iPhone
```

The browser tests stub account/database/storage HTTP boundaries, while exercising
the actual mobile UI, signup-to-create flow, upload validation path, QR rendering,
public access, and PDF.js canvas rendering. They do not prove a real Supabase or
Netlify deployment.

## Remaining before production

- Apply and verify the migration on the intended Supabase project, configure
  Netlify secrets, and verify real email-confirmed signup, expiry/refresh,
  owner separation, quotas, signed upload/read URLs, and abuse reports.
- Add automated expiry/cleanup for abandoned pending-upload reservations and
  orphan objects.
- Add pagination for collections exceeding current quotas and richer text search.
- SEO is currently client-rendered at the share URL; crawler-specific server
  metadata/prerendering is still needed for full SEO coverage.
- Curator profiles, uploaded collection-cover files, annotation tools, and a
  production moderation/retention workflow remain future work. Cover images in
  this increment use curator-supplied HTTPS image URLs.
- AI semantic search, summaries, and page-cited Q&A remain unimplemented; the
  private storage and metadata boundary are a base for that future service.

Do not describe Collections as production-ready until these live checks are
completed. The separate existing production reader 404 remains a tracked blocker
and is not changed by this feature branch.
