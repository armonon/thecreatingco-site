# StemDeck independent mastering vectors — 2026-10-08

Task CORE-STEM-AUD-010; owner director-20261008T0810-mastering. Started08:10UTC, observation completed 2026-10-08T08:20:33.132616+00:00. One bounded company/Core Lab audit, not a marketing cycle or product completion. Parent/lab PAUSE absent;recover returned[];lab.py next selected this eligibleP2, no other RUNNING product owner. Earlier P0/P1 repairs remain held for exact-source disk/CI/stack/platform gates; no competing product work started.

## Outcome

**COMPLETE as evidence-establishment audit; original output qualification FAIL (8valid exports,2clipping refusals).** Independent review accepts only this bounded scope. No product code changed, pushed, merged or deployed. Original results.json remains pass:false. Source6bad0edaf198d80d44c9aa02c3e65970fe7d9148, dedicated clean branch audit/stemdeck-mastering-20261008 at /Users/agentsattari/code/company-worktrees/stemdeck-mastering-20261008. Source-hash receipt retained; only owned temporary dependency link/server removed after runs. Existing PR34/downstack and published artifacts untouched.

- Exact-source focused baseline:32tests/3filesPASS,Node22.23.2.
- Actual offline-browser master harness:9checksPASS,Chromium151.0.7922.34; generatedaudio only, no microphone/speaker/device capture.
- Five deterministic fixture families (sine,transient,intersample,dense,bass-heavy), neutral and drivenlimiter,48kHzstereo24bit. Sine/transient/intersample20s;dense/bass60s cross actual30s export-section boundary. Formulas/fades/stereo phases in audit.mjs; no licensed/copyright corpus or randomunseeded data.
- Eight complete WAV exports decoded independently by ffmpeg version 8.1.1 Copyright (c) 2000-2026 the FFmpeg developers. Sourcegenerator,actualWAVSHA256,strictRIFF/header/payload/framecount checks,FFprobeformat and separate-contiguous-render-versus-exportedPCM parity retained. MaximumPCM error1.1920928955078125e-7 (limit3e-7); LUFSerror0.0525500071LU (limit0.2), samplepeakerror0.0463824104dB(limit0.11), estimatedtruepeakerror0.3249186543dB(limit0.5). Thresholds declaredbeforeobservations, not relaxed.
- Original intersample drivenlimiter and bass-heavy drivenlimiter exports FAIL with explicit sampleclipping refusal. Settings:level100,limiter=true,compression=false,threshold-3dB,drive+3dB,inputtrim0. Independently measured float-render peaks:intersample+0.9dBFS/+2.7dBTP (5.7dB truepeakovershoot relative threshold);bass+0.8dBFS/+0.8dBTP (3.8dBrelative). Transient successfulexport still measures-2.6dBTP,0.4dBabove-3threshold. **The limiter is not a ceiling.** UI/docs already explicitly say this. Export guard refuses clippedPCM rather than silentlywritingclippedoutput.
- Separate inputtrim-6dB recovery:both actualexports succeed with strictPCM/oraclechecks;intersample-5dBFS/-3.2dBTP,bass-5.2/-5.2. FourdiagnosticchecksPASS. These changed-settings recovery observations do not replace or waive originalfailures.

| Family | Settings | Original outcome | Maximum export PCM error |
|---|---|---|---|
| sine | neutral | EXPORT/ORACLE SUBSET PASS | 6.705522537231445e-08 |
| sine | limiter | EXPORT/ORACLE SUBSET PASS | 6.705522537231445e-08 |
| transient | neutral | EXPORT/ORACLE SUBSET PASS | 1.1920928955078125e-07 |
| transient | limiter | EXPORT/ORACLE SUBSET PASS | 1.1920928955078125e-07 |
| intersample | neutral | EXPORT/ORACLE SUBSET PASS | 1.1920928955078125e-07 |
| intersample | limiter | FAIL: clipping refusal (retained) | n/a |
| dense | neutral | EXPORT/ORACLE SUBSET PASS | 8.940696716308594e-08 |
| dense | limiter | EXPORT/ORACLE SUBSET PASS | 1.1920928955078125e-07 |
| bass-heavy | neutral | EXPORT/ORACLE SUBSET PASS | 1.1920928955078125e-07 |
| bass-heavy | limiter | FAIL: clipping refusal (retained) | n/a |

## Actual commands and receipts

Company cwd /Users/agentsattari/thecreateco-company unless noted. Commands are reproducible; logs/scripts remain in this report directory.

1. Read AGENTS.md,DIRECTIVE.md,engine/README.md,COMPANY_STATE.md,AUTONOMY.md,data/model-routing.json,CI_OUTAGE_POLICY.md,REVENUE_DIRECTIVE.md,CoreLabDIRECTIVE/HEALTH,releaseDIRECTIVE/manifest and root RELEASE_MATRIX.md. Initial requested release-program/RELEASE_MATRIX.md lookup was absent; corrected to generated rootmatrix.
2. `python3 engine/company.py recover` (exit0,recovered[]), `refresh` (exit0), `python3 core-product-lab/lab.py next` (selectedexacttask); `claim --id CORE-STEM-AUD-010 --owner director-20261008T0810-mastering --minutes35` (exit0). Unique returned token used for heartbeat/finish, omitted from report. Heartbeat/refreshexit0.
3. `git worktree add -b audit/stemdeck-mastering-20261008 /Users/agentsattari/code/company-worktrees/stemdeck-mastering-20261008 6bad0edaf198d80d44c9aa02c3e65970fe7d9148` (exit0). Temporary own node_modules symlink to existingdeps, no reinstall under limiteddisk.
4. From worktree: `/opt/homebrew/opt/node@22/bin/node node_modules/vitest/vitest.mjs run src/utils/loudnessDSP.test.js src/utils/masterOutput.test.js src/utils/arrangementStreamExport.test.js --maxWorkers=2 > <report>/baseline.log 2>&1` (exit0,32/32).
5. Initial ViteCLI `--cacheDir` option was rejected(exit1). Correct programmatic `node <report>/server.mjs` overrides cacheDir under report; localhost4318 serverused successfully then explicitlystopped.
6. `node <report>/audit.mjs > <report>/audit.log 2>&1` (exit1,8exportsPASS/2refusals). Original running script accidentally expected10ratherthan9baselinepasses; independentreviewcaughtit. Corrected saved audit.mjs expects9,original audit-original.mjs retained. No product tests/gates changed; original resultsremainFAIL.
7. `node <report>/diagnose.mjs > <report>/diagnostic.log 2>&1` (exit0,4/4). First scopedintersample-onlydiagnosis exit0/2of2 is retained as diagnose-intersample-original.mjs; final expands toboth observedfailures. Browserdiagnosticfunction savedexplicitly.
8. Each actualWAV `ffmpeg -v error -i FILE.wav -f f32le -acodec pcm_f32le pipe:1` and `ffmpeg -hide_banner -nostats -i FILE.wav -af ebur128=peak=sample+true -f null -` (exit0). For clippedrender floatdiagnostics: `ffmpeg -hide_banner -nostats -f f32le -ar48000 -ac2 -i pipe:0 -af ebur128=peak=sample+true -f null -` (exit0). Exact properly separated args are in scripts; summaries/logsretained.
9. `python3 <report>/validate.py` (exit0):actualheaders/FFprobe/originalhash-frame linkage. Source-receipt.json asserts finalgitstatus empty, candidateSHA and hashedsource. No fresh fullbuild/fullsuite/security/hostedCI rerun: unchangedproductsource, focusedbaselineappropriate; previous exact-sourceevidence remains historical with its timing.
10. Productobservation patch through `engine/company.py update-products --file <report>/product-patch.json`; taskfinish viaowner/token/evidence; refresh company/lab/release/revenueviews. No SQLiteediting.

## Model routing and independent review

Parent actual OpenAI/gpt-6.1-sol confirmed by live session_status. No actual fallback invocation observed; configured Anthropicfallbacks were not used. Scopedresearch requested native gpt-6-luna; review requested native gpt-6.1-sol withseparatecontext. Child exposedruntime identifies Codex/GPT-6, exactvariantnotconfirmable; no fabricatedLuna/Solexecutionproof or fallbackclaim. Independent review foundbaselinecountdefect and recommendedstrictformatchecks; finalreviewinspected10originalcases,4diagnostics and hash/formatvalidator,accepts evidenceestablishmentonly. Advice and finalreview saved separately. No Claude/Sonnet/Opusreviewinvoked.

## Limitations and next action

Not EBU/ITUcertification, originalsource-versusmasterfidelitysignoff, physical/humanlistening, fullgoldenworkflow, multichannel, allsamplerates/phases/codecs, longhardwareload, native/deployedartifact or wholeproductqualification. Meteragreement is bounded estimatedTP agreement, not a guaranteedceiling. RMS is recorded from independentlydecodedactualPCM perchannel, not used to inferqualityscores. All tests offline/localhost/generated. Quality/businessmetrics unchanged and unknown. Diskheadroomwaslimited (400MiB then308MiBobserved); unchangedmandatoryreleasegate requires2,838,683,648bytes and remainsblocked; not rerun or weakened.

Next:retain these negative/outputvectors and signedoracleerrors; continueexistingnative/platform/goldenqualification and exact6badmandatorygate only when sufficientdiskisavailable; normal hostedchecks/stackgates still required. No limiterceilingadvertisement. Additional intersamplephase/rate/independentmusicalcorpus belongs to future qualification, not this audit's completion. No separateongoingworker, outreach, channelmessage, spend, accountchange or duplicate taskcreated.
