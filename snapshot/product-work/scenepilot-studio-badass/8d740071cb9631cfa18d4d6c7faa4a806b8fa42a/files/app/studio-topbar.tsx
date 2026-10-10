import { ChevronDown, Clapperboard, Clock3, Download, Film, FolderOpen, MonitorPlay, Save, Scissors, Search, Redo2, Undo2 } from "lucide-react";
import type { ProjectSummary } from "../lib/project-store";
import type { EditionCapabilities } from "./edition";
import { StandaloneRuntime } from "./standalone-runtime";
import { ShellDisclosure } from "./shell-disclosure";
import { LockerSaveButton, SuiteMenu } from "./suite-ui";

type Props = {
  embedded: boolean;
  /** Most recent render or hand-off file, offered to the thecreateco Locker. */
  lockerItem?: { blob: Blob; name: string } | null;
  dirty?: boolean;
  isPro: boolean;
  capabilities: EditionCapabilities;
  title: string | undefined;
  projects: ProjectSummary[];
  activeProjectId: string;
  analyzing: boolean;
  rendering: boolean;
  canUndo: boolean;
  canRedo: boolean;
  queueOpen: boolean;
  queueLength: number;
  renderableSequence: boolean;
  selectedProfileChecking: boolean;
  selectedProfileSupported: boolean;
  renderProgress: number;
  onProjectChange: (projectId: string) => void;
  onNewProject: () => void;
  onOpenCommands: () => void;
  onRestoreProject: () => void;
  onOpenRecovery: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenQueue: () => void;
  onExport: () => void;
  /** Premiere Pro hand-off (FCP7 XML / CMX3600 EDL); hidden until there is a cut. */
  onExportPremiere?: (kind: "xml" | "edl") => void;
};

export function StudioTopbar(props: Props) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        {props.embedded && <a className="back-to-site" href="../" aria-label="Back to the ScenePilot site" title="Back to the ScenePilot site"><ChevronDown size={16} style={{ transform: "rotate(90deg)" }} /></a>}
        <div className="brand-mark"><Scissors size={18} /></div><div><strong>SCENEPILOT</strong><span>STUDIO</span></div>
        <span className={`edition-badge ${props.isPro ? "pro" : "lite"}`}>{props.capabilities.label}</span>
      </div>
      <div className="project-title"><span className="status-dot" /><span>{props.title}{props.dirty ? " · Unsaved" : ""}</span></div>
      <div className="top-actions">
        <SuiteMenu />
        {props.lockerItem && <LockerSaveButton className="locker-save-button" label={`Save ${props.lockerItem.name.split(".").pop()?.toUpperCase() ?? "file"} to Locker`} item={() => props.lockerItem ? { name: props.lockerItem.name, type: props.lockerItem.blob.type || "application/octet-stream", blob: props.lockerItem.blob } : null} />}
        <StandaloneRuntime />
        {props.embedded && <a className="icon-button" href="../tools/" aria-label="Film tools (alpha): AutoCut, Reframe, Captions, Board, Grade" title="Film tools (alpha) · AutoCut, Reframe, Captions, Board, Grade"><Clapperboard size={16} /></a>}
        <ShellDisclosure className="project-file-menu" label="File" closeOnAction>
        {props.capabilities.multipleProjects && props.projects.length > 0 && <label className="file-project-picker">Your projects<select className="project-switcher" aria-label="Open Pro project" value={props.activeProjectId} onChange={(event) => props.onProjectChange(event.target.value)}>{props.activeProjectId === "current" && <option value="current">Current unsaved project</option>}{props.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
        <button onClick={props.onNewProject} disabled={props.analyzing || props.rendering} aria-label="New project" title="New project · ⌘N"><Film size={16} /> New project</button>
        <button onClick={props.onRestoreProject} disabled={props.analyzing || props.rendering} aria-label="Restore saved project"><FolderOpen size={16} /> Open project</button>
        {props.isPro && <button onClick={props.onOpenRecovery} aria-label="Open autosave history"><Clock3 size={16} /> Autosave history</button>}
        {props.isPro && <button onClick={props.onOpenQueue} aria-label="Open delivery workspace" aria-pressed={props.queueOpen}><MonitorPlay size={15} /> Export queue · {props.queueLength}</button>}
        {props.onExportPremiere && <button onClick={() => props.onExportPremiere?.("xml")} disabled={props.analyzing || props.rendering} title="Final Cut Pro 7 XML — Premiere Pro: File → Import"><Download size={15} /> Export for Premiere (XML)</button>}
        {props.onExportPremiere && <button onClick={() => props.onExportPremiere?.("edl")} disabled={props.analyzing || props.rendering} title="CMX3600 EDL of the V1 cut + song"><Download size={15} /> Export EDL (CMX3600)</button>}
        </ShellDisclosure>
        <button className="icon-button" onClick={props.onOpenCommands} aria-label="Open command palette" title="Command palette · ⇧⌘P"><Search size={16} /></button>
        <button className="icon-button" onClick={props.onSave} disabled={props.analyzing || props.rendering} aria-label="Save project" title="Save project"><Save size={16} /></button>
        <button className="icon-button" onClick={props.onUndo} disabled={!props.canUndo || props.analyzing || props.rendering} aria-label="Undo" title="Undo"><Undo2 size={16} /></button>
        <button className="icon-button" onClick={props.onRedo} disabled={!props.canRedo || props.analyzing || props.rendering} aria-label="Redo" title="Redo"><Redo2 size={16} /></button>
        <button className="export-button" onClick={props.isPro ? props.onOpenQueue : props.onExport} disabled={props.isPro ? props.analyzing : !props.renderableSequence || props.analyzing || props.selectedProfileChecking || !props.selectedProfileSupported || props.rendering}><Download size={16} /> {props.rendering ? `Exporting · ${Math.round(props.renderProgress * 100)}%` : props.isPro ? "Export" : "Render MP4"}</button>
      </div>
    </header>
  );
}
