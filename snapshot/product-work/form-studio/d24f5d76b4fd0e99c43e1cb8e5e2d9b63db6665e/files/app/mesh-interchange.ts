/**
 * Reading and writing the formats everything else speaks.
 *
 * STEP is the exact route out, and it is the right one for a machinist. It is
 * the wrong one for almost everyone else: a renderer, a game engine, a slicer
 * and a colleague on a different package all want a mesh, and a modeller that
 * cannot hand one over is a dead end however good its geometry is.
 *
 * Four formats, chosen for what they preserve rather than for how common they
 * are:
 *
 *   - **OBJ** keeps n-gons. A quad cage survives a round trip as quads, which
 *     matters here more than anywhere, because subdivision and the NURBS
 *     conversion are both defined on quads.
 *   - **PLY** also keeps n-gons, and is what most scanning and research tools
 *     read.
 *   - **STL** is triangles and nothing else — no topology, no units, no names.
 *     It is included because every 3D printer wants it, not because it is good.
 *   - **glTF** is the web's runtime format, and the one to hand someone who
 *     wants to *look* at the thing.
 *
 * Everything here is a string in and a string out, with no three.js and no DOM,
 * so the writers and parsers can be tested directly.
 *
 * ## Coordinates
 *
 * The workspace is Z-up, as CAD is. OBJ, PLY and STL carry no axis convention,
 * so they are written as-is — converting would silently disagree with every
 * other CAD tool. glTF *does* mandate Y-up, so it alone is converted, which is
 * what makes an exported file open the right way round in a viewer.
 */

import {
  faceNormal,
  triangulate,
  weldVertices,
  type EditableMesh,
  type Vec3,
} from "./mesh-kernel.ts";
import { compactMesh } from "./mesh-operations.ts";
import type { UV } from "./mesh-uv.ts";

export type MeshExportFormat = "obj" | "ply" | "stl" | "gltf" | "usd";

export const MESH_EXPORT_FORMATS: readonly {
  id: MeshExportFormat;
  label: string;
  hint: string;
  extension: string;
  mimeType: string;
}[] = [
  { id: "obj", label: "OBJ", hint: "Keeps quads and n-gons — the best round trip", extension: "obj", mimeType: "text/plain" },
  { id: "ply", label: "PLY", hint: "Keeps n-gons; what scanning tools read", extension: "ply", mimeType: "text/plain" },
  { id: "stl", label: "STL", hint: "Triangles only — what a 3D printer wants", extension: "stl", mimeType: "model/stl" },
  { id: "gltf", label: "glTF", hint: "For viewing on the web; millimetres converted to metres, Y-up", extension: "gltf", mimeType: "model/gltf+json" },
  { id: "usd", label: "USD", hint: "OpenUSD ASCII mesh exchange for DCC pipelines", extension: "usda", mimeType: "model/vnd.usda" },
];

const clean = (name: string) => name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "mesh";
const round = (value: number) => Number.isFinite(value) ? Number(value.toFixed(6)) : 0;

// --- OBJ ---------------------------------------------------------------------

export function toObj(mesh: EditableMesh, name = "mesh", uvOfCorner?: readonly UV[][]): string {
  const lines = [
    "# Written by Form Studio",
    `# ${mesh.positions.length} vertices, ${mesh.faces.length} faces`,
    `o ${clean(name)}`,
  ];
  for (const [x, y, z] of mesh.positions) lines.push(`v ${round(x)} ${round(y)} ${round(z)}`);

  // OBJ carries texture coordinates per *corner*, which is exactly the shape
  // unwrapping produces — a vertex on a seam has a different UV in each chart,
  // and OBJ can say so without duplicating the position.
  const textureIndex = new Map<string, number>();
  if (uvOfCorner) {
    for (const face of uvOfCorner) {
      for (const [u, v] of face) {
        const key = `${round(u)} ${round(v)}`;
        if (textureIndex.has(key)) continue;
        textureIndex.set(key, textureIndex.size + 1);
        lines.push(`vt ${key}`);
      }
    }
  }

  // OBJ is 1-indexed, and it takes polygons directly — no triangulation.
  mesh.faces.forEach((face, faceIndex) => {
    const corners = face.map((vertex, corner) => {
      if (!uvOfCorner?.[faceIndex]?.[corner]) return `${vertex + 1}`;
      const [u, v] = uvOfCorner[faceIndex][corner];
      return `${vertex + 1}/${textureIndex.get(`${round(u)} ${round(v)}`)}`;
    });
    lines.push(`f ${corners.join(" ")}`);
  });
  return `${lines.join("\n")}\n`;
}

export function fromObj(text: string): EditableMesh {
  const positions: Vec3[] = [];
  const faces: number[][] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);

    if (parts[0] === "v" && parts.length >= 4) {
      positions.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
      continue;
    }
    if (parts[0] !== "f" || parts.length < 4) continue;

    const face: number[] = [];
    for (const token of parts.slice(1)) {
      // A corner may be "v", "v/vt", "v//vn" or "v/vt/vn"; only the position
      // index is ours to keep.
      const index = Number(token.split("/")[0]);
      if (!Number.isFinite(index) || index === 0) continue;
      // Negative indices count back from the end, which is legal and rare
      // enough that parsers routinely get it wrong.
      face.push(index > 0 ? index - 1 : positions.length + index);
    }
    if (face.length >= 3) faces.push(face);
  }

  return compactMesh({ positions, faces: faces.filter((face) => face.every((vertex) => vertex < positions.length && vertex >= 0)) });
}

// --- PLY ---------------------------------------------------------------------

export function toPly(mesh: EditableMesh): string {
  const lines = [
    "ply",
    "format ascii 1.0",
    "comment Written by Form Studio",
    `element vertex ${mesh.positions.length}`,
    "property float x",
    "property float y",
    "property float z",
    `element face ${mesh.faces.length}`,
    "property list uchar int vertex_index",
    "end_header",
  ];
  for (const [x, y, z] of mesh.positions) lines.push(`${round(x)} ${round(y)} ${round(z)}`);
  for (const face of mesh.faces) lines.push(`${face.length} ${face.join(" ")}`);
  return `${lines.join("\n")}\n`;
}

// --- OpenUSD -----------------------------------------------------------------

const usdIdentifier = (name: string) => {
  const safe = name.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "Mesh";
  return /^\d/.test(safe) ? `Mesh_${safe}` : safe;
};

/** Writes a standards-readable OpenUSD ASCII mesh without baking triangulation. */
export function toUsd(mesh: EditableMesh, name = "mesh"): string {
  const points = mesh.positions.map(([x, y, z]) => `(${round(x)}, ${round(y)}, ${round(z)})`).join(",\n            ");
  const counts = mesh.faces.map((face) => face.length).join(", ");
  const indices = mesh.faces.flat().join(", ");
  return `#usda 1.0
(
    defaultPrim = "FormStudio"
    metersPerUnit = 0.001
    upAxis = "Z"
)

def Xform "FormStudio"
{
    def Mesh "${usdIdentifier(name)}"
    {
        int[] faceVertexCounts = [${counts}]
        int[] faceVertexIndices = [${indices}]
        point3f[] points = [
            ${points}
        ]
        uniform token subdivisionScheme = "none"
    }
}
`;
}

/** Reads the polygon topology and authored scale from an OpenUSD ASCII mesh. */
export function fromUsd(text: string): EditableMesh {
  if (!/^#usda\s+1(?:\.0)?/m.test(text)) throw new Error("Only OpenUSD ASCII 1.0 files are supported");
  const pointBlock = text.match(/point3f\[\]\s+points\s*=\s*\[([\s\S]*?)\]/)?.[1];
  const countBlock = text.match(/int\[\]\s+faceVertexCounts\s*=\s*\[([\s\S]*?)\]/)?.[1];
  const indexBlock = text.match(/int\[\]\s+faceVertexIndices\s*=\s*\[([\s\S]*?)\]/)?.[1];
  if (!pointBlock || countBlock === undefined || indexBlock === undefined) throw new Error("USD mesh is missing points or face topology");
  const positions: Vec3[] = [...pointBlock.matchAll(/\(\s*([^,]+),\s*([^,]+),\s*([^\)]+)\)/g)].map((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
  if (!positions.length || positions.some((point) => point.some((value) => !Number.isFinite(value)))) throw new Error("USD mesh contains invalid points");
  const numbers = (block: string) => block.split(",").map((value) => Number(value.trim())).filter((value) => Number.isFinite(value));
  const counts = numbers(countBlock);
  const indices = numbers(indexBlock);
  if (counts.some((count) => !Number.isSafeInteger(count) || count < 3) || indices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= positions.length)) throw new Error("USD mesh topology is invalid");
  if (counts.reduce((sum, count) => sum + count, 0) !== indices.length) throw new Error("USD face counts do not match the index buffer");
  let cursor = 0;
  const faces = counts.map((count) => {
    const face = indices.slice(cursor, cursor + count);
    cursor += count;
    return face;
  });
  const metersPerUnit = Number(text.match(/metersPerUnit\s*=\s*([0-9.eE+-]+)/)?.[1] ?? 0.001);
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) throw new Error("USD metersPerUnit is invalid");
  const toMillimeters = metersPerUnit * 1_000;
  return compactMesh({ positions: positions.map(([x, y, z]) => [x * toMillimeters, y * toMillimeters, z * toMillimeters]), faces });
}

type PlyProperty = { name: string; list: boolean };
type PlyElement = { name: string; count: number; properties: PlyProperty[] };

/** Reads an ASCII PLY while preserving polygon faces and ignoring extra scan attributes. */
export function fromPly(text: string): EditableMesh {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "ply") throw new Error("PLY header is missing");
  const elements: PlyElement[] = [];
  let current: PlyElement | undefined;
  let headerEnd = -1;
  let ascii = false;
  for (let index = 1; index < lines.length; index += 1) {
    const parts = lines[index].trim().split(/\s+/);
    if (!parts[0] || parts[0] === "comment" || parts[0] === "obj_info") continue;
    if (parts[0] === "format") {
      ascii = parts[1] === "ascii" && parts[2] === "1.0";
      continue;
    }
    if (parts[0] === "element") {
      const count = Number(parts[2]);
      if (!Number.isSafeInteger(count) || count < 0 || count > 10_000_000) throw new Error("PLY element count is invalid or unsafe");
      current = { name: parts[1] ?? "", count, properties: [] };
      elements.push(current);
      continue;
    }
    if (parts[0] === "property" && current) {
      const list = parts[1] === "list";
      current.properties.push({ name: parts[list ? 4 : 2] ?? "", list });
      continue;
    }
    if (parts[0] === "end_header") {
      headerEnd = index;
      break;
    }
  }
  if (!ascii) throw new Error("Only ASCII PLY 1.0 is supported");
  if (headerEnd < 0) throw new Error("PLY header is incomplete");

  const positions: Vec3[] = [];
  const faces: number[][] = [];
  let cursor = headerEnd + 1;
  for (const element of elements) {
    for (let row = 0; row < element.count; row += 1) {
      while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1;
      if (cursor >= lines.length) throw new Error(`PLY ${element.name} data is truncated`);
      const values = lines[cursor].trim().split(/\s+/).map(Number);
      cursor += 1;
      if (values.some((value) => !Number.isFinite(value))) throw new Error(`PLY ${element.name} data contains a non-finite number`);
      let valueIndex = 0;
      const scalars = new Map<string, number>();
      let vertexIndices: number[] | undefined;
      for (const property of element.properties) {
        if (!property.list) {
          if (valueIndex >= values.length) throw new Error(`PLY ${element.name} row is incomplete`);
          scalars.set(property.name, values[valueIndex]);
          valueIndex += 1;
          continue;
        }
        const count = values[valueIndex];
        valueIndex += 1;
        if (!Number.isSafeInteger(count) || count < 0 || valueIndex + count > values.length) throw new Error(`PLY ${element.name} list is invalid`);
        const list = values.slice(valueIndex, valueIndex + count);
        valueIndex += count;
        if (["vertex_index", "vertex_indices"].includes(property.name)) vertexIndices = list;
      }
      if (element.name === "vertex") {
        const x = scalars.get("x");
        const y = scalars.get("y");
        const z = scalars.get("z");
        if (x === undefined || y === undefined || z === undefined) throw new Error("PLY vertices need x, y and z properties");
        positions.push([x, y, z]);
      } else if (element.name === "face" && vertexIndices && vertexIndices.length >= 3) {
        if (!vertexIndices.every((vertex) => Number.isSafeInteger(vertex) && vertex >= 0 && vertex < positions.length)) throw new Error("PLY face references a missing vertex");
        faces.push(vertexIndices);
      }
    }
  }
  return compactMesh({ positions, faces });
}

// --- STL ---------------------------------------------------------------------

/**
 * ASCII STL. Every triangle carries its own three corners, so all topology is
 * lost on the way out — which is why importing one has to weld it back.
 */
export function toStl(mesh: EditableMesh, name = "mesh"): string {
  const solid = clean(name);
  const lines = [`solid ${solid}`];
  for (const face of mesh.faces) {
    const normal = faceNormal(mesh, face);
    // Fan-triangulate the polygon; a shared normal is right for a planar face
    // and close enough for the near-planar ones a cage produces.
    for (let index = 1; index < face.length - 1; index += 1) {
      lines.push(`facet normal ${round(normal[0])} ${round(normal[1])} ${round(normal[2])}`);
      lines.push("  outer loop");
      for (const vertex of [face[0], face[index], face[index + 1]]) {
        const [x, y, z] = mesh.positions[vertex];
        lines.push(`    vertex ${round(x)} ${round(y)} ${round(z)}`);
      }
      lines.push("  endloop");
      lines.push("endfacet");
    }
  }
  lines.push(`endsolid ${solid}`);
  return `${lines.join("\n")}\n`;
}

/**
 * Reads ASCII or binary STL.
 *
 * The corners arrive unshared, so the result is welded — without that every
 * triangle is its own island, the mesh reports itself as entirely boundary, and
 * nothing downstream works.
 */
export function fromStl(source: string | ArrayBuffer, weldTolerance = 1e-5): EditableMesh {
  const positions: Vec3[] = [];
  const faces: number[][] = [];

  // File.arrayBuffer() does not imply binary STL. Cast and native file inputs
  // provide bytes for both encodings. An exact binary record count wins even
  // when its arbitrary 80-byte header starts with "solid".
  if (typeof source !== "string") {
    const exactBinary = source.byteLength >= 84
      && 84 + new DataView(source).getUint32(80, true) * 50 === source.byteLength;
    const prefix = new TextDecoder().decode(source.slice(0, 80));
    if (!exactBinary && /^\s*solid\b/.test(prefix)) {
      const text = new TextDecoder().decode(source);
      let textLike = true;
      for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 0xfffd) { textLike = false; break; }
      }
      if (textLike && /facet\s+normal/.test(text)) source = text;
    }
  }

  if (typeof source === "string" && /^\s*solid/.test(source) && /facet\s+normal/.test(source)) {
    let corner: number[] = [];
    for (const raw of source.split(/\r?\n/)) {
      const parts = raw.trim().split(/\s+/);
      if (parts[0] === "vertex" && parts.length >= 4) {
        corner.push(positions.length);
        positions.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
      } else if (parts[0] === "endloop") {
        if (corner.length >= 3) faces.push([...corner]);
        corner = [];
      }
    }
  } else {
    const buffer = typeof source === "string" ? stringToBuffer(source) : source;
    const view = new DataView(buffer);
    if (buffer.byteLength < 84) return { positions: [], faces: [] };
    const count = view.getUint32(80, true);
    // A truncated file would otherwise read past the end and throw.
    const available = Math.min(count, Math.floor((buffer.byteLength - 84) / 50));
    for (let triangle = 0; triangle < available; triangle += 1) {
      const base = 84 + triangle * 50;
      const corner: number[] = [];
      for (let point = 0; point < 3; point += 1) {
        const offset = base + 12 + point * 12;
        corner.push(positions.length);
        positions.push([
          view.getFloat32(offset, true),
          view.getFloat32(offset + 4, true),
          view.getFloat32(offset + 8, true),
        ]);
      }
      faces.push(corner);
    }
  }
  return compactMesh(weldVertices({ positions, faces }, weldTolerance));
}

function stringToBuffer(text: string): ArrayBuffer {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff;
  return bytes.buffer;
}

// --- glTF --------------------------------------------------------------------

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 without Buffer or btoa, so the writer runs anywhere. */
function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    out += BASE64[a >> 2];
    out += BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : BASE64[c & 63];
  }
  return out;
}

/**
 * glTF 2.0 with the buffer embedded as a data URI, so one file is the whole
 * asset.
 *
 * Positions are converted from the workspace's Z-up to glTF's mandated Y-up.
 * The rotation is (x, z, -y): what was "up" becomes +Y, and what was "forward"
 * becomes -Z, which is the same convention Blender's exporter uses and the
 * reason an exported file arrives upright rather than lying on its face.
 */
/** Low-level writer: positions must already be in metres (Z-up).
 * Use exportMesh for CAD/sculpt meshes stored in millimetres. */
export function toGltf(mesh: EditableMesh, name = "mesh", uvOfCorner?: readonly UV[][]): string {
  const { positions, normals, indices } = triangulate(mesh);

  // glTF attributes are per vertex, but a UV belongs to a *corner*. Where the
  // two disagree — a vertex on a seam — the vertex has to be split, keyed on the
  // pair. Its normal is unaffected, since that depends only on the position.
  const splitPositions: number[] = [];
  const splitNormals: number[] = [];
  const splitUvs: number[] = [];
  const splitIndices: number[] = [];
  const splitOf = new Map<string, number>();

  const cornerUv = new Map<string, UV>();
  if (uvOfCorner) {
    mesh.faces.forEach((face, faceIndex) => {
      face.forEach((vertex, corner) => {
        const uv = uvOfCorner[faceIndex]?.[corner];
        if (uv) cornerUv.set(`${faceIndex}:${vertex}`, uv);
      });
    });
  }

  const { faceOfTriangle } = triangulate(mesh);
  for (let triangle = 0; triangle * 3 < indices.length; triangle += 1) {
    const faceIndex = faceOfTriangle[triangle];
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = indices[triangle * 3 + corner];
      const uv = cornerUv.get(`${faceIndex}:${vertex}`) ?? [0, 0];
      const key = `${vertex}:${uv[0]}:${uv[1]}`;
      let split = splitOf.get(key);
      if (split === undefined) {
        split = splitPositions.length / 3;
        splitPositions.push(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]);
        splitNormals.push(normals[vertex * 3], normals[vertex * 3 + 1], normals[vertex * 3 + 2]);
        splitUvs.push(uv[0], uv[1]);
        splitOf.set(key, split);
      }
      splitIndices.push(split);
    }
  }

  const count = splitPositions.length / 3;
  const vertexData = new Float32Array(count * 3);
  const normalData = new Float32Array(count * 3);
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];

  for (let index = 0; index < count; index += 1) {
    const yUp = [splitPositions[index * 3], splitPositions[index * 3 + 2], -splitPositions[index * 3 + 1]];
    for (let axis = 0; axis < 3; axis += 1) {
      vertexData[index * 3 + axis] = yUp[axis];
      min[axis] = Math.min(min[axis], yUp[axis]);
      max[axis] = Math.max(max[axis], yUp[axis]);
    }
    normalData[index * 3] = splitNormals[index * 3];
    normalData[index * 3 + 1] = splitNormals[index * 3 + 2];
    normalData[index * 3 + 2] = -splitNormals[index * 3 + 1];
  }

  const uvData = new Float32Array(splitUvs);
  const indexData = new Uint32Array(splitIndices);
  const parts = [
    new Uint8Array(vertexData.buffer, vertexData.byteOffset, vertexData.byteLength),
    new Uint8Array(normalData.buffer, normalData.byteOffset, normalData.byteLength),
    new Uint8Array(indexData.buffer, indexData.byteOffset, indexData.byteLength),
    ...(uvOfCorner ? [new Uint8Array(uvData.buffer, uvData.byteOffset, uvData.byteLength)] : []),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const blob = new Uint8Array(total);
  let offset = 0;
  const offsets: number[] = [];
  for (const part of parts) {
    offsets.push(offset);
    blob.set(part, offset);
    offset += part.length;
  }

  const gltf = {
    asset: { version: "2.0", generator: "Form Studio" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: clean(name) }],
    meshes: [{
      name: clean(name),
      primitives: [{
        attributes: uvOfCorner ? { POSITION: 0, NORMAL: 1, TEXCOORD_0: 3 } : { POSITION: 0, NORMAL: 1 },
        indices: 2,
        mode: 4,
      }],
    }],
    buffers: [{ byteLength: total, uri: `data:application/octet-stream;base64,${toBase64(blob)}` }],
    bufferViews: [
      { buffer: 0, byteOffset: offsets[0], byteLength: parts[0].length, target: 34962 },
      { buffer: 0, byteOffset: offsets[1], byteLength: parts[1].length, target: 34962 },
      { buffer: 0, byteOffset: offsets[2], byteLength: parts[2].length, target: 34963 },
      ...(uvOfCorner ? [{ buffer: 0, byteOffset: offsets[3], byteLength: parts[3].length, target: 34962 }] : []),
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count, type: "VEC3", min, max },
      { bufferView: 1, componentType: 5126, count, type: "VEC3" },
      { bufferView: 2, componentType: 5125, count: indexData.length, type: "SCALAR" },
      ...(uvOfCorner ? [{ bufferView: 3, componentType: 5126, count, type: "VEC2" }] : []),
    ],
  };
  return JSON.stringify(gltf, null, 2);
}

// --- the front door ----------------------------------------------------------

export function exportMesh(
  mesh: EditableMesh,
  format: MeshExportFormat,
  name = "mesh",
  uvOfCorner?: readonly UV[][],
): { text: string; filename: string; mimeType: string } {
  const entry = MESH_EXPORT_FORMATS.find((candidate) => candidate.id === format)!;
  // PLY and STL have no place to put texture coordinates, so they are written
  // without them rather than pretending otherwise.
  const text = format === "obj" ? toObj(mesh, name, uvOfCorner)
    : format === "ply" ? toPly(mesh)
    : format === "stl" ? toStl(mesh, name)
    : format === "gltf" ? toGltf({
      positions: mesh.positions.map(([x, y, z]) => [x / 1000, y / 1000, z / 1000]),
      faces: mesh.faces,
    }, name, uvOfCorner)
    : toUsd(mesh, name);
  return { text, filename: `${clean(name)}.${entry.extension}`, mimeType: entry.mimeType };
}

export type MeshImportFormat = "obj" | "ply" | "stl" | "usd";
export type MeshImportUnit = "mm" | "cm" | "m" | "in" | "ft";

export const MESH_IMPORT_UNIT_TO_MM: Record<MeshImportUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

/** Picks the parser from the file name, since the contents of an STL vary. */
export function importMesh(filename: string, contents: string | ArrayBuffer, options: { unit?: MeshImportUnit } = {}): EditableMesh {
  const extension = filename.toLowerCase().split(".").pop();
  let mesh: EditableMesh;
  if (extension === "stl") mesh = fromStl(contents);
  else if (extension === "obj") {
    if (typeof contents !== "string") throw new Error("An OBJ file must be read as text");
    mesh = fromObj(contents);
  } else if (extension === "ply") {
    if (typeof contents !== "string") throw new Error("An ASCII PLY file must be read as text");
    mesh = fromPly(contents);
  } else if (extension === "usd" || extension === "usda") {
    if (typeof contents !== "string") throw new Error("An OpenUSD ASCII file must be read as text");
    mesh = fromUsd(contents);
  } else throw new Error(`Cannot read a ${extension ?? "file"} — OBJ, PLY, STL and OpenUSD ASCII are supported`);
  const scale = extension === "usd" || extension === "usda" ? 1 : MESH_IMPORT_UNIT_TO_MM[options.unit ?? "mm"];
  if (scale === 1) return mesh;
  return { ...mesh, positions: mesh.positions.map(([x, y, z]) => [x * scale, y * scale, z * scale]) };
}
