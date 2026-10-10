import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CleanCategory,
  cleanCategory,
  cleanPaths,
  DuplicateReport,
  duplicateSelectionKeepsOriginal,
  findDuplicates,
  humanSize,
  mergeProgress,
  restoreTrash,
  revealPath,
  shortPath,
  smartScan,
  SmartScan,
  TreeItem,
  usageTree,
  UsageTree,
} from "../operator/diskCleaner";
import { openSystemSettings } from "../operator/client";
import { AccessCard } from "./clean/AccessCard";
import { AskBar } from "./clean/AskBar";
import { ScanChat } from "./clean/ScanChat";
import { QuarantineCard } from "./clean/QuarantineCard";
import { StorageView } from "./clean/StorageView";
import { TipsView } from "./clean/TipsView";
import {
  ArrowUpRightIcon,
  BulbIcon,
  CheckIcon,
  ChevronIcon,
  CopyIcon,
  FileIcon,
  FolderIcon,
  LayersIcon,
  LockIcon,
  PieIcon,
  ShieldIcon,
  SparkIcon,
  TrashIcon,
  UndoIcon,
} from "./icons";

type View = "scan" | "storage" | "space" | "dupes" | "tips";

// Segment colors: regenerable ("safe") junk in brand-family cools, real files
// ("review") in warm ambers — so the bar itself communicates risk at a glance.
const SAFE_COLORS = ["#4a6cf7", "#7c5cff", "#10b981", "#0ea5e9", "#6366f1", "#14b8a6"];
const REVIEW_COLORS = ["#f59e0b", "#f97316", "#eab308"];

function colorMap(categories: CleanCategory[]): Record<string, string> {
  let s = 0;
  let r = 0;
  const map: Record<string, string> = {};
  for (const c of categories) {
    map[c.id] =
      c.safety === "safe"
        ? SAFE_COLORS[s++ % SAFE_COLORS.length]
        : REVIEW_COLORS[r++ % REVIEW_COLORS.length];
  }
  return map;
}

function ReclaimBar({
  categories,
  total,
  colors,
  selected,
}: {
  categories: CleanCategory[];
  total: number;
  colors: Record<string, string>;
  selected: Set<string>;
}) {
  if (total <= 0) return null;
  return (
    <div
      className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100"
      role="img"
      aria-label="Reclaimable space by category"
    >
      {categories.map((c) => (
        <div
          key={c.id}
          title={`${c.name} · ${c.humanSize}`}
          className="h-full transition-opacity duration-300 first:rounded-l-full last:rounded-r-full"
          style={{
            width: `${Math.max(0.8, (c.sizeBytes / total) * 100)}%`,
            background: colors[c.id],
            opacity: selected.has(c.id) ? 1 : 0.25,
          }}
        />
      ))}
    </div>
  );
}

const card = "rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-soft backdrop-blur";

const VIEWS: { id: View; label: string; icon: typeof SparkIcon }[] = [
  { id: "scan", label: "Smart Scan", icon: SparkIcon },
  { id: "storage", label: "Storage", icon: PieIcon },
  { id: "space", label: "Space map", icon: LayersIcon },
  { id: "dupes", label: "Duplicates", icon: CopyIcon },
  { id: "tips", label: "More savings", icon: BulbIcon },
];

export function DiskCleanerPanel() {
  const [view, setView] = useState<View>("scan");
  // Views stay mounted once opened, so switching tabs never throws away a scan.
  const [visited, setVisited] = useState<Set<View>>(new Set(["scan"]));
  // The app is a dedicated, full-screen cleaner: every list is always shown in full.
  const expanded = true;
  const [spaceStart, setSpaceStart] = useState<{ path?: string; n: number }>({ n: 0 });
  const [quarantineKey, setQuarantineKey] = useState(0);

  const go = useCallback((v: View) => {
    setView(v);
    setVisited((prev) => (prev.has(v) ? prev : new Set(prev).add(v)));
  }, []);

  const explore = useCallback(
    (path: string) => {
      setSpaceStart((s) => ({ path, n: s.n + 1 }));
      go("space");
    },
    [go],
  );

  const cleaned = useCallback(() => setQuarantineKey((k) => k + 1), []);

  return (
    <div>
      <div className="space-y-4">
        <AccessCard />
        <AskBar expanded={expanded} onCleaned={cleaned} />
        <QuarantineCard refreshKey={quarantineKey} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/70 bg-white/70 p-1.5 shadow-soft backdrop-blur">
            {VIEWS.map((v) => {
              const on = v.id === view;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => go(v.id)}
                  aria-pressed={on}
                  className={
                    "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 " +
                    (on ? "bg-brand text-white shadow-lift" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        <div hidden={view !== "scan"}>
          <SmartScanView expanded={expanded} onCleaned={cleaned} />
        </div>
        {visited.has("storage") && (
          <div hidden={view !== "storage"}>
            <StorageView expanded={expanded} onExplore={explore} />
          </div>
        )}
        {visited.has("space") && (
          <div hidden={view !== "space"}>
            <SpaceView expanded={expanded} start={spaceStart} />
          </div>
        )}
        {visited.has("dupes") && (
          <div hidden={view !== "dupes"}>
            <DuplicatesView expanded={expanded} onCleaned={cleaned} />
          </div>
        )}
        {visited.has("tips") && (
          <div hidden={view !== "tips"}>
            <TipsView />
          </div>
        )}
      </div>
    </div>
  );
}


/* ───────────────────────────────────────────────────────── Smart Scan ── */

function SmartScanView({ expanded, onCleaned }: { expanded: boolean; onCleaned: () => void }) {
  const [scan, setScan] = useState<SmartScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"idle" | "cleaning" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [cleaned, setCleaned] = useState<{ freed: number; trashIds: string[] } | null>(null);
  // "Explain with AI" opens a chat grounded in this scan, for follow-up questions.
  const [chatOpen, setChatOpen] = useState(false);
  const [checks, setChecks] = useState<{ done: number; total: number } | null>(null);
  // Once the user changes the selection, streaming results stop auto-selecting.
  const touched = useRef(false);

  const run = useCallback(async () => {
    setScanning(true);
    setError("");
    setCleaned(null);
    setPhase("idle");
    setChatOpen(false); // a new scan means new context
    setChecks(null);
    touched.current = false;
    setScan({ categories: [], totalReclaimable: 0, humanTotal: humanSize(0) });
    setSelected(new Set());
    const autoSelect = (cats: CleanCategory[]) => {
      if (touched.current) return;
      const safe = cats.filter((c) => c.safety === "safe").map((c) => c.id);
      if (safe.length) setSelected((prev) => new Set([...prev, ...safe]));
    };
    try {
      const res = await smartScan((p) => {
        setChecks((c) => ({ done: (c?.done ?? 0) + 1, total: p.totalChecks }));
        setScan((prev) => mergeProgress(prev, p.categories));
        autoSelect(p.categories);
      });
      setScan(res); // the final result is authoritative
      if (!touched.current) {
        // Pre-select the truly-safe, regenerable categories.
        setSelected(new Set(res.categories.filter((c) => c.safety === "safe").map((c) => c.id)));
      }
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setPhase("error");
    } finally {
      setScanning(false);
    }
  }, []);

  const toggle = useCallback((id: string) => {
    touched.current = true;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const chosen = useMemo(
    () => (scan?.categories ?? []).filter((c) => selected.has(c.id)),
    [scan, selected],
  );
  const chosenBytes = useMemo(() => chosen.reduce((s, c) => s + c.sizeBytes, 0), [chosen]);
  const colors = useMemo(() => colorMap(scan?.categories ?? []), [scan]);

  const clean = useCallback(async () => {
    if (chosen.length === 0) return;
    setPhase("cleaning");
    try {
      const trashIds: string[] = [];
      let freed = 0;
      for (const cat of chosen) {
        const res = await cleanCategory(cat, cat.entries.map((e) => e.path));
        trashIds.push(res.trashId);
        freed += cat.sizeBytes;
      }
      setCleaned({ freed, trashIds });
      setPhase("done");
      onCleaned();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setPhase("error");
    }
  }, [chosen, onCleaned]);

  const undo = useCallback(async () => {
    if (!cleaned) return;
    for (const id of cleaned.trashIds) await restoreTrash(id).catch(() => undefined);
    setCleaned(null);
    setPhase("idle");
    onCleaned();
    void run();
  }, [cleaned, run, onCleaned]);


  if (!scan && phase !== "error") {
    return (
      <div className={`${card} text-center`}>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-lift">
          <SparkIcon className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Reclaim disk space, safely</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Scans caches, logs, trash, build junk, old installers, and large forgotten files — then
          moves what you choose to a <b className="text-slate-700">quarantine</b> you can undo from.
        </p>
        <button
          type="button"
          onClick={() => void run()}
          disabled={scanning}
          className="mt-5 rounded-2xl bg-brand px-7 py-3 text-sm font-semibold text-white shadow-lift transition hover:bg-brand-600 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
        >
          {scanning ? "Scanning your disk…" : "Smart Scan"}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldIcon className="h-3.5 w-3.5 text-mint" /> Nothing is deleted until you empty the quarantine.
        </p>
      </div>
    );
  }

  return (
    <>
      {phase === "error" && (
        <div className="animate-pop-in rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {scan && (
        <div className={`${card} animate-pop-in`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Reclaimable
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-900">
                {scan.humanTotal}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                across {scan.categories.length} categories
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChatOpen((o) => !o)}
                disabled={scanning || scan.categories.length === 0}
                aria-expanded={chatOpen}
                className={
                  "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 " +
                  (chatOpen
                    ? "border-brand/40 bg-brand/[0.06] text-brand"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand/40 hover:text-brand")
                }
              >
                <SparkIcon className="h-4 w-4" /> Explain with AI
              </button>
              <button
                type="button"
                onClick={() => void run()}
                disabled={scanning}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-500 transition hover:bg-slate-50"
              >
                Rescan
              </button>
            </div>
          </div>

          <ReclaimBar
            categories={scan.categories}
            total={scan.totalReclaimable}
            colors={colors}
            selected={selected}
          />

          {scanning && (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${checks ? (checks.done / checks.total) * 100 : 4}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Scanning — {checks ? `${checks.done} of ${checks.total} checks` : "starting"} · results appear as they're found
              </p>
            </div>
          )}
          {!scanning && scan.needsFullDiskAccess && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/15 bg-brand/[0.04] px-3.5 py-2.5 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <LockIcon className="h-3.5 w-3.5 text-brand" /> Grant Full Disk Access to also clean the Trash, Mail
                attachment copies and iPhone backups.
              </span>
              <button
                type="button"
                onClick={() => void openSystemSettings("full-disk-access")}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium hover:text-brand"
              >
                Open Settings
              </button>
            </div>
          )}
          {!scanning && (scan.skippedChecks ?? 0) > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              {scan.skippedChecks} check(s) took too long (a folder was blocked by macOS) and were skipped.
            </p>
          )}

          {chatOpen && !scanning && <ScanChat scan={scan} onClose={() => setChatOpen(false)} />}

          {phase === "done" && cleaned ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mint/30 bg-mint/10 p-4 text-sm font-medium text-emerald-700">
              <span className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4" /> Moved {humanSize(cleaned.freed)} to quarantine — it's freed
                when the quarantine empties.
              </span>
              <button
                type="button"
                onClick={() => void undo()}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <UndoIcon className="h-3.5 w-3.5" /> Undo
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {scan.categories.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    color={colors[c.id]}
                    checked={selected.has(c.id)}
                    onToggle={() => toggle(c.id)}
                    expanded={expanded}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-3">
                <span className="text-sm text-slate-500">
                  {chosen.length} selected · <b className="text-slate-700">{humanSize(chosenBytes)}</b>
                </span>
                <button
                  type="button"
                  onClick={() => void clean()}
                  disabled={chosen.length === 0 || phase === "cleaning" || scanning}
                  className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition hover:bg-brand-600 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
                >
                  <TrashIcon className="h-4 w-4" />
                  {phase === "cleaning" ? "Cleaning…" : `Clean ${humanSize(chosenBytes)}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function CategoryRow({
  category,
  color,
  checked,
  onToggle,
  expanded,
}: {
  category: CleanCategory;
  color: string;
  checked: boolean;
  onToggle: () => void;
  expanded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const safe = category.safety === "safe";
  return (
    <div
      className={
        "rounded-2xl border transition " +
        (checked ? "border-brand/30 bg-brand/[0.03]" : "border-slate-200 bg-white")
      }
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 accent-brand"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: color }}
              aria-hidden
            />
            <span className="truncate text-sm font-semibold text-slate-800">{category.name}</span>
            <span
              className={
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                (safe ? "bg-mint/10 text-emerald-600" : "bg-amber-50 text-amber-700")
              }
            >
              {safe ? "safe" : "review"}
            </span>
          </div>
          <div className="truncate text-xs text-slate-400">{category.description}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-700">{category.humanSize}</div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand"
          >
            {category.itemCount} items
            <ChevronIcon
              className={"h-3.5 w-3.5 transition-transform duration-200 " + (open ? "rotate-180" : "")}
            />
          </button>
        </div>
      </div>
      {open && (
        <div
          className={
            "overflow-y-auto border-t border-slate-100 px-4 py-2 " + (expanded ? "max-h-[28rem]" : "max-h-56")
          }
        >
          {(expanded ? category.entries : category.entries.slice(0, 200)).map((e) => (
            <div key={e.path} className="flex items-center gap-2 py-1 text-xs">
              <span className="flex-1 truncate text-slate-500" title={e.path}>
                {e.path.split("/").slice(-2).join("/")}
              </span>
              <span className="text-slate-400">{humanSize(e.sizeBytes)}</span>
              <button
                type="button"
                onClick={() => void revealPath(e.path)}
                className="text-slate-300 hover:text-brand"
                title="Reveal in Finder"
              >
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── Space ── */

function SpaceView({ expanded, start }: { expanded: boolean; start: { path?: string; n: number } }) {
  const [tree, setTree] = useState<UsageTree | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (path?: string) => {
    setLoading(true);
    setError("");
    try {
      setTree(await usageTree(path, expanded ? 2000 : 200));
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [expanded]);

  // Opening a group from Storage (or the first visit) starts the map there.
  useEffect(() => {
    setStack(start.path ? [start.path] : []);
    void load(start.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.n]);

  const enter = useCallback(
    (item: TreeItem) => {
      if (!item.isDirectory) return;
      setStack((s) => [...s, item.path]);
      void load(item.path);
    },
    [load],
  );

  const up = useCallback(() => {
    setStack((s) => {
      const next = s.slice(0, -1);
      void load(next[next.length - 1]);
      return next;
    });
  }, [load]);

  const max = tree?.items[0]?.sizeBytes ?? 1;

  return (
    <div className={card}>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={up}
          disabled={stack.length === 0}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        >
          ← Up
        </button>
        <FolderIcon className="h-4 w-4 text-slate-400" />
        <span className="truncate text-sm text-slate-600" title={tree?.path}>
          {tree ? shortPath(tree.path) : "…"}
        </span>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="py-8 text-center text-sm text-slate-400">Measuring folder sizes…</div>}

      {!loading && tree && (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {tree.items.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-400">This folder is empty.</div>
          )}
          {tree.items.map((it) => (
            <div key={it.path} className="group relative flex items-center gap-3 px-4 py-2.5">
              <div
                className="absolute inset-y-0 left-0 bg-brand/[0.06]"
                style={{ width: `${Math.max(2, (it.sizeBytes / max) * 100)}%` }}
              />
              <button
                type="button"
                onClick={() => enter(it)}
                disabled={!it.isDirectory}
                className={
                  "relative z-10 flex min-w-0 flex-1 items-center gap-2 text-left text-sm " +
                  (it.isDirectory ? "font-medium text-slate-700 hover:text-brand" : "text-slate-600")
                }
                title={it.path}
              >
                {it.isDirectory ? (
                  <FolderIcon className="h-4 w-4 shrink-0 text-brand/70" />
                ) : (
                  <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span className="truncate">{it.name || it.path}</span>
              </button>
              <span className="relative z-10 text-sm font-semibold text-slate-600">{it.humanSize}</span>
              <button
                type="button"
                onClick={() => void revealPath(it.path)}
                className="relative z-10 text-slate-300 hover:text-brand"
                title="Reveal in Finder"
              >
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────── Duplicates ── */

const DUPE_ROOTS = ["~/Downloads", "~/Desktop", "~/Documents", "~/Pictures", "~/Movies"];

function DuplicatesView({ expanded, onCleaned }: { expanded: boolean; onCleaned: () => void }) {
  const [report, setReport] = useState<DuplicateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"idle" | "cleaning" | "done">("idle");
  const [outcome, setOutcome] = useState<{ moved: number; skipped: number } | null>(null);

  const find = useCallback(async () => {
    setLoading(true);
    setReport(null);
    setRemove(new Set());
    setError("");
    setPhase("idle");
    try {
      const res = await findDuplicates(DUPE_ROOTS);
      setReport(res);
      // Default: keep the first of each set, mark the rest for removal.
      const rm = new Set<string>();
      for (const g of res.groups) g.paths.slice(1).forEach((p) => rm.add(p));
      setRemove(rm);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback((p: string) => {
    setRemove((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const selectedBytes = useMemo(() => {
    if (!report) return 0;
    let total = 0;
    for (const g of report.groups) for (const p of g.paths) if (remove.has(p)) total += g.sizeBytes;
    return total;
  }, [report, remove]);

  const keepsOriginal = !report || duplicateSelectionKeepsOriginal(report.groups, remove);

  const clean = useCallback(async () => {
    if (loading || remove.size === 0 || !report) return;
    if (!duplicateSelectionKeepsOriginal(report.groups, remove)) {
      setError("Keep at least one file in each duplicate group.");
      return;
    }
    setError("");
    setPhase("cleaning");
    try {
      const res = await cleanPaths([...remove]);
      onCleaned();
      setOutcome({ moved: res.moved, skipped: res.skipped.length });
      setPhase("done");
      // A partial move is not a full success. Discard stale analysis, not files;
      // the quarantine card retains completed moves and a rescan reviews skips.
      setReport(null);
      setRemove(new Set());
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setPhase("idle");
    }
  }, [loading, remove, report, onCleaned]);

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-700">Find duplicate files</div>
          <div className="text-xs text-slate-400">
            Compares full contents in Downloads, Desktop, Documents, Pictures and Movies. Includes Mac extended attributes. Files below 1 MiB, symbolic/hard links, unreadable/changing files and metadata above 16 MiB are not compared. Review before quarantining; keep one copy.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void find()}
          disabled={loading || phase === "cleaning"}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Find duplicates"}
        </button>
      </div>

      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {phase === "done" && outcome && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-mint/30 bg-mint/10 p-4 text-sm font-medium text-emerald-700">
          <CheckIcon className="h-4 w-4" /> Moved {outcome.moved} item(s) to quarantine; skipped {outcome.skipped}. Scan again to review remaining files. Quarantine does not free space until emptied; restore from the quarantine card.
        </div>
      )}

      {report && (
        <>
          {report.groups.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
              No duplicates found. Nice and tidy.
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {(expanded ? report.groups : report.groups.slice(0, 100)).map((g, gi) => (
                  <div key={gi} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-1.5 text-xs font-semibold text-slate-500">
                      {g.count} copies · {g.humanSize} each ·{" "}
                      <span className="text-brand">{humanSize(g.reclaimable)} reclaimable</span>
                    </div>
                    {g.paths.map((p, pi) => (
                      <label key={p} className="flex items-center gap-2 py-1 text-xs">
                        <input
                          type="checkbox"
                          disabled={loading || phase === "cleaning"}
                          checked={remove.has(p)}
                          onChange={() => toggle(p)}
                          className="h-3.5 w-3.5 accent-brand"
                        />
                        <span
                          className={"flex-1 truncate " + (pi === 0 ? "text-slate-400" : "text-slate-600")}
                          title={p}
                        >
                          {p.replace(/^.*\/(?=[^/]+\/[^/]+$)/, "…/")}
                        </span>
                        {pi === 0 && !remove.has(p) && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                            keep
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-3">
                <span className="text-sm text-slate-500">
                  {remove.size} to remove · <b className="text-slate-700">{humanSize(selectedBytes)}</b>
                  {!keepsOriginal && <span className="block text-red-600">Keep at least one file in each group.</span>}
                </span>
                <button
                  type="button"
                  onClick={() => void clean()}
                  disabled={loading || remove.size === 0 || phase === "cleaning" || !keepsOriginal}
                  className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition hover:bg-brand-600 disabled:opacity-40"
                >
                  <TrashIcon className="h-4 w-4" />
                  {phase === "cleaning" ? "Cleaning…" : "Trash duplicates"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
