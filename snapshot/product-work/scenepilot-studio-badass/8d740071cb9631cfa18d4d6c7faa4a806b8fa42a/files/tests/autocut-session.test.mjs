import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { fingerprintFile } from "../lib/media-link.ts";
import { parseAutoCutSession, verifyAutoCutSessionMedia } from "../lib/autocut-session.ts";
import { sha256Blob } from "../lib/sha256-file.ts";

const music = { duration: 1, bpm: 120, tempoConfidence: 0.5, beats: [0, 0.5], downbeats: [0], beatsPerBar: 4, meterConfidence: 0.5, energy: [0.3, 0.7], energyStep: 0.5, dropTime: 0, dropStrength: 0, sections: [{ start: 0, end: 1, energy: 0.5, label: "verse" }], reliable: true };
const profile = { id: "clip1", name: "clip.mp4", duration: 1, segments: [{ start: 0, end: 1, quality: 0.8, motion: 0.1, brightness: 0.5, faces: false }], sceneCuts: [], usable: 1, energy: 0.5, hero: 0.8, focusX: 0.5, faces: false, notes: [] };

async function fixture() {
  const file = new File(["owned synthetic media bytes"], "clip.mp4", { type: "video/mp4", lastModified: 10 });
  const session = {
    format: "scenepilot-autocut-session", version: 1, savedAt: 20,
    media: [{ id: "m1", name: file.name, kind: "video", size: file.size, lastModified: file.lastModified, sha256: await sha256Blob(file) }],
    song: { mediaId: "m1", kind: "clip", clipId: "c1" }, music,
    settings: { tempoFactor: 1, preset: "music-video", density: 0.5, seed: 3, length: "full", aspect: "9:16", performance: false, performanceTouched: false, brollMix: 0.25, faces: false, quality: 1, premiereRate: "auto", dropFrame: true, beatMarkers: "bars" },
    clips: [{ id: "c1", mediaId: "m1", include: true, role: "auto", manualOffset: 0.25, profile, meta: { duration: 1, width: 320, height: 180, hasAudio: true, thumbnail: "data:image/png;base64,AA==" } }],
    locks: [{ id: "shot-1", clipId: "c1", start: 0, duration: 0.5, sourceStart: 0.25, label: "verse", sectionIndex: 0, hero: false, synced: false, locked: true }],
  };
  return { file, session };
}

test("versioned editable session validates and preserves locked/manual edits", async () => {
  const { file, session } = await fixture();
  const parsed = parseAutoCutSession(JSON.stringify(session));
  assert.equal(parsed.locks[0].sourceStart, 0.25);
  assert.equal(parsed.clips[0].manualOffset, 0.25);
  assert.deepEqual(await verifyAutoCutSessionMedia(parsed, [file]), new Map([["m1", file]]));
});

test("media mismatch rejects atomically before a relink map is returned", async () => {
  const { session } = await fixture();
  const parsed = parseAutoCutSession(JSON.stringify(session));
  const changed = new File(["different media bytes"], "clip.mp4", { type: "video/mp4", lastModified: 10 });
  await assert.rejects(verifyAutoCutSessionMedia(parsed, [changed]), /Missing or changed media/);
  await assert.rejects(verifyAutoCutSessionMedia(parsed, []), /Missing or changed media/);
});

test("malformed and unknown-version sessions are rejected before use", async () => {
  const { session } = await fixture();
  await assert.rejects(async () => parseAutoCutSession("{"), /valid AutoCut session JSON/);
  await assert.rejects(async () => parseAutoCutSession(JSON.stringify({ ...session, version: 99 })), /Unsupported or malformed/);
  await assert.rejects(async () => parseAutoCutSession(JSON.stringify({ ...session, locks: [{ ...session.locks[0], sourceStart: "bad" }] })), /invalid locked edits/);
});

test("full-file SHA-256 hashes middle bytes and streaming chunk boundaries", async () => {
  assert.equal(await sha256Blob(new Blob(["abc"])), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const prefix = new Uint8Array(140_000).fill(7);
  const changed = prefix.slice();
  changed[70_000] = 8;
  const a = new File([prefix], "a.mp4");
  const b = new File([changed], "a.mp4");
  assert.equal(await fingerprintFile(a), await fingerprintFile(b), "the legacy edge fingerprint does not inspect middle bytes");
  assert.notEqual(await sha256Blob(a), await sha256Blob(b), "editable sessions use the full-byte digest");
  const chunks = new Uint8Array(4 * 1024 * 1024 + 37);
  for (let index = 0; index < chunks.length; index += 1) chunks[index] = index % 251;
  assert.equal(await sha256Blob(new Blob([chunks])), createHash("sha256").update(chunks).digest("hex"));
});
