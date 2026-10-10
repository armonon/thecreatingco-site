import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { releaseSourceDigest, verifyReviewEvidence } from "../scripts/release-evidence.mjs";
import { perceptualReviewGates } from "../lib/product-qualification.ts";

test("candidate fingerprint includes tracked deletions and rebuilt untracked assets", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scenepilot-digest-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    await writeFile(path.join(directory, "old.js"), "old bundle");
    execFileSync("git", ["add", "old.js"], { cwd: directory });
    const original = await releaseSourceDigest(directory);
    await rm(path.join(directory, "old.js"));
    const deleted = await releaseSourceDigest(directory);
    assert.notEqual(deleted, original);
    assert.equal(await releaseSourceDigest(directory), deleted);
    await writeFile(path.join(directory, "new.js"), "new bundle");
    assert.notEqual(await releaseSourceDigest(directory), deleted);
    await rm(path.join(directory, "new.js"));
    await writeFile(path.join(directory, "old.js"), "old bundle");
    assert.equal(await releaseSourceDigest(directory), original);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("malformed review submissions fail closed without crashing qualification", () => {
  for (const value of [{ reviewer: 1 }, { reviewer: "QA", appCommit: {} }, { responses: {} }, { responses: [null, { taskId: "edit", evidence: [null] }] }]) {
    assert.ok(perceptualReviewGates(value).every((gate) => gate.status !== "passed"));
  }
});

test("release reviews bind source identity and real evidence, not just filenames", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scenepilot-evidence-"));
  try {
    const options = { sourceSha256: "a".repeat(64), baseDirectory: directory };
    const submission = { reviewer: "QA", appSourceSha256: options.sourceSha256, responses: [{ taskId: "edit", evidence: ["frame.png"] }] };
    assert.equal((await verifyReviewEvidence(submission, options)).length, 1);
    await writeFile(path.join(directory, "frame.png"), "nonempty-test-evidence");
    assert.deepEqual(await verifyReviewEvidence(submission, options), []);
    assert.match((await verifyReviewEvidence({ ...submission, appSourceSha256: "b".repeat(64) }, options))[0], /exact candidate/);
    assert.match((await verifyReviewEvidence({ ...submission, responses: [submission.responses[0], submission.responses[0]] }, options))[0], /unique/);
    for (const evidence of [[], ["../outside.png"], ["/absolute.png"], [" "]]) assert.ok((await verifyReviewEvidence({ ...submission, responses: [{ taskId: "edit", evidence }] }, options)).length);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
