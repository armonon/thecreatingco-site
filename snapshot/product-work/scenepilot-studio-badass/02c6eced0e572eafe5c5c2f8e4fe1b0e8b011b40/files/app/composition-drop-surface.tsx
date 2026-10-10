import { useEffect, useRef, useState, type DragEvent, type ReactNode, type CSSProperties } from "react";
import type { StudioComposition } from "../lib/compositor";

export function CompositionDropSurface({ composition, selectedTrackId, time, busy, onDropTrack, onDropFiles, onStatus, onImport, children }: {
  composition?: StudioComposition; selectedTrackId: string; time: number; busy: boolean; children: ReactNode;
  onDropTrack(event: DragEvent<HTMLDivElement>, trackId: string, time: number): void; onStatus(message: string): void; onImport(): void;
  onDropFiles(files: File[], time: number, trackId?: string): Promise<void>;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });
  const [zooms, setZooms] = useState<Record<string, number>>({});
  const compositionId = composition?.id ?? "";
  const zoom = zooms[compositionId] ?? 0;
  const setZoom = (value: number) => setZooms(current => ({ ...current, [compositionId]: value }));
  const scrollPositions = useRef(new Map<string, { left: number; top: number }>());
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const position = scrollPositions.current.get(compositionId);
    element.scrollLeft = position?.left ?? 0; element.scrollTop = position?.top ?? 0;
    const positions = scrollPositions.current;
    return () => { positions.set(compositionId, { left: element.scrollLeft, top: element.scrollTop }); };
  }, [compositionId]);
  const [importing, setImporting] = useState(false);
  const pendingImport = useRef(false);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect) setSize({ width: rect.width, height: rect.height }); });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const width = composition?.width ?? 1920, height = composition?.height ?? 1080;
  const scale = zoom || Math.min(Math.max(1, size.width - 24) / width, Math.max(1, size.height - 24) / height);
  return <div className="composition-stage-shell"
    onDragOver={(event) => { if (!busy) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
    onDrop={(event) => {
      event.preventDefault(); event.stopPropagation();
      if (busy || pendingImport.current || !composition) return;
      if (event.dataTransfer.files.length) {
        const files = Array.from(event.dataTransfer.files);
        pendingImport.current = true; setImporting(true);
        void onDropFiles(files, time).finally(() => { pendingImport.current = false; setImporting(false); });
        return;
      }
      const tracks = composition.tracks ?? [];
      const target = tracks.find((track) => track.id === selectedTrackId && track.kind === "video" && !track.locked) ?? tracks.find((track) => track.kind === "video" && !track.locked);
      if (!target) { onStatus("Add an unlocked video track before dropping media into the viewer."); return; }
      onDropTrack(event, target.id, time);
    }}>
    <label className="composition-view-zoom">View<select aria-label="Composition viewer zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))}><option value="0">Fit</option>{[.25, .5, 1, 2].map(value => <option key={value} value={value}>{value * 100}%</option>)}</select><span>{Math.round(scale * 100)}%</span></label>
    {importing && <span className="composition-import-status" role="status">Importing media…</span>}
    {!composition?.layers.length && <div className="composition-empty-guide"><strong>Build your composition</strong><span>Drop files here, or drag media and comps from Project Media.</span><button onClick={onImport}>Import source media</button></div>}
    <div className="composition-view-viewport" ref={viewport}><div className="composition-view-content" style={{ "--comp-view-width": `${width * scale}px`, "--comp-view-height": `${height * scale}px` } as CSSProperties}>{children}</div></div>
  </div>;
}
