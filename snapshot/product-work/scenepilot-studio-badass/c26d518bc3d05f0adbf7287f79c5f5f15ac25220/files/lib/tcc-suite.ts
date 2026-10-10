// thecreateco suite kit glue (https://thecreatingco.com/suite/v1/suite.js).
//
// The kit is loaded by a plain <script defer data-app="scenepilot"> tag in each
// page. It may be missing (offline, blocked, not deployed yet), so everything
// here is optional: callers get `null` and simply hide Locker buttons. Media
// never leaves the device — the Locker stores files in this browser only.

export type LockerEntry = { id: string; name: string; type: string; size: number; app: string; created: number | string; meta?: Record<string, unknown> };
export type LockerFile = LockerEntry & { blob: Blob };

export type Locker = {
  save(item: { name: string; type: string; blob: Blob; meta?: Record<string, unknown> }): Promise<string>;
  list(filter?: { types?: string[] }): Promise<LockerEntry[]>;
  get(id: string): Promise<LockerFile>;
  sendTo(appId: string, id: string): Promise<void> | void;
  onOpen(handler: (file: LockerFile) => void): void;
};

type SuiteWindow = Window & { TCC?: { locker?: Locker } };

export function currentLocker(): Locker | null {
  if (typeof window === "undefined") return null;
  const locker = (window as SuiteWindow).TCC?.locker;
  return locker && typeof locker.save === "function" ? locker : null;
}

/**
 * Calls `listener` once the kit is available (immediately if it already is).
 * Re-checks on the kit's ready event, on window load and a few times after, so
 * a slow `defer` script still lights the buttons up. Returns an unsubscribe.
 */
export function whenLocker(listener: (locker: Locker) => void): () => void {
  if (typeof window === "undefined") return () => {};
  let done = false;
  const timers: number[] = [];
  const check = () => {
    if (done) return;
    const locker = currentLocker();
    if (!locker) return;
    done = true;
    cleanup();
    listener(locker);
  };
  const cleanup = () => {
    window.removeEventListener("tcc:ready", check);
    window.removeEventListener("load", check);
    timers.forEach((timer) => window.clearTimeout(timer));
  };
  window.addEventListener("tcc:ready", check);
  window.addEventListener("load", check);
  for (const delay of [0, 500, 1500, 4000, 10000]) timers.push(window.setTimeout(check, delay));
  check();
  return () => { done = true; cleanup(); };
}

/** Register a handler for files sent to this app (`?tcc-open=<id>`). */
export function onLockerOpen(handler: (file: LockerFile) => void): () => void {
  return whenLocker((locker) => {
    try { locker.onOpen(handler); } catch { /* a broken kit must not break the app */ }
  });
}

export async function saveToLocker(item: { name: string; type: string; blob: Blob; meta?: Record<string, unknown> }) {
  const locker = currentLocker();
  if (!locker) throw new Error("Locker isn’t available right now (offline or blocked).");
  return locker.save(item);
}

/** Turn a Locker entry into a File, keeping its name and type. */
export function lockerFileToFile(file: LockerFile): File {
  return new File([file.blob], file.name, { type: file.type || file.blob.type, lastModified: typeof file.created === "number" ? file.created : Date.now() });
}
