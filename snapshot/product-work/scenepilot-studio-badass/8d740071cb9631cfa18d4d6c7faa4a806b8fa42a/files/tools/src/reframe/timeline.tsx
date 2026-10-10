import { useCallback, useMemo, useRef, type PointerEvent } from "react";
import type { PathPoint, SubjectTarget } from "../../../lib/reframe-path.ts";
import type { LetterboxSegment } from "./player.ts";

const HEIGHT = 120;
const RULER = 18;
const TRACK = HEIGHT - RULER;

type Props = {
  duration: number;
  path: PathPoint[];
  cutTimes: number[];
  overrides: SubjectTarget[];
  letterboxSegments: LetterboxSegment[];
  time: number;
  zoom: number;
  onSeek: (time: number) => void;
  onOverride: (time: number, x: number, y: number) => void;
  onRemoveOverride: (time: number) => void;
};

/**
 * The Reframe timeline: the smoothed camera path's horizontal position as a
 * line (0 = frame left, 1 = frame right), scene-cut markers, and draggable
 * diamonds for manual keyframe overrides — drag one vertically to move the
 * crop's x position at that moment, double-click to remove it. Letterbox
 * ranges are a separate editable list below (simpler and more precise than
 * drag-to-select for alpha).
 */
export function ReframeTimeline({ duration, path, cutTimes, overrides, letterboxSegments, time, zoom, onSeek, onOverride, onRemoveOverride }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<number | null>(null);
  const width = Math.max(320, Math.round(duration * zoom));
  const xAt = useCallback((seconds: number) => seconds * zoom, [zoom]);
  const yFor = useCallback((value: number) => RULER + (1 - value) * (TRACK - 12) + 6, []);
  const valueFor = useCallback((clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0.5;
    const local = clientY - rect.top - RULER - 6;
    return Math.min(1, Math.max(0, 1 - local / (TRACK - 12)));
  }, []);

  const linePoints = useMemo(() => path.map((point) => `${xAt(point.time)},${yFor(point.x)}`).join(" "), [path, xAt, yFor]);

  const seekFromClick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    onSeek(Math.min(duration, Math.max(0, localX / zoom)));
  };

  const overrideAt = (overrideTime: number) => overrides.find((item) => Math.abs(item.time - overrideTime) < 1e-6);

  return (
    <div className="reframe-timeline">
      <div ref={containerRef} className="reframe-timeline-scroll" onPointerDown={(event) => { if (dragging.current === null) seekFromClick(event); }}>
        <svg width={width} height={HEIGHT} role="img" aria-label="Crop path over time">
          <rect x={0} y={0} width={width} height={HEIGHT} fill="#12181a" />
          {/* ruler ticks every 5s */}
          {Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => i * 5).map((t) => (
            <g key={t}>
              <line x1={xAt(t)} y1={0} x2={xAt(t)} y2={HEIGHT} stroke="#263033" strokeWidth={1} />
              <text x={xAt(t) + 3} y={12} fill="#6f7c82" fontSize={10}>{t}s</text>
            </g>
          ))}
          {/* letterbox ranges, shaded */}
          {letterboxSegments.map((segment, index) => (
            <rect key={`lb-${index}`} x={xAt(segment.start)} y={RULER} width={Math.max(1, xAt(segment.end - segment.start))} height={TRACK} fill="#f4c96b" opacity={0.12} />
          ))}
          {/* scene cuts */}
          {cutTimes.map((cut) => (
            <line key={cut} x1={xAt(cut)} y1={RULER} x2={xAt(cut)} y2={HEIGHT} stroke="#ff6f91" strokeWidth={2} strokeDasharray="3,3" />
          ))}
          {/* smoothed path (x position over time) */}
          <polyline points={linePoints} fill="none" stroke="#5ce3a8" strokeWidth={2} />
          {/* playhead */}
          <line x1={xAt(time)} y1={0} x2={xAt(time)} y2={HEIGHT} stroke="#fff" strokeWidth={1.5} />
          {/* draggable override keyframes (automatic path samples double as draggable handles) */}
          {path.filter((_, index) => index % 3 === 0).map((point) => {
            const manual = overrideAt(point.time);
            return (
              <circle
                key={point.time}
                cx={xAt(point.time)}
                cy={yFor(manual ? manual.x : point.x)}
                r={manual ? 5 : 3.5}
                fill={manual ? "#ff8a5c" : "#5ce3a8"}
                stroke="#0d1211"
                strokeWidth={1}
                style={{ cursor: "ns-resize" }}
                onPointerDown={(event) => { event.stopPropagation(); dragging.current = point.time; (event.target as Element).setPointerCapture(event.pointerId); }}
                onPointerMove={(event) => {
                  if (dragging.current !== point.time) return;
                  const value = valueFor(event.clientY);
                  onOverride(point.time, value, manual?.y ?? point.y);
                }}
                onPointerUp={() => { dragging.current = null; }}
                onDoubleClick={(event) => { event.stopPropagation(); if (manual) onRemoveOverride(point.time); }}
              >
                <title>{manual ? "Manual override — drag to adjust, double-click to remove" : "Automatic — drag to override"}</title>
              </circle>
            );
          })}
        </svg>
      </div>
      <p className="note" style={{ marginTop: 6 }}>
        Green line: the smoothed crop position (top = frame right, bottom = frame left). Pink dashes: detected scene cuts, where the camera resets instead of panning.
        Orange dots are your manual overrides — drag any dot vertically to pin the crop there, double-click to remove it.
      </p>
    </div>
  );
}
