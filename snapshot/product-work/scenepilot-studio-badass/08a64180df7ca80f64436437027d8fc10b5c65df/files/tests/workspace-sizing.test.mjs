import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../app/workspace-sizing.css");

test("document rows accommodate grouped buttons in normal and focused workspaces", () => {
  assert.equal((css.match(/minmax\(44px,max-content\)/g) ?? []).length, 3);
  assert.match(css, /\.editor-document-tabs\s*\{\s*min-height:44px;/);
  assert.match(css, /data-workspace-focus="viewer"/);
  assert.match(css, /data-workspace-focus="timeline"/);
  assert.equal((css.match(/:not\(\.mode-deliver\)/g) ?? []).length, 3);
  assert.match(css, /@media \(min-width:981px\)/);
});

test("every renderer loads sizing corrections after the workspace theme", () => {
  for (const path of ["../app/layout.tsx", "../webdev/main.tsx"]) {
    const entry = read(path);
    assert.ok(entry.indexOf("workspace-sizing.css") > entry.indexOf("studio-workspace.css"));
  }
});
