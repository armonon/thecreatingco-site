# Pocket Starter Patterns — Manifest

Eight original 16-step grooves for Pocket (https://sattarimusic.com/studio/pocket), thecreateco's phone-first beat sketchpad. All patterns are original work, written directly against Pocket's pattern schema — no samples, no third-party content.

| Pattern | BPM | Feel |
|---|---|---|
| Night Drive | 124 | Four-on-the-floor house, steady kick and open hats for a late-drive pulse |
| Boom Bap Basic | 90 | Boom-bap hip-hop, swung and laid-back with a dusty backbeat |
| Low End Theory | 140 | Trap, rolling hi-hats and sparse 808-style bass hits |
| Dembow Step | 95 | Reggaeton / dembow, the classic displaced snare pattern |
| 2-Step Lift | 132 | UK garage / 2-step, skippy hats and an offbeat kick |
| Rainy Window | 76 | Lo-fi, heavily swung and soft, built for a slow afternoon |
| Grey Room | 128 | Minimal techno, stripped down to a single bass note and a dry kick |
| Lagos Light | 108 | Afrobeat-influenced, interlocking kick and rim for a loose, rolling groove |

## Files

- `patterns/*.json` — one file per pattern, same shape Pocket's saved-pattern list stores.
- `all-patterns.json` — all eight patterns as a single array, matching Pocket's `sattari-pocket-patterns-v1` local-storage value exactly.
- `HOW-TO-USE.md` — how to load this pack into Pocket.
- `IMPORT-CONSOLE-COMMAND.txt` — the one-line browser console command that does the loading.

## Validation

Every pattern was built as a plain object against Pocket's documented schema, then round-tripped through the real `normalizePattern()` function from Pocket's own source (`pocketPattern.js`) — not a reimplementation. All eight passed with no clamping or data loss on any field (name, bpm, swing, key, scale, cutoff, drum steps, bass steps).

## License

CC BY 4.0 thecreateco. Use, remix, and redistribute freely, with credit to thecreateco (https://thecreatingco.com).

## Pack size

`thecreateco-pocket-patterns.zip`: 8 KB.
