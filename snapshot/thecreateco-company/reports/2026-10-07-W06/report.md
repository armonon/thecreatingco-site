# W06 — Product/release claims reconciliation

Run: 2026-10-07, 23:44–23:47 UTC (16:44–16:47 America/Los_Angeles).
Owner: `director-20261007T2344-W06`. One bounded company PRODUCT evidence/audit batch.

## Selection and routing

No PAUSE file at startup. Read company AGENTS.md, DIRECTIVE.md, engine/README.md,
COMPANY_STATE.md and data/model-routing.json. Recover returned no expired leases.
W06 was the highest-priority eligible task (162, explicitly an estimate), with no
dependencies or active competing lease. Claimed for 35 minutes; exact returned
token retained for finish, never copied into this report. Cycle finished well
inside its lease; no heartbeat needed.

Director actual model: `openai/gpt-6.1-sol`, verified by runtime session_status;
no director fallback. One bounded independent native child requested
`gpt-6-luna` for read-only line-specific claims review; actual child model and
fallback are **unverified** (child had no session_status tool and generic GPT-6
self-identification is not reliable routing proof). Do not count this as a
verified Luna execution. Child completed; no continuing workers. No Sonnet/Opus
was needed: no creative redesign or consequential release decision occurred.

## Commands and baseline

From `/Users/agentsattari/thecreateco-company` unless noted:

- `python3 engine/company.py recover` — recovered `[]`.
- `python3 engine/company.py refresh` — refreshed before selection and after
  claims/product changes.
- `python3 engine/company.py claim --owner director-20261007T2344-W06 --minutes 35`
  — W06 acquired with a generated lease token.
- `python3 engine/test_company.py` — **19 passed**.
- Inspected marketing PRODUCTS.md, marketing DIRECTIVE.md, relevant site
  maintenance/AGENTS.md, release JSON/checksum, downloads/product/privacy source,
  Reclaim/company-site registry entries, and relevant dated Wave 4 receipts.
- `python3 -m unittest discover -s engine/tests` from marketing — **configuration
  failure**, ModuleNotFoundError `mktg` because engine was not on PYTHONPATH.
- `PYTHONPATH=engine python3 -m unittest discover -s engine/tests` from marketing
  — **20 passed**. No code changes were made to resolve the invocation.
- `python3 reports/2026-10-07-W06/verify_release.py` — six public page/manifest/
  checksum fetches and one streamed DMG fetch; all HTTP 200. Raw page evidence and
  dated JSON observations retained in this directory. No installer executed.
- `python3 reports/2026-10-07-W06/reconcile_claims.py` — six exact, guarded internal
  claims replacements; before/after copies and unified diff retained. Assertion
  verifies Wave 2 capability text and Wave 2 NEVER CLAIM text unchanged.
- `python3 engine/company.py update-products --file reports/2026-10-07-W06/product-patch.json`
  — updated only Reclaim via supported CLI; no manual database/export edits.
- Inline stdlib assertion audit of all seven status codes, live checksum versus
  manifest versus DMG, analytics disclosure, written claims, and preserved
  read-only browser caveat — **passed**.

## Observations and changes

Live observations: 2026-10-07T23:45:02–23:45:05 UTC, detailed by URL/time/digest
in `live-observations.json`.

Reclaim 0.1.1 public DMG: **13,679,161 bytes**; SHA-256
`163ca0b9d302a3895eafd15ea14ffe673451d0a3c7d1b93b5978bd6e2a9f9e5a`.
Downloaded bytes match both the live manifest and published checksum. Live
product/download pages advertise free Mac alpha, Apple Silicon + Intel, macOS
13+, quarantine/restore, and outstanding clean-machine/physical-Intel/oldest-OS
qualification. Manifest reports Accepted application/DMG notarization; this is
publisher evidence, not an independent notarization rerun.

Live privacy page discloses Netlify Web Analytics processed server-side for
website traffic, explicitly not verified accounts or active product users.
No analytics dashboard values were retrieved; all company funnel/retention/
revenue/usage metrics remain unknown. No inferred zeroes or quality scores.

Updated `/Users/agentsattari/thecreateco-marketing/PRODUCTS.md` internally to
remove blanket no-Mac-download and no-analytics claims, record the narrow
Reclaim exception and qualification gaps, and preserve other-product/platform
restrictions. Saved `PRODUCTS.before.md`, `PRODUCTS.after.md`, `PRODUCTS.patch`.
Before SHA-256: `1fb07ffa7d3b32264ce81001aec88c44156955f1f4592b5c10ddba596e909b1d`.
After SHA-256: `3e8f46e22e7580f29fd951bded07e2aa69559904c1074ff25794178b1081d523`.
The updater refused a concurrently changed input. No substantive product code
changed, so no isolated engineering branch was needed; the shared checkout's
other edits were untouched. Narrow internal documentation is reversible from
saved before/diff evidence. No public site content was changed or deployed.

Reclaim registry now distinguishes live HTTP/download-digest verification from
untested installation and app functionality. Maturity remains ALPHA; no quality
or usage score added. Other products and music/Sattari/StemDeck holds unchanged.

## Limits / next action

This verifies availability and release-byte consistency, not installation,
architecture compatibility, runtime quarantine/restore safety, clean-machine
behavior, physical Intel, macOS 13, or notarization/Gatekeeper execution. Browser
HTTP success is not a browser workflow test. Broader catalog/launch registry,
remaining stale product claims and analytics-access tasks are outside W06.
No deployment, rollback, posting, outreach, spend, account change or messages.

Next action: independently qualify Reclaim install/quarantine/restore on the
outstanding platforms before stronger readiness claims; separately retrieve
source/period/observation-stamped analytics under W02. Treat other releases only
according to their existing evidence/review gates. W06's bounded factual
reconciliation is complete; no entire-portfolio completion claim is made.
