import { suite, test, assert, assertEqual } from "./harness";
import { CleanCategory, duplicateSelectionKeepsOriginal, mergeProgress, scanContext, shortPath } from "../src/operator/diskCleaner";

const cat = (id: string, sizeBytes: number): CleanCategory => ({
  id,
  name: id,
  description: "",
  safety: "safe",
  root: "/Users/me",
  sizeBytes,
  humanSize: "",
  itemCount: 1,
  entries: [],
});

suite("disk cleaner — live scan merge");

test("streamed categories accumulate, largest first, with a running total", () => {
  let scan = mergeProgress(null, [cat("logs", 100)]);
  scan = mergeProgress(scan, [cat("caches", 500), cat("trash", 50)]);
  assertEqual(scan.categories.map((c) => c.id).join(","), "caches,logs,trash");
  assertEqual(scan.totalReclaimable, 650);
});

test("a category reported twice is replaced, not double-counted", () => {
  let scan = mergeProgress(null, [cat("caches", 500)]);
  scan = mergeProgress(scan, [cat("caches", 800)]);
  assertEqual(scan.categories.length, 1);
  assertEqual(scan.totalReclaimable, 800);
});

test("scan flags from the previous state are preserved", () => {
  const scan = mergeProgress(
    { categories: [], totalReclaimable: 0, humanTotal: "0 B", needsFullDiskAccess: true },
    [cat("logs", 1)],
  );
  assert(scan.needsFullDiskAccess === true, "keeps needsFullDiskAccess");
});

suite("disk cleaner — display");

test("home paths shorten to ~", () => {
  assertEqual(shortPath("/Users/lillypad/Documents/a"), "~/Documents/a");
  assertEqual(shortPath("/Applications/Xcode.app"), "/Applications/Xcode.app");
});

suite("disk cleaner — scan chat grounding");

test("the chat prompt names each category, its size, safety and top paths", () => {
  const scan = mergeProgress(null, [
    { ...cat("rust-targets", 2_000_000_000), name: "Rust build output", safety: "review", humanSize: "2.0 GB",
      entries: [{ path: "/Users/me/code/app/target", sizeBytes: 2_000_000_000 }] },
    { ...cat("logs", 1_000), name: "Logs", humanSize: "1 KB" },
  ]);
  const prompt = scanContext(scan);
  assert(prompt.includes("Rust build output — 2.0 GB"), "category + size");
  assert(prompt.includes("review:"), "safety label");
  assert(prompt.includes("app/target"), "top entry path");
  assert(prompt.includes("Logs — 1 KB"), "every category listed");
  assert(prompt.includes("quarantine"), "explains the undo model");
});

test("the chat prompt lists at most six entries per category", () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({ path: `/Users/me/f${i}`, sizeBytes: 10 - i }));
  const prompt = scanContext(mergeProgress(null, [{ ...cat("caches", 55), entries }]));
  assert(prompt.includes("f5"), "sixth entry kept");
  assert(!prompt.includes("f6"), "seventh entry dropped");
});


suite("disk cleaner — preserve duplicate originals");
test("duplicate cleanup refuses selecting every copy, including mixed groups", () => {
  const group = { sizeBytes: 10, humanSize: "10 B", count: 2, reclaimable: 10, paths: ["/a", "/b"] };
  assert(duplicateSelectionKeepsOriginal([group], new Set(["/b"])), "one original remains");
  assert(!duplicateSelectionKeepsOriginal([group], new Set(["/a", "/b"])), "all copies refused");
  assert(!duplicateSelectionKeepsOriginal([group, { ...group, paths: ["/c", "/d"] }], new Set(["/b", "/c", "/d"])), "every group needs an original");
});
