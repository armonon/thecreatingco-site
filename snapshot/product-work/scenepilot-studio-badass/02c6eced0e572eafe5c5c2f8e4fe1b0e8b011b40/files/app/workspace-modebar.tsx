import { ArrowRight, Box, Download, Music2, MonitorPlay, Palette, WandSparkles } from "lucide-react";
import type { JourneyGuide, ProductWorkspace } from "../lib/product-journey";
import { WorkspaceLayoutControls, useFullWorkspaceControls } from "./studio-shell";
import { ShellDisclosure } from "./shell-disclosure";

type Props = {
  workspace: ProductWorkspace;
  isPro: boolean;
  projectName: string;
  projectKind: string;
  bpm: number;
  sequenceItemCount: number;
  videoTrackCount: number;
  activeCompositionName?: string;
  activeCompositionLayerCount: number;
  activeCompositionDuration: number;
  guide: JourneyGuide;
  onOpen: (workspace: ProductWorkspace) => void;
  onGuideAction: () => void;
};

const WORKSPACES = [
  { id: "edit", label: "Edit", detail: "Source + timeline", icon: MonitorPlay },
  { id: "composition", label: "Motion", detail: "Compositions + keyframes", icon: Box, pro: true },
  { id: "color", label: "Color", detail: "Grade + scopes", icon: Palette, pro: true },
  { id: "audio", label: "Audio", detail: "Mix + automate", icon: Music2, pro: true },
  { id: "auto", label: "Auto Cut", detail: "Analyze + build an edit", icon: WandSparkles },
  { id: "deliver", label: "Deliver", detail: "Queue + export", icon: Download, pro: true },
] as const;

export function WorkspaceModebar(props: Props) {
  const full = useFullWorkspaceControls();
  const workspaceButton = (item: typeof WORKSPACES[number]) => {
    const Icon = item.icon;
    const locked = Boolean("pro" in item && item.pro && !props.isPro);
    return <button key={item.id} className={`${props.workspace === item.id ? `active ${item.id}` : ""} ${locked ? "pro-preview" : ""}`} disabled={locked}
      title={locked ? `${item.label} is available in Desktop Pro` : item.detail} onClick={() => props.onOpen(item.id)} aria-pressed={props.workspace === item.id}>
      <Icon size={15} /><span><strong>{item.label}</strong><small>{locked ? "Desktop Pro" : item.detail}</small></span>
    </button>;
  };
  const advanced = WORKSPACES.filter((item) => item.id !== "edit" && item.id !== "auto");
  return (
    <nav className="workspace-modebar" aria-label="ScenePilot workspaces">
      <div className="workspace-home"><span className="status-dot" /><strong>{props.projectName}</strong><small>{props.projectKind}</small></div>
      <div className="workspace-mode-tabs">
        {full ? WORKSPACES.map(workspaceButton) : <>
          {WORKSPACES.filter((item) => item.id === "edit" || item.id === "auto").map(workspaceButton)}
          <ShellDisclosure className="workspace-more" label="Tools" closeOnAction>{advanced.map(workspaceButton)}</ShellDisclosure>
        </>}
      </div>
      <button className="workspace-next-action" onClick={props.onGuideAction} title={props.guide.detail}>
        <span><small>{props.guide.eyebrow}</small><strong>{props.guide.title}</strong></span>
        <em>{props.guide.actionLabel}<ArrowRight size={13} /></em>
      </button>
      <WorkspaceLayoutControls editing={!["auto", "deliver"].includes(props.workspace)} />
      <div className="workspace-readout">
        <span className="workspace-status"><i /> LIVE ENGINE</span>
        <strong>{props.workspace === "auto" ? "AUTO DIRECTOR" : props.workspace === "composition" ? props.activeCompositionName : props.projectName}</strong>
        <small>{props.workspace === "auto"
          ? `${props.bpm} BPM · ${props.sequenceItemCount} hits`
          : props.workspace === "composition"
            ? `${props.activeCompositionLayerCount} layers · ${props.activeCompositionDuration}s`
            : `${props.sequenceItemCount} clips & comps · ${props.videoTrackCount} video tracks`}</small>
      </div>
    </nav>
  );
}
