const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 over a Blob/File in bounded 4 MiB reads (no full-file allocation). */
export async function sha256Blob(blob: Blob): Promise<string> {
  const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  let tail = new Uint8Array(0);
  const compress = (block: Uint8Array) => {
    const view = new DataView(block.buffer, block.byteOffset, 64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3);
      const s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    const values = [a,b,c,d,e,f,g,hh];
    for (let i = 0; i < 8; i++) h[i] = (h[i] + values[i]) >>> 0;
  };
  for (let offset = 0; offset < blob.size; offset += 4 * 1024 * 1024) {
    const chunk = new Uint8Array(await blob.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer());
    const data = new Uint8Array(tail.length + chunk.length);
    data.set(tail); data.set(chunk, tail.length);
    const fullLength = data.length - (data.length % 64);
    for (let offsetBlock = 0; offsetBlock < fullLength; offsetBlock += 64) compress(data.subarray(offsetBlock, offsetBlock + 64));
    tail = data.slice(fullLength);
  }
  const bitLength = blob.size * 8;
  const paddingLength = tail.length < 56 ? 64 : 128;
  const final = new Uint8Array(paddingLength);
  final.set(tail); final[tail.length] = 0x80;
  const view = new DataView(final.buffer);
  view.setUint32(paddingLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddingLength - 4, bitLength >>> 0);
  for (let offset = 0; offset < final.length; offset += 64) compress(final.subarray(offset, offset + 64));
  return [...h].map((value) => value.toString(16).padStart(8, "0")).join("");
}
