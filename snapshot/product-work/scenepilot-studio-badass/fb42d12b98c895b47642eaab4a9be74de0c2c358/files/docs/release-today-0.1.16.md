# ScenePilot 0.1.16 release-today assessment

Assessment date: 2026-09-19 (America/Los_Angeles). Target: Browser Lite and macOS Apple Silicon Desktop Pro. Windows and Intel Mac are not qualified by this pass.

## RELEASE STATUS

**NOT READY for an unrestricted public production release.** The local candidate is for QA. No public deployment or release was made.

This is a release-hardening pass, not a feature expansion. Automated qualification is necessary but does not certify every control, artistic result, hardware configuration, or clean-machine installation.

## WORK COMPLETED

| Problem | Root cause | Fix | Validation |
| --- | --- | --- | --- |
| Portrait/output settings were lost after saving | Disk documents omitted output/color settings | Shared validated settings serializer; restore aspect, dimensions, frame rate, format, curves and LUT samples | Baseline defect reproduced; 9:16 Save As/reopen verified in packaged app; typed LUT round-trip regression |
| Closing a modified project lost changes without warning | No coherent document revision/close guard | Save/Discard/Cancel, visible dirty state, revision-safe async save and guarded replacement | Baseline defect reproduced; Cancel and Save-on-close verified in packaged app; late-save regression |
| Interrupted/concurrent writes could damage project data | Direct writes and overlapping saves | Serialized atomic write/rename, native save single-flight, atomic queue/recovery writes | 100 concurrent writes, failed destination, cleanup and recovery tests |
| Reopened disk-linked media could not decode | Protocol registered on default session, while editor uses persistent session | Register protocol on the editor session; retain restricted CORS access and streamed file responses | Reproduced in packaged app and isolated Electron integration test; final package retest recorded below |
| Linked video could taint canvas effects/roto | Cross-origin media loaded without anonymous CORS | Anonymous media loading in canvas pool, main/audio preview and roto capture | Real MP4 decoding, seek and readable red pixel verified in isolated Electron session |
| Export preparation failure could leave launch locked | Media preparation happened outside error cleanup | Clear launch/abort/progress state and fail queued job on preparation errors | Regression invokes failed media preparation twice and confirms retry remains possible |
| Restored queued jobs could run against another project | Queue did not consistently bind jobs to document identity | Project-bound jobs; interrupted jobs fail safely; explicit retry/rebind | Deterministic regression suite; full restart/retry UI sequence NOT VERIFIED |
| Native IPC trusted too broad a caller surface | Handlers lacked common trusted-editor/main-frame guard | Exact editor URL and main-frame validation; bounded media probing | Trust rejection and four-concurrent-probe regression |
| Malformed documents/preset names could crash state consumers | Incomplete boundary validation | Validate document structure/version and preset allowlists before applying | Malformed/future/null-entry/invalid-preset regressions; not an exhaustive schema/security audit |
| Public packaging could silently skip notarization | Preview and production signing requirements were conflated | Production workflow refuses missing Developer ID/notarization credentials and incomplete review | Signing-gate tests; actual production signing NOT VERIFIED |
| Qualification timeout could leave child processes running | Only npm parent was terminated | Bounded process-group timeout and closed output handles | Spawn-failure, normal completion and descendant timeout tests |
| Dependency audit reported vulnerable versions | Transitive dependency versions | Update pinned overrides/lockfile within supported versions | Full and production-only npm audits reported zero known vulnerabilities at assessment time |

Also extracted project-document and dirty-state helpers from the editor shell, made autosave/duplicate-export failures visible, and lazy-loaded semantic segmentation to retain the editor bundle budget.

## PERFORMANCE

Automated fixture: 10,000 base cuts + 10,000 overlays, 256 assets, eight tracks, 3840×2160 frame-plan settings. These are engine microbenchmarks, **not measured 4K playback FPS**.

The final session-fixed candidate report measured:

- Context compilation: 2.53 ms (80 ms budget).
- Prepared base-cut plan p95: 0.0179 ms; overlay plan p95: 0.0102 ms (2 ms budgets).
- Eight-track, one-second PCM mix: 76.98 ms, approximately 12.99× real time.
- Editor entry chunk stayed under the configured 500 kB budget; some lazy renderer/codec chunks still produce size advisories.

Host load varied severely during the campaign. Earlier slower values are not a controlled before/after experiment and must not be advertised as optimization gains. Cold-start timing, multi-hour memory growth, sustained real-footage 4K playback and low-memory-device performance remain **NOT VERIFIED**. Shared-render export still materializes path-backed media in memory; a safe supported project-size envelope requires real-media stress testing.

## TEST RESULTS

Evidence directories are local, ignored build outputs:

- `outputs/release-today/verified-candidate/`: 742 deterministic tests passed, 15 automated gates passed, zero automated failures; ten required perceptual gates pending. This run predates the final session-scoped media fix.
- `outputs/release-today/session-fixed-candidate/`: final rerun: **742 tests and all 16 automated gates passed**, zero automated failures, ten perceptual gates pending. Includes linked-media decoding/seek/readable pixels, TypeScript/lint, all three production builds, parity, worker audio and performance checks.
- `outputs/release-today/media/`: generated, license-safe MP4/audio fixtures. These do not substitute for difficult hair, occlusion, dialogue, movement or long footage.
- `outputs/release-today/clip-red - mp4-h264.mp4`: packaged-app export verified by ffprobe as H.264, 1080×1920, six seconds. Source was intentionally silent.
- `outputs/release-today/reopened-final.mp4`: final packaged app reopened the saved path-linked project, visibly played its red portrait preview, and completed export. ffprobe confirms H.264, 1080×1920, 6.000 seconds; decoded RGB sample at three seconds was `[230, 0, 2]`. This proves nonempty expected-color output for the fixture, not general perceptual parity.

Final local DMG: `release/ScenePilot-0.1.16-arm64.dmg`, SHA-256 `ef91f632784d3a47c768d13363e6a73c4f7a12f0717de9426484eb0d6837b370`. Deep/strict code-signature integrity verification passed for the app. This remains an **ad-hoc signed, non-notarized QA build**, not a public release.

Reports record the baseline HEAD because fixes were uncommitted when tested. Do not interpret that field as proof that the baseline commit contains these fixes. Qualification must be associated with the final change set and artifact checksum.

### Critical journeys

| Journey | Actual coverage | Remaining gate |
| --- | --- | --- |
| Install/launch | Built DMG and launched packaged arm64 app | Clean-machine/quarantined install and production signature NOT VERIFIED |
| Create project/output settings | Desktop 9:16 project created; reopened settings preserved | Other settings covered by serialization tests, not exhaustive UI combinations |
| Import media | Native picker video import; Lite song plus three clips imported | Camera codec/VFR/HDR/large-file matrix NOT VERIFIED |
| Automated assembly | Lite generated beat grid and montage from generated media | Timing/creative quality on licensed real songs/footage pending |
| Timeline/undo | Lite BPM edit/undo; editable desktop base cut | Every trim/drag/shortcut combination NOT VERIFIED |
| Save/Save As | Native file written and JSON inspected; settings and marker retained | Full-volume/read-only-destination UI retry NOT VERIFIED |
| Close/reopen | Cancel-close and save-on-close exercised; final package reopened and visibly played saved linked media | Abrupt termination and full missing-media relink UI sequence NOT VERIFIED |
| Export | Six-second portrait MP4 from imported native video and again from reopened saved project | Lite export picker completion NOT VERIFIED |
| Autosave/recovery | Lite reload/restore retained timeline and media | Abrupt process kill/disk failure recovery E2E NOT VERIFIED |
| Composition/effects | Deterministic and real-MP4 effect/nesting tests pass | Full comp UI and perceptual preview/export comparisons pending |
| Invalid/missing project media | Boundary/offline handling regressions | Comprehensive packaged UI relink/error journey NOT VERIFIED |
| Large project/background audio | Engine budget, worker-stream, PCM and long-roto-memory tests pass | Long real-project session and device-switch/audio listening pending |

## REMAINING ISSUES

- **P0 release gate:** No Developer ID Application signing identity and complete notarization setup are available. Ad-hoc integrity verification is not Apple trust/notarization.
- **P1:** Ten required real-footage/perceptual reviews remain unsigned. Instructions and scoring forms already exist in the qualification output. No review was fabricated.
- **P1:** Clean-machine installation, offline startup/resource availability, update/rollback and full recovery journeys need certification on the final signed artifact.
- **P1:** Long 4K media/import/export memory envelope and crash/disk-pressure recovery remain unqualified; do not market unbounded professional workloads.
- **P2:** Some Lite controls expose Pro-only workflows; improve disabled-state/explanatory consistency where required.
- **P2:** Main media is represented separately from the asset-bin count; the panel can show zero media while a main source is loaded. This is confusing, not proof that the source was lost.
- **P3:** Broader feature parity with Adobe is outside this release pass and is not a release-quality metric.

## MISSING FOR A PROFESSIONAL RELEASE

Required: signed/notarized distributable, exact-artifact clean-machine evidence, validated recovery/support path, truthful codec/platform/size limitations, and completed real-footage acceptance evidence. Confirm shipped notices/model licenses and downloadable version/checksums before publishing. Third-party legal approval is not inferred from a build passing.

Optional after release: additional generators, wider plugin compatibility, new AI capabilities and large UI redesigns. They should not displace reliability testing now.

## IF WE RELEASED RIGHT NOW

Existing automated coverage is strong and concrete persistence/export defects have been addressed. But customers could encounter Gatekeeper trust friction and workload-specific quality or recovery failures not covered by the fixtures. Shipping as broadly production-ready would overstate the evidence. A clearly labeled, controlled test candidate is more appropriate.

## RELEASE CHECKLIST

- [x] Production browser/worker/desktop renderer builds run.
- [x] Full deterministic tests and automated engine qualification run.
- [x] Native save/settings/dirty-close regressions exercised.
- [x] Real generated MP4 exported from packaged app.
- [x] Review instructions/forms and safe test fixtures prepared.
- [x] Public release signing/review gates fail closed.
- [x] Final saved-project preview/export requalification recorded, including output decode.
- [ ] Developer ID signing, notarization and Gatekeeper acceptance.
- [ ] Clean-machine install/update/offline/recovery matrix.
- [ ] Ten real-footage review gates completed with evidence.
- [ ] Long-project workload limits measured and documented.
- [!] Browser native export dialog automation was unavailable in the Codex-hosted picker; completion NOT VERIFIED.
- [!] No Windows/Intel Mac production qualification was performed.

## FINAL VERDICT

Freeze features and finish the release gate campaign. The highest-value work is proving that a customer can import, edit, save, reopen, export and recover using the exact downloadable build. Passing hundreds of tests is useful evidence, not permission to skip that path.
