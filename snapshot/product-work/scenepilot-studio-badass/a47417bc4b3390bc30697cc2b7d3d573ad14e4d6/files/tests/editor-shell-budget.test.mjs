import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("editor shell stays below its decomposition budget", async () => {
  const page = new URL("../app/page.tsx", import.meta.url);
  const size = (await stat(page)).size;
  assert.ok(size <= 500_000, `app/page.tsx is ${size} bytes; extract another responsibility before exceeding 500000`);
  const source = await readFile(page, "utf8");
  for (const boundary of ["./composition-coordinate", "./composition-media-layer-preview", "./media-file-utils", "./edit-snapshot", "./pro-media-workflows", "./video-delivery", "./auto-director-workspace", "./use-editor-keyboard-shortcuts", "./sequence-inspector", "./use-editor-edit-actions", "./use-program-transport", "./use-source-transport"]) {
    assert.match(source, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(source, /function CompositionMediaLayerPreview/);
  assert.doesNotMatch(source, /function createSilentWavFile/);
});
