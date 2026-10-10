import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { storeGeneratedAudio } from "../electron/generated-audio.js";

test("derived audio writes atomically to stable durable media paths", async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),"scenepilot-generated-audio-test-"));
  try {
    const wav=new Uint8Array(100);wav.set(Buffer.from("RIFF"));wav.set(Buffer.from("WAVE"),8);
    const a=await storeGeneratedAudio(directory,wav),b=await storeGeneratedAudio(directory,wav);
    assert.equal(a.outputPath,b.outputPath);assert.equal(path.dirname(a.outputPath),directory);
    assert.deepEqual(new Uint8Array(await readFile(a.outputPath)),wav);
    await assert.rejects(storeGeneratedAudio(directory,new Uint8Array(50)),/not a WAV/);
    await assert.rejects(storeGeneratedAudio(directory,"../audio.wav"),/under 256/);
  } finally {await rm(directory,{recursive:true,force:true});}
});
