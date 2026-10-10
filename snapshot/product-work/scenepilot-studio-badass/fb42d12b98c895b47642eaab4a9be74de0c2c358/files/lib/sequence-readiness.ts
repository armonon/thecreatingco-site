export type SequenceReadinessInput = {
  hasMainMedia: boolean;
  /** A nested composition can generate the complete picture without a source
   * video or song (motion graphics, titles, alpha masters). */
  hasCompositionContent?: boolean;
  assetCount: number;
  placementCount: number;
  baseCutCount: number;
  montageEnabled?: boolean;
  analyzing?: boolean;
};

export function autoPreviewStatusLabel(input: SequenceReadinessInput) {
  if (input.analyzing) return "ANALYZING MEDIA";
  if (input.hasCompositionContent && input.placementCount > 0) return `${input.placementCount} COMP${input.placementCount === 1 ? "" : "S"} READY`;
  if (input.placementCount > 0) return `${input.placementCount} HITS READY`;
  if (input.baseCutCount > 0) return `${input.baseCutCount} CUTS READY`;
  if (input.hasMainMedia || input.assetCount > 0) return "MEDIA READY";
  return "WAITING FOR MEDIA";
}

export function hasRenderableSequence(input: SequenceReadinessInput) {
  // The sequence owns its picture and clock. A main song/video is an optional
  // source, not a prerequisite for manual editing or composition delivery.
  // Media sitting only in the bin (or a disabled base lane) is not an edit.
  return input.placementCount > 0 || ((input.montageEnabled ?? true) && input.baseCutCount > 0);
}

export function shotMatchSequenceCount(baseCutCount: number, placementCount: number) {
  return baseCutCount > 0 ? baseCutCount : placementCount;
}
