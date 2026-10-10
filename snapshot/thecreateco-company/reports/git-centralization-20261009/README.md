# Creating Co canonical Git handoff — 2026-10-09

## Mandate

Armon selected https://github.com/armonon/thecreatingco-site/tree/company/operations as the canonical home for all Creating Co work (message 1558301715059445790).

## Implementation

- Existing internal operations branch retained, separate from website main and deployments.
- Company engines, configuration, durable exported state, policies and text evidence included. Private runtime databases, credentials, contacts and lease tokens remain local.
- Exact committed product review deltas archived by repository and SHA, including screened source files and patches. Dirty/untracked product changes are never copied; binary/large/private files have explicit exclusion records.
- Normal company review-branch pushes now invoke the central publisher automatically. Source push receipts remain accurate if central synchronization is blocked.
- Workspace-only source uses exact-byte checkpoints linked to checks, followed by central publication. The existing hourly LaunchAgent is the backstop.
- Source origin, PR/CI, product holds and release authorization remain unchanged. No main pushes, force pushes or deployments.
- Concurrent destination advancement was reconciled by rebasing only this task's unpublished script commit; no remote history was rewritten.

## Verification

97 tests passed across company (24), telemetry (16), OS cycle (7), anomaly detection (3), marketing (26), supervisor (13), Git handoff (5) and operations export (3). Evidence: checks.json and suite logs retained locally.

Exporter tests prove committed-versus-dirty isolation, sensitive-content and symlink exclusion, and exact tested-byte checkpoint gating. Handoff tests prove scope, recursion prevention, verified central receipt requirement, and preservation of successful source push evidence on mirror failure.

## Verified initial remote publication

Destination head 77101ae4752517ddea386342bac547a380022274 was independently verified with git ls-remote after publication. Initial snapshot contained 480 company files plus 7,890 changed product source files from 77 exact commits across 16 repositories. Original omission records comprised 12,584 binary/non-source assets and 30 files with contact-like content; these are deliberately explicit, not claims that whole binary repositories were mirrored.

Final source audit checkpointed 41 safe company source files. No source remained excluded for a missing/changed verification checkpoint. Git SSH syntax and published company contact information are distinguished from private recipients. Reserved-domain synthetic fixtures preserve test semantics; Gmail normalization coverage remains intact. Screened JSON evidence is now included alongside Markdown reports.

The final publication refreshes these source fixes, this report and the completed durable task. Publication receipts remain local; the central branch history is the authoritative remote evidence.

