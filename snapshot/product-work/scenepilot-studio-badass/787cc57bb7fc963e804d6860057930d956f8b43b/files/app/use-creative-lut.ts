import { useMemo, useRef, useState } from "react";
import { lutToTiledTexture, parseCubeLut, type CubeLut } from "../lib/lut";

/**
 * Imported creative .cube LUT (from ScenePilot Grade, Resolve, Premiere, …) and
 * its blend intensity, shared by Browser Lite's Auto Director look section and
 * Desktop Pro's Color workspace. Session-only (not persisted — the tables are
 * large binary). `texture` is the tiled table the grade pass uploads to the GPU
 * only when its id changes.
 */
export function useCreativeLut(onLoaded: () => void, setStatus: (message: string) => void) {
  const [source, setSource] = useState<{ lut: CubeLut; name: string } | null>(null);
  const [mix, setMix] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const texture = useMemo(() => {
    if (!source) return undefined;
    const tiled = lutToTiledTexture(source.lut);
    return { ...tiled, mix, id: `${source.name}:${tiled.size}:${tiled.dimensions}` };
  }, [source, mix]);

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const lut = parseCubeLut(await file.text());
      setSource({ lut, name: file.name.replace(/\.cube$/i, "") });
      onLoaded();
      setStatus(`LUT loaded: ${lut.title || file.name} · ${lut.dimensions}D · size ${lut.size}.`);
    } catch (error) {
      setStatus(error instanceof Error ? `LUT import failed: ${error.message}` : "That LUT couldn't be read.");
    }
  };

  const remove = () => { setSource(null); setStatus("Creative LUT removed."); };
  const open = () => inputRef.current?.click();
  const summary = source ? { name: source.name, detail: `${source.lut.dimensions}D · ${source.lut.size}`, mix } : null;

  return { source, mix, setMix, inputRef, texture, importFile, remove, open, summary };
}
