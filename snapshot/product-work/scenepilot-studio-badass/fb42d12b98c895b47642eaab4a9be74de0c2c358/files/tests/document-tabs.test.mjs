import test from "node:test";
import assert from "node:assert/strict";
import { changeDocumentTab, normalizeDocumentTabs } from "../lib/document-tabs.ts";

test("tabs normalize corrupt preferences, remove deleted compositions and deduplicate", () => {
  assert.deepEqual(normalizeDocumentTabs(null, ["a"]), {open:[],pinned:[]});
  assert.deepEqual(normalizeDocumentTabs({open:["a","a","gone",7],pinned:["b","gone"]}, ["a","b"]), {open:["b","a"],pinned:["b"]});
  assert.deepEqual(normalizeDocumentTabs({open:42,pinned:"oops"}, ["a"]), {open:[],pinned:[]});
});
test("closing a tab preserves the composition model, pin protects it and reopening restores it", () => {
  const ids=["a","b"];
  let state=changeDocumentTab({open:[],pinned:[]}, "a", "open");
  state=changeDocumentTab(state, "a", "pin");
  assert.deepEqual(changeDocumentTab(state,"a","close"),state);
  state=changeDocumentTab(state,"a","pin");
  state=changeDocumentTab(state,"a","close");
  assert.deepEqual(state,{open:[],pinned:[]});
  assert.deepEqual(ids,["a","b"]);
  assert.deepEqual(changeDocumentTab(state,"a","open"),{open:["a"],pinned:[]});
});
