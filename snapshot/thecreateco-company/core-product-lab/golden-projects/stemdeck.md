# StemDeck golden workflow

Existing reproducible subset fixture: stemdeck-synthetic.sattari (generated PCM; SHA-256 in adjacent manifest). One deck/six arrangement tracks is explicitly NOT four-deck qualification. Source generator scripts/studio-ui-fixture.mjs at 8c06f81.

Run scripts/session-ui-qa.mjs against an isolated built preview; scripts/reference-lifecycle-qa.html and arrangement-browser-qa.html against isolated source server. Never use a production session. Retain exact browser/source/runtime and outputs. Existing lifecycle generator produces two 180-second sources/four stems, fabricated actions, MIDI and automation. Compare reopen PCM SHA-256, master error <2e-6, ten aligned pre-master stems.

Next fixture: four synthetic decks with stems, tempo/sync/key changes, effects and actual UI capture → replay → arrange → edits → portable save → full browser close → reopen → export. Capture source hashes, event log, safety print, arrangement structure, exports and error counters; verify undo/redo and intentionally missing/corrupt source recovery.

Real-work qualification is separate: owner-selected rights-cleared songs, authorized named hardware, 30/60/120-minute sessions at supported sample rates/buffer settings, latency/underruns/memory and listening checks. No microphone permission inferred. Replay/arrangement partial processing must stay disclosed.
