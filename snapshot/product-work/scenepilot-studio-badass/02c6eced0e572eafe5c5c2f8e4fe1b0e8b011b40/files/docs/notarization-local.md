# Local Developer ID notarization

The Developer ID Application identity is available locally. The old 0.1.16 DMG
predates the current source; rebuild rather than submit that older artifact.
Notarization is not public-release approval or an end-to-end product test.

## Owner credential step

Run this yourself in Terminal; do not send the password in chat:

```sh
xcrun notarytool store-credentials "scenepilot-notary"
```

Follow the interactive prompts for your developer Apple ID, app-specific password
and Team ID. The installed Developer ID certificate has Team ID `NJBZDU7XZX`.
Use an account authorized for that team. The command validates credentials before
saving them in Keychain. Only the profile name needs to be shared with the agent.

## Fresh candidate (not publication)

From the repository root, after the profile has been validated:

```sh
export CSC_NAME="Developer ID Application: Armon Nasiri (NJBZDU7XZX)"
export SCENEPILOT_NOTARY_PROFILE="scenepilot-notary"
export SCENEPILOT_REQUIRE_NOTARIZATION=1
node scripts/require-release-signing.mjs
xcrun notarytool history --keychain-profile "$SCENEPILOT_NOTARY_PROFILE"
npm run desktop:stage-media-tools
npm run desktop:renderer
```

Build into a **new, unused candidate output directory** to preserve existing
installers, passing `--config.mac.identity="$CSC_NAME"` to electron-builder.
Do not run the ordinary preview packaging command and assume it used Developer ID:
its default identity remains ad-hoc (`-`). The custom `afterSign` hook owns
notarization and app-ticket stapling. Built-in notarization is disabled to prevent
duplicate submissions; hardened runtime is explicitly enabled.

After building, verify the exact candidate app's Developer ID authority/team,
`codesign --verify --deep --strict`, `xcrun stapler validate`, and
`spctl --assess --type execute`. Inspect all bundled Mach-O helpers/libraries,
including third-party runtimes; any notary rejection must be resolved, not skipped.

Submit the resulting DMG with `xcrun notarytool submit <candidate.dmg>
--keychain-profile scenepilot-notary --wait`, require **Accepted**, then staple and
validate the DMG. Record the submission IDs and SHA-256 **after** stapling. Retain
Apple's failure log if rejected; do not advertise or publish an unaccepted build.

Public downloads remain unchanged until the candidate also clears the existing
real-media, clean-machine, minimum-OS, licensing and release-review gates.
