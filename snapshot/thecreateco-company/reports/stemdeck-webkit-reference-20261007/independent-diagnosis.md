# Independent scoped diagnosis

Task: CORE-STEM-WEBKIT-REFERENCE-001. Owner remains `company-director-20261008T0510-webkit`. Reviewed the three requested utilities and `inspect-restored.json` / `normal-ui/report.json`; no product edits or browser experiments performed. Source report identifies c15bb06a87b150a966e8c563457de4f2786ba141 and `sourceDirty: true`, so this is a review of supplied working files/evidence, not a clean-commit certification.

## Findings

- The restored records have correct logical sizes but read the complete 88,146,200-byte archive, including SATPROJ6 at byte zero. Even their nested 32-byte reads begin with SATPROJ6. This is actual backing-byte/range corruption, not merely asset-ID remapping, decoder behavior, or a hash normalization problem.
- `readProjectArchive` validates offsets, total length, and every asset tree hash before returning. `importAudioAssets` then persists these archive-backed `File.slice` objects directly through IndexedDB structured cloning. The strongest current hypothesis is loss of a file-backed slice offset/range at the persistence boundary; the available evidence does not prove the exact WebKit mechanism or size threshold. A passing 4 KB probe does not exclude a large-file-specific failure.
- The fresh-profile path has no existing assets to deduplicate against. Its all-assets-to-one-SHA appearance can therefore arise from every restored Blob exposing the same archive bytes; it does not require the ID map to collapse. Do not “fix” semantic comparison or suppress the hash assertion.
- `hashLibraryAudio` and `sameBytes` trust slice reads to return the requested length. Explicit length checks would catch oversized reads, but cannot catch equal-length reads with wrong offsets (the nested 32-byte observation). Length checks alone are not a repair.

## Smallest next checkpoint / conditional repair

1. Finish the large-file probe with exact original slice bytes/hash before storage, after pre-reading/hash verification, and after IndexedDB round-trip (including a process restart). Include two nonzero, distinct offsets and the actual archive. Compare an unmaterialized slice against a byte-materialized Blob in the same batch transaction. This separates large-file slicing, hash/read side effects, and persistence behavior.
2. If only archive-backed slices fail while byte-materialized Blobs pass, narrowly detach v6 imported assets from the archive backing before storing: read verified bounded chunks, enforce each expected byte count, and construct a Blob from actual byte arrays. `new Blob([slice])` is not an evidenced detachment because it can preserve shared backing. Do not use whole-archive reads/base64. Preserve existing hash validation, ID remapping, and all-or-nothing transaction behavior; account for total retained materialized bytes rather than claiming bounded total memory merely because reads are chunked.
3. Validate the candidate using the real 88 MB portable import into a fresh profile, independent per-asset byte hashes, semantic state comparison, full-process restart and export. Post-storage tree-hash verification before replacing the session is a useful failure containment gate, but cannot itself repair storage corruption.

## Release interpretation

The report supports actual UI capture/edit/replay, same-profile full-process restart, and master/aligned-stem export comparisons in the tested WebKit run. Overall `pass` remains false because portable import failed. Physical inputs were not tested and `/api/inventory` was mocked. Native reference decode failure remains a separate unresolved fact supplied by the owner; product bounded decoding working does not establish native decoder success. No full supported-platform pass, release approval, or ownership transfer is justified.
