# Sattari shared-site provenance / integrated release preparation

Task O02, worker sattari-provenance-20261007. Scope here is Sattari only; O02 ScenePilot provenance remainder is not completed by this report. No production publication or merge. Existing token used privately for read-only metadata and one unpublished draft creation; no credentials changed.

## Verified baseline
- Live site sattari `53a43ab7-fd89-4b5b-902e-6bc0e36c58b2`, aliases sattarimusic.com and stemdeck.thecreatingco.com. Published overlay `6ac5bec218287de1ebe8e1c3`, no source commit metadata; published2026-10-07T03:47:44Z. Current and candidate sources are not inferred from deploy branch names.
- Case-sensitive paths must be normalized as Netlify normalizes uploaded filenames. Raw comparison falsely reported122 baseline new files; corrected comparison proves542/547 retained exact security-base1569ef3 built files identical to current live SHA1. Three known live-edited files: downloads.html, robots.txt, sitemap.xml. Two local-only Vite build metadata files are not public deploy content.
-347 live-only files remain outside that build, including plugin micro-site, extra SEO/media, previous hashed chunks, config and edge bundles. Preserve all. Old PR24 only captured39 micro-site files; it is not a complete reconciliation of current live content.
-24 server functions,3 schedules, one edge runtime; configuration includes v2 routes and2 rate-limit rules. source repo netlify.toml is not treated as a sufficient substitute for the uploaded resolved live config.

## Source integration
- PR28 securitybase1569ef3 retains earlier independently verified Node22/24 gate.
- PR29f6f061c, PR304bd196d, PR31dab0dda independently reviewed before integration. Conflict-free cherry-picks in isolated clean worktree `/Users/agentsattari/code/company-worktrees/sattari-integrated-20261007`, branch `release18/sattari-integrated-20261007`, exact head `e547d7d4eef74d533795cea493a426b091b92d2a`.
- Integrated PR32 https://github.com/armonon/sattari-custom-site/pull/32 OPEN. No merge, normal source review retained; final release artifact review remains.
- Existing dirty wave4 source (untracked verify-packs.mjs) untouched. No excluded module source, public assets, server functions, netlifyconfig or package files changed relative to1569ef3.
- Established PR27 policy supports additive-overlay releases while PR24/SEO reconciliation remains. Do not manufacture a main-stack merge requirement or bypass its old failed checks. Whole-site replacement remains unsafe.

## Deterministic additive preparation
`prepare_overlay.py` emits payload, stagedbytes, exactallowlist and hashes.
-89 changed publicpaths:88 HTML pages plus studio-sw.js. HTML except reviewed Pocket/KeyBPM targetpages is byte-equal after asset-reference replacement and validated modulepreload hints only. Downloads retains actual live copy/SEO with assetrefs updated.
-77 added hashedassets;0 removed. All347 live-only paths retain exactmanifestsha, including live netlify.toml/edge; robots/sitemap identical. Alloldhashedassets retained.
-24 original functiondigests/routes/memory/priority/buildmetadata/rate rules and3 schedules explicitly retained.
-Existing release-manifest/performance-support files are retained historical receipts, not evidence certifying the new overlay. Bare dist qualification does not certify the full overlay.

## Draft fails closed — no publication
- Unpublished draft `6ac7049ae9bbb1aa64beaae5` created from complete additive manifest. Netlify accepts static/edge digestreuse but requests **all24 submitted function d-digests**. This proves that particular deploymentdigest map is not reusable, not that every possible provider originaldigest/reuse API has been exhausted. Guard stopped before any file/function uploads. State prepared, not ready/published.
- Retained `.netlify/functions` ZIPs found in originalsource, but0/24 match live d/id/oid SHA256 fields; metadata is an older Node22 build, live uses Node24. These cannot be substituted under exact-preservation claim.
- Read-only GET attempts on known deploy/site function resource paths return404; installed OpenAPI exposes no function-bundle download. No secret readback, account changes, function rebuild, or production invocation was attempted.
- Need resolve original ZIP versus deployed-function digest semantics (id/oid cache reuse has NOT been tested), recover exact deployed ZIPs or a documented deploy-clone/reuse mechanism; otherwise prepare an explicit independently reviewed serverfunction source/build reconciliation before any newfunction deployment. Do not pretend differing bundles preserve behavior.

## Tests / CI checkpoint
- Clean npmci PASS. Full frozen-source local release gate PASS onNode22.248files/2273tests passed; lint/types/build/serviceworker/SEO/browser/audio and mandatory120secondsoak passed. softwarePassed=true,unchanged=true,audioChecked=true,builtArtifactUiChecked=true,releaseApproved=false. Receipt local-gate/report.json; artifactSHA256 e8de491d9e7b183039175866eb34e1c850ea59d8ed248f93f8a7d6d654be9eaa,549files,229493727bytes.
- Remote single dispatch https://github.com/armonon/sattari-custom-site/actions/runs/37719598238 on exacthead e547d7d is actually executing Node22/24, not billingblocked. No repeatedretry. Results pending.
- Product-specific integrated browser checks next after soak to avoid influencing real-time performance. Fullproduct/nativephysical/platform qualification remains separate.

## Local CI feasibility / outage policy
- Existing `npm run test:studio-release` already freezes exactsource, runs real unit/types/build/SEO/browser/audio/soak checks, and saves complete evidence plus artifactidentity. Reuse it; no duplicate harness is necessary.
- Installed explicit `/opt/homebrew/opt/node@22/bin/node` is22.23.2. Defaultnode is26.9.0. `/opt/homebrew/opt/node@24/bin/node` doesnotexist; known npx cachednode `/Users/agentsattari/.npm/_npx/31e18084b4a02655/node_modules/node/bin/node` is20.20.2, NOT24. Bounded search of ~/.nvm,~/.local,~/.volta,/private/tmp and ~/.npm/_npx didnotfind24. Earlier retained StemDeck Node24 reports are remote GitHubmatrix artifacts, not proof of a local Node24 installation. No substituteversion, toolchaininstall or runnerregistration performed.
- GitHub self-hosted runner needs an existing registered runner or authorized registrationtoken and workflowrouting; those are not established by a local testpass. Billing-related queue eligibility cannot be assumed fixed by selfhosting. Independent localCI does not manufacture a GitHub requiredcheck.
- Current ownerpolicy: localcheck/build/security/integration continue; leavePRsopen; do notmerge/publish with unresolvedmandatorychecks. Preserve exactSHAreceipts and historicalfailures.

## Queue hygiene
EngineAPI refreshed current Luma/Form securityresults to reference repaired PR6/PR4 test/lint gates; remoteCI and true fullworkflow/platform/source blockers remain. Duplicate PROGRAM18-POCKET-PERSIST-001 closed as superseded by actuallycompleted SAVE001, not a fake open dependency. Historicalresults retained by engineaudittrail.

## Integrated product browser milestone
- Pocket5/5checks PASS and KeyBPM6/6checks PASS on installed Playwright Chromium151 at e547d7d; real builtartifact UI, storage/downloads and generated fixtures. Receipts pocket-browser/report.json and keybpm-browser/chromium-report.json. No physical/native/accuracy corpus claim.
- StemDeck actual SIGKILL/restart + Chromiumquota denial: PASS2checks on installed systemChrome154.0.8037.98 at e547d7d, clean source; capturequota error surfaced and recovered audio persisted. Receipt stemdeck-process-recovery-system-chrome.json.
- Retained two failures with default Chrome-for-Testing151 manualCDP harness: page.goto timedout30seconds before any checks. Ordinary Playwright151 navigation to samepage passed in0.6sec with real window.qa and no pageerrors; separate manualCDP diagnostic became unresponsive and was terminated. This is an unresolved harness/browser-launch interaction, not a passed151 process-restart requirement. No assertion/timeout was weakened. Successful154 result is scopedto154.

## Final remote CI milestone
Single dispatch37719598238 completed SUCCESS on exact e547d7d: Node22 andNode24 release gates pass, deploySKIPPED. No retry/billing workaround. Immutable QA artifacts downloaded under remote-node22 andremote-node24. Source PR32 remainsopen; publication stillblocked by unresolved functionartifact preservation and independentfinaloverlayreview.
Overlaycontroller fault-injection5/5 passed: wrongSHA, missinglivepath, baselinehashdrift, unreviewednewroute and missingfunction each reject. These are controllerchecks, not productbehavior tests.

## Bounded original-reference investigation
Parent authorized a reversible metadata/cache-reference trial on the SAME unpublisheddraft only. Installed OpenAPI documents functionname→ZIP SHA map but not returned d/id/oid fieldsemantics; public netlify/cli functionlist treats available_functions as namesonly, and deployhasher proves submittedfunctionhash is raw ZIP SHA256. Current livefunction d/id/oid mapping remains undocumented.
PUT sameprepared draft using its exactlive oid-map returned HTTP500. Follow-up readonly GET proves draftstillprepared/unpublished,0availablefunctions,24requiredfunctions still equaloriginald-map, productionIDunchanged6ac5bec2. No file/functionuploaded, no newidtrial/newdraft/blindrebuild/promotion. Receipt function-reference-trial-outcome.json. Need documentedprovider reuse/sourceartifact recovery or explicitlyreviewed functionbuild provenance before continuation; noexistingcredential orbillingsettingchanged.
All owned localpreview/diagnostic processes stopped. Parent must separately complete O02ScenePilot provenance remainder; this report doesnotclaim full O02scopeoranyproductcomplete.
