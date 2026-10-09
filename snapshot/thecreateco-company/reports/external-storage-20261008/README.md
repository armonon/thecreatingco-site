# External build storage — BLOCKED on macOS access

User explicitly authorized using external drive to resolve storage problems.
Observed Extreme Pro: writable ExFAT device disk7s1, UUID 73AE4AA6-2EB4-3155-BD66-9371467CBB7F, about1.7TiB free. Internal Data has146MiB free. Extreme SSD also attached,163GiB free.

Selected plan: create600GiB maximum sparse APFS image inside a new TheCreatingCo-BuildStorage folder on Extreme Pro, preserving all existing drive data and no reformat. APFS needed for Mac build permissions/symlinks; image grows as used, not600GiB preallocation. First target npm content cache5.1GiB; source/repos/user files/evidence stay local initially.

Attempt: mkdir -p '/Volumes/Extreme Pro/TheCreatingCo-BuildStorage' returned Operation not permitted. Dependent hdiutil create failed No such file or directory. No image created, no files moved, no local originals removed, no settings changed. Do not bypass filesystem/privacy denial using another execution route.

Exact next action: user grants the app hosting this agent removable-volume access via macOS Privacy & Security > Files and Folders (or approved access control). Retry one scoped directory creation after access resolves. Then create/mount image, checksum copy, switch cache path with rollback, verify npm/build and free-space delta before reporting success. Never put node_modules directly on ExFAT or blindly remove caches/originals.
