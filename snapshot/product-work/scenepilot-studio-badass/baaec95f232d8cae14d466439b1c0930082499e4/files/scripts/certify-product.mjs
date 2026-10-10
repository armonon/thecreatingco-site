#!/usr/bin/env node
import { runQualificationCommand } from "./qualification-process.mjs";
import { releaseSourceDigest, verifyReviewEvidence } from "./release-evidence.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { blankPerceptualReviewSubmission, perceptualReviewGates, qualificationVerdict, REQUIRED_PERCEPTUAL_TASKS } from "../lib/product-qualification.ts";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const valueArgument = (name) => process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
const full = process.argv.includes("--full");
const requireReview = process.argv.includes("--require-review");
const reviewPath = valueArgument("--review");
const requestedOutput = valueArgument("--output");
const startedAt = Date.now();

function safeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function run(command, args, { cwd = root, timeoutMs = 20 * 60_000, env = process.env } = {}) {
  return runQualificationCommand(command, args, { cwd, timeoutMs, env });
}

const git = await run("git", ["rev-parse", "--short=12", "HEAD"]);
const commit = git.exitCode === 0 ? git.stdout.trim() : "unknown";
const sourceSha256 = await releaseSourceDigest(root);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = path.resolve(requestedOutput || path.join(root, "outputs", "qualification", `${safeSegment(commit)}-${stamp}`));
const evidenceDirectory = path.join(outputDirectory, "evidence");
await mkdir(evidenceDirectory, { recursive: true });

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const suites = [
  { id: "typecheck-lint", label: "TypeScript and lint", command: npm, args: ["run", "check"], required: true },
  { id: "unit-regression", label: "Full deterministic regression suite", command: npm, args: ["run", "test:quick"], required: true },
  { id: "background-render-stream", label: "Electron background direct-to-disk stream", command: npm, args: ["run", "qa:worker-stream"], required: true },
  { id: "linked-media-playback", label: "Session-isolated linked media decode and readable pixels", command: npm, args: ["run", "qa:linked-media"], required: true },
  { id: "worker-pcm-audio", label: "Worker-safe PCM mix and encode", command: npm, args: ["run", "qa:pcm-worker"], required: true },
  { id: "native-pixel-parity", label: "Chromium/FFmpeg native pixel parity", command: npm, args: ["run", "qa:native-pixels"], required: true },
  { id: "main-source-render", label: "Real MP4 main-source edits, effects and nesting", command: npm, args: ["run", "qa:main-source"], required: true },
  { id: "neural-inpaint-provider", label: "Verified neural inpaint provider security", command: npm, args: ["run", "qa:neural-inpaint"], required: true },
  { id: "neural-inpaint-model", label: "Licensed GMCNN/OpenVINO neural model inference", command: npm, args: ["run", "qa:neural-inpaint-model"], required: true },
  { id: "real-media-native", label: "Generated real-media native render", command: npm, args: ["run", "qa:media", "--", `--report=${path.join(evidenceDirectory, "real-media-report.json")}`], required: true },
  { id: "roto-long-memory", label: "Long-form roto memory certification", command: npm, args: ["run", "qa:roto-memory"], required: true },
  { id: "large-project-performance", label: "4K and 20,000-clip performance budgets", command: npm, args: ["run", "qa:performance", "--", `--report=${path.join(evidenceDirectory, "performance-report.json")}`], required: true },
  {
    id: "lite-production-build",
    label: "Browser Lite production build",
    command: npm,
    args: ["run", "build:app"],
    required: true,
    env: { ...process.env, SCENEPILOT_BUILD_EVIDENCE_OUT: path.join(evidenceDirectory, "lite-build") },
  },
  ...(full ? [
    { id: "release-stress", label: "4K repeated exports, cancellation and interrupted-save recovery", command: npm, args: ["run", "qa:release-stress", "--", `--report=${path.join(evidenceDirectory, "release-stress-report.json")}`], required: true },
    ...(process.platform === "darwin" ? [{ id: "disk-pressure", label: "Isolated disk-full save and recovery", command: npm, args: ["run", "qa:disk-pressure"], required: true }] : []),
    { id: "cloudflare-production-build", label: "Cloudflare production build", command: npm, args: ["run", "build"], required: true },
    { id: "editor-bundle-budget", label: "Editor shell lazy-chunk budget", command: npm, args: ["run", "qa:bundle"], required: true },
    { id: "desktop-renderer-build", label: "Desktop Pro renderer build", command: npm, args: ["run", "desktop:renderer"], required: true },
  ] : []),
];

const automatedGates = [];
for (const suite of suites) {
  process.stdout.write(`\n[qualification] ${suite.label}\n`);
  const result = await run(suite.command, suite.args, { env: suite.env });
  const stdoutPath = path.join(evidenceDirectory, `${suite.id}.stdout.log`);
  const stderrPath = path.join(evidenceDirectory, `${suite.id}.stderr.log`);
  await Promise.all([writeFile(stdoutPath, result.stdout, "utf8"), writeFile(stderrPath, result.stderr, "utf8")]);
  const passed = result.exitCode === 0;
  automatedGates.push({
    id: `automated:${suite.id}`,
    label: suite.label,
    kind: "automated",
    required: suite.required,
    status: passed ? "passed" : "failed",
    details: passed ? `${(result.elapsedMs / 1000).toFixed(2)}s` : `Exited ${result.signal ?? result.exitCode ?? "before launch"} after ${(result.elapsedMs / 1000).toFixed(2)}s`,
    evidencePath: path.relative(outputDirectory, passed ? stdoutPath : stderrPath),
  });
  process.stdout.write(`[qualification] ${passed ? "PASS" : "FAIL"} · ${(result.elapsedMs / 1000).toFixed(2)}s\n`);
}

let reviewSubmission = null;
if (reviewPath) {
  try { reviewSubmission = JSON.parse(await readFile(path.resolve(reviewPath), "utf8")); }
  catch (error) { process.stderr.write(`[qualification] Could not read review submission: ${error instanceof Error ? error.message : error}\n`); }
}
const perceptualGates = perceptualReviewGates(reviewSubmission);
const reviewIssues = reviewSubmission ? await verifyReviewEvidence(reviewSubmission, { sourceSha256, baseDirectory: path.dirname(path.resolve(reviewPath)) }) : [];
if (reviewIssues.length) for (const gate of perceptualGates) {
  gate.status = "pending";
  gate.details = reviewIssues.join(" ");
}
if (await releaseSourceDigest(root) !== sourceSha256) automatedGates.push({ id: "automated:stable-source", label: "Candidate source unchanged during qualification", kind: "automated", required: true, status: "failed", details: "Source files changed while qualification ran. Rerun against a frozen candidate." });
const gates = [...automatedGates, ...perceptualGates];
const verdict = qualificationVerdict(gates);
const report = {
  schema: "scenepilot-product-qualification/v1",
  createdAt: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt,
  mode: full ? "full" : "standard",
  commit,
  sourceSha256,
  machine: { platform: process.platform, architecture: process.arch, node: process.version, cpus: os.cpus().length, memoryBytes: os.totalmem() },
  verdict,
  gates,
};

const reviewTemplatePath = path.join(outputDirectory, "perceptual-review.json");
await writeFile(reviewTemplatePath, `${JSON.stringify(reviewSubmission ?? { ...blankPerceptualReviewSubmission(commit), appSourceSha256: sourceSha256 }, null, 2)}\n`, "utf8");
const instructions = [
  "# ScenePilot perceptual release review",
  "",
  `Commit: \`${commit}\``,
  `Candidate source SHA-256: \`${sourceSha256}\``,
  "",
  "This review is a required product gate, not a ceremonial checklist. Use real licensed footage, keep screenshots/renders in `evidence/`, and record the SHA-256 of the exact source-media bundle. Every required task needs a 4/5 or 5/5 score, a clear pass, notes, and at least one evidence path.",
  "",
  ...REQUIRED_PERCEPTUAL_TASKS.flatMap((task, index) => [
    `## ${index + 1}. ${task.label}`,
    "",
    task.instructions,
    "",
    ...task.acceptance.map((item) => `- ${item}`),
    "",
  ]),
  "After completing the JSON form, rerun:",
  "",
  `\`npm run qa:product:release -- --full --review=${reviewTemplatePath}\``,
  "",
].join("\n");
await Promise.all([
  writeFile(path.join(outputDirectory, "review-instructions.md"), instructions, "utf8"),
  writeFile(path.join(outputDirectory, "qualification-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
]);

process.stdout.write(`\n${JSON.stringify({ outputDirectory, verdict }, null, 2)}\n`);
if (automatedGates.some((gate) => gate.required && gate.status === "failed")) process.exitCode = 1;
else if (requireReview && !verdict.releaseReady) process.exitCode = 2;
