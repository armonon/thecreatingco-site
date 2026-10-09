## Scoped security repair

Pin only xcode -> uuid 11.1.1, preserving existing overrides. Independently reviewed by OpenAI GPT-6.1 Sol following bounded worker execution (Luna requested; worker route receipt not exposed).

## Exact candidate evidence

Candidate dce2f0f7e7e6a235967ccc19e55db3fcf8af1056, based on ca7e806 (merged PR3). Fresh lock installation, 44 tests, production build, actual Xcode 100-ID generation/project write-reparse and v5 short-buffer regression pass. Copied-input Capacitor assets and direct iOS sync pass; wrapper fixture failures retained, not claimed as passing. Full audit: 8 moderate, 0 high/critical; production audit: 0. sprintf-js logger residual remains.

## Gates

Draft only. Main 413e3e9 has newer unrelated source/iOS changes; its package manifest/lock equal the candidate parent, but updated-main integration and hosted required checks still need qualification. No merge/deploy/release authorized by this receipt. No native build, physical-device or full product readiness claim.
