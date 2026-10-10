/** Source-time musical annotations. JSON-only so maps survive project/undo/worker boundaries. */
export type SongBeatMap = {
  version: 1;
  bpm: number;
  confidence: number;
  beats: number[];
  downbeats: number[];
  beatsPerBar: number;
  edited?: boolean;
};

/** Continuous beat coordinate, including local-tempo extrapolation at either end. */
export function beatPosition(beats: readonly number[], time: number): number {
  if (beats.length < 2) return 0;
  let lo = 0, hi = beats.length - 1;
  while (lo + 1 < hi) { const m = (lo + hi) >>> 1; if (beats[m] <= time) lo = m; else hi = m; }
  return lo + (time - beats[lo]) / Math.max(1e-6, beats[lo + 1] - beats[lo]);
}

export function beatTime(beats: readonly number[], position: number): number {
  if (beats.length < 2) return beats[0] ?? 0;
  const index = Math.max(0, Math.min(beats.length - 2, Math.floor(position)));
  return beats[index] + (position - index) * (beats[index + 1] - beats[index]);
}

export function validateBeatMap(map: SongBeatMap) {
  if (!Number.isFinite(map.bpm) || map.bpm < 20 || map.bpm > 400) throw new Error("Tempo must be between 20 and 400 BPM.");
  if (!Number.isFinite(map.confidence) || map.confidence < 0 || map.confidence > 1) throw new Error("Invalid beat confidence.");
  if (!Number.isInteger(map.beatsPerBar) || map.beatsPerBar < 2 || map.beatsPerBar > 12) throw new Error("Choose 2–12 beats per bar.");
  if (map.beats.length < 2 || map.beats.some((t, i) => !Number.isFinite(t) || (i > 0 && t <= map.beats[i - 1]))) throw new Error("At least two strictly increasing beat times are required.");
  if (!map.downbeats.length || map.downbeats.some((t, i) => !map.beats.includes(t) || (i > 0 && t <= map.downbeats[i - 1]))) throw new Error("Downbeats must be ordered beat timestamps.");
  return map;
}

/** Rescale measured timing rather than discarding swing/drift. Offset is incremental. */
export function adjustMeasuredBeats(beats: number[], oldBpm: number, newBpm: number, offset: number) {
  if (beats.length < 2 || !(oldBpm > 0) || !(newBpm > 0)) return beats;
  const anchor = beats[0];
  return beats.map(time => anchor + (time - anchor) * oldBpm / newBpm + offset);
}

export function editSongTempo(map: SongBeatMap, bpm: number, offset = 0): SongBeatMap {
  const beats = adjustMeasuredBeats(map.beats, map.bpm, bpm, offset);
  return validateBeatMap({ ...map, bpm, beats, downbeats: map.downbeats.map(t => beats[map.beats.indexOf(t)]), edited: true });
}

export function editSongBeat(map: SongBeatMap, index: number, time: number, downbeat: boolean): SongBeatMap {
  const previous = map.beats[index];
  if (previous === undefined) throw new Error("Select a beat first.");
  const beats = map.beats.map((t, i) => i === index ? time : t);
  const downbeats = map.downbeats.filter(t => t !== previous);
  if (downbeat) downbeats.push(time);
  return validateBeatMap({ ...map, beats, downbeats: downbeats.sort((a, b) => a - b), edited: true });
}

export type AudioWarpPoint = { time: number; sourceTime: number };
/** Error-bounded polyline reduction keeps retimed automation editable rather
 * than adding tens of thousands of redundant timeline handles. */
export function simplifyGainCurve<T extends { time: number; gain: number }>(points: T[], tolerance = .0001): T[] {
  if (points.length < 3) return points;
  const keep = new Set([0, points.length - 1]);
  const pending = [[0, points.length - 1]];
  while (pending.length) {
    const [first, last] = pending.pop()!;
    const a = points[first], b = points[last];
    let maximum = tolerance, index = -1;
    for (let i = first + 1; i < last; i++) {
      const estimate = a.gain + (b.gain - a.gain) * (points[i].time - a.time) / (b.time - a.time);
      const error = Math.abs(points[i].gain - estimate);
      if (error > maximum) { maximum = error; index = i; }
    }
    if (index >= 0) { keep.add(index); pending.push([first, index], [index, last]); }
  }
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}
export function warpedSourceTime(points: readonly AudioWarpPoint[], time: number) {
  let lo = 0, hi = points.length - 1;
  while (lo + 1 < hi) { const middle = (lo + hi) >>> 1; if (points[middle].time <= time) lo = middle; else hi = middle; }
  const a = points[lo], b = points[lo + 1];
  return a.sourceTime + (time - a.time) * (b.sourceTime - a.sourceTime) / (b.time - a.time);
}

/** Sync an incoming clip's first available downbeat to a master downbeat. A bar
 * transition ends at the selected master downbeat; zero bars starts there. */
export function planSongSync(master: { start: number; sourceStart: number; duration: number; playbackRate?: number; beatMap: SongBeatMap }, incoming: { sourceStart: number; duration: number; playbackRate?: number; beatMap: SongBeatMap }, at: number, bars: 0 | 4 | 8 | 16) {
  const m = validateBeatMap(master.beatMap), s = validateBeatMap(incoming.beatMap);
  if (m.beatsPerBar !== s.beatsPerBar) throw new Error("Songs have different meters. Correct their beat maps before syncing.");
  const rate = master.playbackRate ?? 1;
  const available = m.downbeats.map(t => master.start + (t - master.sourceStart) / rate).filter(t => t >= master.start - 1e-6 && t <= master.start + master.duration + 1e-6);
  if (!available.length) throw new Error("The master clip has no available downbeat.");
  const target = available.reduce((best, t) => Math.abs(t - at) < Math.abs(best - at) ? t : best);
  const masterIndex = beatPosition(m.beats, master.sourceStart + (target - master.start) * rate);
  const startIndex = masterIndex - bars * m.beatsPerBar;
  const start = master.start + (beatTime(m.beats, startIndex) - master.sourceStart) / rate;
  if (start < master.start - 1e-6) throw new Error("Not enough master-song bars before that downbeat. Move the playhead later or use fewer bars.");
  const sourceEnd = incoming.sourceStart + incoming.duration * (incoming.playbackRate ?? 1);
  const sourceAnchor = s.downbeats.find(t => t >= incoming.sourceStart - 1e-6 && t < sourceEnd);
  if (sourceAnchor === undefined) throw new Error("The incoming clip has no available downbeat.");
  const sourceIndex = s.beats.indexOf(sourceAnchor);
  const count = beatPosition(s.beats, sourceEnd) - sourceIndex;
  const duration = (beatTime(m.beats, startIndex + count) - beatTime(m.beats, startIndex)) / rate;
  const warp: AudioWarpPoint[] = [];
  for (let n = 0; n < count; n++) warp.push({ time: (beatTime(m.beats, startIndex + n) - beatTime(m.beats, startIndex)) / rate, sourceTime: beatTime(s.beats, sourceIndex + n) });
  warp.push({ time: duration, sourceTime: sourceEnd });
  if (warp.length < 2 || duration <= 0) throw new Error("The incoming song is too short to sync.");
  for (let i = 1; i < warp.length; i++) {
    const ratio = (warp[i].sourceTime - warp[i - 1].sourceTime) / (warp[i].time - warp[i - 1].time);
    if (ratio < .5 || ratio > 2) throw new Error("Sync needs more than ½×–2× stretch. Check half/double tempo and beat markers first.");
  }
  const transitionDuration = target - start;
  if (transitionDuration > duration) throw new Error("The incoming song is shorter than the requested transition.");
  return { start, duration, transitionDuration, transitionEnd: target, warp };
}
