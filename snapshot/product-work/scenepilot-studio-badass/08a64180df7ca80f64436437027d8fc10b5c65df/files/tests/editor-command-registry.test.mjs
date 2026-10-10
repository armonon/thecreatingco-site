import assert from "node:assert/strict";
import test from "node:test";
import { buildEditorCommandItems } from "../app/editor-command-registry.ts";

const ids = [
  "new-project", "import-media", "undo", "redo", "copy", "cut", "paste", "duplicate", "delete", "ripple-delete", "split", "play-pause", "stop", "shuttle-reverse", "shuttle-forward", "step-back", "step-forward", "step-back-second", "step-forward-second", "mark-in", "mark-out", "source-insert", "source-overwrite",
  "open-auto", "open-edit", "open-composition", "open-color", "open-audio", "open-deliver", "save-project", "open-disk-project",
  "save-disk-project-as", "import-extension-pack", "export-extension-pack", "queue-master", "generate-alternatives", "tool-select",
  "tool-razor", "tool-slip", "tool-slide", "tool-roll", "tool-fade", "add-marker", "extract-range", "fit-to-fill", "close-gaps",
  "match-frame", "group-selection", "ungroup-selection", "nest-selection", "select-all", "deselect", "replace-edit", "build-multicam",
  "import-captions", "export-captions", "remove-dialogue-silence", "export-edl", "export-fcpxml", "export-otio", "collect-media", "queue-social", "new-composition", "tool-rate", "tool-hand", "tool-zoom",
];

test("unavailable commands cannot execute through search or another invocation surface", () => {
  let invoked = false;
  const actions = Object.fromEntries(ids.map((id) => [id, () => { invoked = true; }]));
  const commands = buildEditorCommandItems(actions, true, { "queue-master": false });
  const queue = commands.find((command) => command.id === "queue-master");
  assert.equal(queue.enabled, false); queue.run(); assert.equal(invoked, false);
});

test("command registry exposes every action once and invokes the bound action", () => {
  const invoked = [];
  const actions = Object.fromEntries(ids.map((id) => [id, () => invoked.push(id)]));
  const commands = buildEditorCommandItems(actions, true);
  assert.equal(commands.length, ids.length);
  assert.equal(new Set(commands.map((command) => command.id)).size, commands.length);
  for (const command of commands) command.run();
  assert.deepEqual(invoked, ids);
});

test("Browser Lite command surface omits desktop-only workspaces and disk actions", () => {
  const actions = Object.fromEntries(ids.map((id) => [id, () => undefined]));
  const lite = buildEditorCommandItems(actions, false);
  const visible = new Set(lite.map((command) => command.id));
  for (const id of ["open-composition", "open-color", "open-audio", "open-deliver", "open-disk-project", "save-disk-project-as", "import-extension-pack", "export-extension-pack"]) {
    assert.equal(visible.has(id), false, `${id} should stay Pro-only`);
  }
  assert.equal(visible.has("open-edit"), true);
  assert.equal(visible.has("queue-master"), true);
  for (const id of ids.filter((id) => id.startsWith("tool-"))) assert.equal(visible.has(id), false, `${id} requires the Pro tool palette`);
});
