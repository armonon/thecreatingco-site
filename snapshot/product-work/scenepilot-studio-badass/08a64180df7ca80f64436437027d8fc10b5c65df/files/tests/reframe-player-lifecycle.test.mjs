import assert from "node:assert/strict";
import test from "node:test";
import { ReframePlayer } from "../tools/src/reframe/player.ts";

class FakeVideo extends EventTarget {
  videoWidth = 0;
  duration = 0;
  paused = false;
  src = "";
  listeners = new Map();
  pauseCalls = 0;
  addEventListener(type, callback, options) {
    this.listeners.set(type, (this.listeners.get(type) ?? 0) + 1);
    super.addEventListener(type, callback, options);
  }
  removeEventListener(type, callback, options) {
    this.listeners.set(type, Math.max(0, (this.listeners.get(type) ?? 0) - 1));
    super.removeEventListener(type, callback, options);
  }
  pause() { this.pauseCalls++; this.paused = true; }
  load() {}
  removeAttribute(name) { if (name === "src") this.src = ""; }
}

function withFakeDom(run) {
  const previousDocument = globalThis.document;
  const previousRafCancel = globalThis.cancelAnimationFrame;
  const oldCreate = URL.createObjectURL;
  const oldRevoke = URL.revokeObjectURL;
  const video = new FakeVideo();
  const revoked = [];
  globalThis.document = { createElement: (tag) => { assert.equal(tag, "video"); return video; } };
  globalThis.cancelAnimationFrame = () => {};
  URL.createObjectURL = (file) => `blob:${file.name}`;
  URL.revokeObjectURL = (url) => revoked.push(url);
  const player = new ReframePlayer({}, {});
  return Promise.resolve().then(() => run({ player, video, revoked })).finally(() => {
    player.dispose();
    globalThis.document = previousDocument;
    globalThis.cancelAnimationFrame = previousRafCancel;
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
  });
}

test("a superseding player load rejects and detaches the earlier media listeners immediately", async () => {
  await withFakeDom(async ({ player, video, revoked }) => {
    const first = player.load({ name: "first.mp4" });
    assert.equal(video.listeners.get("loadedmetadata"), 1);
    const second = player.load({ name: "second.mp4" });
    await assert.rejects(first, /superseded/);
    assert.equal(video.listeners.get("loadedmetadata"), 1);
    assert.equal(video.listeners.get("error"), 1);
    assert.ok(video.pauseCalls > 0);
    assert.deepEqual(revoked, ["blob:first.mp4"]);
    video.dispatchEvent(new Event("loadedmetadata"));
    await second;
    assert.equal(video.listeners.get("loadedmetadata"), 0);
    assert.equal(video.listeners.get("error"), 0);
  });
});

test("disposing the player rejects pending metadata wait and removes its listeners", async () => {
  await withFakeDom(async ({ player, video, revoked }) => {
    const pending = player.load({ name: "pending.mp4" });
    player.dispose();
    await assert.rejects(pending, /superseded/);
    assert.equal(video.listeners.get("loadedmetadata"), 0);
    assert.equal(video.listeners.get("error"), 0);
    assert.deepEqual(revoked, ["blob:pending.mp4"]);
  });
});
