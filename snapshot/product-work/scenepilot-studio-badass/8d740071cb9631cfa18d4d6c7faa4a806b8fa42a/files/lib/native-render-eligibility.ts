import { nativeColorIsPixelVerified, nativeEffectIsPixelVerified, type NativeParityColor } from "./native-render-contract.ts";

export type NativeEligibilityClip = {
  sourcePath: string;
  transitionType?: string;
  transformKeyframeCount: number;
  reversed: boolean;
  timeRemapCount: number;
  color?: NativeParityColor;
  effects: Array<{
    type: string;
    enabled: boolean;
    amount: number;
    keyframeCount: number;
    expressionSource?: string;
  }>;
};

export type NativeEligibilityInput = {
  isPro: boolean;
  engineAvailable: boolean;
  formatSupported: boolean;
  timelineContinuous: boolean;
  clips: NativeEligibilityClip[];
  placementCount: number;
  titleCount: number;
  audioClipCount: number;
  audioClipsNativeReady?: boolean;
  audioRequiresPcm?: boolean;
  globalTransition: string;
  punchPreset: string;
  shakePreset: string;
  strobePreset: string;
  stutterPreset: string;
  speedPreset: string;
  dropRampEnabled: boolean;
  audioReactive: boolean;
  echoPreset: string;
  hasShaderEffect: boolean;
};

export type NativeEligibilityResult = { eligible: boolean; reasons: string[] };

/** Decide whether the native FFmpeg cut engine can reproduce the frame plan.
 * Returning explicit reasons keeps fallback predictable and debuggable: an
 * unsupported look always goes to the shared parity renderer, never missing
 * silently from the export. */
export function nativeSequenceEligibility(input: NativeEligibilityInput): NativeEligibilityResult {
  const reasons: string[] = [];
  if (!input.isPro) reasons.push("Desktop Pro is required");
  if (!input.engineAvailable) reasons.push("native media engine unavailable");
  if (!input.formatSupported) reasons.push("selected native codec unavailable");
  if (!input.clips.length) reasons.push("no V1 picture clips");
  if (!input.timelineContinuous) reasons.push("timeline contains gaps or range offsets");
  if (input.clips.some((clip) => !clip.sourcePath)) reasons.push("source media needs relinking");
  if (input.placementCount) reasons.push("layered clips or compositions require the parity renderer");
  if (input.titleCount) reasons.push("titles require the parity renderer");
  if (input.audioClipCount && !input.audioClipsNativeReady) reasons.push("placed audio clips need linked local media for the native mixer");
  if (input.audioRequiresPcm) reasons.push("program audio uses the shared PCM mixer to preserve envelopes and channel-strip processing");
  if (input.globalTransition !== "none" || input.clips.some((clip) => (clip.transitionType ?? input.globalTransition) !== "none")) reasons.push("transitions require the parity renderer");
  if (input.clips.some((clip) => clip.transformKeyframeCount > 0)) reasons.push("animated transforms require the parity renderer");
  if (input.clips.some((clip) => clip.timeRemapCount > 0)) reasons.push("time remapping requires the parity renderer");
  if (input.clips.some((clip) => !nativeColorIsPixelVerified(clip.color))) reasons.push("clip color adjustments require the pixel-parity renderer");
  if (input.clips.some((clip) => clip.effects.some((effect) => effect.enabled && effect.amount > 0 && (
    !nativeEffectIsPixelVerified(effect) || effect.keyframeCount > 0 || (effect.expressionSource && effect.expressionSource !== "none")
  )))) reasons.push("clip effects require the parity renderer until pixel-verified");
  if (input.punchPreset !== "off" || input.shakePreset !== "off") reasons.push("camera motion requires the parity renderer");
  if (input.strobePreset !== "off" || input.stutterPreset !== "off" || input.speedPreset !== "off" || input.dropRampEnabled || input.audioReactive) reasons.push("beat-driven timing or light effects require the parity renderer");
  if (input.echoPreset !== "off" || input.hasShaderEffect) reasons.push("GPU grade or feedback requires the parity renderer");
  return { eligible: reasons.length === 0, reasons };
}
