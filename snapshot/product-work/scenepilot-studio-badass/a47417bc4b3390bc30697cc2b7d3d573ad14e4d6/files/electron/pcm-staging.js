import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, open, unlink, rmdir, readdir, lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestName = "owner.json";
const isProcessAlive = (pid) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== "ESRCH"; } // Permission/unknown errors are not proof of death.
};

/** Only reclaim our marked, regular-file caches after their process has died.
 * Unknown/legacy directories, symlinks and live owners are deliberately retained. */
export async function recoverAbandonedPcm(root, alive = isProcessAlive) {
  let directories;
  try { directories = await readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return 0; throw error; }
  let recovered = 0;
  for (const directory of directories) {
    if (!directory.isDirectory() || !/^mix-[A-Za-z0-9]{6}$/.test(directory.name)) continue;
    const location = path.join(root, directory.name);
    try {
      const files = await readdir(location, { withFileTypes: true });
      if (!files.length || files.some(file => !file.isFile() || ![manifestName, "program.wav"].includes(file.name))) continue;
      const manifest = path.join(location, manifestName);
      if ((await lstat(manifest)).size > 1024) continue;
      const owner = JSON.parse(await readFile(manifest, "utf8"));
      if (owner.kind !== "scenepilot-pcm" || owner.version !== 1 || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || !/^[a-f0-9-]{36}$/.test(owner.token ?? "") || alive(owner.pid)) continue;
      if (files.some(file => file.name === "program.wav")) await unlink(path.join(location, "program.wav"));
      await unlink(manifest);
      await rmdir(location);
      recovered++;
    } catch (error) {
      // Another instance may recover the same dead cache. Malformed or unreadable
      // metadata is never authority to delete anything else.
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) console.warn("PCM cache recovery skipped a directory:", error.message);
    }
  }
  return recovered;
}

/** Owner-scoped, random-token PCM files. No renderer-supplied filesystem paths.
 * IPC writes are bounded, serialized and acknowledged for backpressure. */
export function createPcmStagingStore(root) {
  const entries = new Map();
  let recovery;
  const find = (owner, token) => {
    const entry = entries.get(token);
    if (!entry || entry.owner !== owner || entry.releasing) throw new Error("PCM staging token is unavailable.");
    return entry;
  };
  return {
    async begin(owner) {
      if ([...entries.values()].filter(e => e.owner === owner).length >= 2) throw new Error("Too many pending PCM mixes. Cancel the previous delivery first.");
      const token = randomUUID();
      const entry = { owner, queue: Promise.resolve(), size: 0, ready: false, releasing: false, handle: null, directory: "", file: "" };
      entries.set(token, entry); // Reserve before asynchronous allocation.
      entry.queue = (async () => {
        await mkdir(root, { recursive: true });
        recovery ??= recoverAbandonedPcm(root);
        await recovery;
        entry.directory = await mkdtemp(path.join(root, "mix-"));
        await writeFile(path.join(entry.directory, manifestName), JSON.stringify({ kind: "scenepilot-pcm", version: 1, pid: process.pid, token }), { flag: "wx", mode: 0o600 });
        entry.file = path.join(entry.directory, "program.wav");
        entry.handle = await open(entry.file, "wx+");
      })();
      try {
        await entry.queue;
        if (entry.releasing) throw new Error("PCM staging was canceled during allocation.");
        return { token };
      } catch (error) {
        if (!entry.releasing) await this.release(owner, token);
        throw error;
      }
    },
    async write(owner, token, position, data) {
      const entry = find(owner, token);
      if (!(data instanceof Uint8Array) || data.byteLength > 1024 * 1024 || !Number.isSafeInteger(position) || position < 0 || position + data.byteLength > 4_000_000_000) throw new Error("Invalid or oversized PCM staging write.");
      const bytes = Buffer.from(data); // Own this bounded chunk before yielding.
      const work = entry.queue.then(async () => {
        if (entry.ready || !entry.handle || position > entry.size) throw new Error("PCM staging writes must be contiguous or replace existing bytes.");
        let offset = 0;
        while (offset < bytes.length) {
          const { bytesWritten } = await entry.handle.write(bytes, offset, bytes.length - offset, position + offset);
          if (!bytesWritten) throw new Error("PCM staging disk write made no progress.");
          offset += bytesWritten;
        }
        entry.size = Math.max(entry.size, position + bytes.length);
      });
      entry.queue = work;
      await work;
    },
    async finish(owner, token) {
      const entry = find(owner, token);
      const work = entry.queue.then(async () => {
      if (entry.ready) return;
      if (!entry.handle || entry.size < 44) throw new Error("PCM mix is incomplete.");
      const header = Buffer.alloc(48);
      await entry.handle.read(header, 0, Math.min(entry.size, header.length), 0);
      const format = header.toString("ascii", 0, 4);
      if (!["RIFF", "RF64"].includes(format) || header.toString("ascii", 8, 12) !== "WAVE") throw new Error("PCM mix is not a WAV file.");
      if (format === "RF64") {
        if (entry.size < 80 || header.readUInt32LE(4) !== 0xffffffff || header.toString("ascii", 12, 16) !== "ds64" || header.readUInt32LE(16) < 28 || header.readUInt32LE(16) + 20 > entry.size) throw new Error("PCM RF64 size header is incomplete.");
        if (header.readBigUInt64LE(20) + 8n !== BigInt(entry.size) || header.readBigUInt64LE(28) > BigInt(entry.size - 80)) throw new Error("PCM RF64 size does not match its completed stream.");
      } else if (header.readUInt32LE(4) + 8 !== entry.size) throw new Error("PCM WAV size does not match its completed stream.");
      await entry.handle.sync();
      await entry.handle.close(); entry.handle = null;
      entry.ready = true;
      });
      entry.queue = work;
      await work;
    },
    resolve(owner, token) {
      const entry = find(owner, token);
      if (!entry.ready) throw new Error("PCM mix has not finished writing.");
      return entry.file;
    },
    async release(owner, token) {
      const entry = entries.get(token);
      if (!entry || entry.owner !== owner) return false;
      if (entry.releasing) return false;
      entry.releasing = true;
      await entry.queue.catch(() => undefined);
      await entry.handle?.close().catch(() => undefined);
      if (entry.file) await unlink(entry.file).catch(error => { if (error.code !== "ENOENT") throw error; });
      if (entry.directory) await unlink(path.join(entry.directory, manifestName)).catch(error => { if (error.code !== "ENOENT") throw error; });
      if (entry.directory) await rmdir(entry.directory).catch(error => { if (error.code !== "ENOENT") throw error; });
      entries.delete(token);
      return true;
    },
    async releaseOwner(owner) {
      await Promise.all([...entries].filter(([, e]) => e.owner === owner).map(([token]) => this.release(owner, token)));
    },
  };
}
