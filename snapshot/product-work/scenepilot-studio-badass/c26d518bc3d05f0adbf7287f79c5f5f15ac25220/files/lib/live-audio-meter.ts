import { coerceAudioEffectRack, type AudioEffectRack } from "./pro-editor.ts";
import { sharedAudioContext } from "./shared-audio-clock.ts";

export type LiveMeterReading = {
  peak: number;
  rms: number;
  db: number;
  clipped: boolean;
};

export const SILENT_READING: LiveMeterReading = { peak: 0, rms: 0, db: Number.NEGATIVE_INFINITY, clipped: false };

export function amplitudeToDb(amplitude: number) {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : Number.NEGATIVE_INFINITY;
}

export function meterPercent(reading: Pick<LiveMeterReading, "peak">) {
  const db = amplitudeToDb(Math.max(0, reading.peak));
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(100, (db + 60) / 60 * 100));
}

export function formatMeterDb(db: number) {
  if (!Number.isFinite(db) || db <= -96) return "−∞ dB";
  const rounded = Math.max(-96, Math.min(12, db));
  return `${rounded < 0 ? "−" : "+"}${Math.abs(rounded).toFixed(1)} dB`;
}

const mediaSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export type LiveAudioProcessingState = {
  rack?: Partial<AudioEffectRack>;
  pan?: number;
};

/**
 * Measure the samples a real media element is playing. The caller supplies the
 * final gain multiplier so the meter follows clip/track automation instead of
 * presenting decorative activity.
 */
export function attachLiveAudioMeter(
  media: HTMLMediaElement,
  onReading: (reading: LiveMeterReading) => void,
  gainAtTime: () => number = () => media.volume,
  processingAtTime: () => LiveAudioProcessingState = () => ({}),
) {
  if (typeof AudioContext === "undefined") return () => undefined;
  const context = sharedAudioContext()!;
  let source = mediaSources.get(media);
  if (!source) {
    source = context.createMediaElementSource(media);
    mediaSources.set(media, source);
  }
  return attachAudioNodeMeter(source, onReading, gainAtTime, processingAtTime, () => !media.paused);
}

export function attachAudioNodeMeter(source: AudioNode, onReading: (reading: LiveMeterReading) => void, gainAtTime: () => number, processingAtTime: () => LiveAudioProcessingState = () => ({}), playing: () => boolean = () => true) {
  const context = source.context as AudioContext;
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.68;
  const level = context.createGain();
  level.gain.value = 0;
  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  const low = context.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 180;
  const mid = context.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1_500;
  mid.Q.value = 0.8;
  const high = context.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 6_000;
  const compressor = context.createDynamicsCompressor();
  compressor.knee.value = 12;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.18;
  const makeup = context.createGain();
  const limiter = context.createDynamicsCompressor();
  limiter.knee.value = 0;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.08;
  const panner = context.createStereoPanner();
  source.connect(level).connect(highPass).connect(low).connect(mid).connect(high).connect(compressor).connect(makeup).connect(limiter).connect(panner).connect(analyser);
  analyser.connect(context.destination);
  const samples = new Float32Array(analyser.fftSize);
  let frame = 0;
  let lastPublished = 0;
  const read = (now: number) => {
    frame = requestAnimationFrame(read);
    if (context.state === "suspended" && playing()) void context.resume();
    const gain = Math.max(0, gainAtTime());
    const processing = processingAtTime();
    const rack = coerceAudioEffectRack(processing.rack);
    level.gain.setTargetAtTime(gain, context.currentTime, 0.008);
    highPass.frequency.setTargetAtTime(rack.highPassHz, context.currentTime, 0.008);
    low.gain.setTargetAtTime(rack.lowDb, context.currentTime, 0.008);
    mid.gain.setTargetAtTime(rack.midDb, context.currentTime, 0.008);
    high.gain.setTargetAtTime(rack.highDb, context.currentTime, 0.008);
    compressor.threshold.setTargetAtTime(rack.compressorThreshold, context.currentTime, 0.008);
    compressor.ratio.setTargetAtTime(rack.compressorRatio, context.currentTime, 0.008);
    makeup.gain.setTargetAtTime(rack.makeupGain, context.currentTime, 0.008);
    limiter.threshold.setTargetAtTime(rack.limiter ? -1 : 0, context.currentTime, 0.008);
    limiter.ratio.setTargetAtTime(rack.limiter ? 20 : 1, context.currentTime, 0.008);
    panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, processing.pan ?? 0)), context.currentTime, 0.008);
    // Controls follow every animation frame; only meter publication is throttled.
    // Otherwise short composition fades can finish before the gain is updated.
    if (now - lastPublished < 80) return;
    lastPublished = now;
    analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    let energy = 0;
    for (const sample of samples) {
      const value = Math.abs(sample);
      peak = Math.max(peak, value);
      energy += sample * sample;
    }
    const rms = Math.sqrt(energy / samples.length);
    onReading({ peak, rms, db: amplitudeToDb(peak), clipped: peak >= 0.999 });
  };
  frame = requestAnimationFrame(read);
  return () => {
    cancelAnimationFrame(frame);
    try { source.disconnect(level); } catch { source.disconnect(); }
    level.disconnect();
    highPass.disconnect();
    low.disconnect();
    mid.disconnect();
    high.disconnect();
    compressor.disconnect();
    makeup.disconnect();
    limiter.disconnect();
    panner.disconnect();
    analyser.disconnect();
    onReading(SILENT_READING);
  };
}
