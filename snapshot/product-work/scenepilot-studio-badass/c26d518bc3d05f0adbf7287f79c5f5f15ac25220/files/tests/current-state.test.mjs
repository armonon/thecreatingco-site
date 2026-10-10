import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
const bundle = await build({ entryPoints: [new URL("../app/use-current-state.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false, plugins: [{ name: "state-harness", setup(builder) {
  builder.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: "mock" }));
  builder.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: "export const useRef=v=>({current:v}); export const useCallback=f=>f; export const useState=v=>[v,next=>globalThis.publishedState=next];" }));
} }] });
const { useCurrentState } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
test("event-time writes compose before render and publish identical snapshots", () => {
  const [, set, current] = useCurrentState([]);
  try {
    set(items => [...items, { id: "first" }]);
    set(items => items.map(item => ({ ...item, favorite: true })));
    set(items => [...items, { id: "second" }]);
    assert.deepEqual(current.current, [{ id: "first", favorite: true }, { id: "second" }]);
    assert.equal(globalThis.publishedState, current.current);
    set([]); assert.deepEqual(current.current, []);
  } finally { delete globalThis.publishedState; }
});
