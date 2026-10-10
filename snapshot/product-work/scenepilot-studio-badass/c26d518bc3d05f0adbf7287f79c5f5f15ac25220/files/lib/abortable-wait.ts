/** Stop waiting without letting a late OS-dialog result restart canceled work.
 * The OS dialog itself may still need to be dismissed by the user. */
export function abortableWait<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason ?? new DOMException("Canceled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    pending.then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
    if (signal.aborted) abort();
  });
}
