"use client";

import { Box, FolderOpen, Plus, Sparkles, TextQuote } from "lucide-react";
import { memo, useState, type DragEvent, type KeyboardEvent } from "react";

export type ProjectPanelTab = "project" | "effects" | "compositions" | "transcript";
type Props = {
  value: ProjectPanelTab;
  mediaCount: number;
  compositionCount: number;
  transcriptCount: number;
  effectCount: number;
  showTranscript?: boolean;
  dimensions: { width: number; height: number };
  frameRate: number;
  onChange(value: ProjectPanelTab): void;
  onCreateComposition(): void;
  canCreateComposition?: boolean;
  onDropCompositionSource?(event: DragEvent<HTMLButtonElement>): void;
};

export const ProjectPanelTabs = memo(function ProjectPanelTabs(props: Props) {
  const [dragging, setDragging] = useState(false);
  const tabs: ProjectPanelTab[] = props.showTranscript === false ? ["project", "compositions", "effects"] : ["project", "compositions", "effects", "transcript"];
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = tabs.indexOf(props.value);
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    props.onChange(next);
    requestAnimationFrame(() => document.getElementById(`project-tab-${next}`)?.focus());
  };
  return <div className="project-panel-nav" data-active-tab={props.value}>
    <div className={props.showTranscript === false ? "three-tabs" : ""} role="tablist" aria-label="Project assets">
      <button id="project-tab-project" role="tab" tabIndex={props.value === "project" ? 0 : -1} aria-selected={props.value === "project"} className={props.value === "project" ? "active" : ""} onKeyDown={tabKey} onClick={() => props.onChange("project")}>
        <FolderOpen size={13} /><span>Media</span><small>{props.mediaCount}</small>
      </button>
      <button id="project-tab-compositions" role="tab" tabIndex={props.value === "compositions" ? 0 : -1} aria-selected={props.value === "compositions"} className={props.value === "compositions" ? "active" : ""} onKeyDown={tabKey} onClick={() => props.onChange("compositions")}>
        <Box size={13} /><span>Comps</span><small>{props.compositionCount}</small>
      </button>
      <button id="project-tab-effects" role="tab" tabIndex={props.value === "effects" ? 0 : -1} aria-selected={props.value === "effects"} className={props.value === "effects" ? "active" : ""} onKeyDown={tabKey} onClick={() => props.onChange("effects")}>
        <Sparkles size={13} /><span>Effects</span><small>{props.effectCount}</small>
      </button>
      {props.showTranscript !== false && <button id="project-tab-transcript" role="tab" tabIndex={props.value === "transcript" ? 0 : -1} aria-selected={props.value === "transcript"} className={props.value === "transcript" ? "active" : ""} onKeyDown={tabKey} onClick={() => props.onChange("transcript")}>
        <TextQuote size={13} /><span>Transcript</span><small>{props.transcriptCount}</small>
      </button>}
    </div>
    {props.canCreateComposition !== false && (props.value === "project" || props.value === "compositions") && <button className={`match-comp-button composition-create-box ${dragging ? "drop-active" : ""}`} onClick={props.onCreateComposition} title="New composition with custom settings · or drop project media here"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(false); props.onDropCompositionSource?.(event); }}>
      <Plus size={16} /><span>New composition<small>Click to create · drop media to match</small></span><small>{props.dimensions.width}×{props.dimensions.height} · {props.frameRate}p</small>
    </button>}
  </div>;
});
