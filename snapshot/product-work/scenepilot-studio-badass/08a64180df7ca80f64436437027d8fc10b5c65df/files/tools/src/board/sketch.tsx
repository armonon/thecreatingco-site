import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser, Pencil, Trash2, Undo2 } from "lucide-react";

const ASPECT_SIZES: Record<string, [number, number]> = {
  "16:9": [1280, 720],
  "2.39:1": [1280, 536],
  "9:16": [720, 1280],
  "1:1": [960, 960],
};

/** Aspect ratio of a board aspect key as width / height. */
export const aspectRatio = (aspect: string) => {
  const [w, h] = ASPECT_SIZES[aspect] ?? ASPECT_SIZES["16:9"];
  return w / h;
};

/**
 * A small drawing pad in a modal: pen and eraser, colour, size, undo, clear.
 * Returns the drawing as a JPEG data URL. Pointer events cover mouse, pen and
 * touch; pressure (when the device reports it) modulates the stroke width.
 */
export function SketchDialog({ aspect, initial, onSave, onClose }: { aspect: string; initial?: string; onSave: (dataUrl: string) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const history = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#1b1b1b");
  const [size, setSize] = useState(4);
  const [width, height] = ASPECT_SIZES[aspect] ?? ASPECT_SIZES["16:9"];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (initial) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = initial;
    }
  }, [initial]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  };

  const begin = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (history.current.length > 30) history.current.shift();
    last.current = point(event);
    stroke(event);
  };

  const stroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const next = point(event);
    const pressure = event.pressure > 0 && event.pointerType === "pen" ? 0.4 + event.pressure : 1;
    ctx.strokeStyle = tool === "eraser" ? "#f4f1e8" : color;
    ctx.lineWidth = (tool === "eraser" ? size * 4 : size) * pressure;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(next.x + 0.01, next.y + 0.01);
    ctx.stroke();
    last.current = next;
  };

  const end = () => { last.current = null; };

  const undo = () => {
    const ctx = canvasRef.current?.getContext("2d");
    const previous = history.current.pop();
    if (ctx && previous) ctx.putImageData(previous, 0, 0);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (canvas) onSave(canvas.toDataURL("image/jpeg", 0.85));
    dialogRef.current?.close();
  };

  return (
    <dialog ref={dialogRef} className="sketch-dialog" aria-label="Sketch a frame" onClose={onClose}>
      <div className="sketch-toolbar">
        <div className="segmented" role="group" aria-label="Drawing tool">
          <button type="button" aria-pressed={tool === "pen"} onClick={() => setTool("pen")}><Pencil size={12} /> Pen</button>
          <button type="button" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}><Eraser size={12} /> Eraser</button>
        </div>
        <label className="btn-row" style={{ gap: 6, fontSize: 12 }}>Colour <input type="color" value={color} onChange={(event) => { setColor(event.target.value); setTool("pen"); }} /></label>
        <label className="btn-row" style={{ gap: 6, fontSize: 12 }}>Size <input type="range" min={1} max={24} value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
        <button type="button" className="btn small" onClick={undo}><Undo2 size={13} /> Undo</button>
        <button type="button" className="btn small danger" onClick={clear}><Trash2 size={13} /> Clear</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn small" onClick={() => dialogRef.current?.close()}>Cancel</button>
        <button type="button" className="btn small primary" onClick={save}>Use as frame</button>
      </div>
      <canvas ref={canvasRef} className="sketch-canvas" width={width} height={height} style={{ maxWidth: `calc(72vh * ${width / height})`, margin: "0 auto" }} onPointerDown={begin} onPointerMove={stroke} onPointerUp={end} onPointerCancel={end} aria-label="Drawing canvas" />
    </dialog>
  );
}

/** Fit an uploaded image into the board aspect (cover crop) as a JPEG data URL. */
export async function imageFileToFrame(file: File, aspect: string): Promise<string> {
  const [width, height] = ASPECT_SIZES[aspect] ?? ASPECT_SIZES["16:9"];
  // <img> decoding is more forgiving than createImageBitmap (which rejects
  // some valid JPEGs in headless/older Chrome) and also handles SVG.
  const url = URL.createObjectURL(file);
  const bitmap = new Image();
  bitmap.src = url;
  try { await bitmap.decode(); } finally { URL.revokeObjectURL(url); }
  const scale = Math.min(1, 960 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  const cover = Math.max(canvas.width / bitmap.naturalWidth, canvas.height / bitmap.naturalHeight);
  const drawWidth = bitmap.naturalWidth * cover;
  const drawHeight = bitmap.naturalHeight * cover;
  ctx.drawImage(bitmap, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", 0.85);
}
