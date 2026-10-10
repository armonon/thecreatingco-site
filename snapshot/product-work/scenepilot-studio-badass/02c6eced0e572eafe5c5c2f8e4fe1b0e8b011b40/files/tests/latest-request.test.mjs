import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLatestRequestGate, decodeLatestCandidate, runCurrentTask } from "../lib/latest-request.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function loaderRig(initial) {
  const gate = createLatestRequestGate();
  const state = { file: initial, url: "old-url", pcm: "old-pcm", captions: ["authored"], busy: "" };
  const revoked = [];
  const load = (file, work) => decodeLatestCandidate({
    file,
    gate,
    decode: () => work,
    validate: (pcm) => { if (pcm === "malformed") throw new Error("bad audio data"); },
    createUrl: (name) => `url:${name}`,
    revokeUrl: (url) => revoked.push(url),
    previousUrl: state.url,
    started: () => { state.busy = "decode"; },
    commit: (pcm, url) => Object.assign(state, { file, url, pcm, captions: [], busy: "" }),
    failed: (error) => { state.error = error.message; },
    finished: () => { state.busy = ""; },
  });
  return { gate, state, revoked, load };
}

test("production media loader keeps newest decode and revokes stale candidate URLs", async () => {
  const rig = loaderRig("previous");
  const a = deferred();
  const b = deferred();
  const pendingA = rig.load("A", a.promise);
  const pendingB = rig.load("B", b.promise);
  b.resolve("pcm-B");
  await pendingB;
  a.resolve("pcm-A");
  await pendingA;
  assert.deepEqual({ file: rig.state.file, pcm: rig.state.pcm }, { file: "B", pcm: "pcm-B" });
  assert.deepEqual(rig.revoked, ["old-url", "url:A"]);
});

test("production media loader preserves authored state and busy ownership on malformed replacement", async () => {
  const rig = loaderRig("valid.webm");
  const rejected = await rig.load("broken.mp4", Promise.resolve("malformed"));
  assert.equal(rejected.current, true);
  assert.deepEqual({ file: rig.state.file, url: rig.state.url, pcm: rig.state.pcm, captions: rig.state.captions }, {
    file: "valid.webm", url: "old-url", pcm: "old-pcm", captions: ["authored"],
  });
  assert.equal(rig.state.busy, "");
  assert.deepEqual(rig.revoked, ["url:broken.mp4"]);
});

test("aborted transcription cannot publish stale failure or clear replacement decode state", async () => {
  const controller = new AbortController();
  let current = true;
  const state = { busy: "transcribe", status: "working" };
  const request = deferred();
  const task = runCurrentTask({
    controller,
    isCurrent: () => current,
    run: () => request.promise,
    onResult: () => { state.status = "stale result"; },
    onError: () => { state.status = "stale error"; },
    onFinish: () => { state.busy = ""; },
  });
  controller.abort();
  current = false;
  state.busy = "decode";
  state.status = "Checking replacement";
  request.reject(new Error("Cancelled"));
  await task;
  assert.deepEqual(state, { busy: "decode", status: "Checking replacement" });
});

test("user-cancelled current transcription still reports cancellation and clears its own busy state", async () => {
  const controller = new AbortController();
  const state = { busy: "transcribe", status: "working" };
  const request = deferred();
  const task = runCurrentTask({
    controller,
    isCurrent: () => true,
    run: () => request.promise,
    onResult: () => { state.status = "result"; },
    onError: (error) => { state.status = error.message; },
    onFinish: () => { state.busy = ""; },
  });
  controller.abort();
  request.reject(new Error("Cancelled"));
  await task;
  assert.deepEqual(state, { busy: "", status: "Cancelled" });
});

test("Captions UI routes media decode and transcription through the exercised lifecycle helpers", async () => {
  const source = await readFile(new URL("../tools/src/captions/main.tsx", import.meta.url), "utf8");
  assert.match(source, /await decodeLatestCandidate\(/);
  assert.match(source, /await runCurrentTask\(/);
  assert.match(source, /abortRef\.current = null;/);
  assert.match(source, /onProgress: \(value\)/);
  assert.match(source, /const text = await picked\.text\(\);/);
  assert.match(source, /generation !== subtitleGenerationRef\.current/);
});
