"use client";

/**
 * Cast — print and cast prep for jewelry (alpha).
 *
 * A review workspace, like Ghost Studio: it reads a model, runs checks, and
 * writes a prepared STL, but it never edits the open document. Repairs and
 * orientation apply to Cast's own working copy so a user can try them, undo
 * them, and export without touching their design history.
 *
 * Wording matters here: these are checks to discuss with a caster or printer,
 * never a sign-off. tests/cast-prep.test.mjs fails the build if this file
 * starts promising more than that.
 */

import { offerLocker } from "./suite-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  basicRepair, castMeshFromEditable, meshHealth, triangleCount, writeBinaryStl, type CastMesh, type RepairStep,
} from "./cast-mesh";
import {
  createThicknessContext, estimateRingInnerDiameter, measureThicknessRange, overhangAnalysis, placeForPrint,
  precomputeOverhang, suggestOrientations, summarizeThickness, type OrientationCandidate, type PrintOrientation,
  type ThicknessContext,
} from "./cast-analysis";
import { CAST_GUIDANCE_LABEL, CAST_MATERIALS, estimatedWeightGrams, type CastMaterialId } from "./cast-materials";
import {
  RING_SIZE_SYSTEMS, UK_RING_SIZE_LABELS, nearestRingSize, ringSizeReading, type RingSizeSystem,
} from "./cast-ring-size";
import { importMesh, MESH_IMPORT_UNIT_TO_MM, type MeshImportUnit } from "./mesh-interchange";

export type CastSource = { id: string; name: string; origin: "sculpt" | "exact" | "file"; mesh: CastMesh; note?: string };
type Tab = "ring" | "thickness" | "health" | "print";

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const fmt = (value: number, digits = 2) => (Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—");

// --- preview ---------------------------------------------------------------------

type Overlay = {
  lines?: { positions: Float32Array; color: string }[];
  points?: { positions: Float32Array; color: string };
  plate?: boolean;
};

function CastPreview({ mesh, faceColors, baseColor, overlay, frameKey }: { mesh: CastMesh; faceColors: Float32Array | null; baseColor: string; overlay: Overlay; frameKey: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; orbit: OrbitControls; content: THREE.Group; draw: () => void } | null>(null);
  const framed = useRef("");

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer | undefined, orbit: OrbitControls | undefined, observer: ResizeObserver | undefined;
    let fallback: HTMLParagraphElement | undefined;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.domElement.setAttribute("aria-label", "Cast 3D preview");
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color("#f1f3ec");
      scene.add(new THREE.HemisphereLight(0xffffff, 0x606955, 2));
      const light = new THREE.DirectionalLight(0xffffff, 2.6); light.position.set(1, -1, 3); scene.add(light);
      const content = new THREE.Group(); scene.add(content);
      const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 10000); camera.up.set(0, 0, 1);
      orbit = new OrbitControls(camera, renderer.domElement);
      const r = renderer;
      const draw = () => r.render(scene, camera);
      const resize = () => {
        const w = Math.max(1, element.clientWidth), h = Math.max(1, element.clientHeight);
        r.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); draw();
      };
      orbit.addEventListener("change", draw);
      observer = new ResizeObserver(resize); observer.observe(element); resize();
      view.current = { renderer: r, scene, camera, orbit, content, draw };
    } catch {
      renderer?.domElement.remove();
      fallback = document.createElement("p");
      fallback.setAttribute("role", "status");
      fallback.textContent = "3D preview is unavailable on this device. The checks and export still work.";
      element.appendChild(fallback);
    }
    return () => {
      observer?.disconnect(); orbit?.dispose();
      view.current?.content.traverse((object) => {
        const item = object as THREE.Mesh;
        item.geometry?.dispose();
        (Array.isArray(item.material) ? item.material : item.material ? [item.material] : []).forEach((material) => material.dispose());
      });
      renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove(); fallback?.remove();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const current = view.current;
    if (!current) return;
    const { content, camera, orbit, draw } = current;
    for (const child of [...content.children]) {
      content.remove(child);
      child.traverse((object) => {
        const item = object as THREE.Mesh;
        item.geometry?.dispose();
        (Array.isArray(item.material) ? item.material : item.material ? [item.material] : []).forEach((material) => material.dispose());
      });
    }
    const count = triangleCount(mesh);
    // Unindexed so each triangle can carry its own colour in the check views.
    const positions = new Float32Array(count * 9);
    for (let k = 0; k < count * 3; k += 1) {
      const v = mesh.indices[k] * 3;
      positions[k * 3] = mesh.positions[v]; positions[k * 3 + 1] = mesh.positions[v + 1]; positions[k * 3 + 2] = mesh.positions[v + 2];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (faceColors) {
      const colors = new Float32Array(count * 9);
      for (let t = 0; t < count; t += 1) for (let c = 0; c < 3; c += 1) colors.set(faceColors.subarray(t * 3, t * 3 + 3), t * 9 + c * 3);
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: faceColors ? "#ffffff" : baseColor, vertexColors: !!faceColors, roughness: faceColors ? 0.8 : 0.38, metalness: faceColors ? 0 : 0.35, side: THREE.DoubleSide });
    content.add(new THREE.Mesh(geometry, material));
    for (const line of overlay.lines ?? []) {
      if (line.positions.length === 0) continue;
      const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute("position", new THREE.BufferAttribute(line.positions, 3));
      content.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: line.color, depthTest: false })));
    }
    if (overlay.points && overlay.points.positions.length) {
      const pointGeometry = new THREE.BufferGeometry(); pointGeometry.setAttribute("position", new THREE.BufferAttribute(overlay.points.positions, 3));
      content.add(new THREE.Points(pointGeometry, new THREE.PointsMaterial({ color: overlay.points.color, size: 7, sizeAttenuation: false, depthTest: false })));
    }
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
    const centre = bounds.getCenter(new THREE.Vector3()), radius = Math.max(0.5, bounds.getSize(new THREE.Vector3()).length() / 2);
    if (overlay.plate) {
      const grid = new THREE.GridHelper(Math.ceil(radius * 3), 12, "#9aa38c", "#cfd5c4");
      grid.rotation.x = Math.PI / 2; grid.position.set(0, 0, 0);
      content.add(grid);
    }
    if (framed.current !== frameKey) {
      framed.current = frameKey;
      camera.near = radius / 500; camera.far = radius * 60; camera.updateProjectionMatrix();
      orbit.target.copy(centre);
      camera.position.copy(centre).add(new THREE.Vector3(1, -1.25, 0.9).normalize().multiplyScalar(radius * 3.2));
      orbit.update();
    }
    draw();
  }, [mesh, faceColors, baseColor, overlay, frameKey]);

  return <div className="cast-preview" ref={host} />;
}

// --- colour maps --------------------------------------------------------------

const rgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
};
const COLORS = { thin: rgb("#d8452b"), marginal: rgb("#e8a33a"), ok: rgb("#7fb24a"), thick: rgb("#3f8f7a"), unknown: rgb("#a3a89b"), neutral: rgb("#c9cdbf"), inverted: rgb("#8b5cf6"), overhang: rgb("#e0603a"), plate: rgb("#4c83d4") };

function thicknessColors(values: Float32Array, minWall: number, minProng: number): Float32Array {
  const out = new Float32Array(values.length * 3);
  const top = Math.max(minProng, minWall) * 3;
  for (let t = 0; t < values.length; t += 1) {
    const value = values[t];
    let color = COLORS.unknown;
    if (Number.isFinite(value)) {
      if (value < minWall) color = COLORS.thin;
      else if (value < minProng) color = COLORS.marginal;
      else {
        const mix = Math.min(1, (value - Math.max(minWall, minProng)) / Math.max(1e-9, top - Math.max(minWall, minProng)));
        color = [COLORS.ok[0] + (COLORS.thick[0] - COLORS.ok[0]) * mix, COLORS.ok[1] + (COLORS.thick[1] - COLORS.ok[1]) * mix, COLORS.ok[2] + (COLORS.thick[2] - COLORS.ok[2]) * mix];
      }
    }
    out.set(color, t * 3);
  }
  return out;
}

function stateColors(count: number, painted: Map<number, [number, number, number]> | ((t: number) => [number, number, number])): Float32Array {
  const out = new Float32Array(count * 3);
  for (let t = 0; t < count; t += 1) out.set(typeof painted === "function" ? painted(t) : painted.get(t) ?? COLORS.neutral, t * 3);
  return out;
}

function edgeSegments(mesh: CastMesh, pairs: Uint32Array): Float32Array {
  const out = new Float32Array(pairs.length * 3);
  for (let k = 0; k < pairs.length; k += 1) out.set(mesh.positions.subarray(pairs[k] * 3, pairs[k] * 3 + 3), k * 3);
  return out;
}

function circleSegments(centre: number[], axis: number[], radius: number): Float32Array {
  const helper = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let u = [axis[1] * helper[2] - axis[2] * helper[1], axis[2] * helper[0] - axis[0] * helper[2], axis[0] * helper[1] - axis[1] * helper[0]];
  const length = Math.hypot(u[0], u[1], u[2]); u = u.map((value) => value / length);
  const v = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
  const steps = 96, out = new Float32Array(steps * 6);
  const at = (k: number) => { const a = (k / steps) * Math.PI * 2; return [0, 1, 2].map((i) => centre[i] + radius * (Math.cos(a) * u[i] + Math.sin(a) * v[i])); };
  for (let k = 0; k < steps; k += 1) { out.set(at(k), k * 6); out.set(at(k + 1), k * 6 + 3); }
  return out;
}

function downloadBuffer(buffer: ArrayBuffer, name: string) {
  offerLocker(buffer, name, "model/stl", { kind: "cast-stl" });
  const url = URL.createObjectURL(new Blob([buffer], { type: "model/stl" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

const safeName = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "model";

// --- the workspace ------------------------------------------------------------------

export function CastStudio({ sources, onClose, onStatus }: { sources: CastSource[]; onClose: () => void; onStatus?: (message: string) => void }) {
  const dialog = useRef<HTMLElement>(null), fileInput = useRef<HTMLInputElement>(null);
  const [fileSources, setFileSources] = useState<CastSource[]>([]);
  const allSources = useMemo(() => [...fileSources, ...sources], [fileSources, sources]);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const source = allSources.find((item) => item.id === sourceId) ?? allSources[0] ?? null;
  const [unit, setUnit] = useState<MeshImportUnit>("mm");
  const [loading, setLoading] = useState(""), [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("ring");
  const [repaired, setRepaired] = useState<{ sourceId: string; mesh: CastMesh; log: string[] } | null>(null);
  const working = repaired && repaired.sourceId === source?.id ? repaired.mesh : source?.mesh ?? null;
  const repairLog = repaired && repaired.sourceId === source?.id ? repaired.log : [];

  const [materialId, setMaterialId] = useState<CastMaterialId>("sterling-silver");
  const material = CAST_MATERIALS.find((item) => item.id === materialId)!;
  const [minWall, setMinWall] = useState(material.minWallMm), [minProng, setMinProng] = useState(material.minProngMm);
  const [system, setSystem] = useState<RingSizeSystem>("US"), [size, setSize] = useState<string>("7");
  const [orientation, setOrientation] = useState<PrintOrientation>({ tiltXDeg: 0, tiltYDeg: 0 });
  const [supportAngle, setSupportAngle] = useState(30);
  const [suggestions, setSuggestions] = useState<OrientationCandidate[]>([]);
  const [thickness, setThickness] = useState<{ mesh: CastMesh; values: Float32Array; context: Pick<ThicknessContext, "areas" | "topology" | "rays"> } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const runToken = useRef(0);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => { runToken.current += 1; if (previous?.isConnected) previous.focus(); };
  }, []);

  const health = useMemo(() => (working ? meshHealth(working) : null), [working]);
  const ringFit = useMemo(() => (working && tab === "ring" ? estimateRingInnerDiameter(working) : null), [working, tab]);
  const target = useMemo(() => { try { return { reading: ringSizeReading(system, system === "UK" ? size : Number(size)), error: "" }; } catch (failure) { return { reading: null, error: failure instanceof Error ? failure.message : "Unknown size" }; } }, [system, size]);
  const overhangPre = useMemo(() => (working && tab === "print" ? precomputeOverhang(working) : null), [working, tab]);
  const overhang = useMemo(() => (working && overhangPre ? overhangAnalysis(working, orientation, { supportAngleDeg: supportAngle }, overhangPre) : null), [working, overhangPre, orientation, supportAngle]);
  const placed = useMemo(() => (working && tab === "print" ? placeForPrint(working, orientation) : null), [working, tab, orientation]);
  const currentThickness = thickness && thickness.mesh === working ? thickness : null;
  const thicknessSummary = useMemo(() => (currentThickness ? summarizeThickness(currentThickness.context, currentThickness.values, minWall, minProng) : null), [currentThickness, minWall, minProng]);

  const chooseMaterial = (id: CastMaterialId) => {
    const next = CAST_MATERIALS.find((item) => item.id === id)!;
    setMaterialId(id); setMinWall(next.minWallMm); setMinProng(next.minProngMm);
  };

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!/\.(stl|obj)$/i.test(file.name)) return setError("Choose an STL or OBJ file.");
    if (file.size > MAX_FILE_BYTES) return setError("Files up to 200 MB are supported in the browser.");
    setLoading(`Reading ${file.name}…`);
    try {
      const contents = /\.obj$/i.test(file.name) ? await file.text() : await file.arrayBuffer();
      const editable = importMesh(file.name, contents, { unit });
      if (editable.faces.length === 0) throw new Error(`${file.name} holds no triangles`);
      const item: CastSource = { id: `file-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ""), origin: "file", mesh: castMeshFromEditable(editable), note: `Opened as ${unit}; not added to your project` };
      setFileSources((current) => [item, ...current.filter((other) => other.name !== item.name)].slice(0, 3));
      setSourceId(item.id); setThickness(null); setSuggestions([]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This file could not be read");
    } finally { setLoading(""); }
  };

  const runThickness = () => {
    if (!working) return;
    const token = ++runToken.current;
    const mesh = working;
    setProgress(0);
    window.setTimeout(() => {
      if (token !== runToken.current) return;
      const context = createThicknessContext(mesh);
      const values = new Float32Array(triangleCount(mesh));
      let next = 0;
      const step = () => {
        if (token !== runToken.current) { context.raycaster.dispose(); return; }
        const deadline = performance.now() + 32;
        while (next < values.length && performance.now() < deadline) {
          const end = Math.min(values.length, next + 256);
          measureThicknessRange(context, next, end, values);
          next = end;
        }
        if (next < values.length) { setProgress(next / values.length); window.setTimeout(step, 0); return; }
        context.raycaster.dispose();
        setProgress(null);
        setThickness({ mesh, values, context: { areas: context.areas, topology: context.topology, rays: context.rays } });
      };
      step();
    }, 0);
  };

  const repair = (steps: RepairStep[]) => {
    if (!working || !source) return;
    const result = basicRepair(working, steps);
    setRepaired({ sourceId: source.id, mesh: result.mesh, log: [...repairLog, ...result.log] });
    setThickness(null); setSuggestions([]);
  };

  const exportStl = (applyOrientation: boolean) => {
    if (!working || !source) return;
    const mesh = applyOrientation ? placeForPrint(working, orientation) : working;
    const name = `${safeName(source.name)}-cast-prep.stl`;
    downloadBuffer(writeBinaryStl(mesh, `Form Studio Cast prep: ${source.name}`), name);
    onStatus?.(`${name} written · ${triangleCount(mesh).toLocaleString()} triangles · check it with your caster or slicer`);
  };

  const faceColors = useMemo(() => {
    if (!working) return null;
    const count = triangleCount(working);
    if (tab === "thickness" && currentThickness) return thicknessColors(currentThickness.values, minWall, minProng);
    if (tab === "health" && health && health.invertedTriangleList.length) {
      const inverted = new Map<number, [number, number, number]>();
      for (const t of health.invertedTriangleList) inverted.set(t, COLORS.inverted);
      return stateColors(count, inverted);
    }
    if (tab === "print" && overhang) return stateColors(count, (t) => (overhang.state[t] === 1 ? COLORS.overhang : overhang.state[t] === 2 ? COLORS.plate : COLORS.neutral));
    return null;
  }, [working, tab, currentThickness, minWall, minProng, health, overhang]);

  const overlay = useMemo<Overlay>(() => {
    if (!working) return {};
    if (tab === "health" && health) return { lines: [{ positions: edgeSegments(working, health.boundaryEdgeList), color: "#d8452b" }, { positions: edgeSegments(working, health.nonManifoldEdgeList), color: "#c026d3" }] };
    if (tab === "ring" && ringFit?.found) return { lines: [{ positions: circleSegments(ringFit.sliceCentre, ringFit.axis, ringFit.innerDiameterMm / 2), color: "#1f2a12" }] };
    if (tab === "print" && overhang && placed) {
      const points = new Float32Array(overhang.islandVertices.length * 3);
      overhang.islandVertices.forEach((v, k) => points.set(placed.positions.subarray(v * 3, v * 3 + 3), k * 3));
      return { points: { positions: points, color: "#b91c1c" }, plate: true };
    }
    return {};
  }, [working, tab, health, ringFit, overhang, placed]);

  const previewMesh = tab === "print" && placed ? placed : working;
  const weight = health ? estimatedWeightGrams(Math.abs(health.volumeMm3), material.density) : 0;
  const ringNearest = ringFit?.found ? nearestRingSize(system, ringFit.innerDiameterMm) : null;
  const ringDelta = ringFit?.found && target.reading ? ringFit.innerDiameterMm - target.reading.innerDiameterMm : Number.NaN;

  return <div className="cast-backdrop">
    <section className="cast-studio" role="dialog" aria-modal="true" aria-label="Cast print and cast prep" ref={dialog} tabIndex={-1} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const controls = [...(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not([hidden]),select,a[href]") ?? [])].filter((node) => node.tabIndex >= 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header className="cast-header">
        <div><b className="cast-mark">c</b><strong>cast<span>prep</span></strong><em className="cast-alpha">ALPHA</em><small>IN FORM</small><a className="cast-company-link" href="https://thecreatingco.com/" target="_blank" rel="noopener noreferrer" aria-label="The Creating Co. home" title="Visit The Creating Co.">The Creating Co.</a></div>
        <button aria-label="Close Cast" onClick={onClose}>×</button>
      </header>
      <nav className="cast-tabs" aria-label="Cast checks">{([["ring", "Ring size"], ["thickness", "Thickness"], ["health", "Mesh health"], ["print", "Resin print"]] as [Tab, string][]).map(([id, label]) => <button key={id} aria-pressed={tab === id} disabled={!working && id !== "ring"} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className="cast-body">
        <aside className="cast-controls">
          <p className="cast-eyebrow">MODEL</p>
          {allSources.length > 0 && <label className="cast-field">Check<select aria-label="Model to check" value={source?.id ?? ""} onChange={(event) => { setSourceId(event.target.value); setThickness(null); setSuggestions([]); }}>{allSources.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.origin === "file" ? "file" : item.origin === "exact" ? "exact body" : "mesh"}</option>)}</select></label>}
          <div className="cast-file-row">
            <button className="cast-secondary" onClick={() => fileInput.current?.click()}>Open STL / OBJ…</button>
            <select aria-label="File units" value={unit} onChange={(event) => setUnit(event.target.value as MeshImportUnit)}>{(Object.keys(MESH_IMPORT_UNIT_TO_MM) as MeshImportUnit[]).map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
          <input ref={fileInput} hidden aria-label="Choose STL or OBJ for Cast" type="file" accept=".stl,.obj,model/stl" onChange={(event) => { void openFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          {source?.note && <p className="cast-note">{source.note}</p>}
          <p className="cast-error" role="status">{loading || error}</p>

          {tab === "ring" && <section aria-label="Ring size">
            <p className="cast-eyebrow">TARGET SIZE</p>
            <label className="cast-field">Size system<select aria-label="Ring size system" value={system} onChange={(event) => { const next = event.target.value as RingSizeSystem; setSystem(next); setSize(next === "UK" ? "N½" : next === "EU" ? "54" : next === "JP" ? "14" : "7"); }}>{RING_SIZE_SYSTEMS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="cast-field">Size{system === "UK"
              ? <select aria-label="Ring size" value={size} onChange={(event) => setSize(event.target.value)}>{UK_RING_SIZE_LABELS.map((label) => <option key={label} value={label}>{label}</option>)}</select>
              : <input aria-label="Ring size" type="number" step={system === "US" ? 0.25 : 1} value={size} onChange={(event) => setSize(event.target.value)} />}</label>
            {target.reading ? <dl className="cast-readout"><dt>Inner diameter</dt><dd>{fmt(target.reading.innerDiameterMm)} mm</dd><dt>Inner circumference</dt><dd>{fmt(target.reading.innerCircumferenceMm)} mm</dd></dl> : <p className="cast-error">{target.error}</p>}
            <p className="cast-note">Sizing charts differ between makers by about 0.1–0.2 mm. Confirm with a physical ring sizer; wide or comfort-fit bands often feel tighter.</p>
          </section>}

          {tab === "thickness" && <section aria-label="Thickness check">
            <p className="cast-eyebrow">MINIMUMS · GUIDANCE</p>
            <label className="cast-field">Material preset<select aria-label="Material preset" value={materialId} onChange={(event) => chooseMaterial(event.target.value as CastMaterialId)}>{CAST_MATERIALS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="cast-field">Minimum wall <span>mm</span><input aria-label="Minimum wall thickness" type="number" min="0.05" max="20" step="0.05" value={minWall} onChange={(event) => setMinWall(Number(event.target.value))} /></label>
            <label className="cast-field">Minimum prong / wire <span>mm</span><input aria-label="Minimum prong thickness" type="number" min="0.05" max="20" step="0.05" value={minProng} onChange={(event) => setMinProng(Number(event.target.value))} /></label>
            <p className="cast-note">{CAST_GUIDANCE_LABEL} {material.note}</p>
            <button className="cast-primary" disabled={!working || progress !== null} onClick={runThickness}>{progress !== null ? "Measuring…" : currentThickness ? "Measure again" : "Run thickness check"}</button>
            {progress !== null && <progress aria-label="Thickness check progress" max={1} value={progress} />}
          </section>}

          {tab === "health" && <section aria-label="Repairs">
            <p className="cast-eyebrow">BASIC REPAIRS</p>
            <p className="cast-note">Repairs change Cast’s working copy only — your project is not edited.</p>
            <button className="cast-primary" disabled={!working} onClick={() => repair(["weld", "degenerate", "holes", "orient"])}>Run basic repair</button>
            <button className="cast-secondary" disabled={!working || !health || health.shells < 2} onClick={() => repair(["small-shells"])}>Remove loose pieces under 1% of the largest</button>
            <button className="cast-secondary" disabled={!repairLog.length} onClick={() => { setRepaired(null); setThickness(null); }}>Undo repairs</button>
            {repairLog.length > 0 && <ul className="cast-log" aria-label="Repair log">{repairLog.map((line, index) => <li key={index}>{line}</li>)}</ul>}
          </section>}

          {tab === "print" && <section aria-label="Print orientation">
            <p className="cast-eyebrow">ORIENTATION</p>
            <label className="cast-field">Tilt X <output>{orientation.tiltXDeg}°</output><input aria-label="Tilt X" type="range" min="-180" max="180" step="5" value={orientation.tiltXDeg} onChange={(event) => setOrientation((current) => ({ ...current, tiltXDeg: Number(event.target.value) }))} /></label>
            <label className="cast-field">Tilt Y <output>{orientation.tiltYDeg}°</output><input aria-label="Tilt Y" type="range" min="-90" max="90" step="5" value={orientation.tiltYDeg} onChange={(event) => setOrientation((current) => ({ ...current, tiltYDeg: Number(event.target.value) }))} /></label>
            <label className="cast-field">Support below <span>° from horizontal</span><input aria-label="Support angle" type="number" min="5" max="85" step="1" value={supportAngle} onChange={(event) => setSupportAngle(Math.min(85, Math.max(5, Number(event.target.value) || 30)))} /></label>
            <p className="cast-note">Guidance: many resins self-support down to roughly 20–30° from horizontal. Your resin’s own guide wins.</p>
            <button className="cast-secondary" disabled={!working} onClick={() => working && setSuggestions(suggestOrientations(working, { supportAngleDeg: supportAngle }, overhangPre ?? undefined))}>Suggest orientations</button>
            {suggestions.length > 0 && <div className="cast-suggestions" role="group" aria-label="Suggested orientations">{suggestions.map((item, index) => <button key={`${item.tiltXDeg}:${item.tiltYDeg}`} aria-pressed={orientation.tiltXDeg === item.tiltXDeg && orientation.tiltYDeg === item.tiltYDeg} onClick={() => setOrientation({ tiltXDeg: item.tiltXDeg, tiltYDeg: item.tiltYDeg })}><b>{index + 1}</b>X {item.tiltXDeg}° · Y {item.tiltYDeg}°<small>{fmt(item.overhangAreaMm2, 1)} mm² overhang · {item.islands} islands</small></button>)}</div>}
          </section>}
        </aside>

        <main className="cast-stage">
          <div className="cast-stage-heading"><strong>{source?.name ?? "Open a model to begin"}</strong><span>{tab === "thickness" ? "WALL THICKNESS MAP" : tab === "health" ? "OPEN EDGES · NON-MANIFOLD EDGES · INVERTED FACES" : tab === "print" ? "OVERHANGS · ISLANDS · BUILD PLATE" : "FINGER OPENING"}</span></div>
          <div className="cast-stage-view">
            {working && previewMesh ? <CastPreview mesh={previewMesh} faceColors={faceColors} baseColor={material.color} overlay={overlay} frameKey={`${source?.id}:${tab === "print" ? "print" : "model"}`} />
              : <div className="cast-empty"><strong>Nothing to check yet</strong><p>Select a body in Model, or open an STL or OBJ. Files stay on this device.</p></div>}
          </div>
          {tab === "thickness" && <ul className="cast-legend" aria-label="Thickness legend"><li><i style={{ background: "#d8452b" }} />under wall minimum</li><li><i style={{ background: "#e8a33a" }} />under prong minimum</li><li><i style={{ background: "#7fb24a" }} />above both</li><li><i style={{ background: "#a3a89b" }} />not measured</li></ul>}
          {tab === "print" && <ul className="cast-legend" aria-label="Overhang legend"><li><i style={{ background: "#e0603a" }} />needs support</li><li><i style={{ background: "#4c83d4" }} />on build plate</li><li><i style={{ background: "#b91c1c", borderRadius: "50%" }} />island (lowest point)</li></ul>}
          {tab === "health" && <ul className="cast-legend" aria-label="Health legend"><li><i style={{ background: "#d8452b" }} />open edge</li><li><i style={{ background: "#c026d3" }} />non-manifold edge</li><li><i style={{ background: "#8b5cf6" }} />inverted face</li></ul>}
          <p className="cast-hint">Drag to rotate · scroll or pinch to zoom</p>
        </main>

        <aside className="cast-details" aria-live="polite">
          <p className="cast-eyebrow">RESULTS · ESTIMATES</p>
          {!working && <p>Results appear here once a model is loaded.</p>}
          {working && tab === "ring" && (ringFit?.found ? <>
            <h3>Opening ≈ {fmt(ringFit.innerDiameterMm)} mm</h3>
            <dl><dt>Closest size</dt><dd>{ringNearest?.label} ({fmt(ringNearest?.innerDiameterMm ?? Number.NaN)} mm)</dd>
              {target.reading && <><dt>Against {target.reading.label}</dt><dd className={Math.abs(ringDelta) <= 0.1 ? "cast-pass" : "cast-warn"}>{Math.abs(ringDelta) < 0.005 ? "±" : ringDelta > 0 ? "+" : "−"}{fmt(Math.abs(ringDelta))} mm {Math.abs(ringDelta) <= 0.1 ? "· within 0.1 mm" : ringDelta > 0 ? "· larger than target" : "· smaller than target"}</dd></>}
              <dt>Circumference</dt><dd>{fmt(ringFit.circumferenceMm)} mm</dd>
              {ringFit.outOfRoundMm > 0.05 && <><dt>Clear opening</dt><dd className="cast-warn">{fmt(ringFit.clearDiameterMm)} mm · not round ({fmt(ringFit.outOfRoundMm)} mm spread)</dd></>}
            </dl>
            <p>Measured at the narrowest slice of the opening ({ringFit.validSlices} slices sampled); the dark outline in the preview shows which opening was found. {ringFit.message} Ask your caster whether they want shrinkage allowance built into the file.</p>
          </> : <p>{ringFit?.message ?? "Measuring…"}</p>)}
          {working && tab === "thickness" && (thicknessSummary ? <>
            <h3>Thinnest ≈ {fmt(thicknessSummary.minimumMm)} mm</h3>
            <dl>
              <dt>Under wall minimum ({fmt(minWall)} mm)</dt><dd className={thicknessSummary.areaBelowWallMm2 > 0 ? "cast-warn" : "cast-pass"}>{fmt(thicknessSummary.areaBelowWallMm2, 1)} mm² in {thicknessSummary.thinRegions} {thicknessSummary.thinRegions === 1 ? "region" : "regions"}</dd>
              <dt>Under prong minimum ({fmt(minProng)} mm)</dt><dd>{fmt(thicknessSummary.areaBelowProngMm2, 1)} mm²</dd>
              <dt>Typical wall (median)</dt><dd>{fmt(thicknessSummary.medianMm)} mm</dd>
              <dt>Surface measured</dt><dd>{fmt(thicknessSummary.measuredFraction * 100, 0)}% · {currentThickness?.context.rays === 5 ? "5 rays" : "1 ray"} per triangle</dd>
            </dl>
            <p>Red is under your wall minimum; amber is fine for a wall but under your prong minimum. Thin features smaller than the mesh’s triangles can be missed.</p>
          </> : <p>Run the check to map wall thickness. Large meshes take a few seconds; the page stays usable.</p>)}
          {working && tab === "health" && health && <>
            <h3>{health.closed && health.invertedTriangles === 0 ? "Closed and consistently wound" : "Needs attention"}</h3>
            <dl>
              <dt>Watertight</dt><dd className={health.closed ? "cast-pass" : "cast-warn"}>{health.closed ? "Yes" : `No · ${health.boundaryEdges.toLocaleString()} open edges in ${health.holes} ${health.holes === 1 ? "hole" : "holes"}`}</dd>
              <dt>Non-manifold edges</dt><dd className={health.nonManifoldEdges ? "cast-warn" : "cast-pass"}>{health.nonManifoldEdges.toLocaleString()}{health.nonManifoldEdges ? " · fix in your modeler; not auto-repaired" : ""}</dd>
              <dt>Inverted faces</dt><dd className={health.invertedTriangles ? "cast-warn" : "cast-pass"}>{health.invertedTriangles.toLocaleString()}{health.invertedShells ? ` · ${health.invertedShells} inside-out ${health.invertedShells === 1 ? "piece" : "pieces"}` : ""}</dd>
              <dt>Pieces (shells)</dt><dd className={health.shells > 1 ? "cast-warn" : ""}>{health.shells}{health.shells > 1 ? " · overlapping pieces count volume twice; union them before casting" : ""}</dd>
              <dt>Zero-area triangles</dt><dd>{health.degenerateTriangles.toLocaleString()}</dd>
              <dt>Size</dt><dd>{health.bounds.size.map((value) => fmt(value, 1)).join(" × ")} mm</dd>
              <dt>Volume{health.closed ? "" : " (approximate — mesh is open)"}</dt><dd>{fmt(Math.abs(health.volumeMm3), 1)} mm³</dd>
              <dt>Triangles</dt><dd>{health.triangles.toLocaleString()}</dd>
            </dl>
            <p className="cast-eyebrow">ESTIMATED WEIGHT</p>
            <table className="cast-weights"><tbody>{CAST_MATERIALS.map((item) => <tr key={item.id} className={item.id === materialId ? "selected" : undefined}><th>{item.name}</th><td>{fmt(estimatedWeightGrams(Math.abs(health.volumeMm3), item.density))} g</td></tr>)}</tbody></table>
            <p>Before sprues, shrinkage, stones and finishing loss. {material.name}: about {fmt(weight)} g.</p>
          </>}
          {working && tab === "print" && overhang && <>
            <h3>{fmt(overhang.overhangAreaMm2, 1)} mm² needs support</h3>
            <dl>
              <dt>Islands (new lowest points)</dt><dd className={overhang.islandVertices.length ? "cast-warn" : "cast-pass"}>{overhang.islandVertices.length}</dd>
              <dt>On build plate</dt><dd>{fmt(overhang.plateAreaMm2, 1)} mm²</dd>
              <dt>Print height</dt><dd>{fmt(overhang.heightMm, 1)} mm</dd>
            </dl>
            <p>Supports are not generated — add them in your slicer. The suggestion score ignores peel forces, suction cups and where support marks land, so treat it as a starting point.</p>
            <button className="cast-primary" onClick={() => exportStl(true)}>Export prepared STL</button>
            <button className="cast-secondary" onClick={() => exportStl(false)}>Export STL in model orientation</button>
          </>}
          {working && tab !== "print" && <button className="cast-secondary cast-export" onClick={() => exportStl(false)}>Export prepared STL</button>}
          <details className="cast-limits"><summary>About these checks</summary>
            <p>Cast runs estimates on a triangle mesh in your browser. It does not replace a review by your caster, printer or jeweller, and it does not check self-intersections, stone seats, sprue placement or alloy behaviour. Repairs are limited to merging duplicate vertices, removing zero-area triangles, capping small simple holes and making face winding consistent.</p>
          </details>
        </aside>
      </div>
    </section>
  </div>;
}
