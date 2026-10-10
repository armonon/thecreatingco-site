# Cross-thread Git handoff

At a reviewable agent-owned code checkpoint, run the relevant local checks,
commit only task-owned files on a review branch, then:

```sh
python3 /Users/agentsattari/git-handoff/push_branch.py REPO_PATH --expect-sha EXACT_TESTED_HEAD_SHA
```

The helper refuses protected branches and tracked dirty work, uses a normal
non-force push, checks the live remote branch SHA, and writes a local receipt to
`receipts.jsonl`. It never stages, commits, merges or deploys. A failed handoff
must retain the local commit and report the exact blocker. A tested exact commit
in a checkout with another worker's dirty files requires a separately reviewed
exact-ref push; do not include or alter those files.

Read-only reconciliation:

```sh
python3 /Users/agentsattari/git-handoff/audit_recent.py --days 7
```

It scans bounded worktree roots under `code/`, `Sattari/` and `worktrees/`, then
compares recent non-protected branch heads to live origin refs. A head reachable
on another verified current remote branch is `contained_elsewhere`, not missing.
`unpublished` and `unknown` are exceptions; inspect them before pushing. Dirty
uncommitted files are counted but never sent. The existing 30-minute company
progress reporter runs this read-only check; it is not a second controller.

The workspace root has no Git remote. Creating Co code/state/evidence now lands
in the private `armonon/thecreatingco-site` branch `company/operations`. Product
branches retain their existing origins and normal PR/CI gates; successful company
source pushes automatically archive their screened committed review delta there.
Use `checkpoint_company.py --evidence ... --file ...` for tested company source
outside a project origin. Databases, contacts, secrets, binaries and dirty product
files are excluded and listed explicitly, not silently called pushed.
