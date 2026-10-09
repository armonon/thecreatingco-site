## Summary
- Keep the TTF maker-credit string ASCII, matching the existing validated ASCII family/style-name constraint.
- Fix the Macintosh name-table record truncating an em dash to U+0014.
- Add a parsed exported-font regression covering readable, matching Mac and Windows metadata.

## Evidence
- Reproduced in an actual font downloaded from the live Glyph editor during destination-app qualification.
- New regression fails on the unchanged main source, then passes after the fix.
- Fresh npm ci; npm test: 46/46 pass; npm run lint; npm run build; git diff --check all pass.
- Independent OpenAI review: no blocking findings in the two-file patch.

## Scope
No geometry, kerning, licensing grant, pricing, export formats, user data, or free-feature changes. The existing maker-credit field is retained; this patch does not assert ownership over user-created artwork. Native Inkscape rendering evidence used the pre-fix public artifact and is not misrepresented as post-fix deployment evidence.

Evidence directory: thecreateco-company/reports/glyph-destination-20261007 (metadata-code-review.md, metadata-regression-before.log, metadata-checks.json).
