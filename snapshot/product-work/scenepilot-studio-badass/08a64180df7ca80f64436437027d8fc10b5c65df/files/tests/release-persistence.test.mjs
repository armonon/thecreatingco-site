import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeAtomicFile } from "../electron/atomic-file.js";
import { readProjectSettings, serializeProjectSettings } from "../lib/project-settings.ts";
import { createDocumentRevision, documentChanged } from "../lib/document-revision.ts";
import { parseCutFile, coerceEffectSettings, DEFAULT_EFFECTS } from "../lib/project-store.ts";
import { isTrustedEditorUrl, linkedMediaResponse, mapConcurrent } from "../electron/desktop-io.js";
import { requireReleaseSigning } from "../scripts/require-release-signing.mjs";

test("native IPC trusts only its exact editor and probes at most four sources", async () => {
  assert.equal(isTrustedEditorUrl("file:///app/index.html", "/app/index.html"), true);
  for (const url of ["file:///private/other.html", "https://evil.example", "javascript:alert(1)", "malformed"]) assert.equal(isTrustedEditorUrl(url, "/app/index.html"), false);
  assert.equal(isTrustedEditorUrl("http://localhost:5173/", "/app/index.html", "http://localhost:5173/"), true);
  let active = 0, max = 0;
  const result = await mapConcurrent(Array.from({ length: 100 }, (_, i) => i), async (i) => { max = Math.max(max, ++active); await new Promise((r) => setTimeout(r, 1)); active--; return i * 2; });
  assert.equal(max, 4); assert.equal(result[99], 198);
});
test("public release refuses ad-hoc signing or absent notarization credentials", () => {
  assert.throws(() => requireReleaseSigning({}), /Developer ID/);
  assert.throws(() => requireReleaseSigning({ CSC_NAME: "Developer ID Application: QA" }), /notarization/);
  assert.equal(requireReleaseSigning({ CSC_NAME: "Developer ID Application: QA", APPLE_ID: "qa", APPLE_APP_SPECIFIC_PASSWORD: "test-only", APPLE_TEAM_ID: "qa" }), "Developer ID Application: QA");
});

test("linked native media streams ranges to the local editor, not remote origins", async () => {
  let calls = 0;
  const fetchFile = async (url, options) => {
    calls++; assert.equal(url, "file:///tmp/QA%20clip.mp4"); assert.equal(options.headers.get("Range"), "bytes=1-3");
    return new Response(new Uint8Array([1, 2, 3]), { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 1-3/4" } });
  };
  const request = new Request("scenepilot-media://source/test", { headers: { Origin: "null", Range: "bytes=1-3" } });
  const result = await linkedMediaResponse(request, "/tmp/QA clip.mp4", fetchFile);
  assert.equal(result.status, 206); assert.equal(result.headers.get("Access-Control-Allow-Origin"), "null");
  assert.equal(result.headers.get("Content-Type"), "video/mp4"); assert.deepEqual([...new Uint8Array(await result.arrayBuffer())], [1, 2, 3]);
  const denied = await linkedMediaResponse(new Request(request, { headers: { Origin: "https://evil.example" } }), "/tmp/QA clip.mp4", fetchFile);
  assert.equal(denied.status, 403); assert.equal(calls, 1);
});

test("portrait/custom output and exact LUT samples survive disk JSON round trip", () => {
  const settings = { ...readProjectSettings({}), aspect: "custom", customSize: { width: 1080, height: 1350 }, sourceDims: { w: 3840, h: 2160 }, exportFrameRate: 25, exportMaxDimension: 3840, exportFormat: "webm-vp9-alpha", colorCurve: "none", lut3dMix: .7, lut3dSource: { name: "QA", lut: { title: "QA", dimensions: 1, size: 2, table: new Float64Array([0,.1,.2,.8,.9,1]), domainMin: [0,0,0], domainMax: [1,1,1] } } };
  const cut = parseCutFile(JSON.stringify({ format: "scenepilot-cut", version: 2, settings: serializeProjectSettings(settings) }));
  assert.deepEqual(readProjectSettings(cut.settings), settings);
  assert.equal(readProjectSettings({ aspect: "9:16" }).aspect, "9:16");
  assert.equal(readProjectSettings({ aspect: "__proto__", exportFrameRate: 1000 }).aspect, "source");
  assert.equal(readProjectSettings({ lut3dSource: { name: "bad", lut: { size: 256, dimensions: 3, table: [0] } } }).lut3dSource, null);
});

test("malformed or future projects fail before any state can be applied", () => {
  for (const data of [null, [], { format: "scenepilot-cut", version: 999 }, { format: "scenepilot-cut", assets: [null] }, { format: "scenepilot-cut", compositions: [{ id: "broken" }] }, { format: "scenepilot-cut", proState: { audioClips: [null] } }]) assert.throws(() => parseCutFile(JSON.stringify(data)), /project|Project|composition|ScenePilot/);
});

test("unknown effect preset names cannot crash renderer lookups", () => {
  for (const key of ["lookPreset", "punchPreset", "shakePreset", "strobePreset", "stutterPreset", "speedPreset", "transitionType", "montagePace", "echoPreset"]) {
    for (const value of ["__proto__", "constructor", "missing-preset"]) assert.equal(coerceEffectSettings({ [key]: value })[key], DEFAULT_EFFECTS[key]);
  }
  for (const composition of [{ id: "bad", layers: [], tracks: [null] }, { id: "bad", layers: [{ id: "layer", kind: "media", transform: null }] }]) assert.throws(() => parseCutFile(JSON.stringify({ format: "scenepilot-cut", compositions: [composition] })), /composition/);
});

test("a save finishing after another edit cannot mark that edit clean", () => {
  const revision = createDocumentRevision();
  assert.equal(revision.dirty(), false);
  revision.changed(); const saved = revision.capture(); revision.changed();
  revision.saved(saved); assert.equal(revision.dirty(), true);
  revision.saved(revision.capture()); assert.equal(revision.dirty(), false);
  assert.equal(documentChanged({ videoClips: saved, selectedBaseCutId: "a" }, { videoClips: saved, selectedBaseCutId: "b" }), false);
  assert.equal(documentChanged({ lut3dMix: .5 }, { lut3dMix: .7 }), true);
});

test("100 concurrent saves are ordered, atomic, and leave no partial files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "scenepilot-atomic-"));
  try {
    const target = path.join(directory, "project.json");
    await Promise.all(Array.from({ length: 100 }, (_, n) => writeAtomicFile(target, JSON.stringify({ n, data: "x".repeat(5000) }))));
    assert.equal(JSON.parse(await readFile(target, "utf8")).n, 99);
    assert.deepEqual(await readdir(directory), ["project.json"]);
    const blocked = path.join(directory, "directory.json"); await mkdir(blocked);
    await assert.rejects(writeAtomicFile(blocked, "cannot replace directory"));
    assert.deepEqual((await readdir(directory)).sort(), ["directory.json", "project.json"]);
    await writeAtomicFile(target, "recovered"); assert.equal(await readFile(target, "utf8"), "recovered");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
