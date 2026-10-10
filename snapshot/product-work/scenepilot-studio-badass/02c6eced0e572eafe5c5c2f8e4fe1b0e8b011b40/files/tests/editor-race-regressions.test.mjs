import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
function handler(name, env) {
  const start = source.indexOf(`  const ${name} =`);
  assert.ok(start > 0);
  const end = source.indexOf("\n  };", start) + 5;
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(env), `${js}; return ${name};`)(...Object.values(env));
}

test("overlapping imports retain both batches and intervening media edits", async () => {
  const assetsRef = { current: [] }, releases = {}, revoked = [];
  const env = { assets: [], assetsRef, analyzing: false, rendering: false, isPro: true, nativeMediaAvailable: false,
    COLORS: ["red"], MAIN_SOURCE_ID: "__main__", renderAnalysis: null,
    URL: { createObjectURL: f => f.name, revokeObjectURL: url => revoked.push(url) }, desktopMediaBridge: () => null,
    probeVideoDuration: async () => 1, decodeWaveformPeaks: async () => [],
    fingerprintFile: f => new Promise(resolve => { releases[f.name] = () => resolve(f.name); }),
    claimOfflineMediaLinks: () => new Map(), loadMainMedia() {}, setStatus() {},
    setAssets: next => { assetsRef.current = next; }, setAnalysis() {}, setSavedRenderAnalysis() {}, setProjectIntelligence() {} };
  const add = handler("addAssets", env);
  const a = add([{ name: "a.png", type: "image/png" }]);
  const b = add([{ name: "b.png", type: "image/png" }]);
  await new Promise(resolve => setImmediate(resolve));
  releases["b.png"](); await b;
  assetsRef.current = assetsRef.current.map(asset => ({ ...asset, favorite: true }));
  releases["a.png"](); await a;
  assert.deepEqual(assetsRef.current.map(asset => asset.id), ["b.png", "a.png"]);
  assert.equal(assetsRef.current[0].favorite, true);
  const duplicate = add([{ name: "b.png", type: "image/png" }]);
  await new Promise(resolve => setImmediate(resolve)); releases["b.png"](); await duplicate;
  assert.equal(assetsRef.current.length, 2); assert.deepEqual(revoked, ["b.png"]);
});

test("raise/lower protects the selected track and locked swap target", () => {
  for (const lockedIndex of [0, 1]) {
    const tracks = [{ id: "a", name: "A" }, { id: "b", name: "B" }]; tracks[lockedIndex].locked = true;
    let writes = 0, checkpoints = 0, status = "";
    handler("moveClipTrack", { selectedTrack: tracks[0], clipTracks: tracks, checkpoint() { checkpoints++; }, setClipTracks() { writes++; }, setStatus: value => { status = value; } })("up");
    assert.equal(writes, 0); assert.equal(checkpoints, 0); assert.match(status, /Unlock/);
  }
});

test("composition flex viewport overrides inherited centering to prevent Fit collapse", () => {
  const css = fs.readFileSync(new URL("../app/studio-workspace.css", import.meta.url), "utf8");
  assert.match(css, /\.composition-stage-shell:has\(\.composition-view-viewport\)\s*\{[^}]*align-items:stretch/);
});
