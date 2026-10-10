# M10 — Free packs usefulness / handoff / licensing audit

**Captured:** 2026-10-10 09:11 UTC (public GETs). Scope: public `/packs/` and linked archives; campaign draft `packs-2026-10-06.md`; pack-related local site files only.

## Finding

The historical `/packs` 404 is no longer current: `/packs/` returns 200 and `/packs` redirects to it. The page links two usable downloads. The previous marketing draft is materially stale: it claims three assets, a recovered/downloadable Pocket Grotesk, and CC BY 4.0 for everything. The current public page correctly limits the actual downloads to LUTs and Pocket patterns and says Pocket Grotesk's originals are unrecovered, not downloadable, and OFL 1.1.

## Usefulness and handoff status

- **LUT pack:** downloadable ZIP contains 9 33³ `.cube` files, instructions, previews, contact sheet and validation notes. Every LUT had the declared 35,937 RGB rows and ZIP integrity passed. It is a practical handoff to software that accepts standard `.cube` LUTs. Its own validation note explicitly says it was not click-tested in ScenePilot; therefore format-validated/downloadable, not in-app-import-tested.
- **Pocket patterns:** downloadable ZIP contains eight pattern JSONs, a bundled JSON array, preview, and a no-storage-write browser merger. The merger requires user-supplied exported saved-pattern-array JSON, combines records and downloads a new combined JSON. Page/docs warn this does not import automatically or write browser storage; the supplied same-origin safe importer is integration code, not evidence that deployed Pocket has this UI. Treat as downloadable/useful as a manual handoff, not end-to-end in-app-import-tested.
- **Pocket Grotesk:** no font file or download link exists. Public page says original font files have not been recovered and OFL 1.1 applies. Do not market it as a current downloadable pack asset.

## Inventory and license evidence

Local site inventory under `downloads/packs/` is absent (`ls` returned no such directory); `rg --files` found no pack archive/font source in the site checkout. The only provided marketing artifact is the draft at `/Users/agentsattari/thecreateco-marketing/content/packs-2026-10-06.md`. The two ZIPs were fetched from the live links into this report directory, SHA-256 recorded in `http-evidence.txt`; their manifests and included Pocket import page state CC BY 4.0. No standalone license files were present in either archive. Public page copy also states CC BY 4.0 for both downloadable packs and OFL 1.1 for Pocket Grotesk. The exact font source/license text is not in the inspected local pack inventory, so the OFL claim is verified as live-page copy, not independently audited from the font's upstream license file.

## Concrete repair

Keep the current live page's two-download framing and font caveat. Before reusing the 2026-10-06 marketing draft, replace “three” with “two” and remove the claim that Pocket Grotesk is included/downloadable. State: “The LUT and Pocket pattern downloads are CC BY 4.0; Pocket Grotesk is currently unavailable, and its font license is OFL 1.1.” Remove “made entirely with our own apps”/“drew a full display font” as a launch claim unless source recovery and provenance are re-established. Continue to disclose that Pocket patterns do not one-click import or alter browser storage; the page currently does this accurately. Also correct stale ZIP sizes in archive manifests (LUT claims 2,233,806 bytes vs 2,291,789 downloaded; Pocket says 8 KB vs 50,291 downloaded) if manifests are to remain part of the handoff.

## Evidence files

- `http-evidence.txt` — sanitized dated HTTP status, page excerpts, links, content lengths, hashes, inventory/check findings.
- `http-packs-slash.headers` — raw response headers for live page.
- `http-lut-pack.headers`, `http-pocket-pack.headers` — raw response headers for downloads.
- `thecreateco-lut-pack.zip`, `thecreateco-pocket-patterns.zip` — fetched archive copies used for deterministic manifest/content inspection.

## Director checkpoint — 2026-10-10 09:12 UTC

Task M10 was selected by severity/value eligible ranking (see selection.json), claimed by exact ID with company.py under company-director-2069305d. No company/lab PAUSE or active product leases were present. OS-SCHEDULER-PROOF-20261009 was already COMPLETE and was not repeated. Cost preflight returned advisory continue/normal; budgets and actual billed model cost remain unknown, not spend authorization. No new paid tools/media or spending commitments were made. Execution used Sol director plus one explicitly bounded Luna worker, with deterministic HTTP/archive checks; no Astra.

Director independently rechecked both fetched SHA-256 values, ZIP CRC integrity, all nine 33-cubed LUT row counts and the eight-pattern JSON bundle using Python; exit 0, PASS. Receipt: director-verification.json. Revenue dashboard refresh exited 0; unknown metrics remain unknown. A preliminary read-only queue-ranking diagnostic imported the wrong Engine class name and exited 1; corrected deterministic export-only ranking exited 0 and confirmed M10 first. This diagnostic did not mutate the queue.

Audit acceptance is satisfied with current route/download/license-copy evidence and explicit importer limitations. COMPLETE describes this audit, not product import qualification, a release, or proven acquisition benefit.

**Git handoff:** no task-owned code/source edits or code commit resulted; no push was needed. Only audit evidence and generated company/revenue state changed. No branch, PR, merge, deploy, release, or external message was created. Worker fetched the public page HTML into this evidence directory as an audit artifact; provenance is its dated public GET (not a separate parent edit).

**Next action:** Growth must reconcile its stale unpublished pack draft with two live CC BY downloads and unavailable OFL font before publication; retain explicit manual Pocket merger caveat. A separate scoped product owner should qualify actual LUT/Pocket import workflows and reconcile manifest byte-size labels against exact-source gates. Do not claim the font license was independently verified from missing source, three downloadable packs, user uptake, or revenue.
