/* eslint-disable react-hooks/rules-of-hooks -- Isolated hook lifecycle harness. */
import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: [new URL("../app/use-program-transport.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent", plugins: [{ name: "preparation-harness", setup(builder) {
  builder.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: "mock" }));
  builder.onResolve({ filter: /shared-audio-clock/ }, () => ({ path: "clock", namespace: "mock" }));
  builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: path === "react"
    ? "export const useRef=v=>({current:v}); export const useEffect=effect=>globalThis.transportEffects.push(effect);"
    : "export const resumeAudioClock=()=>globalThis.resumeTestClock(); export const anchorAudioClock=()=>{}; export const audioClockPosition=()=>0; export const sharedAudioContext=()=>null;" }));
} }] });
const { useProgramTransport } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
function setup() {
  let resolve, reject; const state = { playing: false, rate: 0, status: "" };
  globalThis.transportEffects = [];
  globalThis.resumeTestClock = () => new Promise((yes, no) => { resolve = yes; reject = no; });
  const actions = useProgramTransport({ videoRef: { current: null }, playing: false, shuttleRate: 0, currentTime: 0, compositionTime: 0, workspaceView: "sequence", editorMode: "pro", duration: 10, timelineRange: {},
    setPlaying: v => { state.playing = v; }, setShuttleRate: v => { state.rate = v; }, setStatus: v => { state.status = v; }, setCurrentTime() {}, setCompositionTime() {} });
  return { actions, state, complete: () => resolve({ failed: [] }), fail: () => reject(new Error("audio unavailable")) };
}
test("Stop cancels pending play and shuttle preparation", async () => {
  for (const start of [a => a.togglePlayback(), a => a.shuttle(1), a => a.shuttle(-1)]) {
    const h = setup(); const pending = start(h.actions); h.actions.stopShuttle(); h.complete(); await pending;
    assert.deepEqual(h.state, { playing: false, rate: 0, status: "" });
  }
});
test("second Play cancels an outstanding start", async () => {
  const h = setup(); const pending = h.actions.togglePlayback(); await h.actions.togglePlayback(); h.complete(); await pending;
  assert.equal(h.state.playing, false);
});
test("preparation failure is handled without starting playback", async () => {
  const h = setup(); const pending = h.actions.togglePlayback(); h.fail(); await pending;
  assert.equal(h.state.playing, false); assert.match(h.state.status, /audio unavailable/);
});
test("document cleanup invalidates prepared starts", async () => {
  const h = setup(); const cleanup = globalThis.transportEffects[1]();
  const pending = h.actions.togglePlayback(); cleanup(); h.complete(); await pending;
  assert.equal(h.state.playing, false);
});
