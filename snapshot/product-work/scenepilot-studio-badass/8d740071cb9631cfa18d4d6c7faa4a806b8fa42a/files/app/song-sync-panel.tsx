"use client";
import { useEffect, useRef, useState } from "react";
import { editSongBeat, editSongTempo, planSongSync, simplifyGainCurve, validateBeatMap, warpedSourceTime, type SongBeatMap } from "../lib/song-beat-map";
import { createClipGainSampler, type AudioClip, type AudioTrack } from "../lib/pro-editor";
import { audioPlaybackRate } from "../lib/audio-timing";
import { sliceEditorialAudio } from "../lib/source-edit";
import { replaceAudioFade } from "../lib/audio-crossfade";
import { materializePathBackedFile } from "./media-file-utils";
import { renderAudioInWorker } from "./render-client";
import { desktopMediaBridge } from "./desktop-media";
import type { MediaAsset } from "./media-browser";

type Props = {
  clips: AudioClip[]; tracks: AudioTrack[]; assets: MediaAsset[]; selected: AudioClip | null; time: number;
  onMap(assetId: string, map: SongBeatMap): void;
  onSelect(clipId: string): void;
  onSync(before: AudioClip[], after: AudioClip[], asset: MediaAsset): void;
};

export function SongSyncPanel(props: Props) {
  const [masterId, setMasterId] = useState("");
  const [bars, setBars] = useState<0 | 4 | 8 | 16>(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const task = useRef<AbortController | null>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  const current = props.selected;
  const asset = props.assets.find(a => a.id === current?.assetId);
  const map = current?.beatMap;
  const index = Math.min(beatIndex, Math.max(0, (map?.beats.length ?? 1) - 1));
  const master = props.clips.find(c => c.id === masterId);
  useEffect(() => () => task.current?.abort(), []);
  const update = (fn: () => SongBeatMap) => {
    try { if (current) { props.onMap(current.assetId, fn()); setMessage("Beat map saved. Existing edits are unchanged."); } }
    catch (error) { setMessage(String(error instanceof Error ? error.message : error)); }
  };
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    const controller = new AbortController(); task.current = controller; setBusy(true);
    try { await action(controller.signal); }
    catch (error) { setMessage(controller.signal.aborted ? "Canceled. No timeline changes applied." : error instanceof Error ? error.message : String(error)); }
    finally { if (task.current === controller) { task.current = null; setBusy(false); } }
  };
  const analyze = () => run(async signal => {
    if (!asset || !current) return;
    const file = await materializePathBackedFile(asset.file, asset.url, signal);
    signal.throwIfAborted();
    const result = await new Promise<SongBeatMap>((resolve, reject) => {
      const worker = new Worker(new URL("./song-analysis.worker.ts", import.meta.url), { type: "module" });
      const finish = () => { worker.terminate(); signal.removeEventListener("abort", abort); };
      const abort = () => { finish(); reject(new DOMException("Canceled", "AbortError")); };
      signal.addEventListener("abort", abort, { once: true });
      worker.onmessage = event => {
        if (event.data.type === "progress") setMessage(event.data.message);
        else if (event.data.type === "done") { finish(); resolve(event.data.map); }
        else { finish(); reject(new Error(event.data.message)); }
      };
      worker.onerror = event => { finish(); reject(new Error(event.message)); };
      worker.postMessage({ file, duration: asset.duration ?? current.sourceStart + current.duration * audioPlaybackRate(current) });
    });
    signal.throwIfAborted();
    if (!latest.current.assets.some(a => a.id === asset.id && a.file === asset.file)) throw new Error("Source media changed during analysis. Analyze the new source again.");
    latest.current.onMap(current.assetId, validateBeatMap(result));
    setMessage(result.confidence < .08 ? "Low confidence: check and edit the beats before syncing." : "Song analyzed. Check the downbeat before matching.");
  });
  const sync = () => run(async signal => {
    if (!current?.beatMap || !master?.beatMap || !asset) throw new Error("Analyze both songs first.");
    if (current.id === master.id || current.linkedVideoId || master.linkedVideoId) throw new Error("Choose two independent audio clips; detach linked picture before retiming.");
    if (props.tracks.some(t => t.locked && (t.id === current.trackId || t.id === master.trackId))) throw new Error("Unlock both song tracks before syncing.");
    if ([current.beatMap, master.beatMap].some(m => m.confidence < .08 && !m.edited)) throw new Error("Review and correct low-confidence beat maps first.");
    const plan = planSongSync({ ...master, beatMap: master.beatMap }, { ...current, beatMap: current.beatMap }, props.time, bars);
    if (plan.duration > 480) throw new Error("Prepare song sync in sections of 8 minutes or less to keep its derived asset within the preview memory budget.");
    const file = await materializePathBackedFile(asset.file, asset.url, signal);
    signal.throwIfAborted();
    // Retain source envelopes as editable output-time automation (100 Hz),
    // not baked gain that could clip before the final track/master mix.
    const gainAt = createClipGainSampler({ ...current, muted: false });
    const automation = simplifyGainCurve(Array.from({ length: Math.ceil(plan.duration * 100) + 1 }, (_, i) => {
      const time = Math.min(plan.duration, i / 100);
      const local = (warpedSourceTime(plan.warp, time) - current.sourceStart) / audioPlaybackRate(current);
      return { time, gain: gainAt(current.start + local) };
    }));
    const handle = renderAudioInWorker({ duration: plan.duration, clips: [{ id: current.id, file, start: 0, sourceStart: plan.warp[0].sourceTime, duration: plan.duration, gain: 1, pan: 0, fadeIn: 0, fadeOut: 0, preservePitch: true, rawSource: true, warp: plan.warp }] }, (progress, text) => setMessage(`${text} · ${Math.round(progress * 100)}%`));
    const abort = () => handle.cancel(); signal.addEventListener("abort", abort, { once: true });
    let blob: Blob | null;
    try { blob = await handle.result; } finally { signal.removeEventListener("abort", abort); }
    signal.throwIfAborted(); if (!blob) throw new Error("Song preparation returned no audio.");
    const id = `synced-${crypto.randomUUID()}`;
    const prepared = new File([blob], `${asset.name.replace(/\.[^.]+$/, "")}-synced.wav`, { type: "audio/wav" });
    const beats = plan.warp.slice(0, -1).map(p => p.time);
    const downbeats = beats.filter((_, i) => i % current.beatMap!.beatsPerBar === 0);
    const replacement: AudioClip = { ...current, assetId: id, name: prepared.name, start: plan.start, sourceStart: 0, duration: plan.duration, playbackRate: 1, gain: 1,
      fadeIn: plan.transitionDuration, fadeOut: 0, fadeShape: "equalPower", envelopes: [], automation: automation.map((p, i) => ({ ...p, id: `sync-gain-${i}` })),
      beatMap: beats.length > 1 ? { ...current.beatMap, bpm: master.beatMap.bpm * audioPlaybackRate(master), beats, downbeats, edited: true } : undefined };
    const after = [replacement];
    if (bars) {
      const trimmed = sliceEditorialAudio(master, 0, plan.transitionEnd - master.start, master.id);
      after.push({ ...replaceAudioFade(trimmed, "out", plan.transitionDuration), fadeShape: "equalPower" });
    }
    const nextAsset: MediaAsset = { ...asset, id, name: prepared.name, file: prepared, url: URL.createObjectURL(prepared), sourcePath: undefined, sourceSize: undefined, sourceLastModified: undefined, proxyFile: undefined, proxyUrl: undefined, waveform: undefined, duration: plan.duration, kind: "audio", proxyState: "original", proxyProgress: 0 };
    nextAsset.beatMap = replacement.beatMap;
    const bridge = desktopMediaBridge();
    if (bridge && !bridge.writeGeneratedAudio) { URL.revokeObjectURL(nextAsset.url); throw new Error("Restart the updated desktop application to enable durable song-sync media."); }
    if (bridge?.writeGeneratedAudio) {
      try {
        const saved = await bridge.writeGeneratedAudio({ bytes: new Uint8Array(await prepared.arrayBuffer()) });
        URL.revokeObjectURL(nextAsset.url); nextAsset.url = saved.url; nextAsset.sourcePath = saved.outputPath;
      } catch (error) { URL.revokeObjectURL(nextAsset.url); throw error; }
    }
    if (signal.aborted) { if (!nextAsset.sourcePath) URL.revokeObjectURL(nextAsset.url); signal.throwIfAborted(); }
    if ([current, master].some(before => latest.current.clips.find(c => c.id === before.id) !== before) || latest.current.tracks.some(t => t.locked && (t.id === current.trackId || t.id === master.trackId))) {
      URL.revokeObjectURL(nextAsset.url);
      throw new Error("Song clips changed during preparation. No edits applied; retry with the current clips.");
    }
    latest.current.onSync([current, master], after, nextAsset);
    setMessage(`Matched beats with pitch preserved${bars ? ` · ${bars}-bar handoff (master trimmed at transition end)` : ""}. Original media retained; Undo restores the edit.`);
  });
  return <section className="song-sync-panel" aria-label="Song beat matching">
    <h3>Song sync</h3>
    <p>Select an audio clip in the timeline. Analyze each song, choose a master, then place the playhead at the desired master downbeat.</p>
    <strong>{current?.name ?? "Select a song clip"}</strong>
    <label>Song to edit<select disabled={busy} value={current?.id ?? ""} onChange={e => props.onSelect(e.target.value)}><option value="">Select a song clip</option>{props.clips.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <button disabled={busy || !asset || asset.offline} onClick={() => void analyze()}>{map ? "Reanalyze song" : "Analyze song beats"}</button>
    {map && <fieldset disabled={busy} key={`${current?.id}-${map.bpm}-${index}-${map.beats[index]}`}>
      <legend>Source beat map · {Math.round(map.confidence * 100)}% confidence{map.edited ? " · edited" : ""}</legend>
      <label>Tempo (BPM)<input type="number" min="20" max="400" step="0.001" defaultValue={map.bpm} onBlur={e => { if (Number(e.target.value) !== map.bpm) update(() => editSongTempo(map, Number(e.target.value))); }} /></label>
      <button onClick={() => update(() => editSongTempo(map, map.bpm, -.005))}>Nudge −5 ms</button><button onClick={() => update(() => editSongTempo(map, map.bpm, .005))}>Nudge +5 ms</button>
      <label>Beats per bar<input type="number" min="2" max="12" defaultValue={map.beatsPerBar} onBlur={e => update(() => validateBeatMap({ ...map, beatsPerBar: Number(e.target.value), edited: true }))} /></label>
      <label>Beat number<input type="number" min="1" max={map.beats.length} value={index + 1} onChange={e => setBeatIndex(Math.max(0, Number(e.target.value) - 1))} /></label>
      <label>Source time (seconds)<input type="number" step="0.001" defaultValue={map.beats[index]} onBlur={e => { if (Number(e.target.value) !== map.beats[index]) update(() => editSongBeat(map, index, Number(e.target.value), map.downbeats.includes(map.beats[index]))); }} /></label>
      <label><input type="checkbox" checked={map.downbeats.includes(map.beats[index])} onChange={e => update(() => editSongBeat(map, index, map.beats[index], e.target.checked))} />Downbeat</label>
      <button onClick={() => update(() => ({ ...map, downbeats: map.beats.filter((_, i) => (i - index) % map.beatsPerBar === 0), edited: true }))}>Set bar one at this beat</button>
    </fieldset>}
    <label>Sync to this song<select value={masterId} disabled={busy} onChange={e => setMasterId(e.target.value)}><option value="">Choose master song</option>{props.clips.filter(c => c.id !== current?.id).map(c => <option key={c.id} value={c.id}>{c.name}{c.beatMap ? ` · ${c.beatMap.bpm} BPM` : " · analyze first"}</option>)}</select></label>
    <label>Transition<select disabled={busy} value={bars} onChange={e => setBars(Number(e.target.value) as typeof bars)}><option value="0">Align only · keep master intact</option>{[4, 8, 16].map(n => <option key={n} value={n}>{n} bars · trim master at handoff</option>)}</select></label>
    <button disabled={busy || !map || !master?.beatMap || current?.id === master.id} onClick={() => void sync()}>Match beats · preserve pitch</button>
    {busy && <button onClick={() => task.current?.abort()}>Cancel</button>}
    <p role="status">{message}</p>
  </section>;
}
