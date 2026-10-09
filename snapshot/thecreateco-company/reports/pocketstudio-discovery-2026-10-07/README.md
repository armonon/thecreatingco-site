# Pocket Studio / Sessions — source and authorization discovery

2026-10-07 Pacific. Task PROGRAM18-POCKETSTUDIO-001; **BLOCKED**, product NOT complete. Work is a read-only/source-discovery and anonymous-interface qualification checkpoint. Parent already asked one concise canonical source/deployment question; do not repeat it. No fake users, account creation, permission grant, physical capture, media upload, public post or room was created. Existing Netlify CLI credential used only for read-only site/functions metadata; no credentials changed or exposed.

## Verified current deployment

- Pocket Studio: https://thecreatingco.com/community/network?view=Pocket%20Studio
- Sessions: https://thecreatingco.com/community/network?view=Sessions
- Real hosted Vinext Community client, deploymentVersion `e9d3a984-5a81-424d-82a7-2c325fb6824f`. Actual public HTML/client assets retained, SHA256 in artifact-hashes.json. This is an artifact ID, **not a source commit**.
- Main Netlify site momentium-creative /59ccf268-f99f-43ba-89b6-1117fa561e93 current published deployment `6ac6eb6cbf814008db6578af` (published2026-10-08T01:03:04Z) reports no linked repository, branch or commit. Existing Community proxy function digest `74bd0204666b29a81c45e3c93c6d2f61b766e98657ba029eca31b52000a0f0ca` retained, nodejs24.x. Read-only API receipts: netlify-site.json/netlify-functions.json. No deployment changed.
- Main-site maintenance/AGENTS.md explicitly says the GitHub/local marketing mirror omits real Community proxy and must **never be deployed wholesale**. Scope routes/cookie/origin contracts must be preserved. No workaround replacement app created.

## Source/access discovery

Registry source/repo unknown. Searched accessible code/worktrees, marketing and historical release paths, workspace apps/src/netlify/repos and owner GitHub repositories/code. `gh search code '"Pocket Studio"' --owner armonon` returns only marketing suite/v1/apps.json; `community-proxy` and `api/community/network` return no upstream source. Owner repo listing has no obvious Community service. Historical release report paths in maintenance instructions are absent in accessible checkouts. OS denies listing `/Users/agentsattari/AgentProjects`; did not bypass that restriction. Netlify API exposes proxy metadata, not its upstream source. Installed official API schema has searchSiteFunctions GET and uploadDeployFunction PUT, no documented source-download endpoint; no guessed mutation endpoint invoked.

**Exact blocker:** canonical Community source repository/checkout and upstream deployment project for the running Pocket Studio/Sessions app have not been located. Cannot repair, test source, review server authorization or map public build to a Git commit responsibly. Need source/deployment location or access from owner. Independently, no designated authenticated test accounts/two distinct real test users are available for upload/account completion/persistence/signout/reconnect and Sessions cross-user checks. Parent has already asked the source question once; no repeated confirmation needed.

## Observed guest behavior / boundary

`guest-check.mjs` ran fresh Chromium153.0.8010.12 at1440×1000 and390×844; screenshot artifacts were visually inspected. Guest deep link hydrates actual Pocket recorder: two-minute description, microphone choice, Record control, timer00:00 and local shelf0/20. Microphone permission explicitly set **denied** by browser test context before clicking Record. UI correctly reports “Microphone access was not granted. Allow it in your browser settings, then try again.” Timer/shelf unchanged. No device recording occurred. No horizontal overflow at390px. These are passing observed subsets, not full accessibility/responsive/platform gate passes.

Sessions deep link shows actual room-name/public-unlisted form and empty open-room list. No room created, no participant simulated and no collaboration/sync claim made. Auth dialog wasn't verified by harness at phone layout; no account/login completion inferred. API POST/account calls seen in guest bootstrap are app's own session checks, not supplied user credentials/account creation. Empty guest GET network response shape recorded without private user data.

Anonymous/no-cookie `POST /api/community/network/media?upload=start` with **empty JSON, no media bytes** and correct same-site Origin returns401 `{error: Sign in to continue.}`. This is direct evidence for anonymous upload-init rejection, not all upload ownership/authentication/security paths. `GET /api/community/network/video?capabilities=1` reports directVideo false. Anonymous GET/account returns405; not treated as login failure. See anonymous-boundary.json.

Public client contains actual local IndexedDB recording shelf, waveform/trim/export/upload logic and Sessions queue API, not proof of full server/backend behavior. No minified deployed client was edited as a substitute for canonical source.

## Unverified completion gates / exact next action

Record→edit/trim→save local→close/reopen→export and authenticated publish unverified. No hardware/browser permission-granted recording or authenticated upload performed. Offline/quota/corrupt/interrupted/large-file, two-client Sessions/reconnect, authenticated account persistence/signout/access ownership, full mobile/browser/platform matrix, performance and source/deployment reproducibility remain unverified.

Owner supplies canonical source/deploy project; clone/inspect exact current source, reuse actual existing auth and media service, baseline/test/fix on scoped branch, independent OpenAI review, normal PR/check/release gates. Separately identify designated existing test accounts for real authenticated/two-user checks. Preserve guest text/interactions and server upload auth; don't fabricate identities or silently replace backend. Continue independent first-wave products while source blocked.
