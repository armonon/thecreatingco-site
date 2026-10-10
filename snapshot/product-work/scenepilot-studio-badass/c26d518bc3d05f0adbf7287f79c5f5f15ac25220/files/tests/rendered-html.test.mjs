import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the ScenePilot Lite shell and Auto Director", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ScenePilot Lite/);
  assert.match(html, /BROWSER LITE/);
  assert.match(html, /Auto Cut/);
  assert.match(html, />Edit</);
  assert.match(html, /Motion/);
  assert.match(html, /Source \+ timeline/);
  assert.match(html, /Color/);
  assert.match(html, /Audio/);
  assert.match(html, /Deliver/);
  assert.match(html, /Motion[^<]*.*Desktop Pro/s);
  assert.match(html, /Render MP4/);
  assert.match(html, /Restore saved project/);
  assert.match(html, /AUTO DIRECTOR/);
  assert.match(html, /DROP VIDEO OR SONG/);
  assert.match(html, /Add media to get started/);
  assert.match(html, /Strobe light pattern/);
  assert.match(html, /Fine-tune editing rules/);
  assert.match(html, /Browser Lite renders H\.264 MP4/);
});

test("keeps the analysis, render, persistence, and standalone engines connected", async () => {
  const [page, analysis, renderEngine, compositor, preview, projectStore, layout, manifest, serviceWorker, desktop, releaseWorkflow, webEntry, siteConfig, renderClient, renderWorker, updateUtils] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/analysis-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/render-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/compositor.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/canvas-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/project-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../electron/main.js", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/release-macos.yml", import.meta.url), "utf8"),
    readFile(new URL("../webdev/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../vite.site.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/render-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/render.worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../electron/update-utils.js", import.meta.url), "utf8"),
  ]);
  const editorComponents = await Promise.all([
    "sequence-inspector.tsx", "use-editor-edit-actions.ts", "editor-input-routing.ts",
    "analysis-progress-dock.tsx", "audio-mixer-sidebar.tsx", "auto-director-section-editor.tsx", "auto-director-workspace.tsx", "composition-properties.tsx", "composition-timeline.tsx", "delivery-workspace.tsx", "editor-foundation.ts", "media-browser.tsx", "roto-subject-panel.tsx", "source-program-monitor.tsx", "studio-topbar.tsx", "timeline-ruler-lanes.tsx", "timeline-toolbar.tsx", "use-editor-keyboard-shortcuts.ts", "video-delivery.ts",
  ].map((file) => readFile(new URL(`../app/${file}`, import.meta.url), "utf8")));
  const editorSource = [page, ...editorComponents].join("\n");
  assert.match(editorSource, /renderProject\(/);
  assert.match(editorSource, /saveProject</);
  assert.match(editorSource, /analysisAbortRef\.current\?\.abort/);
  assert.match(analysis, /sourceStart/);
  assert.match(analysis, /signal\?\.throwIfAborted/);
  assert.match(analysis, /buildDirectedPlacements/);
  assert.match(analysis, /pattern === "build"/);
  assert.match(editorSource, /tapTempo/);
  assert.match(editorSource, /beatOffset/);
  assert.match(editorSource, /accept="video\/\*,audio\/\*"/);
  assert.match(editorSource, /analysis-dock-track/);
  assert.match(editorSource, /formatWait\(eta\)/);
  assert.match(editorSource, /11 \/ REFINE CUT/);
  assert.match(editorSource, /Analyze again & generate draft/);
  assert.match(editorSource, /composeDirector\(analysis, nextSections, beats\)/);
  assert.match(editorSource, /mergeDirectedSectionPlacements\(items, rebuiltSection, selectedSectionId, preserveManualClips\)/);
  assert.match(editorSource, /event\.currentTarget\.value = ""/);
  assert.match(editorSource, /pendingSourceUrlRef/);
  assert.match(editorSource, /type ClipTrack =/);
  assert.match(editorSource, /dropOnClipTrack/);
  assert.match(editorSource, /clip-track-lane/);
  assert.match(editorSource, /Track FX/);
  assert.match(editorSource, /tracks: clipTracks/);
  assert.match(analysis, /new VideoSampleSink\(track\)/);
  assert.match(analysis, /await import\("mediabunny"\)/, "media decoders load only when analysis starts");
  assert.match(webEntry, /lazy\(\(\) => import\("\.\.\/app\/page"\)\)/, "the browser editor loads behind a lightweight shell");
  assert.match(analysis, /Audio source ready; building a visual canvas/);
  assert.match(renderEngine, /new Mp4OutputFormat/);
  assert.match(editorSource, /backgroundDirectWrite = proDirectWrite && workerDirectDiskSupported/);
  assert.doesNotMatch(editorSource, /mixedAudio\.length === 0/, "multi-track audio no longer blocks worker rendering");
  assert.match(editorSource, /new TransformStream<StreamTargetChunk, StreamTargetChunk>/);
  assert.match(renderClient, /worker\.postMessage\(request, outputStream \? \[outputStream\] : \[\]\)/);
  assert.match(renderWorker, /Omit<RenderOptions, "signal" \| "onProgress">/);
  assert.match(renderEngine, /openPcmAudioMix\(audioClips, duration, inputs, signal\)/);
  assert.match(renderEngine, /for await \(const sample of pcmMix\.samples/);
  assert.match(renderEngine, /new AudioSampleSource/);
  assert.match(renderEngine, /createRenderTrackMetadata\(duration, fps, audioSampleRate\)/);
  assert.match(renderEngine, /addVideoTrack\(videoSource, trackMetadata\.video\)/);
  assert.match(renderEngine, /addAudioTrack\(audioSource, trackMetadata\.audio\)/);
  assert.match(renderEngine, /if \(mainInput && !mainVideoTrack && !audioTrack\)/);
  assert.match(renderEngine, /mainVideoTrack \?/);
  // Montage, camera motion, film grade, and cut transitions stay wired end to end.
  assert.match(editorSource, /buildBaseSequence\(/);
  assert.match(editorSource, /baseCuts: montageEnabled \? baseCuts : \[\]/);
  assert.match(editorSource, /motion: renderMotion\(\)/);
  assert.match(editorSource, /transition: TRANSITION_PRESETS\[transitionType\]/);
  assert.match(editorSource, /transitionConfigForCut\(baseCuts/);
  assert.match(editorSource, /clip-transition/);
  assert.match(editorSource, /Incoming transition/);
  assert.match(editorSource, /splitVideoTrackClip/);
  assert.match(editorSource, /Stacked video clip/);
  assert.match(editorSource, /video-trim-handle/);
  assert.match(editorSource, /Rate Stretch/);
  assert.match(editorSource, /rateStretchCut\(/);
  assert.match(editorSource, /fit to fill at/);
  assert.match(editorSource, /GRADE_PRESETS\[lookPreset\]/);
  assert.match(editorSource, /Color room/);
  assert.match(editorSource, /Quick balance/);
  assert.match(editorSource, /setGradeClipboard/);
  assert.match(editorSource, /Audio mixer/);
  assert.match(editorSource, /duckOtherAudioUnderSelection/);
  assert.match(editorSource, /automation: \[/, "auto duck writes real volume automation into the project");
  assert.match(editorSource, /DELIVERY REVIEW/);
  assert.match(editorSource, /PREFLIGHT/);
  assert.match(editorSource, /4K Master/);
  assert.match(editorSource, /deliveryHasSequence/);
  assert.match(editorSource, /EDIT_STYLES\.map/);
  assert.match(renderEngine, /const montage = !transparent && baseCuts\.length > 0/);
  assert.match(renderEngine, /gradePass\.render\(/);
  assert.match(renderEngine, /gradePass\?\.dispose\(\)/);

  // Preview and export share one frame model — this is the WYSIWYG guarantee.
  // The renderer must not re-derive layout; it only resolves decoded sources.
  assert.match(renderEngine, /computeFramePlan\(\{/);
  assert.match(renderEngine, /paintFramePlan\(context, plan, width, height/);
  assert.match(compositor, /export function computeFramePlan/);
  assert.match(compositor, /beatPunchScale\(time, motion\.beats/);
  assert.match(compositor, /transitionAtCut\(time, baseCuts\[activeIndex\]\.start, activeIndex/);
  assert.doesNotMatch(compositor, /transitionAt\(time, baseCuts\.map/, "frame planning must not allocate every cut start per frame");
  assert.match(renderEngine, /prepareFramePlanContext\(/);
  assert.match(preview, /prepareFramePlanContext\(/);
  assert.match(compositor, /sourceTimeForCut\(cut, sourceClock\)/);
  assert.match(compositor, /globalCompositeOperation = layer\.blend/);
  assert.doesNotMatch(renderEngine, /globalCompositeOperation/, "renderer must not paint layers itself");

  // The live preview is the canvas compositor, not the old DOM/CSS layers.
  assert.match(editorSource, /CanvasPreview/);
  assert.doesNotMatch(editorSource, /effect-preview/, "DOM effect layers are retired");
  assert.match(preview, /computeFramePlan\(\{/);
  assert.match(preview, /paintFramePlan\(context, plan, renderWidth, renderHeight/);

  // Streamed sources report an unknown duration; we must measure it rather than
  // fall back to a hardcoded length and analyze minutes of a seconds-long file.
  assert.match(editorSource, /durationchange/);
  assert.doesNotMatch(editorSource, /probe\.duration > 0 \? probe\.duration : 180/, "no hardcoded duration fallback");
  assert.match(compositor, /track\?\.blend === "normal"/);
  assert.match(compositor, /hue-rotate/);
  assert.match(compositor, /track\?\.fadeIn/);
  assert.match(projectStore, /indexedDB\.open/);
  assert.match(editorSource, /StandaloneRuntime/);
  assert.match(editorSource, /pendingSidecarFrames\.length >= 24/, "active roto bakes checkpoint pixel mattes before completion");
  assert.match(editorSource, /Accept current matte/, "uncertain and recovered roto frames have an explicit review workflow");
  assert.match(editorSource, /nextRotoReviewFrame/, "roto review navigation is connected to the editor playhead");
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.equal(JSON.parse(manifest).start_url, "/app/");
  // One worker for the editor and the film tools; see docs/pwa.md.
  assert.match(serviceWorker, /const PREFIX = "scenepilot-"/);
  assert.match(serviceWorker, /APP_ROOTS = \["\/app\/", "\/tools\/"\]/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.match(serviceWorker, /cache\.match\(pageKey\(url\.pathname\)\) \|\| await cache\.match\(shellFor/);
  assert.equal(serviceWorker.match(/skipWaiting\(\)/g)?.length, 1, "only the user-approved SKIP_WAITING message activates a new version");
  assert.match(serviceWorker, /event\.data\.type === "SKIP_WAITING"\) self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /if \(url\.origin !== self\.location\.origin\) return;/, "cross-origin requests are never cached (suite kit excepted)");
  assert.equal(JSON.parse(manifest).name, "ScenePilot");
  assert.equal(JSON.parse(manifest).scope, "/");
  assert.match(siteConfig, /const standaloneAssets = \[/);
  assert.match(siteConfig, /"sw\.js"/);
  assert.match(siteConfig, /path\.join\(siteRoot, asset\)/);
  assert.match(desktop, /checkForUpdates/);
  assert.match(updateUtils, /scenepilot-releases\/releases\/latest/);
  assert.match(desktop, /downloadURL/);
  assert.match(desktop, /loadFile\(DESKTOP_ENTRY\)/);
  assert.match(desktop, /preload: path\.join\(__dirname, "preload\.cjs"\)/);
  assert.match(desktop, /scenepilot:create-proxy/);
  assert.match(desktop, /render-preferences\.json/);
  assert.match(desktop, /scenepilot:reveal-output/);
  assert.match(desktop, /webContents\.send\("scenepilot:action"/);
  assert.doesNotMatch(desktop, /executeJavaScript/, "desktop commands must use the isolated preload bridge");
  assert.match(desktop, /verifyFileDigest/);
  assert.match(desktop, /Auto Edit/);
  assert.match(desktop, /sendEditorAction\("color"\)/);
  assert.match(desktop, /sendEditorAction\("audio"\)/);
  assert.match(desktop, /sendEditorAction\("deliver"\)/);
  assert.match(desktop, /Rate Stretch Tool/);
  assert.match(desktop, /sendEditorAction\("tool-rate"\)/);
  assert.match(releaseWorkflow, /gh release create/);
});
