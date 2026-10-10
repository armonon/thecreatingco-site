# thecreateco — Company Brief (source of truth for marketing)

Source: full crawl of https://thecreatingco.com (27 pages, text captured 2026-10-05; outbound links checked live the same day). Only states what the site says. Quotes are verbatim.

## 1. Company

**Who:** "We're a group of artists and tech nerds building the tools we want to make art with." Founder **Armon Nasiri** (armonnasiri.com); **Jensen Westerlund**, "Design & creative tools" (jensenwesterlund.com). Tagline: "Independent creative software for 3D, images, music, film—and whatever comes next." Footer: "For whatever you're into next."

**Story/mission:** "Creativity shouldn't have an off switch." Friction named: "subscriptions, unreliable connections and workflows that interrupted the idea." "A missed bill shouldn't mean a missed idea. Losing a connection shouldn't mean losing momentum." Goal: "a new generation of creative tools with freedom at the center." Founder note: "I wanted more. So I started building." (After Effects, Photoshop, FL Studio, Blender, Cinema 4D, djay Pro, Ableton.)

**Values:** creative freedom; accessibility ("powerful, accessible and a joy to use"); building in public with feedback ("The ambition is real. So are the rough edges."); careful honesty about limits (nearly every demo carries a caveat).

**Voice & tone:** short two-beat headlines, second person, warm, plain verbs. Examples: "Help us create." / "Create Unbound." / "Make a thing. Make some noise. Make it yours." / "Less friction. More form." / "Your footage. Your rhythm." / "Build. Test. Earn your trust." Copy pairs aspiration with candid scope notes; match that.

**Lite vs Pro:** "Lite will always remain free and fully capable—a complete place to create, finish and keep your work." "Our commitment: creative freedom, without a price of entry." Pro = "More depth. When you need it." — "deeper workflows for more demanding projects." No prices given.

**Platforms:** About says "Desktop now. Mobile on the way. We're rolling out Pro versions for Windows and Mac… bring our apps to iOS and Android." Same page: "Our public apps are still in alpha. Features, offline support and platform availability currently vary." (Conflicts with Downloads/Kickstarter — see §5.)

**Kickstarter status:** "Preparing for Kickstarter. Try the alpha today." No campaign link, date, goal or rewards: "this website is not collecting pledges." Proposed priorities (explicitly not commitments): 1 Reliability, 2 Native apps, 3 Cross-app workflows (Form/Luma/StemDeck/ScenePilot handoffs), 4 Platform access ("Assess Windows support"), 5 Documentation, 6 Community. Roadmap: NOW use alphas → BEFORE CAMPAIGN publish goal, rewards, platforms, scope, risks, delivery estimates → IF FUNDED prioritize dependable releases. "No delivery dates announced."

**Launch list ("Founding list"):** email + consent checkbox via Netlify Forms (ref `founding-list-v1`). Gets "the Kickstarter announcement, any Founding Edition details, new builds and major product updates." "Joining is free. It is not a pledge, purchase or reserved reward." No account, no self-service unsubscribe; removal is manual via the privacy contact form.

**Privacy highlights:** "Your files. Clear boundaries." Main site: no added analytics; hosted on Netlify. Learning workspaces and companions store work in browser (localStorage/IndexedDB); Reclaim/Bounce don't upload files for local operations. Browser storage "is not an account backup." Linked apps differ: Form optional online assets/sharing; Luma hosted generative edits send image content; Librarian AI sends questions/shelf context. Community ("NOW" sign-in): Supabase auth, Resend email, Cloudflare D1/R2, guest posting via 30-day cookie, images need sign-in, EXIF stripped; no automatic retention schedule. Remix submissions reviewed before publication.

**Contact/feedback:** no email address published. Floating "Feedback" form (no account; optional email), full support form at /testing/ (types: product feedback, help, privacy/deletion; no attachments; "Download a copy" option). Community board. "Response times may vary during alpha."

## 2. Products

Site counts: "Eight public tools. Four at the creative core." All eight: "Browser edition · Public alpha"; no public native downloads. Suite = "THECREATECO MOMENTIUM SUITE": "Form → Luma → StemDeck → ScenePilot. Follow one idea through four creative disciplines."

**Form Studio** — "Less friction. More form." 3D/CAD for architecture, products, jewelry, garments. Verified: parametric sketching, exact CAD + feature history, text commands ("Make the house 9 m wide"), design generators (rings, hardware, chains), mesh modeling/sculpt, modifiers, materials, experimental Fabric workspace (Pattern/Sew/Explore drape), exports STEP/STL/DXF, `.form`. Workflow: Start with a line → Give it dimension → Make it your own. 17 lessons. Status: "Public web beta" on product page, "Public alpha" elsewhere; Mac candidates notarized (Apple Silicon + Intel, Intel needs macOS 14+), not public. App: form-3d-studio.armonon.chatgpt.site/studio; info site form-studio-design.netlify.app. Caveats: "not certification for manufacturing, engineering or garment fit"; simulation "not physically validated sizing." **Demo hook:** type "Make the house 9 m wide" → solids rebuild, footprint becomes 54 m²; or clasp swapped polished brass ↔ brushed steel.

**Luma Studio** — "Your images. Your world." Local-first layered image editor (designers, photographers, merch/album art). Verified: layers/masks, Smart Select, 27 blend modes, 17 layer effects, 15 smart filters, 14 adjustment families, captured brushes, editable type/type-on-path, retouching, `.luma` + PNG/JPEG/WebP. Workflow: Start with what you have → Build the composition → Find the feeling. 14 lessons. Status: public web alpha; Mac candidate notarized, not public. App: luma-studio-app.netlify.app/studio. Caveats: hosted generative edits need sign-in and send image content; RAW/print features not all in browser; "PSD conversions have limits." **Demo hook:** "Tap the shirt with Smart Select… then recolor it"; or "Make type weave through an image."

**StemDeck** (a.k.a. Sattari StemDeck / StemDeck Online on Sattari) — "Find the mix. Make the moment." Remix/performance studio for DJs/producers. Verified (online): Library/Perform/Arrange/Mixer views, stem lanes for prepared stems, crossfader, pads, Echo/Space, multitrack arranger, MIDI/piano roll, Sattari EQ/Comp/Echo/Space/Heat/Image, mic capture, mixdown, portable `.sattari` project. Workflow: Bring the music in → Find your balance → Make your own edit. 4 lessons. Status: public web testing; native candidate notarized, "licensing and product qualification remain." App: sattarimusic.com/studio (legacy site stemdeck-studio.netlify.app). Caveats: muting prepared stems "does not perform new AI separation on an arbitrary song"; "Arrangement playback is marked as a preview." **Demo hook:** "Press Play, then take vocals or drums out of the mix."

**ScenePilot** — "Your footage. Your rhythm. Your film." Beat-aware video editor. Verified (Browser Lite): media import, AutoCut beat-aware first cut, timeline trim/split, transitions, 11 color effects, blend modes (Screen/Multiply/Overlay), editable titles, cut-map JSON; target 1080p H.264. Pro (Electron/native) lists multitrack, motion, captions, 4K — not public. 8 lessons. Status: Browser Lite public alpha; native Apple Silicon preview only, "Intel is unqualified." App: scene-pilot.netlify.app/app/. Caveats: reference films "assembled with FFmpeg, not exported by ScenePilot." **Demo hook:** AutoCut reads the soundtrack (104 BPM) and builds ten cuts; swap Zoom for a 0.30-s Dissolve; or Punch Contrast slider compare.

**Ghost Studio** — "See your references in another dimension." Front/back garment photos → 3D garment/object study (fashion, product). Verified: reference pairing, background cleanup, silhouette/drape controls, mannequin/hanger, 13 object categories, GLB/PNG/ZIP export, `.ghostbatch`. 2 lessons. Status: public alpha; Mac candidate not public. App: ghost-garment-studio-lp.netlify.app. Caveat: "does not recover exact sewing patterns, measured fit, or unseen construction." **Demo hook:** two photos in, Natural → Relaxed silhouette, rotate to the back, export GLB.

**Librarian** — "Keep the ideas you want to return to." Book discovery + local PDF reader. Verified: 15 catalog integrations (Open Library, Gutenberg, LoC, etc.), dedup/ranking, personal shelf, PDF import, light/warm/dark reading, AI recommendations. 2 lessons. Status: public alpha; Mac candidate not public. App: librarian-atlas.netlify.app. Caveats: catalogs/AI need network; no built-in EPUB reader; records don't guarantee full text. **Demo hook:** switch a PDF spread light → dark, reload, shelf is still there.

**Reclaim** — "A little clarity for your files." Read-only browser file reviewer (native = Mac storage cleaner with quarantine/undo). Verified (web): select files/folder, SHA-256 content match, search/filter, JSON report, originals unchanged. 2 lessons. Status: public alpha; corrected universal installer notarized, older installer blocked. App: universal-computer-operator.netlify.app/browser/. Caveat: web "cannot scan your whole Mac, clear caches, quarantine or delete files." **Demo hook:** two differently named files flagged identical; two same-named notes.txt correctly *not* matched; "no files were deleted."

**Bounce** — "Your music. A little more feeling." Player for audio you own. Verified (browser): import files, queue reorder, search, bass/mid/treble EQ, saved local library, playlist export. Desktop/mobile features listed but not released. 3 EQ lessons. Status: public alpha; Mac candidate pending "JUCE distribution obligations." App: bounce-music-player.netlify.app/browser/. Caveats: no streaming catalog; mobile "not a publicly released iOS download." **Demo hook:** treble +4 dB, reorder, reload — order, name and EQ return.

**Sattari Audio** — "our native audio suite" (links sattari-audio-suite.netlify.app, "Six connected music products for Mac"). StemDeck runs on Sattari's studio; support form lists "Sattari Audio native suite." No further claims on-site.

## 3. Projects & learning

- **Orbit** (/projects/orbit/): "A pendant becomes a poster, a soundtrack, a film." Form pendant (32 mm, 2.4 mm) → Luma poster (13 layers, 2 artboards) → StemDeck session (126 BPM, 4 stems) → ScenePilot 23-s cut map. Full source bundle 23.2 MB. "Portable file handoffs, not automatic cross-app synchronization." Music: "Foolish Game" (Levihica remix), CC BY 3.0.
- **After Hours** (/after-hours/): "Eight projects. Thirty-two moments." One 4-step captured walkthrough per app (clasp, poster, 18-s evening mix, 18-s trailer, jacket, PDF library, duplicate review, playlist), each with downloads and candid notes.
- **Learn** (/learn/): "43 guided lessons in the real editors" (Form 17, Luma 14, StemDeck 4, ScenePilot 8), saved in-browser to "Your work." Deep pages: Form Architecture ("Your next space starts with a sentence"), Fashion (skirt/tee/dress drape, 7–10 min), Jewelry (Orbit pendant, 9 CAD sizes, DXF/STEP/STL), Luma Effects reference ("Know what changes the image").
- **Remix gallery:** share a remix; reviewed before publication.

## 4. Never claim

- Any public download (Mac, Windows, iPhone, iPad, Android). "There are no public Mac, iPhone or iPad downloads yet." "A browser edition is not an iOS app."
- Windows support or a Windows release (only "Assess Windows support").
- Universal offline use ("No universal offline… availability is being promised").
- Kickstarter is live, a date, goal, pledges, rewards, Founding Edition, pricing, subscription terms. Signup "does not reserve a price or entitlement."
- Notarization = quality/clearance ("Those checks do not establish product quality…").
- AI stem separation on any song (StemDeck); Pro editing features in Browser Lite; ScenePilot-rendered films; Mac cleaning/deletion via web Reclaim; streaming in Bounce; EPUB reading in Librarian.
- Manufacturing/fit/construction/code validation (Form, Ghost), lossless PSD round-trip (Luma).
- Self-service unsubscribe or automatic data deletion.

## 5. Site issues

1. **/community/** 308-redirects to /community, a JS-only app; crawl saw only "Open Community" and an unexplained "NOW sign-in". Nav "Community" links elsewhere: momentium-collaboration.armonon.chatgpt.site (titled "Community · Momentium"). Two different community destinations.
2. **Naming:** brand "thecreateco" vs domain thecreatingco.com; suite "THECREATECO MOMENTIUM SUITE" (likely meant "Momentum") vs "Creative Suite"; "NOW" never defined. StemDeck appears as StemDeck / Sattari StemDeck / StemDeck Online / StemDeck on Sattari. Librarian is "Librarian Atlas" in the support form.
3. **Third-party/odd app hosts:** Form app and Community on *.armonon.chatgpt.site; Reclaim on universal-computer-operator.netlify.app (old name); Librarian "website" link uses hashed deploy librarian-20da0a9c.netlify.app; all others on assorted *.netlify.app. Privacy lists "OpenAI hosting" without explanation.
4. **Contradictions:** About "Desktop now… rolling out Pro versions for Windows and Mac" vs no downloads and Windows only "assessed"; /testing/ "download a native edition where available" (none are); nav label "Downloads & availability" with no downloads; Form "Public web beta" vs "Public alpha"; privacy calls the four-deck StemDeck companion "retired" while the product page says it "remains," and home "Visit the original StemDeck site" points to it.
5. **Meta descriptions overpromise web editions:** Reclaim ("move selected files into a recoverable quarantine") and Bounce ("album browsing") describe native-only features. All /learn/* subpages share one identical description and near-identical content.
6. **Copy glitches:** stray "e." replacing the After Hours heading on /products/bounce/; ".," after the Reclaim and Bounce scope notes; double space on Librarian page; "Kickstarter ↗" external arrow points to an internal page.
7. **Not crawled:** /work/, /learn/*/workshops/, /learn/product-try/*.
