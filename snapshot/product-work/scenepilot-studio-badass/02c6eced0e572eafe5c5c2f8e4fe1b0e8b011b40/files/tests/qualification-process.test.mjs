import assert from "node:assert/strict";
import test from "node:test";
import { runQualificationCommand } from "../scripts/qualification-process.mjs";

test("qualification returns success or spawn failure without hanging", async () => {
  const good = await runQualificationCommand(process.execPath, ["-e", "console.log('ready')"]);
  assert.equal(good.exitCode, 0); assert.match(good.stdout, /ready/);
  const bad = await runQualificationCommand("scenepilot-missing-command-qa", []);
  assert.equal(bad.exitCode, null); assert.match(bad.stderr, /ENOENT/);
});

test("qualification timeout releases inherited descendant pipes", async () => {
  const command = "require('node:child_process').spawn(process.execPath, ['-e','setInterval(()=>{},1000)'], {stdio:'inherit'}); setInterval(()=>{},1000)";
  const result = await runQualificationCommand(process.execPath, ["-e", command], { timeoutMs: 1000 });
  assert.equal(result.exitCode, null); assert.equal(result.signal, "SIGKILL");
  assert.match(result.stderr, /not a passing result/);
});
