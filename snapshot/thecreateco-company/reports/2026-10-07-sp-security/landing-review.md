# Independent ScenePilot landing review — 2026-10-07

Reviewer: separate native OpenAI/Codex agent `/root/scenepilot_land`, not the patch author. Inherited model selection; runtime session_status handler unavailable, so exact runtime model is not independently confirmed. No Claude model was requested.

Reviewed head `4f92d2d8c6947b49cb830c61932e382c05ddf2c5`, parent `fb42d12b98c895b47642eaab4a9be74de0c2c358`. Clean tree. Fresh origin/wave4/scenepilot-suite and GitHub PR #89 still match parent.

## Findings

No blocking finding in the dependency patch. Manifest pins next + eslint-config-next together to 16.3.8; sharp override 0.35.5 and source-map-js 1.2.2. Parsed full lockfile diff confirms 40 package-version changes confined to those families, Next platform binaries and libvips artifacts; no unrelated worker-types change, top-level lock format change or credentials. Git diff --check passes.

Read prior exact-head test logs: 1091 tests passed, zero failures; types/lint passed; production-classified audit zero. Prior report records clean install ignoring lifecycle scripts, static/desktop renderer builds and sharp/source-map smoke. Unchanged patch does not require repeating these solely for review. Full repository verify gate is running separately because its native/QA coverage exceeds prior evidence.

## Integration limits

Target narrow PR at wave4/scenepilot-suite, not main: main diverges 2 vs 44 commits from this head and open PR #89 is unreviewed with failed Netlify checks. Do not implicitly merge #89 or other downstack work through async API. No runtime/site deployment. Full audit still 30 findings (18 high / 12 moderate), including shipped Electron risks; no golden-workflow/native clean-install/notarization qualification.

## Additional pre-push gate repair

Full verify first failed on OpenVINO missing native runtime (prior lifecycle-disabled install). Bounded npm rebuild openvino-node succeeded; qa:neural-inpaint-model now passes with the real unchanged GMCNN model hash and 96x64 synthetic masked-image fixture. No native runtime source/package edits.

Separate qa:accessibility on the unchanged security head reproduced 4 serious/critical categories in New Project, Edit and Delivery. CORE-SP-A11Y-001 was queued with no active owner; claimed under same product owner. Independently reviewed the earlier auditor's two-file patch and applied it unchanged only in this owned worktree. Moves Preview Quality disclosure out of the ARIA tablist without changing button IDs, key handling, state or actions. Adds parent row layout and raises three text colors to pass contrast. No media/persistence/render/export logic changed. Full combined-candidate verification is running.

## Final result

Applied accessibility patch unchanged; full npm run verify passed on the exact tree committed as `e9c62eba1fd17de7ce5c3b1ac4710a14f72088f4` over security commit `4f92d2d8c6947b49cb830c61932e382c05ddf2c5`. This includes types, lint, all 1091 tests, project intelligence, worker/PCM/native pixel/neural model/roto memory/performance/accessibility gates. New Project/Edit/Delivery report zero violations. Native runtime installation and complete verify resolved locally without disabling any checks.

Branch pushed normally (no force/no-verify/no hook override); existing core.hooksPath was unset, so the documented npm run verify gate was executed explicitly before pushing. PR https://github.com/armonon/scenepilot-studio-badass/pull/90 is OPEN against wave4/scenepilot-suite, exact head verified after publication. GitHub reports clean mergeability with no checks on #90 at observation, not successful CI. CI workflow is dispatch-only with existing billing note. Downstack #89 is still unreviewed and has failed Netlify checks. No async merge submitted because it could land unqualified open downstack. No main update, production deployment, branch-rule bypass or external review comment.

Full-tree audit residual 30 findings remains unchanged; CORE-SP-SEC-002 retains runtime follow-up. The valid final gate does not qualify complete golden workflows or packaged/notarized release.
