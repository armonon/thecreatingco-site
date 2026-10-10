import test from "node:test";
import assert from "node:assert/strict";
import { decodeToMono16k, transcribeVocals } from "../app/transcribe-client.ts";

function replaceGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  t.after(() => original ? Object.defineProperty(globalThis, name, original) : delete globalThis[name]);
}

test("transcription decoding closes its audio device on failure", async (t) => {
  let closed = 0;
  replaceGlobal(t, "AudioContext", class {
    async decodeAudioData() { throw new Error("bad audio"); }
    async close() { closed++; }
  });
  await assert.rejects(decodeToMono16k(new File(["bad"], "bad.wav")), /bad audio/);
  assert.equal(closed, 1);
});

test("transcription rejects unsupported resampling instead of mislabeling native-rate PCM", async (t) => {
  replaceGlobal(t, "AudioContext", class {
    async decodeAudioData() { return { duration: 1 }; }
    async close() {}
  });
  replaceGlobal(t, "OfflineAudioContext", undefined);
  await assert.rejects(decodeToMono16k(new File(["audio"], "audio.wav")), /resampling/);
});

test("transcription cancellation during decode does not launch inference", async (t) => {
  const controller = new AbortController();
  let created = 0;
  replaceGlobal(t, "Worker", class { constructor() { created++; } });
  replaceGlobal(t, "AudioContext", class {
    async decodeAudioData() { controller.abort(); return { duration: 1 }; }
    async close() {}
  });
  replaceGlobal(t, "OfflineAudioContext", class {
    createBufferSource() { return { connect() {}, start() {} }; }
    async startRendering() { return { getChannelData: () => new Float32Array(16_000) }; }
  });
  await assert.rejects(transcribeVocals(new File(["audio"], "audio.wav"), undefined, controller.signal), { name: "AbortError" });
  assert.equal(created, 0);
});

test("transcription terminates worker on dispatch failure", async (t) => {
  let terminated = 0;
  replaceGlobal(t, "AudioContext", class {
    async decodeAudioData() { return { duration: 1 }; }
    async close() {}
  });
  replaceGlobal(t, "OfflineAudioContext", class {
    createBufferSource() { return { connect() {}, start() {} }; }
    async startRendering() { return { getChannelData: () => new Float32Array(16_000) }; }
  });
  replaceGlobal(t, "Worker", class {
    postMessage() { throw new Error("dispatch failed"); }
    terminate() { terminated++; }
  });
  await assert.rejects(transcribeVocals(new File(["audio"], "audio.wav")), /dispatch failed/);
  assert.equal(terminated, 1);
});
