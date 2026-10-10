import { coerceAudioEffectRack, type AudioEffectRack } from "./pro-editor.ts";
import { audioFadeGainAt, audioEnvelopesGainAt, type AudioEnvelope, type AudioFadeShape } from "./audio-crossfade.ts";

export const PCM_MIX_SAMPLE_RATE = 48_000;
export const PCM_MIX_CHUNK_FRAMES = 1_024;

export type PcmAutomationPoint = { time: number; gain: number };

export type PcmClipControls = {
  gain: number;
  pan: number;
  fadeIn: number;
  fadeOut: number;
  duration: number;
  fadeShape?: AudioFadeShape;
  envelopes?: AudioEnvelope[];
  automation?: PcmAutomationPoint[];
  processing?: AudioEffectRack;
};

function normalizedAutomation(points: PcmAutomationPoint[] | undefined) {
  return [...(points ?? [])]
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.gain))
    .sort((a, b) => a.time - b.time);
}

function automationGainAtSorted(automation: PcmAutomationPoint[], time: number) {
  if (!automation.length) return 1;
  if (time <= automation[0].time) return Math.max(0, automation[0].gain);
  if (time >= automation[automation.length - 1].time) return Math.max(0, automation[automation.length - 1].gain);
  let low = 1;
  let high = automation.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (automation[middle].time < time) low = middle + 1;
    else high = middle;
  }
  const rightIndex = low;
  const left = automation[rightIndex - 1];
  const right = automation[rightIndex];
  const progress = (time - left.time) / Math.max(0.000_001, right.time - left.time);
  return Math.max(0, left.gain + (right.gain - left.gain) * progress);
}

export function pcmAutomationGainAt(points: PcmAutomationPoint[] | undefined, time: number) {
  return automationGainAtSorted(normalizedAutomation(points), time);
}

export function pcmFadeGainAt(
  time: number,
  duration: number,
  fadeIn: number,
  fadeOut: number,
  shape: AudioFadeShape = "linear",
) {
  return audioFadeGainAt(time, duration, fadeIn, fadeOut, shape);
}

type BiquadCoefficients = { b0: number; b1: number; b2: number; a1: number; a2: number };

const identityBiquad = (): BiquadCoefficients => ({ b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 });

function normalizeBiquad(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): BiquadCoefficients {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function highPassCoefficients(sampleRate: number, frequency: number, q = Math.SQRT1_2) {
  const omega = 2 * Math.PI * Math.max(1, Math.min(sampleRate * 0.49, frequency)) / sampleRate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * q);
  return normalizeBiquad((1 + cosine) / 2, -(1 + cosine), (1 + cosine) / 2, 1 + alpha, -2 * cosine, 1 - alpha);
}

function peakingCoefficients(sampleRate: number, frequency: number, q: number, gainDb: number) {
  if (Math.abs(gainDb) < 0.000_001) return identityBiquad();
  const amplitude = 10 ** (gainDb / 40);
  const omega = 2 * Math.PI * Math.max(1, Math.min(sampleRate * 0.49, frequency)) / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  return normalizeBiquad(
    1 + alpha * amplitude, -2 * Math.cos(omega), 1 - alpha * amplitude,
    1 + alpha / amplitude, -2 * Math.cos(omega), 1 - alpha / amplitude,
  );
}

function shelfCoefficients(sampleRate: number, frequency: number, gainDb: number, high: boolean) {
  if (Math.abs(gainDb) < 0.000_001) return identityBiquad();
  const amplitude = 10 ** (gainDb / 40);
  const omega = 2 * Math.PI * Math.max(1, Math.min(sampleRate * 0.49, frequency)) / sampleRate;
  const cosine = Math.cos(omega);
  const sine = Math.sin(omega);
  const alpha = sine / 2 * Math.SQRT2;
  const root = 2 * Math.sqrt(amplitude) * alpha;
  if (high) {
    return normalizeBiquad(
      amplitude * ((amplitude + 1) + (amplitude - 1) * cosine + root),
      -2 * amplitude * ((amplitude - 1) + (amplitude + 1) * cosine),
      amplitude * ((amplitude + 1) + (amplitude - 1) * cosine - root),
      (amplitude + 1) - (amplitude - 1) * cosine + root,
      2 * ((amplitude - 1) - (amplitude + 1) * cosine),
      (amplitude + 1) - (amplitude - 1) * cosine - root,
    );
  }
  return normalizeBiquad(
    amplitude * ((amplitude + 1) - (amplitude - 1) * cosine + root),
    2 * amplitude * ((amplitude - 1) - (amplitude + 1) * cosine),
    amplitude * ((amplitude + 1) - (amplitude - 1) * cosine - root),
    (amplitude + 1) + (amplitude - 1) * cosine + root,
    -2 * ((amplitude - 1) + (amplitude + 1) * cosine),
    (amplitude + 1) + (amplitude - 1) * cosine - root,
  );
}

class StereoBiquad {
  private readonly coefficients: BiquadCoefficients;
  private left1 = 0;
  private left2 = 0;
  private right1 = 0;
  private right2 = 0;
  left = 0;
  right = 0;

  constructor(coefficients: BiquadCoefficients) {
    this.coefficients = coefficients;
  }

  process(left: number, right: number) {
    const { b0, b1, b2, a1, a2 } = this.coefficients;
    this.left = b0 * left + this.left1;
    this.left1 = b1 * left - a1 * this.left + this.left2;
    this.left2 = b2 * left - a2 * this.left;
    this.right = b0 * right + this.right1;
    this.right1 = b1 * right - a1 * this.right + this.right2;
    this.right2 = b2 * right - a2 * this.right;
  }
}

class StereoDynamics {
  private gain = 1;
  private readonly sampleRate: number;
  private readonly thresholdDb: number;
  private readonly ratio: number;
  private readonly kneeDb: number;
  private readonly attackSeconds: number;
  private readonly releaseSeconds: number;

  constructor(
    sampleRate: number,
    thresholdDb: number,
    ratio: number,
    kneeDb: number,
    attackSeconds: number,
    releaseSeconds: number,
  ) {
    this.sampleRate = sampleRate;
    this.thresholdDb = thresholdDb;
    this.ratio = ratio;
    this.kneeDb = kneeDb;
    this.attackSeconds = attackSeconds;
    this.releaseSeconds = releaseSeconds;
  }

  process(left: number, right: number) {
    if (this.ratio <= 1) return 1;
    const peak = Math.max(Math.abs(left), Math.abs(right), 1e-12);
    const inputDb = 20 * Math.log10(peak);
    const lower = this.thresholdDb - this.kneeDb / 2;
    const upper = this.thresholdDb + this.kneeDb / 2;
    let reductionDb = 0;
    if (this.kneeDb > 0 && inputDb > lower && inputDb < upper) {
      const distance = inputDb - lower;
      reductionDb = (1 / this.ratio - 1) * distance * distance / (2 * this.kneeDb);
    } else if (inputDb >= upper) {
      reductionDb = this.thresholdDb + (inputDb - this.thresholdDb) / this.ratio - inputDb;
    }
    const target = 10 ** (reductionDb / 20);
    const seconds = target < this.gain ? this.attackSeconds : this.releaseSeconds;
    const coefficient = seconds > 0 ? Math.exp(-1 / (seconds * this.sampleRate)) : 0;
    this.gain = target + coefficient * (this.gain - target);
    return this.gain;
  }
}

/** Stateful, deterministic PCM equivalent of ScenePilot's live Web Audio
 * channel strip. One instance must be retained for the full life of a clip so
 * filters and dynamics remain continuous across encoder chunks. */
export class PcmChannelStrip {
  private readonly controls: PcmClipControls;
  private readonly filters: StereoBiquad[];
  private readonly compressor: StereoDynamics;
  private readonly limiter: StereoDynamics;
  private readonly rack: AudioEffectRack;
  private readonly automation: PcmAutomationPoint[];
  left = 0;
  right = 0;

  constructor(controls: PcmClipControls, sampleRate = PCM_MIX_SAMPLE_RATE) {
    this.controls = controls;
    this.rack = coerceAudioEffectRack(controls.processing);
    this.automation = normalizedAutomation(controls.automation);
    this.filters = [
      new StereoBiquad(highPassCoefficients(sampleRate, this.rack.highPassHz)),
      new StereoBiquad(shelfCoefficients(sampleRate, 180, this.rack.lowDb, false)),
      new StereoBiquad(peakingCoefficients(sampleRate, 1_500, 0.8, this.rack.midDb)),
      new StereoBiquad(shelfCoefficients(sampleRate, 6_000, this.rack.highDb, true)),
    ];
    this.compressor = new StereoDynamics(sampleRate, this.rack.compressorThreshold, this.rack.compressorRatio, 12, 0.008, 0.18);
    this.limiter = new StereoDynamics(sampleRate, this.rack.limiter ? -1 : 0, this.rack.limiter ? 20 : 1, 0, 0.002, 0.08);
  }

  process(left: number, right: number, mono: boolean, clipTime: number) {
    const gain = Math.max(0, this.controls.gain)
      * automationGainAtSorted(this.automation, clipTime)
      * pcmFadeGainAt(clipTime, this.controls.duration, this.controls.fadeIn, this.controls.fadeOut, this.controls.fadeShape)
      * audioEnvelopesGainAt(this.controls.envelopes, clipTime);
    let processedLeft = Number.isFinite(left) ? left * gain : 0;
    let processedRight = Number.isFinite(right) ? right * gain : 0;
    for (const filter of this.filters) {
      filter.process(processedLeft, processedRight);
      processedLeft = filter.left;
      processedRight = filter.right;
    }
    const compression = this.compressor.process(processedLeft, processedRight);
    processedLeft *= compression * this.rack.makeupGain;
    processedRight *= compression * this.rack.makeupGain;
    const limiting = this.limiter.process(processedLeft, processedRight);
    processedLeft *= limiting;
    processedRight *= limiting;

    const pan = Math.max(-1, Math.min(1, this.controls.pan));
    if (mono) {
      const angle = (pan + 1) * Math.PI / 4;
      this.left = processedLeft * Math.cos(angle);
      this.right = processedLeft * Math.sin(angle);
    } else if (pan <= 0) {
      const angle = (pan + 1) * Math.PI / 2;
      this.left = processedLeft + processedRight * Math.cos(angle);
      this.right = processedRight * Math.sin(angle);
    } else {
      const angle = pan * Math.PI / 2;
      this.left = processedLeft * Math.cos(angle);
      this.right = processedRight + processedLeft * Math.sin(angle);
    }
    if (!Number.isFinite(this.left)) this.left = 0;
    if (!Number.isFinite(this.right)) this.right = 0;
  }
}

export function clampPcmSample(value: number) {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}
