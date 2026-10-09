## Scope
Integrates the independently reviewed, non-overlapping repairs from PR #29 (StemDeck recovery), #30 (Pocket non-destructive persistence), and #31 (Key & BPM portable reports) on the exact qualified security base `1569ef3` (PR #28). Cherry-picks are conflict-free; no additional application changes. No excluded modules, server functions, deployment config, public media, or dependency updates.

## Release preparation
Current production remains additive overlay `6ac5bec218287de1ebe8e1c3`. Read-only Netlify manifest comparison proves 542 baseline built files byte-identical to production after Netlify filename case normalization. The three differing baseline files are Downloads HTML, robots.txt, and sitemap.xml; 347 live-only paths must be retained, along with all 24 functions, three schedules, deployed config and edge runtime. A whole-site replacement is NOT authorized or safe.

The reviewable release route is the previously established manifest-preserving additive overlay, not merging the unreviewed main/Wave4 stack. Existing PR #27 failed checks remain failed. This integration does not claim the full products stable or supported-platform qualification complete.

## Verification
Existing independent source reviews remain applicable to the unchanged cherry-picked source. Exact integrated validation at `e547d7d`:
- Local Node22:248files/2273tests pass; lint/types/build/service-worker/SEO, real browser/audio/UI and mandatory120secondsoak pass. Frozen source unchanged; releaseApproved=false (full product/hardware gates are separate).
- [Remote exact-head Node22 andNode24 release gates](https://github.com/armonon/sattari-custom-site/actions/runs/37719598238): BOTH SUCCESS; deploy SKIPPED. Single dispatch, no required-check bypass.
- Pocket5/5 and KeyBPM6/6 built-browser checks pass on Chromium151. Actual StemDeck process kill/restart and browser quota checks pass on installed Chrome154. Default CFT151 manual-CDP recovery harness times out before checks; retained as unverified for that launch/browser variant, not falsely passed.
- Additive plan preserves all347 live-only paths, currentconfig/edge hashes, functions/routes/rate rules/schedules;89 allowlisted changed paths and77 added assets,0removed. Five controller failure-injection checks pass.

## Current release blocker
Unpublished draft `6ac7049ae9bbb1aa64beaae5` is prepared, notready orpublished. Netlify requests all24 submitted deployed-function digest references; fail-closed guard stopped beforeuploads. Retained older localZIPs do not match live digests. A bounded original-reference metadata trial on the same draft returned500 and didnotresolve artifacts; production remains unchanged. Exact function-preservation and final artifact review remain unresolved. No arbitrary function replacement, main-stack merge, or promotion.
