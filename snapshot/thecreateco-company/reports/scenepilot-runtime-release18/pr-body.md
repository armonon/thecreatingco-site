## What changed
- Pin Electron43.7.9 consistently in root dependency, lockfile and desktop packaging configuration.
- Removes four reported high-severity Electron runtime advisories that production-only audits omit because Electron is a devDependency.

## Verification
- Actual desktop renderer build passed.
- Full verify:full passed: build, types/lint,1091 unit tests and configured QA checks.
- Actual macOS Electron43.7.9 window startup in an isolated profile passed; sandbox/context isolation/web security remain enabled, renderer Node access and popups denied.

## Release scope
Stacked on PR90. No merge, notarized package or deployment claimed. Other29 development/build-tool audit groups remain tracked; this is not an all-clear security claim. Full native user workflow/platform qualification remains outstanding.
