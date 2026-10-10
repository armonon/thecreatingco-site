"use client";
import { compositionLayerLocked, compositionToLayerTime, layerToCompositionTime, layerTimeBounds, placeImportedCompositionMedia } from "../lib/composition-editing";
import { validateCompositionSettings } from "../lib/composition-creation";
import { useSequenceTimeline } from "./use-sequence-timeline";
import { useProgramTransport } from "./use-program-transport";
import { useMobileWorkspace } from "./use-mobile-workspace";
import { useBrowserDownload } from "./use-browser-download";
import { renderMediaIds, visibleRenderPlacements } from "../lib/render-media";
import { StrobeTimingControls } from "./strobe-timing-controls";
import { useCurrentState } from "./use-current-state";
import { useTimelineScrub } from "./use-timeline-scrub";
import { TimelinePlayhead } from "./timeline-playhead";
import { adjustMeasuredBeats } from "../lib/song-beat-map";
import { isPendingRender } from "../lib/render-job-state";

import {
Activity,
Box,
Clock3,
Copy,
Diamond,
Download,
Eye,
EyeOff,
Film,
Layers3,
Lock,
Maximize2,
Music2,
Palette,
Pause,
Play,
Plus,
RefreshCw,
RotateCcw,
SkipBack,
Sparkles,
Unlock,
Upload,
Volume2,
VolumeX,
WandSparkles,
Zap
} from "lucide-react";
import { ChangeEvent,DragEvent,MouseEvent,Suspense,lazy,useEffect,useMemo,useRef,useState } from "react";
import type { AnalysisProgress,AnalysisResult,EffectProfile } from "../lib/analysis-engine";
import { analyzeProject,buildDirectedPlacements,hasReliableRhythm,mergeDirectedSectionPlacements,suggestDirectorPattern } from "../lib/analysis-engine";
import { deriveEnergyArc } from "../lib/arc";
import { ASPECT_LABELS,outputDimensions,type OutputAspect } from "../lib/aspect";
import { useCreativeLut } from "./use-creative-lut";
import { applyAudioCrossfade } from "../lib/audio-crossfade";
import { measureProgramLoudness,type ProgramLoudnessReport } from "../lib/audio-loudness";
import { DEFAULT_AUDIO_BUSES,type AudioBus } from "../lib/audio-mixer";
import { compositionAudioPlan } from "../lib/composition-audio";
import { programAudioSchedule } from "../lib/program-audio";
import { createAudioStemJobs } from "../lib/audio-stems";
import { checkExportProfile,checkRenderSupport,type ExportProfileSupport } from "../lib/capabilities";
import { captionsToSrt,captionsToTitles,parseCaptions } from "../lib/captions";
import { analyzeCinematicFootage,buildCinematicAssembly,type CinematicAssemblyKind } from "../lib/cinematic-analysis";
import { DEFAULT_AUTO_POLICY, resolveAutoTiming, validateAutoPolicy, type AutoEditPolicy, type ExplainedCut } from "../lib/auto-edit-policy";
import type { AutoEditVersion } from "./auto-edit-types";
import { CLIP_EFFECT_DEFINITIONS,CLIP_EFFECT_RECIPES,createClipEffect,effectsFromRecipe,suggestedEffectRecipe,type ClipEffectRecipe,type ClipEffectType } from "../lib/clip-effects";
import { DEFAULT_COLOR_MANAGEMENT,applyDisplayTransform,type ColorManagementSettings } from "../lib/color-management";
import { autoColorMatch,autoWhiteBalanceAdjust } from "../lib/color-match";
import { activeCompositionCameraAt,projectCompositionLayer } from "../lib/composition-3d";
import { compositionTrackForLayer,normalizeComposition,normalizeCompositions,orderedCompositionLayers,moveCompositionTrack as reorderCompositionTrack,moveCompositionTrackTo as reorderCompositionTrackTo,repositionCompositionLayer } from "../lib/composition-tracks";
import type { CompositionLayer,CompositionTrack,StudioComposition } from "../lib/compositor";
import { ECHO_PRESETS,MAIN_SOURCE_ID,compositionTransformAt as previewCompositionTransform } from "../lib/compositor";
import { CURVE_PRESETS,buildCurveLut,isIdentityCurve } from "../lib/curves";
import { desktopHealthChecks } from "../lib/desktop-health";
import { compactTimelineTimes,dialogueSilences,extractTimedRanges,socialDeliveryPlan,timeAfterRemovingRanges } from "../lib/dialogue-edit";
import { applyDynamicTrim,dynamicTrimDelta,type DynamicTrimSelection } from "../lib/dynamic-trim";
import { interpretEditCommand } from "../lib/edit-command";
import { effectiveCutSelection,groupSelectedCuts,translateSelectedCuts,ungroupSelectedCuts } from "../lib/edit-selection";
import { installEffectPlugin } from "../lib/effect-plugin";
import { createExtensionPack,installExtensionPack,parseExtensionPack,serializeExtensionPack,type PortableEffectRecipe } from "../lib/extension-pack";
import { formatTime,formatTimecode,makeBeatGrid,snapToFrame } from "../lib/format";
import { GRADE_PRESETS,NEUTRAL_GRADE_ADJUST,applyGradeAdjust,isNeutralGrade,type GradeAdjust } from "../lib/grade";
import { creatorProfile,inferCreatorGoalFromMedia,restoreCreatorIntent,type CreatorGoal,type CreatorProfile } from "../lib/instant-create";
import { importOtio } from "../lib/interchange";
import { prepareInterchange, preparePremiere } from "../lib/interchange-delivery";
import { evaluateTransformKeyframes,type Easing,type TransformKeyframe } from "../lib/keyframes";
import { SILENT_READING,attachLiveAudioMeter,type LiveMeterReading } from "../lib/live-audio-meter";
import { autoLyricCues } from "../lib/lyrics";
import { mediaUsageCounts,queryMediaAssets } from "../lib/media-browser-query";
import { buildMediaRelinkMap,claimOfflineMediaLinks,fingerprintFile,type MediaLinkDescriptor } from "../lib/media-link";
import { rotoRuntimeLabel } from "../lib/ml-runtime";
import { createMonitorCommands } from "../lib/monitor-commands";
import { PUNCH_PRESETS,SHAKE_PRESETS } from "../lib/motion";
import { stabilizationKeyframes,trackPoint,trackingNullKeyframes,type PointTrackSample } from "../lib/motion-tracker";
import { buildMulticamSequence,sceneAwareSwitchTimes,switchMulticamAngle } from "../lib/multicam";
import { nestBaseCuts } from "../lib/nest";
import { trackPlanarPatch,type PlanarQuad,type PlanarTrackSample } from "../lib/planar-tracker";
import { buildPointEditCut } from "../lib/point-edit";
import type { PreviewPerformanceSample,PreviewQuality } from "../lib/preview-performance";
import {
DEFAULT_AUDIO_EFFECT_RACK,
automationGainAt,
clipPlaybackRate,
estimateIntegratedLufs,
hasCompositionCycle,
markerSnapCandidates,
rateStretchCut,
rollEdit,
setClipFade,
slideCut,
slipCut,
snapTime,
type AudioClip,
type AudioTrack,
type MediaBin,
type RenderFormat,
type RenderJob,
type TimelineMarker,
type TimelineRange,
type TimelineTool,
} from "../lib/pro-editor";
import { applyAsymmetricSplitEdit,applySplitEdit,type SplitEditKind } from "../lib/pro-workflows";
import { compositionWorkflowGuide,currentWorkspace,workspaceGuide,type JourneyAction,type ProductWorkspace } from "../lib/product-journey";
import { analyzeProjectIntelligence,type ProjectAssemblyKind,type ProjectIntelligence,type ProjectTranscriptChunk } from "../lib/project-intelligence";
import { readProjectSettings,serializeProjectSettings } from "../lib/project-settings";
import { coerceEffectSettings,listProjects,loadProject,parseCutFile,saveProject,type EffectSettings,type ProjectSummary } from "../lib/project-store";
import { bandEnvelope } from "../lib/reactive";
import { listRecoveryRevisions,saveRecoveryRevision,type RecoveryRevision } from "../lib/recovery-store";
import type { RenderMotion,RenderOptions } from "../lib/render-engine";
import { isRotoSceneCut,refineRotoAlphaWithTrimap,warpRotoAlphaMatteDeformable } from "../lib/roto-advanced";
import { beginRotoBake,clearRotoBakeKeyframes,createRotoBakeState,failRotoBake,invalidateRotoBake,isRotoBakeFrameCached,pauseRotoBake,resolveRotoBakeRange,rotoBakeCacheKey,updateRotoBakeProgress } from "../lib/roto-bake";
import { chooseRotoIdentityCandidate,markRotoSubjectLost,rememberRotoSubject,rotoIdentityThreshold,rotoReidentificationSeeds,scoreRotoIdentity } from "../lib/roto-memory";
import { nextRotoReviewFrame,rotoFrameNeedsReview } from "../lib/roto-review";
import { alignRotoPath,decodeRotoAlphaMatte,recoverOccludedRotoKeyframes,reduceRotoChatter,rotoAlphaAt,rotoCorrectionWindow,rotoPathAt,rotoPathCss,rotoTrackingProfile,simplifyRotoStroke,stabilizeRotoAlphaMattes,trackRotoPathBidirectional,upsertRotoKeyframe,warpRotoAlphaMatte,type RotoAlphaMatte,type RotoBakeState,type RotoMask,type RotoMaskKeyframe,type RotoPoint,type RotoPrompt,type RotoQuality,type RotoTarget } from "../lib/rotoscope";
import { computeLumaWaveform,computeRgbParade,computeVectorscope } from "../lib/scopes";
import { autoPreviewStatusLabel,hasRenderableSequence,shotMatchSequenceCount } from "../lib/sequence-readiness";
import { NEUTRAL_CLIP_COLOR,buildBaseSequence,deriveBarGrid,sectionTransition,type BaseCut,type SequencePace } from "../lib/sequencer";
import { coerceRenderAnalysis,deriveRenderAnalysis,remapRenderAnalysis,renderAnalysisFrom,type RenderAnalysis } from "../lib/render-analysis";
import { smartReframeKeyframes } from "../lib/smart-reframe";
import { DROP_RAMP,SPEED_PRESETS } from "../lib/speed";
import { STROBE_PRESETS,limitStrobeRate,onsetHitTimes,strobeSafetyReport,strobeTimes,withDropBurst,type StrobeBand,type StrobeBlend,type StrobeMode,type StrobeShape } from "../lib/strobe";
import { customStrobeTimes } from "../lib/strobe-timing";
import { STUTTER_PRESETS,beatSecondsFrom } from "../lib/stutter";
import { EDIT_STYLES,findStyle,suggestStyle,type EditStyle } from "../lib/styles";
import type { Take } from "../lib/take-select";
import type { TextAnimator } from "../lib/text-animate";
import { hasTimeRemap,identityTimeRemap,sampleTimeRemap } from "../lib/time-remap";
import { extractRange,matchFrame,placeBaseCut,removeTimelineGaps,replaceEdit,type TimelineEditMode } from "../lib/timeline-edit";
import { timelineWindowFromScroll,visibleTimelineItems,visibleTimelineTimes,type TimelineWindow } from "../lib/timeline-window";
import { TITLE_DEFAULTS,snapToBeat,type TitleCue,type TitleStyle } from "../lib/titles";
import { transcriptToLyricCues } from "../lib/transcribe";
import { mapSourceTranscriptToTimeline,remapTranscriptAfterDeletion,transcriptDeletionRanges,type TranscriptWord } from "../lib/transcript-edit";
import { TRANSITION_PRESETS,transitionConfigForCut,type TransitionType } from "../lib/transitions";
import { patchTransformGraphKeyframe,type TransformGraphProperty } from "../lib/value-graph";
import { baseCutToVideoClip,splitUnifiedTimeline,toUnifiedTimeline,videoClipToPlacement } from "../lib/video-timeline";
import { moveTimelineTrackTo,setVideoClipFade,splitVideoTrackClip,trimVideoTrackClip,videoClipPlaybackRate } from "../lib/video-track-edit";
import { assessRenderRisk,mergeProtectedCuts,type SmartMediaFilter } from "../lib/workflow";
import { AnalysisProgressDock } from "./analysis-progress-dock";
import { deliverAudioStem } from "./audio-stem-delivery";
import { CompositionBin } from "./composition-bin";
import { layerPointToCompositionPoint } from "./composition-coordinate";
import { CompositionDropSurface } from "./composition-drop-surface";
import { CompositionFocusBar } from "./composition-focus-bar";
import { CompositionMediaLayerPreview } from "./composition-media-layer-preview";
import { CompositionMotionPath } from "./composition-motion-path";
import type { SavedLayerPreset } from "./composition-properties";
import { desktopMediaBridge,type NativeMediaCapabilities } from "./desktop-media";
import type { EditSnapshot } from "./edit-snapshot";
import { LITE_CAPABILITIES,detectEdition,type EditionCapabilities } from "./edition";
import { toggleEditorFullscreen } from "./editor-browser-actions";
import { buildEditorCommandItems } from "./editor-command-registry";
import { createEditorContextActions } from "./editor-context-actions";
import { EditorContextMenuBoundary } from "./editor-context-menu";
import { EditorDocumentTabs } from "./editor-document-tabs";
import { COLORS,DEFAULT_STYLE,buildSections,decodeWaveformPeaks,initialAudioTracks,initialClipTracks,initialCompositions,initialMediaBins,makePlacements,timestamp,type AutoVariation,type ClipTrack,type Placement,type SectionRule } from "./editor-foundation";
import type { MediaAsset,MediaKindFilter,MediaSort } from "./media-browser";
import { materializePathBackedFile,mediaMime,probeVideoDuration } from "./media-file-utils";
import { createEditorialAudio, patchEditorialAudio, planLinkedRazor, planSourceEdit, retimeLinkedAudio, sliceEditorialAudio, splitEditorialAudio } from "../lib/source-edit";
import { NewCompositionDialog } from "./new-composition-dialog";
import { buildMediaLayerCleanPlate,solveMediaLayerCamera } from "./pro-media-workflows";
import { downloadTextFile,hydrateStoredMedia,linkDocumentMedia,offlineMediaAssets,projectDocument } from "./project-document";
import { buildProjectAssemblyTimeline,buildProjectIntelligenceAssets,projectTranscriptSources,transcribeProjectSources } from "./project-intelligence-assets";
import { ProjectPanelTabs,type ProjectPanelTab } from "./project-panel-tabs";
import { captureRotoFrames,layerPointFromStage } from "./rotoscope-client";
import { StudioShell,WorkspaceResizers } from "./studio-shell";
import { StudioTopbar } from "./studio-topbar";
import { useLockerOpen } from "./suite-ui";
import { lockerFileToFile } from "../lib/tcc-suite";
import { TimelineRulerLanes } from "./timeline-ruler-lanes";
import { TimelineToolbar } from "./timeline-toolbar";
import { useCompositionDocuments } from "./use-composition-documents";
import { useEditorEditActions } from "./use-editor-edit-actions";
import { useEditorKeyboardShortcuts } from "./use-editor-keyboard-shortcuts";
import { useProjectSafety } from "./use-project-safety";
import { useRenderQueue } from "./use-render-queue";
import { useSourceTransport } from "./use-source-transport";
import { deliverActiveComposition,deliverVideo,type VideoDeliveryContext } from "./video-delivery";
import { WorkspaceModebar } from "./workspace-modebar";

const UNIFIED_BASE_TRACK = "__base__";
const NO_ACCENTS: number[] = [];

const SequenceInspector = lazy(() => import("./sequence-inspector").then((module) => ({ default: module.SequenceInspector })));
const CanvasPreview = lazy(() => import("./canvas-preview").then((module) => ({ default: module.CanvasPreview })));
const RotoSubjectPanel = lazy(() => import("./roto-subject-panel").then((module) => ({ default: module.RotoSubjectPanel })));
const DeliveryWorkspace = lazy(() => import("./delivery-workspace").then((module) => ({ default: module.DeliveryWorkspace })));
const CompositionTimeline = lazy(() => import("./composition-timeline").then((module) => ({ default: module.CompositionTimeline })));
const CompositionProperties = lazy(() => import("./composition-properties").then((module) => ({ default: module.CompositionProperties })));
const CompositionTransport = lazy(() => import("./composition-stage-controls").then((module) => ({ default: module.CompositionTransport })));
const RotoSelectionSurface = lazy(() => import("./composition-stage-controls").then((module) => ({ default: module.RotoSelectionSurface })));
const SourceProgramMonitor = lazy(() => import("./source-program-monitor").then((module) => ({ default: module.SourceProgramMonitor })));
const MediaBrowser = lazy(() => import("./media-browser").then((module) => ({ default: module.MediaBrowser })));
const EditorPreviewStage = lazy(() => import("./editor-preview-stage").then((module) => ({ default: module.EditorPreviewStage })));
const CompositionAudioPreview = lazy(() => import("./editor-preview-stage").then((module) => ({ default: module.CompositionAudioPreview })));
const NewProjectDialog = lazy(() => import("./new-project-dialog").then((module) => ({ default: module.NewProjectDialog })));
const CommandPalette = lazy(() => import("./command-palette").then((module) => ({ default: module.CommandPalette })));
const AudioMixerSidebar = lazy(() => import("./audio-mixer-sidebar").then((module) => ({ default: module.AudioMixerSidebar })));
const SongSyncPanel = lazy(() => import("./song-sync-panel").then(module => ({ default: module.SongSyncPanel })));
const AutoEditReviewPanel = lazy(() => import("./auto-edit-review-panel").then(module => ({ default: module.AutoEditReviewPanel })));
const TranscriptEditor = lazy(() => import("./transcript-editor").then((module) => ({ default: module.TranscriptEditor })));
const RecoveryHistoryPanel = lazy(() => import("./recovery-history-panel").then((module) => ({ default: module.RecoveryHistoryPanel<EditSnapshot> })));
const EffectsBrowser = lazy(() => import("./effects-browser").then((module) => ({ default: module.TimelineEffectsBrowser })));
const CompositionEffectsBrowser = lazy(() => import("./composition-effects-browser").then((module) => ({ default: module.CompositionEffectsBrowser })));
const AutoDirectorWorkspace = lazy(() => import("./auto-director-workspace").then((module) => ({ default: module.AutoDirectorWorkspace })));
const MobileStudio = lazy(() => import("./mobile-studio").then((module) => ({ default: module.MobileStudio })));

async function renderProject(options: RenderOptions) {
  const renderer = await import("../lib/render-engine");
  return renderer.renderProject(options);
}

export default function Home() {
  const mobileViewport = useMobileWorkspace();
  const browserExport = useBrowserDownload();
  // Latest finished render / hand-off file, offered to "Save to Locker".
  const [lastRender, setLastRender] = useState<{ blob: Blob; name: string; at: number } | null>(null);
  const [lastHandoff, setLastHandoffState] = useState<{ blob: Blob; name: string; at: number } | null>(null);
  const setLastHandoff = (value: { blob: Blob; name: string }) => setLastHandoffState({ ...value, at: Date.now() });
  const videoRef = useRef<HTMLMediaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const compositionStageRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const planInputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const extensionPackInputRef = useRef<HTMLInputElement>(null);
  const effectPluginInputRef = useRef<HTMLInputElement>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const preparedAutoDraftRef = useRef<AutoEditVersion | null>(null);
  const renderAbortRef = useRef<AbortController | null>(null);
  const rotoAbortRef = useRef<AbortController | null>(null);
  const nativeRenderJobRef = useRef<string | null>(null);
  const renderLaunchRef = useRef(false);
  const analysisRunRef = useRef(0);
  const sourceLoadRef = useRef(0);
  const pendingSourceUrlRef = useRef("");
  const analysisStartedRef = useRef(0);
  const urlsRef = useRef<string[]>([]);
  const historyRef = useRef<EditSnapshot[]>([]);
  const futureRef = useRef<EditSnapshot[]>([]);
  const tapTimesRef = useRef<number[]>([]);
  const continuousEditRef = useRef(false);
  const lastAutosaveSignatureRef = useRef("");
  const compDragRef = useRef<{ layerId: string; checkpointed: boolean } | null>(null);
  const transformClipboardRef = useRef<{ duration: number; keyframes: TransformKeyframe[] } | null>(null);
  const [hasTransformClipboard, setHasTransformClipboard] = useState(false);
  const handPanRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const professionalEditDragRef = useRef<{
    tool: "slip" | "slide" | "roll";
    cutId: string;
    startX: number;
    original: BaseCut[];
    trackWidth: number;
    sourceDuration: number;
    lastDelta: number;
  } | null>(null);
  const fadeDragRef = useRef<{
    cutId: string;
    edge: "in" | "out";
    clipLeft: number;
    clipWidth: number;
    clipDuration: number;
  } | null>(null);
  const placementTrimDragRef = useRef<{
    clipId: string;
    edge: "in" | "out";
    trackLeft: number;
    trackWidth: number;
    sourceDuration: number;
    original: Placement;
  } | null>(null);
  const placementFadeDragRef = useRef<{
    clipId: string;
    edge: "in" | "out";
    clipLeft: number;
    clipWidth: number;
    clipDuration: number;
  } | null>(null);
  const transitionDragRef = useRef<{
    cutId: string;
    clipLeft: number;
    clipWidth: number;
    clipDuration: number;
    maxDuration: number;
  } | null>(null);
  const audioFadeDragRef = useRef<{
    clipId: string;
    edge: "in" | "out";
    clipLeft: number;
    clipWidth: number;
    clipDuration: number;
  } | null>(null);
  const suppressTimelineClickRef = useRef(false);
  const nativeProxyJobsRef = useRef(new Map<string, string>());
  const nativeProxyJobByAssetRef = useRef(new Map<string, string>());
  const meterReadingsRef = useRef(new Map<string, LiveMeterReading>());
  const [meterReadings, setMeterReadings] = useState(new Map<string, LiveMeterReading>());
  const meterPublishedAtRef = useRef(0);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [mainSourcePath, setMainSourcePath] = useState("");
  const [mainUrl, setMainUrl] = useState("");
  const [mainName, setMainName] = useState("Untitled project");
  const { duration, setDuration, videoClips, setVideoClips, baseCuts, placements, setBaseCuts, setPlacements, audioClips, setAudioClips } = useSequenceTimeline();
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shuttleRate, setShuttleRate] = useState(0);
  const [meterTick, setMeterTick] = useState(0);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [showScope, setShowScope] = useState(false);
  const [scopeMode, setScopeMode] = useState<"luma" | "rgb" | "vectorscope">("luma");
  const scopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceVideoRef = useRef<HTMLMediaElement>(null);
  const [monitorMode, setMonitorMode] = useState<"source" | "program" | "multicam">("program");
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);
  const [sourceTime, setSourceTime] = useState(0);
  const [sourceRange, setSourceRange] = useState<{ inPoint: number; outPoint: number | null }>({ inPoint: 0, outPoint: null });
  const [matchFrameHistory, setMatchFrameHistory] = useState<Array<{ id: string; assetId: string; label: string; time: number }>>([]);
  const [splitEditHandles, setSplitEditHandles] = useState({ lead: .5, trail: .5 });
  const [dynamicTrimSelection, setDynamicTrimSelection] = useState<DynamicTrimSelection | null>(null);
  const [assets, setAssets, assetsRef] = useCurrentState<MediaAsset[]>([]);
  const [sections, setSections] = useState<SectionRule[]>([]);
  const [beats, setBeats] = useState<number[]>([]);
  const [bpm, setBpm] = useState(120);
  const [beatOffset, setBeatOffset] = useState(0);
  const [compositions, setCompositions] = useState<StudioComposition[]>([]);
  const [savedLayerPresets, setSavedLayerPresets] = useState<SavedLayerPreset[]>([]);
  const [customEffectRecipes, setCustomEffectRecipes] = useState<PortableEffectRecipe[]>([]);
  const [installedExtensionPacks, setInstalledExtensionPacks] = useState<Array<{ id: string; name: string; author: string; layerPresets: number; effectRecipes: number; compositions: number }>>([]);
  const [installedEffectPlugins, setInstalledEffectPlugins] = useState<Array<{ id: string; name: string; author: string; effects: number }>>([]);
  const [autoVariations, setAutoVariations] = useState<AutoVariation[]>([]);
  const [autoPolicy, setAutoPolicy] = useState<AutoEditPolicy>(DEFAULT_AUTO_POLICY);
  const [autoVersions, setAutoVersions] = useState<AutoEditVersion[]>([]);
  const [creatorGoal, setCreatorGoal] = useState<CreatorGoal>("music-video");
  const [inferredCreatorGoal, setInferredCreatorGoal] = useState<CreatorGoal | null>(null);
  const chooseCreatorGoal = (goal: CreatorGoal) => {
    checkpoint();
    setCreatorGoal(goal);
    setInferredCreatorGoal(null);
    const profile = creatorProfile(goal);
    setAspect(profile.aspect); setAutoEnergy(profile.energy); setMontagePace(profile.pace); setStyleId(profile.styleId);
    setAutoPolicy(p => ({...p,timing:goal === "story" ? "dialogue" : goal === "cinematic" ? "scenes" : "music"}));
  };
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"sequence" | "composition">("sequence");
  const [projectPanelTab, setProjectPanelTab] = useState<ProjectPanelTab>("project");
  const [activeCompositionId, setActiveCompositionId] = useState("");
  const [selectedCompLayerId, setSelectedCompLayerId] = useState("");
  const [selectedCompTrackId, setSelectedCompTrackId] = useState("");
  const [clipTracks, setClipTracks] = useState<ClipTrack[]>(initialClipTracks);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>(initialAudioTracks);
  const [audioBuses, setAudioBuses] = useState<AudioBus[]>(DEFAULT_AUDIO_BUSES);
  const [masterGain, setMasterGain] = useState(1);
  const [loudnessHistory, setLoudnessHistory] = useState<number[]>([]);
  const [programLoudnessReport, setProgramLoudnessReport] = useState<ProgramLoudnessReport | null>(null);
  const [programLoudnessRevision, setProgramLoudnessRevision] = useState("");
  const [programLoudnessAnalyzing, setProgramLoudnessAnalyzing] = useState(false);
  const [transcriptWords, setTranscriptWords] = useState<TranscriptWord[]>([]);
  const [selectedTranscriptIds, setSelectedTranscriptIds] = useState<Set<string>>(new Set());
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const transcriptSelectionAnchorRef = useRef<string | null>(null);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState(initialAudioTracks[0].id);
  const [selectedAudioClipId, setSelectedAudioClipId] = useState<string | null>(null);
  const [selectedAutomationPointId, setSelectedAutomationPointId] = useState<string | null>(null);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [timelineRange, setTimelineRange] = useState<TimelineRange>({ inPoint: null, outPoint: null });
  const [timelineTool, setTimelineTool] = useState<TimelineTool>("select");
  const [snapping, setSnapping] = useState(true);
  const [linkedSelection, setLinkedSelection] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineViewport, setTimelineViewport] = useState<TimelineWindow>({ start: 0, end: Number.POSITIVE_INFINITY });
  const [mediaBins, setMediaBins] = useState<MediaBin[]>(initialMediaBins);
  const [activeBinId, setActiveBinId] = useState("bin-root");
  const [mediaSearch, setMediaSearch] = useState("");
  const [smartFilter, setSmartFilter] = useState<SmartMediaFilter>("all");
  const [mediaKindFilter, setMediaKindFilter] = useState<MediaKindFilter>("all");
  const [mediaSort, setMediaSort] = useState<MediaSort>("name");
  const [mediaView, setMediaView] = useState<"list" | "grid">("grid");
  const [recoveryRevisions, setRecoveryRevisions] = useState<RecoveryRevision<EditSnapshot>[]>([]);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState(initialClipTracks[0].id);
  const [draggingPlacementId, setDraggingPlacementId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [selectedBaseCutId, setSelectedBaseCutId] = useState<string | null>(null);
  const [selectedBaseCutIds, setSelectedBaseCutIds] = useState<string[]>([]);
  // Working transform values for the keyframe editor; "Add keyframe" commits
  // these to the selected clip at the playhead.
  const [motionDraft, setMotionDraft] = useState({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState("Import media and place it on the timeline, or choose Auto Cut for an assisted edit.");
  const [activePanel, setActivePanel] = useState<"section" | "base" | "clip" | "track" | "audio">("base");
  const [editorMode, setEditorMode] = useState<"auto" | "pro">("auto");
  const [proWorkspace, setProWorkspace] = useState<"edit" | "color" | "audio">("edit");
  const [capabilities, setCapabilities] = useState<EditionCapabilities>(LITE_CAPABILITIES);
  const isPro = capabilities.edition === "pro";
  const [timelineEditMode, setTimelineEditMode] = useState<TimelineEditMode>("overwrite");
  const [exportFrameRate, setExportFrameRate] = useState<24 | 25 | 30 | 50 | 60>(30);
  const [exportMaxDimension, setExportMaxDimension] = useState<1920 | 3840>(1920);
  const [exportFormat, setExportFormat] = useState<RenderFormat>("mp4-h264");
  const [exportProfileSupport, setExportProfileSupport] = useState<ExportProfileSupport>({ supported: true, checking: true, codec: "", message: "Checking selected export profile…" });
  const [renderQueue, setRenderQueue] = useRenderQueue(isPro);
  const [renderQueueOpen, setRenderQueueOpen] = useState(false);
  const [renderQueuePaused, setRenderQueuePaused] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState("Detecting hardware acceleration…");
  const [nativeMediaAvailable, setNativeMediaAvailable] = useState(false);
  const [nativeCapabilities, setNativeCapabilities] = useState<NativeMediaCapabilities | null>(null);
  const [activeProjectId, setActiveProjectId] = useState("current");
  const [projectLibrary, setProjectLibrary] = useState<ProjectSummary[]>([]);
  const [autoEnergy, setAutoEnergy] = useState<"smooth" | "dynamic" | "maximum">(DEFAULT_STYLE.energy);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [manualDropTime, setManualDropTime] = useState<number | null>(null);
  const [savedRenderAnalysis, setSavedRenderAnalysis] = useState<RenderAnalysis | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [montageEnabled, setMontageEnabled] = useState(true);
  const [montagePace, setMontagePace] = useState<SequencePace>(DEFAULT_STYLE.pace);
  const [punchPreset, setPunchPreset] = useState<keyof typeof PUNCH_PRESETS>(DEFAULT_STYLE.punch);
  const [lookPreset, setLookPreset] = useState<keyof typeof GRADE_PRESETS>(DEFAULT_STYLE.look);
  const [manualGrade, setManualGrade] = useState<GradeAdjust>(NEUTRAL_GRADE_ADJUST);
  // Master tone-curve look (a key into CURVE_PRESETS). "none" = identity.
  const [colorCurve, setColorCurve] = useState<keyof typeof CURVE_PRESETS>("none");
  const [colorBypass, setColorBypass] = useState(false);
  // Imported creative .cube LUT + mix (Lite look section and Pro Color workspace).
  const creativeLut = useCreativeLut(() => setColorBypass(false), setStatus);
  const { source: lut3dSource, setSource: setLut3dSource, mix: lut3dMix, setMix: setLut3dMix, inputRef: lutInputRef } = creativeLut;
  const [colorManagement, setColorManagement] = useState<ColorManagementSettings>(DEFAULT_COLOR_MANAGEMENT);
  const [gradeClipboard, setGradeClipboard] = useState<{ look: keyof typeof GRADE_PRESETS; grade: GradeAdjust } | null>(null);
  const [transitionType, setTransitionType] = useState<TransitionType>(DEFAULT_STYLE.transition);
  // "auto" = let the analysed track pick the style (see runAnalysis). The
  // param defaults above still come from DEFAULT_STYLE as a pre-analysis look.
  const [styleId, setStyleId] = useState<string>("auto");
  // The New Project setup screen — the first thing a fresh session sees, where
  // the canvas (aspect/fps/resolution) and name are chosen. Reopenable from the
  // top bar; non-destructive, so reopening on an existing edit just retunes the
  // output. `projectNameDraft` seeds the timeline title on Start.
  const [newProjectOpen, setNewProjectOpen] = useState(true);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  // Output frame shape. Vertical for TikTok/Reels, square/4:5 for Instagram.
  const [aspect, setAspect] = useState<OutputAspect>("source");
  // Exact pixel size used when aspect is "custom".
  const [customSize, setCustomSize] = useState({ width: 1080, height: 1080 });
  // The loaded footage's intrinsic size, captured on load, so the "source"
  // preview matches its shape without reading a ref during render.
  const [sourceDims, setSourceDims] = useState({ w: 1280, h: 720 });
  // Whether this browser can actually export (WebCodecs + OffscreenCanvas).
  // Defaults optimistic so SSR and the first client render agree; the real
  // check runs after mount, warning Safari/Firefox before they build an edit.
  const [renderSupport, setRenderSupport] = useState({ supported: true, message: "" });
  useEffect(() => {
    // Deferred so it doesn't setState synchronously in the effect body (and so
    // SSR/first-client render agree on "supported" before the real check lands).
    const id = window.setTimeout(() => setRenderSupport(checkRenderSupport()), 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const edition = detectEdition(window.location, window.navigator.userAgent);
      setCapabilities(edition);
      if (edition.edition === "pro") {
        setEditorMode("pro");
        void listProjects().then(setProjectLibrary).catch(() => undefined);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!isPro) return;
    let active = true;
    const bridge = desktopMediaBridge();
    if (bridge) {
      void bridge.getMediaCapabilities().then((result) => {
        if (!active) return;
        setNativeCapabilities(result);
        setNativeMediaAvailable(result.available);
        setHardwareStatus(result.message);
      }).catch(() => {
        if (!active) return;
        setNativeCapabilities(null);
        setNativeMediaAvailable(false);
        setHardwareStatus("Native engine unavailable · WebCodecs fallback active");
      });
      return () => { active = false; };
    }
    if (typeof VideoEncoder === "undefined") {
      const id = window.setTimeout(() => { if (active) setHardwareStatus("Software encoding fallback"); }, 0);
      return () => { active = false; window.clearTimeout(id); };
    }
    const cores = navigator.hardwareConcurrency || 0;
    void VideoEncoder.isConfigSupported({
      codec: "avc1.640028",
      width: 1920,
      height: 1080,
      bitrate: 12_000_000,
      framerate: 30,
      hardwareAcceleration: "prefer-hardware",
    }).then((result) => {
      if (!active) return;
      setHardwareStatus(result.supported
        ? `Hardware-preferred WebCodecs ready${cores ? ` · ${cores} CPU threads` : ""}`
        : "Software encoding fallback");
    }).catch(() => { if (active) setHardwareStatus("Software encoding fallback"); });
    return () => { active = false; };
  }, [isPro]);

  useEffect(() => {
    const bridge = desktopMediaBridge();
    if (!isPro || !bridge) return;
    return bridge.onMediaProgress(({ jobId, progress, stage, message }) => {
      if (nativeRenderJobRef.current === jobId) {
        const safeProgress = Math.max(0, Math.min(1, progress));
        // Audio preparation may already have advanced the delivery indicator.
        setRenderProgress(current => Math.max(current, safeProgress));
        setStatus(stage ? message : `Native engine rendering… ${Math.round(safeProgress * 100)}%`);
        setRenderQueue((items) => items.map((job) => job.id === jobId ? {
          ...job,
          progress: safeProgress,
          status: stage ?? "rendering",
          message: stage ? message : "Native engine rendering",
          checkpoint: { progress: safeProgress, frame: 0, updatedAt: Date.now() },
        } : job));
        return;
      }
      const assetId = nativeProxyJobsRef.current.get(jobId);
      if (!assetId) return;
      setAssets((items) => items.map((item) => item.id === assetId ? { ...item, proxyProgress: Math.max(0, Math.min(1, progress)) } : item));
    });
  }, [isPro, setRenderQueue, setAssets]);
  const [strobePreset, setStrobePreset] = useState<keyof typeof STROBE_PRESETS>(DEFAULT_STYLE.strobe as keyof typeof STROBE_PRESETS);
  const [strobeColor, setStrobeColor] = useState("#ffffff");
  const [strobeSecondaryColor, setStrobeSecondaryColor] = useState("#ff334f");
  const [strobeAlternate, setStrobeAlternate] = useState(false);
  const [strobeIntensity, setStrobeIntensity] = useState(0.7);
  const [strobeAttack, setStrobeAttack] = useState(0);
  const [strobeHold, setStrobeHold] = useState(0.008);
  const [strobeDecay, setStrobeDecay] = useState(0.08);
  const [strobeShape, setStrobeShape] = useState<StrobeShape>("exponential");
  const [strobeMode, setStrobeMode] = useState<StrobeMode>("full");
  const [strobeBlend, setStrobeBlend] = useState<StrobeBlend>("screen");
  const [strobeX, setStrobeX] = useState(0.5);
  const [strobeY, setStrobeY] = useState(0.5);
  const [strobeSize, setStrobeSize] = useState(0.75);
  const [strobeSoftness, setStrobeSoftness] = useState(0.65);
  const [strobeAngle, setStrobeAngle] = useState(0);
  const [strobeSafeMode, setStrobeSafeMode] = useState(true);
  const [strobeTiming, setStrobeTiming] = useState<"song" | "custom">("song");
  const [strobeBpm, setStrobeBpm] = useState(120);
  const [strobeSensitivity, setStrobeSensitivity] = useState(0.5);
  const [strobeBand, setStrobeBand] = useState<StrobeBand>("all");
  const applyStrobePreset = (preset: keyof typeof STROBE_PRESETS) => {
    const config = STROBE_PRESETS[preset];
    if (preset === "drums") setStrobeTiming("song");
    setStrobePreset(preset);
    setStrobeColor(config.color);
    setStrobeSecondaryColor(config.secondaryColor ?? config.color);
    setStrobeAlternate(config.alternate ?? false);
    setStrobeIntensity(config.intensity);
    setStrobeAttack(config.attack ?? 0);
    setStrobeHold(config.hold ?? 0);
    setStrobeDecay(config.decay);
    setStrobeShape(config.shape ?? "exponential");
    setStrobeMode(config.mode ?? "full");
    setStrobeBlend(config.blend ?? "screen");
    setStrobeX(config.x ?? 0.5);
    setStrobeY(config.y ?? 0.5);
    setStrobeSize(config.size ?? 0.75);
    setStrobeSoftness(config.softness ?? 0.65);
    setStrobeAngle(config.angle ?? 0);
  };
  const [stutterPreset, setStutterPreset] = useState<keyof typeof STUTTER_PRESETS>("off");
  const [speedPreset, setSpeedPreset] = useState<keyof typeof SPEED_PRESETS>("off");
  // Auto slow-mo decelerating into a pronounced drop. On by default; the montage
  // already cuts on the drop, so the freeze resolves into a fresh clip at speed.
  const [dropRampEnabled, setDropRampEnabled] = useState(true);
  // Audio-reactive motion: a continuous bass-pump zoom + hats shimmer riding the
  // band envelopes, on top of the beat punch. Off by default (an extra flavour).
  const [audioReactive, setAudioReactive] = useState(false);
  const [shakePreset, setShakePreset] = useState<keyof typeof SHAKE_PRESETS>("off");
  const [mirrorMode, setMirrorMode] = useState(0);
  const [streak, setStreak] = useState(0);
  const [echoPreset, setEchoPreset] = useState<keyof typeof ECHO_PRESETS>("off");
  const [titles, setTitles] = useState<TitleCue[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleStyle, setTitleStyle] = useState<TitleStyle>("slam");
  // Kinetic typography: how each title's characters animate in (AE-style).
  const [titleAnimator, setTitleAnimator] = useState<TextAnimator>("none");
  // Natural-language editing: the user's plain-English "make it punchier" box.
  const [editCommandDraft, setEditCommandDraft] = useState("");
  // Auto-lyrics: the user's pasted words, and how many beats each line holds.
  const [lyricsDraft, setLyricsDraft] = useState("");
  const [lyricDensity, setLyricDensity] = useState<"fast" | "normal" | "slow">("normal");
  const [transcribing, setTranscribing] = useState(false);
  const [autoCutTranscribing,setAutoCutTranscribing]=useState(false);
  const [deepProjectAnalyzing, setDeepProjectAnalyzing] = useState(false);
  const [storyBrief, setStoryBrief] = useState("");
  const [projectTranscripts, setProjectTranscripts] = useState<Record<string, ProjectTranscriptChunk[]>>({});
  const [projectIntelligence, setProjectIntelligence] = useState<ProjectIntelligence | null>(null);
  const meterVisibleRef = useRef(false);
  useEffect(() => {
    meterVisibleRef.current = isPro && editorMode === "pro" && proWorkspace === "audio";
  }, [isPro, editorMode, proWorkspace]);
  const publishMeter = (id: string, reading: LiveMeterReading) => {
    meterReadingsRef.current.set(id, reading);
    const now = performance.now();
    if (meterVisibleRef.current && now - meterPublishedAtRef.current >= 80) {
      meterPublishedAtRef.current = now;
      setMeterReadings(new Map(meterReadingsRef.current));
      setMeterTick((value) => value + 1);
    }
  };
  // Show a "back to site" link only when the editor is embedded under /app/ on
  // the marketing site. Set after mount so SSR and hydration agree.
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    // Deferred so it doesn't setState synchronously in the effect body, and so
    // SSR and the first client render agree (both start false).
    const id = window.setTimeout(() => setEmbedded(window.location.pathname.replace(/\/$/, "").endsWith("/app")), 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => {
    try {
      const presetRaw = window.localStorage.getItem("scenepilot-layer-presets-v1");
      const recipeRaw = window.localStorage.getItem("scenepilot-effect-recipes-v1");
      const layerPresets = presetRaw ? JSON.parse(presetRaw) : [];
      const effectRecipes = recipeRaw ? JSON.parse(recipeRaw) : [];
      if ((Array.isArray(layerPresets) && layerPresets.length) || (Array.isArray(effectRecipes) && effectRecipes.length)) {
        const library = createExtensionPack({ id: "local-library", name: "Local Library", author: "ScenePilot Creator", layerPresets, effectRecipes, compositions: [] });
        setSavedLayerPresets(library.layerPresets.slice(-100));
        setCustomEffectRecipes(library.effectRecipes.slice(-100));
      }
    } catch { /* A malformed local extension library is ignored safely. */ }
    try {
      const raw = window.localStorage.getItem("scenepilot-extension-packs-v1");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setInstalledExtensionPacks(parsed.slice(-32));
    } catch { /* Pack receipts are informational and can be rebuilt by reinstalling. */ }
    try {
      const raw = window.localStorage.getItem("scenepilot-effect-plugins-v1");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setInstalledEffectPlugins(parsed.slice(-32));
    } catch { /* Plugin receipts are informational and can be rebuilt by reinstalling. */ }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!isPro || !mainUrl) return;
    let detach: () => void = () => {};
    const id = window.setTimeout(() => {
      const media = videoRef.current;
      if (media) detach = attachLiveAudioMeter(media, (reading) => publishMeter("main", reading), () => media.paused ? 0 : masterGain);
    }, 0);
    return () => { window.clearTimeout(id); detach(); };
  }, [isPro, mainUrl, masterGain]);
  const rerollSeedRef = useRef(1);

  const selectedSection = sections.find((item) => item.id === selectedSectionId) ?? sections[0];
  const selectedPlacement = placements.find((item) => item.id === selectedPlacementId) ?? null;
  const selectedBaseCut = baseCuts.find((item) => item.id === selectedBaseCutId) ?? null;
  const selectedBaseCutSet = effectiveCutSelection(baseCuts, selectedBaseCutIds, selectedBaseCutId);

  useEffect(() => {
    if (!selectedBaseCutId && selectedBaseCutIds.length) {
      const id = window.setTimeout(() => setSelectedBaseCutIds([]), 0);
      return () => window.clearTimeout(id);
    }
  }, [selectedBaseCutId, selectedBaseCutIds.length]);
  const selectedBaseCutIndex = selectedBaseCut ? baseCuts.findIndex((item) => item.id === selectedBaseCut.id) : -1;
  const selectedCutTransition = selectedBaseCutIndex >= 0
    ? transitionConfigForCut(baseCuts, selectedBaseCutIndex, TRANSITION_PRESETS[transitionType])
    : TRANSITION_PRESETS.none;
  const selectedBaseAsset = selectedBaseCut ? assets.find((item) => item.id === selectedBaseCut.assetId) : undefined;
  const selectedBaseIsMain = selectedBaseCut?.assetId === MAIN_SOURCE_ID;
  const selectedBaseAssetDuration = (selectedBaseIsMain ? analysis?.duration ?? duration : selectedBaseAsset?.duration)
    ?? analysis?.effects.find((effect) => effect.assetId === selectedBaseAsset?.id)?.sourceDuration
    ?? 30;
  const mediaName = (assetId: string) => assetId === MAIN_SOURCE_ID ? (mainName || mainFile?.name || "Main source") : assets.find((asset) => asset.id === assetId)?.name;
  const mediaColor = (assetId: string) => assetId === MAIN_SOURCE_ID ? "#34d6c7" : assets.find((asset) => asset.id === assetId)?.color;
  const selectedBaseRate = selectedBaseCut ? clipPlaybackRate(selectedBaseCut) : 1;
  const selectedBaseMaxRate = selectedBaseCut
    ? Math.max(0.1, Math.min(8, (selectedBaseAssetDuration - selectedBaseCut.sourceStart) / Math.max(0.05, selectedBaseCut.duration)))
    : 8;
  const selectedPlacementAsset = selectedPlacement ? assets.find((item) => item.id === selectedPlacement.assetId) : undefined;
  const selectedPlacementComposition = selectedPlacement?.compositionId
    ? compositions.find((item) => item.id === selectedPlacement.compositionId)
    : null;
  const selectedPlacementSourceDurationRaw = selectedPlacementComposition?.duration
    ?? selectedPlacementAsset?.duration
    ?? analysis?.effects.find((effect) => effect.assetId === selectedPlacementAsset?.id)?.sourceDuration
    ?? 30;
  const selectedPlacementSourceDuration = Number.isFinite(selectedPlacementSourceDurationRaw)
    ? selectedPlacementSourceDurationRaw
    : Math.max(duration, (selectedPlacement?.sourceStart ?? 0) + (selectedPlacement?.duration ?? 0));
  const selectedPlacementRate = selectedPlacement ? videoClipPlaybackRate(selectedPlacement) : 1;
  const selectedPlacementMaxRate = selectedPlacement
    ? Math.max(0.1, Math.min(8, (selectedPlacementSourceDuration - selectedPlacement.sourceStart) / Math.max(0.05, selectedPlacement.duration)))
    : 8;
  useEffect(() => {
    const id = window.setTimeout(() => {
    if (!selectedBaseCut) {
      setMotionDraft({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
      return;
    }
    const localTime = Math.max(0, Math.min(selectedBaseCut.duration, currentTime - selectedBaseCut.start));
    setMotionDraft(evaluateTransformKeyframes(selectedBaseCut.transformKeyframes, localTime));
    }, 0);
    return () => window.clearTimeout(id);
  // Only reset the working values when clip selection changes. Following the
  // playhead here would overwrite a value while the editor is dragging it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBaseCutId]);
  const selectedTrack = clipTracks.find((item) => item.id === (selectedPlacement?.trackId ?? selectedTrackId)) ?? clipTracks[0];
  const selectedAudioTrack = audioTracks.find((item) => item.id === selectedAudioTrackId) ?? audioTracks[0];
  const selectedAudioClip = audioClips.find((item) => item.id === selectedAudioClipId) ?? null;
  const selectedAutomationPoint = selectedAudioClip?.automation?.find((point) => point.id === selectedAutomationPointId) ?? null;
  const visualAssets = useMemo(() => assets.filter((asset) => asset.kind !== "audio"), [assets]);
  const projectIntelligenceAssets = (result: AnalysisResult | null = analysis, transcripts = projectTranscripts) => buildProjectIntelligenceAssets({
    result,
    transcripts,
    visualAssets,
    hasMainVideo: Boolean(mainFile && !mainIsAudio),
    mainName,
  });
  const multicamAssets = useMemo(() => assets
    .filter((asset) => asset.kind === "video" && Boolean(asset.url) && Number.isFinite(asset.duration) && (asset.duration ?? 0) > 0)
    .slice(0, 9), [assets]);
  const activeMulticamAngleId = baseCuts.find((cut) => currentTime >= cut.start - 1e-6 && currentTime < cut.start + cut.duration - 1e-6)?.assetId;
  const sourceAsset = assets.find((asset) => asset.id === sourceAssetId) ?? null;
  const sourceDuration = sourceAsset?.duration && Number.isFinite(sourceAsset.duration) ? sourceAsset.duration : 5;
  const sourceOut = Math.max(sourceRange.inPoint + 0.05, Math.min(sourceDuration, sourceRange.outPoint ?? sourceDuration));
  const mediaUsage = useMemo(() => mediaUsageCounts(baseCuts, placements, audioClips, compositions), [baseCuts, placements, audioClips, compositions]);
  const visibleAssets = useMemo(() => queryMediaAssets(assets, { activeBinId, mediaSearch, mediaKindFilter, smartFilter, mediaSort, profiles: analysis?.effects, mediaUsage }), [assets, activeBinId, mediaSearch, analysis, smartFilter, mediaKindFilter, mediaSort, mediaUsage]);
  const activeComposition = compositions.find((item) => item.id === activeCompositionId) ?? compositions[0];
  const selectedCompLayer = activeComposition?.layers.find((item) => item.id === selectedCompLayerId);
  const activeCompositionTracks = activeComposition?.tracks ?? [];
  const activeCompTrackById = new Map(activeCompositionTracks.map((track) => [track.id, track]));
  const activeCompVideoSolo = activeCompositionTracks.some((track) => track.kind === "video" && track.solo);
  const nestedCompositionAudioPlan = useMemo(() => compositionAudioPlan(compositions, placements, clipTracks), [compositions, placements, clipTracks]);
  const activeCompositionVisualLayers = activeComposition ? orderedCompositionLayers(activeComposition, "video") : [];
  const selectedCompKeyframe = selectedCompLayer?.keyframes.find((item) => item.id === selectedKeyframeId) ?? null;
  const selectedLayerTransform = selectedCompKeyframe ?? selectedCompLayer;
  const snapCandidates = useMemo(
    () => markerSnapCandidates(baseCuts, markers, beats, timelineRange),
    [baseCuts, markers, beats, timelineRange],
  );
  const [compositionTime, setCompositionTime] = useState(0);
  const [rotoMode, setRotoMode] = useState<"off" | "select" | "add" | "subtract" | "hair" | "solid">("off");
  const [rotoTarget, setRotoTarget] = useState<RotoTarget>("auto");
  const [rotoQuality, setRotoQuality] = useState<RotoQuality>("standard");
  const [rotoTolerance, setRotoTolerance] = useState(1);
  const [rotoEdgeSensitivity, setRotoEdgeSensitivity] = useState(.55);
  const [rotoBrushSize, setRotoBrushSize] = useState(.022);
  const [rotoBrushStrength, setRotoBrushStrength] = useState(.8);
  const [rotoView, setRotoView] = useState<"overlay" | "alpha" | "edge">("overlay");
  const [rotoBackend, setRotoBackend] = useState<"uninitialized" | "native" | "gpu" | "cpu">("uninitialized");
  const [rotoTracking, setRotoTracking] = useState<{ active: boolean; current: number; total: number; direction: string }>({ active: false, current: 0, total: 0, direction: "" });
  const rotoStrokeRef = useRef<{ pointerId: number; layer: RotoPoint[]; stage: RotoPoint[] } | null>(null);
  const [rotoStrokePreview, setRotoStrokePreview] = useState<RotoPoint[]>([]);
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>("auto");
  const [previewPerformance, setPreviewPerformance] = useState<PreviewPerformanceSample>({ averageFrameMs: 0, droppedFrameRatio: 0, cacheEntries: 0, activeDecoders: 0, quality: "full" });
  const selectedRotoPath = rotoPathAt(selectedCompLayer?.roto, compositionTime);
  const selectedSectionHitCount = selectedSection ? placements.filter((item) => item.sectionId === selectedSection.id).length : 0;
  // Which clips are on screen is now decided by the shared frame model in
  // lib/compositor.ts, which both the live preview and the renderer consume.
  const visibleBeats = useMemo(() => beats.filter((beat) => beat <= duration), [beats, duration]);
  const timelineBaseCuts = useMemo(() => visibleTimelineItems(baseCuts, timelineViewport), [baseCuts, timelineViewport]);
  const timelinePlacements = useMemo(() => visibleTimelineItems(placements, timelineViewport), [placements, timelineViewport]);
  const timelineAudioClips = useMemo(() => visibleTimelineItems(audioClips, timelineViewport), [audioClips, timelineViewport]);
  const timelineBeats = useMemo(() => visibleTimelineTimes(visibleBeats, timelineViewport), [visibleBeats, timelineViewport]);
  const energyBars = useMemo(() => {
    if (!analysis?.signals.length) return Array.from({ length: 180 }, () => 8);
    return Array.from({ length: 180 }, (_, index) => {
      const start = Math.floor((index / 180) * analysis.signals.length);
      const end = Math.max(start + 1, Math.floor(((index + 1) / 180) * analysis.signals.length));
      const points = analysis.signals.slice(start, end);
      const level = Math.max(...points.map((point) => point.energy * 0.68 + point.onset * 0.32));
      return Math.round(8 + level * 88);
    });
  }, [analysis]);
  const overallAnalysisProgress = analysisProgress
    ? ({ audio: 0, footage: 25, effects: 70, edit: 88 }[analysisProgress.phase]
      + analysisProgress.progress * ({ audio: 25, footage: 45, effects: 18, edit: 12 }[analysisProgress.phase]))
    : 0;
  const analysisEta = overallAnalysisProgress >= 3
    ? analysisElapsed * (100 - overallAnalysisProgress) / overallAnalysisProgress
    : Number.NaN;
  const mainIsAudio = mainFile?.type.startsWith("audio/") ?? false;
  const directorArc = sections.map((section) => section.pattern.toUpperCase()).join("  /  ");
  useEffect(() => {
    urlsRef.current = [
      mainUrl,
      ...assets.flatMap((asset) => [asset.url, asset.proxyUrl]),
    ].filter((url): url is string => Boolean(url));
  }, [mainUrl, assets]);

  useEffect(() => () => {
    analysisAbortRef.current?.abort();
    renderAbortRef.current?.abort();
    if (pendingSourceUrlRef.current) URL.revokeObjectURL(pendingSourceUrlRef.current);
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const timeline = timelineScrollRef.current;
    if (!timeline || editorMode !== "pro" || workspaceView !== "sequence") return;
    setTimelineViewport(timelineWindowFromScroll(timeline.scrollLeft, timeline.clientWidth, timeline.scrollWidth, duration, Math.max(2, 8 / timelineZoom)));
  }, [duration, editorMode, timelineZoom, workspaceView]);

  useEffect(() => {
    if (!analyzing) return;
    analysisStartedRef.current = window.performance.now();
    const timer = window.setInterval(() => {
      setAnalysisElapsed((window.performance.now() - analysisStartedRef.current) / 1000);
    }, 250);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  const songBeatMaps = useMemo(() => Object.fromEntries(assets.flatMap(a => a.beatMap ? [[a.id, a.beatMap]] : [])), [assets]);
  const snapshot = (): EditSnapshot => ({
    autoPolicy, autoVersions, creatorGoal, inferredCreatorGoal,
    songBeatMaps,
    duration, videoClips, sections, placements, compositions, baseCuts, clipTracks, titles, transcriptWords, projectIntelligence, projectTranscripts, storyBrief, beats, bpm, beatOffset, aspect, customSize,
    styleId, autoEnergy, montageEnabled, montagePace, punchPreset, transitionType, strobePreset,
    strobeColor, strobeSecondaryColor, strobeAlternate, strobeIntensity, strobeAttack, strobeHold, strobeDecay, strobeShape,
    strobeMode, strobeBlend, strobeX, strobeY, strobeSize, strobeSoftness, strobeAngle, strobeSafeMode, strobeTiming, strobeBpm,
    strobeSensitivity, strobeBand, stutterPreset, speedPreset, dropRampEnabled, audioReactive, shakePreset, lookPreset,
    manualGrade, colorCurve, mirrorMode, streak, echoPreset, workspaceView, activeCompositionId, selectedCompLayerId,
    selectedKeyframeId, selectedSectionId, selectedPlacementId, selectedBaseCutId, selectedTrackId,
    audioTracks, audioBuses, masterGain, colorManagement, audioClips, mediaBins, markers, timelineRange, snapping, linkedSelection, manualDropTime, renderAnalysis, exportFrameRate, exportFormat, exportMaxDimension, lut3dSource, lut3dMix,
  });
  const clearHistory = () => {
    continuousEditRef.current = false;
    historyRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  };
  const initialProject = useRef<EditSnapshot | null>(null);
  useEffect(() => { if (!initialProject.current) initialProject.current = structuredClone(snapshot()); });
  const checkpoint = () => {
    historyRef.current = [...historyRef.current.slice(-49), structuredClone(snapshot())];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };
  // Async imports checkpoint the current edit, not the render that began probing files.
  const latestCheckpointRef = useRef(checkpoint);
  useEffect(() => { latestCheckpointRef.current = checkpoint; });
  const compositionImportPendingRef = useRef(false);
  const latestCompositionsRef = useRef(compositions);
  useEffect(() => { latestCompositionsRef.current = compositions; }, [compositions]);
  const beginContinuousEdit = () => {
    if (continuousEditRef.current) return;
    checkpoint();
    continuousEditRef.current = true;
  };
  const endContinuousEdit = () => {
    continuousEditRef.current = false;
  };
  const continuousEditHandlers = {
    onPointerDown: beginContinuousEdit,
    onPointerUp: endContinuousEdit,
    onPointerCancel: endContinuousEdit,
    onKeyDown: beginContinuousEdit,
    onKeyUp: endContinuousEdit,
    onBlur: endContinuousEdit,
  };
  const restoreSnapshot = (value: EditSnapshot) => {
    const intent = restoreCreatorIntent(value, mainFile);
    setCreatorGoal(intent.creatorGoal); setInferredCreatorGoal(intent.inferredCreatorGoal);
    setAutoPolicy(value.autoPolicy ?? DEFAULT_AUTO_POLICY);
    if(value.autoVersions) setAutoVersions(value.autoVersions);
    if (value.exportFrameRate) setExportFrameRate(value.exportFrameRate);
    if (value.exportFormat) setExportFormat(value.exportFormat);
    if (value.exportMaxDimension) setExportMaxDimension(value.exportMaxDimension);
    setLut3dSource(value.lut3dSource ?? null); setLut3dMix(value.lut3dMix ?? 1);
    const restoredCompositions = normalizeCompositions(value.compositions);
    if (typeof value.duration === "number" && Number.isFinite(value.duration)) {
      setDuration(Math.max(.05, value.duration));
    }
    setSections(value.sections);
    if (value.songBeatMaps) setAssets(items => items.map(a => ({ ...a, beatMap: value.songBeatMaps?.[a.id] })));
    // Prefer the unified array; rebuild it from the legacy pair for older snapshots.
    setVideoClips(value.videoClips ?? toUnifiedTimeline(value.baseCuts, value.placements, UNIFIED_BASE_TRACK));
    setCompositions(restoredCompositions);
    setClipTracks(value.clipTracks);
    setTitles(value.titles);
    setTranscriptWords(value.transcriptWords ?? []);
    setProjectIntelligence(value.projectIntelligence ?? null);
    setProjectTranscripts(value.projectTranscripts ?? {});
    setStoryBrief(value.storyBrief ?? "");
    setSelectedTranscriptIds(new Set());
    setBeats(value.beats);
    setBpm(value.bpm);
    setBeatOffset(value.beatOffset);
    setAspect(value.aspect);
    setCustomSize(value.customSize ?? { width: 1080, height: 1080 });
    setStyleId(value.styleId);
    setAutoEnergy(value.autoEnergy);
    setMontageEnabled(value.montageEnabled);
    setMontagePace(value.montagePace);
    setPunchPreset(value.punchPreset);
    setTransitionType(value.transitionType);
    setStrobePreset(value.strobePreset);
    setStrobeColor(value.strobeColor);
    const restoredStrobe = STROBE_PRESETS[value.strobePreset] ?? STROBE_PRESETS.off;
    setStrobeSecondaryColor(value.strobeSecondaryColor ?? restoredStrobe.secondaryColor ?? value.strobeColor);
    setStrobeAlternate(value.strobeAlternate ?? restoredStrobe.alternate ?? false);
    setStrobeIntensity(value.strobeIntensity ?? restoredStrobe.intensity);
    setStrobeAttack(value.strobeAttack ?? restoredStrobe.attack ?? 0);
    setStrobeHold(value.strobeHold ?? restoredStrobe.hold ?? 0);
    setStrobeDecay(value.strobeDecay ?? restoredStrobe.decay);
    setStrobeShape(value.strobeShape ?? restoredStrobe.shape ?? "exponential");
    setStrobeMode(value.strobeMode ?? restoredStrobe.mode ?? "full");
    setStrobeBlend(value.strobeBlend ?? restoredStrobe.blend ?? "screen");
    setStrobeX(value.strobeX ?? restoredStrobe.x ?? 0.5);
    setStrobeY(value.strobeY ?? restoredStrobe.y ?? 0.5);
    setStrobeSize(value.strobeSize ?? restoredStrobe.size ?? 0.75);
    setStrobeSoftness(value.strobeSoftness ?? restoredStrobe.softness ?? 0.65);
    setStrobeAngle(value.strobeAngle ?? restoredStrobe.angle ?? 0);
    setStrobeSafeMode(value.strobeSafeMode ?? true);
    setStrobeTiming(value.strobeTiming ?? "song");
    setStrobeBpm(value.strobeBpm ?? 120);
    setStrobeSensitivity(value.strobeSensitivity);
    setStrobeBand(value.strobeBand);
    setStutterPreset(value.stutterPreset);
    setSpeedPreset(value.speedPreset);
    setDropRampEnabled(value.dropRampEnabled ?? true);
    setAudioReactive(value.audioReactive ?? false);
    setShakePreset(value.shakePreset);
    setLookPreset(value.lookPreset);
    setManualGrade(value.manualGrade ?? NEUTRAL_GRADE_ADJUST);
    setColorCurve(value.colorCurve && CURVE_PRESETS[value.colorCurve] ? value.colorCurve : "none");
    setMirrorMode(value.mirrorMode);
    setStreak(value.streak);
    setEchoPreset(value.echoPreset);
    setWorkspaceView(value.workspaceView);
    setActiveCompositionId(value.activeCompositionId);
    setSelectedCompLayerId(value.selectedCompLayerId);
    const restoredComposition = restoredCompositions.find((composition) => composition.id === value.activeCompositionId) ?? restoredCompositions[0];
    const restoredLayer = restoredComposition?.layers.find((layer) => layer.id === value.selectedCompLayerId) ?? restoredComposition?.layers[0];
    setSelectedCompTrackId(restoredLayer?.trackId ?? restoredComposition?.tracks?.[0]?.id ?? "");
    setSelectedKeyframeId(value.selectedKeyframeId);
    setSelectedSectionId(value.selectedSectionId);
    setSelectedPlacementId(value.selectedPlacementId);
    setSelectedBaseCutId(value.selectedBaseCutId);
    setSelectedTrackId(value.selectedTrackId);
    setAudioTracks(value.audioTracks ?? initialAudioTracks);
    setAudioBuses(value.audioBuses ?? DEFAULT_AUDIO_BUSES);
    setMasterGain(value.masterGain ?? 1);
    setColorManagement(value.colorManagement ?? DEFAULT_COLOR_MANAGEMENT);
    setAudioClips(value.audioClips ?? []);
    setMediaBins(value.mediaBins ?? initialMediaBins);
    setMarkers(value.markers ?? []);
    setTimelineRange(value.timelineRange ?? { inPoint: null, outPoint: null });
    setSnapping(value.snapping ?? true);
    setLinkedSelection(value.linkedSelection ?? true);
    setManualDropTime(value.manualDropTime ?? null);
    setSavedRenderAnalysis(coerceRenderAnalysis(value.renderAnalysis));
  };
  const undo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    futureRef.current.push(structuredClone(snapshot()));
    restoreSnapshot(previous);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  };
  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(structuredClone(snapshot()));
    restoreSnapshot(next);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  };

  useEffect(() => {
    if (!isPro) return;
    const value = snapshot();
    const signature = JSON.stringify(value);
    if (signature === lastAutosaveSignatureRef.current) return;
    const timer = window.setTimeout(() => {
      // Autosave is best-effort: a structuredClone/serialize failure or a storage
      // error must never surface or throw uncaught — just skip this tick.
      try {
        const bridge = desktopMediaBridge();
        void saveRecoveryRevision(activeProjectId, structuredClone(value)).then((revision) => {
          lastAutosaveSignatureRef.current = signature;
          setRecoveryRevisions((items) => [revision, ...items].slice(0, 20));
        }).catch(() => setStatus("Autosave could not be written. Save your project to disk before closing."));
        if (bridge?.journalProject) void bridge.journalProject({ projectId: activeProjectId, projectJson: JSON.stringify(buildCutPlan()) }).catch(() => setStatus("Disk recovery journal failed. Check available storage and save the project manually."));
      } catch { setStatus("Autosave failed. Save your project manually before closing."); }
    }, 12_000);
    return () => window.clearTimeout(timer);
  // snapshot intentionally tracks every serializable editor field listed here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPro, activeProjectId, sections, placements, compositions, baseCuts, clipTracks, autoPolicy, autoVersions, creatorGoal, inferredCreatorGoal,
    titles, beats, bpm, beatOffset, aspect, customSize, styleId, autoEnergy, montageEnabled,
    montagePace, punchPreset, transitionType, strobePreset, strobeColor, strobeSecondaryColor, strobeAlternate,
    strobeIntensity, strobeAttack, strobeHold, strobeDecay, strobeShape, strobeMode, strobeBlend,
    strobeX, strobeY, strobeSize, strobeSoftness, strobeAngle, strobeSafeMode, strobeTiming, strobeBpm,
    strobeSensitivity, strobeBand, stutterPreset, speedPreset, dropRampEnabled, audioReactive, shakePreset,
    lookPreset, manualGrade, mirrorMode, streak, echoPreset, workspaceView, activeCompositionId,
    selectedCompLayerId, selectedKeyframeId, selectedSectionId, selectedPlacementId,
    selectedBaseCutId, selectedTrackId, audioTracks, audioBuses, masterGain, colorManagement, audioClips, mediaBins, markers,
    timelineRange, snapping, linkedSelection, manualDropTime, savedRenderAnalysis, assets, duration, analysis, mainFile, mainSourcePath, colorCurve, lut3dSource, lut3dMix, exportFrameRate, exportFormat, exportMaxDimension,
  ]);


  // Production scopes periodically sample the same graded canvas shown in the
  // program monitor, keeping preview and measurement in lockstep.
  useEffect(() => {
    if (!showScope) return;
    const scope = scopeCanvasRef.current;
    const scopeCtx = scope?.getContext("2d");
    if (!scope || !scopeCtx) return;
    const sampler = document.createElement("canvas");
    sampler.width = 160; sampler.height = 90;
    const samplerCtx = sampler.getContext("2d", { willReadFrequently: true });
    const columns = 80, bins = 64;
    const draw = () => {
      const preview = document.querySelector("canvas.preview-canvas") as HTMLCanvasElement | null;
      if (!preview || !samplerCtx || !preview.width) return;
      try {
        samplerCtx.drawImage(preview, 0, 0, sampler.width, sampler.height);
        const { data } = samplerCtx.getImageData(0, 0, sampler.width, sampler.height);
        scopeCtx.fillStyle = "#05100e";
        scopeCtx.fillRect(0, 0, scope.width, scope.height);
        scopeCtx.strokeStyle = "rgba(255,255,255,.09)";
        scopeCtx.lineWidth = 1;
        for (let line = 1; line < 4; line++) {
          scopeCtx.beginPath(); scopeCtx.moveTo(0, line * scope.height / 4); scopeCtx.lineTo(scope.width, line * scope.height / 4); scopeCtx.stroke();
        }
        if (scopeMode === "vectorscope") {
          const size = 80;
          const vectors = computeVectorscope(data, sampler.width, sampler.height, size);
          for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const value = vectors[y * size + x];
            if (value <= 0.02) continue;
            scopeCtx.fillStyle = `rgba(110,238,196,${Math.min(1, value * 1.6)})`;
            scopeCtx.fillRect(x / size * scope.width, y / size * scope.height, Math.ceil(scope.width / size), Math.ceil(scope.height / size));
          }
        } else {
          const parade = scopeMode === "rgb" ? computeRgbParade(data, sampler.width, sampler.height, columns, bins) : computeLumaWaveform(data, sampler.width, sampler.height, columns, bins);
          const channels = scopeMode === "rgb" ? 3 : 1;
          const plane = columns * bins;
          const colors = ["255,82,105", "80,230,151", "79,151,255"];
          for (let channel = 0; channel < channels; channel++) {
            const panelWidth = scope.width / channels;
            const columnWidth = panelWidth / columns;
            for (let c = 0; c < columns; c++) for (let b = 0; b < bins; b++) {
              const value = parade[channel * plane + c * bins + b];
              if (value <= 0.03) continue;
              scopeCtx.fillStyle = scopeMode === "rgb" ? `rgba(${colors[channel]},${Math.min(1, value)})` : `rgba(120,230,200,${Math.min(1, value)})`;
              scopeCtx.fillRect(channel * panelWidth + c * columnWidth, scope.height - ((b + 1) / bins) * scope.height, Math.max(1, columnWidth), Math.max(1, scope.height / bins));
            }
          }
        }
      } catch { /* frame not ready */ }
    };
    const id = window.setInterval(draw, 150);
    draw();
    return () => window.clearInterval(id);
  }, [showScope, scopeMode]);


  const loadMainMedia = async (file?: File, options: { preserveEdit?: boolean } = {}) => {
    if (!file || (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) || analyzing || rendering) return;
    if (!options.preserveEdit && !await projectSafety.confirmReplace()) return;
    analysisAbortRef.current?.abort();
    const load = ++sourceLoadRef.current;
    const previousUrl = mainUrl;
    if (pendingSourceUrlRef.current) URL.revokeObjectURL(pendingSourceUrlRef.current);
    const url = URL.createObjectURL(file);
    pendingSourceUrlRef.current = url;
    const probe = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    probe.preload = "metadata";
    probe.src = url;
    setStatus(`Reading ${file.name}...`);
    // Streamed/recorded files (WebM from MediaRecorder, some MP4s) report an
    // unknown duration until you seek past the end. Without this the app fell
    // back to a hardcoded 180s and then tried to analyze minutes of a file only
    // seconds long.
    const resolveDuration = () => new Promise<number>((resolve) => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) return resolve(probe.duration);
      const settle = () => {
        probe.removeEventListener("durationchange", onDurationChange);
        window.clearTimeout(timer);
        probe.currentTime = 0;
        resolve(Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 0);
      };
      const onDurationChange = () => {
        if (Number.isFinite(probe.duration) && probe.duration > 0) settle();
      };
      const timer = window.setTimeout(settle, 3000);
      probe.addEventListener("durationchange", onDurationChange);
      probe.currentTime = 1e101;
    });

    probe.onloadedmetadata = async () => {
      if (load !== sourceLoadRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const measured = await resolveDuration();
      if (load !== sourceLoadRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      if (!measured) {
        URL.revokeObjectURL(url);
        if (pendingSourceUrlRef.current === url) pendingSourceUrlRef.current = "";
        setStatus(`Could not read how long ${file.name} is. Try a standard MP4, WAV, MP3, or M4A file.`);
        return;
      }
      pendingSourceUrlRef.current = "";
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      const nextDuration = measured;
      if (!options.preserveEdit) await desktopMediaBridge()?.commitProjectDocument?.(null);
      setPlaying(false);
      setActiveProjectId("current");
      setMainFile(file);
      setMainSourcePath(desktopMediaBridge()?.getPathForFile(file) ?? "");
      setMainUrl(url);
      setSourceDims(probe instanceof HTMLVideoElement && probe.videoWidth ? { w: probe.videoWidth, h: probe.videoHeight } : { w: 1280, h: 720 });
      if (options.preserveEdit) {
        setStatus(`${file.name} relinked as the master source. The existing edit, timing, analysis, and effects were preserved.`);
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.removeAttribute("src");
        probe.load();
        return;
      }
      const inferred = inferCreatorGoalFromMedia(file);
      setCreatorGoal(inferred.goal);
      setInferredCreatorGoal(inferred.goal);
      setMainName(file.name);
      setAutoVersions([]);
      setAutoPolicy(p=>({...p,sceneBoundaries:undefined}));
      const nextSections = buildSections(nextDuration);
      setDuration(nextDuration);
      setSections(nextSections);
      setSelectedSectionId(nextSections[0]?.id ?? "");
      setCurrentTime(0);
      setBpm(120);
      setBeatOffset(0);
      setBeats(Array.from({ length: Math.ceil(nextDuration * 2) }, (_, index) => index * 0.5));
      setVideoClips([]);
      setSelectedPlacementId(null);
      setSelectedBaseCutId(null);
      setTitles([]);
      setTranscriptWords([]);
      setSelectedTranscriptIds(new Set());
      setAnalysis(null);
      setProjectIntelligence(null);
      setProjectTranscripts({});
      setStoryBrief("");
      setManualDropTime(null);
      setSavedRenderAnalysis(null);
      clearHistory();
      setStatus(inferred.reason);
      probe.onloadedmetadata = null;
      probe.onerror = null;
      probe.removeAttribute("src");
      probe.load();
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      if (pendingSourceUrlRef.current === url) pendingSourceUrlRef.current = "";
      if (load === sourceLoadRef.current) setStatus(`Could not read ${file.name}. Try a standard MP4, WAV, MP3, or M4A file.`);
    };
  };

  const selectMainMedia = (event: ChangeEvent<HTMLInputElement>) => {
    loadMainMedia(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };

  const selectAssets = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
    event.currentTarget.value = "";
    if (files.length) void addAssets(files);
  };

  const addAssets = async (files: FileList | File[]) => {
    if (analyzing || rendering) return;
    const proVideoExtension = /\.(?:mov|mxf|mkv|avi|mts|m2ts|m4v|mp4|webm)$/i;
    const proAudioExtension = /\.(?:wav|aif|aiff|flac|mp3|m4a|aac|ogg)$/i;
    const proImageExtension = /\.(?:png|jpe?g|webp|gif|tiff?|bmp|exr|dpx)$/i;
    const eligible = Array.from(files).filter((file) =>
      file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")
      || (isPro && (proVideoExtension.test(file.name) || proAudioExtension.test(file.name) || proImageExtension.test(file.name))));
    setStatus(`Identifying ${eligible.length} media file${eligible.length === 1 ? "" : "s"}...`);
    const incoming = await Promise.all(eligible.map(async (file, index): Promise<MediaAsset> => {
      const url = URL.createObjectURL(file);
      const kind = file.type.startsWith("video/") || (isPro && proVideoExtension.test(file.name))
        ? "video" as const
        : file.type.startsWith("audio/") || (isPro && proAudioExtension.test(file.name))
          ? "audio" as const
          : "image" as const;
      const bridge = desktopMediaBridge();
      const sourcePath = bridge?.getPathForFile(file) ?? "";
      const nativeMetadata = nativeMediaAvailable && bridge && sourcePath && kind !== "image"
        ? await bridge.probeMedia(sourcePath).catch(() => null)
        : null;
      const [mediaDuration, waveform] = await Promise.all([
        kind === "image" ? Promise.resolve(Number.POSITIVE_INFINITY) : nativeMetadata?.duration ? Promise.resolve(nativeMetadata.duration) : probeVideoDuration(url),
        kind === "audio" ? decodeWaveformPeaks(file) : Promise.resolve([]),
      ]);
      return {
        id: await fingerprintFile(file),
        name: file.name,
        file,
        url,
        kind,
        color: COLORS[(assets.length + index) % COLORS.length],
        duration: mediaDuration,
        waveform,
        nativeCodec: nativeMetadata?.video?.codec ?? nativeMetadata?.audio?.codec,
        nativeDimensions: nativeMetadata?.video ? `${nativeMetadata.video.width}×${nativeMetadata.video.height}` : undefined,
        nativeFrameRate: nativeMetadata?.video?.averageFrameRate,
        nativeVfr: nativeMetadata?.video?.variableFrameRate,
        nativeBitDepth: nativeMetadata?.video?.bitDepth,
        nativeHdr: nativeMetadata?.video?.hdr,
        sourcePath: sourcePath || undefined,
        folderId: kind === "audio" ? "bin-audio" : kind === "image" ? "bin-graphics" : "bin-footage",
        proxyState: "original",
        proxyProgress: 0,
      };
    }));
    if (!incoming.length) return;
    // Resolve links and duplicates against event-time state, not the render
    // that launched the probe. Other imports may have completed meanwhile.
    const currentAssets = assetsRef.current;
    const offlineAssets = currentAssets.filter((asset) => !asset.url);
    const claims = claimOfflineMediaLinks(
      offlineAssets.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, size: (asset.sourceSize ?? asset.file.size) || undefined, lastModified: (asset.sourceLastModified ?? asset.file.lastModified) || undefined })),
      incoming.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, size: asset.file.size, lastModified: asset.file.lastModified })),
    );
    const incomingById = new Map(incoming.map((asset) => [asset.id, asset]));
    const claimedIncomingIds = new Set(claims.values());
    const resolvedOfflineIds = new Set(claims.keys());
    const masterIncomingId = claims.get(MAIN_SOURCE_ID);
    const masterIncoming = masterIncomingId ? incomingById.get(masterIncomingId) : undefined;
    if (masterIncoming) loadMainMedia(masterIncoming.file, { preserveEdit: true });
    const revived = offlineAssets.flatMap((offline): MediaAsset[] => {
      if (offline.id === MAIN_SOURCE_ID) return [];
      const incomingId = claims.get(offline.id);
      const linked = incomingId ? incomingById.get(incomingId) : undefined;
      return linked ? [{ ...linked, id: offline.id, color: offline.color, folderId: offline.folderId, favorite: offline.favorite }] : [];
    });
    const retained = currentAssets.filter((asset) => !resolvedOfflineIds.has(asset.id));
    const existingIds = new Set(retained.map((asset) => asset.id));
    const unique = incoming.filter((asset) => !claimedIncomingIds.has(asset.id) && (() => {
      if (!existingIds.has(asset.id)) {
        existingIds.add(asset.id);
        return true;
      }
      URL.revokeObjectURL(asset.url);
      return false;
    })());
    if (!unique.length && !revived.length && !masterIncoming) {
      setStatus("Those media files are already in this project.");
      return retained.filter((asset) => incomingById.has(asset.id));
    }
    const next = [...retained, ...revived, ...unique];
    setAssets(next);
    setAnalysis(null);
    setSavedRenderAnalysis(renderAnalysis);
    setProjectIntelligence(null);
    const added = unique.length;
    const relinked = revived.length + (masterIncoming ? 1 : 0);
    setStatus(relinked
      ? `${relinked} offline media link${relinked === 1 ? "" : "s"} restored${added ? ` · ${added} new file${added === 1 ? "" : "s"} added` : ""}. Every existing edit and composition reference is live again.`
      : `${added} media file${added === 1 ? "" : "s"} added with stable project links. Analyze to profile the new footage.`);
    return [...revived, ...unique, ...retained.filter((asset) => incomingById.has(asset.id))];
  };

  const composeDirector = (result: AnalysisResult, rules: SectionRule[], grid = result.beats, intensity = autoEnergy): Placement[] => {
    const generated = buildDirectedPlacements(
      { ...result, beats: grid },
      visualAssets.map((asset) => asset.id),
      intensity,
      rules,
    ).map((placement) => {
      const assetIndex = Math.max(0, assets.findIndex((asset) => asset.id === placement.assetId));
      return { ...placement, trackId: clipTracks[assetIndex % Math.max(1, clipTracks.length)]?.id };
    });
    const protectedSections = new Set(rules.filter((rule) => rule.locked).map((rule) => rule.id));
    if (!protectedSections.size) return generated;
    return [
      ...generated.filter((placement) => !protectedSections.has(placement.sectionId)),
      ...placements.filter((placement) => protectedSections.has(placement.sectionId)),
    ].sort((a, b) => a.start - b.start);
  };

  // Beat-cut base montage from the effect/footage pool. In montage mode the
  // clips themselves cut on the beat and the main file supplies the soundtrack.
  // The clip pool the sequencer cuts from: each asset with its measured source
  // length and most-dynamic moment. Shared by every montage build below.
  const poolFrom = (effects: EffectProfile[]) => visualAssets.map((asset) => {
    const profile = effects.find((effect) => effect.assetId === asset.id);
    const rule=autoPolicy.sources.find(r=>r.assetId===asset.id);
    return { id: asset.id, kind: asset.kind as "image" | "video", sourceDuration: Math.min(profile?.sourceDuration ?? Infinity,rule?.outPoint ?? Infinity), sourceIn:rule?.inPoint,priority:rule?.priority, peakTime: profile?.peakTime, energy: profile?.flashiness };
  }).filter(a=>!autoPolicy.sources.find(r=>r.assetId===a.id)?.exclude);

  const buildMontage = (result: AnalysisResult, rules: SectionRule[], grid = result.beats, seed = rerollSeedRef.current, pace: SequencePace = montagePace, transition: TransitionType = transitionType): BaseCut[] => {
    const mainShots=!visualAssets.length && !mainIsAudio ? result.cinematic?.shots ?? [] : [];
    const pool = mainShots.length ? mainShots.map(s=>({id:s.id,kind:"video" as const,sourceDuration:s.end,sourceIn:s.start,peakTime:s.bestTime ?? s.start,energy:s.motion})) : poolFrom(result.effects);
    if(!pool.length) return [];
    const arc = deriveEnergyArc(result.signals, result.duration);
    const generated = buildBaseSequence({
      beats: grid,
      sections: rules.map((rule) => ({ id: rule.id, start: rule.start, end: rule.end, energy: rule.energy, enabled: rule.enabled })),
      assets: pool,
      signals: result.signals,
      pace,
      seed,
      duration: result.duration,
      minShot:autoPolicy.minShot,maxShot:autoPolicy.maxShot,
      intensityAt: arc.intensityAt,
      // Land a hard cut on the drop when it's pronounced enough to be worth it.
      dropTime: manualDropTime ?? (arc.dropStrength > 0.12 ? arc.dropTime : undefined),
    });
    // Section-aware treatment: modulate each incoming transition by its section's
    // energy — hot sections snap, the intro breathes (see sectionTransition). The
    // first cut has no incoming transition, so leave it alone.
    const base = TRANSITION_PRESETS[transition];
    const energyById = new Map(rules.map((rule) => [rule.id, rule.energy]));
    const directed = generated.map((original, index) => {
      const cut={...original,assetId:mainShots.length?MAIN_SOURCE_ID:original.assetId,editorial:{reason:`Measured beat at ${original.start.toFixed(3)}s · section energy · strongest sampled source moment`,confidence:result.confidence,alternatives:pool.filter(p=>p.id!==original.assetId).slice(0,3).map(p=>p.id)}};
      if (index === 0) return cut;
      const { transitionType: type, transitionDuration } = sectionTransition(energyById.get(cut.sectionId) ?? 0.5, base);
      return { ...cut, transitionType: type, transitionDuration };
    });
    return mergeProtectedCuts(directed, baseCuts);
  };

  // Downbeats that make the zoom-punch hit harder on "the 1". Memoized because
  // the live preview reads this on every animation frame.
  const liveAccents = useMemo(
    () => (analysis ? deriveBarGrid(beats, analysis.signals).downbeats : null),
    [beats, analysis],
  );
  // The song's intensity shape — drives cut density toward the drop.
  const energyArc = useMemo(
    () => (analysis ? deriveEnergyArc(analysis.signals, analysis.duration) : null),
    [analysis],
  );
  // The render-relevant facts outlive the heavy analysis (which many edits clear)
  // and are saved with the project, so a reopened document renders identically.
  // Live analysis wins; the saved copy is refreshed whenever analysis completes.
  const liveRenderAnalysis = useMemo(
    () => (liveAccents && energyArc ? renderAnalysisFrom(liveAccents, energyArc) : null),
    [liveAccents, energyArc],
  );
  const renderAnalysis = liveRenderAnalysis ?? savedRenderAnalysis;
  const accents = renderAnalysis?.accents ?? NO_ACCENTS;
  // Section spans that drive the section-aware punch/shake/grade. Kept as plain
  // data (not a sampler function) so `motion` stays structured-cloneable for the
  // render worker. Undefined until sections exist, preserving flat behaviour.
  const energySections = useMemo(() => {
    const active = sections
      .filter((section) => section.enabled !== false)
      .sort((a, b) => a.start - b.start)
      .map((section) => ({ start: section.start, end: section.end, energy: section.energy }));
    return active.length ? active : undefined;
  }, [sections]);
  // Audio-reactive band envelopes (bass pump + hats shimmer), precomputed once per
  // analysis as plain arrays — also for worker-serializability. Undefined when off.
  const reactiveEnvelopes = useMemo(() => {
    if (!audioReactive || !analysis || analysis.signals.length < 2) return undefined;
    const signals = analysis.signals;
    return {
      low: bandEnvelope(signals, "low"),
      high: bandEnvelope(signals, "high"),
      startTime: signals[0].time,
      step: signals[1].time - signals[0].time,
    };
  }, [audioReactive, analysis]);
  const renderMotion = (): RenderMotion => ({
    beats,
    accents,
    punch: PUNCH_PRESETS[punchPreset],
    shake: SHAKE_PRESETS[shakePreset],
    affectOverlays: false,
    energySections,
    reactive: reactiveEnvelopes,
  });
  // Tone curve baked to a 256-entry LUT (or undefined when identity — the grade
  // shader then skips the curve entirely, keeping ungraded frames untouched).
  const gradeCurveLut = useMemo(() => {
    const points = CURVE_PRESETS[colorCurve] ?? CURVE_PRESETS.none;
    return isIdentityCurve(points) ? undefined : buildCurveLut(points, 256);
  }, [colorCurve]);
  const gradeLut3d = creativeLut.texture;
  const gradeParams = { ...applyDisplayTransform({ ...applyGradeAdjust(GRADE_PRESETS[lookPreset], manualGrade), mirror: mirrorMode, streak }, colorManagement), curveLut: gradeCurveLut, lut3d: gradeLut3d };
  const hasShaderEffect = lookPreset !== "none" || mirrorMode > 0 || streak > 0 || !isNeutralGrade(manualGrade) || gradeCurveLut != null || gradeLut3d != null;
  const previewGrade = !colorBypass && hasShaderEffect ? { params: gradeParams, beatDriven: true } : null;
  const echoSetting = echoPreset === "off" ? null : ECHO_PRESETS[echoPreset];
  const strobeConfig = {
    ...STROBE_PRESETS[strobePreset],
    color: strobeColor,
    secondaryColor: strobeSecondaryColor,
    alternate: strobeAlternate,
    intensity: strobeIntensity,
    attack: strobeAttack,
    hold: strobeHold,
    decay: strobeDecay,
    shape: strobeShape,
    mode: strobeMode,
    blend: strobeBlend,
    x: strobeX,
    y: strobeY,
    size: strobeSize,
    softness: strobeSoftness,
    angle: strobeAngle,
  };
  // "Drums" fires on the real audio transients; everything else rides the beat grid.
  const rawStrobeFireTimes = useMemo(() => {
    if (strobeConfig.pattern === "off") return [];
    if (strobeTiming === "custom") return customStrobeTimes(duration, strobeBpm, strobeConfig.pattern);
    const base = strobeConfig.pattern === "onset"
      ? (analysis ? onsetHitTimes(analysis.signals, strobeSensitivity, strobeBand) : [])
      : strobeTimes(beats, accents, strobeConfig.pattern);
    // Erupt on a pronounced drop: a rapid flash cluster on the biggest moment.
    return energyArc && energyArc.dropStrength > 0.15
      ? withDropBurst(base, energyArc.dropTime, beatSecondsFrom(beats))
      : base;
  }, [beats, accents, strobeConfig.pattern, analysis, strobeSensitivity, strobeBand, energyArc, strobeTiming, strobeBpm, duration]);
  const strobeFireTimes = useMemo(
    () => strobeSafeMode ? limitStrobeRate(rawStrobeFireTimes, 3) : rawStrobeFireTimes,
    [rawStrobeFireTimes, strobeSafeMode],
  );
  const strobeSafety = useMemo(
    () => strobeSafetyReport(rawStrobeFireTimes, [strobeColor, ...(strobeAlternate ? [strobeSecondaryColor] : [])]),
    [rawStrobeFireTimes, strobeAlternate, strobeColor, strobeSecondaryColor],
  );
  const strobeSetting = strobeConfig.pattern === "off" ? null : { config: strobeConfig, times: strobeFireTimes };
  const stutterConfig = STUTTER_PRESETS[stutterPreset];
  const stutterSetting = stutterConfig.pattern === "off"
    ? null
    : { config: stutterConfig, beatSeconds: beatSecondsFrom(beats), origin: beats[0] ?? 0, beats };
  const speedConfig = SPEED_PRESETS[speedPreset];
  const speedSetting = speedConfig.pattern === "off"
    ? null
    : { config: speedConfig, beatSeconds: beatSecondsFrom(beats), origin: beats[0] ?? 0, beats };
  // Auto drop ramp: a one-shot slow-mo into the drop, only when the drop is
  // pronounced enough to be worth the drama (and the user hasn't turned it off).
  const dropRampSetting = dropRampEnabled && renderAnalysis?.dropRamp && beats.length > 1
    ? { dropTime: manualDropTime ?? renderAnalysis.dropRamp.dropTime, beatSeconds: beatSecondsFrom(beats), config: DROP_RAMP }
    : null;
  useEffect(() => {
    let active = true;
    const checkingId = window.setTimeout(() => { if (active) setExportProfileSupport({ supported: false, checking: true, codec: "", message: "Checking selected export profile…" }); }, 0);
    const size = outputDimensions(sourceDims.w, sourceDims.h, exportMaxDimension, aspect, customSize);
    void checkExportProfile({
      format: exportFormat,
      width: size.width,
      height: size.height,
      frameRate: exportFrameRate,
      requiresWebGL: hasShaderEffect || strobeConfig.pattern !== "off" || echoPreset !== "off",
    }).then((result) => { if (active) setExportProfileSupport(result); });
    return () => { active = false; window.clearTimeout(checkingId); };
  }, [exportFormat, exportMaxDimension, exportFrameRate, aspect, customSize, sourceDims.w, sourceDims.h, hasShaderEffect, strobeConfig.pattern, echoPreset]);
  const nativeSelectedProfileSupported = isPro && Boolean(nativeCapabilities?.nativeSequenceRender) && (
    exportFormat === "mp4-h264"
      ? Boolean(nativeCapabilities?.encoders?.h264 ?? nativeCapabilities?.encoder)
      : exportFormat === "mp4-hevc" && Boolean(nativeCapabilities?.encoders?.hevc)
  );
  const selectedProfileSupported = exportProfileSupport.supported || nativeSelectedProfileSupported;
  const selectedProfileChecking = exportProfileSupport.checking && !nativeSelectedProfileSupported;
  const selectedProfileMessage = nativeSelectedProfileSupported
    ? `${exportFormat === "mp4-hevc" ? "HEVC" : "H.264"} native encoder ready · hybrid parity keeps every unsupported comp and effect in the shared compositor`
    : exportProfileSupport.message;

  const autoTimelineKey = () => JSON.stringify([videoClips,audioClips,titles,transcriptWords,sections,beats,clipTracks,audioTracks,compositions,assets.map(a=>a.id),mainName]);
  const stageAutoEdit = async (name: string, candidates: ExplainedCut[], patch: Partial<EditSnapshot> = {}, mode = autoPolicy.timing) => {
    try {
      const {prepareAutoDraft}=await import("./prepare-auto-draft");
      const next=prepareAutoDraft({snapshot:snapshot(),name,candidates,patch,mode,expectedTimeline:autoTimelineKey(),visualAssets,confidence:analysis?.confidence});
      preparedAutoDraftRef.current=next;
      checkpoint(); setAutoVersions(items=>[...items.slice(-7),next]);
      setStatus(`${name}: ${next.evidence.length} cuts prepared as a separate draft. Review reasons, then Apply reviewed version. Timeline unchanged.`);
      return next;
    } catch(error) {setStatus(`Auto Cut: ${error instanceof Error?error.message:String(error)}`);return null;}
  };
  const applyReviewedAutoVersion = (version: AutoEditVersion) => {
    if(version.expectedTimeline!==autoTimelineKey()) {setStatus("The timeline or media changed after this draft was generated. Regenerate against the current edit to preserve your newer work.");return;}
    const delta=Object.fromEntries((version.fields ?? ["videoClips","baseCuts","placements","audioClips","titles","transcriptWords","duration","montageEnabled"]).map(key=>[key,version.snapshot[key as keyof typeof version.snapshot]]));
    checkpoint(); restoreSnapshot({...snapshot(),...delta,autoVersions});setPlaying(false);setCurrentTime(0);setEditorMode("pro");setWorkspaceView("sequence");
    setStatus(`${version.name} applied. Undo restores the previous timeline. Draft retained in Auto Edit.`);
  };
  const editSceneBoundary = (time:number,remove:boolean) => {
    if(!analysis || !Number.isFinite(time) || time<=0 || time>=analysis.duration) {setStatus("Choose a boundary inside the analyzed source.");return;}
    const sceneCuts=analysis.sceneCuts.filter(c=>Math.abs(c.time-time)>.001);
    if(!remove) sceneCuts.push({time,confidence:1,precision:"manual"});
    sceneCuts.sort((a,b)=>a.time-b.time);
    checkpoint();setAutoPolicy(p=>({...p,sceneBoundaries:sceneCuts.map(c=>c.time)}));
    setAnalysis({...analysis,sceneCuts,cinematic:analyzeCinematicFootage(analysis.duration,analysis.visuals,sceneCuts,analysis.signals)});
    setStatus("Source boundaries updated. Generate a new draft to use them; the timeline is unchanged.");
  };

  const runAnalysis = async (launchProfile?: CreatorProfile): Promise<AnalysisResult | null> => {
    if (!mainFile) {
      setStatus("Add a source video or song first so ScenePilot can inspect it.");
      mainInputRef.current?.click();
      return null;
    }
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const run = ++analysisRunRef.current;
    setAnalysisElapsed(0);
    setAnalyzing(true);
    setStatus("Opening the real analysis engine...");
    try {
      const result = await analyzeProject(
        await materializePathBackedFile(mainFile,mainUrl,controller.signal),
        mainUrl,
        analysis?.duration ?? duration,
        await Promise.all(visualAssets.map(async ({ id, file, url, kind }) => ({ id, file:await materializePathBackedFile(file,url,controller.signal), url, kind: kind as "image" | "video" }))),
        (progress) => {
          if (run !== analysisRunRef.current) return;
          setAnalysisProgress(progress);
          setStatus(progress.message);
        },
        controller.signal,
        { cinematic: launchProfile?.id === "cinematic" || creatorGoal === "cinematic" },
      );
      if (run !== analysisRunRef.current) return null;
      if(autoPolicy.sceneBoundaries) {
        result.sceneCuts=autoPolicy.sceneBoundaries.filter(time=>time<result.duration).map(time=>({time,confidence:1,precision:"manual"}));
        result.cinematic=analyzeCinematicFootage(result.duration,result.visuals,result.sceneCuts,result.signals);
      }
      const detectedSections: SectionRule[] = result.sections.map((section, index) => ({
        id: section.id,
        name: section.name,
        start: section.start,
        end: section.end,
        every: section.energy > 0.68 ? 2 : section.energy > 0.4 ? 4 : 8,
        duration: section.energy > 0.68 ? 0.22 : 0.42,
        scale: Math.round(108 + section.energy * 28),
        enabled: true,
        color: COLORS[index % COLORS.length],
        energy: section.energy,
        rhythm: section.energy > 0.82 ? "double" : section.energy < 0.28 ? "half" : "normal",
        pattern: suggestDirectorPattern(section, index, result.sections.length),
        locked: sections.find((existing) => existing.id === section.id || (existing.start < section.end && existing.end > section.start))?.locked ?? false,
      }));
      const rhythmReliable = hasReliableRhythm(result);
      const arc = deriveEnergyArc(result.signals, result.duration);

      // AUTO style: let the track pick the look. Chosen here, before the build,
      // so the montage/placements use the picked pace + energy rather than the
      // stale state a setState-then-build would read.
      let effectivePace = montagePace;
      let effectiveEnergy = autoEnergy;
      let effectiveTransition = transitionType;
      let autoNote = "";
      let autoStylePatch: Partial<EditSnapshot> = {};
      const requestedStyleId = styleId;
      if (requestedStyleId === "auto" && rhythmReliable) {
        const peakEnergy = result.sections.reduce((max, section) => Math.max(max, section.energy), 0);
        const picked = suggestStyle({ bpm: result.bpm, energy: peakEnergy, drop: arc.dropStrength });
        // Strobe is an opt-in effect, never turned on automatically — a plain
        // edit shouldn't suddenly flash. The user enables it from the Strobe
        // controls (or by picking a strobe-forward style chip themselves).
        effectivePace = picked.pace;
        effectiveEnergy = picked.energy;
        effectiveTransition = picked.transition;
        autoStylePatch={montagePace:picked.pace,autoEnergy:picked.energy,transitionType:picked.transition,lookPreset:picked.look,punchPreset:picked.punch};
        autoNote = ` Auto-picked ${picked.label} for this track.`;
      }

      const timing=resolveAutoTiming(autoPolicy.timing,mainIsAudio,rhythmReliable,transcriptWords.length>0);
      const next = rhythmReliable && timing.mode === "music" ? composeDirector(result, detectedSections, result.beats, effectiveEnergy) : [];
      const montage = rhythmReliable && montageEnabled && timing.mode === "music" ? buildMontage(result, detectedSections, result.beats, rerollSeedRef.current, effectivePace, effectiveTransition) : [];
      checkpoint();
      setAnalysis(result);
      setSavedRenderAnalysis(deriveRenderAnalysis(result, result.beats));
      if (launchProfile?.id === "cinematic" || creatorGoal === "cinematic") {
        setProjectIntelligence(analyzeProjectIntelligence(projectIntelligenceAssets(result, projectTranscripts), storyBrief));
      }
      setSelectedPlacementId(null);
      setSelectedBaseCutId(null);
      const dropNote = arc.dropStrength > 0.12 ? ` Drop at ${formatTime(arc.dropTime)} — the cut builds toward it.` : "";
      if (launchProfile?.id === "cinematic" && result.cinematic) {
        const visual = result.cinematic;
        const soundtrack = rhythmReliable ? ` Soundtrack map: ${result.beats.length} beats at ${result.bpm} BPM.` : " Soundtrack rhythm is secondary and can be corrected later.";
        setStatus(`Cinematic analysis: ${visual.shotCount} ${visual.shotCount === 1 ? "shot" : "shots"} · ${visual.sceneChanges.length} scene changes · ${visual.jumpCuts.length} likely jump cuts · ${visual.pace} pacing.${soundtrack}`);
      } else {
        setStatus(rhythmReliable
          ? `${result.framesAnalyzed} frames, ${result.sceneCuts.length} cuts, ${result.beats.length} beats - ${next.length} placements built.${autoNote}${dropNote}`
          : `Rhythm confidence was too low to make trustworthy cuts. Tap the BPM or adjust the beat grid, then fill the timeline.`);
      }
      if(montage.length) await stageAutoEdit("Music first cut",montage,{...autoStylePatch,placements:next,sections:detectedSections,beats:result.beats,bpm:result.bpm},"music");
      else if(result.cinematic && timing.mode === "scenes") {
        const cuts=buildCinematicAssembly(result.cinematic,"selects",MAIN_SOURCE_ID,{...autoPolicy,selection:"all-scenes",visuals:result.visuals,phrases:autoPolicy.preserveDialogue?projectTranscripts[MAIN_SOURCE_ID]:undefined});
        const linkedAudio:AudioClip[]=audioTracks[0] && result.signals.length ? cuts.map(c=>({id:`cinematic-auto-audio-${c.id}`,assetId:MAIN_SOURCE_ID,trackId:audioTracks[0].id,name:"Source audio",start:c.start,sourceStart:c.sourceStart,duration:c.duration,gain:1,pan:0,fadeIn:0,fadeOut:0,muted:false,linkedVideoId:c.id})):[];
        await stageAutoEdit("Scene first cut",cuts,{placements:[],sections:detectedSections,audioClips:[...audioClips.filter(c=>!c.id.startsWith("cinematic-auto-audio-")),...linkedAudio]},"scenes");
      }
      return result;
    } catch (error) {
      if (controller.signal.aborted) setStatus("Analysis canceled. Your current edit is unchanged.");
      else setStatus(error instanceof Error ? `Analysis stopped: ${error.message}` : "Analysis stopped because this media could not be decoded.");
      return null;
    } finally {
      if (run === analysisRunRef.current) {
        setAnalyzing(false);
        setAnalysisProgress(null);
        analysisAbortRef.current = null;
      }
    }
  };

  // Story cut = the narrative auto-director: transcribe each take, drop the dead
  // air, and lay the spoken parts back-to-back on the timeline with their own
  // synced dialogue audio. No song required. Beta — downloads a speech model.
  const runStoryRoughCut = async (hybridBeats?: number[]) => {
    const takes = [...(mainFile && !mainIsAudio ? [{id:MAIN_SOURCE_ID,file:mainFile,duration:analysis?.duration ?? duration,name:mainName}] : []), ...visualAssets.filter((asset) => asset.kind === "video")].filter(a=>!autoPolicy.sources.find(r=>r.assetId===a.id)?.exclude);
    if (!takes.length) {
      setStatus("Add your talking-head takes (video clips) first, then make the Story cut.");
      assetInputRef.current?.click();
      return;
    }
    const audioTrackId = audioTracks[0]?.id;
    const controller=new AbortController(); analysisAbortRef.current=controller;
    setAutoCutTranscribing(true);
    setTranscribing(true);
    setStatus("Story cut: transcribing your takes — the speech model downloads on first run…");
    try {
      const [{cleanTranscriptChunks,groupTimedTranscript,speechRegionsWithoutFillers},{prepareStoryDraft}]=await Promise.all([import("../lib/filler"),import("./prepare-story-draft")]);
      const { transcribeVocals } = await import("./transcribe-client");
      const transcribed: Take[] = [];
      const chunksByTake = new Map<string, Array<{ text: string; start: number; end: number }>>();
      const wordsByTake = new Map<string, Array<{ text: string; start: number; end: number }>>();
      for (let i = 0; i < takes.length; i++) {
        const take = takes[i];
        let chunks: Array<{ text: string; start: number; end: number }> = [];
        try {
          const media=await materializePathBackedFile(take.file,take.id===MAIN_SOURCE_ID?mainUrl:assets.find(a=>a.id===take.id)?.url ?? "",controller.signal);
          const raw = await transcribeVocals(media, (progress) => setStatus(`Take ${i + 1}/${takes.length}: ${progress.stage}… ${Math.round(progress.progress * 100)}%`),controller.signal);
          if(!raw.some(word=>word.text.trim())) throw new Error("No speech detected. Exclude this source from dialogue assembly or choose Follow scenes.");
          wordsByTake.set(take.id, raw);
          // Word timestamps make hesitation sounds removable inside a sentence;
          // captions are regrouped into readable phrases after cleanup.
          const speech = speechRegionsWithoutFillers(raw);
          chunks = groupTimedTranscript(raw);
          chunksByTake.set(take.id, chunks);
          transcribed.push({
            priority:autoPolicy.sources.find(r=>r.assetId===take.id)?.priority,
            id: take.id,
            duration: take.duration ?? (raw.at(-1)?.end ?? 5) + 0.5,
            speech,
            transcript: cleanTranscriptChunks(raw).map((chunk) => chunk.text).join(" ").trim(),
          });
        } catch (error) { throw new Error(`Transcription failed for ${take.name}: ${error instanceof Error ? error.message : "speech runtime unavailable"}. No footage was silently classified as B-roll.`); }
      }
      // Keep the best of each run of same-line retakes before assembling.
      const {cuts,captionTitles,timelineWords,total,dialogue,summary,retakes,captioned}=prepareStoryDraft({transcribed,takes,chunksByTake,wordsByTake,hybridBeats,rangeStart:autoPolicy.range?.start,audioTrackId});
      if (!cuts.length) { setStatus("Couldn't assemble a cut — no usable footage in those takes."); return; }
      const draft=await stageAutoEdit(hybridBeats?.length ? "Dialogue + music" : "Story rough cut",cuts.map(c=>({...c,linked:true,preservePhrase:true,editorial:{reason:hybridBeats?.length?"Complete spoken region; entrance follows a musical beat":"Transcript speech region; filler/dead air removed",confidence:.7,alternatives:takes.filter(t=>t.id!==c.assetId).slice(0,3).map(t=>t.id)}})),{audioClips:[...audioClips.filter(c=>!c.id.startsWith("story-audio-")),...dialogue],titles:[...titles.filter(t=>!t.id.startsWith("caption-")),...captionTitles],transcriptWords:timelineWords,duration:total},hybridBeats?.length ? "hybrid" : "dialogue");
      if(!draft) return;
      setStatus(`Draft prepared: ${cuts.length} cuts ·${retakes}${captioned} ${summary.dropped.toFixed(1)}s of dead air removed. Review and apply the version; timeline unchanged.`);
    } catch (error) {
      setStatus(controller.signal.aborted?"Auto Cut canceled. The timeline is unchanged.":`Story cut failed: ${error instanceof Error ? error.message : "unknown error"}. Add takes with clear dialogue and try again.`);
    } finally {
      if(analysisAbortRef.current===controller) analysisAbortRef.current=null;
      setAutoCutTranscribing(false);
      setTranscribing(false);
    }
  };

  const runAutoCut = async () => {
    preparedAutoDraftRef.current=null;
    try {validateAutoPolicy(autoPolicy);}catch(error){setStatus(String(error));return;}
    if (autoPolicy.timing === "dialogue" || (creatorGoal === "story" && autoPolicy.timing === "auto")) { await runStoryRoughCut(); return; }
    if (!mainFile) {
      setStatus("Start with your main video or song.");
      mainInputRef.current?.click();
      return;
    }
    if (!assets.length && mainIsAudio && autoPolicy.timing !== "hybrid") {
      setStatus("Add at least one strobe, light clip, or image.");
      assetInputRef.current?.click();
      return;
    }
    const profile = creatorProfile(creatorGoal);
    const result = await runAnalysis(profile);
    const resolved=result?resolveAutoTiming(autoPolicy.timing,mainIsAudio,hasReliableRhythm(result),transcriptWords.length>0).mode:null;
    if(result && resolved === "hybrid") {
      if(!hasReliableRhythm(result)) {setStatus("Hybrid needs a reliable soundtrack beat map. Correct the music or choose Follow dialogue.");return;}
      await runStoryRoughCut(result.beats); return;
    }
    if(result && resolved === "dialogue") {await runStoryRoughCut();return;}
    const draft=preparedAutoDraftRef.current as AutoEditVersion | null;
    if (!result || !profile.autoCaptions || !mainFile || !draft) return;
    const controller=new AbortController();analysisAbortRef.current=controller;
    setAutoCutTranscribing(true);
    setTranscribing(true);
    setStatus(`${profile.label}: generating automatic captions…`);
    try {
      const {captionCuesFromCut}=await import("../lib/story-edit");
      const { transcribeVocals } = await import("./transcribe-client");
      const media=await materializePathBackedFile(mainFile,mainUrl,controller.signal);
      const chunks = await transcribeVocals(media, (progress) => setStatus(`${progress.stage}… ${Math.round(progress.progress * 100)}%`),controller.signal);
      controller.signal.throwIfAborted();
      const timedChunks=(mainIsAudio || resolved==="music"?chunks:captionCuesFromCut(chunks,draft.snapshot.baseCuts.filter(c=>c.assetId===MAIN_SOURCE_ID))).filter(c=>c.end<=(draft.snapshot.duration??Infinity));
      const words=timedChunks.map((word, index) => ({ id: `word-main-${index}-${Math.round(word.start * 1000)}`, text: word.text, start: word.start, end: word.end, sourceLabel: mainFile.name }));
      const cues = transcriptToLyricCues(timedChunks, result.beats, { style: titleStyle, animator: titleAnimator });
      if (cues.length) {
        setAutoVersions(items=>items.map(v=>v.id===draft.id?{...v,snapshot:{...v.snapshot,titles:[...v.snapshot.titles.filter(t=>!t.id.startsWith("caption-")),...cues],transcriptWords:words}}:v));
        setLyricsDraft(chunks.map((chunk) => chunk.text).join("\n"));
        setStatus(`${profile.label} draft ready · ${cues.length} caption cues. Review and apply the version; timeline unchanged.`);
      } else setStatus(`${profile.label} draft retained without captions. No clear speech was detected; review before applying.`);
    } catch {
      setStatus(controller.signal.aborted?"Caption generation canceled. The uncaptioned draft is retained; timeline unchanged.":`${profile.label} draft retained without captions. Caption generation failed; review the draft before applying.`);
    } finally {
      if(analysisAbortRef.current===controller) analysisAbortRef.current=null;
      setAutoCutTranscribing(false);
      setTranscribing(false);
    }
  };

  const applyCinematicAssembly = (kind: CinematicAssemblyKind) => {
    const report=analysis?.cinematic;
    if(!report || !mainFile || mainIsAudio) {setStatus("Analyze a source video before building an assembly.");return;}
    const cuts=buildCinematicAssembly(report,kind,MAIN_SOURCE_ID,{...autoPolicy,visuals:analysis.visuals,phrases:autoPolicy.preserveDialogue?projectTranscripts[MAIN_SOURCE_ID]:undefined});
    if(!cuts.length) {setStatus(`Insufficient evidence for ${kind}. Review boundaries or choose Clean selects.`);return;}
    const linkedAudio:AudioClip[]=audioTracks[0] && analysis.signals.length ? cuts.map(c=>({id:`cinematic-auto-audio-${c.id}`,assetId:MAIN_SOURCE_ID,trackId:audioTracks[0].id,name:"Source audio",start:c.start,sourceStart:c.sourceStart,duration:c.duration,gain:1,pan:0,fadeIn:0,fadeOut:0,muted:false,linkedVideoId:c.id})):[];
    stageAutoEdit(report.assemblies.find(a=>a.kind===kind)?.label ?? kind,cuts,{placements:[],audioClips:[...audioClips.filter(c=>!c.id.startsWith("cinematic-auto-audio-")),...linkedAudio]},"scenes");
  };

  const updateStoryBrief = (value: string) => {
    setStoryBrief(value);
    if (analysis && projectIntelligence) setProjectIntelligence(analyzeProjectIntelligence(projectIntelligenceAssets(analysis, projectTranscripts), value));
  };

  const analyzeProjectLibrary = async () => {
    if (!analysis || !projectIntelligence) {
      setStatus("Run Cinematic analysis first so the library has visual signatures to combine with dialogue.");
      return;
    }
    const sources = projectTranscriptSources({ file: mainFile, isAudio: mainIsAudio, name: mainName }, visualAssets);
    if (!sources.length) {
      setStatus("Add video clips before running deep project analysis.");
      return;
    }
    setDeepProjectAnalyzing(true);
    setTranscribing(true);
    try {
      const nextTranscripts = await transcribeProjectSources(sources, projectTranscripts, (index, count, name, stage, progress) => {
        setStatus(`Project Intelligence ${index + 1}/${count}: ${name} · ${stage} ${Math.round(progress * 100)}%`);
      });
      const report = analyzeProjectIntelligence(projectIntelligenceAssets(analysis, nextTranscripts), storyBrief);
      setProjectTranscripts(nextTranscripts);
      setProjectIntelligence(report);
      setStatus(`Intelligence ready: ${report.assetsAnalyzed} media · ${report.transcriptAssets} transcripts · ${report.takeGroups.length} take groups.`);
    } catch (error) {
      setStatus(`Project Intelligence stopped: ${error instanceof Error ? error.message : "local speech runtime unavailable"}. The edit remains intact.`);
    } finally {
      setTranscribing(false);
      setDeepProjectAnalyzing(false);
    }
  };

  const applyProjectAssembly = (kind: ProjectAssemblyKind) => {
    if(!projectIntelligence || !analysis) return;
    const {cuts,label,linkedAudio}=buildProjectAssemblyTimeline(projectIntelligence,projectIntelligenceAssets(analysis,projectTranscripts),kind,audioTracks[0]?.id,{preserveDialogue:autoPolicy.preserveDialogue,maxShot:autoPolicy.maxShot});
    if(!cuts.length) {setStatus("No confident material; transcribe the library or choose Project selects.");return;}
    stageAutoEdit(label,cuts.map(c=>({...c,editorial:{reason:"Project coverage / transcript relevance; review source context",confidence:.6,alternatives:visualAssets.filter(a=>a.id!==c.assetId).slice(0,3).map(a=>a.id)}})),{placements:[],audioClips:[...audioClips.filter(c=>!c.id.startsWith("project-auto-audio-")),...linkedAudio]},"dialogue");
  };

  const inspectProjectAsset = (assetId: string, time: number) => {
    if (assetId === MAIN_SOURCE_ID) {
      setMonitorMode("program");
      const next = Math.max(0, Math.min(duration, time));
      setCurrentTime(next);
      if (videoRef.current) {
        try { videoRef.current.currentTime = next; } catch { /* media metadata is still loading */ }
      }
      return;
    }
    const asset = assets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const sourceLength = asset.duration && Number.isFinite(asset.duration) ? asset.duration : 5;
    setSourceAssetId(asset.id);
    setSourceRange({ inPoint: 0, outPoint: sourceLength });
    setSourceTime(Math.max(0, Math.min(sourceLength, time)));
    setMonitorMode("source");
    setStatus(`${asset.name} opened at ${formatTime(time)} from Project Intelligence.`);
  };

  const chooseAutoEnergy = (energy: "smooth" | "dynamic" | "maximum") => {
    if (analyzing || rendering) return;
    checkpoint();
    setAutoEnergy(energy);
    setStyleId("custom");
    if (!analysis) return;
    const next = composeDirector(analysis, sections, beats, energy);
    if(baseCuts.length) void stageAutoEdit(`${energy.toUpperCase()} energy`,baseCuts,{placements:next,autoEnergy:energy},"music");
    else setStatus("Energy selected. Generate a first cut to review the new hit arrangement.");
  };

  const addTitle = () => {
    const text = titleDraft.trim();
    if (!text) return;
    checkpoint();
    const start = snapToBeat(currentTime, beats);
    const cue: TitleCue = { id: `title-${crypto.randomUUID()}`, text: text.toUpperCase(), start, ...TITLE_DEFAULTS, style: titleStyle, animator: titleAnimator };
    setTitles((items) => [...items, cue].sort((a, b) => a.start - b.start));
    setTitleDraft("");
    setStatus(`"${cue.text}" drops at ${formatTime(start)}.`);
  };
  const removeTitle = (id: string) => {
    checkpoint();
    setTitles((items) => items.filter((cue) => cue.id !== id));
  };
  // Real ASR (beta): transcribe the vocal with Whisper (lazy-loaded), then lock
  // the timed phrases to the beat as lyric cues. Best on clear vocals; falls
  // back to a status hint on any failure so the paste flow stays the safety net.
  const transcribeVocalsToLyrics = async () => {
    if (!mainFile || !analysis) { setStatus("Add and analyze a song first, then transcribe its vocal."); return; }
    setTranscribing(true);
    setStatus("Transcribing the vocal — the speech model downloads on first run…");
    try {
      const { transcribeVocals } = await import("./transcribe-client");
      const chunks = await transcribeVocals(mainFile, (progress) =>
        setStatus(`${progress.stage}… ${Math.round(progress.progress * 100)}%`));
      setTranscriptWords(chunks.map((word, index) => ({ id: `word-main-${index}-${Math.round(word.start * 1000)}`, text: word.text, start: word.start, end: word.end, sourceLabel: mainFile.name })));
      const cues = transcriptToLyricCues(chunks, beats, { style: titleStyle, animator: titleAnimator });
      if (!cues.length) { setStatus("Couldn't make out a vocal. Paste the lyrics and use Auto-time instead."); return; }
      checkpoint();
      setTitles(cues);
      setLyricsDraft(chunks.map((chunk) => chunk.text).join("\n"));
      setStatus(`Transcribed ${cues.length} lyric ${cues.length === 1 ? "line" : "lines"} from the vocal.`);
    } catch (error) {
      setStatus(`Transcription failed: ${error instanceof Error ? error.message : "unknown error"}. Paste the lyrics to time them manually.`);
    } finally {
      setTranscribing(false);
    }
  };

  const transcribeEditForText = async () => {
    const sequenceCuts = baseCuts.length ? baseCuts : mainFile
      ? [{ id: "main-transcript", assetId: MAIN_SOURCE_ID, sectionId: "main", start: 0, duration, sourceStart: 0 }]
      : [];
    if (!sequenceCuts.length) {
      setStatus("Load media or build a sequence before transcribing the edit.");
      return;
    }
    const sourceIds = [...new Set(sequenceCuts.map((cut) => cut.assetId))];
    setTranscribing(true);
    setStatus(`Text-Based Editing: transcribing ${sourceIds.length} sequence source${sourceIds.length === 1 ? "" : "s"}…`);
    try {
      const { transcribeVocals } = await import("./transcribe-client");
      const mapped: TranscriptWord[] = [];
      for (const [sourceIndex, sourceId] of sourceIds.entries()) {
        const asset = sourceId === MAIN_SOURCE_ID ? null : assets.find((item) => item.id === sourceId);
        const file = sourceId === MAIN_SOURCE_ID ? mainFile : asset?.file;
        if (!file) continue;
        const raw = await transcribeVocals(file, (progress) => setStatus(`Source ${sourceIndex + 1}/${sourceIds.length} · ${progress.stage}… ${Math.round(progress.progress * 100)}%`));
        mapped.push(...mapSourceTranscriptToTimeline(raw, sequenceCuts.filter((cut) => cut.assetId === sourceId), asset?.name ?? mainFile?.name ?? "Main source", sourceId));
      }
      checkpoint();
      setTranscriptWords(mapped.sort((a, b) => a.start - b.start));
      setSelectedTranscriptIds(new Set());
      transcriptSelectionAnchorRef.current = null;
      setProjectPanelTab("transcript");
      setStatus(mapped.length ? `Transcript ready · ${mapped.length} timed words across the active edit.` : "No clear speech was detected in the active edit.");
    } catch (error) {
      setStatus(`Transcription failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    } finally {
      setTranscribing(false);
    }
  };

  const selectTranscriptWord = (id: string, extend: boolean) => {
    if (!extend || !transcriptSelectionAnchorRef.current) {
      transcriptSelectionAnchorRef.current = id;
      setSelectedTranscriptIds(new Set([id]));
      return;
    }
    const anchor = transcriptWords.findIndex((word) => word.id === transcriptSelectionAnchorRef.current);
    const target = transcriptWords.findIndex((word) => word.id === id);
    if (anchor < 0 || target < 0) return;
    const [start, end] = anchor <= target ? [anchor, target] : [target, anchor];
    setSelectedTranscriptIds(new Set(transcriptWords.slice(start, end + 1).map((word) => word.id)));
  };

  const deleteTranscriptSelection = () => {
    const ranges = transcriptDeletionRanges(transcriptWords, selectedTranscriptIds);
    if (!ranges.length) return;
    checkpoint();
    let nextBase = baseCuts.length ? baseCuts : editableBaseCuts();
    for (const range of [...ranges].sort((a, b) => b.start - a.start)) nextBase = extractRange(nextBase, range.start, range.end);
    setBaseCuts(nextBase);
    setMontageEnabled(true);
    setPlacements((items) => items.flatMap((item) => clipTracks.find((track) => track.id === item.trackId)?.syncLock === false ? [item] : extractTimedRanges([item], ranges)));
    setAudioClips((items) => items.flatMap((item) => audioTracks.find((track) => track.id === item.trackId)?.syncLock === false ? [item] : extractTimedRanges([item], ranges, sliceEditorialAudio)));
    setTitles((items) => extractTimedRanges(items, ranges));
    setTranscriptWords((items) => remapTranscriptAfterDeletion(items, ranges));
    setBeats((items) => compactTimelineTimes(items, ranges));
    setMarkers((items) => items.filter((marker) => !ranges.some((range) => marker.time > range.start && marker.time < range.end)).map((marker) => ({ ...marker, time: timeAfterRemovingRanges(marker.time, ranges) })));
    setSections((items) => items.map((section) => ({ ...section, start: timeAfterRemovingRanges(section.start, ranges), end: timeAfterRemovingRanges(section.end, ranges) })).filter((section) => section.end - section.start >= .05));
    const removed = ranges.reduce((sum, range) => sum + range.duration, 0);
    setDuration((value) => Math.max(.05, value - removed));
    setTimelineRange({ inPoint: null, outPoint: null });
    setSelectedBaseCutId(null);
    setSelectedPlacementId(null);
    setSelectedTranscriptIds(new Set());
    transcriptSelectionAnchorRef.current = null;
    seek(ranges[0].start);
    setStatus(`Ripple-deleted ${selectedTranscriptIds.size} transcript word${selectedTranscriptIds.size === 1 ? "" : "s"} · sequence shortened ${removed.toFixed(2)}s.`);
  };
  // Auto-time the pasted lyrics onto the vocal and replace the title track.
  const autoTimeLyrics = () => {
    if (!analysis) { setStatus("Analyze the song first, then auto-time the lyrics."); return; }
    const beatsPerLine = { fast: 1, normal: 2, slow: 4 }[lyricDensity];
    const cues = autoLyricCues(lyricsDraft.split("\n"), beats, analysis.signals, { beatsPerLine, style: titleStyle, animator: titleAnimator });
    if (!cues.length) { setStatus("Paste some lyrics — one line per screen — to auto-time them."); return; }
    checkpoint();
    setTitles(cues);
    setStatus(`Placed ${cues.length} lyric ${cues.length === 1 ? "line" : "lines"} on the vocal.`);
  };

  const rerollMontage = () => {
    if (!analysis || !assets.length) {
      setStatus("Analyze a song with clips first, then reroll the montage.");
      return;
    }
    checkpoint();
    rerollSeedRef.current += 1;
    const montage = buildMontage(analysis, sections);
    void stageAutoEdit("Rerolled montage",montage,{},"music");
  };

  const changeMontagePace = (pace: SequencePace) => {
    checkpoint();
    setMontagePace(pace);
    setStyleId("custom");
    if (!analysis || !assets.length) return;
    const montage = buildMontage(analysis, sections, beats, rerollSeedRef.current, pace);
    void stageAutoEdit(`${pace.toUpperCase()} pace`,montage,{montagePace:pace},"music");
  };

  // One tap sets pace, punch, look, transition and hit density together, then
  // rebuilds the montage and the overlay hits from the existing analysis.
  const applyStyle = (style: EditStyle) => {
    if (analyzing || rendering) return;
    if(analysis) {
      const montage=buildMontage(analysis,sections,beats,rerollSeedRef.current,style.pace,style.transition);
      void stageAutoEdit(style.label,montage.length?montage:baseCuts,{placements:composeDirector(analysis,sections,beats,style.energy),styleId:style.id,montagePace:style.pace,punchPreset:style.punch,lookPreset:style.look,transitionType:style.transition,autoEnergy:style.energy,strobePreset:style.strobe as keyof typeof STROBE_PRESETS},"music");
      return;
    }
    checkpoint();
    setStyleId(style.id);
    setMontagePace(style.pace);
    setPunchPreset(style.punch);
    setLookPreset(style.look);
    setTransitionType(style.transition);
    setAutoEnergy(style.energy);
    applyStrobePreset(style.strobe as keyof typeof STROBE_PRESETS);
    setStrobeBand("all");
    setStatus(`${style.label} armed. Add your song and clips, then Make the Cut.`);
  };

  // Natural-language editing — "make it punchier", "warmer with more cuts".
  // Interprets the request (lib/edit-command.ts) and nudges the existing
  // controls, so plain English drives the whole look/feel.
  const runEditCommand = (text: string) => {
    if (analyzing || rendering) return;
    const commands = interpretEditCommand(text);
    if (!commands.length) {
      setStatus(`Didn't catch an edit in "${text.trim()}". Try "punchier", "more cuts", "warmer", "add captions".`);
      return;
    }
    checkpoint();
    const step = <T,>(ladder: readonly T[], current: T, dir: -1 | 1): T => ladder[Math.max(0, Math.min(ladder.length - 1, ladder.indexOf(current) + dir))];
    const PUNCH_LADDER = ["off", "subtle", "dynamic", "slam"] as const;
    const ENERGY_LADDER = ["smooth", "dynamic", "maximum"] as const;
    const PACE_LADDER = ["cinematic", "balanced", "frenetic"] as const;
    const SHAKE_LADDER = ["off", "handheld", "kick", "riot"] as const;
    let grade = { ...manualGrade };
    let gradeTouched = false;
    const applied: string[] = [];
    for (const command of commands) {
      const dir = command.direction ?? 1;
      switch (command.kind) {
        case "intensity":
          setPunchPreset((value) => step(PUNCH_LADDER, value, dir));
          setAutoEnergy((value) => step(ENERGY_LADDER, value, dir));
          applied.push(dir > 0 ? "punchier" : "calmer");
          break;
        case "pace":
          changeMontagePace(step(PACE_LADDER, montagePace, dir));
          applied.push(dir > 0 ? "more cuts" : "fewer cuts");
          break;
        case "shake":
          setShakePreset((value) => step(SHAKE_LADDER, value, dir));
          applied.push(dir > 0 ? "more shake" : "steadier");
          break;
        case "brightness":
          grade = { ...grade, exposure: Math.max(0.75, Math.min(1.4, grade.exposure + dir * 0.06)) }; gradeTouched = true;
          applied.push(dir > 0 ? "brighter" : "darker");
          break;
        case "contrast":
          grade = { ...grade, contrast: Math.max(0.6, Math.min(1.6, grade.contrast + dir * 0.08)) }; gradeTouched = true;
          applied.push(dir > 0 ? "more contrast" : "flatter");
          break;
        case "saturation":
          grade = { ...grade, saturation: Math.max(0, Math.min(2, grade.saturation + dir * 0.14)) }; gradeTouched = true;
          applied.push(dir > 0 ? "more colour" : "less colour");
          break;
        case "warmth":
          grade = { ...grade, temperature: Math.max(-0.6, Math.min(0.6, grade.temperature + dir * 0.08)) }; gradeTouched = true;
          applied.push(dir > 0 ? "warmer" : "cooler");
          break;
        case "speed":
          setSpeedPreset(dir < 0 ? "slowmo" : "off");
          applied.push(dir < 0 ? "slow-mo" : "full speed");
          break;
        case "strobe":
          applyStrobePreset(dir > 0 ? "rave" : "off");
          applied.push(dir > 0 ? "strobe on" : "strobe off");
          break;
        case "captions":
          if (dir < 0) { setTitles((items) => items.filter((title) => !title.id.startsWith("caption-") && !title.id.startsWith("lyric-"))); applied.push("captions off"); }
          else if (lyricsDraft.trim() && analysis) { autoTimeLyrics(); applied.push("captions on"); }
          else { applied.push("captions — paste lyrics in the Auto lyrics panel first"); }
          break;
        case "style": {
          const look = command.value ? findStyle(command.value) : undefined;
          if (look) { applyStyle(look); applied.push(`${look.label} look`); }
          break;
        }
      }
    }
    if (gradeTouched) { setColorBypass(false); setManualGrade(grade); }
    setStatus(`Applied: ${applied.join(" · ")}.`);
  };

  // Auto shot colour matching — even out exposure/colourfulness across the
  // montage from the per-clip stats the footage analysis captured.
  const matchShotColors = () => {
    const sequencePlacements = placements.filter((placement) => !placement.compositionId);
    const sequenceItems = baseCuts.length ? baseCuts : sequencePlacements;
    if (!sequenceItems.length) { setStatus("Build a sequence first, then match the shots' colour."); return; }
    const inputs = sequenceItems
      .map((item) => {
        const profile = analysis?.effects.find((effect) => effect.assetId === item.assetId);
        if (!profile?.color) return null;
        return { id: item.id, stats: { brightness: profile.brightness, r: profile.color.r, g: profile.color.g, b: profile.color.b } };
      })
      .filter((entry): entry is { id: string; stats: { brightness: number; r: number; g: number; b: number } } => entry !== null);
    if (inputs.length < 2) { setStatus("Analyze the footage first — shot matching needs its colour stats."); return; }
    const corrections = autoColorMatch(inputs);
    if (!corrections.size) { setStatus("Shots already match — no colour correction needed."); return; }
    checkpoint();
    if (baseCuts.length) {
      setBaseCuts((items) => items.map((cut) => corrections.has(cut.id) ? { ...cut, color: { ...NEUTRAL_CLIP_COLOR, ...corrections.get(cut.id) } } : cut));
    } else {
      setPlacements((items) => items.map((placement) => corrections.has(placement.id) ? { ...placement, color: { ...NEUTRAL_CLIP_COLOR, ...corrections.get(placement.id) } } : placement));
    }
    setStatus(`Matched ${corrections.size} shot${corrections.size === 1 ? "" : "s"} to the reference for a consistent look.`);
  };

  // Auto white balance — neutralise both blue↔orange and green↔magenta axes on
  // the sequence grade through the same shader used by preview and export.
  const autoWhiteBalance = () => {
    const sequencePlacements = placements.filter((placement) => !placement.compositionId);
    const sequenceItems = baseCuts.length ? baseCuts : sequencePlacements;
    const inputs = sequenceItems.map((item) => {
      const profile = analysis?.effects.find((effect) => effect.assetId === item.assetId);
      return profile?.color ? { id: item.id, stats: { brightness: profile.brightness, r: profile.color.r, g: profile.color.g, b: profile.color.b } } : null;
    }).filter((entry): entry is { id: string; stats: { brightness: number; r: number; g: number; b: number } } => entry !== null);
    if (!inputs.length) { setStatus("Analyze the footage first — auto white balance needs its colour stats."); return; }
    const balance = autoWhiteBalanceAdjust(inputs);
    if (Math.abs(balance.temperature) < 0.005 && Math.abs(balance.tint) < 0.005) { setStatus("Already neutral — no white-balance correction needed."); return; }
    checkpoint();
    setColorBypass(false);
    setManualGrade((grade) => ({ ...grade, temperature: balance.temperature, tint: balance.tint }));
    const actions = [Math.abs(balance.temperature) >= .005 ? balance.temperature < 0 ? "cooled" : "warmed" : "", Math.abs(balance.tint) >= .005 ? balance.tint < 0 ? "shifted green" : "shifted magenta" : ""].filter(Boolean).join(" and ");
    setStatus(`Auto white balance ${actions} to neutralise both colour axes.`);
  };

  const generateAutoVariations = () => {
    if (!analysis || !visualAssets.length) {
      setStatus("Analyze the song and footage before generating editorial alternatives.");
      return;
    }
    const preferred = suggestStyle({
      bpm: analysis.bpm,
      energy: analysis.sections.reduce((maximum, section) => Math.max(maximum, section.energy), 0),
      drop: energyArc?.dropStrength ?? 0,
    });
    const ordered = [preferred, ...EDIT_STYLES.filter((style) => style.id !== preferred.id)];
    const tonalTargets = [
      ordered.find((style) => style.pace === "cinematic"),
      ordered.find((style) => style.pace === "balanced"),
      ordered.find((style) => style.pace === "frenetic"),
    ].filter((style): style is EditStyle => Boolean(style));
    const candidates = [...new Map([...tonalTargets, ...ordered].map((style) => [style.id, style])).values()].slice(0, 3);
    const variations = candidates.map((style, index): AutoVariation => ({
      id: `variation-${style.id}-${crypto.randomUUID()}`,
      style,
      placements: composeDirector(analysis, sections, beats, style.energy),
      baseCuts: buildMontage(analysis, sections, beats, rerollSeedRef.current + index + 1, style.pace, style.transition),
    }));
    setAutoVariations(variations);
    setStatus("Built three editable directions from the same analysis. Protected sections and clips remain intact.");
  };

  const applyAutoVariation = (variation: AutoVariation) => {
    stageAutoEdit(variation.style.label,variation.baseCuts,{placements:variation.placements,styleId:variation.style.id,montagePace:variation.style.pace,punchPreset:variation.style.punch,lookPreset:variation.style.look,transitionType:variation.style.transition,autoEnergy:variation.style.energy},"music");
  };

  const rebuildPlacements = () => {
    checkpoint();
    const smart = analysis ? composeDirector(analysis, sections, beats) : null;
    const next = smart ? smart.filter((placement) => {
      const section = sections.find((item) => placement.start >= item.start && placement.start < item.end);
      return section?.enabled ?? false;
    }) : makePlacements(assets, visibleBeats, sections, clipTracks);
    setPlacements(next);
    setSelectedPlacementId(null);
    setStatus(`${next.length} deliberate placements built across ${sections.length} sections.`);
  };

  const updateSection = (patch: Partial<SectionRule>) => {
    if (!selectedSection || analyzing || rendering) return;
    if (!continuousEditRef.current) checkpoint();
    const nextSections = sections.map((item) => (item.id === selectedSectionId ? { ...item, ...patch } : item));
    setSections(nextSections);
    if (Object.prototype.hasOwnProperty.call(patch, "locked")) {
      setStatus(patch.locked ? `${selectedSection.name} is protected from automated rebuilds.` : `${selectedSection.name} is available to Auto Director again.`);
      return;
    }
    // A rename doesn't change the edit — skip the placement rebuild + its status.
    if (Object.keys(patch).length === 1 && Object.prototype.hasOwnProperty.call(patch, "name")) return;
    if (!analysis) return;
    const rebuiltSection = composeDirector(analysis, nextSections, beats).filter((placement) => placement.sectionId === selectedSectionId);
    const preserveManualClips = patch.enabled !== false;
    setPlacements((items) => mergeDirectedSectionPlacements(items, rebuiltSection, selectedSectionId, preserveManualClips));
    setSelectedPlacementId(null);
    setStatus(`${selectedSection.name} rebuilt with ${rebuiltSection.length} hits from the existing analysis.`);
  };

  const updatePlacement = (patch: Partial<Placement>) => {
    if (!selectedPlacementId) return;
    if (selectedTrack?.locked) {
      setStatus(`${selectedTrack.name} is locked. Unlock the track before editing its clips.`);
      return;
    }
    if (!continuousEditRef.current) checkpoint();
    setPlacements((items) => items.map((item) => {
      if (item.id !== selectedPlacementId) return item;
      const candidate = { ...item, ...patch };
      const composition = candidate.compositionId ? compositions.find((entry) => entry.id === candidate.compositionId) : null;
      const asset = assets.find((entry) => entry.id === candidate.assetId);
      const sourceDuration = composition?.duration
        ?? asset?.duration
        ?? analysis?.effects.find((effect) => effect.assetId === candidate.assetId)?.sourceDuration
        ?? Number.POSITIVE_INFINITY;
      const playbackRate = videoClipPlaybackRate(candidate);
      const sourceStart = Math.max(0, Math.min(candidate.sourceStart, Math.max(0, sourceDuration - 0.04)));
      const maxDuration = Math.max(0.04, Math.min(duration - candidate.start, (sourceDuration - sourceStart) / playbackRate));
      return { ...candidate, playbackRate, sourceStart, duration: Math.max(0.04, Math.min(candidate.duration, maxDuration)) };
    }).sort((a, b) => a.start - b.start));
  };

  const splitPlacementAt = (placement: Placement, time: number) => {
    const track = clipTracks.find((item) => item.id === placement.trackId);
    if (track?.locked) {
      setStatus(`${track.name} is locked.`);
      return;
    }
    const split = splitVideoTrackClip(placement, time, `placement-${crypto.randomUUID()}`);
    if (!split) {
      setStatus("Move the cut point farther from the stacked clip edge.");
      return;
    }
    checkpoint();
    setPlacements((items) => items.flatMap((item) => item.id === placement.id ? split : item).sort((a, b) => a.start - b.start));
    setSelectedPlacementId(split[1].id);
    setSelectedTrackId(placement.trackId ?? selectedTrackId);
    setActivePanel("clip");
    setStatus(`Split ${track?.name ?? "video track"} at ${formatTimecode(time, exportFrameRate)}.`);
  };


  const updateBaseCut = (patch: Partial<BaseCut>) => {
    if (!selectedBaseCutId || !selectedBaseCut) return;
    const changesTiming = patch.playbackRate !== undefined || patch.start !== undefined || patch.duration !== undefined || patch.sourceStart !== undefined;
    const linked = linkedSelection && changesTiming ? audioClips.filter((clip) => clip.linkedVideoId === selectedBaseCutId) : [];
    if (linked.some((clip) => audioTracks.find((track) => track.id === clip.trackId)?.locked)) { setStatus("Unlock the linked audio track before changing picture timing."); return; }
    const candidate = { ...selectedBaseCut, ...patch };
    const asset = assets.find((entry) => entry.id === candidate.assetId);
    const assetDuration = asset?.duration ?? analysis?.effects.find((effect) => effect.assetId === candidate.assetId)?.sourceDuration ?? Number.POSITIVE_INFINITY;
    const playbackRate = clipPlaybackRate(candidate);
    const sourceStart = Math.max(0, Math.min(candidate.sourceStart, Math.max(0, assetDuration - 0.05)));
    const maxDuration = Math.max(0.05, (assetDuration - sourceStart) / playbackRate);
    const updated = { ...candidate, start: Math.max(0, candidate.start), playbackRate, sourceStart, duration: Math.max(0.05, Math.min(candidate.duration, maxDuration)) };
    if (!continuousEditRef.current) checkpoint();
    setBaseCuts((items) => items
      .map((item) => item.id === selectedBaseCutId ? updated : item)
      .sort((a, b) => a.start - b.start));
    if (linked.length) setAudioClips((items) => items.map((clip) => clip.linkedVideoId === selectedBaseCutId ? retimeLinkedAudio(clip, selectedBaseCut, updated) : clip));
  };

  const autoBalanceSelectedClip = (target: "base" | "overlay") => {
    const clip = target === "base" ? selectedBaseCut : selectedPlacement;
    if (!clip || ("compositionId" in clip && clip.compositionId)) return;
    const profile = analysis?.effects.find((effect) => effect.assetId === clip.assetId);
    if (!profile?.color) {
      setStatus("Analyze this footage first — selected-clip white balance needs sampled color stats.");
      return;
    }
    const balance = autoWhiteBalanceAdjust([{ id: clip.id, stats: { brightness: profile.brightness, r: profile.color.r, g: profile.color.g, b: profile.color.b } }]);
    const color = { ...NEUTRAL_CLIP_COLOR, ...clip.color, ...balance };
    if (target === "base") updateBaseCut({ color }); else updatePlacement({ color });
    setStatus(`Balanced the selected clip · ${balance.temperature >= 0 ? "warm" : "cool"} ${Math.abs(balance.temperature).toFixed(2)} · ${balance.tint >= 0 ? "magenta" : "green"} ${Math.abs(balance.tint).toFixed(2)}.`);
  };

  // The clip's static transform lives on its first transform keyframe (so it
  // shares the compositor's animation evaluator); the Transform panel reads and
  // writes that. Flip is a separate clip flag applied by the compositor draw.
  const CLIP_TRANSFORM_DEFAULT = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
  const clipTransform = { ...CLIP_TRANSFORM_DEFAULT, ...selectedBaseCut?.transformKeyframes?.[0] };
  const setClipTransform = (patch: Partial<typeof CLIP_TRANSFORM_DEFAULT>) => {
    if (!selectedBaseCut) return;
    const head = selectedBaseCut.transformKeyframes?.[0] ?? { id: `kf-${crypto.randomUUID()}`, time: 0, ...CLIP_TRANSFORM_DEFAULT };
    const rest = (selectedBaseCut.transformKeyframes ?? []).slice(1);
    updateBaseCut({ transformKeyframes: [{ ...head, ...patch, time: 0 }, ...rest] });
  };

  const applySelectedSplitEdit = (kind: SplitEditKind) => {
    if (!selectedBaseCut) return;
    const selectedAsset = assets.find((asset) => asset.id === selectedBaseCut.assetId);
    const existing = audioClips.find((clip) => clip.linkedVideoId === selectedBaseCut.id) ?? selectedAudioClip;
    const target = existing ?? (selectedAsset?.kind === "video" ? {
      id: `audio-clip-${crypto.randomUUID()}`,
      assetId: selectedAsset.id,
      trackId: audioTracks.find((track) => !track.locked)?.id ?? audioTracks[0]?.id ?? "a1",
      name: `${selectedAsset.name} · embedded audio`,
      start: selectedBaseCut.start,
      sourceStart: selectedBaseCut.sourceStart,
      duration: selectedBaseCut.duration,
      gain: 1, pan: 0, fadeIn: 0, fadeOut: 0, muted: false,
      automation: [], linkedVideoId: selectedBaseCut.id,
    } satisfies AudioClip : null);
    if (!target) {
      setStatus("This picture clip has no embedded or linked audio for a split edit.");
      return;
    }
    checkpoint();
    const edited = applySplitEdit(target, selectedBaseCut.start, selectedBaseCut.duration, kind, .5);
    setAudioClips((items) => existing
      ? items.map((clip) => clip.id === target.id ? edited : clip)
      : [...items, edited]);
    setSelectedAudioClipId(target.id);
    setSelectedAudioTrackId(target.trackId);
    setStatus(kind === "j-cut" ? "J-cut applied: dialogue now leads picture by 0.5s." : kind === "l-cut" ? "L-cut applied: dialogue now carries 0.5s past picture." : "Split edit reset to the picture cut.");
  };

  const applySelectedAsymmetricSplitEdit = () => {
    if (!selectedBaseCut) return;
    const target = audioClips.find((clip) => clip.linkedVideoId === selectedBaseCut.id) ?? selectedAudioClip;
    if (!target) {
      setStatus("Create or select linked audio before applying custom J/L handles.");
      return;
    }
    checkpoint();
    const edited = applyAsymmetricSplitEdit(target, selectedBaseCut.start, selectedBaseCut.duration, splitEditHandles.lead, splitEditHandles.trail);
    setAudioClips((items) => items.map((clip) => clip.id === target.id ? edited : clip));
    setSelectedAudioClipId(target.id);
    setSelectedAudioTrackId(target.trackId);
    setStatus(`Asymmetric split edit · audio leads ${splitEditHandles.lead.toFixed(2)}s and trails ${splitEditHandles.trail.toFixed(2)}s.`);
  };

  const startDynamicTrim = (edge: "in" | "out", mode: "ripple" | "roll") => {
    if (!selectedBaseCut) {
      setStatus("Select a V1 clip before entering Dynamic Trim.");
      return;
    }
    setDynamicTrimSelection({ cutId: selectedBaseCut.id, edge, mode });
    seek(edge === "in" ? selectedBaseCut.start : selectedBaseCut.start + selectedBaseCut.duration);
    setStatus(`Dynamic ${mode} trim armed on the ${edge} point · J/L trim backward/forward, K exits.`);
  };

  const stepDynamicTrim = (rate: number) => {
    if (!dynamicTrimSelection) return;
    checkpoint();
    const delta = dynamicTrimDelta(rate, exportFrameRate);
    setBaseCuts((items) => applyDynamicTrim(items, dynamicTrimSelection, delta));
    setCurrentTime((time) => snapToFrame(Math.max(0, Math.min(duration, time + delta)), exportFrameRate));
    setStatus(`Dynamic ${dynamicTrimSelection.mode} trim ${rate < 0 ? "back" : "forward"} ${Math.abs(rate)} frame${Math.abs(rate) === 1 ? "" : "s"}.`);
  };

  const selectedEffectClip = selectedBaseCut ?? selectedPlacement;
  const updateSelectedClipEffects = (effects: NonNullable<BaseCut["effects"]>) => {
    if (selectedBaseCut) updateBaseCut({ effects });
    else if (selectedPlacement) updatePlacement({ effects });
  };

  const applyClipEffectRecipe = (recipe: ClipEffectRecipe) => {
    if (!selectedEffectClip) return;
    updateSelectedClipEffects(effectsFromRecipe(recipe));
    setStatus(`${CLIP_EFFECT_RECIPES[recipe].label} effect stack applied to the selected clip.`);
  };

  const applyCustomEffectRecipe = (recipe: PortableEffectRecipe) => {
    if (!selectedEffectClip) return;
    updateSelectedClipEffects(recipe.effects.map((effect) => ({ ...structuredClone(effect), id: `fx-${crypto.randomUUID()}` })));
    setStatus(`${recipe.name} extension recipe applied to the selected clip.`);
  };

  const persistEffectRecipes = (recipes: PortableEffectRecipe[]) => {
    const limited = recipes.slice(-100);
    setCustomEffectRecipes(limited);
    try { window.localStorage.setItem("scenepilot-effect-recipes-v1", JSON.stringify(limited)); } catch { /* Recipe remains available in this session. */ }
  };

  const saveSelectedClipEffectRecipe = () => {
    if (!selectedEffectClip?.effects?.length) {
      setStatus("Add at least one clip effect before saving a reusable recipe.");
      return;
    }
    const recipe: PortableEffectRecipe = {
      id: `effect-recipe-${crypto.randomUUID()}`,
      name: `CUSTOM FX ${customEffectRecipes.length + 1}`,
      effects: selectedEffectClip.effects.map((effect) => ({ ...structuredClone(effect), id: `template-${crypto.randomUUID()}` })),
    };
    persistEffectRecipes([...customEffectRecipes, recipe]);
    setStatus(`${recipe.name} saved to the Pro extension library.`);
  };

  const autoGenerateClipEffects = () => {
    if (!selectedEffectClip) return;
    const sectionEnergy = sections.find((section) => section.id === selectedEffectClip.sectionId)?.energy ?? 0.5;
    const selectedIndex = selectedBaseCut ? selectedBaseCutIndex : placements.findIndex((placement) => placement.id === selectedPlacement?.id);
    const recipe = suggestedEffectRecipe(sectionEnergy, Math.max(0, selectedIndex));
    applyClipEffectRecipe(recipe);
  };

  const addClipEffect = (type: ClipEffectType) => {
    if (!selectedEffectClip) return;
    updateSelectedClipEffects([...(selectedEffectClip.effects ?? []), createClipEffect(type)]);
  };

  const updateClipEffect = (id: string, patch: Partial<NonNullable<BaseCut["effects"]>[number]>) => {
    if (!selectedEffectClip) return;
    updateSelectedClipEffects((selectedEffectClip.effects ?? []).map((effect) => effect.id === id ? { ...effect, ...patch } : effect));
  };

  const moveClipEffect = (id: string, direction: -1 | 1) => {
    if (!selectedEffectClip) return;
    const effects = [...(selectedEffectClip.effects ?? [])];
    const index = effects.findIndex((effect) => effect.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= effects.length) return;
    [effects[index], effects[target]] = [effects[target], effects[index]];
    updateSelectedClipEffects(effects);
  };

  const addClipEffectKeyframe = (effectId: string) => {
    if (!selectedEffectClip) return;
    const localTime = Math.max(0, Math.min(selectedEffectClip.duration, snapToFrame(currentTime - selectedEffectClip.start, exportFrameRate)));
    const effects = (selectedEffectClip.effects ?? []).map((effect) => {
      if (effect.id !== effectId) return effect;
      const others = (effect.keyframes ?? []).filter((keyframe) => Math.abs(keyframe.time - localTime) > 1e-3);
      return {
        ...effect,
        keyframes: [...others, { id: `fxkf-${crypto.randomUUID()}`, time: localTime, value: effect.amount, easing: "ease-in-out" as const }]
          .sort((left, right) => left.time - right.time),
      };
    });
    updateSelectedClipEffects(effects);
    setStatus(`Effect amount keyframed at ${formatTimecode(currentTime, exportFrameRate)}.`);
  };

  const updateClipEffectKeyframe = (effectId: string, keyframeId: string, patch: { time?: number; value?: number; easing?: Easing }) => {
    if (!selectedEffectClip) return;
    updateSelectedClipEffects((selectedEffectClip.effects ?? []).map((effect) => effect.id === effectId
      ? { ...effect, keyframes: (effect.keyframes ?? []).map((keyframe) => keyframe.id === keyframeId ? { ...keyframe, ...patch } : keyframe).sort((left, right) => left.time - right.time) }
      : effect));
  };

  const removeClipEffectKeyframe = (effectId: string, keyframeId: string) => {
    if (!selectedEffectClip) return;
    updateSelectedClipEffects((selectedEffectClip.effects ?? []).map((effect) => effect.id === effectId
      ? { ...effect, keyframes: (effect.keyframes ?? []).filter((keyframe) => keyframe.id !== keyframeId) }
      : effect));
  };

  const selectBaseCut = (cut: BaseCut, additive = false) => {
    if (!additive) {
      const grouped = cut.groupId ? baseCuts.filter((item) => item.groupId === cut.groupId).map((item) => item.id) : [cut.id];
      setSelectedBaseCutIds(grouped);
    } else {
      setSelectedBaseCutIds((ids) => ids.includes(cut.id) ? ids.filter((id) => id !== cut.id) : [...ids, cut.id]);
    }
    setSelectedBaseCutId(cut.id);
    setSelectedPlacementId(null);
    setActivePanel("base");
  };

  const groupCurrentSelection = () => {
    if (selectedBaseCutSet.size < 2) {
      setStatus("Shift-click at least two V1 clips before grouping them.");
      return;
    }
    checkpoint();
    const groupId = `clip-group-${crypto.randomUUID()}`;
    setBaseCuts((items) => groupSelectedCuts(items, selectedBaseCutSet, groupId));
    setStatus(`${selectedBaseCutSet.size} clips grouped. Selecting or moving one now selects the group.`);
  };

  const ungroupCurrentSelection = () => {
    if (![...selectedBaseCutSet].some((id) => baseCuts.find((cut) => cut.id === id)?.groupId)) {
      setStatus("The selected clips are not grouped.");
      return;
    }
    checkpoint();
    setBaseCuts((items) => ungroupSelectedCuts(items, selectedBaseCutSet));
    setStatus("Clip group released; timing stays unchanged.");
  };

  // Nest the selected base cuts into a reusable composition and replace them on
  // the timeline with a single composition clip (lossless — see lib/nest.ts).
  const nestSelection = () => {
    if (selectedBaseCutSet.size < 1) { setStatus("Select clips on V1 to nest them into a composition."); return; }
    const size = outputDimensions(sourceDims.w, sourceDims.h, exportMaxDimension, aspect, customSize);
    const compositionId = `comp-${crypto.randomUUID()}`;
    const result = nestBaseCuts(baseCuts, selectedBaseCutSet, {
      width: size.width, height: size.height, compositionId,
      name: `NEST ${compositions.length + 1}`,
    });
    if (!result) { setStatus("Nothing to nest."); return; }
    const targetTrack = clipTracks.find((track) => track.enabled && !track.locked) ?? clipTracks[0];
    if (!targetTrack) { setStatus("Add an overlay video track to hold the nested clip."); return; }
    checkpoint();
    const removed = new Set(result.removedIds);
    const placement: Placement = {
      id: `placement-${crypto.randomUUID()}`,
      assetId: `composition:${compositionId}`,
      compositionId,
      sectionId: "manual",
      start: result.start,
      sourceStart: 0,
      duration: result.duration,
      scale: 100,
      opacity: 100,
      trackId: targetTrack.id,
    };
    setCompositions((items) => [...items, normalizeComposition(result.composition)]);
    // Cross-lane edit — one atomic update on the unified store (remove the nested
    // base cuts, add the composition clip on the overlay track).
    setVideoClips((clips) => {
      const split = splitUnifiedTimeline(clips);
      return toUnifiedTimeline(split.baseCuts.filter((cut) => !removed.has(cut.id)), [...split.placements, placement], UNIFIED_BASE_TRACK);
    });
    setSelectedBaseCutId(null);
    setSelectedTrackId(targetTrack.id);
    setStatus(`Nested ${result.removedIds.length} clip${result.removedIds.length === 1 ? "" : "s"} into ${result.composition.name} on ${targetTrack.name}. Open it in Composition to edit inside.`);
  };

  // Cross-lane clip mobility — enabled by the unified VideoClip model. Move the
  // selected base-lane clip up onto an overlay track, keeping every attribute
  // (colour, effects, reverse, time-remap) via the lossless adapter.
  const sendSelectedToOverlay = () => {
    if (!selectedBaseCut) { setStatus("Select a base-lane clip to send to an overlay track."); return; }
    const targetTrack = clipTracks.find((track) => track.enabled && !track.locked) ?? clipTracks[0];
    if (!targetTrack) { setStatus("Add an overlay video track first."); return; }
    checkpoint();
    const moved = videoClipToPlacement(baseCutToVideoClip(selectedBaseCut, UNIFIED_BASE_TRACK));
    const placement: Placement = { ...(moved as Placement), id: `placement-${crypto.randomUUID()}`, trackId: targetTrack.id };
    // One atomic move on the unified store: drop the base cut, add the overlay.
    setVideoClips((clips) => {
      const split = splitUnifiedTimeline(clips);
      return toUnifiedTimeline(split.baseCuts.filter((cut) => cut.id !== selectedBaseCut.id), [...split.placements, placement], UNIFIED_BASE_TRACK);
    });
    setSelectedBaseCutId(null);
    setSelectedPlacementId(placement.id);
    setSelectedTrackId(targetTrack.id);
    setActivePanel("clip");
    setStatus(`Sent the clip to ${targetTrack.name} — it composites as an overlay now, look and all.`);
  };

  const openSourceAsset = (asset: MediaAsset) => {
    setSourceAssetId(asset.id);
    setSourceTime(0);
    setSourceRange({ inPoint: 0, outPoint: asset.duration && Number.isFinite(asset.duration) ? asset.duration : 5 });
    setMonitorMode("source");
    setStatus(asset.kind === "audio" ? `${asset.name} opened in Source. Drag it to an audio track, or right-click the media and choose Add audio at playhead.` : `${asset.name} opened in Source. Mark In/Out, then Insert or Overwrite.`);
  };

  const seekSource = (time: number) => {
    const next = Math.max(0, Math.min(sourceDuration, time));
    setSourceTime(next);
    if (sourceVideoRef.current) {
      try { sourceVideoRef.current.currentTime = next; } catch { /* metadata is still loading */ }
    }
  };

  const editSourceToTimeline = (mode: "insert" | "overwrite") => {
    if (!sourceAsset || sourceAsset.kind === "audio") {
      setStatus("Open a video or still in the Source monitor for a picture edit. Audio can be dragged to an audio track.");
      return;
    }
    const start = Math.max(0, timelineRange.inPoint ?? currentTime);
    const markedDuration = Math.max(0.05, sourceOut - sourceRange.inPoint);
    const targetDuration = timelineRange.outPoint !== null && timelineRange.outPoint > start
      ? timelineRange.outPoint - start
      : markedDuration;
    const clipDuration = Math.max(0.05, targetDuration);
    const playbackRate = markedDuration / clipDuration;
    if (playbackRate < 0.1 || playbackRate > 8) {
      setStatus("This fit-to-fill needs a speed outside 10–800%. Adjust the Source or sequence In/Out points.");
      return;
    }
    const section = sections.find((item) => start >= item.start && start < item.end) ?? sections[0];
    const clip: BaseCut = {
      id: `base-cut-${crypto.randomUUID()}`,
      assetId: sourceAsset.id,
      sectionId: section?.id ?? "manual",
      start,
      sourceStart: sourceRange.inPoint,
      duration: clipDuration,
      playbackRate,
      linked: true,
    };
    // Video edits carry their embedded audio onto the first available audio
    // track. This makes Source Insert/Overwrite and J/L edits behave as users
    // expect without requiring a separate extraction/import step.
    const audioTrack = sourceAsset.kind === "video" ? audioTracks.find((track) => !track.locked) : undefined;
    const linkedAudio: AudioClip | undefined = audioTrack ? {
          id: `audio-clip-${crypto.randomUUID()}`,
          assetId: sourceAsset.id,
          trackId: audioTrack.id,
          name: `${sourceAsset.name} · embedded audio`,
          start,
          sourceStart: sourceRange.inPoint,
          duration: clipDuration,
          playbackRate,
          gain: 1,
          pan: 0,
          fadeIn: 0,
          fadeOut: 0,
          muted: false,
          automation: [],
          linkedVideoId: clip.id,
        } : undefined;
    const edit = planSourceEdit({ cuts: baseCuts, audioClips, audioTracks, incoming: clip, incomingAudio: linkedAudio, mode });
    if (edit.error) { setStatus(edit.error); return; }
    checkpoint();
    setBaseCuts(edit.cuts!);
    setAudioClips(edit.audioClips!);
    setMontageEnabled(true);
    if (linkedAudio) {
      setSelectedAudioClipId(linkedAudio.id);
      setSelectedAudioTrackId(linkedAudio.trackId);
    }
    setSelectedBaseCutId(clip.id);
    setActivePanel("base");
    setMonitorMode("program");
    seek(mode === "insert" ? start + clipDuration : start);
    const fitNote = Math.abs(playbackRate - 1) > 0.01 ? ` · fit to fill at ${Math.round(playbackRate * 100)}%` : "";
    setStatus(`${mode === "insert" ? "Inserted" : "Overwrote with"} ${sourceAsset.name} · ${formatTime(sourceRange.inPoint)}–${formatTime(sourceOut)}${fitNote}.`);
  };

  // ---- Per-clip transform keyframes -------------------------------------
  const addTransformKeyframe = () => {
    if (!selectedBaseCut) return;
    const localTime = Math.max(0, Math.min(selectedBaseCut.duration, snapToFrame(currentTime - selectedBaseCut.start, exportFrameRate)));
    const others = (selectedBaseCut.transformKeyframes ?? []).filter((keyframe) => Math.abs(keyframe.time - localTime) > 1e-3);
    const next = [...others, { id: `kf-${crypto.randomUUID()}`, time: localTime, ...motionDraft, easing: "linear" as const }]
      .sort((a, b) => a.time - b.time);
    updateBaseCut({ transformKeyframes: next });
    setStatus(`Keyframe at ${formatTimecode(currentTime, exportFrameRate)}. Add another down the timeline to animate.`);
  };
  const removeTransformKeyframe = (id: string) => {
    if (!selectedBaseCut) return;
    updateBaseCut({ transformKeyframes: (selectedBaseCut.transformKeyframes ?? []).filter((keyframe) => keyframe.id !== id) });
  };
  const updateTransformKeyframe = (id: string, patch: Partial<Pick<TransformKeyframe, "time" | "easing" | "bezier">>) => {
    if (!selectedBaseCut) return;
    updateBaseCut({
      transformKeyframes: (selectedBaseCut.transformKeyframes ?? []).map((keyframe) =>
        keyframe.id === id ? { ...keyframe, ...patch } : keyframe),
    });
  };

  // Keyframed time remap (AE Time Remap). Enabling seeds an identity two-key map;
  // adding a point at the playhead lets the user drag speed/freeze/reverse in.
  const toggleTimeRemap = () => {
    if (!selectedBaseCut) return;
    checkpoint();
    if (hasTimeRemap(selectedBaseCut.timeRemap)) {
      updateBaseCut({ timeRemap: undefined });
      setStatus("Time remap cleared — clip plays at its straight rate.");
    } else {
      updateBaseCut({ timeRemap: identityTimeRemap(selectedBaseCut.sourceStart, selectedBaseCut.duration, clipPlaybackRate(selectedBaseCut), selectedBaseCut.id) });
      setStatus("Time remap on. Add points at the playhead, then drag their source time to speed/freeze/reverse.");
    }
  };
  const addTimeRemapPoint = () => {
    if (!selectedBaseCut) return;
    const keys = hasTimeRemap(selectedBaseCut.timeRemap)
      ? selectedBaseCut.timeRemap
      : identityTimeRemap(selectedBaseCut.sourceStart, selectedBaseCut.duration, clipPlaybackRate(selectedBaseCut), selectedBaseCut.id);
    const localTime = Math.max(0, Math.min(selectedBaseCut.duration, snapToFrame(currentTime - selectedBaseCut.start, exportFrameRate)));
    const sourceTime = sampleTimeRemap(keys, localTime);
    const next = [...keys.filter((k) => Math.abs(k.time - localTime) > 1e-3), { id: `tr-${crypto.randomUUID()}`, time: localTime, sourceTime }]
      .sort((a, b) => a.time - b.time);
    checkpoint();
    updateBaseCut({ timeRemap: next });
    setStatus(`Time-remap point at ${formatTimecode(currentTime, exportFrameRate)} (source ${sourceTime.toFixed(2)}s). Drag its source time to retime.`);
  };
  const updateTimeRemapPoint = (id: string, sourceTime: number) => {
    if (!selectedBaseCut || !hasTimeRemap(selectedBaseCut.timeRemap)) return;
    updateBaseCut({ timeRemap: selectedBaseCut.timeRemap.map((k) => k.id === id ? { ...k, sourceTime: Math.max(0, sourceTime) } : k) });
  };
  const removeTimeRemapPoint = (id: string) => {
    if (!selectedBaseCut || !hasTimeRemap(selectedBaseCut.timeRemap)) return;
    const next = selectedBaseCut.timeRemap.filter((k) => k.id !== id);
    updateBaseCut({ timeRemap: next.length >= 2 ? next : undefined });
  };
  const loadTransformKeyframe = (keyframe: { time: number; x: number; y: number; scale: number; rotation: number; opacity: number }) => {
    if (!selectedBaseCut) return;
    setMotionDraft({ x: keyframe.x, y: keyframe.y, scale: keyframe.scale, rotation: keyframe.rotation, opacity: keyframe.opacity });
    seek(selectedBaseCut.start + keyframe.time);
  };
  const copyTransformKeyframes = () => {
    if (!selectedBaseCut?.transformKeyframes?.length) return;
    transformClipboardRef.current = { duration: selectedBaseCut.duration, keyframes: structuredClone(selectedBaseCut.transformKeyframes) };
    setHasTransformClipboard(true);
    setStatus(`Copied ${selectedBaseCut.transformKeyframes.length} motion keyframes.`);
  };
  const pasteTransformKeyframes = () => {
    if (!selectedBaseCut || !transformClipboardRef.current) return;
    const clipboard = transformClipboardRef.current;
    const scale = selectedBaseCut.duration / Math.max(0.05, clipboard.duration);
    updateBaseCut({ transformKeyframes: clipboard.keyframes.map((keyframe) => ({ ...keyframe, id: `kf-${crypto.randomUUID()}`, time: Math.min(selectedBaseCut.duration, keyframe.time * scale) })) });
    setStatus(`Pasted ${clipboard.keyframes.length} keyframes and fitted them to this clip.`);
  };

  const splitSelectedBaseCut = () => {
    if (!selectedBaseCut || currentTime <= selectedBaseCut.start + 0.03 || currentTime >= selectedBaseCut.start + selectedBaseCut.duration - 0.03) {
      setStatus("Move the playhead inside a selected V1 clip before splitting.");
      return;
    }
    razorAt(currentTime, selectedBaseCut.id);
  };

  // A lone dropped video isn't a montage, so V1 shows it as one static strip. To
  // "edit normally" it must become a real clip first — a single cut sourced from
  // the main video (MAIN_SOURCE_ID renders identically in preview and export).
  const editableBaseCuts = (): BaseCut[] => {
    if (baseCuts.length) return baseCuts;
    if (!mainFile || !(duration > 0)) return [];
    return [{ id: `base-main-${crypto.randomUUID()}`, assetId: MAIN_SOURCE_ID, sectionId: sections[0]?.id ?? "main", start: 0, duration, sourceStart: 0 }];
  };

  const razorAt = (time: number, preferredCutId?: string) => {
    const source = editableBaseCuts();
    const target = preferredCutId
      ? source.find((cut) => cut.id === preferredCutId)
      : source.find((cut) => time > cut.start && time < cut.start + cut.duration);
    if (!target) {
      setStatus(mainFile ? "The razor needs a clip under the cut point." : "Load a video first, then use the razor to cut it.");
      return;
    }
    const split = planLinkedRazor(source, audioClips, audioTracks, target.id, snapToFrame(time, exportFrameRate), linkedSelection);
    if (split.error || !split.cuts) {
      setStatus(split.error ?? "Move the razor farther from the clip edge.");
      return;
    }
    checkpoint();
    setBaseCuts(split.cuts);
    setAudioClips(split.audioClips);
    if (!montageEnabled) setMontageEnabled(true);
    setSelectedBaseCutId(split.selectedId);
    setSelectedBaseCutIds([split.selectedId]);
    setStatus(`Razor cut at ${formatTime(time)}.`);
  };

  const nudgeProfessionalEdit = (direction: -1 | 1, large = false) => {
    if (!selectedBaseCut) return;
    const delta = direction * (large ? 0.5 : 1 / exportFrameRate);
    checkpoint();
    if (timelineTool === "slip") {
      setBaseCuts((items) => items.map((cut) => cut.id === selectedBaseCut.id
        ? slipCut(cut, delta, selectedBaseAssetDuration)
        : cut));
      setStatus(`Slip edit ${direction > 0 ? "forward" : "back"} ${Math.abs(delta).toFixed(2)}s.`);
    } else if (timelineTool === "slide") {
      setBaseCuts((items) => slideCut(items, selectedBaseCut.id, delta));
      setStatus(`Slide edit ${direction > 0 ? "forward" : "back"} ${Math.abs(delta).toFixed(2)}s.`);
    } else if (timelineTool === "roll") {
      setBaseCuts((items) => rollEdit(items, selectedBaseCut.id, delta));
      setStatus(`Rolled the next edit point ${direction > 0 ? "forward" : "back"}.`);
    } else if (timelineTool === "rate") {
      setBaseCuts((items) => items.map((cut) => cut.id === selectedBaseCut.id
        ? rateStretchCut(cut, Math.min(duration - cut.start, Math.max(0.05, cut.duration + delta)), selectedBaseAssetDuration)
        : cut));
      setStatus(`Rate stretch ${direction > 0 ? "longer and slower" : "shorter and faster"} by ${Math.abs(delta).toFixed(2)}s.`);
    } else {
      const nextStart = snapTime(selectedBaseCut.start + delta, snapCandidates, 0.08, snapping);
      updateBaseCut({ start: Math.min(duration - selectedBaseCut.duration, nextStart) });
    }
  };

  const addMarker = (kind: TimelineMarker["kind"] = "marker") => {
    checkpoint();
    // A plain marker with a live In/Out range becomes a range/duration marker
    // spanning it — like marking a region to revisit.
    const rangeSpan = kind === "marker" && timelineRange.inPoint !== null && timelineRange.outPoint !== null
      ? Math.abs(timelineRange.outPoint - timelineRange.inPoint)
      : 0;
    const markerTime = rangeSpan > 0 ? Math.min(timelineRange.inPoint!, timelineRange.outPoint!) : currentTime;
    const marker: TimelineMarker = {
      id: `marker-${crypto.randomUUID()}`,
      time: markerTime,
      label: kind === "chapter" ? `CHAPTER ${markers.filter((item) => item.kind === "chapter").length + 1}` : rangeSpan > 0 ? "RANGE" : "MARKER",
      color: kind === "comment" ? "#f7c84b" : kind === "sync" ? "#5eb8ff" : "#ff695d",
      kind,
      ...(rangeSpan > 0 ? { duration: rangeSpan } : {}),
    };
    setMarkers((items) => [...items, marker].sort((a, b) => a.time - b.time));
    setStatus(rangeSpan > 0
      ? `Range marker over ${formatTime(marker.time)}–${formatTime(marker.time + rangeSpan)} added.`
      : `${marker.label} added at ${formatTime(currentTime)}.`);
  };

  const extractInOut = () => {
    if (timelineRange.inPoint === null || timelineRange.outPoint === null) {
      setStatus("Mark an In and Out point before extracting a range.");
      return;
    }
    checkpoint();
    const start = Math.min(timelineRange.inPoint, timelineRange.outPoint);
    const end = Math.max(timelineRange.inPoint, timelineRange.outPoint);
    const removed = [{ start, end, duration: end - start }];
    setBaseCuts((items) => extractRange(items, start, end));
    setPlacements((items) => items.flatMap((item) => clipTracks.find((track) => track.id === item.trackId)?.syncLock === false ? [item] : extractTimedRanges([item], removed)));
    setAudioClips((items) => items.flatMap((item) => audioTracks.find((track) => track.id === item.trackId)?.syncLock === false ? [item] : extractTimedRanges([item], removed, sliceEditorialAudio)));
    setTitles((items) => extractTimedRanges(items, removed));
    setTranscriptWords((items) => remapTranscriptAfterDeletion(items, removed));
    setBeats((items) => compactTimelineTimes(items, removed));
    setMarkers((items) => items.filter((marker) => marker.time <= start || marker.time >= end).map((marker) => ({ ...marker, time: timeAfterRemovingRanges(marker.time, removed) })));
    setSections((items) => items.map((section) => ({ ...section, start: timeAfterRemovingRanges(section.start, removed), end: timeAfterRemovingRanges(section.end, removed) })).filter((section) => section.end - section.start >= 0.05));
    setDuration((value) => Math.max(0.05, value - (end - start)));
    setTimelineRange({ inPoint: null, outPoint: null });
    setSelectedBaseCutId(null);
    seek(start);
    setStatus(`Extracted ${formatTime(end - start)} and closed the sequence gap.`);
  };

  // Four-point "fit to fill": retime the selected clip's source span so it fills
  // the marked In/Out range exactly, then overwrite the range with it.
  const fitSelectedToRange = () => {
    if (!selectedBaseCut) {
      setStatus("Select a clip to fit into the range.");
      return;
    }
    if (timelineRange.inPoint === null || timelineRange.outPoint === null) {
      setStatus("Mark In and Out points to define the range to fill.");
      return;
    }
    const timelineIn = Math.min(timelineRange.inPoint, timelineRange.outPoint);
    const timelineOut = Math.max(timelineRange.inPoint, timelineRange.outPoint);
    const sourceIn = selectedBaseCut.sourceStart;
    const sourceOut = sourceIn + selectedBaseCut.duration * clipPlaybackRate(selectedBaseCut);
    const cut = buildPointEditCut(selectedBaseCut, { sourceIn, sourceOut, timelineIn, timelineOut }, `fit-${crypto.randomUUID()}`);
    if (!cut) {
      setStatus("Fit-to-fill requires positive ranges and a speed between 10% and 800%. Adjust the In/Out points.");
      return;
    }
    if (selectedBaseCut.locked) { setStatus("Unlock this picture clip before fitting it to the range."); return; }
    const linked = linkedSelection ? audioClips.filter((clip) => clip.linkedVideoId === selectedBaseCut.id) : [];
    if (linked.length && (selectedBaseCut.reversed || selectedBaseCut.timeRemap?.length)) { setStatus("Linked audio cannot follow reverse or variable time-remapping yet. Unlink audio or render this clip before fitting it to the range."); return; }
    const linkedIds = new Set(linked.map((clip) => clip.id));
    const edit = planSourceEdit({ cuts: baseCuts.filter((item) => item.id !== selectedBaseCut.id), audioClips: audioClips.filter((clip) => !linkedIds.has(clip.id)), audioTracks, incoming: cut, incomingAudioClips: linked.map((clip) => retimeLinkedAudio(clip, selectedBaseCut, cut)), mode: "overwrite" });
    if (edit.error) { setStatus(edit.error); return; }
    checkpoint();
    setBaseCuts(edit.cuts!);
    setAudioClips(edit.audioClips!);
    setSelectedBaseCutId(cut.id);
    const fitRate = clipPlaybackRate(cut);
    setStatus(fitRate === 1
      ? "Fit into the range."
      : `Fit to fill: retimed to ${fitRate.toFixed(2)}× to fill the range.`);
  };

  const closeAllTimelineGaps = () => {
    if (baseCuts.length < 2) return;
    checkpoint();
    setBaseCuts((items) => removeTimelineGaps(items));
    setStatus("Closed all gaps on V1 without changing clip order or duration.");
  };

  const matchFrameAtPlayhead = () => {
    const match = matchFrame(baseCuts, currentTime);
    if (!match) {
      setStatus("There is no V1 frame under the playhead.");
      return;
    }
    const asset = assets.find((item) => item.id === match.assetId);
    if (!asset) {
      setStatus("The matched frame points to offline media.");
      return;
    }
    openSourceAsset(asset);
    setSourceTime(match.sourceTime);
    setMatchFrameHistory((items) => [{ id: `match-${crypto.randomUUID()}`, assetId: asset.id, label: asset.name, time: match.sourceTime }, ...items].slice(0, 8));
    window.setTimeout(() => {
      if (sourceVideoRef.current) sourceVideoRef.current.currentTime = match.sourceTime;
    });
    setStatus(`Matched ${asset.name} at ${formatTime(match.sourceTime)} in the Source monitor.`);
  };

  const restoreMatchFrame = (id: string) => {
    const match = matchFrameHistory.find((item) => item.id === id);
    const asset = match && assets.find((item) => item.id === match.assetId);
    if (!match || !asset) {
      setStatus("That match-frame source is offline.");
      return;
    }
    openSourceAsset(asset);
    setSourceTime(match.time);
    window.setTimeout(() => { if (sourceVideoRef.current) sourceVideoRef.current.currentTime = match.time; });
    setStatus(`Restored matched frame · ${asset.name} at ${formatTime(match.time)}.`);
  };

  const replaceSelectedFromSource = () => {
    if (!selectedBaseCut || !sourceAsset || sourceAsset.kind === "audio") {
      setStatus("Select a V1 clip and open replacement media in the Source monitor first.");
      return;
    }
    checkpoint();
    const replacement = replaceEdit(selectedBaseCut, sourceAsset.id, sourceRange.inPoint, sourceDuration);
    setBaseCuts((items) => items.map((item) => item.id === selectedBaseCut.id ? replacement : item));
    setStatus(`Replaced the shot with ${sourceAsset.name} while preserving both edit points.`);
  };

  const buildMulticamPass = () => {
    const angles = multicamAssets;
    if (angles.length < 2) {
      setStatus("Import at least two video angles before building a multicam pass.");
      return;
    }
    const syncPoints = markers.filter((marker) => marker.kind === "sync").map((marker) => marker.time);
    const switches = syncPoints.length > 1
      ? syncPoints
      : sceneAwareSwitchTimes((analysis?.sceneCuts ?? []).map((cut) => cut.time), beats, duration);
    checkpoint();
    // Content-aware: weight each angle by its motion/energy so the livelier
    // cameras get more screen time (falls back to round-robin without analysis).
    const angleWeights = analysis?.effects.length
      ? angles.map((asset) => 0.1 + (analysis.effects.find((effect) => effect.assetId === asset.id)?.flashiness ?? 0.5))
      : undefined;
    setBaseCuts(buildMulticamSequence(angles.map((asset) => ({ assetId: asset.id, sourceDuration: asset.duration ?? duration })), switches, duration, "multicam", { angleWeights }));
    setMontageEnabled(true);
    setSelectedBaseCutId(null);
    setMonitorMode("multicam");
    setStatus(`Built a ${angles.length}-angle multicam pass with ${switches.length} switch points${angleWeights ? " (content-weighted)" : ""}.`);
  };

  const recordLiveMulticamSwitch = (assetId: string) => {
    const angle = multicamAssets.find((asset) => asset.id === assetId);
    if (!angle) return;
    const switchTime = snapToFrame(currentTime, exportFrameRate);
    checkpoint();
    setBaseCuts((items) => {
      const seeded = items.some((cut) => switchTime >= cut.start - 1e-6 && switchTime < cut.start + cut.duration - 1e-6)
        ? items
        : buildMulticamSequence(multicamAssets.map((asset) => ({ assetId: asset.id, sourceDuration: asset.duration ?? duration })), [], duration, "multicam");
      return switchMulticamAngle(seeded, { assetId: angle.id, sourceDuration: angle.duration ?? duration }, switchTime, duration);
    });
    setMontageEnabled(true);
    setSelectedBaseCutId(null);
    setStatus(`Multicam ${multicamAssets.findIndex((asset) => asset.id === assetId) + 1} · ${angle.name} at ${formatTimecode(switchTime, exportFrameRate)}.`);
  };

  const importCaptionFile = async (file?: File) => {
    if (!file) return;
    try {
      const cues = parseCaptions(await file.text());
      if (!cues.length) throw new Error("No valid timed cues were found.");
      checkpoint();
      setTitles((items) => [...items.filter((item) => !item.id.startsWith("caption-")), ...captionsToTitles(cues)]);
      setStatus(`Imported ${cues.length} timed captions with preview/render parity.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Caption import failed: ${error.message}` : "Caption import failed.");
    }
  };

  const addAudioTrack = () => {
    checkpoint();
    const index = audioTracks.length;
    const track: AudioTrack = {
      id: `audio-track-${crypto.randomUUID()}`,
      name: `A${index + 1} · AUDIO`,
      color: COLORS[(index + 4) % COLORS.length],
      muted: false,
      solo: false,
      locked: false,
      target: false,
      syncLock: true,
      busId: DEFAULT_AUDIO_BUSES[0].id,
      gain: 1,
      pan: 0,
      processing: { ...DEFAULT_AUDIO_EFFECT_RACK },
    };
    setAudioTracks((items) => [...items, track]);
    setSelectedAudioTrackId(track.id);
    setActivePanel("audio");
  };

  const updateAudioTrack = (patch: Partial<AudioTrack>) => {
    if (!selectedAudioTrack) return;
    if (!continuousEditRef.current) checkpoint();
    setAudioTracks((items) => items.map((track) => track.id === selectedAudioTrack.id ? { ...track, ...patch } : track));
  };

  const updateAudioTrackById = (trackId: string, patch: Partial<AudioTrack>) => {
    if (!continuousEditRef.current) checkpoint();
    setAudioTracks((items) => items.map((track) => track.id === trackId ? { ...track, ...patch } : track));
  };

  const moveAudioTrackTo = (trackId: string, targetTrackId: string) => {
    if (trackId === targetTrackId) return;
    const track = audioTracks.find((item) => item.id === trackId);
    const target = audioTracks.find((item) => item.id === targetTrackId);
    if (!track || !target) return;
    if (track.locked || target.locked) { setStatus(`Unlock ${track.locked ? track.name : target.name} before reordering audio tracks.`); return; }
    checkpoint();
    setAudioTracks((items) => moveTimelineTrackTo(items, trackId, targetTrackId));
    setSelectedAudioTrackId(trackId);
    setStatus(`${track.name} moved to ${target.name}'s mixer position.`);
  };

  const removeAudioTrack = (trackId: string) => {
    if (audioTracks.length <= 1) {
      setStatus("A project needs at least one audio track.");
      return;
    }
    const target = audioTracks.find((track) => track.id === trackId);
    if (target?.locked) {
      setStatus("Unlock the audio track before removing it.");
      return;
    }
    const fallback = audioTracks.find((track) => track.id !== trackId);
    if (!fallback) return;
    checkpoint();
    setAudioClips((items) => items.map((clip) => clip.trackId === trackId ? { ...clip, trackId: fallback.id } : clip));
    setAudioTracks((items) => items.filter((track) => track.id !== trackId));
    setSelectedAudioTrackId(fallback.id);
    setSelectedAudioClipId(null);
    setStatus(`${target?.name ?? "Audio track"} removed; its clips moved to ${fallback.name}.`);
  };

  const updateAudioClip = (patch: Partial<AudioClip>) => {
    if (!selectedAudioClip) return;
    if (audioTracks.find((track) => track.id === selectedAudioClip.trackId)?.locked) {
      setStatus("Unlock this audio track before editing its clips.");
      return;
    }
    if (!continuousEditRef.current) checkpoint();
    setAudioClips((items) => items.map((clip) => clip.id === selectedAudioClip.id
      ? patchEditorialAudio(clip, patch, assets.find((asset) => asset.id === clip.assetId)?.duration)
      : clip));
  };

  // Constant-power crossfade between the selected clip and its neighbour on the
  // same track — the Premiere "Constant Power" audio transition.
  const crossfadeSelectedAudio = () => {
    if (!selectedAudioClip) return;
    if (audioTracks.find((track) => track.id === selectedAudioClip.trackId)?.locked) {
      setStatus("Unlock this audio track before crossfading its clips.");
      return;
    }
    const onTrack = audioClips
      .filter((clip) => clip.trackId === selectedAudioClip.trackId)
      .sort((a, b) => a.start - b.start);
    const index = onTrack.findIndex((clip) => clip.id === selectedAudioClip.id);
    const prev = onTrack[index - 1];
    const next = onTrack[index + 1];
    const DURATION = 0.5;
    let pair = prev ? applyAudioCrossfade(prev, selectedAudioClip, DURATION) : null;
    if (!pair && next) pair = applyAudioCrossfade(selectedAudioClip, next, DURATION);
    if (!pair) {
      setStatus("Crossfade needs an adjacent clip with spare handle to overlap.");
      return;
    }
    checkpoint();
    const [left, right] = pair;
    setAudioClips((items) => items.map((clip) => (clip.id === left.id ? left : clip.id === right.id ? right : clip)));
    setStatus("Constant-power crossfade applied.");
  };

  const addAudioAutomationPoint = () => {
    if (!selectedAudioClip) return;
    const localTime = Math.max(0, Math.min(selectedAudioClip.duration, currentTime - selectedAudioClip.start));
    const point = {
      id: `volume-${crypto.randomUUID()}`,
      time: localTime,
      gain: automationGainAt(selectedAudioClip.automation, localTime),
    };
    updateAudioClip({
      automation: [
        ...(selectedAudioClip.automation ?? []).filter((item) => Math.abs(item.time - localTime) > 0.025),
        point,
      ].sort((a, b) => a.time - b.time),
    });
    setSelectedAutomationPointId(point.id);
    setStatus(`Volume keyframe added at ${formatTime(currentTime)}.`);
  };

  const updateAudioAutomationPoint = (patch: Partial<{ time: number; gain: number }>) => {
    if (!selectedAudioClip || !selectedAutomationPointId) return;
    updateAudioClip({
      automation: (selectedAudioClip.automation ?? []).map((point) =>
        point.id === selectedAutomationPointId
          ? {
            ...point,
            time: Math.max(0, Math.min(selectedAudioClip.duration, patch.time ?? point.time)),
            gain: Math.max(0, Math.min(2, patch.gain ?? point.gain)),
          }
          : point).sort((a, b) => a.time - b.time),
    });
  };

  const updateAudioAutomationPointById = (
    clipId: string,
    pointId: string,
    patch: Partial<{ time: number; gain: number }>,
  ) => {
    const clip = audioClips.find((item) => item.id === clipId);
    if (!clip || audioTracks.find((track) => track.id === clip.trackId)?.locked) return;
    setAudioClips((items) => items.map((item) => item.id === clipId
      ? {
        ...item,
        automation: (item.automation ?? []).map((point) => point.id === pointId
          ? {
            ...point,
            time: Math.max(0, Math.min(item.duration, patch.time ?? point.time)),
            gain: Math.max(0, Math.min(2, patch.gain ?? point.gain)),
          }
          : point).sort((a, b) => a.time - b.time),
      }
      : item));
  };

  const removeAudioAutomationPoint = () => {
    if (!selectedAudioClip || !selectedAutomationPointId) return;
    updateAudioClip({
      automation: (selectedAudioClip.automation ?? []).filter((point) => point.id !== selectedAutomationPointId),
    });
    setSelectedAutomationPointId(null);
  };

  const setSelectedAudioClipUnity = () => {
    if (!selectedAudioClip || !selectedAudioTrack) return;
    updateAudioClip({ gain: Math.max(0, Math.min(2, 1 / Math.max(0.01, selectedAudioTrack.gain))), muted: false });
    setStatus("Selected clip set to unity gain after the track fader.");
  };

  const applySelectedAudioFade = () => {
    if (!selectedAudioClip) return;
    updateAudioClip({
      fadeIn: Math.min(0.18, selectedAudioClip.duration / 3),
      fadeOut: Math.min(0.35, selectedAudioClip.duration / 3),
    });
    setStatus("Broadcast-safe fades applied to the selected clip.");
  };

  const duckOtherAudioUnderSelection = () => {
    if (!selectedAudioClip) {
      setStatus("Select a dialogue or hero audio clip before creating a duck.");
      return;
    }
    const duckStart = selectedAudioClip.start;
    const duckEnd = selectedAudioClip.start + selectedAudioClip.duration;
    let changed = 0;
    checkpoint();
    setAudioClips((items) => items.map((clip) => {
      if (clip.id === selectedAudioClip.id || clip.trackId === selectedAudioClip.trackId || audioTracks.find((track) => track.id === clip.trackId)?.locked) return clip;
      const overlapStart = Math.max(clip.start, duckStart);
      const overlapEnd = Math.min(clip.start + clip.duration, duckEnd);
      if (overlapEnd <= overlapStart) return clip;
      changed += 1;
      const localStart = overlapStart - clip.start;
      const localEnd = overlapEnd - clip.start;
      const ramp = Math.min(0.2, Math.max(0.03, (localEnd - localStart) / 4));
      const keep = (clip.automation ?? []).filter((point) => point.time < localStart - ramp || point.time > localEnd + ramp);
      return {
        ...clip,
        automation: [
          ...keep,
          { id: `duck-${crypto.randomUUID()}`, time: Math.max(0, localStart - ramp), gain: 1 },
          { id: `duck-${crypto.randomUUID()}`, time: localStart, gain: 0.32 },
          { id: `duck-${crypto.randomUUID()}`, time: localEnd, gain: 0.32 },
          { id: `duck-${crypto.randomUUID()}`, time: Math.min(clip.duration, localEnd + ramp), gain: 1 },
        ].sort((a, b) => a.time - b.time),
      };
    }));
    setStatus(changed ? `Auto-ducked ${changed} overlapping clip${changed === 1 ? "" : "s"}.` : "No other audio overlaps the selected clip.");
  };

  const dropOnAudioTrack = (event: DragEvent<HTMLDivElement>, trackId: string) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("application/x-scenepilot") || event.dataTransfer.getData("text/plain");
    if (!payload.startsWith("asset:")) return;
    const asset = assets.find((item) => item.id === payload.slice("asset:".length));
    if (!asset || (asset.kind !== "audio" && asset.kind !== "video")) {
      setStatus("Audio tracks accept audio files and the embedded audio from video clips.");
      return;
    }
    const track = audioTracks.find((item) => item.id === trackId);
    if (track?.locked) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawStart = ((event.clientX - bounds.left) / bounds.width) * duration;
    const start = snapTime(rawStart, snapCandidates, 0.1, snapping);
    const clip = createEditorialAudio(asset, trackId, start, `audio-clip-${crypto.randomUUID()}`);
    checkpoint();
    setAudioClips((items) => [...items, clip]);
    setSelectedAudioClipId(clip.id);
    setSelectedAudioTrackId(trackId);
    setActivePanel("audio");
    setStatus(`${asset.name} placed on ${track?.name ?? "audio track"}.`);
  };

  const buildProxy = async (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset || asset.kind !== "video" || asset.proxyState === "building") return;
    const bridge = desktopMediaBridge();
    const sourcePath = bridge?.getPathForFile(asset.file) ?? "";
    const nativeJobId = `proxy-${crypto.randomUUID()}`;
    if (nativeMediaAvailable && bridge && sourcePath) {
      nativeProxyJobsRef.current.set(nativeJobId, assetId);
      nativeProxyJobByAssetRef.current.set(assetId, nativeJobId);
      setAssets((items) => items.map((item) => item.id === assetId ? { ...item, proxyState: "building", proxyProgress: 0 } : item));
      setStatus(`Building a native 720p editing proxy for ${asset.name}…`);
      try {
        const result = await bridge.createProxy({ jobId: nativeJobId, sourcePath, maxWidth: 1280 });
        setAssets((items) => items.map((item) => item.id === assetId
          ? { ...item, proxyUrl: result.url, proxyState: "ready", proxyProgress: 1 }
          : item));
        setStatus(`${result.cached ? "Cached" : "Native"} proxy ready for ${asset.name}. Final exports still use the original.`);
        return;
      } catch (error) {
        const canceled = error instanceof Error && /cancel/i.test(error.message);
        setAssets((items) => items.map((item) => item.id === assetId ? { ...item, proxyState: canceled ? "original" : "failed", proxyProgress: 0 } : item));
        setStatus(canceled ? `Proxy canceled for ${asset.name}.` : error instanceof Error ? `Native proxy failed: ${error.message}` : "Native proxy generation failed.");
        return;
      } finally {
        nativeProxyJobsRef.current.delete(nativeJobId);
        nativeProxyJobByAssetRef.current.delete(assetId);
      }
    }
    setAssets((items) => items.map((item) => item.id === assetId ? { ...item, proxyState: "building", proxyProgress: 0 } : item));
    setStatus(`Building a 720p editing proxy for ${asset.name}…`);
    try {
      const blob = await renderProject({
        mainFile: asset.file,
        assets: [],
        placements: [],
        duration: asset.duration ?? 1,
        maxDimension: 1280,
        frameRate: 24,
        format: "mp4-h264",
        hardwareAcceleration: "prefer-hardware",
        onProgress: (progress) => setAssets((items) => items.map((item) =>
          item.id === assetId ? { ...item, proxyProgress: progress } : item)),
      });
      if (!blob) throw new Error("The proxy encoder returned no media.");
      const proxyFile = new File([blob], `${asset.name.replace(/\.[^/.]+$/, "")}.proxy.mp4`, { type: "video/mp4" });
      const proxyUrl = URL.createObjectURL(proxyFile);
      setAssets((items) => items.map((item) => item.id === assetId
        ? { ...item, proxyFile, proxyUrl, proxyState: "ready", proxyProgress: 1 }
        : item));
      setStatus(`720p proxy ready for ${asset.name}. Final exports still use the original.`);
    } catch (error) {
      setAssets((items) => items.map((item) => item.id === assetId ? { ...item, proxyState: "failed", proxyProgress: 0 } : item));
      setStatus(error instanceof Error ? `Proxy failed: ${error.message}` : "Proxy generation failed.");
    }
  };

  const cancelProxy = async (assetId: string) => {
    const bridge = desktopMediaBridge();
    const jobId = nativeProxyJobByAssetRef.current.get(assetId);
    if (!bridge || !jobId) return;
    const canceled = await bridge.cancelMediaJob(jobId).catch(() => false);
    if (canceled) setStatus("Canceling native proxy job…");
  };

  const addMediaBin = () => {
    const bin: MediaBin = {
      id: `bin-${crypto.randomUUID()}`,
      name: `BIN ${mediaBins.length}`,
      parentId: "bin-root",
    };
    setMediaBins((items) => [...items, bin]);
    setActiveBinId(bin.id);
    setStatus(`${bin.name} created. Use the folder selector on media rows to organize sources.`);
  };

  const moveAssetToBin = (assetId: string, folderId: string) => {
    setAssets((items) => items.map((asset) => asset.id === assetId ? { ...asset, folderId } : asset));
  };

  const beginTimelinePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (timelineTool === "zoom") {
      setTimelineZoom((value) => Math.max(1, Math.min(30, value + (event.shiftKey ? -1 : 1))));
      return;
    }
    if (timelineTool !== "hand" || !timelineScrollRef.current) return;
    handPanRef.current = { x: event.clientX, scrollLeft: timelineScrollRef.current.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveTimelinePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!handPanRef.current || !timelineScrollRef.current) return;
    timelineScrollRef.current.scrollLeft = handPanRef.current.scrollLeft - (event.clientX - handPanRef.current.x);
  };

  const endTimelinePan = () => {
    handPanRef.current = null;
  };

  const timelineScrub = useTimelineScrub({ duration, frameRate: exportFrameRate,
    bounds: (target) => target.closest(".timeline")?.querySelector(".ruler-scrub")?.getBoundingClientRect(),
    onSeek: (time) => seek(time), onStart: () => stopShuttle(),
  });

  // Drag a base cut's right edge to roll the boundary with the next clip (the
  // natural trim for a contiguous montage — reuses the tested rollEdit). Works
  // off a snapshot taken at drag start so the delta stays absolute, not
  // compounding, and frame-snaps the result.
  const trimDragRef = useRef<{ cutId: string; startX: number; original: BaseCut[]; trackWidth: number } | null>(null);
  const beginTrim = (event: React.PointerEvent<HTMLElement>, cutId: string) => {
    if (timelineTool !== "select") return;
    event.stopPropagation();
    event.preventDefault();
    const track = event.currentTarget.closest(".base-drop-zone");
    const width = track?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
    checkpoint();
    trimDragRef.current = { cutId, startX: event.clientX, original: baseCuts, trackWidth: width };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };
  const moveTrim = (event: React.PointerEvent<HTMLElement>) => {
    const drag = trimDragRef.current;
    if (!drag) return;
    const rawDelta = (event.clientX - drag.startX) / drag.trackWidth * duration;
    const delta = snapToFrame(Math.abs(rawDelta), exportFrameRate) * Math.sign(rawDelta);
    setBaseCuts(rollEdit(drag.original, drag.cutId, delta));
  };
  const endTrim = (event: React.PointerEvent<HTMLElement>) => {
    if (!trimDragRef.current) return;
    trimDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const rateStretchDragRef = useRef<{
    cutId: string;
    startX: number;
    original: BaseCut[];
    originalCut: BaseCut;
    trackWidth: number;
    sourceDuration: number;
    lastRate: number;
  } | null>(null);
  const beginRateStretch = (event: React.PointerEvent<HTMLElement>, cut: BaseCut) => {
    if (timelineTool !== "rate") return;
    event.preventDefault();
    event.stopPropagation();
    if (cut.locked) {
      setStatus("Unlock this clip before rate stretching it.");
      return;
    }
    const track = event.currentTarget.closest(".base-drop-zone");
    const trackWidth = track?.getBoundingClientRect().width ?? 0;
    if (trackWidth <= 0) return;
    const sourceDuration = assets.find((asset) => asset.id === cut.assetId)?.duration ?? Number.POSITIVE_INFINITY;
    checkpoint();
    rateStretchDragRef.current = {
      cutId: cut.id,
      startX: event.clientX,
      original: baseCuts,
      originalCut: cut,
      trackWidth,
      sourceDuration,
      lastRate: clipPlaybackRate(cut),
    };
    setSelectedBaseCutId(cut.id);
    setSelectedPlacementId(null);
    setActivePanel("base");
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };
  const moveRateStretch = (event: React.PointerEvent<HTMLElement>) => {
    const drag = rateStretchDragRef.current;
    if (!drag) return;
    const rawDelta = (event.clientX - drag.startX) / drag.trackWidth * duration;
    const requestedDuration = Math.min(
      duration - drag.originalCut.start,
      Math.max(0.05, snapToFrame(drag.originalCut.duration + rawDelta, exportFrameRate)),
    );
    const stretched = rateStretchCut(drag.originalCut, requestedDuration, drag.sourceDuration);
    drag.lastRate = clipPlaybackRate(stretched);
    setBaseCuts(drag.original.map((cut) => cut.id === drag.cutId ? stretched : cut));
    suppressTimelineClickRef.current = true;
  };
  const endRateStretch = (event: React.PointerEvent<HTMLElement>) => {
    const drag = rateStretchDragRef.current;
    if (!drag) return;
    rateStretchDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    setStatus(`Rate stretch complete · ${Math.round(drag.lastRate * 100)}% playback · source frames preserved.`);
  };

  // Slip, slide and roll are direct manipulation tools: drag the selected clip
  // horizontally and the tested edit operation runs against the drag-start
  // snapshot. This keeps long drags stable and frame-exact.
  const beginProfessionalEditDrag = (event: React.PointerEvent<HTMLButtonElement>, cut: BaseCut) => {
    if (timelineTool !== "slip" && timelineTool !== "slide" && timelineTool !== "roll") return;
    const track = event.currentTarget.closest(".base-drop-zone");
    const trackWidth = track?.getBoundingClientRect().width ?? 0;
    if (trackWidth <= 0 || cut.locked) {
      if (cut.locked) setStatus("Unlock this clip before changing its edit.");
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    checkpoint();
    const asset = assets.find((item) => item.id === cut.assetId);
    professionalEditDragRef.current = {
      tool: timelineTool,
      cutId: cut.id,
      startX: event.clientX,
      original: baseCuts,
      trackWidth,
      sourceDuration: asset?.duration ?? Number.POSITIVE_INFINITY,
      lastDelta: 0,
    };
    setSelectedBaseCutId(cut.id);
    setSelectedPlacementId(null);
    setActivePanel("base");
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const moveProfessionalEditDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = professionalEditDragRef.current;
    if (!drag) return;
    const rawDelta = (event.clientX - drag.startX) / drag.trackWidth * duration;
    const delta = snapToFrame(Math.abs(rawDelta), exportFrameRate) * Math.sign(rawDelta);
    drag.lastDelta = delta;
    if (Math.abs(delta) >= 1 / exportFrameRate) suppressTimelineClickRef.current = true;
    if (drag.tool === "slip") {
      setBaseCuts(drag.original.map((item) => item.id === drag.cutId ? slipCut(item, delta, drag.sourceDuration) : item));
    } else if (drag.tool === "slide") {
      setBaseCuts(slideCut(drag.original, drag.cutId, delta));
    } else {
      setBaseCuts(rollEdit(drag.original, drag.cutId, delta));
    }
  };

  const endProfessionalEditDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = professionalEditDragRef.current;
    if (!drag) return;
    professionalEditDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    setStatus(`${drag.tool.toUpperCase()} edit · ${drag.lastDelta >= 0 ? "+" : ""}${drag.lastDelta.toFixed(2)}s · frame exact.`);
  };

  const beginFadeDrag = (event: React.PointerEvent<HTMLElement>, cut: BaseCut, edge: "in" | "out") => {
    if (timelineTool !== "fade" || cut.locked) return;
    const clip = event.currentTarget.closest(".base-cut-block");
    const bounds = clip?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    checkpoint();
    fadeDragRef.current = { cutId: cut.id, edge, clipLeft: bounds.left, clipWidth: bounds.width, clipDuration: cut.duration };
    setSelectedBaseCutId(cut.id);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const moveFadeDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = fadeDragRef.current;
    if (!drag) return;
    const ratio = drag.edge === "in"
      ? (event.clientX - drag.clipLeft) / drag.clipWidth
      : (drag.clipLeft + drag.clipWidth - event.clientX) / drag.clipWidth;
    const seconds = snapToFrame(Math.max(0, Math.min(1, ratio)) * drag.clipDuration, exportFrameRate);
    setBaseCuts((items) => items.map((item) => item.id === drag.cutId ? setClipFade(item, drag.edge, seconds) : item));
    suppressTimelineClickRef.current = true;
  };

  const endFadeDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = fadeDragRef.current;
    if (!drag) return;
    fadeDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    setStatus(`${drag.edge === "in" ? "Fade in" : "Fade out"} adjusted directly on the clip.`);
  };

  const beginTransitionDrag = (event: React.PointerEvent<HTMLElement>, cut: BaseCut, cutIndex: number) => {
    if (timelineTool !== "select" || cutIndex <= 0 || cut.locked) return;
    const block = event.currentTarget.closest(".base-cut-block");
    const bounds = block?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    const previous = baseCuts[cutIndex - 1];
    checkpoint();
    transitionDragRef.current = {
      cutId: cut.id,
      clipLeft: bounds.left,
      clipWidth: bounds.width,
      clipDuration: cut.duration,
      maxDuration: Math.min(2, cut.duration, previous?.duration ?? cut.duration),
    };
    setSelectedBaseCutId(cut.id);
    setSelectedPlacementId(null);
    setActivePanel("base");
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const moveTransitionDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = transitionDragRef.current;
    if (!drag) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - drag.clipLeft) / drag.clipWidth));
    const seconds = Math.max(0.04, Math.min(drag.maxDuration, snapToFrame(ratio * drag.clipDuration, exportFrameRate)));
    setBaseCuts((items) => items.map((item) => item.id === drag.cutId ? { ...item, transitionDuration: seconds } : item));
    suppressTimelineClickRef.current = true;
  };

  const endTransitionDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = transitionDragRef.current;
    if (!drag) return;
    transitionDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    setStatus("Incoming transition duration adjusted directly on the edit.");
  };

  const beginPlacementTrim = (event: React.PointerEvent<HTMLElement>, placement: Placement, edge: "in" | "out") => {
    const track = clipTracks.find((item) => item.id === placement.trackId);
    if (timelineTool !== "select" || track?.locked) return;
    const lane = event.currentTarget.closest(".clip-drop-zone");
    const bounds = lane?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    const composition = placement.compositionId ? compositions.find((item) => item.id === placement.compositionId) : null;
    const asset = assets.find((item) => item.id === placement.assetId);
    checkpoint();
    placementTrimDragRef.current = {
      clipId: placement.id,
      edge,
      trackLeft: bounds.left,
      trackWidth: bounds.width,
      sourceDuration: composition?.duration ?? asset?.duration ?? Number.POSITIVE_INFINITY,
      original: placement,
    };
    setSelectedPlacementId(placement.id);
    setSelectedTrackId(placement.trackId ?? selectedTrackId);
    setActivePanel("clip");
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const movePlacementTrim = (event: React.PointerEvent<HTMLElement>) => {
    const drag = placementTrimDragRef.current;
    if (!drag) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - drag.trackLeft) / drag.trackWidth));
    const time = snapToFrame(ratio * duration, exportFrameRate);
    const next = trimVideoTrackClip(drag.original, drag.edge, time, drag.sourceDuration);
    setPlacements((items) => items.map((item) => item.id === drag.clipId ? next : item).sort((a, b) => a.start - b.start));
    suppressTimelineClickRef.current = true;
  };

  const endPlacementTrim = (event: React.PointerEvent<HTMLElement>) => {
    const drag = placementTrimDragRef.current;
    if (!drag) return;
    placementTrimDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    setStatus(`${drag.edge === "in" ? "In" : "Out"} point trimmed on the stacked video clip.`);
  };

  const beginPlacementFade = (event: React.PointerEvent<HTMLElement>, placement: Placement, edge: "in" | "out") => {
    const track = clipTracks.find((item) => item.id === placement.trackId);
    if (timelineTool !== "fade" || track?.locked) return;
    const block = event.currentTarget.closest(".effect-block");
    const bounds = block?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    checkpoint();
    placementFadeDragRef.current = { clipId: placement.id, edge, clipLeft: bounds.left, clipWidth: bounds.width, clipDuration: placement.duration };
    setSelectedPlacementId(placement.id);
    setSelectedTrackId(placement.trackId ?? selectedTrackId);
    setActivePanel("clip");
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const movePlacementFade = (event: React.PointerEvent<HTMLElement>) => {
    const drag = placementFadeDragRef.current;
    if (!drag) return;
    const ratio = drag.edge === "in"
      ? (event.clientX - drag.clipLeft) / drag.clipWidth
      : (drag.clipLeft + drag.clipWidth - event.clientX) / drag.clipWidth;
    const seconds = snapToFrame(Math.max(0, Math.min(1, ratio)) * drag.clipDuration, exportFrameRate);
    setPlacements((items) => items.map((item) => item.id === drag.clipId ? setVideoClipFade(item, drag.edge, seconds) : item));
    suppressTimelineClickRef.current = true;
  };

  const endPlacementFade = (event: React.PointerEvent<HTMLElement>) => {
    const drag = placementFadeDragRef.current;
    if (!drag) return;
    placementFadeDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    setStatus(`${drag.edge === "in" ? "Fade in" : "Fade out"} adjusted on the stacked video clip.`);
  };

  const applySelectedTransitionToAllCuts = () => {
    if (!selectedBaseCut) return;
    const type = selectedBaseCut.transitionType ?? transitionType;
    const durationValue = selectedCutTransition.duration;
    checkpoint();
    setBaseCuts((items) => items.map((cut, index) => index === 0 ? cut : { ...cut, transitionType: type, transitionDuration: durationValue }));
    setStatus(`${type.toUpperCase()} applied to every edit in the master sequence.`);
  };

  const beginAudioFadeDrag = (event: React.PointerEvent<HTMLElement>, clip: AudioClip, edge: "in" | "out") => {
    const track = audioTracks.find((item) => item.id === clip.trackId);
    if (timelineTool !== "fade" || track?.locked) return;
    const block = event.currentTarget.closest(".audio-clip-block");
    const bounds = block?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    checkpoint();
    audioFadeDragRef.current = { clipId: clip.id, edge, clipLeft: bounds.left, clipWidth: bounds.width, clipDuration: clip.duration };
    setSelectedAudioClipId(clip.id);
    setSelectedAudioTrackId(clip.trackId);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const moveAudioFadeDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = audioFadeDragRef.current;
    if (!drag) return;
    const ratio = drag.edge === "in"
      ? (event.clientX - drag.clipLeft) / drag.clipWidth
      : (drag.clipLeft + drag.clipWidth - event.clientX) / drag.clipWidth;
    const seconds = snapToFrame(Math.max(0, Math.min(1, ratio)) * drag.clipDuration, exportFrameRate);
    setAudioClips((items) => items.map((item) => item.id === drag.clipId ? setClipFade(item, drag.edge, seconds) : item));
  };

  const endAudioFadeDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = audioFadeDragRef.current;
    if (!drag) return;
    audioFadeDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    setStatus(`${drag.edge === "in" ? "Audio fade in" : "Audio fade out"} adjusted directly.`);
  };

  const dropOnBaseTrack = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("application/x-scenepilot") || event.dataTransfer.getData("text/plain");
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawStart = Math.min(duration, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * duration));
    const start = snapTime(rawStart, snapCandidates, 0.1, snapping);
    const editMode = isPro ? timelineEditMode : "overwrite";
    if (payload.startsWith("effect:")) {
      const type = payload.slice("effect:".length) as ClipEffectType;
      const target = baseCuts.find((cut) => start >= cut.start && start < cut.start + cut.duration);
      if (!target || !CLIP_EFFECT_DEFINITIONS[type]) { setStatus("Drop the effect directly over a V1 clip."); return; }
      checkpoint();
      setBaseCuts((items) => items.map((cut) => cut.id === target.id ? { ...cut, effects: [...(cut.effects ?? []), createClipEffect(type)] } : cut));
      setSelectedBaseCutId(target.id); setSelectedBaseCutIds([target.id]); setActivePanel("base");
      setStatus(`${CLIP_EFFECT_DEFINITIONS[type].label} added to the clip at ${formatTime(start)}.`);
      return;
    }
    if (payload.startsWith("basecut:")) {
      const cutId = payload.slice("basecut:".length);
      const cut = baseCuts.find((item) => item.id === cutId);
      if (!cut) return;
      checkpoint();
      const movingIds = effectiveCutSelection(baseCuts, selectedBaseCutIds, cutId);
      const earliest = Math.min(...baseCuts.filter(item => movingIds.has(item.id)).map(item => item.start));
      const nextStart = Math.max(cut.start - earliest, start);
      const moveDelta = nextStart - cut.start;
      if (movingIds.size > 1) {
        const extendedEnd = Math.max(duration, ...baseCuts.filter(item => movingIds.has(item.id)).map(item => item.start + item.duration + moveDelta));
        setBaseCuts((items) => translateSelectedCuts(items, movingIds, moveDelta, extendedEnd));
        if (linkedSelection) setAudioClips((items) => items.map((clip) => clip.linkedVideoId && movingIds.has(clip.linkedVideoId) ? { ...clip, start: Math.max(0, clip.start + moveDelta) } : clip));
        setSelectedBaseCutIds([...movingIds]);
        setSelectedBaseCutId(cutId);
        setSelectedPlacementId(null);
        setActivePanel("base");
        seek(nextStart);
        setStatus(`Moved ${movingIds.size} selected clips as one block to ${formatTime(nextStart)}.`);
        return;
      }
      const section = sections.find((item) => nextStart >= item.start && nextStart < item.end);
      const moved = { ...cut, start: nextStart, sectionId: section?.id ?? cut.sectionId };
      setBaseCuts((items) => placeBaseCut(items, moved, editMode, cutId));
      if (linkedSelection) setAudioClips((items) => items.map((clip) => clip.linkedVideoId === cutId ? { ...clip, start: Math.max(0, clip.start + moveDelta) } : clip));
      setSelectedBaseCutId(cutId);
      setSelectedBaseCutIds([cutId]);
      setSelectedPlacementId(null);
      setActivePanel("base");
      seek(nextStart);
      setStatus(`${editMode.toUpperCase()} edit: moved the V1 clip to ${formatTime(nextStart)}.`);
      return;
    }
    if (!payload.startsWith("asset:")) return;
    const assetId = payload.slice("asset:".length);
    const asset = assets.find((item) => item.id === assetId);
    if (!asset || asset.kind === "audio") return;
    const clipDuration = asset.kind === "image" ? 3 : Math.max(.05, asset.duration ?? 3);
    const section = sections.find((item) => start >= item.start && start < item.end) ?? sections[0];
    const cut: BaseCut = {
      id: `base-cut-${crypto.randomUUID()}`,
      assetId,
      sectionId: section?.id ?? "manual",
      start,
      duration: clipDuration,
      sourceStart: 0,
    };
    checkpoint();
    setBaseCuts((items) => placeBaseCut(items, cut, editMode));
    setMontageEnabled(true);
    setSelectedBaseCutId(cut.id);
    setSelectedBaseCutIds([cut.id]);
    setSelectedPlacementId(null);
    setActivePanel("base");
    seek(start);
    setStatus(`${asset.name} placed with a ${editMode} edit at ${formatTime(start)}.`);
  };

  const addClipTrack = () => {
    checkpoint();
    const index = clipTracks.length;
    const track: ClipTrack = {
      id: `clip-track-${crypto.randomUUID()}`,
      name: `V${index + 2} · VIDEO`,
      color: COLORS[index % COLORS.length],
      enabled: true,
      locked: false,
      blend: "normal",
      opacity: 100,
      hue: 0,
      saturation: 100,
      brightness: 100,
      glow: 0,
      fadeIn: 0.05,
      fadeOut: 0.12,
    };
    setClipTracks((items) => [...items, track]);
    setSelectedTrackId(track.id);
    setSelectedPlacementId(null);
    setActivePanel("track");
    setStatus(`${track.name} added. Drag media or existing clips onto it.`);
  };

  const updateClipTrack = (patch: Partial<ClipTrack>) => {
    if (!selectedTrack) return;
    if (!continuousEditRef.current) checkpoint();
    setClipTracks((items) => items.map((track) => track.id === selectedTrack.id ? { ...track, ...patch } : track));
  };

  const moveClipTrack = (direction: "up" | "down") => {
    if (!selectedTrack) return;
    const index = clipTracks.findIndex((track) => track.id === selectedTrack.id);
    const target = direction === "up" ? index + 1 : index - 1;
    if (index < 0 || target < 0 || target >= clipTracks.length) return;
    if (selectedTrack.locked || clipTracks[target].locked) { setStatus(`Unlock ${selectedTrack.locked ? selectedTrack.name : clipTracks[target].name} before changing the video stack.`); return; }
    checkpoint();
    setClipTracks((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setStatus(`${selectedTrack.name} moved ${direction} in the video stack.`);
  };

  const moveClipTrackTo = (trackId: string, targetTrackId: string) => {
    if (trackId === targetTrackId) return;
    const track = clipTracks.find((item) => item.id === trackId);
    const target = clipTracks.find((item) => item.id === targetTrackId);
    if (!track || !target) return;
    if (track.locked || target.locked) { setStatus(`Unlock ${track.locked ? track.name : target.name} before changing the video stack.`); return; }
    checkpoint();
    setClipTracks((items) => moveTimelineTrackTo(items, trackId, targetTrackId));
    setSelectedTrackId(trackId);
    setSelectedPlacementId(null);
    setActivePanel("track");
    setStatus(`${track.name} moved to ${target.name}'s stack position.`);
  };

  const { openComposition, createComposition, finishCreateComposition, beginCompositionFromSource, dropCompositionSource, openMainSequence, newCompositionDraft, closeCompositionDialog } = useCompositionDocuments({
    isPro, analyzing, rendering, compositions, assets, duration, sourceDims, exportMaxDimension, aspect, customSize, exportFrameRate,
    workspaceView, activeCompositionId, compositionTime, selectedCompLayerId, selectedCompTrackId, setCompositions, setActiveCompositionId,
    setSelectedCompLayerId, setSelectedCompTrackId, setSelectedKeyframeId, setCompositionTime, setProjectPanelTab, setWorkspaceView, setEditorMode,
    setPlaying, setStatus, checkpoint, addAssets,
  });

  const updateComposition = (patch: Partial<StudioComposition>) => {
    if (!activeComposition) return;
    const error = validateCompositionSettings({ ...activeComposition, ...patch });
    if (error) { setStatus(error); return; }
    if (!continuousEditRef.current) checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? { ...composition, ...patch } : composition));
    if (patch.duration !== undefined) seekComposition(Math.min(compositionTime, patch.duration));
  };

  const addCompositionLayer = (kind: CompositionLayer["kind"]) => {
    if (!activeComposition) return;
    const normalized = normalizeComposition(activeComposition);
    const selectedTrack = normalized.tracks?.find(track => track.id === selectedCompTrackId);
    const targetKind = kind === "media" ? selectedTrack?.kind ?? "video" : "video";
    const compatibleMedia = assets.filter(asset => targetKind === "audio" ? asset.kind !== "image" : asset.kind !== "audio");
    if (kind === "media" && !compatibleMedia.length) {
      setStatus("Import media into the project before adding a media layer.");
      assetInputRef.current?.click();
      return;
    }
    const childComposition = kind === "composition"
      ? compositions.find((composition) =>
        composition.id !== activeComposition.id
        && !hasCompositionCycle(compositions, activeComposition.id, composition.id))
      : undefined;
    if (kind === "composition" && !childComposition) {
      setStatus("Create another composition first. ScenePilot blocks circular precomposition dependencies.");
      return;
    }
    if (selectedTrack?.kind === targetKind && selectedTrack.locked) { setStatus(`Unlock ${selectedTrack.name} before adding a layer.`); return; }
    const targetTrack = selectedTrack?.kind === targetKind ? selectedTrack : [...(normalized.tracks ?? [])].reverse().find(track => track.kind === targetKind && !track.locked);
    if (!targetTrack) { setStatus(`Create or unlock a ${targetKind} track before adding a layer.`); return; }
    checkpoint();
    const id = `layer-${crypto.randomUUID()}`;
    const layer: CompositionLayer = {
      id,
      name: kind === "text"
        ? "NEW TEXT"
        : kind === "media"
          ? compatibleMedia[0]?.name.toUpperCase() ?? "MEDIA LAYER"
          : kind === "null"
            ? "NULL CONTROL"
            : kind === "adjustment"
              ? "ADJUSTMENT LAYER"
              : kind === "composition"
                ? childComposition?.name ?? "PRECOMPOSITION"
                : kind === "particle"
                  ? "PARTICLE EMITTER"
                  : "SHAPE LAYER",
      kind,
      assetId: kind === "media" ? compatibleMedia[0]?.id : undefined,
      compositionId: kind === "composition" ? childComposition?.id : undefined,
      trackId: targetTrack.id,
      start: compositionTime,
      duration: Math.max(.05, Math.min(activeComposition.duration - compositionTime, kind === "media" && compatibleMedia[0]?.kind !== "image" ? compatibleMedia[0]?.duration ?? Infinity : Infinity)),
      sourceStart: 0,
      playbackRate: 1,
      text: kind === "text" ? "YOUR TITLE" : "",
      textAnimator: kind === "text" ? "cascade" : undefined,
      shape: kind === "shape" ? "ellipse" : "rectangle",
      shapeOptions: kind === "shape" ? { trimStart: 0, trimEnd: 100 } : undefined,
      particle: kind === "particle" ? { rate: 36, lifetime: 1.8, speed: 22, spread: 70, gravity: 18, size: 1.8, randomness: .5 } : undefined,
      color: kind === "text" ? "#f3f5f1" : kind === "media" ? "#ffffff" : COLORS[compositions.length % COLORS.length],
      x: 50,
      y: 50,
      width: kind === "text" ? 78 : kind === "media" || kind === "composition" || kind === "adjustment" ? 100 : kind === "particle" ? 65 : kind === "null" ? 8 : 22,
      height: kind === "text" ? 16 : kind === "media" || kind === "composition" || kind === "adjustment" ? 100 : kind === "particle" ? 65 : kind === "null" ? 8 : 38,
      scale: 100,
      rotation: 0,
      opacity: 100,
      enabled: true,
      blend: kind === "text" || kind === "media" || kind === "composition" ? "normal" : "screen",
      effect: kind === "shape" || kind === "particle" ? "glow" : kind === "adjustment" ? "blur" : "none",
      effects: kind === "adjustment" ? [createClipEffect("blur")] : undefined,
      animation: "none",
      motionBlur: false,
      mask: { enabled: false, shape: "rectangle", feather: 0, expansion: 0, inverted: false, x: 50, y: 50, width: 100, height: 100, rotation: 0 },
      keyframes: [],
    };
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? { ...composition, layers: [...composition.layers, layer] }
      : composition));
    setSelectedCompLayerId(id);
    setSelectedCompTrackId(targetTrack.id);
    setSelectedKeyframeId(null);
    setStatus(`${layer.name} added to ${activeComposition.name}.`);
  };

  const addCompositionTrack = (kind: CompositionTrack["kind"]) => {
    if (!activeComposition) return;
    const normalized = normalizeComposition(activeComposition);
    const count = (normalized.tracks ?? []).filter((track) => track.kind === kind).length + 1;
    const track: CompositionTrack = {
      id: `${activeComposition.id}-${kind}-track-${crypto.randomUUID()}`,
      name: `${kind === "video" ? "V" : "A"}${count} · ${kind === "video" ? "VIDEO" : "AUDIO"}`,
      kind,
      enabled: true,
      locked: false,
      muted: false,
      solo: false,
    };
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? { ...normalizeComposition(composition), tracks: [...(normalizeComposition(composition).tracks ?? []), track] }
      : composition));
    setSelectedCompTrackId(track.id);
    setSelectedCompLayerId("");
    setSelectedKeyframeId(null);
    setStatus(`${track.name} added at the top of ${activeComposition.name}. Drop project media onto it.`);
  };

  const updateCompositionTrack = (trackId: string, patch: Partial<CompositionTrack>) => {
    if (!activeComposition) return;
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? { ...normalizeComposition(composition), tracks: normalizeComposition(composition).tracks?.map((track) => track.id === trackId ? { ...track, ...patch } : track) }
      : composition));
  };

  const moveCompositionTrack = (trackId: string, direction: "up" | "down") => {
    if (!activeComposition) return;
    const normalized = normalizeComposition(activeComposition);
    const track = normalized.tracks?.find((item) => item.id === trackId);
    if (!track || track.locked) { if (track?.locked) setStatus(`Unlock ${track.name} before reordering it.`); return; }
    const next = reorderCompositionTrack(normalized.tracks ?? [], trackId, direction);
    if (next === normalized.tracks) return;
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? { ...normalized, tracks: next } : composition));
    setStatus(`${track.name} moved ${direction}. ${direction === "up" ? "It now composites above more tracks." : "Tracks above it now composite over it."}`);
  };

  const moveCompositionTrackTo = (trackId: string, targetTrackId: string) => {
    if (!activeComposition || trackId === targetTrackId) return;
    const normalized = normalizeComposition(activeComposition);
    const track = normalized.tracks?.find((item) => item.id === trackId);
    const target = normalized.tracks?.find((item) => item.id === targetTrackId);
    if (!track || !target) return;
    if (track.locked || target.locked) {
      setStatus(`Unlock ${track.locked ? track.name : target.name} before changing the track stack.`);
      return;
    }
    const next = reorderCompositionTrackTo(normalized.tracks ?? [], trackId, targetTrackId);
    if (next === normalized.tracks) return;
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? { ...normalized, tracks: next } : composition));
    setSelectedCompTrackId(trackId);
    setStatus(`${track.name} moved to ${target.name}'s stack position.`);
  };

  const removeCompositionTrack = (trackId: string) => {
    if (!activeComposition) return;
    const normalized = normalizeComposition(activeComposition);
    const track = normalized.tracks?.find((item) => item.id === trackId);
    if (!track || track.locked) { if (track?.locked) setStatus(`Unlock ${track.name} before removing it.`); return; }
    const removedIds = new Set(normalized.layers.filter((layer) => layer.trackId === trackId).map((layer) => layer.id));
    const layers = normalized.layers.filter((layer) => !removedIds.has(layer.id)).map((layer) => ({
      ...layer,
      parentId: layer.parentId && removedIds.has(layer.parentId) ? undefined : layer.parentId,
      matteLayerId: layer.matteLayerId && removedIds.has(layer.matteLayerId) ? undefined : layer.matteLayerId,
      trackMatte: layer.trackMatte && removedIds.has(layer.trackMatte.layerId) ? undefined : layer.trackMatte,
    }));
    const tracks = (normalized.tracks ?? []).filter((item) => item.id !== trackId);
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? { ...normalized, tracks, layers } : composition));
    setSelectedCompTrackId(tracks.at(-1)?.id ?? "");
    if (removedIds.has(selectedCompLayerId)) setSelectedCompLayerId("");
    setSelectedKeyframeId(null);
    setStatus(`${track.name} and ${removedIds.size} clip${removedIds.size === 1 ? "" : "s"} removed.`);
  };

  const importIntoComposition = async (files: File[], time: number, trackId?: string) => {
    if (!activeComposition || rendering || analyzing || compositionImportPendingRef.current) return;
    compositionImportPendingRef.current = true;
    const compositionId = activeComposition.id;
    try {
      const incoming = await addAssets(files);
      if (!incoming?.length) { setStatus("No supported media was imported. Drop a video, image or audio file."); return; }
      const sources = incoming.map(asset => ({ ...asset, layerId: `layer-${crypto.randomUUID()}` }));
      const current = latestCompositionsRef.current.find(item => item.id === compositionId);
      if (!current || placeImportedCompositionMedia(current, sources, time, trackId) === current) {
        setStatus("Files are in Project Media. No compatible unlocked destination remains in this composition.");
        return;
      }
      latestCheckpointRef.current();
      setCompositions(items => items.map(composition => composition.id === compositionId ? placeImportedCompositionMedia(normalizeComposition(composition), sources, time, trackId) : composition));
      setStatus(`Media imported for ${activeComposition.name}. Compatible files are placed on unlocked tracks; all files remain in Project Media.`);
    } catch (error) { setStatus(`Could not import media: ${error instanceof Error ? error.message : String(error)}`); }
    finally { compositionImportPendingRef.current = false; }
  };

  const dropOnCompositionTrack = (event: DragEvent<HTMLDivElement>, trackId: string, at?: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (!activeComposition) return;
    const normalized = normalizeComposition(activeComposition);
    const track = normalized.tracks?.find((item) => item.id === trackId);
    const payload = event.dataTransfer.getData("application/x-scenepilot") || event.dataTransfer.getData("text/plain");
    if (!track) return;
    if (track.locked) { setStatus(`Unlock ${track.name} before placing clips on it.`); return; }
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawStart = Math.max(0, Math.min(activeComposition.duration - .05, at ?? ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * activeComposition.duration));
    const compositionSnapCandidates = [0, activeComposition.duration, ...normalized.layers.flatMap((layer) => [layer.start ?? 0, (layer.start ?? 0) + (layer.duration ?? activeComposition.duration)])];
    const start = snapToFrame(snapTime(rawStart, compositionSnapCandidates, .1, snapping), exportFrameRate);

    if (event.dataTransfer.files.length) { void importIntoComposition(Array.from(event.dataTransfer.files), start, trackId); return; }

    if (payload.startsWith("composition-layer:")) {
      const layerId = payload.slice("composition-layer:".length);
      const layer = normalized.layers.find((item) => item.id === layerId);
      const sourceTrack = normalized.tracks?.find((item) => item.id === layer?.trackId);
      const layerAsset = layer?.assetId ? assets.find((item) => item.id === layer.assetId) : undefined;
      if (!layer) return;
      if (layer.locked || sourceTrack?.locked) { setStatus(`Unlock ${layer.name} before moving it.`); return; }
      if (track.kind === "audio" && (layer.kind !== "media" || layerAsset?.kind === "image")) { setStatus("Only audio or video media can move onto an audio track."); return; }
      if (track.kind === "video" && layer.kind === "media" && layerAsset?.kind === "audio") { setStatus("Audio files belong on an audio track."); return; }
      checkpoint();
      const moved = repositionCompositionLayer(normalized, layerId, trackId, start);
      setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? moved : composition));
      setSelectedCompTrackId(trackId);
      setSelectedCompLayerId(layerId);
      setSelectedKeyframeId(null);
      setCompositionTime(moved.layers.find((item) => item.id === layerId)?.start ?? start);
      setStatus(`${layer.name} moved to ${track.name} at ${(moved.layers.find((item) => item.id === layerId)?.start ?? start).toFixed(2)}s.`);
      return;
    }

    const nestedCompositionId = payload.startsWith("composition:") ? payload.slice("composition:".length) : undefined;
    const nestedComposition = nestedCompositionId ? compositions.find((item) => item.id === nestedCompositionId) : undefined;
    const asset = payload.startsWith("asset:") ? assets.find((item) => item.id === payload.slice(6)) : undefined;
    if (!asset && !nestedComposition) return;
    if (nestedComposition) {
      if (track.kind !== "video") { setStatus("Compositions belong on a video track."); return; }
      if (hasCompositionCycle(compositions, activeComposition.id, nestedComposition.id)) { setStatus("That precomposition would create a circular dependency."); return; }
    }
    if (asset && track.kind === "video" && asset.kind === "audio") { setStatus("Audio files belong on an audio track."); return; }
    if (asset && track.kind === "audio" && asset.kind === "image") { setStatus("Still images belong on a video track."); return; }
    const id = `layer-${crypto.randomUUID()}`;
    const sourceDuration = nestedComposition?.duration ?? asset?.duration ?? activeComposition.duration;
    const layerName = nestedComposition?.name ?? (track.kind === "audio" && asset?.kind === "video" ? `${asset.name} · EMBEDDED AUDIO` : asset?.name.toUpperCase()) ?? "MEDIA";
    const layer: CompositionLayer = {
      id, trackId, name: layerName, kind: nestedComposition ? "composition" : "media", assetId: asset?.id, compositionId: nestedComposition?.id,
      start, duration: Math.max(.05, Math.min(sourceDuration, activeComposition.duration - start)), sourceStart: 0, playbackRate: 1,
      text: "", shape: "rectangle", color: "#ffffff", x: 50, y: 50, width: 100, height: 100, scale: 100, rotation: 0, opacity: 100,
      enabled: true, locked: false, blend: "normal", effect: "none", animation: "none", motionBlur: false,
      mask: { enabled: false, shape: "rectangle", feather: 0, expansion: 0, inverted: false, x: 50, y: 50, width: 100, height: 100, rotation: 0 }, keyframes: [],
    };
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? { ...normalized, layers: [...normalized.layers, layer] } : composition));
    setSelectedCompTrackId(trackId);
    setSelectedCompLayerId(id);
    setSelectedKeyframeId(null);
    setStatus(`${nestedComposition?.name ?? asset?.name} placed on ${track.name} at ${start.toFixed(2)}s.`);
  };

  const updateCompositionLayer = (patch: Partial<CompositionLayer>) => {
    if (!activeComposition || !selectedCompLayer) return;
    const selectedLayerTrack = compositionTrackForLayer(activeComposition, selectedCompLayer);
    if ((selectedCompLayer.locked || selectedLayerTrack?.locked) && !("locked" in patch) && !("enabled" in patch)) {
      setStatus(`${selectedCompLayer.name} is locked. Unlock it before editing.`);
      return;
    }
    if (!continuousEditRef.current) checkpoint();
    const transformPatch = patch as Partial<Pick<CompositionLayer, "x" | "y" | "scale" | "rotation" | "opacity">>;
    const hasTransform = ["x", "y", "scale", "rotation", "opacity"].some((key) => key in patch);
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? {
        ...composition,
        layers: composition.layers.map((layer) => {
          if (layer.id !== selectedCompLayer.id) return layer;
          if (selectedKeyframeId && hasTransform) {
            return {
              ...layer,
              keyframes: layer.keyframes.map((keyframe) => keyframe.id === selectedKeyframeId ? { ...keyframe, ...transformPatch } : keyframe),
            };
          }
          return { ...layer, ...patch };
        }),
      }
      : composition));
  };

  const writeLayerRoto = (compositionId: string, layerId: string, roto: RotoMask) => {
    setCompositions((items) => items.map((composition) => composition.id === compositionId
      ? { ...composition, layers: composition.layers.map((layer) => layer.id === layerId ? { ...layer, roto } : layer) }
      : composition));
  };

  const solveTargetedRoto = async (
    frame: ImageData,
    prompts: RotoPrompt[],
    movingSeed: RotoPoint,
    pointCount: number,
    target: RotoTarget,
    options: { detail?: number; decontaminate?: number; tolerance?: number; edgeSensitivity?: number; memoryMatte?: RotoAlphaMatte; sessionId?: string; resetMemory?: boolean; memoryAnchor?: boolean; frameIndex?: number; refineAlpha?: boolean },
  ) => {
    const { guidedObjectMatte, semanticObjectMatte, semanticObjectSegmenterStatus, semanticSegmenterStatus, semanticSubjectMatte, semanticSubjectMatteFromAlpha } = await import("../lib/semantic-segmenter");
    let personFailure: unknown;
    const bridge = desktopMediaBridge();
    if (isPro && nativeCapabilities?.mlAcceleration?.native && bridge?.segmentRotoFrame) {
      try {
        const rgba = new Uint8Array(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
        const nativePrompts = prompts.flatMap((prompt) => prompt.stroke?.length
          ? prompt.stroke.map((point) => ({ ...point, kind: prompt.kind, detail: prompt.detail, radius: prompt.radius, strength: prompt.strength }))
          : [{ x: prompt.x, y: prompt.y, kind: prompt.kind, detail: prompt.detail, radius: prompt.radius, strength: prompt.strength }]).slice(-96);
        const memoryAlpha = options.memoryMatte?.width === frame.width && options.memoryMatte.height === frame.height
          ? new Uint8Array(decodeRotoAlphaMatte(options.memoryMatte))
          : undefined;
        const result = await bridge.segmentRotoFrame({
          width: frame.width, height: frame.height, rgba, target, prompts: nativePrompts, memoryAlpha,
          sessionId: options.sessionId, resetMemory: options.resetMemory, memoryAnchor: options.memoryAnchor, frameIndex: options.frameIndex,
          refineAlpha: options.refineAlpha ?? true,
        });
        const solved = semanticSubjectMatteFromAlpha(frame, result.alpha, result.width, result.height, prompts, movingSeed, pointCount, options);
        if (solved.contour.length) {
          setRotoBackend("native");
          return { ...solved, engine: target === "object" ? "interactive-ml" as const : "semantic-ml" as const, nativeAlphaRefined: result.alphaRefined, nativeMemoryAttention: result.memoryAttention };
        }
      } catch (error) { personFailure = error; }
    }
    if (target !== "object") {
      try {
        const solved = await semanticSubjectMatte(frame, prompts, movingSeed, pointCount, options);
        personFailure = undefined;
        if (solved.contour.length) {
          setRotoBackend(semanticSegmenterStatus().delegate);
          return { ...solved, engine: "semantic-ml" as const };
        }
      } catch (error) { personFailure = error; }
      if (target === "person") throw new Error(personFailure ? "Person segmentation is unavailable on this frame." : "No person was found close to that point. Click directly on the performer or choose Object.");
    }
    try {
      const solved = await semanticObjectMatte(frame, prompts, movingSeed, pointCount, options);
      if (solved.contour.length) {
        setRotoBackend(semanticObjectSegmenterStatus().delegate);
        return { ...solved, engine: "interactive-ml" as const };
      }
    } catch {
      // MagicTouch downloads lazily and can be unavailable offline. The local,
      // deterministic guided-object solver keeps the edit usable in that case.
    }
    const solved = guidedObjectMatte(frame, prompts, movingSeed, pointCount, options);
    if (!solved.contour.length) throw new Error("No stable object boundary was found. Add a foreground guide on the object and a background guide beside it.");
    return { ...solved, engine: "guided-object" as const };
  };

  const solveRotoStroke = async (stroke: RotoPoint[]) => {
    if (!capabilities.rotoscoping || rotoMode === "off" || !activeComposition || !selectedCompLayer || selectedCompLayer.kind !== "media" || !selectedCompLayer.assetId) return;
    const asset = assets.find((item) => item.id === selectedCompLayer.assetId);
    if (!asset || asset.kind === "audio" || !stroke.length) return;
    const persistedStroke = simplifyRotoStroke(stroke, .0015, 128);
    const point = persistedStroke[Math.floor(persistedStroke.length / 2)];
    const currentMask: RotoMask = selectedCompLayer.roto ?? {
      subjectId: `subject-${crypto.randomUUID()}`,
      subjectName: `Subject ${1 + activeComposition.layers.filter((layer) => layer.roto).length}`,
      enabled: true, inverted: false, feather: 3, expansion: 0, edgeDetail: .72, decontaminate: .35, edgeColorCleanup: .3, motionBlur: 0, motionBlurSamples: 5, target: rotoTarget, prompts: [], keyframes: [],
    };
    const workingMask: RotoMask = rotoMode === "select" ? { ...currentMask, prompts: [], keyframes: [], memory: undefined } : currentMask;
    const target = workingMask.target ?? rotoTarget;
    const prompt: RotoPrompt = {
      ...point,
      kind: rotoMode === "subtract" ? "background" : "foreground",
      detail: rotoMode === "hair" ? "hair" : rotoMode === "solid" ? "solid" : undefined,
      radius: rotoBrushSize,
      strength: rotoBrushStrength,
      stroke: persistedStroke.length > 1 ? persistedStroke : undefined,
    };
    const prompts = rotoMode === "select" ? [prompt] : [...(workingMask.prompts ?? []), prompt].slice(-24);
    const selectionSeed = prompts.find((item) => item.kind === "foreground") ?? point;
    try {
      setStatus(rotoMode === "select" ? "Analyzing the painted subject guide…" : `Re-solving the matte with a ${prompt.detail ?? prompt.kind} brush…`);
      const profile = rotoTrackingProfile(rotoQuality, exportFrameRate);
      const solvePass = async (frameWidth: number, refineAlpha: boolean) => {
        let nextPath = rotoPathAt(workingMask, compositionTime);
        let nextMatte: RotoAlphaMatte | undefined = rotoAlphaAt(workingMask, compositionTime);
        let nextMemory = workingMask.memory;
        const solveState: { engine: "semantic-ml" | "interactive-ml" | "guided-object" } = { engine: "guided-object" };
        await captureRotoFrames({ url: asset.url, kind: asset.kind === "image" ? "image" : "video", duration: asset.duration }, [compositionTime], frameWidth, async (frame) => {
          const solved = await solveTargetedRoto(frame, prompts, selectionSeed, profile.pointCount, target, {
            detail: workingMask.edgeDetail, decontaminate: workingMask.decontaminate, tolerance: rotoTolerance, edgeSensitivity: rotoEdgeSensitivity,
            sessionId: workingMask.subjectId, resetMemory: true, memoryAnchor: true, frameIndex: Math.round(compositionTime * exportFrameRate), refineAlpha,
          });
          if (solved.contour.length) {
            nextPath = nextPath?.length ? alignRotoPath(nextPath, solved.contour) : solved.contour;
            nextMatte = "nativeAlphaRefined" in solved && solved.nativeAlphaRefined
              ? solved.matte
              : refineRotoAlphaWithTrimap(frame, solved.matte, { detail: workingMask.edgeDetail, decontaminate: workingMask.decontaminate }).matte;
            nextMemory = rememberRotoSubject(nextMemory, workingMask.subjectId ?? "subject", frame, nextMatte, compositionTime, 1, "manual");
            solveState.engine = solved.engine;
          }
        });
        if (!nextPath?.length) throw new Error("No stable subject boundary was found at that point.");
        return { nextPath, nextMatte, nextMemory, engine: solveState.engine };
      };
      const makeMask = (result: Awaited<ReturnType<typeof solvePass>>) => {
        const keyframe: RotoMaskKeyframe = { id: `roto-${crypto.randomUUID()}`, time: compositionTime, points: result.nextPath, matte: result.nextMatte, confidence: 1, source: "manual" };
        let nextMask = upsertRotoKeyframe({ ...workingMask, enabled: true, target, engine: result.engine, prompts, memory: result.nextMemory, bake: rotoMode === "select" ? undefined : workingMask.bake }, keyframe);
        if (rotoMode !== "select" && nextMask.bake) {
          const window = rotoCorrectionWindow(nextMask.keyframes, compositionTime, activeComposition.duration);
          nextMask = { ...nextMask, bake: invalidateRotoBake(nextMask.bake, window.start, window.end, activeComposition.duration, "manual correction") };
        }
        return nextMask;
      };
      const progressiveNativeSolve = isPro && Boolean(nativeCapabilities?.mlAcceleration?.native) && rotoQuality !== "draft";
      const draft = await solvePass(progressiveNativeSolve ? Math.min(256, profile.frameWidth) : profile.frameWidth, !progressiveNativeSolve);
      checkpoint();
      writeLayerRoto(activeComposition.id, selectedCompLayer.id, makeMask(draft));
      let final = draft;
      if (progressiveNativeSolve) {
        setStatus("Fast subject matte ready · refining hair and edges at full quality…");
        try {
          final = await solvePass(profile.frameWidth, true);
          writeLayerRoto(activeComposition.id, selectedCompLayer.id, makeMask(final));
        } catch {
          setRotoMode("off");
          setStatus("Fast subject matte retained. High-quality refinement could not finish; retry the brush when ready.");
          return;
        }
      }
      setRotoMode("off");
      setStatus(`${final.engine === "semantic-ml" ? "Semantic person" : final.engine === "interactive-ml" ? "Promptable object ML" : "Guided object"} matte solved${progressiveNativeSolve ? " and edge-refined" : ""} from ${prompts.filter((item) => item.kind === "foreground").length} foreground and ${prompts.filter((item) => item.kind === "background").length} background guides.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The subject could not be selected.");
    }
  };

  const rotoPointerPoint = (event: React.PointerEvent<HTMLButtonElement>) => {
    const stage = compositionStageRef.current;
    if (!stage || !selectedCompLayer) return null;
    const bounds = stage.getBoundingClientRect();
    return {
      layer: layerPointFromStage(bounds, event.clientX, event.clientY, {
        x: selectedLayerTransform?.x ?? selectedCompLayer.x,
        y: selectedLayerTransform?.y ?? selectedCompLayer.y,
        width: selectedCompLayer.width,
        height: selectedCompLayer.height,
        scale: selectedLayerTransform?.scale ?? selectedCompLayer.scale,
        rotation: selectedLayerTransform?.rotation ?? selectedCompLayer.rotation,
      }),
      stage: { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width))), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height))) },
    };
  };

  const beginRotoStroke = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation();
    const point = rotoPointerPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    rotoStrokeRef.current = { pointerId: event.pointerId, layer: [point.layer], stage: [point.stage] };
    setRotoStrokePreview([point.stage]);
  };

  const extendRotoStroke = (event: React.PointerEvent<HTMLButtonElement>) => {
    const draft = rotoStrokeRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = rotoPointerPoint(event);
    const previous = draft.stage.at(-1);
    if (!point || !previous || Math.hypot(point.stage.x - previous.x, point.stage.y - previous.y) < .0025) return;
    draft.layer.push(point.layer); draft.stage.push(point.stage);
    setRotoStrokePreview([...draft.stage]);
  };

  const finishRotoStroke = (event: React.PointerEvent<HTMLButtonElement>) => {
    extendRotoStroke(event);
    const draft = rotoStrokeRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rotoStrokeRef.current = null; setRotoStrokePreview([]);
    void solveRotoStroke(draft.layer);
  };

  const cancelRotoStroke = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (rotoStrokeRef.current?.pointerId !== event.pointerId) return;
    rotoStrokeRef.current = null; setRotoStrokePreview([]);
  };

  const trackRotoSubject = async (direction: "forward" | "backward" | "all" | "correction" | "resume") => {
    if (!capabilities.rotoscoping || !activeComposition || !selectedCompLayer || selectedCompLayer.kind !== "media" || !selectedCompLayer.assetId) return;
    const { guidedObjectMatte } = await import("../lib/semantic-segmenter");
    const asset = assets.find((item) => item.id === selectedCompLayer.assetId);
    let initialPath = rotoPathAt(selectedCompLayer.roto, compositionTime);
    if (!asset || asset.kind === "audio" || !initialPath?.length || !selectedCompLayer.roto) {
      setStatus("Select the subject on one frame before starting propagation.");
      return;
    }
    rotoAbortRef.current?.abort();
    const controller = new AbortController();
    rotoAbortRef.current = controller;
    const profile = rotoTrackingProfile(rotoQuality, exportFrameRate);
    const frameStep = 1 / profile.framesPerSecond;
    const frameWidth = profile.frameWidth;
    const mediaEnd = Math.max(compositionTime, Math.min(activeComposition.duration, asset.duration ?? activeComposition.duration));
    const correctionWindow = rotoCorrectionWindow(selectedCompLayer.roto.keyframes, compositionTime, mediaEnd);
    const rangeStart = direction === "correction" ? correctionWindow.start : direction === "resume" ? selectedCompLayer.roto.bake?.rangeStart ?? 0 : direction === "forward" ? compositionTime : 0;
    const rangeEnd = direction === "correction" ? correctionWindow.end : direction === "resume" ? Math.min(mediaEnd, selectedCompLayer.roto.bake?.rangeEnd ?? mediaEnd) : direction === "backward" ? compositionTime : mediaEnd;
    const trackingOrigin = Math.max(rangeStart, Math.min(rangeEnd, compositionTime));
    initialPath = rotoPathAt(selectedCompLayer.roto, trackingOrigin) ?? initialPath;
    const times = (start: number, finish: number, step: number) => {
      const result = [start];
      if (step > 0) for (let time = start + step; time < finish - step / 2; time += step) result.push(time);
      else for (let time = start + step; time > finish - step / 2; time += step) result.push(time);
      if (Math.abs(result[result.length - 1] - finish) > .001) result.push(finish);
      const low = Math.min(start, finish);
      const high = Math.max(start, finish);
      for (const correction of selectedCompLayer.roto?.keyframes ?? []) {
        if (correction.source === "manual" && correction.time > low + 1 / 240 && correction.time < high - 1 / 240 && !result.some((time) => Math.abs(time - correction.time) <= 1 / 240)) result.push(correction.time);
      }
      return result.sort((left, right) => step > 0 ? left - right : right - left);
    };
    const passes: Array<{ label: string; values: number[] }> = [];
    if (direction === "forward" || direction === "all" || direction === "correction" || direction === "resume") passes.push({ label: direction === "correction" ? "correction forward" : "forward", values: times(trackingOrigin, rangeEnd, frameStep) });
    if (direction === "backward" || direction === "all" || direction === "correction" || direction === "resume") passes.push({ label: direction === "correction" ? "correction backward" : "backward", values: times(trackingOrigin, rangeStart, -frameStep) });
    const total = passes.reduce((sum, pass) => sum + Math.max(0, pass.values.length - 1), 0);
    let completed = 0;
    let generated = [...selectedCompLayer.roto.keyframes];
    let memory = selectedCompLayer.roto.memory;
    const bakeKey = rotoBakeCacheKey({
      assetId: asset.id, sourceSize: asset.file.size, sourceModified: asset.file.lastModified,
      subjectId: selectedCompLayer.roto.subjectId ?? selectedCompLayer.id,
      target: selectedCompLayer.roto.target ?? "auto", promptRevision: JSON.stringify(selectedCompLayer.roto.prompts ?? []),
      quality: rotoQuality, framesPerSecond: profile.framesPerSecond, duration: mediaEnd,
      edgeDetail: selectedCompLayer.roto.edgeDetail ?? .72, decontaminate: selectedCompLayer.roto.decontaminate ?? .35,
      tolerance: rotoTolerance, edgeSensitivity: rotoEdgeSensitivity,
    });
    const baseBake = selectedCompLayer.roto.bake ?? createRotoBakeState(bakeKey, rotoQuality, profile.framesPerSecond, rangeStart, rangeEnd);
    const reusableBake = baseBake.cacheKey === bakeKey && baseBake.quality === rotoQuality && baseBake.framesPerSecond === profile.framesPerSecond;
    const coverageStart = reusableBake ? Math.min(baseBake.rangeStart, rangeStart) : rangeStart;
    const coverageEnd = reusableBake ? Math.max(baseBake.rangeEnd, rangeEnd) : rangeEnd;
    let bake: RotoBakeState = beginRotoBake(direction === "correction" ? invalidateRotoBake(baseBake, rangeStart, rangeEnd, mediaEnd, "manual correction") ?? baseBake : baseBake, bakeKey, rotoQuality, profile.framesPerSecond, coverageStart, coverageEnd);
    const cacheBridge = desktopMediaBridge();
    if (isPro && cacheBridge?.readRotoCache) {
      try {
        const cached = await cacheBridge.readRotoCache({ cacheKey: bakeKey, start: coverageStart, end: coverageEnd, limit: 20_000 });
        if (controller.signal.aborted) {
          if (rotoAbortRef.current === controller) rotoAbortRef.current = null;
          return;
        }
        const manual = generated.filter((keyframe) => keyframe.source === "manual");
        for (const frame of cached.frames) {
          if (manual.some((keyframe) => Math.abs(keyframe.time - frame.time) <= frameStep / 3)) continue;
          generated = generated.filter((keyframe) => keyframe.source !== "tracked" || Math.abs(keyframe.time - frame.time) > frameStep / 3);
          generated.push(frame);
          bake = resolveRotoBakeRange(bake, frame.time - frameStep / 2, frame.time + frameStep / 2, bake.completedFrames + 1, frame.time);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        // A missing, corrupt, or older sidecar is a cache miss. The source media
        // remains authoritative and the bake safely regenerates those frames.
      }
    }
    const completedBeforeJob = reusableBake ? bake.completedFrames : 0;
    const persistRotoSidecar = async (frames: RotoMaskKeyframe[]) => {
      if (!isPro || !cacheBridge?.writeRotoCache) return;
      const safeFrames = frames.filter((keyframe) => keyframe.source === "tracked" && keyframe.matte);
      try {
        for (let index = 0; index < safeFrames.length; index += 500) {
          await cacheBridge.writeRotoCache({ cacheKey: bakeKey, frames: safeFrames.slice(index, index + 500) });
        }
      } catch { /* disk caching is recoverable; project keyframes remain authoritative */ }
    };
    let pendingSidecarFrames: RotoMaskKeyframe[] = [];
    checkpoint();
    writeLayerRoto(activeComposition.id, selectedCompLayer.id, { ...selectedCompLayer.roto, bake });
    setRotoTracking({ active: true, current: 0, total, direction });
    setStatus(`Tracking subject ${direction} with ${rotoQuality} precision at ${profile.framesPerSecond} fps…`);
    try {
      for (const pass of passes) {
        let previousFrame: ImageData | null = null;
        let path = initialPath;
        let matte = rotoAlphaAt(selectedCompLayer.roto, trackingOrigin);
        let nativeSequenceStarted = false;
        const nativeSessionId = `${selectedCompLayer.roto.subjectId ?? selectedCompLayer.id}:${pass.label}`;
        await captureRotoFrames(
          { url: asset.url, kind: asset.kind, duration: asset.duration },
          pass.values,
          frameWidth,
          async (frame, time, index) => {
            if (index === 0 || !previousFrame) {
              if (matte) memory = rememberRotoSubject(memory, selectedCompLayer.roto?.subjectId ?? selectedCompLayer.id, frame, matte, time, 1, "manual");
              previousFrame = frame;
              return;
            }
            const manualAnchor = generated.find((keyframe) => keyframe.source === "manual" && Math.abs(keyframe.time - time) <= frameStep / 3 && Math.abs(keyframe.time - trackingOrigin) > 1 / 120);
            if (manualAnchor) {
              path = manualAnchor.points;
              matte = manualAnchor.matte;
              if (matte) memory = rememberRotoSubject(memory, selectedCompLayer.roto?.subjectId ?? selectedCompLayer.id, frame, matte, time, 1, "manual");
              previousFrame = frame;
              completed += 1;
              bake = updateRotoBakeProgress(resolveRotoBakeRange(bake, time - frameStep / 2, time + frameStep / 2, completedBeforeJob + completed, time), completedBeforeJob + completed, time);
              setRotoTracking({ active: true, current: completed, total, direction: `${pass.label} · correction anchor` });
              return;
            }
            const cachedAnchor = generated.find((keyframe) => keyframe.source === "tracked" && Math.abs(keyframe.time - time) <= frameStep / 3);
            if (cachedAnchor && isRotoBakeFrameCached(bake, generated, time, frameStep / 3)) {
              path = cachedAnchor.points;
              matte = cachedAnchor.matte;
              previousFrame = frame;
              completed += 1;
              bake = updateRotoBakeProgress(bake, completedBeforeJob + completed, time);
              setRotoTracking({ active: true, current: completed, total, direction: `${pass.label} · cached` });
              return;
            }
            const hardCut = isRotoSceneCut(previousFrame, frame);
            const tracked = trackRotoPathBidirectional(previousFrame, frame, path, profile.searchRadius);
            path = tracked.points;
            if (!hardCut && !tracked.occluded && matte) {
              const deformable = warpRotoAlphaMatteDeformable(previousFrame, frame, matte, {
                globalDx: tracked.dx,
                globalDy: tracked.dy,
                searchRadius: rotoQuality === "high" ? 10 : rotoQuality === "draft" ? 5 : 8,
                columns: rotoQuality === "high" ? 10 : 8,
                rows: rotoQuality === "high" ? 8 : 6,
              });
              matte = deformable.confidence >= .2
                ? deformable.matte
                : warpRotoAlphaMatte(matte, tracked.dx * matte.width / frame.width, tracked.dy * matte.height / frame.height, tracked.scale);
            }
            let confidence = tracked.confidence;
            let occluded = tracked.occluded;
            if (hardCut) { confidence = 0; occluded = true; nativeSequenceStarted = false; }
            const wasLost = hardCut || occluded || (memory?.lostFrames ?? 0) > 0;
            let reidentified = false;
            const semanticStride = profile.semanticStride;
            if (hardCut || index % semanticStride === 0 || confidence < .62 || occluded) {
              const movingSeed = path.reduce((sum, item) => ({ x: sum.x + item.x / path.length, y: sum.y + item.y / path.length }), { x: 0, y: 0 });
              try {
                const solved = await solveTargetedRoto(frame, selectedCompLayer.roto?.prompts ?? [{ ...movingSeed, kind: "foreground" }], movingSeed, profile.pointCount, selectedCompLayer.roto?.target ?? "auto", {
                  detail: selectedCompLayer.roto?.edgeDetail, decontaminate: selectedCompLayer.roto?.decontaminate,
                  tolerance: rotoTolerance, edgeSensitivity: rotoEdgeSensitivity, memoryMatte: !hardCut && !tracked.occluded ? matte : undefined,
                  sessionId: nativeSessionId, resetMemory: hardCut || !nativeSequenceStarted, memoryAnchor: hardCut || !nativeSequenceStarted, frameIndex: Math.round(time * exportFrameRate), refineAlpha: true,
                });
                if ("nativeAlphaRefined" in solved) nativeSequenceStarted = true;
                if (solved.contour.length) {
                  const candidateMatte = "nativeAlphaRefined" in solved && solved.nativeAlphaRefined
                    ? solved.matte
                    : refineRotoAlphaWithTrimap(frame, solved.matte, { detail: selectedCompLayer.roto?.edgeDetail, decontaminate: selectedCompLayer.roto?.decontaminate }).matte;
                  const identity = scoreRotoIdentity(memory, frame, candidateMatte);
                  const identityMinimum = rotoIdentityThreshold(memory, wasLost ? "recovery" : "tracking");
                  if (!memory || identity >= identityMinimum) {
                    path = alignRotoPath(path, solved.contour); matte = candidateMatte;
                    confidence = Math.max(.75 + identity * .2, confidence); occluded = false; reidentified = wasLost;
                  } else occluded = true;
                }
              } catch { /* keep the temporal tracker result */ }
              if (occluded && memory) {
                memory = markRotoSubjectLost(memory);
                const recoverySeeds = rotoReidentificationSeeds(memory, movingSeed, rotoQuality === "high" ? 13 : rotoQuality === "draft" ? 5 : 9);
                const candidates = recoverySeeds.flatMap((seed) => {
                  const candidate = guidedObjectMatte(frame, [{ ...seed, kind: "foreground" }], seed, rotoQuality === "high" ? 96 : 64, { detail: selectedCompLayer.roto?.edgeDetail, decontaminate: selectedCompLayer.roto?.decontaminate, tolerance: rotoTolerance, edgeSensitivity: rotoEdgeSensitivity });
                  if (!candidate.contour.length) return [];
                  return [{ value: candidate, matte: candidate.matte }];
                });
                const recovered = chooseRotoIdentityCandidate(memory, frame, candidates, rotoIdentityThreshold(memory, "recovery"));
                if (recovered) {
                  path = alignRotoPath(path, recovered.value.contour);
                  matte = refineRotoAlphaWithTrimap(frame, recovered.matte, { detail: selectedCompLayer.roto?.edgeDetail, decontaminate: selectedCompLayer.roto?.decontaminate }).matte;
                  confidence = recovered.score; occluded = false; reidentified = true;
                }
              }
            }
            if (!occluded && matte && confidence >= .42) memory = rememberRotoSubject(memory, selectedCompLayer.roto?.subjectId ?? selectedCompLayer.id, frame, matte, time, confidence, "tracked");
            else if (!occluded) memory = markRotoSubjectLost(memory);
            generated = generated.filter((keyframe) => Math.abs(keyframe.time - time) > 1 / 120);
            const trackedFrame: RotoMaskKeyframe = { id: `roto-${crypto.randomUUID()}`, time, points: path, matte, confidence, source: "tracked", occluded, recovered: reidentified || undefined };
            generated.push(trackedFrame);
            pendingSidecarFrames.push(trackedFrame);
            previousFrame = frame;
            completed += 1;
            bake = updateRotoBakeProgress(resolveRotoBakeRange(bake, time - frameStep / 2, time + frameStep / 2, completedBeforeJob + completed, time), completedBeforeJob + completed, time);
            if (completed % 6 === 0) {
              generated.sort((left, right) => left.time - right.time);
              writeLayerRoto(activeComposition.id, selectedCompLayer.id, { ...selectedCompLayer.roto!, keyframes: generated, memory, bake });
            }
            if (pendingSidecarFrames.length >= 24) {
              const checkpointFrames = pendingSidecarFrames;
              pendingSidecarFrames = [];
              await persistRotoSidecar(checkpointFrames);
            }
            setRotoTracking({ active: true, current: completed, total, direction: hardCut ? `${pass.label} · cut re-ID` : pass.label });
          },
          controller.signal,
        );
      }
      generated = stabilizeRotoAlphaMattes(recoverOccludedRotoKeyframes(generated, 2), rotoQuality === "high" ? .46 : rotoQuality === "draft" ? .24 : .36);
      generated.sort((a, b) => a.time - b.time);
      bake = resolveRotoBakeRange(bake, rangeStart, rangeEnd, completedBeforeJob + completed, rangeEnd);
      await persistRotoSidecar(generated);
      writeLayerRoto(activeComposition.id, selectedCompLayer.id, { ...selectedCompLayer.roto, keyframes: generated, memory, bake });
      const averageConfidence = generated.filter((keyframe) => keyframe.source === "tracked").reduce((sum, keyframe, _, list) => sum + keyframe.confidence / Math.max(1, list.length), 0);
      const recoveredCount = generated.filter((keyframe) => keyframe.recovered).length;
      setStatus(`Roto propagation complete · ${generated.length} contour + alpha frames · ${Math.round(averageConfidence * 100)}% average confidence${recoveredCount ? ` · ${recoveredCount} occluded frames recovered` : ""}${direction === "correction" ? " · bounded by manual corrections" : ""}.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        generated.sort((a, b) => a.time - b.time);
        bake = pauseRotoBake(bake, bake.lastCompletedTime);
        await persistRotoSidecar(generated);
        writeLayerRoto(activeComposition.id, selectedCompLayer.id, { ...selectedCompLayer.roto, keyframes: generated, memory, bake });
        setStatus(`Background roto bake paused. ${generated.length} completed contour frames and ${bake.completedFrames}/${bake.totalFrames} cached frames were preserved.`);
      }
      else {
        const message = error instanceof Error ? error.message : "Roto propagation failed.";
        bake = failRotoBake(bake, message);
        await persistRotoSidecar(generated).catch(() => {});
        writeLayerRoto(activeComposition.id, selectedCompLayer.id, { ...selectedCompLayer.roto, keyframes: generated, memory, bake });
        setStatus(message);
      }
    } finally {
      if (rotoAbortRef.current === controller) rotoAbortRef.current = null;
      setRotoTracking((state) => ({ ...state, active: false }));
    }
  };

  const invalidateSelectedRotoBake = (reason: string) => {
    if (!activeComposition || !selectedCompLayer?.roto?.bake) return;
    writeLayerRoto(activeComposition.id, selectedCompLayer.id, {
      ...selectedCompLayer.roto,
      bake: invalidateRotoBake(selectedCompLayer.roto.bake, 0, activeComposition.duration, activeComposition.duration, reason),
    });
  };

  const updateSelectedRotoMask = (roto: RotoMask) => {
    if (!activeComposition || !selectedCompLayer?.roto) { updateCompositionLayer({ roto }); return; }
    const before = selectedCompLayer.roto;
    const solverChanged = before.edgeDetail !== roto.edgeDetail
      || before.decontaminate !== roto.decontaminate
      || before.target !== roto.target
      || JSON.stringify(before.prompts ?? []) !== JSON.stringify(roto.prompts ?? []);
    updateCompositionLayer({
      roto: solverChanged && roto.bake
        ? { ...roto, bake: invalidateRotoBake(roto.bake, 0, activeComposition.duration, activeComposition.duration, "solver settings changed") }
        : roto,
    });
  };

  const clearSelectedRotoBake = () => {
    if (!activeComposition || !selectedCompLayer?.roto) return;
    checkpoint();
    const cacheKey = selectedCompLayer.roto.bake?.cacheKey;
    if (cacheKey && isPro) void desktopMediaBridge()?.clearRotoCache(cacheKey).catch(() => {});
    writeLayerRoto(activeComposition.id, selectedCompLayer.id, {
      ...selectedCompLayer.roto,
      keyframes: clearRotoBakeKeyframes(selectedCompLayer.roto.keyframes),
      bake: undefined,
    });
    setStatus("Cleared tracked roto cache. Manual subject selections and corrections were preserved.");
  };

  const removeRotoKeyframeAtPlayhead = () => {
    if (!activeComposition || !selectedCompLayer?.roto) return;
    checkpoint();
    const window = rotoCorrectionWindow(selectedCompLayer.roto.keyframes, compositionTime, activeComposition.duration);
    writeLayerRoto(activeComposition.id, selectedCompLayer.id, {
      ...selectedCompLayer.roto,
      keyframes: selectedCompLayer.roto.keyframes.filter((keyframe) => Math.abs(keyframe.time - compositionTime) > 1 / 60),
      bake: invalidateRotoBake(selectedCompLayer.roto.bake, window.start, window.end, activeComposition.duration, "correction removed"),
    });
    setStatus("Removed the subject correction at this frame; neighboring masks now interpolate across it.");
  };

  const smoothRotoTrack = () => {
    if (!activeComposition || !selectedCompLayer?.roto?.keyframes.length) return;
    checkpoint();
    const smoothed = stabilizeRotoAlphaMattes(reduceRotoChatter(selectedCompLayer.roto.keyframes, .6), .42);
    writeLayerRoto(activeComposition.id, selectedCompLayer.id, { ...selectedCompLayer.roto, keyframes: smoothed });
    setStatus(`Reduced contour and soft-alpha chatter across ${smoothed.filter((keyframe) => keyframe.source === "tracked").length} tracked frames. Manual corrections were preserved.`);
  };

  const createAnotherRotoObjectLayer = () => {
    if (!activeComposition || !selectedCompLayer || selectedCompLayer.kind !== "media" || !selectedCompLayer.roto?.keyframes.length) return;
    checkpoint();
    const id = `layer-${crypto.randomUUID()}`;
    const objectNumber = activeComposition.layers.filter((layer) => layer.assetId === selectedCompLayer.assetId && layer.roto).length + 1;
    const duplicate: CompositionLayer = {
      ...structuredClone(selectedCompLayer),
      id,
      name: `${selectedCompLayer.name.replace(/ · OBJECT \d+$/i, "")} · OBJECT ${objectNumber}`,
      locked: false,
      keyframes: selectedCompLayer.keyframes.map((keyframe) => ({ ...keyframe, id: `keyframe-${crypto.randomUUID()}` })),
      roto: {
        ...structuredClone(selectedCompLayer.roto),
        subjectId: `subject-${crypto.randomUUID()}`,
        subjectName: `Object ${objectNumber}`,
        target: "object",
        bake: undefined,
        keyframes: selectedCompLayer.roto.keyframes.map((keyframe) => ({ ...keyframe, id: `roto-${crypto.randomUUID()}` })),
      },
    };
    const sourceIndex = activeComposition.layers.findIndex((layer) => layer.id === selectedCompLayer.id);
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? { ...composition, layers: [...composition.layers.slice(0, sourceIndex + 1), duplicate, ...composition.layers.slice(sourceIndex + 1)] }
      : composition));
    setSelectedCompLayerId(id);
    setSelectedKeyframeId(null);
    setRotoTarget("object");
    setRotoMode("select");
    setStatus(`Object ${objectNumber} layer created. Click the next object; its identity and track will remain independent.`);
  };

  const createSubjectComposition = () => {
    if (!capabilities.rotoscoping || !activeComposition || !selectedCompLayer?.roto?.keyframes.length || selectedCompLayer.kind !== "media") {
      setStatus("Track a media subject before creating an isolated composition.");
      return;
    }
    checkpoint();
    const id = `comp-subject-${crypto.randomUUID()}`;
    const layerId = `layer-subject-${crypto.randomUUID()}`;
    const isolatedLayer: CompositionLayer = {
      ...structuredClone(selectedCompLayer),
      id: layerId,
      name: `${selectedCompLayer.name} · ISOLATED`,
      parentId: undefined,
      matteLayerId: undefined,
      trackMatte: undefined,
      locked: false,
      blend: "normal",
      keyframes: selectedCompLayer.keyframes.map((keyframe) => ({ ...keyframe, id: `keyframe-${crypto.randomUUID()}` })),
      roto: { ...structuredClone(selectedCompLayer.roto), keyframes: selectedCompLayer.roto.keyframes.map((keyframe) => ({ ...keyframe, id: `roto-${crypto.randomUUID()}` })) },
    };
    const subjectComposition = normalizeComposition({
      id,
      name: `${selectedCompLayer.name.replace(/\.[^.]+$/, "")} · SUBJECT`,
      duration: activeComposition.duration,
      width: activeComposition.width,
      height: activeComposition.height,
      background: "rgba(0,0,0,0)",
      layers: [isolatedLayer],
    });
    setCompositions((items) => [...items, subjectComposition]);
    setActiveCompositionId(id);
    setSelectedCompLayerId(layerId);
    setSelectedCompTrackId(subjectComposition.layers[0]?.trackId ?? "");
    setSelectedKeyframeId(null);
    setCompositionTime(0);
    rotoStrokeRef.current = null;
    setRotoStrokePreview([]);
    setRotoMode("off");
    setStatus(`${subjectComposition.name} created as a reusable transparent composition. Add it to the master or nest it inside any composition.`);
  };

  const createSubjectTrackingNull = () => {
    if (!activeComposition || !selectedCompLayer?.roto?.keyframes.length) return;
    const layerStart = selectedCompLayer.start ?? 0;
    const sourceStart = selectedCompLayer.sourceStart ?? 0;
    const rate = Math.max(.01, selectedCompLayer.playbackRate ?? 1);
    const samples = selectedCompLayer.roto.keyframes.map((keyframe) => {
      const center = keyframe.points.reduce((sum, point) => ({ x: sum.x + point.x / keyframe.points.length, y: sum.y + point.y / keyframe.points.length }), { x: 0, y: 0 });
      const mapped = layerPointToCompositionPoint(center, selectedCompLayer, activeComposition, keyframe.time);
      return {
        ...mapped,
        time: layerStart + (keyframe.time - sourceStart) / rate,
        confidence: keyframe.confidence, occluded: keyframe.occluded,
      };
    });
    const keyframes = trackingNullKeyframes(samples, `null-${selectedCompLayer.id}`);
    const id = `layer-track-null-${crypto.randomUUID()}`;
    const layer: CompositionLayer = {
      id, name: `${selectedCompLayer.name} · TRACK NULL`, kind: "null", text: "", shape: "rectangle", color: "#73f6df",
      trackId: selectedCompLayer.trackId,
      x: keyframes[0]?.x ?? 50, y: keyframes[0]?.y ?? 50, width: 8, height: 8, scale: 100, rotation: 0, opacity: 100,
      start: layerStart, duration: selectedCompLayer.duration ?? Math.max(.05, activeComposition.duration - layerStart), sourceStart: layerStart, playbackRate: 1,
      enabled: true, blend: "normal", effect: "none", animation: "none", keyframes,
    };
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? { ...composition, layers: [...composition.layers, layer] } : composition));
    setSelectedCompLayerId(id);
    setStatus(`Tracking null created with ${keyframes.length} editable motion points. Parent text, shapes, or effects to it.`);
  };

  const trackSelectedLayerPoint = async (stabilize: boolean) => {
    if (!activeComposition || !selectedCompLayer?.assetId || selectedCompLayer.kind !== "media" || rotoTracking.active) return;
    const asset = assets.find((item) => item.id === selectedCompLayer.assetId);
    if (!asset || asset.kind === "audio") return;
    const layerStart = selectedCompLayer.start ?? 0;
    const layerDuration = selectedCompLayer.duration ?? activeComposition.duration - layerStart;
    const start = Math.max(layerStart, compositionTime);
    const end = Math.min(activeComposition.duration, layerStart + layerDuration, start + 30);
    const step = 1 / 12;
    const compositionTimes = Array.from({ length: Math.max(2, Math.floor((end - start) / step) + 1) }, (_, index) => Math.min(end, start + index * step));
    const rate = Math.max(.01, selectedCompLayer.playbackRate ?? 1);
    const sourceTimes = compositionTimes.map((time) => (selectedCompLayer.sourceStart ?? 0) + (time - layerStart) * rate);
    const localSeedTime = sourceTimes[0];
    const seedPath = rotoPathAt(selectedCompLayer.roto, localSeedTime);
    let point = seedPath?.length
      ? seedPath.reduce((sum, item) => ({ x: sum.x + item.x / seedPath.length, y: sum.y + item.y / seedPath.length }), { x: 0, y: 0 })
      : { x: .5, y: .5 };
    let previous: ImageData | null = null;
    const samples: PointTrackSample[] = [];
    const controller = new AbortController();
    rotoAbortRef.current = controller;
    setRotoTracking({ active: true, current: 0, total: compositionTimes.length, direction: stabilize ? "Stabilizing" : "Point tracking" });
    try {
      await captureRotoFrames({ url: asset.proxyUrl ?? asset.url, kind: asset.kind, duration: asset.duration }, sourceTimes, 640, (frame, _sourceTime, index) => {
        if (previous) {
          const result = trackPoint(previous, frame, point, 24, 6);
          point = result.point;
          samples.push({ ...point, time: compositionTimes[index], confidence: result.confidence, occluded: result.occluded });
        } else samples.push({ ...point, time: compositionTimes[index], confidence: 1 });
        previous = frame;
        setRotoTracking({ active: true, current: index + 1, total: compositionTimes.length, direction: stabilize ? "Stabilizing" : "Point tracking" });
      }, controller.signal);
      checkpoint();
      if (stabilize) {
        const sourceSamples = samples.map((sample, index) => ({ ...sample, time: sourceTimes[index] }));
        const baseTransform = previewCompositionTransform(selectedCompLayer, sourceTimes[0], activeComposition.layers, new Set(), activeComposition.width, activeComposition.height);
        const keyframes = stabilizationKeyframes(sourceSamples, sourceSamples[0], `stabilize-${selectedCompLayer.id}`).map((keyframe) => ({
          ...keyframe,
          x: keyframe.x + baseTransform.x - 50,
          y: keyframe.y + baseTransform.y - 50,
          scale: Math.max(105, baseTransform.scale),
          rotation: baseTransform.rotation,
          opacity: baseTransform.opacity,
        }));
        setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? {
          ...composition,
          layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id ? { ...layer, keyframes } : layer),
        } : composition));
        setStatus(`Stabilized ${selectedCompLayer.name} with ${keyframes.length} editable transform samples.`);
      } else {
        const mapped = samples.map((sample) => ({ ...layerPointToCompositionPoint(sample, selectedCompLayer, activeComposition, sample.time), time: sample.time, confidence: sample.confidence, occluded: sample.occluded }));
        const keyframes = trackingNullKeyframes(mapped, `point-${selectedCompLayer.id}`);
        const id = `layer-point-null-${crypto.randomUUID()}`;
        const layer: CompositionLayer = {
          id, name: `${selectedCompLayer.name} · POINT TRACK`, kind: "null", text: "", shape: "rectangle", color: "#73f6df",
          trackId: selectedCompLayer.trackId,
          x: keyframes[0]?.x ?? 50, y: keyframes[0]?.y ?? 50, width: 8, height: 8, scale: 100, rotation: 0, opacity: 100,
          start, duration: Math.max(.05, end - start), sourceStart: start, playbackRate: 1,
          enabled: true, blend: "normal", effect: "none", animation: "none", keyframes,
        };
        setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? { ...composition, layers: [...composition.layers, layer] } : composition));
        setSelectedCompLayerId(id);
        setStatus(`Point tracker created an editable null with ${keyframes.length} samples.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Point tracking failed.");
    } finally {
      if (rotoAbortRef.current === controller) rotoAbortRef.current = null;
      setRotoTracking((state) => ({ ...state, active: false }));
    }
  };

  const trackSelectedLayerPlane = async () => {
    if (!activeComposition || !selectedCompLayer?.assetId || selectedCompLayer.kind !== "media" || rotoTracking.active) return;
    const asset = assets.find((item) => item.id === selectedCompLayer.assetId);
    if (!asset || asset.kind === "audio") return;
    const layerStart = selectedCompLayer.start ?? 0;
    const layerEnd = Math.min(activeComposition.duration, layerStart + (selectedCompLayer.duration ?? activeComposition.duration - layerStart));
    const start = Math.max(layerStart, compositionTime);
    const end = Math.min(layerEnd, start + 30);
    const step = 1 / 12;
    const compositionTimes = Array.from({ length: Math.max(2, Math.floor((end - start) / step) + 1) }, (_, index) => Math.min(end, start + index * step));
    const rate = Math.max(.01, selectedCompLayer.playbackRate ?? 1);
    const sourceTimes = compositionTimes.map((time) => (selectedCompLayer.sourceStart ?? 0) + (time - layerStart) * rate);
    const subjectPath = rotoPathAt(selectedCompLayer.roto, start);
    const reference: PlanarQuad = subjectPath?.length
      ? (() => {
          const xs = subjectPath.map((point) => point.x), ys = subjectPath.map((point) => point.y);
          const minimumX = Math.max(.02, Math.min(...xs) - .03), maximumX = Math.min(.98, Math.max(...xs) + .03);
          const minimumY = Math.max(.02, Math.min(...ys) - .03), maximumY = Math.min(.98, Math.max(...ys) + .03);
          return [{ x: minimumX, y: minimumY }, { x: maximumX, y: minimumY }, { x: maximumX, y: maximumY }, { x: minimumX, y: maximumY }] as PlanarQuad;
        })()
      : [{ x: .25, y: .25 }, { x: .75, y: .25 }, { x: .75, y: .75 }, { x: .25, y: .75 }];
    let corners = reference;
    let previous: ImageData | null = null;
    const samples: PlanarTrackSample[] = [];
    const controller = new AbortController();
    rotoAbortRef.current = controller;
    setRotoTracking({ active: true, current: 0, total: compositionTimes.length, direction: "Planar tracking" });
    try {
      await captureRotoFrames({ url: asset.proxyUrl ?? asset.url, kind: asset.kind, duration: asset.duration }, sourceTimes, 720, (frame, _sourceTime, index) => {
        if (!previous) samples.push({ time: compositionTimes[index], corners, confidence: 1 });
        else {
          const tracked = trackPlanarPatch(previous, frame, corners, 28);
          corners = tracked.corners;
          samples.push({ ...tracked, time: compositionTimes[index] });
        }
        previous = frame;
        setRotoTracking({ active: true, current: index + 1, total: compositionTimes.length, direction: "Planar tracking" });
      }, controller.signal);
      checkpoint();
      setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? {
        ...composition,
        layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id ? { ...layer, planarTrack: { enabled: true, reference, samples, influence: 100 } } : layer),
      } : composition));
      const confidence = samples.reduce((sum, sample) => sum + sample.confidence, 0) / Math.max(1, samples.length);
      setStatus(`Planar track applied with ${samples.length} samples at ${Math.round(confidence * 100)}% average confidence.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Planar tracking failed.");
    } finally {
      if (rotoAbortRef.current === controller) rotoAbortRef.current = null;
      setRotoTracking((state) => ({ ...state, active: false }));
    }
  };

  const solveSelectedLayerCamera = async () => {
    if (!activeComposition || !selectedCompLayer?.assetId || selectedCompLayer.kind !== "media" || rotoTracking.active) return;
    const asset = assets.find((item) => item.id === selectedCompLayer.assetId);
    if (!asset || asset.kind === "audio") return;
    const controller = new AbortController();
    rotoAbortRef.current = controller;
    try {
      const solved = await solveMediaLayerCamera({
        composition: activeComposition, layer: selectedCompLayer, asset: { ...asset, kind: asset.kind as "image" | "video" }, compositionTime, signal: controller.signal,
        onProgress: (current, total, direction) => setRotoTracking({ active: true, current, total, direction }),
      });
      checkpoint();
      setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? {
        ...composition,
        cameras: [...(composition.cameras ?? []).filter((camera) => camera.id !== solved.camera.id), solved.camera],
        activeCameraId: solved.camera.id,
      } : composition));
      setStatus(`Solved a ${solved.pointCloud.length}-point 3D camera at ${Math.round(solved.confidence * 100)}% confidence · ${(solved.reprojectionError * activeComposition.width).toFixed(1)}px reprojection error.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "3D camera solve failed.");
    } finally {
      if (rotoAbortRef.current === controller) rotoAbortRef.current = null;
      setRotoTracking((state) => ({ ...state, active: false }));
    }
  };

  const buildSelectedLayerCleanPlate = async () => {
    if (!activeComposition || !selectedCompLayer?.assetId || selectedCompLayer.kind !== "media" || rotoTracking.active) return;
    if (!selectedCompLayer.roto?.enabled && !selectedCompLayer.mask?.enabled) return setStatus("Create a tracked Roto Subject or layer mask before building a clean plate.");
    const asset = assets.find((item) => item.id === selectedCompLayer.assetId);
    if (!asset || asset.kind === "audio") return;
    const controller = new AbortController();
    rotoAbortRef.current = controller;
    try {
      const { plate, blob, cacheKey, fileName, backend, provenance, fallbackReason } = await buildMediaLayerCleanPlate({
        composition: activeComposition, layer: selectedCompLayer, asset: { ...asset, kind: asset.kind as "image" | "video" }, signal: controller.signal,
        onProgress: (current, total, direction) => setRotoTracking({ active: true, current, total, direction }),
      });
      const id = `cleanplate-${cacheKey}`;
      const file = new File([blob], fileName, { type: "image/png" });
      let url = URL.createObjectURL(file);
      let sourcePath: string | undefined;
      const bridge = desktopMediaBridge();
      if (isPro && bridge?.writeInpaintCache) {
        const cached = await bridge.writeInpaintCache({ cacheKey, width: plate.width, height: plate.height, png: new Uint8Array(await blob.arrayBuffer()), model: backend });
        URL.revokeObjectURL(url); url = cached.url; sourcePath = cached.outputPath;
      }
      setAssets((items) => [...items.filter((item) => item.id !== id), { id, name: file.name, file, url, kind: "image", color: "#73f6df", duration: Number.POSITIVE_INFINITY, folderId: "bin-graphics", proxyState: "original", proxyProgress: 0, sourcePath }]);
      checkpoint();
      setCompositions((items) => items.map((composition) => composition.id === activeComposition.id ? {
        ...composition,
        layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id ? { ...layer, removal: { enabled: true, passes: layer.removal?.passes ?? 16, mode: "clean-plate", cleanPlateAssetId: id, cacheKey, model: backend } } : layer),
      } : composition));
      setStatus(`${provenance ? `${provenance.model} neural clean plate` : "Temporal clean plate"} built from ${plate.sourceFrames} frames · ${Math.round(plate.coverageRatio * 100)}% observed background · ${plate.meanVisibleSamples.toFixed(1)} samples/pixel${plate.spatialFallbackPixels ? ` · ${plate.spatialFallbackPixels.toLocaleString()} pixels spatially repaired` : ""}${sourcePath ? " · cached on disk" : ""}${fallbackReason ? " · verified neural provider unavailable, safe temporal fallback used" : ""}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Clean-plate generation failed.");
    } finally {
      if (rotoAbortRef.current === controller) rotoAbortRef.current = null;
      setRotoTracking((state) => ({ ...state, active: false }));
    }
  };

  const createSmartReframeComposition = () => {
    if (!activeComposition || !selectedCompLayer?.roto?.keyframes.length || selectedCompLayer.kind !== "media") return;
    const id = `comp-reframe-${crypto.randomUUID()}`;
    const layerId = `layer-reframe-${crypto.randomUUID()}`;
    const keyframes = smartReframeKeyframes(selectedCompLayer.roto, activeComposition.width / activeComposition.height, 9 / 16, `reframe-${layerId}`);
    const layer: CompositionLayer = {
      ...structuredClone(selectedCompLayer), id: layerId, name: `${selectedCompLayer.name} · SMART REFRAME`,
      x: keyframes[0]?.x ?? 50, y: keyframes[0]?.y ?? 50, scale: keyframes[0]?.scale ?? 100,
      parentId: undefined, matteLayerId: undefined, trackMatte: undefined, locked: false, keyframes,
      // Roto drives the virtual camera, but the delivered reframe must retain
      // the complete shot. Subject isolation is a separate explicit workflow.
      roto: undefined,
    };
    const composition = normalizeComposition({ id, name: `${selectedCompLayer.name.replace(/\.[^.]+$/, "")} · VERTICAL`, duration: activeComposition.duration, width: 1080, height: 1920, background: "#000000", layers: [layer] });
    checkpoint();
    setCompositions((items) => [...items, composition]);
    setActiveCompositionId(id);
    setSelectedCompLayerId(layerId);
    setSelectedCompTrackId(composition.layers[0]?.trackId ?? "");
    setCompositionTime(0);
    setStatus(`${composition.name} created with ${keyframes.length} subject-following camera keyframes. It is ready to nest or edit in the graph.`);
  };

  const jumpToRotoReview = (direction: "next" | "previous") => {
    const review = nextRotoReviewFrame(selectedCompLayer?.roto?.keyframes ?? [], compositionTime, direction);
    if (!review) return setStatus("No low-confidence matte frames need review.");
    seekComposition(review.time);
    setRotoView("edge");
    setStatus(`Reviewing ${review.reason.replace("-", " ")} matte at ${review.time.toFixed(2)}s. Correct it or accept the current edge, then continue.`);
  };

  const acceptCurrentRotoReview = () => {
    if (!activeComposition || !selectedCompLayer?.roto) return;
    const target = selectedCompLayer.roto.keyframes.find((keyframe) => rotoFrameNeedsReview(keyframe) && Math.abs(keyframe.time - compositionTime) <= 1 / 60);
    if (!target) return setStatus("Move to an uncertain roto frame before accepting it.");
    checkpoint();
    const reviewed = { ...target, reviewed: true };
    writeLayerRoto(activeComposition.id, selectedCompLayer.id, {
      ...selectedCompLayer.roto,
      keyframes: selectedCompLayer.roto.keyframes.map((keyframe) => keyframe.id === target.id ? reviewed : keyframe),
    });
    const cacheKey = selectedCompLayer.roto.bake?.cacheKey;
    if (isPro && cacheKey && reviewed.matte) void desktopMediaBridge()?.writeRotoCache({ cacheKey, frames: [reviewed] }).catch(() => {});
    setStatus(`Accepted the matte at ${target.time.toFixed(2)}s. The review queue will skip it unless propagation replaces that frame.`);
  };

  const setCompositionLayerFlags = (layerId: string, patch: Pick<CompositionLayer, "enabled"> | Pick<CompositionLayer, "locked">) => {
    if (!activeComposition) return;
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? { ...composition, layers: composition.layers.map((layer) => layer.id === layerId ? { ...layer, ...patch } : layer) }
      : composition));
  };

  const updateCompositionKeyframeValue = (
    keyframeId: string,
    patch: Partial<Pick<TransformKeyframe, TransformGraphProperty | "time">>,
  ) => {
    if (!activeComposition || !selectedCompLayer) return;
    if (compositionLayerLocked(activeComposition, selectedCompLayer)) return;
    const bounds = layerTimeBounds(selectedCompLayer, activeComposition.duration);
    if (typeof patch.time === "number") {
      patch = { ...patch, time: Math.max(bounds.minimum, Math.min(bounds.maximum, patch.time)) };
      seekComposition(layerToCompositionTime(selectedCompLayer, patch.time!));
    }
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? {
        ...composition,
        layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id
          ? {
            ...layer,
            keyframes: patchTransformGraphKeyframe(layer.keyframes, keyframeId, patch, bounds.maximum),
          }
          : layer),
      }
      : composition));
  };

  const updateSelectedCompositionKeyframe = (patch: Partial<TransformKeyframe>) => {
    if (!activeComposition || !selectedCompLayer || !selectedCompKeyframe || compositionLayerLocked(activeComposition, selectedCompLayer)) return;
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? {
        ...composition,
        layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id
          ? { ...layer, keyframes: layer.keyframes.map((keyframe) => keyframe.id === selectedCompKeyframe.id ? { ...keyframe, ...patch } : keyframe) }
          : layer),
      }
      : composition));
  };

  const updateCompositionMotionKeyframe = (keyframeId: string, patch: Partial<TransformKeyframe>) => {
    if (!activeComposition || !selectedCompLayer || compositionLayerLocked(activeComposition, selectedCompLayer)) return;
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? {
        ...composition,
        layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id
          ? { ...layer, keyframes: layer.keyframes.map((keyframe) => keyframe.id === keyframeId ? { ...keyframe, ...patch } : keyframe).sort((left, right) => left.time - right.time || left.id.localeCompare(right.id)) }
          : layer),
      }
      : composition));
  };

  const applyCompositionPreset = (presetId: "neon" | "soft" | "whip" | "matte") => {
    if (!selectedCompLayer) return;
    if (compositionLayerLocked(activeComposition, selectedCompLayer)) {
      setStatus(`${selectedCompLayer.name} is locked. Unlock it before applying a preset.`);
      return;
    }
    checkpoint();
    const presets: Record<typeof presetId, Partial<CompositionLayer>> = {
      neon: { presetId, effect: "glow", blend: "screen", motionBlur: true, animation: "pulse" },
      soft: { presetId, effect: "blur", blend: "screen", opacity: 72, motionBlur: true },
      whip: { presetId, effect: "none", blend: "normal", motionBlur: true, animation: "drift" },
      matte: { presetId, effect: "none", blend: "multiply", mask: { enabled: true, shape: "ellipse", feather: 16, expansion: 0, inverted: false, x: 50, y: 50, width: 82, height: 82, rotation: 0 } },
    };
    setCompositions((items) => items.map((composition) => composition.id === activeComposition?.id
      ? { ...composition, layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id ? { ...layer, ...presets[presetId] } : layer) }
      : composition));
    setStatus(`${presetId.toUpperCase()} preset applied to ${selectedCompLayer.name}.`);
  };

  const persistLayerPresets = (presets: SavedLayerPreset[]) => {
    const limited = presets.slice(-100);
    setSavedLayerPresets(limited);
    try { window.localStorage.setItem("scenepilot-layer-presets-v1", JSON.stringify(limited)); } catch { /* Session preset still works. */ }
  };

  const saveSelectedLayerPreset = () => {
    if (!selectedCompLayer) return;
    const preset: SavedLayerPreset = {
      id: `layer-preset-${crypto.randomUUID()}`,
      name: `${selectedCompLayer.name.replace(/\s+COPY$/i, "")} LOOK ${savedLayerPresets.length + 1}`,
      patch: {
        blend: selectedCompLayer.blend,
        effect: selectedCompLayer.effect,
        effects: selectedCompLayer.effects ? structuredClone(selectedCompLayer.effects) : undefined,
        effectGraph: selectedCompLayer.effectGraph ? structuredClone(selectedCompLayer.effectGraph) : undefined,
        animation: selectedCompLayer.animation,
        expression: selectedCompLayer.expression ? structuredClone(selectedCompLayer.expression) : undefined,
        motionBlur: selectedCompLayer.motionBlur,
        opacity: selectedCompLayer.opacity,
        scale: selectedCompLayer.scale,
        rotation: selectedCompLayer.rotation,
        mask: structuredClone(selectedCompLayer.mask),
        trackMatte: selectedCompLayer.trackMatte ? structuredClone(selectedCompLayer.trackMatte) : undefined,
      },
    };
    persistLayerPresets([...savedLayerPresets, preset]);
    setStatus(`${preset.name} saved. It is available to every composition on this device.`);
  };

  const applySavedLayerPreset = (preset: SavedLayerPreset) => {
    if (!selectedCompLayer || compositionLayerLocked(activeComposition, selectedCompLayer)) {
      setStatus("Select and unlock a composition layer before applying a saved preset.");
      return;
    }
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition?.id
      ? { ...composition, layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id ? { ...layer, ...structuredClone(preset.patch), presetId: preset.id } : layer) }
      : composition));
    setStatus(`${preset.name} applied to ${selectedCompLayer.name}.`);
  };

  const removeSavedLayerPreset = (presetId: string) => {
    persistLayerPresets(savedLayerPresets.filter((preset) => preset.id !== presetId));
    setStatus("Reusable layer preset removed.");
  };

  const persistInstalledExtensionPacks = (packs: typeof installedExtensionPacks) => {
    const limited = packs.slice(-32);
    setInstalledExtensionPacks(limited);
    try { window.localStorage.setItem("scenepilot-extension-packs-v1", JSON.stringify(limited)); } catch { /* Pack receipt is informational. */ }
  };

  const importExtensionPack = async (file: File | undefined) => {
    if (!file) return;
    if (!isPro) {
      setStatus("Extension packs are available in ScenePilot Pro.");
      return;
    }
    try {
      const pack = parseExtensionPack(await file.text());
      const installed = installExtensionPack(pack, {
        compositionIds: compositions.map((composition) => composition.id),
        layerPresetIds: savedLayerPresets.map((preset) => preset.id),
        effectRecipeIds: customEffectRecipes.map((recipe) => recipe.id),
      });
      checkpoint();
      setCompositions((items) => [...items, ...installed.compositions]);
      persistLayerPresets([...savedLayerPresets, ...installed.layerPresets].slice(-100));
      persistEffectRecipes([...customEffectRecipes, ...installed.effectRecipes]);
      persistInstalledExtensionPacks([...installedExtensionPacks.filter((item) => item.id !== installed.pack.id), {
        id: installed.pack.id, name: installed.pack.name, author: installed.pack.author,
        layerPresets: installed.layerPresets.length, effectRecipes: installed.effectRecipes.length, compositions: installed.compositions.length,
      }]);
      setStatus(`Installed ${installed.pack.name} by ${installed.pack.author} · ${installed.compositions.length} comps, ${installed.layerPresets.length} looks, ${installed.effectRecipes.length} effect recipes.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Extension pack rejected: ${error.message}` : "Extension pack could not be installed.");
    }
  };

  const importEffectPlugin = async (file: File | undefined) => {
    if (!file) return;
    if (!isPro) return setStatus("Effect plugins are available in ScenePilot Pro.");
    try {
      const installed = installEffectPlugin(await file.text());
      const pluginRecipePrefix = `plugin.${installed.plugin.id}.`;
      persistEffectRecipes([...customEffectRecipes.filter((recipe) => !recipe.id.startsWith(pluginRecipePrefix)), ...installed.recipes]);
      const receipts = [...installedEffectPlugins.filter((plugin) => plugin.id !== installed.plugin.id), { id: installed.plugin.id, name: installed.plugin.name, author: installed.plugin.author, effects: installed.plugin.effects.length }].slice(-32);
      setInstalledEffectPlugins(receipts);
      try { window.localStorage.setItem("scenepilot-effect-plugins-v1", JSON.stringify(receipts)); } catch { /* Recipes remain installed for this session. */ }
      setStatus(`Installed ${installed.plugin.name} by ${installed.plugin.author} · ${installed.plugin.effects.length} sandboxed parity effect${installed.plugin.effects.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Effect plugin rejected: ${error.message}` : "Effect plugin could not be installed.");
    }
  };

  const exportCreatorExtensionPack = () => {
    if (!isPro) {
      setStatus("Extension pack authoring is available in ScenePilot Pro.");
      return;
    }
    try {
      const baseName = mainName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "creator";
      const pack = createExtensionPack({
        id: `${baseName}-creator-pack`, name: `${mainName.replace(/\.[^/.]+$/, "") || "ScenePilot"} Creator Pack`, author: "ScenePilot Creator",
        description: "Reusable compositions, layer looks, and deterministic clip effect recipes authored in ScenePilot Pro.", minimumAppVersion: "0.1.14",
        layerPresets: savedLayerPresets, effectRecipes: customEffectRecipes, compositions,
      });
      downloadTextFile(serializeExtensionPack(pack), `${baseName}.scenepilot-pack.json`, "application/vnd.scenepilot.extension+json");
      setStatus(`Exported ${pack.name} · ${pack.compositions.length} comps, ${pack.layerPresets.length} looks, ${pack.effectRecipes.length} effect recipes.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Could not export extension pack: ${error.message}` : "Could not export extension pack.");
    }
  };

  const beginCompositionLayerDrag = (event: React.PointerEvent<HTMLButtonElement>, layerId: string) => {
    if (!isPro || !activeComposition) return;
    event.stopPropagation();
    setSelectedCompLayerId(layerId);
    setSelectedKeyframeId(null);
    const layer = activeComposition.layers.find((item) => item.id === layerId);
    if (layer?.trackId) setSelectedCompTrackId(layer.trackId);
    const track = compositionTrackForLayer(activeComposition, layer);
    if (layer?.locked || track?.locked) {
      setStatus(`${layer?.name ?? "This layer"} is locked. Unlock it from the layer timeline to move it.`);
      return;
    }
    checkpoint();
    compDragRef.current = { layerId, checkpointed: true };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveCompositionLayerInViewer = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = compDragRef.current;
    const stage = compositionStageRef.current;
    if (!drag || !stage || !activeComposition) return;
    const bounds = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? {
        ...composition,
        layers: composition.layers.map((layer) => layer.id === drag.layerId ? { ...layer, x, y } : layer),
      }
      : composition));
  };

  const endCompositionLayerDrag = () => {
    compDragRef.current = null;
  };

  const removeCompositionLayer = (layerId: string) => {
    if (!activeComposition) return;
    if (compositionLayerLocked(activeComposition, activeComposition.layers.find((layer) => layer.id === layerId))) {
      setStatus("Unlock this layer and its track before deleting it.");
      return;
    }
    checkpoint();
    const remaining = activeComposition.layers
      .filter((layer) => layer.id !== layerId)
      .map((layer) => ({
        ...layer,
        parentId: layer.parentId === layerId ? undefined : layer.parentId,
        matteLayerId: layer.matteLayerId === layerId ? undefined : layer.matteLayerId,
      }));
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? { ...composition, layers: remaining }
      : composition));
    setSelectedCompLayerId(remaining[0]?.id ?? "");
    setSelectedKeyframeId(null);
  };

  const deleteComposition = (compositionId: string) => {
    const target = compositions.find((composition) => composition.id === compositionId);
    if (!target) return;
    checkpoint();
    const remaining = compositions.filter((composition) => composition.id !== compositionId);
    setCompositions(remaining.map((composition) => ({
      ...composition,
      layers: composition.layers.filter((layer) => layer.compositionId !== compositionId),
    })));
    setPlacements((items) => items.filter((placement) => placement.compositionId !== compositionId));
    setActiveCompositionId(remaining[0]?.id ?? "");
    setSelectedCompLayerId(remaining[0]?.layers[0]?.id ?? "");
    setSelectedKeyframeId(null);
    setCompositionTime(0);
    if (!remaining.length) setWorkspaceView("sequence");
    setStatus(`${target.name} and its master placements were removed.`);
  };

  const addCompositionKeyframe = () => {
    if (!selectedCompLayer || !activeComposition) return;
    if (compositionLayerLocked(activeComposition, selectedCompLayer)) {
      setStatus(`Unlock ${selectedCompLayer.name} before adding keyframes.`);
      return;
    }
    const bounds = layerTimeBounds(selectedCompLayer, activeComposition.duration);
    const time = compositionToLayerTime(selectedCompLayer, compositionTime);
    if (time < bounds.minimum || time >= bounds.maximum) {
      setStatus("Move the playhead inside the selected layer before adding a keyframe.");
      return;
    }
    checkpoint();
    const transform = previewCompositionTransform(selectedCompLayer, time, activeComposition.layers, new Set(), activeComposition.width, activeComposition.height);
    const keyframe = {
      id: `keyframe-${crypto.randomUUID()}`,
      time,
      x: transform.x,
      y: transform.y,
      scale: transform.scale,
      rotation: transform.rotation,
      opacity: transform.opacity,
      easing: "ease-in-out" as const,
    };
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? {
        ...composition,
        layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id
          ? { ...layer, keyframes: [...layer.keyframes.filter((item) => Math.abs(item.time - time) > .25 * Math.max(.01, layer.playbackRate ?? 1) / exportFrameRate), keyframe].sort((a, b) => a.time - b.time) }
          : layer),
      }
      : composition));
    setSelectedKeyframeId(keyframe.id);
    setStatus(`Keyframe added at ${time.toFixed(2)}s for ${selectedCompLayer.name}.`);
  };

  const deleteCompositionKeyframe = () => {
    if (!activeComposition || !selectedCompLayer || !selectedKeyframeId) return;
    if (compositionLayerLocked(activeComposition, selectedCompLayer)) return;
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? {
        ...composition,
        layers: composition.layers.map((layer) => layer.id === selectedCompLayer.id
          ? { ...layer, keyframes: layer.keyframes.filter((keyframe) => keyframe.id !== selectedKeyframeId) }
          : layer),
      }
      : composition));
    setSelectedKeyframeId(null);
    setStatus(`Removed the keyframe from ${selectedCompLayer.name}.`);
  };

  const moveCompositionLayer = (direction: "up" | "down") => {
    if (!activeComposition || !selectedCompLayer) return;
    const normalized = normalizeComposition(activeComposition);
    const currentTrack = compositionTrackForLayer(normalized, selectedCompLayer);
    if (selectedCompLayer.locked || currentTrack?.locked) {
      setStatus(`Unlock ${selectedCompLayer.name} before changing its stack order.`);
      return;
    }
    const videoTracks = (normalized.tracks ?? []).filter((track) => track.kind === "video");
    const index = videoTracks.findIndex((track) => track.id === selectedCompLayer.trackId);
    const targetIndex = direction === "up" ? index + 1 : index - 1;
    const targetTrack = videoTracks[targetIndex];
    if (index < 0 || !targetTrack || targetTrack.locked) return;
    checkpoint();
    setCompositions((items) => items.map((composition) => composition.id === activeComposition.id
      ? { ...normalized, layers: normalized.layers.map((layer) => layer.id === selectedCompLayer.id ? { ...layer, trackId: targetTrack.id } : layer) }
      : composition));
    setSelectedCompTrackId(targetTrack.id);
    setStatus(`${selectedCompLayer.name} moved ${direction} to ${targetTrack.name}.`);
  };

  const addCompositionToSequence = (compositionId: string, start = currentTime, trackId = selectedTrackId) => {
    const composition = compositions.find((item) => item.id === compositionId);
    if (!composition) return;
    checkpoint();
    const safeStart = Math.max(0, start);
    const section = sections.find((item) => safeStart >= item.start && safeStart < item.end) ?? sections[0];
    const placement: Placement = {
      id: `composition-placement-${crypto.randomUUID()}`,
      assetId: `composition:${composition.id}`,
      compositionId: composition.id,
      sectionId: section?.id ?? "manual",
      trackId: trackId || clipTracks[0]?.id,
      start: safeStart,
      sourceStart: 0,
      duration: composition.duration,
      scale: 100,
      opacity: 100,
    };
    setPlacements((items) => [...items, placement].sort((a, b) => a.start - b.start));
    setSelectedPlacementId(placement.id);
    setSelectedBaseCutId(null);
    setSelectedTrackId(placement.trackId ?? clipTracks[0]?.id ?? "");
    setWorkspaceView("sequence");
    setActivePanel("clip");
    setStatus(`${composition.name} nested in the master sequence at ${formatTime(safeStart)}.`);
  };

  const removeClipTrack = (trackId: string) => {
    if (clipTracks.length <= 1) return;
    if (!continuousEditRef.current) checkpoint();
    const fallback = clipTracks.find((track) => track.id !== trackId);
    setClipTracks((items) => items.filter((track) => track.id !== trackId));
    setPlacements((items) => items.map((placement) => placement.trackId === trackId ? { ...placement, trackId: fallback?.id } : placement));
    setSelectedTrackId(fallback?.id ?? "");
    setSelectedPlacementId(null);
    setActivePanel("track");
  };

  const dropOnClipTrack = (event: DragEvent<HTMLDivElement>, trackId: string) => {
    event.preventDefault();
    const targetTrack = clipTracks.find((track) => track.id === trackId);
    if (targetTrack?.locked) {
      setStatus(`${targetTrack.name} is locked.`);
      return;
    }
    const payload = event.dataTransfer.getData("application/x-scenepilot") || event.dataTransfer.getData("text/plain");
    if (!payload) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawStart = Math.min(duration - 0.05, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * duration));
    const start = snapTime(rawStart, snapCandidates, 0.1, snapping);
    if (payload.startsWith("effect:")) {
      const type = payload.slice("effect:".length) as ClipEffectType;
      const target = placements.find((placement) => placement.trackId === trackId && start >= placement.start && start < placement.start + placement.duration);
      if (!target || !CLIP_EFFECT_DEFINITIONS[type]) { setStatus("Drop the effect directly over a video clip."); return; }
      checkpoint();
      setPlacements((items) => items.map((placement) => placement.id === target.id ? { ...placement, effects: [...(placement.effects ?? []), createClipEffect(type)] } : placement));
      setSelectedPlacementId(target.id); setSelectedTrackId(trackId); setActivePanel("clip");
      setStatus(`${CLIP_EFFECT_DEFINITIONS[type].label} added to ${mediaName(target.assetId) ?? "the clip"}.`);
      return;
    }
    if (payload.startsWith("placement:")) {
      const id = payload.slice("placement:".length);
      const moving = placements.find((placement) => placement.id === id);
      const sourceTrack = clipTracks.find((track) => track.id === moving?.trackId);
      if (sourceTrack?.locked) {
        setStatus(`${sourceTrack.name} is locked.`);
        return;
      }
      checkpoint();
      setPlacements((items) => items.map((placement) => {
        if (placement.id !== id) return placement;
        const nextStart = Math.max(0, Math.min(duration - placement.duration, start));
        const section = sections.find((item) => nextStart >= item.start && nextStart < item.end);
        return { ...placement, trackId, start: nextStart, sectionId: section?.id ?? placement.sectionId };
      }));
      setSelectedPlacementId(id);
      setSelectedBaseCutId(null);
      setSelectedTrackId(trackId);
      setActivePanel("clip");
      setStatus(`Clip moved to ${clipTracks.find((track) => track.id === trackId)?.name ?? "track"} at ${formatTime(start)}.`);
    } else if (payload.startsWith("asset:") || payload.startsWith("composition:")) {
      const isComposition = payload.startsWith("composition:");
      const assetId = isComposition ? payload : payload.slice("asset:".length);
      if (!isComposition && assets.find((asset) => asset.id === assetId)?.kind === "audio") {
        setStatus("Drag audio media to an A-track, not a video overlay track.");
        return;
      }
      checkpoint();
      const compositionId = isComposition ? payload.slice("composition:".length) : undefined;
      const composition = compositionId ? compositions.find((item) => item.id === compositionId) : null;
      const section = sections.find((item) => start >= item.start && start < item.end) ?? sections[0];
      const placement: Placement = {
        id: `manual-${crypto.randomUUID()}`,
        assetId,
        compositionId,
        sectionId: section?.id ?? "manual",
        trackId,
        start,
        sourceStart: 0,
        duration: Math.min(composition?.duration ?? section?.duration ?? 0.5, duration - start),
        scale: composition ? 100 : section?.scale ?? 112,
        opacity: 100,
      };
      setPlacements((items) => [...items, placement].sort((a, b) => a.start - b.start));
      setSelectedPlacementId(placement.id);
      setSelectedBaseCutId(null);
      setSelectedTrackId(trackId);
      setActivePanel("clip");
      setStatus(`${composition?.name ?? "Media"} placed on ${clipTracks.find((track) => track.id === trackId)?.name ?? "track"} at ${formatTime(start)}.`);
    }
    setDraggingPlacementId(null);
  };

  const applyBeatGrid = (nextBpm: number, nextOffset: number) => {
    const roundedBpm = Math.round(Math.min(220, Math.max(50, nextBpm)) * 10) / 10;
    const nextBeats = beats.length > 1
      ? adjustMeasuredBeats(beats, bpm, roundedBpm, nextOffset - beatOffset)
      : makeBeatGrid(duration, roundedBpm, nextOffset);
    if (!continuousEditRef.current) checkpoint();
    setBpm(roundedBpm);
    setBeatOffset(nextOffset);
    setBeats(nextBeats);
    setStatus(`Beat grid set to ${roundedBpm} BPM with ${Math.round(nextOffset * 1000)} ms offset. Measured timing and existing edits preserved; run Auto Cut explicitly to rebuild.`);
  };

  const tapTempo = (event: MouseEvent<HTMLButtonElement>) => {
    const now = event.timeStamp;
    const previous = tapTimesRef.current.at(-1);
    if (previous && now - previous > 2000) tapTimesRef.current = [];
    tapTimesRef.current = [...tapTimesRef.current.slice(-6), now];
    if (tapTimesRef.current.length < 2) {
      setStatus("Keep tapping the beat.");
      return;
    }
    const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]).sort((a, b) => a - b);
    const middle = intervals[Math.floor(intervals.length / 2)];
    applyBeatGrid(60000 / middle, beatOffset);
  };

  const resetBeatGrid = () => {
    if (!analysis) return;
    checkpoint();
    setBpm(analysis.bpm);
    setBeatOffset(0);
    setBeats(analysis.beats);
    setStatus(`Restored the measured ${analysis.bpm} BPM grid. Existing edits preserved.`);
  };

  const splitAtPlayhead = () => {
    const section = sections.find((item) => currentTime > item.start + 0.5 && currentTime < item.end - 0.5);
    if (!section) {
      setStatus("Move the playhead inside a section before splitting.");
      return;
    }
    checkpoint();
    const left = { ...section, end: currentTime };
    const right = { ...section, id: `${section.id}-split-${crypto.randomUUID()}`, name: `${section.name} B`, start: currentTime, color: COLORS[sections.length % COLORS.length] };
    const index = sections.indexOf(section);
    const next = [...sections.slice(0, index), left, right, ...sections.slice(index + 1)];
    setSections(next);
    setPlacements((items) => items.map((placement) => placement.sectionId === section.id && placement.start >= currentTime
      ? { ...placement, sectionId: right.id }
      : placement));
    setSelectedSectionId(right.id);
    setStatus(`Split ${section.name} at ${formatTime(currentTime)}. Give each half its own rhythm.`);
  };

  const { togglePlayback, shuttle, stopShuttle } = useProgramTransport({ currentTime, compositionTime, frameRate: exportFrameRate, videoRef, playing, setPlaying, shuttleRate, setShuttleRate, setCompositionTime, setCurrentTime, editorMode, workspaceView, activeComposition, mainUrl, placements, isPro, timelineRange, duration, loopPlayback, setStatus });

  const seek = (time: number) => {
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const seekComposition = (time: number) => {
    setCompositionTime(Math.max(0, Math.min(activeComposition?.duration ?? 0, time)));
  };

  const removeAsset = (id: string) => {
    if (analyzing || rendering) return;
    const target = assets.find((asset) => asset.id === id);
    if (!window.confirm(`Remove “${target?.name ?? "this media"}” and every clip using it? This clears undo history. The original file will not be deleted.`)) return;
    if (target) URL.revokeObjectURL(target.url);
    if (target?.proxyUrl) URL.revokeObjectURL(target.proxyUrl);
    const selectedLayerWasRemoved = selectedCompLayer?.kind === "media" && selectedCompLayer.assetId === id;
    const fallbackLayerId = activeComposition?.layers.find((layer) => layer.kind !== "media" || layer.assetId !== id)?.id ?? "";
    setAssets((items) => items.filter((asset) => asset.id !== id));
    setPlacements((items) => items.filter((placement) => placement.assetId !== id));
    setBaseCuts((items) => items.filter((cut) => cut.assetId !== id));
    setAudioClips((items) => items.filter((clip) => clip.assetId !== id));
    setCompositions((items) => items.map((composition) => ({
      ...composition,
      layers: composition.layers.filter((layer) => layer.kind !== "media" || layer.assetId !== id),
    })));
    if (selectedBaseCut?.assetId === id) setSelectedBaseCutId(null);
    if (selectedPlacement?.assetId === id) setSelectedPlacementId(null);
    if (selectedLayerWasRemoved) {
      setSelectedCompLayerId(fallbackLayerId);
      setSelectedKeyframeId(null);
    }
    setAnalysis(null);
    setSavedRenderAnalysis(renderAnalysis);
    setProjectIntelligence(null);
    setProjectTranscripts((items) => Object.fromEntries(Object.entries(items).filter(([assetId]) => assetId !== id)));
    clearHistory();
    setStatus("Effect removed. Analyze again to refresh its visual profile.");
  };

  // Every effect knob, collected for save/export.
  const currentEffects = (): EffectSettings => ({
    styleId, autoEnergy, montageEnabled, montagePace, punchPreset,
    transitionType, strobePreset, strobeColor, strobeSecondaryColor, strobeAlternate, strobeIntensity,
    strobeAttack, strobeHold, strobeDecay, strobeShape, strobeMode, strobeBlend, strobeX, strobeY,
    strobeSize, strobeSoftness, strobeAngle, strobeSafeMode, strobeTiming, strobeBpm, strobeSensitivity, strobeBand, stutterPreset,
    speedPreset, dropRampEnabled, audioReactive, shakePreset, lookPreset, manualGrade, mirrorMode, streak, echoPreset,
  });

  // Restore all effect controls.
  const applyEffects = (raw: unknown) => {
    const e = coerceEffectSettings(raw);
    setStyleId(e.styleId);
    setAutoEnergy(e.autoEnergy);
    setMontageEnabled(e.montageEnabled);
    setMontagePace(e.montagePace as SequencePace);
    setPunchPreset(e.punchPreset as keyof typeof PUNCH_PRESETS);
    setTransitionType(e.transitionType as TransitionType);
    setStrobePreset(e.strobePreset as keyof typeof STROBE_PRESETS);
    setStrobeColor(e.strobeColor);
    setStrobeSecondaryColor(e.strobeSecondaryColor);
    setStrobeAlternate(e.strobeAlternate);
    setStrobeIntensity(e.strobeIntensity);
    setStrobeAttack(e.strobeAttack);
    setStrobeHold(e.strobeHold);
    setStrobeDecay(e.strobeDecay);
    setStrobeShape(e.strobeShape as StrobeShape);
    setStrobeMode(e.strobeMode as StrobeMode);
    setStrobeBlend(e.strobeBlend as StrobeBlend);
    setStrobeX(e.strobeX);
    setStrobeY(e.strobeY);
    setStrobeSize(e.strobeSize);
    setStrobeSoftness(e.strobeSoftness);
    setStrobeAngle(e.strobeAngle);
    setStrobeSafeMode(e.strobeSafeMode);
    setStrobeTiming(e.strobeTiming);
    setStrobeBpm(e.strobeBpm);
    setStrobeSensitivity(e.strobeSensitivity);
    setStrobeBand(e.strobeBand as StrobeBand);
    setStutterPreset(e.stutterPreset as keyof typeof STUTTER_PRESETS);
    setSpeedPreset(e.speedPreset as keyof typeof SPEED_PRESETS);
    setDropRampEnabled(e.dropRampEnabled);
    setAudioReactive(e.audioReactive);
    setShakePreset(e.shakePreset as keyof typeof SHAKE_PRESETS);
    setLookPreset(e.lookPreset as keyof typeof GRADE_PRESETS);
    setManualGrade(e.manualGrade);
    setMirrorMode(e.mirrorMode);
    setStreak(e.streak);
    setEchoPreset(e.echoPreset as keyof typeof ECHO_PRESETS);
  };

  const projectSettings = () => ({ aspect, customSize, sourceDims, exportFrameRate, exportMaxDimension, exportFormat, colorCurve, lut3dSource, lut3dMix });
  const applyProjectSettings = (raw: unknown) => {
    const s = readProjectSettings(raw);
    setAspect(s.aspect); setCustomSize(s.customSize); setSourceDims(s.sourceDims);
    setExportFrameRate(isPro ? s.exportFrameRate : 30); setExportMaxDimension(isPro ? s.exportMaxDimension : 1920);
    setExportFormat(isPro ? s.exportFormat : "mp4-h264"); setColorCurve(s.colorCurve); setLut3dSource(s.lut3dSource); setLut3dMix(s.lut3dMix);
  };
  function buildCutPlan() { return projectDocument({ snapshot: snapshot(), analysis, mainFile, mainName, mainSourcePath, assets, effects: currentEffects(), settings: projectSettings() }); }

  const exportCaptionSidecar = () => {
    const cues = titles.filter((title) => title.id.startsWith("caption-")).map((title) => ({ start: title.start, end: title.start + title.duration, text: title.text }));
    if (!cues.length) return setStatus("Generate or import captions before exporting an SRT sidecar.");
    downloadTextFile(captionsToSrt(cues), `${mainName.replace(/\.[^/.]+$/, "") || "scenepilot"}.srt`, "application/x-subrip");
    setStatus(`Exported ${cues.length} caption cues as an editable SRT sidecar.`);
  };

  // A shareable cut file: the whole edit and every effect, minus the media.
  const exportPlan = () => {
    const plan = buildCutPlan();
    downloadTextFile(JSON.stringify(plan, null, 2), `${mainName.replace(/\.[^/.]+$/, "") || "scenepilot"}.scenepilot.json`, "application/json");
    setStatus("Project download requested. Media is not embedded: keep the original files to relink when reopening this cut.");
  };

  // Files sent here from other thecreateco apps via the Locker (?tcc-open=).
  useLockerOpen((entry) => {
    const file = lockerFileToFile(entry);
    const name = file.name.toLowerCase();
    if (name.endsWith(".cube")) { void creativeLut.importFile(file); return; }
    if (name.endsWith(".srt") || name.endsWith(".vtt")) { void importCaptionFile(file); return; }
    if (file.type.startsWith("audio/") || (!mainFile && file.type.startsWith("video/"))) { void loadMainMedia(file); setStatus(`Opened ${file.name} from your Locker.`); return; }
    if (file.type.startsWith("video/") || file.type.startsWith("image/")) { void addAssets([file]); setStatus(`Added ${file.name} from your Locker.`); return; }
    setStatus(`${file.name} can't be opened in the editor.`);
  });

  const exportPremiere = (type: "xml" | "edl") => {
    try {
      const size = outputDimensions(sourceDims.w, sourceDims.h, exportMaxDimension, aspect, customSize);
      const dims = (value?: string) => { const match = value?.match(/(\d+)\D+(\d+)/); return match ? { width: Number(match[1]), height: Number(match[2]) } : {}; };
      const delivery = preparePremiere(type, {
        project: mainName, frameRate: exportFrameRate, width: size.width, height: size.height, duration, videoClips,
        assets: assets.map(({ id, name, kind, duration: assetDuration, nativeFrameRate, nativeDimensions, sourcePath }) => ({ id, name, kind, duration: assetDuration, frameRate: nativeFrameRate, sourcePath, ...dims(nativeDimensions) })),
        main: mainFile ? { id: MAIN_SOURCE_ID, name: mainFile.name, kind: mainIsAudio ? "audio" : "video", isAudio: mainIsAudio, duration, width: mainIsAudio ? undefined : sourceDims.w, height: mainIsAudio ? undefined : sourceDims.h, sourcePath: mainSourcePath || desktopMediaBridge()?.getPathForFile(mainFile) || undefined } : undefined,
        audioClipCount: audioClips.length, beats, sections: sections.filter((section) => section.enabled !== false).map(({ name, start, end }) => ({ name, start, end })), markers,
      });
      if (!window.confirm(`Export for Premiere (${type.toUpperCase()}):\n\n${delivery.warnings.join("\n\n")}\n\nExport now?`)) {
        setStatus("Premiere export canceled. The project was not changed."); return;
      }
      downloadTextFile(delivery.text, delivery.filename, delivery.mime);
      setLastHandoff({ blob: new Blob([delivery.text], { type: delivery.mime }), name: delivery.filename });
      setStatus(type === "xml"
        ? `Exported ${delivery.filename}. In Premiere Pro: File → Import… → this file; relink the media if asked.`
        : `Exported ${delivery.filename} (CMX3600). In Premiere Pro: File → Import… → this file; the song is on A1.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Premiere export failed."); }
  };

  const exportInterchange = (type: "edl" | "fcpxml" | "otio" | "premiere" | "premiere-edl") => {
    if (type === "premiere" || type === "premiere-edl") { exportPremiere(type === "premiere" ? "xml" : "edl"); return; }
    try {
      const delivery = prepareInterchange(type, {
        project: mainName, frameRate: exportFrameRate, videoClips, audioClips, audioTracks, markers, compositions,
        videoTracks: [{ id: UNIFIED_BASE_TRACK, name: "V1 · MASTER EDIT", enabled: montageEnabled }, ...clipTracks],
        assets: [
          ...assets.map(({ id, name, sourcePath, kind }) => ({ id, name, sourcePath, kind })),
          ...(mainFile ? [{ id: MAIN_SOURCE_ID, name: mainFile.name, sourcePath: mainSourcePath || desktopMediaBridge()?.getPathForFile(mainFile) || undefined }] : []),
        ],
      });
      if (!window.confirm(`${type.toUpperCase()} handoff limitations:\n\n${delivery.warnings.join("\n\n")}\n\nExport anyway?`)) {
        setStatus("Interchange export canceled. The project was not changed."); return;
      }
      downloadTextFile(delivery.text, delivery.filename, delivery.mime);
      setStatus(`Exported ${type.toUpperCase()} with disclosed handoff limitations. Keep a ScenePilot project and reference render.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Interchange export failed."); }
  };

  const collectDesktopProject = async () => {
    const bridge = desktopMediaBridge();
    if (!bridge?.collectProject) {
      setStatus("Collect Project is available in Desktop Pro.");
      return;
    }
    const sourceCandidates = [
      ...(mainFile ? [{ id: "main", path: bridge.getPathForFile(mainFile) }] : []),
      ...assets.map((asset) => ({ id: asset.id, path: asset.sourcePath ?? bridge.getPathForFile(asset.file) })),
    ].filter((source) => source.path);
    try {
      const result = await bridge.collectProject({ projectName: mainName, projectJson: JSON.stringify(buildCutPlan(), null, 2), sources: sourceCandidates });
      if (!result) {
        setStatus("Collect Project canceled.");
      } else {
        const missing = result.skipped?.length ?? 0;
        setStatus(missing > 0
          ? `Collected ${result.mediaCount} source ${result.mediaCount === 1 ? "file" : "files"} — ${missing} missing ${missing === 1 ? "file was" : "files were"} skipped (moved or deleted). Relink them and collect again.`
          : `Collected ${result.mediaCount} source files into a portable Desktop Pro project.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? `Collect Project failed: ${error.message}` : "Collect Project failed.");
    }
  };

  const removeDialogueSilence = () => {
    const captionCues = titles.filter((title) => title.id.startsWith("caption-")).map((title) => ({ start: title.start, end: title.start + title.duration, text: title.text }));
    const ranges = dialogueSilences(captionCues, duration);
    if (!ranges.length) {
      setStatus("Import SRT/VTT captions first, or no removable dialogue gaps were found.");
      return;
    }
    checkpoint();
    let nextBase = baseCuts;
    for (const range of [...ranges].sort((a, b) => b.start - a.start)) nextBase = extractRange(nextBase, range.start, range.end);
    setBaseCuts(nextBase);
    setPlacements((items) => extractTimedRanges(items, ranges));
    setAudioClips((items) => extractTimedRanges(items, ranges, sliceEditorialAudio));
    setTitles((items) => extractTimedRanges(items, ranges));
    setTranscriptWords((items) => remapTranscriptAfterDeletion(items, ranges));
    setBeats((items) => compactTimelineTimes(items, ranges));
    setMarkers((items) => items.filter((marker) => !ranges.some((range) => marker.time > range.start && marker.time < range.end)).map((marker) => ({ ...marker, time: timeAfterRemovingRanges(marker.time, ranges) })));
    setSections((items) => items.map((section) => ({ ...section, start: timeAfterRemovingRanges(section.start, ranges), end: timeAfterRemovingRanges(section.end, ranges) })).filter((section) => section.end - section.start >= 0.05));
    setTimelineRange({ inPoint: null, outPoint: null });
    setManualDropTime((time) => time === null ? null : timeAfterRemovingRanges(time, ranges));
    setSavedRenderAnalysis(renderAnalysis && remapRenderAnalysis(renderAnalysis, (time) => timeAfterRemovingRanges(time, ranges)));
    setAnalysis(null);
    setDuration((value) => Math.max(0.05, value - ranges.reduce((sum, range) => sum + range.duration, 0)));
    setSelectedBaseCutId(null);
    setSelectedPlacementId(null);
    setStatus(`Removed ${ranges.length} dialogue gaps while preserving phrase handles.`);
  };

  const queueSocialVersions = () => {
    const deliveries = socialDeliveryPlan(duration, analysis?.sceneCuts.map((cut) => cut.time) ?? []);
    const baseName = mainName.replace(/\.[^/.]+$/, "") || "ScenePilot";
    const jobs: RenderJob[] = deliveries.map((delivery) => ({
      projectId: activeProjectId,
      id: `render-${crypto.randomUUID()}`,
      name: `${baseName} · ${delivery.label}`,
      format: exportFormat,
      status: "queued",
      progress: 0,
      message: "Queued social version",
      createdAt: timestamp(),
      frameRate: exportFrameRate,
      maxDimension: exportMaxDimension,
      range: { inPoint: delivery.start, outPoint: delivery.end },
      aspect: delivery.aspect,
    }));
    setRenderQueue((items) => [...items, ...jobs]);
    openWorkspace("deliver");
    setStatus("Queued landscape, vertical, square and portrait social masters.");
  };

  // Re-apply an exported cut file. Media isn't in the file, so the current
  // source and clips stay; everything else — the arrangement and every effect —
  // is restored.
  const retainOfflineMediaLinks = (unresolved: MediaLinkDescriptor[], availableAssets: MediaAsset[]) => {
    const placeholders = offlineMediaAssets(unresolved, availableAssets);
    if (placeholders.length) setAssets([...availableAssets, ...placeholders]);
  };

  const importPlan = async (file?: File, availableAssets = assets, linkedMainReady = false, replaceDocument = false) => {
    if (!file || analyzing || rendering) return;
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error("Project metadata exceeds 32 MB. Choose a ScenePilot project file, not a media file.");
      const source = await file.text();
      const parsed = JSON.parse(source) as { OTIO_SCHEMA?: string };
      if (parsed.OTIO_SCHEMA === "Timeline.1") {
        const imported = importOtio(source);
        if (![24, 25, 30, 50, 60].includes(imported.frameRate)) throw new Error(`This editor cannot preserve ${imported.frameRate} fps yet. Convert the project frame rate in the source editor before importing; no timeline was changed.`);
        const relink = buildMediaRelinkMap(imported.assets, availableAssets.filter((asset) => asset.url).map((asset) => ({
          id: asset.id, name: asset.name, kind: asset.kind, size: asset.file.size, lastModified: asset.file.lastModified,
        })));
        retainOfflineMediaLinks(relink.unresolved, availableAssets);
        checkpoint();
        const remapOtioAssetId = (id: string) => relink.idMap.get(id) ?? id;
        const importedVideoClips = imported.videoClips.map((clip) => ({
          ...clip,
          assetId: clip.overlay?.compositionId ? clip.assetId : remapOtioAssetId(clip.assetId),
        }));
        setVideoClips(importedVideoClips);
        const importedClipTracks = imported.videoTracks.filter((track) => track.id !== UNIFIED_BASE_TRACK).map((track, index) => ({
          ...initialClipTracks[index % initialClipTracks.length],
          id: track.id,
          name: track.name,
          color: COLORS[index % COLORS.length],
          enabled: track.enabled !== false,
          solo: track.solo,
        }));
        if (importedClipTracks.length) setClipTracks(importedClipTracks);
        const importedAudioTracks = imported.audioTracks.map((track, index) => ({
          ...initialAudioTracks[index % initialAudioTracks.length],
          id: track.id,
          name: track.name,
          color: COLORS[(index + 4) % COLORS.length],
          muted: Boolean(track.muted),
          solo: Boolean(track.solo),
        }));
        if (importedAudioTracks.length) setAudioTracks(importedAudioTracks);
        setAudioClips(imported.audioClips.map((clip) => ({ ...clip, assetId: remapOtioAssetId(clip.assetId) })));
        setMarkers(imported.markers);
        if (imported.compositions.length) {
          const restoredCompositions = normalizeCompositions(imported.compositions.map((composition) => ({
            ...composition,
            layers: composition.layers.map((layer) => layer.kind === "media" && layer.assetId
              ? { ...layer, assetId: remapOtioAssetId(layer.assetId) }
              : layer),
          })));
          setCompositions(restoredCompositions);
          setActiveCompositionId(restoredCompositions[0]?.id ?? "");
          setSelectedCompLayerId(restoredCompositions[0]?.layers[0]?.id ?? "");
          setSelectedCompTrackId(restoredCompositions[0]?.layers[0]?.trackId ?? restoredCompositions[0]?.tracks?.[0]?.id ?? "");
        }
        setDuration(Math.max(.05, imported.duration));
        setExportFrameRate(([24, 25, 30, 50, 60].includes(Math.round(imported.frameRate)) ? Math.round(imported.frameRate) : 30) as 24 | 25 | 30 | 50 | 60);
        setMontageEnabled(true);
        setSelectedBaseCutId(null);
        setSelectedPlacementId(null);
        setStatus(relink.unresolved.length
          ? `Imported OTIO “${imported.project}” · ${importedVideoClips.length} video + ${imported.audioClips.length} audio clips · ${relink.unresolved.length} offline media link${relink.unresolved.length === 1 ? "" : "s"}. Import matching files to relink.`
          : `Imported OTIO “${imported.project}” · ${importedVideoClips.length} video + ${imported.audioClips.length} audio clips · all media relinked.`);
        return;
      }
      const cut = parseCutFile(source);
      const relink = buildMediaRelinkMap(
        cut.assets,
        availableAssets.filter((asset) => asset.url).map((asset) => ({
          id: asset.id,
          name: asset.name,
          kind: asset.kind,
          size: asset.file.size,
          lastModified: asset.file.lastModified,
        })),
      );
      const currentMainMatches = Boolean(!replaceDocument && cut.mainAsset && mainFile
        && cut.mainAsset.name.toLocaleLowerCase() === mainFile.name.toLocaleLowerCase()
        && cut.mainAsset.kind === (mainFile.type.startsWith("audio/") ? "audio" : "video")
        && (cut.mainAsset.size == null || cut.mainAsset.size === mainFile.size));
      const unresolvedMain = cut.mainAsset && !linkedMainReady && !currentMainMatches
        ? [{ id: MAIN_SOURCE_ID, name: cut.mainAsset.name, kind: cut.mainAsset.kind, size: cut.mainAsset.size, lastModified: cut.mainAsset.lastModified }]
        : [];
      retainOfflineMediaLinks([...relink.unresolved, ...unresolvedMain], availableAssets);
      const remapAssetId = (id: string) => relink.idMap.get(id) ?? id;
      checkpoint();
      setDuration(cut.duration || duration);
      setBeats(cut.beats);
      if (cut.bpm) setBpm(cut.bpm);
      setBeatOffset(cut.beatOffset);
      {
        const restored = (cut.sections as SectionRule[]).map((s, i) => ({ ...s, pattern: s.pattern ?? suggestDirectorPattern({ name: s.name ?? "Section", energy: s.energy ?? .5 }, i, cut.sections.length) }));
        setSections(restored);
        setSelectedSectionId(restored[0]?.id ?? "");
      }
      setClipTracks(cut.tracks as ClipTrack[]);
      const importedPlacements = (cut.placements as Placement[]).map((placement) => ({
        ...placement,
        assetId: placement.compositionId ? placement.assetId : remapAssetId(placement.assetId),
      }));
      {
        const restoredCompositions = normalizeCompositions((cut.compositions as StudioComposition[]).map((composition) => ({
          ...composition,
          layers: composition.layers.map((layer) => layer.kind === "media" && layer.assetId
            ? { ...layer, assetId: remapAssetId(layer.assetId) }
            : layer),
        })));
        setCompositions(restoredCompositions);
        setActiveCompositionId(restoredCompositions[0]?.id ?? "");
        setSelectedCompLayerId(restoredCompositions[0]?.layers[0]?.id ?? "");
        setSelectedCompTrackId(restoredCompositions[0]?.layers[0]?.trackId ?? restoredCompositions[0]?.tracks?.[0]?.id ?? "");
      }
      const importedBaseCuts = (cut.baseCuts as typeof baseCuts).map((cutItem) => ({ ...cutItem, assetId: remapAssetId(cutItem.assetId) }));
      const importedUnified = cut.videoClips?.length
        ? cut.videoClips.map((clip) => ({ ...clip, assetId: clip.overlay?.compositionId ? clip.assetId : remapAssetId(clip.assetId) }))
        : toUnifiedTimeline(importedBaseCuts, importedPlacements, UNIFIED_BASE_TRACK);
      setVideoClips(importedUnified);
      setSelectedPlacementId(null);
      setSelectedBaseCutId(null);
      setSelectedKeyframeId(null);
      setTitles(cut.titles as TitleCue[]);
      setProjectIntelligence(cut.projectIntelligence ?? null);
      setProjectTranscripts(cut.projectTranscripts ?? {});
      setStoryBrief(cut.storyBrief ?? "");
      applyEffects(cut.effects);
      applyProjectSettings(cut.settings);
      setMainName(cut.project);
      const importedProState = (cut.proState ?? {}) as Partial<{
        creatorGoal: CreatorGoal; inferredCreatorGoal: CreatorGoal | null;
        autoPolicy: AutoEditPolicy; autoVersions: AutoEditVersion[];
        audioTracks: AudioTrack[];
        audioBuses: AudioBus[];
        masterGain: number;
        colorManagement: ColorManagementSettings;
        audioClips: AudioClip[];
        transcriptWords: TranscriptWord[];
        projectIntelligence: ProjectIntelligence | null;
        projectTranscripts: Record<string, ProjectTranscriptChunk[]>;
        storyBrief: string;
        markers: TimelineMarker[];
        timelineRange: TimelineRange;
        mediaBins: MediaBin[];
        snapping: boolean;
        linkedSelection: boolean;
        manualDropTime: number | null;
      }>;
      setAudioTracks(importedProState.audioTracks ?? initialAudioTracks);
      setAutoPolicy(importedProState.autoPolicy ?? DEFAULT_AUTO_POLICY); setAutoVersions(importedProState.autoVersions ?? []);
      const importedIntent = restoreCreatorIntent(importedProState, mainFile ?? {name: cut.project, type: ""});
      setCreatorGoal(importedIntent.creatorGoal); setInferredCreatorGoal(importedIntent.inferredCreatorGoal);
      setAudioBuses(importedProState.audioBuses ?? DEFAULT_AUDIO_BUSES);
      setMasterGain(importedProState.masterGain ?? 1);
      setColorManagement(importedProState.colorManagement ?? DEFAULT_COLOR_MANAGEMENT);
      setAudioClips((importedProState.audioClips ?? []).map((clip) => ({ ...clip, assetId: remapAssetId(clip.assetId) })));
      setTranscriptWords(importedProState.transcriptWords ?? []);
      setProjectIntelligence(importedProState.projectIntelligence ?? cut.projectIntelligence ?? null);
      setProjectTranscripts(importedProState.projectTranscripts ?? cut.projectTranscripts ?? {});
      setStoryBrief(importedProState.storyBrief ?? cut.storyBrief ?? "");
      setSelectedTranscriptIds(new Set());
      setMarkers(importedProState.markers ?? []);
      setTimelineRange(importedProState.timelineRange ?? { inPoint: null, outPoint: null });
      setMediaBins(importedProState.mediaBins ?? initialMediaBins);
      setSnapping(importedProState.snapping ?? true);
      setLinkedSelection(importedProState.linkedSelection ?? true);
      setManualDropTime(importedProState.manualDropTime ?? null);
      setSavedRenderAnalysis(cut.renderAnalysis ?? null);
      const missingMedia = relink.unresolved.length + unresolvedMain.length;
      setStatus(missingMedia
        ? `Imported "${cut.project}" with ${missingMedia} offline media link${missingMedia === 1 ? "" : "s"}. Import the matching files to relink them.`
        : `Imported "${cut.project}" — every media link was matched and the edit is ready.`);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? `Import failed: ${error.message}` : "That cut file could not be read.");
      return false;
    }
  };

  const saveDesktopProjectDocument = async (saveAs = false): Promise<boolean> => {
    const revision = projectSafety.capture();
    const bridge = desktopMediaBridge();
    if (!isPro || !bridge?.saveProjectDocument) {
      setStatus("Disk project documents are available in Desktop Pro.");
      return false;
    }
    try {
      const safeName = (mainName.replace(/\.[^/.]+$/, "") || "ScenePilot Project").replace(/[^a-z0-9 _-]/gi, "-");
      const result = await bridge.saveProjectDocument({
        projectJson: JSON.stringify(buildCutPlan(), null, 2),
        suggestedName: `${safeName}.scenepilot.json`,
        saveAs,
      });
      if (result) setStatus(`Project document saved atomically to ${result.path}. Media paths are preserved for automatic relinking.`);
      if (result) projectSafety.markSaved(revision);
      return Boolean(result);
    } catch (error) {
      setStatus(error instanceof Error ? `Project document save failed: ${error.message}` : "Project document save failed.");
      return false;
    }
  };

  const openDesktopProjectDocument = async (recover = false) => {
    if (!await projectSafety.confirmReplace()) return;
    const bridge = desktopMediaBridge();
    if (!isPro || !bridge?.openProjectDocument) {
      setStatus("Disk project documents are available in Desktop Pro.");
      return;
    }
    try {
      const result = await bridge.openProjectDocument({ recovery: recover === true });
      if (!result) return;
      const name = result.path.split(/[\\/]/).at(-1) ?? "ScenePilot Project.scenepilot.json";
      const cut = parseCutFile(result.text);
      const linked = await linkDocumentMedia(cut, bridge);
      const availableAssets = linked.assets;
      setAssets(availableAssets);
      const linkedMain = linked.main;
      setMainFile(null); setMainUrl(""); setMainSourcePath(""); setAnalysis(null); setPlaying(false);
      if (linkedMain && cut.mainAsset) {
        const mainStub = new File([], cut.mainAsset.name, { type: mediaMime(cut.mainAsset.kind, cut.mainAsset.name), lastModified: linkedMain.lastModified });
        setMainFile(mainStub);
        setMainUrl(linkedMain.url);
        setMainName(cut.project || cut.mainAsset.name);
        setMainSourcePath(linkedMain.path);
        setDuration(cut.duration || linkedMain.metadata?.duration || duration);
        if (linkedMain.metadata?.video) setSourceDims({ w: linkedMain.metadata.video.width || 1280, h: linkedMain.metadata.video.height || 720 });
      }
      const imported = await importPlan(new File([result.text], name, { type: "application/json" }), availableAssets, Boolean(linkedMain), true);
      if (!imported) return;
      await bridge.commitProjectDocument?.(result.recovered ? null : result.path);
      clearHistory(); setCurrentTime(0); setCompositionTime(0); setActiveProjectId(`document-${result.path}`); setNewProjectOpen(false);
      if (!result.recovered) projectSafety.markLoaded();
      else { setRecoveryOpen(false); setStatus("Recovered the disk autosave with its media links. Save a new project document before continuing."); }
      if (linked.missing) setStatus(`Opened "${cut.project}" with ${linked.missing} offline media item(s). Relink them from the Project panel.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Project document open failed: ${error.message}` : "Project document open failed.");
    }
  };

  const saveCurrentProject = async (): Promise<boolean> => {
    const revision = projectSafety.capture();
    try {
      const projectId = isPro && activeProjectId === "current" ? `project-${crypto.randomUUID()}` : activeProjectId;
      await saveProject<SectionRule, Placement, ClipTrack>({
        schemaVersion: 2,
        projectId,
        name: mainName,
        mainFile,
        mainSourcePath,
        settings: serializeProjectSettings(projectSettings()),
        assets: assets.map(({ id, name, file, kind, color, duration: assetDuration, folderId, favorite, proxyState, proxyFile, waveform, sourcePath, nativeCodec, nativeDimensions, nativeFrameRate, nativeVfr, nativeBitDepth, nativeHdr, offline, sourceSize, sourceLastModified, beatMap }) => ({
          id, name, file, kind, color, duration: assetDuration, folderId, favorite, proxyState, proxyFile, waveform, sourcePath, nativeCodec, nativeDimensions, nativeFrameRate, nativeVfr, nativeBitDepth, nativeHdr, offline: offline || undefined, sourceSize, sourceLastModified, beatMap,
        })),
        duration,
        bpm,
        beatOffset,
        beats,
        sections,
        videoClips,
        placements,
        compositions,
        tracks: clipTracks,
        baseCuts,
        titles,
        analysis,
        autoEnergy,
        effects: currentEffects(),
        proState: { autoPolicy, autoVersions, creatorGoal, inferredCreatorGoal, audioTracks, audioBuses, masterGain, colorManagement, audioClips, transcriptWords, projectIntelligence, projectTranscripts, storyBrief, markers, timelineRange, mediaBins, snapping, linkedSelection, manualDropTime, renderAnalysis },
        savedAt: timestamp(),
      }, projectId);
      setActiveProjectId(projectId);
      if (isPro) setProjectLibrary(await listProjects());
      projectSafety.markSaved(revision);
      const offlineCount = assets.filter(asset => asset.offline || !asset.url).length;
      setStatus(offlineCount
        ? `Project saved with ${offlineCount} offline media link${offlineCount === 1 ? "" : "s"}. Your edit is safe; relink the original files before rendering.`
        : isPro ? "Project saved to the local Pro library with its media and edit state." : "Project saved locally with its source media, edit map, and effects.");
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? `Save failed: ${error.message}` : "This browser could not save the project.");
      return false;
    }
  };

  const restoreCurrentProject = async (projectId = "current") => {
    if (analyzing || rendering) return;
    if (!await projectSafety.confirmReplace()) return;
    try {
      const stored = await loadProject<SectionRule, Placement, ClipTrack>(projectId);
      if (!stored) {
        setStatus("No saved ScenePilot project was found in this browser.");
        return;
      }
      const media = await hydrateStoredMedia(stored);
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      const restoredAssets = media.assets;
      setMainFile(stored.mainFile);
      setMainSourcePath(media.mainSourcePath);
      setMainUrl(media.mainUrl);
      setMainName(stored.name ?? stored.mainFile?.name ?? "Untitled project");
      setAssets(restoredAssets);
      setDuration(stored.duration);
      setBpm(stored.bpm);
      setBeatOffset(stored.beatOffset ?? 0);
      setBeats(stored.beats);
      const restoredSections = stored.sections.map((section, index) => ({
        ...section,
        energy: section.energy ?? stored.analysis?.sections[index]?.energy ?? 0.5,
        rhythm: section.rhythm ?? "normal" as const,
        pattern: section.pattern ?? suggestDirectorPattern({ name: section.name, energy: section.energy ?? 0.5 }, index, stored.sections.length),
      }));
      setSections(restoredSections);
      const restoredTracks = stored.tracks?.length ? stored.tracks : initialClipTracks;
      setClipTracks(restoredTracks);
      const restoredPlacements = stored.placements.map((placement, index) => ({ ...placement, trackId: placement.trackId ?? restoredTracks[index % restoredTracks.length].id }));
      {
        const restoredCompositions = normalizeCompositions((stored.compositions ?? []) as StudioComposition[]);
        setCompositions(restoredCompositions);
        setActiveCompositionId(restoredCompositions[0]?.id ?? "");
        setSelectedCompLayerId(restoredCompositions[0]?.layers[0]?.id ?? "");
        setSelectedCompTrackId(restoredCompositions[0]?.layers[0]?.trackId ?? restoredCompositions[0]?.tracks?.[0]?.id ?? "");
      }
      setVideoClips(stored.videoClips?.length
        ? stored.videoClips
        : toUnifiedTimeline(stored.baseCuts ?? [], restoredPlacements, UNIFIED_BASE_TRACK));
      setTitles(stored.titles ?? []);
      setAnalysis(stored.analysis);
      const restoredProState = (stored.proState ?? {}) as Partial<{
        creatorGoal: CreatorGoal; inferredCreatorGoal: CreatorGoal | null;
        autoPolicy: AutoEditPolicy; autoVersions: AutoEditVersion[];
        audioTracks: AudioTrack[];
        audioBuses: AudioBus[];
        masterGain: number;
        colorManagement: ColorManagementSettings;
        audioClips: AudioClip[];
        transcriptWords: TranscriptWord[];
        projectIntelligence: ProjectIntelligence | null;
        projectTranscripts: Record<string, ProjectTranscriptChunk[]>;
        storyBrief: string;
        markers: TimelineMarker[];
        timelineRange: TimelineRange;
        mediaBins: MediaBin[];
        snapping: boolean;
        linkedSelection: boolean;
        manualDropTime: number | null;
        renderAnalysis: unknown;
      }>;
      setAudioTracks(restoredProState.audioTracks ?? initialAudioTracks);
      setAutoPolicy(restoredProState.autoPolicy ?? DEFAULT_AUTO_POLICY); setAutoVersions(restoredProState.autoVersions ?? []);
      const restoredIntent = restoreCreatorIntent(restoredProState, stored.mainFile);
      setCreatorGoal(restoredIntent.creatorGoal); setInferredCreatorGoal(restoredIntent.inferredCreatorGoal);
      setAudioBuses(restoredProState.audioBuses ?? DEFAULT_AUDIO_BUSES);
      setMasterGain(restoredProState.masterGain ?? 1);
      setColorManagement(restoredProState.colorManagement ?? DEFAULT_COLOR_MANAGEMENT);
      setAudioClips(restoredProState.audioClips ?? []);
      setTranscriptWords(restoredProState.transcriptWords ?? []);
      setProjectIntelligence(restoredProState.projectIntelligence ?? null);
      setProjectTranscripts(restoredProState.projectTranscripts ?? {});
      setStoryBrief(restoredProState.storyBrief ?? "");
      setSelectedTranscriptIds(new Set());
      setMarkers(restoredProState.markers ?? []);
      setTimelineRange(restoredProState.timelineRange ?? { inPoint: null, outPoint: null });
      setMediaBins(restoredProState.mediaBins ?? initialMediaBins);
      setSnapping(restoredProState.snapping ?? true);
      setLinkedSelection(restoredProState.linkedSelection ?? true);
      setManualDropTime(restoredProState.manualDropTime ?? null);
      setSavedRenderAnalysis(coerceRenderAnalysis(restoredProState.renderAnalysis));
      // Restore every effect; fall back to the saved autoEnergy for old saves.
      applyEffects(stored.effects ?? coerceEffectSettings({ autoEnergy: stored.autoEnergy }));
      applyProjectSettings(stored.settings);
      setSelectedSectionId(restoredSections[0]?.id ?? "");
      setSelectedPlacementId(null);
      setSelectedBaseCutId(null);
      setSelectedKeyframeId(null);
      setSelectedTrackId(restoredTracks[0].id);
      setCurrentTime(0);
      setCompositionTime(0);
      setActiveProjectId(stored.projectId ?? projectId);
      setNewProjectOpen(false); setPlaying(false);
      clearHistory();
      await desktopMediaBridge()?.commitProjectDocument?.(null);
      projectSafety.markLoaded();
      setStatus(`Restored ${(stored.videoClips?.length ?? ((stored.baseCuts?.length ?? 0) + stored.placements.length)) + (restoredProState.audioClips?.length ?? 0)} timeline items and your effects from the saved project.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Restore failed: ${error.message}` : "This browser could not restore the project.");
    }
  };

  const { markMonitorBoundary, stepMonitorFrame } = createMonitorCommands({
    target: editorMode === "pro" && workspaceView === "composition" ? "composition" : editorMode === "pro" && monitorMode === "source" && sourceAsset ? "source" : "program",
    sourceTime, sourceDuration, compositionTime, compositionDuration: activeComposition?.duration ?? duration,
    currentTime, duration, fps: exportFrameRate, setSourceRange, setTimelineRange, seekSource, seekComposition, seek,
    onUnsupported: () => setStatus("Composition work-area marks are not supported yet. Use the main sequence to mark a delivery range."),
  });

  const exportAudioStem = (queuedJob: RenderJob) => deliverAudioStem({
    queuedJob, rendering, renderLaunchRef, renderAbortRef, mainFile, mainUrl, mainName, duration,
    assets, audioClips, audioTracks, audioBuses, nestedCompositionAudio: nestedCompositionAudioPlan.clips, compositionAudioIssues: nestedCompositionAudioPlan.issues, masterGain,
    materializeFile: materializePathBackedFile,
    setRendering, setRenderProgress, setStatus, updateQueue: setRenderQueue,
  });

  const videoDeliveryContext: VideoDeliveryContext = {
    onBrowserDownloadReady: mobileViewport && !isPro ? browserExport.ready : undefined,
    onRendered: (blob, name) => setLastRender({ blob, name, at: Date.now() }),
    activeProjectId,
    exportAudioStem, placements, mainFile, montageEnabled, baseCuts, rendering, renderLaunchRef, duration,
    exportFormat, mainName, timelineRange, exportFrameRate, exportMaxDimension, aspect, customSize,
    compositions, sourceDims, isPro, assets, audioTracks, audioClips, audioBuses, masterGain,
    nativeCapabilities, titles, transitionType, punchPreset, shakePreset, strobeConfig, stutterPreset,
    speedPreset, dropRampEnabled, audioReactive, echoPreset, hasShaderEffect, setStatus, setRenderQueue,
    nativeRenderJobRef, renderAbortRef, setRendering, setRenderProgress, setRenderQueueOpen, capabilities, mainUrl,
    visualAssets, clipTracks, renderMotion, gradeParams, strobeSetting, stutterSetting, speedSetting,
    dropRampSetting, echoSetting, mainSourcePath,
  };
  const exportVideo = (queuedJob?: RenderJob) => deliverVideo(videoDeliveryContext, queuedJob);
  function queueExport(outputName?: string) {
    if (selectedProfileChecking) {
      setStatus("Wait for the selected export profile to finish its capability check.");
      return;
    }
    if (!selectedProfileSupported) {
      setStatus(`Render blocked by preflight: ${selectedProfileMessage}`);
      return;
    }
    if (!isPro) { void exportVideo(); return; }
    const job: RenderJob = {
      projectId: activeProjectId,
      id: `render-${crypto.randomUUID()}`,
      name: typeof outputName === "string" && outputName.trim() ? outputName.trim().replace(/[^a-z0-9._ -]/gi, "-") : `${mainName.replace(/\.[^/.]+$/, "") || "ScenePilot"} · ${exportFormat}`,
      format: exportFormat,
      status: "queued",
      progress: 0,
      message: "Queued",
      createdAt: timestamp(),
      frameRate: exportFrameRate,
      maxDimension: exportMaxDimension,
      range: { ...timelineRange },
      aspect,
      customSize,
    };
    setRenderQueue((items) => [...items, job]);
    setEditorMode("pro");
    setWorkspaceView("sequence");
    setRenderQueueOpen(true);
    setStatus(rendering ? "Added to the render queue. It will start automatically after the active job." : "Added to the render queue.");
  }

  const queueAudioStems = () => {
    if (!isPro) return;
    const jobs = createAudioStemJobs(mainName, {
      frameRate: exportFrameRate, maxDimension: exportMaxDimension,
      range: { ...timelineRange }, aspect, customSize,
    });
    setRenderQueue((items) => [...items, ...jobs.map((job) => ({ ...job, projectId: activeProjectId }))]);
    setRenderQueueOpen(true);
    setStatus("Queued 24-bit master, music, dialogue and SFX WAV deliverables.");
  };

  const retryRenderJob = (job: RenderJob) => {
    if (job.projectId !== activeProjectId && !window.confirm("This delivery belongs to another or an older session. Render the currently open project instead?")) return;
    const retried: RenderJob = {
      ...job,
      projectId: activeProjectId,
      status: "queued",
      progress: 0,
      message: "Queued for clean retry",
      error: undefined,
    };
    setRenderQueue((items) => items.map((item) => item.id === job.id ? retried : item));
    setStatus("Render queued for a clean retry from the beginning.");
  };

  const revealRenderOutput = async (job: RenderJob) => {
    if (!job.outputPath) return;
    try {
      await desktopMediaBridge()?.revealOutput(job.outputPath);
      setStatus(`Revealed ${job.name} in Finder.`);
    } catch (error) {
      setStatus(error instanceof Error ? `The rendered file is no longer at that location: ${error.message}` : "The rendered file could not be revealed.");
    }
  };

  useEffect(() => {
    if (!isPro || renderQueuePaused || rendering || renderLaunchRef.current) return;
    const next = renderQueue.find((job) => job.status === "queued");
    if (!next) return;
    if (next.projectId && next.projectId !== activeProjectId) {
      setRenderQueue((jobs) => jobs.map((job) => job.id === next.id ? { ...job, status: "failed", message: "Restore the delivery's project before retrying." } : job));
      return;
    }
    void exportVideo(next);
  // exportVideo intentionally reads the freshest project state while each
  // queued delivery keeps its own output profile and range.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, renderQueuePaused, rendering, renderQueue]);

  const exportActiveComposition = () => deliverActiveComposition(videoDeliveryContext, activeComposition);
  const toggleRecoveryHistory = async () => {
    const next = !recoveryOpen;
    setRecoveryOpen(next);
    if (!next) return;
    try {
      setRecoveryRevisions(await listRecoveryRevisions<EditSnapshot>(activeProjectId));
    } catch {
      setStatus("Recovery history is unavailable in this environment.");
    }
  };

  const restoreRecoveryRevision = (revision: RecoveryRevision<EditSnapshot>) => {
    checkpoint();
    restoreSnapshot(structuredClone(revision.value));
    setRecoveryOpen(false);
    setStatus(`Recovered ${revision.label.toLowerCase()} from ${new Date(revision.savedAt).toLocaleTimeString()}.`);
  };

  const toggleFullscreen = () => toggleEditorFullscreen(previewRef.current, setStatus);

  const dropMain = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    loadMainMedia(event.dataTransfer.files[0]);
  };

  // One preview stage, painted by the same frame model the renderer uses, so
  // the montage, punch, transitions and grade all show up before you export.
  // An optional main media element follows the document clock for audio;
  // clip-first sequences do not require a main song or video.
  // Preview canvas buffer matches the output shape, so `object-fit: contain`
  // letterboxes the true frame in the stage — WYSIWYG for vertical/square too.
  // For "source" we mirror the real footage shape (from state, captured on load
  // — never read the ref during render) so vertical clips preview vertical.
  const generatedMasterComposition = !mainFile
    ? compositions.find((composition) => composition.id === placements.find((placement) => placement.compositionId)?.compositionId)
    : undefined;
  const previewSourceDims = generatedMasterComposition ? { w: generatedMasterComposition.width, h: generatedMasterComposition.height } : sourceDims;
  const previewDims = outputDimensions(previewSourceDims.w, previewSourceDims.h, aspect === "source" ? 960 : 640, aspect, customSize);
  const placementShotCount = placements.filter((placement) => !placement.compositionId).length;
  const hasCompositionTimelineContent = placements.some((placement) => Boolean(placement.compositionId));
  const mobileMissingMediaCount = useMemo(() => {
    if (!mobileViewport || isPro) return 0;
    const required = renderMediaIds([visibleRenderPlacements(placements, clipTracks), montageEnabled ? baseCuts : []], compositions, { pictureOnly: true });
    if (assets.some(asset => asset.id === MAIN_SOURCE_ID && !asset.url)) required.add(MAIN_SOURCE_ID);
    const linked = new Set(assets.filter(asset => asset.url).map(asset => asset.id));
    if (mainUrl) linked.add(MAIN_SOURCE_ID);
    return [...required].filter(id => !linked.has(id)).length;
  }, [mobileViewport, isPro, placements, clipTracks, montageEnabled, baseCuts, compositions, assets, mainUrl]);
  const renderableSequence = hasRenderableSequence({
    hasMainMedia: Boolean(mainFile),
    hasCompositionContent: hasCompositionTimelineContent,
    assetCount: assets.length,
    placementCount: placements.length,
    baseCutCount: baseCuts.length,
    montageEnabled,
  });
  const autoPreviewLabel = autoPreviewStatusLabel({
    hasMainMedia: Boolean(mainFile),
    hasCompositionContent: hasCompositionTimelineContent,
    assetCount: assets.length,
    placementCount: placements.length,
    baseCutCount: baseCuts.length,
    analyzing,
  });
  const colorShotCount = shotMatchSequenceCount(baseCuts.length, placementShotCount);
  const colorShotBrowserItems = baseCuts.length
    ? baseCuts.slice(0, 18).map((cut) => ({ id: cut.id, labelId: cut.id, assetId: cut.assetId, start: cut.start, active: selectedBaseCutId === cut.id, onClick: () => { setSelectedBaseCutId(cut.id); setCurrentTime(cut.start); setActivePanel("base"); } }))
    : placements.filter((placement) => !placement.compositionId).slice(0, 18).map((placement) => ({ id: placement.id, labelId: placement.id, assetId: placement.assetId, start: placement.start, active: selectedPlacementId === placement.id, onClick: () => { setSelectedPlacementId(placement.id); setCurrentTime(placement.start); setActivePanel("clip"); } }));
  const deliveryStart = isPro ? timelineRange.inPoint ?? 0 : 0;
  const deliveryEnd = isPro ? timelineRange.outPoint ?? duration : duration;
  const deliveryDuration = Math.max(0, Math.abs(deliveryEnd - deliveryStart));
  const deliveryHasSequence = renderableSequence;
  const deliveryRangeValid = deliveryDuration >= 0.05;
  const deliveryRisk = assessRenderRisk(deliveryDuration, exportMaxDimension, exportFrameRate);
  void meterTick;
  const combinedMeter = (ids: string[]) => {
    if (!playing) return SILENT_READING;
    const readings = ids.map((id) => meterReadings.get(id) ?? SILENT_READING);
    const peak = Math.min(2, readings.reduce((sum, reading) => sum + reading.peak, 0));
    const rms = Math.min(2, Math.sqrt(readings.reduce((sum, reading) => sum + reading.rms ** 2, 0)));
    return { peak, rms, db: peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY, clipped: readings.some((reading) => reading.clipped) || peak >= 0.999 };
  };
  const masterMeter = combinedMeter(["main", ...audioClips.map((clip) => clip.id), ...nestedCompositionAudioPlan.clips.map((clip) => clip.id)]);
  const meterForTrack = (trackId: string) => combinedMeter(audioClips.filter((clip) => clip.trackId === trackId).map((clip) => clip.id));
  useEffect(() => {
    if (!playing || masterMeter.rms <= 0) return;
    const id = window.setTimeout(() => setLoudnessHistory((history) => [...history.slice(-899), masterMeter.rms]), 0);
    return () => window.clearTimeout(id);
  }, [masterMeter.rms, meterTick, playing]);
  const integratedLufs = estimateIntegratedLufs(loudnessHistory);
  const programAudioRevision = useMemo(() => JSON.stringify({
    source: mainFile ? [mainFile.size, mainFile.lastModified] : null,
    duration, masterGain, audioClips, audioTracks, audioBuses,
    nested: nestedCompositionAudioPlan,
  }), [mainFile, duration, masterGain, audioClips, audioTracks, audioBuses, nestedCompositionAudioPlan]);
  const currentProgramLoudnessReport = programLoudnessRevision === programAudioRevision ? programLoudnessReport : null;

  const analyzeFullProgramAudio = async () => {
    if (!mainFile && !audioClips.length && !nestedCompositionAudioPlan.clips.length && !nestedCompositionAudioPlan.issues.length) return setStatus("This sequence has no program audio to analyze.");
    setProgramLoudnessAnalyzing(true);
    setStatus("Rendering the complete post-mix audio program for offline loudness analysis…");
    const revision = programAudioRevision;
    try {
      const schedule = programAudioSchedule({ main: Boolean(mainFile), duration, masterGain, audioClips, audioTracks, audioBuses, composition: nestedCompositionAudioPlan });
      const usedAssetIds = new Set(schedule.map(clip => clip.assetId));
      const resolvedAssets = await Promise.all(assets.filter((asset) => usedAssetIds.has(asset.id)).map(async (asset) => [asset.id, await materializePathBackedFile(asset.file, asset.url)] as const));
      const fileById = new Map(resolvedAssets);
      const main = mainFile ? await materializePathBackedFile(mainFile, mainUrl) : null;
      const clips = schedule.map(clip => {
        const file = clip.assetId === null ? main : fileById.get(clip.assetId);
        if (!file) throw new Error("Program audio media is offline. Relink it before analysis.");
        return { ...clip, file };
      });
      const { mixAudioClips } = await import("../lib/render-engine");
      const mix = await mixAudioClips(clips, duration);
      const report = measureProgramLoudness(mix);
      setProgramLoudnessReport(report);
      setProgramLoudnessRevision(revision);
      setStatus(`Offline audio analysis complete · ${report.integratedLufs.toFixed(1)} LUFS · ${report.truePeakDbtp.toFixed(1)} dBTP · ${report.loudnessRangeLu.toFixed(1)} LU range.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Offline audio analysis failed: ${error.message}` : "Offline audio analysis failed.");
    } finally {
      setProgramLoudnessAnalyzing(false);
    }
  };

  // New Project screen: encoded frame size for the current canvas, and the
  // aspect-preview ratios the frame thumbnails draw themselves with.
  const newProjectDims = outputDimensions(sourceDims.w, sourceDims.h, exportMaxDimension, aspect, customSize);
  const newProject = async () => {
    if (!await projectSafety.confirmReplace() || !initialProject.current) return;
    await desktopMediaBridge()?.commitProjectDocument?.(null);
    sourceLoadRef.current++; videoRef.current?.pause(); setPlaying(false); setShuttleRate(0);
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    restoreSnapshot(structuredClone(initialProject.current)); clearHistory();
    setAssets([]); setMainFile(null); setMainUrl(""); setMainSourcePath(""); setMainName("Untitled project");
    setSourceDims({ w: 1280, h: 720 }); setAnalysis(null); setCurrentTime(0); setCompositionTime(0);
    setActiveProjectId("current"); setProjectNameDraft(""); setNewProjectOpen(true); projectSafety.markLoaded();
  };
  const startNewProject = () => {
    const name = projectNameDraft.trim();
    if (name) setMainName(name);
    setNewProjectOpen(false);
    setStatus(mainFile ? `Canvas set to ${ASPECT_LABELS[aspect]}.` : "Canvas ready — drop a song or video to begin.");
  };

  function openWorkspace(workspace: ProductWorkspace) {
    if (workspace === "auto") {
      setRenderQueueOpen(false);
      setColorBypass(false);
      setEditorMode("auto");
      return;
    }
    if (!isPro && workspace !== "edit") return;
    setEditorMode("pro");
    setRenderQueueOpen(workspace === "deliver");
    if (workspace !== "color") setColorBypass(false);
    if (workspace === "composition") {
      setWorkspaceView("composition");
      return;
    }
    setWorkspaceView("sequence");
    if (workspace === "color") {
      setProWorkspace("color");
      setShowScope(true);
      setActivePanel("track");
    } else if (workspace === "audio") {
      setProWorkspace("audio");
      setActivePanel("audio");
    } else {
      setProWorkspace("edit");
    }
  }

  const activeProductWorkspace = currentWorkspace({ editorMode, workspaceView, proWorkspace, renderQueueOpen });

  const productGuide = workspaceGuide({
    workspace: activeProductWorkspace,
    isPro,
    assetCount: assets.length,
    visualAssetCount: visualAssets.length,
    audioAssetCount: assets.filter((asset) => asset.kind === "audio").length,
    analyzed: Boolean(analysis),
    sequenceClipCount: videoClips.length,
    compositionCount: compositions.length,
    activeCompositionLayerCount: activeComposition?.layers.length ?? 0,
    hasAudioMix: audioClips.length > 0 || Boolean(mainFile),
    exportReady: deliveryHasSequence && deliveryRangeValid && selectedProfileSupported && !selectedProfileChecking,
    queuedRenderCount: renderQueue.filter((job) => isPendingRender(job.status)).length,
  });
  const activeMediaLayers = activeComposition?.layers.filter((layer) => layer.kind === "media" && activeCompTrackById.get(layer.trackId ?? "")?.kind !== "audio") ?? [];
  const compositionGuide = compositionWorkflowGuide({
    hasComposition: Boolean(activeComposition),
    visualAssetCount: visualAssets.length,
    layerCount: activeComposition?.layers.length ?? 0,
    mediaLayerCount: activeMediaLayers.length,
    selectedLayerKind: selectedCompLayer?.kind,
    selectedRotoPath: Boolean(selectedRotoPath?.length),
    selectedRotoFrameCount: selectedCompLayer?.roto?.keyframes.length ?? 0,
    isolatedSubject: Boolean(activeComposition?.id.startsWith("comp-subject-") || (activeComposition?.background === "rgba(0,0,0,0)" && activeComposition.layers.some((layer) => Boolean(layer.roto?.keyframes.length)))),
  });
  const renderEngineChecks = desktopHealthChecks({
    isDesktop: isPro && Boolean(desktopMediaBridge()),
    available: nativeCapabilities?.available,
    nativeSequenceRender: nativeCapabilities?.nativeSequenceRender,
    hardware: nativeCapabilities?.hardware,
    h264: nativeCapabilities?.encoders?.h264 ?? nativeCapabilities?.encoder,
    hevc: nativeCapabilities?.encoders?.hevc,
    transparentVideo: nativeCapabilities?.transparentVideo,
    queuedJobs: renderQueue.filter((job) => isPendingRender(job.status)).length,
    failedJobs: renderQueue.filter((job) => job.status === "failed").length,
  });
  const runJourneyAction = (action: JourneyAction) => {
    if (action === "import-media") assetInputRef.current?.click();
    else if (action === "make-auto-cut") { openWorkspace("auto"); void runAutoCut(); }
    else if (action === "open-edit") openWorkspace("edit");
    else if (action === "create-composition") { openWorkspace("composition"); createComposition(); }
    else if (action === "add-composition-media") addCompositionLayer("media");
    else if (action === "select-composition-media") {
      const mediaLayer = activeMediaLayers[0];
      if (mediaLayer) { setSelectedCompLayerId(mediaLayer.id); if (mediaLayer.trackId) setSelectedCompTrackId(mediaLayer.trackId); setSelectedKeyframeId(null); }
    }
    else if (action === "select-roto-subject") setRotoMode("select");
    else if (action === "track-roto-subject") void trackRotoSubject("all");
    else if (action === "isolate-roto-subject") createSubjectComposition();
    else if (action === "add-composition-to-master" && activeComposition) addCompositionToSequence(activeComposition.id);
    else if (action === "open-color") openWorkspace("color");
    else if (action === "open-audio") openWorkspace("audio");
    else if (action === "open-deliver") {
      if (isPro) openWorkspace("deliver");
      else queueExport();
    }
    else if (action === "queue-master") queueExport();
  };

  const autoReview = (part: "settings" | "review") => <AutoEditReviewPanel previewSourceSize={{ width: sourceDims.w, height: sourceDims.h }} previewAssets={visualAssets.map(a => ({ id: a.id, url: a.proxyUrl ?? a.url, kind: a.kind as "image" | "video" }))} mainVisualUrl={!mainIsAudio ? mainUrl : ""} part={part} policy={autoPolicy} change={p=>{checkpoint();setAutoPolicy(p);}} disabled={analyzing || rendering || transcribing} timingReason={resolveAutoTiming(autoPolicy.timing,mainIsAudio,Boolean(analysis && hasReliableRhythm(analysis)),transcriptWords.length>0).reason} sources={[...(mainFile?[{id:MAIN_SOURCE_ID,name:mainName,duration:analysis?.duration ?? duration}]:[]),...visualAssets]} versions={autoVersions} apply={applyReviewedAutoVersion} discard={id=>{checkpoint();setAutoVersions(v=>v.filter(x=>x.id!==id));}} sourceUrl={!mainIsAudio?mainUrl:undefined} boundaries={analysis?.sceneCuts ?? []} transitionCandidates={analysis?.transitionCandidates ?? []} boundary={editSceneBoundary} />;
  const previewStage = (emptyState: React.ReactNode, delivery = false) => <EditorPreviewStage
    auditionEnabled={!delivery}
    emptyState={emptyState} mediaRef={videoRef} mainUrl={mainUrl} mainIsAudio={mainIsAudio} mainName={mainName}
    assets={assets} placements={placements} compositions={compositions} tracks={clipTracks} baseCuts={baseCuts}
    montageEnabled={montageEnabled}
    includeProAudio={isPro} includeCompositionAudio={isPro && workspaceView === "sequence"}
    audioClips={audioClips} audioTracks={audioTracks} audioBuses={audioBuses} masterGain={masterGain}
    currentTime={currentTime} playing={playing} motion={renderMotion()} transition={TRANSITION_PRESETS[transitionType]}
    grade={delivery ? hasShaderEffect ? { params: gradeParams, beatDriven: true } : null : previewGrade} strobe={strobeSetting} stutter={stutterSetting} speed={speedSetting}
    dropRamp={dropRampSetting} echo={echoSetting} titles={titles} width={previewDims.width} height={previewDims.height}
    quality={previewQuality} onPerformance={setPreviewPerformance} onMeter={publishMeter}
    energyBars={energyBars} showScope={!delivery && showScope} scopeCanvasRef={scopeCanvasRef}
  />;
  const saveProjectAction = (): Promise<boolean> => isPro && desktopMediaBridge() ? saveDesktopProjectDocument() : saveCurrentProject();
  const projectSafety = useProjectSafety({ ...snapshot(), ...projectSettings(), assets, mainFile, mainName }, analyzing || rendering || rotoTracking.active, saveProjectAction);
  const keyboardContext = { markMonitorBoundary, stepMonitorFrame, deleteTimelineSelection, addMarker, audioClips, audioTracks, baseCuts, checkpoint, commandPaletteOpen, compositionTime, currentTime, deleteCompositionKeyframe, duration, dynamicTrimSelection, editSourceToTimeline, editorMode, exportFrameRate, extractInOut, groupCurrentSelection, isPro, linkedSelection, matchFrameAtPlayhead, monitorMode, multicamAssets, nudgeProfessionalEdit, openDesktopProjectDocument, openWorkspace, placements, recordLiveMulticamSwitch, redo, removeCompositionLayer, rotoMode, rotoStrokeRef, saveCurrentProject, saveDesktopProjectDocument, seek, seekComposition, selectedAudioClipId, selectedBaseCut, selectedBaseCutId, selectedBaseCutIds, selectedCompLayer, selectedKeyframeId, selectedPlacement, selectedPlacementId, selectedTrackId, setActivePanel, setAudioClips, setBaseCuts, setCommandPaletteOpen, setCommandSearch, setDynamicTrimSelection, setPlacements, setRotoMode, setRotoStrokePreview, setSelectedAudioClipId, setSelectedAutomationPointId, setSelectedBaseCutId, setSelectedBaseCutIds, setSelectedPlacementId, setStatus, setTimelineRange, setTimelineTool, shuttle, sourceVideoRef, splitPlacementAt, splitSelectedBaseCut, stepDynamicTrim, stopShuttle, togglePlayback, undo, ungroupCurrentSelection, workspaceView, clipTracks };
  const editing = useEditorEditActions({ ...keyboardContext, busy: analyzing || rendering || rotoTracking.active, activePanel, activeComposition, compositions, selectedCompTrackId, setSelectedCompLayerId, updateComposition });
  const sourceTransport = useSourceTransport(sourceVideoRef, sourceAssetId ?? "", monitorMode === "source" && workspaceView === "sequence", setStatus);
  const sourceActive = editorMode === "pro" && workspaceView === "sequence" && monitorMode === "source";
  const runPlayback = () => { void (sourceActive ? sourceTransport.toggle() : togglePlayback()).catch((error) => setStatus("Playback failed: " + (error instanceof Error ? error.message : String(error)))); };
  const commandItems = buildEditorCommandItems({
    ...editing.actions,
    "new-project": () => void newProject(), "import-media": () => assetInputRef.current?.click(),
    undo, redo,
    "play-pause": runPlayback, "stop": () => sourceActive ? sourceTransport.stop() : stopShuttle(),
    "shuttle-reverse": () => void (sourceActive ? sourceTransport.shuttle(-1) : shuttle(-1)),
    "shuttle-forward": () => void (sourceActive ? sourceTransport.shuttle(1) : shuttle(1)),
    "step-back": () => stepMonitorFrame(-1), "step-forward": () => stepMonitorFrame(1),
    "step-back-second": () => stepMonitorFrame(-1, true), "step-forward-second": () => stepMonitorFrame(1, true),
    "mark-in": () => markMonitorBoundary("in"), "mark-out": () => markMonitorBoundary("out"),
    "source-insert": () => editSourceToTimeline("insert"), "source-overwrite": () => editSourceToTimeline("overwrite"),
    "new-composition": createComposition,
    "tool-rate": () => { openWorkspace("edit"); setTimelineTool("rate"); },
    "tool-hand": () => { openWorkspace("edit"); setTimelineTool("hand"); },
    "tool-zoom": () => { openWorkspace("edit"); setTimelineTool("zoom"); },
    "open-auto": () => openWorkspace("auto"), "open-edit": () => openWorkspace("edit"),
    "open-composition": () => openWorkspace("composition"), "open-color": () => openWorkspace("color"),
    "open-audio": () => openWorkspace("audio"), "open-deliver": () => openWorkspace("deliver"),
    "save-project": () => void saveProjectAction(), "open-disk-project": () => void openDesktopProjectDocument(),
    "save-disk-project-as": () => void saveDesktopProjectDocument(true), "import-extension-pack": () => extensionPackInputRef.current?.click(),
    "export-extension-pack": exportCreatorExtensionPack, "queue-master": queueExport, "generate-alternatives": generateAutoVariations,
    "tool-select": () => { openWorkspace("edit"); setTimelineTool("select"); }, "tool-razor": () => { openWorkspace("edit"); setTimelineTool("razor"); },
    "tool-slip": () => { openWorkspace("edit"); setTimelineTool("slip"); }, "tool-slide": () => { openWorkspace("edit"); setTimelineTool("slide"); },
    "tool-roll": () => { openWorkspace("edit"); setTimelineTool("roll"); }, "tool-fade": () => { openWorkspace("edit"); setTimelineTool("fade"); },
    "add-marker": addMarker, "extract-range": extractInOut, "fit-to-fill": fitSelectedToRange, "close-gaps": closeAllTimelineGaps,
    "match-frame": matchFrameAtPlayhead, "group-selection": groupCurrentSelection, "ungroup-selection": ungroupCurrentSelection,
    "nest-selection": nestSelection,
    "select-all": () => { setSelectedBaseCutIds(baseCuts.map((cut) => cut.id)); setSelectedBaseCutId(baseCuts[0]?.id ?? null); },
    "deselect": () => { setSelectedBaseCutId(null); setSelectedBaseCutIds([]); setSelectedPlacementId(null); setSelectedAudioClipId(null); },
    "replace-edit": replaceSelectedFromSource, "build-multicam": buildMulticamPass,
    "import-captions": () => captionInputRef.current?.click(), "export-captions": exportCaptionSidecar,
    "remove-dialogue-silence": removeDialogueSilence, "export-edl": () => exportInterchange("edl"),
    "export-fcpxml": () => exportInterchange("fcpxml"), "export-otio": () => exportInterchange("otio"),
    "collect-media": () => void collectDesktopProject(), "queue-social": queueSocialVersions,
  }, isPro, {
    undo: canUndo && !rendering && !analyzing, redo: canRedo && !rendering && !analyzing,
    copy: editing.hasSelection, cut: editing.hasSelection && !editing.locked && !rendering && !analyzing,
    paste: !rendering && !analyzing, duplicate: editing.hasSelection && !editing.locked && !rendering && !analyzing,
    delete: editing.hasSelection && !editing.locked && !rendering && !analyzing,
    "ripple-delete": workspaceView === "sequence" && editing.hasSelection && !editing.locked && !rendering && !analyzing,
    split: workspaceView === "sequence" && Boolean(selectedBaseCut || selectedPlacement || selectedAudioClip) && !editing.locked && !rendering && !analyzing,
    "source-insert": sourceActive && Boolean(sourceAsset && sourceAsset.kind !== "audio") && !rendering,
    "source-overwrite": sourceActive && Boolean(sourceAsset && sourceAsset.kind !== "audio") && !rendering,
    "new-project": !rendering && !analyzing, "import-media": !rendering && !analyzing,
    "new-composition": !analyzing && !rendering,
    "queue-master": renderableSequence && !analyzing && selectedProfileSupported && !selectedProfileChecking,
    "queue-social": renderableSequence && !analyzing,
    "save-project": !analyzing && !rendering,
    "open-disk-project": Boolean(desktopMediaBridge()) && !analyzing && !rendering,
    "save-disk-project-as": Boolean(desktopMediaBridge()) && !rendering,
    "collect-media": Boolean(desktopMediaBridge()) && assets.length > 0,
    "fit-to-fill": Boolean(selectedBaseCut && timelineRange.inPoint !== null && timelineRange.outPoint !== null),
    "extract-range": timelineRange.inPoint !== null && timelineRange.outPoint !== null,
    "close-gaps": baseCuts.length > 0,
    "group-selection": selectedBaseCutIds.length > 1,
    "ungroup-selection": Boolean(selectedBaseCut?.groupId),
    "nest-selection": Boolean(selectedBaseCut || selectedPlacement),
    "select-all": workspaceView === "sequence" && baseCuts.length > 0,
    "export-captions": titles.length > 0,
    "replace-edit": Boolean(selectedBaseCut && sourceAssetId),
    "build-multicam": multicamAssets.length >= 2,
  });
  const runCommand = (id: import("./editor-command-registry").EditorCommandId) => commandItems.find((item) => item.id === id)?.run();
  useEditorKeyboardShortcuts(keyboardContext, commandItems);
  const contextActions = createEditorContextActions({ runCommand, analyzing, rendering, rotoTracking, selectedAudioClip, audioTracks, checkpoint, setAudioClips, setSelectedAudioClipId, setSelectedAutomationPointId, selectedPlacement, clipTracks, setPlacements, setSelectedPlacementId, selectedBaseCut, baseCuts, selectedBaseCutIds, linkedSelection, audioClips, setStatus, setBaseCuts, setSelectedBaseCutId, setSelectedBaseCutIds, setActivePanel, placements, setSelectedTrackId, setSelectedAudioTrackId, activeComposition, setSelectedCompLayerId, setSelectedCompTrackId, setSelectedKeyframeId, selectedBaseCutId, selectedPlacementId, updateBaseCut, updatePlacement, mediaName, razorAt, currentTime, splitPlacementAt, setProjectPanelTab, isPro, nestSelection, setClipTracks, addClipTrack, moveClipTrackTo, removeClipTrack, addAudioTrack, updateAudioTrackById, moveAudioTrackTo, removeAudioTrack, updateAudioClip, crossfadeSelectedAudio, assets, openSourceAsset, setAssets, cancelProxy, buildProxy, nativeProxyJobByAssetRef, removeAsset, activeCompTrackById, addCompositionKeyframe, setCompositionLayerFlags, removeCompositionLayer, addCompositionTrack, updateCompositionTrack, moveCompositionTrack, removeCompositionTrack, mainName, editableBaseCuts, setMontageEnabled, mainFile, duration, createComposition, addMarker, undo, canUndo, redo, canRedo });
  const { selectContextTarget, buildContextMenu } = contextActions;
  function deleteTimelineSelection(ripple = false, target?: "base" | "overlay" | "audio") { contextActions.deleteTimelineSelection(ripple, target); }
  if (mobileViewport && !isPro) return <Suspense fallback={<div className="editor-boot" role="status"><strong>SCENEPILOT</strong><span>Opening your pocket studio…</span></div>}>
    <MobileStudio {...{ mainUrl, mainName, mainIsAudio, mainInputRef, assetInputRef, selectMainMedia, selectAssets, assets, analysis, analyzing, rendering, renderProgress, renderableSequence, previewStage, previewRef, currentTime, duration, playing, seek, togglePlayback, styleId, applyStyle, checkpoint, setStyleId, aspect, setAspect, status, autoEnergy, chooseAutoEnergy, montagePace, changeMontagePace, bpm, titleDraft, setTitleDraft, addTitle, titles, removeTitle, exportPlan, transcribing, baseCuts, canUndo, canRedo, energyBars }}
      onUndo={() => runCommand("undo")} onRedo={() => runCommand("redo")} onSave={saveProjectAction} onRestore={() => restoreCurrentProject()}
      onPause={stopShuttle} browserDownload={browserExport.download} onDismissDownload={browserExport.dismiss}
      missingMediaCount={mobileMissingMediaCount}
      onImportProject={async file => { if (await projectSafety.confirmReplace()) await importPlan(file, assets, false, true); }}
      onLoadSample={loadMainMedia} onGenerate={runAutoCut} onSplit={() => razorAt(currentTime)}
      onFullscreen={toggleFullscreen} onExport={() => queueExport()} onCancelAnalysis={() => analysisAbortRef.current?.abort()} onCancelRender={() => renderAbortRef.current?.abort()}
      canCancelTranscription={autoCutTranscribing}
      analysisPercent={overallAnalysisProgress} analysisMessage={analysisProgress?.message ?? ""}
      exportReady={selectedProfileSupported && !selectedProfileChecking} exportMessage={selectedProfileMessage}
      dimensions={newProjectDims} previewAspect={previewDims.width / previewDims.height}
      automationControls={autoReview("settings")} draftReview={autoReview("review")}
      lightingControls={<StrobeTimingControls timing={strobeTiming} bpm={strobeBpm} songBpm={bpm} preset={strobePreset}
        disabled={analyzing || rendering || transcribing} analyzed={Boolean(analysis)} limited={strobeSafeMode} flashes={strobeFireTimes.length}
        inputHandlers={continuousEditHandlers} onBpm={setStrobeBpm}
        onTiming={value => { checkpoint(); setStrobeTiming(value); if (value === "custom" && strobePreset === "drums") applyStrobePreset("rave"); }}
        onPreset={value => { checkpoint(); applyStrobePreset(value); }} />} />
  </Suspense>;
  return (
    <EditorContextMenuBoundary select={selectContextTarget} build={buildContextMenu}>
    <StudioShell workspace={activeProductWorkspace} hasInspectorTarget={Boolean(activePanel === "base" ? selectedBaseCut : activePanel === "clip" ? selectedPlacement : activePanel === "audio" ? selectedAudioTrack : activePanel === "track" ? selectedTrack : selectedSection)} className={`studio-shell ${isPro ? "pro-shell" : "lite-shell"} mode-${editorMode} view-${workspaceView} ${editorMode === "pro" && workspaceView === "sequence" ? `workspace-${proWorkspace}` : ""} ${renderQueueOpen ? "mode-deliver" : ""}`}>
      <StudioTopbar onExportPremiere={baseCuts.length ? exportPremiere : undefined} lockerItem={[lastRender, lastHandoff].filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => b.at - a.at)[0] ?? null} embedded={embedded} isPro={isPro} capabilities={capabilities} title={editorMode === "auto" ? "Auto Edit" : workspaceView === "composition" ? activeComposition?.name : `Sequence 01 · ${mainName}`}
        projects={projectLibrary} activeProjectId={activeProjectId} analyzing={analyzing} rendering={rendering} canUndo={canUndo} canRedo={canRedo} queueOpen={renderQueueOpen} queueLength={renderQueue.length}
        renderableSequence={renderableSequence} selectedProfileChecking={selectedProfileChecking} selectedProfileSupported={selectedProfileSupported} renderProgress={renderProgress}
        onProjectChange={(projectId) => void restoreCurrentProject(projectId)} onNewProject={() => void newProject()} onOpenCommands={() => { setCommandPaletteOpen(true); setCommandSearch(""); }}
        onRestoreProject={() => void restoreCurrentProject()} onOpenRecovery={() => void toggleRecoveryHistory()} onSave={() => void saveProjectAction()} onUndo={() => runCommand("undo")} onRedo={() => runCommand("redo")} onOpenQueue={() => openWorkspace("deliver")} onExport={queueExport} dirty={projectSafety.dirty} />
      <input ref={captionInputRef} hidden type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" onChange={(event) => { void importCaptionFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      <input ref={lutInputRef} hidden type="file" accept=".cube" onChange={(event) => { void creativeLut.importFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      <input ref={extensionPackInputRef} hidden type="file" accept=".json,.scenepilot-pack.json,application/json,application/vnd.scenepilot.extension+json" onChange={(event) => { void importExtensionPack(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      <input ref={effectPluginInputRef} hidden type="file" accept=".json,.scenepilot-effect.json,application/json,application/vnd.scenepilot.effect+json" onChange={(event) => { void importEffectPlugin(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />

      <Suspense fallback={<div className="shell-loading" role="status"><Activity size={18} /> Loading workspace…</div>}>
      {newProjectOpen && <NewProjectDialog projectName={projectNameDraft} aspect={aspect} customSize={customSize} capabilities={capabilities} frameRate={exportFrameRate} maxDimension={exportMaxDimension} dimensions={newProjectDims} hasMainFile={Boolean(mainFile)} onClose={() => setNewProjectOpen(false)} onStart={startNewProject} onProjectNameChange={setProjectNameDraft} onAspectChange={(value) => { checkpoint(); setAspect(value); }} onCustomSizeChange={setCustomSize} onFrameRateChange={setExportFrameRate} onMaxDimensionChange={setExportMaxDimension} />}
      {newCompositionDraft && <NewCompositionDialog initial={newCompositionDraft.settings} sourceName={newCompositionDraft.source?.name} frameRate={exportFrameRate} onClose={closeCompositionDialog} onCreate={finishCreateComposition} />}

      {commandPaletteOpen && <CommandPalette search={commandSearch} items={commandItems} onSearchChange={setCommandSearch} onClose={() => setCommandPaletteOpen(false)} />}

      {isPro && recoveryOpen && <RecoveryHistoryPanel revisions={recoveryRevisions} onRestore={restoreRecoveryRevision} onClose={() => setRecoveryOpen(false)} onOpenDisk={() => void openDesktopProjectDocument(true)} />}

      <WorkspaceModebar
        workspace={activeProductWorkspace}
        isPro={isPro}
        projectName={mainName}
        projectKind={isPro ? "DESKTOP PROJECT" : "BROWSER PROJECT"}
        bpm={bpm}
        sequenceItemCount={videoClips.length}
        videoTrackCount={clipTracks.length + 1}
        activeCompositionName={activeComposition?.name}
        activeCompositionLayerCount={activeComposition?.layers.length ?? 0}
        activeCompositionDuration={activeComposition?.duration ?? 0}
        guide={productGuide}
        onOpen={openWorkspace}
        onGuideAction={() => runJourneyAction(productGuide.action)}
      />

      {isPro && editorMode === "pro" && !renderQueueOpen && <EditorDocumentTabs
        projectId={activeProjectId}
        onRenameComposition={(id, name) => { checkpoint(); setCompositions(items => items.map(c => c.id === id ? { ...c, name } : c)); }}
        projectName={mainName}
        compositions={compositions}
        activeView={workspaceView}
        activeCompositionId={activeComposition?.id}
        onOpenMaster={() => { openMainSequence(); setProWorkspace("edit"); }}
        onOpenComposition={openComposition}
        onCreateComposition={createComposition}
      />}

      {analyzing && analysisProgress && <AnalysisProgressDock progress={analysisProgress} overall={overallAnalysisProgress} elapsed={analysisElapsed} eta={analysisEta} onCancel={() => analysisAbortRef.current?.abort()} />}

      {editorMode === "auto" ? (
        <AutoDirectorWorkspace strobeTiming={strobeTiming} strobeBpm={strobeBpm} setStrobeTiming={setStrobeTiming} setStrobeBpm={setStrobeBpm} {...{ addTitle, analysis, analysisAbortRef, analyzeProjectLibrary, analyzing, applyAutoVariation, applyBeatGrid, applyCinematicAssembly, applyProjectAssembly, applyStrobePreset, applyStyle, aspect, assetInputRef, assets, audioReactive, autoEnergy, autoPreviewLabel, autoTimeLyrics, autoVariations, baseCuts, beatOffset, bpm, capabilities, captionInputRef, changeMontagePace, checkpoint, chooseAutoEnergy, chooseCreatorGoal, collectDesktopProject, continuousEditHandlers, creatorGoal, currentTime, deepProjectAnalyzing, directorArc, dragActive, dropMain, dropRampEnabled, duration, echoPreset, editCommandDraft, energyArc, exportFrameRate, exportInterchange, exportMaxDimension, exportPlan, generateAutoVariations, importPlan, inferredCreatorGoal, inspectProjectAsset, isPro, lookPreset, lyricDensity, lyricsDraft, mainFile, mainInputRef, mainIsAudio, mainName, mainUrl, manualDropTime, manualGrade, mirrorMode, montageEnabled, montagePace, openDesktopProjectDocument, placements, planInputRef, playing, previewRef, previewStage, projectIntelligence, punchPreset, rawStrobeFireTimes, removeDialogueSilence, removeTitle, renderAbortRef, renderProgress, renderSupport, renderableSequence, rendering, rerollMontage, resetBeatGrid, runAutoCut, runEditCommand, saveDesktopProjectDocument, sections, seek, selectAssets, selectMainMedia, selectedSection, selectedSectionHitCount, setActivePanel, setAspect, setAudioReactive, setDragActive, setDropRampEnabled, setEchoPreset, setEditCommandDraft, setEditorMode, setExportFrameRate, setExportMaxDimension, setLookPreset, setLyricDensity, setLyricsDraft, setManualDropTime, setManualGrade, setMirrorMode, setMontageEnabled, setPunchPreset, setSelectedSectionId, setShakePreset, setSpeedPreset, setStatus, setStreak, setStrobeAlternate, setStrobeAngle, setStrobeAttack, setStrobeBand, setStrobeBlend, setStrobeColor, setStrobeDecay, setStrobeHold, setStrobeIntensity, setStrobeMode, setStrobeSafeMode, setStrobeSecondaryColor, setStrobeSensitivity, setStrobeShape, setStrobeSize, setStrobeSoftness, setStrobeX, setStrobeY, setStutterPreset, setStyleId, setTitleAnimator, setTitleDraft, setTitleStyle, setTitles, setTransitionType, setWorkspaceView, shakePreset, speedConfig, speedPreset, status, storyBrief, streak, strobeAlternate, strobeAngle, strobeAttack, strobeBand, strobeBlend, strobeColor, strobeDecay, strobeFireTimes, strobeHold, strobeIntensity, strobeMode, strobePreset, strobeSafeMode, strobeSafety, strobeSecondaryColor, strobeSensitivity, strobeShape, strobeSize, strobeSoftness, strobeX, strobeY, stutterConfig, stutterPreset, styleId, titleAnimator, titleDraft, titleStyle, titles, togglePlayback, transcribeVocalsToLyrics, transcribing, transitionType, updateSection }} setStoryBrief={updateStoryBrief} canCancelTranscription={autoCutTranscribing} automationControls={autoReview("settings")} draftReview={autoReview("review")}
          creativeLut={creativeLut.summary} openLutImport={creativeLut.open} removeLut={creativeLut.remove} setLutMix={setLut3dMix} />
      ) : renderQueueOpen ? (
        <DeliveryWorkspace
          preview={previewStage(<div className="delivery-empty-preview">Your sequence preview appears here after adding media.</div>, true)}
          playing={playing} onTogglePlayback={() => { void togglePlayback(); }} onSeek={seek}
          exportFormat={exportFormat} maxDimension={exportMaxDimension} frameRate={exportFrameRate} aspect={aspect}
          timelineRange={timelineRange} currentTime={currentTime} duration={duration} deliveryStart={deliveryStart} deliveryEnd={deliveryEnd} deliveryDuration={deliveryDuration}
          deliveryHasSequence={deliveryHasSequence} deliveryRangeValid={deliveryRangeValid} deliveryRisk={deliveryRisk} renderEngineChecks={renderEngineChecks}
          previewDimensions={previewDims} mainName={mainName} hasMainFile={Boolean(mainFile)} hasCompositionVisuals={hasCompositionTimelineContent} shotCount={baseCuts.length || placementShotCount || (hasCompositionTimelineContent ? placements.length : 0)} placementCount={placements.length}
          audioTrackCount={audioTracks.length} audioClipCount={audioClips.length} hasAudio={Boolean(mainFile || audioClips.length || nestedCompositionAudioPlan.clips.length)}
          integratedLufs={integratedLufs} peakDb={masterMeter.db} audioSampleCount={loudnessHistory.length} offlineAudioReport={currentProgramLoudnessReport} offlineAudioAnalyzing={programLoudnessAnalyzing} analyzing={analyzing} rendering={rendering}
          selectedProfileSupported={selectedProfileSupported} selectedProfileChecking={selectedProfileChecking} selectedProfileMessage={selectedProfileMessage} exportProfileSupport={exportProfileSupport}
          jobs={renderQueue} queuePaused={renderQueuePaused} hardwareStatus={hardwareStatus}
          onFormatChange={setExportFormat} onMaxDimensionChange={setExportMaxDimension} onFrameRateChange={setExportFrameRate} onAspectChange={setAspect} onRangeChange={setTimelineRange}
          onReturnToEdit={() => openWorkspace("edit")} onQueueExport={queueExport} onQueueSocialVersions={queueSocialVersions} onQueueAudioStems={queueAudioStems} onToggleQueuePaused={() => setRenderQueuePaused((value) => !value)}
          onReveal={(job) => void revealRenderOutput(job)} onRetry={retryRenderJob} onRemove={(jobId) => setRenderQueue((items) => items.filter((item) => item.id !== jobId))}
          onClearFinished={() => setRenderQueue((items) => items.filter((job) => job.status !== "completed" && job.status !== "canceled"))} onCancelActive={() => renderAbortRef.current?.abort()}
          onAnalyzeAudio={() => void analyzeFullProgramAudio()}
        />
      ) : (
      <>
      {workspaceView === "sequence" ? (
      <>
      <section className="workspace">
        {isPro && <WorkspaceResizers />}
        <aside className={`sequence-project panel-${projectPanelTab}`}>
          <ProjectPanelTabs value={projectPanelTab} mediaCount={assets.length + (isPro ? compositions.length : 0)} effectCount={Object.keys(CLIP_EFFECT_DEFINITIONS).length} compositionCount={compositions.length} transcriptCount={transcriptWords.length} showTranscript={isPro} dimensions={newProjectDims} frameRate={exportFrameRate} onChange={setProjectPanelTab} onCreateComposition={createComposition} canCreateComposition={isPro && !analyzing && !rendering} onDropCompositionSource={dropCompositionSource} />
          {projectPanelTab === "transcript" && <TranscriptEditor words={transcriptWords} selectedIds={selectedTranscriptIds} query={transcriptQuery} currentTime={currentTime} busy={transcribing || analyzing || rendering}
            onQuery={setTranscriptQuery} onSelect={selectTranscriptWord} onSeek={seek}
            onSelectAll={(ids) => { setSelectedTranscriptIds(new Set(ids)); transcriptSelectionAnchorRef.current = ids[0] ?? null; }}
            onClearSelection={() => { setSelectedTranscriptIds(new Set()); transcriptSelectionAnchorRef.current = null; }}
            onDelete={deleteTranscriptSelection} onTranscribe={() => void transcribeEditForText()} />}
          {projectPanelTab === "effects" && <EffectsBrowser base={selectedBaseCut} overlay={selectedPlacement} overlayName={selectedPlacementComposition?.name} locked={!!selectedTrack?.locked} mediaName={mediaName} onApply={addClipEffect} onApplyRecipe={applyClipEffectRecipe} />}
          {projectPanelTab === "project" && proWorkspace === "color" && (
            <div className="workspace-side-dashboard color-room-sidebar">
              <div className="panel-head">
                <div><Palette size={16} /><strong>Color room</strong><span>sequence-wide finishing</span></div>
                <button className={`bypass-button ${colorBypass ? "active" : ""}`} onClick={() => setColorBypass((value) => !value)}>{colorBypass ? "GRADE OFF" : "COMPARE"}</button>
              </div>
              <div className="workspace-side-section">
                <div className="side-section-title"><span>LOOK PIPELINE</span><small>{lookPreset.toUpperCase()}</small></div>
                <div className="color-look-stack">
                  {(["none", "cinematic", "neon", "vhs", "noir"] as const).map((look) => (
                    <button key={look} className={lookPreset === look ? "active" : ""} onClick={() => { checkpoint(); setLookPreset(look); setColorBypass(false); }}>
                      <i className={`look-swatch ${look}`} /><span><strong>{look === "none" ? "Clean source" : look}</strong><small>{look === "none" ? "Neutral starting point" : look === "cinematic" ? "Filmic contrast and warmth" : look === "neon" ? "Saturated glow and cool tone" : look === "vhs" ? "Analog texture and split" : "Monochrome high contrast"}</small></span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="workspace-side-section">
                <div className="side-section-title"><span>TONE CURVE</span><small>{colorCurve === "none" ? "OFF" : colorCurve.toUpperCase()}</small></div>
                <div className="curve-preset-row">
                  {(Object.keys(CURVE_PRESETS) as Array<keyof typeof CURVE_PRESETS>).map((key) => (
                    <button key={key} className={colorCurve === key ? "active" : ""} onClick={() => { checkpoint(); setColorCurve(key); setColorBypass(false); }}>
                      {key === "none" ? "Off" : key === "filmFade" ? "Film fade" : key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="workspace-side-section">
                <div className="side-section-title"><span>CREATIVE LUT</span><small>{lut3dSource ? `${lut3dSource.lut.dimensions}D · ${lut3dSource.lut.size}` : "NONE"}</small></div>
                <div className="lut-controls">
                  <button className="lut-import" onClick={creativeLut.open}><Upload size={13} /> {lut3dSource ? lut3dSource.name : "Import .cube LUT"}</button>
                  {lut3dSource && (
                    <>
                      <label className="lut-mix"><span>Mix</span><input type="range" min="0" max="1" step="0.01" value={lut3dMix} onChange={(event) => setLut3dMix(Number(event.target.value))} /><strong>{Math.round(lut3dMix * 100)}%</strong></label>
                      <button className="lut-remove" onClick={creativeLut.remove}>Remove LUT</button>
                    </>
                  )}
                </div>
              </div>
              <div className="workspace-side-section color-utility-grid">
                <button onClick={() => { checkpoint(); setManualGrade({ ...NEUTRAL_GRADE_ADJUST, exposure: 1.04, contrast: 1.06, saturation: 1.03, temperature: 0.02 }); setColorBypass(false); setStatus("Quick balance applied to the sequence grade."); }}><WandSparkles size={13} /> Quick balance</button>
                <button disabled={colorShotCount < 2} onClick={matchShotColors} title="Even out exposure and colour across the montage's shots"><Palette size={13} /> Match shots</button>
                <button disabled={!colorShotCount} onClick={autoWhiteBalance} title="Neutralise the montage's overall colour cast"><WandSparkles size={13} /> Auto WB</button>
                <button onClick={() => { setGradeClipboard({ look: lookPreset, grade: structuredClone(manualGrade) }); setStatus("Color grade copied inside this project."); }}><Copy size={13} /> Copy grade</button>
                <button disabled={!gradeClipboard} onClick={() => { if (!gradeClipboard) return; checkpoint(); setLookPreset(gradeClipboard.look); setManualGrade(structuredClone(gradeClipboard.grade)); setColorBypass(false); setStatus("Copied color grade applied."); }}><Palette size={13} /> Paste grade</button>
                <button onClick={() => { checkpoint(); setLookPreset("none"); setManualGrade(NEUTRAL_GRADE_ADJUST); setColorCurve("none"); setColorBypass(false); }}><RotateCcw size={13} /> Reset all</button>
              </div>
              <div className="workspace-side-section shot-browser">
                <div className="side-section-title"><span>SHOT MATCH</span><small>{colorShotCount} {baseCuts.length ? "cuts" : "shots"}</small></div>
                {colorShotBrowserItems.map((item, index) => (
                  <button key={item.id} className={item.active ? "active" : ""} onClick={item.onClick}>
                    <span>{String(index + 1).padStart(2, "0")}</span><i style={{ background: mediaColor(item.assetId) ?? "#65728a" }} /><strong>{mediaName(item.assetId) ?? "Offline clip"}</strong><small>{formatTimecode(item.start, exportFrameRate)}</small>
                  </button>
                ))}
                {!colorShotCount && <p>Build a sequence in Auto Edit or Edit to populate shot matching.</p>}
              </div>
            </div>
          )}

          {projectPanelTab === "project" && proWorkspace === "audio" && (
            <AudioMixerSidebar tracks={audioTracks} buses={audioBuses} clips={audioClips} selectedTrackId={selectedAudioTrackId} selectedClip={selectedAudioClip}
              masterGain={masterGain} masterMeter={masterMeter} integratedLufs={integratedLufs} playing={playing} inputHandlers={continuousEditHandlers}
              meterForTrack={meterForTrack} onAddTrack={addAudioTrack} onRemoveTrack={removeAudioTrack} onSelectTrack={(id) => { setSelectedAudioTrackId(id); setActivePanel("audio"); }}
              onMasterGain={setMasterGain} onBusesChange={(update) => setAudioBuses(update)} onTrackChange={updateAudioTrackById}
              onUnity={setSelectedAudioClipUnity} onFades={applySelectedAudioFade} onDuck={duckOtherAudioUnderSelection}
              songSync={<SongSyncPanel clips={audioClips} tracks={audioTracks} assets={assets} selected={selectedAudioClip} time={currentTime}
              onSelect={id => { setSelectedAudioClipId(id || null); setSelectedAudioTrackId(audioClips.find(c => c.id === id)?.trackId ?? selectedAudioTrackId); }}
              onMap={(assetId, beatMap) => { checkpoint(); setAssets(items => items.map(a => a.id === assetId ? { ...a, beatMap } : a)); setAudioClips(items => items.map(c => c.assetId === assetId ? { ...c, beatMap } : c)); }}
              onSync={(_before, after, asset) => { checkpoint(); setPlaying(false); setAssets(items => [...items, asset]); setAudioClips(items => items.map(c => after.find(next => next.id === c.id) ?? c)); setStatus("Song sync prepared. Original media retained. Save the project to retain its new audio asset."); }} />} />
          )}

          {projectPanelTab === "project" && <MediaBrowser onCreateCompositionFromAsset={beginCompositionFromSource} projectName={mainName} assets={assets} visibleAssets={visibleAssets} bins={mediaBins} activeBinId={activeBinId} sourceAssetId={sourceAssetId}
            search={mediaSearch} kindFilter={mediaKindFilter} sort={mediaSort} view={mediaView} smartFilter={smartFilter} showSmartFilters={Boolean(isPro && analysis)}
            isPro={isPro} disabled={analyzing || rendering} nativeMediaAvailable={nativeMediaAvailable} usage={mediaUsage} inputRef={assetInputRef}
            canCancelProxy={(id) => nativeProxyJobByAssetRef.current.has(id)} onImport={selectAssets} onAddBin={addMediaBin} onSearch={setMediaSearch}
            onKindFilter={setMediaKindFilter} onSort={setMediaSort} onView={setMediaView} onActiveBin={setActiveBinId} onSmartFilter={setSmartFilter}
            onOpen={openSourceAsset} onBuildProxy={(id) => { void buildProxy(id); }} onCancelProxy={(id) => { void cancelProxy(id); }} onMoveToBin={moveAssetToBin}
            onToggleFavorite={(id) => setAssets((items) => items.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item))} onRemove={removeAsset} />}
          {isPro && projectPanelTab !== "transcript" && projectPanelTab !== "effects" && (
            <>
              <div className="comp-bin-head">
                <span><Box size={14} /> COMPOSITIONS <small>{compositions.length}</small></span>
                <button onClick={createComposition}><Plus size={13} /> New</button>
              </div>
              <CompositionBin compositions={compositions} activeId="" onAddExamples={() => { checkpoint(); setCompositions(structuredClone(initialCompositions)); setStatus("Sample compositions added to Project Media. Open one to explore, or drag it into the sequence."); }} query={mediaSearch} onOpen={openComposition} onAdd={addCompositionToSequence} onCreate={createComposition} />
              <div className="project-tip"><Diamond size={12} /><span>Double-click a comp to edit its layers. Drag it to the timeline to nest it.</span></div>
              <details className="extension-pack-shelf media-organize">
                <summary>Plugins & creator packs · {installedExtensionPacks.length}</summary>
                <div className="extension-pack-actions"><button onClick={() => extensionPackInputRef.current?.click()}><Upload size={12} /> Import pack</button><button onClick={() => effectPluginInputRef.current?.click()}><Sparkles size={12} /> Install FX plugin</button><button onClick={exportCreatorExtensionPack}><Download size={12} /> Export creator pack</button></div>
                {installedExtensionPacks.length > 0 && <div className="extension-pack-list">{installedExtensionPacks.map((pack) => <span key={pack.id}><strong>{pack.name}</strong><small>{pack.author} · {pack.compositions} comps · {pack.layerPresets} looks · {pack.effectRecipes} FX</small></span>)}</div>}
                {installedEffectPlugins.length > 0 && <div className="extension-pack-list">{installedEffectPlugins.map((plugin) => <span key={plugin.id}><strong>{plugin.name}</strong><small>{plugin.author} · {plugin.effects} sandboxed effect{plugin.effects === 1 ? "" : "s"}</small></span>)}</div>}
                <p>Validated packs and effect plugins preserve preview/export parity. Plugins cannot execute code or access files and networks.</p>
              </details>
            </>
          )}
        </aside>

        <div className="monitor-column">
          <SourceProgramMonitor
            mode={monitorMode} sourceAsset={sourceAsset} sourceVideoRef={sourceVideoRef} sourceTime={sourceTime} sourceDuration={sourceDuration}
            sourceIn={sourceRange.inPoint} sourceOut={sourceOut} previewQuality={previewQuality} previewPerformance={previewPerformance}
            matchHistory={matchFrameHistory} onRestoreMatch={restoreMatchFrame}
            multicamAngles={multicamAssets.map((asset) => ({ id: asset.id, name: asset.name, url: asset.url, proxyUrl: asset.proxyUrl, duration: asset.duration ?? duration }))}
            programTime={currentTime} programDuration={duration} programPlaying={playing} activeAngleId={activeMulticamAngleId}
            onModeChange={(mode) => { sourceTransport.stop(); stopShuttle(); setMonitorMode(mode); }} onSourceTimeChange={setSourceTime} onSeekSource={seekSource}
            onMarkIn={() => runCommand("mark-in")}
            onMarkOut={() => runCommand("mark-out")}
            onPreviewQualityChange={setPreviewQuality} onEdit={(mode) => runCommand(mode === "insert" ? "source-insert" : "source-overwrite")}
            onMulticamSwitch={recordLiveMulticamSwitch} onBuildMulticam={buildMulticamPass} onProgramSeek={seek} onToggleProgramPlayback={() => runCommand("play-pause")} onToggleSourcePlayback={() => runCommand("play-pause")}
            program={<>
          <div
            ref={previewRef}
            className={`monitor ${dragActive ? "is-dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={dropMain}
          >
            {previewStage(
              <div className="empty-monitor">
                <div className="empty-reel"><Film size={36} /></div>
                <p>{assets.length ? "Build your sequence" : "Start with your media"}</p>
                <span>{assets.length ? "Drag project media onto a track, or open it in Source and Insert." : "Import clips, images or audio. A main song is optional."}</span>
                <button onClick={() => assetInputRef.current?.click()}><Upload size={16} /> Import project media</button>
              </div>,
            )}
            <div className="monitor-badge"><Activity size={13} /> {mainUrl || renderableSequence ? "LIVE PREVIEW" : "LOCAL ENGINE READY"}</div>
            <input ref={mainInputRef} hidden type="file" accept="video/*,audio/*" onChange={selectMainMedia} />
          </div>

          <div className="transport">
            <button className="icon-button" onClick={() => seek(Math.max(0, currentTime - 5))} aria-label="Back five seconds"><SkipBack size={17} /></button>
            <button className={`play-button ${playing ? "is-playing" : ""}`} onClick={() => runCommand("play-pause")} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
            <div className="timecode"><strong>{isPro ? formatTimecode(currentTime, exportFrameRate) : formatTime(currentTime)}</strong><span>/ {isPro ? formatTimecode(duration, exportFrameRate) : formatTime(duration)}</span></div>
            <input className="scrubber" aria-label="Master playhead" type="range" min="0" max={duration} step="0.01" value={currentTime} onChange={(event) => seek(Number(event.target.value))} />
            <span className="fps">{exportFrameRate} FPS</span>
            <button className="icon-button" onClick={toggleFullscreen} aria-label="Fullscreen preview" title="Fullscreen"><Maximize2 size={16} /></button>
          </div>
          </>}
          />

          <div className="edit-status-strip"><p role="status" aria-live="polite">{status}</p></div>
          <details className="edit-rhythm-controls"><summary>Rhythm tools · {analysis ? bpm + " BPM analyzed" : "not analyzed"}</summary>
          <div className="analysis-strip">
            <div><Zap size={15} /><strong>{visibleBeats.length}</strong><span>edit points</span></div>
            <div><Activity size={15} /><strong>{analysis ? bpm : "—"}</strong><span>BPM</span></div>
            <div><Layers3 size={15} /><strong>{placements.length}</strong><span>placements</span></div>
            <p role="status" aria-live="polite">{status}</p>
            <button className="analyze-button" onClick={analyzing ? () => analysisAbortRef.current?.abort() : () => runAnalysis()} disabled={rendering || !mainFile}><WandSparkles size={16} /> {analyzing ? "Cancel analysis" : "Analyze media"}</button>
          </div>

          <div className="beat-grid-panel">
            <div className="beat-grid-title"><Clock3 size={15} /><span><strong>Beat grid</strong><small>Correct the musical timing</small></span></div>
            <div className="beat-bpm-control">
              <button onClick={() => applyBeatGrid(bpm - 1, beatOffset)} aria-label="Decrease BPM">−</button>
              <strong>{bpm}</strong><span>BPM</span>
              <button onClick={() => applyBeatGrid(bpm + 1, beatOffset)} aria-label="Increase BPM">+</button>
            </div>
            <button className="tap-tempo" onClick={tapTempo}>TAP</button>
            <label className="beat-offset"><span>OFFSET</span><input type="range" {...continuousEditHandlers} min="-0.5" max="0.5" step="0.005" value={beatOffset} onChange={(event) => applyBeatGrid(bpm, Number(event.target.value))} /><strong>{beatOffset >= 0 ? "+" : ""}{Math.round(beatOffset * 1000)}ms</strong></label>
            <button className="icon-button" onClick={resetBeatGrid} disabled={!analysis} aria-label="Restore analyzed beat grid" title="Restore analyzed grid"><RefreshCw size={15} /></button>
          </div>
          </details>
        </div>

        <SequenceInspector hasTimelineContent={Boolean(mainFile || videoClips.length)} onImportMedia={() => runCommand("import-media")} proWorkspace={proWorkspace}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          selectedBaseCut={selectedBaseCut}
          selectedPlacement={selectedPlacement}
          selectedTrack={selectedTrack}
          isPro={isPro}
          selectedAudioTrack={selectedAudioTrack}
          colorManagement={colorManagement}
          setColorManagement={setColorManagement}
          lookPreset={lookPreset}
          checkpoint={checkpoint}
          setLookPreset={setLookPreset}
          setManualGrade={setManualGrade}
          continuousEditHandlers={continuousEditHandlers}
          manualGrade={manualGrade}
          scopeMode={scopeMode}
          setScopeMode={setScopeMode}
          setShowScope={setShowScope}
          selectedSection={selectedSection}
          updateSection={updateSection}
          splitAtPlayhead={splitAtPlayhead}
          rebuildPlacements={rebuildPlacements}
          mediaColor={mediaColor}
          mediaName={mediaName}
          updateBaseCut={updateBaseCut}
          mainFile={mainFile}
          mainName={mainName}
          assets={assets}
          duration={duration}
          selectedBaseAssetDuration={selectedBaseAssetDuration}
          selectedBaseRate={selectedBaseRate}
          selectedBaseMaxRate={selectedBaseMaxRate}
          applySelectedSplitEdit={applySelectedSplitEdit}
          splitEditHandles={splitEditHandles}
          setSplitEditHandles={setSplitEditHandles}
          applySelectedAsymmetricSplitEdit={applySelectedAsymmetricSplitEdit}
          dynamicTrimSelection={dynamicTrimSelection}
          startDynamicTrim={startDynamicTrim}
          setClipTransform={setClipTransform}
          clipTransform={clipTransform}
          currentTime={currentTime}
          toggleTimeRemap={toggleTimeRemap}
          addTimeRemapPoint={addTimeRemapPoint}
          seek={seek}
          updateTimeRemapPoint={updateTimeRemapPoint}
          removeTimeRemapPoint={removeTimeRemapPoint}
          autoBalanceSelectedClip={autoBalanceSelectedClip}
          sourceAsset={sourceAsset}
          replaceSelectedFromSource={replaceSelectedFromSource}
          customEffectRecipes={customEffectRecipes}
          autoGenerateClipEffects={autoGenerateClipEffects}
          applyClipEffectRecipe={applyClipEffectRecipe}
          applyCustomEffectRecipe={applyCustomEffectRecipe}
          saveSelectedClipEffectRecipe={saveSelectedClipEffectRecipe}
          addClipEffect={addClipEffect}
          updateClipEffect={updateClipEffect}
          moveClipEffect={moveClipEffect}
          addClipEffectKeyframe={addClipEffectKeyframe}
          updateClipEffectKeyframe={updateClipEffectKeyframe}
          removeClipEffectKeyframe={removeClipEffectKeyframe}
          selectedBaseCutIndex={selectedBaseCutIndex}
          transitionType={transitionType}
          baseCuts={baseCuts}
          exportFrameRate={exportFrameRate}
          selectedCutTransition={selectedCutTransition}
          applySelectedTransitionToAllCuts={applySelectedTransitionToAllCuts}
          motionDraft={motionDraft}
          setMotionDraft={setMotionDraft}
          addTransformKeyframe={addTransformKeyframe}
          copyTransformKeyframes={copyTransformKeyframes}
          hasTransformClipboard={hasTransformClipboard}
          pasteTransformKeyframes={pasteTransformKeyframes}
          loadTransformKeyframe={loadTransformKeyframe}
          updateTransformKeyframe={updateTransformKeyframe}
          removeTransformKeyframe={removeTransformKeyframe}
          timelineTool={timelineTool}
          nudgeProfessionalEdit={nudgeProfessionalEdit}
          splitSelectedBaseCut={() => runCommand("split")}
          deleteTimelineSelection={(ripple) => runCommand(ripple ? "ripple-delete" : "delete")}
          selectedBaseCutSet={selectedBaseCutSet}
          selectedPlacementComposition={selectedPlacementComposition}
          selectedPlacementAsset={selectedPlacementAsset}
          openComposition={openComposition}
          setClipTracks={setClipTracks}
          clipTracks={clipTracks}
          setSelectedTrackId={setSelectedTrackId}
          updatePlacement={updatePlacement}
          selectedPlacementSourceDuration={selectedPlacementSourceDuration}
          selectedPlacementRate={selectedPlacementRate}
          selectedPlacementMaxRate={selectedPlacementMaxRate}
          splitSelectedPlacement={() => runCommand("split")}
          placements={placements}
          updateClipTrack={updateClipTrack}
          beginContinuousEdit={beginContinuousEdit}
          endContinuousEdit={endContinuousEdit}
          moveClipTrack={moveClipTrack}
          removeClipTrack={removeClipTrack}
          audioClips={audioClips}
          updateAudioTrack={updateAudioTrack}
          audioBuses={audioBuses}
          selectedAudioClip={selectedAudioClip}
          updateAudioClip={updateAudioClip}
          snapCandidates={snapCandidates}
          snapping={snapping}
          setSelectedAudioClipUnity={setSelectedAudioClipUnity}
          applySelectedAudioFade={applySelectedAudioFade}
          crossfadeSelectedAudio={crossfadeSelectedAudio}
          duckOtherAudioUnderSelection={duckOtherAudioUnderSelection}
          addAudioAutomationPoint={addAudioAutomationPoint}
          selectedAutomationPoint={selectedAutomationPoint}
          updateAudioAutomationPoint={updateAudioAutomationPoint}
          removeAudioAutomationPoint={removeAudioAutomationPoint} />
      </section>

      <section className="timeline-wrap">
        <TimelineToolbar clipTrackCount={clipTracks.length} audioTrackCount={audioTracks.length} snapping={snapping} capabilities={capabilities} isPro={isPro} editMode={timelineEditMode} tool={timelineTool} linkedSelection={linkedSelection}
          canGroup={selectedBaseCutSet.size >= 2} canUngroup={[...selectedBaseCutSet].some((id) => Boolean(baseCuts.find((cut) => cut.id === id)?.groupId))} canNest={selectedBaseCutSet.size >= 1} hasSelectedClip={Boolean(selectedBaseCut)}
          range={timelineRange} currentTime={currentTime} hasRange={timelineRange.inPoint !== null && timelineRange.outPoint !== null} canFitRange={Boolean(selectedBaseCut && timelineRange.inPoint !== null && timelineRange.outPoint !== null)} canCloseGaps={baseCuts.length >= 2}
          loopPlayback={loopPlayback} showScope={showScope} scopeMode={scopeMode} zoom={timelineZoom} onEditModeChange={setTimelineEditMode} onAddVideoTrack={addClipTrack} onAddAudioTrack={addAudioTrack} onBuildMulticam={buildMulticamPass}
          onToolChange={(tool) => runCommand(("tool-" + tool) as import("./editor-command-registry").EditorCommandId)} onToggleSnapping={() => setSnapping((value) => !value)} onToggleLinked={() => setLinkedSelection((value) => !value)} onGroup={groupCurrentSelection} onUngroup={ungroupCurrentSelection} onNest={nestSelection}
          onSendToOverlay={sendSelectedToOverlay} onAddMarker={() => addMarker()} onRangeChange={setTimelineRange} onExtract={() => runCommand("extract-range")} onFitToFill={() => runCommand("fit-to-fill")} onCloseGaps={() => runCommand("close-gaps")} onMatchFrame={() => runCommand("match-frame")}
          onToggleLoop={() => setLoopPlayback((value) => !value)} onToggleScope={() => setShowScope((value) => !value)} onScopeModeChange={setScopeMode} onZoomChange={setTimelineZoom} />
        <div data-context-kind="timeline" data-context-id="main" ref={timelineScrollRef} className={`timeline-scroll active-tool-${timelineTool}`} onScroll={(event) => setTimelineViewport(timelineWindowFromScroll(event.currentTarget.scrollLeft, event.currentTarget.clientWidth, event.currentTarget.scrollWidth, duration, Math.max(2, 8 / timelineZoom)))} onPointerDown={beginTimelinePan} onPointerMove={moveTimelinePan} onPointerUp={endTimelinePan} onPointerCancel={endTimelinePan}>
          <div className="timeline" style={{ minWidth: Math.max(980, duration * 7 * timelineZoom), height: 211 + clipTracks.length * 60 + (isPro ? audioTracks.length * 56 : 0) }}>
            <TimelineRulerLanes duration={duration} sections={sections} selectedSectionId={selectedSectionId} beats={timelineBeats} allBeats={visibleBeats}
              markers={markers} range={timelineRange} viewport={timelineViewport} sceneCuts={analysis?.sceneCuts ?? []}
              onSelectSection={(id) => { setSelectedSectionId(id); setActivePanel("section"); }} onSeek={seek}
              {...timelineScrub} />
            <div className="video-lane">
              <div className="track-label"><Film size={15} /><span>V1 · MASTER EDIT</span></div>
              <div className={`track-content base-drop-zone tool-${timelineTool}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={dropOnBaseTrack} onClick={(event) => {
                if (timelineTool !== "razor") return;
                const bounds = event.currentTarget.getBoundingClientRect();
                razorAt(((event.clientX - bounds.left) / bounds.width) * duration);
              }}>
                {montageEnabled && baseCuts.length ? timelineBaseCuts.map((cut) => {
                  const cutIndex = baseCuts.findIndex((item) => item.id === cut.id);
                  const cutName = mediaName(cut.assetId);
                  const cutTransition = transitionConfigForCut(baseCuts, cutIndex, TRANSITION_PRESETS[transitionType]);
                  return (
                    <button
                      draggable={timelineTool === "select"}
                      key={cut.id}
                      data-context-kind="base" data-context-id={cut.id} className={`base-cut-block ${selectedBaseCutSet.has(cut.id) ? "selected" : ""} ${cut.groupId ? "grouped" : ""} ${cut.locked ? "locked" : ""}`}
                      style={{ left: `${cut.start / duration * 100}%`, width: `${Math.max(.4, cut.duration / duration * 100)}%`, borderColor: mediaColor(cut.assetId) ?? "#34d6c7" }}
                      title={`${cutName ?? "Offline"} · ${formatTime(cut.start)} · ${cut.duration.toFixed(2)}s`}
                      onDragStart={(event) => {
                        if (trimDragRef.current) { event.preventDefault(); return; } // trimming, not moving
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("application/x-scenepilot", `basecut:${cut.id}`);
                      }}
                      onPointerDown={(event) => beginProfessionalEditDrag(event, cut)}
                      onPointerMove={moveProfessionalEditDrag}
                      onPointerUp={endProfessionalEditDrag}
                      onPointerCancel={endProfessionalEditDrag}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (suppressTimelineClickRef.current) {
                          suppressTimelineClickRef.current = false;
                          return;
                        }
                        if (timelineTool === "razor") {
                          const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
                          if (bounds) razorAt(((event.clientX - bounds.left) / bounds.width) * duration, cut.id);
                          return;
                        }
                        if (timelineTool === "fade") {
                          setStatus("Drag either fade handle to shape the clip opacity.");
                        }
                        if (timelineTool === "rate") {
                          setStatus("Drag the striped right edge to change duration while preserving source frames.");
                        }
                        selectBaseCut(cut, event.shiftKey || event.metaKey || event.ctrlKey);
                        seek(cut.start);
                      }}
                    >
                      <i style={{ background: mediaColor(cut.assetId) ?? "#34d6c7" }} />
                      {timelineTool === "select" && (
                        <>
                          {cutIndex > 0 && <span
                            className="trim-handle left"
                            draggable={false}
                            title="Drag the incoming edit point"
                            onPointerDown={(event) => beginTrim(event, baseCuts[cutIndex - 1].id)}
                            onPointerMove={moveTrim}
                            onPointerUp={endTrim}
                            onPointerCancel={endTrim}
                          />}
                          <span
                            className="trim-handle right"
                            draggable={false}
                            title="Drag the outgoing edit point"
                            onPointerDown={(event) => beginTrim(event, cut.id)}
                            onPointerMove={moveTrim}
                            onPointerUp={endTrim}
                            onPointerCancel={endTrim}
        />
        {dynamicTrimSelection && <div className="dynamic-trim-bar"><strong>DYNAMIC {dynamicTrimSelection.mode.toUpperCase()} · {dynamicTrimSelection.edge.toUpperCase()}</strong><span>J backward</span><button onClick={() => stepDynamicTrim(-1)}>−1 FRAME</button><button onClick={() => stepDynamicTrim(1)}>+1 FRAME</button><span>L forward</span><button onClick={() => setDynamicTrimSelection(null)}>K · DONE</button></div>}
                        </>
                      )}
                      {Boolean(cut.fadeIn) && <b className="clip-fade fade-in" style={{ width: `${Math.min(95, (cut.fadeIn ?? 0) / cut.duration * 100)}%` }} />}
                      {Boolean(cut.fadeOut) && <b className="clip-fade fade-out" style={{ width: `${Math.min(95, (cut.fadeOut ?? 0) / cut.duration * 100)}%` }} />}
                      {cutIndex > 0 && cutTransition.type !== "none" && <span className={`clip-transition transition-${cutTransition.type}`} style={{ width: `${Math.min(95, cutTransition.duration / cut.duration * 100)}%` }} title={`${cutTransition.type} · ${cutTransition.duration.toFixed(2)}s`}><small>{cutTransition.type}</small>{cut.id === selectedBaseCutId && timelineTool === "select" && <i className="transition-duration-handle" onPointerDown={(event) => beginTransitionDrag(event, cut, cutIndex)} onPointerMove={moveTransitionDrag} onPointerUp={endTransitionDrag} onPointerCancel={endTransitionDrag} />}</span>}
                      {timelineTool === "fade" && <>
                        <span className="fade-handle in" style={{ left: `${Math.min(95, (cut.fadeIn ?? 0) / cut.duration * 100)}%` }} title="Drag fade in" onPointerDown={(event) => beginFadeDrag(event, cut, "in")} onPointerMove={moveFadeDrag} onPointerUp={endFadeDrag} onPointerCancel={endFadeDrag} />
                        <span className="fade-handle out" style={{ right: `${Math.min(95, (cut.fadeOut ?? 0) / cut.duration * 100)}%` }} title="Drag fade out" onPointerDown={(event) => beginFadeDrag(event, cut, "out")} onPointerMove={moveFadeDrag} onPointerUp={endFadeDrag} onPointerCancel={endFadeDrag} />
                      </>}
                      {timelineTool === "rate" && <span
                        className="rate-stretch-handle"
                        title="Drag to rate stretch"
                        onPointerDown={(event) => beginRateStretch(event, cut)}
                        onPointerMove={moveRateStretch}
                        onPointerUp={endRateStretch}
                        onPointerCancel={endRateStretch}
                      />}
                      {cut.locked && <Lock className="clip-lock" size={9} />}
                      <strong>{cutName ?? "Offline media"}</strong>
                      <span>{cut.duration.toFixed(1)}s</span>
                      {Math.abs(clipPlaybackRate(cut) - 1) > 0.005 && <em className="clip-rate">{Math.round(clipPlaybackRate(cut) * 100)}%</em>}
                    </button>
                  );
                }) : mainFile ? <button data-context-kind="main-source" data-context-id="main" className="main-clip" title="Click to edit this clip — trim, transform, flip, cut" onClick={() => {
                  if (!mainFile || !(duration > 0)) return;
                  const seed = editableBaseCuts();
                  if (!seed.length) return;
                  checkpoint();
                  setBaseCuts(seed);
                  setMontageEnabled(true);
                  setSelectedBaseCutId(seed[0].id);
                  setActivePanel("base");
                }}><div className="clip-stripes" /><strong>{mainName}</strong><span>{formatTime(duration)}</span></button> : <div className="timeline-empty-hint">Drop video or a composition here to begin your sequence</div>}
              </div>
            </div>
            {[...clipTracks].reverse().map((track) => (
              <div tabIndex={0} data-optional-empty={!placements.some((clip) => (clip.trackId ?? clipTracks[0]?.id) === track.id) && !(activePanel === "track" && selectedTrackId === track.id)} data-context-kind="video-track" data-context-id={track.id} className={`clip-track-lane ${track.enabled ? "" : "disabled"} ${track.locked ? "locked" : ""}`} key={track.id}>
                <div className={`track-label clip-track-label ${selectedTrack?.id === track.id ? "selected" : ""}`} style={{ borderLeftColor: track.color }} draggable={!track.locked}
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-scenepilot", `timeline-video-track:${track.id}`); }}
                  onDragOver={(event) => { if (event.dataTransfer.types.includes("application/x-scenepilot")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
                  onDrop={(event) => { const payload = event.dataTransfer.getData("application/x-scenepilot") || event.dataTransfer.getData("text/plain"); if (!payload.startsWith("timeline-video-track:")) return; event.preventDefault(); event.stopPropagation(); moveClipTrackTo(payload.slice("timeline-video-track:".length), track.id); }}>
                  <button onClick={() => { setSelectedTrackId(track.id); setSelectedPlacementId(null); setSelectedBaseCutId(null); setActivePanel("track"); }}><Layers3 size={14} /><span>{track.name}</span><small>{track.blend} · {track.opacity}% · {track.locked ? "locked" : "live"}</small></button>
                  <button className={!track.enabled ? "active" : ""} onClick={() => { checkpoint(); setClipTracks((items) => items.map((item) => item.id === track.id ? { ...item, enabled: !item.enabled } : item)); }} title={track.enabled ? "Hide track" : "Show track"}>{track.enabled ? <Eye size={11} /> : <EyeOff size={11} />}</button>
                  <button className={track.locked ? "active" : ""} onClick={() => { checkpoint(); setClipTracks((items) => items.map((item) => item.id === track.id ? { ...item, locked: !item.locked } : item)); }} title={track.locked ? "Unlock track" : "Lock track"}>{track.locked ? <Lock size={10} /> : <Unlock size={10} />}</button>
                </div>
                <div className="track-content clip-drop-zone" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = track.locked ? "none" : draggingPlacementId ? "move" : "copy"; }} onDrop={(event) => dropOnClipTrack(event, track.id)}>
                  {timelinePlacements.filter((placement) => (placement.trackId ?? clipTracks[0]?.id) === track.id).map((placement) => {
                    const asset = assets.find((item) => item.id === placement.assetId);
                    const composition = placement.compositionId ? compositions.find((item) => item.id === placement.compositionId) : null;
                    const label = composition?.name ?? asset?.name ?? "Offline";
                    return <button draggable={timelineTool === "select" && !track.locked} key={placement.id} data-context-kind="overlay" data-context-id={placement.id} className={`effect-block ${composition ? "composition-block" : ""} ${placement.id === selectedPlacementId ? "selected" : ""} ${placement.id === draggingPlacementId ? "dragging" : ""}`} style={{ left: `${(placement.start / duration) * 100}%`, width: `${Math.max(0.38, (placement.duration / duration) * 100)}%`, background: composition ? "#6957d8" : asset?.color ?? track.color }} title={`${label} · ${formatTimecode(placement.start, exportFrameRate)} · ${placement.duration.toFixed(2)}s`} onDragStart={(event) => { if (track.locked) { event.preventDefault(); return; } setDraggingPlacementId(placement.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-scenepilot", `placement:${placement.id}`); }} onDragEnd={() => setDraggingPlacementId(null)} onDoubleClick={() => composition && openComposition(composition.id)} onClick={(event) => { event.stopPropagation(); if (suppressTimelineClickRef.current) { suppressTimelineClickRef.current = false; return; } if (timelineTool === "razor") { const bounds = event.currentTarget.parentElement?.getBoundingClientRect(); if (bounds) splitPlacementAt(placement, ((event.clientX - bounds.left) / bounds.width) * duration); return; } if (timelineTool === "fade") setStatus("Drag either gold edge to shape the clip fade."); setSelectedPlacementId(placement.id); setSelectedBaseCutId(null); setSelectedTrackId(track.id); setSelectedSectionId(placement.sectionId); setActivePanel("clip"); seek(placement.start); }}>
                      {timelineTool === "select" && placement.id === selectedPlacementId && !track.locked && <><i className="video-trim-handle left" onPointerDown={(event) => beginPlacementTrim(event, placement, "in")} onPointerMove={movePlacementTrim} onPointerUp={endPlacementTrim} onPointerCancel={endPlacementTrim} /><i className="video-trim-handle right" onPointerDown={(event) => beginPlacementTrim(event, placement, "out")} onPointerMove={movePlacementTrim} onPointerUp={endPlacementTrim} onPointerCancel={endPlacementTrim} /></>}
                      {Boolean(placement.fadeIn) && <b className="clip-fade fade-in" style={{ width: `${Math.min(95, (placement.fadeIn ?? 0) / placement.duration * 100)}%` }} />}
                      {Boolean(placement.fadeOut) && <b className="clip-fade fade-out" style={{ width: `${Math.min(95, (placement.fadeOut ?? 0) / placement.duration * 100)}%` }} />}
                      {timelineTool === "fade" && !track.locked && <><i className="video-fade-handle in" style={{ left: `${Math.min(95, (placement.fadeIn ?? 0) / placement.duration * 100)}%` }} onPointerDown={(event) => beginPlacementFade(event, placement, "in")} onPointerMove={movePlacementFade} onPointerUp={endPlacementFade} onPointerCancel={endPlacementFade} /><i className="video-fade-handle out" style={{ right: `${Math.min(95, (placement.fadeOut ?? 0) / placement.duration * 100)}%` }} onPointerDown={(event) => beginPlacementFade(event, placement, "out")} onPointerMove={movePlacementFade} onPointerUp={endPlacementFade} onPointerCancel={endPlacementFade} /></>}
                      <span>{composition && <Box size={10} />} {label.slice(0, 15)}</span>
                      {Math.abs(videoClipPlaybackRate(placement) - 1) > 0.005 && <em className="clip-rate">{Math.round(videoClipPlaybackRate(placement) * 100)}%</em>}
                    </button>;
                  })}
                </div>
              </div>
            ))}
            {isPro && audioTracks.map((track) => (
              <div tabIndex={0} data-optional-empty={track.id !== audioTracks[0]?.id && !audioClips.some((clip) => clip.trackId === track.id) && !(activePanel === "audio" && selectedAudioTrackId === track.id)} data-context-kind="audio-track" data-context-id={track.id} className={`audio-track-lane ${track.muted ? "muted" : ""}`} key={track.id}>
                <div className={`track-label audio-track-label ${selectedAudioTrack?.id === track.id ? "selected" : ""}`} style={{ borderLeftColor: track.color }} draggable={!track.locked}
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-scenepilot", `timeline-audio-track:${track.id}`); }}
                  onDragOver={(event) => { if (event.dataTransfer.types.includes("application/x-scenepilot")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
                  onDrop={(event) => { const payload = event.dataTransfer.getData("application/x-scenepilot") || event.dataTransfer.getData("text/plain"); if (!payload.startsWith("timeline-audio-track:")) return; event.preventDefault(); event.stopPropagation(); moveAudioTrackTo(payload.slice("timeline-audio-track:".length), track.id); }}>
                  <button onClick={() => { setSelectedAudioTrackId(track.id); setSelectedAudioClipId(null); setActivePanel("audio"); }}>
                    <Music2 size={14} /><span>{track.name}</span><small>{Math.round(track.gain * 100)}% · {track.pan > 0 ? `R${Math.round(track.pan * 100)}` : track.pan < 0 ? `L${Math.round(Math.abs(track.pan) * 100)}` : "C"}</small>
                  </button>
                  <button className={track.muted ? "active" : ""} onClick={() => { setSelectedAudioTrackId(track.id); setAudioTracks((items) => items.map((item) => item.id === track.id ? { ...item, muted: !item.muted } : item)); }} title="Mute">{track.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>
                  <button className={track.solo ? "active" : ""} onClick={() => setAudioTracks((items) => items.map((item) => item.id === track.id ? { ...item, solo: !item.solo } : item))} title="Solo">S</button>
                </div>
                <div className="track-content audio-drop-zone" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => dropOnAudioTrack(event, track.id)}>
                  {timelineAudioClips.filter((clip) => clip.trackId === track.id).map((clip) => {
                    const audioAsset = assets.find((asset) => asset.id === clip.assetId);
                    const selectClip = () => {
                      if (timelineTool === "fade") {
                        setStatus("Drag either gold handle to shape the audio fade.");
                      }
                      setSelectedAudioClipId(clip.id);
                      setSelectedAutomationPointId(null);
                      setSelectedAudioTrackId(track.id);
                      setSelectedPlacementId(null);
                      setSelectedBaseCutId(linkedSelection ? clip.linkedVideoId ?? null : null);
                      setActivePanel("audio");
                      seek(clip.start);
                    };
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`Select audio clip ${clip.name}`}
                        key={clip.id}
                        data-context-kind="audio" data-context-id={clip.id} className={`audio-clip-block ${clip.id === selectedAudioClipId ? "selected" : ""}`}
                        style={{ left: `${clip.start / duration * 100}%`, width: `${Math.max(.4, clip.duration / duration * 100)}%`, borderColor: track.color }}
                        onClick={(event) => {
                          if (timelineTool !== "razor") { selectClip(); return; }
                          event.stopPropagation();
                          if (track.locked) { setStatus("Unlock this audio track before splitting."); return; }
                          const bounds = event.currentTarget.getBoundingClientRect();
                          const time = snapToFrame(clip.start + (event.clientX - bounds.left) / bounds.width * clip.duration, exportFrameRate);
                          const pieces = splitEditorialAudio(clip, time, `audio-${crypto.randomUUID()}`);
                          if (!pieces) { setStatus("Move the razor farther from the audio clip edge."); return; }
                          checkpoint(); setAudioClips((items) => items.flatMap((item) => item.id === clip.id ? pieces : [item]));
                          setSelectedAudioClipId(pieces[1].id); setSelectedAudioTrackId(track.id); setActivePanel("audio");
                          setStatus("Audio split. Source, fades and automation preserved.");
                        }}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectClip(); }}
                      >
                        <span className="audio-wave-mini">
                          {(audioAsset?.waveform ?? []).map((peak, index) => <i key={index} style={{ height: `${Math.max(5, peak * 100)}%` }} />)}
                        </span>
                        <span className="audio-automation-line" />
                        {(clip.automation ?? []).map((point) => (
                          <button
                            key={point.id}
                            className={`audio-automation-point ${point.id === selectedAutomationPointId ? "selected" : ""}`}
                            style={{ left: `${point.time / Math.max(.01, clip.duration) * 100}%`, bottom: `${Math.max(4, Math.min(88, point.gain / 2 * 84 + 4))}%` }}
                            aria-label={`Volume ${Math.round(point.gain * 100)} percent at ${point.time.toFixed(2)} seconds`}
                            disabled={track.locked}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.currentTarget.setPointerCapture(event.pointerId);
                              beginContinuousEdit();
                              setSelectedAudioClipId(clip.id);
                              setSelectedAudioTrackId(track.id);
                              setSelectedAutomationPointId(point.id);
                              setActivePanel("audio");
                            }}
                            onPointerMove={(event) => {
                              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                              const block = event.currentTarget.parentElement;
                              if (!block) return;
                              const bounds = block.getBoundingClientRect();
                              updateAudioAutomationPointById(clip.id, point.id, {
                                time: Math.max(0, Math.min(clip.duration, (event.clientX - bounds.left) / bounds.width * clip.duration)),
                                gain: Math.max(0, Math.min(2, (1 - (event.clientY - bounds.top) / bounds.height) * 2)),
                              });
                            }}
                            onPointerUp={(event) => {
                              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                              endContinuousEdit();
                            }}
                            onPointerCancel={endContinuousEdit}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedAudioClipId(clip.id);
                              setSelectedAudioTrackId(track.id);
                              setSelectedAutomationPointId(point.id);
                              setActivePanel("audio");
                              seek(clip.start + point.time);
                            }}
                          />
                        ))}
                        <strong>{clip.name}</strong>
                        <b className="audio-fade in" style={{ width: `${Math.min(95, clip.fadeIn / clip.duration * 100)}%` }} />
                        <b className="audio-fade out" style={{ width: `${Math.min(95, clip.fadeOut / clip.duration * 100)}%` }} />
                        {timelineTool === "fade" && <>
                          <span className="fade-handle in" style={{ left: `${Math.min(95, clip.fadeIn / clip.duration * 100)}%` }} title="Drag audio fade in" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => beginAudioFadeDrag(event, clip, "in")} onPointerMove={moveAudioFadeDrag} onPointerUp={endAudioFadeDrag} onPointerCancel={endAudioFadeDrag} />
                          <span className="fade-handle out" style={{ right: `${Math.min(95, clip.fadeOut / clip.duration * 100)}%` }} title="Drag audio fade out" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => beginAudioFadeDrag(event, clip, "out")} onPointerMove={moveAudioFadeDrag} onPointerUp={endAudioFadeDrag} onPointerCancel={endAudioFadeDrag} />
                        </>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div data-context-kind="timeline" data-context-id="main" className="energy-lane">
              <div className="track-label"><Zap size={15} /><span>ENERGY</span></div>
              <div className="track-content"><div className={`waveform ${analysis ? "measured" : ""}`}>{energyBars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
            </div>
            <TimelinePlayhead className="playhead" label="Sequence playhead" time={currentTime} duration={duration} frameRate={exportFrameRate} text={formatTime(currentTime)} scrub={timelineScrub} onSeek={seek} onStart={stopShuttle} />
          </div>
        </div>
      </section>
      </>
      ) : (
      <>
      <section className="composition-workspace">
        {isPro && <WorkspaceResizers />}
        <aside className="composition-project">
          <ProjectPanelTabs value={projectPanelTab} mediaCount={assets.length + compositions.length} effectCount={Object.keys(CLIP_EFFECT_DEFINITIONS).length} compositionCount={compositions.length} transcriptCount={transcriptWords.length} showTranscript={false} dimensions={newProjectDims} frameRate={exportFrameRate} onChange={setProjectPanelTab} onCreateComposition={createComposition} canCreateComposition={isPro && !analyzing && !rendering} onDropCompositionSource={dropCompositionSource} />
          {projectPanelTab === "effects" && <CompositionEffectsBrowser key={selectedCompLayer?.id} compositionId={activeComposition.id} layer={selectedCompLayer} track={activeCompTrackById.get(selectedCompLayer?.trackId ?? "")} onUpdate={updateCompositionLayer} />}
          {projectPanelTab === "project" && <MediaBrowser onCreateCompositionFromAsset={beginCompositionFromSource} projectName={mainName} assets={assets} visibleAssets={visibleAssets} bins={mediaBins} activeBinId={activeBinId} sourceAssetId={sourceAssetId}
            search={mediaSearch} kindFilter={mediaKindFilter} sort={mediaSort} view={mediaView} smartFilter={smartFilter} showSmartFilters={Boolean(isPro && analysis)}
            isPro={isPro} disabled={analyzing || rendering} nativeMediaAvailable={nativeMediaAvailable} usage={mediaUsage} inputRef={assetInputRef}
            canCancelProxy={(id) => nativeProxyJobByAssetRef.current.has(id)} onImport={selectAssets} onAddBin={addMediaBin} onSearch={setMediaSearch}
            onKindFilter={setMediaKindFilter} onSort={setMediaSort} onView={setMediaView} onActiveBin={setActiveBinId} onSmartFilter={setSmartFilter}
            onOpen={openSourceAsset} onBuildProxy={(id) => { void buildProxy(id); }} onCancelProxy={(id) => { void cancelProxy(id); }} onMoveToBin={moveAssetToBin}
            onToggleFavorite={(id) => setAssets((items) => items.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item))} onRemove={removeAsset} />}
          {(projectPanelTab === "compositions" || projectPanelTab === "project") && <><div className="comp-bin-head"><span><Box size={14} /> COMPOSITIONS <small>{compositions.length}</small></span></div><CompositionBin compositions={compositions} activeId={activeCompositionId} onAddExamples={() => { checkpoint(); setCompositions(structuredClone(initialCompositions)); setStatus("Sample compositions added to Project Media. Open one to explore, or drag it into the sequence."); }} query={mediaSearch} onOpen={openComposition} onAdd={addCompositionToSequence} onCreate={createComposition} />
          {activeComposition && (
            <button className="nest-comp-button" onClick={() => addCompositionToSequence(activeComposition.id)}>
              <Plus size={15} /> Add to master at {formatTime(currentTime)}
            </button>
          )}
          <section className="extension-pack-shelf compact">
            <header><span><Sparkles size={13} /> EXTENSION PACKS <small>{installedExtensionPacks.length}</small></span></header>
            <div className="extension-pack-actions"><button onClick={() => extensionPackInputRef.current?.click()}><Upload size={12} /> Import pack</button><button onClick={() => effectPluginInputRef.current?.click()}><Sparkles size={12} /> FX plugin</button><button onClick={exportCreatorExtensionPack}><Download size={12} /> Export</button></div>
            {installedExtensionPacks.slice(-3).map((pack) => <div className="extension-pack-row" key={pack.id}><strong>{pack.name}</strong><small>{pack.compositions} comps · {pack.layerPresets} looks · {pack.effectRecipes} FX</small></div>)}
            {installedEffectPlugins.slice(-3).map((plugin) => <div className="extension-pack-row" key={plugin.id}><strong>{plugin.name}</strong><small>{plugin.author} · {plugin.effects} sandboxed FX</small></div>)}
          </section></>}
        </aside>

        <div className="composition-editor">
          {rotoMode !== "off" && selectedCompLayer?.kind === "media" && <CompositionFocusBar guide={compositionGuide} busy={rotoTracking.active || rendering} onAction={() => runJourneyAction(compositionGuide.action)} />}
          <div className="composition-editor-head">
            <div>
              <span className="comp-breadcrumb"><button onClick={() => setWorkspaceView("sequence")}>MASTER</button><i>/</i> {activeComposition?.name}</span>
              <strong>COMPOSITION VIEWER</strong>
            </div>
            <span>{activeComposition?.width} × {activeComposition?.height}</span>
          </div>
          <CompositionDropSurface onDropFiles={importIntoComposition} composition={activeComposition} selectedTrackId={selectedCompTrackId} time={compositionTime} busy={rendering || analyzing} onDropTrack={dropOnCompositionTrack} onStatus={setStatus} onImport={() => { setProjectPanelTab("project"); assetInputRef.current?.click(); }}>
            <div
              ref={compositionStageRef}
              className={`composition-stage roto-view-${rotoView} ${rotoView === "overlay" ? "shared-compositor-preview" : ""}`}
              style={{ background: activeComposition?.background, aspectRatio: `${activeComposition?.width ?? 16} / ${activeComposition?.height ?? 9}` }}
              onPointerMove={moveCompositionLayerInViewer}
              onPointerUp={endCompositionLayerDrag}
              onPointerCancel={endCompositionLayerDrag}
            >
              {activeComposition && <CanvasPreview
                mediaRef={videoRef}
                mainUrl=""
                mainSourceUrl={mainIsAudio ? "" : mainUrl}
                assets={visualAssets.map(({ id, url, proxyUrl, kind }) => ({ id, url: proxyUrl ?? url, kind: kind as "image" | "video" }))}
                placements={[{ id: `preview-${activeComposition.id}`, assetId: `composition:${activeComposition.id}`, compositionId: activeComposition.id, start: 0, duration: activeComposition.duration, scale: 100, opacity: 100, trackId: "composition-preview" }]}
                compositions={compositions}
                tracks={[{ id: "composition-preview", enabled: true, blend: "normal", opacity: 100, hue: 0, saturation: 100, brightness: 100, glow: 0, color: "#fff", fadeIn: 0, fadeOut: 0 }]}
                baseCuts={[]}
                currentTime={compositionTime}
                width={Math.min(960, activeComposition.width)}
                height={Math.max(1, Math.round(Math.min(960, activeComposition.width) * activeComposition.height / activeComposition.width))}
                quality={previewQuality}
              />}
              {activeCompositionVisualLayers.map((layer) => {
                const compositionTrack = activeCompTrackById.get(layer.trackId ?? "");
                if (!compositionTrack?.enabled || (activeCompVideoSolo && !compositionTrack.solo)) return null;
                if (!layer.enabled) return null;
                const layerStart = layer.start ?? 0;
                const layerDuration = layer.duration ?? activeComposition.duration - layerStart;
                if (compositionTime < layerStart || compositionTime >= layerStart + layerDuration) return null;
                const layerTime = (layer.sourceStart ?? 0) + (compositionTime - layerStart) * Math.max(.01, layer.playbackRate ?? 1);
                const transform = previewCompositionTransform(layer, layerTime, activeComposition.layers, new Set(), activeComposition.width, activeComposition.height);
                const layerRotoPath = rotoPathAt(layer.roto, layerTime);
                const projection = layer.threeD ? projectCompositionLayer({
                  width: activeComposition.width,
                  height: activeComposition.height,
                  centerX: activeComposition.width * transform.x / 100,
                  centerY: activeComposition.height * transform.y / 100,
                  layerWidth: activeComposition.width * layer.width / 100 * transform.scale / 100,
                  layerHeight: activeComposition.height * layer.height / 100 * transform.scale / 100,
                  rotationZ: transform.rotation,
                  spatial: { z: transform.z, rotationX: transform.rotationX, rotationY: transform.rotationY, scaleX: transform.scaleX, scaleY: transform.scaleY, scaleZ: transform.scaleZ },
                  camera: activeCompositionCameraAt(activeComposition.id, activeComposition.cameras, activeComposition.activeCameraId, compositionTime, activeComposition.width),
                  lights: activeComposition.lights,
                  material: layer.material,
                  basis: transform.basis,
                }) : undefined;
                const projectionBounds = projection ? {
                  left: Math.min(...projection.quad.map((point) => point.x)),
                  top: Math.min(...projection.quad.map((point) => point.y)),
                  right: Math.max(...projection.quad.map((point) => point.x)),
                  bottom: Math.max(...projection.quad.map((point) => point.y)),
                } : undefined;
                const projectionWidth = projectionBounds ? Math.max(.001, projectionBounds.right - projectionBounds.left) : 0;
                const projectionHeight = projectionBounds ? Math.max(.001, projectionBounds.bottom - projectionBounds.top) : 0;
                const style = {
                  left: projectionBounds ? `${projectionBounds.left / activeComposition.width * 100}%` : `${transform.x}%`,
                  top: projectionBounds ? `${projectionBounds.top / activeComposition.height * 100}%` : `${transform.y}%`,
                  width: projectionBounds ? `${projectionWidth / activeComposition.width * 100}%` : `${layer.width}%`,
                  height: projectionBounds ? `${projectionHeight / activeComposition.height * 100}%` : `${layer.height}%`,
                  color: layer.color,
                  background: layer.kind === "shape" ? layer.color : layer.kind === "adjustment" ? `${layer.color}14` : "transparent",
                  borderRadius: layer.shape === "ellipse" ? "50%" : "2px",
                  opacity: transform.opacity / 100,
                  transform: projectionBounds ? "none" : `translate(-50%, -50%) scale(${transform.scale / 100}) rotate(${transform.rotation}deg)`,
                  mixBlendMode: layer.blend === "normal" ? "normal" : layer.blend,
                  filter: `${layer.effect === "glow" ? `drop-shadow(0 0 20px ${layer.color})` : layer.effect === "blur" && layer.kind !== "adjustment" ? "blur(7px)" : "none"}${layer.motionBlur ? " blur(1.5px)" : ""}`,
                  clipPath: projectionBounds && projection
                    ? `polygon(${projection.quad.map((point) => `${(point.x - projectionBounds.left) / projectionWidth * 100}% ${(point.y - projectionBounds.top) / projectionHeight * 100}%`).join(",")})`
                    : layerRotoPath?.length && !layer.roto?.inverted
                    ? rotoPathCss(layerRotoPath)
                    : layer.mask?.enabled && !layer.mask.inverted
                      ? layer.mask.shape === "ellipse" ? "ellipse(50% 50% at 50% 50%)" : "inset(0)"
                      : undefined,
                } as React.CSSProperties;
                return (
                  <button data-context-kind="layer" data-context-id={layer.id} key={layer.id} className={`composition-preview-layer ${layer.kind} ${selectedCompLayer?.id === layer.id ? "selected roto-diagnostic-target" : ""} ${layer.locked ? "locked" : ""}`} style={style} onPointerDown={(event) => beginCompositionLayerDrag(event, layer.id)} onClick={() => { setSelectedCompLayerId(layer.id); if (layer.trackId) setSelectedCompTrackId(layer.trackId); setSelectedKeyframeId(null); }}>
                    {layer.kind === "text" ? layer.text : layer.kind === "media" && layer.assetId ? (() => {
                      const asset = assets.find((item) => item.id === layer.assetId);
                      return asset ? <CompositionMediaLayerPreview asset={asset} time={layerTime} playing={playing} /> : <span className="offline-layer">OFFLINE</span>;
                    })() : layer.kind === "null"
                      ? <span className="null-control"><i /><b>NULL</b></span>
                      : layer.kind === "adjustment"
                        ? <span className="adjustment-control">ADJUSTMENT · {layer.effect.toUpperCase()}</span>
                        : layer.kind === "composition"
                          ? <span className="precomp-control"><Box size={18} />{compositions.find((item) => item.id === layer.compositionId)?.name ?? "OFFLINE COMP"}</span>
                          : null}
                    {layerRotoPath?.length && selectedCompLayer?.id === layer.id && <svg className="roto-path-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={layerRotoPath.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} /></svg>}
                  </button>
                );
              })}
              {selectedCompLayer && !selectedCompLayer.threeD && !selectedCompLayer.parentId && selectedCompLayer.keyframes.length >= 2 && <CompositionMotionPath
                keyframes={selectedCompLayer.keyframes}
                selectedKeyframeId={selectedKeyframeId}
                locked={compositionLayerLocked(activeComposition, selectedCompLayer)}
                onBeginEdit={beginContinuousEdit}
                onEndEdit={endContinuousEdit}
                onSelect={(keyframeId, time) => { setSelectedKeyframeId(keyframeId); seekComposition(layerToCompositionTime(selectedCompLayer, time)); }}
                onPatch={updateCompositionMotionKeyframe}
              />}
              <CompositionAudioPreview compositions={compositions} placements={[{ id: `preview-${activeComposition.id}`, assetId: `composition:${activeComposition.id}`, compositionId: activeComposition.id, start: 0, duration: activeComposition.duration, scale: 100, opacity: 100 }]} mainUrl={mainUrl} assets={assets} time={compositionTime} playing={playing} />
              {capabilities.rotoscoping && rotoMode !== "off" && <RotoSelectionSurface mode={rotoMode} size={rotoBrushSize} strength={rotoBrushStrength} points={rotoStrokePreview} onStart={beginRotoStroke} onMove={extendRotoStroke} onFinish={finishRotoStroke} onCancel={cancelRotoStroke} />}
            </div>
          </CompositionDropSurface>
          <CompositionTransport playing={playing} rendering={rendering} time={compositionTime} duration={activeComposition?.duration ?? 1} frameRate={exportFrameRate} pro={isPro} onToggle={togglePlayback} onSeek={seekComposition} onExport={() => void exportActiveComposition()} />
        </div>

        <CompositionProperties composition={activeComposition} compositions={compositions.filter((composition) => composition.id === activeComposition?.id || !hasCompositionCycle(compositions, activeComposition?.id ?? "", composition.id))}
          layer={selectedCompLayer} keyframe={selectedCompKeyframe} transform={selectedLayerTransform} capabilities={capabilities} visualAssets={visualAssets} mediaAssets={assets} selectedTrackKind={activeCompTrackById.get(selectedCompLayer?.trackId ?? selectedCompTrackId)?.kind ?? "video"} time={compositionTime}
          continuousEditHandlers={continuousEditHandlers} savedPresets={savedLayerPresets} onUpdateComposition={updateComposition} onDeleteComposition={deleteComposition} onAddLayer={addCompositionLayer}
          onUpdateLayer={updateCompositionLayer} onMoveLayer={moveCompositionLayer} onDuplicateLayer={() => runCommand("duplicate")} onPrecompositionChange={(compositionId) => {
            if (activeComposition && hasCompositionCycle(compositions, activeComposition.id, compositionId)) { setStatus("That precomposition would create a circular dependency."); return; }
            updateCompositionLayer({ compositionId });
          }} onUpdateKeyframe={updateSelectedCompositionKeyframe} onDeleteKeyframe={deleteCompositionKeyframe} onApplyPreset={applyCompositionPreset}
          onSavePreset={saveSelectedLayerPreset} onApplySavedPreset={applySavedLayerPreset} onRemoveSavedPreset={removeSavedLayerPreset} onAddKeyframe={addCompositionKeyframe} onRemoveLayer={removeCompositionLayer}
          onTrackPlane={() => void trackSelectedLayerPlane()}
          onSolveCamera={() => void solveSelectedLayerCamera()}
          onBuildCleanPlate={() => void buildSelectedLayerCleanPlate()}
          onBeginEdit={beginContinuousEdit} onEndEdit={endContinuousEdit} onSeek={seekComposition}
          rotoPanel={capabilities.rotoscoping ? <RotoSubjectPanel mask={selectedCompLayer?.roto} duration={activeComposition?.duration ?? 1} time={compositionTime} pathReady={Boolean(selectedRotoPath?.length)} target={selectedCompLayer?.roto?.target ?? rotoTarget} diskCache={isPro}
            mode={rotoMode} quality={rotoQuality} view={rotoView} tolerance={rotoTolerance} edgeSensitivity={rotoEdgeSensitivity} brushSize={rotoBrushSize} brushStrength={rotoBrushStrength} backend={rotoBackend} backendLabel={rotoRuntimeLabel(rotoBackend, nativeCapabilities?.mlAcceleration?.provider, nativeCapabilities?.mlAcceleration?.model)} tracking={rotoTracking}
            onModeChange={setRotoMode} onTargetChange={(target) => { setRotoTarget(target); if (selectedCompLayer?.roto) updateSelectedRotoMask({ ...selectedCompLayer.roto, target }); }} onQualityChange={(quality) => { setRotoQuality(quality); invalidateSelectedRotoBake("precision changed"); }} onViewChange={setRotoView} onToleranceChange={(value) => { setRotoTolerance(value); invalidateSelectedRotoBake("selection tolerance changed"); }} onEdgeSensitivityChange={(value) => { setRotoEdgeSensitivity(value); invalidateSelectedRotoBake("edge protection changed"); }} onBrushSizeChange={setRotoBrushSize} onBrushStrengthChange={setRotoBrushStrength}
            onMaskChange={updateSelectedRotoMask} onTrack={(direction) => void trackRotoSubject(direction)} onStop={() => rotoAbortRef.current?.abort()} onClearBake={clearSelectedRotoBake} onSeek={seekComposition}
            onRemoveCorrection={removeRotoKeyframeAtPlayhead} onReset={() => updateCompositionLayer({ roto: undefined })} onReview={jumpToRotoReview} onAcceptReview={acceptCurrentRotoReview} onSmooth={smoothRotoTrack}
            onCreateTrackingNull={createSubjectTrackingNull} onTrackPoint={(stabilize) => void trackSelectedLayerPoint(stabilize)} onSmartReframe={createSmartReframeComposition} onCreateSubjectComp={createSubjectComposition} onCreateObjectLayer={createAnotherRotoObjectLayer} />
            : <section className="roto-pro-lock"><span><WandSparkles size={15} /><b>ROTO SUBJECT</b><em>DESKTOP PRO</em></span><p>Select, track, refine, and isolate a subject as a reusable transparent composition in ScenePilot Pro.</p></section>} />
      </section>

      <CompositionTimeline composition={activeComposition} selectedLayer={selectedCompLayer} selectedTrackId={selectedCompTrackId} selectedKeyframeId={selectedKeyframeId} time={compositionTime} frameRate={exportFrameRate} onScrubStart={stopShuttle}
        onAddTrack={addCompositionTrack} onRemoveTrack={removeCompositionTrack} onMoveTrack={moveCompositionTrack} onMoveTrackTo={moveCompositionTrackTo} onSetTrack={updateCompositionTrack} onSelectTrack={(trackId) => { setSelectedCompTrackId(trackId); if (selectedCompLayer?.trackId !== trackId) { setSelectedCompLayerId(""); setSelectedKeyframeId(null); } }} onDropAsset={dropOnCompositionTrack} onAddKeyframe={addCompositionKeyframe}
        onSelectLayer={(layerId) => { const layer = activeComposition?.layers.find((item) => item.id === layerId); setSelectedCompLayerId(layerId); if (layer?.trackId) setSelectedCompTrackId(layer.trackId); setSelectedKeyframeId(null); }} onSetLayerFlags={setCompositionLayerFlags} onSeek={seekComposition}
        onSelectKeyframe={(layerId, keyframeId, time) => { const layer = activeComposition?.layers.find(item => item.id === layerId); setSelectedCompLayerId(layerId); setSelectedKeyframeId(keyframeId); seekComposition(layer ? layerToCompositionTime(layer, time) : time); }}
        onBeginEdit={beginContinuousEdit} onEndEdit={endContinuousEdit} onCheckpoint={checkpoint} onUpdateKeyframeValue={updateCompositionKeyframeValue} />
      </>
      )}
      </>
      )}
      </Suspense>
    </StudioShell>
    </EditorContextMenuBoundary>
  );
}
