// AutoCut — performance alignment. When every take of a performance was shot
// with the song playing, the take's own audio is a (noisy, roomy) copy of the
// master. Cross-correlating onset envelopes finds where each take sits on the
// song's timeline, so cutting between takes keeps lip sync locked.
//
// Two stages:
// 1. Coarse: FFT cross-correlation of 100 Hz onset-novelty envelopes in three
//    bands over the whole take, then the strongest peaks re-ranked by Pearson r.
//    Envelopes, not raw samples, so different mics, rooms, gain and phase don't
//    matter — only *when* things hit, and in which register.
// 2. Fine: a direct normalised correlation of decimated PCM within ±30 ms of the
//    coarse lag, on the take's loudest few seconds. Only kept if it agrees
//    strongly; otherwise the 10 ms envelope lag stands (well under a frame).
//
// Pure, no DOM. Offsets use one convention everywhere:
//   offset = song time at which the take's t=0 plays  →  takeTime = songTime - offset

export const ENVELOPE_RATE = 100;

/**
 * Onset-novelty envelope: log energy of a pre-emphasised signal in short hops,
 * half-wave-rectified first difference, minus a 1 s moving average. One value
 * per `1 / rate` seconds.
 */
export function onsetEnvelope(mono: ArrayLike<number>, sampleRate: number, rate = ENVELOPE_RATE): Float32Array {
  const emphasised = new Float32Array(mono.length);
  let previous = 0;
  for (let index = 0; index < mono.length; index++) {
    const sample = mono[index] || 0;
    emphasised[index] = sample - 0.97 * previous;
    previous = sample;
  }
  return noveltyOf(emphasised, sampleRate, rate);
}

function noveltyOf(signal: Float32Array, sampleRate: number, rate: number): Float32Array {
  const hop = Math.max(1, Math.round(sampleRate / rate));
  const frames = Math.floor(signal.length / hop);
  const logEnergy = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    const from = frame * hop;
    for (let index = from; index < from + hop; index++) sum += signal[index] * signal[index];
    logEnergy[frame] = Math.log(1e-9 + sum / hop);
  }
  const novelty = new Float32Array(frames);
  for (let frame = 1; frame < frames; frame++) novelty[frame] = Math.max(0, logEnergy[frame] - logEnergy[frame - 1]);
  // Remove the slow trend so loud sections don't dominate the correlation.
  const radius = Math.max(1, Math.round(rate / 2));
  const out = new Float32Array(frames);
  let windowSum = 0;
  let lo = 0, hi = -1;
  for (let frame = 0; frame < frames; frame++) {
    while (hi < Math.min(frames - 1, frame + radius)) windowSum += novelty[++hi];
    while (lo < frame - radius) windowSum -= novelty[lo++];
    out[frame] = Math.max(0, novelty[frame] - windowSum / (hi - lo + 1));
  }
  return out;
}

function lowpass(signal: ArrayLike<number>, sampleRate: number, cutoff: number): Float32Array {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  const out = new Float32Array(signal.length);
  let y = 0;
  for (let index = 0; index < signal.length; index++) { y += a * ((signal[index] || 0) - y); out[index] = y; }
  return out;
}

/**
 * Onset envelopes in three bands — low (<200 Hz: kick, bass), mid (200 Hz–2 kHz:
 * voice, melody) and high (>2 kHz: hats, sibilance) — each scaled to unit
 * variance. Stacking them lets the melody and vocal disambiguate bars that the
 * drums alone make look identical, and a noisy band can't swamp the others.
 */
export function bandEnvelopes(mono: ArrayLike<number>, sampleRate: number, rate = ENVELOPE_RATE): Float32Array[] {
  const low = lowpass(mono, sampleRate, 200);
  const upToMid = lowpass(mono, sampleRate, 2000);
  const mid = new Float32Array(mono.length);
  const high = new Float32Array(mono.length);
  for (let index = 0; index < mono.length; index++) {
    mid[index] = upToMid[index] - low[index];
    high[index] = (mono[index] || 0) - upToMid[index];
  }
  return [low, mid, high].map((band) => {
    const envelope = noveltyOf(band, sampleRate, rate);
    let sum = 0, square = 0;
    for (const value of envelope) { sum += value; square += value * value; }
    const mean = sum / Math.max(1, envelope.length);
    const deviation = Math.sqrt(Math.max(1e-12, square / Math.max(1, envelope.length) - mean * mean));
    return envelope.map((value) => value / deviation);
  });
}

/** In-place iterative radix-2 FFT. `re`/`im` length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size;
    const wRe = Math.cos(angle), wIm = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k, b = a + size / 2;
        const tRe = re[b] * curRe - im[b] * curIm;
        const tIm = re[b] * curIm + im[b] * curRe;
        re[b] = re[a] - tRe; im[b] = im[a] - tIm;
        re[a] += tRe; im[a] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/**
 * Full linear cross-correlation c[k] = Σ a[n + k] · b[n] for every lag
 * k ∈ [-(b.length - 1), a.length - 1]. Returned as `{ values, minLag }` where
 * values[i] is the correlation at lag minLag + i.
 */
export function crossCorrelate(a: ArrayLike<number>, b: ArrayLike<number>): { values: Float64Array; minLag: number } {
  const total = a.length + b.length - 1;
  let size = 1;
  while (size < total) size <<= 1;
  const aRe = new Float64Array(size), aIm = new Float64Array(size);
  const bRe = new Float64Array(size), bIm = new Float64Array(size);
  for (let i = 0; i < a.length; i++) aRe[i] = a[i];
  for (let i = 0; i < b.length; i++) bRe[i] = b[i];
  fft(aRe, aIm);
  fft(bRe, bIm);
  // A · conj(B)
  for (let i = 0; i < size; i++) {
    const re = aRe[i] * bRe[i] + aIm[i] * bIm[i];
    const im = aIm[i] * bRe[i] - aRe[i] * bIm[i];
    aRe[i] = re; aIm[i] = im;
  }
  fft(aRe, aIm, true);
  const minLag = -(b.length - 1);
  const values = new Float64Array(total);
  for (let i = 0; i < total; i++) {
    const lag = minLag + i;
    values[i] = aRe[lag >= 0 ? lag : size + lag];
  }
  return { values, minLag };
}

/** Pearson correlation of a[k + n] and b[n] over their overlap. */
export function overlapCorrelation(a: ArrayLike<number>, b: ArrayLike<number>, lag: number): { r: number; overlap: number } {
  const from = Math.max(0, -lag);
  const to = Math.min(b.length, a.length - lag);
  const count = to - from;
  if (count < 2) return { r: 0, overlap: 0 };
  let sa = 0, sb = 0;
  for (let n = from; n < to; n++) { sa += a[n + lag]; sb += b[n]; }
  const ma = sa / count, mb = sb / count;
  let num = 0, da = 0, db = 0;
  for (let n = from; n < to; n++) {
    const x = a[n + lag] - ma, y = b[n] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const denominator = Math.sqrt(da * db);
  return { r: denominator > 1e-12 ? num / denominator : 0, overlap: count };
}

export type Alignment = {
  /** Song time (s) where the take's t=0 plays. Negative when the take starts before the song. */
  offset: number;
  /** 0..1 — Pearson r of the envelopes at the chosen lag. */
  confidence: number;
  /** How far the winning peak stands above the best rival lag (>0.25 s away), 0..1. */
  margin: number;
  /** Seconds of take/song overlap at the chosen lag. */
  overlap: number;
  /** Share of the take that overlaps the song at that lag, 0..1. */
  coverage: number;
  refined: boolean;
};

export type AlignOptions = {
  rate?: number;
  /** Ignore lags giving less than this much overlap (s). Default: min(4 s, half the take). */
  minOverlap?: number;
};

/** Mean Pearson r across bands at one lag (band b of a vs band b of b). */
export function stackedCorrelation(a: ArrayLike<number>[], b: ArrayLike<number>[], lag: number): { r: number; overlap: number } {
  let r = 0, overlap = 0;
  for (let band = 0; band < a.length; band++) {
    const result = overlapCorrelation(a[band], b[band], lag);
    r += result.r;
    overlap = result.overlap;
  }
  return { r: r / Math.max(1, a.length), overlap };
}

/** Coarse alignment of a take envelope (or stacked band envelopes) against the master's. */
export function alignEnvelopes(masterInput: Float32Array | Float32Array[], takeInput: Float32Array | Float32Array[], options: AlignOptions = {}): Alignment {
  const rate = options.rate ?? ENVELOPE_RATE;
  const masterBands = Array.isArray(masterInput) ? masterInput : [masterInput];
  const takeBands = Array.isArray(takeInput) ? takeInput : [takeInput];
  const master = masterBands[0];
  const take = takeBands[0];
  const none: Alignment = { offset: 0, confidence: 0, margin: 0, overlap: 0, coverage: 0, refined: false };
  if (!master || !take || master.length < rate || take.length < rate || masterBands.length !== takeBands.length) return none;
  const minOverlap = Math.round((options.minOverlap ?? Math.min(4, (take.length / rate) / 2)) * rate);
  const correlations = masterBands.map((band, index) => crossCorrelate(band, takeBands[index]));
  const { minLag } = correlations[0];
  const values = correlations[0].values.map((_, i) => correlations.reduce((sum, item) => sum + item.values[i], 0));
  // Normalise by overlap so short edge overlaps don't win on a lucky spike, but
  // only gently (sqrt), since real alignment also maximises the shared material.
  let bestIndex = -1, bestScore = -Infinity;
  const scores = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const lag = minLag + i;
    const overlap = Math.min(take.length, master.length - lag) - Math.max(0, -lag);
    if (overlap < minOverlap) { scores[i] = -Infinity; continue; }
    scores[i] = values[i] / Math.sqrt(overlap);
    if (scores[i] > bestScore) { bestScore = scores[i]; bestIndex = i; }
  }
  if (bestIndex < 0 || !(bestScore > 0)) return none;
  // Music repeats (bars, choruses), so raw correlation has many near-equal
  // peaks and the loudest overlap can win over the right one. Re-rank the
  // strongest local maxima by gain-invariant Pearson r over their overlap.
  const peaks: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    if (!Number.isFinite(scores[i]) || scores[i] <= 0) continue;
    if ((i > 0 && scores[i - 1] > scores[i]) || (i < scores.length - 1 && scores[i + 1] >= scores[i])) continue;
    peaks.push(i);
  }
  peaks.sort((a, b) => scores[b] - scores[a]);
  // Rank by r, discounted when less than 60% of the take overlaps the song, so
  // a short edge overlap with a lucky r can't beat the real lag.
  const fullOverlap = 0.6 * take.length;
  const evidence = (peak: { r: number; overlap: number }) => peak.r * Math.sqrt(Math.min(1, peak.overlap / fullOverlap));
  const ranked = peaks.slice(0, 32).map((index) => ({ index, ...stackedCorrelation(masterBands, takeBands, minLag + index) }))
    .sort((a, b) => evidence(b) - evidence(a));
  const winner = ranked[0] ?? { index: bestIndex, ...stackedCorrelation(masterBands, takeBands, minLag + bestIndex) };
  const exclusion = Math.round(rate * 0.25);
  const rivalPeak = ranked.find((peak) => Math.abs(peak.index - winner.index) > exclusion);
  const winnerEvidence = evidence(winner);
  const rival = rivalPeak ? evidence(rivalPeak) * (winner.r / Math.max(1e-9, winnerEvidence)) : 0;
  const at = winner.index;
  const left = scores[at - 1], right = scores[at + 1], center = scores[at];
  let fraction = 0;
  if (Number.isFinite(left) && Number.isFinite(right)) {
    const curvature = left - 2 * center + right;
    if (Math.abs(curvature) > 1e-12) fraction = Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / curvature));
  }
  return {
    offset: (minLag + at + fraction) / rate,
    confidence: Math.max(0, Math.min(1, winner.r)),
    margin: winner.r > 0 ? Math.max(0, Math.min(1, (winner.r - Math.max(0, rival)) / winner.r)) : 0,
    overlap: winner.overlap / rate,
    coverage: Math.min(1, winner.overlap / take.length),
    refined: false,
  };
}

function decimate(mono: ArrayLike<number>, factor: number): Float32Array {
  const out = new Float32Array(Math.floor(mono.length / factor));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += mono[i * factor + j] || 0;
    out[i] = sum / factor;
  }
  return out;
}

/**
 * Refine a coarse offset on decimated PCM: search ±`searchMs` around it with a
 * normalised correlation over the take's loudest `windowSec`. Returns the
 * refined alignment when the waveform correlation is convincing (r ≥ 0.5),
 * else the coarse one unchanged.
 */
export function refineAlignment(master: Float32Array, take: Float32Array, sampleRate: number, coarse: Alignment, searchMs = 30, windowSec = 4): Alignment {
  const factor = Math.max(1, Math.round(sampleRate / 8000));
  const rate = sampleRate / factor;
  const m = decimate(master, factor);
  const t = decimate(take, factor);
  const windowLength = Math.min(t.length, Math.round(windowSec * rate));
  if (windowLength < rate * 0.5) return coarse;
  // Loudest window of the take (by block energy), constrained to overlap the master.
  const block = Math.max(1, Math.round(rate * 0.5));
  let bestStart = 0, bestEnergy = -1;
  for (let start = 0; start + windowLength <= t.length; start += block) {
    const songStart = Math.round(coarse.offset * rate) + start;
    if (songStart < 0 || songStart + windowLength > m.length) continue;
    let energy = 0;
    for (let i = start; i < start + windowLength; i += 4) energy += t[i] * t[i];
    if (energy > bestEnergy) { bestEnergy = energy; bestStart = start; }
  }
  if (bestEnergy <= 0) return coarse;
  const search = Math.round((searchMs / 1000) * rate);
  const center = Math.round(coarse.offset * rate);
  let best = { lag: center, r: -Infinity };
  for (let lag = center - search; lag <= center + search; lag++) {
    const songStart = lag + bestStart;
    if (songStart < 0 || songStart + windowLength > m.length) continue;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < windowLength; i++) {
      const x = m[songStart + i], y = t[bestStart + i];
      num += x * y; da += x * x; db += y * y;
    }
    const r = num / Math.sqrt(da * db + 1e-12);
    if (r > best.r) best = { lag, r };
  }
  if (!(best.r >= 0.5)) return coarse;
  return { ...coarse, offset: best.lag / rate, refined: true };
}

/** Coarse + fine alignment of a take's mono PCM to the master song's mono PCM. */
export function alignTake(master: Float32Array, masterRate: number, take: Float32Array, takeRate: number, options: AlignOptions = {}): Alignment {
  const rate = options.rate ?? ENVELOPE_RATE;
  const coarse = alignEnvelopes(bandEnvelopes(master, masterRate, rate), bandEnvelopes(take, takeRate, rate), options);
  if (coarse.confidence <= 0 || masterRate !== takeRate) return coarse;
  return refineAlignment(master, take, masterRate, coarse);
}

/**
 * Whether an alignment is trustworthy enough to cut lip-synced against: the
 * envelopes correlate (r ≥ 0.5), at least half the take overlaps the song, and either the winning lag clearly
 * beats every other candidate or the waveform itself confirmed it.
 */
export function isSynced(alignment: Pick<Alignment, "confidence" | "margin" | "overlap" | "coverage" | "refined">, threshold = 0.5) {
  return alignment.confidence >= threshold && alignment.overlap >= 2 && alignment.coverage >= 0.5
    && (alignment.margin >= 0.08 || alignment.refined);
}

/** True when the take could plausibly sit at another place in the song (repeated sections). */
export function isAmbiguous(alignment: Pick<Alignment, "margin">) {
  return alignment.margin < 0.08;
}

/**
 * Resample mono PCM by linear interpolation, with a box pre-filter when
 * downsampling (good enough for onset envelopes; not for listening).
 */
export function resampleMono(mono: ArrayLike<number>, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return Float32Array.from(mono as ArrayLike<number>);
  const ratio = fromRate / toRate;
  const length = Math.floor(mono.length / ratio);
  const out = new Float32Array(length);
  const box = Math.max(1, Math.floor(ratio));
  for (let index = 0; index < length; index++) {
    const position = index * ratio;
    const base = Math.floor(position);
    const frac = position - base;
    let a = 0, b = 0;
    for (let k = 0; k < box; k++) {
      a += mono[Math.min(mono.length - 1, base + k)] || 0;
      b += mono[Math.min(mono.length - 1, base + 1 + k)] || 0;
    }
    out[index] = (a * (1 - frac) + b * frac) / box;
  }
  return out;
}
