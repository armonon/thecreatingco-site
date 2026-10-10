// Disk cleaner client — an AI-assisted, fully-reversible cleaner.
//
// The native engine (batch_operator.rs) measures space; removal always routes
// through the reversible quarantine trash (batch_trash) with user approval.
// Long scans stream progress events so the UI fills in live.

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  confinementRoot,
  humanSize,
  restoreTrash,
  revealPath,
  trashPaths,
  TrashResult,
} from "./fileManager";

export type Safety = "safe" | "review";

export interface CleanEntry {
  path: string;
  sizeBytes: number;
}

export interface CleanCategory {
  id: string;
  name: string;
  description: string;
  safety: Safety;
  root: string;
  sizeBytes: number;
  humanSize: string;
  itemCount: number;
  entries: CleanEntry[];
}

export interface SmartScan {
  categories: CleanCategory[];
  totalReclaimable: number;
  humanTotal: string;
  /** macOS gates Trash / Mail / backups behind Full Disk Access. */
  needsFullDiskAccess?: boolean;
  /** Checks that hit the deadline (e.g. a folder blocked by the OS). */
  skippedChecks?: number;
}

export interface ScanProgress {
  check: string;
  categories: CleanCategory[];
  totalChecks: number;
}

/** Subscribe to a native event; resolves to a no-op outside the Tauri app. */
async function safeListen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  try {
    return await listen<T>(event, (e) => handler(e.payload));
  } catch {
    return () => undefined;
  }
}

/** Smart Scan, reporting each finished check through `onProgress` as it lands. */
export async function smartScan(onProgress?: (p: ScanProgress) => void): Promise<SmartScan> {
  const unlisten = onProgress ? await safeListen<ScanProgress>("disk-scan-progress", onProgress) : null;
  try {
    return await invoke<SmartScan>("disk_smart_scan");
  } finally {
    unlisten?.();
  }
}

/** Fold a streamed batch of categories into the running scan (newest wins). */
export function mergeProgress(prev: SmartScan | null, incoming: CleanCategory[]): SmartScan {
  const byId = new Map((prev?.categories ?? []).map((c) => [c.id, c]));
  for (const c of incoming) byId.set(c.id, c);
  const categories = [...byId.values()].sort((a, b) => b.sizeBytes - a.sizeBytes);
  const total = categories.reduce((sum, c) => sum + c.sizeBytes, 0);
  return { ...prev, categories, totalReclaimable: total, humanTotal: humanSize(total) };
}

export interface Capacity {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  humanTotal: string;
  humanAvailable: string;
  humanUsed: string;
}

export async function diskCapacity(): Promise<Capacity> {
  return invoke<Capacity>("disk_capacity");
}

export interface StorageKind {
  id: string;
  name: string;
  drillPath: string;
  sizeBytes: number;
  humanSize: string;
  capped: boolean;
  measuring?: boolean;
}

export interface StorageReport {
  kinds: StorageKind[];
  measuredBytes: number;
  humanMeasured: string;
  needsFullDiskAccess?: boolean;
  unmeasured?: string[];
}

/** Whole-disk overview; `onProgress` receives running totals while measuring. */
export async function storageBreakdown(
  onProgress?: (kinds: StorageKind[]) => void,
): Promise<StorageReport> {
  const unlisten = onProgress
    ? await safeListen<{ kinds: StorageKind[] }>("disk-storage-progress", (p) => onProgress(p.kinds))
    : null;
  try {
    return await invoke<StorageReport>("disk_storage_breakdown");
  } finally {
    unlisten?.();
  }
}

export interface TreeItem {
  path: string;
  name: string;
  sizeBytes: number;
  humanSize: string;
  isDirectory: boolean;
  capped?: boolean;
}

export interface UsageTree {
  path: string;
  items: TreeItem[];
  totalBytes?: number;
  humanTotal?: string;
  itemCount?: number;
}

export async function usageTree(path?: string, limit?: number): Promise<UsageTree> {
  return invoke<UsageTree>("disk_usage_tree", { path: path ?? null, limit: limit ?? null });
}

export interface DuplicateGroup {
  sizeBytes: number;
  humanSize: string;
  count: number;
  reclaimable: number;
  paths: string[];
}

export interface DuplicateReport {
  groups: DuplicateGroup[];
  reclaimable: number;
  humanReclaimable: string;
}

/** A duplicate cleanup must leave one reviewed source in every affected set. */
export function duplicateSelectionKeepsOriginal(groups: DuplicateGroup[], selected: ReadonlySet<string>): boolean {
  return groups.every((group) => group.paths.some((path) => !selected.has(path)));
}

export async function findDuplicates(paths: string[]): Promise<DuplicateReport> {
  return invoke<DuplicateReport>("disk_find_duplicates", { input: { inputPaths: paths } });
}

export interface Tip {
  id: string;
  title: string;
  detail: string;
  command?: string;
  sizeBytes?: number;
  humanSize?: string;
}

/** Space savers that live outside the reversible trash — shown, never run. */
export async function diskTips(): Promise<Tip[]> {
  const res = await invoke<{ tips: Tip[] }>("disk_tips");
  return res.tips;
}

/** Copy via the native clipboard (the webview clipboard is unreliable in Tauri). */
export async function copyText(text: string): Promise<void> {
  await invoke("copy_to_clipboard", { text });
}

export interface QuarantineItem {
  original: string;
  trashed: string;
  sizeBytes: number;
  humanSize: string;
}

export interface QuarantineBatch {
  trashId: string;
  trashedAt: string;
  itemCount: number;
  sizeBytes: number;
  humanSize: string;
  items: QuarantineItem[];
}

export interface QuarantineInfo {
  totalBytes: number;
  humanTotal: string;
  batches: QuarantineBatch[];
}

/** What the quarantine is holding — space that isn't freed until it's emptied. */
export async function quarantineInfo(): Promise<QuarantineInfo> {
  return invoke<QuarantineInfo>("batch_quarantine_info");
}

export async function restoreQuarantineItem(trashId: string, original: string): Promise<void> {
  await invoke("batch_restore_trash_item", { input: { trashId, original } });
}

/**
 * Permanently delete quarantine batches — the one irreversible step in the app.
 * Only called on an explicit, typed confirmation or by the retention policy.
 */
export interface EmptyResult {
  freedBytes: number;
  humanFreed: string;
  emptied: number;
  /** Paths that couldn't be removed (other than protected app bundles). */
  failed?: string[];
  /** App bundles macOS won't let Reclaim delete until it has App Management. */
  protectedApps?: { name: string; sizeBytes: number; humanSize: string }[];
}

export async function emptyQuarantine(opts: {
  trashIds?: string[];
  olderThanDays?: number;
}): Promise<EmptyResult> {
  const res = await invoke<{ metadata: EmptyResult }>(
    "batch_empty_quarantine",
    { input: { trashIds: opts.trashIds ?? null, olderThanDays: opts.olderThanDays ?? null } },
  );
  return res.metadata;
}

export async function hasFullDiskAccess(): Promise<boolean> {
  try {
    return await invoke<boolean>("disk_full_disk_access");
  } catch {
    return true; // outside the app, don't nag
  }
}

const RETENTION_KEY = "uco.quarantineDays";
/** Retention choices; 0 means "keep until I empty it". */
export const RETENTION_OPTIONS = [7, 30, 90, 0] as const;

export function getRetentionDays(): number {
  try {
    const v = localStorage.getItem(RETENTION_KEY);
    return v === null ? 30 : Number(v) || 0;
  } catch {
    return 30;
  }
}

export function setRetentionDays(days: number): void {
  try {
    localStorage.setItem(RETENTION_KEY, String(days));
  } catch {
    /* per-device convenience only */
  }
}

/**
 * Trash a set of paths that all belong to one category, confined to that
 * category's root so removal can never reach outside the scanned area.
 */
export async function cleanCategory(
  category: CleanCategory,
  paths: string[],
): Promise<TrashResult> {
  return trashPaths(paths, category.root);
}

/** Trash an arbitrary set of paths, confined to their common ancestor. */
export async function cleanPaths(paths: string[]): Promise<TrashResult> {
  const root = confinementRoot(paths.map(parentOf));
  return trashPaths(paths, root);
}

function parentOf(p: string): string {
  const i = p.replace(/\/+$/, "").lastIndexOf("/");
  return i > 0 ? p.slice(0, i) : "/";
}

/** "/Users/me/Documents" → "~/Documents" for display. */
export function shortPath(p: string): string {
  const home = p.match(/^\/Users\/[^/]+/);
  return home ? "~" + p.slice(home[0].length) : p;
}

export { humanSize, restoreTrash, revealPath };
export type { TrashResult };

/** Ground the model in this exact scan so answers name real categories and paths. */
export function scanContext(scan: SmartScan): string {
  const lines = scan.categories.map((c) => {
    const top = c.entries
      .slice(0, 6)
      .map((e) => `    · ${shortPath(e.path)} (${humanSize(e.sizeBytes)})`)
      .join("\n");
    return `- ${c.name} — ${c.humanSize}, ${c.itemCount} item(s), ${c.safety}: ${c.description}\n${top}`;
  });
  return (
    "You are Reclaim's cleanup assistant inside a Mac disk cleaner. Answer the user's questions " +
    "about THIS scan of their Mac. Be concise (short paragraphs or a few bullets), concrete, and " +
    "reassuring without overpromising. Name real categories and paths from the scan below; never " +
    "invent files or sizes, and say plainly when you're not sure.\n\n" +
    "How Reclaim works: 'safe' categories are regenerable junk; 'review' ones are real files. " +
    "Cleaning moves items to a quarantine the user can undo from until it's emptied (automatically " +
    "after the retention period, or on demand). Point the user to Reclaim's own controls (tick a " +
    "category, press Clean, restore from quarantine) rather than terminal commands.\n\n" +
    `Smart Scan results — ${scan.humanTotal} reclaimable:\n${lines.join("\n")}`
  );
}
