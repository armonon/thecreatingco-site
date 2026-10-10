"use client";

/* eslint-disable @next/next/no-img-element -- Local media and bundled sample artwork do not use an image server. */

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LockerSaveButton, SuiteMenu } from "./suite-ui";
import { ArrowDownToLine, ArrowRight, AudioLines, Check, ChevronRight, CircleHelp, Clapperboard, Download, Film, FolderOpen, Layers2, LoaderCircle, Maximize2, Music2, Palette, Pause, Play, Plus, Redo2, Save, Scissors, ShieldCheck, SkipBack, Smartphone, Sparkles, Type, Undo2, WandSparkles, X } from "lucide-react";
import type { AutoDirectorWorkspaceProps } from "./auto-director-workspace";
import type { BaseCut } from "../lib/sequencer";
import { ASPECT_LABELS, type OutputAspect } from "../lib/aspect";
import { EDIT_STYLES } from "../lib/styles";
import { formatTime } from "../lib/format";
import "./mobile-studio.css";
import { MobileTimelineRuler } from "./mobile-timeline-ruler";
import type { BrowserDownload } from "../lib/browser-download";

const alpineArtwork = new URL("../site/assets/alpine-source-20260911.jpg", import.meta.url).href;
const sampleVideo = new URL("../site/assets/scenepilot-loop.mp4", import.meta.url).href;
const TABS = [
  { id: "create", label: "Create", icon: Clapperboard },
  { id: "edit", label: "Edit", icon: Scissors },
  { id: "looks", label: "Looks", icon: Palette },
  { id: "export", label: "Export", icon: ArrowDownToLine },
] as const;
type Tab = typeof TABS[number]["id"];

type Props = Pick<AutoDirectorWorkspaceProps,
  "mainUrl" | "mainName" | "mainIsAudio" | "mainInputRef" | "assetInputRef" | "selectMainMedia" | "selectAssets"
  | "assets" | "analysis" | "analyzing" | "rendering" | "renderProgress" | "renderableSequence"
  | "previewStage" | "previewRef" | "currentTime" | "duration" | "playing" | "seek" | "togglePlayback"
  | "styleId" | "applyStyle" | "checkpoint" | "setStyleId" | "aspect" | "setAspect" | "status"
  | "autoEnergy" | "chooseAutoEnergy" | "montagePace" | "changeMontagePace"
  | "bpm" | "titleDraft" | "setTitleDraft" | "addTitle" | "titles" | "removeTitle"
  | "exportPlan" | "transcribing"
> & {
  baseCuts: BaseCut[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  onSave(): Promise<unknown>;
  onRestore(): Promise<unknown>;
  onPause(): void;
  browserDownload: BrowserDownload | null;
  onDismissDownload(): void;
  missingMediaCount: number;
  onImportProject(file: File): Promise<void>;
  onLoadSample(file: File): Promise<void>;
  onGenerate(): Promise<void>;
  onSplit(): void;
  onFullscreen(): void;
  onExport(): void;
  onCancelAnalysis(): void;
  onCancelRender(): void;
  analysisPercent: number;
  analysisMessage: string;
  exportReady: boolean;
  exportMessage: string;
  dimensions: { width: number; height: number };
  previewAspect: number;
  energyBars: number[];
  automationControls: ReactNode;
  draftReview: ReactNode;
  lightingControls: ReactNode;
  canCancelTranscription: boolean;
};

export function MobileStudio({ mainInputRef, assetInputRef, previewRef, ...p }: Props) {
  const [tab, setTab] = useState<Tab>("create");
  const [helpOpen, setHelpOpen] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const helpRef = useRef<HTMLDialogElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const [openingProject, setOpeningProject] = useState(false);
  const fileActionRef = useRef(false);
  const [fileAction, setFileAction] = useState("");
  const [fileError, setFileError] = useState("");
  const busy = p.analyzing || p.rendering || p.transcribing || loadingSample || openingProject || Boolean(fileAction);
  const hasMedia = Boolean(p.mainUrl);
  const hasProject = hasMedia || p.assets.length > 0 || p.baseCuts.length > 0 || p.titles.length > 0;
  const name = p.mainName.replace(/\.[^/.]+$/, "");
  const activeStyle = EDIT_STYLES.find((style) => style.id === p.styleId);
  const cuts = p.baseCuts.length ? p.baseCuts : hasMedia && !p.mainIsAudio
    ? [{ id: "source", start: 0, duration: p.duration }] : [];
  const progress = Math.min(100, Math.max(0, (p.currentTime / Math.max(0.01, p.duration)) * 100));
  const canSplit = cuts.some(cut => p.currentTime > cut.start + .03 && p.currentTime < cut.start + cut.duration - .03);
  const libraryAssets = p.assets.filter(asset => asset.id !== "__main__");
  const sourceCount = libraryAssets.length + Number(hasMedia || p.assets.some(asset => asset.id === "__main__"));

  async function runFileAction(label: string, action: () => Promise<unknown>) {
    if (fileActionRef.current || busy) return;
    fileActionRef.current = true; setFileAction(label); setFileError("");
    try { await action(); }
    catch (error) { setFileError(error instanceof Error ? error.message : "The file operation failed. Please try again."); }
    finally { fileActionRef.current = false; setFileAction(""); }
  }

  function navigate(next: Tab) {
    setTab(next);
    if (next === "export" && p.playing) p.togglePlayback();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function loadSample() {
    setLoadingSample(true);
    setSampleError("");
    try {
      const response = await fetch(sampleVideo);
      if (!response.ok) throw new Error("Sample unavailable");
      await p.onLoadSample(new File([await response.blob()], "Light study.mp4", { type: "video/mp4" }));
    } catch {
      setSampleError("The sample couldn't load. Try again or add a video from your phone.");
    } finally {
      setLoadingSample(false);
    }
  }

  const aspectPicker = <div className="ms-ratios" role="group" aria-label="Video format">
    {([
      ["9:16", "Reels", "portrait"], ["16:9", "YouTube", "landscape"], ["1:1", "Square", "square"], ["source", "Original", "original"],
    ] as const).map(([ratio, label, shape]) => <button key={ratio} aria-pressed={p.aspect === ratio} disabled={busy} className={p.aspect === ratio ? "is-selected" : ""} onClick={() => { p.checkpoint(); p.setAspect(ratio); }}>
      <i className={`ms-ratio-icon ms-ratio-${shape}`} /><strong>{ratio === "source" ? "Original" : ratio}</strong><span>{ratio === "source" ? "Keep size" : label}</span>
    </button>)}
  </div>;

  return <main className="mobile-studio" data-mobile-tab={tab}>
    <header className="ms-header">
      <button className="ms-brand" aria-label="ScenePilot home" onClick={() => navigate("create")}><span><Scissors size={19} strokeWidth={2.4} /></span><strong>scene<span>pilot</span><small>STUDIO</small></strong></button>
      <div className="ms-header-actions">
        <span className="ms-local"><i /> ON DEVICE</span>
        <button className="ms-icon" aria-label="About this mobile workspace" onClick={() => { setHelpOpen(true); helpRef.current?.showModal(); }}><CircleHelp size={20} /></button>
        <SuiteMenu />
      </div>
    </header>

    <input hidden type="file" accept="video/*,audio/*" aria-label="Import a video or song" ref={mainInputRef} disabled={busy} onChange={p.selectMainMedia} />
    <input hidden type="file" accept="video/*,audio/*,image/*" aria-label="Add footage or relink source files" multiple ref={assetInputRef} disabled={busy} onChange={p.selectAssets} />
    <input hidden type="file" accept=".json,.otio,application/json" aria-label="Open project file" ref={projectFileRef} disabled={busy || openingProject} onChange={async event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
      if (!file || openingProject) return;
      setOpeningProject(true);
      setFileError("");
      try { await p.onImportProject(file); }
      catch (error) { setFileError(error instanceof Error ? error.message : "The project could not be opened."); }
      finally { setOpeningProject(false); }
    }} />
    <div className="ms-home-secondary"><button disabled={busy || openingProject} onClick={() => projectFileRef.current?.click()}><FolderOpen size={16} />{openingProject ? "Opening project..." : "Open project file"}</button>
      {p.assets.some(asset => !asset.url) && <button disabled={busy || openingProject} onClick={() => assetInputRef.current?.click()}><Plus size={16} />Relink source files</button>}
    </div>

    <div className="ms-content">
      {fileAction && <p className="ms-status" role="status">{fileAction}</p>}
      {fileError && <p className="ms-error" role="alert">{fileError}</p>}
      {!hasProject && tab === "create" ? <>
        <div className="ms-intro"><span className="ms-eyebrow"><i /> YOUR POCKET STUDIO</span><h1>Make a scene.</h1><p>Your footage. Your rhythm. Your next great cut.</p></div>
        <section className="ms-hero" aria-label="Start creating">
          <img src={alpineArtwork} alt="Sunlight falling over snow-covered mountain peaks" fetchPriority="high" />
          <div className="ms-hero-top"><span><span className="ms-rec" /> READY WHEN YOU ARE</span><span>01 / ∞</span></div>
          <div className="ms-frame-corner ms-corner-tl" /><div className="ms-frame-corner ms-corner-br" />
          <div className="ms-hero-copy"><span>LESS SETUP. MORE STORY.</span><h2>Find your<br /><em>own rhythm.</em></h2><p>A little footage. A whole lot of possibility.</p></div>
          <button className="ms-hero-add" aria-label="Start with your video or song" disabled={busy} onClick={() => mainInputRef.current?.click()}><Plus size={27} /></button>
        </section>
        <button className="ms-primary ms-start" disabled={busy} onClick={() => mainInputRef.current?.click()}><Plus size={20} /> New project <ArrowRight size={19} /></button>
        <div className="ms-home-secondary"><button disabled={busy} onClick={() => void runFileAction("Restoring project…", p.onRestore)}><FolderOpen size={16} /> Restore browser save</button><button disabled={busy} onClick={() => void loadSample()}>{loadingSample ? <LoaderCircle className="ms-spin" size={16} /> : <Play size={14} />} Try a sample</button></div>
        {sampleError && <p className="ms-error" role="alert">{sampleError}</p>}
        <div className="ms-section-heading"><h2>A good cut starts here</h2><span>THE SHORT VERSION</span></div>
        <div className="ms-how"><div><span>01</span><Film size={20} /><strong>Bring the clips</strong><p>Video, photos, a song.<br />Start with what you have.</p></div><div><span>02</span><AudioLines size={20} /><strong>Catch the rhythm</strong><p>Let Auto Director<br />find your first cut.</p></div><div><span>03</span><ArrowDownToLine size={20} /><strong>Make it yours</strong><p>Fine-tune the feeling.<br />Take it anywhere.</p></div></div>
        <p className="ms-privacy"><ShieldCheck size={14} /> Your media stays on your device.</p>
      </> : <>
        <div className="ms-workspace-heading"><div><span className="ms-eyebrow">{tab === "create" ? "THE FIRST CUT" : tab === "edit" ? "EVERY FRAME COUNTS" : tab === "looks" ? "SET THE FEELING" : "READY FOR THE WORLD"}</span><h1>{tab === "create" ? "Your next scene." : tab === "edit" ? "In the details." : tab === "looks" ? "Find your look." : "Take it with you."}</h1></div>{hasProject && <button className="ms-icon" disabled={busy} onClick={() => void runFileAction("Saving project…", p.onSave)} aria-label="Save project"><Save size={19} /></button>}</div>

        <section className={`ms-viewer ${hasMedia ? "has-media" : ""}`} aria-label="Video preview">
          <div className="ms-viewer-label"><span><i /> {hasMedia ? name : "YOUR CANVAS"}</span><span>{hasMedia ? ASPECT_LABELS[p.aspect] : "NO MEDIA YET"}</span></div>
          <div className="ms-preview" ref={previewRef} style={{ "--ms-preview-ratio": p.previewAspect } as CSSProperties}>
            {p.previewStage(<button className="ms-empty-preview" disabled={busy} onClick={() => mainInputRef.current?.click()}><Plus size={30} /><strong>It starts with a clip.</strong><span>Add a video or song to begin</span></button>)}
          </div>
          {hasMedia && <div className="ms-transport"><span>{formatTime(p.currentTime)} <small>/ {formatTime(p.duration)}</small></span><div><button className="ms-icon" aria-label="Back to start" onClick={() => { p.onPause(); p.seek(0); }} disabled={p.rendering}><SkipBack size={18} /></button><button className="ms-play" aria-label={p.playing ? "Pause preview" : "Play preview"} onClick={p.togglePlayback} disabled={p.rendering}>{p.playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button className="ms-icon" aria-label="Expand preview" onClick={p.onFullscreen}><Maximize2 size={17} /></button></div><span className="ms-preview-tag">PREVIEW</span></div>}
        </section>
        {hasMedia && <label className="ms-scrubber"><span className="ms-sr-only">Preview position</span><input aria-label="Preview position" type="range" min="0" max={p.duration} step="0.01" value={Math.min(p.currentTime, p.duration)} disabled={p.rendering} onPointerDown={p.onPause} onKeyDown={p.onPause} onChange={(event) => p.seek(Number(event.target.value))} style={{ "--ms-progress": `${progress}%` } as CSSProperties} /></label>}

        {tab === "create" && <section className="ms-panel">
          <div className="ms-section-heading"><h2>Your ingredients</h2><span>{sourceCount} SOURCE{sourceCount === 1 ? "" : "S"}</span></div>
          <button className="ms-media-row" disabled={busy} onClick={() => mainInputRef.current?.click()}><span className="ms-media-icon">{p.mainIsAudio ? <Music2 size={21} /> : <Film size={21} />}</span><span><strong>{p.mainName}</strong><small>{p.mainIsAudio ? "Your soundtrack" : "Main video"} · {formatTime(p.duration)}</small></span><span className="ms-replace">Replace</span></button>
          <button className="ms-media-row ms-add-footage" disabled={busy} onClick={() => assetInputRef.current?.click()}><span className="ms-media-icon"><Plus size={21} /></span><span><strong>{libraryAssets.length ? `${libraryAssets.length} ${libraryAssets.length === 1 ? "clip" : "clips"} in your library` : "Add your footage"}</strong><small>{p.mainIsAudio ? "Videos & photos to cut to your song" : "B-roll, extra angles & photos"}</small></span><ChevronRight size={18} /></button>
          {libraryAssets.length > 0 && <div className="ms-assets">{libraryAssets.map((asset) => <span key={asset.id}><Layers2 size={12} />{asset.name}</span>)}</div>}
          <div className="ms-section-heading"><h2>Made for your screen</h2><Smartphone size={16} /></div>
          {aspectPicker}
          <button className="ms-look-link" disabled={busy} onClick={() => navigate("looks")}><span><WandSparkles size={19} /><span><strong>{activeStyle?.label ?? "Auto style"}</strong><small>{activeStyle ? "Your chosen creative direction" : "Let the footage set the feeling"}</small></span></span><ChevronRight size={18} /></button>
          <details className="ms-automation"><summary>Timing & editing rules</summary>{p.automationControls}</details>
          <button className="ms-primary" disabled={busy || !hasMedia || (p.mainIsAudio && !p.assets.length)} onClick={() => void p.onGenerate()}><Sparkles size={19} />{p.analyzing ? "Finding your rhythm…" : p.analysis ? "Rebuild the cut" : "Make my first cut"}<ArrowRight size={18} /></button>
          <p className="ms-hint">{p.mainIsAudio && !p.assets.length ? "Add at least one video or photo to build your cut." : "Generate a draft, review it below, then apply. Your timeline stays unchanged until you choose."}</p>
          <div className="ms-draft-review">{p.draftReview}</div>
          {p.analysis && <button className="ms-secondary" onClick={() => navigate("edit")}><Scissors size={17} /> Refine your edit <ArrowRight size={16} /></button>}
        </section>}

        {tab === "edit" && <section className="ms-panel">
          <div className="ms-section-heading"><h2>Your timeline <small>{cuts.length} {cuts.length === 1 ? "clip" : "clips"}</small></h2><div className="ms-history"><button className="ms-icon" aria-label="Undo edit" disabled={!p.canUndo || busy} onClick={p.onUndo}><Undo2 size={18} /></button><button className="ms-icon" aria-label="Redo edit" disabled={!p.canRedo || busy} onClick={p.onRedo}><Redo2 size={18} /></button></div></div>
          {hasMedia ? <>
            <div className="ms-timeline" role="group" aria-label="Sequence timeline"><MobileTimelineRuler duration={p.duration} time={p.currentTime} disabled={busy} onSeek={p.seek} onPause={p.onPause} /><div className="ms-track">{cuts.map((cut, index) => <button key={cut.id} style={{ left: `${Math.max(0, cut.start / Math.max(.01, p.duration) * 100)}%`, width: `${Math.max(0, Math.min(cut.duration, p.duration - cut.start) / Math.max(.01, p.duration) * 100)}%` }} aria-label={`Seek to clip ${index + 1}, ${formatTime(cut.start)}`} disabled={busy} onClick={() => { p.onPause(); p.seek(cut.start + Math.min(.1, cut.duration / 2)); }}><Film size={14} /><span>{String(index + 1).padStart(2, "0")}</span></button>)}{!cuts.length && <span className="ms-track-empty">Add footage, then make your first cut</span>}<i className="ms-playhead" style={{ left: `${progress}%` }} /></div><div className="ms-waveform" role="img" aria-label={p.analysis ? "Analyzed audio energy" : "Audio analysis pending"}>{p.analysis ? p.energyBars.slice(0, 64).map((height, index) => <i key={index} style={{ height: `${Math.max(8, Math.min(100, height))}%` }} />) : <span><AudioLines size={16} /> Make a first cut to analyze the rhythm</span>}</div></div>
            {cuts.length > 0 && <label className="ms-clip-picker">Clip
              <select aria-label="Jump to clip" disabled={busy} value={cuts.find((cut) => p.currentTime >= cut.start && p.currentTime < cut.start + cut.duration)?.id ?? ""} onChange={(event) => {
                const cut = cuts.find((item) => item.id === event.target.value);
                if (cut) { p.onPause(); p.seek(cut.start + Math.min(.1, cut.duration / 2)); }
              }}>
                <option value="" disabled>Select clip</option>
                {cuts.map((cut, index) => <option key={cut.id} value={cut.id}>{index + 1} · {formatTime(cut.start)}</option>)}
              </select>
            </label>}
            <button className="ms-secondary" disabled={busy || !canSplit} onClick={p.onSplit}><Scissors size={17} /> Split at playhead <span>{formatTime(p.currentTime)}</span></button>
            <p className="ms-hint">Drag the time ruler to scrub. Tap a clip to jump to it. {!canSplit && "Move inside a clip to split it."}</p>
          </> : <p className="ms-empty-note">Import a video or song to start your timeline.</p>}
          <div className="ms-section-heading"><h2>Set the pace</h2><AudioLines size={17} /></div>
          <div className="ms-segmented" role="group" aria-label="Edit pace">{([ ["cinematic", "Slow burn"], ["balanced", "In the groove"], ["frenetic", "Full energy"] ] as const).map(([value, label]) => <button key={value} aria-pressed={p.montagePace === value} disabled={busy || !p.analysis || !p.assets.length} onClick={() => p.changeMontagePace(value)}>{label}</button>)}</div>
          {(!p.analysis || !p.assets.length) && <p className="ms-hint">Add footage and make your first cut to unlock beat-based pacing.</p>}
          {p.analysis && <button className="ms-secondary" onClick={() => navigate("create")}>Review generated drafts <ArrowRight size={16} /></button>}
          <div className="ms-section-heading"><h2>Say something</h2><Type size={17} /></div>
          <form className="ms-title-form" onSubmit={(event) => { event.preventDefault(); if (!busy && hasMedia && p.titleDraft.trim()) p.addTitle(); }}><input aria-label="Title text" placeholder="A few words for this moment…" value={p.titleDraft} disabled={busy || !hasMedia} onChange={(event) => p.setTitleDraft(event.target.value)} /><button className="ms-icon" aria-label="Add title at playhead" disabled={busy || !hasMedia || !p.titleDraft.trim()}><Plus size={20} /></button></form>
          {p.titles.map((title) => <div className="ms-title-row" key={title.id}><Type size={14} /><span>{title.text}</span><small>{formatTime(title.start)}</small><button className="ms-icon" aria-label={`Remove title ${title.text}`} disabled={busy} onClick={() => p.removeTitle(title.id)}><X size={15} /></button></div>)}
        </section>}

        {tab === "looks" && <section className="ms-panel">
          <div className="ms-section-heading"><h2>One tap. A whole mood.</h2><span>{EDIT_STYLES.length + 1} STYLES</span></div>
          <div className="ms-looks" role="group" aria-label="Creative style"><button className={`ms-style ms-style-auto ${p.styleId === "auto" ? "is-selected" : ""}`} aria-pressed={p.styleId === "auto"} disabled={busy} onClick={() => { p.checkpoint(); p.setStyleId("auto"); }}><span className="ms-style-art"><Sparkles size={28} />{p.styleId === "auto" && <i><Check size={13} /></i>}</span><strong>Auto</strong><small>Follow the feeling</small></button>{EDIT_STYLES.map((style) => <button className={`ms-style ms-style-${style.id} ${p.styleId === style.id ? "is-selected" : ""}`} key={style.id} aria-pressed={p.styleId === style.id} disabled={busy} onClick={() => p.applyStyle(style)}><span className="ms-style-art"><img src={alpineArtwork} alt="" loading="lazy" />{p.styleId === style.id && <i><Check size={13} /></i>}</span><strong>{style.label}</strong><small>{style.id === "cinematic" ? "Room to breathe" : style.id === "hyperpop" ? "Turn it all the way up" : style.id === "vhs" ? "A little nostalgia" : style.id === "noir" ? "Less color. More mood." : "Made for the drop"}</small></button>)}</div>
          <p className="ms-style-description"><WandSparkles size={17} /><span>{activeStyle?.blurb ?? "Auto chooses a style from the rhythm and energy when you build your first cut."}</span></p>
          <div className="ms-section-heading"><h2>Energy</h2><span>{p.analysis ? `${Math.round(p.bpm)} BPM` : "YOUR CREATIVE DIRECTION"}</span></div>
          <div className="ms-segmented" role="group" aria-label="Creative energy">{([ ["smooth", "Mellow"], ["dynamic", "Balanced"], ["maximum", "All in"] ] as const).map(([value, label]) => <button key={value} aria-pressed={p.autoEnergy === value} disabled={busy} onClick={() => p.chooseAutoEnergy(value)}>{label}</button>)}</div>
          <p className="ms-hint">Looks combine color, transitions, motion, and cut pacing.</p>
          {p.analysis && <><p className="ms-hint">After analysis, a style creates a separate draft. Apply it below to change your edit.</p><div className="ms-draft-review">{p.draftReview}</div></>}
          <div className="ms-lighting">{p.lightingControls}</div>
          <button className="ms-secondary" onClick={() => navigate(hasMedia ? "edit" : "create")}><ArrowRight size={17} />{hasMedia ? "Back to your edit" : "Start creating"}</button>
        </section>}

        {tab === "export" && <section className="ms-panel">
          <div className="ms-section-heading"><h2>Where’s it going?</h2><span>CHOOSE YOUR FRAME</span></div>{aspectPicker}
          {!["source", "9:16", "16:9", "1:1"].includes(p.aspect) && <p className="ms-hint">Current format: {ASPECT_LABELS[p.aspect as OutputAspect]}</p>}
          <div className="ms-export-settings"><div><span>Resolution</span><strong>{p.dimensions.width} × {p.dimensions.height}</strong></div><div><span>Frame rate</span><strong>30 fps</strong></div><div><span>File format</span><strong>MP4 <small>H.264</small></strong></div></div>
          <div className="ms-export-note"><ShieldCheck size={21} /><div><strong>Made here. Stays here.</strong><p>Your video is rendered on this device.<br />No upload. No watermark.</p></div></div>
          {!p.exportReady && hasMedia && <p className="ms-export-warning" role="status">{p.exportMessage}</p>}
          <button className="ms-primary" disabled={busy || !p.exportReady || !p.renderableSequence || p.missingMediaCount > 0} onClick={p.onExport}>{p.rendering ? <LoaderCircle className="ms-spin" size={19} /> : <Download size={19} />}{p.rendering ? `Exporting ${Math.round(p.renderProgress * 100)}%` : "Export video"}<ArrowRight size={18} /></button>
          {p.missingMediaCount > 0 && <p className="ms-export-warning" role="status">Relink {p.missingMediaCount} missing source{p.missingMediaCount === 1 ? "" : "s"} used by this edit before exporting video.</p>}
          <p className="ms-hint">{hasMedia ? "Render here, then tap Save video. Keep this page open until the file is saved." : "Add a video or song before exporting."}</p>
          {p.browserDownload && <section className="ms-download-ready" aria-label="Completed video">
            <h3>Your video is ready</h3><p>{p.browserDownload.name} · {(p.browserDownload.size / 1024 / 1024).toFixed(1)} MB</p>
            {!busy && <a className="ms-primary" href={p.browserDownload.url} download={p.browserDownload.name}><Download size={18} />Save video</a>}
            {!busy && <LockerSaveButton className="ms-secondary" label="Save to Locker" item={async () => p.browserDownload ? { name: p.browserDownload.name, type: p.browserDownload.name.endsWith(".webm") ? "video/webm" : "video/mp4", blob: await (await fetch(p.browserDownload.url)).blob() } : null} />}
            <p className="ms-hint">This is your last completed render; later edits are not included. Save it before leaving the page. It stays available until replaced or discarded.</p>
            <button className="ms-secondary" disabled={busy} onClick={p.onDismissDownload}>Discard rendered file</button>
          </section>}
          <button className="ms-secondary" disabled={busy || !hasProject} onClick={p.exportPlan}><Save size={16} /> Download editable project</button>
          {hasProject && !hasMedia && <p className="ms-hint">Your edit can still be saved. Relink the source media before previewing or exporting video.</p>}
        </section>}
      </>}

      {(p.analyzing || p.rendering || p.transcribing) && <section className="ms-job" aria-label={p.rendering ? "Export progress" : "Analysis progress"}><div><LoaderCircle className="ms-spin" size={17} /><strong>{p.rendering ? "Rendering your video" : p.transcribing ? "Adding captions" : "Finding the story"}</strong><button disabled={p.transcribing && !p.canCancelTranscription} onClick={p.rendering ? p.onCancelRender : p.onCancelAnalysis}>Cancel</button></div><progress aria-label="Job progress" max="100" value={p.rendering ? p.renderProgress * 100 : p.analysisPercent} /><p>{p.rendering ? p.status : p.analysisMessage || p.status}</p></section>}
      {(hasMedia || p.status !== "Load a video or song to analyze its rhythm") && <p className="ms-status" role="status"><span />{p.status}</p>}
    </div>

    <nav className="ms-bottom-nav" aria-label="Mobile workspace">{TABS.map(({ id, label, icon: Icon }) => <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => navigate(id)}><span><Icon size={21} strokeWidth={tab === id ? 2.2 : 1.7} /></span><strong>{label}</strong>{tab === id && <i />}</button>)}</nav>

    <dialog ref={helpRef} className="ms-help" onClose={() => setHelpOpen(false)} aria-labelledby="ms-help-title">
      {helpOpen && <><div className="ms-section-heading"><span className="ms-eyebrow">SCENEPILOT / MOBILE</span><button className="ms-icon" aria-label="Close help" onClick={() => helpRef.current?.close()}><X size={20} /></button></div><h2 id="ms-help-title">A studio that<br />goes with you.</h2><p>Import a video, or pair a song with footage. Auto Director builds a first cut; Edit and Looks make it yours.</p><p>Save your project to this browser, or download an editable project file from Export. Keep your original media for reopening it.</p><p>MP4 export depends on your browser’s video encoder. Export checks your device before starting.</p><div className="ms-export-note"><ShieldCheck size={22} /><span>Your media is processed locally on your device.</span></div><button className="ms-primary" onClick={() => helpRef.current?.close()}>Let’s make something <ArrowRight size={18} /></button></>}
    </dialog>
  </main>;
}
