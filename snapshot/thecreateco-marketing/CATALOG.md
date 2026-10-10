# thecreateco — master app catalog (updated 2026-10-06 ~00:00 PT)

Armon (Discord 2026-10-05): everything here becomes an app under thecreateco (thecreatingco.com). Music tools live under the Sattari brand; other tools live inside their parent app.
Status key: LIVE = public web alpha · REVIEW = deployed on a review site, not yet on the production domain.

## Creative Suite (live)
1. Form Studio — browser 3D/CAD (architecture, products, jewelry, garments). LIVE https://form.thecreatingco.com/studio
   - Cast — ring sizing, thin-wall/prong check, mesh health + repair, metal weight, resin print orientation, STL export. MERGED to form-studio main (PR https://github.com/armonon/form-studio/pull/1); review https://form-studio-review.netlify.app/studio (☰ project menu → Open Cast). Not yet on production form.thecreatingco.com — that's hosted separately via chatgpt.site/Cloudflare, not this Netlify site, and was left untouched.
2. Luma Studio — layered image editor. LIVE https://luma.thecreatingco.com/studio
   - Mockup — art onto tee, hoodie, tote, poster, vinyl sleeve, phone; batch export. LIVE https://luma.thecreatingco.com/studio ("…" menu → Mockups) (merged https://github.com/armonon/luma-studio/pull/1)
   - Glyph — draw your own font, export OTF/TTF, use in Luma's type tool; installed fonts now embed in `.luma` projects so they reopen anywhere. LIVE https://luma.thecreatingco.com/studio ("…" menu → Glyph font maker) (PR same). Spun out as its own standalone product, see Glyph Studio below.
3. StemDeck (Sattari) — stem remix/performance studio. LIVE https://stemdeck.thecreatingco.com/studio
4. ScenePilot — beat-aware video editor (Browser Lite). LIVE https://scenepilot.thecreatingco.com/app/
   - Captions — on-device speech-to-text, animated caption styles, burn-in WebM + SRT/VTT. LIVE https://scenepilot.thecreatingco.com/tools/captions/ (PR https://github.com/armonon/scenepilot-studio-badass/pull/85)
   - Board — script → shot list → storyboard, PDF/CSV, timeline markers. LIVE https://scenepilot.thecreatingco.com/tools/board/ (PR same)
   - Grade — color grade from a reference still, .cube LUT export. LIVE https://scenepilot.thecreatingco.com/tools/grade/ (PR same)
   - AutoCut — dedicated auto-editor for videos/music videos: beat+energy-driven cuts, presets, multi-take lip-sync alignment, 9:16/1:1/16:9 export, opens in ScenePilot. LIVE https://scenepilot.thecreatingco.com/tools/autocut/ (PR https://github.com/armonon/scenepilot-studio-badass/pull/86, stacked on #85)
   - Reframe — 16:9 → 9:16/4:5/1:1 auto-crop: follows faces (reuses AutoCut's self-hosted BlazeFace) or motion when there's no face, smooth virtual camera with dead zone/max pan speed/easing, resets on scene cuts instead of whip-panning, two-subject framing, draggable keyframe override, per-segment letterbox, exports MP4/WebM + crop-path JSON. **LIVE** https://scenepilot.thecreatingco.com/tools/reframe/ (PR https://github.com/armonon/scenepilot-studio-badass/pull/88, stacked on #87 — published by additive overlay, not a merge; see WAVE2.md)

## Sattari (music)
5. Sattari Audio — native plugin suite for Mac (AU/VST3): Compass (free), Auto Pitch, Instruments, Vocal, Mix, Create; 49 plugins incl. Auto Pitch, Key, Arp, Align, Royal Chain, VoxKey, Sub Conjurer. Internal alpha, not released. https://sattari-audio-suite.netlify.app/
6. Split — separate any song into vocals/drums/bass/other on your device; opens in StemDeck. **LIVE** https://sattarimusic.com/studio/split (built on PR https://github.com/armonon/sattari-custom-site/pull/23, supersedes #21/#22 — published by additive overlay deploy, not a merge; see WAVE2.md)
7. Key & BPM — batch key + tempo detection, CSV export. **LIVE** https://sattarimusic.com/studio/keybpm (same PR #23)
8. Vox — record/drop a vocal, pitch-correct, add harmonies. **LIVE** https://sattarimusic.com/studio/vox (same PR #23)
9. Canvas — audio-reactive looping 9:16 visuals for Spotify Canvas/Reels, MP4/WebM. **LIVE** https://sattarimusic.com/studio/canvas (same PR #23)
10. Pocket — mobile-first beat/loop sketchpad, WAV + stems, Send to StemDeck. **LIVE** https://sattarimusic.com/studio/pocket (same PR #23)
11. Press — artist EPK / link-in-bio builder, HTML + PDF export. **LIVE** https://sattarimusic.com/press (same PR #23)

## Other apps (live)
12. Ghost Studio — two garment photos → 3D garment study, GLB export. LIVE https://ghost.thecreatingco.com/
13. Librarian — book discovery + local PDF reader. LIVE https://librarian.thecreatingco.com/
14. Reclaim — read-only duplicate-file review in the browser (Mac cleaner native). LIVE https://reclaim.thecreatingco.com/browser/
15. Bounce — music player for audio you own, EQ, saved library. LIVE https://bounce.thecreatingco.com/browser/
16. Glyph Studio — standalone draw-your-own-font tool spun out of Luma's Glyph (separate repo `armonon/glyph-studio`, decoupled engine). Brush + pen drawing, smooth curve fitting, kerning pairs editor, metrics, type tester, save/load `.glyph` projects + IndexedDB autosave, OTF/TTF export, "Open in Luma" link. LIVE https://glyph-studio-610.netlify.app (custom domain glyph.thecreatingco.com pending DNS — CNAME glyph → glyph-studio-610.netlify.app, needs to be added at Squarespace). Alpha caveat: kerning exports to TTF only, not OTF (opentype.js has no GPOS/kern writer).

## Projects / learning (live)
- Orbit — one idea through Form → Luma → StemDeck → ScenePilot with source files. https://thecreatingco.com/projects/orbit/
- After Hours — 8 captured project walkthroughs. https://thecreatingco.com/after-hours/
- Learn — 43 guided lessons in the real editors. https://thecreatingco.com/learn/

Totals: 24 apps/tools. LIVE: 8 web apps + Glyph Studio + 13 new tools (ScenePilot: AutoCut, Captions, Board, Grade, Reframe; Sattari: Split, Key & BPM, Vox, Canvas, Pocket, Press; Luma: Mockup, Glyph). REVIEW: Cast (form-studio-review.netlify.app; form.thecreatingco.com is published via OpenAI Sites). Not released: Sattari Audio native suite.
