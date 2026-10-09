## Scoped recovery repair

Stacked on PR93 (`codex/scenepilot-workflow-release18`); do not merge downstack or bypass required checks.

Actual moved-media recovery audit found that saving while an asset is offline silently dropped its original path, custom folder, favorite and beat map. Preserve those descriptors on offline placeholders and retain authored beat maps during media relink. Missing media remains offline, not falsely playable; legacy default bins and identity deduplication remain unchanged.

### Verification

- Independent separate OpenAI review: narrow fix approved, no blocking findings.
- Baseline roundtrip regression fails; fixed regression tests 2/2 pass.
- Node22 type/lint, production build + full1095/1095 unit tests, desktop renderer build pass.
- Actual isolated Electron development-profile audit: completed editor autosave → SIGKILL → new-process recovery, moved-media save/relink identity, real permission-denied save preservation and retry pass. Native file choices harnessed; actual OS chooser unverified.
- Actual ENOSPC on dedicated32MB disk image preserves prior document and retries; atomic-helper coverage, not full UI ENOSPC.

Not a stable-release claim. Signed/package/native chooser/platform/full golden, kill-during-write/power-loss and mandatory hosted/downstack gates remain unverified. No merge/deploy requested. Local dated report: thecreateco-company/reports/scenepilot-recovery-20261008/README.md.
