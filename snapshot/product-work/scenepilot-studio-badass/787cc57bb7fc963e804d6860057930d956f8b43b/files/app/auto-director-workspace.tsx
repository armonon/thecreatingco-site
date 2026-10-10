import { Activity, ChevronDown, Download, Film, FolderOpen, Lock, Music2, Pause, Play, Plus, RefreshCw, Save, Scissors, Settings2, Sparkles, Split, Type, Upload, Video, WandSparkles, X, Zap } from "lucide-react";
import type { ChangeEvent, Dispatch, DragEvent, InputHTMLAttributes, MutableRefObject, ReactNode, RefObject, SetStateAction } from "react";
import { ASPECT_HINTS, ASPECT_LABELS, type OutputAspect } from "../lib/aspect";
import { CREATOR_PROFILES, type CreatorGoal } from "../lib/instant-create";
import { EDIT_STYLES, type EditStyle } from "../lib/styles";
import { PUNCH_PRESETS, SHAKE_PRESETS } from "../lib/motion";
import { SPEED_PRESETS } from "../lib/speed";
import { STUTTER_PRESETS } from "../lib/stutter";
import { TEXT_ANIMATORS, type TextAnimator } from "../lib/text-animate";
import { NEUTRAL_GRADE_ADJUST, isNeutralGrade, type GradeAdjust } from "../lib/grade";
import { formatTime } from "../lib/format";
import type { AnalysisResult } from "../lib/analysis-engine";
import type { EnergyArc } from "../lib/arc";
import type { EditionCapabilities } from "./edition";
import type { AutoVariation, SectionRule } from "./editor-foundation";
import type { MediaAsset } from "./media-browser";
import type { Placement } from "./editor-foundation";
import type { TitleCue, TitleStyle } from "../lib/titles";
import type { StrobeBand, StrobeBlend, StrobeMode, StrobeShape } from "../lib/strobe";
import type { TransitionType } from "../lib/transitions";
import { AutoDirectorSectionEditor } from "./auto-director-section-editor";
import { CinematicIntelligencePanel } from "./cinematic-intelligence-panel";
import type { CinematicAssemblyKind } from "../lib/cinematic-analysis";
import type { ProjectAssemblyKind, ProjectIntelligence } from "../lib/project-intelligence";
import { ProjectIntelligencePanel } from "./project-intelligence-panel";

type SetValue<T> = Dispatch<SetStateAction<T>>;
type AutoEnergy = "smooth" | "dynamic" | "maximum";
type WorkspaceView = "sequence" | "composition";
type EditorMode = "auto" | "pro";

export type AutoDirectorWorkspaceProps = {
  analysis: AnalysisResult | null; analysisAbortRef: MutableRefObject<AbortController | null>; analyzing: boolean;
  addTitle(): void; applyAutoVariation(value: AutoVariation): void; applyBeatGrid(bpm: number, offset: number): void; applyStrobePreset(value: string): void; applyStyle(value: EditStyle): void;
  applyCinematicAssembly(value: CinematicAssemblyKind): void;
  applyProjectAssembly(value: ProjectAssemblyKind): void; analyzeProjectLibrary(): void; deepProjectAnalyzing: boolean;
  projectIntelligence: ProjectIntelligence | null; storyBrief: string; setStoryBrief(value: string): void; inspectProjectAsset(assetId: string, time: number): void;
  aspect: OutputAspect; assetInputRef: RefObject<HTMLInputElement | null>; assets: MediaAsset[]; audioReactive: boolean; autoEnergy: AutoEnergy;
  autoPreviewLabel: string; autoTimeLyrics(): void; autoVariations: AutoVariation[]; baseCuts: Array<{ id: string }>; beatOffset: number; bpm: number;
  capabilities: EditionCapabilities; captionInputRef: RefObject<HTMLInputElement | null>; changeMontagePace(value: "cinematic" | "balanced" | "frenetic"): void;
  checkpoint(): void; chooseAutoEnergy(value: AutoEnergy): void; collectDesktopProject(): Promise<unknown>; continuousEditHandlers: InputHTMLAttributes<HTMLInputElement>;
  chooseCreatorGoal(value: CreatorGoal): void; creatorGoal: CreatorGoal; currentTime: number; directorArc: string; dragActive: boolean; dropMain(event: DragEvent<HTMLDivElement>): void;
  dropRampEnabled: boolean; duration: number; echoPreset: string; editCommandDraft: string; energyArc: EnergyArc | null; exportFrameRate: 24 | 25 | 30 | 50 | 60;
  exportInterchange(value: "edl" | "fcpxml" | "otio"): void; exportMaxDimension: 1920 | 3840; exportPlan(): void; generateAutoVariations(): void; importPlan(file?: File): void;
  inferredCreatorGoal: CreatorGoal | null; isPro: boolean; lookPreset: string;
  /** Imported creative .cube LUT (Grade tool, Resolve, etc.); applied after the look and manual grade. */
  creativeLut: { name: string; detail: string; mix: number } | null; openLutImport(): void; removeLut(): void; setLutMix(value: number): void; lyricDensity: "fast" | "normal" | "slow"; lyricsDraft: string;
  mainFile: File | null; mainInputRef: RefObject<HTMLInputElement | null>; mainIsAudio: boolean; mainName: string; mainUrl: string; manualDropTime: number | null;
  manualGrade: GradeAdjust; mirrorMode: number; montageEnabled: boolean; montagePace: "cinematic" | "balanced" | "frenetic";
  openDesktopProjectDocument(): Promise<unknown>; placements: Placement[]; planInputRef: RefObject<HTMLInputElement | null>; playing: boolean;
  previewRef: RefObject<HTMLDivElement | null>; previewStage(empty: ReactNode): ReactNode; punchPreset: keyof typeof PUNCH_PRESETS;
  rawStrobeFireTimes: number[]; removeDialogueSilence(): void; removeTitle(id: string): void; renderAbortRef: MutableRefObject<AbortController | null>;
  renderProgress: number; renderSupport: { supported: boolean; message: string }; renderableSequence: boolean; rendering: boolean; rerollMontage(): void; resetBeatGrid(): void;
  runAutoCut(): void; runEditCommand(value: string): void; saveDesktopProjectDocument(saveAs?: boolean): Promise<unknown>; sections: SectionRule[];
  seek(time: number): void; selectAssets(event: ChangeEvent<HTMLInputElement>): void; selectMainMedia(event: ChangeEvent<HTMLInputElement>): void;
  selectedSection: SectionRule | undefined; selectedSectionHitCount: number; setActivePanel: SetValue<"section" | "clip" | "audio" | "base" | "track">; setAspect: SetValue<OutputAspect>;
  setAudioReactive: SetValue<boolean>; setDragActive: SetValue<boolean>; setDropRampEnabled: SetValue<boolean>;
  setEchoPreset: SetValue<keyof typeof import("../lib/compositor").ECHO_PRESETS>; setEditCommandDraft: SetValue<string>; setEditorMode: SetValue<EditorMode>;
  setExportFrameRate: SetValue<24 | 25 | 30 | 50 | 60>; setExportMaxDimension: SetValue<1920 | 3840>; setLookPreset: SetValue<string>;
  setLyricDensity: SetValue<"fast" | "normal" | "slow">; setLyricsDraft: SetValue<string>; setManualDropTime: SetValue<number | null>; setManualGrade: SetValue<GradeAdjust>;
  setMirrorMode: SetValue<number>; setMontageEnabled: SetValue<boolean>; setPunchPreset: SetValue<keyof typeof PUNCH_PRESETS>; setSelectedSectionId: SetValue<string>;
  setShakePreset: SetValue<keyof typeof SHAKE_PRESETS>; setSpeedPreset: SetValue<keyof typeof SPEED_PRESETS>; setStatus: SetValue<string>; setStreak: SetValue<number>;
  setStrobeAlternate: SetValue<boolean>; setStrobeAngle: SetValue<number>; setStrobeAttack: SetValue<number>; setStrobeBand: SetValue<StrobeBand>; setStrobeBlend: SetValue<StrobeBlend>;
  setStrobeColor: SetValue<string>; setStrobeDecay: SetValue<number>; setStrobeHold: SetValue<number>; setStrobeIntensity: SetValue<number>; setStrobeMode: SetValue<StrobeMode>;
  setStrobeSafeMode: SetValue<boolean>; setStrobeSecondaryColor: SetValue<string>; setStrobeSensitivity: SetValue<number>; setStrobeShape: SetValue<StrobeShape>;
  setStrobeSize: SetValue<number>; setStrobeSoftness: SetValue<number>; setStrobeX: SetValue<number>; setStrobeY: SetValue<number>; setStutterPreset: SetValue<keyof typeof STUTTER_PRESETS>;
  setStyleId: SetValue<string>; setTitleAnimator: SetValue<TextAnimator>; setTitleDraft: SetValue<string>; setTitleStyle: SetValue<TitleStyle>; setTitles: SetValue<TitleCue[]>;
  setTransitionType: SetValue<TransitionType>; setWorkspaceView: SetValue<WorkspaceView>; shakePreset: keyof typeof SHAKE_PRESETS;
  speedConfig: (typeof SPEED_PRESETS)[keyof typeof SPEED_PRESETS]; speedPreset: keyof typeof SPEED_PRESETS; status: string; streak: number;
  strobeAlternate: boolean; strobeAngle: number; strobeAttack: number; strobeBand: StrobeBand; strobeBlend: StrobeBlend; strobeColor: string; strobeDecay: number;
  strobeFireTimes: number[]; strobeHold: number; strobeIntensity: number; strobeMode: StrobeMode; strobePreset: string; strobeSafeMode: boolean;
  strobeSafety: { safe: boolean; message: string }; strobeSecondaryColor: string; strobeSensitivity: number; strobeShape: StrobeShape; strobeSize: number;
  strobeSoftness: number; strobeX: number; strobeY: number; stutterConfig: (typeof STUTTER_PRESETS)[keyof typeof STUTTER_PRESETS]; stutterPreset: keyof typeof STUTTER_PRESETS;
  styleId: string; titleAnimator: TextAnimator; titleDraft: string; titleStyle: TitleStyle; titles: TitleCue[]; togglePlayback(): void;
  transcribeVocalsToLyrics(): Promise<unknown>; transcribing: boolean; transitionType: TransitionType; updateSection(patch: Partial<SectionRule>): void;
};

export function AutoDirectorWorkspace(props: AutoDirectorWorkspaceProps) {
  const { creativeLut, openLutImport, removeLut, setLutMix, addTitle, analysis, analysisAbortRef, analyzeProjectLibrary, analyzing, applyAutoVariation, applyBeatGrid, applyCinematicAssembly, applyProjectAssembly, applyStrobePreset, applyStyle, aspect, assetInputRef, assets, audioReactive, autoEnergy, autoPreviewLabel, autoTimeLyrics, autoVariations, baseCuts, beatOffset, bpm, capabilities, captionInputRef, changeMontagePace, checkpoint, chooseAutoEnergy, chooseCreatorGoal, collectDesktopProject, continuousEditHandlers, creatorGoal, currentTime, deepProjectAnalyzing, directorArc, dragActive, dropMain, dropRampEnabled, duration, echoPreset, editCommandDraft, energyArc, exportFrameRate, exportInterchange, exportMaxDimension, exportPlan, generateAutoVariations, importPlan, inferredCreatorGoal, inspectProjectAsset, isPro, lookPreset, lyricDensity, lyricsDraft, mainFile, mainInputRef, mainIsAudio, mainName, mainUrl, manualDropTime, manualGrade, mirrorMode, montageEnabled, montagePace, openDesktopProjectDocument, placements, planInputRef, playing, previewRef, previewStage, projectIntelligence, punchPreset, rawStrobeFireTimes, removeDialogueSilence, removeTitle, renderAbortRef, renderProgress, renderSupport, renderableSequence, rendering, rerollMontage, resetBeatGrid, runAutoCut, runEditCommand, saveDesktopProjectDocument, sections, seek, selectAssets, selectMainMedia, selectedSection, selectedSectionHitCount, setActivePanel, setAspect, setAudioReactive, setDragActive, setDropRampEnabled, setEchoPreset, setEditCommandDraft, setEditorMode, setExportFrameRate, setExportMaxDimension, setLookPreset, setLyricDensity, setLyricsDraft, setManualDropTime, setManualGrade, setMirrorMode, setMontageEnabled, setPunchPreset, setSelectedSectionId, setShakePreset, setSpeedPreset, setStatus, setStoryBrief, setStreak, setStrobeAlternate, setStrobeAngle, setStrobeAttack, setStrobeBand, setStrobeBlend, setStrobeColor, setStrobeDecay, setStrobeHold, setStrobeIntensity, setStrobeMode, setStrobeSafeMode, setStrobeSecondaryColor, setStrobeSensitivity, setStrobeShape, setStrobeSize, setStrobeSoftness, setStrobeX, setStrobeY, setStutterPreset, setStyleId, setTitleAnimator, setTitleDraft, setTitleStyle, setTitles, setTransitionType, setWorkspaceView, shakePreset, speedConfig, speedPreset, status, storyBrief, streak, strobeAlternate, strobeAngle, strobeAttack, strobeBand, strobeBlend, strobeColor, strobeDecay, strobeFireTimes, strobeHold, strobeIntensity, strobeMode, strobePreset, strobeSafeMode, strobeSafety, strobeSecondaryColor, strobeSensitivity, strobeShape, strobeSize, strobeSoftness, strobeX, strobeY, stutterConfig, stutterPreset, styleId, titleAnimator, titleDraft, titleStyle, titles, togglePlayback, transcribeVocalsToLyrics, transcribing, transitionType, updateSection } = props;
  return (
  <section className="auto-screen">
    <div className="auto-heading">
      <span><Zap size={14} fill="currentColor" /> AUTO DIRECTOR</span>
      <h1>AUTOMATE THE FIRST CUT.</h1>
      <p>{isPro
        ? "Analyze rhythm, map the energy arc, generate an editable sequence, then finish it in Edit or build layered motion in Composition."
        : "Analyze the song, generate an editable sequence, then finish the timing in Edit. Desktop Pro adds layered motion compositions."}</p>
      {!renderSupport.supported && <p className="browser-warning" role="alert">{renderSupport.message}</p>}
    </div>

    <div className="auto-workbench">
      <div
        ref={previewRef}
        className={`auto-preview ${dragActive ? "is-dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={dropMain}
      >
        {previewStage(
          <button className="auto-preview-empty" onClick={() => mainInputRef.current?.click()}>
            <Film size={42} />
            <strong>DROP VIDEO OR SONG</strong>
            <span>or choose a file</span>
          </button>,
        )}
        <div className="auto-preview-status"><span className={renderableSequence ? "ready" : ""} />{autoPreviewLabel}</div>
        <button className={`auto-preview-play ${playing ? "is-playing" : ""}`} onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button>
      </div>

      <div className="auto-controls">
        <div className="creator-goal-panel">
          <div><small>{inferredCreatorGoal === creatorGoal ? `AUTO-DETECTED · ${creatorGoal === "music-video" ? "AUDIO → MUSIC MODE" : "VIDEO → CINEMATIC MODE"}` : "START WITH AN OUTCOME"}</small><strong>One-click creator</strong><span>ScenePilot configures the canvas, pacing, look, effects and captions—then leaves a normal editable timeline. You can change modes at any time.</span></div>
          <div className="creator-goal-grid">{(Object.keys(CREATOR_PROFILES) as CreatorGoal[]).map((goal) => {
            const profile = CREATOR_PROFILES[goal];
            return <button key={goal} className={creatorGoal === goal ? "active" : ""} onClick={() => chooseCreatorGoal(goal)} disabled={analyzing || rendering || transcribing}><strong>{profile.label}</strong><small>{profile.promise}</small></button>;
          })}</div>
        </div>
        <div className={`auto-media-row ${analysis ? "compact" : ""}`}>
          <button className={mainUrl ? "loaded" : ""} disabled={analyzing || rendering} onClick={() => mainInputRef.current?.click()}>
            <div>{mainUrl ? mainIsAudio ? <Music2 size={20} /> : <Video size={20} /> : <Upload size={20} />}</div>
            <span><small>01 / {creatorGoal === "music-video" || creatorGoal === "lyrics" ? "SONG" : "SOURCE"}</small><strong>{mainUrl ? mainName : creatorGoal === "cinematic" ? "Your source video" : "Your song (or video)"}</strong></span>
            {mainUrl && <i>READY</i>}
          </button>
          <button className={assets.length ? "loaded" : ""} disabled={analyzing || rendering} onClick={() => assetInputRef.current?.click()}>
            <div>{assets.length ? <Sparkles size={20} /> : <Plus size={20} />}</div>
            <span><small>02 / CLIPS</small><strong>{assets.length ? `${assets.length} ${assets.length === 1 ? "clip" : "clips"} to cut` : creatorGoal === "cinematic" ? "Coverage, B-roll & inserts (optional)" : "Your footage & lights"}</strong></span>
            {assets.length > 0 && <i>READY</i>}
          </button>
        </div>
        <input ref={mainInputRef} disabled={analyzing || rendering} hidden type="file" accept="video/*,audio/*" onChange={selectMainMedia} />
        <input ref={assetInputRef} disabled={analyzing || rendering} hidden type="file" multiple accept="image/*,video/*" onChange={selectAssets} />

        <div className="energy-control">
          <div><small>03 / STYLE</small><strong>Let AUTO pick, or choose a look</strong></div>
          <div className="style-options">
            <button
              disabled={analyzing || rendering}
              className={styleId === "auto" ? "active" : ""}
              onClick={() => { checkpoint(); setStyleId("auto"); setStatus("AUTO: ScenePilot reads the track and picks the style when you build."); }}
            >
              <span className="style-name">Auto ✨</span>
              <span className="style-blurb">Reads the tempo, energy and drop — picks the vibe for you</span>
            </button>
            {EDIT_STYLES.map((style) => (
              <button
                key={style.id}
                disabled={analyzing || rendering}
                className={styleId === style.id ? "active" : ""}
                onClick={() => applyStyle(style)}
              >
                <span className="style-name">{style.label}</span>
                <span className="style-blurb">{style.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="energy-control">
          <div><small>OUTPUT</small><strong>Pick the aspect ratio</strong></div>
          <div className="look-options" role="group" aria-label="Output aspect ratio">
            {(["source", "9:16", "1:1", "4:5", "16:9", "2.39", "21:9"] as const).map((option) => (
              <button
                key={option}
                disabled={analyzing || rendering}
                className={aspect === option ? "active" : ""}
                onClick={() => { checkpoint(); setAspect(option); }}
                title={ASPECT_HINTS[option]}
              >{ASPECT_LABELS[option]}</button>
            ))}
          </div>
          <small className="montage-note">{ASPECT_HINTS[aspect]}</small>
          {capabilities.exportProfiles ? (
            <div className="pro-output-profile">
              <label><span>Frame rate</span><select value={exportFrameRate} onChange={(event) => setExportFrameRate(Number(event.target.value) as 24 | 25 | 30 | 50 | 60)}><option value="24">24 fps · film</option><option value="25">25 fps · PAL</option><option value="30">30 fps · standard</option><option value="50">50 fps · smooth</option><option value="60">60 fps · high motion</option></select></label>
              <label><span>Resolution cap</span><select value={exportMaxDimension} onChange={(event) => setExportMaxDimension(Number(event.target.value) as 1920 | 3840)}><option value="1920">1080p</option><option value="3840">4K</option></select></label>
            </div>
          ) : (
            <small className="lite-output-note">Browser Lite renders H.264 MP4 at 1080p / 30 fps. Desktop Pro adds 4K and film-rate profiles.</small>
          )}
        </div>

        <div className="energy-control">
          <div><small>04 / ENERGY</small><strong>How hard should it hit?</strong></div>
          <div className="energy-options">
            <button disabled={analyzing || rendering} className={autoEnergy === "smooth" ? "active" : ""} onClick={() => chooseAutoEnergy("smooth")}><i /><span>SMOOTH</span></button>
            <button disabled={analyzing || rendering} className={autoEnergy === "dynamic" ? "active" : ""} onClick={() => chooseAutoEnergy("dynamic")}><i /><i /><span>DYNAMIC</span></button>
            <button disabled={analyzing || rendering} className={autoEnergy === "maximum" ? "active" : ""} onClick={() => chooseAutoEnergy("maximum")}><i /><i /><i /><span>MAXIMUM</span></button>
          </div>
        </div>

        {analysis && energyArc && creatorGoal !== "cinematic" && <div className="music-map-card">
          <div className="music-map-head"><span><Activity size={14} /><strong>Music Map</strong><small>{Math.round(analysis.confidence * 100)}% rhythm confidence</small></span><strong>DROP {formatTime(manualDropTime ?? energyArc.dropTime)}</strong></div>
          <div className="music-map-track">
            {sections.map((section) => <button key={section.id} className={section.locked ? "locked" : ""} style={{ left: `${section.start / duration * 100}%`, width: `${(section.end - section.start) / duration * 100}%`, opacity: 0.45 + section.energy * 0.55 }} onClick={() => { setSelectedSectionId(section.id); setEditorMode("pro"); setWorkspaceView("sequence"); setActivePanel("section"); }} title={`${section.name} · ${Math.round(section.energy * 100)}% energy`}>{section.name}{section.locked && <Lock size={9} />}</button>)}
            <i className="music-drop" style={{ left: `${(manualDropTime ?? energyArc.dropTime) / duration * 100}%` }} />
          </div>
          <label><span>Move the drop</span><input type="range" min="0" max={duration} step={1 / exportFrameRate} value={manualDropTime ?? energyArc.dropTime} onChange={(event) => setManualDropTime(Number(event.target.value))} /><strong>{formatTime(manualDropTime ?? energyArc.dropTime)}</strong></label>
          <div className="music-map-actions"><button onClick={() => setManualDropTime(currentTime)}>Set at playhead</button><button disabled={manualDropTime === null} onClick={() => setManualDropTime(null)}>Use detected</button><button className={dropRampEnabled ? "active" : ""} onClick={() => { checkpoint(); setDropRampEnabled((on) => !on); }} title="Slow-motion decelerating into a freeze on the drop, then a hard cut on the downbeat">Slow-mo drop {dropRampEnabled ? "on" : "off"}</button><button className={audioReactive ? "active" : ""} onClick={() => { checkpoint(); setAudioReactive((on) => !on); }} title="Continuous bass-pump zoom and hats shimmer riding the audio's low and high bands">Audio-reactive {audioReactive ? "on" : "off"}</button></div>
        </div>}

        {analysis?.cinematic && creatorGoal === "cinematic" && <CinematicIntelligencePanel report={analysis.cinematic} seek={seek} applyAssembly={applyCinematicAssembly} disabled={analyzing || rendering} />}
        {projectIntelligence && creatorGoal === "cinematic" && <ProjectIntelligencePanel report={projectIntelligence} brief={storyBrief}
          assetNames={new Map([["__main__", mainName], ...assets.map((asset) => [asset.id, asset.name] as [string, string])])} disabled={analyzing || rendering || transcribing}
          deepAnalyzing={deepProjectAnalyzing} setBrief={setStoryBrief} analyzeLibrary={analyzeProjectLibrary}
          inspectAsset={inspectProjectAsset} applyAssembly={applyProjectAssembly} />}

        {analysis && <div className="lyrics-studio">
          <div className="lyrics-head"><span><Type size={14} /><strong>Auto lyrics</strong><small>Paste your words — they lock to the vocal and the beat</small></span>{titles.length > 0 && <button onClick={() => { checkpoint(); setTitles([]); }} title="Clear the title track">Clear</button>}</div>
          <textarea className="lyrics-input" value={lyricsDraft} onChange={(event) => setLyricsDraft(event.target.value)} placeholder={"One line per screen\ne.g.\nWE LIT THE NIGHT\nAND NEVER CAME DOWN"} rows={4} disabled={analyzing || rendering} />
          <div className="lyrics-actions">
            <label><span>Pace</span><select value={lyricDensity} onChange={(event) => setLyricDensity(event.target.value as "fast" | "normal" | "slow")} disabled={analyzing || rendering}><option value="fast">Fast · every beat</option><option value="normal">Normal · every 2</option><option value="slow">Slow · every bar</option></select></label>
            <button className="lyrics-go" onClick={autoTimeLyrics} disabled={analyzing || rendering || !lyricsDraft.trim()}><WandSparkles size={14} /> Auto-time lyrics</button>
          </div>
          {titles.length > 0 && <small className="lyrics-note">{titles.length} {titles.length === 1 ? "line" : "lines"} on the timeline · edit or restyle any of them in the Pro title tools</small>}
          <div className="lyrics-asr">
            <button className="lyrics-asr-go" onClick={() => void transcribeVocalsToLyrics()} disabled={analyzing || rendering || transcribing || !mainFile}>
              <Sparkles size={13} /> {transcribing ? "Transcribing…" : "Transcribe vocal automatically"}
            </button>
            <small>Beta · downloads a speech model (~40&nbsp;MB) on first run and works best on clear vocals. No words to paste — it writes them for you.</small>
          </div>
        </div>}

        {analysis && <div className="variation-studio">
          <div className="variation-studio-head"><span><Split size={14} /><strong>Editorial alternatives</strong><small>Three directions · one analysis · every cut remains editable</small></span><button onClick={generateAutoVariations} disabled={analyzing || rendering}>{autoVariations.length ? "Regenerate" : "Generate 3 versions"}</button></div>
          {autoVariations.length > 0 && <div className="variation-grid">
            {autoVariations.map((variation, index) => <button key={variation.id} className={styleId === variation.style.id ? "active" : ""} onClick={() => applyAutoVariation(variation)}>
              <small>VERSION {String.fromCharCode(65 + index)}</small><strong>{variation.style.label}</strong><span>{variation.style.blurb}</span><em>{variation.baseCuts.length} cuts · {variation.placements.length} hits · {variation.style.look}</em>
            </button>)}
          </div>}
        </div>}

        <div className="director-command">
          <div className="director-command-head"><WandSparkles size={14} /><strong>Direct in words</strong><small>{'Plain English — “punchier”, “warmer with more cuts”, “add captions”'}</small></div>
          <div className="director-command-row">
            <input
              type="text" value={editCommandDraft} placeholder='Tell the director what to change…'
              disabled={analyzing || rendering}
              onChange={(event) => setEditCommandDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && editCommandDraft.trim()) { runEditCommand(editCommandDraft); setEditCommandDraft(""); } }}
            />
            <button className="montage-reroll" disabled={analyzing || rendering || !editCommandDraft.trim()} onClick={() => { runEditCommand(editCommandDraft); setEditCommandDraft(""); }}><WandSparkles size={13} /> Apply</button>
          </div>
          <div className="director-command-suggestions">
            {["punchier", "more cuts", "warmer", "cinematic", "add captions", "slow-mo"].map((phrase) => (
              <button key={phrase} disabled={analyzing || rendering} onClick={() => runEditCommand(phrase)}>{phrase}</button>
            ))}
          </div>
        </div>

        <details className="creative-controls" open={isPro}>
          <summary><span><Settings2 size={14} /><strong>Creative controls</strong></span><small>Montage, camera, strobe, look and titles</small><ChevronDown size={14} /></summary>
        <div className="energy-control">
          <div className="montage-head">
            <span><small>05 / MONTAGE</small><strong>Cut your clips to the beat</strong></span>
            <label className="switch" title="Beat-cut the clip pool as the base layer"><input type="checkbox" disabled={analyzing || rendering} checked={montageEnabled} onChange={(event) => { checkpoint(); setMontageEnabled(event.target.checked); }} /><i /></label>
          </div>
          {montageEnabled && (
            <>
              <div className="energy-options">
                {(["cinematic", "balanced", "frenetic"] as const).map((pace) => (
                  <button key={pace} disabled={analyzing || rendering} className={montagePace === pace ? "active" : ""} onClick={() => changeMontagePace(pace)}><span>{pace.toUpperCase()}</span></button>
                ))}
              </div>
              <div className="montage-row">
                <label className="auto-refine-field"><span>Beat punch</span>
                  <select value={punchPreset} disabled={analyzing || rendering} onChange={(event) => { checkpoint(); setPunchPreset(event.target.value as keyof typeof PUNCH_PRESETS); }}>
                    <option value="off">Off</option>
                    <option value="subtle">Subtle</option>
                    <option value="dynamic">Dynamic</option>
                    <option value="slam">Slam</option>
                  </select>
                </label>
                <button className="montage-reroll" disabled={analyzing || rendering || !analysis || !assets.length} onClick={rerollMontage} title="Generate a different cut"><RefreshCw size={14} /> Reroll</button>
              </div>
              <span className="montage-sublabel">Transition on every cut</span>
              <div className="look-options" role="group" aria-label="Cut transition">
                {(["none", "flash", "zoom", "whip", "glitch", "dissolve", "dip", "slide"] as const).map((type) => (
                  <button
                    key={type}
                    disabled={analyzing || rendering}
                    className={transitionType === type ? "active" : ""}
                    onClick={() => { checkpoint(); setTransitionType(type); }}
                  >{type === "none" ? "HARD" : type.toUpperCase()}</button>
                ))}
              </div>
              <small className="montage-note">{baseCuts.length ? `${baseCuts.length} beat-cut clips ready — shown in the rendered MP4.` : "Add clips + a song, then Make the Cut."}</small>
            </>
          )}
        </div>

        <div className="energy-control">
          <div><small>06 / STROBE</small><strong>Lights on the beat — no clips needed</strong></div>
          <div className="look-options" role="group" aria-label="Strobe pattern">
            {(["off", "drums", "pulse", "rave", "machinegun", "police", "warm"] as const).map((preset) => (
              <button
                key={preset}
                disabled={analyzing || rendering || (preset === "drums" && !analysis)}
                title={preset === "drums" && !analysis ? "Analyze first so it can read the drums" : undefined}
                className={strobePreset === preset ? "active" : ""}
                onClick={() => {
                  checkpoint();
                  applyStrobePreset(preset);
                }}
              >{preset === "machinegun" ? "MACHINE" : preset.toUpperCase()}</button>
            ))}
          </div>
          {strobePreset === "drums" && (
            <span className="montage-sublabel">Flash on</span>
          )}
          {strobePreset === "drums" && (
            <div className="look-options" role="group" aria-label="Drum band">
              {([["Kick", "low"], ["Snare", "high"], ["All", "all"]] as const).map(([label, band]) => (
                <button key={band} disabled={analyzing || rendering}
                  className={strobeBand === band ? "active" : ""}
                  onClick={() => { checkpoint(); setStrobeBand(band); }}>{label.toUpperCase()}</button>
              ))}
            </div>
          )}
          {strobePreset === "drums" && (
            <label className="auto-refine-field" style={{ marginTop: 10 }}>
              <span>Hit sensitivity</span>
              <div className="auto-value-line">
                <input type="range" disabled={analyzing || rendering} {...continuousEditHandlers}
                  min="0.1" max="1" step="0.05" value={strobeSensitivity}
                  onChange={(event) => setStrobeSensitivity(Number(event.target.value))} />
                <strong>{Math.round(strobeSensitivity * 100)}%</strong>
              </div>
            </label>
          )}
          {strobePreset !== "off" && (
            <div className="strobe-lab">
              <div className="strobe-color-row">
                <label className="auto-refine-field"><span>Primary gel</span>
                  <input type="color" className="strobe-color" disabled={analyzing || rendering} value={strobeColor} onChange={(event) => setStrobeColor(event.target.value)} />
                </label>
                <label className="auto-refine-field"><span>Secondary gel</span>
                  <input type="color" className="strobe-color" disabled={analyzing || rendering || !strobeAlternate} value={strobeSecondaryColor} onChange={(event) => setStrobeSecondaryColor(event.target.value)} />
                </label>
                <button type="button" className={strobeAlternate ? "strobe-toggle active" : "strobe-toggle"} aria-pressed={strobeAlternate} disabled={analyzing || rendering} onClick={() => { checkpoint(); setStrobeAlternate((value) => !value); }}>ALT GELS</button>
              </div>
              <div className="strobe-parameter-grid">
                <label className="auto-refine-field"><span>Output</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="0" max="1" step="0.01" value={strobeIntensity} onChange={(event) => setStrobeIntensity(Number(event.target.value))} /><strong>{Math.round(strobeIntensity * 100)}%</strong></div></label>
                <label className="auto-refine-field"><span>Attack</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="0" max="0.25" step="0.001" value={strobeAttack} onChange={(event) => setStrobeAttack(Number(event.target.value))} /><strong>{Math.round(strobeAttack * 1000)}ms</strong></div></label>
                <label className="auto-refine-field"><span>Hold</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="0" max="0.25" step="0.001" value={strobeHold} onChange={(event) => setStrobeHold(Number(event.target.value))} /><strong>{Math.round(strobeHold * 1000)}ms</strong></div></label>
                <label className="auto-refine-field"><span>Release</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="0.01" max="0.5" step="0.005" value={strobeDecay} onChange={(event) => setStrobeDecay(Number(event.target.value))} /><strong>{Math.round(strobeDecay * 1000)}ms</strong></div></label>
              </div>
              <span className="montage-sublabel">Envelope</span>
              <div className="look-options" role="group" aria-label="Strobe envelope">
                {(["square", "linear", "smooth", "exponential"] as const).map((shape) => <button key={shape} className={strobeShape === shape ? "active" : ""} disabled={analyzing || rendering} onClick={() => { checkpoint(); setStrobeShape(shape); }}>{shape === "exponential" ? "EXP" : shape.toUpperCase()}</button>)}
              </div>
              <span className="montage-sublabel">Light shape</span>
              <div className="look-options" role="group" aria-label="Strobe light shape">
                {(["full", "radial", "split", "bars", "sweep"] as const).map((mode) => <button key={mode} className={strobeMode === mode ? "active" : ""} disabled={analyzing || rendering} onClick={() => { checkpoint(); setStrobeMode(mode); }}>{mode.toUpperCase()}</button>)}
              </div>
              <div className="strobe-spatial-head"><span>Composite</span><div className="look-options" role="group" aria-label="Strobe blend mode">{(["screen", "add", "overlay"] as const).map((blend) => <button key={blend} className={strobeBlend === blend ? "active" : ""} onClick={() => { checkpoint(); setStrobeBlend(blend); }}>{blend.toUpperCase()}</button>)}</div></div>
              {strobeMode !== "full" && <div className="strobe-parameter-grid spatial">
                <label className="auto-refine-field"><span>Position X</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="0" max="1" step="0.01" value={strobeX} onChange={(event) => setStrobeX(Number(event.target.value))} /><strong>{Math.round(strobeX * 100)}%</strong></div></label>
                <label className="auto-refine-field"><span>Position Y</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="0" max="1" step="0.01" value={strobeY} onChange={(event) => setStrobeY(Number(event.target.value))} /><strong>{Math.round(strobeY * 100)}%</strong></div></label>
                <label className="auto-refine-field"><span>Size</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="0.05" max="1.5" step="0.01" value={strobeSize} onChange={(event) => setStrobeSize(Number(event.target.value))} /><strong>{Math.round(strobeSize * 100)}%</strong></div></label>
                <label className="auto-refine-field"><span>Softness</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="0" max="1" step="0.01" value={strobeSoftness} onChange={(event) => setStrobeSoftness(Number(event.target.value))} /><strong>{Math.round(strobeSoftness * 100)}%</strong></div></label>
                <label className="auto-refine-field"><span>Angle</span><div className="auto-value-line"><input type="range" {...continuousEditHandlers} min="-180" max="180" step="1" value={strobeAngle} onChange={(event) => setStrobeAngle(Number(event.target.value))} /><strong>{Math.round(strobeAngle)}°</strong></div></label>
              </div>}
              <div className={strobeSafeMode ? "strobe-safety safe" : strobeSafety.safe ? "strobe-safety" : "strobe-safety warning"}>
                <button type="button" aria-pressed={strobeSafeMode} disabled={analyzing || rendering} onClick={() => { checkpoint(); setStrobeSafeMode((value) => !value); }}>{strobeSafeMode ? "SAFE LIMITER ON" : "SAFE LIMITER OFF"}</button>
                <span>{strobeSafeMode
                  ? `Full-frame flashes limited to 3/s · ${Math.max(0, rawStrobeFireTimes.length - strobeFireTimes.length)} suppressed`
                  : strobeSafety.safe ? "Pattern stays within the 3 flashes/s guideline." : strobeSafety.message}</span>
              </div>
              <small className="montage-note">{strobePreset === "drums" ? `${strobeFireTimes.length} ${strobeBand === "low" ? "kick" : strobeBand === "high" ? "snare/hat" : "drum"} hits found.` : `${strobeFireTimes.length} flashes across the track.`} Preview and export use the same light envelope.</small>
            </div>
          )}
        </div>

        <div className="energy-control">
          <div><small>07 / CAMERA</small><strong>Shake and speed on the beat</strong></div>
          <span className="montage-sublabel">Shake</span>
          <div className="look-options" role="group" aria-label="Camera shake">
            {(["off", "handheld", "kick", "riot"] as const).map((preset) => (
              <button key={preset} disabled={analyzing || rendering}
                className={shakePreset === preset ? "active" : ""}
                onClick={() => { checkpoint(); setShakePreset(preset); }}>{preset.toUpperCase()}</button>
            ))}
          </div>
          <span className="montage-sublabel">Speed ramp</span>
          <div className="look-options" role="group" aria-label="Speed ramp">
            {(["off", "drift", "slowmo", "launch", "whip"] as const).map((preset) => (
              <button key={preset} disabled={analyzing || rendering}
                className={speedPreset === preset ? "active" : ""}
                onClick={() => { checkpoint(); setSpeedPreset(preset); }}>{preset.toUpperCase()}</button>
            ))}
          </div>
          <small className="montage-note">
            {speedPreset === "off"
              ? "Footage runs at real speed."
              : `Resyncs to the grid every ${speedConfig.every} beats, so it never drifts off the song.`}
          </small>
        </div>

        <div className="energy-control">
          <div><small>08 / STUTTER</small><strong>Freeze the motion on the grid</strong></div>
          <div className="look-options" role="group" aria-label="Stutter pattern">
            {(["off", "step", "chop", "roll", "rewind", "robot"] as const).map((preset) => (
              <button
                key={preset}
                disabled={analyzing || rendering}
                className={stutterPreset === preset ? "active" : ""}
                onClick={() => { checkpoint(); setStutterPreset(preset); }}
              >{preset.toUpperCase()}</button>
            ))}
          </div>
          <small className="montage-note">
            {stutterPreset === "off"
              ? "Motion runs smooth."
              : `${stutterConfig.pattern} on 1/${Math.round(4 / stutterConfig.division)} notes — ${stutterConfig.window} of every ${stutterConfig.every} beats.`}
          </small>
        </div>

        <div className="energy-control">
          <div><small>09 / LOOK</small><strong>Film grade on the render</strong></div>
          <div className="look-options">
            {(["none", "cinematic", "neon", "vhs", "noir"] as const).map((look) => (
              <button
                key={look}
                disabled={analyzing || rendering}
                className={lookPreset === look ? "active" : ""}
                onClick={() => { checkpoint(); setLookPreset(look); }}
              >{look === "none" ? "RAW" : look.toUpperCase()}</button>
            ))}
          </div>
          <span className="montage-sublabel">Colour — manual grade</span>
          <div className="manual-grade">
            {([
              ["exposure", "Exposure", 0.5, 2, 0.01],
              ["contrast", "Contrast", 0.5, 2, 0.01],
              ["saturation", "Saturation", 0, 2, 0.01],
              ["temperature", "Warmth", -1, 1, 0.01],
              ["tint", "Tint", -1, 1, 0.01],
              ["bloom", "Bloom", 0, 2, 0.01],
              ["vignette", "Vignette", 0, 1, 0.01],
              ["grain", "Grain", 0, 1, 0.01],
              ["aberration", "RGB split", 0, 0.02, 0.001],
            ] as const).map(([key, label, min, max, step]) => (
              <div key={key} className="value-line">
                <small>{label}</small>
                <input type="range" {...continuousEditHandlers} min={min} max={max} step={step} disabled={analyzing || rendering} value={manualGrade[key]}
                  onChange={(event) => setManualGrade((grade) => ({ ...grade, [key]: Number(event.target.value) }))} />
                <strong>{manualGrade[key].toFixed(2)}</strong>
              </div>
            ))}
            <button className="montage-reroll" disabled={isNeutralGrade(manualGrade)} onClick={() => { checkpoint(); setManualGrade(NEUTRAL_GRADE_ADJUST); }}>Reset colour</button>
          </div>
          <span className="montage-sublabel">Creative LUT (.cube)</span>
          <div className="lut-controls lite-lut-controls">
            <button className="lut-import" disabled={analyzing || rendering} onClick={openLutImport} title="Import a .cube LUT, e.g. from ScenePilot Grade, DaVinci Resolve or Premiere. Applied to the preview and the render.">
              <Upload size={13} /> {creativeLut ? `${creativeLut.name} · ${creativeLut.detail}` : "Import .cube LUT"}
            </button>
            {creativeLut && (
              <>
                <label className="lut-mix"><span>Mix</span><input type="range" min="0" max="1" step="0.01" disabled={analyzing || rendering} value={creativeLut.mix} onChange={(event) => setLutMix(Number(event.target.value))} /><strong>{Math.round(creativeLut.mix * 100)}%</strong></label>
                <button className="lut-remove" disabled={analyzing || rendering} onClick={removeLut}>Remove LUT</button>
              </>
            )}
            {!creativeLut && <small className="lite-lut-hint">Made a look in ScenePilot Grade? Import its .cube here.</small>}
          </div>
          <span className="montage-sublabel">Kaleidoscope</span>
          <div className="look-options" role="group" aria-label="Mirror fold">
            {[["None", 0], ["Horizontal", 1], ["Vertical", 2], ["Quad", 3]].map(([label, mode]) => (
              <button key={mode as number} disabled={analyzing || rendering}
                className={mirrorMode === mode ? "active" : ""}
                onClick={() => { checkpoint(); setMirrorMode(mode as number); }}>{(label as string).toUpperCase()}</button>
            ))}
          </div>
          <label className="auto-refine-field" style={{ marginTop: 12 }}>
            <span>Anamorphic streak</span>
            <div className="auto-value-line">
              <input type="range" disabled={analyzing || rendering} {...continuousEditHandlers}
                min="0" max="1" step="0.05" value={streak}
                onChange={(event) => setStreak(Number(event.target.value))} />
              <strong>{streak.toFixed(2)}</strong>
            </div>
          </label>
          <span className="montage-sublabel">Echo trails</span>
          <div className="look-options" role="group" aria-label="Frame-trail echo">
            {(["off", "ghost", "trails", "pulse", "smear"] as const).map((preset) => (
              <button key={preset} disabled={analyzing || rendering}
                className={echoPreset === preset ? "active" : ""}
                onClick={() => { checkpoint(); setEchoPreset(preset); }}>{preset.toUpperCase()}</button>
            ))}
          </div>
          <small className="montage-note">Graded on the GPU as the MP4 encodes, pulsing with the beat.</small>
        </div>

        <div className="energy-control">
          <div><small>10 / TITLES</small><strong>Words that slam on the beat</strong></div>
          {isPro && <div className="montage-row"><button className="montage-reroll" onClick={() => captionInputRef.current?.click()}><Upload size={13} /> Import SRT / VTT</button><button className="montage-reroll" disabled={!titles.some((title) => title.id.startsWith("caption-"))} onClick={removeDialogueSilence}><Scissors size={13} /> Remove silence</button><small className="montage-note">Timed captions become editable cues and can drive phrase-safe dialogue edits.</small></div>}
          <div className="title-add">
            <input
              type="text" value={titleDraft} maxLength={40} placeholder="TYPE A WORD"
              disabled={analyzing || rendering}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") addTitle(); }}
            />
            <button className="montage-reroll" disabled={analyzing || rendering || !titleDraft.trim()} onClick={addTitle}>
              <Plus size={13} /> Drop
            </button>
          </div>
          <div className="look-options" role="group" aria-label="Title style">
            {(["slam", "pop", "rise"] as const).map((style) => (
              <button key={style} disabled={analyzing || rendering}
                className={titleStyle === style ? "active" : ""}
                onClick={() => setTitleStyle(style)}>{style.toUpperCase()}</button>
            ))}
          </div>
          <div className="look-options" role="group" aria-label="Character animation">
            {TEXT_ANIMATORS.map((animator) => (
              <button key={animator} disabled={analyzing || rendering}
                className={titleAnimator === animator ? "active" : ""}
                title={animator === "none" ? "Whole word animates as one" : `Animate characters: ${animator}`}
                onClick={() => setTitleAnimator(animator)}>{animator === "none" ? "WHOLE" : animator.toUpperCase()}</button>
            ))}
          </div>
          {titles.length > 0 ? (
            <div className="title-list">
              {titles.map((cue) => (
                <div key={cue.id} className="title-row">
                  <button className="title-seek" onClick={() => seek(cue.start)} title="Jump to this title">
                    <span>{formatTime(cue.start)}</span><strong>{cue.text}</strong>
                  </button>
                  <button className="title-del" disabled={analyzing || rendering} onClick={() => removeTitle(cue.id)} aria-label={`Remove ${cue.text}`}><X size={13} /></button>
                </div>
              ))}
            </div>
          ) : (
            <small className="montage-note">Move the playhead, type a word, hit Drop. It snaps to the nearest beat and punches on the hit.</small>
          )}
        </div>
        </details>

        {!analysis && <div className="director-strip">
          <div><small>11 / AUTO DIRECTOR</small><strong>{analysis ? `${sections.length} musical sections shaped` : "Builds an intentional section arc"}</strong></div>
          <span>{analysis ? directorArc : "RESTRAINT  /  PULSE  /  BUILD  /  BURST  /  RELEASE"}</span>
        </div>}

        {analysis && selectedSection && <AutoDirectorSectionEditor selected={selectedSection} sections={sections} hitCount={selectedSectionHitCount}
          disabled={analyzing || rendering} bpm={bpm} beatOffset={beatOffset} inputHandlers={continuousEditHandlers}
          hitsForSection={(id) => placements.filter((placement) => placement.sectionId === id).length} onSelect={setSelectedSectionId}
          onUpdate={updateSection} onBeatGrid={applyBeatGrid} onResetGrid={resetBeatGrid} />}

        <button className={`auto-cut-button ${analyzing ? "is-running" : ""}`} onClick={analyzing ? () => analysisAbortRef.current?.abort() : runAutoCut} disabled={rendering || transcribing}>
          {analyzing ? <Activity size={19} /> : <WandSparkles size={19} />}
          <span>{analyzing ? "CANCEL ANALYSIS" : transcribing ? "GENERATING CAPTIONS…" : analysis ? `RE-ANALYZE MEDIA · ${CREATOR_PROFILES[creatorGoal].label.toUpperCase()}` : creatorGoal === "music-video" ? "MAKE MY MUSIC VIDEO" : `MAKE ${CREATOR_PROFILES[creatorGoal].label.toUpperCase()}`}</span>
        </button>

        {rendering && <div className="render-progress" role="progressbar" aria-label="Render progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(renderProgress * 100)}><i style={{ width: `${renderProgress * 100}%` }} /><span>{Math.round(renderProgress * 100)}%</span><button onClick={() => renderAbortRef.current?.abort()}>Cancel render</button></div>}

        <div className="auto-readout">
          <span><Activity size={14} /><strong>{bpm}</strong> BPM</span>
          <span><Zap size={14} /><strong>{placements.length}</strong> HITS</span>
          {montageEnabled && <span><Scissors size={14} /><strong>{baseCuts.length}</strong> CUTS</span>}
          {analysis && <span><Film size={14} /><strong>{analysis.framesAnalyzed}</strong> FRAMES</span>}
          {analysis && <span><Scissors size={14} /><strong>{analysis.sceneCuts.length}</strong> CUTS</span>}
          <p role="status" aria-live="polite">{status}</p>
          {(placements.length > 0 || baseCuts.length > 0) && <button onClick={exportPlan}><Download size={14} /> Export cut</button>}
          <button onClick={() => planInputRef.current?.click()} disabled={analyzing || rendering}><Upload size={14} /> Import cut</button>
          {isPro && <><button onClick={() => void openDesktopProjectDocument()}><FolderOpen size={14} /> Open project file</button><button onClick={() => void saveDesktopProjectDocument()}><Save size={14} /> Save project file</button></>}
          {isPro && baseCuts.length > 0 && <><button onClick={() => exportInterchange("edl")}><Download size={14} /> EDL</button><button onClick={() => exportInterchange("fcpxml")}><Download size={14} /> FCPXML</button><button onClick={() => exportInterchange("otio")}><Download size={14} /> OTIO</button><button onClick={() => void collectDesktopProject()}><FolderOpen size={14} /> Collect project</button></>}
          <input ref={planInputRef} hidden type="file" accept="application/json,.json,.otio" onChange={(event) => { importPlan(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
        </div>
      </div>
    </div>
  </section>
  );
}
