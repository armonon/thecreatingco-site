# Bounce first-wave checkpoint

Candidate8c8c2541e8d8861a53f102ef8b985e4e35950f3e independently OpenAI-reviewed and pushed in PR2. PR2 merged normally without bypass at77d7fab8b75752e0821b17b58553733d33d28cdc. No required remote checks/rules found, no open downstack; native Windows workflow is manual and unrelated to this web-only repair.

## Changed and why
Saved queue/title/EQ are captured together before asynchronous file reads. Metadata edits during saving now produce a truthful newer-unsaved-work warning. Originals unchanged. PWA content hash regenerated. Actual browser regression reproduced mixed metadata on baseline then passed fix.

## Executed qualification
Clean exact-head Chromium154, Firefox153 and WebKit26.5 on macOS: actual PCM playback/reorder, save/reload/restore, portable download/fresh-tab reopen, independent byte-for-byte SHA-256 audio equality, malformed/truncated archive preserving existing queue, edit-during-save regression, published24-second musical studies playback,390px layout and labeled queue controls passed. Check exact-*/report.json for actual versions/checks and sourceDirty=false.
Actual Chromium quota denial after restarting its owned temporary profile preserved last-good stored library and current unsaved queue. Earlier attempts demonstrated cached grants; only final exact-head result is relied on. Firefox/WebKit quota explicitly UNVERIFIED, not passed.
PWA local baseline/candidate tests passed installability, offline local-audio playback, media-cache exclusions and explicit update/reload. No native engine or physical hardware claim.

## Release preparation
Live before6ac56c60e16a70e7cc60bd7a has47 files and no functions. Full local/live SHA1 manifest matched except reviewed/tested bounce.js and sw.js; headers and every unrelated file unchanged. Netlify site has no linked repository/build; merge alone did not deploy. Draft rollout and workflow verification in progress; publish-receipt.json, if present, records actual publication—not this paragraph.

## Status and limitations
ALPHA, not stable-release candidate. Native licensing/distribution, physical platforms, fullcodec/large-library stress, long-session performance, assistive technology and all recovery modes remain unverified. No website icon changes or excluded apps affected.

## Published result
Published2026-10-08T02:24:06Z, Netlify deploy6ac6fe7a70a37106cdf27df7. All47 file hashes match exact release manifest; only/test/bounce.js and/sw.js changed. Public canonical URL full Chromium workflow passed after publication, including real quota denial and portable output hashes. See live-verification.json and live-check/report.json. Existing Netlify credential used for scoped site metadata/draft/publish; no credential changes.
