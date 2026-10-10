// Tempo estimation — autocorrelation of the onset novelty with an octave prior.
//
// Extracted from analyzeAudio so it's independently testable (the octave bug is
// the highest-leverage failure in the whole auto pipeline) and shared with the
// downbeat-model trainer, which used to replicate it.

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
}

export type TempoEstimate = { bpm: number; confidence: number; lag: number };

/** Multi-beat spans reduce onset-frame quantization error without flattening
 * the actual beat map. This is a displayed tempo estimate, not a new grid. */
export function tempoFromTrackedBeats(beats: number[], fallback: number) {
  const span = Math.min(32, Math.floor((beats.length - 1) / 2));
  if (span < 4) return fallback;
  const periods = beats.slice(span).map((t, i) => (t - beats[i]) / span).filter(gap => gap > 0).sort((a, b) => a - b);
  const median = periods[Math.floor(periods.length / 2)];
  const bpm = 60 / median;
  return bpm > fallback * .8 && bpm < fallback * 1.2 ? Math.round(bpm * 1000) / 1000 : fallback;
}

/**
 * Estimate tempo from a normalised onset-novelty envelope. Autocorrelates over
 * [minBpm, maxBpm], but weights each lag by a broad log-normal prior centred on
 * a danceable tempo before choosing — because the autocorrelation peaks just as
 * strongly at a tempo's half and double, so the raw maximum octave-slips (a 150
 * BPM track reading as 75). The prior only breaks ties among octave-equivalent
 * peaks; a clear, unambiguous peak still wins.
 */
export function estimateTempo(onset: number[], frameRate: number, minBpm = 72, maxBpm = 176): TempoEstimate {
  const fallback: TempoEstimate = { bpm: 120, confidence: 0, lag: Math.round((60 / 120) * Math.max(1, frameRate)) };
  if (onset.length < 8 || !Number.isFinite(frameRate) || frameRate <= 0) return fallback;

  const noveltyMean = onset.reduce((sum, value) => sum + value, 0) / onset.length;
  const minimumLag = Math.max(1, Math.floor((60 / maxBpm) * frameRate));
  const maximumLag = Math.max(minimumLag + 1, Math.ceil((60 / minBpm) * frameRate));
  const correlations = new Map<number, number>();

  const tempoPrior = (lag: number) => {
    const bpm = (60 * frameRate) / lag;
    const octaves = Math.log2(bpm / 130);
    return Math.exp(-0.5 * (octaves / 0.9) ** 2);
  };

  let bestLag = Math.round((60 / 120) * frameRate);
  let bestCorrelation = -Infinity;
  let bestScore = -Infinity;
  for (let lag = minimumLag; lag <= maximumLag; lag++) {
    let correlation = 0;
    let weight = 0;
    for (let index = lag; index < onset.length; index += 2) {
      correlation += Math.max(0, onset[index] - noveltyMean) * Math.max(0, onset[index - lag] - noveltyMean);
      weight++;
    }
    correlation /= Math.max(1, weight);
    correlations.set(lag, correlation);
    const score = correlation * tempoPrior(lag);
    if (score > bestScore) {
      bestScore = score;
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  // Sub-lag refinement by parabolic interpolation of the raw correlations.
  const left = correlations.get(bestLag - 1) ?? bestCorrelation;
  const right = correlations.get(bestLag + 1) ?? bestCorrelation;
  const curvature = left - 2 * bestCorrelation + right;
  const offset = Math.abs(curvature) > 1e-9 ? Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / curvature)) : 0;
  const bpm = Math.round(1000 * Math.max(minBpm, Math.min(maxBpm, (60 * frameRate) / (bestLag + offset)))) / 1000;

  const correlationValues = [...correlations.values()];
  const correlationFloor = quantile(correlationValues, 0.5);
  const confidence = clamp01((bestCorrelation - correlationFloor) / Math.max(1e-5, quantile(onset, 0.9) ** 2 * 0.35));
  return { bpm, confidence, lag: bestLag };
}
