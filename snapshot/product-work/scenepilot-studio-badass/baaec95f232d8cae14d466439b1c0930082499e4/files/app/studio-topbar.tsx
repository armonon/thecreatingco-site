import { ChevronDown, Clock3, Download, Film, FolderOpen, MonitorPlay, Save, Scissors, Search, Redo2, Undo2 } from "lucide-react";
import type { ProjectSummary } from "../lib/project-store";
import type { EditionCapabilities } from "./edition";
import { StandaloneRuntime } from "./standalone-runtime";

type Props = {
  embedded: boolean;
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
};

export function StudioTopbar(props: Props) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        {props.embedded && <a className="back-to-site" href="../" aria-label="Back to the ScenePilot site" title="Back to the ScenePilot site"><ChevronDown size={16} style={{ transform: "rotate(90deg)" }} /></a>}
        <div className="brand-mark"><Scissors size={18} /></div><div><strong>SCENEPILOT</strong><span>STUDIO</span></div>
        <span className={`edition-badge ${props.isPro ? "pro" : "lite"}`}>{props.capabilities.label}</span>
      </div>
      <div className="project-title"><span className="status-dot" /><span>{props.title}{props.dirty ? " · Unsaved" : ""}</span><ChevronDown size={14} /></div>
      <div className="top-actions">
        {props.capabilities.multipleProjects && props.projects.length > 0 && <select className="project-switcher" aria-label="Open Pro project" value={props.activeProjectId} onChange={(event) => props.onProjectChange(event.target.value)}>{props.activeProjectId === "current" && <option value="current">CURRENT UNSAVED PROJECT</option>}{props.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
        <StandaloneRuntime />
        <button className="icon-button" onClick={props.onNewProject} disabled={props.analyzing || props.rendering} aria-label="New project" title="New project · ⌘N"><Film size={16} /></button>
        <button className="icon-button" onClick={props.onOpenCommands} aria-label="Open command palette" title="Command palette · ⇧⌘P"><Search size={16} /></button>
        <button className="icon-button" onClick={props.onRestoreProject} disabled={props.analyzing || props.rendering} aria-label="Restore saved project" title="Restore project"><FolderOpen size={16} /></button>
        {props.isPro && <button className="icon-button" onClick={props.onOpenRecovery} aria-label="Open autosave history" title="Autosave history"><Clock3 size={16} /></button>}
        <button className="icon-button" onClick={props.onSave} disabled={props.analyzing || props.rendering} aria-label="Save project" title="Save project"><Save size={16} /></button>
        <button className="icon-button" onClick={props.onUndo} disabled={!props.canUndo || props.analyzing || props.rendering} aria-label="Undo" title="Undo"><Undo2 size={16} /></button>
        <button className="icon-button" onClick={props.onRedo} disabled={!props.canRedo || props.analyzing || props.rendering} aria-label="Redo" title="Redo"><Redo2 size={16} /></button>
        {props.isPro && <button className={`queue-button ${props.queueOpen ? "active" : ""}`} onClick={props.onOpenQueue} aria-label="Open delivery workspace" aria-pressed={props.queueOpen}><MonitorPlay size={15} /><span>Queue</span><b>{props.queueLength}</b></button>}
        <button className="export-button record-action" onClick={props.onExport} disabled={!props.renderableSequence || props.analyzing || props.selectedProfileChecking || !props.selectedProfileSupported || (!props.isPro && props.rendering)}><i className={props.rendering ? "action-led active" : "action-led"} /><Download size={16} /> {props.isPro ? props.rendering ? `Queue another · ${Math.round(props.renderProgress * 100)}%` : "Add to Queue" : props.rendering ? `${Math.round(props.renderProgress * 100)}%` : "Render MP4"}</button>
      </div>
    </header>
  );
}
