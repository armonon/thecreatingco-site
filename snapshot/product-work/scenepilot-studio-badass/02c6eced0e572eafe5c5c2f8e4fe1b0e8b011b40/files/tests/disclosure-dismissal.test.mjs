import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const effects = [];
globalThis.__disclosureEffects = effects;
const bundle = await build({
  entryPoints: ["app/shell-disclosure.tsx"], bundle: true, write: false,
  platform: "node", format: "esm", jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "hook-harness", setup(builder) {
    builder.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents:
      "export const useRef = current => ({current}); export const useEffect = fn => globalThis.__disclosureEffects.push(fn);" }));
  } }],
});
const { useDismissibleDisclosure } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

test("Escape closes an open disclosure and returns focus without leaking shortcuts", () => {
  const { onKeyDown } = useDismissibleDisclosure();
  const calls = [];
  const details = { open: true, querySelector: () => ({ focus: () => calls.push("focus") }) };
  const event = { key: "Escape", currentTarget: details, preventDefault: () => calls.push("prevent"), stopPropagation: () => calls.push("stop") };
  onKeyDown({ ...event, key: "ArrowDown" });
  assert.equal(details.open, true);
  assert.deepEqual(calls, []);
  onKeyDown(event);
  assert.equal(details.open, false);
  assert.deepEqual(calls, ["prevent", "stop", "focus"]);
  onKeyDown(event);
  assert.equal(calls.length, 3, "closed disclosures do not intercept Escape");
});

test("outside pointer dismisses; settings interaction stays open; listener is cleaned up", () => {
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  class TestNode {}
  const listeners = new Map();
  globalThis.Node = TestNode;
  globalThis.document = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { assert.equal(listeners.get(type), listener); listeners.delete(type); },
  };
  try {
    const { ref } = useDismissibleDisclosure();
    const cleanup = effects.at(-1)();
    const inside = new TestNode();
    ref.current = { open: true, contains: target => target === inside };
    listeners.get("pointerdown")({ target: inside });
    assert.equal(ref.current.open, true);
    listeners.get("pointerdown")({ target: new TestNode() });
    assert.equal(ref.current.open, false);
    ref.current = null;
    listeners.get("pointerdown")({ target: new TestNode() });
    cleanup();
    assert.equal(listeners.size, 0);
  } finally {
    globalThis.document = previousDocument;
    globalThis.Node = previousNode;
  }
});

test("layout settings opt into shared dismissal without changing content structure", () => {
  const source = readFileSync("app/studio-shell.tsx", "utf8");
  assert.match(source, /const disclosure = useDismissibleDisclosure\(\)/);
  assert.match(source, /<details \{\.\.\.disclosure\} className="workspace-layout-menu"/);
  assert.match(source, /aria-label="Workspace layout settings"/);
});
