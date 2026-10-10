/** A decoder transfers ownership of every yielded sample to its consumer.
 * Include cancellation checks inside this scope so an aborted operation still
 * closes the sample it has just received. */
export async function withDecodedSample<T extends { close(): void }, R>(
  sample: T | null,
  consume: (sample: T | null) => R | Promise<R>,
): Promise<R> {
  try { return await consume(sample); }
  finally { sample?.close(); }
}
