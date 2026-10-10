# W09 live SEO structure audit

Read-only snapshot of the public `https://thecreatingco.com` release. This is a technical structure observation, not a claim of Google indexing, rich-result eligibility, search ranking, traffic, or release qualification.

## Reproduce

From `/Users/agentsattari`:

```sh
python3 /Users/agentsattari/thecreateco-company/automation/w09-seo-audit-20261010.py /Users/agentsattari/thecreateco-company/reports/w09-seo-20261010/evidence.json
```

The script uses Python standard-library `urllib`, `html.parser`, JSON and regex. It only issues GETs; it submits no forms and performs no site writes. It fetches `robots.txt`, `/sitemap.xml`, at most 20 same-host child sitemap files for a sitemap index, and at most the first 100 unique same-host URLs in sitemap order. Page fetch concurrency is capped at 6; timeout is 12 seconds and response bodies are capped at 2,000,000 bytes each. Evidence records timestamp, status/final URL, body SHA-256, parsing results and limits. No response bodies or query parameters are copied into the report.

## Observed snapshot

- Run time: `2026-10-10T14:13:10.098082Z`–`2026-10-10T14:13:13.092387Z` (2.994 seconds).
- `robots.txt`: HTTP 200; allows `/`, disallows `/api/` and `/_next/`, and names `https://thecreatingco.com/sitemap.xml`.
- Sitemap root and all three child maps returned HTTP 200. Child maps: `pages.xml` (19 locs), `products.xml` (27), `learn.xml` (10). Total 56 unique same-host URLs; all 56 were fetched and returned HTTP 200; none omitted by the 100-page cap. Per-file hashes and final URLs are in `evidence.json`.
- Every sampled page had exactly one canonical and a non-empty description. All canonical URLs resolved to the final page URL. No structural canonical or OG URL mismatch was found. `https://thecreatingco.com/community/rules` had no `og:url`; the other 55 pages did.
- All present sampled JSON-LD blocks parsed as JSON. Two pages (`/community/network` and `/community/rules`) had no JSON-LD block; absence is recorded, not treated as a defect. Observed types on pages with JSON-LD: `BreadcrumbList`, `ItemList`, `ListItem`, `Organization`, `SoftwareApplication`, `WebPage`, `WebSite`. No conflicting `WebPage` identity was found. External destinations on application/product entities are not classified as site-identity mismatches.
- First-wave product routes are present in sitemap and return HTTP 200 with matching self-canonicals: `/products/bounce/`, `/products/pocket-studio/`, `/products/key-bpm/`, `/products/glyph-studio/`. The sitemap establishes these public landing pages only; it makes no claim about separately hosted app availability or launch state.

## Parser note and gaps

An initial diagnostic run discovered this local Python build has no Expat (`ElementTree` raised `ImportError: No module named expat`), which produced zero parsed entries. This was a local parser limitation, not a live sitemap failure. That diagnostic is retained in `initial-parser-diagnostic.json`. The final script therefore uses bounded extraction of sitemap `<loc>` values and records a root tag; it does not claim full XML well-formedness or sitemap-schema validation. No manual-page crawl outside sitemap URLs was done. The snapshot is time-specific and can change after publication.

## Director verification and handoff

Sol director + bounded requested OpenAI Luna worker. Cost preflight: continue/advisory, unset budgets remain unknown; no new paid services. Commissioning proof already COMPLETE; P1 WebLab task fenced by product hold. Director compiled exact audit bytes and reconciled 56 page receipts, child totals, JSON-LD and four first-wave routes (PASS). Final script moved unchanged to `automation/w09-seo-audit-20261010.py` because reports only exports text evidence.

Verified-byte code checkpoint recorded. Central publication failed: `OPS_SYNC_BLOCKED: Operations worktree dirty; review it before automated sync`. Exact dirty path `?? .snapshot-1o1y1_q9/` was left untouched. Operations local HEAD `f06113fb29661b9abb18f8a8b1c1a2077b171e05`, branch `company/operations`; no new task commit or remote SHA receipt. Audit script retained locally, checkpointed but unpushed. No product code commit resulted; no product-branch push needed. No merge/deployment/CI success claimed. See `verification.json` and `handoff.json`.
