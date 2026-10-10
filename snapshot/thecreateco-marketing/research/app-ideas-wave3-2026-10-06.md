# Wave 3 ideas — 2026-10-06 (Armon: "lets brainstorm new ideas and apps")

Where we are: wave 1 = make (Form, Luma, StemDeck, ScenePilot). Wave 2 = finish & share (13 tools + Glyph Studio, all live 2026-10-06). Gaps now: (1) nothing connects the apps into one workflow, (2) nothing works offline / installs like an app despite "creativity shouldn't have an off switch", (3) no growth loop that brings people back, (4) we can't measure anything (no analytics).

## Top picks (build now)
1. **Lyric** (Sattari) — lyric video maker: song + lyrics → auto-timed words (on-device speech alignment, reuses Captions' Whisper) → animated type styles over Canvas visuals or your footage → 9:16/16:9 export. Every releasing artist needs one; output is shareable by nature. Combines Captions + Canvas + Glyph fonts.
2. **Clean** (Sattari) — voice cleanup for podcasts/voiceovers/vocals: denoise, de-reverb-lite, de-ess, level to −16 LUFS, one button, on-device. Local alternative to cloud "enhance" tools. Uses Sattari DSP know-how (clean/deess/comp modules).
3. **Reframe** (ScenePilot) — 16:9 → 9:16/1:1 auto-crop that follows the subject (face/motion tracking, reuses AutoCut's face model), smooth camera path, manual keyframe override, export. Every creator repurposing long video into shorts.

## Platform moves (not apps, bigger leverage)
4. **Installable + offline** — make every web app a PWA (install to dock/home screen, works offline after first load where engines allow). Directly delivers the brand promise and the About page's "mobile on the way".
5. **Locker** — one local library for all your work across apps (.form, .luma, .sattari, .glyph, AutoCut cut maps), with "send to" handoffs (Form render → Luma, Luma art → Mockup/Canvas, Pocket → StemDeck → AutoCut). It's Kickstarter priority #3 ("cross-app workflows") made real.
6. **Made with thecreateco** — public showcase: one-click "share what I made" from any app (opt-in, reviewed), weekly creative prompt/challenge. The growth loop + Kickstarter social proof.

## More ideas
- **Chop** (Sattari) — drop a song/sample, auto-slice to 16 pads on transients/beats, play/sequence, export slices. Pairs with Pocket.
- **Chords** (Sattari) — chord progression sketcher by mood/key → MIDI/WAV, into Pocket/StemDeck.
- **Toolbox** — tiny free utilities people google daily: tuner, metronome, tap BPM, aspect-ratio calculator, ring-size chart, color palette from image, LUFS meter. SEO magnets that funnel into the big apps.
- **Thumb** (Luma) — YouTube thumbnail maker: subject cutout (on-device background removal), bold type presets, A/B variants.
- **Cutout / Upscale** (Luma) — on-device background removal and 2–4× upscaling.
- **Script** (ScenePilot) — screenplay writer (Fountain format) that flows into Board → AutoCut.
- **Pattern** (Form/Ghost) — flat sewing patterns from Form's Fabric/Ghost garments; big pain for fashion students (CLO is expensive).
- **Room** (Form) — sketch a floor plan or type "two-bed flat, 70 m²" → 3D walkthrough.

## Prerequisite
Measurement: add privacy-friendly analytics before choosing wave 4 by data. Free option needs Armon to create a Cloudflare Web Analytics token (free) — or approve Plausible (~$9/mo). Spending = Armon's call per DIRECTIVE.md.
