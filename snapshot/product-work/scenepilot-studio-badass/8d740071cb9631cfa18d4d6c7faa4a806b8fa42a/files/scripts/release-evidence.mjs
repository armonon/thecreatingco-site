import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat, realpath } from "node:fs/promises";
import path from "node:path";

/** Exclude human review/docs so committing a completed review does not change
 * the reviewed program. Include tracked runtime, lockfiles and build scripts. */
export async function releaseSourceDigest(root) {
  const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  const files = [...new Set(tracked.split("\0").filter(Boolean))].filter((file) => !file.startsWith("docs/") && !file.endsWith(".md")).sort();
  const digest = createHash("sha256");
  for (const file of files) {
    let bytes;
    try { bytes = await readFile(path.join(root, file)); }
    catch (error) {
      // Rebuilds remove old, tracked hashed assets before a release commit.
      // Bind their absence into the candidate identity instead of crashing or
      // silently ignoring deletions. Other I/O failures must still fail closed.
      if (error.code !== "ENOENT") throw error;
      digest.update(`${file}\0missing\0`);
      continue;
    }
    digest.update(`${file}\0${bytes.length}\0`).update(bytes);
  }
  return digest.digest("hex");
}

export async function verifyReviewEvidence(submission, { sourceSha256, baseDirectory }) {
  const issues = [];
  if (!submission || submission.appSourceSha256 !== sourceSha256) issues.push("Review must name the exact candidate appSourceSha256.");
  if (!submission || typeof submission.reviewer !== "string" || !submission.reviewer.trim()) issues.push("A named reviewer is required.");
  if (!Array.isArray(submission?.responses)) return [...issues, "Review responses are missing."];
  const ids = new Set();
  for (const response of submission.responses) {
    if (!response || typeof response.taskId !== "string" || ids.has(response.taskId)) { issues.push("Review task IDs must be unique strings."); continue; }
    ids.add(response.taskId);
    if (!Array.isArray(response.evidence) || !response.evidence.length) { issues.push(`${response.taskId}: evidence is missing.`); continue; }
    for (const relative of response.evidence) {
      if (typeof relative !== "string" || !relative.trim() || path.isAbsolute(relative)) { issues.push(`${response.taskId}: evidence must be a relative file path.`); continue; }
      const file = path.resolve(baseDirectory, relative);
      if (!file.startsWith(`${path.resolve(baseDirectory)}${path.sep}`)) { issues.push(`${response.taskId}: evidence must stay inside the review folder.`); continue; }
      try {
        const actual = await realpath(file);
        if (!actual.startsWith(`${await realpath(baseDirectory)}${path.sep}`)) { issues.push(`${response.taskId}: evidence symlink leaves the review folder.`); continue; }
        const info = await stat(file); if (!info.isFile() || !info.size) issues.push(`${response.taskId}: evidence is empty or not a file.`);
      }
      catch { issues.push(`${response.taskId}: evidence file is unavailable: ${relative}`); }
    }
  }
  return issues;
}
