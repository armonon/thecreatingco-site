import { activeLine, layoutCaption, wordVisual, type CaptionLine, type CaptionPreset } from "../../../lib/caption-words";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Draw the caption that is live at `time` onto a frame. The same function
 * drives the preview and the burn-in export, so what you see is what renders.
 */
export function drawCaptions(ctx: CanvasRenderingContext2D, width: number, height: number, lines: CaptionLine[], time: number, preset: CaptionPreset) {
  const line = activeLine(lines, time);
  if (!line || !line.words.length) return;
  const fontSize = Math.round(preset.size * Math.min(width, height) * (height > width ? 1.25 : 1));
  ctx.save();
  ctx.font = `${preset.weight} ${fontSize}px ${preset.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const texts = line.words.map((word) => (preset.uppercase ? word.text.toUpperCase() : word.text));
  const layout = layoutCaption(texts, (text) => ctx.measureText(text).width, {
    maxWidth: width * 0.84,
    centerX: width / 2,
    centerY: height * preset.y,
    lineHeight: fontSize * 1.28,
    spaceWidth: ctx.measureText(" ").width * 1.1,
  });

  // Whole-line fade in/out so captions don't pop on and off.
  const fadeIn = Math.min(1, Math.max(0, (time - line.start) / 0.1));
  const fadeOut = Math.min(1, Math.max(0, (line.end + 0.35 - time) / 0.15));
  const lineAlpha = Math.min(fadeIn, fadeOut);

  if (preset.plate && layout.length) {
    const left = Math.min(...layout.map((word) => word.x));
    const right = Math.max(...layout.map((word) => word.x + word.width));
    const top = Math.min(...layout.map((word) => word.y)) - fontSize * 0.75;
    const bottom = Math.max(...layout.map((word) => word.y)) + fontSize * 0.75;
    ctx.globalAlpha = lineAlpha;
    ctx.fillStyle = preset.plate;
    roundRect(ctx, left - fontSize * 0.5, top, right - left + fontSize, bottom - top, fontSize * 0.25);
    ctx.fill();
  }

  for (const word of layout) {
    const visual = wordVisual(line, word.index, time, preset.mode);
    if (visual.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = lineAlpha * visual.alpha;
    ctx.translate(word.x + word.width / 2, word.y);
    ctx.scale(visual.scale, visual.scale);
    if (preset.mode === "box" && visual.highlighted) {
      ctx.fillStyle = preset.highlight;
      roundRect(ctx, -word.width / 2 - fontSize * 0.18, -fontSize * 0.62, word.width + fontSize * 0.36, fontSize * 1.24, fontSize * 0.18);
      ctx.fill();
    }
    const color = visual.highlighted ? (preset.mode === "box" ? preset.highlightText : preset.highlight) : preset.fill;
    if (preset.strokeWidth > 0) {
      if (preset.shadow) { ctx.shadowColor = "#000000aa"; ctx.shadowBlur = fontSize * 0.18; ctx.shadowOffsetY = fontSize * 0.05; }
      ctx.lineWidth = fontSize * preset.strokeWidth;
      ctx.strokeStyle = preset.stroke;
      ctx.strokeText(word.text, 0, 0);
      ctx.shadowColor = "transparent";
    } else if (preset.shadow) {
      ctx.shadowColor = "#000000aa"; ctx.shadowBlur = fontSize * 0.18; ctx.shadowOffsetY = fontSize * 0.05;
    }
    ctx.fillStyle = color;
    ctx.fillText(word.text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/** Backdrop for audio-only sources: a dark gradient with a live level bar. */
export function drawAudioBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, title: string, level: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#101a18");
  gradient.addColorStop(1, "#1d1630");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const short = Math.min(width, height);
  const bars = 32;
  const barWidth = (width * 0.6) / bars;
  for (let i = 0; i < bars; i++) {
    const wobble = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + level * 9));
    const barHeight = short * 0.02 + short * 0.16 * level * wobble;
    ctx.fillStyle = i % 2 ? "#34d6c7aa" : "#b79cffaa";
    ctx.fillRect(width * 0.2 + i * barWidth, height * 0.42 - barHeight / 2, barWidth * 0.6, barHeight);
  }
  ctx.fillStyle = "#cbd1ce";
  ctx.font = `600 ${Math.round(short * 0.03)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title.slice(0, 48), width / 2, height * 0.3);
}
