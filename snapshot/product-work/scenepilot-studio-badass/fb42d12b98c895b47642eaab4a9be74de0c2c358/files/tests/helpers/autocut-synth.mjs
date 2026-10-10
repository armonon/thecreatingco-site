// Synthetic test signals for the AutoCut tests: a drum-machine "song" with a
// known tempo, bar grid and loudness sections, and seeded noise. Deterministic.

export function noiseSource(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/**
 * sections: [{ bars, level, busy }] — level scales everything, busy adds
 * snares/hats. Kick on every beat 1 (accented, with a bass note) and beat 3;
 * snare on 2 and 4 when busy; eighth-note hats when busy.
 */
export function synthSong({ bpm = 120, sampleRate = 44100, sections, seed = 7, melody = false }) {
  const beat = 60 / bpm;
  const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);
  const length = Math.ceil(totalBars * 4 * beat * sampleRate) + sampleRate;
  const out = new Float32Array(length);
  const noise = noiseSource(seed);
  const add = (time, fn, seconds) => {
    const start = Math.round(time * sampleRate);
    const n = Math.round(seconds * sampleRate);
    for (let i = 0; i < n && start + i < length; i++) out[start + i] += fn(i / sampleRate);
  };
  let bar = 0;
  const truth = { beats: [], downbeats: [], sectionStarts: [] };
  for (const section of sections) {
    truth.sectionStarts.push(bar * 4 * beat);
    for (let b = 0; b < section.bars; b++, bar++) {
      for (let q = 0; q < 4; q++) {
        const time = (bar * 4 + q) * beat;
        truth.beats.push(time);
        if (q === 0) truth.downbeats.push(time);
        const level = section.level;
        if (q === 0 || q === 2) {
          const accent = q === 0 ? 1 : 0.6;
          add(time, (t) => level * accent * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9), 0.35);
        }
        if (q === 0) add(time, (t) => level * 0.35 * Math.sin(2 * Math.PI * 41 * t) * Math.exp(-t * 2), beat * 4 * 0.9);
        if (section.busy && (q === 1 || q === 3)) add(time, () => level * 0.5 * noise(), 0.12);
        if (section.busy) for (const h of [0, 0.5]) add(time + h * beat, (t) => level * 0.18 * noise() * Math.exp(-t * 60), 0.05);
        if (!section.busy && q !== 0 && q !== 2) add(time, (t) => level * 0.15 * noise() * Math.exp(-t * 80), 0.03);
        // A non-repeating "vocal" line (random notes and lengths) so the song
        // isn't a perfect loop, like real music.
        if (melody && noise() > -0.4) {
          const pitch = 220 * 2 ** (Math.floor((noise() + 1) * 6) / 12);
          const length = beat * (0.3 + (noise() + 1) * 0.6);
          const onset = time + (noise() > 0.3 ? beat / 2 : 0);
          add(onset, (t) => level * 0.22 * Math.sin(2 * Math.PI * pitch * t) * Math.min(1, t * 40) * Math.exp(-t * 1.5), length);
        }
      }
    }
  }
  return { samples: out, sampleRate, truth, duration: length / sampleRate };
}

/** Hand-built music map at 120 BPM for the cut-logic tests. */
export function fakeMusic({ duration = 64, bpm = 120, sections } = {}) {
  const beat = 60 / bpm;
  const beats = [];
  for (let t = 0; t < duration - 1e-6; t += beat) beats.push(Math.round(t * 1000) / 1000);
  const downbeats = beats.filter((_, i) => i % 4 === 0);
  const spans = sections ?? [
    { start: 0, end: 16, energy: 0.15, label: "intro" },
    { start: 16, end: 32, energy: 0.45, label: "verse" },
    { start: 32, end: 48, energy: 0.95, label: "chorus" },
    { start: 48, end: 64, energy: 0.2, label: "outro" },
  ];
  const energyStep = 0.25;
  const energy = [];
  for (let t = 0; t < duration; t += energyStep) energy.push(spans.find((s) => t >= s.start && t < s.end)?.energy ?? 0.2);
  return {
    duration, bpm, tempoConfidence: 1, beats, downbeats, beatsPerBar: 4, meterConfidence: 1,
    energy, energyStep, dropTime: 32, dropStrength: 0.8, reliable: true,
    sections: spans.map((s, index) => ({ id: `section-${index}`, index, ...s })),
  };
}

export function fakeClip(id, { duration = 12, energy = 0.5, hero = 0.5, quality = 0.8, offset, segments } = {}) {
  return {
    id, duration, energy, hero, offset,
    segments: segments ?? [{ start: 0, end: duration, quality, motion: energy * 0.1, brightness: 0.45, faces: false }],
  };
}
