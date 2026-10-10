# ScenePilot 0.1.16 candidate handoff

Status: internal QA candidate, **not approved for public release**. Do not replace
public downloads until the qualification review, clean-machine matrix, and signed,
notarized distribution gates pass. See `release-today-0.1.16.md` for the initial pass
and `release-followup-0.1.16.md` for the subsequent evidence.

## Installation and compatibility gate

- Candidate target: Apple Silicon, macOS 13 or newer. Both application metadata and
  the Swift helper now target 13; this is not proof of operation on macOS 13.
- Test the exact signed DMG on a separate clean macOS 13 machine and a current macOS
  machine, without Node, FFmpeg, development caches, or project source installed.
- Verify SHA-256, mount the DMG, copy to Applications, launch through Finder, and
  confirm Gatekeeper accepts it. Do not disable Gatekeeper or remove quarantine to
  call this test passed. Test a standard non-admin user.
- With networking disabled, import local video/audio, save, quit, reopen, play,
  export MP4, and use bundled segmentation. Optional external providers are not
  promised offline. Check nested comps and transparent export separately.
- Upgrade an existing test installation with saved projects; confirm settings and
  media links survive. Back up projects before upgrade. To roll back, install the
  previously trusted version and use pre-upgrade project copies; older project
  compatibility is not guaranteed.

## Signing and notarization

The available local Apple Development identity is not a Developer ID Application
distribution identity. The release workflow requires `MACOS_CERTIFICATE`,
`MACOS_CERTIFICATE_PASSWORD`, `MACOS_SIGNING_IDENTITY`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` configured securely by the owner.
Never put certificates, passwords or API tokens in project files or chat.
The workflow fails closed without these and a completed candidate-bound review.
Validate `codesign --verify --deep --strict`, `spctl --assess --type execute`, and
the notarization ticket on the actual distribution artifact before publication.

## Project safety and recovery

Save important projects explicitly. Autosave is recovery, not backup. Keep original
media alongside a separate backup; a project file stores links, not all source bytes.
If interrupted, open Autosave history and choose **Recover disk autosave with media
links…**. Choose the newest appropriate journal file, verify media and edits, then
Save As a new project. Recovery deliberately does not overwrite the journal.
If a source was moved, use relink; do not silently substitute another file.
If disk space runs out, free space on the destination and retry. Atomic replacement
preserves the previous complete project/output, but cannot create free disk space.

## Support and release limitations

For a reproducible report collect app version, macOS version, Apple Silicon model,
available storage, format/resolution/frame rate, steps, expected/actual result, and
the smallest permission-cleared project/media sample. Redact personal filesystem
paths and credentials from logs. Ask before transferring a customer's footage.

Current tests are not a guarantee for all codecs, VFR footage, multihour timelines,
every external device, or every plugin. Short generated 4K throughput is not a
long-session thermal/memory result. Roto hair/occlusion quality and visual parity on
real production work need signed review; do not market them as perfect.

## Public handoff checklist

- [ ] Completed candidate-bound review, with actual evidence files and named reviewer.
- [ ] Clean-machine install, offline use, upgrade/rollback and oldest OS results.
- [ ] Developer ID signing, notarization, ticket and Gatekeeper acceptance.
- [ ] Owner review of bundled model/media-library licensing and distribution obligations.
- [ ] DMG checksum, versioned release notes and known limitations match the artifact.
- [ ] Public download and support contact tested without developer authentication.
- [ ] Rollback artifact and pre-upgrade project backup instructions retained.

Local checks and an unsigned preview do not satisfy these unchecked public gates.
