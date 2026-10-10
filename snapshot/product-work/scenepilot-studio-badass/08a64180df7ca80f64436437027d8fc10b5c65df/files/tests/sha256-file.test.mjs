import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { sha256Blob } from "../lib/sha256-file.ts";

test("streaming SHA-256 matches standard empty, short, and chunk-boundary vectors", async () => {
  assert.equal(await sha256Blob(new Blob([])), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(await sha256Blob(new Blob(["abc"])), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const bytes = new Uint8Array(4 * 1024 * 1024 + 17).fill(0x61);
  assert.equal(await sha256Blob(new Blob([bytes])), createHash("sha256").update(bytes).digest("hex"));
});

test("streaming SHA-256 matches Node crypto around padding and 4 MiB chunk boundaries", async () => {
  for (const size of [1, 55, 56, 63, 64, 65, 4095, 4096, 4 * 1024 * 1024 - 1, 4 * 1024 * 1024, 4 * 1024 * 1024 + 1]) {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = (i * 31 + size) & 0xff;
    assert.equal(await sha256Blob(new Blob([bytes])), createHash("sha256").update(bytes).digest("hex"), `size ${size}`);
  }
});
