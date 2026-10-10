# Wave 2 app ideas — brainstorm 2026-10-05 (Armon: "start brainstorming a new wave of apps")

Thesis: wave 1 = tools to MAKE (Form → Luma → StemDeck → ScenePilot). Wave 2 = small, free, single-purpose tools that help creators FINISH and SHARE. Each is (a) something people already search for by name, (b) demoable in under 10 seconds, (c) built on engines we already own, (d) a natural on-ramp into a suite app. These are acquisition products as much as products.

Evidence used: community scout 2026-10-05 (DJs need stems from finished songs; jewelry beginners worry about wall thickness/casting minimums; editors want beat-cut montages), StemDeck "never claim: no AI separation", existing code (NeuralStemEngine seam, Auto Pitch/AutoKey/song-key, cymatic-generator, ScenePilot AutoCut, Rhythm Genie, 49 Sattari DSP modules).

## Top picks
1. **Split** — in-browser stem splitter (vocals/drums/bass/other), local on device (ONNX/WebGPU, Demucs-class model, check license). Opens straight into StemDeck. Fixes StemDeck's biggest stated limit. Demo: drop a song → four lanes → mute vocals. Risk: model size/speed in browser; copyrighted-input optics (position as "for your own tracks / practice").
2. **Canvas** — audio-reactive 9:16 looping visuals for Spotify Canvas / Reels / TikTok from a track + optional cover art. Built from cymatic-generator + Luma layers; export MP4/WebM loop. Every releasing musician needs one; the output itself is shareable marketing ("made with Canvas"). Demo: drop track → visual breathes on the kick.
3. **Captions** — auto captions for shorts with styled, animated, editable words (on-device speech-to-text, e.g. Whisper via WebGPU). Massive creator demand; free CapCut-style captions without an account. Hands off to ScenePilot. Demo: talking clip → word-by-word captions in 5 s.
4. **Vox** — record or drop a vocal in the browser → pitch-correct with the Auto Pitch engine (WASM), auto-detected key, one-tap harmonies, export. Our most mature DSP, finally in front of non-plugin users. Demo: off-key voice memo → in tune → 3-part harmony.

## More ideas
5. **Board** — script → shot list → storyboard frames → ScenePilot timeline. Fills the pre-production gap in the film chain; ties into our own video-marketing workflow.
6. **Mockup** — put Luma art / Form objects on merch, vinyl sleeves, posters, phone screens with realistic lighting; batch export. Merch makers and album-art designers.
7. **Cast** (Form companion) — jewelry print/cast prep: ring sizing, minimum wall/prong thickness check, STL repair, resin-print orientation. Straight from the jewelry-CAD threads. Must stay "checks", never "certified for manufacturing".
8. **Pocket** — phone-first beat/loop sketchpad (Rhythm Genie + Sattari Arp in the browser); export stems to StemDeck. Ideas captured on the bus.
9. **Grade** — make a LUT from any reference image/film still, apply in Luma/ScenePilot, export .cube. Small, viral "steal this look" demos.
10. **Key & BPM** — drop a folder, get key/BPM/energy for every track (song-key + AutoKey engines), export to DJ crates. DJ utility that drives StemDeck traffic.
11. **Press** — EPK / link-in-bio page builder for artists from Bounce/StemDeck/Luma assets; hosted on thecreatingco.
12. **Glyph** — draw your own font in the browser, export OTF. Niche, beloved, very on-brand ("make it yours").

## Suggested next step
Pick 2 to prototype in a week each (recommendation: Split + Canvas — biggest gap + most shareable output), run a quick spike on browser feasibility (model size/latency for Split; render speed for Canvas), and put fake-door "coming soon — join the list" pages on the site for 3–4 of them to measure demand via the launch list before building.
