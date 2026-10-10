import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createRoot } from "react-dom/client";
import { Download, FileText, Film, Loader2, Pause, Play, Sparkles, Trash2, Upload, Merge } from "lucide-react";
import { decodeToMono16k, transcribePcm } from "../../../app/transcribe-client";
import { parseCaptions } from "../../../lib/captions";
import {
  CAPTION_PRESETS, groupCaptionLines, lineText, linesToCutFile, linesToSrt, linesToVtt, normalizeWords, presetById, retimeLine, tidyLines,
  activeLine, activeWordIndex, type CaptionLine, type CaptionWord,
} from "../../../lib/caption-words";
import { ToolShell, baseName, downloadFile } from "../shell";
import { drawAudioBackdrop, drawCaptions } from "./render";
import "../tools.css";

const MODELS = [
  { id: "Xenova/whisper-tiny.en", label: "Fast · English", size: "≈40 MB" },
  { id: "Xenova/whisper-base.en", label: "Accurate · English", size: "≈80 MB" },
  { id: "Xenova/whisper-tiny", label: "Multilingual · tiny", size: "≈40 MB" },
] as const;

const AUDIO_ASPECTS = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080] } as const;
type AudioAspect = keyof typeof AUDIO_ASPECTS;
const MAX_SECONDS = 15 * 60;
const MAX_VIDEO_SIDE = 1920;

const LIMITS = [
  "Speech-to-text runs on this device with OpenAI Whisper (MIT release; Apache-2.0 ONNX exports by Xenova) via transformers.js (Apache-2.0) and ONNX Runtime Web (MIT). The first run downloads the model (≈40–80 MB) from the Hugging Face CDN; it is cached after that.",
  "Accuracy is Whisper tiny/base quality: names, lyrics over loud music and heavy accents need hand fixes. Word timings can drift by a few hundred milliseconds.",
  "Built for short clips. Anything over a few minutes is slow on CPU; the hard limit is 15 minutes.",
  "Burn-in export records in real time (a 60 s clip takes about 60 s) and keeps the tab’s playback audible. Keep the tab visible while it records. Output is WebM (VP9/VP8 + Opus) straight from MediaRecorder, so it has no duration/seek index: it plays and uploads fine, but some players can’t scrub it and ScenePilot’s analysis wants an MP4. MP4 export is not available yet.",
  "Transcription runs on the CPU (WASM) by default. WebGPU is an experimental option that falls back to CPU if it fails; for short clips it is currently slower (≈65 s vs ≈19 s for a 5 s clip on an M-series Mac, model download included).",
  "The ScenePilot handoff carries captions as per-line title cues; word-by-word highlighting is only in this tool’s burn-in.",
];

type Status = { text: string; error?: boolean; progress?: number };

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00.0";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function pickRecorderType() {
  const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return options.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
}

function CaptionsApp() {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [kind, setKind] = useState<"video" | "audio">("video");
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pcm, setPcm] = useState<Float32Array | null>(null);
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [presetId, setPresetId] = useState(CAPTION_PRESETS[0].id);
  const [model, setModel] = useState<string>(MODELS[0].id);
  // WASM is the default: in our measurements whisper-tiny on short clips was
  // ~3x faster on CPU than on WebGPU (shader warm-up + q4 decoder dominate).
  const [useGpu, setUseGpu] = useState(false);
  const [maxChars, setMaxChars] = useState(28);
  const [audioAspect, setAudioAspect] = useState<AudioAspect>("9:16");
  const [status, setStatus] = useState<Status>({ text: "Drop a short video or audio clip to start." });
  const [busy, setBusy] = useState<"" | "decode" | "transcribe" | "export">("");
  const [dragging, setDragging] = useState(false);
  const [videoSize, setVideoSize] = useState<[number, number]>([1920, 1080]);

  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const srtInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioGraphRef = useRef<{ context: AudioContext; destination: MediaStreamAudioDestinationNode } | null>(null);
  const preset = presetById(presetId);
  const canvasSize: readonly [number, number] = kind === "audio" ? AUDIO_ASPECTS[audioAspect] : videoSize;
  const gpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

  // ---------------------------------------------------------------- drawing
  const levelAt = useCallback((seconds: number) => {
    if (!pcm) return 0;
    const start = Math.max(0, Math.floor(seconds * 16000) - 400);
    let sum = 0;
    const end = Math.min(pcm.length, start + 800);
    for (let i = start; i < end; i++) sum += pcm[i] * pcm[i];
    return Math.min(1, Math.sqrt(sum / Math.max(1, end - start)) * 4);
  }, [pcm]);

  const draw = useCallback((at?: number) => {
    const canvas = canvasRef.current;
    const media = mediaRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const t = at ?? media?.currentTime ?? 0;
    const { width, height } = canvas;
    if (kind === "video" && media && media.readyState >= 2) {
      ctx.drawImage(media, 0, 0, width, height);
    } else if (kind === "audio" && file) {
      drawAudioBackdrop(ctx, width, height, baseName(file.name), levelAt(t));
    } else {
      ctx.fillStyle = "#050706";
      ctx.fillRect(0, 0, width, height);
    }
    drawCaptions(ctx, width, height, lines, t, preset);
  }, [file, kind, levelAt, lines, preset]);

  // Repaint whenever captions, style or size change while paused.
  useEffect(() => { draw(); }, [draw, canvasSize]);

  // Preview loop while playing. requestVideoFrameCallback/rAF pause in hidden
  // tabs, so a timer keeps the clock moving there.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const media = mediaRef.current;
      if (media) { draw(media.currentTime); setTime(media.currentTime); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = window.setInterval(() => { if (document.hidden) tick(); }, 1000 / 15);
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, [draw, playing]);

  // ---------------------------------------------------------------- loading
  const loadFile = async (next: File | undefined) => {
    if (!next) return;
    const isAudio = next.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(next.name);
    const isVideo = next.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv)$/i.test(next.name);
    if (!isAudio && !isVideo) { setStatus({ text: "That file isn't audio or video.", error: true }); return; }
    abortRef.current?.abort();
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setFile(next);
    setKind(isAudio ? "audio" : "video");
    setMediaUrl(URL.createObjectURL(next));
    setLines([]);
    setPcm(null);
    setTime(0);
    setPlaying(false);
    setBusy("decode");
    setStatus({ text: "Decoding audio on this device…" });
    try {
      const decoded = await decodeToMono16k(next);
      const seconds = decoded.length / 16000;
      if (seconds > MAX_SECONDS) throw new Error("That clip is longer than 15 minutes. Trim it first — this alpha is built for shorts.");
      setPcm(decoded);
      setStatus({ text: `Ready · ${formatClock(seconds)} of audio. Press “Transcribe” to generate captions.` });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "This file's audio couldn't be decoded.", error: true });
    } finally {
      setBusy("");
    }
  };

  const onMediaLoaded = () => {
    const media = mediaRef.current;
    if (!media) return;
    setDuration(Number.isFinite(media.duration) ? media.duration : (pcm ? pcm.length / 16000 : 0));
    if (kind === "video" && media.videoWidth) {
      const scale = Math.min(1, MAX_VIDEO_SIDE / Math.max(media.videoWidth, media.videoHeight));
      setVideoSize([Math.round((media.videoWidth * scale) / 2) * 2, Math.round((media.videoHeight * scale) / 2) * 2]);
    }
    window.setTimeout(() => draw(0), 0);
  };

  // ---------------------------------------------------------------- ASR
  const transcribe = async () => {
    if (!pcm) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("transcribe");
    const started = performance.now();
    const run = (device: "webgpu" | "wasm") => transcribePcm(pcm, (progress) => {
      setStatus({ text: `${progress.stage}${device === "webgpu" ? " · WebGPU" : " · CPU (WASM)"}…`, progress: progress.stage.startsWith("Downloading") ? progress.progress : undefined });
    }, controller.signal, { model, device });
    try {
      let chunks;
      let deviceUsed: "webgpu" | "wasm" = useGpu && gpuAvailable ? "webgpu" : "wasm";
      try {
        chunks = await run(deviceUsed);
      } catch (error) {
        if (deviceUsed !== "webgpu" || controller.signal.aborted) throw error;
        deviceUsed = "wasm";
        setStatus({ text: "WebGPU wasn't available for this model — retrying on CPU (WASM)…" });
        chunks = await run("wasm");
      }
      const words = normalizeWords(chunks, duration || pcm.length / 16000);
      if (!words.length) throw new Error("No speech was recognised. Try the Accurate model, or import an SRT/VTT.");
      setLines(groupCaptionLines(words, { maxChars }));
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      setStatus({ text: `${words.length} words transcribed in ${seconds}s on ${deviceUsed === "webgpu" ? "WebGPU" : "CPU (WASM)"}. Edit any line below.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transcription failed.";
      setStatus({ text: message === "Cancelled" ? "Transcription cancelled." : `Transcription failed: ${message}`, error: message !== "Cancelled" });
    } finally {
      setBusy("");
      abortRef.current = null;
    }
  };

  const importSubtitles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!picked) return;
    try {
      const cues = parseCaptions(await picked.text());
      if (!cues.length) throw new Error("No timed cues found.");
      // Subtitles carry line timing only, so words are spread across each line.
      const imported = cues.map((cue, index) => retimeLine({ id: `import-${index}`, words: [], start: cue.start, end: cue.end }, cue.text));
      setLines(tidyLines(imported));
      setStatus({ text: `Imported ${cues.length} captions. Word timing is estimated from each line's span.` });
    } catch (error) {
      setStatus({ text: error instanceof Error ? `Import failed: ${error.message}` : "Import failed.", error: true });
    }
  };

  const regroup = (chars: number) => {
    setMaxChars(chars);
    const words: CaptionWord[] = lines.flatMap((line) => line.words);
    if (words.length) setLines(groupCaptionLines(words, { maxChars: chars }));
  };

  // ---------------------------------------------------------------- editing
  const editLine = (id: string, text: string) => setLines((items) => items.map((line) => (line.id === id ? retimeLine(line, text) : line)));
  const removeLine = (id: string) => setLines((items) => items.filter((line) => line.id !== id));
  const mergeNext = (id: string) => setLines((items) => {
    const index = items.findIndex((line) => line.id === id);
    if (index < 0 || index >= items.length - 1) return items;
    const merged = { ...items[index], words: [...items[index].words, ...items[index + 1].words] };
    return tidyLines([...items.slice(0, index), merged, ...items.slice(index + 2)]);
  });

  // ---------------------------------------------------------------- playback
  const togglePlay = async () => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) { await media.play().catch(() => undefined); setPlaying(!media.paused); } else { media.pause(); setPlaying(false); }
  };
  const seek = (seconds: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(seconds, duration || seconds));
    setTime(media.currentTime);
  };

  // ---------------------------------------------------------------- export
  const exportBurnIn = async () => {
    const media = mediaRef.current;
    const canvas = canvasRef.current;
    if (!media || !canvas || !file) return;
    const mimeType = pickRecorderType();
    if (!mimeType || typeof canvas.captureStream !== "function") {
      setStatus({ text: "This browser can't record a canvas to WebM. Use Chrome, Edge or Firefox.", error: true });
      return;
    }
    setBusy("export");
    try {
      if (!audioGraphRef.current) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(media);
        const destination = context.createMediaStreamDestination();
        source.connect(destination);
        source.connect(context.destination);
        audioGraphRef.current = { context, destination };
      }
      const { context, destination } = audioGraphRef.current;
      await context.resume();
      const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...destination.stream.getAudioTracks()]);
      const pixels = canvas.width * canvas.height;
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.round(Math.min(12e6, Math.max(3e6, pixels * 4))) });
      const parts: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) parts.push(event.data); };
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

      media.pause();
      media.currentTime = 0;
      await new Promise<void>((resolve) => {
        const fallback = window.setTimeout(resolve, 1500);
        media.onseeked = () => { media.onseeked = null; window.clearTimeout(fallback); resolve(); };
      });
      draw(0);
      recorder.start(250);
      setPlaying(true);
      await media.play();
      const total = duration || media.duration;
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          setStatus({ text: `Recording burn-in… ${formatClock(media.currentTime)} / ${formatClock(total)} (real time — keep this tab visible)`, progress: total ? media.currentTime / total : undefined });
          if (media.ended || media.paused) { window.clearInterval(timer); resolve(); }
        }, 200);
      });
      draw();
      recorder.stop();
      await stopped;
      stream.getVideoTracks().forEach((track) => track.stop());
      setPlaying(false);
      const blob = new Blob(parts, { type: "video/webm" });
      downloadFile(`${baseName(file.name)}-captioned.webm`, blob);
      setStatus({ text: `Exported ${(blob.size / 1024 / 1024).toFixed(1)} MB WebM with burned-in captions.` });
    } catch (error) {
      setStatus({ text: error instanceof Error ? `Export failed: ${error.message}` : "Export failed.", error: true });
      setPlaying(false);
    } finally {
      setBusy("");
    }
  };

  const exportCut = () => {
    if (!file) return;
    const cut = linesToCutFile(lines, preset, { project: `${baseName(file.name)} captions`, duration: duration || (pcm ? pcm.length / 16000 : 1), mainAsset: { name: file.name, kind, size: file.size, lastModified: file.lastModified } });
    downloadFile(`${baseName(file.name)}-captions.scenepilot.json`, JSON.stringify(cut, null, 2), "application/json");
  };

  const current = activeLine(lines, time);
  const currentWord = current ? activeWordIndex(current, time) : -1;
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const wordCount = useMemo(() => lines.reduce((sum, line) => sum + line.words.length, 0), [lines]);

  const onDrop = (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragging(false); void loadFile(event.dataTransfer.files?.[0]); };

  return (
    <ToolShell tool="captions" limits={LIMITS} onOpenFile={(opened) => void loadFile(opened)}>
      <div className="tool-heading">
        <div>
          <span className="eyebrow"><Sparkles size={12} /> On-device speech-to-text · alpha</span>
          <h1>Captions</h1>
          <p>Drop a talking clip, get word-timed captions in a few seconds, fix any word, pick a style, and export a burned-in WebM or SRT/VTT — then carry them into ScenePilot.</p>
        </div>
      </div>
      <input ref={fileInputRef} type="file" hidden accept="video/*,audio/*,.mp4,.mov,.webm,.m4v,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={(event) => { void loadFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      <input ref={srtInputRef} type="file" hidden accept=".srt,.vtt,text/vtt,application/x-subrip" onChange={(event) => void importSubtitles(event)} />
      <div className="captions-layout">
        <section className="panel" aria-label="Preview">
          <div className="panel-title"><span>Preview</span><small>{file ? `${file.name} · ${canvasSize[0]}×${canvasSize[1]}` : "No clip"}</small></div>
          {!file ? (
            <button type="button" className={`dropzone ${dragging ? "dragging" : ""}`} style={{ width: "100%", minHeight: 360 }} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <span><Upload size={26} /><strong>Drop a video or audio clip</strong><small>MP4, MOV, WebM, MP3, WAV, M4A · up to 15 minutes · stays on this device</small></span>
            </button>
          ) : (
            <>
              <div className="stage" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
                <canvas ref={canvasRef} width={canvasSize[0]} height={canvasSize[1]} aria-label="Caption preview" />
                {/* The media element is the clock and audio source; the canvas shows it. */}
                <video ref={mediaRef} src={mediaUrl} playsInline preload="auto" hidden onLoadedMetadata={onMediaLoaded} onLoadedData={() => draw()} onSeeked={() => draw()} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
              </div>
              <div className="stage-controls">
                <button type="button" className="btn icon" onClick={() => void togglePlay()} disabled={busy === "export"} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
                <input type="range" min={0} max={duration || 0} step={0.01} value={Math.min(time, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label="Playhead" disabled={busy === "export"} />
                <output>{formatClock(time)} / {formatClock(duration)}</output>
              </div>
            </>
          )}
          <div className="panel-body">
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={busy !== ""}><Upload size={14} /> {file ? "Replace clip" : "Choose clip"}</button>
              {kind === "audio" && file && (
                <div className="segmented" role="group" aria-label="Frame for audio-only clips">
                  {(Object.keys(AUDIO_ASPECTS) as AudioAspect[]).map((aspect) => <button key={aspect} type="button" aria-pressed={audioAspect === aspect} onClick={() => setAudioAspect(aspect)}>{aspect}</button>)}
                </div>
              )}
            </div>
            <p className={`status-line ${status.error ? "error" : ""}`} role="status" aria-live="polite">{busy && <Loader2 size={13} className="spin" />}{status.text}</p>
            {status.progress !== undefined && <div className="progress" aria-hidden="true"><i style={{ width: `${Math.round(status.progress * 100)}%` }} /></div>}
          </div>
        </section>

        <div className="side-stack">
          <section className="panel" aria-label="Transcription">
            <div className="panel-title"><span>01 · Transcribe</span><small>{wordCount ? `${wordCount} words · ${lines.length} captions` : "on this device"}</small></div>
            <div className="panel-body">
              <div className="option-grid">
                <label className="field"><span>Model</span>
                  <select value={model} onChange={(event) => setModel(event.target.value)} disabled={busy !== ""}>
                    {MODELS.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.size})</option>)}
                  </select>
                </label>
                <label className="field"><span>Engine</span>
                  <select value={useGpu ? "gpu" : "cpu"} onChange={(event) => setUseGpu(event.target.value === "gpu")} disabled={busy !== ""}>
                    <option value="cpu">CPU · WASM (recommended)</option>
                    <option value="gpu" disabled={!gpuAvailable}>{gpuAvailable ? "WebGPU · experimental, CPU fallback" : "WebGPU · not available here"}</option>
                  </select>
                </label>
              </div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                {busy === "transcribe"
                  ? <button type="button" className="btn danger" onClick={() => abortRef.current?.abort()}>Cancel</button>
                  : <button type="button" className="btn primary" onClick={() => void transcribe()} disabled={!pcm || busy !== ""}><Sparkles size={14} /> {lines.length ? "Re-transcribe" : "Transcribe"}</button>}
                <button type="button" className="btn" onClick={() => srtInputRef.current?.click()} disabled={busy !== ""}><FileText size={14} /> Import SRT / VTT</button>
              </div>
              <label className="slider-field" style={{ marginTop: 12 }}>
                <span className="field"><span>Caption length · {maxChars} characters</span></span>
                <output>{maxChars <= 18 ? "punchy" : maxChars <= 32 ? "balanced" : "subtitle"}</output>
                <input type="range" min={10} max={48} step={1} value={maxChars} onChange={(event) => regroup(Number(event.target.value))} disabled={!lines.length} />
              </label>
            </div>
          </section>

          <section className="panel" aria-label="Caption style">
            <div className="panel-title"><span>02 · Style</span><small>{preset.label}</small></div>
            <div className="panel-body">
              <div className="preset-grid">
                {CAPTION_PRESETS.map((item) => (
                  <button key={item.id} type="button" aria-pressed={item.id === presetId} onClick={() => setPresetId(item.id)}>
                    <span style={{ color: item.highlight === "#ffffff" ? item.fill : item.highlight, fontWeight: 800 }}>{item.label}</span>
                    <i>{item.mode === "none" ? "static" : item.mode === "color" ? "karaoke fill" : item.mode === "box" ? "word box" : item.mode === "pop" ? "word pop" : "word reveal"}</i>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="panel" aria-label="Export">
            <div className="panel-title"><span>03 · Export</span><small>{lines.length ? "ready" : "transcribe first"}</small></div>
            <div className="panel-body">
              <div className="btn-row">
                <button type="button" className="btn primary" onClick={() => void exportBurnIn()} disabled={!lines.length || busy !== ""}><Film size={14} /> Burn-in WebM</button>
                <button type="button" className="btn" onClick={() => file && downloadFile(`${baseName(file.name)}.srt`, linesToSrt(lines), "application/x-subrip")} disabled={!lines.length}><Download size={14} /> SRT</button>
                <button type="button" className="btn" onClick={() => file && downloadFile(`${baseName(file.name)}.vtt`, linesToVtt(lines), "text/vtt")} disabled={!lines.length}><Download size={14} /> VTT (word timed)</button>
                <button type="button" className="btn" onClick={exportCut} disabled={!lines.length}><Download size={14} /> ScenePilot cut</button>
              </div>
              <div className="handoff">
                <strong style={{ fontSize: 12 }}>Hand off to ScenePilot</strong>
                <ol>
                  <li><b>Existing project:</b> download the SRT, then in the editor run <i>Import SRT / VTT captions</i> from the command palette (⇧⌘P). Captions land as editable title cues.</li>
                  <li><b>New project:</b> open the editor with this clip as the main media, then <i>Import cut</i> the <code>.scenepilot.json</code>. It replaces the open cut.</li>
                </ol>
              </div>
            </div>
          </section>
        </div>
      </div>

      {lines.length > 0 && (
        <section className="panel" aria-label="Transcript" style={{ marginTop: 14 }}>
          <div className="panel-title"><span>Transcript · edit any line</span><small>Same word count keeps exact timing; adding or removing words re-spreads the line</small></div>
          <div className="panel-body transcript" ref={transcriptRef}>
            {lines.map((line, index) => (
              <div key={line.id} className={`transcript-line ${current?.id === line.id ? "active" : ""}`}>
                <button type="button" className="transcript-time" onClick={() => seek(line.start)} aria-label={`Jump to ${formatClock(line.start)}`}>{formatClock(line.start)}</button>
                <div>
                  <LineEditor line={line} onCommit={(text) => editLine(line.id, text)} />
                  <div className="word-chips" aria-hidden="true">
                    {line.words.map((word, wordIndex) => (
                      <button type="button" tabIndex={-1} key={word.id} className={current?.id === line.id && wordIndex === currentWord ? "current" : ""} onClick={() => seek(word.start)} title={`${word.start.toFixed(2)}–${word.end.toFixed(2)} s`}>{word.text}</button>
                    ))}
                  </div>
                </div>
                <div className="btn-row" style={{ flexDirection: "column", gap: 4 }}>
                  <button type="button" className="btn small icon" onClick={() => mergeNext(line.id)} disabled={index === lines.length - 1} aria-label="Merge with next caption" title="Merge with next"><Merge size={13} /></button>
                  <button type="button" className="btn small icon danger" onClick={() => removeLine(line.id)} aria-label="Delete caption" title="Delete caption"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </ToolShell>
  );
}

/** Text area that commits on blur / ⌘↵ so retiming happens once per edit, not per keystroke. */
function LineEditor({ line, onCommit }: { line: CaptionLine; onCommit: (text: string) => void }) {
  const text = lineText(line);
  const [draft, setDraft] = useState(text);
  const [lastText, setLastText] = useState(text);
  if (text !== lastText) { setLastText(text); setDraft(text); }
  const commit = () => { if (draft.trim() !== text) onCommit(draft); };
  return <textarea aria-label={`Caption at ${line.start.toFixed(1)} seconds`} value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commit(); (event.target as HTMLTextAreaElement).blur(); } }} />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><CaptionsApp /></StrictMode>);
