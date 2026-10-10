import type { StreamTargetChunk } from "mediabunny";

type Box = { start: number; end: number; body: number; type: string };

/** Rewrite only fixed-size timing fields: media bytes and chunk offsets stay put.
 * The AAC packet adapter reserves a two-entry edit list. A zero-duration empty
 * edit followed by a media-time skip removes priming without deleting samples. */
export function correctMp4AudioPriming(data: Uint8Array, delay: number, duration: number): Uint8Array<ArrayBuffer> {
  if (!Number.isFinite(delay) || delay < 0 || !Number.isFinite(duration) || duration <= 0) throw new Error("Invalid AAC timing correction.");
  const bytes = new Uint8Array(data), view = new DataView(bytes.buffer);
  const uint = (offset: number, wide: boolean) => wide ? Number(view.getBigUint64(offset)) : view.getUint32(offset);
  const put = (offset: number, value: number, wide: boolean) => {
    if (!Number.isSafeInteger(value) || value < 0 || (!wide && value > 0xffffffff)) throw new Error("MP4 timing field overflow.");
    if (wide) view.setBigUint64(offset, BigInt(value)); else view.setUint32(offset, value);
  };
  const children = (start: number, end: number): Box[] => {
    const result: Box[] = [];
    for (let at = start; at < end;) {
      if (at + 8 > end) throw new Error("Truncated MP4 box.");
      const size32 = view.getUint32(at), header = size32 === 1 ? 16 : 8;
      if (at + header > end) throw new Error("Truncated MP4 box header.");
      const size = size32 === 1 ? uint(at + 8, true) : size32 || end - at;
      if (!Number.isSafeInteger(size) || size < header || at + size > end) throw new Error("Invalid MP4 box size.");
      result.push({ start: at, end: at + size, body: at + header, type: String.fromCharCode(...bytes.subarray(at + 4, at + 8)) });
      at += size;
    }
    return result;
  };
  const child = (box: Box, type: string) => {
    const found = children(box.body, box.end).find(item => item.type === type);
    if (!found) throw new Error(`AAC timing metadata is missing ${type}.`);
    return found;
  };
  const requireBytes = (box: Box, count: number) => { if (box.body + count > box.end) throw new Error(`Truncated ${box.type}.`); };
  const clock = (box: Box) => {
    requireBytes(box, 4); const wide = view.getUint8(box.body) === 1;
    if (view.getUint8(box.body) > 1) throw new Error("Unsupported MP4 timing version.");
    requireBytes(box, wide ? 32 : 20);
    const scale = view.getUint32(box.body + (wide ? 20 : 12));
    if (!scale) throw new Error("Invalid MP4 timescale.");
    return { wide, scale, durationAt: box.body + (wide ? 24 : 16) };
  };
  // With reserved fast-start space, onMoov also reports the following `free`
  // header, whose payload is unwritten padding. Parse only the movie itself.
  if (bytes.length < 8) throw new Error("Truncated MP4 box.");
  const movieSize = view.getUint32(0) === 1 && bytes.length >= 16 ? uint(8, true) : view.getUint32(0);
  if (movieSize > bytes.length || movieSize < 8) throw new Error("Invalid MP4 movie box size.");
  const moov = children(0, movieSize).find(box => box.type === "moov");
  if (!moov) throw new Error("AAC timing metadata has no movie box.");
  const movie = clock(child(moov, "mvhd"));
  let corrected = 0, longestTrack = 0;
  for (const track of children(moov.body, moov.end).filter(box => box.type === "trak")) {
    const mdia = child(track, "mdia"), handler = child(mdia, "hdlr"), tkhd = child(track, "tkhd");
    requireBytes(handler, 12); requireBytes(tkhd, 4);
    const wide = view.getUint8(tkhd.body) === 1;
    if (view.getUint8(tkhd.body) > 1) throw new Error("Unsupported track timing version.");
    requireBytes(tkhd, wide ? 36 : 24);
    const durationAt = tkhd.body + (wide ? 28 : 20);
    const isAudio = String.fromCharCode(...bytes.subarray(handler.body + 8, handler.body + 12)) === "soun";
    if (isAudio) {
      const media = clock(child(mdia, "mdhd")), edit = child(child(track, "edts"), "elst");
      requireBytes(edit, 8);
      const editWide = view.getUint8(edit.body) === 1, stride = editWide ? 20 : 12;
      if (view.getUint8(edit.body) > 1 || view.getUint32(edit.body + 4) !== 2) throw new Error("Unexpected AAC edit list.");
      requireBytes(edit, 8 + 2 * stride);
      put(edit.body + 8, 0, editWide);
      put(edit.body + 8 + stride, Math.round(duration * movie.scale), editWide);
      put(edit.body + 8 + stride + (editWide ? 8 : 4), Math.round(delay * media.scale), editWide);
      put(durationAt, Math.round(duration * movie.scale), wide);
      corrected++;
    }
    longestTrack = Math.max(longestTrack, uint(durationAt, wide));
  }
  if (corrected !== 1) throw new Error("Expected exactly one mixed AAC audio track.");
  put(movie.durationAt, longestTrack, movie.wide);
  return bytes;
}

/** Hold only the movie metadata, never the media payload. Reapply it after all
 * muxer writes, before closing the destination, for both seekable disk and RAM. */
export function createMp4TimingPatch(duration: number, timing: () => number | undefined) {
  let patch: StreamTargetChunk | undefined;
  let failed = false, failure: unknown;
  return {
    fail(error: unknown) { failed = true; failure = error; },
    onMoov(data: Uint8Array, position: number) {
      const delay = timing();
      if (delay !== undefined) patch = { type: "write", position, data: correctMp4AudioPriming(data, delay, duration) };
    },
    apply(buffer: ArrayBuffer) { if (patch) new Uint8Array(buffer).set(patch.data, patch.position); },
    wrap(stream: WritableStream<StreamTargetChunk>, signal?: AbortSignal) {
      // Acquire lazily: codec preparation can fail before Output.start().
      let destination: WritableStreamDefaultWriter<StreamTargetChunk> | undefined;
      const getWriter = () => destination ??= stream.getWriter();
      return new WritableStream<StreamTargetChunk>({
        async write(chunk) {
          const writer = getWriter();
          try { signal?.throwIfAborted(); await writer.write(chunk); }
          catch (error) {
            await writer.abort(error).catch(() => undefined);
            writer.releaseLock(); destination = undefined;
            throw error;
          }
        },
        async close() {
          const writer = getWriter();
          try { if (failed) throw failure; signal?.throwIfAborted(); if (patch) await writer.write(patch); signal?.throwIfAborted(); await writer.close(); }
          catch (error) { await writer.abort(error).catch(() => undefined); throw error; }
          finally { writer.releaseLock(); }
        },
        async abort(reason) { const writer = getWriter(); try { await writer.abort(reason); } finally { writer.releaseLock(); } },
      });
    },
  };
}
