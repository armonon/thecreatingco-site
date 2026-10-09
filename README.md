# thecreateco operations snapshot

This is the **company/operations** branch of the private
`armonon/thecreatingco-site` Git repository. It is an orphan branch, separate
from the website's `main` and review branches. Do not merge it into a site
release or use it as Netlify deploy input: these are internal operating records,
not public pages.

`snapshot/` contains a screened copy of canonical company state, policy, queue,
registry, selected company/marketing source and text-only evidence. Its
`MANIFEST.json` records every copied file's SHA-256 and explicitly skipped
candidates. It also indexes current company product Git checkout heads; product
source remains in its owning repository, without duplicated history here.

The snapshot **does not** include customer/contact lists, private feedback,
credentials, runtime databases, browser profiles, binary QA artifacts, or the
whole workstation. It is not a substitute for encrypted host backups. A file
with an email address or secret-like string is skipped wholesale, including
some test fixtures, rather than being silently altered.

To refresh: run `python3 sync_snapshot.py` in this worktree, review the
manifest and staged diff, commit only this branch, then run
`python3 /Users/agentsattari/git-handoff/push_branch.py . --expect-sha SHA`.
No automatic merge or deploy follows.
