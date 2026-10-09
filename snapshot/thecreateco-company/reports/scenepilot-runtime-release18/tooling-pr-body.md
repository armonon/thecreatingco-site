## What changed
Refresh compatible tooling overrides: brace-expansion1/2/5 patched versions, fast-uri3.1.8, undici7.29.1, http-cache-semantics4.3.0. Only package manifest and lock changed; no source/gate changes.

## Verification
- Full verify:full passed again: build/types/lint,1091 unit tests and configured QA.
- Independent OpenAI review confirmed exactly8 existing dev-only lock records changed, no packages added/removed, valid dependency tree and unchanged source/scripts.
- Full audit improved29→16 groups (17→8high;12→8moderate). Production-only audit remains0; Electron runtime advisory was separately repaired in PR91.

## Remaining limitations
Not an all-clear security claim. Remaining root advisories are braces<=3.0.3 and sprintf-js<=1.1.3; registry latest versions are still affected. They are build/lint/logging dependencies, not production npm dependencies; reachability needs to remain tracked. No forced major downgrade, removed checks, package/signing or deployment. Stacked on PR91.
