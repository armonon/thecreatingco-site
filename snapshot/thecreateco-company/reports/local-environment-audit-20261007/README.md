# Local development environment audit — 2026-10-07

Observed2026-10-08T02:52Z. Full command argv, timestamps, output and exit status are adjacent JSON artifacts. This is environment discovery, not product or hosted-CI success.

- macOS arm64; Git2.54/GitHubCLI2.92 available.
- DefaultNode26.9.0; explicit `/opt/homebrew/opt/node@22/bin/node`22.23.2 available and already used for ScenePilot local gates. HomebrewNode24 path absent; investigate retained explicit binary used by earlier local gates rather than claiming absent everywhere.
- Swift6.3.1 and FFmpeg8.1.1 available. xcodebuild fails because only CommandLineTools selected; full native packaging/Xcode qualification not available through current path. No global toolchain switch performed.
- Rust/cargo notdefaultPATH; Reclaim worker uses isolated1.99 toolchain. This is not evidence Rust unavailable globally.
- HomebrewPython3.14 XML import fails on libexpat symbol; task-local3.12 venv also hit that host library mismatch. Do not label Python-XML-dependent checks passed. Node/Sharp generated the actual ScenePilot5-file fixture successfully without changing systemPython.
-21GiB free at observation; avoid redundant full SDK/model downloads and duplicating build trees. No user files removed.
- Memory search reported stale index/expiredembeddingtoken; no credentials changed. Current repository/queue/tool results are authoritative here.

## Reporting and release policy

CI_OUTAGE_POLICY.md adopted in company AGENTS/DIRECTIVE/AUTONOMY and named18 directive. Existing enabled progress reporter `99398759-74b2-4cb3-a096-beb54e44ceb4` runs `20,50 8-22 * * *` America/Los_Angeles; latest receipt says delivered. Existing director/lab/reporter read canonical directives; no duplicate schedule or controller created. Future scheduled execution of this new amendment is not yet claimed. Explicit localCI/self-hosted feasibility delegated to existing worker, preserving active leases and source work.

Luma/Form exact-head hostedCI attempt2 again ran0steps with account billing/spending annotations. This predates latest no-retry-loop policy. No morebilling retries without changedaccess evidence; see reports/actions-retry-20261007. Localchecks remain distinct from mandatoryhostedstatus. No merge/deploy withunresolvedmandatorychecks.

## Current unblocked execution

ScenePilot runtime and tooling repairs reviewed/pushedPR91/92 abovePR90; localverify1091tests+QA passed, realdesktopboundarypassed; fullnativegolden workflow nowowned. Form Project exportcontrolfix inprogress abovePR4/PR3. StemDeck/Pocket/KeyBPM integratedcandidate undergoinglocalandactualnonbillingCIgates; unpublisheddraftmissingexactserverfunctionbundles isfailclosed. Reclaim data-losscheckpointcontinuingbeforeworkerreturnsStemDeck. Named18scope andexcludedproducts remain intact.
