"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { splitUnifiedTimeline } from "../lib/video-timeline";
import { TRANSITION_PRESETS } from "../lib/transitions";
import { formatTime } from "../lib/format";
import { outputDimensions } from "../lib/aspect";
import { previewFrameTime } from "../lib/preview-frame-time";
import { CanvasPreview, type PreviewAsset } from "./canvas-preview";
import type { AutoEditVersion } from "./auto-edit-types";

/** Isolated cut review. Never swaps the user's timeline or controls its transport. */
export function AutoDraftPreview({ version, assets, mainUrl, sourceSize = { width: 1280, height: 720 } }: {
  version: AutoEditVersion; assets: PreviewAsset[]; mainUrl: string; sourceSize?: { width: number; height: number };
}) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const s = version.snapshot;
  const lanes = useMemo(() => s.videoClips ? splitUnifiedTimeline(s.videoClips) : { baseCuts: s.baseCuts, placements: s.placements }, [s]);
  const duration = Math.max(.04, s.duration ?? Math.max(0, ...version.evidence.map(c => c.start + c.duration)));
  const dims = outputDimensions(sourceSize.width, sourceSize.height, 1920, s.aspect, s.customSize);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const next = Math.min(duration, time + (performance.now() - start) / 1000);
      setTime(next);
      if (next >= duration) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // The clock starts at the selected frame; scrubbing pauses it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);
  return <section className="auto-draft-preview" aria-label="Draft cut preview">
    <strong>Preview the cut</strong>
    <div className="draft-preview-frame" style={{ aspectRatio: `${dims.width} / ${dims.height}` }}>
      <CanvasPreview auditionEnabled={false} mediaRef={mediaRef} mainUrl={mainUrl}
        assets={assets} placements={lanes.placements} baseCuts={s.montageEnabled ? lanes.baseCuts : []}
        tracks={s.clipTracks} compositions={s.compositions} titles={s.titles}
        transition={TRANSITION_PRESETS[s.transitionType]} currentTime={previewFrameTime(time, duration, s.exportFrameRate)}
        width={dims.width} height={dims.height} quality="half" />
    </div>
    <div className="draft-preview-transport"><button onClick={() => { if (!playing && time >= duration) setTime(0); setPlaying(v => !v); }}>{playing ? "Pause draft" : "Play draft"}</button>
      <input aria-label="Scrub draft" type="range" min={0} max={duration} step={1 / (s.exportFrameRate ?? 30)} value={time} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }} /><output>{formatTime(time)} / {formatTime(duration)}</output>
    </div>
    <small>Silent cut review · clip effects, titles and transitions. Apply to review the full audio mix and global look in the main viewer; Undo restores your previous edit.</small>
  </section>;
}
