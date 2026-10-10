# ScenePilot 0.1.16 notarized candidate — September 27, 2026

## Verified exact artifact

- DMG: `release/ScenePilot-0.1.16-arm64.dmg`
- Post-stapling SHA-256: `2b8c9b2dd9756ca9d3b2105711ad6cc169a98b599d3be024889eb01dc57d0e77`
- DMG ticket validation: passed.
- DMG Gatekeeper assessment: accepted, Notarized Developer ID.
- Mounted read-only; filesystem checksum validation passed.
- Enclosed app deep/strict code-signature verification: passed.
- App authority: Developer ID Application: Armon Nasiri (NJBZDU7XZX).
- App hardened runtime: enabled; signing timestamp September 27, 2026.
- App stapled ticket validation and Gatekeeper execute assessment: passed.
- All packaged desktop JS/preload runtime files match current source.
- All 107 renderer HTML/JS/CSS files match a fresh desktop renderer rebuild.
- Bundled media-engine discovery, native roto helper, model integrity and license
  notice presence passed the package certification script.
- Candidate source digest: `b514385ecf15f683aafc40dc090cac418e26c9bee37096f0de3b1e8cf64b828f`.
- Packaged app.asar digest: `be4594c850045152d5ffcbd9c1ee7e2ca4c5d21c4e0a6e8cf5456e0459d76bc7`.

## Local installation smoke test

Copied the exact bundle to a separate test directory; existing
`/Applications/ScenePilot.app` was not overwritten. The signed test copy launched
successfully and displayed the editor workspace with native engine ready.

Test copy: `/Users/lillypad/Downloads/scenepilot-install-test.0KCgu3/ScenePilot.app`.

The desktop reported user activity during further actions. UI automation paused
to avoid interfering. Save/reopen, playback and MP4 export remain unverified for
this exact installed candidate. A generated eight-second H.264/AAC fixture is
available beside the test app as `qa-av.mp4`.

## Release status

Uploaded the exact DMG and corrected checksum to the `v0.1.16` GitHub draft:
https://github.com/armonon/scenepilot-releases/releases/tag/untagged-a5a18d94d68809f61b18

GitHub reports both assets uploaded. Its SHA-256 digest for the 362,679,890-byte
DMG matches the local post-stapling digest above. Release remains `isDraft: true`;
public downloads and the website have not changed. The temporary read-only DMG
mount was ejected; the separate test installation was retained.

Signing/notarization checks pass; this is not full release approval. Existing
candidate-bound perceptual, clean-machine/minimum-OS, upgrade and distribution
review gates still apply. The package script's `publicReleaseReady` field denotes
its narrow signature/Gatekeeper check, not completion of those wider gates.
Do not mark missing tests passed or switch public downloads on that field alone.
