import { spawn } from "node:child_process";

/** A timed-out npm parent must not strand its compiler/encoder and pipe handles. */
export function runQualificationCommand(command, args, { cwd, timeoutMs = 20 * 60_000, env = process.env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now(), stdout = [], stderr = [];
    const grouped = process.platform !== "win32";
    const child = spawn(command, args, { cwd, env, detached: grouped, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let finished = false;
    const finish = (exitCode, signal, detail = "") => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ exitCode, signal, elapsedMs: Date.now() - started, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") + detail });
    };
    const timer = setTimeout(() => {
      try { if (grouped && child.pid) process.kill(-child.pid, "SIGKILL"); else child.kill("SIGKILL"); } catch { /* Already exited. */ }
      child.stdout.destroy(); child.stderr.destroy(); child.unref();
      finish(null, "SIGKILL", `\nQualification command exceeded ${timeoutMs}ms and was terminated. This is not a passing result.\n`);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", (error) => finish(null, null, error.message));
    child.once("close", (code, signal) => finish(code, signal));
  });
}
