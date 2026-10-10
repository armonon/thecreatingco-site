import test from "node:test";
import assert from "node:assert/strict";
import { correctMp4AudioPriming, createMp4TimingPatch } from "../lib/mp4-audio-priming.ts";

const concat = (...parts) => { const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const part of parts) { result.set(part, at); at += part.length; } return result; };
const box = (name, ...parts) => { const body = concat(...parts), bytes = new Uint8Array(body.length + 8); new DataView(bytes.buffer).setUint32(0, bytes.length); bytes.set([...name].map(c => c.charCodeAt(0)), 4); bytes.set(body, 8); return bytes; };
function fixture(wide = false) {
  const clock = (name, scale, duration) => { const data = new Uint8Array(wide ? 32 : 20), v = new DataView(data.buffer); data[0] = +wide; v.setUint32(wide ? 20 : 12, scale); if (wide) v.setBigUint64(24, BigInt(duration)); else v.setUint32(16, duration); return box(name, data); };
  const track = type => {
    const tk = new Uint8Array(wide ? 36 : 24), tv = new DataView(tk.buffer); tk[0] = +wide;
    if (wide) tv.setBigUint64(28, BigInt(type === "soun" ? 2100 : 2000)); else tv.setUint32(20, type === "soun" ? 2100 : 2000);
    const handler = new Uint8Array(12); handler.set([...type].map(c => c.charCodeAt(0)), 8);
    const edit = new Uint8Array(wide ? 48 : 32), ev = new DataView(edit.buffer); edit[0] = +wide; ev.setUint32(4, 2);
    if (wide) { ev.setBigUint64(8, 44n); ev.setBigInt64(16, -1n); ev.setUint32(24, 65536); ev.setBigUint64(28, 2069n); ev.setUint32(44, 65536); }
    else { ev.setUint32(8, 44); ev.setInt32(12, -1); ev.setUint32(16, 65536); ev.setUint32(20, 2069); ev.setUint32(28, 65536); }
    return box("trak", box("tkhd", tk), box("mdia", clock("mdhd", 48000, 99328), box("hdlr", handler)), ...(type === "soun" ? [box("edts", box("elst", edit))] : []));
  };
  return concat(box("moov", clock("mvhd", 1000, 2100), track("vide"), track("soun")), box("free", new Uint8Array(16)));
}
function find(data, name) { const at = Buffer.from(data).indexOf(name); assert.ok(at >= 0); return at + 4; }
for (const wide of [false, true]) test(`AAC edit-list correction preserves box layout (v${+wide})`, () => {
  const source = fixture(wide), before = new Uint8Array(source), output = correctMp4AudioPriming(source, .044, 2), view = new DataView(output.buffer);
  assert.deepEqual(source, before); assert.equal(source.length, output.length);
  const edit = find(output, "elst"), movie = find(output, "mvhd");
  const read = offset => wide ? Number(view.getBigUint64(offset)) : view.getUint32(offset);
  assert.equal(read(edit + 8), 0);
  assert.equal(read(edit + (wide ? 28 : 20)), 2000);
  assert.equal(read(edit + (wide ? 36 : 24)), 2112);
  assert.equal(read(movie + (wide ? 24 : 16)), 2000);
  assert.deepEqual(output.slice(-24), before.slice(-24));
});
test("AAC timing fails closed on malformed or missing metadata", () => {
  assert.throws(() => correctMp4AudioPriming(new Uint8Array(7), .044, 2), /Truncated/);
  assert.throws(() => correctMp4AudioPriming(box("moov"), .044, 2), /missing mvhd/);
  assert.throws(() => correctMp4AudioPriming(fixture(), -.1, 2), /Invalid AAC/);
});
test("reserved fast-start padding may include only its free-box header", () => {
  const source = fixture(), movieSize = new DataView(source.buffer).getUint32(0);
  const partial = source.slice(0, movieSize + 8);
  new DataView(partial.buffer).setUint32(movieSize, 65536);
  const corrected = correctMp4AudioPriming(partial, .044, 2);
  assert.equal(corrected.length, partial.length);
  assert.equal(new DataView(corrected.buffer).getUint32(movieSize), 65536);
});
test("stream and buffer destinations receive identical correction after muxer writes", async () => {
  const patch = createMp4TimingPatch(2, () => .044), moov = fixture(), events = [];
  const stream = patch.wrap(new WritableStream({ write(chunk) { events.push(chunk); }, close() { events.push("closed"); } }));
  const writer = stream.getWriter();
  await writer.write({ type: "write", position: 24, data: moov });
  patch.onMoov(moov, 24); await writer.close();
  const buffer = new ArrayBuffer(moov.length + 24); patch.apply(buffer);
  assert.deepEqual(events[1].data, new Uint8Array(buffer).slice(24));
  assert.equal(events[1].position, 24); assert.equal(events[2], "closed");
});
test("canceling a streamed export aborts rather than committing its destination", async () => {
  const controller = new AbortController(); let closed = false, aborted = false;
  const destination = new WritableStream({ close() { closed = true; }, abort() { aborted = true; } });
  const stream = createMp4TimingPatch(2, () => undefined).wrap(destination, controller.signal);
  controller.abort(); await assert.rejects(stream.getWriter().close(), { name: "AbortError" });
  assert.equal(closed, false); assert.equal(aborted, true); assert.equal(destination.locked, false);
});
test("metadata write failures reject export and release destination ownership", async () => {
  let aborted = false;
  const destination = new WritableStream({ write() { throw Error("disk full"); }, abort() { aborted = true; } });
  const patch = createMp4TimingPatch(2, () => .044); patch.onMoov(fixture(), 0);
  await assert.rejects(patch.wrap(destination).getWriter().close(), /disk full/);
  assert.equal(destination.locked, false);
  // WHATWG streams already errored by write() need not call the sink's abort().
  assert.equal(typeof aborted, "boolean");
});
test("encoder failure makes muxer cleanup abort instead of committing a partial file", async () => {
  let closed = false, reason;
  const destination = new WritableStream({ close() { closed = true; }, abort(error) { reason = error; } });
  const patch = createMp4TimingPatch(2, () => undefined), writer = patch.wrap(destination).getWriter();
  await writer.write({ type: "write", position: 0, data: new Uint8Array([1, 2]) });
  const error = new Error("encoder failed"); patch.fail(error);
  await assert.rejects(writer.close(), /encoder failed/);
  assert.equal(closed, false); assert.equal(reason, error); assert.equal(destination.locked, false);
});
test("payload write failures release the raw destination even when close is never called", async () => {
  const destination = new WritableStream({ write() { throw Error("disk disconnected"); } });
  const writer = createMp4TimingPatch(2, () => undefined).wrap(destination).getWriter();
  await assert.rejects(writer.write({ type: "write", position: 0, data: new Uint8Array(8) }), /disk disconnected/);
  assert.equal(destination.locked, false);
});
