import { useCallback, useEffect, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import LayersPanel from "../components/LayersPanel";
import Timeline from "../components/Timeline";
import TweenPanel from "../components/TweenPanel";
import ExportPanel, { type ExportResult } from "../components/ExportPanel";
import { newProject, deserializeProject, serializeProject, projectFileName, type Project } from "../engine/project";
import { newLayer, ensureOwnCel, setCelAtFrame, type Layer } from "../engine/layers";
import { addPoint, newStroke, type StrokePoint } from "../engine/stroke";
import {
  setKeyframe as setKeyframeTrack,
  removeKeyframe as removeKeyframeTrack,
  type TweenableProp,
} from "../engine/tween";
import type { EasingId } from "../engine/easing";
import {
  addFrame,
  defaultTimeline,
  frameDurationMs,
  gotoFrame,
  nextPlaybackFrame,
  onionSkinFrames,
  removeFrame,
  type Fps,
  type OnionSkinSettings,
} from "../engine/timeline";
import { renderFrame, renderFrameToCanvas, syncReferenceVideos, clearReferenceVideos, dropLayerCanvas, type ActiveStrokePreview } from "../engine/render";
import { applyFillAtPoint } from "../lib/fill-tool";
import { autosaveProject, loadAutosavedProject } from "../lib/idb";
import { lockerApi, sendToScenePilot, useLocker, waitForLocker, launchedFromLocker, type LockerEntry } from "../lib/suite";
import { exportGif as encodeGifFile } from "../engine/export/gif";
import { exportVideo } from "../engine/export/video";
import { buildPngZip } from "../engine/export/png-zip";
import { computeGridLayout, buildSheetJson, composeSheet } from "../engine/export/spritesheet";
import { exportLottie as buildLottie } from "../engine/export/lottie";
import JSZip from "jszip";
import "../styles/studio.css";

type Tool = "brush" | "eraser" | "fill";

function initialProject(): Project {
  return newProject("Untitled animation");
}

export default function Studio() {
  const [project, setProject] = useState<Project>(initialProject);
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#1b1a22");
  const [brushSize, setBrushSize] = useState(8);
  const [selectedLayerId, setSelectedLayerId] = useState<string>(project.layers[0].id);
  const [playing, setPlaying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projectRef = useRef(project);
  const playingRef = useRef(false);
  const activeStrokeRef = useRef<ActiveStrokePreview | null>(null);
  const projectFileInput = useRef<HTMLInputElement>(null);
  const referenceFileInput = useRef<HTMLInputElement>(null);
  const locker = useLocker();

  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Rehydrate renderer-only video elements after any project load or layer change.
  useEffect(() => {
    syncReferenceVideos(project.layers);
  }, [project.layers]);

  useEffect(() => () => clearReferenceVideos(), []);

  // --- load: Locker onOpen (if launched with ?tcc-open=) or IndexedDB autosave ---
  const applyOpenedEntry = useCallback(async (entry: LockerEntry & { blob: Blob }) => {
    const isProject = entry.name.endsWith(".animate") || entry.type === "application/json";
    if (isProject) {
      const text = await entry.blob.text();
      const p = deserializeProject(text);
      setProject(p);
      setSelectedLayerId(p.layers[0]?.id ?? "");
      return;
    }
    const kind = entry.type.startsWith("video/") ? "video" : "image";
    const url = URL.createObjectURL(entry.blob);
    const layer: Layer = { ...newLayer(entry.name, "reference"), referenceSrc: url, referenceKind: kind };
    setProject((p) => ({ ...p, layers: [...p.layers, layer] }));
    setSelectedLayerId(layer.id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const api = await waitForLocker(3000);
      if (!cancelled) api?.onOpen((entry) => void applyOpenedEntry(entry));
    })();
    void (async () => {
      if (!launchedFromLocker()) {
        const json = await loadAutosavedProject();
        if (!cancelled && json) {
          try {
            const p = deserializeProject(json);
            setProject(p);
            setSelectedLayerId(p.layers[0]?.id ?? "");
          } catch {
            // ignore a corrupt autosave, keep the fresh project
          }
        }
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- autosave (debounced) ---
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void serializeProject(project).then(autosaveProject);
    }, 800);
    return () => clearTimeout(timer);
  }, [project, loaded]);

  // --- continuous render + playback loop ---
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (playingRef.current) {
        acc += dt;
        const p = projectRef.current;
        const frameMs = frameDurationMs(p.timeline.fps);
        let steps = 0;
        while (acc >= frameMs && steps < 8) {
          acc -= frameMs;
          steps++;
          const next = nextPlaybackFrame(p.timeline);
          if (next === p.timeline.currentFrame) {
            playingRef.current = false;
            setPlaying(false);
          } else {
            setProject((cur) => ({ ...cur, timeline: gotoFrame(cur.timeline, next) }));
          }
        }
      }
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        const p = projectRef.current;
        renderFrame(ctx, p, p.timeline.currentFrame, {
          onionSkin: onionSkinFrames(p.timeline),
          activeStroke: activeStrokeRef.current ?? undefined,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const currentLayer = useCallback(
    () => project.layers.find((l) => l.id === selectedLayerId) ?? project.layers[0],
    [project, selectedLayerId],
  );

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  function commitStroke(layerId: string, stroke: ReturnType<typeof newStroke>) {
    setProject((p) => {
      const frame = p.timeline.currentFrame;
      const layers = p.layers.map((l) => {
        if (l.id !== layerId) return l;
        const withCel = ensureOwnCel(l, frame);
        const cel = withCel.cels[frame];
        return setCelAtFrame(withCel, frame, { ...cel, strokes: [...cel.strokes, stroke] });
      });
      return { ...p, layers, updatedAt: Date.now() };
    });
  }

  async function doFill(point: StrokePoint) {
    const layer = currentLayer();
    if (!layer || layer.kind !== "draw" || layer.locked) return;
    const frame = project.timeline.currentFrame;
    const withCel = ensureOwnCel(layer, frame);
    const cel = withCel.cels[frame];
    const fillDataUrl = await applyFillAtPoint(cel, project.width, project.height, point.x, point.y, color);
    setProject((p) => ({
      ...p,
      layers: p.layers.map((l) => (l.id !== layer.id ? l : setCelAtFrame(withCel, frame, { ...cel, fillDataUrl }))),
    }));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const layer = currentLayer();
    if (!layer || layer.kind !== "draw" || layer.locked) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    if (tool === "fill") {
      void doFill(pt);
      return;
    }
    const stroke = addPoint(newStroke(color, brushSize, tool === "eraser"), pt);
    activeStrokeRef.current = { layerId: layer.id, stroke };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) return;
    const pt = getCanvasPoint(e);
    activeStrokeRef.current = { ...activeStrokeRef.current, stroke: addPoint(activeStrokeRef.current.stroke, pt) };
  }

  function onPointerUp() {
    const active = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (active && active.stroke.points.length > 0) commitStroke(active.layerId, active.stroke);
  }

  // --- layers ---
  function addDrawLayer() {
    const layer = newLayer(`Layer ${project.layers.length + 1}`);
    setProject((p) => ({ ...p, layers: [...p.layers, layer] }));
    setSelectedLayerId(layer.id);
  }

  function importReference() {
    referenceFileInput.current?.click();
  }

  function onReferenceFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const url = URL.createObjectURL(file);
    const layer: Layer = { ...newLayer(file.name, "reference"), referenceSrc: url, referenceKind: kind };
    setProject((p) => ({ ...p, layers: [...p.layers, layer] }));
    setSelectedLayerId(layer.id);
  }

  function toggleVisible(id: string) {
    setProject((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) }));
  }
  function toggleLocked(id: string) {
    setProject((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)) }));
  }
  function renameLayer(id: string, name: string) {
    setProject((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, name } : l)) }));
  }
  function removeLayer(id: string) {
    dropLayerCanvas(id);
    setProject((p) => {
      const layers = p.layers.filter((l) => l.id !== id);
      return { ...p, layers: layers.length ? layers : [newLayer("Layer 1")] };
    });
  }

  // --- tweens ---
  function setKeyframe(prop: TweenableProp, value: number, easing: EasingId) {
    const frame = project.timeline.currentFrame;
    setProject((p) => ({
      ...p,
      layers: p.layers.map((l) =>
        l.id !== selectedLayerId ? l : { ...l, tweens: { ...l.tweens, [prop]: setKeyframeTrack(l.tweens[prop] ?? [], { frame, value, easing }) } },
      ),
    }));
  }
  function removeKeyframe(prop: TweenableProp) {
    const frame = project.timeline.currentFrame;
    setProject((p) => ({
      ...p,
      layers: p.layers.map((l) => (l.id !== selectedLayerId ? l : { ...l, tweens: { ...l.tweens, [prop]: removeKeyframeTrack(l.tweens[prop] ?? [], frame) } })),
    }));
  }

  // --- timeline ---
  const setTimeline = (fn: (t: Project["timeline"]) => Project["timeline"]) => setProject((p) => ({ ...p, timeline: fn(p.timeline) }));

  // --- project file ops ---
  async function saveProjectFile() {
    const json = await serializeProject(project);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = projectFileName(project);
    a.click();
    URL.revokeObjectURL(url);
  }
  function openProjectFile() {
    projectFileInput.current?.click();
  }
  function onProjectFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void file.text().then((text) => {
      try {
        const p = deserializeProject(text);
        setProject(p);
        setSelectedLayerId(p.layers[0]?.id ?? "");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Couldn't open that file.");
      }
    });
  }
  function saveProjectToLocker() {
    const api = lockerApi();
    if (!api) return;
    void serializeProject(project).then((json) => {
      const blob = new Blob([json], { type: "application/json" });
      void api.save({ name: projectFileName(project), type: "application/json", blob }).catch((err) => alert(err.message));
    });
  }

  // --- export helpers ---
  function renderAllFrames(): HTMLCanvasElement[] {
    const frames: HTMLCanvasElement[] = [];
    for (let f = 0; f < project.timeline.frameCount; f++) frames.push(renderFrameToCanvas(project, f));
    return frames;
  }

  async function runExport(label: string, fn: () => Promise<ExportResult>) {
    setExportBusy(label);
    try {
      setLastResult(await fn());
    } catch (err) {
      alert(err instanceof Error ? err.message : `Export failed: ${label}`);
    } finally {
      setExportBusy(null);
    }
  }

  const exportGif = () =>
    runExport("GIF", async () => {
      const bytes = await encodeGifFile(project.timeline.frameCount, project.timeline.fps, (f) => {
        const canvas = renderFrameToCanvas(project, f);
        const ctx = canvas.getContext("2d")!;
        const id = ctx.getImageData(0, 0, project.width, project.height);
        return { data: id.data, width: project.width, height: project.height };
      });
      return { label: "GIF", blob: new Blob([bytes as unknown as BlobPart], { type: "image/gif" }), filename: `${project.name}.gif`, mimeType: "image/gif" };
    });

  const exportVideoFormat = (format: "mp4" | "webm") =>
    runExport(format.toUpperCase(), async () => {
      const canvas = document.createElement("canvas");
      canvas.width = project.width;
      canvas.height = project.height;
      const ctx = canvas.getContext("2d")!;
      const result = await exportVideo(canvas, (f) => renderFrame(ctx, project, f), project.timeline.frameCount, project.timeline.fps, format);
      return {
        label: format.toUpperCase(),
        blob: result.blob,
        filename: `${project.name}.${format}`,
        mimeType: result.mimeType,
        note: result.method === "mediarecorder" ? "Encoded with MediaRecorder (WebCodecs unavailable in this browser)." : undefined,
      };
    });

  const exportPngZip = () =>
    runExport("PNG sequence", async () => {
      const canvases = renderAllFrames();
      const blobs = await Promise.all(canvases.map((c) => new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), "image/png"))));
      const zip = await buildPngZip(blobs, project.name.replace(/\s+/g, "-").toLowerCase());
      return { label: "PNG sequence", blob: zip, filename: `${project.name}-frames.zip`, mimeType: "application/zip" };
    });

  const exportSpriteSheet = () =>
    runExport("sprite sheet", async () => {
      const canvases = renderAllFrames();
      const layout = computeGridLayout(project.timeline.frameCount, project.width, project.height);
      const sheet = composeSheet(layout, canvases);
      const sheetBlob = await new Promise<Blob>((resolve) => sheet.toBlob((b) => resolve(b!), "image/png"));
      const json = buildSheetJson(layout, project.timeline.fps, project.name.replace(/\s+/g, "-").toLowerCase());
      const zip = new JSZip();
      zip.file("sheet.png", sheetBlob);
      zip.file("sheet.json", JSON.stringify(json, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      return { label: "sprite sheet", blob, filename: `${project.name}-spritesheet.zip`, mimeType: "application/zip" };
    });

  const exportLottieFile = () =>
    runExport("Lottie", async () => {
      const { json, exportedLayers, skippedLayers } = buildLottie(project);
      if (!json) {
        throw new Error(
          skippedLayers.length
            ? `No layer could export to Lottie: ${skippedLayers.map((s) => `${s.name} (${s.reason})`).join("; ")}.`
            : "No layers to export.",
        );
      }
      const note =
        skippedLayers.length > 0
          ? `Exported ${exportedLayers.join(", ")}. Skipped (not vector/tween-only): ${skippedLayers.map((s) => s.name).join(", ")}.`
          : `Exported ${exportedLayers.join(", ")}.`;
      return { label: "Lottie", blob: new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }), filename: `${project.name}.lottie.json`, mimeType: "application/json", note };
    });

  function onSaveExportToLocker(result: ExportResult) {
    const api = lockerApi();
    if (!api) return;
    void api.save({ name: result.filename, type: result.mimeType, blob: result.blob }).catch((err) => alert(err.message));
  }
  function onSendExportToScenePilot(result: ExportResult) {
    void sendToScenePilot({ name: result.filename, type: result.mimeType, blob: result.blob }).catch((err) => alert(err.message));
  }

  function patchOnion(patch: Partial<OnionSkinSettings>) {
    setTimeline((t) => ({ ...t, onionSkin: { ...t.onionSkin, ...patch } }));
  }

  return (
    <div className="studio">
      <SiteHeader />
      <div className="studio-toolbar">
        <div className="tool-group" role="group" aria-label="Drawing tool">
          <button type="button" data-testid="tool-brush" className={tool === "brush" ? "active" : ""} onClick={() => setTool("brush")}>
            Brush
          </button>
          <button type="button" data-testid="tool-eraser" className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")}>
            Eraser
          </button>
          <button type="button" data-testid="tool-fill" className={tool === "fill" ? "active" : ""} onClick={() => setTool("fill")}>
            Fill
          </button>
        </div>
        <label className="tool-color">
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className="tool-size">
          Size
          <input type="range" min={1} max={60} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
          <span>{brushSize}px</span>
        </label>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
          aria-label="Project name"
        />
        <div className="file-actions">
          <button type="button" onClick={() => setProject(initialProject())}>
            New
          </button>
          <button type="button" onClick={openProjectFile}>
            Open
          </button>
          <button type="button" onClick={saveProjectFile}>
            Save .animate
          </button>
          {locker && (
            <button type="button" onClick={saveProjectToLocker}>
              Save project to Locker
            </button>
          )}
          <button type="button" className="btn-export" data-testid="open-export" onClick={() => setExportOpen(true)}>
            Export…
          </button>
        </div>
      </div>

      <div className="studio-main">
        <LayersPanel
          layers={project.layers}
          selectedId={selectedLayerId}
          onSelect={setSelectedLayerId}
          onToggleVisible={toggleVisible}
          onToggleLocked={toggleLocked}
          onRename={renameLayer}
          onAddLayer={addDrawLayer}
          onImportReference={importReference}
          onRemoveLayer={removeLayer}
        />

        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            data-testid="studio-canvas"
            width={project.width}
            height={project.height}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <TweenPanel layer={currentLayer()} frame={project.timeline.currentFrame} onSetKeyframe={setKeyframe} onRemoveKeyframe={removeKeyframe} />
      </div>

      <Timeline
        timeline={project.timeline}
        playing={playing}
        onGoto={(f) => setTimeline((t) => gotoFrame(t, f))}
        onAddFrame={() => setTimeline(addFrame)}
        onRemoveFrame={(f) => setTimeline((t) => removeFrame(t, f))}
        onSetFps={(fps: Fps) => setTimeline((t) => ({ ...t, fps }))}
        onToggleLoop={() => setTimeline((t) => ({ ...t, loop: !t.loop }))}
        onTogglePlay={() => setPlaying((v) => !v)}
        onSetOnion={patchOnion}
      />

      <ExportPanel
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        busy={exportBusy}
        lastResult={lastResult}
        onExportGif={exportGif}
        onExportMp4={() => exportVideoFormat("mp4")}
        onExportWebm={() => exportVideoFormat("webm")}
        onExportPngZip={exportPngZip}
        onExportSpriteSheet={exportSpriteSheet}
        onExportLottie={exportLottieFile}
        onSaveToLocker={onSaveExportToLocker}
        onSendToScenePilot={onSendExportToScenePilot}
        lockerAvailable={!!locker}
      />

      <input ref={projectFileInput} type="file" accept=".animate,application/json" hidden onChange={onProjectFileChosen} />
      <input ref={referenceFileInput} type="file" accept="image/*,video/*" hidden onChange={onReferenceFileChosen} />
    </div>
  );
}
