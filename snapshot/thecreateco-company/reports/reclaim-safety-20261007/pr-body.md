## Scope

Scoped native file-safety repair; not a native release certification or deployment.

- Replace sampled-edge duplicate matches with full streamed SHA256 plus bounded Mac extended-attribute/resource-fork comparison; reject unstable/link/hardlink files and deduplicate overlapping roots.
- Keep at least one reviewed copy in the UI, block stale cleanup while scanning, and report actual moved/skipped outcomes.
- Preserve Mac resource forks/extended attributes in cross-volume quarantine copies; fail closed on observed source mutation/replacement before publication and before source removal.
- Reconcile stale README and document exact safety/platform limits.

## Evidence

- Baseline regressions reproduced false duplicate matches and lost extended attributes.
- 58 native tests passed; three ignored entries explicitly separated: live user-folder smoke not run, subprocess helper used by recovery test, owned-volume qualification separately run and passed.
- Actual subprocess SIGKILL interrupts a5,000-file quarantine; new process restores every file byte-for-byte.
- Actual owned32MiB HFS+ volume:8MiB cross-volume/resource-fork roundtrip; real ENOSPC preserves source after partial-copy failure.
- 77 TypeScript tests, typecheck and production build pass.
- Browser read-only fixture comparison/export passes Chromium151, Firefox153 and WebKit26.5; this is not native UI verification.
- Independent OpenAI reviewer addressed initial findings and approved the final scoped source/doc candidate.

## Still unverified

Final check-to-unlink race against hostile concurrent writers is not atomically eliminated. Native GUI, exact signed/notarized artifact, clean machine, physical Intel/macOS13, comprehensive platform/performance/accessibility and full release qualification remain outstanding. Browser file review does not support quarantine/deletion. No merge/deploy or CI gate bypass requested.
