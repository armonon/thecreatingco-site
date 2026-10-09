## Change
Catch IndexedDB autosave errors instead of silently losing the save. Display pending/saved/failed truthfully, keep an actionable quota warning, and offer retry plus portable backup. Ignore stale completions and preserve status for same-project advance-handle clicks.

## Verification
- Baseline quota reproduction: unhandled QuotaExceededError while header claimed autosaved.
- 34 engine tests; lint; TypeScript + production/PWA build: pass.
- Chromium quota warning, failed/successful retry, same-project click, undo/redo, portable Save/close/Open and exact IndexedDB project comparison: pass.
- Existing browser smoke, offline reload/export and SVG/TTF independent raster comparison: pass.
- npm audit --omit=dev: zero advisories at observation time.
- Independent OpenAI reviewer caught same-identity edge case; fixed and reverified.

## Scope / limitations
Only committed standalone Glyph source. Existing uncommitted Brand Kit work is untouched and absent from this candidate. No deployment or full multi-platform/font-license qualification claimed. Synthetic local Chromium tests are not product completion. No excluded apps/shared dependencies changed.
