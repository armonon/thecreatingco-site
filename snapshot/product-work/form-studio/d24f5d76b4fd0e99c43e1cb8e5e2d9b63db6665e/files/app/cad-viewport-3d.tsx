"use client";

import React, { useEffect, useRef, useState } from "react";
import { currentPreviewPixelRatio } from "./mobile-preview";
import { PointerTapGuard } from "./pointer-tap-guard";
import * as THREE from "three";
import { updatePaintDataTexture } from "./paint-data-texture";
import { captureNativeRenderScene, type NativeRenderScene } from "./native-render-scene";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CAD_ENVIRONMENTS, type CadAppearance } from "./cad-appearance";
import type { ExactSceneMesh } from "./cad-kernel";
import type { CadEntity, ModelInstance, ModelState } from "./cad-model";
import { createSketchModelPreview } from "./sketch-model-preview";
import { buildEdgeMap, type EditableMesh } from "./mesh-kernel";
import { installSelectionBrush, type ViewportSelectionBrushInput } from "./viewport-selection-brush";
import { shadeAuto, withCornerUvs } from "./mesh-operations";
import { parseEdgeKey, type SelectionMode } from "./mesh-selection";
import type { BrushSettings, StrokeSample } from "./sculpt-brush";
import {
  describeRegionSelection,
  boxBounds,
  itemsForMode,
  projectVertices,
  regionContains,
  regionCrossesSegment,
  regionFromDrag,
  selectInRegion,
  type RegionMode,
  type ScreenPoint,
} from "./region-select";
import {
  beginTransform,
  describeTransform,
  handleKey,
  handlePointer,
  setModifiers,
  snapTargetsOf,
  transformValue,
  type ModalTransform,
  type SnapContext,
  type SnapTarget,
  type TransformValue,
  type ViewBasis,
} from "./modal-transform";
import {
  WORLD_PLANE_ID,
  planeBasisMatrix,
  planeById,
  type SketchPlane,
  type Triple,
} from "./sketch-planes";
import {
  EMPTY_BOUNDS,
  SHADING_ORDER,
  STANDARD_VIEWS,
  VIEWPORT_SHADING,
  describeViewport,
  effectiveProjection,
  frameStandardView,
  orthographicFrustum,
  type CameraProjection,
  type StandardView,
  type Vec3,
  type ViewportState,
} from "./viewport-modes";

/** Vertical field of view shared by the perspective camera and the ortho framing maths. */
const VIEWPORT_FOV = 42;

type Layer = { id: string; name: string; color: string; visible: boolean; locked: boolean };

/** A model instance's 2D outline, with rectangle rotation and fillet radius baked in. */
function shapeForInstance(instance: ModelInstance): THREE.Shape | null {
  const e = instance.entity;
  if (e.type === "rectangle") {
    const x0 = Math.min(e.a.x, e.b.x);
    const x1 = Math.max(e.a.x, e.b.x);
    const y0 = Math.min(e.a.y, e.b.y);
    const y1 = Math.max(e.a.y, e.b.y);
    const w = x1 - x0;
    const h = y1 - y0;
    const r = Math.min(Math.max(0, instance.cornerRadius), Math.min(w, h) / 2);
    const rot = ((e.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const pivot = e.a;
    const rp = (px: number, py: number): [number, number] => {
      const dx = px - pivot.x;
      const dy = py - pivot.y;
      return [pivot.x + dx * cos - dy * sin, pivot.y + dx * sin + dy * cos];
    };
    const shape = new THREE.Shape();
    if (r > 0) {
      shape.moveTo(...rp(x0 + r, y0));
      shape.lineTo(...rp(x1 - r, y0));
      shape.quadraticCurveTo(...rp(x1, y0), ...rp(x1, y0 + r));
      shape.lineTo(...rp(x1, y1 - r));
      shape.quadraticCurveTo(...rp(x1, y1), ...rp(x1 - r, y1));
      shape.lineTo(...rp(x0 + r, y1));
      shape.quadraticCurveTo(...rp(x0, y1), ...rp(x0, y1 - r));
      shape.lineTo(...rp(x0, y0 + r));
      shape.quadraticCurveTo(...rp(x0, y0), ...rp(x0 + r, y0));
    } else {
      shape.moveTo(...rp(x0, y0));
      shape.lineTo(...rp(x1, y0));
      shape.lineTo(...rp(x1, y1));
      shape.lineTo(...rp(x0, y1));
    }
    shape.closePath();
    return shape;
  }
  if (e.type === "circle") {
    const radius = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
    if (radius <= 0) return null;
    const shape = new THREE.Shape();
    shape.absarc(e.a.x, e.a.y, radius, 0, Math.PI * 2, false);
    return shape;
  }
  return null;
}

export type ViewportPickMode = "entity" | "face" | "edit-face" | "edge" | "finish-face";

export type ExactDirectEdit = {
  sourceEntityId: string;
  topologyId: string;
  kind: "face" | "edge";
  distance: number;
};

/**
 * The 3D scene: WebGL setup, geometry, lighting, picking and the presentation dial.
 *
 * It owns nothing about the document. Everything it draws arrives as props, and
 * every interaction leaves as a callback, so the workspace stays the single place
 * that decides what a pick or a drag *means*.
 */
/** The few viewport actions the workspace needs to drive from outside the scene. */
export type CadViewportHandle = {
  /** Renders one frame and returns it, for exporting a still of the model. */
  captureImage: () => Promise<Blob | null>;
  /**
   * Where the camera is right now.
   *
   * The path tracer has its own camera model and needs the one you are looking
   * through, or a render would come out from somewhere you never chose.
   */
  readCamera: () => { position: Triple; target: Triple; up: Triple; fov: number } | null;
  readNativeScene?: () => NativeRenderScene;
  /** The groups holding solid bodies and sculpts (plus their overlays), for Export for Blender. */
  exportSources?: () => THREE.Object3D[];
};

/** A sculpted body, already rebuilt from its cage by the workspace. */
export type ViewportMeshBody = {
  id: string;
  name: string;
  surface: EditableMesh;
  selectedFaces: number[];
  selectedEdges: string[];
  selectedVertices: number[];
  /** Degrees two faces may turn and still share a normal. Display only. */
  shadingAngle: number;
  /** Where the body sits, inherited down the scene graph. Column-major. */
  worldMatrix: number[];
  visible: boolean;
  /** UV per face corner, when the body has been unwrapped. */
  uvOfCorner?: readonly (readonly [number, number])[][] | null;
  /** A baked or painted texture, RGBA, square. */
  texture?: { pixels: Uint8ClampedArray; size: number; revision: number } | null;
};

export type CadViewport3DProps = {
  /** Populated with the imperative handle once the scene exists. */
  handleRef?: React.MutableRefObject<CadViewportHandle | null>;
  /** The scene stays mounted while hidden so its WebGL context survives view changes. */
  visible: boolean;
  modelState: ModelState;
  entities: CadEntity[];
  layers: Layer[];
  sketchPlanes: SketchPlane[];
  activeSketchPlaneId: string;
  exactMeshes: ExactSceneMesh[];
  /** Final native rigid-body transforms, shown non-destructively until baked. */
  physicsTransforms: Array<{
    id: string;
    initialPosition: Triple;
    position: Triple;
    rotation: [number, number, number, number];
  }>;
  /** Solved native tetrahedral lattice, overlaid without changing exact geometry. */
  softBodyPreview: {
    positions: Triple[];
    topology: [number, number, number, number][];
    rigidSpheres: Array<{ center: Triple; radius?: number }>;
  } | null;
  meshBodies: ViewportMeshBody[];
  appearance: CadAppearance;
  viewport: ViewportState;
  explodedAssembly: boolean;
  selectedId: string;
  selectedIds: string[];
  selectedTopologyIds: string[];
  pickMode: ViewportPickMode;
  onViewportChange: (next: ViewportState) => void;
  onStatus: (message: string) => void;
  onSelectEntity: (entityId: string, additive: boolean) => void;
  onObjectContext?: (target: { id: string; mesh: boolean; face: number }, x: number, y: number) => void;
  onClearSelection: () => void;
  onPickTopology: (topologyId: string, sourceEntityId: string, additive: boolean) => void;
  onPickFace: (origin: Triple, normal: Triple, sourceEntityId?: string) => void;
  /** A click on a sculpted body, resolved back to the n-gon face that was hit. */
  onPickMeshFace: (meshId: string, faceIndex: number, additive: boolean) => void;
  onTransformCommit: (sourceEntityId: string, worldDelta: Triple) => void;
  /** A topology handle moved; preview is transient and commit becomes exact history. */
  onDirectEditPreview: (edit: ExactDirectEdit | null) => void;
  onDirectEditCommit: (edit: ExactDirectEdit) => void;
  /**
   * What a modal transform should act on, or null if nothing can be moved.
   * `vertices` being present puts the operator in edit mode: it acts on those
   * cage vertices rather than on the whole body.
   */
  modalTarget: {
    meshId: string;
    pivot: Triple;
    /** The body's own axes, for a local constraint. */
    frame?: Triple[];
    vertices?: number[];
  } | null;
  /**
   * The transform changed while the operator is running. The workspace shows it
   * as a preview; nothing is written to the document until it is confirmed.
   */
  onModalChange: (value: TransformValue | null, header: string) => void;
  /** A modal transform was confirmed. The workspace decides what it changes. */
  onModalCommit: (value: TransformValue, pivot: Triple, vertices?: number[]) => void;
  /**
   * The mesh a region drag should select over, with the matrix placing it. Null
   * when nothing is selected and there is nothing to draw a region around.
   */
  regionTarget: { meshId: string; surface: EditableMesh; worldMatrix: number[] } | null;
  /** Which of vertices, edges or faces a region drag should resolve to. */
  selectionMode: SelectionMode;
  /** A visible toolbar or command-bar request to arm one region gesture. */
  regionRequest: { kind: "box" | "ellipse" | "lasso" | "polygon"; combine: RegionMode; token: number; scope?: "mesh" | "body" } | null;
  /** Clears the one-shot toolbar state after applying or cancelling the drag. */
  onRegionRequestComplete: () => void;
  /** A region drag finished. The items are for the active selection mode. */
  onRegionSelect: (items: (number | string)[], mode: RegionMode, summary: string) => void;
  /** A body-space marquee finished over exact B-Rep bodies. */
  onRegionSelectEntities: (entityIds: string[], mode: RegionMode) => void;
  /** True while painting, which makes a drag lay colour down instead of orbiting. */
  painting: boolean;
  paintRadius?: number;
  /** Where a paint stroke touched, in texture coordinates. */
  onPaint: (meshId: string, u: number, v: number) => void;
  onPaintBegin?: () => void;
  onPaintEnd?: (cancelled: boolean) => void;
  /**
   * The brush, when sculpt mode is on. Null leaves dragging to orbit, which is
   * what makes sculpt mode a mode rather than a hazard.
   */
  sculptBrush: BrushSettings | null;
  sculptTargetId?: string | null;
  /** Samples so far, so the stroke can be shown as it is drawn. */
  onSculptStroke: (samples: StrokeSample[], done: boolean) => void;
  selectionBrushInput?: ViewportSelectionBrushInput;
  selectionHud?: React.ReactNode;
  selectionThrough?: boolean;
};

export default function CadViewport3D({
  handleRef,
  visible,
  modelState,
  entities,
  layers,
  sketchPlanes,
  activeSketchPlaneId,
  exactMeshes,
  physicsTransforms,
  softBodyPreview,
  meshBodies,
  appearance,
  viewport,
  explodedAssembly,
  selectedId,
  selectedIds,
  selectedTopologyIds,
  pickMode,
  onViewportChange,
  onStatus,
  onSelectEntity,
  onObjectContext,
  onClearSelection,
  onPickTopology,
  onPickFace,
  onPickMeshFace,
  onTransformCommit,
  onDirectEditPreview,
  onDirectEditCommit,
  modalTarget,
  onModalChange,
  onModalCommit,
  regionTarget,
  selectionMode,
  regionRequest,
  onRegionRequestComplete,
  onRegionSelect,
  onRegionSelectEntities,
  sculptBrush,
  sculptTargetId,
  onSculptStroke,
  painting,
  paintRadius = .04,
  onPaint,
  onPaintBegin,
  onPaintEnd,
  selectionBrushInput,
  selectionHud,
  selectionThrough = false,
}: CadViewport3DProps) {
  const brushInputRef = useRef(selectionBrushInput);
  const selectionThroughRef = useRef(selectionThrough);
  const regionRef = useRef<{
    kind: "box" | "ellipse" | "lasso" | "polygon";
    points: ScreenPoint[];
    mode: RegionMode;
    armed: boolean;
    scope: "mesh" | "body";
  } | null>(null);
  useEffect(() => {
    brushInputRef.current = selectionBrushInput;
    selectionThroughRef.current = selectionThrough;
  }, [selectionBrushInput, selectionThrough]);
  const [hudAnchor, setHudAnchor] = useState<{ x: number; y: number } | null>(null);
  /**
   * Set once the WebGL scene exists.
   *
   * The input effects below bail out when `threeCtxRef` is empty, and if they
   * depended only on `visible` they would never run again — the scene appearing
   * is not a change they can see. That is a silent failure: the keys simply stop
   * working, with nothing in the console to say why.
   */
  const [sceneReady, setSceneReady] = React.useState(false);

  const three3dRef = useRef<HTMLDivElement>(null);
  const threeCtxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    orthoCamera: THREE.OrthographicCamera;
    getActiveCamera: () => THREE.Camera;
    setProjection: (projection: CameraProjection) => void;
    applyStandardView: (view: StandardView) => void;
    composer: EffectComposer | null;
    aoPass: GTAOPass | null;
    useComposer: (enabled: boolean) => void;
    renderOnce: () => void;
    environment: THREE.Texture | null;
    controls: OrbitControls;
    transform: TransformControls;
    group: THREE.Group;
    meshGroup: THREE.Group;
    topologyHighlight: THREE.Group;
    directProxy: THREE.Object3D;
    grid: THREE.GridHelper;
    hemisphere: THREE.HemisphereLight;
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.DirectionalLight;
    ground: THREE.Mesh;
    observer: ResizeObserver;
    raf: number;
  } | null>(null);
  // Picking runs inside the render loop's closure, so the current handlers are
  // read through a ref rather than re-subscribing the listener on every render.
  const pickHandlersRef = useRef({
    pickMode: "entity" as ViewportPickMode,
    selectEntity: (() => {}) as (entityId: string, additive: boolean) => void,
    clearSelection: (() => {}) as () => void,
    pickTopology: (() => {}) as (topologyId: string, sourceEntityId: string, additive: boolean) => void,
    pickFace: (() => {}) as (origin: Triple, normal: Triple, sourceEntityId?: string) => void,
    pickMeshFace: (() => {}) as (meshId: string, faceIndex: number, additive: boolean) => void,
  });
  const objectContextRef = useRef(onObjectContext);
  useEffect(() => { objectContextRef.current = onObjectContext; }, [onObjectContext]);
  const sculptInputRef = useRef({ brush: sculptBrush, onStroke: onSculptStroke, targetId: sculptTargetId });
  const paintInputRef = useRef({ painting, paintRadius, onPaint, onPaintBegin, onPaintEnd });
  useEffect(() => {
    sculptInputRef.current = { brush: sculptBrush, onStroke: onSculptStroke, targetId: sculptTargetId };
    paintInputRef.current = { painting, paintRadius, onPaint, onPaintBegin, onPaintEnd };
  }, [sculptBrush, sculptTargetId, onSculptStroke, painting, paintRadius, onPaint, onPaintBegin, onPaintEnd]);
  const transformCommitRef = useRef<(sourceEntityId: string, worldDelta: Triple) => void>(() => {});
  const directEditRef = useRef({
    preview: (() => {}) as (edit: ExactDirectEdit | null) => void,
    commit: (() => {}) as (edit: ExactDirectEdit) => void,
  });
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const [hoveredTopologyId, setHoveredTopologyId] = useState<string | null>(null);

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      exportSources: () => {
        const ctx = threeCtxRef.current;
        return ctx ? [ctx.group, ctx.meshGroup] : [];
      },
      readNativeScene: () => {
        const ctx=threeCtxRef.current;
        if(!ctx) throw new Error("The modeling viewport is not ready");
        const camera=ctx.getActiveCamera();
        if(!(camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera)) throw new Error("Unsupported render camera");
        return captureNativeRenderScene([ctx.group,ctx.meshGroup],ctx.scene,camera,ctx.renderer.toneMappingExposure,ctx.renderer);
      },
      readCamera: () => {
        const context = threeCtxRef.current;
        if (!context) return null;
        const camera = context.getActiveCamera();
        camera.updateMatrixWorld();
        const target = context.controls.target;
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
        return {
          position: [camera.position.x, camera.position.y, camera.position.z] as Triple,
          target: [target.x, target.y, target.z] as Triple,
          up: [up.x, up.y, up.z] as Triple,
          fov: VIEWPORT_FOV,
        };
      },
      captureImage: () => new Promise<Blob | null>((resolve) => {
        const ctx = threeCtxRef.current;
        if (!ctx) return resolve(null);
        // Render on demand so the buffer holds a frame even when the tab is idle.
        ctx.renderer.render(ctx.scene, ctx.getActiveCamera());
        ctx.renderer.domElement.toBlob((blob) => resolve(blob));
      }),
    };
    return () => { handleRef.current = null; };
  }, [handleRef]);

  useEffect(() => {
    pickHandlersRef.current.pickMode = pickMode;
    pickHandlersRef.current.selectEntity = onSelectEntity;
    pickHandlersRef.current.clearSelection = onClearSelection;
    pickHandlersRef.current.pickTopology = onPickTopology;
    pickHandlersRef.current.pickFace = onPickFace;
    pickHandlersRef.current.pickMeshFace = onPickMeshFace;
    transformCommitRef.current = onTransformCommit;
    directEditRef.current = { preview: onDirectEditPreview, commit: onDirectEditCommit };
  });

  useEffect(() => {
    const container = three3dRef.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(currentPreviewPixelRatio());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(VIEWPORT_FOV, 1, 0.5, 6000);
    camera.up.set(0, 0, 1);
    camera.position.set(140, -180, 140);
    // A second camera shares the perspective camera's position and target so the
    // projection can be swapped without the view appearing to jump.
    const orthoCamera = new THREE.OrthographicCamera(-100, 100, 100, -100, -4000, 8000);
    orthoCamera.up.set(0, 0, 1);
    orthoCamera.position.copy(camera.position);
    let activeCamera: THREE.Camera = camera;
    const getActiveCamera = () => activeCamera;

    // Image-based lighting, generated procedurally so the app ships no HDR assets.
    // A GPU without the required float render targets simply gets the light rig.
    let environment: THREE.Texture | null = null;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {
      environment = null;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    // Orient the camera now rather than on the first frame, for the same reason.
    controls.update();
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode("translate");
    transform.setSize(0.75);
    // Direct manipulation should land on manufacturable values by default.
    // The inspector remains available for arbitrary expressions and sub-mm
    // placement, while the gizmo itself advances in exact 1 mm increments.
    transform.setTranslationSnap(1);
    transform.addEventListener("dragging-changed", (event) => {
      controls.enabled = !event.value;
    });
    let dragStart = new THREE.Vector3();
    transform.addEventListener("mouseDown", () => {
      if (transform.object) dragStart = transform.object.position.clone();
    });
    transform.addEventListener("mouseUp", () => {
      const object = transform.object;
      if (!object) return;
      const delta = object.position.clone().sub(dragStart);
      if (delta.lengthSq() < 1e-8) return;
      const direct = object.userData?.directEdit as Omit<ExactDirectEdit, "distance"> & { axis: Triple } | undefined;
      if (direct) {
        const distance = delta.dot(new THREE.Vector3(...direct.axis).normalize());
        if (Math.abs(distance) >= 0.001) directEditRef.current.commit({
          sourceEntityId: direct.sourceEntityId,
          topologyId: direct.topologyId,
          kind: direct.kind,
          distance,
        });
        directEditRef.current.preview(null);
        return;
      }
      const sourceId = object.userData?.sourceEntityId as string | undefined;
      if (sourceId) transformCommitRef.current(sourceId, [delta.x, delta.y, delta.z]);
    });
    transform.addEventListener("objectChange", () => {
      const object = transform.object;
      const direct = object?.userData?.directEdit as Omit<ExactDirectEdit, "distance"> & { axis: Triple } | undefined;
      if (!object || !direct) return;
      const distance = object.position.clone().sub(dragStart).dot(new THREE.Vector3(...direct.axis).normalize());
      directEditRef.current.preview({
        sourceEntityId: direct.sourceEntityId,
        topologyId: direct.topologyId,
        kind: direct.kind,
        distance,
      });
    });
    const hemisphere = new THREE.HemisphereLight(0xf4f0e7, 0x25332c, 1.35);
    scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight(0xfff0dc, 4.2);
    keyLight.position.set(120, -160, 210);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -240;
    keyLight.shadow.camera.right = 240;
    keyLight.shadow.camera.top = 240;
    keyLight.shadow.camera.bottom = -240;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 800;
    keyLight.shadow.bias = -0.00015;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc7dcff, 2.1);
    fillLight.position.set(-170, 80, 110);
    scene.add(fillLight);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.ShadowMaterial({ color: 0x070908, opacity: 0.32 }),
    );
    ground.position.z = -0.08;
    ground.receiveShadow = true;
    ground.renderOrder = -1;
    scene.add(ground);
    const grid1 = new THREE.GridHelper(400, 40, 0xaeb4ad, 0xc6cac4);
    grid1.rotation.x = Math.PI / 2;
    scene.add(grid1);
    const axes = new THREE.AxesHelper(30);
    scene.add(axes);
    const group = new THREE.Group();
    scene.add(group);
    // Sculpted bodies live in their own group so the solid rebuild, which
    // clears its group wholesale, cannot discard them.
    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    const topologyHighlight = new THREE.Group();
    topologyHighlight.renderOrder = 40;
    scene.add(topologyHighlight);
    const directProxy = new THREE.Object3D();
    directProxy.visible = false;
    scene.add(directProxy);
    const transformHelper = (transform as unknown as { getHelper?: () => THREE.Object3D }).getHelper?.()
      ?? (transform as unknown as THREE.Object3D);
    scene.add(transformHelper);
    // Post-processing is optional; without it the viewport still renders directly.
    let composer: EffectComposer | null = null;
    let renderPass: RenderPass | null = null;
    let aoPass: GTAOPass | null = null;
    try {
      composer = new EffectComposer(renderer);
      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      aoPass = new GTAOPass(scene, camera, 1, 1);
      aoPass.enabled = false;
      composer.addPass(aoPass);
      composer.addPass(new OutputPass());
    } catch {
      composer = null;
      renderPass = null;
      aoPass = null;
    }
    let composerEnabled = false;
    const useComposer = (enabled: boolean) => {
      composerEnabled = enabled && composer !== null && aoPass !== null;
      if (aoPass) aoPass.enabled = composerEnabled;
    };

    /** Keeps the orthographic frustum showing the same extent the perspective camera sees. */
    const syncOrthoFrustum = () => {
      const aspect = camera.aspect || 1;
      const distance = camera.position.distanceTo(controls.target);
      const frustum = orthographicFrustum(distance, VIEWPORT_FOV, aspect);
      orthoCamera.left = frustum.left;
      orthoCamera.right = frustum.right;
      orthoCamera.top = frustum.top;
      orthoCamera.bottom = frustum.bottom;
      orthoCamera.updateProjectionMatrix();
    };

    const setProjection = (projection: CameraProjection) => {
      const next: THREE.Camera = projection === "orthographic" ? orthoCamera : camera;
      if (next === activeCamera) return;
      if (projection === "orthographic") {
        orthoCamera.position.copy(camera.position);
        orthoCamera.up.copy(camera.up);
        orthoCamera.quaternion.copy(camera.quaternion);
        syncOrthoFrustum();
      } else {
        camera.position.copy(orthoCamera.position);
        camera.up.copy(orthoCamera.up);
        camera.quaternion.copy(orthoCamera.quaternion);
      }
      activeCamera = next;
      controls.object = next as THREE.PerspectiveCamera;
      transform.camera = next;
      if (renderPass) renderPass.camera = next;
      if (aoPass) aoPass.camera = next as THREE.PerspectiveCamera;
      controls.update();
    };

    /** Frames the model from a named direction, in whichever projection is active. */
    const applyStandardView = (view: StandardView) => {
      const box = new THREE.Box3();
      group.children.forEach((child) => {
        if (child instanceof THREE.Mesh) box.expandByObject(child);
      });
      const bounds = box.isEmpty()
        ? EMPTY_BOUNDS
        : { min: [box.min.x, box.min.y, box.min.z] as Vec3, max: [box.max.x, box.max.y, box.max.z] as Vec3 };
      const framing = frameStandardView(view, bounds, VIEWPORT_FOV, camera.aspect || 1);
      const target = new THREE.Vector3(...framing.target);
      const position = new THREE.Vector3(...framing.position);
      const up = new THREE.Vector3(...framing.up);
      for (const item of [camera, orthoCamera]) {
        item.up.copy(up);
        item.position.copy(position);
        item.lookAt(target);
      }
      controls.target.copy(target);
      syncOrthoFrustum();
      controls.update();
    };

    let sizedWidth = 0;
    let sizedHeight = 0;
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      // The viewport starts hidden behind the sketch view, so the first measurement
      // is 0x0. A ResizeObserver alone does not reliably report the transition back
      // out of display:none, which previously left the canvas at its default size
      // and the scene never visible. The render loop re-checks instead.
      if (w <= 0 || h <= 0) return;
      if (w === sizedWidth && h === sizedHeight) return;
      sizedWidth = w;
      sizedHeight = h;
      renderer.setSize(w, h, false);
      composer?.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      syncOrthoFrustum();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 2.5 };
    const meshHover = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x9dffec, opacity: 0.16, transparent: true, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    meshHover.matrixAutoUpdate = false;
    meshHover.visible = false;
    scene.add(meshHover);
    let hoverKey = "";
    const ndc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let downT = 0;
    let moved = false;
    const trackMove = (event: PointerEvent) => { if (event.buttons && Math.hypot(event.clientX - downX, event.clientY - downY) > 8) moved = true; };
    const openObjectContext = (event: MouseEvent) => {
      if (modalRef.current || !objectContextRef.current) return;
      event.preventDefault();
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      activeCamera.updateMatrixWorld(); raycaster.setFromCamera(ndc, activeCamera);
      const targets = [...group.children, ...meshGroup.children].filter((child) => (child instanceof THREE.Mesh && (child.userData.sourceEntityId || child.userData.meshFeatureId)) || child.userData.sketchPreview);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit) return;
      const meshId = hit.object.userData.meshFeatureId as string | undefined;
      objectContextRef.current({ id: meshId ?? hit.object.userData.sourceEntityId, mesh: !!meshId, face: meshId && hit.faceIndex != null ? hit.object.userData.faceOfTriangle?.[hit.faceIndex] ?? 0 : 0 }, event.clientX, event.clientY);
    };
    const tapGuard = new PointerTapGuard();
    const onPointerCancel = (event: PointerEvent) => tapGuard.cancel(event.pointerId);
    const onPointerDown = (event: PointerEvent) => {
      tapGuard.down(event.pointerId);
      moved = false;
      meshHover.visible = false;
      downX = event.clientX;
      downY = event.clientY;
      downT = performance.now();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!tapGuard.up(event.pointerId)) return;
      if (event.button !== 0 || moved) return;
      if (event.pointerType === "touch" && pickHandlersRef.current.pickMode === "entity" && !brushInputRef.current?.brush && !sculptInputRef.current.brush && !paintInputRef.current.painting && !modalRef.current && !regionRef.current && Math.hypot(event.clientX - downX, event.clientY - downY) <= 8 && performance.now() - downT < 650) {
        openObjectContext(event); return;
      }
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) return;
      if (performance.now() - downT > 500) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      // Picking must not depend on a frame having rendered: the very first click,
      // or a click while the tab is throttled, would otherwise cast from a stale
      // camera matrix and hit nothing.
      activeCamera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, activeCamera);
      const handlers = pickHandlersRef.current;
      if (handlers.pickMode === "edge") {
        const lines = group.children.filter((child): child is THREE.LineSegments => child instanceof THREE.LineSegments && Boolean(child.userData.topologyId));
        const edgeHit = raycaster.intersectObjects(lines, false)[0];
        const topologyId = edgeHit?.object.userData.topologyId as string | undefined;
        const sourceId = edgeHit?.object.userData.sourceEntityId as string | undefined;
        if (topologyId && sourceId) handlers.pickTopology(topologyId, sourceId, event.shiftKey);
        return;
      }
      const meshes = [...group.children, ...meshGroup.children]
        .filter((child) => (child instanceof THREE.Mesh && !!(child.userData.sourceEntityId || child.userData.meshFeatureId))
          || (handlers.pickMode === "entity" && child.userData.sketchPreview));
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit) {
        if (handlers.pickMode === "entity") handlers.clearSelection();
        return;
      }
      const sourceId = (hit.object as THREE.Mesh).userData.sourceEntityId as string | undefined;
      const meshId = hit.object.userData.meshFeatureId as string | undefined;
      if (meshId && hit.faceIndex != null) {
        const face = (hit.object.userData.faceOfTriangle as Uint32Array)[hit.faceIndex];
        handlers.pickMeshFace(meshId, face, event.shiftKey);
        return;
      }
      if ((handlers.pickMode === "finish-face" || handlers.pickMode === "edit-face") && sourceId && hit.faceIndex != null) {
        const groups = (hit.object as THREE.Mesh).userData.faceGroups as Int32Array | undefined;
        const topologyIds = (hit.object as THREE.Mesh).userData.faceTopologyIds as string[] | undefined;
        if (groups) {
          for (let index = 0; index < groups.length; index += 3) {
            // Three reports faceIndex in triangles; BufferGeometry groups are
            // measured in indices. Comparing the two directly made most exact
            // faces impossible to pick once a body had more than one face.
            const start = Math.floor(groups[index] / 3);
            const count = Math.ceil(groups[index + 1] / 3);
            if (hit.faceIndex >= start && hit.faceIndex < start + count) {
              const topologyId = topologyIds?.[index / 3];
              if (topologyId) handlers.pickTopology(topologyId, sourceId, event.shiftKey);
              return;
            }
          }
        }
        return;
      }
      if (handlers.pickMode === "face" && hit.face) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
        const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        handlers.pickFace(
          [hit.point.x, hit.point.y, hit.point.z],
          [normal.x, normal.y, normal.z],
          sourceId,
        );
        return;
      }
      if (sourceId) handlers.selectEntity(sourceId, event.shiftKey);
    };
    const onPickHover = (event: PointerEvent) => {
      if (event.buttons || brushInputRef.current?.brush || regionRef.current || modalRef.current) { meshHover.visible = false; return; }
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      activeCamera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, activeCamera);
      const mode = pickHandlersRef.current.pickMode;
      if (mode === "edge") {
        const lines = group.children.filter((child): child is THREE.LineSegments => child instanceof THREE.LineSegments && Boolean(child.userData.topologyId));
        const hit = raycaster.intersectObjects(lines, false)[0]?.object;
        const topologyId = hit?.userData.topologyId as string | undefined;
        const sourceId = hit?.userData.sourceEntityId as string | undefined;
        setHoveredTopologyId((current) => current === (topologyId ?? null) ? current : topologyId ?? null);
        setHoveredSourceId((current) => current === (sourceId ?? null) ? current : sourceId ?? null);
        renderer.domElement.style.cursor = topologyId ? "crosshair" : "default";
        return;
      }
      const meshes = [...group.children, ...meshGroup.children].filter((child) =>
        (child instanceof THREE.Mesh && !!(child.userData.sourceEntityId || child.userData.meshFeatureId))
        || (mode === "entity" && child.userData.sketchPreview));
      const intersection = raycaster.intersectObjects(meshes, false)[0];
      const hit = intersection?.object;
      meshHover.visible = false;
      if (hit instanceof THREE.Mesh && hit.userData.meshFeatureId && intersection?.faceIndex != null) {
        const faceMap = hit.userData.faceOfTriangle as Uint32Array;
        const face = faceMap[intersection.faceIndex];
        const key = `${hit.uuid}:${face}`;
        if (key !== hoverKey) {
          const indices = hit.geometry.index;
          const positions = hit.geometry.getAttribute("position");
          const triangles: number[] = [];
          for (let t = 0; t < faceMap.length; t++) if (faceMap[t] === face) {
            for (let k = 0; k < 3; k++) { const v = indices ? indices.getX(t * 3 + k) : t * 3 + k; triangles.push(positions.getX(v), positions.getY(v), positions.getZ(v)); }
          }
          meshHover.geometry.dispose();
          meshHover.geometry = new THREE.BufferGeometry();
          meshHover.geometry.setAttribute("position", new THREE.Float32BufferAttribute(triangles, 3));
          hoverKey = key;
        }
        hit.updateMatrixWorld(true);
        meshHover.matrix.copy(hit.matrixWorld); meshHover.matrixWorldNeedsUpdate = true; meshHover.visible = true;
        renderer.domElement.style.cursor = "crosshair";
        return;
      }
      const sourceId = hit?.userData.sourceEntityId as string | undefined;
      let faceTopologyId: string | null = null;
      if ((mode === "face" || mode === "edit-face" || mode === "finish-face") && hit && intersection?.faceIndex != null) {
        const groups = hit.userData.faceGroups as Int32Array | undefined;
        const topologyIds = hit.userData.faceTopologyIds as string[] | undefined;
        if (groups) {
          for (let index = 0; index < groups.length; index += 3) {
            const start = Math.floor(groups[index] / 3);
            const count = Math.ceil(groups[index + 1] / 3);
            if (intersection.faceIndex >= start && intersection.faceIndex < start + count) {
              faceTopologyId = topologyIds?.[index / 3] ?? null;
              break;
            }
          }
        }
      }
      setHoveredTopologyId((current) => current === faceTopologyId ? current : faceTopologyId);
      setHoveredSourceId((current) => current === (sourceId ?? null) ? current : sourceId ?? null);
      renderer.domElement.style.cursor = sourceId ? (mode === "face" || mode === "edit-face" || mode === "finish-face" ? "crosshair" : "pointer") : "default";
    };
    const onPickLeave = () => {
      meshHover.visible = false;
      setHoveredSourceId(null);
      setHoveredTopologyId(null);
      renderer.domElement.style.cursor = "default";
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointermove", trackMove);
    renderer.domElement.addEventListener("contextmenu", openObjectContext);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);
    renderer.domElement.addEventListener("pointermove", onPickHover);
    renderer.domElement.addEventListener("pointerleave", onPickLeave);
    let raf = 0;
    const renderOnce = () => {
      resize();
      controls.update();
      if (activeCamera === orthoCamera) syncOrthoFrustum();
      // Ambient occlusion needs the composer; without it a direct render is cheaper.
      if (composerEnabled && composer) composer.render();
      else renderer.render(scene, activeCamera);
    };
    const loop = () => {
      renderOnce();
      raf = requestAnimationFrame(loop);
    };
    loop();
    const ownContext = {
      renderer, scene, camera, orthoCamera, getActiveCamera, setProjection, applyStandardView,
      composer, aoPass, useComposer, renderOnce, environment,
      controls, transform, group, meshGroup, topologyHighlight, directProxy, grid: grid1, hemisphere, keyLight, fillLight, ground, observer, raf,
    };
    threeCtxRef.current = ownContext;
    setSceneReady(true);
    return () => {
      // Tear down only this instance. Reading the shared ref here cancelled the
      // *successor's* animation frame under StrictMode's mount/cleanup/mount, which
      // left the viewport permanently frozen on its first frame.
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      transform.detach();
      transform.dispose();
      renderer.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", trackMove);
      renderer.domElement.removeEventListener("contextmenu", openObjectContext);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      renderer.domElement.removeEventListener("pointermove", onPickHover);
      renderer.domElement.removeEventListener("pointerleave", onPickLeave);
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (material) (Array.isArray(material) ? material : [material]).forEach((m) => m.dispose());
      });
      if (threeCtxRef.current === ownContext) {
        threeCtxRef.current = null;
        setSceneReady(false);
      }
    };
  }, []);

  // Preserve crisp edges for ordinary parts, then trade a little pixel density
  // for interaction latency on dense assemblies. Exact geometry is untouched;
  // this only changes the transient viewport raster.
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const exactTriangles = exactMeshes.reduce((total, mesh) => total + Math.floor(mesh.indices.length / 3), 0);
    const sculptTriangles = meshBodies.reduce((total, body) => total + body.surface.faces.reduce((sum, face) => sum + Math.max(0, face.length - 2), 0), 0);
    const dense = exactTriangles + sculptTriangles > 750_000;
    ctx.renderer.setPixelRatio(Math.min(currentPreviewPixelRatio(), dense ? 1.25 : 2));
  }, [exactMeshes, meshBodies]);

  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    while (ctx.group.children.length) {
      const child = ctx.group.children[0];
      ctx.group.remove(child);
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (material) (Array.isArray(material) ? material : [material]).forEach((m) => m.dispose());
    }
    // Always include sketch linework, even while the exact kernel is rebuilding
    // or when the document already contains solids. No import/Extrude required.
    createSketchModelPreview(entities, layers, sketchPlanes).forEach((line) => ctx.group.add(line));
    if (softBodyPreview) {
      const pairs = new Set<string>(); const segments: number[] = [];
      softBodyPreview.topology.forEach((tetrahedron) => {
        for (const [left, right] of [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]) {
          const a = tetrahedron[left]; const b = tetrahedron[right]; const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          if (pairs.has(key)) continue; pairs.add(key);
          const start = softBodyPreview.positions[a]; const end = softBodyPreview.positions[b];
          if (start && end) segments.push(...start, ...end);
        }
      });
      const latticeGeometry = new THREE.BufferGeometry(); latticeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
      const lattice = new THREE.LineSegments(latticeGeometry, new THREE.LineBasicMaterial({ color: 0x72e7ff, transparent: true, opacity: 0.9, depthTest: false }));
      lattice.renderOrder = 50; lattice.userData.softBodyPreview = true; ctx.group.add(lattice);
      const pointGeometry = new THREE.BufferGeometry(); pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(softBodyPreview.positions.flat(), 3));
      const points = new THREE.Points(pointGeometry, new THREE.PointsMaterial({ color: 0xd7ff78, size: 2.5, sizeAttenuation: false, depthTest: false }));
      points.renderOrder = 51; points.userData.softBodyPreview = true; ctx.group.add(points);
      softBodyPreview.rigidSpheres.forEach((sphere) => {
        const geometry = new THREE.WireframeGeometry(new THREE.SphereGeometry(Math.max(0.1, sphere.radius ?? 1), 16, 10));
        const wire = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffb44a, transparent: true, opacity: 0.8, depthTest: false }));
        wire.position.set(...sphere.center); wire.renderOrder = 49; wire.userData.softBodyPreview = true; ctx.group.add(wire);
      });
    }
    if (exactMeshes.length > 0) {
      exactMeshes.forEach((exactMesh, index) => {
        const entity = entities.find((item) => item.id === exactMesh.sourceId);
        const layer = layers.find((item) => item.id === entity?.layer) ?? layers.find((item) => item.id === "model");
        if (!layer?.visible) return;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(exactMesh.positions, 3));
        geometry.setAttribute("normal", new THREE.BufferAttribute(exactMesh.normals, 3));
        geometry.setIndex(new THREE.BufferAttribute(exactMesh.indices, 1));
        // Rebuild display normals from the indexed triangles. OCCT face normals
        // can arrive in per-face orientation while WebGL expects a consistent
        // vertex basis, which previously left valid side walls nearly black.
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(
          geometry,
          // Colour, finish and explode offset are applied by the appearance effect below.
          new THREE.MeshPhysicalMaterial({ color: layer.color }),
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const explodeOffset: Triple = [(index % 3) * 18, Math.floor(index / 3) * 14, index * 3];
        mesh.userData.sourceEntityId = exactMesh.sourceId;
        // Remembered so technical mode can flatten the surface and restore it after.
        mesh.userData.appearance = { metalness: (mesh.material as THREE.MeshPhysicalMaterial).metalness, roughness: (mesh.material as THREE.MeshPhysicalMaterial).roughness, clearcoat: (mesh.material as THREE.MeshPhysicalMaterial).clearcoat };
        mesh.userData.faceGroups = exactMesh.faceGroups;
        mesh.userData.faceTopologyIds = exactMesh.faceTopologyIds;
        mesh.userData.appearance = "exact";
        mesh.userData.baseColor = layer.color;
        mesh.userData.explodeOffset = explodeOffset;
        ctx.group.add(mesh);
        for (let groupIndex = 0; groupIndex < exactMesh.edgeGroups.length; groupIndex += 3) {
          const start = exactMesh.edgeGroups[groupIndex];
          const count = exactMesh.edgeGroups[groupIndex + 1];
          const topologyId = exactMesh.edgeTopologyIds[groupIndex / 3];
          if (!topologyId) continue;
          const segmentPositions: number[] = [];
          for (let pointIndex = start; pointIndex + 5 < start + count; pointIndex += 3) {
            segmentPositions.push(
              exactMesh.edgePositions[pointIndex], exactMesh.edgePositions[pointIndex + 1], exactMesh.edgePositions[pointIndex + 2],
              exactMesh.edgePositions[pointIndex + 3], exactMesh.edgePositions[pointIndex + 4], exactMesh.edgePositions[pointIndex + 5],
            );
          }
          if (segmentPositions.length === 0) continue;
          const edgeGeometry = new THREE.BufferGeometry();
          edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(segmentPositions, 3));
          const edgeLines = new THREE.LineSegments(
            edgeGeometry,
            new THREE.LineBasicMaterial({ color: 0x0d1210, transparent: true, opacity: 0.58 }),
          );
          edgeLines.userData.sourceEntityId = exactMesh.sourceId;
          edgeLines.userData.topologyId = topologyId;
          edgeLines.userData.appearance = "exact-edge";
          edgeLines.userData.explodeOffset = explodeOffset;
          ctx.group.add(edgeLines);
        }
      });
      return;
    }
    const depth = Math.max(0.1, modelState.extrusionDepth);
    modelState.instances.forEach((instance) => {
      const layer = layers.find((item) => item.id === instance.entity.layer);
      if (!layer?.visible) return;
      const shape = shapeForInstance(instance);
      if (!shape) return;
      const chamfer = Math.max(0, Math.min(instance.chamfer, depth / 2));
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: chamfer > 0,
        bevelSize: chamfer,
        bevelThickness: chamfer,
        bevelSegments: 1,
        bevelOffset: 0,
        curveSegments: 32,
      });
      geometry.computeVertexNormals();
      const isShelled = instance.shellThickness > 0;
      const baseColor = new THREE.Color(layer.color);
      const plane = planeById(sketchPlanes, instance.entity.sketchPlaneId);
      const basis = planeBasisMatrix(plane);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshPhysicalMaterial({
          color: baseColor,
          metalness: 0.15,
          roughness: 0.55,
          transparent: isShelled,
          opacity: isShelled ? 0.32 : 1,
          side: THREE.DoubleSide,
        }),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.applyMatrix4(basis);
      mesh.userData.sourceEntityId = instance.sourceEntityId;
      // Remembered so technical mode can flatten the surface and restore it after.
      mesh.userData.appearance = { metalness: (mesh.material as THREE.MeshPhysicalMaterial).metalness, roughness: (mesh.material as THREE.MeshPhysicalMaterial).roughness, clearcoat: (mesh.material as THREE.MeshPhysicalMaterial).clearcoat };
      mesh.userData.appearance = "instance";
      mesh.userData.baseColor = layer.color;
      ctx.group.add(mesh);
      const edges = new THREE.EdgesGeometry(geometry, 25);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: isShelled ? 0xd7ff78 : 0x0d1210,
        transparent: true,
        opacity: isShelled ? 0.9 : 0.55,
      });
      const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
      edgeLines.applyMatrix4(basis);
      edgeLines.userData.sourceEntityId = instance.sourceEntityId;
      edgeLines.userData.appearance = "instance-edge";
      edgeLines.userData.shelled = isShelled;
      ctx.group.add(edgeLines);
      if (isShelled) {
        const inset = Math.max(0.5, Math.min(instance.shellThickness, depth / 3));
        const innerGeom = new THREE.ExtrudeGeometry(shape, {
          depth: Math.max(0.2, depth - inset * 2),
          bevelEnabled: false,
          curveSegments: 32,
        });
        innerGeom.translate(0, 0, inset);
        const innerMesh = new THREE.Mesh(
          innerGeom,
          new THREE.MeshPhysicalMaterial({
            color: baseColor.clone().multiplyScalar(0.6),
            metalness: 0.1,
            roughness: 0.7,
            transparent: true,
            opacity: 0.4,
            side: THREE.BackSide,
          }),
        );
        innerMesh.castShadow = true;
        innerMesh.receiveShadow = true;
        innerMesh.applyMatrix4(basis);
        ctx.group.add(innerMesh);
      }
    });
  }, [entities, exactMeshes, layers, modelState, sketchPlanes, softBodyPreview, sceneReady]);

  // Exact face preselection is rendered as geometry, not as a whole-body tint.
  // This makes it unambiguous which opening a shell will remove and fixes the
  // common CAD failure mode where the status says "face" but the viewport only
  // highlights the owning solid.
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    while (ctx.topologyHighlight.children.length) {
      const child = ctx.topologyHighlight.children[0] as THREE.Mesh;
      ctx.topologyHighlight.remove(child);
      child.geometry?.dispose();
      const material = child.material;
      if (material) (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
    }
    const highlighted = new Set(selectedTopologyIds.filter((topologyId) => topologyId.includes(":face:")));
    if (hoveredTopologyId?.includes(":face:")) highlighted.add(hoveredTopologyId);
    if (highlighted.size === 0) return;
    const physicsById = new Map(physicsTransforms.map((transform) => [transform.id, transform]));
    exactMeshes.forEach((exactMesh, meshIndex) => {
      for (let groupIndex = 0; groupIndex < exactMesh.faceGroups.length; groupIndex += 3) {
        const topologyId = exactMesh.faceTopologyIds[groupIndex / 3];
        if (!topologyId || !highlighted.has(topologyId)) continue;
        const start = exactMesh.faceGroups[groupIndex];
        const count = exactMesh.faceGroups[groupIndex + 1];
        const positions: number[] = [];
        for (let index = start; index < start + count; index += 1) {
          const vertex = exactMesh.indices[index] * 3;
          positions.push(exactMesh.positions[vertex], exactMesh.positions[vertex + 1], exactMesh.positions[vertex + 2]);
        }
        if (positions.length < 9) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        const selected = selectedTopologyIds.includes(topologyId);
        const overlay = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
          color: selected ? 0xffb44a : 0x53d9bf,
          transparent: true,
          opacity: selected ? 0.48 : 0.32,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }));
        const explodeOffset: Triple = [(meshIndex % 3) * 18, Math.floor(meshIndex / 3) * 14, meshIndex * 3];
        const exploded = explodedAssembly ? explodeOffset : [0, 0, 0] as Triple;
        const physics = physicsById.get(exactMesh.sourceId);
        if (physics) {
          const rotation = new THREE.Quaternion(...physics.rotation).normalize();
          const rotatedCenter = new THREE.Vector3(...physics.initialPosition).applyQuaternion(rotation);
          overlay.quaternion.copy(rotation);
          overlay.position.set(
            physics.position[0] - rotatedCenter.x + exploded[0],
            physics.position[1] - rotatedCenter.y + exploded[1],
            physics.position[2] - rotatedCenter.z + exploded[2],
          );
        } else overlay.position.set(...exploded);
        overlay.renderOrder = 40;
        overlay.userData.topologyId = topologyId;
        ctx.topologyHighlight.add(overlay);
      }
    });
  }, [exactMeshes, explodedAssembly, hoveredTopologyId, physicsTransforms, selectedTopologyIds]);

  // Appearance-only pass: selection highlighting, material finish and the explode
  // offset mutate the meshes built above so that clicking around never re-tessellates
  // the scene. Its deps include every geometry input so it re-runs after a rebuild.
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const physicsById = new Map(physicsTransforms.map((transform) => [transform.id, transform]));
    ctx.group.children.forEach((child) => {
      const appearanceKind = child.userData.appearance as string | undefined;
      if (!appearanceKind) return;
      const sourceId = child.userData.sourceEntityId as string | undefined;
      const isSelected = sourceId !== undefined && (sourceId === selectedId || selectedIds.includes(sourceId));
      const isHovered = Boolean(sourceId) && sourceId === hoveredSourceId;
      if (appearanceKind === "sketch") {
        const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
        material.color.set(isSelected ? 0xffbf69 : isHovered ? 0xbce3ff : 0x68b5ff);
        return; // Sketches stay on their authoring plane, independent of body physics/explode.
      }
      const explodeOffset = child.userData.explodeOffset as Triple | undefined;
      const physics = sourceId ? physicsById.get(sourceId) : undefined;
      const exploded = explodedAssembly && explodeOffset ? explodeOffset : [0, 0, 0];
      if (physics) {
        const rotation = new THREE.Quaternion(...physics.rotation).normalize();
        const rotatedCenter = new THREE.Vector3(...physics.initialPosition).applyQuaternion(rotation);
        child.quaternion.copy(rotation);
        child.position.set(
          physics.position[0] - rotatedCenter.x + exploded[0],
          physics.position[1] - rotatedCenter.y + exploded[1],
          physics.position[2] - rotatedCenter.z + exploded[2],
        );
      } else {
        child.quaternion.identity();
        child.position.set(exploded[0], exploded[1], exploded[2]);
      }
      if (appearanceKind === "exact" || appearanceKind === "instance") {
        const meshMaterial = (child as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
        const baseColor = appearance.useLayerColor ? child.userData.baseColor as string : appearance.baseColor;
        // Preserve the actual finish while selected. Replacing the entire
        // material with neon green flattened the object in rendered mode.
        meshMaterial.color.set(baseColor);
        if (isSelected) meshMaterial.color.lerp(new THREE.Color(0xd7ff78), 0.16);
        else if (isHovered) meshMaterial.color.lerp(new THREE.Color(0xf4f7ee), 0.08);
        meshMaterial.emissive.set(isSelected ? 0x7b941f : isHovered ? 0x273126 : 0x000000);
        meshMaterial.emissiveIntensity = isSelected ? 0.055 : isHovered ? 0.025 : 0;
        meshMaterial.metalness = appearance.metalness;
        meshMaterial.roughness = appearance.roughness;
        meshMaterial.clearcoat = appearance.clearcoat;
        meshMaterial.clearcoatRoughness = appearance.clearcoatRoughness;
        meshMaterial.transmission = appearance.transmission;
        meshMaterial.opacity = appearance.opacity;
        meshMaterial.transparent = appearance.opacity < 1 || appearance.transmission > 0;
        meshMaterial.depthWrite = appearance.opacity > 0.65;
        // Imported and exact kernels do not always agree on triangle winding.
        // This prevents a valid face from appearing black or disappearing.
        meshMaterial.side = THREE.DoubleSide;
        meshMaterial.needsUpdate = true;
        return;
      }
      const lineMaterial = (child as THREE.LineSegments).material as THREE.LineBasicMaterial;
      if (appearanceKind === "exact-edge") {
        const targeted = selectedTopologyIds.includes(child.userData.topologyId as string);
        const hovered = child.userData.topologyId === hoveredTopologyId;
        lineMaterial.color.set(targeted ? 0xffb44a : hovered ? 0x53d9bf : isSelected ? 0xf2ba5c : 0x0d1210);
        lineMaterial.opacity = targeted || hovered ? 1 : 0.58;
        return;
      }
      lineMaterial.color.set(isSelected ? 0xffffff : (child.userData.shelled ? 0xd7ff78 : 0x0d1210));
    });
  }, [appearance, entities, exactMeshes, explodedAssembly, hoveredSourceId, hoveredTopologyId, layers, modelState, physicsTransforms, selectedId, selectedIds, selectedTopologyIds, sketchPlanes, sceneReady]);

  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const environment = CAD_ENVIRONMENTS[appearance.environment];
    ctx.scene.background = new THREE.Color(environment.background);
    ctx.renderer.toneMappingExposure = appearance.exposure;
    ctx.hemisphere.color.set(environment.hemisphereSky);
    ctx.hemisphere.groundColor.set(environment.hemisphereGround);
    ctx.hemisphere.intensity = environment.hemisphereIntensity;
    ctx.keyLight.color.set(environment.keyColor);
    ctx.keyLight.intensity = environment.keyIntensity;
    ctx.fillLight.color.set(environment.fillColor);
    ctx.fillLight.intensity = environment.fillIntensity;
    ctx.ground.visible = appearance.groundShadow;
    const darkWorkspace = appearance.environment !== "daylight";
    const gridMaterials = Array.isArray(ctx.grid.material) ? ctx.grid.material : [ctx.grid.material];
    gridMaterials.forEach((material, index) => {
      material.color.set(darkWorkspace ? (index === 0 ? 0x556159 : 0x303832) : (index === 0 ? 0xaeb4ad : 0xc6cac4));
      material.opacity = darkWorkspace ? (index === 0 ? 0.55 : 0.34) : 1;
      material.transparent = darkWorkspace;
      material.needsUpdate = true;
    });
  }, [appearance.environment, appearance.exposure, appearance.groundShadow]);

  // Number keys frame a standard view, the way CAD and DCC tools both behave.
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      const standard = STANDARD_VIEWS.find((item) => item.key === event.key);
      if (!standard) return;
      event.preventDefault();
      threeCtxRef.current?.applyStandardView(standard.id);
      onStatus(`${standard.label} view`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onStatus]);

  /**
   * The modal transform operators: G, R and S.
   *
   * The state machine lives in modal-transform.ts and knows nothing about the
   * camera. What is needed from here is a `ViewBasis` — where the screen's axes
   * point in the world, how much world one pixel covers at the pivot, and where
   * the pivot lands on screen — and the raw pointer and key events.
   *
   * Nothing is written to the document while the operator runs. Each change is
   * reported as a preview and only a confirm commits it, which is what makes
   * Escape a real undo rather than a second edit.
   */
  const meshBodiesRef = useRef(meshBodies);
  useEffect(() => { meshBodiesRef.current = meshBodies; }, [meshBodies]);

  const modalRef = useRef<ModalTransform | null>(null);
  // The listeners below are installed once and must see the latest target and
  // callbacks without being torn down and rebuilt on every render — which would
  // also drop the gesture in progress. A ref updated in its own effect is the
  // way to hand them across.
  const modalInputRef = useRef({ target: modalTarget, onChange: onModalChange, onCommit: onModalCommit });
  useEffect(() => {
    modalInputRef.current = { target: modalTarget, onChange: onModalChange, onCommit: onModalCommit };
  }, [modalTarget, onModalChange, onModalCommit]);

  useEffect(() => {
    if (!visible) return;
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const element = ctx.renderer.domElement;

    const viewBasisFor = (pivot: Triple): ViewBasis | null => {
      const camera = ctx.getActiveCamera();
      camera.updateMatrixWorld();
      const rect = element.getBoundingClientRect();
      if (rect.height < 1) return null;

      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      // A camera looks down its own -Z, so the third column negated is forward.
      const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate().normalize();

      const point = new THREE.Vector3(...pivot);
      const projected = point.clone().project(camera);
      const perspective = camera as THREE.PerspectiveCamera;
      const ortho = camera as THREE.OrthographicCamera;
      // How much world a pixel covers depends on the projection: on distance for
      // a perspective camera, and on the frustum alone for an orthographic one.
      const unitsPerPixel = ortho.isOrthographicCamera
        ? (ortho.top - ortho.bottom) / rect.height / (ortho.zoom || 1)
        : (2 * Math.tan((perspective.fov * Math.PI) / 360) * camera.position.distanceTo(point)) / rect.height;

      return {
        right: [right.x, right.y, right.z],
        up: [up.x, up.y, up.z],
        forward: [forward.x, forward.y, forward.z],
        unitsPerPixel,
        pivotScreen: {
          x: (projected.x * 0.5 + 0.5) * rect.width,
          y: (-projected.y * 0.5 + 0.5) * rect.height,
        },
      };
    };

    const pointerAt = (event: PointerEvent | MouseEvent) => {
      const rect = element.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const frameOf = () => modalInputRef.current.target?.frame as Vec3[] | undefined;

    /**
     * Where a move may land exactly.
     *
     * Gathered from the bodies the drag is *not* moving: snapping a thing to
     * itself is how a drag ends up unable to leave where it started. The radius
     * is ten pixels' worth of world at the pivot, so it feels the same distance
     * away whatever the zoom.
     */
    const snapContextFor = (basis: ViewBasis): SnapContext | undefined => {
      const target = modalInputRef.current.target;
      if (!target) return undefined;
      const candidates: SnapTarget[] = [];
      for (const body of meshBodiesRef.current) {
        if (body.id === target.meshId || !body.visible) continue;
        const matrix = body.worldMatrix;
        const placed = body.surface.positions.map((point) => [
          matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
          matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
          matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
        ] as Vec3);
        candidates.push(...snapTargetsOf(placed, body.surface.faces));
      }
      return {
        anchor: target.pivot as Vec3,
        candidates,
        radius: basis.unitsPerPixel * 10,
        gridIncrement: 0,
      };
    };

    const report = () => {
      const state = modalRef.current;
      const target = modalInputRef.current.target;
      if (!state || !target) return;
      const basis = viewBasisFor(target.pivot);
      if (!basis) return;
      const snapping = snapContextFor(basis);
      modalInputRef.current.onChange(
        transformValue(state, basis, frameOf(), snapping),
        describeTransform(state, basis, frameOf(), snapping),
      );
    };

    const finish = (commit: boolean) => {
      const state = modalRef.current;
      const target = modalInputRef.current.target;
      modalRef.current = null;
      // Orbiting was suspended so a drag could not spin the camera instead.
      ctx.controls.enabled = true;
      if (commit && state && target) {
        const basis = viewBasisFor(target.pivot);
        if (basis) {
          modalInputRef.current.onCommit(
            transformValue(state, basis, frameOf(), snapContextFor(basis)),
            target.pivot,
            target.vertices,
          );
        }
      }
      modalInputRef.current.onChange(null, "");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const focus = event.target as HTMLElement | null;
      if (focus && /^(INPUT|TEXTAREA|SELECT)$/.test(focus.tagName)) return;
      if (focus?.isContentEditable) return;

      if (modalRef.current) {
        // While the operator runs it owns the keyboard, or a digit would reach
        // the standard-view shortcuts instead of the number being typed.
        event.preventDefault();
        event.stopPropagation();
        modalRef.current = setModifiers(modalRef.current, { shift: event.shiftKey, ctrl: event.ctrlKey });
        const outcome = handleKey(modalRef.current, event.key, { shift: event.shiftKey });
        modalRef.current = outcome.state;
        if (outcome.action === "confirm") return finish(true);
        if (outcome.action === "cancel") return finish(false);
        return report();
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const kind = event.key === "g" || event.key === "G" ? "move"
        : event.key === "r" || event.key === "R" ? "rotate"
        : event.key === "s" || event.key === "S" ? "scale"
        : null;
      if (!kind) return;
      if (regionRef.current) return;
      if (brushInputRef.current?.painted && brushInputRef.current.weights.some((w) => w > 0)) {
        event.preventDefault();
        onStatus("Painted mask · use the nearby weighted controls; G/R/S operates on hard component selections");
        return;
      }
      const target = modalInputRef.current.target;
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      modalRef.current = beginTransform(kind, target.pivot, lastPointer);
      ctx.controls.enabled = false;
      report();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!modalRef.current) return;
      modalRef.current = setModifiers(modalRef.current, { shift: event.shiftKey, ctrl: event.ctrlKey });
      report();
    };

    let lastPointer = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      lastPointer = pointerAt(event);
      if (!modalRef.current) return;
      modalRef.current = handlePointer(modalRef.current, lastPointer);
      report();
    };

    const onPointerDownModal = (event: PointerEvent) => {
      if (!modalRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      finish(event.button === 0);
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!modalRef.current) return;
      event.preventDefault();
      finish(false);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerdown", onPointerDownModal, true);
    element.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerdown", onPointerDownModal, true);
      element.removeEventListener("contextmenu", onContextMenu);
      // A teardown mid-gesture must not leave orbiting switched off.
      if (modalRef.current) {
        modalRef.current = null;
        ctx.controls.enabled = true;
      }
    };
  }, [visible, sceneReady, onStatus]);

  /**
   * Box and lasso select: B and L.
   *
   * The region is drawn as a plain DOM overlay rather than in the scene. It is a
   * screen-space shape, it must sit on top of everything, and it has to survive
   * frames not being rendered — all three of which an absolutely-positioned div
   * gets for free and a mesh in the scene does not.
   *
   * Which items a region catches is decided in region-select.ts against the
   * *projected* vertices, so it agrees exactly with what is on screen rather
   * than approximating it with a raycast per candidate.
   */
  const regionInputRef = useRef({
    target: regionTarget,
    mode: selectionMode,
    onSelect: onRegionSelect,
    onSelectEntities: onRegionSelectEntities,
    exactMeshes,
    onComplete: onRegionRequestComplete,
  });
  useEffect(() => {
    regionInputRef.current = {
      target: regionTarget,
      mode: selectionMode,
      onSelect: onRegionSelect,
      onSelectEntities: onRegionSelectEntities,
      exactMeshes,
      onComplete: onRegionRequestComplete,
    };
  }, [exactMeshes, regionTarget, selectionMode, onRegionSelect, onRegionSelectEntities, onRegionRequestComplete]);

  useEffect(() => {
    if (!visible || !sceneReady) return;
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    if (!regionRequest) {
      if (regionRef.current?.armed) { regionRef.current = null; ctx.controls.enabled = true; }
      return;
    }
    if (regionRequest.scope !== "body" && !regionTarget) return;
    regionRef.current = {
      kind: regionRequest.kind,
      points: [],
      mode: regionRequest.combine,
      armed: true,
      scope: regionRequest.scope ?? "mesh",
    };
    ctx.controls.enabled = false;
    onStatus(regionRequest.kind === "polygon" ? "Polygon select · click corners, Enter or double-click to finish, Escape to cancel" : regionRequest.kind === "ellipse" ? "Ellipse select · drag an oval, Escape to cancel" : regionRequest.kind === "box"
      ? "Marquee select · drag a rectangle, Escape to cancel"
      : "Lasso select · drag around what you want, Escape to cancel");
  }, [onStatus, regionRequest, regionTarget, sceneReady, visible]);

  useEffect(() => {
    if (!visible) return;
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const element = ctx.renderer.domElement;
    const host = element.parentElement;
    if (!host) return;

    const overlay = document.createElement("div");
    overlay.className = "cad-region-overlay";
    overlay.style.display = "none";
    host.appendChild(overlay);

    const pointerAt = (event: PointerEvent | MouseEvent): ScreenPoint => {
      const rect = element.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const draw = () => {
      const drag = regionRef.current;
      if (!drag || drag.points.length < 2) {
        overlay.style.display = "none";
        return;
      }
      overlay.style.display = "block";
      overlay.style.borderRadius = drag.kind === "ellipse" ? "50%" : "0";
      if (drag.kind === "box" || drag.kind === "ellipse") {
        const [from] = drag.points;
        const to = drag.points[drag.points.length - 1];
        overlay.style.clipPath = "";
        overlay.style.left = `${Math.min(from.x, to.x)}px`;
        overlay.style.top = `${Math.min(from.y, to.y)}px`;
        overlay.style.width = `${Math.abs(to.x - from.x)}px`;
        overlay.style.height = `${Math.abs(to.y - from.y)}px`;
        return;
      }
      // A lasso is the same box stretched over the whole canvas, cut to the
      // traced outline — one element for both shapes.
      const rect = element.getBoundingClientRect();
      overlay.style.left = "0px";
      overlay.style.top = "0px";
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.clipPath = `polygon(${drag.points.map((point) => `${point.x}px ${point.y}px`).join(", ")})`;
    };

    const finish = (apply: boolean) => {
      const drag = regionRef.current;
      regionRef.current = null;
      overlay.style.display = "none";
      ctx.controls.enabled = true;
      regionInputRef.current.onComplete();
      if (!apply || !drag) return;

      const { target, mode, onSelect, onSelectEntities, exactMeshes: currentExactMeshes } = regionInputRef.current;
      const region = regionFromDrag(drag.kind, drag.points);
      if (!region) return;

      const camera = ctx.getActiveCamera();
      camera.updateMatrixWorld();
      const rect = element.getBoundingClientRect();
      if (rect.height < 1) return;

      if (drag.scope === "body") {
        const selected = currentExactMeshes.filter((mesh) => mesh.positions.length >= 3).filter((mesh) => {
          const bounds = new THREE.Box3();
          for (let index = 0; index + 2 < mesh.positions.length; index += 3) bounds.expandByPoint(new THREE.Vector3(mesh.positions[index], mesh.positions[index + 1], mesh.positions[index + 2]));
          const points = [bounds.getCenter(new THREE.Vector3())];
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z));
          const screenPoints = points.map((point) => {
            const projected = point.project(camera);
            if (projected.z < -1 || projected.z > 1) return null;
            return { x: (projected.x * 0.5 + 0.5) * rect.width, y: (-projected.y * 0.5 + 0.5) * rect.height };
          }).filter((point): point is ScreenPoint => point !== null);
          if (screenPoints.some((point) => regionContains(region, point))) return true;
          if (screenPoints.length === 0) return false;
          const minX = Math.min(...screenPoints.map((point) => point.x));
          const maxX = Math.max(...screenPoints.map((point) => point.x));
          const minY = Math.min(...screenPoints.map((point) => point.y));
          const maxY = Math.max(...screenPoints.map((point) => point.y));
          const outline = [
            { x: minX, y: minY }, { x: maxX, y: minY },
            { x: maxX, y: maxY }, { x: minX, y: maxY },
          ];
          if (region.kind === "box") {
            const selection = boxBounds(region);
            return selection.minX <= maxX && selection.maxX >= minX && selection.minY <= maxY && selection.maxY >= minY;
          }
          if (region.kind === "ellipse") {
            const bounds = boxBounds(region);
            const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
            if (center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY) return true;
          } else if (region.points.some((point) => point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY)) return true;
          return outline.some((point, index) => regionCrossesSegment(region, point, outline[(index + 1) % outline.length]));
        }).map((mesh) => mesh.sourceId);
        onSelectEntities([...new Set(selected)], drag.mode);
        return;
      }
      if (!target) return;

      const viewProjection = new THREE.Matrix4()
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const screen = projectVertices(
        target.surface, viewProjection.toArray(), rect.width, rect.height, target.worldMatrix,
      );

      // The viewer, so the far side of a solid is left alone. A perspective
      // camera gives a point; an orthographic one only a direction.
      const ortho = camera as THREE.OrthographicCamera;
      const inverseModel = new THREE.Matrix4().fromArray(target.worldMatrix).invert();
      const facing = ortho.isOrthographicCamera
        ? { forward: camera.getWorldDirection(new THREE.Vector3()).transformDirection(inverseModel).toArray() as Vec3 }
        : { eye: camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverseModel).toArray() as Vec3 };

      const found = selectInRegion(target.surface, screen, region, selectionThroughRef.current ? {} : facing);
      onSelect(itemsForMode(found, mode), drag.mode, describeRegionSelection(found, mode));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // A running modal transform owns the keyboard; B and L there are ordinary
      // keys it will ignore rather than a second gesture starting underneath.
      if (modalRef.current) return;
      const focus = event.target as HTMLElement | null;
      if (focus && /^(INPUT|TEXTAREA|SELECT)$/.test(focus.tagName)) return;
      if (focus?.isContentEditable) return;
      if (regionRef.current?.kind === "polygon" && event.key === "Enter") {
        event.preventDefault(); event.stopImmediatePropagation(); finish(true); return;
      }
      if (event.metaKey || event.altKey) return;

      const kind = event.key === "b" || event.key === "B" ? "box"
        : event.key === "l" || event.key === "L" ? "lasso"
        : null;
      if (!kind || (!regionInputRef.current.target && regionInputRef.current.exactMeshes.length === 0)) return;

      event.preventDefault();
      event.stopPropagation();
      // Armed, not dragging: the next press on the canvas begins the region, so
      // the key can be tapped and then aimed, as Blender's B does.
      regionRef.current = {
        kind,
        points: [],
        mode: event.shiftKey ? "extend" : event.ctrlKey ? "subtract" : "replace",
        armed: true,
        scope: regionInputRef.current.target ? "mesh" : "body",
      };
      ctx.controls.enabled = false;
      onStatus(kind === "box"
        ? "Box select · drag a rectangle, Escape to cancel"
        : "Lasso select · drag around what you want, Escape to cancel");
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!regionRef.current || event.key !== "Escape") return;
      event.preventDefault();
      finish(false);
      onStatus("Region select cancelled");
    };

    const onPointerDown = (event: PointerEvent) => {
      const drag = regionRef.current;
      if (!drag || event.button !== 0 || (!drag.armed && drag.kind !== "polygon")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      element.setPointerCapture(event.pointerId);
      const point = pointerAt(event);
      regionRef.current = { ...drag, armed: false, points: drag.kind === "polygon" ? (drag.armed ? [point, point] : [...drag.points.slice(0, -1), point, point]) : [point] };
      draw();
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = regionRef.current;
      if (!drag || drag.armed) return;
      const point = pointerAt(event);
      // A lasso keeps every step of the path; a box only needs its two corners,
      // so tracking every sample would grow the array for nothing.
      regionRef.current = drag.kind === "polygon" ? { ...drag, points: [...drag.points.slice(0, -1), point] } : drag.kind === "lasso"
        ? { ...drag, points: [...drag.points, point] }
        : { ...drag, points: [drag.points[0], point] };
      draw();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!regionRef.current || regionRef.current.armed) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      if (regionRef.current.kind === "polygon") return;
      finish(true);
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (regionRef.current?.kind !== "polygon") return;
      event.preventDefault(); event.stopImmediatePropagation(); finish(true);
    };
    const onPointerCancel = () => finish(false);

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    element.addEventListener("pointerdown", onPointerDown, true);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp, true);
    element.addEventListener("pointercancel", onPointerCancel);
    element.addEventListener("dblclick", onDoubleClick, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      element.removeEventListener("pointerdown", onPointerDown, true);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp, true);
      element.removeEventListener("pointercancel", onPointerCancel);
      element.removeEventListener("dblclick", onDoubleClick, true);
      overlay.remove();
      if (regionRef.current) {
        regionRef.current = null;
        ctx.controls.enabled = true;
      }
    };
  }, [visible, sceneReady, onStatus]);

  /**
   * Sculpt strokes.
   *
   * A stroke is a list of points *on the surface*, found by raycasting the body
   * under the pointer. Working in mesh space rather than screen space is what
   * lets the same stroke be replayed later: the samples mean something about the
   * model rather than about where the camera happened to be.
   *
   * Orbiting is suspended while the brush is down, or a drag would spin the view
   * and paint at the same time.
   */
  const strokeRef = useRef<StrokeSample[] | null>(null);
  const selectionBrushActive = !!selectionBrushInput?.brush;
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!visible || !sceneReady || !ctx || !selectionBrushActive) return;
    return installSelectionBrush(ctx.renderer.domElement,
      () => brushInputRef.current!, ctx.getActiveCamera,
      () => [...ctx.group.children, ...ctx.meshGroup.children].filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && !!(child.userData.meshFeatureId || child.userData.sourceEntityId)),
      ctx.controls, () => !!regionRef.current || !!modalRef.current);
  }, [visible, sceneReady, selectionBrushActive, selectionBrushInput?.target?.meshId]);
  const paintingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const element = ctx.renderer.domElement;
    const raycaster = new THREE.Raycaster();

    let activePointer: number | null = null;
    const releasePointer = () => {
      const pointer = activePointer;
      activePointer = null;
      if (pointer !== null && element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
    };
    const cancelStroke = () => {
      if (paintingRef.current) {
        paintingRef.current = false;
        paintInputRef.current.onPaintEnd?.(true);
      }
      if (strokeRef.current) {
        strokeRef.current = null;
        sculptInputRef.current.onStroke([], false);
      }
      if (activePointer !== null) ctx.controls.enabled = true;
      releasePointer();
    };
    const cancelPointer = (event: PointerEvent) => {
      if (event.pointerId === activePointer) cancelStroke();
    };
    const cancelKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activePointer !== null) {
        event.preventDefault();
        cancelStroke();
      }
    };

    /** Where the pointer meets the sculpt, in the body's own space. */
    const hit = (event: PointerEvent): StrokeSample | null => {
      const rect = element.getBoundingClientRect();
      if (rect.height < 1) return null;
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const camera = ctx.getActiveCamera();
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);

      const bodies = ctx.meshGroup.children
        .filter((child): child is THREE.Mesh =>
          child instanceof THREE.Mesh && child.userData.meshFeatureId != null);
      const struck = raycaster.intersectObjects(bodies, false)[0];
      if (!struck || !struck.face) return null;
      // A hit on another mesh must never deform the active mesh in that body's coordinates.
      if (struck.object.userData.meshFeatureId !== sculptInputRef.current.targetId) return null;

      // Back into the body's own coordinates: the samples have to survive the
      // body being moved afterwards, and a world-space stroke would not.
      const inverse = new THREE.Matrix4().copy(struck.object.matrixWorld).invert();
      const local = struck.point.clone().applyMatrix4(inverse);
      const normal = struck.face.normal.clone()
        .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(struck.object.matrixWorld))
        .applyMatrix3(new THREE.Matrix3().setFromMatrix4(inverse))
        .normalize();
      return {
        point: [local.x, local.y, local.z],
        normal: [normal.x, normal.y, normal.z],
        pressure: event.pressure > 0 ? event.pressure : 1,
      };
    };

    let lastPaint: { meshId: string; face: number | undefined; u: number; v: number } | null = null;
    const paintAt = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      if (rect.height < 1) return;
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const camera = ctx.getActiveCamera();
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      const bodies = ctx.meshGroup.children
        .filter((child): child is THREE.Mesh =>
          child instanceof THREE.Mesh && child.userData.meshFeatureId != null);
      const struck = raycaster.intersectObjects(bodies, false)[0];
      // three.js only fills `uv` when the geometry carries the attribute, which
      // it only does once the body has been unwrapped and given a texture.
      if (!struck?.uv) { lastPaint = null; return; }
      const next = { meshId: struck.object.userData.meshFeatureId as string, face: struck.faceIndex ?? undefined, u: struck.uv.x, v: struck.uv.y };
      // Fill gaps only within the same triangle: never draw a line across
      // unrelated UV islands when the pointer crosses a texture seam.
      const previous = lastPaint?.meshId === next.meshId && lastPaint.face !== undefined && lastPaint.face === next.face ? lastPaint : null;
      const steps = previous ? Math.min(64, Math.max(1, Math.ceil(Math.hypot(next.u - previous.u, next.v - previous.v) / Math.max(.001, paintInputRef.current.paintRadius * .3)))) : 1;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        paintInputRef.current.onPaint(next.meshId, previous ? previous.u + (next.u - previous.u) * t : next.u, previous ? previous.v + (next.v - previous.v) * t : next.v);
      }
      lastPaint = next;
    };

    const onPaintDown = (event: PointerEvent) => {
      if (activePointer !== null) return;
      if (!paintInputRef.current.painting || event.button !== 0) return;
      if (regionRef.current || modalRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      element.setPointerCapture(event.pointerId);
      activePointer = event.pointerId;
      ctx.controls.enabled = false;
      paintingRef.current = true;
      lastPaint = null;
      paintInputRef.current.onPaintBegin?.();
      paintAt(event);
    };

    const onPaintMove = (event: PointerEvent) => {
      if (paintingRef.current && event.pointerId === activePointer) {
        const samples = event.getCoalescedEvents?.() ?? [];
        for (const sample of samples.length ? samples : [event]) paintAt(sample);
      }
    };

    const onPaintUp = (event: PointerEvent) => {
      if (!paintingRef.current || event.pointerId !== activePointer) return;
      paintingRef.current = false;
      ctx.controls.enabled = true;
      paintInputRef.current.onPaintEnd?.(false);
      releasePointer();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (activePointer !== null) return;
      if (paintingRef.current || paintInputRef.current.painting) return;
      if (!sculptInputRef.current.brush || event.button !== 0) return;
      // A region drag or a modal transform owns the pointer if one is running.
      if (regionRef.current || modalRef.current) return;
      const first = hit(event);
      if (!first) return;

      event.preventDefault();
      event.stopPropagation();
      element.setPointerCapture(event.pointerId);
      activePointer = event.pointerId;
      ctx.controls.enabled = false;
      strokeRef.current = [first];
      sculptInputRef.current.onStroke([first], false);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!strokeRef.current || event.pointerId !== activePointer) return;
      const next = hit(event);
      if (!next) return;
      strokeRef.current = [...strokeRef.current, next];
      sculptInputRef.current.onStroke(strokeRef.current, false);
    };

    const onPointerUp = (event: PointerEvent) => {
      const stroke = strokeRef.current;
      if (!stroke || event.pointerId !== activePointer) return;
      event.preventDefault();
      event.stopPropagation();
      strokeRef.current = null;
      ctx.controls.enabled = true;
      sculptInputRef.current.onStroke(stroke, true);
      releasePointer();
    };

    element.addEventListener("pointerdown", onPaintDown, true);
    element.addEventListener("pointermove", onPaintMove);
    element.addEventListener("pointerup", onPaintUp, true);
    element.addEventListener("pointerdown", onPointerDown, true);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp, true);
    element.addEventListener("pointercancel", cancelPointer);
    element.addEventListener("lostpointercapture", cancelPointer);
    window.addEventListener("blur", cancelStroke);
    window.addEventListener("keydown", cancelKey);
    return () => {
      cancelStroke();
      element.removeEventListener("pointercancel", cancelPointer);
      element.removeEventListener("lostpointercapture", cancelPointer);
      window.removeEventListener("blur", cancelStroke);
      window.removeEventListener("keydown", cancelKey);
      element.removeEventListener("pointerdown", onPaintDown, true);
      element.removeEventListener("pointermove", onPaintMove);
      element.removeEventListener("pointerup", onPaintUp, true);
      element.removeEventListener("pointerdown", onPointerDown, true);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp, true);
      if (strokeRef.current || paintingRef.current) {
        if (paintingRef.current) paintInputRef.current.onPaintEnd?.(true);
        strokeRef.current = null;
        paintingRef.current = false;
        ctx.controls.enabled = true;
      }
    };
  }, [visible, sceneReady]);


  /**
   * Applies the presentation dial: technical reads as a drawing, rendered as a
   * photograph. Only lighting, materials and passes change here — never geometry,
   * so switching modes never triggers a rebuild.
   */
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const recipe = VIEWPORT_SHADING[viewport.shading];
    const environment = CAD_ENVIRONMENTS[appearance.environment];

    ctx.setProjection(effectiveProjection(viewport));
    ctx.renderer.shadowMap.enabled = recipe.shadows;
    ctx.renderer.toneMappingExposure = appearance.exposure * recipe.exposureScale;
    ctx.scene.environment = recipe.environmentIntensity > 0 ? ctx.environment : null;
    // Falls back to the light rig alone when image-based lighting is unavailable.
    ctx.scene.environmentIntensity = recipe.environmentIntensity;
    ctx.grid.visible = recipe.grid;
    ctx.ground.visible = recipe.groundShadow && appearance.groundShadow;
    ctx.keyLight.castShadow = recipe.shadows;
    ctx.useComposer(recipe.ambientOcclusion);

    // Technical mode lifts the lighting to a near-constant wash so surfaces read as
    // measurable rather than lit; the other modes keep the environment's own rig.
    ctx.hemisphere.intensity = recipe.flatSurfaces
      ? 2.6
      : environment.hemisphereIntensity * recipe.lightIntensity;
    ctx.keyLight.intensity = environment.keyIntensity * recipe.lightIntensity;
    ctx.fillLight.intensity = environment.fillIntensity * recipe.lightIntensity;

    ctx.group.traverse((object) => {
      if (object instanceof THREE.LineSegments) {
        const lineMaterial = object.material as THREE.LineBasicMaterial;
        // Selection highlights own their own opacity; leave those alone.
        if (object.userData.isHighlight) return;
        lineMaterial.opacity = recipe.edgeOpacity;
        lineMaterial.visible = recipe.edgeOpacity > 0.01;
        lineMaterial.needsUpdate = true;
        return;
      }
      if (!(object instanceof THREE.Mesh)) return;
      const meshMaterial = object.material as THREE.MeshPhysicalMaterial;
      if (!meshMaterial || !("metalness" in meshMaterial)) return;
      object.castShadow = recipe.shadows;
      object.receiveShadow = recipe.shadows;
      meshMaterial.envMapIntensity = recipe.environmentIntensity;
      if (recipe.flatSurfaces) {
        meshMaterial.metalness = 0;
        meshMaterial.roughness = 1;
        meshMaterial.clearcoat = 0;
      } else {
        const base = object.userData.appearance as
          | { metalness: number; roughness: number; clearcoat: number }
          | undefined;
        meshMaterial.metalness = base?.metalness ?? appearance.metalness;
        meshMaterial.roughness = base?.roughness ?? appearance.roughness;
        meshMaterial.clearcoat = base?.clearcoat ?? appearance.clearcoat;
      }
      meshMaterial.needsUpdate = true;
    });
  }, [appearance, modelState, viewport]);

  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const topologyId = selectedTopologyIds.at(-1);
    const directKind = pickMode === "edit-face" ? "face" : pickMode === "edge" ? "edge" : null;
    if (visible && topologyId && directKind) {
      const exactMesh = exactMeshes.find((mesh) => directKind === "face"
        ? mesh.faceTopologyIds.includes(topologyId)
        : mesh.edgeTopologyIds.includes(topologyId));
      if (exactMesh) {
        const points: THREE.Vector3[] = [];
        const normal = new THREE.Vector3();
        if (directKind === "face") {
          const groupIndex = exactMesh.faceTopologyIds.indexOf(topologyId) * 3;
          const start = exactMesh.faceGroups[groupIndex];
          const count = exactMesh.faceGroups[groupIndex + 1];
          for (let index = start; index < start + count; index += 1) {
            const vertex = exactMesh.indices[index] * 3;
            points.push(new THREE.Vector3(exactMesh.positions[vertex], exactMesh.positions[vertex + 1], exactMesh.positions[vertex + 2]));
            normal.add(new THREE.Vector3(exactMesh.normals[vertex], exactMesh.normals[vertex + 1], exactMesh.normals[vertex + 2]));
          }
        } else {
          const groupIndex = exactMesh.edgeTopologyIds.indexOf(topologyId) * 3;
          const start = exactMesh.edgeGroups[groupIndex];
          const count = exactMesh.edgeGroups[groupIndex + 1];
          for (let index = start; index + 2 < start + count; index += 3) {
            points.push(new THREE.Vector3(exactMesh.edgePositions[index], exactMesh.edgePositions[index + 1], exactMesh.edgePositions[index + 2]));
          }
          const bounds = new THREE.Box3();
          for (let index = 0; index + 2 < exactMesh.positions.length; index += 3) bounds.expandByPoint(new THREE.Vector3(exactMesh.positions[index], exactMesh.positions[index + 1], exactMesh.positions[index + 2]));
          const bodyCenter = bounds.getCenter(new THREE.Vector3());
          const edgeCenter = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, points.length));
          normal.copy(edgeCenter).sub(bodyCenter);
        }
        if (points.length > 0) {
          const semanticAxis = directKind === "face"
            ? topologyId.match(/:face:(?:plane|cylinder)-([+-])([xyz])-/)
            : null;
          if (semanticAxis) {
            normal.set(0, 0, 0);
            normal[semanticAxis[2] as "x" | "y" | "z"] = semanticAxis[1] === "+" ? 1 : -1;
          }
          let center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
          if (directKind === "face" && topologyId.includes(":face:cylinder-") && normal.lengthSq() > 0) {
            const furthest = Math.max(...points.map((point) => point.dot(normal)));
            const anchors = points.filter((point) => Math.abs(point.dot(normal) - furthest) < 0.001);
            if (anchors.length) center = anchors.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / anchors.length);
          }
          if (directKind === "face") {
            const bounds = new THREE.Box3();
            for (let index = 0; index + 2 < exactMesh.positions.length; index += 3) bounds.expandByPoint(new THREE.Vector3(exactMesh.positions[index], exactMesh.positions[index + 1], exactMesh.positions[index + 2]));
            const outward = center.clone().sub(bounds.getCenter(new THREE.Vector3()));
            if (normal.dot(outward) < 0) normal.multiplyScalar(-1);
          }
          if (normal.lengthSq() < 1e-9) normal.set(0, 0, 1);
          normal.normalize();
          ctx.directProxy.position.copy(center);
          ctx.directProxy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
          ctx.directProxy.userData.directEdit = {
            sourceEntityId: exactMesh.sourceId,
            topologyId,
            kind: directKind,
            axis: [normal.x, normal.y, normal.z] as Triple,
          };
          ctx.directProxy.visible = true;
          ctx.directProxy.updateMatrixWorld(true);
          ctx.transform.setSpace("local");
          ctx.transform.showX = false;
          ctx.transform.showY = false;
          ctx.transform.showZ = true;
          ctx.transform.setSize(0.68);
          ctx.transform.attach(ctx.directProxy);
          return;
        }
      }
    }
    ctx.directProxy.visible = false;
    delete ctx.directProxy.userData.directEdit;
    ctx.transform.showX = true;
    ctx.transform.showY = true;
    ctx.transform.showZ = true;
    ctx.transform.setSpace("world");
    ctx.transform.setSize(0.75);
    if (!visible || pickMode !== "entity") {
      ctx.transform.detach();
      return;
    }
    const meshes = ctx.group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    const target = meshes.find((mesh) => (mesh.userData?.sourceEntityId as string | undefined) === selectedId);
    if (target) ctx.transform.attach(target);
    else ctx.transform.detach();
  }, [exactMeshes, selectedId, selectedTopologyIds, visible, pickMode, modelState, sketchPlanes]);

  /** Draws the sculpted bodies. Their cages live in the document; this shows the surface. */
  const meshDisplayRef = useRef<{ bodies: ViewportMeshBody[]; group: THREE.Group; mode: typeof selectionMode; shading: typeof viewport.shading } | null>(null);
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const previous = meshDisplayRef.current;
    const equal = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((value, index) => value === b[index]);
    // Paint changes pixels, not topology. Reuse geometry and GPU materials for
    // dabs, Undo and cancellation instead of triangulating the scene each time.
    const pixelsOnly = previous && previous.group === ctx.meshGroup && previous.mode === selectionMode && previous.shading === viewport.shading
      && previous.bodies.length === meshBodies.length && meshBodies.every((body, index) => {
        const before = previous.bodies[index];
        return body.id === before.id && body.surface === before.surface && body.visible === before.visible
          && body.shadingAngle === before.shadingAngle && body.uvOfCorner === before.uvOfCorner
          && body.texture?.size === before.texture?.size && equal(body.worldMatrix, before.worldMatrix)
          && equal(body.selectedFaces, before.selectedFaces) && equal(body.selectedEdges, before.selectedEdges) && equal(body.selectedVertices, before.selectedVertices);
      });
    meshDisplayRef.current = { bodies: meshBodies, group: ctx.meshGroup, mode: selectionMode, shading: viewport.shading };
    if (pixelsOnly) {
      for (const child of ctx.meshGroup.children) {
        if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshPhysicalMaterial)) continue;
        const texture = meshBodies.find((body) => body.id === child.userData.meshFeatureId)?.texture;
        if (texture && child.material.map instanceof THREE.DataTexture) {
          updatePaintDataTexture(child.material.map, texture.pixels);
        }
      }
      return;
    }
    while (ctx.meshGroup.children.length) {
      const child = ctx.meshGroup.children[0];
      ctx.meshGroup.remove(child);
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (material) (Array.isArray(material) ? material : [material]).forEach((item) => {
        if (item instanceof THREE.MeshPhysicalMaterial) item.map?.dispose();
        item.dispose();
      });
    }

    for (const body of meshBodies) {
      if (body.surface.faces.length === 0 || !body.visible) continue;
      // Auto-smooth rather than a plain triangulation: one normal per vertex
      // would shade a cage's hard corners as though they were rounded.
      const shaded = shadeAuto(body.surface, body.shadingAngle);
      // A UV belongs to a face *corner*, while shadeAuto splits vertices by
      // smoothing group, so a seam that is not also a crease leaves one vertex
      // carrying two UVs. withCornerUvs splits those, which is the only way the
      // texture lands right along the seam.
      const textured = body.uvOfCorner && body.texture
        ? withCornerUvs(shaded, body.uvOfCorner)
        : null;
      const { positions, normals, indices, faceOfTriangle } = textured ?? shaded;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      let map: THREE.DataTexture | null = null;
      if (textured && body.texture) {
        geometry.setAttribute("uv", new THREE.BufferAttribute(textured.uvs, 2));

        map = new THREE.DataTexture(
          new Uint8Array(body.texture.pixels.buffer.slice(0)),
          body.texture.size, body.texture.size, THREE.RGBAFormat,
        );
        map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true;
      }
      geometry.computeBoundingSphere();

      const selected = selectionMode === "face" ? body.selectedFaces.length > 0
        : selectionMode === "edge" ? body.selectedEdges.length > 0
        : body.selectedVertices.length > 0;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
        color: map ? 0xffffff : (selected ? 0xaac8cd : 0x9fb6c9),
        map,
        metalness: 0.05,
        roughness: 0.55,
        side: THREE.DoubleSide,
      }));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.meshFeatureId = body.id;
      mesh.userData.faceOfTriangle = faceOfTriangle;
      // The world matrix already has every ancestor folded in, so the mesh is
      // placed directly rather than nested in a chain of three.js objects.
      mesh.matrixAutoUpdate = false;
      mesh.matrix.fromArray(body.worldMatrix);
      mesh.matrixWorldNeedsUpdate = true;
      ctx.meshGroup.add(mesh);

      // Highlight the active component type itself; a selected edge or vertex
      // must not look like an arbitrarily selected face merely because the
      // selection can also be converted into faces for an operation.
      if (selectionMode === "face" && body.selectedFaces.length > 0) {
        const picked = new Set(body.selectedFaces);
        const highlightIndices: number[] = [];
        for (let triangle = 0; triangle < faceOfTriangle.length; triangle += 1) {
          if (!picked.has(faceOfTriangle[triangle])) continue;
          highlightIndices.push(indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]);
        }
        if (highlightIndices.length > 0) {
          const highlight = new THREE.BufferGeometry();
          highlight.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          highlight.setIndex(highlightIndices);
          const overlay = new THREE.Mesh(highlight, new THREE.MeshBasicMaterial({
            color: 0x72e7dd, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
            depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
          }));
          // The highlight has to be placed the same way as the body it marks,
          // or it floats at the origin while the body sits elsewhere.
          overlay.matrixAutoUpdate = false;
          overlay.matrix.fromArray(body.worldMatrix);
          overlay.matrixWorldNeedsUpdate = true;
          ctx.meshGroup.add(overlay);
        }
        const boundary = [...buildEdgeMap(body.surface).values()].filter((edge) => edge.faces.some((f) => picked.has(f)) && (edge.faces.length === 1 || edge.faces.some((f) => !picked.has(f))));
        const outline = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(boundary.flatMap(({ a, b }) => [new THREE.Vector3(...body.surface.positions[a]), new THREE.Vector3(...body.surface.positions[b])])), new THREE.LineBasicMaterial({ color: 0x91fff0, transparent: true, opacity: 0.9, depthWrite: false }));
        outline.matrixAutoUpdate = false;
        outline.matrix.fromArray(body.worldMatrix);
        ctx.meshGroup.add(outline);
      }

      if (selectionMode === "edge" && body.selectedEdges.length > 0) {
        const points = body.selectedEdges.flatMap((key) => {
          const [a, b] = parseEdgeKey(key);
          const from = body.surface.positions[a];
          const to = body.surface.positions[b];
          return from && to
            ? [new THREE.Vector3(...from), new THREE.Vector3(...to)]
            : [];
        });
        if (points.length > 0) {
          const highlight = new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: 0xd7ff78, depthTest: false }),
          );
          highlight.renderOrder = 20;
          highlight.matrixAutoUpdate = false;
          highlight.matrix.fromArray(body.worldMatrix);
          highlight.matrixWorldNeedsUpdate = true;
          ctx.meshGroup.add(highlight);
        }
      }

      if (selectionMode === "vertex" && body.selectedVertices.length > 0) {
        const points = body.selectedVertices
          .map((index) => body.surface.positions[index])
          .filter((point): point is [number, number, number] => Boolean(point))
          .map((point) => new THREE.Vector3(...point));
        if (points.length > 0) {
          const highlight = new THREE.Points(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.PointsMaterial({ color: 0xd7ff78, size: 7, sizeAttenuation: false, depthTest: false }),
          );
          highlight.renderOrder = 20;
          highlight.matrixAutoUpdate = false;
          highlight.matrix.fromArray(body.worldMatrix);
          highlight.matrixWorldNeedsUpdate = true;
          ctx.meshGroup.add(highlight);
        }
      }

      if (selectionMode === "edge" || viewport.shading === "technical") {
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 20),
        new THREE.LineBasicMaterial({ color: 0x0d1210, transparent: true, opacity: 0.35 }),
      );
      wire.matrixAutoUpdate = false;
      wire.matrix.fromArray(body.worldMatrix);
      wire.matrixWorldNeedsUpdate = true;
      ctx.meshGroup.add(wire);
      }
    }
  }, [meshBodies, selectionMode, viewport.shading, sceneReady]);

  const maskTarget = selectionBrushInput?.target;
  const maskWeights = selectionBrushInput?.weights;
  const maskThrough = selectionBrushInput?.brush?.through;
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx || !maskTarget || !maskWeights?.some((w) => w > 0)) return;
    const { surface, worldMatrix } = maskTarget;
    const positions: number[] = [];
    const colors: number[] = [];
    // Per-corner alpha makes the mask feather continuously over triangles.
    for (const face of surface.faces) for (let i = 1; i < face.length - 1; i++) {
      const vertices = [face[0], face[i], face[i + 1]];
      if (!vertices.some((v) => maskWeights[v] > 0)) continue;
      for (const v of vertices) { positions.push(...surface.positions[v]); colors.push(0.28, 1, 0.83, (maskWeights[v] ?? 0) * 0.65); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthTest: !maskThrough, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const overlay = new THREE.Mesh(geometry, material);
    overlay.matrixAutoUpdate = false;
    overlay.matrix.fromArray(worldMatrix);
    ctx.scene.add(overlay);
    return () => { ctx.scene.remove(overlay); geometry.dispose(); material.dispose(); };
  }, [maskTarget, maskWeights, maskThrough, sceneReady]);

  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx || !selectionHud || !regionTarget) { setHudAnchor(null); return; }
    const reposition = () => {
      const body = meshBodies.find((b) => b.id === regionTarget.meshId);
      const mask = brushInputRef.current?.weights;
      const chosen = mask?.some((w) => w > 0) ? mask.flatMap((w, i) => w > 0.05 ? [i] : []) : body?.selectedVertices ?? [];
      const vertices = chosen.length ? chosen : regionTarget.surface.positions.map((_, i) => i);
      if (!vertices.length) return;
      const center = new THREE.Vector3();
      vertices.forEach((i) => { const p = regionTarget.surface.positions[i]; if (p) center.add(new THREE.Vector3(...p)); });
      center.divideScalar(vertices.length).applyMatrix4(new THREE.Matrix4().fromArray(regionTarget.worldMatrix));
      const camera = ctx.getActiveCamera(); camera.updateMatrixWorld(); center.project(camera);
      const canvas = ctx.renderer.domElement;
      const width = canvas.clientWidth; const height = canvas.clientHeight;
      if (center.z < -1 || center.z > 1 || width < 360 || height < 340) { setHudAnchor(null); return; }
      const anchor = { x: Math.max(12, Math.min(width - 292, (center.x * 0.5 + 0.5) * width + 50)), y: Math.max(96, Math.min(height - 280, (-center.y * 0.5 + 0.5) * height - 40)) };
      setHudAnchor((old) => old && Math.abs(old.x - anchor.x) < 1 && Math.abs(old.y - anchor.y) < 1 ? old : anchor);
    };
    reposition(); ctx.controls.addEventListener("change", reposition);
    const resize = new ResizeObserver(reposition); resize.observe(ctx.renderer.domElement);
    return () => { ctx.controls.removeEventListener("change", reposition); resize.disconnect(); };
  }, [selectionHud, regionTarget, meshBodies, sceneReady]);

  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const existing = ctx.scene.getObjectByName("active-plane-helper");
    if (existing) {
      ctx.scene.remove(existing);
      existing.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (material) (Array.isArray(material) ? material : [material]).forEach((m) => m.dispose());
      });
    }
    if (activeSketchPlaneId === WORLD_PLANE_ID) return;
    const plane = planeById(sketchPlanes, activeSketchPlaneId);
    const helper = new THREE.Group();
    helper.name = "active-plane-helper";
    const basis = planeBasisMatrix(plane);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshBasicMaterial({ color: 0xd7ff78, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    quad.applyMatrix4(basis);
    helper.add(quad);
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(60, 60)),
      new THREE.LineBasicMaterial({ color: 0xd7ff78, transparent: true, opacity: 0.85 }),
    );
    outline.applyMatrix4(basis);
    helper.add(outline);
    const uLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(30, 0, 0)]),
      new THREE.LineBasicMaterial({ color: 0xff6b6b }),
    );
    uLine.applyMatrix4(basis);
    helper.add(uLine);
    const vLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 30, 0)]),
      new THREE.LineBasicMaterial({ color: 0x8dff8d }),
    );
    vLine.applyMatrix4(basis);
    helper.add(vLine);
    ctx.scene.add(helper);
  }, [activeSketchPlaneId, sketchPlanes]);

  // WebKit can suspend rAF while a native window is inactive. Scene effects
  // still run, so draw their completed result instead of leaving the initial
  // empty frame on screen until animation happens to resume.
  useEffect(() => {
    if (visible) threeCtxRef.current?.renderOnce();
  }, [visible, sceneReady, entities, exactMeshes, layers, modelState, sketchPlanes,
    activeSketchPlaneId, softBodyPreview, physicsTransforms, meshBodies, appearance,
    viewport, explodedAssembly, selectedId, selectedIds, selectedTopologyIds,
    hoveredSourceId, hoveredTopologyId, maskWeights, maskThrough, selectionMode]);

  return <>
    <div ref={three3dRef} className="cad-3d" style={{ display: visible ? "block" : "none" }} aria-label="3D model viewport" />
    {visible && selectionHud && hudAnchor && <div className="form-selection-hud" style={{ left: hudAnchor.x, top: hudAnchor.y }}>{selectionHud}</div>}
    {visible && !selectionHud && <div className="cad-pick-feedback" aria-label="Viewport selection feedback">
      <strong>{pickMode === "edge" ? "Edge selection" : pickMode === "entity" ? "Body selection" : "Face selection"}</strong>
      <span>{hoveredTopologyId ? `Hover: ${hoveredTopologyId.includes(":edge:") ? "edge" : "face"} · click to select` : hoveredSourceId ? "Hover: body · click to select" : "Move over geometry to preview selection"}</span>
      <small>{selectedTopologyIds.length ? `${selectedTopologyIds.length} topology target(s) selected · ` : ""}Shift adds/removes · Esc clears</small>
    </div>}
    {visible && (
      <div className="cad-viewport-bar" title={describeViewport(viewport)}>
        <div className="cad-shading-switch" role="group" aria-label="Viewport shading">
          {SHADING_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              className={viewport.shading === mode ? "active" : ""}
              title={VIEWPORT_SHADING[mode].hint}
              onClick={() => {
                onViewportChange({ ...viewport, shading: mode });
                onStatus(`${VIEWPORT_SHADING[mode].label} view · ${VIEWPORT_SHADING[mode].hint}`);
              }}
            >{VIEWPORT_SHADING[mode].label}</button>
          ))}
        </div>
        <button
          type="button"
          className={`cad-projection-toggle${viewport.projection ? " pinned" : ""}`}
          title={viewport.projection
            ? "Projection pinned — click to follow the shading mode again"
            : "Projection follows the shading mode — click to pin it"}
          onClick={() => {
            const nextProjection: CameraProjection = effectiveProjection(viewport) === "orthographic" ? "perspective" : "orthographic";
            onViewportChange({ ...viewport, projection: nextProjection });
            onStatus(`${nextProjection === "orthographic" ? "Orthographic" : "Perspective"} projection pinned`);
          }}
        >{effectiveProjection(viewport) === "orthographic" ? "Ortho" : "Persp"}</button>
        <div className="cad-standard-views" role="group" aria-label="Standard views">
          {STANDARD_VIEWS.map((standard) => (
            <button
              key={standard.id}
              type="button"
              title={`${standard.label} view (${standard.key})`}
              onClick={() => {
                threeCtxRef.current?.applyStandardView(standard.id);
                onStatus(`${standard.label} view`);
              }}
            >{standard.label.slice(0, standard.id === "iso" ? 3 : 1)}</button>
          ))}
        </div>
      </div>
    )}
  </>;
}
