import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("audio preparation passes cancellation to media reads and releases failed preparation locks", async () => {
  const bundled = await build({ entryPoints: [new URL("../app/audio-stem-delivery.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
  const { deliverAudioStem } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`);
  let jobs = [{ id: "stem", status: "queued", audioStem: "master" }], busy = false;
  const context = {
    queuedJob: jobs[0], rendering: false, renderLaunchRef: { current: false }, renderAbortRef: { current: null },
    mainFile: new File([], "linked.wav"), mainUrl: "scenepilot-media:/linked.wav", mainName: "Test", duration: 1,
    assets: [], audioClips: [], audioTracks: [], audioBuses: [], nestedCompositionAudio: [], masterGain: 1,
    setRendering: value => { busy = value; }, setRenderProgress() {}, setStatus() {}, updateQueue: update => { jobs = update(jobs); },
    async materializeFile(_file, _url, signal) {
      assert.equal(signal, context.renderAbortRef.current.signal);
      assert.equal(busy, true); assert.equal(jobs[0].status, "preparing");
      context.renderAbortRef.current.abort(); signal.throwIfAborted();
    },
  };
  await deliverAudioStem(context);
  assert.equal(jobs[0].status, "canceled"); assert.equal(busy, false); assert.equal(context.renderLaunchRef.current, false);
  context.materializeFile = async () => { throw new Error("Out of memory resolving media"); };
  await deliverAudioStem(context);
  assert.equal(jobs[0].status, "failed"); assert.match(jobs[0].error, /Out of memory/);
  assert.equal(busy, false); assert.equal(context.renderAbortRef.current, null); assert.equal(context.renderLaunchRef.current, false);
});
