/* eslint-disable @next/next/no-img-element -- Thumbnails are local data URLs; next/image does not apply to this Vite page. */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createRoot } from "react-dom/client";
import { ChevronLeft, ChevronRight, Dices, Download, FileJson, FolderOpen, Loader2, Lock, Pause, Play, Repeat, Scissors, Shuffle, Unlock, Upload, X } from "lucide-react";
import { alignTake, isAmbiguous, isSynced, resampleMono, type Alignment } from "../../../lib/autocut-align";
import type { ClipProfile } from "../../../lib/autocut-clips";
import { assignClip, generateCut, PRESET_ORDER, PRESETS, shotAt, slipShot, summarizeCut, swapShot, type CutClip, type CutRequest, type PresetId, type Shot } from "../../../lib/autocut-cut";
import { ASPECTS, autocutToCutFile, outputSize, shotsToCsv, type AspectId } from "../../../lib/autocut-export";
import { analyzeMusic, bestWindow, rescaleTempo, SECTION_LABELS, type MusicAnalysis } from "../../../lib/autocut-music";
import { ToolShell, baseName, downloadFile } from "../shell";
import { createFaceFinder, type FaceFinder } from "./faces";
import { ALIGN_RATE, analyzeClip, bufferToMono, decodeSong, decodeTrackMono, filesFromDrop, mediaKind, type ClipMeta } from "./media";
import { PreviewPlayer } from "./player";
import { renderCut, type RenderResult } from "./render";
import { SECTION_COLORS, Timeline } from "./timeline";
import "../tools.css";

const LIMITS = [
  "Beat, bar and tempo come from ScenePilot’s classical beat tracker plus its small downbeat model. Busy, rubato or beat-less music can read at half or double time (use ½× / 2×), and the “1” of the bar can land on the wrong beat.",
  "Section names (intro, verse, chorus, drop…) are guesses from loudness and texture changes — there’s no lyric or harmony analysis. They only steer pacing.",
  "Clip analysis looks at brightness, detail, motion and scene changes on tiny frames. It skips black, blown-out, blank and out-of-focus stretches; it doesn’t understand content, so a technically fine but boring shot can still be picked.",
  "Face detection is on by default (Google’s MediaPipe BlazeFace, Apache-2.0, ~230 KB, served from this site and run on your device). Faces raise hero shots and centre vertical crops; there is no tracking, so a moving subject can leave the crop. If the model can’t load, AutoCut keeps cutting without faces.",
  "Performance mode aligns each take to the song by cross-correlating their audio. It needs the song audible in the take (not just a click track or silence) and assumes takes play at normal speed. Repetitive songs can align a short take to the wrong chorus — check the ♪ offsets, and nudge them if needed.",
  "Hard cuts only: no transitions, speed ramps, effects or titles here. Export the ScenePilot project to add them in the editor.",
  "Video export uses WebCodecs (faster than real time on most machines): MP4 (H.264/AAC) where the browser can encode it, otherwise WebM. Browsers without a WebCodecs audio encoder can’t export video here — export the ScenePilot project instead.",
  "Everything happens in this tab. Very long clips or hundreds of files are slow to analyse and use a lot of memory; the preview may stutter on 4K sources (the export doesn’t).",
];

const CLIP_COLORS = ["#8a7cff", "#4ee3b0", "#ff8a5c", "#5ca7ff", "#f4c96b", "#ff6f91", "#b79cff", "#3ec8d7", "#c8ef4b", "#ffb35c", "#7fd1ff", "#e59cff"];
const LENGTHS: Array<{ id: "full" | "15" | "30" | "60"; label: string }> = [
  { id: "full", label: "Full song" },
  { id: "15", label: "Best 15 s" },
  { id: "30", label: "Best 30 s" },
  { id: "60", label: "Best 60 s" },
];

type ClipItem = {
  id: string;
  file: File;
  url: string;
  color: string;
  include: boolean;
  role: "auto" | "take" | "broll";
  status: "queued" | "analyzing" | "done" | "error";
  progress: number;
  error?: string;
  profile?: ClipProfile;
  meta?: ClipMeta;
  alignment?: Alignment;
  manualOffset?: number;
};

type SongChoice = { kind: "file"; index: number } | { kind: "clip"; id: string } | null;

const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

function AutoCutApp() {
  const [songFiles, setSongFiles] = useState<File[]>([]);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [songChoice, setSongChoice] = useState<SongChoice>(null);
  const [song, setSong] = useState<{ buffer: AudioBuffer; mono16: Float32Array; file: File; kind: "audio" | "video"; key: string } | null>(null);
  const [baseMusic, setBaseMusic] = useState<MusicAnalysis | null>(null);
  const [tempoFactor, setTempoFactor] = useState<1 | 0.5 | 2>(1);
  const [preset, setPreset] = useState<PresetId>("music-video");
  const [density, setDensity] = useState(0.5);
  const [seed, setSeed] = useState(1);
  const [length, setLength] = useState<"full" | "15" | "30" | "60">("full");
  const [aspect, setAspect] = useState<AspectId>("9:16");
  const [performance, setPerformance] = useState(false);
  const [performanceTouched, setPerformanceTouched] = useState(false);
  const [brollMix, setBrollMix] = useState(0.25);
  const [faces, setFaces] = useState(true);
  const [faceState, setFaceState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [locks, setLocks] = useState<Shot[]>([]);
  const [selected, setSelected] = useState(-1);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoomOverride, setZoom] = useState<number | null>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({ text: "Drop a song and your clips — or a whole folder — to start." });
  const [dragging, setDragging] = useState(false);
  const [quality, setQuality] = useState<1 | 0.5>(1);
  const [render, setRender] = useState<{ progress: number; message: string } | null>(null);
  const [result, setResult] = useState<(RenderResult & { url: string; name: string }) | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<PreviewPlayer | null>(null);
  const filesInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);
  const analyzing = useRef(false);
  const faceFinder = useRef<Promise<FaceFinder | null> | null>(null);
  const renderAbort = useRef<AbortController | null>(null);
  const thumbs = useRef(new Map<string, HTMLImageElement>());
  const [thumbVersion, setThumbVersion] = useState(0);

  // ---- Ingest -------------------------------------------------------------
  const addFiles = useCallback((incoming: File[]) => {
    const audio = incoming.filter((file) => mediaKind(file) === "audio");
    const video = incoming.filter((file) => mediaKind(file) === "video");
    const skipped = incoming.length - audio.length - video.length;
    setSongFiles((current) => {
      const known = new Set(current.map(fileKey));
      return [...current, ...audio.filter((file) => !known.has(fileKey(file)))];
    });
    setClips((current) => {
      const known = new Set(current.map((clip) => fileKey(clip.file)));
      const fresh = video.filter((file) => !known.has(fileKey(file))).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      return [...current, ...fresh.map((file, index) => ({
        id: `clip-${current.length + index + 1}`,
        file,
        url: URL.createObjectURL(file),
        color: CLIP_COLORS[(current.length + index) % CLIP_COLORS.length],
        include: true,
        role: "auto" as const,
        status: "queued" as const,
        progress: 0,
      }))];
    });
    setStatus({ text: `Added ${video.length} clip${video.length === 1 ? "" : "s"}${audio.length ? ` and ${audio.length} audio file${audio.length === 1 ? "" : "s"}` : ""}${skipped ? ` · skipped ${skipped} other file${skipped === 1 ? "" : "s"}` : ""}.` });
  }, []);

  // No audio file? Use the longest video's soundtrack (a performance take) as the song.
  const activeSong: SongChoice = songChoice
    ?? (songFiles.length ? { kind: "file", index: 0 } : clips.length ? { kind: "clip", id: [...clips].sort((a, b) => b.file.size - a.file.size)[0].id } : null);
  const songFile = activeSong?.kind === "file" ? songFiles[activeSong.index] : activeSong?.kind === "clip" ? clips.find((clip) => clip.id === activeSong.id)?.file : undefined;

  // ---- Song analysis --------------------------------------------------------
  useEffect(() => {
    if (!songFile) return;
    const key = fileKey(songFile);
    if (song?.key === key) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus({ text: `Decoding ${songFile.name}…` });
        const buffer = await decodeSong(songFile);
        if (cancelled) return;
        setStatus({ text: "Finding the beat, bars, energy and sections…" });
        await new Promise((resolve) => setTimeout(resolve, 20));
        const mono = bufferToMono(buffer);
        const music = analyzeMusic(mono, buffer.sampleRate);
        const mono16 = resampleMono(mono, buffer.sampleRate, ALIGN_RATE);
        if (cancelled) return;
        setSong({ buffer, mono16, file: songFile, kind: mediaKind(songFile) === "audio" ? "audio" : "video", key });
        setBaseMusic(music);
        setTempoFactor(1);
        setLocks([]);
        setSelected(-1);
        setClips((current) => current.map((clip) => ({ ...clip, alignment: undefined })));
        setStatus({ text: `${music.bpm} BPM · ${music.beatsPerBar}/4 · ${music.sections.length} sections${music.reliable ? "" : " · no clear beat: using an even 120 BPM grid"}.` });
      } catch (error) {
        if (!cancelled) setStatus({ text: error instanceof Error ? error.message : "That song couldn't be decoded.", error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [songFile, song?.key]);

  const music = useMemo(() => (baseMusic && tempoFactor !== 1 ? rescaleTempo(baseMusic, tempoFactor) : baseMusic), [baseMusic, tempoFactor]);
  // Fit the whole song in the timeline until the user zooms.
  const zoom = zoomOverride ?? Math.round(Math.min(120, Math.max(4, 1240 / Math.max(1, music?.duration ?? 60))));

  // ---- Clip analysis (one at a time) ----------------------------------------
  useEffect(() => {
    if (analyzing.current) return;
    const next = clips.find((clip) => clip.status === "queued");
    if (!next) return;
    analyzing.current = true;
    const update = (patch: Partial<ClipItem>) => setClips((current) => current.map((clip) => (clip.id === next.id ? { ...clip, ...patch } : clip)));
    (async () => {
      update({ status: "analyzing", progress: 0 });
      try {
        if (faces && !faceFinder.current) {
          setFaceState("loading");
          faceFinder.current = createFaceFinder().then(
            (finder) => { setFaceState("ready"); return finder; },
            (error) => {
              // Graceful fallback: keep analysing and cutting, just without faces.
              console.warn("AutoCut: face detection unavailable, continuing without it.", error);
              setFaceState("failed");
              return null;
            },
          );
        }
        const finder = faces ? await faceFinder.current : null;
        const { profile, meta } = await analyzeClip(next.id, next.file, { faces: finder, onProgress: (progress) => update({ progress }) });
        const image = new Image();
        image.onload = () => setThumbVersion((value) => value + 1);
        image.src = meta.thumbnail;
        thumbs.current.set(next.id, image);
        update({ status: "done", progress: 1, profile, meta });
      } catch (error) {
        update({ status: "error", error: error instanceof Error ? error.message : "Couldn't read this clip." });
      } finally {
        analyzing.current = false;
        setClips((current) => [...current]); // nudge the queue
      }
    })();
  }, [clips, faces]);

  // ---- Performance alignment: every analysed clip with audio vs the song ----
  const aligning = useRef(false);
  useEffect(() => {
    if (!song || aligning.current) return;
    const next = clips.find((clip) => clip.status === "done" && clip.meta?.hasAudio && !clip.alignment);
    if (!next) return;
    aligning.current = true;
    (async () => {
      let alignment: Alignment = { offset: 0, confidence: 0, margin: 0, overlap: 0, coverage: 0, refined: false };
      try {
        const take = await decodeTrackMono(next.file, ALIGN_RATE);
        if (take) alignment = alignTake(song.mono16, ALIGN_RATE, take.samples, ALIGN_RATE);
      } catch (error) { console.warn("AutoCut: could not align", next.file.name, error); }
      setClips((current) => current.map((clip) => (clip.id === next.id ? { ...clip, alignment } : clip)));
      aligning.current = false;
    })();
  }, [clips, song]);

  const syncedCount = clips.filter((clip) => clip.alignment && isSynced(clip.alignment)).length;
  // Takes that contain the song switch Performance mode on, until the user decides.
  const performanceOn = performanceTouched ? performance : syncedCount > 0;

  // ---- Cut ------------------------------------------------------------------
  const range = useMemo(() => {
    if (!music) return { start: 0, end: 0 };
    return length === "full" ? { start: 0, end: music.duration } : bestWindow(music, Number(length));
  }, [music, length]);

  const cutClips: CutClip[] = useMemo(() => clips.filter((clip) => clip.include && clip.status === "done" && clip.profile).map((clip) => {
    const profile = clip.profile!;
    const synced = clip.alignment && (clip.role === "take" || (clip.role === "auto" && isSynced(clip.alignment)));
    return {
      id: clip.id,
      duration: profile.duration,
      segments: profile.segments,
      energy: profile.energy,
      hero: profile.hero,
      offset: synced && clip.role !== "broll" ? clip.manualOffset ?? clip.alignment!.offset : undefined,
    };
  }), [clips]);

  const request: CutRequest | null = useMemo(() => (music && cutClips.length ? {
    music, clips: cutClips, preset, density, seed, range, performance: performanceOn, brollMix,
  } : null), [music, cutClips, preset, density, seed, range, performanceOn, brollMix]);

  // The cut is derived: regenerated whenever an input changes. Locked shots
  // (and swapped / re-assigned / slipped ones, which lock) are kept exactly.
  const shots = useMemo(() => (request ? generateCut({ ...request, locked: locks }) : []), [request, locks]);

  const summary = useMemo(() => summarizeCut(shots), [shots]);
  const clipById = useMemo(() => new Map(clips.map((clip) => [clip.id, clip])), [clips]);
  const clipColor = useCallback((id: string) => clipById.get(id)?.color ?? "#555", [clipById]);
  const thumbnail = useCallback((id: string) => (thumbVersion >= 0 ? thumbs.current.get(id) : undefined), [thumbVersion]);

  // ---- Preview ----------------------------------------------------------------
  const previewSize = useMemo(() => {
    const out = outputSize(aspect);
    const scale = Math.min(480 / out.height, 640 / out.width);
    return { width: Math.round(out.width * scale), height: Math.round(out.height * scale) };
  }, [aspect]);

  useEffect(() => {
    if (!song || !canvasRef.current) return;
    const player = new PreviewPlayer(canvasRef.current, song.buffer);
    player.onTime = setTime;
    player.onEnded = () => setPlaying(false);
    playerRef.current = player;
    return () => { player.dispose(); playerRef.current = null; setPlaying(false); };
  }, [song]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.shots = shots;
    player.range = range;
    player.clips = new Map(clips.map((clip) => [clip.id, { url: clip.url, focusX: clip.profile?.focusX ?? 0.5 }]));
    if (!player.playing) void player.seek(Math.min(Math.max(player.time, range.start), range.end));
  }, [shots, range, clips, previewSize]);

  const togglePlay = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.playing) {
      player.pause();
      setPlaying(false);
      const index = shots.indexOf(shotAt(shots, player.time) as Shot);
      if (index >= 0) setSelected(index);
    } else { await player.play(); setPlaying(true); }
  }, [shots]);
  const seek = useCallback((value: number) => { void playerRef.current?.seek(value); }, []);

  // ---- Shot edits -------------------------------------------------------------
  // While playing, the shot panel follows the playhead.
  const playingShot = shotAt(shots, time);
  const shown = playing && playingShot ? shots.indexOf(playingShot) : selected;
  const current = shown >= 0 ? shots[shown] : undefined;
  const pinLock = useCallback((shot: Shot) => {
    const end = shot.start + shot.duration;
    setLocks((list) => [...list.filter((lock) => lock.start + lock.duration <= shot.start + 1e-6 || lock.start >= end - 1e-6), { ...shot, locked: true }]);
  }, []);
  const selectShot = useCallback((index: number) => {
    setSelected(index);
    const shot = shots[index];
    if (shot) seek(shot.start + 0.001);
  }, [shots, seek]);
  const toggleLock = useCallback(() => {
    if (!current) return;
    if (current.locked) setLocks((list) => list.filter((lock) => Math.abs(lock.start - current.start) > 1e-6));
    else pinLock(current);
  }, [current, pinLock]);
  const swap = useCallback(() => {
    if (!request || !current) return;
    const next = swapShot(request, shots, shown, Date.now() % 100000);
    if (!next) { setStatus({ text: "No other clip fits this shot exactly." }); return; }
    pinLock(next[shown]);
    setStatus({ text: "Swapped and locked — re-rolls keep this shot." });
  }, [request, current, shots, shown, pinLock]);
  const assign = useCallback((clipId: string) => {
    if (!request || !current) return;
    const next = assignClip(request, shots, shown, clipId);
    if (!next) { setStatus({ text: "That clip doesn't have enough usable footage for this shot.", error: true }); return; }
    pinLock(next[shown]);
  }, [request, current, shots, shown, pinLock]);
  const slip = useCallback((delta: number) => {
    if (!current) return;
    const clip = clipById.get(current.clipId);
    pinLock(slipShot(shots, shown, clip?.profile?.duration ?? 0, delta)[shown]);
  }, [current, clipById, shots, shown, pinLock]);
  const reroll = useCallback(() => setSeed((value) => value + 1), []);
  const unlockAll = useCallback(() => setLocks([]), []);

  // Keyboard: space play, ←/→ shots, L lock, S swap, R re-roll.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " ") { event.preventDefault(); void togglePlay(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); selectShot(Math.min(shots.length - 1, shown + 1)); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); selectShot(Math.max(0, shown - 1)); }
      else if (event.key.toLowerCase() === "l") toggleLock();
      else if (event.key.toLowerCase() === "s") swap();
      else if (event.key.toLowerCase() === "r") reroll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, selectShot, shots.length, shown, toggleLock, swap, reroll]);

  // ---- Export -----------------------------------------------------------------
  const projectName = songFile ? baseName(songFile.name) : "autocut";
  const exportVideo = async () => {
    if (!song || !shots.length) return;
    renderAbort.current = new AbortController();
    playerRef.current?.pause();
    setPlaying(false);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setRender({ progress: 0, message: "Preparing" });
    try {
      const rendered = await renderCut({
        shots, range, aspect, scale: quality, song: song.buffer,
        clips: new Map(clips.map((clip) => [clip.id, { file: clip.file, focusX: clip.profile?.focusX ?? 0.5 }])),
        onProgress: (progress, message) => setRender({ progress, message }),
        signal: renderAbort.current.signal,
      });
      const name = `${projectName}-autocut-${aspect.replace(":", "x")}.${rendered.extension}`;
      const url = URL.createObjectURL(rendered.blob);
      setResult({ ...rendered, url, name });
      downloadFile(name, rendered.blob, rendered.mime);
      setStatus({ text: `Rendered ${name} (${rendered.codec}, ${(rendered.blob.size / 1e6).toFixed(1)} MB) in ${rendered.seconds.toFixed(1)} s.` });
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      setStatus({ text: aborted ? "Export cancelled." : error instanceof Error ? `Export failed: ${error.message}` : "Export failed.", error: !aborted });
    } finally {
      setRender(null);
      renderAbort.current = null;
    }
  };

  const exportProject = () => {
    if (!music || !songFile || !shots.length) return;
    const file = autocutToCutFile({
      project: `${projectName} · AutoCut`,
      music,
      shots,
      range,
      song: { name: songFile.name, kind: song?.kind ?? "audio", size: songFile.size, lastModified: songFile.lastModified },
      clips: clips.map((clip) => ({
        id: clip.id, name: clip.file.name, size: clip.file.size, lastModified: clip.file.lastModified,
        offset: clip.manualOffset ?? clip.alignment?.offset, synced: Boolean(clip.alignment && isSynced(clip.alignment)),
      })),
      settings: { preset, density, seed, performance: performanceOn, brollMix, aspect },
      savedAt: Date.now(),
    });
    downloadFile(`${projectName}-autocut.scenepilot.json`, JSON.stringify(file, null, 2), "application/json");
    setStatus({ text: "Saved the ScenePilot project. In the editor: import the song and the clips, then Import cut → this file." });
  };

  const exportCsv = () => downloadFile(`${projectName}-autocut-shots.csv`, shotsToCsv(shots, (id) => clipById.get(id)?.file.name ?? id), "text/csv");

  // ---- Drop zone --------------------------------------------------------------
  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles(await filesFromDrop(event.dataTransfer));
  };
  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles([...(event.target.files ?? [])]);
    event.target.value = "";
  };

  const pending = clips.filter((clip) => clip.status === "queued" || clip.status === "analyzing").length;
  const ready = Boolean(music && shots.length);
  const sectionSummary = music ? music.sections.map((section) => SECTION_LABELS[section.label]).join(" · ") : "";

  const dropzone = (
    <div
      className={`dropzone ac-drop${dragging ? " dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => filesInput.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === "Enter") filesInput.current?.click(); }}
    >
      <div>
        <Upload size={28} />
        <strong>Drop a song and your clips — or a whole folder</strong>
        <small>MP3/WAV/M4A + MP4/MOV/WebM. No song file? AutoCut uses the soundtrack of your longest clip (a performance take).</small>
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 10 }}>
          <button type="button" className="btn" onClick={(event) => { event.stopPropagation(); filesInput.current?.click(); }}><Upload size={14} /> Choose files</button>
          <button type="button" className="btn" onClick={(event) => { event.stopPropagation(); folderInput.current?.click(); }}><FolderOpen size={14} /> Choose folder</button>
        </div>
      </div>
    </div>
  );

  return (
    <ToolShell tool="autocut" limits={LIMITS}>
      <input ref={filesInput} type="file" multiple accept="audio/*,video/*,.mov,.mkv" hidden onChange={onPick} aria-label="Choose song and clips" />
      <input ref={folderInput} type="file" hidden onChange={onPick} aria-label="Choose a folder of clips" {...{ webkitdirectory: "", directory: "" }} />
      <div className="tool-heading">
        <div>
          <span className="eyebrow">Music video · edit · trailer · alpha</span>
          <h1>AutoCut.</h1>
          <p>Drop a song and a pile of clips. AutoCut finds the beat, the bars and the drop, picks the usable moments of every clip and cuts them to the music — calm where the song breathes, fast where it hits. Re-roll, lock the shots you love, export.</p>
        </div>
      </div>

      {!clips.length && !songFiles.length ? dropzone : (
        <div className="ac-layout">
          <section className="panel ac-stage-panel" aria-label="Preview">
            <div className="panel-title"><span>Preview</span><small>{music ? `${music.bpm} BPM · ${fmt(range.end - range.start)} · ${summary.shots} shots` : "waiting for the song"}</small></div>
            <div className="ac-stage">
              <canvas ref={canvasRef} width={previewSize.width} height={previewSize.height} style={{ width: previewSize.width, height: previewSize.height }} aria-label="AutoCut preview" />
              {playingShot && <span className="ac-badge" style={{ borderColor: SECTION_COLORS[playingShot.label] }}>{SECTION_LABELS[playingShot.label]}{playingShot.synced ? " · ♪ synced" : ""}</span>}
            </div>
            <div className="stage-controls">
              <button type="button" className="btn icon" onClick={() => void togglePlay()} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
              <input type="range" min={range.start} max={Math.max(range.start + 0.01, range.end)} step={0.01} value={Math.min(range.end, Math.max(range.start, time))} onChange={(event) => seek(Number(event.target.value))} aria-label="Playhead" disabled={!ready} />
              <output>{fmt(Math.max(0, time - range.start))} / {fmt(range.end - range.start)}</output>
            </div>
          </section>

          <section className="panel" aria-label="Cut settings">
            <div className="panel-title"><span>Cut</span><small>seed {seed}</small></div>
            <div className="panel-body ac-settings">
              <div className="field">
                <span>Song</span>
                <select
                  value={activeSong ? (activeSong.kind === "file" ? `file:${activeSong.index}` : `clip:${activeSong.id}`) : ""}
                  onChange={(event) => {
                    const [kind, value] = event.target.value.split(":");
                    setSongChoice(kind === "file" ? { kind: "file", index: Number(value) } : { kind: "clip", id: value });
                  }}
                >
                  {!activeSong && <option value="">Choose…</option>}
                  {songFiles.map((file, index) => <option key={fileKey(file)} value={`file:${index}`}>{file.name}</option>)}
                  {clips.map((clip) => <option key={clip.id} value={`clip:${clip.id}`}>Audio of {clip.file.name}</option>)}
                </select>
              </div>
              {music && (
                <div className="ac-music">
                  <span><b>{music.bpm}</b> BPM</span>
                  <span><b>{music.beatsPerBar}/4</b></span>
                  <span className={music.reliable ? "" : "warn"}>{music.reliable ? "beat locked" : "no clear beat"}</span>
                  <div className="segmented" role="group" aria-label="Tempo fix">
                    <button type="button" aria-pressed={tempoFactor === 0.5} onClick={() => setTempoFactor(tempoFactor === 0.5 ? 1 : 0.5)} title="The tempo reads double: halve it">½×</button>
                    <button type="button" aria-pressed={tempoFactor === 2} onClick={() => setTempoFactor(tempoFactor === 2 ? 1 : 2)} title="The tempo reads half: double it">2×</button>
                  </div>
                  <small className="ac-sections" title="Section guesses">{sectionSummary}</small>
                </div>
              )}
              <div className="field">
                <span>Style</span>
                <div className="preset-grid ac-presets">
                  {PRESET_ORDER.map((id) => (
                    <button key={id} type="button" aria-pressed={preset === id} onClick={() => setPreset(id)} title={PRESETS[id].blurb}>
                      {PRESETS[id].name}<i>{PRESETS[id].blurb}</i>
                    </button>
                  ))}
                </div>
              </div>
              <label className="slider-field">
                <span className="ac-label">Cut density</span>
                <output>{density < 0.34 ? "Relaxed" : density > 0.66 ? "Frantic" : "Balanced"}</output>
                <input type="range" min={0} max={1} step={0.05} value={density} onChange={(event) => setDensity(Number(event.target.value))} aria-label="Cut density" />
              </label>
              <div className="option-grid">
                <div className="field">
                  <span>Length</span>
                  <select value={length} onChange={(event) => setLength(event.target.value as typeof length)} aria-label="Length">
                    {LENGTHS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <span>Frame</span>
                  <div className="segmented" role="group" aria-label="Aspect ratio">
                    {(Object.keys(ASPECTS) as AspectId[]).map((id) => <button key={id} type="button" aria-pressed={aspect === id} onClick={() => setAspect(id)}>{id}</button>)}
                  </div>
                </div>
              </div>
              <div className="ac-mode">
                <label className="ac-check">
                  <input type="checkbox" checked={performanceOn} onChange={(event) => { setPerformance(event.target.checked); setPerformanceTouched(true); }} />
                  <span><b>Performance mode</b> — lip-sync takes to the song ({syncedCount} synced)</span>
                </label>
                {performanceOn && (
                  <label className="slider-field">
                    <span className="ac-label">B-roll mix</span>
                    <output>{Math.round(brollMix * 100)}%</output>
                    <input type="range" min={0} max={1} step={0.05} value={brollMix} onChange={(event) => setBrollMix(Number(event.target.value))} aria-label="B-roll mix" />
                  </label>
                )}
              </div>
              <div className="btn-row">
                <button type="button" className="btn primary" onClick={reroll} disabled={!request}><Dices size={15} /> Re-roll</button>
                <button type="button" className="btn small" onClick={unlockAll} disabled={!locks.length}><Unlock size={13} /> Unlock all</button>
                <label className="ac-seed">Seed <input type="number" value={seed} min={1} onChange={(event) => setSeed(Math.max(1, Math.round(Number(event.target.value) || 1)))} aria-label="Seed" /></label>
              </div>
            </div>
          </section>

          <section className="panel ac-timeline-panel" aria-label="Timeline">
            <div className="panel-title">
              <span>Timeline</span>
              <small>
                {summary.shots ? `${summary.shots} shots · avg ${summary.averageLength.toFixed(2)} s · ${summary.clipsUsed} clips${summary.synced ? ` · ${summary.synced} synced` : ""} · ${shots.filter((shot) => shot.locked).length} locked` : pending ? `analysing ${pending} clip${pending === 1 ? "" : "s"}…` : "add clips"}
                <label className="ac-zoom">Zoom <input type="range" min={4} max={120} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Timeline zoom" /></label>
              </small>
            </div>
            {music ? (
              <Timeline music={music} shots={shots} range={range} time={time} selected={shown} zoom={zoom} clipColor={clipColor} thumbnail={thumbnail} onSeek={seek} onSelect={selectShot} />
            ) : <p className="note" style={{ padding: 12 }}>The beat grid appears once the song is analysed.</p>}
            <div className="ac-shot-bar">
              {current ? (
                <>
                  <button type="button" className="btn icon small" onClick={() => selectShot(Math.max(0, shown - 1))} aria-label="Previous shot"><ChevronLeft size={14} /></button>
                  <span className="ac-shot-name"><i style={{ background: clipColor(current.clipId) }} /> #{shown + 1} · {clipById.get(current.clipId)?.file.name} · {fmt(current.start)}–{fmt(current.start + current.duration)} · {SECTION_LABELS[current.label]}{current.hero ? " · hero" : ""}{current.synced ? " · ♪ synced" : ` · in ${current.sourceStart.toFixed(2)} s`}</span>
                  <button type="button" className="btn icon small" onClick={() => selectShot(Math.min(shots.length - 1, shown + 1))} aria-label="Next shot"><ChevronRight size={14} /></button>
                  <button type="button" className="btn small" onClick={toggleLock} aria-pressed={Boolean(current.locked)}>{current.locked ? <><Lock size={13} /> Locked</> : <><Unlock size={13} /> Lock</>}</button>
                  <button type="button" className="btn small" onClick={swap}><Shuffle size={13} /> Swap</button>
                  {!current.synced && <button type="button" className="btn small" onClick={() => slip(-0.5)} title="Show earlier footage">−0.5 s</button>}
                  {!current.synced && <button type="button" className="btn small" onClick={() => slip(0.5)} title="Show later footage">+0.5 s</button>}
                  <select className="text-input ac-assign" value="" onChange={(event) => event.target.value && assign(event.target.value)} aria-label="Use a specific clip">
                    <option value="">Use clip…</option>
                    {clips.filter((clip) => clip.profile?.segments.length).map((clip) => <option key={clip.id} value={clip.id}>{clip.file.name}</option>)}
                  </select>
                </>
              ) : <span className="note">Click a shot to lock it, swap it or choose its clip. Keys: space play · ←/→ shots · L lock · S swap · R re-roll.</span>}
            </div>
          </section>

          <section className="panel" aria-label="Clips">
            <div className="panel-title"><span>Clips</span><small>{clips.length} · {clips.filter((clip) => clip.status === "done").length} analysed</small></div>
            <div className="panel-body ac-clips">
              {clips.map((clip) => (
                <div key={clip.id} className={`ac-clip${clip.include ? "" : " off"}`}>
                  <span className="ac-swatch" style={{ background: clip.color }} />
                  {clip.meta ? <img src={clip.meta.thumbnail} alt="" /> : <span className="ac-thumb-empty">{clip.status === "analyzing" ? <Loader2 size={14} className="spin" /> : clip.status === "error" ? "!" : "…"}</span>}
                  <div className="ac-clip-text">
                    <b title={clip.file.name}>{clip.file.name}</b>
                    <small>
                      {clip.status === "analyzing" && `analysing ${Math.round(clip.progress * 100)}%`}
                      {clip.status === "error" && <span className="warn">{clip.error}</span>}
                      {clip.profile && `${clip.profile.duration.toFixed(1)} s · ${clip.profile.usable.toFixed(1)} s usable · energy ${Math.round(clip.profile.energy * 100)}${clip.profile.faces ? " · faces" : ""}`}
                      {clip.profile?.notes.length ? <span className="warn"> · {clip.profile.notes.join(", ")}</span> : null}
                    </small>
                    {clip.alignment && (isSynced(clip.alignment) || clip.role === "take") && (
                      <small className="ac-sync">
                        ♪ starts at {(clip.manualOffset ?? clip.alignment.offset).toFixed(2)} s in the song · match {Math.round(clip.alignment.confidence * 100)}%
                        {isAmbiguous(clip.alignment) && <span className="warn"> · could also fit elsewhere</span>}
                        <input type="number" step={0.01} value={(clip.manualOffset ?? clip.alignment.offset).toFixed(2)} aria-label={`Sync offset for ${clip.file.name}`}
                          onChange={(event) => { const value = Number(event.target.value); setClips((list) => list.map((item) => (item.id === clip.id ? { ...item, manualOffset: Number.isFinite(value) ? value : undefined } : item))); }} />
                      </small>
                    )}
                  </div>
                  {performanceOn && clip.alignment && (
                    <select className="text-input ac-role" value={clip.role} aria-label={`Role of ${clip.file.name}`} onChange={(event) => setClips((list) => list.map((item) => (item.id === clip.id ? { ...item, role: event.target.value as ClipItem["role"] } : item)))}>
                      <option value="auto">{isSynced(clip.alignment) ? "Take (auto)" : "B-roll (auto)"}</option>
                      <option value="take">Take</option>
                      <option value="broll">B-roll</option>
                    </select>
                  )}
                  <label className="ac-include" title="Use this clip"><input type="checkbox" checked={clip.include} onChange={(event) => setClips((list) => list.map((item) => (item.id === clip.id ? { ...item, include: event.target.checked } : item)))} aria-label={`Use ${clip.file.name}`} /></label>
                </div>
              ))}
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button type="button" className="btn small" onClick={() => filesInput.current?.click()}><Upload size={13} /> Add files</button>
                <button type="button" className="btn small" onClick={() => folderInput.current?.click()}><FolderOpen size={13} /> Add folder</button>
                <label className="ac-check small" title="On-device face detection (MediaPipe BlazeFace, ~230 KB, served from this site). Applies to clips analysed after you change it.">
                  <input type="checkbox" checked={faces} onChange={(event) => setFaces(event.target.checked)} /> Find faces
                  {faces && faceState === "loading" && <span className="ac-face-note"> · loading model…</span>}
                  {faces && faceState === "failed" && <span className="ac-face-note" role="status"> · unavailable here, cutting without faces</span>}
                </label>
              </div>
            </div>
          </section>

          <section className="panel" aria-label="Export">
            <div className="panel-title"><span>Export</span><small>{ASPECTS[aspect].label} · {outputSize(aspect, quality).width}×{outputSize(aspect, quality).height}</small></div>
            <div className="panel-body">
              <div className="btn-row">
                <div className="segmented" role="group" aria-label="Quality">
                  <button type="button" aria-pressed={quality === 1} onClick={() => setQuality(1)}>1080p</button>
                  <button type="button" aria-pressed={quality === 0.5} onClick={() => setQuality(0.5)}>Draft</button>
                </div>
                {render ? (
                  <button type="button" className="btn danger" onClick={() => renderAbort.current?.abort()}><X size={14} /> Cancel</button>
                ) : (
                  <button type="button" className="btn primary" onClick={() => void exportVideo()} disabled={!ready}><Download size={15} /> Export video</button>
                )}
                <button type="button" className="btn" onClick={exportProject} disabled={!ready}><FileJson size={15} /> ScenePilot project</button>
                <button type="button" className="btn small" onClick={exportCsv} disabled={!ready}>Shot list CSV</button>
              </div>
              {render && (
                <div style={{ marginTop: 10 }}>
                  <div className="progress"><i style={{ width: `${Math.round(render.progress * 100)}%` }} /></div>
                  <p className="note">{render.message}</p>
                </div>
              )}
              {result && (
                <p className="note ac-result"><a href={result.url} download={result.name}><Download size={12} /> {result.name}</a> · {result.codec} · {(result.blob.size / 1e6).toFixed(1)} MB · rendered in {result.seconds.toFixed(1)} s</p>
              )}
              <div className="handoff">
                <span className="eyebrow"><Scissors size={12} /> Finish it in ScenePilot</span>
                <ol>
                  <li>Download the ScenePilot project.</li>
                  <li>Open the editor, load the song as the main source and import the same clips.</li>
                  <li>Import cut → the project file. Shots land on V1 at the same beats; a “Best N s” cut opens as the timeline in/out range.</li>
                </ol>
              </div>
            </div>
          </section>
        </div>
      )}
      <p className={`status-line${status.error ? " error" : ""}`} role="status">
        {(pending > 0 || (songFile && !music)) && !status.error ? <Loader2 size={14} className="spin" /> : <Repeat size={14} style={{ opacity: 0.5 }} />}
        {status.text}
      </p>
    </ToolShell>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><AutoCutApp /></StrictMode>);
