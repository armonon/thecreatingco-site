/** Monotonic request fence for async media work. Only the newest request may commit. */
export function createRequestFence() {
  let generation = 0;
  return {
    begin() { return ++generation; },
    isCurrent(token: number) { return token === generation; },
  };
}

/** Latest-only analysis runner shared by the Reframe UI and lifecycle tests. */
export function createAnalysisCoordinator() {
  const fence = createRequestFence();
  let active: AbortController | null = null;
  const begin = () => {
    active?.abort();
    active = null;
    return fence.begin();
  };
  return {
    begin,
    async run<T>(
      work: (signal: AbortSignal, progress: (value: number) => void) => Promise<T>,
      handlers: { progress?: (value: number) => void; result?: (value: T) => void; error?: (error: unknown) => void; finally?: () => void } = {},
    ): Promise<void> {
      active?.abort();
      const token = fence.begin();
      const controller = new AbortController();
      active = controller;
      const isCurrent = () => fence.isCurrent(token);
      try {
        const value = await work(controller.signal, (progress) => {
          if (isCurrent()) handlers.progress?.(progress);
        });
        if (isCurrent()) handlers.result?.(value);
      } catch (error) {
        if (isCurrent()) handlers.error?.(error);
      } finally {
        if (isCurrent()) {
          active = null;
          handlers.finally?.();
        }
      }
    },
    isCurrent: (token: number) => fence.isCurrent(token),
  };
}
