/** One hardware-clock anchor for transport and scheduled song sources. */
let context: AudioContext | null = null;
type Clock = { position: number; contextTime: number; playing: boolean; rate: number; revision: number };
let clock: Clock = { position: 0, contextTime: 0, playing: false, rate: 1, revision: 0 };
const listeners = new Set<() => void>();

export function sharedAudioContext() {
  if (typeof AudioContext === "undefined") return null;
  context ??= new AudioContext({ sampleRate: 48000 });
  return context;
}
export function audioClockPosition() {
  // Timeline seconds never go below zero, even while reverse-shuttling past the head.
  return Math.max(0, clock.position + (clock.playing && context ? Math.max(0, context.currentTime - clock.contextTime) * clock.rate : 0));
}
export function audioClockSnapshot() { return clock; }
export function subscribeAudioClock(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function anchorAudioClock(position: number, playing: boolean, rate = 1, leadSeconds = 0) {
  const audio = sharedAudioContext();
  clock = { position, playing, rate, contextTime: (audio?.currentTime ?? 0) + (playing ? leadSeconds : 0), revision: clock.revision + 1 };
  for (const listener of listeners) listener();
}
export async function resumeAudioClock(): Promise<{ failed: string[] }> {
  const audio = sharedAudioContext();
  if (audio?.state === "suspended") await audio.resume();
  // Resume in the user gesture, then wait for the active/look-ahead sources
  // before moving transport; the first kick must not be skipped on decode.
  // One offline/corrupt source must not block the rest, so settle every source
  // and report the ones that failed instead of rejecting the whole transport.
  const active = [...buffers.entries()].filter(([, entry]) => entry.users > 0);
  const results = await Promise.allSettled(active.map(([, entry]) => entry.promise));
  return { failed: active.filter((_, index) => results[index].status === "rejected").map(([url]) => url) };
}

/** Small LRU of decoded song sources. Never grows with project length. */
const buffers = new Map<string, { promise: Promise<AudioBuffer>; bytes: number; users: number }>();
const BUDGET = 384 * 1024 * 1024;
export function acquireSongBuffer(url: string, duration?: number) {
  const audio = sharedAudioContext();
  if (!audio) throw new Error("This browser does not support scheduled audio.");
  let entry = buffers.get(url);
  if (!entry) {
    // Admission estimate assumes stereo float32 (channel count is unknown until
    // decode). The exact size is re-checked against the budget after decoding.
    const expected = Math.ceil((duration ?? 300) * audio.sampleRate * 2 * 4);
    if (expected > BUDGET / 2) throw new Error("This song exceeds the shared-clock preview buffer limit. Split it into shorter source files for preview; streaming export remains available.");
    for (const [key, item] of buffers) if (!item.users) buffers.delete(key);
    if ([...buffers.values()].reduce((n, b) => n + b.bytes, expected) > BUDGET) throw new Error("Audio preview memory budget reached. Reduce simultaneous long song sources.");
    entry = { users: 0, bytes: expected, promise: fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Audio source could not be loaded (${response.status}).`);
      const data = await response.arrayBuffer();
      if (data.byteLength > BUDGET / 2) throw new Error("Audio source is too large for safe preview decoding.");
      const decoded = await audio.decodeAudioData(data);
      const bytes = decoded.length * decoded.numberOfChannels * 4;
      if (bytes > BUDGET / 2) throw new Error("Decoded audio exceeds the preview memory limit.");
      // Multichannel sources can decode larger than the stereo estimate; enforce
      // the shared budget with exact sizes so the estimate can't be exceeded.
      let others = 0;
      for (const [key, other] of buffers) if (key !== url) others += other.bytes;
      if (others + bytes > BUDGET) throw new Error("Audio preview memory budget reached. Reduce simultaneous long song sources.");
      const item = buffers.get(url); if (item) item.bytes = bytes;
      return decoded;
    }) };
    buffers.set(url, entry);
    const added = entry;
    void entry.promise.catch(() => { if (buffers.get(url) === added) buffers.delete(url); });
  }
  entry.users++;
  const acquired = entry;
  return { buffer: entry.promise, release: () => { acquired.users = Math.max(0, acquired.users - 1); } };
}
