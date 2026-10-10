import { parseGarment, serializeGarment, type FabricPoint, type GarmentProject } from "./fabric-engine.ts";
import { draftSkirtPatternFromScan } from "./garment-scan-pattern.ts";
import {
  FORM_FABRIC_WORKSPACE_SCHEMA,
  formWorkspace,
  updateFormWorkspace,
  type FormProject,
  type FormProjectAsset,
} from "./project-format.ts";

export type TracedScanView = { assetId: string; points: FabricPoint[] };
export type TracedSkirtScan = {
  kind: "skirt";
  front: TracedScanView;
  back: TracedScanView;
  measuredLengthMm: number;
};

function originalScanAsset(project: FormProject<unknown>, view: "front" | "back", assetId: string): FormProjectAsset {
  const asset = project.assets.find((item) => item.id === assetId);
  const metadata = asset?.metadata?.garmentScan as Record<string, unknown> | undefined;
  if (!asset || metadata?.version !== 1 || metadata.view !== view || metadata.sourceBytesPreserved !== true ||
      !/^[a-f0-9]{64}$/i.test(asset.checksum ?? "") ||
      !asset.uri?.startsWith(`data:${asset.mediaType};base64,`)) {
    throw new Error(`needs-input: attach an original ${view} scan asset before drafting a pattern`);
  }
  return asset;
}

async function verifyOriginalBytes(asset: FormProjectAsset, view: "front" | "back") {
  try {
    const payload = asset.uri!.slice(asset.uri!.indexOf(",") + 1);
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (bytes.length !== asset.bytes || digest !== asset.checksum) throw new Error("checksum mismatch");
  } catch {
    throw new Error(`The original ${view} scan bytes do not match the pattern evidence`);
  }
}

/** Keep a traced draft and its original scans in the same versioned Form project. */
export function attachTracedSkirtPattern(project: FormProject<unknown>, input: TracedSkirtScan, at = Date.now()) {
  if (input?.kind !== "skirt") throw new Error("needs-input: this scan category has no proved pattern construction yet");
  if (input.front.assetId === input.back.assetId) throw new Error("needs-input: front and back must use distinct original scans");
  const front = originalScanAsset(project, "front", input.front.assetId);
  const back = originalScanAsset(project, "back", input.back.assetId);
  if (front.checksum === back.checksum) throw new Error("needs-input: provide distinct front and back scan images");
  const garment = draftSkirtPatternFromScan({
    kind: "skirt", measuredLengthMm: input.measuredLengthMm,
    front: { sourceId: front.id, sha256: front.checksum!, points: input.front.points },
    back: { sourceId: back.id, sha256: back.checksum!, points: input.back.points },
  });
  const portable = parseGarment(serializeGarment(garment));
  const updated = updateFormWorkspace(project, "fabric", {
    schema: FORM_FABRIC_WORKSPACE_SCHEMA,
    objectIds: [...portable.pieces.map((piece) => piece.id), ...portable.seams.map((seam) => seam.id)],
    data: portable,
  }, at);
  return { project: updated, garment: portable };
}

/** Reopening must not silently detach an inferred pattern from its source images. */
export async function scanPatternFromProject(project: FormProject<unknown>): Promise<GarmentProject> {
  const stored = formWorkspace<GarmentProject>(project, "fabric");
  if (stored?.schema !== FORM_FABRIC_WORKSPACE_SCHEMA) throw new Error("This project has no supported Fabric workspace");
  const garment = parseGarment(JSON.stringify(stored.data));
  if (!garment.scanEvidence) throw new Error("This project has no scan-derived pattern");
  for (const view of ["front", "back"] as const) {
    const source = garment.scanEvidence.views[view];
    const asset = originalScanAsset(project, view, source.sourceId);
    if (asset.checksum !== source.sha256) throw new Error(`The ${view} scan does not match its pattern evidence`);
    await verifyOriginalBytes(asset, view);
  }
  return garment;
}
