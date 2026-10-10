/* eslint-disable @next/next/no-img-element -- The reference still is a local blob URL; next/image does not apply to this Vite page. */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import { createRoot } from "react-dom/client";
import { Download, ImagePlus, Loader2, Palette, Pause, Play, Upload } from "lucide-react";
import {
  bakeLut3d, buildColorTransfer, dominantPalette, lutToRgba8, measureLabStats, mergeLabStats, neutralLabStats, serializeCubeLut,
  type LabStats, type PaletteSwatch, type TransferMethod,
} from "../../../lib/color-transfer";
import { sampleCubeLut } from "../../../lib/lut";
import { ToolShell, baseName, downloadFile } from "../shell";
import { createLutRenderer, type LutRenderer } from "./gl";
import "../tools.css";

const LIMITS = [
  "The look is a statistical colour transfer (CIELAB mean/spread and histogram matching), not a learned model. It moves overall cast, contrast and saturation; it can’t relight a scene, change what’s in it, or separate skin tones from the background.",
  "The LUT is tuned to the clip you load: the same .cube will look different on footage with very different colours. Load a representative clip before exporting.",
  "Very small, flat or monochrome references give weak or noisy results; Histogram mode can posterize on sparse stills — try Balanced or Reinhard.",
  "Assumes Rec.709/sRGB display-referred footage. Log or HDR footage needs a conversion LUT first.",
  "Preview uses WebGL2; without it, stills preview on the CPU and video preview is unavailable.",
  "In ScenePilot the LUT applies through Desktop Pro’s Color workspace; Browser Lite has no LUT import yet.",
];

const METHODS: Array<{ id: TransferMethod; label: string; hint: string }> = [
  { id: "balanced", label: "Balanced", hint: "Tone curve from the histogram, colour from mean/spread" },
  { id: "reinhard", label: "Reinhard", hint: "Smoothest — mean and spread only" },
  { id: "histogram", label: "Histogram", hint: "Closest match, can posterize" },
];

const STATS_SIDE = 320;
const PREVIEW_SIDE = 1920;

type Source = { name: string; kind: "image" | "video"; url: string; width: number; height: number };

function pixelsOf(source: CanvasImageSource, width: number, height: number, maxSide = STATS_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function loadImage(url: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return image;
}

const seekTo = (video: HTMLVideoElement, time: number) => new Promise<void>((resolve) => {
  const done = () => { video.removeEventListener("seeked", done); resolve(); };
  video.addEventListener("seeked", done);
  video.currentTime = time;
  window.setTimeout(done, 2000);
});

function GradeApp() {
  const [reference, setReference] = useState<Source | null>(null);
  const [referenceStats, setReferenceStats] = useState<LabStats | null>(null);
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);
  const [target, setTarget] = useState<Source | null>(null);
  const [targetStats, setTargetStats] = useState<LabStats | null>(null);
  const [method, setMethod] = useState<TransferMethod>("balanced");
  const [intensity, setIntensity] = useState(0.8);
  const [lutSize, setLutSize] = useState(33);
  const [split, setSplit] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({ text: "Add a reference still (the look you want), then your own clip or image." });
  const [busy, setBusy] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [dragTarget, setDragTarget] = useState<"" | "reference" | "target">("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<LutRenderer | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const referenceInput = useRef<HTMLInputElement | null>(null);
  const targetInput = useRef<HTMLInputElement | null>(null);
  const neutral = useMemo(() => neutralLabStats(), []);

  // The baked LUT is the single source of truth for preview and export.
  const lut = useMemo(() => {
    if (!referenceStats) return null;
    const transfer = buildColorTransfer(targetStats ?? neutral, referenceStats, { method, intensity });
    return { size: lutSize, table: bakeLut3d(transfer, lutSize) };
  }, [intensity, lutSize, method, neutral, referenceStats, targetStats]);

  const sourceElement = useCallback((): HTMLImageElement | HTMLVideoElement | null => {
    if (target?.kind === "video") return videoRef.current;
    if (target?.kind === "image") return imageRef.current;
    if (reference) return imageRef.current;
    return null;
  }, [reference, target]);

  const shown = target ?? reference;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const element = sourceElement();
    if (!canvas || !element || !lut) return;
    if (element instanceof HTMLVideoElement && element.readyState < 2) return;
    const renderer = rendererRef.current;
    if (renderer) { renderer.draw(element, split); return; }
    // CPU fallback for stills.
    if (element instanceof HTMLVideoElement) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const parsed = { title: "", dimensions: 3 as const, size: lut.size, table: lut.table, domainMin: [0, 0, 0] as [number, number, number], domainMax: [1, 1, 1] as [number, number, number] };
    const splitX = Math.round(split * canvas.width);
    for (let y = 0; y < canvas.height; y++) for (let x = splitX; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const [r, g, b] = sampleCubeLut(parsed, frame.data[i] / 255, frame.data[i + 1] / 255, frame.data[i + 2] / 255);
      frame.data[i] = r * 255; frame.data[i + 1] = g * 255; frame.data[i + 2] = b * 255;
    }
    ctx.putImageData(frame, 0, 0);
  }, [lut, sourceElement, split]);

  // Size the canvas to the shown source, (re)create the GL renderer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shown) return;
    const scale = Math.min(1, PREVIEW_SIDE / Math.max(shown.width, shown.height));
    canvas.width = Math.max(2, Math.round(shown.width * scale));
    canvas.height = Math.max(2, Math.round(shown.height * scale));
    if (!rendererRef.current && webgl) {
      try {
        rendererRef.current = createLutRenderer(canvas);
      } catch {
        rendererRef.current = null;
      }
      if (!rendererRef.current) window.setTimeout(() => setWebgl(false), 0);
    }
  }, [shown, webgl]);

  useEffect(() => {
    if (lut && rendererRef.current) rendererRef.current.setLut(lutToRgba8(lut.table), lut.size);
  }, [lut, shown]);
  useEffect(() => { draw(); }, [draw, shown]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { draw(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw, playing]);

  // ---------------------------------------------------------------- loading
  const loadReference = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus({ text: "The reference should be a still image (JPG, PNG, WebP).", error: true }); return; }
    setBusy(true);
    try {
      const url = URL.createObjectURL(file);
      const image = await loadImage(url);
      const pixels = pixelsOf(image, image.naturalWidth, image.naturalHeight);
      setReferenceStats(measureLabStats(pixels));
      setPalette(dominantPalette(pixels));
      if (reference) URL.revokeObjectURL(reference.url);
      setReference({ name: file.name, kind: "image", url, width: image.naturalWidth, height: image.naturalHeight });
      if (!target) imageRef.current = image;
      setStatus({ text: target ? "Look extracted. Compare with the split slider, then export the .cube." : "Look extracted. Now add your clip or image to tune the grade to your footage." });
    } catch {
      setStatus({ text: "That image couldn't be read.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const loadTarget = async (file?: File) => {
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { setStatus({ text: "Add a video clip or a still image.", error: true }); return; }
    setBusy(true);
    setPlaying(false);
    videoRef.current?.pause();
    try {
      const url = URL.createObjectURL(file);
      if (isImage) {
        const image = await loadImage(url);
        imageRef.current = image;
        setTargetStats(measureLabStats(pixelsOf(image, image.naturalWidth, image.naturalHeight)));
        setTarget({ name: file.name, kind: "image", url, width: image.naturalWidth, height: image.naturalHeight });
      } else {
        const video = videoRef.current!;
        video.src = url;
        await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error("decode")); });
        // Measure the clip across eight evenly spaced frames, not just the first.
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const samples: LabStats[] = [];
        const count = duration > 1 ? 8 : 1;
        for (let i = 0; i < count; i++) {
          setStatus({ text: `Measuring your clip… frame ${i + 1} of ${count}` });
          if (count > 1) await seekTo(video, (duration * (i + 0.5)) / count);
          samples.push(measureLabStats(pixelsOf(video, video.videoWidth, video.videoHeight, 240)));
        }
        await seekTo(video, 0);
        setTargetStats(mergeLabStats(samples));
        setTarget({ name: file.name, kind: "video", url, width: video.videoWidth, height: video.videoHeight });
      }
      setStatus({ text: reference ? "Grade tuned to your footage. Drag the split to compare." : "Now add a reference still with the look you want." });
    } catch {
      setStatus({ text: "That file couldn't be decoded in this browser.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { await video.play().catch(() => undefined); setPlaying(!video.paused); } else { video.pause(); setPlaying(false); }
  };

  const exportCube = () => {
    if (!lut || !reference) return;
    const title = `${baseName(reference.name)} look${target ? ` for ${baseName(target.name)}` : ""}`;
    downloadFile(`${baseName(reference.name)}-grade-${lut.size}.cube`, serializeCubeLut(lut.table, lut.size, title), "text/plain");
  };

  const exportStill = () => {
    const canvas = canvasRef.current;
    if (!canvas || !shown) return;
    const previous = split;
    // Render fully graded, capture, then restore the comparison.
    if (rendererRef.current) { const element = sourceElement(); if (element) rendererRef.current.draw(element, 0); }
    canvas.toBlob((blob) => {
      if (blob) downloadFile(`${baseName(shown.name)}-graded.png`, blob);
      if (rendererRef.current) { const element = sourceElement(); if (element) rendererRef.current.draw(element, previous); }
    }, "image/png");
  };

  const onSplitPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1 && event.type !== "pointerdown") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setSplit(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)));
  };

  const dropOn = (which: "reference" | "target") => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragTarget("");
    const file = event.dataTransfer.files?.[0];
    if (which === "reference") void loadReference(file); else void loadTarget(file);
  };
  const dragProps = (which: "reference" | "target") => ({
    onDragOver: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragTarget(which); },
    onDragLeave: () => setDragTarget(""),
    onDrop: dropOn(which),
  });

  return (
    <ToolShell tool="grade" limits={LIMITS}>
      <div className="tool-heading">
        <div>
          <span className="eyebrow"><Palette size={12} /> Steal this look · alpha</span>
          <h1>Grade</h1>
          <p>Drop a film still or photo with the look you love, add your own clip, and Grade transfers the colour and contrast. Dial the strength, compare before and after, and export a .cube LUT for ScenePilot, Resolve or Premiere.</p>
        </div>
      </div>
      <input ref={referenceInput} type="file" hidden accept="image/*" onChange={(event) => { void loadReference(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      <input ref={targetInput} type="file" hidden accept="video/*,image/*" onChange={(event) => { void loadTarget(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      <video ref={videoRef} hidden muted loop playsInline preload="auto" onSeeked={() => draw()} />

      <div className="grade-layout">
        <section className="panel" aria-label="Preview">
          <div className="panel-title"><span>Preview</span><small>{shown ? `${shown.name}${target ? "" : " (reference — add your clip)"}` : "nothing loaded"}</small></div>
          <div className={`grade-stage ${dragTarget === "target" ? "dragging" : ""}`} {...dragProps("target")}>
            {shown ? (
              <div style={{ position: "relative", touchAction: "none", cursor: "ew-resize" }} onPointerDown={onSplitPointer} onPointerMove={onSplitPointer}>
                <canvas ref={canvasRef} aria-label="Graded preview with before/after split" />
                <span className="split-handle" style={{ left: `${split * 100}%` }} />
                {split > 0.08 && <span className="split-label" style={{ left: 10 }}>Before</span>}
                {split < 0.92 && <span className="split-label" style={{ right: 10 }}>Graded</span>}
              </div>
            ) : (
              <button type="button" className="dropzone" style={{ width: "100%", minHeight: 360, border: 0 }} onClick={() => targetInput.current?.click()}>
                <span><Upload size={26} /><strong>Drop your clip or image</strong><small>The footage you want to grade · stays on this device</small></span>
              </button>
            )}
          </div>
          <div className="stage-controls">
            {target?.kind === "video" && <button type="button" className="btn icon" onClick={() => void togglePlay()} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>}
            <label style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, fontSize: 12 }}>Split <input type="range" min={0} max={1} step={0.01} value={split} onChange={(event) => setSplit(Number(event.target.value))} aria-label="Before/after split" disabled={!shown} /></label>
            <button type="button" className="btn small" onClick={() => targetInput.current?.click()} disabled={busy}><Upload size={13} /> {target ? "Replace clip" : "Add clip"}</button>
          </div>
          <div className="panel-body">
            <p className={`status-line ${status.error ? "error" : ""}`} role="status" aria-live="polite">{busy && <Loader2 size={13} className="spin" />}{status.text}</p>
            {!webgl && <p className="note">WebGL2 is unavailable here: stills preview on the CPU; video preview is off. Export still works.</p>}
          </div>
        </section>

        <div className="side-stack">
          <section className="panel" aria-label="Reference look">
            <div className="panel-title"><span>01 · Reference look</span><small>{reference ? reference.name : "a still you love"}</small></div>
            <div className="panel-body">
              {reference ? (
                <button type="button" onClick={() => referenceInput.current?.click()} style={{ padding: 0, border: 0, background: "none", width: "100%", cursor: "pointer" }} aria-label="Replace reference still" {...dragProps("reference")}>
                  <img className="ref-thumb" src={reference.url} alt="Reference still" />
                </button>
              ) : (
                <button type="button" className={`dropzone ${dragTarget === "reference" ? "dragging" : ""}`} style={{ width: "100%", minHeight: 150 }} onClick={() => referenceInput.current?.click()} {...dragProps("reference")}>
                  <span><ImagePlus size={22} /><strong>Drop a reference still</strong><small>Film frame, photo or painting</small></span>
                </button>
              )}
              {palette.length > 0 && <div className="palette" aria-label="Reference palette">{palette.map((swatch) => <i key={swatch.hex} style={{ background: swatch.hex, flexGrow: Math.max(0.4, swatch.share * 10) }} title={swatch.hex} />)}</div>}
            </div>
          </section>

          <section className="panel" aria-label="Grade controls">
            <div className="panel-title"><span>02 · Transfer</span><small>{targetStats ? "tuned to your clip" : "generic until you add a clip"}</small></div>
            <div className="panel-body" style={{ display: "grid", gap: 12 }}>
              <div className="segmented" role="group" aria-label="Transfer method">
                {METHODS.map((item) => <button key={item.id} type="button" aria-pressed={method === item.id} onClick={() => setMethod(item.id)} title={item.hint}>{item.label}</button>)}
              </div>
              <p className="note" style={{ margin: 0 }}>{METHODS.find((item) => item.id === method)?.hint}</p>
              <label className="slider-field">
                <span className="field"><span>Intensity</span></span>
                <output>{Math.round(intensity * 100)}%</output>
                <input type="range" min={0} max={1} step={0.01} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
              </label>
              <label className="field"><span>LUT size</span>
                <select value={lutSize} onChange={(event) => setLutSize(Number(event.target.value))}>
                  <option value={17}>17³ · small, any app</option>
                  <option value={33}>33³ · standard</option>
                  <option value={65}>65³ · finest, large file</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel" aria-label="Export">
            <div className="panel-title"><span>03 · Export</span><small>{lut ? `${lut.size}³ .cube` : "add a reference"}</small></div>
            <div className="panel-body">
              <div className="btn-row">
                <button type="button" className="btn primary" onClick={exportCube} disabled={!lut}><Download size={14} /> Export .cube</button>
                <button type="button" className="btn" onClick={exportStill} disabled={!lut || !shown}><Download size={14} /> Graded still (PNG)</button>
              </div>
              <div className="handoff">
                <strong style={{ fontSize: 12 }}>Apply in ScenePilot</strong>
                <ol>
                  <li><b>Desktop Pro:</b> open the <i>Color</i> workspace, choose <i>Import .cube LUT</i> under <i>Creative LUT</i>, then use <i>Mix</i> to soften it.</li>
                  <li><b>Browser Lite</b> doesn’t expose LUT import yet — use the .cube in Pro, Resolve, Premiere or Final Cut.</li>
                </ol>
                <p className="note">Intensity is baked into the file. Export at 100% if you prefer to set strength with the editor’s Mix.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </ToolShell>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><GradeApp /></StrictMode>);
