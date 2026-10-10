# Launch content pack — 2026-10-05

Status: **DRAFT. Nothing here is published.** No owned social accounts are connected yet; publish only after accounts are connected and Armon says go (DIRECTIVE Phase 1). Emails are blocked until there is a postal address in BRAND.md and access to the Netlify Forms list.

Sources: PRODUCTS.md, BRAND.md, AUDIENCES.md, research/site-brief-2026-10-05.md, plus pages fetched today: /after-hours/, /projects/orbit/, /kickstarter/, /about/, /products/{form,luma,stemdeck,scenepilot}/, /learn/, /learn/form/architecture/. Every claim below traces to PRODUCTS.md (see §8). Where I quote the site directly, it's in quotes.

Primary CTA everywhere: **Try the free web alpha, then join the launch list (free, not a pledge) at thecreatingco.com.**

---

## 0. Before anyone posts: read this first

### Things I noticed on the site today (deltas from PRODUCTS.md)
1. **App URLs changed.** The site now links branded subdomains, and all four return 200: `https://form.thecreatingco.com/studio`, `https://luma.thecreatingco.com/studio`, `https://stemdeck.thecreatingco.com/studio`, `https://scenepilot.thecreatingco.com/app/`. PRODUCTS.md still lists the older hosts. This pack uses the branded URLs. **PRODUCTS.md should be updated.**
2. **The About page was revised.** It now reads "Desktop in development. Mobile planned… No public native downloads are available yet." That fixes part of the contradiction in site-brief §5.4.
3. **After Hours StemDeck uses the "Earlier browser companion"** (the legacy four-deck mixer), not the current Sattari studio. Don't caption After Hours StemDeck stills as the current studio.
4. **AI-generated source art.** The After Hours Luma still life and the Ghost jacket references are labeled "AI-generated" on-site. Our audience is artists, so avoid those images as the hero of Luma ads. If they're used, carry the site's label.

### Non-negotiable caption rules (every piece)
- Say "web alpha" or "public alpha". Never "download", "app for Mac/iPhone", "works offline", or "on Windows".
- **StemDeck:** every StemDeck video carries the on-screen line "Prepared stems. StemDeck doesn't split any song you throw at it." Never target or imply "remove vocals from any song".
- **ScenePilot:** footage is a screen recording of the program monitor or timeline. Never say a film was "exported from / rendered by ScenePilot". Orbit's `orbit-preview.mp4` is "assembled with FFmpeg"; label it that way if it's shown as a finished film.
- **Form:** add the end-card fine print "Design study. Not manufacturing, fit or construction validation." For the house, use the site's own line: "Concept-design exercise. Not construction-ready or a code review."
- **Concept art** (`/assets/product-artwork/*`, `/assets/hero/creative-journey.mp4`) must carry the label "Concept artwork".
- **No** prices, subscription terms, Kickstarter dates, rewards, Founding Edition or "reserve your spot" language.
- **Banned words:** revolutionary, cutting-edge, game-changer, unlock, elevate, seamless, thrilled to announce, and fake urgency.

### Music and media rights (check before posting audio)
- **Safe:** the After Hours Evening Mix and the four original parts, plus the After Hours ScenePilot source clips (all "original").
- **Orbit soundtrack:** *Foolish Game* by snowflake (Levihica Remix), **CC BY 3.0**. It's usable, but every post must carry this credit: `Music: Foolish Game by snowflake (Levihica Remix), CC BY 3.0, ccmixter.org/files/Levihica/47591. Edited excerpt; no endorsement implied.`
- **Unknown licence, so [ARMON: confirm before social use]:**
  - the prepared song in StemDeck's "Shape the stems" lesson
  - the Sophie Sky / Roze footage in the ScenePilot lessons
  - the photo of the man in Luma's recolor lesson
  - Unsplash photo used in the ScenePilot colour demo: Johannes Mändle; credit it anyway.
- Do not add trending or licensed platform music over demos. The product's own audio is the soundtrack.

### Measurement reality
There are no site analytics, and launch-list signups sit in Netlify Forms without source data. Until that changes, **signups can't be attributed to a post**. Here is how each test is judged:
- **Hook winner:** lowest swipe-away or skip in the first 2–3 s, compared **on the same platform**. Use YouTube Shorts "viewed vs. swiped away", Instagram skip rate, or the TikTok retention curve at 2–3 s.
- **Body winner:** average % watched.
- **Business signal:** link-in-bio or link clicks, plus qualified comments (people asking how to try it or describing their own project).
- **Treat early numbers as directional.** New accounts give noisy samples, so only compare variants after each has 500+ views.
- **Asks for Armon (site change, needs approval):**
  - add a hidden `source` field, or `?ref=` capture, to the founding-list form
  - or enable Netlify Analytics
  - then use one `?ref=` link per piece (e.g. `thecreatingco.com/?ref=tt-form-a`)

---

## 0.5 Universal screen-recording spec (Armon)

- **Setup:**
  - Record on a Mac in the browser you normally test with, and note browser and version in the capture log.
  - Use a clean profile: no bookmarks bar, no extension icons, zoom at 100%.
  - Turn on Do Not Disturb.
- **Resolution:**
  - Record at full Retina resolution, 60 fps, at least 2560 px wide. We'll punch in to 9:16 in the edit, so pixels matter. Every existing site video is about 1000 px wide and landscape.
  - Also try a tall, narrow browser window (about 1080 × 1350). If the app reflows usefully, record that too.
- **Audio** (StemDeck, ScenePilot, Orbit):
  - capture system audio. OBS (free) with macOS screen and audio capture works.
  - record no mic unless you're doing VO.
- **One action per clip.** Hold 2–3 s before and after each click or keystroke so we have room to cut.
- **One unbroken take of the whole flow** for every product. That lets us honestly caption "one take, real browser". The site's current launch "proofs" are stills held for 2 s each, so a live take is a step up in credibility.
- **Never edit UI or numbers in post.** If the app shows a different number from this pack (e.g. not 54 m² or not 104 BPM), keep the real one and tell me. I'll fix the script.
- **Capture log:** keep `content/capture-log.md` with date, URL, browser, any failures or glitches. Failures are content for the honest-alpha posts.

---

## 1. Four product short videos (9:16, 15–30 s)

### V1 — Form Studio: "One sentence moves a wall"
**Transformation (verified):** typing "Make the house 9 m wide" makes the solids rebuild, the footprint becomes 54 m², and the plan dimensions update (PRODUCTS.md demo hook; /learn/form/architecture/).
**Length:** about 24 s.

**Three opening hooks (first 2 s):**
- **A.** Extreme close-up on Form's text box as "Make the house 9 m wide" types out, then Enter. Caption: **"I typed one sentence into a CAD app."**
- **B.** Start on the result, the plan showing **54 m²**. Caption: **"This floor plan changed because of a sentence."** Then rewind-wipe to the before state.
- **C.** Call-out to the viewer, with the text box visible. VO and caption: **"Architecture students: you can type this."**

**Visual opening:** dark UI, cursor blinking in the command box, monospace text typing in sync with keyboard clicks. Hard cut on Enter to the 3D model rebuilding.

**Script / VO** (Armon's voice, or captions only):

| t | VO | On-screen caption |
|---|---|---|
| 0–2 | (hook) | (hook) |
| 2–5 | "This is Form Studio. It runs in a browser tab." | Form Studio · web alpha · no install |
| 5–9 | "Type what you want. Preview it." | PREVIEW |
| 9–13 | "Apply. The walls are exact solids, and they rebuild." | APPLY → solids rebuild |
| 13–17 | "The plan updates with them. Fifty-four square metres." | Footprint: 54 m² |
| 17–20 | "Rename the room. Still editable." | "Rename studio to My creative home" |
| 20–24 | "Keep the .form. Export the plan as DXF. Try the Studio House lesson free." | Free web alpha → thecreatingco.com |

**End card fine print:** "Concept-design exercise. Not construction-ready or a code review."

**Shot list:**
1. Close-up of the text box typing (0–2).
2. Wide 3D view, before (2–5).
3. Preview state, with the proposed edit highlighted (5–9).
4. Apply, then rebuild. Use a 1.2× slow push-in (9–13).
5. Plan view, punched in on the footprint and dimension labels (13–17).
6. Room label renamed (17–20).
7. Save `.form`, then the Export DXF dialog (20–22).
8. End card with logo and URL (22–24).

**Screen-recording requirements:**
- **Lesson:** Form → *Studio House* at `https://thecreatingco.com/learn/form/workshops/?lesson=architecture`. Use "Continue in full studio" (`https://form.thecreatingco.com/studio`) if the embedded editor is cramped.
- **Commands, typed exactly:**
  1. `Make the house 9 m wide`
  2. `Rename studio to My creative home`
- **Clips to capture:**
  - (a) 3D view before
  - (b) the preview state
  - (c) apply and rebuild, with the camera locked
  - (d) the same, with a slow orbit after the rebuild
  - (e) plan view showing the 54 m² footprint
  - (f) rename
  - (g) Save `.form` and Export plan as DXF
  - (h) one unbroken take of (a)–(g)
- **Bonus clip** (for X and a later cut): the After Hours clasp. Widen the outer width from 55 to 64 mm, then switch the finish from polished brass to brushed steel (After Hours "Form" walkthrough; `orbit-clasp.form` download).

**CTA:** "Try the Studio House lesson free in your browser → thecreatingco.com. Join the launch list. It's free, not a pledge."
**Platforms:** TikTok, Instagram Reels, YouTube Shorts; X native video.
**Audience:** architecture students and hobbyists, product and industrial design students, makers (AUDIENCES.md).
**Winner metric:** lowest swipe-away at 2 s (A vs B vs C, same platform), then average % watched. Business signal: link clicks and saves. Saves matter here because it's a tutorial-shaped piece.
**Pre-capture stand-in (existing assets):** `/assets/form-architecture/text-edit.jpg`, `/assets/form-architecture/house-plan.jpg`, `/assets/form-architecture/house-editor.jpg` (1280×720 stills of exactly this flow). They're good enough for an X post with images, not for the 9:16 video.

---

### V2 — Luma Studio: "Tap the shirt. Change the color."
**Transformation (verified):** Smart Select tap, refine the mask with Add/Remove, recolor. Lesson description: "Keep his face, arms, printed lettering and surroundings intact."
**Length:** about 20 s.

**Three opening hooks:**
- **A.** The same photo with the shirt flipping through three colours in 2 s, cut on the beat. Caption: **"One tap. Three shirts."**
- **B.** The cursor taps once and the mask overlay floods the shirt only. Caption: **"It found the shirt. Not the face. Not the lettering."** [Only use if the capture visibly shows that; otherwise use A.]
- **C.** VO and caption: **"Merch makers: recolor the shirt, not the whole photo."**

**Visual opening:** the original photo, a single click ripple on the shirt, the mask overlay appearing, then a snap to a new colour.

**Script / VO:**

| t | VO | Caption |
|---|---|---|
| 0–2 | (hook) | (hook) |
| 2–5 | "Luma Studio. A layered image editor in your browser." | Luma Studio · web alpha |
| 5–9 | "Tap the shirt with Smart Select." | SMART SELECT · 1 tap |
| 9–12 | "Tighten the edge. Add here, remove there." | ADD / REMOVE |
| 12–16 | "Recolor. Everything else stays put." | RECOLOR |
| 16–20 | "Keep the editable .luma. Export a PNG. First lesson's free in your browser." | thecreatingco.com |

**Shot list:**
1. Before photo (0–2).
2. Editor wide shot (2–5).
3. Tap and the mask overlay (5–9).
4. Add/Remove brush refinement, punched in at 200% (9–12).
5. Three colour takes cut together (12–16).
6. Before/after split, then Save `.luma` and Export PNG (16–20).

**Screen-recording requirements:**
- **Lesson:** Luma → *"Select his shirt. Change its color."* at `https://thecreatingco.com/learn/luma/workshops/?workshop=recolor` (full studio: `https://luma.thecreatingco.com/studio`).
- **Clips to capture:**
  - (a) the untouched photo
  - (b) the Smart Select tap, with the mask preview visible
  - (c) Add and Remove refinement on one edge
  - (d) recolor to **three** distinct colours, one clip each
  - (e) Save `.luma` and Export PNG
  - (f) one unbroken take
- **Rights:** confirm we can publish the lesson photo. **Preferred:** shoot your own photo of a person in a printed tee (with consent) and use "Use my own media", which is real footage and rights-clean. [ARMON: add detail — whose shirt and photo]
- **Alt concept (second Luma video, same specs):** *"Make type weave through an image."* at `https://thecreatingco.com/learn/luma/workshops/?workshop=weave`. Write behind the model, then reveal a letter through the subject mask. Hook: **"Put the headline behind them."**

**CTA:** "Try it free in your browser → thecreatingco.com."
**Platforms:** Instagram Reels (primary: designers and photographers), TikTok, YouTube Shorts, X.
**Audience:** merch and album-art makers, designers, photographers, people leaving Adobe subscriptions (AUDIENCES.md). Don't name competitors in captions.
**Winner metric:** 2-s skip rate (A vs C is the real test: visual vs call-out), then average % watched. Business signal: link clicks and saves.
**Caution:** don't call Smart Select "AI generation" or claim it runs on-device. Hosted generative edits are a separate feature that needs sign-in.

---

### V3 — StemDeck: "Press Play. Take the drums out."
**Transformation (verified):** in the current Sattari studio, press Play and take vocals or drums out of the mix live. This works with *prepared* stems only (PRODUCTS.md caveat).
**Length:** about 22 s. Sound-on piece.

**Three opening hooks:**
- **A.** The track is already playing. On a downbeat the cursor clicks DRUMS mute, the beat drops out, and a caption slams in: **"Drums: out."**
- **B.** Rapid toggles: full mix, no vocals, no drums, back to full. Caption: **"Same track. Three versions. Ten seconds."**
- **C.** Arranger open with a gap in the timeline. Caption: **"Bedroom DJs: build the break yourself."**

**Visual opening:** waveform and stem lanes moving. The mute button lights on the beat, and the caption hits as the audio changes.

**Script** (captions only, with no VO over music; the audio is the demo):

| t | Caption |
|---|---|
| 0–2 | (hook) |
| 2–5 | StemDeck · web alpha · press Play |
| 5–9 | VOCALS: OFF → ON |
| 9–13 | DRUMS: OFF … back on the drop |
| 13–17 | ARRANGE: cut a break, bring it back |
| 17–20 | Save a portable .sattari · export the mix |
| 20–22 | Prepared stems. StemDeck doesn't split any song you throw at it. → thecreatingco.com |

**Shot list:**
1. Mid-play stem lanes (0–2).
2. Perform view, wide (2–5).
3. Vocal mute and unmute, punched in on the lane controls (5–9).
4. Drum mute, then re-enter on the drop (9–13).
5. Arranger: split and cut clips to create a break (13–17).
6. Save `.sattari` and the export dialog (17–20).
7. Disclaimer end card (20–22).

**Screen-recording requirements:**
- **Lesson:** StemDeck → *Shape the stems* at `https://thecreatingco.com/learn/stemdeck/workshops/?lesson=stems`. Then *Arrange your own edit* at `https://thecreatingco.com/learn/stemdeck/workshops/?lesson=arrange`. Full studio: `https://stemdeck.thecreatingco.com/studio`.
- **Capture system audio** (see §0.5). Clips:
  - (a) 8 s of the full mix playing
  - (b) vocals out, then in
  - (c) drums out, then in on a phrase boundary
  - (d) arranger cut and break
  - (e) save `.sattari` and export the mixdown
  - (f) one unbroken take
- **Rights fallback:** if the "Shape the stems" song isn't cleared for social, load the Orbit session `https://thecreatingco.com/assets/orbit-story/orbit-sound.sattari` (126 BPM, 4 tracks, CC BY 3.0, needs the credit line). [ARMON: check whether the Orbit session has a vocal lane. If not, drop the vocal beat and keep "Drums: out."]
- **Do not use** After Hours StemDeck stills as "current studio" footage (they come from the earlier companion).

**CTA:** "Mix the prepared session free in your browser → thecreatingco.com."
**Platforms:** TikTok (primary), Instagram Reels, YouTube Shorts.
**Audience:** bedroom DJs, remixers, producers. **Not** "split any song" seekers. If comments ask "can it do any song?", answer plainly: no, prepared stems.
**Winner metric:** average % watched, which is the stronger signal for a sound-led piece. Use 2-s swipe-away as a tiebreak. Also track the share of comments asking about any-song separation; if it's high, the hook is attracting the wrong audience and loses even if views are high.

---

### V4 — ScenePilot: "104 BPM in. Ten cuts out."
**Transformation (verified):** AutoCut reads the soundtrack at 104 BPM and builds ten cuts (After Hours: ten master clips plus five overlays). Then every Zoom transition is swapped for a 0.30 s Dissolve.
**Length:** about 22 s.

**Three opening hooks:**
- **A.** An empty timeline, a click on AutoCut, and the timeline fills. Caption: **"104 BPM in. Ten cuts out."**
- **B.** The program monitor mid-playback, cuts landing on the beat. Caption: **"The soundtrack placed these cuts."**
- **C.** Caption: **"Still cutting on the beat by hand?"** Then a hard cut to the AutoCut click.

**Visual opening:** three clip thumbnails and a waveform sitting in the bin. One click, and the clips cascade onto the timeline in rhythm.

**Script / VO:**

| t | VO | Caption |
|---|---|---|
| 0–2 | (hook) | (hook) |
| 2–5 | "ScenePilot. Three clips, one 18-second soundtrack." | ScenePilot Browser Lite · web alpha |
| 5–9 | "AutoCut reads the track: 104 BPM. First cut, done." | AutoCut · 104 BPM · 10 cuts |
| 9–14 | (let it play, cuts on beat) | Every shot stays editable |
| 14–18 | "Swap every Zoom for a 0.30-second Dissolve." | Zoom → Dissolve 0.30 s · all cuts |
| 18–22 | "Save, reload, it's all still there. Try it free in your browser." | thecreatingco.com |

**Shot list:**
1. Bin with three clips and the WAV (0–2 or 2–5).
2. AutoCut click and the analysis result on screen (5–9).
3. Program monitor playback, with the timeline below (9–14).
4. Transition panel: Zoom to Dissolve 0.30 s, apply to all (14–18).
5. Reload and "Restore saved project" (18–20).
6. End card (20–22).

**Screen-recording requirements:**
- **App:** ScenePilot Browser Lite at `https://scenepilot.thecreatingco.com/app/`.
- **Media:** download and unzip the After Hours source bundle at `https://thecreatingco.com/assets/after-hours/outputs/after-hours-scene-sources.zip` (three original 5-s clips plus the 18-s StemDeck mix; rights-clean).
- **Steps, matching the After Hours walkthrough:**
  1. Import the 3 clips and the WAV.
  2. Cinematic mode AutoCut. Confirm the readout says 104 BPM and count the master clips (10) and overlays (5).
  3. Play the program monitor through once.
  4. Change the incoming transition from Zoom to a 0.30 s Dissolve and apply it to every master edit.
  5. Save, reload, and use Restore saved project.
  6. Capture each step as its own clip, plus one unbroken take, with system audio.
- **Optional, and stronger for creators:** the same flow with your own phone clips and a track you own. [ARMON: add detail — what you'd shoot]
- **Do not** caption any footage as a ScenePilot export. If you try MP4 export and it works, note it in the capture log. We'll add the claim only after PRODUCTS.md is updated.

**CTA:** "Make your first cut free in your browser → thecreatingco.com."
**Platforms:** TikTok, YouTube Shorts (primary: editors), Instagram Reels, X.
**Audience:** music-video editors, beat-sync edit creators, musicians making visualizers.
**Winner metric:** 2-s swipe-away (A vs C), then average % watched. Business signal: link clicks plus comments describing the commenter's own footage.
**Existing-asset alternate opener:** the Punch Contrast before/after (`/assets/scenepilot-color/original.jpg` → `/assets/scenepilot-color/fx-contrast-100.jpg`). These are real ScenePilot renders, credited "Photo: Johannes Mändle / Unsplash", and work as a 1-s slider wipe.

---

## 2. Orbit cross-suite: "This started as a 32 mm ring" (9:16, 35–40 s)

**Transformation (verified):**
- Form pendant (32 mm × 2.4 mm)
- Luma poster (13 editable layers, 2 artboards)
- StemDeck session (126 BPM, 4 tracks)
- ScenePilot 23-s cut map

These are "portable file handoffs, not automatic cross-app synchronization."

**Three opening hooks:**
- **A.** A slow push on the pendant render. Caption: **"This started as a 32 mm ring."**
- **B.** Four frames flashing on the beat (pendant, poster, waveform, film frame). Caption: **"One pendant. Four apps. One film."**
- **C.** Open on the final film frame, then a rewind effect. Caption: **"Rewind. It was a pendant."**

**Visual opening:** black, then the Orbit pendant fades up as the first phrase of the Orbit soundtrack hits.

**Script / captions** (Orbit WAV as the bed; optional VO):

| t | VO | Caption |
|---|---|---|
| 0–3 | (hook) | (hook) |
| 3–10 | "Form Studio. A pendant, 32 millimetres, 2.4 deep. Exact CAD." | 01 FORM · 32 mm · 2.4 mm |
| 10–17 | "Luma Studio. The render becomes a poster: 13 editable layers, two artboards." | 02 LUMA · 13 layers · 2 artboards |
| 17–24 | "StemDeck. Four stems, 126 BPM. An opening, a drop, a return." | 03 STEMDECK · 126 BPM |
| 24–33 | "ScenePilot. Three clips, one soundtrack, a 23-second cut." | 04 SCENEPILOT · 23 s |
| 33–38 | "Every source file is free to download. Take it somewhere else." | Portable files, not auto-sync · thecreatingco.com/projects/orbit/ |

**Pinned or first-comment credit:** `Music: Foolish Game by snowflake (Levihica Remix), CC BY 3.0, ccmixter.org/files/Levihica/47591. Edited excerpt; no endorsement implied. Pendant image: Blender render of Form geometry. Film preview assembled with FFmpeg.`

**Shot list:**
1. Pendant render push-in (0–3).
2. Form editor with the pendant: change the diameter, then switch back (3–10).
3. Luma with the poster document: toggle layers on/off to show the build, then flip to the square artboard (10–17).
4. StemDeck arrangement playing at 126 BPM, the drum-break region highlighted (17–24).
5. ScenePilot with the cut map imported and relinked, timeline playing (24–33).
6. Grid of all four outputs plus the URL (33–38).

**v0 (ship before any capture, from existing assets).** Reframe each into 9:16 with blurred-fill backgrounds:
- `https://thecreatingco.com/assets/orbit-story/orbit-object.jpg` (Blender render, label it)
- `https://thecreatingco.com/assets/orbit-story/orbit-poster.png` (1200×1500)
- `https://thecreatingco.com/assets/orbit-story/orbit-social.png` (1200×1200)
- `https://thecreatingco.com/assets/orbit-story/orbit-sound-studio.jpg`
- `https://thecreatingco.com/assets/orbit-story/orbit-preview.mp4` (1280×720, 23 s; label "assembled with FFmpeg")
- `https://thecreatingco.com/assets/orbit-story/orbit-sound.wav`
- `https://thecreatingco.com/assets/form-jewelry/orbit-form-model.jpg`

**v1 (real capture):**
- **Download** `https://thecreatingco.com/assets/orbit-story/orbit-complete-project.zip` (23.2 MB).
- **Form:** open `orbit-pendant.form` in the Jewelry lesson `https://thecreatingco.com/learn/form/workshops/?lesson=jewelry` and capture "Change the pendant's diameter and keep the editable object".
- **Luma:** open `orbit-artwork.luma` at `https://luma.thecreatingco.com/studio`. Capture layer toggles and the artboard switch.
- **StemDeck:** open `orbit-sound.sattari` at `https://stemdeck.thecreatingco.com/studio`. Capture playback through the drum break, with system audio.
- **ScenePilot:** import `orbit-film.scenepilot.json` at `https://scenepilot.thecreatingco.com/app/`, relink the three MP4s and the WAV, and play the timeline.
- Record one clip per app, each 6–10 s, plus the relink moment. That moment is honest proof of "portable files".

**CTA:** "Download the whole project, free. Make your version → thecreatingco.com/projects/orbit/"
**Platforms:** Instagram Reels (primary), TikTok, YouTube Shorts, X (also as a 4-image post).
**Audience:** multidisciplinary creators, art students, educators.
**Winner metric:** average % watched (it's the longest piece, so completion is the test) and shares/sends. Business signal: link clicks to /projects/orbit/. Comparing hooks A vs B on Reels tells us whether "origin story" or "list of four" holds better.

---

## 3. Founder piece: one story, three formats

Built only on the site's About page ("Our story" and "A note from Armon"). Anything personal beyond that is marked **[ARMON: add detail]**.

### 3a. Reel script (9:16, about 40 s; Armon to camera, real footage)

**Hooks (pick one):**
- **A.** Armon to camera, tight framing: **"A missed bill shouldn't mean a missed idea."**
- **B.** Rapid text flashes on the beat, "After Effects. Photoshop. FL Studio. Blender. Cinema 4D. djay Pro. Ableton.", then Armon: **"I used all of them. Then I started building."**
- **C.** **"Creativity shouldn't have an off switch."** Spoken, then a lamp clicks off and back on.

**Script:**
> (0–3) [Hook]
> (3–9) "I've used computers my whole life. After Effects, Photoshop, FL Studio, Blender, Cinema 4D, then djay Pro and Ableton."
> (9–14) "I learned a lot of them deeply. And I kept noticing the features I wished they had." [ARMON: add detail — one feature you kept wishing for]
> (14–20) "The same friction kept showing up. Subscriptions. Unreliable connections. Workflows that interrupted the idea." [ARMON: add detail — a real moment this cost you a project, if you want to share one]
> (20–25) "A missed bill shouldn't mean a missed idea. So I started building."
> (25–31) B-roll of four screens (the V1–V4 captures): "Form for 3D. Luma for images. StemDeck for sound. ScenePilot for film. In your browser, right now."
> (31–36) "It's alpha. The ambition is real. So are the rough edges."
> (36–40) "Try one. Tell us what broke. Link's on our page."

**Captions:** burn in the full text. Key words get weight: *off switch*, *missed bill*, *missed idea*, *rough edges*.

**Shot list:**
1. Armon at his desk, eye level, natural light, phone vertical 4K (hook and 3–25).
2. Close-up of hands on keyboard (cutaway at 9–14).
3. Four 2-s screen-capture cutaways (25–31).
4. Back to camera (31–40).

**Real footage needed:** all of the Armon-on-camera material. Optionally, his old project files or apps on screen [ARMON: add detail — only if real].

**CTA:** "Try the free web alpha. Join the launch list. Free, not a pledge."
**Platforms:** Instagram Reels, TikTok, YouTube Shorts.
**Audience:** creators broadly, and anyone tired of subscriptions.
**Winner metric:** average % watched, follows from the post, and comments that tell their own subscription or friction story (qualified resonance).

**Honesty note.** Don't say or imply "works offline" or "no subscriptions, ever". Use the site's line "Lite will always remain free and fully capable" if pricing comes up. Nothing else about pricing has been announced.

### 3b. X thread (6 posts)

> **1/** A missed bill shouldn't mean a missed idea. Losing a connection shouldn't mean losing momentum.
>
> That's the short version of why we're building thecreateco. The longer one:

> **2/** I've used computers my whole life. After Effects, Photoshop, FL Studio, Blender, Cinema 4D, then djay Pro and Ableton.
>
> I learned a lot of them deeply. And I kept noticing the features I wished they had.

> **3/** The same friction kept showing up: subscriptions, unreliable connections, workflows that interrupted the idea. [ARMON: add detail]
>
> Eventually I realized I could build the tools I wanted. So I went all in.

> **4/** Today: eight public tools that run in your browser.
>
> Form Studio for 3D/CAD. Luma Studio for layered images. StemDeck for mixing prepared stems. ScenePilot for beat-aware first cuts. Plus Ghost Studio, Librarian, Reclaim and Bounce.

> **5/** Honest status: it's alpha. No public native downloads yet, and the web apps need a connection to load.
>
> Our public promise: Lite will always remain free and fully capable.
>
> The ambition is real. So are the rough edges.

> **6/** Try one real project and tell us what broke. Launch list is free and not a pledge:
> thecreatingco.com

### 3c. Blog intro (300 words)

Hosting: **the site has no blog.** Options are a new /journal/ page on thecreatingco.com, armonnasiri.com, or an external newsletter platform. [ARMON: choose.]

> **A missed bill shouldn't mean a missed idea**
>
> I've used computers my whole life. Different creative phases took me through After Effects, Photoshop, FL Studio, Blender and Cinema 4D, then djay Pro and Ableton. Different tools for different ways of making.
>
> I learned a lot of those apps deeply. The deeper I went, the more I noticed the features I wished they had: the things that would make creating easier, more powerful or more open. [ARMON: add detail — one feature you kept wishing for, and in which app.]
>
> Over years of making images, music, films and 3D work, the same friction kept showing up. Subscriptions. Unreliable connections. Workflows that interrupted the idea. [ARMON: add detail — a moment this happened to you, if you want to share it.]
>
> That's the part I couldn't let go of. A missed bill shouldn't mean a missed idea. Losing a connection shouldn't mean losing momentum. Artists should have more control over the tools they depend on.
>
> At some point I realized this was something I could build myself, so I went all in. I build it with Jensen Westerlund, who focuses on design and creative tools. Together we call ourselves a group of artists and tech nerds building the tools we want to make art with.
>
> Here's where it stands today. There are eight public tools you can open in a browser tab: Form Studio for 3D, Luma Studio for images, StemDeck for sound, ScenePilot for film, plus four smaller apps. They're alpha. Some features are unfinished, the web editions still need a connection to load, and there are no public native downloads yet. We'd rather tell you that up front.
>
> What we can promise is the principle we're building toward. Lite will always remain free and fully capable, a complete place to create, finish and keep your work.
>
> The ambition is real. So are the rough edges. Here's what we're working on next, and how you can help shape it.

(About 300 words; the last line leads into the body. The body should cover the NOW / BEFORE THE CAMPAIGN / IF FUNDED roadmap from /kickstarter/, framed as "proposed, not promised".)

---

## 4. Ten standalone X posts (each ≤ 260 characters, 0 hashtags)

Character counts were checked by script. Attach the listed media.

1. **Demo · Form** (media: `text-edit.jpg` + `house-plan.jpg`)
   > Typed "Make the house 9 m wide" into Form Studio. The solids rebuilt, the footprint became 54 m², and the plan updated with it.
   >
   > Free web alpha, Studio House lesson: thecreatingco.com

2. **Demo · Luma** (media: V2 clip, or `/assets/luma-workshops/recolor-example.jpg`)
   > Tap the shirt. Refine the mask. Recolor it.
   >
   > That's the first lesson in Luma Studio, a layered image editor that runs in your browser. About five minutes.
   >
   > thecreatingco.com

3. **Demo · StemDeck, honest** (media: V3 clip)
   > Press Play. Take the drums out. Bring them back on the drop.
   >
   > StemDeck works with prepared stems. It won't split any song you throw at it, and we'd rather say that up front.
   >
   > thecreatingco.com

4. **Demo · ScenePilot** (media: `scenepilot-02-first-cut.png` → `scenepilot-03-dissolves.png`, or the V4 clip)
   > An 18-second soundtrack in. ScenePilot read it at 104 BPM and built ten cuts. Then we swapped every Zoom for a 0.30 s Dissolve.
   >
   > Browser Lite, public alpha: thecreatingco.com

5. **Behind the scenes · Orbit** (media: 4 images, Orbit object/poster/sound-studio/social)
   > One idea, four apps: a 32 mm pendant in Form, a 13-layer poster in Luma, a 126 BPM session in StemDeck, a 23-second cut map in ScenePilot.
   >
   > Every source file is downloadable: thecreatingco.com/projects/orbit/

6. **Behind the scenes · candour** (media: `form-01-proportions.png`)
   > One of our demo pages says "the starter's optional fillet failed and was suppressed."
   >
   > We left that in. We'd rather show you the rough edge than a perfect screenshot. Public alpha means exactly that.

7. **Honest alpha**
   > What our web apps don't do yet: public native downloads, Windows, guaranteed offline.
   >
   > What they do: 3D/CAD, layered images, stem mixing, beat-aware first cuts. In a browser tab, free to try.
   >
   > thecreatingco.com

8. **Question to creators**
   > Creators: what's the one feature you wish your main app had?
   >
   > Not a whole new app. One feature.
   >
   > Asking because that exact itch is how thecreateco started.

9. **Question to creators**
   > Honest question for people who make things: has a lapsed subscription or a dropped connection ever stopped a project mid-idea?
   >
   > What did you do?

10. **Founder line** (media: `/assets/team/armon-nasiri.jpg` or none)
    > A missed bill shouldn't mean a missed idea. Losing a connection shouldn't mean losing momentum.
    >
    > That's why we started building thecreateco. The alphas are rough. Come break them: thecreatingco.com

Reply rule for posts 8 and 9: answer people individually and genuinely. Don't drop a link in every reply.

---

## 5. Email

**Blockers:**
- No postal address in BRAND.md (CAN-SPAM needs it in commercial email).
- No access to the Netlify Forms list.
- The opt-out process must work. The site says removal goes through the privacy contact form, so **never write "unsubscribe here" or "unsubscribe anytime"**.

**Consent scope:** the form promised "the Kickstarter announcement, any Founding Edition details, new builds and major product updates". Keep nurture emails framed as builds and product updates, and low frequency.

### 5a. Welcome email (to people already on the list)

**Subject (A/B):**
- A: "You're on the list. Here's what's real today."
- B: "Thanks for joining. Start with one project."

**Preview text:** "No pledge, no price, no install. Just the tools."

> Hi,
>
> Thanks for joining the thecreateco launch list.
>
> A quick recap of what you signed up for: the Kickstarter announcement, any Founding Edition details, new builds and major product updates. Joining isn't a pledge, a purchase or a reserved reward. We haven't announced a campaign date, pricing or rewards yet. When we do, you'll hear it here.
>
> In the meantime, the tools are already open. Eight of them run in your browser with no install. If you only try one, pick the one closest to what you make:
>
> - **3D:** type "Make the house 9 m wide" in Form Studio's Studio House lesson → https://thecreatingco.com/learn/form/workshops/?lesson=architecture
> - **Images:** tap a shirt with Smart Select in Luma Studio and recolor it → https://thecreatingco.com/learn/luma/workshops/?workshop=recolor
> - **Sound:** press Play in StemDeck and take the drums out of a prepared mix → https://thecreatingco.com/learn/stemdeck/workshops/?lesson=stems
> - **Film:** let ScenePilot build a beat-aware first cut → https://thecreatingco.com/learn/scenepilot/workshops/?workshop=autocut
>
> They're alpha, so some things will break. When they do, we want to know what you were making, what you expected, what happened, and which device you used. Tell us here: https://thecreatingco.com/testing/#feedback, or just reply.
>
> The ambition is real. So are the rough edges. Thanks for helping us find them.
>
> Armon
> thecreateco · https://thecreatingco.com
>
> ---
> You're getting this because you joined the thecreateco launch list at thecreatingco.com.
> To leave the list, reply "leave" or use the privacy contact form at https://thecreatingco.com/testing/.
> [POSTAL ADDRESS — required before sending]

[ARMON: confirm (1) replies to hello@ are read, and (2) "reply leave" removals will be handled manually within 10 business days, as CAN-SPAM requires. Then log them in DO_NOT_CONTACT.md.]

### 5b. Three-email nurture outline

| # | When | Subject idea | Content | CTA | Success metric |
|---|---|---|---|---|---|
| N1 | Day 4 after welcome (or one-time for the existing list) | "One pendant, four apps" | Orbit: pendant → poster → soundtrack → film. Use 4 images from Orbit with real specs (32 mm, 13 layers, 126 BPM, 23 s). State plainly: "portable files, not automatic sync." Include the CC BY credit. | Download the whole project (23.2 MB) → /projects/orbit/ | Click-through to Orbit; replies or "Share your version" submissions |
| N2 | Day 11 | "What broke this week" | Honest alpha update. One real fix or change Armon shipped [ARMON: add a real shipped change; skip the email if there isn't one]. One known limitation stated plainly. Ask: "What were you trying to make?" | Feedback form /testing/#feedback | Reply rate and feedback submissions (the best qualified-user signal we have) |
| N3 | Day 21 | "Why we're building this" | Founder story (the 3c intro, condensed), Lite promise quoted from the site, and the /kickstarter/ roadmap: NOW (use the alphas) → BEFORE THE CAMPAIGN (publish goal, rewards, platforms, risks) → IF FUNDED. Explicitly: no dates, no prices yet. | Try one lesson; reply with the feature you wish existed | Replies; lesson clicks |

Rules: plain text or very light HTML; one link-heavy section at most. Never mention Kickstarter timing, price, rewards or "founding" perks beyond "details will come to this list".

---

## 6. Two-week content calendar

Assumes Day 1 is the first Monday after accounts are connected and Armon says go (e.g. Mon 12 Oct 2026). **TT** = TikTok, **IG** = Instagram Reels, **YT** = YouTube Shorts.

**Week 1** front-loads pieces built from existing assets while Armon captures. Week 2 runs the captured demos and the second hooks.

**Capture order for Armon (needed before Day 3):** V1 Form → V4 ScenePilot → V2 Luma → V3 StemDeck → founder camera footage → Orbit v1.

| Day | Short video (TT / IG / YT) | X | Email / other | Dependency |
|---|---|---|---|---|
| D1 Mon | **Orbit v0**, hook A (existing assets) | Founder thread (3b) | | Assets only |
| D2 Tue | — | X #1 Form (stills) | **Welcome email** (5a) if unblocked | Postal address + list access |
| D3 Wed | **V1 Form**, hook A | V1 clip as native video | | V1 capture |
| D4 Thu | — | X #8 (question) | | — |
| D5 Fri | **V4 ScenePilot**, hook A | X #4 ScenePilot | | V4 capture |
| D6 Sat | — | X #6 (candour) | | — |
| D7 Sun | Reply to comments; log Week 1 numbers in EXPERIMENTS.md | X #9 (question) | | — |
| D8 Mon | **V2 Luma**, hook A | X #2 Luma | N1 Orbit email (to existing list) | V2 capture; rights check |
| D9 Tue | **Founder Reel**, hook A | X #10 founder line | Blog intro published (3c) | Armon footage; blog home chosen |
| D10 Wed | **V3 StemDeck**, hook A (TT first) | X #3 StemDeck | | V3 capture; music rights |
| D11 Thu | **V1 Form**, hook B (same body; hook test on the same platforms) | X #7 honest alpha | | — |
| D12 Fri | **Orbit v1** (real capture), hook B | X #5 Orbit | | Orbit capture |
| D13 Sat | **V4 ScenePilot**, hook C | — | | — |
| D14 Sun | Review: pick hook winners per product (≥500 views per variant, otherwise call it inconclusive); write LEARNINGS.md; plan Week 3 around the winners | — | N2 drafted (only if there's a real shipped change) | — |

Posting notes:
- Same video on TT, IG and YT on the same day is fine. Hook comparisons are made **within** a platform, never across.
- IG captions: two short lines plus the CTA. Credits go in the caption or first comment.
- X: native video, never a link-only post for demos.
- Respond to every genuine comment within 24 h. If someone asks about price, a date or Windows, answer with the site's own words ("not announced", "being assessed").

---

## 7. Asset inventory: existing vs. needs real footage

### Usable now from the site (all return HTTP 200 as of 2026-10-05)
Every video asset is landscape, around 1000 px wide, so use them for X, as stills, or reframed with a blurred background. They aren't a substitute for 9:16 capture.

| Piece | Asset URL | Notes |
|---|---|---|
| Form | https://thecreatingco.com/assets/form-architecture/text-edit.jpg · /house-plan.jpg · /house-editor.jpg | Stills of the "9 m wide" flow, 1280×720 |
| Form | https://thecreatingco.com/assets/after-hours/form-01-proportions.png … form-04-steel.png · /assets/after-hours/outputs/orbit-steel-render.png | Clasp 55 → 64 mm, brass vs steel |
| Form | https://thecreatingco.com/assets/launch/form-proof.mp4 | 8 s, 1000×562; **stills held 2 s, not a continuous recording** |
| Luma | https://thecreatingco.com/assets/luma-workshops/recolor-example.jpg · /weave-example.jpg · /visual-world-captures/weave.png | Lesson posters; recolor photo rights unconfirmed |
| Luma | https://thecreatingco.com/assets/after-hours/luma-before-tone.png · luma-03-tone.png · /outputs/after-hours-poster.png | Source art **AI-generated**, so label it |
| Luma | https://thecreatingco.com/assets/launch/luma-proof.mp4 | 8 s stills sequence |
| StemDeck | https://thecreatingco.com/assets/stemdeck-studio/stems-live.png · /arranger.png · /mixer.png | Current studio screenshots |
| StemDeck | https://thecreatingco.com/assets/after-hours/outputs/After-Hours-Evening-Mix.wav | Original audio, rights-clean; earlier companion |
| StemDeck | https://thecreatingco.com/assets/launch/stemdeck-proof.mp4 | 8 s stills sequence (earlier companion) |
| ScenePilot | https://thecreatingco.com/assets/after-hours/scenepilot-01-sources.png … scenepilot-04-restored.png | AutoCut / Dissolve flow |
| ScenePilot | https://thecreatingco.com/assets/scenepilot-color/original.jpg · /fx-contrast-100.jpg | Real ScenePilot renders; credit Unsplash photographer |
| ScenePilot | https://thecreatingco.com/assets/workflows/scenepilot-analysis.png · /scenepilot-timeline.png · /assets/launch/scenepilot-proof.mp4 | |
| ScenePilot | https://thecreatingco.com/assets/after-hours/outputs/after-hours-scene-sources.zip | Source media for V4 capture |
| Orbit | https://thecreatingco.com/assets/orbit-story/orbit-object.jpg · orbit-poster.png · orbit-social.png · orbit-sound-studio.jpg · orbit-sound.wav · orbit-preview.mp4 · orbit-complete-project.zip | Preview is **FFmpeg-assembled**; music CC BY 3.0 |
| Founder | https://thecreatingco.com/assets/team/armon-nasiri.jpg | Headshot |
| Brand | https://thecreatingco.com/assets/product-artwork/{form,luma,stemdeck,scenepilot}.png · /assets/hero/creative-journey.mp4 | **Concept artwork, so label it**; never present as UI |

### Requires real footage (Armon)
| Piece | What | Priority |
|---|---|---|
| V1 Form | Studio House text-command flow + DXF export, 60 fps Retina | **1** |
| V4 ScenePilot | AutoCut on the After Hours sources + Dissolve swap + restore, with audio | **2** |
| V2 Luma | Smart Select recolor (ideally your own shirt photo) | 3 |
| V3 StemDeck | Stem mutes + arranger break, with system audio; rights-cleared track | 4 |
| Founder Reel | Armon to camera, vertical 4K, about 3 min of raw material | 5 |
| Orbit v1 | One clip per app opening the Orbit files + the relink moment | 6 |

---

## 8. Claim trace (everything numeric or capability-based)

| Claim used | Source |
|---|---|
| "Make the house 9 m wide" → solids rebuild, 54 m², plan updates | PRODUCTS.md Form demo hook; /learn/form/architecture/ |
| .form save, DXF/STEP export | PRODUCTS.md Form ("exports STEP/STL/DXF, `.form`") |
| Clasp 55 → 64 mm, brass/steel | /after-hours/ Form (PRODUCTS.md demo hook: brass ↔ steel) |
| Smart Select tap, Add/Remove, recolor; .luma + PNG | PRODUCTS.md Luma (Smart Select, `.luma` + PNG/JPEG/WebP; demo hook) |
| Type weave through an image | PRODUCTS.md Luma demo hook; /learn/ lesson "weave" |
| Press Play, take vocals/drums out; prepared stems only | PRODUCTS.md StemDeck demo hook and caveat |
| Arranger, .sattari, mixdown | PRODUCTS.md StemDeck (multitrack arranger, mixdown, `.sattari`) |
| AutoCut 104 BPM, ten cuts, Zoom → 0.30 s Dissolve | PRODUCTS.md ScenePilot demo hook; /after-hours/ |
| Punch Contrast compare | PRODUCTS.md ScenePilot demo hook (11 color effects) |
| Orbit 32 mm / 2.4 mm, 13 layers / 2 artboards, 126 BPM / 4 stems, 23 s, 23.2 MB, not auto-sync | PRODUCTS.md §3 Orbit |
| Eight public tools, browser, public alpha, no public native downloads | PRODUCTS.md header + NEVER CLAIM |
| "Lite will always remain free and fully capable" | BRAND.md; /about/ (site brief §1) |
| Founder story lines | /about/ "Our story" + "A note from Armon" (site brief §1) |
| Web apps need a connection to load | Product pages: "Initial editor and example assets require a network connection"; NEVER CLAIM offline |
| Kickstarter roadmap NOW / BEFORE / IF FUNDED, no dates | Site brief §1; /kickstarter/ |
