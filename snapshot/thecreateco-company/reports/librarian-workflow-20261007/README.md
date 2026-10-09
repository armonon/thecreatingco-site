# Librarian workflow and exact PDF asset recovery

Checkpoint 2026-10-08T03:37:22.377459+00:00. Source PR2 https://github.com/armonon/librarian/pull/2 at `b549a40072c1a5f01cd846fd37c68da3c1c31030`. Reviewed two-file documentation/guard regression change, pushed/open, not merged/deployed. Original wave4 checkout1ba7da4 preserved; currentmain7126236 contains substantive iOS/reading/rights changes and is **not** the current public web version.

## Auth finding corrected, not disguised as a fix
AI recommendations are deliberately hidden from navigation/render. There is no approved client account/session integration; dormant code lacks Bearer, but this is not a reachable guest PDF/search regression. No account/token bridge invented, no AI enabled, no guard relaxed, no provider called. Verified-account E2E is BLOCKED on approved session integration, secure backend configuration and authorized test access. README no longer calls this an available offline heuristic.
Deterministic guard tests now cover missing/malformed Bearer, expired/forbidden session and account-service failure, all stopping before quota. Existing verified/anonymous/unverified/quota-denied contracts retained. These synthetic contract responses are **not real authenticated E2E**. Independent OpenAI parent review approved exact two-file diff before push.

## Confirmed public core failure
`public/results.json`: owned synthetic3page PDF imports, but Read requests `/assets/pdf-BbVnaTMr.js`404 and shows Could not open this PDF. This is actual reader failure, not a body-visibility probe issue. Source/main built realChrome workflow succeeds with exact original bytes after close/newpage/reopen (`local-built/results.json`).

## Exact additive restoration prepared
Historical committed `179024b483c641ba407c83c8d6a5c579c5e1f97b` rebuilt with its lockfile in isolated librarian-live-recovery-20261007. Its active JS(index-C8ngpwrs.js), CSS(index-CpCy105w.css) and PDFworker byteSHA1 match the published manifest exactly. It also reproduces the missing431198byte reader module, SHA256 `59e06f6a8c45957395fed4f4f64a5e41e46d870b36a50400937a8cad0096f895`. Evidence exact-reader-recovery.json. The source tree is clean; no old app rewrite or alias to another bundle.
`restoration/assets/pdf-BbVnaTMr.js` is the concrete artifact. `reader-restoration-manifest.json` retains all215published paths/hashes, adds exactly1file and removes0. Netlify config retained. Actualpublic browser with ONLY that missing response served from recovered bytes paints real PDF pixels, closes/reopens and downloads byte-identical original (`public-one-file-overlay/results.json`). This response interception is an explicit artifact qualification, **not a deployed fix**.

## Specific release blocker
Published sitec7d47329-0df4-47b0-9ddd-d8332ce7af1e, deploy6ac1ecba6479a9e160b433b7. Two live functions: librarian andproxy. Exact deployed function ZIPs are absent from inspected Librarian trees. Existing company Sattari investigation already demonstrated that metadata d/id/oid references are not a documented reusable ZIP mapping; no duplicate draft/probe/retry was attempted here. Need exact matching deployed ZIP archives or documented immutable function reuse (or separately reviewed function-source/config reconstruction) before creating/promoting a preserving deployment. Older REVIEWONLY drafts explicitly omit functions and **must not be published**. All public files/functions/data/config unchanged. Netlify credentials used privately for read-only metadata; no secret values recorded in this report.

## Tests and limits
- Baseline42/42 and candidate44/44 unit tests; Node22.23.2.
- Web and iOS-mode builds pass, filehash manifests retained.
- Real Chrome154/macOSarm64: local PDF import/read/close/reopen/download exactbytes.
-6/6 existing WebKit reading cases at emulated small-iPhone/iPad: PDFs,progress/bookmarks,organization,denied/corrupt inputs/licensefixtures. Not physical iOS or native certification. Their offline step blocks externalHTTPS while bundledassets remain reachable; no true cold-offline claim.
- Production dependency audit0. Full audit retains1critical4high11moderate findings in development/build dependency tree, includingtar/sharp/packaging dependencies. No runtime exploit claim and no clean full-security claim; separate triage queued.
- No dedicated lint/typecheck scripts declared. No new model/provider, paid request, account, credentials or security settings changed.

## Next actions
1. Recover exact deployed function artifacts/reuse contract, then independently review216-file preserving deployment; verify unchanged baseline/rollback and required gates before release.
2. Keep guest PDF/search independent; approved session integration and verified test access needed only for intentionally hidden recommendations.
3. Triage dev/build dependency audit in isolated branch; do not force downgrade packages or label findingsfixed without tests.
4. Qualify fullcatalog/platform/native/cold-offline/security requirements before product completion. Current product is NOTCOMPLETE; results.json and canonical registry preserve exact remaining gaps.

## Later dependency milestone
PR3 ca7e806 completes reviewed critical/high build-tool repair. Current full audit0critical0high13moderate, production0; earlier16finding report above is retained historicalbaseline. See tooling/README.md andtooling/results.json for exact newer source and44unit/6browser/asset/template checks. PublicPDF/functionpreservation andauthaccess blockers unchanged.
