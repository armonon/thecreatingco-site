import test from "node:test";
import assert from "node:assert/strict";
import { LAYOUT_PRESETS, contextualWorkspaceLayout, normalizeWorkspaceLayout, fitWorkspaceLayout, readWorkspaceLayouts } from "../lib/workspace-layout.ts";

test("corrupt and obsolete workspace preferences recover without hiding the editor", () => {
  for (const raw of [null, "broken", '{"version":2,"layouts":{"edit":{}}}']) assert.deepEqual(readWorkspaceLayouts(raw), {});
  const layouts = readWorkspaceLayouts(JSON.stringify({ version: 1, layouts: { edit: { left: -999, right: 9000, inspector: "no" }, injected: {} } }));
  assert.deepEqual(Object.keys(layouts), ["edit"]);
  assert.equal(layouts.edit.left, 190); assert.equal(layouts.edit.right, 640); assert.equal(layouts.edit.inspector, true);
  assert.deepEqual(normalizeWorkspaceLayout({ left: NaN, right: Infinity }), LAYOUT_PRESETS.balanced);
});
test("Essentials derives inspector visibility without overwriting saved preferences", () => {
  const preference = { ...LAYOUT_PRESETS.balanced };
  assert.equal(contextualWorkspaceLayout(preference, "edit", false).inspector, false);
  assert.equal(contextualWorkspaceLayout(preference, "edit", true).inspector, true);
  assert.equal(preference.inspector, true);
  for (const workspace of ["composition", "color", "audio"]) assert.equal(contextualWorkspaceLayout(preference, workspace, false).inspector, true);
  assert.equal(contextualWorkspaceLayout({ ...preference, detail: "full" }, "edit", false).inspector, true);
  assert.equal(contextualWorkspaceLayout({ ...preference, inspector: false }, "edit", true).inspector, false);
});
test("legacy preferences migrate to Essentials while full-control choices persist", () => {
  const legacy = readWorkspaceLayouts(JSON.stringify({ version: 1, layouts: { edit: { left: 280, inspector: true } } }));
  assert.equal(legacy.edit.detail, "essential"); assert.equal(legacy.edit.left, 280);
  assert.equal(normalizeWorkspaceLayout({ detail: "corrupt" }).detail, "essential");
  assert.equal(readWorkspaceLayouts(JSON.stringify({ version: 1, layouts: { edit: { ...legacy.edit, detail: "full" } } })).edit.detail, "full");
});
test("saved workspace sizing survives round trip while smaller screens retain usable viewer space", () => {
  const layouts = { edit: LAYOUT_PRESETS.editing, composition: LAYOUT_PRESETS.compositing };
  assert.deepEqual(readWorkspaceLayouts(JSON.stringify({ version: 1, layouts })), layouts);
  for (const width of [981, 1280, 1440, 1920]) for (const height of [800, 900, 1080]) {
    const fitted = fitWorkspaceLayout({ ...LAYOUT_PRESETS.compositing, left: 460, right: 640, bottom: 600 }, width, height);
    assert.ok(width - fitted.left - fitted.right - 24 >= 440);
    assert.ok(height - fitted.bottom >= 410);
  }
});
test("unused-track visibility round-trips without changing project or inspector state", () => {
  const layout = { ...LAYOUT_PRESETS.balanced, emptyTracks: true };
  assert.deepEqual(readWorkspaceLayouts(JSON.stringify({ version:1, layouts:{edit:layout} })).edit, layout);
  assert.equal(contextualWorkspaceLayout(layout, "edit", false).emptyTracks, true);
  assert.equal(normalizeWorkspaceLayout({ emptyTracks:"invalid" }).emptyTracks, undefined);
  const layouts = { auto:{...layout,detail:"full"}, deliver:{...layout,detail:"full"} };
  assert.deepEqual(readWorkspaceLayouts(JSON.stringify({version:1,layouts})),layouts);
});
