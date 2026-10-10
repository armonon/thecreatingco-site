# Creating Co — central company work

Canonical destination: **[armonon/thecreatingco-site · company/operations](https://github.com/armonon/thecreatingco-site/tree/company/operations)**.
Armon designated this branch for all Creating Co work on 2026-10-09.

This private orphan branch is internal company storage. It is **not** website
`main`, a Netlify input, a product release, or permission to merge/deploy.

## What lands here

- `snapshot/thecreateco-company/`: current state, unified queue/registry, policies,
  budgets/routing, tested engine source, plans, safe automation definitions and
  screened text evidence, including Core Product Lab and release-program records.
- `snapshot/thecreateco-marketing/`: safe strategy, drafts/research, model-routing
  and tested engine source. Private CRM, contacts and message histories stay local.
- `snapshot/operations-supervisor/` and `snapshot/git-handoff/`: tested monitoring
  and Git-handoff source/configuration.
- `snapshot/product-work/<repo>/<commit>/`: exact **committed** company review
  changes, source files, screened `changes.patch`, base SHA, branch provenance and
  explicit exclusions. `INDEX.json` indexes all discovered company worktrees.
  Product origins/review branches stay intact with their existing CI/PR gates.
- `snapshot/MANIFEST.json`: copied-file hashes, product-commit records, and every
  screened/skipped candidate. A skipped file is never silently described as pushed.

Never included: credentials, customer/contact records, private feedback, runtime
SQLite databases, browser profiles, untracked/dirty product contents, binary QA
artifacts or unrelated workstation files. Large/binary product assets remain in
original Git commits and are explicitly referenced/excluded, not copied blindly.
Synthetic reserved-domain email fixtures are allowed; non-fixture emails and
secret-like content are rejected from both files and patch deletions.

## Automatic handoff

After a verified product checkpoint, workers commit only their owned files and run:

```sh
python3 /Users/agentsattari/git-handoff/push_branch.py REPO_PATH --expect-sha TESTED_HEAD_SHA
```

The helper verifies the source branch push, then immediately publishes company
source changes here. It never pushes `main`, forces, merges or deploys. A mirror
failure preserves the source push receipt and reports the central handoff blocked.
The operations push has an explicit recursion guard.

For company/marketing/supervisor code without a project origin:

```sh
python3 /Users/agentsattari/git-handoff/checkpoint_company.py \
  --evidence /path/to/passing-verification \
  --file /path/to/task-owned-tested-file
```

Repeat `--file` as needed. This records the exact verified bytes, not a personal
approval. Code changed since its last checkpoint is visibly skipped until its
worker records the new passing checkpoint. State and safe text evidence refresh
without this code checkpoint requirement.

The existing hourly LaunchAgent runs `publish_snapshot.py` as a backstop. It
requires a clean operations worktree, reconciles remote fast-forwards, builds a
screened snapshot before replacement, commits only `snapshot/`, and verifies the
exact normal push. Divergence is blocked without force and local commits retained.
Manual refresh: `python3 publish_snapshot.py`. No automatic merge/deployment follows.
