import type { EditSnapshot } from "./edit-snapshot";
import type { CutEvidence } from "../lib/auto-edit-policy";
export type AutoEditVersion = {
  id: string; name: string; createdAt: string; expectedTimeline: string;
  fields?: Array<keyof EditSnapshot>;
  snapshot: Omit<EditSnapshot, "autoVersions">;
  evidence: Array<{ id: string; assetId: string; start: number; duration: number; editorial: CutEvidence }>;
  warnings: string[];
};
