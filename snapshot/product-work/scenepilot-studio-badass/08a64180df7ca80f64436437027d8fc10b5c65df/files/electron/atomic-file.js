import { randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";

const writes = new Map();
/** Serialize writers per destination; independent unique temp files avoid
 * truncated/renamed-away data when save or queue progress fires rapidly. */
export function writeAtomicFile(destination, contents) {
  const prior = writes.get(destination) ?? Promise.resolve();
  const next = prior.catch(() => {}).then(async () => {
    const temporary = `${destination}.${randomUUID()}.partial`;
    let file;
    try {
      file = await open(temporary, "wx", 0o600);
      await file.writeFile(contents, "utf8");
      await file.sync();
      await file.close();
      file = null;
      await rename(temporary, destination);
    } finally {
      await file?.close().catch(() => {});
      await unlink(temporary).catch(() => {});
    }
  });
  writes.set(destination, next);
  void next.finally(() => { if (writes.get(destination) === next) writes.delete(destination); }).catch(() => {});
  return next;
}
