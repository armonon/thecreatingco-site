# Reclaim file safety and qualification

## Two different products surfaces

- Native Mac app: storage review, duplicate analysis, quarantine and restore. Browser checks do not validate this engine or its Tauri UI.
- Browser edition: selected-file SHA256 review (up to64MiB per compared file and10,000 files), filter/search and downloadable JSON report. Originals are never changed. Reports contain filenames, sizes and hashes, not file content. Native restore is not available in the browser.

## Native duplicate review

The native engine compares regular files of at least1MiB across the selected roots. It streams every data-fork byte into SHA256 and includes sorted Mac extended-attribute names/values (including resource forks). Metadata above16MiB, unreadable/changing files, symbolic links and hardlinked files are conservatively excluded. Repeated/overlapping roots do not count one inode twice. Traversal remains capped at200,000 entries and displayed groups at200; this is not an exhaustive disk certificate.

Read handles use no-follow and observed identity/size/mtime/ctime are rechecked after hashing. This is a scan-time result, not a lock against subsequent external edits. The UI (not the general-purpose native trash command) requires leaving one file in each reviewed group and reports actual moved/skipped item counts. Review your selection; keep other applications from editing or moving those files during cleanup.

## Quarantine and recovery

- A private manifest is written and synced before moves; stored names cannot collide with user filenames or `manifest.json`.
- Same-volume moves use atomic macOS no-replace rename. Restore refuses occupied destinations, including dangling links, and validates recovery paths. Invalid metadata does not authorize traversal.
- Cross-volume regular files are copied into an exclusive temporary file, synced and published without overwrite before removing the source. Mac descriptor-based copying preserves resource forks, extended attributes and metadata, not just the data fork. A full-disk copy failure keeps the source. Opened-descriptor and current-path identity, size, mtime and ctime are checked after copying and immediately before source removal; observed modification/replacement fails closed. A completed recovery copy may remain alongside a changed source. There is still a final check-to-unlink race against a hostile writer; this is not an atomic compare-and-delete guarantee.
- Quarantine does not free disk space until emptied. Emptying or automatic retention is permanent; verify restored content before emptying anything. This qualification never empties real user files.

## Reproducible local evidence

`cargo test --locked` covers full-content false-positive regression, overlapping-root/hardlink exclusion, distinct resource-fork/annotation handling, occupied-destination and manifest traversal checks, same-name/manifest-name recovery, partial permission failure and resource-fork preservation. A native-engine subprocess test creates5,000 disposable files, actually kills a partially completed quarantine worker, restarts a separate process and verifies every original byte on restore. It is not a simulated exception and not a Tauri GUI test.

The ignored subprocess helper is invoked only by that recovery test. The pre-existing `live_disk_smoke` stays ignored because it reads actual user folders. Do not indiscriminately run all ignored tests.

A separate opt-in test, `quarantine_owned_volume_roundtrip_and_disk_full_preserve_source`, needs an owned disposable32MiB mounted filesystem whose root contains `owned-fixture` with exact text `reclaim-disposable-32mb-volume`. Set `RECLAIM_OWNED_TEST_VOLUME` to that mount only, then run:

```sh
cargo test --locked quarantine_owned_volume_roundtrip_and_disk_full_preserve_source -- --ignored --nocapture
```

It refuses the source filesystem, limits fixture writes, verifies a real8MiB cross-volume round trip, fills only that test volume until actual ENOSPC, and verifies a failed copy leaves its original bytes intact. Never point this at an existing user volume. Use a newly created disk image; detach it afterward.

## Still unverified / not release-ready

Native UI action/confirmation wiring, signed/notarized exact-artifact installation, clean-machine behavior, oldest-supported macOS13 and physical Intel remain separate gates. Source uses Mac-specific atomic moves; other operating systems are not claimed supported here. Crash tests cover process termination, not sudden power loss. Hostile concurrent parent-directory/path replacement and concurrent source writes during cross-volume copy are not comprehensively qualified. Do not infer race-free or full data-loss certification from the passing fixture subset. Corrupt-manifest manual recovery, external-volume disconnect and general performance/accessibility also need dedicated evidence.
