import assert from "node:assert/strict";
import test from "node:test";
import {
  MESH_EXPORT_FORMATS,
  exportMesh,
  fromObj,
  fromPly,
  fromStl,
  fromUsd,
  importMesh,
  toGltf,
  toObj,
  toPly,
  toStl,
  toUsd,
} from "../app/mesh-interchange.ts";
import { createBox, createCylinder, isClosed, meshVolume } from "../app/mesh-kernel.ts";
import { unwrapMesh } from "../app/mesh-uv.ts";

const near = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected}, got ${actual}`);

// --- OBJ ---------------------------------------------------------------------

test("OBJ keeps quads, which is the whole reason it is the preferred round trip", () => {
  const box = createBox(20, 20, 20);
  const text = toObj(box, "block");

  assert.match(text, /^o block$/m);
  assert.equal(text.split("\n").filter((line) => line.startsWith("v ")).length, 8);
  const faces = text.split("\n").filter((line) => line.startsWith("f "));
  assert.equal(faces.length, 6);
  assert.ok(faces.every((line) => line.split(/\s+/).length === 5), "four corners each, not triangulated");
});

test("an OBJ round trip returns the same solid", () => {
  const box = createBox(20, 20, 20);
  const restored = fromObj(toObj(box));

  assert.deepEqual(restored.faces, box.faces);
  assert.equal(isClosed(restored), true);
  near(meshVolume(restored), meshVolume(box));
});

test("a cylinder's n-gon caps survive the round trip as n-gons", () => {
  const cylinder = createCylinder(10, 20, 8);
  const restored = fromObj(toObj(cylinder));
  assert.deepEqual(restored.faces.map((face) => face.length), cylinder.faces.map((face) => face.length));

  // Positions are written to six decimal places — a nanometre in millimetres —
  // so a cylinder's irrational corners come back very slightly moved. The check
  // is relative, because an absolute one just measures how big the part is.
  const before = meshVolume(cylinder);
  assert.ok(Math.abs(meshVolume(restored) - before) / before < 1e-7);
});

test("OBJ corners with texture and normal indices are read for their position only", () => {
  const mesh = fromObj([
    "v 0 0 0", "v 1 0 0", "v 1 1 0", "v 0 1 0",
    "f 1/1/1 2/2/1 3/3/1 4/4/1",
  ].join("\n"));
  assert.equal(mesh.positions.length, 4);
  assert.deepEqual(mesh.faces, [[0, 1, 2, 3]]);

  const doubleSlash = fromObj(["v 0 0 0", "v 1 0 0", "v 1 1 0", "f 1//1 2//1 3//1"].join("\n"));
  assert.deepEqual(doubleSlash.faces, [[0, 1, 2]]);
});

test("negative OBJ indices count back from the end", () => {
  // Legal, uncommon, and routinely mis-parsed.
  const mesh = fromObj(["v 0 0 0", "v 1 0 0", "v 1 1 0", "f -3 -2 -1"].join("\n"));
  assert.deepEqual(mesh.faces, [[0, 1, 2]]);
});

test("comments, blank lines and unknown keywords are ignored rather than fatal", () => {
  const mesh = fromObj([
    "# a comment", "", "mtllib thing.mtl", "usemtl steel", "s off",
    "v 0 0 0", "v 1 0 0", "v 1 1 0", "vt 0 0", "vn 0 0 1",
    "f 1 2 3",
  ].join("\n"));
  assert.equal(mesh.positions.length, 3);
  assert.equal(mesh.faces.length, 1);
});

test("a face naming a vertex that does not exist is dropped, not kept as a crash", () => {
  const mesh = fromObj(["v 0 0 0", "v 1 0 0", "v 1 1 0", "f 1 2 99"].join("\n"));
  assert.deepEqual(mesh.faces, []);
});

// --- PLY ---------------------------------------------------------------------

test("PLY writes a header that matches its body, and keeps n-gons", () => {
  const cylinder = createCylinder(10, 20, 6);
  const text = toPly(cylinder);
  const lines = text.trim().split("\n");
  const header = lines.indexOf("end_header");

  assert.match(text, /^ply\nformat ascii 1\.0/);
  assert.match(text, new RegExp(`element vertex ${cylinder.positions.length}`));
  assert.match(text, new RegExp(`element face ${cylinder.faces.length}`));
  assert.equal(lines.length - header - 1, cylinder.positions.length + cylinder.faces.length);

  // The caps are six-sided, and the count prefix says so.
  const faceLines = lines.slice(header + 1 + cylinder.positions.length);
  assert.ok(faceLines.some((line) => line.startsWith("6 ")));
});

test("an ASCII PLY round trip preserves a closed polygon solid", () => {
  const box = createBox(20, 20, 20);
  const restored = fromPly(toPly(box));
  assert.deepEqual(restored.faces, box.faces);
  assert.equal(isClosed(restored), true);
  near(Math.abs(meshVolume(restored)), Math.abs(meshVolume(box)));
});

test("PLY import follows named vertex properties and ignores scan attributes", () => {
  const restored = fromPly([
    "ply", "format ascii 1.0", "element vertex 3",
    "property uchar red", "property float z", "property float x", "property float y",
    "element face 1", "property list uchar int vertex_indices", "end_header",
    "255 0 0 0", "128 0 1 0", "64 0 0 1", "3 0 1 2",
  ].join("\n"));
  assert.deepEqual(restored.positions, [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  assert.deepEqual(restored.faces, [[0, 1, 2]]);
});

test("PLY import rejects binary, truncated and invalid topology explicitly", () => {
  assert.throws(() => fromPly("ply\nformat binary_little_endian 1.0\nend_header\n"), /Only ASCII/);
  assert.throws(() => fromPly("ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n"), /truncated/);
  assert.throws(() => fromPly("ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_index\nend_header\n0 0 0\n3 0 1 2\n"), /missing vertex/);
});

// --- OpenUSD -----------------------------------------------------------------

test("OpenUSD ASCII round-trips n-gons, millimeter scale and Z-up metadata", () => {
  const cylinder = createCylinder(10, 20, 8);
  const text = toUsd(cylinder, "8 sided cylinder");
  assert.match(text, /^#usda 1\.0/);
  assert.match(text, /metersPerUnit = 0\.001/);
  assert.match(text, /upAxis = "Z"/);
  assert.match(text, /def Mesh "Mesh_8_sided_cylinder"/);
  const restored = fromUsd(text);
  assert.deepEqual(restored.faces.map((face) => face.length), cylinder.faces.map((face) => face.length));
  near(Math.abs(meshVolume(restored)), Math.abs(meshVolume(cylinder)), 1e-3);
});

test("OpenUSD import honors metersPerUnit and rejects malformed topology", () => {
  const meters = toUsd(createBox(1, 1, 1)).replace("metersPerUnit = 0.001", "metersPerUnit = 1");
  near(Math.abs(meshVolume(fromUsd(meters))), 1_000 ** 3, 1);
  assert.throws(() => fromUsd("#usda 1.0\ndef Mesh \"Broken\" {}"), /missing points/);
  assert.throws(() => fromUsd(toUsd(createBox(1, 1, 1)).replace("int[] faceVertexCounts = [4", "int[] faceVertexCounts = [3")), /do not match/);
});

// --- STL ---------------------------------------------------------------------

test("STL is triangles with a normal each, and a cube makes twelve", () => {
  const box = createBox(20, 20, 20);
  const text = toStl(box, "block");

  assert.match(text, /^solid block/);
  assert.match(text, /endsolid block\n$/);
  assert.equal((text.match(/facet normal/g) ?? []).length, 12);
  assert.equal((text.match(/vertex /g) ?? []).length, 36);
});

test("reading an ASCII STL welds the corners back into a solid", () => {
  // Every triangle in an STL carries its own copy of each corner. Without the
  // weld each one is its own island and nothing downstream works.
  const box = createBox(20, 20, 20);
  const restored = fromStl(toStl(box));

  assert.equal(restored.positions.length, 8, "the copies should have fused");
  assert.equal(restored.faces.length, 12, "still triangles — STL cannot carry quads");
  assert.equal(isClosed(restored), true);
  near(Math.abs(meshVolume(restored)), 8000, 1e-3);
});

test("ASCII STL browser file bytes preserve geometry and explicit units", () => {
  const text = toStl(createBox(2, 1, 0.4), "browser-file-é");
  for (const content of [text, text.replaceAll("\n", "\r\n"), "\ufeff" + text]) {
    const bytes = new TextEncoder().encode(content).buffer;
    const restored = importMesh("reference-box.stl", bytes, { unit: "cm" });
    assert.equal(restored.faces.length, 12);
    assert.equal(isClosed(restored), true);
    const extent = [0, 1, 2].map(axis => Math.max(...restored.positions.map(p => p[axis])) - Math.min(...restored.positions.map(p => p[axis])));
    extent.forEach((value, axis) => near(value, [20, 10, 4][axis]));
    near(Math.abs(meshVolume(restored)), 800, 1e-4);
  }
});

test("a binary STL is read too, and the two encodings agree", () => {
  const box = createBox(20, 20, 20);
  const view = new DataView(new ArrayBuffer(84 + 12 * 50));
  view.setUint32(80, 12, true);

  // Re-encode the ASCII triangles as binary, then check both parse the same.
  const corners = toStl(box).split("\n")
    .filter((line) => line.trim().startsWith("vertex "))
    .map((line) => line.trim().split(/\s+/).slice(1).map(Number));
  corners.forEach((point, index) => {
    const base = 84 + Math.floor(index / 3) * 50 + 12 + (index % 3) * 12;
    point.forEach((value, axis) => view.setFloat32(base + axis * 4, value, true));
  });

  // Binary STL headers are arbitrary text; "solid" is not enough to
  // classify the file as ASCII, even with other ASCII STL keywords present.
  new Uint8Array(view.buffer).set(new TextEncoder().encode("solid facet normal vertex endloop"));
  const binary = fromStl(view.buffer);
  assert.equal(binary.positions.length, 8);
  assert.equal(binary.faces.length, 12);
  near(Math.abs(meshVolume(binary)), 8000, 1e-2);
});

test("a truncated binary STL reads what is there rather than running off the end", () => {
  const view = new DataView(new ArrayBuffer(84 + 50));
  view.setUint32(80, 500, true, "the header claims far more than the file holds");
  const mesh = fromStl(view.buffer);
  assert.ok(mesh.faces.length <= 1);
});

test("a file too short to be an STL yields nothing rather than throwing", () => {
  assert.deepEqual(fromStl(new ArrayBuffer(10)), { positions: [], faces: [] });
});

// --- glTF --------------------------------------------------------------------

test("glTF is valid JSON with the buffer embedded, so one file is the whole asset", () => {
  const box = createBox(20, 20, 20);
  const gltf = JSON.parse(toGltf(box, "block"));

  assert.equal(gltf.asset.version, "2.0");
  assert.equal(gltf.meshes[0].primitives[0].mode, 4, "triangles");
  assert.equal(gltf.buffers.length, 1);
  assert.match(gltf.buffers[0].uri, /^data:application\/octet-stream;base64,/);

  // The accessors have to agree with the views they read, or a viewer rejects it.
  assert.equal(gltf.accessors.length, 3);
  assert.equal(gltf.accessors[0].type, "VEC3");
  assert.equal(gltf.accessors[0].count, box.positions.length);
  assert.equal(gltf.accessors[2].count, 36, "twelve triangles");
  assert.equal(
    gltf.buffers[0].byteLength,
    gltf.bufferViews.reduce((total, view) => total + view.byteLength, 0),
  );
});

test("glTF is converted to Y-up, since the spec mandates it", () => {
  // A slab lying flat in the workspace's Z-up world is 40 wide, 40 deep and 2
  // tall. In glTF that height has to appear on Y, not Z, or it opens on its face.
  const slab = createBox(40, 40, 2);
  const gltf = JSON.parse(toGltf(slab));
  const [minX, minY, minZ] = gltf.accessors[0].min;
  const [maxX, maxY, maxZ] = gltf.accessors[0].max;

  near(maxX - minX, 40);
  near(maxY - minY, 2, 1e-5, "the workspace's Z becomes glTF's Y");
  near(maxZ - minZ, 40);
});

test("the embedded base64 decodes to exactly the byte length claimed", () => {
  const gltf = JSON.parse(toGltf(createBox(2, 2, 2)));
  const base64 = gltf.buffers[0].uri.split(",")[1];
  assert.equal(Buffer.from(base64, "base64").length, gltf.buffers[0].byteLength);
});

// --- the front door ----------------------------------------------------------

test("every offered format writes something, with the right name and type", () => {
  const box = createBox(10, 10, 10);
  for (const format of MESH_EXPORT_FORMATS) {
    const written = exportMesh(box, format.id, "my part");
    assert.equal(written.filename, `my-part.${format.extension}`, "spaces are not filename material");
    assert.equal(written.mimeType, format.mimeType);
    assert.ok(written.text.length > 50, `${format.id} wrote almost nothing`);
  }
});

test("a name that is all punctuation still yields a usable filename", () => {
  assert.equal(exportMesh(createBox(1, 1, 1), "obj", "///").filename, "mesh.obj");
});

test("importing picks the parser from the extension and refuses what it cannot read", () => {
  const box = createBox(10, 10, 10);
  assert.equal(importMesh("part.obj", toObj(box)).faces.length, 6);
  assert.equal(importMesh("part.ply", toPly(box)).faces.length, 6);
  assert.equal(importMesh("part.usda", toUsd(box), { unit: "in" }).faces.length, 6, "OpenUSD declares its own scale");
  assert.equal(importMesh("PART.STL", toStl(box)).faces.length, 12, "the extension is case-insensitive");

  assert.throws(() => importMesh("part.3dm", "anything"), /OBJ, PLY, STL and OpenUSD ASCII are supported/);
  assert.throws(() => importMesh("part.obj", new ArrayBuffer(4)), /read as text/);
});

test("unitless OBJ and STL imports are explicitly converted to workspace millimeters", () => {
  const inchBox = createBox(1, 1, 1);
  const obj = importMesh("inch-part.obj", toObj(inchBox), { unit: "in" });
  const stl = importMesh("inch-part.stl", toStl(inchBox), { unit: "in" });
  near(Math.abs(meshVolume(obj)), 25.4 ** 3, 1e-3);
  near(Math.abs(meshVolume(stl)), 25.4 ** 3, 1e-2);
  assert.equal(importMesh("millimeter-part.obj", toObj(inchBox), { unit: "mm" }).positions[0][0], inchBox.positions[0][0]);
});

// --- texture coordinates -----------------------------------------------------

test("OBJ carries UVs per corner, which is what a seam needs", () => {
  const box = createBox(20, 20, 20);
  const unwrap = unwrapMesh(box);
  const text = toObj(box, "block", unwrap.uvOfCorner);

  const vt = text.split("\n").filter((line) => line.startsWith("vt "));
  assert.ok(vt.length >= 8, `expected texture coordinates, got ${vt.length}`);

  // Faces now reference both a position and a texture coordinate.
  const faces = text.split("\n").filter((line) => line.startsWith("f "));
  assert.ok(faces.every((line) => /^f( \d+\/\d+){4}$/.test(line)), faces[0]);

  // A cube corner belongs to three faces on three charts, so it must appear
  // with three different vt indices — the whole reason OBJ indexes them apart.
  const corner = 7;
  const used = new Set();
  box.faces.forEach((face, faceIndex) => {
    const at = face.indexOf(corner);
    if (at < 0) return;
    used.add(faces[faceIndex].split(/\s+/)[at + 1].split("/")[1]);
  });
  assert.equal(used.size, 3);
});

test("OBJ without UVs still writes bare position indices", () => {
  const text = toObj(createBox(10, 10, 10));
  assert.ok(!text.includes("vt "));
  assert.ok(text.split("\n").filter((line) => line.startsWith("f ")).every((line) => !line.includes("/")));
});

test("glTF splits vertices where a seam gives one corner two UVs", () => {
  const box = createBox(20, 20, 20);
  const unwrap = unwrapMesh(box);
  const plain = JSON.parse(toGltf(box));
  const textured = JSON.parse(toGltf(box, "block", unwrap.uvOfCorner));

  assert.equal(plain.meshes[0].primitives[0].attributes.TEXCOORD_0, undefined);
  assert.equal(textured.meshes[0].primitives[0].attributes.TEXCOORD_0, 3);

  const uv = textured.accessors[3];
  assert.equal(uv.type, "VEC2");
  // Every corner of the cube is on three charts, so eight vertices become
  // twenty-four. A viewer given fewer would smear the texture across seams.
  assert.equal(uv.count, 24);
  assert.equal(textured.accessors[0].count, 24, "positions must match the UVs one for one");
  assert.equal(
    textured.buffers[0].byteLength,
    textured.bufferViews.reduce((total, view) => total + view.byteLength, 0),
  );
});

test("exporting passes UVs to the formats that can hold them and not to the others", () => {
  const box = createBox(10, 10, 10);
  const unwrap = unwrapMesh(box);

  assert.ok(exportMesh(box, "obj", "part", unwrap.uvOfCorner).text.includes("vt "));
  assert.ok(exportMesh(box, "gltf", "part", unwrap.uvOfCorner).text.includes("TEXCOORD_0"));
  // PLY and STL have nowhere to put them; they must not gain a broken header.
  assert.ok(!exportMesh(box, "ply", "part", unwrap.uvOfCorner).text.includes("texture"));
  assert.match(exportMesh(box, "stl", "part", unwrap.uvOfCorner).text, /^solid part/);
});
