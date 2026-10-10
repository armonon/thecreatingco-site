import { useState, type ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, Download, Gauge, MonitorPlay, Scissors, Sparkles, Waves } from "lucide-react";
import { ASPECT_LABELS, type OutputAspect } from "../lib/aspect";
import type { ExportProfileSupport } from "../lib/capabilities";
import type { DesktopHealthCheck } from "../lib/desktop-health";
import { assessDeliveryAudio } from "../lib/delivery-audio";
import type { ProgramLoudnessReport } from "../lib/audio-loudness";
import { formatTime, formatTimecode } from "../lib/format";
import type { RenderFormat, RenderJob, TimelineRange } from "../lib/pro-editor";
import type { RenderRisk } from "../lib/workflow";
import { DesktopEngineCard } from "./desktop-engine-card";
import { RenderQueuePanel } from "./render-queue-panel";

type FrameRate = 24 | 25 | 30 | 50 | 60;

type Props = {
  preview: ReactNode;
  playing: boolean;
  onTogglePlayback(): void;
  onSeek(time: number): void;
  exportFormat: RenderFormat;
  maxDimension: 1920 | 3840;
  frameRate: FrameRate;
  aspect: OutputAspect;
  timelineRange: TimelineRange;
  currentTime: number;
  duration: number;
  deliveryStart: number;
  deliveryEnd: number;
  deliveryDuration: number;
  deliveryHasSequence: boolean;
  deliveryRangeValid: boolean;
  deliveryRisk: RenderRisk;
  renderEngineChecks: DesktopHealthCheck[];
  previewDimensions: { width: number; height: number };
  mainName: string;
  hasMainFile: boolean;
  hasCompositionVisuals: boolean;
  shotCount: number;
  placementCount: number;
  audioTrackCount: number;
  audioClipCount: number;
  hasAudio: boolean;
  integratedLufs: number;
  peakDb: number;
  audioSampleCount: number;
  offlineAudioReport: ProgramLoudnessReport | null;
  offlineAudioAnalyzing: boolean;
  analyzing: boolean;
  rendering: boolean;
  selectedProfileSupported: boolean;
  selectedProfileChecking: boolean;
  selectedProfileMessage: string;
  exportProfileSupport: ExportProfileSupport;
  jobs: RenderJob[];
  queuePaused: boolean;
  hardwareStatus: string;
  onFormatChange: (value: RenderFormat) => void;
  onMaxDimensionChange: (value: 1920 | 3840) => void;
  onFrameRateChange: (value: FrameRate) => void;
  onAspectChange: (value: OutputAspect) => void;
  onRangeChange: (value: TimelineRange) => void;
  onReturnToEdit: () => void;
  onQueueExport: (outputName?: string) => void;
  onQueueSocialVersions: () => void;
  onQueueAudioStems: () => void;
  onToggleQueuePaused: () => void;
  onReveal: (job: RenderJob) => void;
  onRetry: (job: RenderJob) => void;
  onRemove: (jobId: string) => void;
  onClearFinished: () => void;
  onCancelActive: () => void;
  onAnalyzeAudio: () => void;
};

export function DeliveryWorkspace(props: Props) {
  const outputBase = props.mainName.replace(/\.[^/.]+$/, "") || "scenepilot";
  const [outputName, setOutputName] = useState("");
  const resolvedName = outputName.trim().replace(/[^a-z0-9._ -]/gi, "-") || `${outputBase}-scenepilot`;
  const sourceReady = props.deliveryHasSequence;
  const showQueue = props.jobs.length > 0 || props.rendering || props.queuePaused;
  const audioAssessment = assessDeliveryAudio({
    hasAudio: props.hasAudio,
    integratedLufs: props.offlineAudioReport?.integratedLufs ?? props.integratedLufs,
    peakDb: props.offlineAudioReport?.truePeakDbtp ?? props.peakDb,
    sampleCount: props.offlineAudioReport ? Math.max(30, props.offlineAudioReport.blocksMeasured) : props.audioSampleCount,
  });
  const audioDetail = props.offlineAudioReport
    ? `${props.offlineAudioReport.integratedLufs.toFixed(1)} LUFS · ${props.offlineAudioReport.truePeakDbtp.toFixed(1)} dBTP (4× estimate) · ${props.offlineAudioReport.loudnessRangeLu.toFixed(1)} LU range · full ${formatTime(props.offlineAudioReport.duration)} mix`
    : audioAssessment.detail;
  const setProfile = (format: RenderFormat, maxDimension: 1920 | 3840) => {
    props.onFormatChange(format);
    props.onMaxDimensionChange(maxDimension);
    props.onFrameRateChange(30);
  };
  return (
    <section className={`deliver-workspace ${showQueue ? "has-jobs" : "no-jobs"}`} aria-label="Delivery workspace">
      <aside className="delivery-settings-panel">
        <div className="delivery-panel-head"><span><Download size={15} /> OUTPUT SETTINGS</span><small>Professional delivery profiles</small></div>
        <div className="delivery-section">
          <div className="delivery-section-title"><span>QUICK PROFILES</span><small>one-click setup</small></div>
          <div className="delivery-profile-list">
            <button className={props.exportFormat === "mp4-h264" && props.maxDimension === 1920 && props.frameRate === 30 ? "active" : ""} onClick={() => setProfile("mp4-h264", 1920)}><span><strong>Social / Web</strong><small>H.264 · 1080p · 30 fps</small></span><CheckCircle2 size={14} /></button>
            <button className={props.exportFormat === "mp4-hevc" && props.maxDimension === 3840 ? "active" : ""} onClick={() => setProfile("mp4-hevc", 3840)}><span><strong>4K Master</strong><small>HEVC · 2160p · 30 fps</small></span><CheckCircle2 size={14} /></button>
            <button className={props.exportFormat === "webm-vp9" ? "active" : ""} onClick={() => setProfile("webm-vp9", 1920)}><span><strong>Open Web</strong><small>VP9 · WebM · 1080p</small></span><CheckCircle2 size={14} /></button>
            <button className={props.exportFormat === "webm-vp9-alpha" ? "active" : ""} onClick={() => setProfile("webm-vp9-alpha", 1920)}><span><strong>Alpha Master</strong><small>VP9 · transparent WebM</small></span><CheckCircle2 size={14} /></button>
          </div>
        </div>
        <details className="delivery-advanced"><summary>Custom video settings</summary><div className="delivery-section delivery-custom-grid">
          <label><span>FORMAT</span><select value={props.exportFormat} onChange={(event) => props.onFormatChange(event.target.value as RenderFormat)}><option value="mp4-h264">H.264 · MP4</option><option value="mp4-hevc">HEVC · MP4</option><option value="webm-vp9">VP9 · WebM</option><option value="webm-vp9-alpha">VP9 + Alpha · WebM</option></select></label>
          <label><span>RESOLUTION</span><select value={props.maxDimension} onChange={(event) => props.onMaxDimensionChange(Number(event.target.value) as 1920 | 3840)}><option value="1920">1080p</option><option value="3840">4K UHD</option></select></label>
          <label><span>FRAME RATE</span><select value={props.frameRate} onChange={(event) => props.onFrameRateChange(Number(event.target.value) as FrameRate)}><option value="24">24 fps</option><option value="25">25 fps</option><option value="30">30 fps</option><option value="50">50 fps</option><option value="60">60 fps</option></select></label>
          <label><span>FRAME</span><select value={props.aspect} onChange={(event) => props.onAspectChange(event.target.value as OutputAspect)}>{Object.entries(ASPECT_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
        </details>
        <div className="delivery-section">
          <div className="delivery-section-title"><span>EXPORT RANGE</span><small>{props.deliveryDuration.toFixed(2)} seconds</small></div>
          <div className="delivery-range-buttons"><button className={props.timelineRange.inPoint === null && props.timelineRange.outPoint === null ? "active" : ""} onClick={() => props.onRangeChange({ inPoint: null, outPoint: null })}>Entire sequence</button><button className={props.timelineRange.inPoint !== null || props.timelineRange.outPoint !== null ? "active" : ""} onClick={() => props.onRangeChange({ inPoint: props.timelineRange.inPoint ?? props.currentTime, outPoint: props.timelineRange.outPoint ?? Math.min(props.duration, Math.max(props.currentTime + 1, props.duration)) })}>In / Out</button></div>
          <div className="delivery-time-range"><span><small>IN</small><strong>{formatTimecode(Math.min(props.deliveryStart, props.deliveryEnd), props.frameRate)}</strong></span><i /><span><small>OUT</small><strong>{formatTimecode(Math.max(props.deliveryStart, props.deliveryEnd), props.frameRate)}</strong></span></div>
        </div>
        <details className="delivery-advanced"><summary>Render engine diagnostics</summary><DesktopEngineCard checks={props.renderEngineChecks} /></details>
      </aside>

      <div className="delivery-review-panel">
        <div className="delivery-review-head"><span><MonitorPlay size={15} /> DELIVERY REVIEW</span><button onClick={props.onReturnToEdit}><Scissors size={13} /> Return to edit</button></div>
        <div className="delivery-preview-card">
          <div className="delivery-preview-frame" style={{ aspectRatio: `${props.previewDimensions.width} / ${props.previewDimensions.height}` }}>{props.preview}</div>
          <div className="delivery-preview-transport"><button disabled={!sourceReady || props.rendering} onClick={props.onTogglePlayback}>{props.playing ? "Pause" : "Play preview"}</button><input aria-label="Scrub export preview" type="range" min={0} max={props.duration || 1} step={1 / props.frameRate} value={props.currentTime} disabled={!sourceReady || props.rendering} onChange={e => props.onSeek(Number(e.target.value))} /><output>{formatTimecode(props.currentTime, props.frameRate)}</output></div>
          <p className="delivery-preview-note">Main sequence · applied effects only · range {formatTime(props.deliveryStart)}–{formatTime(props.deliveryEnd)}</p>
          <label className="delivery-output-name"><span>FILE NAME (without extension)</span><input aria-label="Export file name" value={outputName} placeholder={`${outputBase}-scenepilot`} maxLength={120} onChange={e => setOutputName(e.target.value)} /><strong>{resolvedName}.{props.exportFormat.startsWith("webm") ? "webm" : "mp4"}</strong></label>
          <p className="delivery-preview-note">Choose a save location when prompted. Browser downloads use your browser’s download location.</p>
        </div>
        <details className="delivery-advanced"><summary>Output details & preflight checks</summary><div className="delivery-spec-grid">
          <article><small>VIDEO</small><strong>{props.exportFormat === "mp4-h264" ? "H.264" : props.exportFormat === "mp4-hevc" ? "HEVC" : "VP9"}</strong><span>{props.maxDimension === 3840 ? "3840 max dimension" : "1920 max dimension"}</span></article>
          <article><small>TIMING</small><strong>{props.frameRate} FPS</strong><span>{Math.ceil(props.deliveryDuration * props.frameRate).toLocaleString()} frames</span></article>
          <article><small>AUDIO</small><strong>{props.audioTrackCount} TRACK MIX</strong><span>{props.audioClipCount} placed clips{props.hasMainFile ? " + source" : " · no main source"}</span></article>
          <article><small>RANGE</small><strong>{formatTime(props.deliveryDuration)}</strong><span>{props.timelineRange.inPoint === null && props.timelineRange.outPoint === null ? "Entire sequence" : "Marked in / out"}</span></article>
        </div>
        <div className="delivery-preflight">
          <div className="delivery-section-title"><span>PREFLIGHT</span><small>{props.deliveryHasSequence && props.deliveryRangeValid && props.selectedProfileSupported && !props.selectedProfileChecking ? "ready to render" : "attention needed"}</small></div>
          <div className={sourceReady ? "pass" : "warn"}>{sourceReady ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}<span><strong>Visual source</strong><small>{!sourceReady ? "Place a clip or composition on the timeline" : props.hasMainFile ? props.mainName : props.hasCompositionVisuals ? "Composition-generated master · no source media required" : "Timeline media · no main source required"}</small></span></div>
          <div className={props.deliveryHasSequence ? "pass" : "warn"}>{props.deliveryHasSequence ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}<span><strong>Sequence content</strong><small>{props.deliveryHasSequence ? `${props.shotCount} shots · ${props.placementCount} timeline items` : "Build an edit before delivery"}</small></span></div>
          <div className={props.deliveryRangeValid ? "pass" : "warn"}>{props.deliveryRangeValid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}<span><strong>Export range</strong><small>{props.deliveryRangeValid ? `${props.deliveryDuration.toFixed(2)} seconds selected` : "Set a valid in / out range"}</small></span></div>
          <div className={props.selectedProfileSupported && !props.selectedProfileChecking ? "pass" : "warn"}>{props.selectedProfileSupported && !props.selectedProfileChecking ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}<span><strong>Exact output profile</strong><small>{props.selectedProfileMessage}</small></span></div>
          <div className={audioAssessment.status === "pass" ? "pass" : audioAssessment.status === "silent" ? "notice" : "warn"}>{audioAssessment.status === "pass" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}<span><strong>{props.offlineAudioReport ? "Offline program loudness" : audioAssessment.label}</strong><small>{audioDetail}</small></span><button disabled={!props.hasAudio || props.offlineAudioAnalyzing} onClick={props.onAnalyzeAudio}>{props.offlineAudioAnalyzing ? "Analyzing…" : props.offlineAudioReport ? "Analyze again" : "Analyze full mix"}</button></div>
          <div className={props.deliveryRisk === "normal" ? "pass" : "notice"}>{props.deliveryRisk === "normal" ? <CheckCircle2 size={14} /> : <Gauge size={14} />}<span><strong>Memory profile</strong><small>{props.deliveryRisk === "normal" ? "Standard render safeguards" : `${props.deliveryRisk} load · direct-to-disk safeguards active`}</small></span></div>
        </div>
        </details>
        <p role="status" className="delivery-ready-status">{!sourceReady ? "Add media or a composition to your sequence first." : !props.deliveryRangeValid ? "Choose a valid export range." : props.selectedProfileMessage}</p>
        <button className="delivery-queue-cta" disabled={!props.deliveryHasSequence || !props.deliveryRangeValid || props.analyzing || props.selectedProfileChecking || !props.selectedProfileSupported} onClick={() => props.onQueueExport(resolvedName)}>{props.rendering ? <Activity size={17} /> : <Download size={17} />}<span><strong>{props.rendering ? "Queue another export" : "Export video"}</strong><small>{props.selectedProfileSupported ? "Queued rendering · native core when the sequence qualifies" : "Resolve the failed preflight check first"}</small></span></button>
        <details className="delivery-advanced"><summary>Social versions & audio stems</summary>
        <button className="delivery-queue-cta" disabled={!props.deliveryHasSequence || props.analyzing || props.exportProfileSupport.checking || !props.exportProfileSupport.supported} onClick={props.onQueueSocialVersions}><Sparkles size={17} /><span><strong>QUEUE SOCIAL VERSION SET</strong><small>Landscape, vertical, square and portrait highlight masters</small></span></button>
        <button className="delivery-queue-cta stem-delivery-cta" disabled={!props.hasAudio || props.analyzing} onClick={props.onQueueAudioStems}><Waves size={17} /><span><strong>QUEUE MASTER + AUDIO STEMS</strong><small>24-bit / 48 kHz WAV · master, music, dialogue and SFX</small></span></button>
        </details>
      </div>

      {showQueue && <RenderQueuePanel jobs={props.jobs} paused={props.queuePaused} rendering={props.rendering} hardwareStatus={props.hardwareStatus} onTogglePaused={props.onToggleQueuePaused} onReveal={props.onReveal} onRetry={props.onRetry} onRemove={props.onRemove} onClearFinished={props.onClearFinished} onCancelActive={props.onCancelActive} />}
    </section>
  );
}
