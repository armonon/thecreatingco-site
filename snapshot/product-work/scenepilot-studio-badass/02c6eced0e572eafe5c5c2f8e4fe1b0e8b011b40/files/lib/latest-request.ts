/** Small generation gate for async UI work where only the newest request may commit. */
export function createLatestRequestGate() {
  let generation = 0;
  return {
    begin: () => ++generation,
    isCurrent: (request: number) => request === generation,
  };
}

/** Production async media-loader transaction, injected so races are deterministic in tests. */
export async function decodeLatestCandidate<TFile, TDecoded, TResult>(options: {
  file: TFile;
  gate: ReturnType<typeof createLatestRequestGate>;
  decode: (file: TFile) => Promise<TDecoded>;
  validate: (decoded: TDecoded) => void;
  createUrl: (file: TFile) => string;
  revokeUrl: (url: string) => void;
  previousUrl: string;
  commit: (decoded: TDecoded, candidateUrl: string) => TResult;
  failed: (error: unknown) => void;
  started?: () => void;
  finished?: () => void;
}) {
  const request = options.gate.begin();
  options.started?.();
  const candidateUrl = options.createUrl(options.file);
  try {
    const decoded = await options.decode(options.file);
    options.validate(decoded);
    if (!options.gate.isCurrent(request)) {
      options.revokeUrl(candidateUrl);
      return { current: false as const };
    }
    if (options.previousUrl) options.revokeUrl(options.previousUrl);
    const value = options.commit(decoded, candidateUrl);
    return { current: true as const, value };
  } catch (error) {
    options.revokeUrl(candidateUrl);
    if (options.gate.isCurrent(request)) options.failed(error);
    return { current: options.gate.isCurrent(request) as boolean, error };
  } finally {
    if (options.gate.isCurrent(request)) options.finished?.();
  }
}

/** Fence all callbacks from a transcription after it is aborted/superseded. */
export async function runCurrentTask<T>(options: {
  controller: AbortController;
  isCurrent: () => boolean;
  run: (report: (value: unknown) => void) => Promise<T>;
  onProgress?: (value: unknown) => void;
  onResult: (value: T) => void;
  onError: (error: unknown) => void;
  onFinish: () => void;
}) {
  const current = () => options.isCurrent();
  const active = () => current() && !options.controller.signal.aborted;
  try {
    const result = await options.run((value) => { if (active()) options.onProgress?.(value); });
    if (active()) options.onResult(result);
  } catch (error) {
    if (current()) options.onError(error);
  } finally {
    if (current()) options.onFinish();
  }
}
