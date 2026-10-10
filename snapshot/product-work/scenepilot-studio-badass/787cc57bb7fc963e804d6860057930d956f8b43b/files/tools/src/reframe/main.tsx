import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, Download, FileJson, Loader2, Pause, Play, Plus, Trash2, Upload } from "lucide-react";
import { CURRENT_CUT_FILE_VERSION, CUT_FILE_FORMAT, DEFAULT_EFFECTS } from "../../../lib/project-store.ts";
import { applyManualOverrides, buildCameraPath, type PathPoint, type SubjectTarget } from "../../../lib/reframe-path.ts";
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
  const fileInput = useRef<HTMLInputElement | null>(null);

  // One PathPoint path combines the automatic targets (smoothed) with manual pins.
  const path: PathPoint[] = useMemo(() => {
    if (!autoTargets.length) return [];
    const base = buildCameraPath(autoTargets, { deadZone, maxPanSpeed, ease, cutTimes });
    return applyManualOverrides(base, overrides);
  }, [autoTargets, cutTimes, overrides, deadZone, maxPanSpeed, ease]);

  useEffect(() => {
    if (!sourceCanvasRef.current || !outputCanvasRef.current) return;
    const player = new ReframePlayer(sourceCanvasRef.current, outputCanvasRef.current);
    player.onTime = setTime;
    player.onEnded = () => setPlaying(false);
    playerRef.current = player;
    return () => player.dispose();
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.path = path;
    player.aspect = aspect;
    player.letterboxSegments = letterboxSegments;
    void player.drawStill();
  }, [path, aspect, letterboxSegments]);

  const getFaceFinder = useCallback(async (): Promise<FaceFinder | null> => {
    if (!useFaces) return null;
    faceFinderRef.current ??= createFaceFinder().catch((error) => {
      console.warn("Face model unavailable, falling back to motion saliency.", error);
      return null;
    });
    return faceFinderRef.current;
  }, [useFaces]);

  const loadFile = useCallback(async (incoming: File) => {
    setFile(incoming);
    setResult(null);
    setOverrides([]);
    setLetterboxSegments([]);
    setStatus({ text: `Loaded ${incoming.name}. Analysing…`, error: false });
    const player = playerRef.current;
    if (player) await player.load(incoming).catch((error) => setStatus({ text: String(error.message ?? error), error: true }));
    setAnalyzing(true);
    setAnalyzeProgress(0);
    try {
      const faces = await getFaceFinder();
      const analysis = await analyzeVideo(incoming, { faces, onProgress: (p) => setAnalyzeProgress(p.fraction) });
      setDuration(analysis.duration);
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
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Could not analyse this video.", error: true });
    } finally {
      setAnalyzing(false);
    }
  }, [getFaceFinder]);

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
    const start = Math.max(0, time - 1);
    const end = Math.min(duration || time + 1, time + 1);
    setLetterboxSegments((current) => [...current, { start, end }].sort((a, b) => a.start - b.start));
  };
  const updateSegment = (index: number, field: "start" | "end", value: number) => {
    setLetterboxSegments((current) => current.map((segment, i) => (i === index ? { ...segment, [field]: value } : segment)));
  };
  const removeSegment = (index: number) => setLetterboxSegments((current) => current.filter((_, i) => i !== index));

  const onOverride = (overrideTime: number, x: number, y: number) => {
    setOverrides((current) => [...current.filter((item) => Math.abs(item.time - overrideTime) > 1e-6), { time: overrideTime, x, y }]);
  };
  const onRemoveOverride = (overrideTime: number) => {
    setOverrides((current) => current.filter((item) => Math.abs(item.time - overrideTime) > 1e-6));
  };

  const exportVideo = async () => {
    if (!file || !path.length) return;
    setRendering({ fraction: 0, message: "Starting…" });
    try {
      const render = await renderReframe({
        file, path, aspect, letterboxSegments,
        onProgress: (fraction, message) => setRendering({ fraction, message }),
      });
      const url = URL.createObjectURL(render.blob);
      const name = `${baseName(file.name)}-reframe-${aspect.replace(":", "x")}.${render.extension}`;
      setResult({ ...render, url, name });
      setStatus({ text: `Exported ${name} via ${render.method === "webcodecs" ? "WebCodecs" : "MediaRecorder (real-time fallback)"} in ${render.seconds.toFixed(1)}s.`, error: false });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Export failed.", error: true });
    } finally {
      setRendering(null);
    }
  };

  const exportPathJson = () => {
    if (!file) return;
    const json = pathToJson({ fileName: file.name, width: 0, height: 0, duration, aspect, path, cutTimes, letterboxSegments });
    downloadFile(`${baseName(file.name)}-crop-path.json`, JSON.stringify(json, null, 2), "application/json");
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
      actions={file ? <button type="button" className="btn ghost" onClick={() => fileInput.current?.click()}>Change video</button> : undefined}
    >
      <input ref={fileInput} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => onPickFiles(e.target.files)} />
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
            <label>
              Output aspect
              <select value={aspect} onChange={(e) => setAspect(e.target.value as ReframeAspectId)}>
                {REFRAME_ASPECT_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={useFaces} onChange={(e) => { setUseFaces(e.target.checked); if (file) void loadFile(file); }} />
              Follow faces {usedFaces ? "(found)" : ""}
            </label>
            <label>
              Dead zone <span className="note">{Math.round(deadZone * 100)}%</span>
              <input type="range" min={0} max={0.3} step={0.01} value={deadZone} onChange={(e) => setDeadZone(Number(e.target.value))} />
            </label>
            <label>
              Max pan speed <span className="note">{maxPanSpeed.toFixed(2)}/s</span>
              <input type="range" min={0.1} max={1.5} step={0.05} value={maxPanSpeed} onChange={(e) => setMaxPanSpeed(Number(e.target.value))} />
            </label>
            <label>
              Ease <span className="note">{ease.toFixed(2)}</span>
              <input type="range" min={0.05} max={1} step={0.05} value={ease} onChange={(e) => setEase(Number(e.target.value))} />
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
            <button type="button" className="btn primary" onClick={() => void exportVideo()} disabled={!path.length || Boolean(rendering)}>
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
