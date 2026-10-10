import { spawn } from "node:child_process";
import path from "node:path";
import electronPath from "electron";
import { createServer } from "node:net";

const root = path.resolve(new URL("..", import.meta.url).pathname);
// Never reuse an unrelated preview occupying a fixed QA port.
const port = await new Promise((resolve, reject) => {
  const reservation = createServer();
  reservation.once("error", reject);
  reservation.listen(0, "127.0.0.1", () => {
    const assigned = reservation.address().port;
    reservation.close((error) => error ? reject(error) : resolve(assigned));
  });
});
const url = `http://127.0.0.1:${port}/?edition=pro`;
const workerUrl = `http://127.0.0.1:${port}/@fs${path.join(root, "scripts", "certify-pcm.worker.ts")}`;
const vite = spawn(path.join(root, "node_modules", ".bin", "vite"), ["--config", "vite.web.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
const serverOutput = [];
vite.stdout.on("data", (chunk) => serverOutput.push(chunk));
vite.stderr.on("data", (chunk) => serverOutput.push(chunk));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (vite.exitCode !== null) throw new Error(Buffer.concat(serverOutput).toString() || `Vite exited ${vite.exitCode}`);
    if (Buffer.concat(serverOutput).toString().includes("Local:")) {
      try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("PCM worker certificate server did not start within ten seconds.");
}

function runCertificate() {
  return new Promise((resolve, reject) => {
    const helper = path.join(root, "scripts", "certify-pcm-worker-electron.mjs");
    const child = spawn(electronPath, [helper, url, workerUrl], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [], stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => code === 0
      ? resolve(Buffer.concat(stdout).toString())
      : reject(new Error(Buffer.concat(stderr).toString() || Buffer.concat(stdout).toString() || `PCM worker certificate exited ${code}`)));
  });
}

try {
  await waitForServer();
  const report = JSON.parse(await runCertificate());
  console.log(JSON.stringify({ schema: "scenepilot-worker-pcm/v1", ...report }, null, 2));
  if (!report.passed) throw new Error(report.error || "PCM worker certificate failed its audio gates.");
} finally {
  vite.kill("SIGTERM");
}
