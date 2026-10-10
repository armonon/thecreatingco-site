// Scenes rendered by both engines in scripts/certify-engine-parity.mjs. Each is a
// saved Pro `scenepilot-cut` document, exactly what a user would hand the translator.
export const PARITY_SIZE = { width: 640, height: 360, fps: 30, seconds: 3 };

/**
 * Agreed tolerances: 8-bit RGB error between Pro's export and the native export of
 * the same document, per frame, after one decoder. Set from measurement (see
 * docs/engine-parity.md): Pro's H.264 encoder alone costs ~2.5 worst-frame MAE against
 * the source, so the engine budget is that floor plus a 1.5 margin. A one-frame slip
 * of the source (≥5.5) or an unported blend rule (≥6.8 mean) exceeds it; the harness
 * re-proves that sensitivity on every run. Film grain is independent noise per engine,
 * so a graded case gets one more level.
 */
export const TOLERANCES = {
  engine: { meanMAE: 3, worstMAE: 4, worstP99: 80, minPSNR: 24 },
  grain: { meanMAE: 3.5, worstMAE: 5, worstP99: 80, minPSNR: 24 },
};

const NEUTRAL_GRADE = { exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0, bloom: 0, vignette: 0, grain: 0, aberration: 0 };
const NEUTRAL_EFFECTS = {
  styleId: "cinematic", autoEnergy: "dynamic", montageEnabled: true, montagePace: "balanced",
  punchPreset: "off", shakePreset: "off", strobePreset: "off", stutterPreset: "off", speedPreset: "off", echoPreset: "off",
  lookPreset: "none", dropRampEnabled: false, audioReactive: false, mirrorMode: 0, streak: 0, transitionType: "none", manualGrade: NEUTRAL_GRADE,
};
const TRACK = { id: "v2", name: "V2 · Overlay", color: "#fff", enabled: true, locked: false, blend: "normal", opacity: 100, hue: 0, saturation: 100, brightness: 100, glow: 0, fadeIn: 0, fadeOut: 0 };
const base = (id, assetId, start, duration, extra = {}) => ({ id, assetId, trackId: "__base__", sectionId: "s", start, duration, sourceStart: 0, ...extra });
const overlay = (id, assetId, start, duration, presentation, extra = {}) => ({ id, assetId, trackId: "v2", sectionId: "manual", start, duration, sourceStart: 0, overlay: presentation, ...extra });
const grid = (step) => Array.from({ length: Math.floor(PARITY_SIZE.seconds / step) + 1 }, (_, i) => +(i * step).toFixed(6));
const beats120 = grid(0.5); // 120 BPM over 3 s
const sections = [{ id: "verse", start: 0, end: 1.5, energy: 0.3 }, { id: "drop", start: 1.5, end: 3, energy: 0.9 }];

function document(media, name, { effects = {}, rawEffects, videoClips, tracks = [TRACK], beats = [], sections = [], renderAnalysis } = {}) {
  return {
    format: "scenepilot-cut", version: 2, project: name, duration: PARITY_SIZE.seconds, bpm: 120, beatOffset: 0, beats, sections,
    effects: rawEffects ?? { ...NEUTRAL_EFFECTS, ...effects },
    settings: { aspect: "custom", customSize: { width: PARITY_SIZE.width, height: PARITY_SIZE.height }, sourceDims: { w: PARITY_SIZE.width, h: PARITY_SIZE.height },
      exportFrameRate: PARITY_SIZE.fps, exportMaxDimension: 1920, exportFormat: "mp4-h264", colorCurve: "none", lut3dSource: null, lut3dMix: 1 },
    tracks, videoClips, titles: [],
    assets: Object.entries(media).map(([id, sourcePath]) => ({ id, name: `${id}.mp4`, kind: "video", sourcePath })),
    proState: { masterGain: 1, audioClips: [] },
    ...(renderAnalysis ? { renderAnalysis } : {}),
  };
}

export function parityCases(media) {
  const make = (name, purpose, options, extra = {}) => ({ name, purpose, document: document(media, name, options), ...extra });
  return [
    make("baseline", "One untouched cut; each export is also compared with the source footage (encoder noise floor).",
      { videoClips: [base("only", "pattern", 0, 3)] }, { source: "pattern" }),
    make("cuts-flip", "Hard cut, source offset and horizontal flip.",
      { videoClips: [base("a", "pattern", 0, 1.5, { sourceStart: 0.5, flipH: true }), base("b", "blue", 1.5, 1.5)] }),
    make("overlay-motion", "Half-scale overlay moving with an eased keyframe path.",
      { videoClips: [base("a", "pattern", 0, 3), overlay("o", "red", 0.5, 2, { scale: 50, opacity: 100 }, {
        transformKeyframes: [{ id: "k0", time: 0, x: -0.2, y: 0, scale: 1, rotation: 0, opacity: 1, easing: "ease-out" }, { id: "k1", time: 2, x: 0.2, y: 0, scale: 1.5, rotation: 0, opacity: 1, easing: "linear" }] })] }),
    make("fades-opacity", "Picture fades, overlay and track opacity (gamma blending).",
      { tracks: [{ ...TRACK, fadeIn: 0.2 }], videoClips: [base("a", "pattern", 0, 1.5, { fadeIn: 0.3 }), base("b", "blue", 1.5, 1.5, { fadeOut: 0.6 }), overlay("o", "red", 0.5, 2, { scale: 50, opacity: 60 })] }),
    make("punch-accents", "Dynamic beat punch at 120 BPM: saved accents hit harder, section energy scales the size.",
      { effects: { punchPreset: "dynamic" }, beats: beats120, sections, renderAnalysis: { accents: [0, 1, 2], dropRamp: null },
        videoClips: [base("a", "pattern", 0, 3)] }),
    make("zoom-transitions", "Zoom transition into every cut, one with its own duration.",
      { effects: { transitionType: "zoom" }, videoClips: [base("a", "pattern", 0, 1.2), base("b", "pattern", 1.2, 1.8, { sourceStart: 0.3, flipH: true, transitionDuration: 0.3 })] }),
    make("drop-ramp", "Slow-mo drop ramp: 8 beats at 240 BPM decelerating to a freeze on the drop, then a hard cut.",
      { effects: { dropRampEnabled: true }, beats: grid(0.25), renderAnalysis: { accents: [], dropRamp: { dropTime: 2.4 } },
        videoClips: [base("a", "pattern", 0, 2.4), base("b", "pattern", 2.4, 0.6, { sourceStart: 0.2, flipH: true })] }),
    make("look-cinematic", "Cinematic look: bloom, aberration, contrast, warmth, vignette and grain, pulsing on the beat with section energy.",
      { effects: { lookPreset: "cinematic" }, beats: beats120, sections, renderAnalysis: { accents: [0, 2], dropRamp: null },
        videoClips: [base("a", "pattern", 0, 1.5), base("b", "red", 1.5, 1.5)] }, { tolerance: "grain" }),
    make("look-mirror-streak", "Grade without grain: neon look folded by the quad mirror with anamorphic streaks.",
      { effects: { lookPreset: "none", mirrorMode: 3, streak: 0.6, manualGrade: { ...NEUTRAL_GRADE, contrast: 1.2, saturation: 1.3, bloom: 0.4, vignette: 0.3, aberration: 0.003 } },
        videoClips: [base("a", "pattern", 0, 3)] }),
    make("pro-defaults", "A document with no effect settings: Pro's defaults (cinematic look, dynamic punch, zoom transitions, drop ramp) all at once.",
      { rawEffects: {}, beats: beats120, sections, renderAnalysis: { accents: [0, 1, 2], dropRamp: { dropTime: 2.5 } },
        videoClips: [base("a", "pattern", 0, 1.5), base("b", "pattern", 1.5, 1.5, { sourceStart: 1, flipV: true }), overlay("o", "red", 0.5, 2, { scale: 40, opacity: 100 })] }, { tolerance: "grain" }),
  ];
}
