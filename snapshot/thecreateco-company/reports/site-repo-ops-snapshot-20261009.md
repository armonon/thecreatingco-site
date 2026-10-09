# Company operations Git handoff — 2026-10-09

Armon requested that company updates go into the Git repository for
thecreatingco.com. The private `armonon/thecreatingco-site` repository now has
an orphan `company/operations` branch for internal records, separate from the
deployable site branches. Initial remote head `ba5d2b3b2bdb76ec6a6b0eb566dcf2848bea2e75`
was verified on GitHub; site `main` and open site review branch were unchanged.

The initial screened snapshot copied 281 source/text files (about 2.9 MB) and
indexed 53 company-product Git checkout heads. Eleven dirty tracked files and
seven files matching sensitive-content rules were skipped. Product code remains
in its owning GitHub repositories. Runtime databases, contacts, credentials,
private feedback, browser profiles, binary QA evidence and host backups were
not copied. `snapshot/MANIFEST.json` in the operations branch records exact
file hashes and omissions. This is not a complete workstation backup.

An hourly local LaunchAgent (`com.thecreateco.ops-sync`) now refreshes and
exact-head pushes the screened snapshot without merging or deploying it. The
installed job was kickstarted through launchd and exited 0; its first observed
run found no changes, verified remote head `8b8890339e3af88a0197022cf4e0ce4e98330cc1`,
and recorded an `already-current` Git handoff receipt. A future timer-fired
run has not yet been observed.
