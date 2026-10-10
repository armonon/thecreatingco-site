import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, Download, FileJson, Loader2, Pause, Play, Plus, Trash2, Upload } from "lucide-react";
import { CURRENT_CUT_FILE_VERSION, CUT_FILE_FORMAT, DEFAULT_EFFECTS } from "../../../lib/project-store.ts";
import { applyManualOverrides, buildCameraPath, type PathPoint, type SubjectTarget } from "../../../lib/reframe-path.ts";
import { createAnalysisCoordinator } from "../../../lib/reframe-lifecycle.ts";
import { createReframeSession, parseReframeSession, reframeSessionMatchesMedia } from "../../../lib/reframe-session.ts";
import { sha256Blob } from "../../../lib/sha256-file.ts";
import { REFRAME_ASPECT_IDS, type ReframeAspectId } from "../../../lib/reframe-crop.ts";
import { ToolShell, baseName, downloadFile } from "../shell.tsx";
import { analyzeVideo } from "./analyze.ts";
import { createFaceFinder, type FaceFinder } from "../autocut/faces.ts";
import { ReframePlayer, type LetterboxSegment } from "./player.ts";
import { pathToJson, renderReframe, type RenderResult } from "./render.ts";
import { ReframeTimeline } from "./timeline.tsx";
import "../tools.css";

const LIMITS = [
  "Subject tracking is per-frame, not real tracking: it re-detects faces on each sampled frame (about 6/s) and falls back to a simple motion-saliency centroid when no face is found. A subject that moves fast between samples, turns away, or is small/backlit can be lost; the camera then drifts toward whatever has the most frame-to-frame motion instead.",
  "Face detection reuses AutoCut's self-hosted BlazeFace (Google, Apache-2.0) — the same model, same on-device run, same graceful “no faces” fallback if it can't load.",
  "Multiple-subject mode keeps the two most prominent faces together only when they both fit inside the crop at the current aspect; with three or more faces it only ever considers the two largest, and a third subject can be left out of frame entirely.",
  "Scene-cut detection is the same histogram/motion-spike heuristic AutoCut uses for clip analysis — tuned for hard cuts, not whip pans, dissolves, or flashes, any of which can be misread as a cut (snapping the crop) or missed (causing a pan across a real cut).",
  "The camera path only ever pans and re-centres; it never zooms. A subject that moves toward or away from the camera can still leave a tight crop.",
  "Manual keyframe overrides are pins at a point in time, not editable curves — drag a dot to move the crop there, double-click to remove it. There's no keyframe easing control beyond the global dead zone / speed settings.",
  "Letterbox ranges are entered as start/end times, not drawn on the timeline by dragging a selection.",
  "Video export uses WebCodecs when this browser can encode it (MP4 H.264/AAC, otherwise WebM); without a WebCodecs encoder it falls back to a real-time MediaRecorder capture (WebM only, takes as long as the clip, and the tab must stay visible).",
  "“Open in AutoCut” / “Open in editor” just open that tool in a new tab — they don't carry the file over automatically. Drop the exported clip in yourself (editor hand-off also downloads a .scenepilot.json; use New project with this clip as the main media, then Import cut).",
  "Alpha: tested so far on short, ffmpeg-generated synthetic clips (a moving bright square, a synthetic face image), not on a broad range of real footage.",
];

const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;

function reframeToCutFile(options: { name: string; duration: number; exportName: string }) {
  return {
    format: CUT_FILE_FORMAT,
    version: CURRENT_CUT_FILE_VERSION,
    project: options.name || "Reframe",
    duration: Math.max(1, options.duration),
    bpm: 120,
    beatOffset: 0,
    beats: [] as number[],
    sections: [] as unknown[],
    videoClips: [] as unknown[],
    placements: [] as unknown[],
    compositions: [] as unknown[],
    tracks: [] as unknown[],
    baseCuts: [] as unknown[],
    titles: [] as unknown[],
    assets: [] as unknown[],
    effects: DEFAULT_EFFECTS,
    mainAsset: { name: options.exportName, kind: "video" as const },
    savedAt: Date.now(),
  };
}

function ReframeApp() {
  const [file, setFile] = useState<File | null>(null);
  const [aspect, setAspect] = useState<ReframeAspectId>("9:16");
  const [useFaces, setUseFaces] = useState(true);
  const [deadZone, setDeadZone] = useState(0.08);
  const [maxPanSpeed, setMaxPanSpeed] = useState(0.6);
  const [ease, setEase] = useState(0.35);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [autoTargets, setAutoTargets] = useState<SubjectTarget[]>([]);
  const [cutTimes, setCutTimes] = useState<number[]>([]);
  const [overrides, setOverrides] = useState<SubjectTarget[]>([]);
  const [letterboxSegments, setLetterboxSegments] = useState<LetterboxSegment[]>([]);
  const [duration, setDuration] = useState(0);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState({ text: "Drop a horizontal video to start.", error: false });
  const [rendering, setRendering] = useState<{ fraction: number; message: string } | null>(null);
  const [result, setResult] = useState<(RenderResult & { url: string; name: string }) | null>(null);
  const [usedFaces, setUsedFaces] = useState(false);

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<ReframePlayer | null>(null);
  const faceFinderRef = useRef<Promise<FaceFinder | null> | null>(null);
  const analysisCoordinatorRef = useRef(createAnalysisCoordinator());
  const renderGenerationRef = useRef(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const sessionInput = useRef<HTMLInputElement | null>(null);
  const currentFileRef = useRef<File | null>(file);

  // One PathPoint path combines the automatic targets (smoothed) with manual pins.
  const path: PathPoint[] = useMemo(() => {
    if (!autoTargets.length) return [];
    const base = buildCameraPath(autoTargets, { deadZone, maxPanSpeed, ease, cutTimes });
    return applyManualOverrides(base, overrides);
  }, [autoTargets, cutTimes, overrides, deadZone, maxPanSpeed, ease]);

  useEffect(() => {
    currentFileRef.current = file;
    if (!file || !sourceCanvasRef.current || !outputCanvasRef.current) return;
    let player = playerRef.current;
    if (!player) {
      player = new ReframePlayer(sourceCanvasRef.current, outputCanvasRef.current);
      player.onTime = setTime;
      player.onEnded = () => setPlaying(false);
      playerRef.current = player;
    }
    const loadedFile = file;
    void player.load(loadedFile).catch((error) => {
      if (playerRef.current === player && currentFileRef.current === loadedFile && !String(error?.message ?? error).includes("superseded")) {
        setStatus({ text: String(error instanceof Error ? error.message : error), error: true });
      }
    });
  }, [file]);

  useEffect(() => () => playerRef.current?.dispose(), []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.path = path;
    player.aspect = aspect;
    player.letterboxSegments = letterboxSegments;
    void player.drawStill();
  }, [path, aspect, letterboxSegments]);

  useEffect(() => {
    renderGenerationRef.current++;
  }, [file, path, aspect, letterboxSegments]);

  const invalidateRender = () => {
    renderGenerationRef.current++;
    setRendering(null);
    setResult((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return null;
    });
  };

  const getFaceFinder = useCallback(async (enabled: boolean): Promise<FaceFinder | null> => {
    if (!enabled) return null;
    faceFinderRef.current ??= createFaceFinder().catch((error) => {
      console.warn("Face model unavailable, falling back to motion saliency.", error);
      return null;
    });
    return faceFinderRef.current;
  }, []);

  const analyzeLoadedFile = useCallback(async (incoming: File, facesEnabled: boolean) => {
    invalidateRender();
    setAnalyzing(true);
    setAnalyzeProgress(0);
    await analysisCoordinatorRef.current.run(async (signal, progress) => {
      const faces = await getFaceFinder(facesEnabled);
      return analyzeVideo(incoming, { faces, onProgress: (p) => progress(p.fraction), signal });
    }, {
      progress: setAnalyzeProgress,
      result: (analysis) => {
      setDuration(analysis.duration);
      setSourceSize({ width: analysis.width, height: analysis.height });
      setCutTimes(analysis.cutTimes);
      setUsedFaces(analysis.usedFaces);
      setAutoTargets(analysis.targets);
      const coverage = Math.round(analysis.faceCoverage * 100);
      setStatus({
        text: analysis.usedFaces
          ? `Analysed: faces found on ${coverage}% of sampled frames, ${analysis.cutTimes.length} scene cut${analysis.cutTimes.length === 1 ? "" : "s"} detected.`
          : `Analysed: no faces found — following motion instead. ${analysis.cutTimes.length} scene cut${analysis.cutTimes.length === 1 ? "" : "s"} detected.`,
        error: false,
      });
      },
      error: (error) => setStatus({ text: error instanceof Error ? error.message : "Could not analyse this video.", error: true }),
      finally: () => setAnalyzing(false),
    });
  }, [getFaceFinder]);

  const loadFile = useCallback(async (incoming: File) => {
    invalidateRender();
    analysisCoordinatorRef.current.begin();
    setFile(incoming);
    setResult(null);
    setOverrides([]);
    setLetterboxSegments([]);
    setAutoTargets([]);
    setCutTimes([]);
    setDuration(0);
    setSourceSize({ width: 0, height: 0 });
    setStatus({ text: `Loaded ${incoming.name}. Analysing…`, error: false });
    await analyzeLoadedFile(incoming, useFaces);
  }, [analyzeLoadedFile, useFaces]);

  const toggleFaces = (enabled: boolean) => {
    setUseFaces(enabled);
    if (file) void analyzeLoadedFile(file, enabled);
  };

  const onPickFiles = (list: FileList | null) => {
    const picked = list?.[0];
    if (picked) void loadFile(picked);
  };

  const togglePlay = async () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) { player.pause(); setPlaying(false); }
    else { await player.play(); setPlaying(true); }
  };

  const seek = (target: number) => { void playerRef.current?.seek(target); };

  const addLetterboxSegment = () => {
    invalidateRender();
    const start = Math.max(0, time - 1);
    const end = Math.min(duration || time + 1, time + 1);
    setLetterboxSegments((current) => [...current, { start, end }].sort((a, b) => a.start - b.start));
  };
  const updateSegment = (index: number, field: "start" | "end", value: number) => {
    invalidateRender();
    setLetterboxSegments((current) => current.map((segment, i) => (i === index ? { ...segment, [field]: value } : segment)));
  };
  const removeSegment = (index: number) => { invalidateRender(); setLetterboxSegments((current) => current.filter((_, i) => i !== index)); };

  const onOverride = (overrideTime: number, x: number, y: number) => {
    invalidateRender();
    setOverrides((current) => [...current.filter((item) => Math.abs(item.time - overrideTime) > 1e-6), { time: overrideTime, x, y }]);
  };
  const onRemoveOverride = (overrideTime: number) => {
    invalidateRender();
    setOverrides((current) => current.filter((item) => Math.abs(item.time - overrideTime) > 1e-6));
  };

  const exportVideo = async () => {
    if (!file || !path.length) return;
    invalidateRender();
    const renderToken = ++renderGenerationRef.current;
    setRendering({ fraction: 0, message: "Starting…" });
    try {
      const render = await renderReframe({
        file, path, aspect, letterboxSegments,
        onProgress: (fraction, message) => { if (renderGenerationRef.current === renderToken) setRendering({ fraction, message }); },
      });
      if (renderGenerationRef.current !== renderToken) return;
      const url = URL.createObjectURL(render.blob);
      const name = `${baseName(file.name)}-reframe-${aspect.replace(":", "x")}.${render.extension}`;
      setResult({ ...render, url, name });
      setStatus({ text: `Exported ${name} via ${render.method === "webcodecs" ? "WebCodecs" : "MediaRecorder (real-time fallback)"} in ${render.seconds.toFixed(1)}s.`, error: false });
    } catch (error) {
      if (renderGenerationRef.current === renderToken) setStatus({ text: error instanceof Error ? error.message : "Export failed.", error: true });
    } finally {
      if (renderGenerationRef.current === renderToken) setRendering(null);
    }
  };

  const exportPathJson = () => {
    if (!file) return;
    const json = pathToJson({ fileName: file.name, ...sourceSize, duration, aspect, path, cutTimes, letterboxSegments });
    downloadFile(`${baseName(file.name)}-crop-path.json`, JSON.stringify(json, null, 2), "application/json");
  };

  const exportSession = async () => {
    if (!file || !duration || !sourceSize.width || !sourceSize.height) return;
    const sourceFile = file;
    const renderToken = renderGenerationRef.current;
    const settings = { aspect, useFaces, deadZone, maxPanSpeed, ease };
    const edits = { targets: autoTargets, cutTimes, overrides, letterboxSegments };
    const sha256 = await sha256Blob(sourceFile);
    if (currentFileRef.current !== sourceFile || renderGenerationRef.current !== renderToken) return;
    const session = createReframeSession({
      source: { name: sourceFile.name, size: sourceFile.size, sha256, ...sourceSize, duration },
      settings,
      ...edits,
    });
    downloadFile(`${baseName(sourceFile.name)}-reframe-session.json`, JSON.stringify(session, null, 2), "application/json");
  };

  const importSessionFile = async (candidate: File | undefined) => {
    if (!candidate) return;
    if (analyzing) { setStatus({ text: "Wait for analysis to finish before importing a session.", error: true }); return; }
    const sourceFile = file;
    if (!sourceFile || !duration) { setStatus({ text: "Load the source video before importing its session.", error: true }); return; }
    const importToken = analysisCoordinatorRef.current.begin();
    invalidateRender();
    const renderToken = renderGenerationRef.current;
    setAnalyzing(false);
    try {
      const session = parseReframeSession(await candidate.text());
      const sha256 = await sha256Blob(sourceFile);
      if (!analysisCoordinatorRef.current.isCurrent(importToken) || currentFileRef.current !== sourceFile || renderGenerationRef.current !== renderToken) return;
      if (!reframeSessionMatchesMedia(session, { size: sourceFile.size, sha256, ...sourceSize, duration })) {
        throw new Error("Choose the original or matching media first. Session relinking checks SHA-256, file size, dimensions, and duration; it stores no media path.");
      }
      setAspect(session.settings.aspect);
      setUseFaces(session.settings.useFaces);
      setDeadZone(session.settings.deadZone);
      setMaxPanSpeed(session.settings.maxPanSpeed);
      setEase(session.settings.ease);
      setAutoTargets(session.targets);
      setCutTimes(session.cutTimes);
      setOverrides(session.overrides);
      setLetterboxSegments(session.letterboxSegments);
      setStatus({ text: `Restored editable Reframe session for ${session.source.name} onto ${sourceFile.name}.`, error: false });
    } catch (error) {
      if (analysisCoordinatorRef.current.isCurrent(importToken) && currentFileRef.current === sourceFile) {
        setStatus({ text: error instanceof Error ? error.message : "Could not import Reframe session.", error: true });
      }
    }
  };

  const openInEditor = () => {
    if (!file) return;
    const cutFile = reframeToCutFile({ name: baseName(file.name), duration, exportName: result?.name ?? file.name });
    downloadFile(`${baseName(file.name)}-reframe.scenepilot.json`, JSON.stringify(cutFile, null, 2), "application/json");
    setStatus({ text: "Saved the ScenePilot project file. In the editor: new project with the exported clip as the main media, then Import cut → this file.", error: false });
    window.open("../../app/", "_blank", "noopener");
  };

  const openInAutoCut = () => {
    if (result) downloadFile(result.name, result.blob, result.mime);
    window.open("../autocut/", "_blank", "noopener");
    setStatus({ text: "Downloaded the reframed clip and opened AutoCut — drop it in there as a clip.", error: false });
  };

  return (
    <ToolShell
      tool="reframe"
      limits={LIMITS}
      onOpenFile={(opened) => { if (opened.type.startsWith("video/")) void loadFile(opened); }}
      actions={file ? <button type="button" className="btn ghost" onClick={() => fileInput.current?.click()}>Change video</button> : undefined}
    >
      <input ref={fileInput} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => onPickFiles(e.target.files)} />
      <input ref={sessionInput} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { void importSessionFile(e.target.files?.[0]); e.target.value = ""; }} />
      {!file ? (
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onPickFiles(e.dataTransfer.files); }}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
        >
          <Upload size={28} />
          <p>Drop a horizontal video here, or click to choose one.</p>
          <p className="note">Nothing is uploaded — it stays in this browser tab.</p>
        </div>
      ) : (
        <div className="reframe-layout">
          <div className="reframe-controls">
            <div className="row-head">
              <button type="button" className="btn ghost" onClick={() => void exportSession()} disabled={!duration || analyzing}><Download size={14} /> Save editable session</button>
              <button type="button" className="btn ghost" onClick={() => sessionInput.current?.click()} disabled={analyzing}><Upload size={14} /> Import / relink session</button>
            </div>
            <label>
              Output aspect
              <select value={aspect} onChange={(e) => { invalidateRender(); setAspect(e.target.value as ReframeAspectId); }}>
                {REFRAME_ASPECT_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={useFaces} onChange={(e) => toggleFaces(e.target.checked)} />
              Follow faces {usedFaces ? "(found)" : ""}
            </label>
            <label>
              Dead zone <span className="note">{Math.round(deadZone * 100)}%</span>
              <input type="range" min={0} max={0.3} step={0.01} value={deadZone} onChange={(e) => { invalidateRender(); setDeadZone(Number(e.target.value)); }} />
            </label>
            <label>
              Max pan speed <span className="note">{maxPanSpeed.toFixed(2)}/s</span>
              <input type="range" min={0.1} max={1.5} step={0.05} value={maxPanSpeed} onChange={(e) => { invalidateRender(); setMaxPanSpeed(Number(e.target.value)); }} />
            </label>
            <label>
              Ease <span className="note">{ease.toFixed(2)}</span>
              <input type="range" min={0.05} max={1} step={0.05} value={ease} onChange={(e) => { invalidateRender(); setEase(Number(e.target.value)); }} />
            </label>
            {analyzing && <p className="note"><Loader2 className="spin" size={14} /> Analysing… {Math.round(analyzeProgress * 100)}%</p>}
          </div>

          <div className="reframe-preview">
            <canvas ref={sourceCanvasRef} width={640} height={360} aria-label="Source with crop window" />
            <canvas ref={outputCanvasRef} width={304} height={540} aria-label="Cropped output preview" />
          </div>

          <div className="reframe-transport">
            <button type="button" className="btn" onClick={togglePlay} disabled={!duration}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
            <input type="range" min={0} max={duration || 1} step={0.01} value={time} onChange={(e) => seek(Number(e.target.value))} />
            <span className="note">{fmt(time)} / {fmt(duration)}</span>
          </div>

          <ReframeTimeline
            duration={duration}
            path={path}
            cutTimes={cutTimes}
            overrides={overrides}
            letterboxSegments={letterboxSegments}
            time={time}
            zoom={Math.max(20, Math.min(120, 900 / Math.max(1, duration)))}
            onSeek={seek}
            onOverride={onOverride}
            onRemoveOverride={onRemoveOverride}
          />

          <div className="reframe-letterbox">
            <div className="row-head">
              <strong>Letterbox instead</strong>
              <button type="button" className="btn ghost" onClick={addLetterboxSegment} disabled={!duration}><Plus size={14} /> Add segment at playhead</button>
            </div>
            {letterboxSegments.length === 0 && <p className="note">No letterboxed segments — the whole clip is cropped.</p>}
            {letterboxSegments.map((segment, index) => (
              <div key={index} className="segment-row">
                <input type="number" min={0} max={duration} step={0.1} value={segment.start.toFixed(1)} onChange={(e) => updateSegment(index, "start", Number(e.target.value))} />
                <span>to</span>
                <input type="number" min={0} max={duration} step={0.1} value={segment.end.toFixed(1)} onChange={(e) => updateSegment(index, "end", Number(e.target.value))} />
                <span>s — show the whole frame, letterboxed, instead of cropping</span>
                <button type="button" className="btn ghost" onClick={() => removeSegment(index)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <div className="reframe-actions">
            <button type="button" className="btn primary" onClick={() => void exportVideo()} disabled={!path.length || analyzing || Boolean(rendering)}>
              {rendering ? <Loader2 className="spin" size={14} /> : <Download size={14} />} Export video
            </button>
            <button type="button" className="btn" onClick={exportPathJson} disabled={!path.length}><FileJson size={14} /> Export crop path JSON</button>
            {result && <a className="btn" href={result.url} download={result.name}><Download size={14} /> Download {result.name}</a>}
            <button type="button" className="btn ghost" onClick={openInAutoCut} disabled={!result}>Open in AutoCut <ArrowUpRight size={14} /></button>
            <button type="button" className="btn ghost" onClick={openInEditor} disabled={!file}>Open in editor <ArrowUpRight size={14} /></button>
          </div>
          {rendering && <p className="note">{rendering.message} ({Math.round(rendering.fraction * 100)}%)</p>}
        </div>
      )}
      <p className={status.error ? "status-line error" : "status-line"}>{status.text}</p>
    </ToolShell>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><ReframeApp /></StrictMode>);
