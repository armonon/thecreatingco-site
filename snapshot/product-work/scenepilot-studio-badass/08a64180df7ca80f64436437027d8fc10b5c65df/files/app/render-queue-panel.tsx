import { Activity, FolderOpen, MonitorPlay, Pause, Play, RotateCcw, X } from "lucide-react";
import type { RenderJob } from "../lib/pro-editor";
import { isPendingRender, renderStageLabel, renderShowsProgress } from "../lib/render-job-state";

type Props = {
  jobs: RenderJob[];
  paused: boolean;
  rendering: boolean;
  hardwareStatus: string;
  onTogglePaused: () => void;
  onReveal: (job: RenderJob) => void;
  onRetry: (job: RenderJob) => void;
  onRemove: (jobId: string) => void;
  onClearFinished: () => void;
  onCancelActive: () => void;
};

export function RenderQueuePanel(props: Props) {
  const activeCount = props.jobs.filter((job) => isPendingRender(job.status)).length;
  return (
    <aside className="delivery-queue-panel">
      <div className="delivery-panel-head"><span><MonitorPlay size={15} /> RENDER QUEUE</span><div><small>{activeCount} active</small><button className={props.paused ? "queue-pause active" : "queue-pause"} onClick={props.onTogglePaused}>{props.paused ? <Play size={11} /> : <Pause size={11} />}{props.paused ? "Resume" : "Pause"}</button></div></div>
      <div className="render-queue-hardware"><Activity size={13} /><span>{props.hardwareStatus}</span></div>
      <div className="render-job-list">
        {props.jobs.length ? [...props.jobs].reverse().map((job) => (
          <div className={`render-job ${job.status}`} key={job.id}>
            <div><strong>{job.name}</strong><span>{job.message}</span></div>
            {job.error && <p role="status" style={{ overflowWrap: "anywhere" }}>{job.error}</p>}
            <small>{renderStageLabel(job.status)} · {job.kind === "audio-stem" ? `24-BIT WAV / 48 KHZ · ${job.audioStem?.toUpperCase() ?? "STEM"}` : `${job.maxDimension ?? 1080}px / ${job.frameRate ?? 30}fps`}{renderShowsProgress(job.status) ? ` · ${Math.round(job.progress * 100)}%` : ""}</small>
            {renderShowsProgress(job.status) && <i><b style={{ width: `${job.progress * 100}%` }} /></i>}
            {job.status === "awaiting-destination" && <p role="status">Choose a file location, or cancel the Save dialog to return to editing. No encoding has started.</p>}
            {job.status === "completed" && job.outputPath && <button className="render-job-resume" onClick={() => props.onReveal(job)}><FolderOpen size={12} /> Reveal output</button>}
            {(job.status === "failed" || job.status === "canceled") && <button className="render-job-resume" onClick={() => props.onRetry(job)}><RotateCcw size={12} /> Retry render</button>}
            {job.status === "queued" && <button className="render-job-remove" onClick={() => props.onRemove(job.id)}><X size={12} /> Remove</button>}
          </div>
        )) : <div className="delivery-empty-queue"><MonitorPlay size={26} /><strong>Queue is ready</strong><span>Choose a profile and add your first master.</span></div>}
      </div>
      {props.jobs.some((job) => job.status === "completed" || job.status === "canceled") && <button className="queue-clear" onClick={props.onClearFinished}>Clear finished jobs</button>}
      {props.rendering && <button className="queue-cancel" onClick={props.onCancelActive}>Cancel active export</button>}
    </aside>
  );
}
