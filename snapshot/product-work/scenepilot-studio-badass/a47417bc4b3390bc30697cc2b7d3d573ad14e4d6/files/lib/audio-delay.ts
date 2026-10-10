/** Match a known calibration signal, returning a sample offset, never a guessed platform constant. */
export function measureAudioDelay(reference: Float32Array, decoded: Float32Array, origin: number, maxDelay: number) {
  let referencePower = 0;
  for (const value of reference) referencePower += value * value;
  if (referencePower < 1e-8) throw new Error("Audio timing probe is silent.");
  const score = (lag: number) => {
    let dot = 0, power = 0;
    for (let i = 0; i < reference.length; i++) {
      const value = decoded[origin + lag + i] ?? 0;
      dot += reference[i] * value; power += value * value;
    }
    return power > 1e-8 ? dot / Math.sqrt(referencePower * power) : 0;
  };
  // Search every sample offset: narrow-band audio can make striding
  // past the correct lag miss the peak entirely. The probe is bounded to 1024 samples.
  let delay = 0, correlation = -1;
  for (let lag = -Math.min(origin, maxDelay); lag <= maxDelay; lag++) {
    const value = score(lag);
    if (value > correlation) { correlation = value; delay = lag; }
  }
  if (correlation < .65) throw new Error("AAC timing calibration was inconclusive. Try WebM export or the native desktop renderer.");
  return { delay, correlation };
}
