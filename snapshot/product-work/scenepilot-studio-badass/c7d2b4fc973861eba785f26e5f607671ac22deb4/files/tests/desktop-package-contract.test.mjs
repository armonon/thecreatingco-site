import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("every local desktop runtime import is included in the packaged app", async () => {
  const root = new URL("../electron/", import.meta.url);
  const config = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const files = config.build.files.filter(name => /\.(js|cjs|mjs)$/.test(name) && !name.includes("*"));
  for (const name of files) {
    const source = await readFile(new URL(name, root), "utf8");
    for (const match of source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*["'](\.\/[^"']+\.(?:js|cjs|mjs))["']/g)) {
      assert.ok(files.includes(match[1].slice(2)), `${name} imports ${match[1]} but electron/package.json omits it`);
    }
  }
});
