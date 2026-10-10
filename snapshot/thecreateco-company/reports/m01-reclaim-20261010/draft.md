# Reclaim for Mac — internal demo draft (not an announcement)

**Purpose:** a short, evidence-bounded walkthrough showing the difference between a read-only look and the native alpha's review → quarantine → restore workflow. This is a rehearsal script, not a release announcement, launch post, or proof that the native workflow has been qualified.

## On-camera setup

- Use a supported Mac and the currently linked public alpha only after a separate operator has verified the downloaded file and environment. Current listing says Reclaim 0.1.1, macOS 13+, Apple Silicon + Intel; clean-machine, physical-Intel and macOS 13 testing remain outstanding, so do not represent those as validated targets.
- Use disposable copies in a dedicated throwaway folder, never a real user library or the only copy of anything. Prepare a small, known set: one obvious duplicate pair and one unrelated file. Preserve a before-state listing/checksum outside the demo folder. Do not use a production folder or imply reclaimed-space totals.
- If this exact app version, test device, disposable fixture, or restore operation has not been independently checked immediately before filming, keep the native sequence as a storyboard only. No install/run/restore evidence was collected for this draft.

## Script (about 60–90 seconds)

**1 — Before: uncertainty (show the disposable folder in Finder).**

> “A downloads folder can accumulate several copies of the same thing. Before I act, I want to see what Reclaim identifies—and keep the originals safe while I decide.”

**Action:** show the prepared folder and its small fixture set. Do not claim this represents a user's whole disk or a measured storage problem.

**2 — Contrast with the browser preview (optional, 10 seconds).**

> “The browser companion is for read-only review. It can help inspect selected files; it does not quarantine or delete originals. The Mac alpha is the path for the reversible file workflow.”

**Action:** optionally show `https://reclaim.thecreatingco.com/browser/` as a page only. The page was reachable during this check, but its interactive workflow was not exercised. Never imply browser-side cleanup.

**3 — Native alpha: inspect before acting (only after the sequence is independently confirmed).**

> “In the Mac alpha, I review the candidates first. I can leave anything alone; a match is a suggestion to inspect, not an instruction to remove.”

**Action:** show the review/results screen with only the disposable fixture folder selected. Pause on the candidates; show the user choosing what to keep. If the visible UI or behavior differs, stop and revise the script rather than narrating expected behavior as observed fact.

**4 — Quarantine, then restore (the key proof point).**

> “For this demo, I’m moving only the selected disposable copy into quarantine. Then I’ll restore it and check that it’s back where expected.”

**Action:** quarantine one known duplicate, then use the app’s restore path. Show the restored file in its expected location and compare against the preserved before-state. Capture the actual app version, macOS/device details, exact steps, and observed result in a qualification receipt before treating this sequence as filmed proof. Do not click permanent deletion or show it as a routine step.

**5 — After: state exactly what happened.**

> “That was one small, reversible test on disposable files. It shows the review-and-restore path we exercised; it doesn’t establish safety on every Mac, folder, or failure condition.”

**Action:** show the restored fixture and say only what the evidence supports. If restore was not independently completed and recorded, replace this closing with: “This is the workflow we’re preparing to qualify; restore has not been demonstrated in this recording.”

## Guardrails and caption

- Describe Reclaim as a **free public Mac alpha, version 0.1.1**. The current manifest labels it `public-alpha` and the GitHub release is marked prerelease.
- The Mac product page says it can review storage, quarantine selected items and restore what users keep. The download page says automatic permanent deletion is off unless explicitly enabled. These are publisher descriptions, not a substitute for the demo's own observed result.
- The current manifest says physical Intel, clean-machine installation and macOS 13 testing remain outstanding. Do not say “works on Intel/macOS 13” as a qualified result, despite those being listed targets.
- Keep the browser companion distinctly **read-only**. Do not conflate its preview with native quarantine/restore.
- Show backup/disposable-file guidance. Do not claim “risk-free,” “guaranteed recovery,” “safe for your whole drive,” verified reclaimed GB, or universal duplicate detection.
- Never showcase permanent deletion in this demo. If a later independently approved test explores it, keep it a separate procedure and report.

**Suggested lower-third:** `Reclaim 0.1.1 · Public Mac alpha · Demo uses disposable files · Restore result must be verified for this recording`

**Publication status:** internal draft only. No post, distribution, endorsement, or release-status change is authorized by this work.
