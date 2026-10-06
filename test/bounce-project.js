const MAGIC = 'BOUNCE01';
const MAX_AUDIO = 300 * 1024 * 1024;
const MAX_HEADER = 256 * 1024;
const encoder = new TextEncoder();

function validate(manifest) {
  if (manifest?.format !== 'bounce-library' || manifest.version !== 1 ||
      typeof manifest.name !== 'string' || manifest.name.length > 80 ||
      !Array.isArray(manifest.eq) || manifest.eq.length !== 3 ||
      !manifest.eq.every(n => Number.isFinite(n) && n >= -12 && n <= 12) ||
      !Array.isArray(manifest.tracks) || manifest.tracks.length > 200) {
    throw Error('Unsupported or damaged Bounce library.');
  }
  let total = 0;
  for (const track of manifest.tracks) {
    if (typeof track.name !== 'string' || !track.name || track.name.length > 1024 ||
        typeof track.type !== 'string' || track.type.length > 128 ||
        !Number.isSafeInteger(track.size) || track.size < 0 || track.size > 150 * 1024 * 1024) {
      throw Error('Invalid audio entry in Bounce library.');
    }
    total += track.size;
  }
  if (total > MAX_AUDIO) throw Error('Portable libraries are limited to 300 MB of audio.');
  return total;
}

// Binary payloads stay as Blob slices: no base64 or whole-library memory copy.
export function createLibrary(files, name, eq) {
  const manifest = { format: 'bounce-library', version: 1, name, eq,
    tracks: files.map(file => ({ name: file.name, type: file.type, size: file.size })) };
  validate(manifest);
  const header = encoder.encode(JSON.stringify(manifest));
  if (header.length > MAX_HEADER) throw Error('Library metadata is too large.');
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, header.length, true);
  return new Blob([MAGIC, length, header, ...files], { type: 'application/octet-stream' });
}

export async function readLibrary(file) {
  if (file.size < 12 || file.size > MAX_AUDIO + MAX_HEADER + 12) throw Error('Invalid Bounce library size.');
  const prefix = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (new TextDecoder().decode(prefix.slice(0, 8)) !== MAGIC) throw Error('Choose a .bounce library, not a playlist file list.');
  const length = new DataView(prefix.buffer).getUint32(8, true);
  if (length < 2 || length > MAX_HEADER || 12 + length > file.size) throw Error('Damaged Bounce library header.');
  let manifest;
  try { manifest = JSON.parse(await file.slice(12, 12 + length).text()); }
  catch { throw Error('Damaged Bounce library metadata.'); }
  const total = validate(manifest);
  let offset = 12 + length;
  if (offset + total !== file.size) throw Error('Incomplete Bounce library. Keep your original files.');
  const files = manifest.tracks.map(track => {
    const audio = file.slice(offset, offset + track.size, track.type);
    offset += track.size;
    return new File([audio], track.name, { type: track.type });
  });
  return { name: manifest.name, eq: manifest.eq, files };
}
