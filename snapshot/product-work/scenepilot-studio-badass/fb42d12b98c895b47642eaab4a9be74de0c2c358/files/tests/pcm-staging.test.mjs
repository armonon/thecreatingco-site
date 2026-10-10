import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPcmStagingStore, recoverAbandonedPcm } from "../electron/pcm-staging.js";

function wav() {
  const bytes = Buffer.alloc(48);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(40, 4); bytes.write("WAVE", 8);
  bytes.write("fmt ", 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(96000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(4, 40); bytes.writeInt16LE(123, 44); return bytes;
}
function rf64() {
  const bytes = Buffer.alloc(84);
  bytes.write("RF64", 0); bytes.writeUInt32LE(0xffffffff, 4); bytes.write("WAVE", 8);
  bytes.write("ds64", 12); bytes.writeUInt32LE(28, 16); bytes.writeBigUInt64LE(76n, 20); bytes.writeBigUInt64LE(4n, 28);
  wav().copy(bytes, 48, 12); bytes.writeUInt32LE(0xffffffff, 76);
  return bytes;
}
test("streamed RF64 masters are accepted only after their final size header is written", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scenepilot-staging-test-"));
  const store = createPcmStagingStore(directory);
  try {
    const { token } = await store.begin(1);
    await store.write(1, token, 0, rf64());
    await store.finish(1, token);
    assert.deepEqual(await readFile(store.resolve(1, token)), rf64());
    await store.release(1, token);
    for (const invalid of [rf64().subarray(0, 80), Buffer.from(rf64())]) {
      if (invalid.length === 84) invalid.writeBigUInt64LE(1000n, 28);
      const lease = await store.begin(1);
      await store.write(1, lease.token, 0, invalid);
      await assert.rejects(store.finish(1, lease.token), /size/);
      await store.release(1, lease.token);
    }
  } finally { await store.releaseOwner(1); await rm(directory, { recursive: true, force: true }); }
});
test("native PCM staging is owner scoped, bounded, seekable and cleaned after delivery", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scenepilot-staging-test-"));
  const store = createPcmStagingStore(directory);
  try {
    const { token } = await store.begin(1);
    assert.throws(() => store.resolve(1, token), /not finished/);
    await assert.rejects(store.write(2, token, 0, wav()), /unavailable/);
    await assert.rejects(store.write(1, token, 0, new Uint8Array(1024 * 1024 + 1)), /oversized/);
    const bytes = wav();
    await Promise.all([store.write(1, token, 0, bytes.subarray(0, 44)), store.write(1, token, 44, bytes.subarray(44))]);
    await store.write(1, token, 4, bytes.subarray(4, 8));
    await Promise.all([store.finish(1, token), store.finish(1, token)]);
    assert.deepEqual(await readFile(store.resolve(1, token)), bytes);
    assert.equal(await store.release(2, token), false);
    await assert.rejects(store.write(1, token, 0, bytes), /contiguous/);
    assert.equal(await store.release(1, token), true);
    assert.equal(await store.release(1, token), false);
    assert.deepEqual(await readdir(directory), []);
  } finally { await store.releaseOwner(1); await rm(directory, { recursive: true, force: true }); }
});

test("failed/incomplete PCM streams cannot be used as native soundtracks", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scenepilot-staging-test-"));
  const store = createPcmStagingStore(directory);
  try {
    const one = await store.begin(1), two = await store.begin(1);
    await assert.rejects(store.begin(1), /Too many/);
    await store.write(1, one.token, 0, wav().subarray(0, 44));
    await assert.rejects(store.finish(1, one.token), /size/);
    assert.throws(() => store.resolve(1, one.token), /not finished/);
    await assert.rejects(store.write(1, two.token, 5, new Uint8Array(1)), /contiguous/);
    await store.releaseOwner(1);
    assert.deepEqual(await readdir(directory), []);
    const pending = store.begin(2);
    const canceled = assert.rejects(pending, /canceled/);
    await store.releaseOwner(2);
    await canceled;
    assert.deepEqual(await readdir(directory), []);
  } finally { await store.releaseOwner(1); await store.releaseOwner(2); await rm(directory, { recursive: true, force: true }); }
});

test("crash recovery reclaims only dead owned caches, never live, legacy, unknown or linked files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scenepilot-staging-test-"));
  const names = ["mix-dead01", "mix-live01", "mix-legacy", "mix-extra1", "mix-link01", "mix-bad001", "not-ours"];
  const marker = { kind: "scenepilot-pcm", version: 1, pid: 42, token: "11111111-1111-4111-8111-111111111111" };
  try {
    for (const name of names) {
      const target = path.join(directory, name); await mkdir(target);
      await writeFile(path.join(target, "program.wav"), wav());
      if (name !== "mix-legacy") await writeFile(path.join(target, "owner.json"), JSON.stringify({ ...marker, pid: name === "mix-live01" ? 43 : 42 }));
    }
    await writeFile(path.join(directory, "mix-extra1", "user-note.txt"), "keep");
    await writeFile(path.join(directory, "mix-bad001", "owner.json"), "bad json");
    await rm(path.join(directory, "mix-link01", "program.wav"));
    await symlink(path.join(directory, "mix-live01", "program.wav"), path.join(directory, "mix-link01", "program.wav"));
    await symlink(path.join(directory, "mix-dead01"), path.join(directory, "mix-sym001"));
    assert.equal(await recoverAbandonedPcm(directory, pid => pid === 43), 1);
    assert.deepEqual((await readdir(directory)).sort(), [...names.filter(n => n !== "mix-dead01"), "mix-sym001"].sort());
    assert.deepEqual(await readFile(path.join(directory, "mix-live01", "program.wav")), wav());
    assert.equal(await recoverAbandonedPcm(directory, pid => pid === 43), 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
