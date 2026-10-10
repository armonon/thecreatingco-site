import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, ChevronLeft, Scissors } from "lucide-react";
import { TOOLS } from "./shell";
import "./tools.css";

function Hub() {
  return (
    <div className="tool-page">
      <header className="tool-topbar">
        <div className="tool-brand">
          <a className="tool-back" href="../" aria-label="Back to the ScenePilot site" title="ScenePilot site"><ChevronLeft size={16} /></a>
          <span className="tool-mark" aria-hidden="true"><Scissors size={17} /></span>
          <div><strong>SCENEPILOT</strong><span>FILM TOOLS</span></div>
          <span className="alpha-badge">ALPHA</span>
        </div>
        <span />
        <div className="tool-actions"><a className="tool-editor-link" href="../app/">Open the editor <ArrowUpRight size={14} /></a></div>
      </header>
      <main id="tool-main" className="tool-main">
        <div className="tool-heading">
          <div>
            <span className="eyebrow">Free · in your browser · alpha</span>
            <h1>Film tools.</h1>
            <p>Free single-purpose tools for the work around the edit: cut it to the music with AutoCut, caption it, board it, grade it. Each one runs locally in your browser (nothing is uploaded) and hands its result to the ScenePilot editor.</p>
          </div>
        </div>
        <div className="hub-grid">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <a key={tool.id} className={`hub-card${tool.id === "autocut" ? " hub-card-featured" : ""}`} href={`./${tool.id}/`}>
                {tool.id === "autocut" && <em className="hub-new">New · start here</em>}
                <h2><Icon size={22} /> {tool.name}</h2>
                <p>{tool.blurb}</p>
                <span>Open {tool.name} ↗</span>
              </a>
            );
          })}
        </div>
      </main>
      <footer className="tool-footer"><p>Alpha tools: expect rough edges. Media stays on your device.</p></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Hub /></StrictMode>);
