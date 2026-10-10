import type { InputHTMLAttributes } from "react";

type Props = {
  timing: "song" | "custom"; bpm: number; songBpm: number; preset: string;
  disabled: boolean; analyzed: boolean; limited: boolean; flashes: number;
  inputHandlers: InputHTMLAttributes<HTMLInputElement>;
  onTiming(value: "song" | "custom"): void; onBpm(value: number): void;
  onPreset(value: string): void;
};

/** Uses the same persisted effect state and preview/export clock as the full light lab. */
export function StrobeTimingControls(p: Props) {
  return <section className="strobe-quick-controls" aria-label="Strobe lighting">
    <div className="strobe-quick-heading"><div><strong>Strobe lights</strong><p>Set the rhythm of the lights without changing your cuts.</p></div>
      <label>Light pattern<select aria-label="Strobe light pattern" disabled={p.disabled} value={p.preset} onChange={e => p.onPreset(e.target.value)}>
        <option value="off">Off</option><option value="rave">Every beat</option><option value="pulse">Every 4 beats · soft pulse</option>
        <option value="machinegun">Double time · bars</option><option value="police">Bar bursts · alternating colors</option><option value="warm">Offbeats · warm sweep</option>
        <option value="drums" disabled={!p.analyzed || p.timing === "custom"}>Detected drum hits</option>
      </select></label></div>
    {p.preset !== "off" && <>
      <div className="strobe-timing-switch" role="group" aria-label="Strobe timing source">
        <button disabled={p.disabled} aria-pressed={p.timing === "song"} onClick={() => p.onTiming("song")}>Sync to song</button>
        <button disabled={p.disabled} aria-pressed={p.timing === "custom"} onClick={() => p.onTiming("custom")}>Custom BPM</button>
      </div>
      {p.timing === "custom" ? <label className="strobe-bpm-control">Strobe tempo
        <div><input aria-label="Strobe BPM" type="range" min="30" max="240" step="0.1" value={p.bpm} disabled={p.disabled} {...p.inputHandlers} onChange={e => p.onBpm(Number(e.target.value))} />
        <output>{Number(p.bpm.toFixed(1))} BPM</output></div>
        <small>Independent light clock. Pattern divisions still apply; your song and edit tempo stay unchanged.</small>
      </label> : <p className="strobe-timing-note">{p.preset === "drums" ? "Follows detected drum transients, not a fixed tempo." : p.analyzed ? `Follows the project beat grid · ${Number(p.songBpm.toFixed(1))} BPM.` : "Uses the current project beat grid. Analyze a song to detect its rhythm, or choose Custom BPM."}</p>}
      <p className="strobe-timing-note">{p.flashes} flashes in this sequence. {p.limited ? "Rate limiter on: rapid patterns may be reduced to 3 flashes/second." : "Rate limiter off."} Flashing imagery can affect sensitive viewers; the limiter is not a safety certification.</p>
    </>}
  </section>;
}
