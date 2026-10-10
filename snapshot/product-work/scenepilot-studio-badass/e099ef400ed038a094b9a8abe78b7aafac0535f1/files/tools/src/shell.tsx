import { ArrowUpRight, Captions, ChevronLeft, Clapperboard, Palette, Scissors } from "lucide-react";
import type { ReactNode } from "react";

export type ToolId = "captions" | "board" | "grade";

export const TOOLS: Array<{ id: ToolId; name: string; blurb: string; icon: typeof Captions }> = [
  { id: "captions", name: "Captions", blurb: "On-device speech-to-text, word-by-word animated captions, burn-in WebM and SRT/VTT.", icon: Captions },
  { id: "board", name: "Board", blurb: "Paste a script, get a shot list and storyboard, print it, send the markers to the timeline.", icon: Clapperboard },
  { id: "grade", name: "Grade", blurb: "Steal the look of any still: colour transfer onto your clip, export a .cube LUT.", icon: Palette },
];

/**
 * Shared frame for the film tools: brand, ALPHA label, tool switcher, links back
 * to the editor and the site, and an always-visible "honest limits" panel.
 * Paths are relative so the pages work at /tools/<tool>/ on the site.
 */
export function ToolShell({ tool, limits, children, actions }: { tool: ToolId; limits: string[]; children: ReactNode; actions?: ReactNode }) {
  const current = TOOLS.find((item) => item.id === tool)!;
  return (
    <div className="tool-page">
      <a className="skip-link" href="#tool-main">Skip to the tool</a>
      <header className="tool-topbar">
        <div className="tool-brand">
          <a className="tool-back" href="../../" aria-label="Back to the ScenePilot site" title="ScenePilot site"><ChevronLeft size={16} /></a>
          <a className="tool-mark" href="../" aria-label="All ScenePilot film tools"><Scissors size={17} /></a>
          <div><strong>SCENEPILOT</strong><span>{current.name.toUpperCase()}</span></div>
          <span className="alpha-badge" title="Early alpha — expect rough edges">ALPHA</span>
        </div>
        <nav className="tool-switcher" aria-label="Film tools">
          {TOOLS.map((item) => {
            const Icon = item.icon;
            return <a key={item.id} href={`../${item.id}/`} aria-current={item.id === tool ? "page" : undefined}><Icon size={14} />{item.name}</a>;
          })}
        </nav>
        <div className="tool-actions">
          {actions}
          <a className="tool-editor-link" href="../../app/">Open the editor <ArrowUpRight size={14} /></a>
        </div>
      </header>
      <main id="tool-main" className="tool-main">{children}</main>
      <footer className="tool-footer">
        <details className="tool-limits">
          <summary>Alpha · what works and what doesn’t yet</summary>
          <ul>{limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
        </details>
        <p>Runs in this browser tab. Your media is not uploaded. Chrome or Edge recommended.</p>
      </footer>
    </div>
  );
}

/** Trigger a download of text or a Blob. */
export function downloadFile(name: string, content: string | Blob, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const baseName = (fileName: string) => fileName.replace(/\.[^/.]+$/, "") || "scenepilot";
