import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import type { Shot } from "../../../lib/autocut-cut";
import { SECTION_LABELS, type MusicAnalysis, type SectionLabel } from "../../../lib/autocut-music";

export const SECTION_COLORS: Record<SectionLabel, string> = {
  intro: "#5ca7ff",
  verse: "#4ee3b0",
  build: "#f4c96b",
  chorus: "#ff8a5c",
  drop: "#ff6f91",
  break: "#b79cff",
  outro: "#5ca7ff",
};

const RULER = 16;
const SECTIONS = 22;
const ENERGY = 46;
const SHOTS = 56;
const HEIGHT = RULER + SECTIONS + ENERGY + SHOTS + 6;

type Props = {
  music: MusicAnalysis;
  shots: Shot[];
  range: { start: number; end: number };
  time: number;
  selected: number;
  zoom: number;
  clipColor: (clipId: string) => string;
  thumbnail: (clipId: string) => HTMLImageElement | undefined;
  onSeek: (time: number) => void;
  onSelect: (index: number) => void;
};

/**
 * The AutoCut timeline: section guesses, the energy curve over the beat grid
 * (bar downbeats taller), and the shot strip with thumbnails, hero and lock
 * marks. Drawn to one canvas; the playhead is a separate element so playback
 * doesn't redraw thousands of pixels per frame.
 */
export function Timeline({ music, shots, range, time, selected, zoom, clipColor, thumbnail, onSeek, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const width = Math.max(320, Math.round(music.duration * zoom));
  const x = useMemo(() => (seconds: number) => seconds * zoom, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.min(32000, Math.round(width * ratio));
    canvas.height = Math.round(HEIGHT * ratio);
    const context = canvas.getContext("2d")!;
    context.setTransform(canvas.width / width, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, HEIGHT);
    context.font = "10px SFMono-Regular, Consolas, monospace";
    context.textBaseline = "middle";

    // Ruler: a label every N seconds.
    const step = zoom > 60 ? 1 : zoom > 24 ? 5 : zoom > 8 ? 10 : 30;
    context.fillStyle = "#8994a8";
    for (let second = 0; second <= music.duration; second += step) {
      context.fillRect(x(second), 0, 1, 5);
      context.fillText(`${Math.floor(second / 60)}:${String(Math.floor(second % 60)).padStart(2, "0")}`, x(second) + 3, 9);
    }

    // Sections.
    for (const section of music.sections) {
      const left = x(section.start), w = x(section.end) - left;
      context.fillStyle = `${SECTION_COLORS[section.label]}33`;
      context.fillRect(left, RULER, w - 1, SECTIONS - 2);
      context.fillStyle = SECTION_COLORS[section.label];
      context.fillRect(left, RULER, 2, SECTIONS - 2);
      if (w > 44) context.fillText(SECTION_LABELS[section.label].toUpperCase(), left + 6, RULER + SECTIONS / 2);
    }

    // Beat grid + energy curve.
    const top = RULER + SECTIONS;
    const downbeats = new Set(music.downbeats.map((beat) => Math.round(beat * 1000)));
    for (const beat of music.beats) {
      const isDown = downbeats.has(Math.round(beat * 1000));
      if (!isDown && zoom < 14) continue;
      context.fillStyle = isDown ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.08)";
      context.fillRect(x(beat), isDown ? top : top + ENERGY * 0.55, 1, isDown ? ENERGY : ENERGY * 0.45);
    }
    context.beginPath();
    music.energy.forEach((value, index) => {
      const px = x(index * music.energyStep), py = top + ENERGY - 3 - value * (ENERGY - 8);
      if (index) context.lineTo(px, py); else context.moveTo(px, py);
    });
    context.strokeStyle = "#8a7cff";
    context.lineWidth = 1.5;
    context.stroke();
    if (music.dropStrength > 0.15) {
      context.fillStyle = "#ff6f91";
      context.fillRect(x(music.dropTime) - 1, top, 2, ENERGY);
      context.fillText("DROP", x(music.dropTime) + 4, top + 8);
    }

    // Shots.
    const shotTop = top + ENERGY + 4;
    shots.forEach((shot, index) => {
      const left = x(shot.start), w = Math.max(1, x(shot.duration) - 1);
      context.fillStyle = clipColor(shot.clipId);
      context.globalAlpha = 0.85;
      context.fillRect(left, shotTop, w, SHOTS - 4);
      context.globalAlpha = 1;
      const image = thumbnail(shot.clipId);
      if (image?.complete && w > 26) {
        const h = SHOTS - 16;
        const tw = Math.min(w - 4, h * (image.naturalWidth / Math.max(1, image.naturalHeight)));
        context.drawImage(image, left + 2, shotTop + 2, tw, h);
      }
      if (shot.hero) { context.fillStyle = "#f4c96b"; context.fillRect(left, shotTop + SHOTS - 8, Math.min(w, 10), 3); }
      if (shot.locked) {
        context.fillStyle = "#ffffff";
        context.fillRect(left, shotTop, w, 3);
        if (w > 40) context.fillText("LOCK", left + 3, shotTop + SHOTS - 12);
      }
      if (shot.synced && w > 18) { context.fillStyle = "#0d1119"; context.fillText("♪", left + w - 10, shotTop + SHOTS - 12); }
      if (index === selected) {
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.strokeRect(left + 1, shotTop + 1, w - 2, SHOTS - 6);
      }
    });

    // Outside the cut range: dim.
    context.fillStyle = "rgba(8,10,16,.7)";
    if (range.start > 0) context.fillRect(0, RULER, x(range.start), HEIGHT - RULER);
    if (range.end < music.duration) context.fillRect(x(range.end), RULER, width - x(range.end), HEIGHT - RULER);
  }, [music, shots, range, selected, zoom, width, x, clipColor, thumbnail]);

  // Keep the playhead in view while playing.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const px = x(time);
    if (px < scroller.scrollLeft + 20 || px > scroller.scrollLeft + scroller.clientWidth - 40) scroller.scrollLeft = Math.max(0, px - scroller.clientWidth * 0.25);
  }, [time, x]);

  const pick = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const seconds = ((event.clientX - rect.left) / rect.width) * music.duration;
    const y = event.clientY - rect.top;
    if (y >= RULER + SECTIONS + ENERGY) {
      const index = shots.findIndex((shot) => seconds >= shot.start && seconds < shot.start + shot.duration);
      if (index >= 0) onSelect(index);
    }
    onSeek(seconds);
  };

  return (
    <div className="ac-timeline" ref={scrollRef}>
      <div style={{ position: "relative", width, height: HEIGHT }}>
        <canvas
          ref={canvasRef}
          style={{ width, height: HEIGHT, display: "block", cursor: "pointer" }}
          onPointerDown={pick}
          role="img"
          aria-label={`Timeline: ${music.sections.length} sections, ${shots.length} shots. Click to seek or select a shot.`}
        />
        <div className="ac-playhead" style={{ left: x(time) }} aria-hidden="true" />
      </div>
    </div>
  );
}
