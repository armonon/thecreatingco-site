import test from "node:test";
import assert from "node:assert/strict";

test("transport shares the audio hardware clock, precise seeks, pause and rate changes",async()=>{
  const previous=globalThis.AudioContext;
  class FakeContext {currentTime=5;state="running";sampleRate=48000;async resume(){this.state="running";}}
  globalThis.AudioContext=FakeContext;
  try {
    const c=await import("../lib/shared-audio-clock.ts");
    const context=c.sharedAudioContext();
    let changes=0;const unsubscribe=c.subscribeAudioClock(()=>changes++);
    c.anchorAudioClock(10,true);context.currentTime=7;
    assert.equal(c.audioClockPosition(),12);
    c.anchorAudioClock(12.001,true);assert.equal(c.audioClockPosition(),12.001,"1 ms seek isn't swallowed by a drift threshold");
    c.anchorAudioClock(12,false);context.currentTime=20;assert.equal(c.audioClockPosition(),12);
    c.anchorAudioClock(12,true,2);context.currentTime=21;assert.equal(c.audioClockPosition(),14);
    c.anchorAudioClock(14,true,-1);context.currentTime=22;assert.equal(c.audioClockPosition(),13);
    assert.equal(changes,5);unsubscribe();
  }finally{globalThis.AudioContext=previous;}
});

// Shared helper: a fake hardware context whose decode returns a sized buffer.
async function withClock(run) {
  const previousContext = globalThis.AudioContext, previousFetch = globalThis.fetch;
  class FakeContext { currentTime = 0; state = "running"; sampleRate = 48000; async resume() { this.state = "running"; } }
  globalThis.AudioContext = FakeContext;
  try {
    const c = await import("../lib/shared-audio-clock.ts");
    const context = c.sharedAudioContext();
    // decode "size" is encoded in the fake bytes: [channels, lengthMillions]
    context.decodeAudioData = async (data) => { const [channels, millions] = new Uint32Array(data); return { length: millions * 1e6, numberOfChannels: channels, duration: 1 }; };
    await run(c, context);
  } finally { globalThis.AudioContext = previousContext; globalThis.fetch = previousFetch; }
}
const audioResponse = (channels, millions) => ({ ok: true, arrayBuffer: async () => new Uint32Array([channels, millions]).buffer });

test("one failed source is reported but never blocks transport resume", async () => {
  await withClock(async (c) => {
    globalThis.fetch = async (url) => url.includes("bad") ? { ok: false, status: 404 } : audioResponse(2, 1);
    const good = c.acquireSongBuffer("blob:good-song", 10);
    const bad = c.acquireSongBuffer("blob:bad-song", 10);
    await assert.rejects(bad.buffer);
    const result = await c.resumeAudioClock(); // must resolve, not reject
    assert.deepEqual(result.failed, [], "the failed entry evicts itself; the good one resolved");
    good.release(); bad.release();
  });
});

test("resume reports sources that fail while still pending", async () => {
  await withClock(async (c) => {
    let reject; globalThis.fetch = () => new Promise((_, no) => { reject = no; });
    const pending = c.acquireSongBuffer("blob:slow-offline", 10);
    const resumed = c.resumeAudioClock();
    reject(new Error("offline"));
    await assert.rejects(pending.buffer);
    assert.deepEqual((await resumed).failed, ["blob:slow-offline"]);
    pending.release();
  });
});

test("multichannel sources are budgeted by exact decoded size, not the stereo estimate", async () => {
  await withClock(async (c) => {
    // Each decodes to 8 ch × 5M frames × 4 B = 160 MB, though admitted as a ~4 MB stereo estimate.
    globalThis.fetch = async () => audioResponse(8, 5);
    const held = [];
    for (const name of ["a", "b"]) { const item = c.acquireSongBuffer(`blob:surround-${name}`, 10); held.push(item); await item.buffer; }
    const third = c.acquireSongBuffer("blob:surround-c", 10); held.push(third);
    await assert.rejects(third.buffer, /memory budget/, "exact 480 MB total exceeds the 384 MB budget");
    for (const item of held) item.release();
  });
});

test("clock position never goes negative when reverse-shuttling past the head", async () => {
  await withClock(async (c, context) => {
    c.anchorAudioClock(0.5, true, -1); context.currentTime += 2;
    assert.equal(c.audioClockPosition(), 0);
    c.anchorAudioClock(0, false);
  });
});
